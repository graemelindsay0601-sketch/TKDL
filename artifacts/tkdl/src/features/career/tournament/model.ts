/**
 * Workstream B — tournament presentation model. Pure functions over the real
 * tournament read (A3 draw/results, A4 prize ladder, A5 rankings, A7.2 meetings).
 * Nothing here decides a sporting outcome: it only names, orders and explains
 * facts the server already persisted. Missing facts stay missing.
 */
import type { TournamentView } from "../api";

export type TView = TournamentView;
export type TMatch = TView["matches"][number];
export type TPlayer = TView["field"][number];

const FINAL = new Set(["COMPLETED", "BYE", "WALKOVER", "VOID"]);
export const isGroup = (m: Pick<TMatch, "stage_key">) => m.stage_key.startsWith("groups:");
export const involvesHuman = (m: Pick<TMatch, "a_key" | "b_key">) => m.a_key === "HUMAN" || m.b_key === "HUMAN";
export const isFinal = (m: Pick<TMatch, "status">) => FINAL.has(m.status);

// ---------------------------------------------------------------- tier identity
export type TierKey = "GRASSROOTS" | "REGIONAL" | "DEVELOPMENT" | "PROFESSIONAL" | "MAJOR" | "WORLD";
export type TierProfile = { key: TierKey; label: string; kicker: string; arrival: string; stage: string };

const PROFILES: Record<TierKey, TierProfile> = {
  GRASSROOTS: { key: "GRASSROOTS", label: "Grassroots", kicker: "Club & community darts", stage: "Club oche",
    arrival: "A local field, a handful of boards and every leg counted the same way as on the big stage." },
  REGIONAL: { key: "REGIONAL", label: "Regional", kicker: "Regional & national circuit", stage: "Open floor",
    arrival: "A wider field drawn from across the region. Results here build a reputation beyond your home venue." },
  DEVELOPMENT: { key: "DEVELOPMENT", label: "Development", kicker: "Development tour", stage: "Tour floor",
    arrival: "Players without a Tour Card chasing ranking points, finals places and the next step up." },
  PROFESSIONAL: { key: "PROFESSIONAL", label: "Professional", kicker: "Professional tour", stage: "Tour floor",
    arrival: "Tour professionals, seeded draws and ranking money on the line." },
  MAJOR: { key: "MAJOR", label: "Major", kicker: "Major championship", stage: "Major stage",
    arrival: "A locked championship field, longer matches and one of the sport's established titles." },
  WORLD: { key: "WORLD", label: "World Championship", kicker: "The Palace · World Championship", stage: "The Palace",
    arrival: "The world's best in a set-play bracket at the sport's permanent home." },
};

/** Tier from the tournament read: importance level first, then the event's content class. */
export function tierProfile(level: number, eventClass?: string | null): TierProfile {
  if (level >= 5 || eventClass === "WORLD_CHAMPIONSHIP") return PROFILES.WORLD;
  if (level === 4 || eventClass === "MAJOR") return PROFILES.MAJOR;
  if (eventClass === "SECONDARY_TOUR") return PROFILES.DEVELOPMENT;
  if (level === 3 || ["PROFESSIONAL_TOUR", "STAGE_SERIES"].includes(eventClass ?? "")) return PROFILES.PROFESSIONAL;
  if (["REGIONAL", "NATIONAL", "INTERNATIONAL_OPEN"].includes(eventClass ?? "") || level === 2) return PROFILES.REGIONAL;
  return PROFILES.GRASSROOTS;
}

/** Tier from a calendar event (A3 presentation tier + circuit), used on the entry screen. */
export function tierFromEvent(tier: string, circuit: string): TierProfile {
  if (tier === "WORLD" || circuit === "WORLD_CHAMPIONSHIP") return PROFILES.WORLD;
  if (tier === "MAJOR" || circuit === "MAJOR") return PROFILES.MAJOR;
  // Second-tier tours (Challenger, Vault, Q-School, regional affiliate tours) are for players without a Tour Card.
  if (["CHALLENGER", "VAULT", "Q_SCHOOL"].includes(circuit)) return PROFILES.DEVELOPMENT;
  if (["PRO_CIRCUIT", "EUROPEAN_SERIES", "WORLD_SERIES", "INVITATIONAL"].includes(circuit) || tier === "TELEVISED")
    return PROFILES.PROFESSIONAL;
  if (["NATIONAL_AMATEUR", "COUNTY", "REGIONAL"].includes(circuit) || tier === "FEATURED") return PROFILES.REGIONAL;
  return PROFILES.GRASSROOTS;
}

// ---------------------------------------------------------------- stages & bracket
export function knockoutRounds(matches: Pick<TMatch, "stage_key" | "round">[]) {
  const ko = matches.filter(m => !isGroup(m));
  return ko.length ? Math.max(...ko.map(m => m.round)) : 0;
}
/** Same naming as A3's stageName: remaining players = 2^(rounds-round+1). */
export function roundLabel(round: number, rounds: number) {
  const remaining = 2 ** (rounds - round + 1);
  return remaining === 2 ? "Final" : remaining === 4 ? "Semi-final" : remaining === 8 ? "Quarter-final" : `Last ${remaining}`;
}
export function stageOf(m: Pick<TMatch, "stage_key" | "round">, rounds: number) {
  return isGroup(m) ? `Group ${m.stage_key.split(":")[1]} · Round ${m.round}` : roundLabel(m.round, rounds);
}

