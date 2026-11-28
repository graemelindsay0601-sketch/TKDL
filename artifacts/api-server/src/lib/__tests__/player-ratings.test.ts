import test from "node:test";
import assert from "node:assert/strict";
import { playerRatings, cardBand, MIN_MATCHES, type RatingMatch } from "../../shared/darts-rules/player-ratings.ts";

const m = (o: Partial<RatingMatch> = {}): RatingMatch => ({ won: true, gameType: "501", darts: 24, tons: 2, t140: 1, t180: 0, coAttempts: 4, coHits: 1, upset: false, ...o });

test("needs enough X01 matches", () => {
  assert.equal(playerRatings({ matches: Array(MIN_MATCHES - 1).fill(m()), elo: 1000 }), null);
  assert.equal(playerRatings({ matches: Array(10).fill(m({ gameType: "cricket" })), elo: 1000 }), null);
  assert.ok(playerRatings({ matches: Array(MIN_MATCHES).fill(m()), elo: 1000 }));
});

test("every rating stays 40-99", () => {
  for (const o of [m({ darts: 9, tons: 3, t140: 0, t180: 3, coAttempts: 1, coHits: 1 }), m({ darts: 90, tons: 0, t140: 0, t180: 0, coAttempts: 30, coHits: 0, won: false })]) {
    const r = playerRatings({ matches: Array(12).fill(o), elo: o.won ? 2000 : 400 })!;
    for (const v of Object.values(r.ratings)) assert.ok(v == null || (v >= 40 && v <= 99), String(v));
    assert.ok(r.overall >= 40 && r.overall <= 99);
  }
});

test("better darts, better ratings", () => {
  const good = playerRatings({ matches: Array(10).fill(m({ darts: 15, tons: 3, t140: 1, coHits: 2 })), elo: 1300 })!;
  const poor = playerRatings({ matches: Array(10).fill(m({ darts: 42, tons: 0, t140: 0, coHits: 0, won: false })), elo: 950 })!;
  for (const k of ["SCO", "FIN", "PAC", "FRM", "BIG"] as const) assert.ok((good.ratings[k] ?? 0) > (poor.ratings[k] ?? 0), k);
  assert.ok(good.overall > poor.overall);
});

test("missing checkout data leaves Finishing blank, not 40", () => {
  const r = playerRatings({ matches: Array(8).fill(m({ coAttempts: null, coHits: null })), elo: 1000 })!;
  assert.equal(r.ratings.FIN, null);
  assert.equal(r.raw.checkoutPct, null);
});

test("recent form counts more", () => {
  const hot = [...Array(5).fill(m({ won: true })), ...Array(5).fill(m({ won: false }))];
  const cold = [...hot].reverse();
  assert.ok(playerRatings({ matches: hot, elo: 1000 })!.ratings.FRM! > playerRatings({ matches: cold, elo: 1000 })!.ratings.FRM!);
});

test("bands", () => {
  assert.equal(cardBand(59).id, "bronze"); assert.equal(cardBand(60).id, "silver"); assert.equal(cardBand(75).id, "gold"); assert.equal(cardBand(80).id, "elite");
});
