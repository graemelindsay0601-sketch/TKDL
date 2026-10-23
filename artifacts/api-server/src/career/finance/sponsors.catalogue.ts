import {z} from "zod";
import { SPONSOR_DATABASE_VERSION } from "./config.ts";
import {BRANDS,SPONSOR_CATEGORIES,type Brand,type RelationshipSlot,type SponsorCategory} from "../content/brands.ts";
import {representativeById} from "../content/sponsor-representatives.ts";

/** Latest supported catalogue. Offers and signed contracts retain their stored terms when a save advances. */
export const CURRENT_SPONSOR_DATABASE_VERSION = 8;
export const SUPPORTED_SPONSOR_DATABASE_VERSIONS=Object.freeze([1,2,3,4,5,6,7,8] as const);
/** Annual GBP guarantee schedule approved for new v5 sponsor offers. */
export const SPONSOR_GUARANTEE_CONFIGURATION_STATUS = "APPROVED" as const;

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
  // Larger local/regional businesses can ask for media or promotional work
  // when they fund a professional-level deal; grassroots variants remain community-only.
  LOCAL_PARTNER:["COMMUNITY_APPEARANCE","MEDIA_APPEARANCE","PROMOTIONAL_APPEARANCE"],
  MAIN_PARTNER:["MEDIA_APPEARANCE","PROMOTIONAL_APPEARANCE","COMMUNITY_APPEARANCE"],
  SECONDARY_PARTNER:["MEDIA_APPEARANCE","COMMUNITY_APPEARANCE"],
};
const OPTIONAL_CATEGORY_TYPES:Record<SponsorCategory,readonly string[]>={
  EQUIPMENT_PARTNER:["PRODUCT_LAUNCH","PROMOTIONAL_EVENT"],
  APPAREL_PARTNER:["SPONSOR_MEDIA_APPEARANCE","PROMOTIONAL_EVENT"],
  TRAVEL_PARTNER:["PROMOTIONAL_EVENT","COMMUNITY_APPEARANCE"],
  LOCAL_PARTNER:["COMMUNITY_APPEARANCE","MEDIA_APPEARANCE","PROMOTIONAL_APPEARANCE"],
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
  commercialProfile?: {
    positioning:string; benefitFocus:string; commitmentFocus:string;
    negotiation:{style:"RELATIONSHIP"|"PRACTICAL"|"RESULTS_LED"|"PRESTIGE"|"PRODUCT_LED";
      accept:number; ceiling:number; counterShare:number; rationale:string};
  };
};
export type SponsorDefinition = { key: string; offerRequirement: Requirement; terms: SponsorTerms };

