import { scopedRandom } from "../world/random.ts";
import { STREAM, handleFor, type ChatEvent, type Regular, type Tally, type TierKey } from "./model.ts";

/**
 * The live overlay: what a real stream shows on screen instead of leaving it buried in chat.
 * - Viewer requests ("hit a ton this leg"): offered only between legs, you Accept or Skip, judged from your own darts.
 *   Done pays the requester's bits and lifts the room; missed or skipped costs nothing.
 * - Predictions: chat calls each leg; win when they doubted you and it's an upset.
 * - The hype train: cheers in quick succession build it up to level 5; it ends after a quiet spell.
 * - Milestone alerts as follower counts tick over.
 * Everything here is hype and money for the channel; none of it changes how you or anyone throws.
 */
export type RequestKind = "TON" | "MAX" | "BIG_FINISH" | "TOPS_FINISH" | "BULL_FINISH" | "QUICK_LEG";
export type StreamRequest = { n: number; kind: RequestKind; label: string; by: string; rewardPence: number;
  status: "OFFERED" | "ACTIVE" | "DONE" | "MISSED" | "SKIPPED"; unit: "LEGS" | "VISITS"; left: number };
export type Prediction = { leg: number; believe: number; status: "OPEN" | "RIGHT" | "UPSET" | "LOST" };
export type HypeTrain = { level: number; progress: number; visitsLeft: number; best: number };
export type Recap = { topChatter: string | null; requestsDone: number; requestsTried: number; trainBest: number; upsets: number; legsCalled: number };
export type Overlay = { train?: HypeTrain; request?: StreamRequest | null; requests?: { offered: number; tried: number; done: number };
  prediction?: Prediction | null; predictions?: { called: number; upsets: number }; startFollowers?: number; seenFollowers?: number; recap?: Recap };

export const REQUESTS: Record<RequestKind, { label: string; reward: number; unit: "LEGS" | "VISITS"; left: number; weight: number }> = {
  TON: { label: "Hit a ton (100+) this leg", reward: 1, unit: "LEGS", left: 1, weight: 5 },
  BIG_FINISH: { label: "Check out from 80 or more", reward: 1.5, unit: "LEGS", left: 2, weight: 3 },
  QUICK_LEG: { label: "Win a leg in 18 darts or fewer", reward: 1.5, unit: "LEGS", left: 2, weight: 3 },
  TOPS_FINISH: { label: "Finish a leg on double 20", reward: 1.2, unit: "LEGS", left: 2, weight: 2 },
  MAX: { label: "Hit a 180", reward: 2.5, unit: "LEGS", left: 2, weight: 2 },
  BULL_FINISH: { label: "Finish on the bull", reward: 3, unit: "LEGS", left: 2, weight: 1 },
};
const DRILL_REQUESTS: RequestKind[] = ["TON", "MAX"];
const BASE_REWARD: Record<TierKey, number> = { NEWCOMER: 0, AFFILIATE: 500, PARTNER: 1200, STAR: 3000 };
export const MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000];
export const TRAIN = { maxLevel: 5, perCheer: 40, perSub: 80, quietVisits: 8, followersPerLevel: 2 };

export type VisitInfo = { you: boolean; points: number; bust: boolean; checkout: boolean; startScore: number;
  lastDart?: { segment: number; multiplier: number }; dartsInLeg?: number;
  /** This visit ended a leg (x01), and whether the stream is now over. */
  legEnded: boolean; legNo: number; streamOver: boolean };

const alert = (alert: string, text: string, user?: string): ChatEvent => ({ kind: "ALERT", alert, text, ...(user ? { user } : {}) } as ChatEvent);
const room = (t: Tally) => Math.min(1, t.viewers / 300);

/** Who in chat sent a request: a regular if you have them, otherwise someone from the room. */
function requester(rng: () => number, regulars: readonly Regular[]) {
  return regulars.length && rng() < 0.7 ? regulars[Math.floor(rng() * Math.min(regulars.length, 6))].name : handleFor(rng);
}

function offerRequest(rng: () => number, n: number, tier: TierKey, tally: Tally, regulars: readonly Regular[], drill: boolean): StreamRequest {
  const pool = drill ? DRILL_REQUESTS : (Object.keys(REQUESTS) as RequestKind[]);
  const total = pool.reduce((s, k) => s + REQUESTS[k].weight, 0);
  let roll = rng() * total, kind = pool[0];
  for (const k of pool) { roll -= REQUESTS[k].weight; if (roll <= 0) { kind = k; break; } }
  const def = REQUESTS[kind];
  const reward = Math.round(BASE_REWARD[tier] * def.reward * (0.8 + rng() * 0.4) * (1 + room(tally)) / 100) * 100;
  return { n, kind, label: def.label, by: requester(rng, regulars), rewardPence: reward, status: "OFFERED",
    unit: drill ? "VISITS" : def.unit, left: drill ? 6 : def.left };
}

