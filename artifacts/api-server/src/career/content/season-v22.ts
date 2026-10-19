import type { EventDefinition, ScheduleSlot } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { identity } from "./events.ts";

export const V22_CALENDAR_REFRESH_KEYS = [
  "continental-youth-cup-singles",
  "continental-youth-cup-pairs",
  "continental-girls-youth-cup-singles",
  "continental-girls-youth-cup-pairs",
] as const;

/**
 * Add the currently scheduled WDF Europe Cup Youth divisions that Career can
 * execute today. The real cup also has team divisions; those are deliberately
 * not disguised as doubles because this tournament engine only supports
 * singles and pairs.
 */
export function buildCatalogueV22(v21: readonly EventDefinition[]): readonly EventDefinition[] {
  const out = v21.map(original => ({
    ...structuredClone(original),
    eventDatabaseVersion: 22,
  }));
  const find = (key: string) => {
    const definition = out.find(d => d.key === key);
    if (!definition) throw new Error(`Missing v22 event template: ${key}`);
    return definition;
  };
  const adultTemplate = find("wdf-europe-cup");
  const youthTemplate = find("youth-world-championship");
  const slot: ScheduleSlot = {
    week: 28,
    day: 1,
    endDay: 4,
    venue: adultTemplate.schedule.kind === "FIXED"
      ? adultTemplate.schedule.slots[0]?.venue ?? "maas-hal-rotterdam"
      : "maas-hal-rotterdam",
  };
  const youth = R.age({ maxAgeExclusive: 18 });
  const addDivision = (key: typeof V22_CALENDAR_REFRESH_KEYS[number], name: string,
    womenOnly: boolean, pairs: boolean) => {
    const d: EventDefinition = {
      ...structuredClone(adultTemplate),
      key,
      name,
      family: "continental-youth-cup",
      eventDatabaseVersion: 22,
      circuit: "NATIONAL_AMATEUR",
      classification: "RANKING",
      rankingCategory: womenOnly ? "WOMENS" : "YOUTH",
      presentation: {
        ...adultTemplate.presentation,
        tier: "FEATURED",
        featured: true,
        calendarPriority: 66,
        brandingFamily: "continental-youth-cup",
        heroAssetKey: "hero:continental-youth-cup",
        badgeAssetKey: "badge:continental-youth-cup",
      },
      format: structuredClone(youthTemplate.format),
      fieldSize: 64,
      minimumEntrants: pairs ? 16 : 8,
      eligibility: womenOnly ? R.all(youth, R.women()) : youth,
      fieldPolicy: "SELECTION",
      entitlementIntake: [],
      invitationPolicy: null,
      schedule: { kind: "FIXED", slots: [{ ...slot }] },
      legacyConcept: "WDF Europe Cup Youth division; distinct in-game name",
    };
    if (pairs) d.format = { ...d.format, sideSize: 2, pairing: "NATION" };
    d.content = {
      ...identity(d, "youth-championships", "NATIONAL"),
      circuitName: "Continental European youth circuit",
      summary: `${name}. A European national-entry youth tournament for players under 18, using ${pairs ? "country-paired doubles" : "singles"} knockout. Girls divisions are restricted to eligible women players.`,
    };
    out.push(d);
  };

  addDivision("continental-youth-cup-singles", "Continental Youth Cup — Singles", false, false);
  addDivision("continental-youth-cup-pairs", "Continental Youth Cup — Pairs", false, true);
  addDivision("continental-girls-youth-cup-singles", "Continental Girls Youth Cup — Singles", true, false);
  addDivision("continental-girls-youth-cup-pairs", "Continental Girls Youth Cup — Pairs", true, true);
  return Object.freeze(out);
}
