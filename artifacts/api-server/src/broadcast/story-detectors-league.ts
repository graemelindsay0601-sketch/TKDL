// TKDL LIVE — Story Engine: LEAGUE family detectors (handover doc Appendix
// A / section 9.4). Cross-league — unlike RESULT/FORM/H2H/PERFORMANCE,
// standings and title-race stories apply the same way to Singles, Doubles
// and Shift Wars alike, all driven by the SAME Title Predictor shape
// (title-predictor.ts's SinglesTitleProbability / team-title-predictor.ts's
// team equivalent both reduce to {entityId, probability}).
//
// Different shape from every other family here: most LEAGUE story types
// are inherently about the TOP of a table (NEW_FAVOURITE, DEAD_HEAT,
// TITLE_RACE) rather than a fixed one or two subjects, and TITLE_SWING can
// legitimately fire for more than one entity in the same Edition (a
// three-way title race can have two entities both swing >=10pp in the same
// batch of results) — so every detector here returns StoryCandidate[]
// (possibly empty) rather than the single "one candidate or null" shape
// the other families use. story-engine.ts's own aggregation is a flatMap
// either way, so this costs it nothing.
//
// "Since previous Edition" comparisons (TITLE_SWING, NEW_LEADER, LEAD_
// TIGHTENS/WIDENS, NEW_FAVOURITE) need a stored prior snapshot — reading
// that back from broadcast_prediction_snapshots is story-engine.ts's job;
// this file just consumes the already-diffed `previous` snapshot it's
// handed, the same division of labour every other file in this folder
// uses for DB-dependent inputs.
import { subjectKey } from "./story-engine-math.ts";
import type { StoryCandidate } from "./story-types.ts";
import type { LeagueType } from "@workspace/db/schema";

export type LeagueEntityStanding = {
  entityId: number;
  points: number;
  /** 0..1 — title-predictor.ts's/team-title-predictor.ts's own `probability` field. */
  titleProbability: number;
  isEliminated: boolean;
};

export type LeagueStandingsFacts = {
  leagueType: LeagueType;
  seasonId: number;
  /** All active entities' current standing — players for Singles, teams for Doubles/Shift Wars. */
  current: LeagueEntityStanding[];
  /** Same shape from the previous Edition's stored broadcast_prediction_snapshots row, or null if this is the season's first Edition (nothing to diff against yet). */
  previous: LeagueEntityStanding[] | null;
  /** Singles-only: a live points tie at the top requiring the official tiebreak flow (see 3.2's Singles tie-flow prerequisite fix) — always false for Doubles/Shift Wars, which don't have this concept. */
  singlesTiePending: boolean;
  seasonJustEnded: boolean;
  /** Set only when seasonJustEnded is true. */
  championEntityId: number | null;
  /** Mirrors seasonJustEnded's own "did the boundary fall inside this batch's window" shape, but for the season's startDate instead — the concrete, checkable proxy for "a new season just began" (see CHAMPION's own comment on why a window-based check is what's actually available here). */
  seasonJustStarted: boolean;
  /** The season's display name (e.g. "September 2026") — a plain already-verified string, not an entity id, so it passes straight through the commentary engine's template facts unresolved. Always populated (every season has a name), but only actually consumed by SEASON_KICKOFF today. */
  seasonName: string;
};

const TITLE_SWING_THRESHOLD = 0.10; // 9.4: ">=10 percentage points"
const DEAD_HEAT_THRESHOLD = 0.05; // 9.4: "within 5 points"
const VIABLE_TITLE_PROBABILITY = 0.10; // judgment call: an entity below this isn't a real part of "the race" for TITLE_RACE purposes
const LEAD_GAP_MATERIAL_DELTA = 3; // judgment call: Singles seasons start at 25 points on small integer stakes, so a 3-point swing in the leader's gap is a real move, not table noise

function nonEliminated(standings: LeagueEntityStanding[]): LeagueEntityStanding[] {
  return standings.filter(s => !s.isEliminated);
}

function byPointsDesc(standings: LeagueEntityStanding[]): LeagueEntityStanding[] {
  // Stable sort; a genuine points tie at the top is TIE_PENDING's own
  // concern (Singles-only) rather than something this ordering needs to
  // resolve — ties elsewhere on the table just keep array order.
  return [...standings].sort((a, b) => b.points - a.points);
}

