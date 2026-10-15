import { generateNpc } from "../world/generation.ts";
import { localIdentity } from "../world/geographical-identities.ts";
import { npcSchema, type Npc, type Tier } from "../world/types.ts";
import { LOCALITIES } from "./geography.ts";
import type { Rule } from "./eligibility.ts";
import type { InstanceRow } from "./engine.ts";

/**
 * Substitutes: when a selection event is still short of its minimum after locals and guests (everyone eligible is
 * already playing elsewhere that day), club players from the event's own area are created to make up the field,
 * as real county and club events always find players. They are ordinary, permanent players from then on
 * (named for their country, living where the event is played, at the event's level and age or category), so
 * the same faces turn up again. Deterministic from the world seed and the event.
 */
const TIER_ORDER: Tier[] = ["AMATEUR", "GRASSROOTS", "PROFESSIONAL", "ELITE"];

function rulesIn(rule: Rule): Rule[] {
  if ("all" in rule) return rule.all.flatMap(rulesIn);
  if ("any" in rule) return rule.any.flatMap(rulesIn);
  if ("not" in rule) return [];
  return [rule];
}

export function substitutesFor(seed: string, version: number, event: InstanceRow, count: number, existing: readonly Npc[], tierWeights: Record<string, number>): Npc[] {
  if (count <= 0) return [];
  const rules = rulesIn(event.snapshot.eligibility);
  const women = rules.some(r => "type" in r && r.type === "WOMEN");
  const age = rules.find((r): r is Extract<Rule, { type: "AGE" }> => "type" in r && r.type === "AGE");
  const ageRange: readonly [number, number] | undefined = age
    ? [Math.max(16, age.minAge ?? 16), Math.max(Math.max(16, age.minAge ?? 16), Math.min(60, (age.maxAgeExclusive ?? 61) - 1))] : undefined;
  const tier = TIER_ORDER.find(t => (tierWeights[t] ?? 0) > 0) ?? "AMATEUR";
  const region = event.locality_key ? LOCALITIES.find(l => l.key === event.locality_key)?.region ?? null : null;
  const used = new Set(existing.map(p => `${p.firstName} ${p.surname}`));
  const out: Npc[] = [];
  for (let i = 0; i < count; i++) {
    const worldKey = `${women ? "women:" : ""}sub:${event.season}:${event.instance_key}:${i}`;
    const identity = localIdentity(seed, worldKey, event.country, region, women, used);
    if (!identity) break;
    const npc = generateNpc(seed, version, worldKey, tier, event.season, new Set(used), false, ageRange);
    out.push(npcSchema.parse({ ...npc, ...identity, nickname: null }));
  }
  return out;
}
