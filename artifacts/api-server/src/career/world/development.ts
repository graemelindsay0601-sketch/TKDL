import { ATTRIBUTES, CAREER_DEVELOPMENT_CONFIG as D, CAREER_WORLD_CONFIG as W, targetPopulation } from "./config.ts";
import { scopedRandom, normal } from "./random.ts";
import { clamp, meanAbility, npcSchema, type Npc, type Ability } from "./types.ts";
import { stageForAge, tierForAbility, generateProspects, assertGenerationVersion } from "./generation.ts";
import { regressForm } from "./form.ts";

export function developNpc(npc: Npc, seed: string, version: number, periodKey: string, elapsedYears: number, opportunity: number): Npc {
  assertGenerationVersion(version);
  npcSchema.parse(npc);
  if (!Number.isFinite(elapsedYears) || elapsedYears < 0 || elapsedYears > 1 || !Number.isFinite(opportunity) || opportunity < 0 || opportunity > 1) throw new Error("Invalid development period");
  if (npc.status === "RETIRED" || elapsedYears === 0) return structuredClone(npc);
  const rng = scopedRandom(seed, version, "development", periodKey, npc.id);
  const d = npc.development;
  const before = meanAbility(npc.ability);
  const headroom = clamp((d.potential - before) / D.headroomScale, 0, 1);
  const timing = npc.age < d.breakthroughAge ? D.preBreakthroughFactor : npc.age <= d.peakStart ? 1 : D.peakGrowthFactor;
  const growth = rng() < D.plateauChance ? 0 : d.rate * headroom * timing * (D.opportunityFloor + opportunity * (1 - D.opportunityFloor));
  const decline = D.decline[d.declineProfile];
  const pastPeak = Math.max(0, npc.age - d.peakEnd - decline.grace);
  const declineRate = pastPeak > 0 ? decline.rate + pastPeak * decline.acceleration : 0;
  const delta = (growth - declineRate) * elapsedYears + normal(rng) * d.volatility * Math.sqrt(elapsedYears);
  const ceilingHeadroom = Math.max(0, d.potential - before);
  const ability = Object.fromEntries(ATTRIBUTES.map(attribute => [attribute,
    clamp(npc.ability[attribute] + Math.min(ceilingHeadroom, delta * (1 + normal(rng) * D.attributeDeltaSpread)), W.attributeMin, W.attributeMax),
  ])) as Ability;
  const after = meanAbility(ability);
  const tier = tierForAbility(after);
  return npcSchema.parse({ ...npc, ability, tier, professionalStatus: tier === "ELITE" || tier === "PROFESSIONAL" ? "PROFESSIONAL" : "AMATEUR",
    form: regressForm(npc.form, elapsedYears),
    development: { ...d, recentDelta: after - before, lowAbilityYears: after < D.retirement.lowAbilityThreshold ? Math.min(W.maximumAge, d.lowAbilityYears + elapsedYears) : 0 },
  });
}

export function retirementProbability(npc: Npc): number {
  const r = D.retirement;
  if (npc.age >= W.maximumAge) return 1; // Defensive storage bound, not the normal retirement model.
  return clamp((r.base + Math.max(0, npc.age - r.ageStart) * r.ageWeight
    + Math.max(0, r.lowAbilityThreshold - meanAbility(npc.ability)) / r.lowAbilityThreshold * r.lowAbilityWeight
    + Math.max(0, -npc.development.recentDelta) * r.declineWeight
    + npc.development.lowAbilityYears * r.lowYearsWeight
    + (npc.stage === "VETERAN" ? r.veteranWeight : 0)) * (npc.professionalStatus === "AMATEUR" ? r.amateurMultiplier : 1), 0, r.maximumChance);
}

/**
 * Player database v4: the base population (the original world and its prospects) is topped up on its own count.
 * Juniors, women's intake, club and international squads and substitutes are maintained separately, so they no
 * longer hide retirements from the base pool (which otherwise never received new prospects).
 */
export const isBasePopulation = (npc: Npc) => /^(initial|curated|generation):/.test(npc.worldKey);

export function evolveOffSeason(players: readonly Npc[], seed: string, version: number, season: number, remainingYear: number, opportunity: number,
  countsTowardTarget: (npc: Npc) => boolean = () => true, target = targetPopulation()) {
  assertGenerationVersion(version);
  const retired: string[] = [];
  const evolved = players.map(player => {
    if (player.status === "RETIRED") return structuredClone(player);
    const developed = developNpc(player, seed, version, `offseason:${season}`, remainingYear, opportunity);
    const retire = scopedRandom(seed, version, "retirement", season, player.id)() < retirementProbability(developed);
    if (retire) {
      retired.push(player.id);
      return npcSchema.parse({ ...developed, status: "RETIRED", stage: "RETIRED", retiredSeason: season });
    }
    const age = developed.age + 1;
    return npcSchema.parse({ ...developed, age, stage: stageForAge(age, developed.development.peakStart, developed.development.peakEnd) });
  });
  const deficit = Math.max(0, target - evolved.filter(npc => npc.status === "ACTIVE" && countsTowardTarget(npc)).length);
  const entrants = generateProspects(seed, version, season + 1, deficit, evolved);
  return { players: [...evolved, ...entrants], retired, entrants: entrants.map(npc => npc.id) };
}

/**
 * Player database v5: a steady world. Juniors grow up into the open (men's) pool, so the open pool is the base
 * population plus every junior; retirements there are replaced by the junior intake first (at least a small
 * class every season, so the junior circuit never empties) and then by adult prospects. The women's intake
 * replaces the women's cohort's retirements. Squads (v4) already hold their size.
 */
export const STEADY_WORLD = Object.freeze({ openTarget: targetPopulation() + 40, junior: { minimum: 6, maximum: 18 }, womenTarget: 80, women: { minimum: 4, maximum: 20 } });
export const isOpenPopulation = (npc: Npc) => isBasePopulation(npc) || npc.worldKey.startsWith("junior:");
export const isWomenCohort = (npc: Npc) => /^women:\d+:/.test(npc.worldKey);
export function steadyIntakes(players: readonly Npc[]) {
  const active = players.filter(npc => npc.status === "ACTIVE");
  const openDeficit = Math.max(0, STEADY_WORLD.openTarget - active.filter(isOpenPopulation).length);
  const junior = clamp(openDeficit, STEADY_WORLD.junior.minimum, STEADY_WORLD.junior.maximum);
  return { junior, prospects: Math.max(0, openDeficit - junior),
    women: clamp(STEADY_WORLD.womenTarget - active.filter(isWomenCohort).length, STEADY_WORLD.women.minimum, STEADY_WORLD.women.maximum) };
}
