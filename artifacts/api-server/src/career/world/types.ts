import { z } from "zod";
import { ATTRIBUTES, CONTEXTS, TIERS, CAREER_WORLD_CONFIG as W, CAREER_DEVELOPMENT_CONFIG as D, CAREER_SIMULATION_CONFIG as S } from "./config.ts";

const bounded = (min: number, max: number) => z.number().finite().min(min).max(max);
const attribute = bounded(W.attributeMin, W.attributeMax);
export const abilitySchema = z.object({ scoring: attribute, finishing: attribute, consistency: attribute,
  pressure: attribute, powerScoring: attribute, clutch: attribute }).strict();
export type Ability = z.infer<typeof abilitySchema>;
export type Attribute = typeof ATTRIBUTES[number];
export type Tier = typeof TIERS[number];
const tendency = bounded(-W.tendencyLimit, W.tendencyLimit);
export const tendencySchema = z.object({ local: tendency, floor: tendency, stage: tendency, qualifier: tendency, major: tendency }).strict();
export const npcSchema = z.object({
  id: z.string().uuid(), worldKey: z.string().min(1).max(120),
  firstName: z.string().min(1).max(80), surname: z.string().min(1).max(160),
  nickname: z.string().max(80).nullable(), nationality: z.string().min(2).max(3), homeRegion: z.string().min(1).max(80),
  dominantHand: z.enum(["RIGHT", "LEFT"]), startingAge: z.number().int().min(W.minimumAge).max(W.maximumAge),
  age: z.number().int().min(W.minimumAge).max(W.maximumAge),
  stage: z.enum(["PROSPECT", "DEVELOPING", "PRIME", "VETERAN", "RETIRED"]),
  tier: z.enum(TIERS), professionalStatus: z.enum(["AMATEUR", "PROFESSIONAL"]),
  detailTier: z.enum(["BASIC", "STANDARD", "FEATURED"]), templateKey: z.string().nullable(),
  status: z.enum(["ACTIVE", "RETIRED"]), createdSeason: z.number().int().positive(), retiredSeason: z.number().int().positive().nullable(),
  ability: abilitySchema, form: bounded(-D.formLimit, D.formLimit), tendencies: tendencySchema,
  development: z.object({ potential: attribute, rate: bounded(0, 10), volatility: bounded(0, 5),
    peakStart: z.number().int().min(18).max(70), peakEnd: z.number().int().min(18).max(80),
    breakthroughAge: z.number().int().min(16).max(70), declineProfile: z.enum(["GRADUAL", "PLATEAU", "SHARP", "EARLY"]),
    lowAbilityYears: bounded(0, W.maximumAge), recentDelta: bounded(-100, 100),
  }).strict(),
}).strict().superRefine((npc, ctx) => {
  if (npc.development.peakEnd < npc.development.peakStart) ctx.addIssue({ code: "custom", message: "Invalid peak window" });
  if ((npc.status === "RETIRED") !== (npc.retiredSeason !== null) || (npc.status === "RETIRED") !== (npc.stage === "RETIRED")) ctx.addIssue({ code: "custom", message: "Invalid retirement state" });
});
export type Npc = z.infer<typeof npcSchema>;
export const matchContextSchema = z.object({ category: z.enum(CONTEXTS), roundImportance: bounded(0, 1), elimination: z.boolean() }).strict();
export type MatchContext = z.infer<typeof matchContextSchema>;
export const matchFormatSchema = z.object({ bestOf: z.number().int().min(1).max(S.maxBestOf).refine(n => n % 2 === 1, "bestOf must be odd"), firstThrow: z.union([z.literal(0), z.literal(1)]) }).strict();
export type MatchFormat = z.infer<typeof matchFormatSchema>;
export type Performance = { npcId: string; effective: Ability; dayDeviation: number; pressureIntensity: number; visitSd: number; expectedAverage: number; expectedCheckout: number };
export type MatchStats = { points: number; darts: number; average: number; doubleAttempts: number; checkouts: number; checkoutPercentage: number; maximums: number; highestCheckout: number; legsWon: number };
export type SimulatedMatch = {
  simulationVersion: number; winnerId: string; loserId: string; format: MatchFormat; context: MatchContext;
  participants: [string, string]; performance: [Performance, Performance]; stats: [MatchStats, MatchStats];
  legs: { winner: 0 | 1; firstThrow: 0 | 1; checkout: number; darts: [number, number]; points: [number, number] }[];
};
export const meanAbility = (ability: Ability) => ATTRIBUTES.reduce((sum, key) => sum + ability[key], 0) / ATTRIBUTES.length;
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
