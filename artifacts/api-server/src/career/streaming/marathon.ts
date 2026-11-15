import { scopedRandom } from "../world/random.ts";
import { STREAM, activeStreamers, streamIncome, type ChatEvent, type Tally, type TierKey } from "./model.ts";

/**
 * Marathon streams, once a season each (from Affiliate): game after game of one-leg 501 against viewers, on a timer.
 * - The Subathon: support (subs, super chats, bits) adds time; a ladder of support goals unlocks along the way, each
 *   one a celebration that wins followers. Losing a leg never ends it; the timer does.
 * - The Charity Marathon: every cheer goes to the cause, scene creators chip in as the total climbs, and reaching the
 *   target is a trophy moment (and fans who remember it, like any charity stream).
 * No fatigue, no penalties: the only cost is the night.
 */
export type MarathonKind = "SUBATHON" | "MARATHON";
export type MarathonState = { kind: MarathonKind; visitsLeft: number; extended: number; support: number; goalsHit: number;
  targetPence?: number; donorsHit?: number; targetHit?: boolean };

export const MARATHON = Object.freeze({
  startVisits: 30, maxExtension: 60,
  /** Visits added per kind of support. */
  addSub: 3, addSuper: 2, addBits: 1,
  /** Support points per kind (subs count most). */
  pointsSub: 3, pointsSuper: 2, pointsBits: 1,
  goals: [5, 15, 30, 50, 80] as readonly number[],
  goalRewards: ["Chat picks your next checkout", "Walk-on music vote", "Left-handed leg (just for fun)", "Viewer-designed flights giveaway", "Retro shirt for the rest of the stream"] as readonly string[],
  goalFollowers: 4,
  /** Charity target by tier (pence), and creator donations at each quarter of it. */
  target: { NEWCOMER: 5_000, AFFILIATE: 10_000, PARTNER: 40_000, STAR: 150_000 } as Record<TierKey, number>,
  donationShare: 0.08, targetFollowers: 0.03, crowd: 1.35,
});

export const isMarathon = (format: unknown): format is MarathonKind => format === "SUBATHON" || format === "MARATHON";
export const startMarathon = (kind: MarathonKind, tier: TierKey): MarathonState =>
  ({ kind, visitsLeft: MARATHON.startVisits, extended: 0, support: 0, goalsHit: 0, ...(kind === "MARATHON" ? { targetPence: MARATHON.target[tier], donorsHit: 0, targetHit: false } : {}) });

/**
 * One visit of a marathon: your visits run the clock down, support winds it back (up to a cap), goals and donations
 * land as alerts. Deterministic per stream and visit.
 */
export function marathonVisit(seed: string, streamKey: string, index: number, you: boolean, tally: Tally, cheers: readonly ChatEvent[], season: number):
  { tally: Tally; events: ChatEvent[] } {
  const m = tally.ov?.marathon;
  if (!m) return { tally, events: [] };
  const s: MarathonState = { ...m };
  const events: ChatEvent[] = [];
  let t: Tally = { ...tally };
  let add = 0, points = 0;
  for (const e of cheers) {
    if (e.kind === "SUB") { add += MARATHON.addSub; points += MARATHON.pointsSub; }
    else if (e.kind === "SUPERCHAT") { add += MARATHON.addSuper; points += MARATHON.pointsSuper; }
    else if (e.kind === "BITS") { add += MARATHON.addBits; points += MARATHON.pointsBits; }
  }
  const room = Math.max(0, MARATHON.maxExtension - s.extended), granted = Math.min(add, room);
  s.extended += granted; s.visitsLeft += granted; s.support += points;
  if (granted > 0 && s.kind === "SUBATHON") events.push({ kind: "ALERT", alert: "TIMER", text: `+${granted} visit${granted === 1 ? "" : "s"} on the clock` } as ChatEvent);
  if (you) s.visitsLeft = Math.max(0, s.visitsLeft - 1);
  if (s.kind === "SUBATHON") {
    while (s.goalsHit < MARATHON.goals.length && s.support >= MARATHON.goals[s.goalsHit]) {
      events.push({ kind: "ALERT", alert: "GOAL", text: `Goal ${s.goalsHit + 1} hit: ${MARATHON.goalRewards[s.goalsHit]}!` } as ChatEvent);
      t.followersGained += MARATHON.goalFollowers * (s.goalsHit + 1); t.hype = Math.min(3, t.hype + 0.5);
      s.goalsHit++;
    }
  } else if (s.targetPence) {
    // Scene creators donate as the total passes each quarter of the target.
    const rng = scopedRandom(seed, STREAM.version, "stream-marathon-donor", streamKey, index);
    const creators = activeStreamers(season);
    while ((s.donorsHit ?? 0) < 4 && streamIncome(t) >= s.targetPence * ((s.donorsHit ?? 0) + 1) / 4) {
      const who = creators[Math.floor(rng() * creators.length)];
      const pence = Math.max(500, Math.round(s.targetPence * MARATHON.donationShare / 100) * 100);
      t.bitsPence += pence; s.donorsHit = (s.donorsHit ?? 0) + 1;
      events.push({ kind: "ALERT", alert: "DONATION", user: who.handle, text: `${who.handle} donated £${(pence / 100).toFixed(0)} to the cause!` } as ChatEvent);
    }
    if (!s.targetHit && streamIncome(t) >= s.targetPence) {
      s.targetHit = true; t.hype = Math.min(3, t.hype + 1);
      events.push({ kind: "ALERT", alert: "GOAL", text: `Target smashed: £${(s.targetPence / 100).toFixed(0)} raised! 🎗️` } as ChatEvent);
    }
  }
  t = { ...t, ov: { ...(t.ov ?? {}), marathon: s } };
  return { tally: t, events };
}
