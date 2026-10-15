import { ATTRIBUTES, CAREER_DEVELOPMENT_CONFIG as D, CAREER_WORLD_CONFIG as W, targetPopulation } from "./config.ts";
import { scopedRandom, normal, between, integer } from "./random.ts";
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

/**
 * Player database v6: the top of the pyramid holds. Real darts keeps a steady top 32 and 128 Tour Card holders
 * because new players keep breaking through; generated prospects alone rarely have that ceiling, so the elite and
 * the tour level thinned out over long Careers. Each off-season the elite and tour-level counts, plus the players
 * already rising towards them, are compared with the world's targets; any shortfall goes to the best young players
 * one level below as a breakthrough (a higher ceiling and growth from now), and they rise over the next seasons.
 * The open (men's) game and the women's game are counted separately.
 */
export const PYRAMID = Object.freeze({
  open: { elite: 36, tourLevel: 140 },
  women: { elite: 8, tourLevel: 24 },
  maximumAge: 34, minimumRate: 2, growthYears: [6, 9] as const, risingWeight: 0.5, fadingWeight: 0.25,
  elite: { potential: [76, 90] as const, perSeason: 6, risingFrom: 50 },
  tour: { potential: [60, 72] as const, perSeason: 10, risingFrom: 38 },
});
const isWomen = (npc: Npc) => npc.worldKey.startsWith("women:");
const tourLevel = (npc: Npc) => npc.tier === "ELITE" || npc.tier === "PROFESSIONAL";

export function breakthroughs(players: readonly Npc[], seed: string, version: number, season: number) {
  const P = PYRAMID, chosen = new Map<string, Npc>(), bands = new Map<string, "ELITE" | "TOUR">();
  const best = (a: Npc, b: Npc) => meanAbility(b.ability) - meanAbility(a.ability) || a.id.localeCompare(b.id);
  /** Already on the way up: a ceiling in the band, quick development, past the breakthrough age and close enough. */
  const rising = (npc: Npc, band: typeof P.elite | typeof P.tour) => npc.age >= npc.development.breakthroughAge && npc.age < npc.development.peakStart
    && npc.development.potential >= band.potential[0] && npc.development.rate >= P.minimumRate && meanAbility(npc.ability) >= band.risingFrom;
  for (const [game, targets] of [["open", P.open], ["women", P.women]] as const) {
    const pool = players.filter(npc => npc.status === "ACTIVE" && isWomen(npc) === (game === "women"));
    const plan = [
      { band: P.elite, reached: (npc: Npc) => npc.tier === "ELITE", target: targets.elite, from: ["PROFESSIONAL", "AMATEUR"] },
      { band: P.tour, reached: tourLevel, target: targets.tourLevel, from: ["AMATEUR", "GRASSROOTS"] },
    ] as const;
    for (const { band, reached, target, from } of plan) {
      // Rising players count half: they take several seasons to arrive and not all of them do.
      // Looking ahead (a breakthrough takes a few seasons): players there but past their peak count a quarter.
      const there = pool.filter(reached), fading = there.filter(npc => npc.age > npc.development.peakEnd).length;
      const need = target - (there.length - fading) - Math.floor(fading * P.fadingWeight)
        - Math.ceil(pool.filter(npc => !reached(npc) && (chosen.has(npc.id) || rising(npc, band))).length * P.risingWeight);
      // The best young players one level below first, then the level below that when they run short.
      const candidates = from.flatMap(tier => pool.filter(npc => npc.tier === tier && npc.age <= P.maximumAge && !chosen.has(npc.id) && !rising(npc, band)).sort(best));
      for (const npc of candidates.slice(0, clamp(need, 0, band.perSeason))) {
        const rng = scopedRandom(seed, version, "breakthrough", season, npc.id), d = npc.development;
        const peakStart = Math.max(d.peakStart, npc.age + integer(rng, ...P.growthYears));
        bands.set(npc.id, band === P.elite ? "ELITE" : "TOUR");
        chosen.set(npc.id, npcSchema.parse({ ...npc, development: { ...d, potential: Math.max(d.potential, between(rng, band.potential[0], band.potential[1])),
          rate: Math.max(d.rate, between(rng, P.minimumRate + 0.5, D.developmentRate[1])), breakthroughAge: Math.min(d.breakthroughAge, npc.age),
          peakStart, peakEnd: Math.max(d.peakEnd, peakStart + D.peakLength[0]) } }));
      }
    }
  }
  return { players: players.map(npc => chosen.get(npc.id) ?? npc), breakthroughs: [...chosen.keys()],
    /** For the close-season news (who is tipped, and for which level); best first within each band. */
    tips: [...bands].map(([id, band]) => ({ id, band })) };
}
