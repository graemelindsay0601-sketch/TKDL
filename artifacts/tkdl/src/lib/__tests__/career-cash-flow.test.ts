import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSeasonCashFlow } from "../../features/career/model.ts";
import type { SponsorGuaranteePayment } from "../../features/career/types.ts";

const payment = (o: Partial<SponsorGuaranteePayment> = {}): SponsorGuaranteePayment => ({
  operationKey: "guarantee-1", contractId: "contract-1", sponsorKey: "sponsor-1", displayName: "Sponsor",
  amountPence: 2_000, cadence: "MONTHLY", termIndex: 0, installment: 1, installments: 12, season: 2, week: 5,
  status: "SCHEDULED", ...o,
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