/** Did this visit meet the request? */
export function meets(kind: RequestKind, v: VisitInfo) {
  if (!v.you || v.bust) return false;
  switch (kind) {
    case "TON": return v.points >= 100;
    case "MAX": return v.points === 180;
    case "BIG_FINISH": return v.checkout && v.startScore >= 80;
    case "QUICK_LEG": return v.checkout && (v.dartsInLeg ?? 99) <= 18;
    case "TOPS_FINISH": return v.checkout && v.lastDart?.segment === 20 && v.lastDart.multiplier === 2;
    case "BULL_FINISH": return v.checkout && v.lastDart?.segment === 25 && v.lastDart.multiplier === 2;
  }
}

/** How strongly chat believes you'll win the next leg (percent), from the room's mood and the matchup. */
export function believers(rng: () => number, hype: number, myAvg: number | null, theirAvg: number | null) {
  const edge = myAvg !== null && theirAvg !== null ? (myAvg - theirAvg) * 1.5 : 0;
  return Math.max(8, Math.min(92, Math.round(50 + (hype - 0.8) * 12 + edge + (rng() - 0.5) * 16)));
}

/**
 * One visit's overlay: judges the active request, moves the hype train on from this visit's cheers, settles the leg's
 * prediction, offers the next request between legs, and calls out follower milestones. Deterministic per stream and visit.
 */
