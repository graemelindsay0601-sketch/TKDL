/**
 * Workstream E2 — locked, versioned award PRESENTATION policy.
 *
 * Decides what an event's winner is SHOWN receiving: a physical trophy, a
 * recognition (plaque or medal), or the result and prize only. It never changes
 * a result, title count, prize payment, ranking money or qualification. A win
 * remains a recorded win whatever is displayed.
 *
 * A trophyId in event content is NOT evidence that a physical trophy exists.
 * Every catalogue definition (v1–v5) has an explicit row below; the rule
 * fallback exists only for definitions added later and is reported by tests.
 */
export const AWARD_POLICY_VERSION = 1 as const;

export type AwardType = "PHYSICAL_TROPHY" | "RECOGNITION" | "RESULT_ONLY";
export type RecognitionForm = "PLAQUE" | "MEDAL";
export type EventAwardKind = "WORLD_CHAMPIONSHIP" | "MAJOR" | "CHAMPIONSHIP" | "SPECIAL_LOCAL_CHAMPIONSHIP" | "SERIES_FINALS"
  | "TOUR_ROUND" | "SERIES_ROUND" | "WEEKLY" | "INVITATIONAL" | "QUALIFIER" | "Q_SCHOOL_SESSION";

export type EventAward = {
  award: AwardType;
  kind: EventAwardKind;
  /** Premium art identity for PHYSICAL_TROPHY (one of the 18 catalogue identities); null otherwise. */
  trophyId: string | null;
  recognition?: RecognitionForm;
  /** Approved engraving for the plinth plate; never a sponsor mark. */
  inscription?: string;
  note?: string;
};

const T = (kind: EventAwardKind, trophyId: string, inscription?: string): EventAward => ({ award: "PHYSICAL_TROPHY", kind, trophyId, inscription });
const R = (kind: EventAwardKind, recognition: RecognitionForm, note?: string): EventAward => ({ award: "RECOGNITION", kind, trophyId: null, recognition, note });
const N = (kind: EventAwardKind, note?: string): EventAward => ({ award: "RESULT_ONLY", kind, trophyId: null, note });

const WEEKLY = "Weekly/club fixture: prize, result and any ranking points only.";
const ROUND = "Regular tour round: result, prize and ranking money only.";
const QUAL = "Qualifier: a sporting achievement, never a championship trophy.";
const QSCHOOL = "Q-School session: Tour Cards are an A5 decision; no championship trophy.";

