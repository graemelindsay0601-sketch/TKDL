import { test } from "node:test";
import assert from "node:assert/strict";
import { candidatesFrom, mergeRecords, simulatedNineDarters, liveNineDarters, AVERAGE_MIN_LEGS, type RecordMatch } from "../../career/records/model.ts";

const match = (over: Partial<RecordMatch> & { summary: Record<string, unknown> }): RecordMatch => ({ id: "m1", eventId: "e1", aKey: "npc-a", bKey: "npc-b",
  legsA: 6, legsB: 3, day: 10, season: 1, resultSource: "A2_SIMULATION", tier: "STANDARD", pairs: false, ...over });

test("records come only from recorded match statistics, with their source", () => {
  const c = candidatesFrom([
    match({ summary: { averages: [101.5, 88.2], maximums: [4, 1], highestCheckouts: [170, 64], nineDarters: [1, 0] } }),
    match({ id: "m2", aKey: "HUMAN", tier: "TELEVISED", summary: { quickSim: {}, averages: [95, 90], maximums: [2, 0], highestCheckouts: [121, 0] } }),
    match({ id: "m3", aKey: "HUMAN", legsA: 6, legsB: 2, summary: { live: { facts: { human: { average: 99.1, maximums: 3, highestCheckout: 140, nineDarters: 1 }, opponent: { average: 80, maximums: 0, highestCheckout: 40 } } } } }),
    match({ id: "short", legsA: 2, legsB: 1, summary: { averages: [130, 60], maximums: [0, 0], highestCheckouts: [0, 0] } }),
    match({ id: "pairs", pairs: true, summary: { averages: [120, 60], maximums: [9, 0], highestCheckouts: [170, 0] } }),
    match({ id: "bye", resultSource: "BYE", summary: { averages: [0, 0] } }),
  ]);
  const of = (key: string) => c.filter(e => e.key === key);
  assert.deepEqual(of("nine-darter").map(e => [e.matchId, e.participantKey, e.source]), [["m1", "npc-a", "SIMULATED"], ["m3", "HUMAN", "LIVE"]]);
  assert.ok(!c.some(e => e.matchId === "short" && e.key === "match-average"), `averages need ${AVERAGE_MIN_LEGS}+ legs`);
  assert.ok(c.some(e => e.matchId === "short" && e.key === "checkout") === false, "zero values are never records");
  assert.ok(!c.some(e => e.matchId === "pairs" || e.matchId === "bye"), "pairs and byes never count");
  assert.deepEqual(of("tv-average").map(e => [e.participantKey, e.source]), [["HUMAN", "QUICK_SIM"], ["npc-b", "SIMULATED"]]);
  assert.equal(of("match-average").find(e => e.matchId === "m3" && e.participantKey === "HUMAN")?.source, "LIVE");
});

test("the book keeps the top ten (ties to whoever did it first) and every nine-darter in order", () => {
  const entries = Array.from({ length: 14 }, (_, i) => ({ key: "checkout" as const, participantKey: `p${i}`, matchId: `m${i}`, eventId: "e", value: i < 12 ? 170 : 161, season: 1, day: 50 - i, source: "SIMULATED" as const }));
  const nines = [3, 1, 2].map(d => ({ key: "nine-darter" as const, participantKey: `n${d}`, matchId: `x${d}`, eventId: "e", value: 1, season: 1, day: d, source: "SIMULATED" as const }));
  const kept = mergeRecords([], [...entries, ...nines]);
  const checkouts = kept.filter(e => e.key === "checkout");
  assert.equal(checkouts.length, 10);
  assert.ok(checkouts.every(e => e.value === 170) && checkouts[0].day === 39, "the earliest 170 holds first place");
  assert.deepEqual(kept.filter(e => e.key === "nine-darter").map(e => e.day), [1, 2, 3]);
  assert.deepEqual(mergeRecords(kept, entries), kept, "re-adding the same matches changes nothing");
});

test("nine-dart legs: a won 501 straight-in leg in exactly nine darts", () => {
  const leg = (winner: number, darts: [number, number], checkout = 141) => ({ winner, darts, checkout });
  assert.deepEqual(simulatedNineDarters([leg(0, [9, 6]), leg(1, [9, 10]), leg(0, [10, 9])], { gameType: "X01", startingScore: 501, inRule: "STRAIGHT" }), [1, 0]);
  assert.deepEqual(simulatedNineDarters([leg(0, [9, 6])], { gameType: "X01", startingScore: 301, inRule: "STRAIGHT" }), [0, 0]);
  assert.deepEqual(simulatedNineDarters([leg(0, [9, 6])], { gameType: "X01", startingScore: 501, inRule: "DOUBLE" }), [0, 0]);
  assert.deepEqual(simulatedNineDarters([leg(0, [9, 6], 0)], { gameType: "X01", startingScore: 501 }), [0, 0], "no checkout: cricket or corked leg");
  const state = (legsLog: { winner: number; darts: number[]; cork?: boolean; game?: string }[]) => ({ format: { startingScore: 501, inRule: "STRAIGHT" }, legsLog });
  assert.equal(liveNineDarters(state([{ winner: 0, darts: [9, 6] }, { winner: 0, darts: [9, 9], game: "CRICKET" }, { winner: 1, darts: [6, 9] }]), 0), 1);
  assert.equal(liveNineDarters(state([{ winner: 1, darts: [6, 9] }]), 1), 1);
});
