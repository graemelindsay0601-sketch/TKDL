import test from "node:test";
import assert from "node:assert/strict";
import { gameCard, cardGameOf, cardBand, CARD_RATINGS, MIN_MATCHES, type CardMatch } from "../../shared/darts-rules/player-ratings.ts";

const x01 = (o: Partial<CardMatch> = {}): CardMatch => ({ game: "501", won: true, eloChange: 16, darts: 24, t100: 2, t140: 1, t180: 0, coAttempts: 4, coHits: 1, ...o });
const cri = (o: Partial<CardMatch> = {}, s: Partial<NonNullable<CardMatch["cricket"]>> = {}): CardMatch =>
  ({ game: "CRICKET", won: true, eloChange: 16, cricket: { darts: 45, visits: 15, marks: 30, bestVisit: 6, nineMarkVisits: 0, blankVisits: 3, ...s }, ...o });
const atw = (o: Partial<CardMatch> = {}, s: Partial<NonNullable<CardMatch["atw"]>> = {}): CardMatch =>
  ({ game: "ATW", won: true, eloChange: 16, atw: { darts: 50, visits: 17, trebleSkips: 3, doubleSkips: 4, bullDarts: 4, blankVisits: 5, ...s }, ...o });

test("stored game types map to cards", () => {
  assert.equal(cardGameOf("501"), "501"); assert.equal(cardGameOf("501_double_out"), "501");
  assert.equal(cardGameOf("301_double_out"), "301"); assert.equal(cardGameOf("Cricket"), "CRICKET");
  assert.equal(cardGameOf("Around the world"), "ATW"); assert.equal(cardGameOf("x01_handicap"), null);
  assert.equal(cardGameOf("team_301_doubles"), null); assert.equal(cardGameOf("Killer"), null);
});

test("each card has six ratings and needs five games", () => {
  for (const g of ["501", "301", "CRICKET", "ATW"] as const) assert.equal(CARD_RATINGS[g].length, 6);
  assert.equal(gameCard("501", Array(MIN_MATCHES - 1).fill(x01())), null);
  assert.equal(gameCard("501", Array(10).fill(cri())), null, "cricket games don't count for 501");
  const c = gameCard("501", Array(MIN_MATCHES).fill(x01()))!;
  assert.deepEqual(Object.keys(c.ratings).sort(), CARD_RATINGS["501"].map(i => i.key).sort());
});

test("ratings stay 40-99 and better darts rate higher", () => {
  const good = gameCard("501", Array(10).fill(x01({ darts: 15, t100: 2, t140: 1, t180: 1, coHits: 3, eloChange: 24 })))!;
  const poor = gameCard("501", Array(10).fill(x01({ darts: 45, t100: 0, t140: 0, coHits: 0, won: false, eloChange: 24 })))!;
  for (const c of [good, poor]) for (const v of Object.values(c.ratings)) assert.ok(v == null || (v >= 40 && v <= 99));
  for (const k of ["SCO", "FIN", "FRM", "WIN"]) assert.ok((good.ratings[k] ?? 0) > (poor.ratings[k] ?? 0), k);
  assert.ok(good.overall > poor.overall);
});

test("consistency rewards steady legs", () => {
  const steady = gameCard("501", [18, 19, 18, 20, 19, 18].map(d => x01({ darts: d })))!;
  const streaky = gameCard("501", [12, 40, 15, 36, 13, 39].map(d => x01({ darts: d })))!;
  assert.ok(steady.ratings.CON! > streaky.ratings.CON!);
});

test("301 pace is scaled for the shorter game", () => {
  const c = gameCard("301", Array(6).fill(x01({ game: "301", darts: 15 })))!;
  assert.ok(c.ratings.PAC! > gameCard("501", Array(6).fill(x01({ darts: 15 })))!.ratings.PAC! - 30);
  assert.ok(c.ratings.PAC! >= 70);
});

test("wins over stronger players count more", () => {
  const giantKiller = gameCard("501", [...Array(3).fill(x01({ eloChange: 28 })), ...Array(3).fill(x01({ won: false, eloChange: 28 }))])!;
  const flatTrack = gameCard("501", [...Array(3).fill(x01({ eloChange: 6 })), ...Array(3).fill(x01({ won: false, eloChange: 6 }))])!;
  assert.ok(giantKiller.ratings.WIN! > flatTrack.ratings.WIN!);
});

test("cricket and ATW detail only from live-scored games", () => {
  const resultsOnly = gameCard("CRICKET", Array(8).fill(cri({ cricket: null })))!;
  assert.equal(resultsOnly.ratings.MPR, null);
  assert.ok(resultsOnly.ratings.FRM! >= 40 && resultsOnly.ratings.WIN! >= 40);
  const live = gameCard("CRICKET", Array(8).fill(cri({}, { marks: 60, nineMarkVisits: 2 })))!;
  assert.ok(live.ratings.MPR! > gameCard("CRICKET", Array(8).fill(cri({}, { marks: 20 })))!.ratings.MPR!);
  const a = gameCard("ATW", Array(6).fill(atw()))!;
  for (const k of ["PAC", "ACC", "SKP", "BUL"]) assert.ok(a.ratings[k] != null, k);
  assert.ok(gameCard("ATW", Array(6).fill(atw({}, { darts: 30, bullDarts: 1 })))!.ratings.BUL! > a.ratings.BUL!);
});

test("bands", () => {
  assert.equal(cardBand(59).id, "bronze"); assert.equal(cardBand(60).id, "silver"); assert.equal(cardBand(75).id, "gold"); assert.equal(cardBand(80).id, "elite");
});
