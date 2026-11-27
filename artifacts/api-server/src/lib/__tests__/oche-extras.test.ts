import { test } from "node:test";
import assert from "node:assert/strict";
import { motmShortlist, motmWinner, calloutStreaks, bountyTargets, bountyLevel, bountyUnlocks, OO_UNLOCKS } from "../oche-extras.ts";

test("shortlist: records first, then by score, earliest on a tie, max 5", () => {
  const m = (id: number, kind: string, score: number, at = `2026-11-0${id}`) => ({ id, kind, score, at });
  assert.deepEqual(motmShortlist([m(1, "max", 9), m(2, "record", 0), m(3, "upset", 9), m(4, "max", 1), m(5, "big_finish", 4), m(6, "streak", 3), m(7, "record", 2)]), [7, 2, 1, 3, 5]);
});

test("winner: votes, then score, then earliest", () => {
  assert.equal(motmWinner([{ id: 1, votes: 2, score: 0, at: "a" }, { id: 2, votes: 3, score: 0, at: "b" }]), 2);
  assert.equal(motmWinner([{ id: 1, votes: 2, score: 1, at: "a" }, { id: 2, votes: 2, score: 5, at: "b" }]), 2);
  assert.equal(motmWinner([{ id: 1, votes: 0, score: 0, at: "a" }, { id: 2, votes: 0, score: 0, at: "b" }]), 1);
  assert.equal(motmWinner([]), null);
});

test("call-out streaks count wins in a row either side, reset on a loss", () => {
  const s = calloutStreaks([
    { challengerId: 1, targetId: 2, winnerId: 1, at: "1" },
    { challengerId: 3, targetId: 1, winnerId: 1, at: "2" },
    { challengerId: 1, targetId: 4, winnerId: 1, at: "3" },
    { challengerId: 2, targetId: 1, winnerId: 2, at: "4" },
    { challengerId: 1, targetId: 3, winnerId: 1, at: "5" },
  ]);
  assert.deepEqual(s.get(1), { current: 1, best: 3 });
  assert.deepEqual(s.get(2), { current: 1, best: 1 });
});

test("bounty targets: leader, 5+ runs, 3+ call-out streak; one each, leader first", () => {
  const t = bountyTargets({ leaderId: 1, runs: [{ id: 1, streak: 6 }, { id: 2, streak: 5 }, { id: 3, streak: 4 }], calloutTop: { id: 4, streak: 3 } });
  assert.deepEqual([...t.entries()], [[1, "leader"], [2, "run"], [4, "callout"]]);
  assert.equal(bountyTargets({ leaderId: null, runs: [], calloutTop: { id: 4, streak: 2 } }).size, 0);
});

test("bounty levels and unlocks", () => {
  const now = new Date("2026-11-27T12:00:00Z");
  assert.equal(bountyLevel("2026-11-26T12:00:00Z", now), 1);
  assert.equal(bountyLevel("2026-11-19T12:00:00Z", now), 2);
  assert.equal(bountyLevel("2026-10-01T12:00:00Z", now), 3);
  assert.deepEqual(bountyUnlocks(1).map(c => c.id), [OO_UNLOCKS.hunter.id]);
  assert.deepEqual(bountyUnlocks(3).map(c => c.id), [OO_UNLOCKS.hunter.id, OO_UNLOCKS.wanted.id, OO_UNLOCKS.goldBounty.id]);
});

test("every unlock is an exclusive id", () => {
  for (const c of Object.values(OO_UNLOCKS)) assert.match(c.id, /-oo-/);
});
