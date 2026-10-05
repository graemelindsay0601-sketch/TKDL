import { SPONSOR_DATABASE_VERSION } from "./config.ts";
import { BRANDS, type RelationshipSlot } from "../content/brands.ts";

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
  exclusivityGroups?: string[];
  geographicPreference?: string | null;
  signatureProductSupport?: ("SIGNATURE_DARTS" | "SIGNATURE_RANGE")[];
};
export type SponsorDefinition = { key: string; offerRequirement: Requirement; terms: SponsorTerms };

const AMATEUR = ["GRASSROOTS", "COUNTY", "REGIONAL", "NATIONAL_AMATEUR", "SPECIAL"];
const DEVELOPMENT = ["REGIONAL", "NATIONAL_AMATEUR", "CHALLENGER", "VAULT", "Q_SCHOOL"];
const PRO = ["PRO_CIRCUIT", "EUROPEAN_SERIES", "WORLD_SERIES", "MAJOR", "INVITATIONAL", "WORLD_CHAMPIONSHIP"];
const RANKED = ["RANKING", "QUALIFIER"];
const def = (key: string, offerRequirement: Requirement, terms: Omit<SponsorTerms, "sponsorKey" | "sponsorDatabaseVersion">): SponsorDefinition =>
  ({ key, offerRequirement, terms: { ...terms, sponsorKey: key, sponsorDatabaseVersion: SPONSOR_DATABASE_VERSION } });

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
    geographicPreference: b.locationId, signatureProductSupport: b.signatureProductSupport,
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
  throw new Error(`Unsupported sponsor database version ${version}`);
}
