/**
 * Workstream E2 — locked, versioned award PRESENTATION policy.
 *
 * Decides what an event's winner is SHOWN receiving: a physical trophy, a
 * recognition (plaque or medal), or the result and prize only. It never changes
 * a result, title count, prize payment, ranking money or qualification. A win
 * remains a recorded win whatever is displayed.
 *
 * A trophyId in event content is NOT evidence that a physical trophy exists.
 * Every catalogue definition (v1–v7) has an explicit row below; the rule
 * fallback exists only for definitions added later and is reported by tests.
 */
/** v1: award type + catalogue trophy family. v2 (current): adds event-specific premium designs. */
export const AWARD_POLICY_VERSION = 2 as const;
export type AwardPolicyVersion = 1 | 2;

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
  // v13 pairs: the nation's pair lifts the World Cup.
  "world-cup-of-darts": T("INVITATIONAL", "international-globe", "WORLD CUP OF DARTS"),
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
  ...Object.fromEntries(["aus", "bel", "can", "deu", "gbr", "irl", "nld", "fra", "swe", "jpn", "usa", "nzl"].map(c => [`national-amateur-${c}`, T("CHAMPIONSHIP", "silver-cup", "NATIONAL CHAMPION")])),
  // ---- v7 regional ladders and tours (every starting country)
  ...Object.fromEntries(["gbr", "irl", "nld", "deu", "bel", "fra", "swe", "aus", "can", "usa", "jpn", "nzl"].flatMap(c => [[`${c}-regional-series`, N("SERIES_ROUND", ROUND)]])),
  "gbr-classic": T("CHAMPIONSHIP", "silver-cup", "UNITED KINGDOM CLASSIC"),
  "gbr-masters": T("CHAMPIONSHIP", "silver-cup", "UNITED KINGDOM MASTERS"),
  "irl-classic": T("CHAMPIONSHIP", "silver-cup", "IRELAND CLASSIC"),
  "irl-masters": T("CHAMPIONSHIP", "silver-cup", "IRELAND MASTERS"),
  "nld-classic": T("CHAMPIONSHIP", "silver-cup", "NETHERLANDS CLASSIC"),
  "nld-masters": T("CHAMPIONSHIP", "silver-cup", "NETHERLANDS MASTERS"),
  "deu-classic": T("CHAMPIONSHIP", "silver-cup", "GERMANY CLASSIC"),
  "deu-masters": T("CHAMPIONSHIP", "silver-cup", "GERMANY MASTERS"),
  "bel-classic": T("CHAMPIONSHIP", "silver-cup", "BELGIUM CLASSIC"),
  "bel-masters": T("CHAMPIONSHIP", "silver-cup", "BELGIUM MASTERS"),
  "fra-classic": T("CHAMPIONSHIP", "silver-cup", "FRANCE CLASSIC"),
  "fra-masters": T("CHAMPIONSHIP", "silver-cup", "FRANCE MASTERS"),
  "swe-classic": T("CHAMPIONSHIP", "silver-cup", "SWEDEN CLASSIC"),
  "swe-masters": T("CHAMPIONSHIP", "silver-cup", "SWEDEN MASTERS"),
  "aus-classic": T("CHAMPIONSHIP", "silver-cup", "AUSTRALIA CLASSIC"),
  "aus-masters": T("CHAMPIONSHIP", "silver-cup", "AUSTRALIA MASTERS"),
  "can-classic": T("CHAMPIONSHIP", "silver-cup", "CANADA CLASSIC"),
  "can-masters": T("CHAMPIONSHIP", "silver-cup", "CANADA MASTERS"),
  "usa-classic": T("CHAMPIONSHIP", "silver-cup", "UNITED STATES CLASSIC"),
  "usa-masters": T("CHAMPIONSHIP", "silver-cup", "UNITED STATES MASTERS"),
  "jpn-classic": T("CHAMPIONSHIP", "silver-cup", "JAPAN CLASSIC"),
  "jpn-masters": T("CHAMPIONSHIP", "silver-cup", "JAPAN MASTERS"),
  "nzl-classic": T("CHAMPIONSHIP", "silver-cup", "NEW ZEALAND CLASSIC"),
  "nzl-masters": T("CHAMPIONSHIP", "silver-cup", "NEW ZEALAND MASTERS"),
  "asian-tour": N("TOUR_ROUND", ROUND),
  "asian-tour-finals": T("SERIES_FINALS", "international-globe", "ASIAN TOUR FINALS"),
  "north-american-tour": N("TOUR_ROUND", ROUND),
  "north-american-tour-finals": T("SERIES_FINALS", "international-globe", "NORTH AMERICAN TOUR FINALS"),
  "soft-tip-series": N("TOUR_ROUND", ROUND),
  "soft-tip-masters": T("CHAMPIONSHIP", "silver-cup", "SOFT-TIP MASTERS"),
  "soft-tip-series-finals": T("SERIES_FINALS", "international-globe", "SOFT-TIP WORLD FINALS"),
  "pro-super-series": N("TOUR_ROUND", "Super Series event: prize money and a Finals place only."),
  "pro-super-series-finals": T("SERIES_FINALS", "silver-cup", "PRO SUPER SERIES FINALS"),
  "grand-slam-qualifier": N("QUALIFIER", QUAL),
  "oceanic-tour": N("TOUR_ROUND", ROUND),
  "oceanic-tour-finals": T("SERIES_FINALS", "international-globe", "OCEANIC TOUR FINALS"),
  "nordic-baltic-tour": N("TOUR_ROUND", ROUND),
  "nordic-baltic-tour-finals": T("SERIES_FINALS", "international-globe", "NORDIC & BALTIC TOUR FINALS"),
  "european-development-series": N("TOUR_ROUND", ROUND),
  "european-development-series-finals": T("SERIES_FINALS", "international-globe", "EUROPEAN DEVELOPMENT FINALS"),
  "club-league-night": N("WEEKLY", WEEKLY),
  "midweek-league-night": N("WEEKLY", WEEKLY),
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
  "free-entry-night": N("WEEKLY", WEEKLY),
  "town-open": T("SPECIAL_LOCAL_CHAMPIONSHIP", "wood-silver-shield", "TOWN OPEN"),
  "new-year-open": T("SPECIAL_LOCAL_CHAMPIONSHIP", "wood-silver-shield", "NEW YEAR OPEN"),
  "festive-open": T("SPECIAL_LOCAL_CHAMPIONSHIP", "wood-silver-shield", "FESTIVE OPEN"),
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

