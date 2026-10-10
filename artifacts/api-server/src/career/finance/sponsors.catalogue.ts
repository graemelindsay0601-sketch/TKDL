import {z} from "zod";
import { SPONSOR_DATABASE_VERSION } from "./config.ts";
import {BRANDS,SPONSOR_CATEGORIES,type Brand,type RelationshipSlot,type SponsorCategory} from "../content/brands.ts";
import {representativeById} from "../content/sponsor-representatives.ts";

/** Latest supported catalogue for new Career saves; older saves stay pinned to their snapshot version. */
export const CURRENT_SPONSOR_DATABASE_VERSION = 3;
/** New recurring/guaranteed cash is intentionally unavailable until its balance is approved. */
export const SPONSOR_GUARANTEE_CONFIGURATION_STATUS = "AWAITING_BALANCE_APPROVAL" as const;

/**
 * SPONSOR DATABASE v1 — fictional brands only (no gambling, no real darts
 * manufacturers, no near-copies). Terms are data; offers/contracts snapshot them.
 */
export const SPONSOR_TIERS = ["LOCAL", "REGIONAL", "PROFESSIONAL", "ELITE"] as const;
export type SponsorTier = typeof SPONSOR_TIERS[number];
export const tierRank = (tier: SponsorTier | null) => tier ? SPONSOR_TIERS.indexOf(tier) + 1 : 0;

/** Factual sporting inputs supplied by a provider (A3 facts today, A5 status later). null = unknown. */
export type SportingFacts = {
  careerStarted: boolean;
  titles: number;
  bestFinishByCircuit: Record<string, number>;
  qualifications: string[];
  professionalStatus: "AMATEUR" | "PROFESSIONAL" | null;
  tourCard: boolean | null;
  worldRanking: number | null;
};
export type Requirement =
  | { all: Requirement[] } | { any: Requirement[] }
  | { fact: "careerStarted" }
  | { fact: "titles"; min: number }
  | { fact: "circuitFinish"; circuits: string[]; maxPosition: number }
  | { fact: "qualification"; targetKeys: string[] }
  | { fact: "professional" }
  | { fact: "tourCard" }
  | { fact: "worldRanking"; maxPosition: number };

const requirementSchema:z.ZodType<Requirement>=z.lazy(()=>z.union([
  z.object({all:z.array(requirementSchema).min(1).max(24)}).strict(),
  z.object({any:z.array(requirementSchema).min(1).max(24)}).strict(),
  z.object({fact:z.literal("careerStarted")}).strict(),
  z.object({fact:z.literal("titles"),min:z.number().int().min(0).max(1000)}).strict(),
  z.object({fact:z.literal("circuitFinish"),circuits:z.array(z.string().min(1).max(60)).min(1).max(32),
    maxPosition:z.number().int().min(1).max(1000)}).strict(),
  z.object({fact:z.literal("qualification"),targetKeys:z.array(z.string().min(1).max(80)).min(1).max(32)}).strict(),
  z.object({fact:z.literal("professional")}).strict(),
  z.object({fact:z.literal("tourCard")}).strict(),
  z.object({fact:z.literal("worldRanking"),maxPosition:z.number().int().min(1).max(1000)}).strict(),
]));

/** true = satisfied, false = known unmet, null = authority unknown (never grants). */
export function evaluateRequirement(rule: Requirement, facts: SportingFacts): boolean | null {
  if ("all" in rule) { const r = rule.all.map(x => evaluateRequirement(x, facts)); return r.includes(false) ? false : r.includes(null) ? null : true; }
  if ("any" in rule) { const r = rule.any.map(x => evaluateRequirement(x, facts)); return r.includes(true) ? true : r.includes(null) ? null : false; }
  switch (rule.fact) {
    case "careerStarted": return facts.careerStarted;
    case "titles": return facts.titles >= rule.min;
    case "circuitFinish": return rule.circuits.some(c => facts.bestFinishByCircuit[c] !== undefined && facts.bestFinishByCircuit[c] <= rule.maxPosition);
    case "qualification": return rule.targetKeys.some(k => facts.qualifications.includes(k));
    case "professional": return facts.professionalStatus === null ? null : facts.professionalStatus === "PROFESSIONAL";
    case "tourCard": return facts.tourCard;
    case "worldRanking": return facts.worldRanking === null ? null : facts.worldRanking <= rule.maxPosition;
  }
}

