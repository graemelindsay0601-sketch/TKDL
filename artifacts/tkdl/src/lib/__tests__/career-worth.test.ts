import { test } from "node:test";
import assert from "node:assert/strict";
import { worthIt } from "../../features/career/model.ts";
import type { EventFinancePreview } from "../../features/career/types.ts";

const f = (cost: number, bands: [number, number][]): EventFinancePreview => ({
  affordable: true, currency: "GBP", travelBand: "DOMESTIC", nights: 0, entryFeePence: 500, entryFeeBasis: "PER_EVENT", estimatedTravelPence: 0, estimatedAccommodationPence: 0,
  sponsorCoverage: { entryFeePence: 0, travelPence: 0, accommodationPence: 0 }, estimatedPlayerCostPence: cost, balancePence: 0, availablePence: 0,
  prizeProfile: "p", topPrizePence: bands[0]?.[1] ?? 0, rankingEligible: false, commitment: null,
  prizeBands: bands.map(([upToPosition, amountPence]) => ({ upToPosition, amountPence })),
});

test("worth it: the earliest round whose prize pays back your costs", () => {
  const ladder: [number, number][] = [[1, 50000], [2, 20000], [4, 10000], [8, 5000], [16, 2500]];
  assert.deepEqual([worthIt(f(1500, ladder))!.tone, worthIt(f(1500, ladder))!.label], ["good", "£15 to play. You get it back if you reach the last 16."]);
  assert.equal(worthIt(f(8000, ladder))!.label, "£80 to play. You get it back if you reach the semi-finals.");
  assert.equal(worthIt(f(30000, ladder))!.tone, "poor", "only a win pays");
  assert.equal(worthIt(f(30000, ladder))!.label, "£300 to play. Only the winner gets it back.");
});

test("worth it: a trip the winner's prize cannot cover, free nights and prize-less nights", () => {
  const night: [number, number][] = [[1, 2500], [2, 1000]];
  assert.deepEqual([worthIt(f(6500, night))!.tone, worthIt(f(6500, night))!.label], ["poor", "£65 to play. Even the winner ends up £40 down."]);
  assert.equal(worthIt(f(0, night))!.label, "Free to play. The winner gets £25.");
  assert.equal(worthIt(f(500, []))!.label, "£5 to play. No prize money.");
  assert.equal(worthIt(null), null);
});
