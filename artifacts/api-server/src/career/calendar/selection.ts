import type { Npc, Tier } from "../world/types.ts";
import type { Random } from "../world/random.ts";
import type { GeographyPolicy } from "./catalogue.ts";
import { npcFacts } from "./providers.ts";

/**
 * Participation weighting only. Geography and tier change who is likely to
 * travel to an event; nationality never changes ability or ceilings, and any
 * NPC can appear anywhere their eligibility allows.
 */
export type EventGeo = { country: string; zone: string; localityKey: string | null };

export function geographyWeight(policy: GeographyPolicy, event: EventGeo, npc: Npc): number {
  const home = npcFacts(npc);
  const sameCountry = home.country === event.country, sameZone = home.zone === event.zone;
  switch (policy.kind) {
    case "LOCALITY": return event.localityKey && home.locality === event.localityKey ? 1 : sameCountry ? 0.25 : sameZone ? 0.04 : 0;
    case "REGION": return event.localityKey && home.locality === event.localityKey ? 1 : sameCountry ? 0.3 : sameZone ? 0.05 : 0;
    case "COUNTRY": return sameCountry ? 1 : sameZone ? 0.25 : 0.03;
    case "ZONE": return sameZone ? 1 : 0.3;
    case "INTERNATIONAL": return sameCountry ? policy.hostBonus : 1;
  }
}

/**
 * Deterministic weighted sampling without replacement (Efraimidis–Spirakis):
 * key = -ln(u) / w, smallest keys win. Candidates are pre-sorted by id so the
 * outcome depends only on the scoped RNG and the candidate set.
 */
export function weightedSample<T extends { id: string }>(candidates: readonly T[], weight: (c: T) => number, count: number, rng: Random): T[] {
  return [...candidates].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map(candidate => ({ candidate, w: weight(candidate), u: rng() }))
    .filter(entry => entry.w > 0)
    .map(entry => ({ candidate: entry.candidate, key: -Math.log(1 - entry.u) / entry.w }))
    .sort((a, b) => a.key - b.key)
    .slice(0, Math.max(0, count))
    .map(entry => entry.candidate);
}

export const tierWeight = (weights: Record<Tier, number>, npc: Npc, tierOf: (npc: Npc) => Tier = n => n.tier) => weights[tierOf(npc)] ?? 0;

/** Deterministic NPC fill target within the definition's [min,max] fraction. */
export function fillTarget(capacity: number, fill: [number, number], rng: Random): number {
  const low = Math.floor(capacity * fill[0]), high = Math.floor(capacity * fill[1]);
  return Math.min(capacity, low + Math.floor(rng() * (high - low + 1)));
}
