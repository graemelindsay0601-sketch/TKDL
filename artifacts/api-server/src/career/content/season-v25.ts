import type { EventDefinition } from "../calendar/catalogue.ts";
import { knockout501 } from "../calendar/formats.ts";
import { R } from "../calendar/eligibility.ts";

export const V25_CALENDAR_REFRESH_KEYS = [
  "anz-premier-night-1", "anz-premier-night-2", "anz-premier-night-3",
  "anz-premier-night-4", "anz-premier-night-5", "anz-premier-finals",
] as const;

const NIGHTS = [
  { week: 39, day: 6, venue: "anz-canberra-hall", label: "Canberra" },
  { week: 40, day: 6, venue: "anz-adelaide-hall", label: "Adelaide" },
  { week: 41, day: 6, venue: "southern-cross-hall", label: "Melbourne" },
  { week: 42, day: 5, venue: "waitemata-centre-auckland", label: "Auckland" },
  { week: 43, day: 6, venue: "anz-newcastle-hall", label: "Newcastle" },
  { week: 44, day: 6, venue: "pacific-assembly", label: "Brisbane" },
] as const;

/** Six-night Dabble-style regional league: five cup nights, then the top-four final. */
export function buildCatalogueV25(v24: readonly EventDefinition[]): readonly EventDefinition[] {
  const out = v24.map(original => ({ ...structuredClone(original), eventDatabaseVersion: 25 }));
  const template = out.find(event => event.key === "thursday-night-darts");
  if (!template) throw new Error("Missing invitation event template for ANZ Premier League");
  const common = {
    ...structuredClone(template),
    family: "anz-premier-league",
    circuit: "INVITATIONAL" as const,
    classification: "INVITATIONAL_EXHIBITION" as const,
    rankingCategory: null,
    presentation: {
      ...template.presentation,
      tier: "TELEVISED" as const,
      featured: true,
      calendarPriority: 84,
      brandingFamily: "anz-premier-league",
      heroAssetKey: "hero:anz-premier-league",
      badgeAssetKey: "badge:anz-premier-league",
    },
    format: knockout501([9, 9, 9], "stage"),
    fieldSize: 8,
    minimumEntrants: 8,
    npcFill: [0, 0] as [number, number],
    npcTierWeights: { GRASSROOTS: 0, AMATEUR: 0, PROFESSIONAL: 0.5, ELITE: 1 },
    geography: { kind: "INTERNATIONAL" as const, hostBonus: 1.4 },
    eligibility: R.invitation(),
    fieldPolicy: "SELECTION" as const,
    entitlementIntake: [] as string[],
    invitationPolicy: { count: 8, tierWeights: { GRASSROOTS: 0, AMATEUR: 0, PROFESSIONAL: 0.5, ELITE: 1 } },
    qualificationOutputs: [],
    seedingPolicy: { list: null, seeds: 0 },
    registrationLeadWeeks: 2,
    series: { key: "anz-premier-league", day: 1, days: 6 },
    legacyConcept: "ANZ Premier League",
    content: {
      ...template.content!,
      summary: "Five eight-player knockout nights award league points (5 to the winner, 3 to the runner-up, 2 to each semi-finalist). The top four advance to Finals Night.",
      circuitId: "anz-premier-league",
      circuitName: "Oceania Premier League",
      eventClass: "SECONDARY_TOUR" as const,
    },
  };
  const nights = NIGHTS.slice(0, 5).map((slot, index): EventDefinition => ({
    ...structuredClone(common),
    key: `anz-premier-night-${index + 1}`,
    name: `Oceania Premier League — Night ${index + 1} ({city})`,
    eventDatabaseVersion: 25,
    schedule: { kind: "FIXED", slots: [{ week: slot.week, day: slot.day, venue: slot.venue, label: slot.label }] },
    series: { key: "anz-premier-league", day: index + 1, days: 6 },
    fieldPolicy: index === 0 ? "SELECTION" : "SERIES_FIRST_DAY",
    invitationPolicy: index === 0 ? common.invitationPolicy : null,
    seedingPolicy: index === 4 ? { list: "anz-premier-league", seeds: 8 } : { list: null, seeds: 0 },
    content: { ...common.content!, summary: index === 4
      ? "The fifth eight-player knockout night is seeded from the league table after Night Four. The winner scores 5 points, the runner-up 3 and each semi-finalist 2."
      : common.content!.summary },
  }));
  const finals: EventDefinition = {
    ...structuredClone(common),
    key: "anz-premier-finals",
    name: "Oceania Premier League — Finals Night ({city})",
    eventDatabaseVersion: 25,
    format: knockout501([9, 9], "stage"),
    fieldSize: 4,
    minimumEntrants: 4,
    eligibility: R.qualified("anz-premier-finals"),
    fieldPolicy: "SELECTION",
    entitlementIntake: ["anz-premier-finals"],
    invitationPolicy: null,
    seedingPolicy: { list: "anz-premier-league", seeds: 4 },
    series: { key: "anz-premier-league", day: 6, days: 6 },
    qualificationOutputs: [
      { maxPosition: 1, entitlementType: "EVENT_ENTRY", targetKey: "world-championship", targetSeason: "SAME", consumption: "SINGLE_USE" },
      { maxPosition: 1, entitlementType: "EVENT_ENTRY", targetKey: "grand-slam-of-champions", targetSeason: "SAME", consumption: "SINGLE_USE" },
    ],
    schedule: { kind: "FIXED", slots: [{ week: 44, day: NIGHTS[5].day, venue: NIGHTS[5].venue, label: NIGHTS[5].label }] },
    content: { ...common.content!, summary: "The four league-table leaders play semi-finals and a final. The champion qualifies for the World Darts Championship and Grand Slam of Darts." },
  };
  return Object.freeze([...out, ...nights, finals]);
}