export type BracketColumn = { round: number; label: string; matches: TMatch[] };
/** Knockout columns in persisted slot order. No recomputation of who plays whom. */
export function bracketColumns(v: Pick<TView, "matches">): BracketColumn[] {
  const rounds = knockoutRounds(v.matches);
  return Array.from({ length: rounds }, (_, i) => i + 1).map(round => ({
    round, label: roundLabel(round, rounds),
    matches: v.matches.filter(m => !isGroup(m) && m.round === round).sort((a, b) => a.slot - b.slot),
  }));
}

/** The player's own fixtures, groups first then knockout rounds. */
export function humanPath(v: Pick<TView, "matches">) {
  return v.matches.filter(involvesHuman).sort((a, b) => Number(!isGroup(a)) - Number(!isGroup(b)) || a.round - b.round || a.slot - b.slot);
}

export type NextOpponent =
  | { kind: "KNOWN"; key: string; viaMatch: TMatch | null }
  | { kind: "PENDING"; feeder: TMatch }
  | { kind: "NONE" };
/**
 * Who the player meets next if they win `m`, from the persisted bracket only:
 * the sibling slot's winner (A3 fills slot ceil(s/2) from slots 2k-1 and 2k).
 */
export function opponentIfWin(v: Pick<TView, "matches">, m: TMatch): NextOpponent {
  if (isGroup(m)) return { kind: "NONE" };
  const rounds = knockoutRounds(v.matches);
  if (m.round >= rounds) return { kind: "NONE" };
  const next = v.matches.find(x => x.stage_key === m.stage_key && x.round === m.round + 1 && x.slot === Math.ceil(m.slot / 2));
  const mySide = m.slot % 2 === 1 ? "a" : "b";
  const other = next ? (mySide === "a" ? next.b_key : next.a_key) : null;
  if (other) return { kind: "KNOWN", key: other, viaMatch: null };
  const siblingSlot = m.slot % 2 === 1 ? m.slot + 1 : m.slot - 1;
  const feeder = v.matches.find(x => x.stage_key === m.stage_key && x.round === m.round && x.slot === siblingSlot);
  if (!feeder) return { kind: "NONE" };
  if (isFinal(feeder) && feeder.winner_key) return { kind: "KNOWN", key: feeder.winner_key, viaMatch: feeder };
  return { kind: "PENDING", feeder };
}

// ---------------------------------------------------------------- opponent dossier
export type Dossier = {
  player: TPlayer;
  ranking: string; titles: string; nationality: string;
  meetings: { played: number; humanWins: number; npcWins: number; latest: string | null; labels: string[] } | null;
  thisEvent: { round: string; opponent: string; score: string | null; how: string }[];
};
/** Facts only: published ranking, recorded titles, A7.2 meetings and this event's saved results. */
export function dossier(v: Pick<TView, "matches" | "field" | "opponents">, key: string): Dossier | null {
  const player = v.field.find(p => p.key === key);
  if (!player) return null;
  const rounds = knockoutRounds(v.matches);
  const nameOf = (k: string | null) => k === "HUMAN" ? "You" : v.field.find(p => p.key === k)?.name ?? "Unknown";
  const h2h = v.opponents.find(o => o.key === key);
  const thisEvent = v.matches.filter(m => (m.a_key === key || m.b_key === key) && isFinal(m) && !involvesHuman(m))
    .sort((a, b) => Number(!isGroup(a)) - Number(!isGroup(b)) || a.round - b.round)
    .map(m => {
      const mine = m.a_key === key, other = mine ? m.b_key : m.a_key;
      const score = m.legs_a !== null && m.legs_b !== null ? (mine ? `${m.legs_a}–${m.legs_b}` : `${m.legs_b}–${m.legs_a}`) : null;
      const how = m.status === "BYE" ? "Bye" : m.status === "WALKOVER" ? (m.winner_key === key ? "Walkover win" : "Walkover loss")
        : m.status === "VOID" ? "Void" : m.winner_key === key ? "Won" : "Lost";
      return { round: stageOf(m, rounds), opponent: m.status === "BYE" ? "—" : nameOf(other), score: m.status === "COMPLETED" ? score : null, how };
    });
  return {
    player,
    ranking: player.ranking ? `World #${player.ranking}` : "Unranked",
    titles: player.titles ? `${player.titles} recorded title${player.titles === 1 ? "" : "s"}` : "No recorded titles",
    nationality: player.nationality || "Country not recorded",
    meetings: h2h ? { played: h2h.meetings, humanWins: h2h.humanWins, npcWins: h2h.npcWins,
      latest: h2h.latestMeeting ? `${h2h.latestMeeting.name}, season ${h2h.latestMeeting.season}` : null, labels: h2h.labels } : null,
    thisEvent,
  };
}

