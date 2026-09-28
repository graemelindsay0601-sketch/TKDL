import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWagerShares } from "../wager-pot.ts";
import { reverseRecordedParticipant } from "../match-rollback.ts";

test("exact deltas restore every balance after a 1v2 total wager", () => {
  const { winnerShares, loserShares } = computeWagerShares(20, 1, 2, "total");
  const original = [
    { elo: 1000, points: 50, careerPoints: 12 },
    { elo: 805, points: 30, careerPoints: -4 },
    { elo: 990, points: 40, careerPoints: 8 },
  ];
  const deltas = [
    { points: winnerShares[0], elo: 16 },
    { points: -loserShares[0], elo: -5 }, // floor-clamped from 805 to 800
    { points: -loserShares[1], elo: -16 },
  ];
  const settled = original.map((p, i) => ({
    elo: p.elo + deltas[i].elo,
    points: p.points + deltas[i].points,
    careerPoints: p.careerPoints + deltas[i].points,
  }));

  assert.deepEqual(
    settled.map((p, i) => reverseRecordedParticipant(p, deltas[i].points, deltas[i].elo)),
    original,
  );
});

test("reversing a loss adds the recorded points back to career points", () => {
  assert.deepEqual(
    reverseRecordedParticipant({ elo: 984, points: 20, careerPoints: -10 }, -10, -16),
    { elo: 1000, points: 30, careerPoints: 0 },
  );
});