function leaderGap(standings: LeagueEntityStanding[]): number | null {
  const sorted = byPointsDesc(nonEliminated(standings));
  if (sorted.length < 2) return null;
  return sorted[0].points - sorted[1].points;
}

function findStanding(standings: LeagueEntityStanding[], entityId: number): LeagueEntityStanding | undefined {
  return standings.find(s => s.entityId === entityId);
}

// ── NEW_LEADER (9.4: points leader changes) ───────────────────────────────
export function detectNewLeader(facts: LeagueStandingsFacts): StoryCandidate[] {
  if (!facts.previous) return [];

  const currentLeader = byPointsDesc(nonEliminated(facts.current))[0];
  const previousLeader = byPointsDesc(nonEliminated(facts.previous))[0];
  if (!currentLeader || !previousLeader) return [];
  if (currentLeader.entityId === previousLeader.entityId) return [];

  return [{
    storyType: "NEW_LEADER",
    leagueType: facts.leagueType,
    subjectKeys: [subjectKey(facts.leagueType, currentLeader.entityId), subjectKey(facts.leagueType, previousLeader.entityId)],
    sentiment: "positive",
    tags: ["new_leader"],
    facts: { newLeaderEntityId: currentLeader.entityId, previousLeaderEntityId: previousLeader.entityId, points: currentLeader.points },
    components: {
      competitiveImportance: 20,
      unexpectedness: 0,
      historicalSignificance: 8,
      performanceAnomaly: 0,
      entertainmentValue: 4,
    },
  }];
}

// ── LEAD_TIGHTENS / LEAD_WIDENS (Appendix A: top gap materially decreases/increases) ─
export function detectLeadTightens(facts: LeagueStandingsFacts): StoryCandidate[] {
  if (!facts.previous) return [];
  const currentGap = leaderGap(facts.current);
  const previousGap = leaderGap(facts.previous);
  if (currentGap === null || previousGap === null) return [];

  const delta = previousGap - currentGap; // positive = gap shrank
  if (delta < LEAD_GAP_MATERIAL_DELTA) return [];

  const leader = byPointsDesc(nonEliminated(facts.current))[0];
  return [{
    storyType: "LEAD_TIGHTENS",
    leagueType: facts.leagueType,
    subjectKeys: [subjectKey(facts.leagueType, leader.entityId)],
    sentiment: "neutral",
    tags: ["lead_tightens"],
    facts: { leaderEntityId: leader.entityId, previousGap, currentGap },
    components: {
      competitiveImportance: 15,
      unexpectedness: 0,
      historicalSignificance: 4,
      performanceAnomaly: 0,
      entertainmentValue: 3,
    },
  }];
}

export function detectLeadWidens(facts: LeagueStandingsFacts): StoryCandidate[] {
  if (!facts.previous) return [];
  const currentGap = leaderGap(facts.current);
  const previousGap = leaderGap(facts.previous);
  if (currentGap === null || previousGap === null) return [];

  const delta = currentGap - previousGap; // positive = gap grew
  if (delta < LEAD_GAP_MATERIAL_DELTA) return [];

  const leader = byPointsDesc(nonEliminated(facts.current))[0];
  return [{
    storyType: "LEAD_WIDENS",
    leagueType: facts.leagueType,
    subjectKeys: [subjectKey(facts.leagueType, leader.entityId)],
    sentiment: "positive",
    tags: ["lead_widens"],
    facts: { leaderEntityId: leader.entityId, previousGap, currentGap },
    components: {
      competitiveImportance: 12,
      unexpectedness: 0,
      historicalSignificance: 4,
      performanceAnomaly: 0,
      entertainmentValue: 2,
    },
  }];
}

// ── TITLE_SWING (9.4: stored probability moves >=10pp since previous Edition) ─
// Can legitimately fire for more than one entity per Edition (a three-way
// race where two contenders both swing) — hence the array return every
// other detector in this family also uses.
export function detectTitleSwing(facts: LeagueStandingsFacts): StoryCandidate[] {
  if (!facts.previous) return [];

  const results: StoryCandidate[] = [];
  for (const entity of facts.current) {
    const prior = findStanding(facts.previous, entity.entityId);
    if (!prior) continue; // newly appeared entity this Edition — nothing to swing FROM
    const delta = entity.titleProbability - prior.titleProbability;
    if (Math.abs(delta) < TITLE_SWING_THRESHOLD) continue;

    results.push({
      storyType: "TITLE_SWING",
      leagueType: facts.leagueType,
      subjectKeys: [subjectKey(facts.leagueType, entity.entityId)],
      sentiment: delta > 0 ? "positive" : "neutral",
      tags: ["title_swing"],
      facts: { entityId: entity.entityId, previousProbability: prior.titleProbability, currentProbability: entity.titleProbability, deltaPoints: delta },
      components: {
        competitiveImportance: 22,
        unexpectedness: 0,
        historicalSignificance: Math.min(Math.abs(delta) / 0.30, 1) * 10,
        performanceAnomaly: 0,
        entertainmentValue: 4,
      },
    });
  }
  return results;
}

