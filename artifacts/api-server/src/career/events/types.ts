import { z } from "zod";
import type { Npc } from "../world/types.ts";

export const CLASSIFICATIONS = ["RANKING", "QUALIFIER", "INVITATIONAL_EXHIBITION", "SPECIAL"] as const;
export const CIRCUITS = ["GRASSROOTS", "COUNTY", "REGIONAL", "NATIONAL_AMATEUR", "CHALLENGER", "VAULT", "Q_SCHOOL", "PRO_CIRCUIT", "EUROPEAN_SERIES", "WORLD_SERIES", "INVITATIONAL", "MAJOR", "WORLD_CHAMPIONSHIP", "SPECIAL"] as const;
export type Circuit = typeof CIRCUITS[number];
export type Rule = { op: "ALL_OF" | "ANY_OF"; rules: Rule[] } | { op: "NOT"; rule: Rule }
  | { op: "OPEN_ENTRY" | "ENTITLEMENT" | "INVITATION" | "DEFENDING_CHAMPION" | "TOUR_CARD" | "NON_TOUR_CARD" }
  | { op: "COUNTRY" | "REGION"; values: string[] }
  | { op: "STATUS"; value: "AMATEUR" | "PROFESSIONAL" }
  | { op: "RANK"; category: "AMATEUR" | "REGIONAL" | "PRO"; maximum: number }
  | { op: "PREVIOUS_RESULT"; family: string; maximum: number };
