import { test } from "node:test";
import assert from "node:assert/strict";
import { writeMatchReport, scoringAverage, winningDouble, type ReportDart } from "../match-report.ts";

const visit = (v: number, phase = "scoring"): ReportDart[] => [20, 20, 20].map(() => ({ seg: 20, mult: v === 180 ? 3 : 1, val: v / 3, phase }));
const base = { matchId: 7, gameType: "501", stake: 20, upset: false, winner: { name: "Graeme" }, loser: { name: "Robert" } };

test("scoring average ignores checkout and typed darts", () => {
  const log = [...visit(60), ...visit(180), { seg: 16, mult: 2, val: 32, phase: "checkout" }, { seg: 0, mult: 1, val: 0, phase: "scoring", typed: true }];
  assert.equal(scoringAverage(log), 120);
  assert.equal(scoringAverage(visit(60)), null); // too few darts
});

test("winning double reads the last dart only when it is a double", () => {
  assert.equal(winningDouble([{ seg: 16, mult: 2, val: 32 }]), "D16");
  assert.equal(winningDouble([{ seg: 25, mult: 2, val: 50 }]), "the bull");
  assert.equal(winningDouble([{ seg: 16, mult: 1, val: 16 }]), null);
  assert.equal(winningDouble([]), null);
});

test("upset takes the headline and the ticker", () => {
  const r = writeMatchReport({ ...base, upset: true });
  assert.match(r.headline, /Graeme/);
  assert.equal(r.ticker, "upset");
  assert.match(r.paragraphs[0], /behind Robert/);
});

test("maximums and finishing come from the real numbers", () => {
  const r = writeMatchReport({ ...base, winner: { name: "Graeme", s180: 2, coAttempts: 4, coHits: 2, log: [...visit(100), ...visit(180), { seg: 8, mult: 2, val: 16, phase: "checkout" }] }, loser: { name: "Robert", s180: 0, coAttempts: 5, coHits: 0, log: [...visit(45), ...visit(60)] } });
  assert.equal(r.headline, "Graeme fires 2 maximums past Robert");
  const text = r.paragraphs.join(" ");
  assert.match(text, /averaging 140 .* against 52\.5/);
  assert.match(text, /won it on D8/);
  assert.match(text, /50% for Graeme against 0% for Robert/);
  assert.deepEqual(r.keyStats.map(k => k.label), ["Scoring average", "Doubles", "180s"]);
});

test("no stats means no invented stat lines", () => {
  const r = writeMatchReport({ ...base, gameType: "cricket", meetingNumber: 1 });
  assert.equal(r.paragraphs.length, 2);
  assert.match(r.headline, /first meeting/);
  assert.equal(r.keyStats.length, 0);
});

test("head-to-head line counts this win", () => {
  const r = writeMatchReport({ ...base, meetingNumber: 6, winnerWinsBefore: 1, loserWinsBefore: 4 });
  assert.equal(r.ticker, "revenge win");
  assert.match(r.paragraphs.at(-1)!, /Robert still leads the head-to-head 4–2/);
  const level = writeMatchReport({ ...base, meetingNumber: 4, winnerWinsBefore: 1, loserWinsBefore: 2 });
  assert.match(level.paragraphs.at(-1)!, /level at 2–2/);
});

test("x01 variants like 301_double_out count as x01", () => {
  const r = writeMatchReport({ ...base, gameType: "301_double_out", winner: { name: "Graeme", log: [{ seg: 5, mult: 2, val: 10, phase: "checkout" }] } });
  assert.match(r.paragraphs.join(" "), /won it on D5/);
});

test("a broken league record leads the report", () => {
  const r = writeMatchReport({ ...base, records: [{ title: "Fewest darts to win a 501", unit: "darts", playerName: "Graeme", value: 12, previous: 15, previousHolder: "Robert" }] });
  assert.equal(r.headline, "League record! Graeme sets the fewest darts to win a 501");
  assert.equal(r.ticker, "league record");
  assert.deepEqual(r.records, ["Graeme: fewest darts to win a 501, 12 darts (was 15, Robert)."]);
});

test("a 501 won in nine darts is called a nine-darter", () => {
  const r = writeMatchReport({ ...base, winner: { name: "Graeme", darts: 9, s180: 2 } });
  assert.match(r.headline, /^NINE-DARTER!/);
  assert.match(r.paragraphs.join(" "), /perfect game/);
});