export type CostType = "ENTRY_FEE" | "TRAVEL" | "ACCOMMODATION";
/** One generic rule covers none / percentage / fixed / full / capped coverage. */
export type CoverageRule = { costTypes: CostType[]; percent: number; perEventCapPence: number | null; seasonCapPence: number | null; circuits: string[] | null };
export type EventPayment = { amountPence: number; circuits: string[]; maxEventsPerSeason: number };
export type PerformanceBonus = { key: string; maxPosition: number; amountPence: number; circuits: string[] | null; classifications: string[] };
export const SPONSOR_CONTRACT_STATES=["DRAFT","OFFERED","NEGOTIATING","SIGNED","ACTIVE","COMPLETED","EXPIRED","DECLINED","WITHDRAWN","TERMINATED"] as const;
export type SponsorContractState=typeof SPONSOR_CONTRACT_STATES[number];
export const SPONSOR_ACTIVITY_SPEC_VERSION = 1 as const;
export const REQUIRED_SPONSOR_ACTIVITY_TYPES = ["MEDIA_APPEARANCE","COMMUNITY_APPEARANCE","PROMOTIONAL_APPEARANCE","PRODUCT_APPEARANCE"] as const;
export const OPTIONAL_SPONSOR_ACTIVITY_TYPES = ["SPONSOR_MEDIA_APPEARANCE","PROMOTIONAL_EVENT","COMMUNITY_APPEARANCE","PRODUCT_LAUNCH"] as const;
const sponsorActivitySpecSchema = z.object({
  version:z.literal(SPONSOR_ACTIVITY_SPEC_VERSION),
  required:z.array(z.object({
    id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type:z.enum(REQUIRED_SPONSOR_ACTIVITY_TYPES),
    maxPerSeason:z.number().int().min(1).max(2),
    windowWeeks:z.number().int().min(3).max(4),
    firstWindowWeek:z.number().int().min(1).max(52),
    extraCompensationPence:z.literal(0),
  }).strict()).max(8),
  optional:z.array(z.object({
    id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    type:z.enum(OPTIONAL_SPONSOR_ACTIVITY_TYPES),
    maxPerSeason:z.number().int().min(1).max(2),
    windowWeeks:z.number().int().min(2).max(5),
    firstWindowWeek:z.number().int().min(1).max(52),
    compensationPence:z.literal(0),
  }).strict()).max(8),
}).strict();
export type SponsorActivitySpecification=z.infer<typeof sponsorActivitySpecSchema>;
const REQUIRED_PER_SEASON:Record<(typeof REQUIRED_SPONSOR_ACTIVITY_TYPES)[number],number>={
  MEDIA_APPEARANCE:1,COMMUNITY_APPEARANCE:1,PROMOTIONAL_APPEARANCE:2,PRODUCT_APPEARANCE:1,
};
const REQUIRED_WINDOW:Record<(typeof REQUIRED_SPONSOR_ACTIVITY_TYPES)[number],number>={
  MEDIA_APPEARANCE:3,COMMUNITY_APPEARANCE:4,PROMOTIONAL_APPEARANCE:3,PRODUCT_APPEARANCE:4,
};
const REQUIRED_TIER_LIMIT:Record<SponsorTier,number>={LOCAL:1,REGIONAL:2,PROFESSIONAL:3,ELITE:4};
const CATEGORY_ACTIVITY_TYPES:Record<SponsorCategory,readonly string[]>={
  EQUIPMENT_PARTNER:["PRODUCT_APPEARANCE","PROMOTIONAL_APPEARANCE"],
  APPAREL_PARTNER:["MEDIA_APPEARANCE","PROMOTIONAL_APPEARANCE"],
  TRAVEL_PARTNER:["PROMOTIONAL_APPEARANCE","COMMUNITY_APPEARANCE"],
  LOCAL_PARTNER:["COMMUNITY_APPEARANCE"],
  MAIN_PARTNER:["MEDIA_APPEARANCE","PROMOTIONAL_APPEARANCE","COMMUNITY_APPEARANCE"],
  SECONDARY_PARTNER:["MEDIA_APPEARANCE","COMMUNITY_APPEARANCE"],
};
const OPTIONAL_CATEGORY_TYPES:Record<SponsorCategory,readonly string[]>={
  EQUIPMENT_PARTNER:["PRODUCT_LAUNCH","PROMOTIONAL_EVENT"],
  APPAREL_PARTNER:["SPONSOR_MEDIA_APPEARANCE","PROMOTIONAL_EVENT"],
  TRAVEL_PARTNER:["PROMOTIONAL_EVENT","COMMUNITY_APPEARANCE"],
  LOCAL_PARTNER:["COMMUNITY_APPEARANCE"],
  MAIN_PARTNER:["SPONSOR_MEDIA_APPEARANCE","PROMOTIONAL_EVENT","COMMUNITY_APPEARANCE"],
  SECONDARY_PARTNER:["SPONSOR_MEDIA_APPEARANCE","COMMUNITY_APPEARANCE"],
};
const REQUIRED_TIER_TYPES:Record<SponsorTier,readonly string[]>={
  LOCAL:["COMMUNITY_APPEARANCE"],
  REGIONAL:["COMMUNITY_APPEARANCE","MEDIA_APPEARANCE","PROMOTIONAL_APPEARANCE"],
  PROFESSIONAL:REQUIRED_SPONSOR_ACTIVITY_TYPES,
  ELITE:REQUIRED_SPONSOR_ACTIVITY_TYPES,
};
/** Validate authored v4 clause data; tier/category maxima never create duties themselves. */
export function validateSponsorActivitySpecification(spec:SponsorActivitySpecification,tier:SponsorTier,category:SponsorCategory):SponsorActivitySpecification{
  const ids=[...spec.required,...spec.optional].map(clause=>clause.id);
  if(new Set(ids).size!==ids.length)throw new Error("Sponsor activity clause IDs must be unique");
  const requiredByType=new Map<string,number>();
  for(const clause of spec.required){
    if(clause.windowWeeks!==REQUIRED_WINDOW[clause.type])throw new Error(`Invalid availability window for ${clause.type}`);
    if(!CATEGORY_ACTIVITY_TYPES[category].includes(clause.type)||!REQUIRED_TIER_TYPES[tier].includes(clause.type))
      throw new Error(`${clause.type} is not supported for ${tier} ${category}`);
    requiredByType.set(clause.type,(requiredByType.get(clause.type)??0)+clause.maxPerSeason);
  }
  const totalRequired=[...requiredByType.values()].reduce((a,b)=>a+b,0);
  if(totalRequired>REQUIRED_TIER_LIMIT[tier])throw new Error(`${tier} contracts may define at most ${REQUIRED_TIER_LIMIT[tier]} required activities per season`);
  for(const [type,count] of requiredByType)if(count>REQUIRED_PER_SEASON[type as keyof typeof REQUIRED_PER_SEASON])
    throw new Error(`${type} exceeds its per-season limit`);
  const optionalCaps:Record<string,number>={SPONSOR_MEDIA_APPEARANCE:2,PROMOTIONAL_EVENT:2,COMMUNITY_APPEARANCE:2,PRODUCT_LAUNCH:1};
  for(const clause of spec.optional){
    if(!OPTIONAL_CATEGORY_TYPES[category].includes(clause.type))throw new Error(`${clause.type} is not supported for ${category}`);
    const validWindow=clause.type==="PRODUCT_LAUNCH"?clause.windowWeeks>=3&&clause.windowWeeks<=5:clause.windowWeeks>=2&&clause.windowWeeks<=4;
    if(!validWindow)throw new Error(`Invalid optional availability window for ${clause.type}`);
    if(clause.maxPerSeason>optionalCaps[clause.type])throw new Error(`${clause.type} exceeds its per-season limit`);
  }
  return spec;
}
const penceSchema=z.number().int().min(0).max(2_000_000_000);
const categorySchema=z.enum(SPONSOR_CATEGORIES);
export const sponsorContractFoundationSchema=z.object({
  schemaVersion:z.literal(1),
  category:categorySchema,
  guaranteedPayments:z.array(z.object({
    // One-off total for ON_SIGNING, or the total recurring guarantee per Career season.
    amountPence:penceSchema,
    cadence:z.enum(["ON_SIGNING","MONTHLY","PER_SEASON"]),
    installments:z.number().int().min(1).max(120),
  }).strict()).max(24),
  commitments:z.array(z.object({
    id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    kind:z.enum(["EVENT_APPEARANCE","MEDIA_APPEARANCE","COMMUNITY_SESSION","PRODUCT_FEEDBACK","EXCLUSIVE_USE"]),
    required:z.boolean(),
    cadence:z.enum(["PER_EVENT","PER_SEASON","ON_REQUEST"]),
    count:z.number().int().min(1).max(100).nullable(),
  }).strict()).max(32),
  /** Opt-in v4 terms only; existing v1-v3 snapshots omit this field. */
  activitySpecification:sponsorActivitySpecSchema.optional(),
  optionalOpportunities:z.array(z.object({
    id:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    kind:z.enum(["EXHIBITION","MEDIA","COMMUNITY","PRODUCT_TESTING"]),
    cadence:z.enum(["PER_EVENT","PER_SEASON","ON_REQUEST"]),
  }).strict()).max(32),
  exclusivity:z.object({groups:z.array(z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/)).max(16),exclusiveWithinGroup:z.boolean()}).strict(),
  sportingPriority:z.enum(["NONE","PREFERRED_ACCESS","FIRST_REFUSAL"]),
  releaseClause:z.object({
    playerNoticeWeeks:z.number().int().min(0).max(52).nullable(),
    sponsorNoticeWeeks:z.number().int().min(0).max(52).nullable(),
    buyoutPence:penceSchema.nullable(),
  }).strict(),
  terminationConditions:z.array(z.enum(["TERM_COMPLETION","MUTUAL_AGREEMENT","MATERIAL_BREACH","INELIGIBILITY"])).max(8),
  renewal:z.object({
    state:z.enum(["NOT_CONFIGURED","NOT_DUE","REVIEW_DUE","OFFERED","DECLINED","RENEWED"]),
    noticeWeeks:z.number().int().min(0).max(52).nullable(),
  }).strict(),
  productRights:z.object({
    productTypes:z.array(z.enum(["SIGNATURE_DARTS","SIGNATURE_RANGE"])).max(4),
    exclusive:z.boolean(),
  }).strict(),
}).strict();
export type SponsorContractFoundation=z.infer<typeof sponsorContractFoundationSchema>;
export type SponsorTerms = {
  sponsorKey: string; displayName: string; tier: SponsorTier; sponsorDatabaseVersion: number;
  duration: { kind: "REMAINDER_OF_SEASON" } | { kind: "SEASONS"; seasons: number };
  signingBonusPence: number;
  eventPayment: EventPayment | null;
  coverage: CoverageRule[];
  performanceBonuses: PerformanceBonus[];
  renewalRequirement: Requirement;
  /** Evaluated at season reviews; only a KNOWN failure terminates (unknown authority never punishes). */
  retentionRequirement: Requirement | null;
  presentation: { brandingFamily: string; logoAssetKey: string; colour: string };
  relationshipSlot?: RelationshipSlot;
  category?:SponsorCategory;
  exclusivityGroups?: string[];
  geographicPreference?: string | null;
  signatureProductSupport?: ("SIGNATURE_DARTS" | "SIGNATURE_RANGE")[];
  representative?:{id:string;sponsorId:string;displayName:string;role:string}|null;
  contractFoundation?:SponsorContractFoundation;
};
export type SponsorDefinition = { key: string; offerRequirement: Requirement; terms: SponsorTerms };

