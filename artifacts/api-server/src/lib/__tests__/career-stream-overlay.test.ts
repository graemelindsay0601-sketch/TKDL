/** The live stream overlay: viewer requests, leg predictions, the hype train, milestones and the recap. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MILESTONES, TRAIN, answerRequest, meets, overlayVisit, recapFor, type VisitInfo } from "../../career/streaming/overlay.ts";
import type { ChatEvent, Tally } from "../../career/streaming/model.ts";

const SEED = "b".repeat(64);
const base = (): Tally => ({ viewers: 40, peak: 40, hype: 0.8, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0, ov: { startFollowers: 95 } });
const visit = (o: Partial<VisitInfo> = {}): VisitInfo => ({ you: true, points: 60, bust: false, checkout: false, startScore: 501, legEnded: false, legNo: 1, streamOver: false, ...o });
const alerts = (es: ChatEvent[]) => es.filter(e => e.kind === "ALERT").map(e => (e as { alert: string }).alert);

test("what meets each request", () => {
  assert.ok(meets("TON", visit({ points: 100 }))); assert.ok(!meets("TON", visit({ points: 99 })));
  assert.ok(!meets("TON", visit({ points: 140, you: false })), "their darts never count");
  assert.ok(!meets("TON", visit({ points: 140, bust: true })));
  assert.ok(meets("MAX", visit({ points: 180 })));
  assert.ok(meets("BIG_FINISH", visit({ checkout: true, startScore: 81, points: 81 })));
  assert.ok(meets("QUICK_LEG", visit({ checkout: true, dartsInLeg: 18 }))); assert.ok(!meets("QUICK_LEG", visit({ checkout: true, dartsInLeg: 19 })));
  assert.ok(meets("TOPS_FINISH", visit({ checkout: true, lastDart: { segment: 20, multiplier: 2 } })));
  assert.ok(meets("BULL_FINISH", visit({ checkout: true, lastDart: { segment: 25, multiplier: 2 } })));
  assert.ok(!meets("BULL_FINISH", visit({ checkout: true, lastDart: { segment: 25, multiplier: 1 } })));
});

test("a leg opens with chat's call; between legs a request comes in; accept it and your darts settle it", () => {
  let r = overlayVisit(SEED, "s", 0, visit(), base(), "AFFILIATE", [], { drill: false });
  assert.equal(r.tally.ov!.prediction!.status, "OPEN"); assert.equal(r.tally.ov!.request ?? null, null, "no request mid-leg");
  // You win leg 1: the prediction settles and (first time, very likely) a request is offered for the next leg.
  let offered: Tally | null = null;
  for (let i = 1; i < 40 && !offered; i++) {
    const out = overlayVisit(SEED, `s${i}`, i, visit({ checkout: true, legEnded: true, startScore: 40, points: 40 }), r.tally, "AFFILIATE", [], { drill: false });
    assert.notEqual(out.tally.ov!.prediction!.status, undefined);
    if (out.tally.ov!.request?.status === "OFFERED") { offered = out.tally; assert.ok(alerts(out.events).includes("REQUEST_IN")); }
  }
  assert.ok(offered, "a request turns up between legs");
  const req = offered!.ov!.request!;
  assert.ok(req.rewardPence > 0, "an Affiliate's viewers pay bits");
  assert.equal(answerRequest(offered!, false).ov!.request, null, "skip: gone, no harm");
  const accepted = answerRequest(offered!, true);
  assert.equal(accepted.ov!.request!.status, "ACTIVE"); assert.equal(accepted.ov!.requests!.tried, 1);
  assert.equal(answerRequest(accepted, false), accepted, "only an offer can be answered");
  // A visit that meets it pays out.
  const hit: Partial<VisitInfo> = { TON: { points: 140 }, MAX: { points: 180 }, BIG_FINISH: { checkout: true, startScore: 100, points: 100, legEnded: true },
    QUICK_LEG: { checkout: true, dartsInLeg: 15, legEnded: true }, TOPS_FINISH: { checkout: true, lastDart: { segment: 20, multiplier: 2 }, legEnded: true },
    BULL_FINISH: { checkout: true, lastDart: { segment: 25, multiplier: 2 }, legEnded: true } }[req.kind]!;
  const done = overlayVisit(SEED, "d", 50, visit({ ...hit, legNo: 2 }), accepted, "AFFILIATE", [], { drill: false });
  assert.ok(alerts(done.events).includes("REQUEST"));
  assert.ok(done.tally.bitsPence >= accepted.bitsPence + req.rewardPence);
  assert.equal(done.tally.ov!.requests!.done, 1);
  // A request that runs out of legs just lapses (nothing lost).
  let missed = accepted;
  for (let i = 0; i < 3; i++) missed = overlayVisit(SEED, "m", 60 + i, visit({ you: false, checkout: true, legEnded: true }), missed, "AFFILIATE", [], { drill: false }).tally;
  assert.notEqual(missed.ov!.request?.status, "ACTIVE");
  assert.equal(missed.bitsPence, accepted.bitsPence, "missing costs nothing");
});

test("an upset: win a leg chat doubted and the room erupts", () => {
  const t = { ...base(), ov: { ...base().ov, prediction: { leg: 1, believe: 30, status: "OPEN" as const } } };
  const r = overlayVisit(SEED, "u", 5, visit({ checkout: true, legEnded: true, startScore: 32, points: 32 }), t, "PARTNER", [], { drill: false });
  assert.ok(alerts(r.events).includes("PREDICTION")); assert.equal(r.tally.ov!.predictions!.upsets, 1);
  assert.ok(r.tally.hype > t.hype && r.tally.bitsPence > 0);
  const lost = overlayVisit(SEED, "u", 6, visit({ you: false, checkout: true, legEnded: true }), t, "PARTNER", [], { drill: false });
  assert.equal(lost.tally.bitsPence, 0, "losing a leg costs nothing");
});

test("the hype train builds from cheers, tops out at 5 and pays a few followers when it ends", () => {
  const cheer: ChatEvent[] = [{ kind: "BITS", user: "x", pence: 100, text: "" }, { kind: "SUB", user: "y", months: 1 }];
  let t = base();
  for (let i = 0; i < 20; i++) t = overlayVisit(SEED, "h", i, visit(), t, "PARTNER", cheer, { drill: false }).tally;
  assert.equal(t.ov!.train!.level, TRAIN.maxLevel);
  const gained = t.followersGained;
  let end: ChatEvent[] = [];
  for (let i = 20; i < 20 + TRAIN.quietVisits; i++) { const r = overlayVisit(SEED, "h", i, visit(), t, "PARTNER", [], { drill: false }); t = r.tally; end = end.concat(r.events); }
  assert.ok(alerts(end).includes("TRAIN_END")); assert.equal(t.ov!.train!.level, 0); assert.equal(t.ov!.train!.best, TRAIN.maxLevel);
  assert.equal(t.followersGained, gained + TRAIN.maxLevel * TRAIN.followersPerLevel);
  const newcomer = overlayVisit(SEED, "h", 0, visit(), base(), "NEWCOMER", cheer, { drill: false });
  assert.equal(newcomer.tally.ov!.train, undefined, "no cheers before Affiliate, so no train");
});

test("milestones, determinism and the recap", () => {
  const t = { ...base(), followersGained: 4 };
  const r = overlayVisit(SEED, "m", 3, visit(), { ...t, followerCarry: 0 }, "AFFILIATE", [], { drill: false });
  assert.deepEqual(r, overlayVisit(SEED, "m", 3, visit(), { ...t, followerCarry: 0 }, "AFFILIATE", [], { drill: false }), "same visit, same overlay");
  const crossing = overlayVisit(SEED, "m", 4, visit(), { ...base(), followersGained: 6, ov: { startFollowers: 96 } }, "NEWCOMER", [], { drill: false });
  assert.deepEqual(alerts(crossing.events), ["MILESTONE"], "96 + 6 passes 100");
  assert.ok(!alerts(overlayVisit(SEED, "m", 5, visit(), crossing.tally, "NEWCOMER", [], { drill: false }).events).includes("MILESTONE"), "announced once");
  assert.ok(!alerts(overlayVisit(SEED, "m", 6, visit(), { ...base(), followersGained: 3, ov: { startFollowers: 96 } }, "NEWCOMER", [], { drill: false }).events).includes("MILESTONE"), "99 isn't one");
  const chat: ChatEvent[] = [{ kind: "CHAT", user: "A", text: "" }, { kind: "CHAT", user: "B", text: "" }, { kind: "CHAT", user: "A", text: "" }, { kind: "CHAT", user: "DartCast", text: "" }];
  const recap = recapFor({ ...base(), ov: { requests: { offered: 2, tried: 2, done: 1 }, train: { level: 0, progress: 0, visitsLeft: 0, best: 3 }, predictions: { called: 3, upsets: 1 } } }, chat, "Me");
  assert.deepEqual(recap, { topChatter: "A", requestsDone: 1, requestsTried: 2, trainBest: 3, upsets: 1, legsCalled: 3 });
});