// ---------------------------------------------------------------- v2 event-specific designs
export type DesignAllocation = { designId: string; allocation: "UNIQUE" | "SHARED" | "HISTORIC"; group?: string };
const U = (designId: string): DesignAllocation => ({ designId, allocation: "UNIQUE" });
const S = (designId: string, group: string): DesignAllocation => ({ designId, allocation: "SHARED", group });

/**
 * Which premium design each physical-trophy event shows (policy v2). Significant
 * championships have their own design; series that are one championship format
 * share a design by name. This is presentation only and never alters the stored
 * catalogue trophy identity (`trophyId`).
 */
export const EVENT_DESIGNS_V2: Readonly<Record<string, DesignAllocation>> = Object.freeze({
  "world-darts-championship": U("sovereign"),
  "double-crown": U("double-crown"),
  "open-championship": U("open-masters-heritage"),
  "grand-slam-of-champions": U("championship-cup"),
  "long-format-matchplay": U("tall-championship"),
  "pro-circuit-finals": U("silver-bowl"),
  "european-championship": U("ec-continental-crest"),
  "women-world-championship": U("wwc-crystal-flame"),
  "women-masters": U("cut-glass"),
  "youth-world-championship": U("ywc-star-orb"),
  "youth-masters": U("youth-rising-star"),
  "junior-development-championship": U("junior-star-cup"),
  "open-finals": U("open-finals-compass"),
  "amateur-world-masters": U("awm-globe-cup"),
  "amateur-masters": U("amateur-masters-tankard"),
  "national-open": U("traditional-shield"),
  "international-amateur-open": U("crystal-column"),
  "world-dart-series-finals": U("metal-sculpture"),
  "champions-masters": U("dart-sculpture"),
  "regional-champions-league": U("league-shield-ring"),
  "county-championship": U("regional-craft"),
  "snooker-darts-cup": U("snooker-darts-cup"),
  "treble-out-trophy": U("treble-triangles"),
  "noughts-and-crosses-trophy": U("noughts-crosses-block"),
  "national-cricket": U("cricket-scoreboard"),
  ...Object.fromEntries(["aus", "bel", "can", "deu", "gbr", "irl", "nld", "fra", "swe", "jpn", "usa", "nzl"].map(c => [`national-amateur-${c}`, S("silver-cup", "National amateur championships")])),
  ...Object.fromEntries(["gbr", "irl", "nld", "deu", "bel", "fra", "swe", "aus", "can", "usa", "jpn", "nzl"].flatMap(c => [[`${c}-classic`, S("silver-cup", "National classics & masters")], [`${c}-masters`, S("silver-cup", "National classics & masters")]])),
  ...Object.fromEntries(["asian-tour-finals", "north-american-tour-finals", "soft-tip-series-finals", "oceanic-tour-finals", "nordic-baltic-tour-finals", "european-development-series-finals"].map(k => [k, S("international-globe", "Regional tour finals")])),
  ...Object.fromEntries(["international-open", "northern-open", "north-american-open", "asia-pacific-open", "australasian-open", "premier-open"]
    .map(k => [k, S("international-globe", "International open series")])),
  "world-cup-of-darts": S("international-globe", "International team event"),
  "soft-tip-masters": S("silver-cup", "Soft-tip championships"),
  "pro-super-series-finals": S("silver-cup", "Pro Super Series"),
  "vault-championship": S("vault-geometric", "Vault championship lineage"),
  "vault-masters": S("vault-geometric", "Vault championship lineage"),
  "pro-circuit-championship": S("championship-plate", "Pro Circuit tour rounds"),
  "town-open": S("wood-silver-shield", "Local & format championships"),
  "new-year-open": S("wood-silver-shield", "Local & format championships"),
  "festive-open": S("wood-silver-shield", "Local & format championships"),
  "national-halve-it": S("wood-silver-shield", "Local & format championships"),
  "double-start-grand-prix": { designId: "silver-cup", allocation: "HISTORIC", group: "Retired v1 major (kept as recorded)" },
});