export const EVENT_AWARDS: Readonly<Record<string, EventAward>> = Object.freeze({
  // ---- World Championship
  "world-darts-championship": T("WORLD_CHAMPIONSHIP", "sovereign", "WORLD CHAMPION"),
  "world-championship-qualifier": N("QUALIFIER", QUAL),
  "amateur-world-qualifier": N("QUALIFIER", QUAL),
  // ---- Majors (premium distinctive identities)
  "double-crown": T("MAJOR", "double-crown", "DOUBLE CROWN"),
  "double-start-grand-prix": T("MAJOR", "silver-cup", "GRAND PRIX"),
  "european-championship": T("MAJOR", "international-globe", "EUROPEAN CHAMPION"),
  "grand-slam-of-champions": T("MAJOR", "championship-cup", "GRAND SLAM OF CHAMPIONS"),
  "long-format-matchplay": T("MAJOR", "tall-championship", "MATCHPLAY CHAMPION"),
  "open-championship": T("MAJOR", "open-masters-heritage", "THE OPEN CHAMPION"),
  "pro-circuit-finals": T("MAJOR", "silver-bowl", "PRO CIRCUIT FINALS"),
  "open-championship-qualifier": N("QUALIFIER", QUAL),
  // ---- Professional tour
  "pro-circuit-championship": T("TOUR_ROUND", "championship-plate", "PRO CIRCUIT"),
  "challenger-event": N("TOUR_ROUND", ROUND),
  "european-dart-series": R("SERIES_ROUND", "PLAQUE", "Continental series round: event plaque, no ornate trophy."),
  "european-series-qualifier": N("QUALIFIER", QUAL),
  "world-dart-series": R("SERIES_ROUND", "PLAQUE", "World series round: event plaque, no ornate trophy."),
  "world-dart-series-finals": T("SERIES_FINALS", "silver-cup", "WORLD SERIES FINALS"),
  "champions-masters": T("INVITATIONAL", "silver-cup", "CHAMPIONS MASTERS"),
  "thursday-night-darts": N("WEEKLY", "Weekly league night: result and prize only."),
  // ---- Vault
  "vault-championship": T("CHAMPIONSHIP", "vault-geometric", "VAULT CHAMPION"),
  "vault-masters": T("CHAMPIONSHIP", "vault-geometric", "VAULT MASTERS"),
  "vault-nights": N("SERIES_ROUND", "Vault night: result and prize only."),
  "vault-series-night": N("SERIES_ROUND", "Vault series night: result and prize only."),
  "vault-tour": N("TOUR_ROUND", ROUND),
  "vault-qualifier": N("QUALIFIER", QUAL),
  // ---- Q-School
  ...Object.fromEntries(["europe", "uk_ireland"].flatMap(p => [
    ...[1, 2, 3, 4].map(d => [`q-school-final-${p}-d${d}`, N("Q_SCHOOL_SESSION", QSCHOOL)]),
    ...[1, 2, 3].map(d => [`q-school-first-${p}-d${d}`, N("Q_SCHOOL_SESSION", QSCHOOL)]),
  ])),
  // ---- National & international amateur
  ...Object.fromEntries(["aus", "bel", "can", "deu", "gbr", "irl", "nld"].map(c => [`national-amateur-${c}`, T("CHAMPIONSHIP", "silver-cup", "NATIONAL CHAMPION")])),
  "amateur-masters": T("CHAMPIONSHIP", "silver-cup", "AMATEUR MASTERS"),
  "amateur-world-masters": T("CHAMPIONSHIP", "silver-cup", "AMATEUR WORLD MASTERS"),
  "international-amateur-open": T("CHAMPIONSHIP", "silver-cup", "INTERNATIONAL AMATEUR OPEN"),
  "national-open": T("CHAMPIONSHIP", "silver-cup", "NATIONAL OPEN"),
  "international-open": T("CHAMPIONSHIP", "international-globe", "INTERNATIONAL OPEN"),
  "northern-open": T("CHAMPIONSHIP", "international-globe", "NORTHERN OPEN"),
  "north-american-open": T("CHAMPIONSHIP", "international-globe", "NORTH AMERICAN OPEN"),
  "asia-pacific-open": T("CHAMPIONSHIP", "international-globe", "ASIA-PACIFIC OPEN"),
  "australasian-open": T("CHAMPIONSHIP", "international-globe", "AUSTRALASIAN OPEN"),
  "premier-open": T("CHAMPIONSHIP", "international-globe", "PREMIER OPEN"),
  "open-finals": T("SERIES_FINALS", "international-globe", "OPEN FINALS"),
  // ---- Women
  "women-world-championship": T("CHAMPIONSHIP", "cut-glass", "WOMEN'S WORLD CHAMPION"),
  "women-masters": T("CHAMPIONSHIP", "cut-glass", "WOMEN'S MASTERS"),
  "women-tour": N("TOUR_ROUND", ROUND),
  // ---- Youth & development: ordinary rounds no cups; championship finals yes
  "youth-world-championship": T("CHAMPIONSHIP", "youth-rising-star", "YOUTH WORLD CHAMPION"),
  "youth-masters": T("CHAMPIONSHIP", "youth-rising-star", "YOUTH MASTERS"),
  "junior-development-championship": T("CHAMPIONSHIP", "youth-rising-star", "JUNIOR CHAMPION"),
  "development-tour": N("TOUR_ROUND", "Development tour round: result and prize only."),
  "junior-development-night": N("WEEKLY", "Junior development night: result only."),
  // ---- County & regional: named championships only
  "county-championship": T("CHAMPIONSHIP", "regional-craft", "COUNTY CHAMPION"),
  "regional-champions-league": T("CHAMPIONSHIP", "regional-craft", "REGIONAL CHAMPIONS LEAGUE"),
  "regional-classic": R("CHAMPIONSHIP", "PLAQUE", "Regional classic: winner's plaque."),
  "regional-open": R("CHAMPIONSHIP", "PLAQUE", "Regional open: winner's plaque."),
  "county-501-open": N("TOUR_ROUND", "Routine county fixture: result and prize only."),
  "county-301-sprint": N("TOUR_ROUND", "Routine county fixture: result and prize only."),
  "county-701-open": N("TOUR_ROUND", "Routine county fixture: result and prize only."),
  "county-classic-dido": N("TOUR_ROUND", "Routine county fixture: result and prize only."),
  // ---- Grassroots & weekly
  "friday-night-501": N("WEEKLY", WEEKLY),
  "sunday-league-sprint": N("WEEKLY", WEEKLY),
  "pub-doubles": N("WEEKLY", WEEKLY),
  "town-open": T("SPECIAL_LOCAL_CHAMPIONSHIP", "wood-silver-shield", "TOWN OPEN"),
  // ---- Special formats: local nights result-only; named trophies/cups modest shield; featured classics plaque
  ...Object.fromEntries(["count-up-challenge", "cricket-classic", "football-darts", "golf-night", "halve-it-night", "killer-night", "sudden-death-night"]
    .map(k => [k, N("WEEKLY", "Local format night: result and prize only.")])),
  "noughts-and-crosses-trophy": T("SPECIAL_LOCAL_CHAMPIONSHIP", "wood-silver-shield", "NOUGHTS & CROSSES"),
  "snooker-darts-cup": T("SPECIAL_LOCAL_CHAMPIONSHIP", "wood-silver-shield", "SNOOKER DARTS CUP"),
  "treble-out-trophy": T("SPECIAL_LOCAL_CHAMPIONSHIP", "wood-silver-shield", "TREBLE-OUT TROPHY"),
  "national-cricket": T("SPECIAL_LOCAL_CHAMPIONSHIP", "wood-silver-shield", "NATIONAL CRICKET"),
  "national-halve-it": T("SPECIAL_LOCAL_CHAMPIONSHIP", "wood-silver-shield", "NATIONAL HALVE-IT"),
  ...Object.fromEntries(["baseball-darts-classic", "bobs-27-challenge", "fives-festival", "golf-18-open", "scram-shootout", "shanghai-showdown"]
    .map(k => [k, R("SPECIAL_LOCAL_CHAMPIONSHIP", "PLAQUE", "Featured format event: winner's plaque.")])),
});