export const ruleSchema: z.ZodType<Rule> = z.lazy(() => z.union([
  z.object({ op: z.enum(["ALL_OF", "ANY_OF"]), rules: z.array(ruleSchema).min(1).max(20) }).strict(),
  z.object({ op: z.literal("NOT"), rule: ruleSchema }).strict(),
  z.object({ op: z.enum(["OPEN_ENTRY", "ENTITLEMENT", "INVITATION", "DEFENDING_CHAMPION", "TOUR_CARD", "NON_TOUR_CARD"]) }).strict(),
  z.object({ op: z.enum(["COUNTRY", "REGION"]), values: z.array(z.string()).min(1) }).strict(),
  z.object({ op: z.literal("STATUS"), value: z.enum(["AMATEUR", "PROFESSIONAL"]) }).strict(),
  z.object({ op: z.literal("RANK"), category: z.enum(["AMATEUR", "REGIONAL", "PRO"]), maximum: z.number().int().positive() }).strict(),
  z.object({ op: z.literal("PREVIOUS_RESULT"), family: z.string(), maximum: z.number().int().positive() }).strict(),
]));
export const formatSchema = z.object({
  structure: z.enum(["KNOCKOUT", "GROUPS_KNOCKOUT", "ROUND_ROBIN", "MULTI_STAGE"]),
  game: z.enum(["X01", "CRICKET", "KILLER", "HALVE_IT", "GOLF"]), startingScore: z.number().int().positive(),
  inRule: z.enum(["STRAIGHT", "DOUBLE"]), outRule: z.enum(["DOUBLE", "STRAIGHT", "TREBLE"]),
  bestOfLegs: z.number().int().min(1).max(101).refine(n => n % 2 === 1),
  bestOfSets: z.number().int().positive().nullable(), legsPerSet: z.number().int().positive().nullable(),
  groupSize: z.number().int().min(2).nullable(), stage: z.number().int().positive(),
  firstThrowMethod: z.enum(["DRAW_ORDER", "BULL_UP_REQUIRED"]),
}).strict();
export type Format = z.infer<typeof formatSchema>;
export type Capability = { status: "SUPPORTED" } | { status: "UNSUPPORTED_FORMAT"; reasons: string[] };
export const venueSchema = z.object({ key: z.string(), name: z.string(), city: z.string(), country: z.string(), region: z.string(), group: z.string() }).strict();
export type Venue = z.infer<typeof venueSchema>;
export const definitionSchema = z.object({
  key: z.string().min(1).max(100), version: z.literal(1), name: z.string(), shortName: z.string(), family: z.string(),
  circuit: z.enum(CIRCUITS), classification: z.enum(CLASSIFICATIONS),
  weeks: z.array(z.number().int().min(1).max(52)).min(1), dayInWeek: z.number().int().min(0).max(6), durationDays: z.number().int().min(1).max(21),
  venuePool: z.array(venueSchema).min(1), fieldSize: z.number().int().min(2).max(128), format: formatSchema,
  eligibility: ruleSchema, prestige: z.number().min(0).max(100), priority: z.number().int(),
  presentationTier: z.enum(["LOCAL", "STANDARD", "FEATURED", "TELEVISED", "MAJOR", "WORLD"]),
  pathway: z.enum(["UK_IRELAND", "EUROPE"]).nullable(),
  qualification: z.object({ targetKey: z.string(), targetKind: z.enum(["EVENT", "FAMILY", "STAGE"]), top: z.number().int().positive() }).nullable(),
  rankingCategory: z.string().nullable(), prizeProfile: z.string(), entryFeeProfile: z.string(), travelProfile: z.string(), accommodationProfile: z.string(),
}).strict().superRefine((d, ctx) => {
  if (d.classification !== "RANKING" && d.rankingCategory !== null) ctx.addIssue({ code: "custom", message: "Only ranking events may carry ranking value references" });
  if (d.classification === "SPECIAL" && d.qualification !== null) ctx.addIssue({ code: "custom", message: "Special events cannot grant sporting qualification" });
});
export type Definition = z.infer<typeof definitionSchema>;
export type EventSnapshot = { id: string; key: string; season: number; definition: Definition; venue: Venue; startDay: number; endDay: number; opensDay: number; closesDay: number };
export type EventStatus = "SCHEDULED" | "REGISTRATION_OPEN" | "DRAWN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type EntryStatus = "ENTERED" | "WITHDRAWN" | "CONFIRMED" | "ELIMINATED" | "CHAMPION" | "MISSED";
export type Entrant = { key: string; npcId: string | null; name: string; country: string; region: string; status: "ACTIVE" | "RETIRED"; professionalStatus: "AMATEUR" | "PROFESSIONAL"; tier: Npc["tier"] };
export type SportingFacts = { tourCard?: boolean; ranks?: Partial<Record<"AMATEUR" | "REGIONAL" | "PRO", number>>; invited?: boolean; previous?: Record<string, number>; defendingChampion?: boolean };
/** Trusted A5/human-profile integration only. Missing facts fail closed; no invented ranks/cards. */
export interface SportingProvider {
  facts(saveId: string, season: number, entrants: readonly Entrant[], event: EventSnapshot): Promise<Record<string, SportingFacts>>;
  seeds?(saveId: string, event: EventSnapshot, entrants: readonly Entrant[]): Promise<string[]>;
  human?(saveId: string): Promise<{ country: string; region: string; professionalStatus: "AMATEUR" | "PROFESSIONAL" }>;
}
export const emptyProvider: SportingProvider = { facts: async () => ({}) };
export type Match = { id: string; round: number; index: number; a: string | null; b: string | null; winner: string | null; loser: string | null; firstThrow: 0 | 1; score: [number, number] | null; source: "BYE" | "A2" | "LIVE" | null; a2Key: string | null; receipt: string | null };
export type Draw = { field: Entrant[]; slots: (string | null)[]; seeds: string[]; rounds: Match[][] };
export type Finish = { participant: string; position: number; stage: number; wins: number; losses: number; matchIds: string[] };
export type EventResult = { champion: string; runnerUp: string; finishes: Finish[]; qualificationRecipients: string[] };
export type StoredEvent = EventSnapshot & { status: EventStatus; draw: Draw | null; result: EventResult | null; cancellationReason: string | null };
export const HUMAN = "human";
export const weekOf = (day: number) => Math.min(52, Math.floor(day / 7) + 1);
export const seasonGroup = (week: number) => week <= 8 ? "Opening Swing" : week <= 16 ? "Spring Circuit" : week <= 32 ? "Summer Tour" : week <= 44 ? "Major Season" : "World Championship Period";