export type AwardInput = { definitionKey: string; circuit?: string; classification?: string; tier?: string };
export type ResolvedAward = EventAward & {
  source: "EXPLICIT" | "RULE"; policyVersion: AwardPolicyVersion;
  /** Premium design to display (v2: event-specific; v1: the catalogue family). Null when no physical trophy. */
  designId: string | null;
  designSource: "EVENT_DESIGN" | "FAMILY" | "PERSISTED" | null;
};
export type ResolveOptions = { version?: AwardPolicyVersion; persistedTrophyId?: string | null };

/**
 * Explicit mapping first. The rule fallback is conservative: qualifiers and
 * Q-School never get trophies; only WORLD/MAJOR-tier definitions get one.
 */
export function resolveAward(e: AwardInput, opts: ResolveOptions = {}): ResolvedAward {
  const version = opts.version ?? AWARD_POLICY_VERSION;
  const withDesign = (award: EventAward, source: ResolvedAward["source"]): ResolvedAward => {
    if (award.award !== "PHYSICAL_TROPHY") return { ...award, source, policyVersion: version, designId: null, designSource: null };
    // A saved event whose stored family differs from today's catalogue keeps its stored identity: never reinterpreted.
    if (opts.persistedTrophyId && opts.persistedTrophyId !== award.trophyId)
      return { ...award, source, policyVersion: version, designId: opts.persistedTrophyId, designSource: "PERSISTED" };
    const v2 = version >= 2 ? EVENT_DESIGNS_V2[e.definitionKey] : undefined;
    return { ...award, source, policyVersion: version, designId: v2?.designId ?? award.trophyId, designSource: v2 ? "EVENT_DESIGN" : "FAMILY" };
  };
  const explicit = EVENT_AWARDS[e.definitionKey];
  if (explicit) return withDesign(explicit, "EXPLICIT");
  const rule: EventAward = e.circuit === "Q_SCHOOL" ? N("Q_SCHOOL_SESSION", QSCHOOL)
    : e.classification === "QUALIFIER" ? N("QUALIFIER", QUAL)
    : e.tier === "WORLD" || e.circuit === "WORLD_CHAMPIONSHIP" ? T("WORLD_CHAMPIONSHIP", "sovereign", "WORLD CHAMPION")
    : e.tier === "MAJOR" ? T("MAJOR", "championship-cup")
    : N("TOUR_ROUND", "Unclassified event: result and prize only until explicitly designated.");
  return withDesign(rule, "RULE");
}

/** True only when the winner is shown holding a physical trophy. */
export const awardsPhysicalTrophy = (e: AwardInput) => resolveAward(e).award === "PHYSICAL_TROPHY";