// ---------------------------------------------------------------- result significance
export type Significance = "TITLE" | "FINAL_REACHED" | "SEMI_REACHED" | "QUARTER_REACHED" | "WIN" | "GROUP_WIN"
  | "GROUP_LOSS" | "ELIMINATED" | "RUNNER_UP";
export type ResultMoment = { significance: Significance; headline: string; detail: string; milestone: boolean };

/**
 * Classifies the player's most recent decided match from saved facts. A win in
 * round r of R takes the player to round r+1; a final win is a title only when
 * the server says the player is champion.
 */
export function resultMoment(v: Pick<TView, "matches" | "phase" | "event" | "achievements">, m: TMatch | null): ResultMoment | null {
  if (!m || !involvesHuman(m) || !isFinal(m) || m.status === "BYE") return null;
  const rounds = knockoutRounds(v.matches);
  const won = m.winner_key === "HUMAN";
  if (isGroup(m)) return won
    ? { significance: "GROUP_WIN", headline: "Group match won", detail: "Group standings decide who reaches the knockout stage.", milestone: false }
    : { significance: "GROUP_LOSS", headline: "Group match lost", detail: "A group loss does not end your event on its own — the table decides.", milestone: false };
  if (!won) {
    if (m.round === rounds) return { significance: "RUNNER_UP", headline: v.event.level >= 5 ? "World Championship runner-up" : "Runner-up",
      detail: "Beaten in the final — the best finish of the field bar one.", milestone: true };
    return { significance: "ELIMINATED", headline: `Out in the ${roundLabel(m.round, rounds).toLowerCase()}`,
      detail: "Your tournament ends here. Prize and ranking money follow your finishing position.", milestone: false };
  }
  if (m.round === rounds) return v.achievements.tournamentChampion || v.phase === "CHAMPION"
    ? { significance: "TITLE", headline: v.event.level >= 5 ? "World Champion" : v.event.qSchool ? "Session winner" : "Champion",
      detail: v.event.qSchool ? "Q-School session won — Tour Cards remain an A5 decision." : "The title is yours — recorded in your Career history.", milestone: true }
    : { significance: "WIN", headline: "Final won", detail: "Awaiting the event's official settlement.", milestone: true };
  const nextLabel = roundLabel(m.round + 1, rounds);
  const sig: Significance = nextLabel === "Final" ? "FINAL_REACHED" : nextLabel === "Semi-final" ? "SEMI_REACHED" : nextLabel === "Quarter-final" ? "QUARTER_REACHED" : "WIN";
  return { significance: sig, headline: sig === "WIN" ? `Through to the ${nextLabel.toLowerCase()}` : `Into the ${nextLabel.toLowerCase()}`,
    detail: sig === "WIN" ? "On to the next round of the official draw." : `One of the last ${2 ** (rounds - m.round)} players standing.`, milestone: sig !== "WIN" };
}

// ---------------------------------------------------------------- prize ladder
export type PrizeStep = { label: string; upToPosition: number; amountPence: number; reached: boolean; current: boolean };
/** A4 bands as a ladder, best first, with the player's current (or final) position marked. */
export function prizeLadder(bands: { upToPosition: number; amountPence: number }[] | undefined, position: number | null): PrizeStep[] {
  if (!bands?.length) return [];
  const sorted = [...bands].filter(b => b.amountPence > 0).sort((a, b) => a.upToPosition - b.upToPosition);
  const currentBand = position ? sorted.find(b => position <= b.upToPosition) ?? null : null;
  let previous = 0;
  return sorted.map(b => {
    const label = b.upToPosition === 1 ? "Winner" : b.upToPosition === 2 ? "Runner-up" : previous + 1 === b.upToPosition ? positionLabel(b.upToPosition)
      : b.upToPosition <= 4 ? "Semi-finalists" : b.upToPosition <= 8 ? "Quarter-finalists" : `Last ${b.upToPosition}`;
    previous = b.upToPosition;
    return { label, upToPosition: b.upToPosition, amountPence: b.amountPence,
      reached: !!position && position <= b.upToPosition, current: currentBand === b };
  });
}
function positionLabel(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** The headline facts of a completed run, all read from saved results. */
export function runSummary(v: Pick<TView, "matches" | "humanResult" | "position">) {
  const path = humanPath(v).filter(m => isFinal(m) && m.status !== "BYE");
  const played = path.filter(m => m.status === "COMPLETED");
  const legs = played.reduce((acc, m) => {
    const mine = m.a_key === "HUMAN";
    acc[0] += (mine ? m.legs_a : m.legs_b) ?? 0; acc[1] += (mine ? m.legs_b : m.legs_a) ?? 0; return acc;
  }, [0, 0] as [number, number]);
  return { matches: path.length, played: played.length, won: path.filter(m => m.winner_key === "HUMAN").length, legsFor: legs[0], legsAgainst: legs[1] };
}
