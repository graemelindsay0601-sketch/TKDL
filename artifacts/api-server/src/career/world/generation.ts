import { ATTRIBUTES, CONTEXTS, TIERS, WORLD_GENERATION_VERSION, CAREER_WORLD_CONFIG as W, CAREER_DEVELOPMENT_CONFIG as D } from "./config.ts";
import { scopedRandom, stableUuid, between, integer, normal, pick, weighted } from "./random.ts";
import { IDENTITY_POOLS, CURATED_NPCS } from "./identities.ts";
import { clamp, meanAbility, npcSchema, type Ability, type Npc, type Tier } from "./types.ts";

export function assertGenerationVersion(version: number): void {
  if (version !== WORLD_GENERATION_VERSION) throw new Error(`Unsupported Career generation version ${version}; migration required`);
}
export const tierForAbility = (value: number): Tier => value >= W.tierThresholds.ELITE ? "ELITE" : value >= W.tierThresholds.PROFESSIONAL ? "PROFESSIONAL" : value >= W.tierThresholds.AMATEUR ? "AMATEUR" : "GRASSROOTS";
export function stageForAge(age: number, peakStart: number, peakEnd: number): Npc["stage"] {
  return age < 23 ? "PROSPECT" : age < peakStart ? "DEVELOPING" : age <= peakEnd ? "PRIME" : "VETERAN";
}

function generateNpc(seed: string, version: number, worldKey: string, tier: Tier, season: number, names: Set<string>, prospect: boolean, ageRange?: readonly [number, number]): Npc {
  const identity = scopedRandom(seed, version, "identity", worldKey);
  const attributes = scopedRandom(seed, version, "attributes", worldKey);
  const development = scopedRandom(seed, version, "development-profile", worldKey);
  const pool = weighted(identity, IDENTITY_POOLS);
  const template = CURATED_NPCS.find(npc => worldKey === `curated:${npc.key}`);
  let firstName: string = template?.firstName ?? pick(identity, pool.first);
  let surname: string = template?.surname ?? pick(identity, pool.last);
  // Distinct names without numerical suffixes, including across later generations.
  while (names.has(`${firstName} ${surname}`)) surname = `${pick(identity, pool.last)}-${pick(identity, pool.last)}-${pick(identity, pool.last)}`;
  names.add(`${firstName} ${surname}`);
  const prospectClass = weighted(development, D.prospects);
  const centre = prospect ? between(attributes, prospectClass.ability[0], prospectClass.ability[1]) : W.ability[tier][0] + normal(attributes) * W.ability[tier][1];
  const ability = Object.fromEntries(ATTRIBUTES.map(key => [key, clamp(centre + normal(attributes) * W.attributeSpread, W.attributeMin, W.attributeMax)])) as Ability;
  const age = ageRange ? integer(identity, ageRange[0], ageRange[1]) : prospect ? integer(identity, ...D.prospectAge) : integer(identity, W.ages[tier][0], W.ages[tier][1]);
  const peakStart = integer(development, ...D.peakStart);
  const peakEnd = peakStart + integer(development, ...D.peakLength);
  const late = development() < D.lateBloomShare;
  const breakthroughAge = late ? integer(development, ...D.lateBreakthroughAge) : integer(development, ...D.earlyBreakthroughAge);
  const actualPeakStart = Math.max(peakStart, breakthroughAge);
  const actualPeakEnd = Math.max(peakEnd, breakthroughAge + D.peakLength[0]);
  const finalTier = prospect ? tierForAbility(meanAbility(ability)) : tier;
  return npcSchema.parse({
    id: stableUuid(seed, version, "npc", worldKey), worldKey,
    firstName, surname, nickname: template?.nickname ?? null,
    nationality: template?.nationality ?? pool.nationality, homeRegion: template?.homeRegion ?? pick(identity, pool.regions),
    dominantHand: identity() < W.leftHandedShare ? "LEFT" : "RIGHT", startingAge: age, age,
    stage: stageForAge(age, actualPeakStart, actualPeakEnd), tier: finalTier,
    professionalStatus: finalTier === "PROFESSIONAL" || finalTier === "ELITE" ? "PROFESSIONAL" : "AMATEUR",
    detailTier: template || finalTier === "ELITE" ? "FEATURED" : finalTier === "PROFESSIONAL" ? "STANDARD" : "BASIC",
    templateKey: template?.key ?? null, status: "ACTIVE", createdSeason: season, retiredSeason: null,
    ability, form: 0,
    tendencies: Object.fromEntries(CONTEXTS.map(key => [key, between(attributes, -W.tendencyLimit, W.tendencyLimit)])),
    development: {
      potential: clamp(Math.max(meanAbility(ability), prospect ? between(development, prospectClass.potential[0], prospectClass.potential[1]) : meanAbility(ability) + between(development, ...D.potentialHeadroom)), W.attributeMin, W.attributeMax),
      rate: between(development, ...D.developmentRate), volatility: between(development, ...D.volatility),
      peakStart: actualPeakStart, peakEnd: actualPeakEnd, breakthroughAge,
      declineProfile: pick(development, Object.keys(D.decline) as (keyof typeof D.decline)[]), lowAbilityYears: 0, recentDelta: 0,
    },
  });
}

export function generateInitialWorld(seed: string, version: number): Npc[] {
  assertGenerationVersion(version);
  const names = new Set<string>();
  const players: Npc[] = [];
  for (const tier of TIERS) {
    const curated = CURATED_NPCS.filter(npc => npc.tier === tier);
    for (let index = 0; index < W.population[tier]; index++) {
      const key = index < curated.length ? `curated:${curated[index].key}` : `initial:${tier}:${index}`;
      players.push(generateNpc(seed, version, key, tier, 1, names, false));
    }
  }
  return players;
}

export function generateProspects(seed: string, version: number, season: number, count: number, existing: readonly Npc[]): Npc[] {
  assertGenerationVersion(version);
  if (!Number.isSafeInteger(season) || season < 2 || !Number.isSafeInteger(count) || count < 0) throw new Error("Invalid generation request");
  const names = new Set(existing.map(npc => `${npc.firstName} ${npc.surname}`));
  return Array.from({ length: count }, (_, i) => generateNpc(seed, version, `generation:${season}:${i}`, "GRASSROOTS", season, names, true));
}

/**
 * A6.5 junior cohort, used only by saves on event database v2+ (which carry the
 * Junior Development Circuit). Generated on their own world keys, so every v1
 * player and every existing RNG stream is untouched. Juniors are ordinary NPCs:
 * prospect-grade ability, the same development and simulation as everyone else.
 */
export const JUNIOR_COHORT = Object.freeze({ initial: 40, annualIntake: 18, initialAges: [16, 17] as const, intakeAges: [16, 16] as const });
export function generateJuniorCohort(seed: string, version: number, season: number, count: number, existing: readonly Npc[], tag: string): Npc[] {
  assertGenerationVersion(version);
  const names = new Set(existing.map(npc => `${npc.firstName} ${npc.surname}`));
  const ages = tag === "initial" ? JUNIOR_COHORT.initialAges : JUNIOR_COHORT.intakeAges;
  return Array.from({ length: count }, (_, i) => generateNpc(seed, version, `junior:${tag}:${i}`, "GRASSROOTS", season, names, true, ages));
}
