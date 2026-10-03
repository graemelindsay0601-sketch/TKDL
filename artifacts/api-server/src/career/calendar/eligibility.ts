import { z } from "zod";
import { zoneOf, ZONES, type Zone } from "./geography.ts";

/**
 * Composable eligibility. Rules are data stored in each instance snapshot, so a
 * historical event keeps the rules it was played under. Authority that A3 does
 * not own (rankings, Tour Cards) is read only through SportingStatus providers.
 */
export type Rule =
  | { all: Rule[] } | { any: Rule[] } | { not: Rule }
  | { type: "OPEN" }
  | { type: "COUNTRY"; countries: string[] }
  | { type: "ZONE"; zones: Zone[] }
  | { type: "LOCALITY"; localities: string[] }
  | { type: "PRO_STATUS"; status: "AMATEUR" | "PROFESSIONAL" }
  | { type: "TOUR_CARD" }
  | { type: "NON_TOUR_CARD" }
  | { type: "QUALIFICATION"; targetKey: string }
  | { type: "INVITATION" }
  | { type: "RANKING"; list: string; maxPosition: number }
  | { type: "EVENT_RESULT"; definitionKey: string; maxPosition: number; season: "SAME" | "PREVIOUS" }
  | { type: "DEFENDING_CHAMPION" };

const leaf = z.discriminatedUnion("type", [
  z.object({ type: z.literal("OPEN") }).strict(),
  z.object({ type: z.literal("COUNTRY"), countries: z.array(z.string().min(2).max(3)).min(1) }).strict(),
  z.object({ type: z.literal("ZONE"), zones: z.array(z.enum(ZONES)).min(1) }).strict(),
  z.object({ type: z.literal("LOCALITY"), localities: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ type: z.literal("PRO_STATUS"), status: z.enum(["AMATEUR", "PROFESSIONAL"]) }).strict(),
  z.object({ type: z.literal("TOUR_CARD") }).strict(),
  z.object({ type: z.literal("NON_TOUR_CARD") }).strict(),
  z.object({ type: z.literal("QUALIFICATION"), targetKey: z.string().min(1) }).strict(),
  z.object({ type: z.literal("INVITATION") }).strict(),
  z.object({ type: z.literal("RANKING"), list: z.string().min(1), maxPosition: z.number().int().positive() }).strict(),
  z.object({ type: z.literal("EVENT_RESULT"), definitionKey: z.string().min(1), maxPosition: z.number().int().positive(), season: z.enum(["SAME", "PREVIOUS"]) }).strict(),
  z.object({ type: z.literal("DEFENDING_CHAMPION") }).strict(),
]);
export const ruleSchema: z.ZodType<Rule> = z.lazy(() => z.union([
  z.object({ all: z.array(ruleSchema).min(1) }).strict(),
  z.object({ any: z.array(ruleSchema).min(1) }).strict(),
  z.object({ not: ruleSchema }).strict(),
  leaf,
]));

export const DENIAL_REASONS = [
  "NOT_ELIGIBLE", "OUTSIDE_REGION", "REQUIRES_AMATEUR_STATUS", "REQUIRES_PROFESSIONAL_STATUS",
  "REQUIRES_TOUR_CARD", "TOUR_CARD_HOLDER_EXCLUDED", "REQUIRES_QUALIFICATION", "REQUIRES_INVITATION",
  "REQUIRES_RANKING", "REQUIRES_EVENT_RESULT", "REQUIRES_DEFENDING_CHAMPION",
  "REGISTRATION_NOT_OPEN", "REGISTRATION_CLOSED", "SCHEDULE_CONFLICT", "ALREADY_ENTERED", "NOT_ENTERED",
  "UNSUPPORTED_FORMAT", "CAREER_NOT_ACTIVE", "PARTICIPANT_RETIRED", "FIELD_LOCKED", "EVENT_FINISHED",
] as const;
export type DenialReason = typeof DENIAL_REASONS[number];

/** Facts about one participant, supplied by A3 + provider boundaries. */
export type ParticipantFacts = {
  key: string; kind: "HUMAN" | "NPC";
  country: string; zone: Zone; locality: string | null;
  professionalStatus: "AMATEUR" | "PROFESSIONAL";
  /** null = authority (A5) not available; A3 never invents Tour Cards. */
  tourCard: boolean | null;
  /** Ranking positions by list; empty until A5 provides them. */
  rankings: Record<string, number>;
  /** Active entitlement target keys this participant holds. */
  entitlementTargets: ReadonlySet<string>;
  invited: boolean;
  /** definitionKey -> best finishing position, per relative season. */
  results: { SAME: ReadonlyMap<string, number>; PREVIOUS: ReadonlyMap<string, number> };
  defendingChampion: boolean;
};

