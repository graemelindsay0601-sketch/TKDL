import { test } from "node:test";
import assert from "node:assert/strict";
import { reserveList, type InstanceRow } from "../../career/calendar/engine.ts";
import { R, type ParticipantFacts } from "../../career/calendar/eligibility.ts";
import type { Npc } from "../../career/world/types.ts";

// Real-world reserve lists for short qualified fields (see lockField):
// - Tour Card events top up from the Challenger (Challenge Tour) ranking, then the strongest non-card players;
// - ranking-qualified events take the next players down that ranking (PDC rule 3.7).

const npc = (id: string, tier = "AMATEUR") => ({ id, tier, status: "ACTIVE" }) as unknown as Npc;
const event = (eligibility: unknown) => ({ snapshot: { eligibility } }) as unknown as InstanceRow;

test("Tour Card event: reserves are non-card players, Challenger ranking first, then strongest", () => {
  const facts: Record<string, Partial<ParticipantFacts>> = {
    card: { tourCard: true, rankings: { challenger: 1 } },
    c3: { tourCard: false, rankings: { challenger: 3 } },
    c1: { tourCard: false, rankings: { challenger: 1 } },
    elite: { tourCard: false, rankings: {} },
    amateur: { tourCard: false, rankings: {} },
  };
  const pool = [npc("card", "ELITE"), npc("c3"), npc("amateur"), npc("elite", "ELITE"), npc("c1")];
  const picked = reserveList(event(R.tourCard()), pool, n => facts[n.id] as ParticipantFacts, n => n.tier, 3);
  assert.deepEqual(picked.map(n => n.id), ["c1", "c3", "elite"]);
});

test("ranking-qualified event: next players down the qualifying ranking, other rules still apply", () => {
  const rule = R.all(R.nonTourCard(), R.any(R.ranking("vault", 16), R.qualified("vault-championship")));
  const facts: Record<string, Partial<ParticipantFacts>> = {
    v17: { tourCard: false, rankings: { vault: 17 }, entitlementTargets: new Set() },
    v19: { tourCard: false, rankings: { vault: 19 }, entitlementTargets: new Set() },
    v18card: { tourCard: true, rankings: { vault: 18 }, entitlementTargets: new Set() },
    unranked: { tourCard: false, rankings: {}, entitlementTargets: new Set() },
  };
  const pool = ["v19", "unranked", "v18card", "v17"].map(id => npc(id));
  const picked = reserveList(event(rule), pool, n => facts[n.id] as ParticipantFacts, n => n.tier, 5);
  assert.deepEqual(picked.map(n => n.id), ["v17", "v19"]);
});

test("open events have no reserve list", () => {
  assert.deepEqual(reserveList(event(R.open()), [npc("a")], () => ({ rankings: {} }) as unknown as ParticipantFacts, n => n.tier, 4), []);
});
