import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSeason } from "../../career/calendar/generation.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import { CURRENT_EVENT_DATABASE_VERSION } from "../../career/calendar/config.ts";

/**
 * Guard for audit finding PROG-01 (fixed in event database v6). A SELECTION event with npcFill [0,0]
 * and no invitation policy only admits NPCs that hold an intake entitlement (calendar/engine.ts field
 * assembly). If a season can never issue enough such entitlements to reach minimumEntrants (plus the
 * one human), every edition is cancelled — including for a human who qualified by ranking.
 */
test("every executable event can reach its minimum field in a normal season (current edition)", () => {
  for (const season of [2, 3]) {
    const drafts = generateSeason(HARNESS_SEED, CURRENT_EVENT_DATABASE_VERSION, season);
    const unfillable: string[] = [];
    for (const d of drafts) {
      const s = d.snapshot as any;
      if (!d.executable || s.fieldPolicy !== "SELECTION" || s.invitationPolicy) continue;
      // v13 World Cup: the field is each nation's top two by ranking (national selection), not intake entitlements.
      if (s.format?.pairing === "NATION") continue;
      // ANZ Finals are filled by the standings provider after Night 5, not catalogue qualification outputs.
      if (d.definitionKey === "anz-premier-finals") continue;
      if (!(s.npcFill?.[0] === 0 && s.npcFill?.[1] === 0)) continue;
      const intake = new Set<string>(s.entitlementIntake ?? []);
      // Upper bound: every qualifying position of every same-season source edition issues a distinct NPC entitlement.
      let maxNpcs = 0;
      for (const src of drafts) for (const o of (src.snapshot as any).qualificationOutputs ?? [])
        if (intake.has(o.targetKey) && o.targetSeason === "SAME") maxNpcs += o.maxPosition;
      if (maxNpcs + 1 < s.minimumEntrants) unfillable.push(`S${season} ${d.definitionKey} (max ${maxNpcs} NPC + 1 human < min ${s.minimumEntrants})`);
    }
    assert.deepEqual([...new Set(unfillable)], [], "events that are cancelled every season by construction");
  }
});