const sponsorTermsSchema=z.object({
  sponsorKey:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  displayName:z.string().trim().min(2).max(80),
  tier:z.enum(SPONSOR_TIERS),
  sponsorDatabaseVersion:z.number().int().min(1).max(8),
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
  commercialProfile:z.object({
    positioning:z.string().trim().min(2).max(100),
    benefitFocus:z.string().trim().min(2).max(100),
    commitmentFocus:z.string().trim().min(2).max(100),
    negotiation:z.object({
      style:z.enum(["RELATIONSHIP","PRACTICAL","RESULTS_LED","PRESTIGE","PRODUCT_LED"]),
      accept:z.number().min(0.05).max(0.4),ceiling:z.number().min(0.2).max(0.9),
      counterShare:z.number().min(0.25).max(0.75),rationale:z.string().trim().min(12).max(180),
    }).strict(),
  }).strict().optional(),
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
      // A professional main partner wants a professional-level name: a Tour Card, a world ranking, or a win on the
      // Challenger Tour or Vault. (Ten titles of any kind let ten pub-night wins bring a professional retainer.)
      { any: [{ fact: "tourCard" }, { fact: "worldRanking", maxPosition: 128 }, { fact: "circuitFinish", circuits: ["CHALLENGER", "VAULT"], maxPosition: 1 }] } : { any: [{ fact: "worldRanking", maxPosition: 16 },
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
export function sponsorCatalogue(version: number):readonly SponsorDefinition[] {
  if (version === SPONSOR_DATABASE_VERSION) return SPONSOR_CATALOGUE_V1;
  if (version === 2) return SPONSOR_CATALOGUE_V2;
  if (version === 3) return SPONSOR_CATALOGUE_V3;
  if (version === 4) return SPONSOR_CATALOGUE_V4;
  if (version === 5) return SPONSOR_CATALOGUE_V5;
  if (version === 6) return SPONSOR_CATALOGUE_V6;
  if (version === 7) return SPONSOR_CATALOGUE_V7;
  if (version === CURRENT_SPONSOR_DATABASE_VERSION) return SPONSOR_CATALOGUE_V8;
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

const requiredTypeForCategory:Record<SponsorCategory,readonly (typeof REQUIRED_SPONSOR_ACTIVITY_TYPES[number])[]>={
  EQUIPMENT_PARTNER:["PRODUCT_APPEARANCE","PROMOTIONAL_APPEARANCE"],
  APPAREL_PARTNER:["MEDIA_APPEARANCE","PROMOTIONAL_APPEARANCE"],
  TRAVEL_PARTNER:["PROMOTIONAL_APPEARANCE","COMMUNITY_APPEARANCE"],
  LOCAL_PARTNER:["COMMUNITY_APPEARANCE","MEDIA_APPEARANCE","PROMOTIONAL_APPEARANCE"],
  MAIN_PARTNER:["MEDIA_APPEARANCE","PROMOTIONAL_APPEARANCE","COMMUNITY_APPEARANCE"],
  SECONDARY_PARTNER:["MEDIA_APPEARANCE","COMMUNITY_APPEARANCE"],
};
const optionalTypeForCategory:Record<SponsorCategory, (typeof OPTIONAL_SPONSOR_ACTIVITY_TYPES[number])>={
  EQUIPMENT_PARTNER:"PRODUCT_LAUNCH",APPAREL_PARTNER:"SPONSOR_MEDIA_APPEARANCE",
  TRAVEL_PARTNER:"PROMOTIONAL_EVENT",LOCAL_PARTNER:"COMMUNITY_APPEARANCE",
  MAIN_PARTNER:"SPONSOR_MEDIA_APPEARANCE",SECONDARY_PARTNER:"COMMUNITY_APPEARANCE",
};
function v4ActivitySpecification(definition:SponsorDefinition):SponsorActivitySpecification{
  const category=definition.terms.contractFoundation!.category;
  const tier=definition.terms.tier;
  const candidates=requiredTypeForCategory[category].filter(type=>REQUIRED_TIER_TYPES[tier].includes(type));
  const requiredCount=tier==="LOCAL"?0:tier==="ELITE"?2:1;
  const required=candidates.slice(0,requiredCount).map((type,index)=>({
    id:`required-${type.toLowerCase().replaceAll("_","-")}-${index+1}`,
    type,maxPerSeason:1 as const,windowWeeks:REQUIRED_WINDOW[type],
    firstWindowWeek:index===0?8:24,extraCompensationPence:0 as const,
  }));
  const type=optionalTypeForCategory[category];
  const optional=[{
    id:`optional-${type.toLowerCase().replaceAll("_","-")}`,
    type,maxPerSeason:1 as const,windowWeeks:3,
    firstWindowWeek:16,compensationPence:0 as const,
  }];
  return validateSponsorActivitySpecification({version:SPONSOR_ACTIVITY_SPEC_VERSION,required,optional},tier,category);
}

/** SP-D3: immutable v4 clauses. Historic v1-v3 definitions and snapshots stay untouched. */
export const SPONSOR_CATALOGUE_V4:readonly SponsorDefinition[]=Object.freeze(SPONSOR_CATALOGUE_V3.map(definition=>{
  const terms=structuredClone(definition.terms);
  const foundation=terms.contractFoundation!;
  terms.sponsorDatabaseVersion=4;
  foundation.activitySpecification=v4ActivitySpecification(definition);
  return {key:definition.key,offerRequirement:structuredClone(definition.offerRequirement),terms};
}));

/** SP-Economy: additive v5 terms; existing contract and offer snapshots remain immutable. */
const ANNUAL_GUARANTEE_PENCE: Readonly<Record<SponsorTier, number>> = Object.freeze({
  LOCAL: 25_000,
  REGIONAL: 125_000,
  PROFESSIONAL: 800_000,
  ELITE: 2_000_000,
});
export const SPONSOR_CATALOGUE_V5:readonly SponsorDefinition[]=Object.freeze(SPONSOR_CATALOGUE_V4.map(definition=>{
  const terms=structuredClone(definition.terms);
  terms.sponsorDatabaseVersion=5;
  terms.contractFoundation!.guaranteedPayments=[{
    amountPence:ANNUAL_GUARANTEE_PENCE[terms.tier],
    cadence:"PER_SEASON",
    installments:4,
  }];
  return {key:definition.key,offerRequirement:structuredClone(definition.offerRequirement),terms};
}));

/** SP-F1: brands have distinct commercial shapes, not only different names and artwork. */
const SPONSOR_V6_PROFILE: Readonly<Record<SponsorCategory, {
  guarantee: number; signing: number; event: number; performance: number; travel: number; entry: number;
}>> = Object.freeze({
  MAIN_PARTNER: { guarantee: 1.25, signing: 1.15, event: 1, performance: 1.15, travel: 1.1, entry: 1.1 },
  EQUIPMENT_PARTNER: { guarantee: 1.1, signing: 1.2, event: 0.8, performance: 1.25, travel: 0.6, entry: 1.35 },
  TRAVEL_PARTNER: { guarantee: 0.8, signing: 0.75, event: 1.25, performance: 0.9, travel: 1.5, entry: 0.8 },
  LOCAL_PARTNER: { guarantee: 0.75, signing: 0.8, event: 1.4, performance: 1.2, travel: 0.7, entry: 1.15 },
  APPAREL_PARTNER: { guarantee: 0.9, signing: 0.95, event: 0.9, performance: 1.4, travel: 0.65, entry: 1.05 },
  SECONDARY_PARTNER: { guarantee: 0.95, signing: 0.9, event: 1.1, performance: 1, travel: 1.2, entry: 0.9 },
});
const scaleSponsorPence = (amount: number, factor: number) => Math.round(amount * factor / 100) * 100;
export const SPONSOR_CATALOGUE_V6:readonly SponsorDefinition[]=Object.freeze(SPONSOR_CATALOGUE_V5.map(definition=>{
  const terms=structuredClone(definition.terms);
  const profile=SPONSOR_V6_PROFILE[terms.category ?? "MAIN_PARTNER"];
  terms.sponsorDatabaseVersion=6;
  terms.signingBonusPence=scaleSponsorPence(terms.signingBonusPence,profile.signing);
  if(terms.eventPayment)terms.eventPayment.amountPence=scaleSponsorPence(terms.eventPayment.amountPence,profile.event);
  terms.performanceBonuses=terms.performanceBonuses.map(bonus=>({
    ...bonus,amountPence:scaleSponsorPence(bonus.amountPence,profile.performance),
  }));
  terms.coverage=terms.coverage.map(rule=>({
    ...rule,
    percent:Math.max(1,Math.min(100,Math.round(rule.percent*(
      rule.costTypes.some(type=>type==="TRAVEL"||type==="ACCOMMODATION")?profile.travel:profile.entry
    )))),
  }));
  terms.contractFoundation!.guaranteedPayments=[{
    amountPence:scaleSponsorPence(ANNUAL_GUARANTEE_PENCE[terms.tier],profile.guarantee),
    cadence:"PER_SEASON",
    installments:4,
  }];
  return {key:definition.key,offerRequirement:structuredClone(definition.offerRequirement),terms};
}));

/** SP-F2: versioned company identities and distinct bargaining styles for new offers. */
const V7_NEGOTIATION:Readonly<Record<SponsorCategory,{
  style:"RELATIONSHIP"|"PRACTICAL"|"RESULTS_LED"|"PRESTIGE"|"PRODUCT_LED";
  accept:number;ceiling:number;counterShare:number;rationale:string;
}>>=Object.freeze({
  LOCAL_PARTNER:{style:"RELATIONSHIP",accept:.15,ceiling:.46,counterShare:.62,rationale:"We want to keep backing darts locally, so we can be flexible on a balanced package."},
  TRAVEL_PARTNER:{style:"PRACTICAL",accept:.12,ceiling:.50,counterShare:.48,rationale:"Our budget is strongest on getting you to events; cash terms have less room to move."},
  EQUIPMENT_PARTNER:{style:"PRODUCT_LED",accept:.16,ceiling:.55,counterShare:.56,rationale:"Product visibility and performance matter most to us, so we have balanced those against the cash request."},
  APPAREL_PARTNER:{style:"RESULTS_LED",accept:.13,ceiling:.49,counterShare:.44,rationale:"We need the promotional commitment to match the support in this package."},
  MAIN_PARTNER:{style:"PRESTIGE",accept:.19,ceiling:.62,counterShare:.40,rationale:"We can invest in a visible partnership, but the full commitment must reflect results and reach."},
  SECONDARY_PARTNER:{style:"PRACTICAL",accept:.17,ceiling:.52,counterShare:.53,rationale:"We can find a workable middle ground while keeping the partnership commercially balanced."},
});
const V7_BENEFIT:Readonly<Record<string,string>>=Object.freeze({
  EQUIPMENT:"Darts equipment, product access and performance rewards",APPAREL:"Competition apparel and visibility-led support",
  TRADES:"Local backing and entry-fee help",LOGISTICS:"Travel and accommodation support",
  AUTOMOTIVE:"Touring support and event access",TECHNOLOGY:"Digital reach and practical technology",
  ENERGY:"Long-term backing and performance rewards",CONSUMER:"Audience reach and event payments",
  FINANCIAL:"Reliable guarantees and professional growth",
});
const V7_COMMITMENT:Readonly<Record<SponsorCategory,string>>=Object.freeze({
  EQUIPMENT_PARTNER:"Product appearances and launch feedback",APPAREL_PARTNER:"Media appearances and promotional work",
  TRAVEL_PARTNER:"Event promotion and community appearances",LOCAL_PARTNER:"Local community appearances",
  MAIN_PARTNER:"Media visibility, promotion and community appearances",
  SECONDARY_PARTNER:"A focused mix of media and community appearances",
});
const stableBrandNumber=(key:string)=>[...key].reduce((value,char)=>(value*31+char.charCodeAt(0))>>>0,7);
export const SPONSOR_CATALOGUE_V7:readonly SponsorDefinition[]=Object.freeze(SPONSOR_CATALOGUE_V6.map(definition=>{
  const terms=structuredClone(definition.terms),brand=BRANDS.find(item=>item.id===definition.key)!;
  const base=V7_NEGOTIATION[terms.category??"MAIN_PARTNER"],variation=stableBrandNumber(brand.id);
  const accept=Math.max(.08,Math.min(.3,base.accept+((variation%5)-2)*.01));
  const ceiling=Math.max(accept+.18,Math.min(.78,base.ceiling+(((variation>>>3)%7)-3)*.015));
  const counterShare=Math.max(.32,Math.min(.68,base.counterShare+(((variation>>>6)%7)-3)*.025));
  terms.sponsorDatabaseVersion=7;
  terms.commercialProfile={positioning:brand.personality,
    benefitFocus:V7_BENEFIT[brand.sector]??"Flexible commercial support for your career",
    commitmentFocus:V7_COMMITMENT[brand.category],
    negotiation:{...base,accept,ceiling,counterShare}};
  return {key:definition.key,offerRequirement:structuredClone(definition.offerRequirement),terms};
}));

/** SP-F3: restore a visible four-stage value ladder and scale duties with the deal. */
const V8_TIER:Readonly<Record<SponsorTier,{guarantee:number;signing:number;event:number;performance:number;duration:number;required:number}>>=Object.freeze({
  LOCAL:{guarantee:45_000,signing:20_000,event:1_500,performance:1,duration:1,required:0},
  REGIONAL:{guarantee:250_000,signing:100_000,event:4_000,performance:1.15,duration:1,required:1},
  PROFESSIONAL:{guarantee:1_400_000,signing:600_000,event:15_000,performance:1.25,duration:2,required:2},
  ELITE:{guarantee:5_000_000,signing:2_500_000,event:65_000,performance:1.4,duration:3,required:3},
});
const V8_SECTOR:Readonly<Record<string,{guarantee:number;signing:number;event:number}>>=Object.freeze({
  EQUIPMENT:{guarantee:1.05,signing:1.05,event:.8},APPAREL:{guarantee:.95,signing:1.1,event:1.15},
  TRADES:{guarantee:.85,signing:.8,event:1.35},LOGISTICS:{guarantee:1,signing:.9,event:1.2},
  AUTOMOTIVE:{guarantee:1.1,signing:1.15,event:1},TECHNOLOGY:{guarantee:1,signing:1.1,event:1.1},
  ENERGY:{guarantee:1.2,signing:1,event:.9},CONSUMER:{guarantee:.9,signing:1.2,event:1.3},
  FINANCIAL:{guarantee:1.25,signing:1.1,event:.85},
});
function v8ActivitySpecification(definition:SponsorDefinition):SponsorActivitySpecification{
  const category=definition.terms.contractFoundation!.category,tier=definition.terms.tier;
  const count=V8_TIER[tier].required;
  const categoryTypes=category==="LOCAL_PARTNER"&&tier==="PROFESSIONAL"
    ?["COMMUNITY_APPEARANCE","MEDIA_APPEARANCE","PROMOTIONAL_APPEARANCE"] as const
    :requiredTypeForCategory[category];
  const types=categoryTypes.filter(type=>REQUIRED_TIER_TYPES[tier].includes(type)).slice(0,count);
  const required=types.map((type,index)=>({id:`v8-${type.toLowerCase().replaceAll("_","-")}-${index+1}`,
    type,maxPerSeason:1 as const,windowWeeks:REQUIRED_WINDOW[type],firstWindowWeek:8+index*16,extraCompensationPence:0 as const}));
  const optional=definition.terms.contractFoundation!.activitySpecification?.optional??[];
  return validateSponsorActivitySpecification({version:SPONSOR_ACTIVITY_SPEC_VERSION,required,optional},tier,category);
}
export const SPONSOR_CATALOGUE_V8:readonly SponsorDefinition[]=Object.freeze(SPONSOR_CATALOGUE_V7.map(definition=>{
  const terms=structuredClone(definition.terms),tier=V8_TIER[terms.tier];
  const brand=BRANDS.find(item=>item.id===definition.key)!;
  const sector=V8_SECTOR[brand.sector]??{guarantee:1,signing:1,event:1};
  const category=SPONSOR_V6_PROFILE[terms.category??"MAIN_PARTNER"];
  terms.sponsorDatabaseVersion=8;
  terms.duration={kind:"SEASONS",seasons:tier.duration};
  terms.signingBonusPence=scaleSponsorPence(tier.signing,sector.signing*category.signing);
  terms.contractFoundation!.guaranteedPayments=[{amountPence:scaleSponsorPence(tier.guarantee,sector.guarantee*category.guarantee),
    cadence:"PER_SEASON",installments:4}];
  if(terms.eventPayment){
    terms.eventPayment.amountPence=scaleSponsorPence(tier.event,sector.event*category.event);
    terms.eventPayment.maxEventsPerSeason=terms.tier==="LOCAL"?12:terms.tier==="REGIONAL"?20:terms.tier==="PROFESSIONAL"?32:40;
  }
  terms.performanceBonuses=terms.performanceBonuses.map(bonus=>({...bonus,
    amountPence:scaleSponsorPence(bonus.amountPence,tier.performance)}));
  terms.coverage=terms.coverage.map(rule=>{
    const travel=rule.costTypes.some(type=>type==="TRAVEL"||type==="ACCOMMODATION");
    const perEvent=terms.tier==="LOCAL"?2_500:terms.tier==="REGIONAL"?15_000:terms.tier==="PROFESSIONAL"?100_000:null;
    const season=terms.tier==="LOCAL"?30_000:terms.tier==="REGIONAL"?250_000:terms.tier==="PROFESSIONAL"?2_000_000:null;
    return {...rule,perEventCapPence:perEvent,seasonCapPence:season,
      percent:terms.tier==="ELITE"?100:Math.max(rule.percent,terms.tier==="LOCAL"?70:terms.tier==="REGIONAL"?45:terms.tier==="PROFESSIONAL"?(travel?40:65):0)};
  });
  terms.contractFoundation!.activitySpecification=v8ActivitySpecification(definition);
  return {key:definition.key,offerRequirement:structuredClone(definition.offerRequirement),terms};
}));

export function validateSponsorCatalogues():void {
  for(const [version,catalogue] of [[1,SPONSOR_CATALOGUE_V1],[2,SPONSOR_CATALOGUE_V2],[3,SPONSOR_CATALOGUE_V3],[4,SPONSOR_CATALOGUE_V4],[5,SPONSOR_CATALOGUE_V5],[6,SPONSOR_CATALOGUE_V6],[7,SPONSOR_CATALOGUE_V7],[8,SPONSOR_CATALOGUE_V8]] as const){
    const keys=new Set<string>();
    for(const definition of catalogue){
      if(keys.has(definition.key))throw new Error(`Duplicate sponsor definition in v${version}: ${definition.key}`);
      keys.add(definition.key);
      requirementSchema.parse(definition.offerRequirement);
      parseSponsorTerms(definition.terms);
      if(definition.terms.sponsorDatabaseVersion!==version)throw new Error(`Sponsor terms version mismatch: ${definition.key}`);
      if(definition.terms.sponsorKey!==definition.key)throw new Error(`Sponsor key mismatch: ${definition.key}`);
      if(version===4||version===5){
        const guarantees=definition.terms.contractFoundation?.guaranteedPayments??[];
        if(version===4&&guarantees.length!==0)
          throw new Error(`Sponsor guarantees in v4 must remain unchanged: ${definition.key}`);
        if(version===5&&(guarantees.length!==1||guarantees[0].cadence!=="PER_SEASON"||
          guarantees[0].installments!==4||guarantees[0].amountPence!==ANNUAL_GUARANTEE_PENCE[definition.terms.tier]))
          throw new Error(`Sponsor guarantee does not match the approved v5 tier schedule: ${definition.key}`);
        if(!definition.terms.contractFoundation?.activitySpecification)
          throw new Error(`Sponsor activities are missing from v4: ${definition.key}`);
        validateSponsorActivitySpecification(definition.terms.contractFoundation.activitySpecification,definition.terms.tier,definition.terms.contractFoundation.category);
      }
      if(version===6&&definition.terms.contractFoundation?.guaranteedPayments.length!==1)
        throw new Error(`Sponsor v6 must have one seasonal guarantee: ${definition.key}`);
      if(version===7&&!definition.terms.commercialProfile)
        throw new Error(`Sponsor v7 commercial identity is missing: ${definition.key}`);
      if(version===8){
        if(!definition.terms.commercialProfile)throw new Error(`Sponsor v8 commercial identity is missing: ${definition.key}`);
        validateSponsorActivitySpecification(definition.terms.contractFoundation!.activitySpecification!,definition.terms.tier,definition.terms.contractFoundation!.category);
      }
      if(definition.terms.representative&&definition.terms.representative.sponsorId!==definition.key)
        throw new Error(`Sponsor representative owner mismatch: ${definition.key}`);
    }
  }
}
validateSponsorCatalogues();