export function overlayVisit(seed: string, streamKey: string, index: number, v: VisitInfo, tally: Tally, tier: TierKey, cheers: readonly ChatEvent[],
  opts: { drill: boolean; regulars?: readonly Regular[]; myAvg?: number | null; theirAvg?: number | null }): { tally: Tally; events: ChatEvent[] } {
  const rng = scopedRandom(seed, STREAM.version, "stream-overlay", streamKey, index);
  const regulars = opts.regulars ?? [];
  const events: ChatEvent[] = [];
  let t: Tally = { ...tally };
  const ov: Overlay = { ...(t.ov ?? {}) };
  const counts = { offered: 0, tried: 0, done: 0, ...(ov.requests ?? {}) }, calls = { called: 0, upsets: 0, ...(ov.predictions ?? {}) };

  // The first visit: chat makes its call on the opening leg.
  if (!opts.drill && index === 0 && !ov.prediction) ov.prediction = { leg: 1, believe: believers(rng, t.hype, opts.myAvg ?? null, opts.theirAvg ?? null), status: "OPEN" };

  // 1. The request you took on.
  let req = ov.request ? { ...ov.request } : null;
  if (req?.status === "ACTIVE" && meets(req.kind, v)) {
    req.status = "DONE"; counts.done++;
    t.hype = Math.min(3, t.hype + 0.6);
    events.push(alert("REQUEST", `Request done: ${req.label}`, req.by));
    if (req.rewardPence > 0) { t.bitsPence += req.rewardPence; events.push({ kind: "BITS", user: req.by, pence: req.rewardPence, text: "request complete, as promised!" }); }
    else events.push({ kind: "CHAT", user: req.by, text: "YOU DID IT 🙌" });
  } else if (req?.status === "ACTIVE" && (req.unit === "VISITS" ? v.you : v.legEnded)) {
    req.left--;
    if (req.left <= 0) { req.status = "MISSED"; events.push({ kind: "CHAT", user: req.by, text: pick(rng, ["no worries, next time!", "so close, good effort", "we'll get it next stream"]) }); }
  }
  // An offer you didn't answer lapses when the next leg ends (no harm done).
  else if (req?.status === "OFFERED" && v.legEnded) req = null;
  if (req && req.status !== "OFFERED" && req.status !== "ACTIVE") req = null;

  // 2. The hype train: cheers in quick succession build it; a quiet spell ends it (it pays a few followers by level).
  if (tier !== "NEWCOMER") {
    const train = { level: 0, progress: 0, visitsLeft: 0, best: 0, ...(ov.train ?? {}) };
    const fuel = cheers.reduce((n, e) => n + (e.kind === "SUB" ? TRAIN.perSub : e.kind === "BITS" || e.kind === "SUPERCHAT" ? TRAIN.perCheer : 0), 0)
      + events.reduce((n, e) => n + (e.kind === "BITS" ? TRAIN.perCheer : 0), 0);
    if (fuel > 0) {
      train.progress += fuel; train.visitsLeft = TRAIN.quietVisits;
      while (train.progress >= 100 && train.level < TRAIN.maxLevel) {
        train.level++; train.progress -= 100;
        t.hype = Math.min(3, t.hype + 0.3); t.viewers += Math.max(1, Math.round(t.viewers * 0.03)); t.peak = Math.max(t.peak, t.viewers);
        events.push(alert("TRAIN", train.level === 1 ? "Hype train is leaving the station!" : `Hype train level ${train.level}!`));
      }
      if (train.level >= TRAIN.maxLevel) train.progress = Math.min(train.progress, 100);
      train.best = Math.max(train.best, train.level);
    } else if (train.level > 0 || train.progress > 0) {
      train.visitsLeft--;
      if (train.visitsLeft <= 0) {
        if (train.level > 0) {
          t.followersGained += train.level * TRAIN.followersPerLevel;
          events.push(alert("TRAIN_END", `Hype train finished at level ${train.level}`));
        }
        train.level = 0; train.progress = 0; train.visitsLeft = 0;
      }
    }
    ov.train = train;
  }

  // 3. The leg is over: settle chat's call, then (with more to play) a fresh call and maybe a new request.
  if (v.legEnded && !opts.drill) {
    const p = ov.prediction;
    if (p?.status === "OPEN") {
      const won = v.you && v.checkout;
      calls.called++;
      if (won && p.believe < 50) {
        calls.upsets++; t.hype = Math.min(3, t.hype + 0.8);
        events.push(alert("PREDICTION", `UPSET! Only ${p.believe}% believed`));
        if (tier !== "NEWCOMER") { const pence = Math.round(BASE_REWARD[tier] * (0.4 + rng() * 0.4) / 100) * 100; t.bitsPence += pence;
          events.push({ kind: "BITS", user: requester(rng, regulars), pence, text: "I'll never doubt you again" }); }
      } else if (won) events.push(alert("PREDICTION", `Chat called it: ${p.believe}% backed you`));
      else events.push({ kind: "CHAT", user: requester(rng, regulars), text: pick(rng, ["we go again 💪", "next leg's yours", "shake it off"]) });
      ov.prediction = { ...p, status: won ? (p.believe < 50 ? "UPSET" : "RIGHT") : "LOST" };
    }
    if (!v.streamOver) {
      ov.prediction = { leg: v.legNo + 1, believe: believers(rng, t.hype, opts.myAvg ?? null, opts.theirAvg ?? null), status: "OPEN" };
      if (!req && rng() < (counts.offered === 0 ? 0.9 : 0.55)) {
        req = offerRequest(rng, counts.offered + 1, tier, t, regulars, false); counts.offered++;
        events.push(alert("REQUEST_IN", `Request from ${req.by}`, req.by));
      }
    }
  }
  // Drills have no legs: a request may come in every few visits.
  if (opts.drill && !v.streamOver && !req && index % 8 === 5 && rng() < 0.7) {
    req = offerRequest(rng, counts.offered + 1, tier, t, regulars, true); counts.offered++;
    events.push(alert("REQUEST_IN", `Request from ${req.by}`, req.by));
  }
  if (v.streamOver && req?.status === "OFFERED") req = null;

  // 4. Follower milestones crossed during the stream.
  if (ov.startFollowers !== undefined) {
    const before = ov.seenFollowers ?? ov.startFollowers, after = ov.startFollowers + t.followersGained;
    for (const m of MILESTONES) if (before < m && after >= m) events.push(alert("MILESTONE", `${m.toLocaleString("en-GB")} followers! 🎉`));
    ov.seenFollowers = Math.max(before, after);
  }
  ov.request = req; ov.requests = counts; ov.predictions = calls;
  t = { ...t, ov };
  return { tally: t, events };
}

/** Accept or skip the offered request (only while it's on offer). */
export function answerRequest(tally: Tally, accept: boolean): Tally {
  const ov = tally.ov ?? {}, req = ov.request;
  if (!req || req.status !== "OFFERED") return tally;
  const counts = { offered: 0, tried: 0, done: 0, ...(ov.requests ?? {}) };
  return { ...tally, ov: { ...ov, request: accept ? { ...req, status: "ACTIVE" } : null, requests: accept ? { ...counts, tried: counts.tried + 1 } : counts } };
}

/** The end-of-stream recap: who chatted most, requests, the best hype train and the upsets. */
export function recapFor(tally: Tally, chat: readonly ChatEvent[], handle: string): Recap {
  const by = new Map<string, number>();
  for (const e of chat) if (e.kind === "CHAT" && e.user !== "DartCast" && e.user !== handle) by.set(e.user, (by.get(e.user) ?? 0) + 1);
  const top = [...by.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const ov = tally.ov ?? {};
  return { topChatter: top ? top[0] : null, requestsDone: ov.requests?.done ?? 0, requestsTried: ov.requests?.tried ?? 0,
    trainBest: ov.train?.best ?? 0, upsets: ov.predictions?.upsets ?? 0, legsCalled: ov.predictions?.called ?? 0 };
}

function pick<T>(rng: () => number, xs: readonly T[]) { return xs[Math.floor(rng() * xs.length)]; }
