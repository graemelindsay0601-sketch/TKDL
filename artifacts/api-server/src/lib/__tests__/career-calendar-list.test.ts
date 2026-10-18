import { test } from "node:test";
import assert from "node:assert/strict";
import { listEvent } from "../../career/calendar/service.ts";

test("calendar list events keep what list screens read and drop the heavy detail-only content", () => {
  const event = {
    id: "e1", name: "Pro Tour 1", venue: { key: "v", city: "Wolverhampton" }, finance: { entryFeePence: 100 }, format: { days: 1 }, human: { canEnter: true },
    seedingPolicy: { list: "pro-world", seeds: 32 }, profiles: { prize: "prize:pro" },
    qualificationOutputs: [{ maxPosition: 3, entitlementType: "EVENT_ENTRY", targetKey: "world-championship", targetSeason: "SAME", consumption: "SINGLE_USE" }],
    opportunity: { state: "OPEN", reasons: [], canEnter: true, authority: "A3 eligibility/entries" },
    content: { circuitId: "pro-tour", circuitName: "Pro Tour", summary: "A floor event.", eventClass: "PRO_TOUR", trophyId: "plate",
      venue: { mapAnchor: { latitude: 1, longitude: 2 }, history: { venueKey: "v" } }, themeKey: "event:pro-tour", longevity: "RECURRING" },
  };
  const lean = listEvent(event);
  assert.deepEqual(lean.content, { circuitId: "pro-tour", circuitName: "Pro Tour", summary: "A floor event.", eventClass: "PRO_TOUR", trophyId: "plate" });
  assert.deepEqual(lean.qualificationStakes, [{ maxPosition: 3, entitlementType: "EVENT_ENTRY", targetKey: "world-championship", targetSeason: "SAME" }]);
  assert.deepEqual(lean.opportunity, { state: "OPEN", reasons: [], canEnter: true });
  assert.ok(!("profiles" in lean) && !("qualificationOutputs" in lean));
  for (const key of ["id", "name", "venue", "finance", "format", "human", "seedingPolicy"] as const) assert.deepEqual(lean[key], event[key], key);
  assert.equal(listEvent({ ...event, content: null }).content, null, "events without stored content stay null");
  assert.ok(JSON.stringify(event.content).includes("mapAnchor"), "the source event is not mutated");
});