// ── NEW_FAVOURITE (9.4: highest title-probability entity changes) ────────
export function detectNewFavourite(facts: LeagueStandingsFacts): StoryCandidate[] {
  if (!facts.previous) return [];

  const currentTop = [...facts.current].sort((a, b) => b.titleProbability - a.titleProbability)[0];
  const previousTop = [...facts.previous].sort((a, b) => b.titleProbability - a.titleProbability)[0];
  if (!currentTop || !previousTop) return [];
  if (currentTop.entityId === previousTop.entityId) return [];

  return [{
    storyType: "NEW_FAVOURITE",
    leagueType: facts.leagueType,
    subjectKeys: [subjectKey(facts.leagueType, currentTop.entityId), subjectKey(facts.leagueType, previousTop.entityId)],
    sentiment: "positive",
    tags: ["new_favourite"],
    facts: { newFavouriteEntityId: currentTop.entityId, previousFavouriteEntityId: previousTop.entityId, probability: currentTop.titleProbability },
    components: {
      competitiveImportance: 18,
      unexpectedness: 0,
      historicalSignificance: 6,
      performanceAnomaly: 0,
      entertainmentValue: 4,
    },
  }];
}

// ── DEAD_HEAT (9.4: top two title probabilities within 5 points) ─────────
export function detectDeadHeat(facts: LeagueStandingsFacts): StoryCandidate[] {
  const sorted = [...nonEliminated(facts.current)].sort((a, b) => b.titleProbability - a.titleProbability);
  if (sorted.length < 2) return [];

  const gap = sorted[0].titleProbability - sorted[1].titleProbability;
  if (gap > DEAD_HEAT_THRESHOLD) return [];

  return [{
    storyType: "DEAD_HEAT",
    leagueType: facts.leagueType,
    subjectKeys: [subjectKey(facts.leagueType, sorted[0].entityId), subjectKey(facts.leagueType, sorted[1].entityId)],
    sentiment: "neutral",
    tags: ["dead_heat"],
    facts: {
      firstEntityId: sorted[0].entityId, firstProbability: sorted[0].titleProbability,
      secondEntityId: sorted[1].entityId, secondProbability: sorted[1].titleProbability,
    },
    components: {
      competitiveImportance: 20,
      unexpectedness: 0,
      historicalSignificance: 8,
      performanceAnomaly: 0,
      entertainmentValue: 5,
    },
  }];
}

// ── TITLE_RACE (Appendix A: multiple viable entities; Director chooses context) ─
export function detectTitleRace(facts: LeagueStandingsFacts): StoryCandidate[] {
  const viable = nonEliminated(facts.current).filter(e => e.titleProbability >= VIABLE_TITLE_PROBABILITY);
  if (viable.length < 2) return [];

  return [{
    storyType: "TITLE_RACE",
    leagueType: facts.leagueType,
    subjectKeys: viable.map(e => subjectKey(facts.leagueType, e.entityId)),
    sentiment: "neutral",
    tags: ["title_race"],
    facts: { viableEntityIds: viable.map(e => e.entityId), probabilities: viable.map(e => e.titleProbability) },
    components: {
      competitiveImportance: 16,
      unexpectedness: 0,
      historicalSignificance: 6,
      performanceAnomaly: 0,
      entertainmentValue: 4,
    },
  }];
}

