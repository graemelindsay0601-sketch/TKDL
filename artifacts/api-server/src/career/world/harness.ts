import { performance } from "node:perf_hooks";
import type { CareerDifficulty } from "../config.ts";
import { generateInitialWorld } from "./generation.ts";
import { simulateNpcMatch } from "./simulation.ts";
import { ATTRIBUTES, WORLD_GENERATION_VERSION, SIMULATION_VERSION } from "./config.ts";
import { meanAbility, npcSchema, type Ability, type Npc } from "./types.ts";

export const HARNESS_SEED = "a12e".repeat(16);
export const BALANCE_CLASSES = [
  { name: "Elite vs Top-32 calibre", stronger: 85, weaker: 73 },
  { name: "Top-32 vs Established Pro", stronger: 73, weaker: 63 },
  { name: "Established vs Lower Pro", stronger: 63, weaker: 54 },
  { name: "Pro vs Regional", stronger: 54, weaker: 43 },
  { name: "Regional vs Grassroots", stronger: 43, weaker: 28 },
] as const;

export function describe(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, n) => sum + (n - mean) ** 2, 0) / values.length);
  const quantile = (fraction: number) => sorted[Math.floor((sorted.length - 1) * fraction)];
  return { min: sorted[0], p10: quantile(0.1), median: quantile(0.5), p90: quantile(0.9), max: sorted.at(-1), mean, sd,
    aboveTwoSdPct: values.filter(n => n > mean + 2 * sd).length / values.length * 100 };
}
const counts = (values: string[]) => values.reduce<Record<string, number>>((result, value) => { result[value] = (result[value] ?? 0) + 1; return result; }, {});

export function worldReport(seed = HARNESS_SEED, version = WORLD_GENERATION_VERSION) {
  const started = performance.now();
  const players = generateInitialWorld(seed, version);
  const names = players.map(npc => `${npc.firstName} ${npc.surname}`);
  return { seed, version, generationMs: performance.now() - started, active: players.filter(npc => npc.status === "ACTIVE").length,
    tiers: counts(players.map(npc => npc.tier)), stages: counts(players.map(npc => npc.stage)),
    ages: describe(players.map(npc => npc.age)), ability: describe(players.map(npc => meanAbility(npc.ability))),
    attributes: Object.fromEntries(ATTRIBUTES.map(key => [key, describe(players.map(npc => npc.ability[key]))])),
    potential: describe(players.map(npc => npc.development.potential)),
    professional: players.filter(npc => npc.professionalStatus === "PROFESSIONAL").length,
    elite: players.filter(npc => npc.tier === "ELITE").length, prospects: players.filter(npc => npc.stage === "PROSPECT").length,
    nationalities: counts(players.map(npc => npc.nationality)), regions: counts(players.map(npc => `${npc.nationality}/${npc.homeRegion}`)),
    duplicateNames: names.length - new Set(names).size, invalidAttributes: players.filter(npc => !npcSchema.safeParse(npc).success).length,
    curated: players.filter(npc => npc.templateKey).length,
  };
}

export function calibratedNpc(template: Npc, ability: number): Npc {
  return { ...template, form: 0, ability: Object.fromEntries(ATTRIBUTES.map(key => [key, ability])) as Ability,
    tendencies: { local: 0, floor: 0, stage: 0, qualifier: 0, major: 0 } };
}

export function balanceReport(totalMatches = 10_000, seed = HARNESS_SEED, difficulty: CareerDifficulty = "STANDARD") {
  if (!Number.isSafeInteger(totalMatches) || totalMatches < 10_000) throw new Error("Balance harness requires at least 10,000 matches");
  const started = performance.now();
  const world = generateInitialWorld(seed, WORLD_GENERATION_VERSION);
  const perGroup = Math.ceil(totalMatches / (BALANCE_CLASSES.length * 2));
  const groups = [];
  for (const matchup of BALANCE_CLASSES) {
    const players: [Npc, Npc] = [calibratedNpc(world[0], matchup.stronger), calibratedNpc(world[1], matchup.weaker)];
    for (const bestOf of [7, 31]) {
      let strongerWins = 0;
      const averages: [number[], number[]] = [[], []];
      const checkouts = [0, 0], attempts = [0, 0], maximums = [0, 0];
      for (let i = 0; i < perGroup; i++) {
        const result = simulateNpcMatch({ players, seed, generationVersion: WORLD_GENERATION_VERSION, matchKey: `${matchup.name}:${i}`, difficulty,
          context: { category: "floor", roundImportance: 0.2, elimination: false }, format: { bestOf, firstThrow: (i % 2) as 0 | 1 } });
        if (result.winnerId === players[0].id) strongerWins++;
        for (const who of [0, 1] as const) {
          averages[who].push(result.stats[who].average); checkouts[who] += result.stats[who].checkouts;
          attempts[who] += result.stats[who].doubleAttempts; maximums[who] += result.stats[who].maximums;
        }
      }
      groups.push({ matchup: matchup.name, bestOf, matches: perGroup, strongerWinPct: strongerWins / perGroup * 100,
        upsetPct: (perGroup - strongerWins) / perGroup * 100, averages: averages.map(describe),
        checkoutPct: checkouts.map((value, i) => value / attempts[i] * 100), maximums });
    }
  }
  return { seed, difficulty, generationVersion: WORLD_GENERATION_VERSION, simulationVersion: SIMULATION_VERSION, matches: groups.length * perGroup,
    elapsedMs: performance.now() - started, groups };
}