const sponsorTermsSchema=z.object({
  sponsorKey:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName:z.string().trim().min(2).max(80),
  tier:z.enum(SPONSOR_TIERS),
  sponsorDatabaseVersion:z.number().int().min(1).max(3),
  duration:z.union([z.object({kind:z.literal("REMAINDER_OF_SEASON")}).strict(),
    z.object({kind:z.literal("SEASONS"),seasons:z.number().int().min(1).max(5)}).strict()]),
  signingBonusPence:penceSchema,
  eventPayment:z.object({amountPence:penceSchema,circuits:z.array(z.string().min(1).max(60)).max(64),
    maxEventsPerSeason:z.number().int().min(1).max(200)}).strict().nullable(),
  coverage:z.array(z.object({costTypes:z.array(z.enum(["ENTRY_FEE","TRAVEL","ACCOMMODATION"])).min(1).max(3),
    percent:z.number().min(0).max(100),perEventCapPence:penceSchema.nullable(),seasonCapPence:penceSchema.nullable(),
    circuits:z.array(z.string().min(1).max(60)).max(64).nullable()}).strict()).max(32),
  performanceBonuses:z.array(z.object({key:z.string().min(1).max(80),maxPosition:z.number().int().min(1).max(1000),
    amountPence:penceSchema,circuits:z.array(z.string().min(1).max(60)).max(64).nullable(),
    classifications:z.array(z.string().min(1).max(60)).max(32)}).strict()).max(32),
  renewalRequirement:requirementSchema,
  retentionRequirement:requirementSchema.nullable(),
  presentation:z.object({brandingFamily:z.string().min(1).max(100),logoAssetKey:z.string().min(1).max(100),
    colour:z.string().regex(/^#[0-9a-fA-F]{6}$/)}).strict(),
  relationshipSlot:z.enum(["EQUIPMENT_PARTNER","APPAREL_PARTNER","PRIMARY_COMMERCIAL","SECONDARY_COMMERCIAL","LOCAL_REGIONAL_PARTNER"]).optional(),
  category:categorySchema.optional(),
  exclusivityGroups:z.array(z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/)).max(16).optional(),
  geographicPreference:z.string().max(100).nullable().optional(),
  signatureProductSupport:z.array(z.enum(["SIGNATURE_DARTS","SIGNATURE_RANGE"])).max(4).optional(),
  representative:z.object({id:z.string().regex(/^rep-[a-z0-9-]+$/),sponsorId:z.string().regex(/^[a-z0-9-]+$/),
    displayName:z.string().trim().min(2).max(80),role:z.string().trim().min(2).max(100)}).strict().nullable().optional(),
  contractFoundation:sponsorContractFoundationSchema.optional(),
}).strict();

export function parseSponsorTerms(value:unknown):SponsorTerms {
  return sponsorTermsSchema.parse(value) as SponsorTerms;
}

const AMATEUR = ["GRASSROOTS", "COUNTY", "REGIONAL", "NATIONAL_AMATEUR", "SPECIAL"];
const DEVELOPMENT = ["REGIONAL", "NATIONAL_AMATEUR", "CHALLENGER", "VAULT", "Q_SCHOOL"];
const PRO = ["PRO_CIRCUIT", "EUROPEAN_SERIES", "WORLD_SERIES", "MAJOR", "INVITATIONAL", "WORLD_CHAMPIONSHIP"];
const RANKED = ["RANKING", "QUALIFIER"];
const def = (key: string, offerRequirement: Requirement, terms: Omit<SponsorTerms, "sponsorKey" | "sponsorDatabaseVersion">): SponsorDefinition =>
  ({ key, offerRequirement, terms: { ...terms, sponsorKey: key, sponsorDatabaseVersion: SPONSOR_DATABASE_VERSION } });
const contractFoundationFor=(brand:Brand):SponsorContractFoundation=>sponsorContractFoundationSchema.parse({
  schemaVersion:1,category:brand.category,guaranteedPayments:[],commitments:[],optionalOpportunities:[],
  exclusivity:{groups:brand.exclusivityGroups,exclusiveWithinGroup:true},sportingPriority:"NONE",
  releaseClause:{playerNoticeWeeks:null,sponsorNoticeWeeks:null,buyoutPence:null},terminationConditions:[],
  renewal:{state:"NOT_CONFIGURED",noticeWeeks:null},
  productRights:{productTypes:brand.signatureProductSupport,exclusive:false},
});

export const SPONSOR_CATALOGUE_V1: readonly SponsorDefinition[] = Object.freeze([
  def("forge-workwear", { any: [{ fact: "titles", min: 1 }, { fact: "circuitFinish", circuits: ["GRASSROOTS", "COUNTY"], maxPosition: 2 }] }, {
    displayName: "Forge Workwear", tier: "LOCAL", duration: { kind: "REMAINDER_OF_SEASON" }, signingBonusPence: 10000,
    eventPayment: { amountPence: 1000, circuits: ["GRASSROOTS", "COUNTY"], maxEventsPerSeason: 20 },
    coverage: [{ costTypes: ["ENTRY_FEE"], percent: 50, perEventCapPence: 1000, seasonCapPence: 15000, circuits: ["GRASSROOTS", "COUNTY", "REGIONAL"] }],
    performanceBonuses: [{ key: "title", maxPosition: 1, amountPence: 2500, circuits: ["GRASSROOTS", "COUNTY", "REGIONAL"], classifications: RANKED }],
    renewalRequirement: { fact: "titles", min: 1 }, retentionRequirement: null,
    presentation: { brandingFamily: "forge-workwear", logoAssetKey: "sponsor:forge-workwear", colour: "#C2562B" } }),
  def("lochside-joinery", { fact: "circuitFinish", circuits: ["GRASSROOTS", "COUNTY", "REGIONAL"], maxPosition: 4 }, {
    displayName: "Lochside Joinery", tier: "LOCAL", duration: { kind: "REMAINDER_OF_SEASON" }, signingBonusPence: 7500,
    eventPayment: { amountPence: 750, circuits: ["GRASSROOTS", "COUNTY"], maxEventsPerSeason: 15 },
    coverage: [{ costTypes: ["ENTRY_FEE", "TRAVEL"], percent: 25, perEventCapPence: 1500, seasonCapPence: 10000, circuits: AMATEUR }],
    performanceBonuses: [{ key: "final", maxPosition: 2, amountPence: 1500, circuits: AMATEUR, classifications: RANKED }],
    renewalRequirement: { fact: "circuitFinish", circuits: ["COUNTY", "REGIONAL"], maxPosition: 4 }, retentionRequirement: null,
    presentation: { brandingFamily: "lochside-joinery", logoAssetKey: "sponsor:lochside-joinery", colour: "#2F6B4F" } }),
  def("ochre-darts", { any: [{ fact: "circuitFinish", circuits: ["REGIONAL", "NATIONAL_AMATEUR"], maxPosition: 4 }, { fact: "titles", min: 3 }] }, {
    displayName: "Ochre Darts Co.", tier: "REGIONAL", duration: { kind: "SEASONS", seasons: 1 }, signingBonusPence: 50000,
    eventPayment: { amountPence: 2500, circuits: DEVELOPMENT, maxEventsPerSeason: 15 },
    coverage: [{ costTypes: ["ENTRY_FEE"], percent: 100, perEventCapPence: 5000, seasonCapPence: 60000, circuits: [...AMATEUR, ...DEVELOPMENT] },
      { costTypes: ["TRAVEL"], percent: 50, perEventCapPence: 10000, seasonCapPence: 60000, circuits: null }],
    performanceBonuses: [{ key: "title", maxPosition: 1, amountPence: 25000, circuits: DEVELOPMENT, classifications: RANKED },
      { key: "final", maxPosition: 2, amountPence: 10000, circuits: DEVELOPMENT, classifications: RANKED }],
    renewalRequirement: { any: [{ fact: "circuitFinish", circuits: DEVELOPMENT, maxPosition: 8 }, { fact: "qualification", targetKeys: ["challenger-tour"] }] },
    retentionRequirement: null,
    presentation: { brandingFamily: "ochre-darts", logoAssetKey: "sponsor:ochre-darts", colour: "#C8902E" } }),
  def("redpoint-darts", { any: [{ fact: "qualification", targetKeys: ["challenger-tour", "q-school-final:UK_IRELAND", "q-school-final:EUROPE", "vault-series"] },
    { fact: "circuitFinish", circuits: ["CHALLENGER", "VAULT"], maxPosition: 8 }] }, {
    displayName: "Redpoint Darts", tier: "REGIONAL", duration: { kind: "SEASONS", seasons: 1 }, signingBonusPence: 75000,
    eventPayment: { amountPence: 3000, circuits: ["CHALLENGER", "VAULT", "Q_SCHOOL"], maxEventsPerSeason: 20 },
    coverage: [{ costTypes: ["ENTRY_FEE", "TRAVEL", "ACCOMMODATION"], percent: 50, perEventCapPence: 20000, seasonCapPence: 150000, circuits: DEVELOPMENT }],
    performanceBonuses: [{ key: "title", maxPosition: 1, amountPence: 50000, circuits: ["CHALLENGER", "VAULT"], classifications: RANKED },
      { key: "semi", maxPosition: 4, amountPence: 10000, circuits: ["CHALLENGER", "VAULT"], classifications: RANKED }],
    renewalRequirement: { fact: "circuitFinish", circuits: ["CHALLENGER", "VAULT", "Q_SCHOOL"], maxPosition: 16 }, retentionRequirement: null,
    presentation: { brandingFamily: "redpoint-darts", logoAssetKey: "sponsor:redpoint-darts", colour: "#B3202A" } }),
  def("ironflight", { any: [{ fact: "circuitFinish", circuits: ["CHALLENGER"], maxPosition: 2 }, { fact: "tourCard" }] }, {
    displayName: "Ironflight", tier: "PROFESSIONAL", duration: { kind: "SEASONS", seasons: 1 }, signingBonusPence: 300000,
    eventPayment: { amountPence: 15000, circuits: ["PRO_CIRCUIT", "CHALLENGER"], maxEventsPerSeason: 30 },
    coverage: [{ costTypes: ["ENTRY_FEE"], percent: 100, perEventCapPence: null, seasonCapPence: null, circuits: PRO },
      { costTypes: ["TRAVEL", "ACCOMMODATION"], percent: 60, perEventCapPence: 40000, seasonCapPence: 800000, circuits: null }],
    performanceBonuses: [{ key: "title", maxPosition: 1, amountPence: 300000, circuits: PRO, classifications: RANKED },
      { key: "final", maxPosition: 2, amountPence: 100000, circuits: PRO, classifications: RANKED }],
    renewalRequirement: { fact: "tourCard" }, retentionRequirement: { fact: "tourCard" },
    presentation: { brandingFamily: "ironflight", logoAssetKey: "sponsor:ironflight", colour: "#4A5866" } }),
  def("northline-darts", { all: [{ fact: "tourCard" }, { any: [{ fact: "titles", min: 1 }, { fact: "circuitFinish", circuits: PRO, maxPosition: 4 }] }] }, {
    displayName: "Northline Darts", tier: "PROFESSIONAL", duration: { kind: "SEASONS", seasons: 2 }, signingBonusPence: 750000,
    eventPayment: { amountPence: 25000, circuits: ["PRO_CIRCUIT", "EUROPEAN_SERIES"], maxEventsPerSeason: 40 },
    coverage: [{ costTypes: ["ENTRY_FEE", "TRAVEL", "ACCOMMODATION"], percent: 100, perEventCapPence: 60000, seasonCapPence: 1500000, circuits: PRO }],
    performanceBonuses: [{ key: "title", maxPosition: 1, amountPence: 500000, circuits: PRO, classifications: RANKED },
      { key: "final", maxPosition: 2, amountPence: 200000, circuits: PRO, classifications: RANKED },
      { key: "quarter", maxPosition: 8, amountPence: 50000, circuits: ["MAJOR", "WORLD_CHAMPIONSHIP"], classifications: RANKED }],
    renewalRequirement: { fact: "tourCard" }, retentionRequirement: { fact: "tourCard" },
    presentation: { brandingFamily: "northline-darts", logoAssetKey: "sponsor:northline-darts", colour: "#1F4E8C" } }),
  def("vantage-darts", { any: [{ fact: "worldRanking", maxPosition: 16 }, { fact: "circuitFinish", circuits: ["MAJOR", "WORLD_CHAMPIONSHIP"], maxPosition: 2 }] }, {
    displayName: "Vantage Darts", tier: "ELITE", duration: { kind: "SEASONS", seasons: 3 }, signingBonusPence: 5000000,
    eventPayment: { amountPence: 100000, circuits: PRO, maxEventsPerSeason: 40 },
    coverage: [{ costTypes: ["ENTRY_FEE", "TRAVEL", "ACCOMMODATION"], percent: 100, perEventCapPence: null, seasonCapPence: null, circuits: null }],
    performanceBonuses: [{ key: "major-title", maxPosition: 1, amountPence: 5000000, circuits: ["MAJOR", "WORLD_CHAMPIONSHIP"], classifications: ["RANKING"] },
      { key: "title", maxPosition: 1, amountPence: 1000000, circuits: PRO, classifications: RANKED }],
    renewalRequirement: { any: [{ fact: "worldRanking", maxPosition: 32 }, { fact: "circuitFinish", circuits: ["MAJOR"], maxPosition: 4 }] },
    retentionRequirement: { fact: "tourCard" },
    presentation: { brandingFamily: "vantage-darts", logoAssetKey: "sponsor:vantage-darts", colour: "#5B2A86" } }),
]);

/** New content uses existing A4 money/coverage types and conservative existing tier bands. */
export const SPONSOR_CATALOGUE_V2: readonly SponsorDefinition[] = Object.freeze(BRANDS.map(b => {
  const original = SPONSOR_CATALOGUE_V1.find(d => d.key === b.id);
  const template = original ?? SPONSOR_CATALOGUE_V1.find(d => d.terms.tier === b.commercialTier)!;
  const requirement: Requirement = original?.offerRequirement ?? (b.commercialTier === "LOCAL" ? { fact: "titles", min: 1 } :
    b.commercialTier === "REGIONAL" ? { fact: "titles", min: 3 } : b.commercialTier === "PROFESSIONAL" ?
      { any: [{ fact: "tourCard" }, { fact: "titles", min: 10 }] } : { any: [{ fact: "worldRanking", maxPosition: 16 },
        {fact:"circuitFinish",circuits:["MAJOR","WORLD_CHAMPIONSHIP"],maxPosition:2}] });
  const terms: SponsorTerms = { ...structuredClone(template.terms), sponsorKey: b.id, displayName: b.name,
    sponsorDatabaseVersion: 2, relationshipSlot: b.slot, exclusivityGroups: b.exclusivityGroups,
    category:b.category,geographicPreference: b.locationId, signatureProductSupport: b.signatureProductSupport,
    representative:b.representativeId?representativeById(b.representativeId)??null:null,
    contractFoundation:contractFoundationFor(b),
    presentation: { ...template.terms.presentation, brandingFamily: b.id, logoAssetKey: `sponsor:${b.id}` } };
  if (!original) {
    terms.renewalRequirement = requirement; terms.retentionRequirement = null;
    if (["LOGISTICS", "AUTOMOTIVE"].includes(b.sector)) terms.coverage = [{ costTypes: ["TRAVEL", "ACCOMMODATION"], percent: 50,
      perEventCapPence: 20000, seasonCapPence: 150000, circuits: null }];
  }
  return { key: b.id, offerRequirement: requirement, terms };
}));
export function sponsorCatalogue(version: number) {
  if (version === SPONSOR_DATABASE_VERSION) return SPONSOR_CATALOGUE_V1;
  if (version === 2) return SPONSOR_CATALOGUE_V2;
  if (version === CURRENT_SPONSOR_DATABASE_VERSION) return SPONSOR_CATALOGUE_V3;
  throw new Error(`Unsupported sponsor database version ${version}`);
}
/**
 * A9 economics. v1/v2 offers/contracts remain immutable. New-save offers pin v3;
 * accepted terms are still snapshotted by A4, with best-applicable coverage.
 */
export const SPONSOR_CATALOGUE_V3:readonly SponsorDefinition[] = Object.freeze(SPONSOR_CATALOGUE_V2.map(d=>{
  const terms=structuredClone(d.terms),brand=BRANDS.find(b=>b.id===d.key)!;
  terms.sponsorDatabaseVersion=3;
  const rule=(types:CostType[],percent:number,cap:number,seasonCap:number,circuits:string[]|null):CoverageRule=>
    ({costTypes:types,percent,perEventCapPence:cap,seasonCapPence:seasonCap,circuits});
  if(terms.tier==="REGIONAL") {
    terms.signingBonusPence=d.key==="redpoint-darts"?50000:35000;
    if(terms.eventPayment)terms.eventPayment.amountPence=d.key==="redpoint-darts"?2500:2000;
    terms.coverage=d.key==="redpoint-darts"?
      [rule(["ENTRY_FEE"],60,10000,100000,DEVELOPMENT),rule(["TRAVEL","ACCOMMODATION"],30,10000,100000,DEVELOPMENT)]:
      [rule(["ENTRY_FEE"],75,5000,60000,[...AMATEUR,...DEVELOPMENT]),
        ...(d.key==="ochre-darts"?[rule(["TRAVEL"],25,6000,35000,null)]:[])];
  } else if(terms.tier==="PROFESSIONAL"&&d.key!=="northline-darts") {
    terms.signingBonusPence=200000;
    if(terms.eventPayment)terms.eventPayment.amountPence=7500;
    terms.coverage=[rule(["ENTRY_FEE"],75,15000,400000,PRO),
      ...(d.key==="ironflight"?[rule(["TRAVEL","ACCOMMODATION"],40,40000,800000,null)]:[])];
  }
  if(["REGIONAL","PROFESSIONAL"].includes(terms.tier)&&d.key!=="northline-darts"&&["LOGISTICS","AUTOMOTIVE"].includes(brand.sector)) {
    const pro=terms.tier==="PROFESSIONAL";
    terms.signingBonusPence=pro?100000:20000;
    if(terms.eventPayment)terms.eventPayment.amountPence=pro?2500:1000;
    terms.coverage=[rule(["TRAVEL","ACCOMMODATION"],pro?70:60,20000,pro?300000:75000,null)];
  } else if(["REGIONAL","PROFESSIONAL"].includes(terms.tier)&&brand.sector==="APPAREL") {
    const pro=terms.tier==="PROFESSIONAL";
    terms.signingBonusPence=pro?150000:25000;
    if(terms.eventPayment)terms.eventPayment.amountPence=pro?5000:1500;
    terms.coverage=[rule(["ENTRY_FEE"],25,5000,75000,null)];
  }
  // Measured compatible portfolios (and genuinely local trips) still turn a
  // £75 attendance stipend into guaranteed profit. Use A4's existing factual
  // performance-bonus authority instead: no new payment/negotiation system.
  if(terms.tier==="PROFESSIONAL"&&d.key!=="northline-darts"&&terms.eventPayment) {
    terms.performanceBonuses.push({key:"competitive-appearance",maxPosition:32,
      amountPence:terms.eventPayment.amountPence,circuits:["PRO_CIRCUIT","EUROPEAN_SERIES"],classifications:["RANKING"]});
    terms.eventPayment=null;
  }
  return {key:d.key,offerRequirement:structuredClone(d.offerRequirement),terms};
}));

export function validateSponsorCatalogues():void {
  for(const [version,catalogue] of [[1,SPONSOR_CATALOGUE_V1],[2,SPONSOR_CATALOGUE_V2],[CURRENT_SPONSOR_DATABASE_VERSION,SPONSOR_CATALOGUE_V3]] as const){
    const keys=new Set<string>();
    for(const definition of catalogue){
      if(keys.has(definition.key))throw new Error(`Duplicate sponsor definition in v${version}: ${definition.key}`);
      keys.add(definition.key);
      requirementSchema.parse(definition.offerRequirement);
      parseSponsorTerms(definition.terms);
      if(definition.terms.sponsorDatabaseVersion!==version)throw new Error(`Sponsor terms version mismatch: ${definition.key}`);
      if(definition.terms.sponsorKey!==definition.key)throw new Error(`Sponsor key mismatch: ${definition.key}`);
      if (version === CURRENT_SPONSOR_DATABASE_VERSION &&
        SPONSOR_GUARANTEE_CONFIGURATION_STATUS === "AWAITING_BALANCE_APPROVAL" &&
        (definition.terms.contractFoundation?.guaranteedPayments.length ?? 0) > 0) {
        throw new Error(`Sponsor guarantees in v${version} require balance approval before they can be offered: ${definition.key}`);
      }
      if(definition.terms.representative&&definition.terms.representative.sponsorId!==definition.key)
        throw new Error(`Sponsor representative owner mismatch: ${definition.key}`);
    }
  }
}
validateSponsorCatalogues();