export type RuleOutcome = { eligible: boolean; reasons: DenialReason[] };
const ok: RuleOutcome = { eligible: true, reasons: [] };
const deny = (...reasons: DenialReason[]): RuleOutcome => ({ eligible: false, reasons });

export function evaluateRule(rule: Rule, facts: ParticipantFacts): RuleOutcome {
  if ("all" in rule) {
    const outcomes = rule.all.map(r => evaluateRule(r, facts));
    const failed = outcomes.filter(o => !o.eligible);
    return failed.length ? deny(...unique(failed.flatMap(o => o.reasons))) : ok;
  }
  if ("any" in rule) {
    const outcomes = rule.any.map(r => evaluateRule(r, facts));
    return outcomes.some(o => o.eligible) ? ok : deny(...unique(outcomes.flatMap(o => o.reasons)));
  }
  if ("not" in rule) return evaluateRule(rule.not, facts).eligible ? deny("NOT_ELIGIBLE") : ok;
  switch (rule.type) {
    case "OPEN": return ok;
    case "COUNTRY": return rule.countries.includes(facts.country) ? ok : deny("OUTSIDE_REGION");
    case "ZONE": return rule.zones.includes(facts.zone) ? ok : deny("OUTSIDE_REGION");
    case "LOCALITY": return facts.locality && rule.localities.includes(facts.locality) ? ok : deny("OUTSIDE_REGION");
    case "PRO_STATUS": return facts.professionalStatus === rule.status ? ok : deny(rule.status === "AMATEUR" ? "REQUIRES_AMATEUR_STATUS" : "REQUIRES_PROFESSIONAL_STATUS");
    case "TOUR_CARD": return facts.tourCard === true ? ok : deny("REQUIRES_TOUR_CARD");
    case "NON_TOUR_CARD": return facts.tourCard === true ? deny("TOUR_CARD_HOLDER_EXCLUDED") : ok;
    case "QUALIFICATION": return facts.entitlementTargets.has(rule.targetKey) ? ok : deny("REQUIRES_QUALIFICATION");
    case "INVITATION": return facts.invited ? ok : deny("REQUIRES_INVITATION");
    case "RANKING": {
      const position = facts.rankings[rule.list];
      return position !== undefined && position <= rule.maxPosition ? ok : deny("REQUIRES_RANKING");
    }
    case "EVENT_RESULT": {
      const position = facts.results[rule.season].get(rule.definitionKey);
      return position !== undefined && position <= rule.maxPosition ? ok : deny("REQUIRES_EVENT_RESULT");
    }
    case "DEFENDING_CHAMPION": return facts.defendingChampion ? ok : deny("REQUIRES_DEFENDING_CHAMPION");
  }
}
const unique = <T>(values: T[]) => [...new Set(values)];

/** Static rule helpers for authored definitions. */
export const R = {
  open: (): Rule => ({ type: "OPEN" }),
  all: (...all: Rule[]): Rule => ({ all }),
  any: (...any: Rule[]): Rule => ({ any }),
  not: (rule: Rule): Rule => ({ not: rule }),
  country: (...countries: string[]): Rule => ({ type: "COUNTRY", countries }),
  zone: (...zones: Zone[]): Rule => ({ type: "ZONE", zones }),
  locality: (...localities: string[]): Rule => ({ type: "LOCALITY", localities }),
  amateur: (): Rule => ({ type: "PRO_STATUS", status: "AMATEUR" }),
  tourCard: (): Rule => ({ type: "TOUR_CARD" }),
  nonTourCard: (): Rule => ({ type: "NON_TOUR_CARD" }),
  qualified: (targetKey: string): Rule => ({ type: "QUALIFICATION", targetKey }),
  invitation: (): Rule => ({ type: "INVITATION" }),
  ranking: (list: string, maxPosition: number): Rule => ({ type: "RANKING", list, maxPosition }),
  result: (definitionKey: string, maxPosition: number, season: "SAME" | "PREVIOUS"): Rule => ({ type: "EVENT_RESULT", definitionKey, maxPosition, season }),
  defendingChampion: (): Rule => ({ type: "DEFENDING_CHAMPION" }),
};

/** Q-School pathway geography: UK/Ireland vs Europe; rest of world may choose either. */
export const Q_SCHOOL_PATHWAYS = {
  UK_IRELAND: { key: "UK_IRELAND", name: "UK & Ireland", zones: ["UK_IRELAND", "REST_OF_WORLD"] as Zone[] },
  EUROPE: { key: "EUROPE", name: "Europe", zones: ["EUROPE", "REST_OF_WORLD"] as Zone[] },
} as const;
export type QSchoolPathway = keyof typeof Q_SCHOOL_PATHWAYS;
export { zoneOf };