export type AwardInput = { definitionKey: string; circuit?: string; classification?: string; tier?: string };
export type ResolvedAward = EventAward & { source: "EXPLICIT" | "RULE"; policyVersion: typeof AWARD_POLICY_VERSION };

/**
 * Explicit mapping first. The rule fallback is conservative: qualifiers and
 * Q-School never get trophies; only WORLD/MAJOR-tier definitions get one.
 */
export function resolveAward(e: AwardInput): ResolvedAward {
  const explicit = EVENT_AWARDS[e.definitionKey];
  if (explicit) return { ...explicit, source: "EXPLICIT", policyVersion: AWARD_POLICY_VERSION };
  const rule: EventAward = e.circuit === "Q_SCHOOL" ? N("Q_SCHOOL_SESSION", QSCHOOL)
    : e.classification === "QUALIFIER" ? N("QUALIFIER", QUAL)
    : e.tier === "WORLD" || e.circuit === "WORLD_CHAMPIONSHIP" ? T("WORLD_CHAMPIONSHIP", "sovereign", "WORLD CHAMPION")
    : e.tier === "MAJOR" ? T("MAJOR", "championship-cup")
    : N("TOUR_ROUND", "Unclassified event: result and prize only until explicitly designated.");
  return { ...rule, source: "RULE", policyVersion: AWARD_POLICY_VERSION };
}

/** True only when the winner is shown holding a physical trophy. */
export const awardsPhysicalTrophy = (e: AwardInput) => resolveAward(e).award === "PHYSICAL_TROPHY";
