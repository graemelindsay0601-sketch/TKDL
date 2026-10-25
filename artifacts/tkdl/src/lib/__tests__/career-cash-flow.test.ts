import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSeasonCashFlow } from "../../features/career/model.ts";
import type { SponsorConditionalEventPayment, SponsorGuaranteePayment } from "../../features/career/types.ts";

const payment = (o: Partial<SponsorGuaranteePayment> = {}): SponsorGuaranteePayment => ({
  operationKey: "guarantee-1", contractId: "contract-1", sponsorKey: "sponsor-1", displayName: "Sponsor",
  amountPence: 2_000, cadence: "MONTHLY", termIndex: 0, installment: 1, installments: 12, season: 2, week: 5,
  status: "SCHEDULED", ...o,
});
const eventPayment = (o: Partial<SponsorConditionalEventPayment> = {}): SponsorConditionalEventPayment => ({
  contractId: "event-contract", sponsorKey: "sponsor-1", displayName: "Sponsor", amountPence: 1_500,
  circuits: ["DEVELOPMENT"], maxEventsPerSeason: 3, paidEvents: 1, remainingEvents: 2, status: "ACTIVE",
  start: { season: 2, week: 3 }, end: { season: 2, week: 20 }, ...o,
});

test("cash forecast applies only confirmed sponsor instalments and keeps prizes out of available cash", () => {
  const rows = buildSeasonCashFlow(2, 5, 7, 10_000, [
    { id: "event-1", name: "Week Five Open", startWeek: 5, estimatedCostPence: 8_000, possiblePrizePence: 50_000 },
    { id: "event-2", name: "Week Seven Open", startWeek: 7, estimatedCostPence: 5_000, possiblePrizePence: 20_000 },
  ], [
    payment({ operationKey: "due-now", status: "DUE" }),
    payment({ operationKey: "next-week", week: 6, amountPence: 3_000 }),
    payment({ operationKey: "already-paid", week: 7, amountPence: 12_000, status: "PAID" }),
    payment({ operationKey: "overdue", week: 7, amountPence: 9_000, status: "PAST_DUE" }),
    payment({ operationKey: "other-season", season: 3, week: 7, amountPence: 15_000 }),
  ]);

  assert.deepEqual(rows.map(row => [row.week, row.incomePence, row.cost, row.remaining]), [
    [5, 2_000, 8_000, 4_000],
    [6, 3_000, 0, 7_000],
    [7, 0, 5_000, 2_000],
  ]);
  assert.equal(rows[0].possiblePrize, 50_000);
  assert.equal(rows[0].remaining, 4_000);
  assert.deepEqual(rows[2].income, []);
});

test("weeks without events or confirmed income preserve the available balance", () => {
  const rows = buildSeasonCashFlow(1, 10, 12, 7_500, [], [
    payment({ season: 1, week: 11, status: "PAID" }),
    payment({ season: 1, week: 12, status: "PAST_DUE" }),
  ]);
  assert.deepEqual(rows.map(row => [row.week, row.remaining]), [[10, 7_500], [11, 7_500], [12, 7_500]]);
});

test("conditional event payments are shown separately, respect circuits, contract dates and season caps", () => {
  const rows = buildSeasonCashFlow(2, 5, 8, 10_000, [
    { id: "event-a", name: "Eligible Open", circuit: "DEVELOPMENT", startWeek: 5, endWeek: 7, estimatedCostPence: 2_000, possiblePrizePence: 10_000 },
    { id: "event-b", name: "Second Eligible Open", circuit: "DEVELOPMENT", startWeek: 6, endWeek: 6, estimatedCostPence: 0, possiblePrizePence: 0 },
    { id: "event-c", name: "Wrong Circuit", circuit: "PRO_CIRCUIT", startWeek: 7, endWeek: 7, estimatedCostPence: 0, possiblePrizePence: 0 },
    { id: "event-d", name: "After Contract", circuit: "DEVELOPMENT", startWeek: 8, endWeek: 8, estimatedCostPence: 0, possiblePrizePence: 0 },
  ], [], [
    eventPayment({ remainingEvents: 1, maxEventsPerSeason: 2, end: { season: 2, week: 7 } }),
    eventPayment({ contractId: "starts-late", start: { season: 2, week: 6 }, end: { season: 2, week: 7 } }),
  ]);

  assert.deepEqual(rows.map(row => [row.week, row.conditionalPence, row.remaining]), [
    [5, 0, 8_000], [6, 1_500, 8_000], [7, 1_500, 8_000], [8, 0, 8_000],
  ]);
  assert.deepEqual(rows[2].conditionalIncome.map(payment => payment.eventId), ["event-a"]);
  assert.deepEqual(rows[1].conditionalIncome.map(payment => payment.contractId), ["starts-late"]);
});