// ── CHAMPION (Appendix A: official season champion state) ────────────────
export function detectChampion(facts: LeagueStandingsFacts): StoryCandidate[] {
  if (!facts.seasonJustEnded || facts.championEntityId === null) return [];

  return [{
    storyType: "CHAMPION",
    leagueType: facts.leagueType,
    subjectKeys: [subjectKey(facts.leagueType, facts.championEntityId)],
    sentiment: "positive",
    tags: ["champion"],
    // seasonName added alongside the pre-existing seasonId/championEntityId
    // — a real user report ("the last season's catch-up episode is just a
    // clump of all seasons") traced back to this exact story type: CHAMPION
    // is written once when a season closes and then NEVER re-evaluated (see
    // story-engine.ts's processLeagueFamily header), so several different
    // months' champions can end up sitting in the same story pool at once
    // with nothing distinguishing "champion of March" from "champion of
    // June." `facts.seasonName` is already available on every call site
    // (LeagueStandingsFacts requires it — SEASON_KICKOFF already uses it the
    // same way) — this was simply never carried through to CHAMPION's own
    // facts. Deliberately NOT added to CHAMPION_REQUIRES in
    // commentary-library.ts (which would gate every CHAMPION phrase on it) —
    // stories already frozen in production from before this change don't
    // have this key in their stored `facts` JSON and never will (they're
    // never re-upserted), so a hard requirement would silently drop their
    // dialogue entirely. See commentary-library.ts's own CHAMPION.qf.2 for
    // how this is surfaced instead, additively.
    facts: { seasonId: facts.seasonId, championEntityId: facts.championEntityId, seasonName: facts.seasonName },
    components: {
      competitiveImportance: 25, // the single most consequential state a season can reach
      unexpectedness: 0,
      historicalSignificance: 15,
      performanceAnomaly: 0,
      entertainmentValue: 5,
    },
  }];
}

// ── SEASON_KICKOFF (new: a fresh season just began) ───────────────────────
// The deliberate counterweight to CHAMPION: without this, the very first
// Edition of a new season has nothing telling viewers "the board just
// reset" — it would just start narrating the new month's early standings as
// if they were a continuation of the same old race, which is exactly the
// "same old players doing the same old thing every month" staleness this
// story exists to head off. Fires once per season (season-anchored, like
// CHAMPION and TIE_PENDING — see story-engine.ts's SEASON_ANCHORED_TYPES),
// runs alongside the normal standings-based detectors rather than replacing
// them the way CHAMPION does, since a season that's just STARTED is still
// very much active and has real (if early) title-probability data to show.
export function detectSeasonKickoff(facts: LeagueStandingsFacts): StoryCandidate[] {
  if (!facts.seasonJustStarted) return [];

  return [{
    storyType: "SEASON_KICKOFF",
    leagueType: facts.leagueType,
    subjectKeys: [], // about the season itself, not any one entity
    sentiment: "neutral",
    tags: ["season_kickoff"],
    facts: { seasonId: facts.seasonId, seasonName: facts.seasonName, entrantCount: facts.current.length },
    components: {
      competitiveImportance: 15,
      unexpectedness: 0,
      historicalSignificance: 8,
      performanceAnomaly: 0,
      entertainmentValue: 5,
    },
  }];
}

// ── TIE_PENDING (Appendix A: Singles points tie requiring official tiebreak) ─
export function detectTiePending(facts: LeagueStandingsFacts): StoryCandidate[] {
  if (facts.leagueType !== "singles") return []; // Doubles/Shift Wars have no official tiebreak concept here
  if (!facts.singlesTiePending) return [];

  const tiedLeaders = byPointsDesc(nonEliminated(facts.current)).filter((s, _, arr) => s.points === arr[0].points);

  return [{
    storyType: "TIE_PENDING",
    leagueType: "singles",
    subjectKeys: tiedLeaders.map(s => subjectKey("singles", s.entityId)),
    sentiment: "neutral",
    tags: ["tie_pending"],
    facts: { seasonId: facts.seasonId, tiedEntityIds: tiedLeaders.map(s => s.entityId), points: tiedLeaders[0]?.points ?? null },
    components: {
      competitiveImportance: 20,
      unexpectedness: 0,
      historicalSignificance: 10,
      performanceAnomaly: 0,
      entertainmentValue: 4,
    },
  }];
}

export const LEAGUE_DETECTORS = [
  detectNewLeader,
  detectLeadTightens,
  detectLeadWidens,
  detectTitleSwing,
  detectNewFavourite,
  detectDeadHeat,
  detectTitleRace,
  detectChampion,
  detectTiePending,
  detectSeasonKickoff,
] as const satisfies readonly ((facts: LeagueStandingsFacts) => StoryCandidate[])[];

export function detectLeagueStories(facts: LeagueStandingsFacts): StoryCandidate[] {
  return LEAGUE_DETECTORS.flatMap(detector => detector(facts));
}
