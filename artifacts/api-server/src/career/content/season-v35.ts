import type { EventDefinition } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { identity } from "./events.ts";

/**
 * WDF Youth and Under-23 ranking edition. Existing event identities remain
 * intact; separate categories prevent the Career Youth merit from being used
 * as a proxy for WDF's age-division tables.
 */
export const V35_WDF_RANKED_EVENT_KEYS = [
  "youth-world-championship",
  "wdf-world-girls-championship",
  "youth-masters",
  "youth-world-ranking-open",
  "girls-world-ranking-open",
  "u23-world-ranking-open",
  "u23-girls-world-ranking-open",
] as const;

const U23_OPEN = "WDF_U23_OPEN";
const U23_GIRLS = "WDF_U23_GIRLS";
const U18_OPEN = "WDF_YOUTH_OPEN";
const U18_GIRLS = "WDF_YOUTH_GIRLS";

export function buildCatalogueV35(v34: readonly EventDefinition[]): readonly EventDefinition[] {
  const out = v34.map(original => ({ ...structuredClone(original), eventDatabaseVersion: 35 }));
  const find = (key: string) => {
    const definition = out.find(event => event.key === key);
    if (!definition) throw new Error(`Missing v35 event template: ${key}`);
    return definition;
  };

  for (const [key, category] of [
    ["youth-world-championship", U18_OPEN],
    ["youth-masters", U18_OPEN],
    ["youth-world-ranking-open", U18_OPEN],
    ["wdf-world-girls-championship", U18_GIRLS],
    ["girls-world-ranking-open", U18_GIRLS],
  ] as const) {
    find(key).rankingCategory = category;
  }

  const addU23 = (key: string, name: string, category: string, girls: boolean) => {
    const template = find(girls ? "girls-world-ranking-open" : "youth-world-ranking-open");
    const event: EventDefinition = {
      ...structuredClone(template),
      key,
      name,
      family: "wdf-u23-world-ranking-open",
      eventDatabaseVersion: 35,
      rankingCategory: category,
      eligibility: R.all(R.age({ minAge: 18, maxAgeExclusive: 23 }), ...(girls ? [R.women()] : []), R.nonTourCard()),
      legacyConcept: "Career-authored WDF Under-23 ranking fixture; not an official named event",
      presentation: {
        ...template.presentation,
        brandingFamily: "wdf-u23-world-ranking-open",
        heroAssetKey: "hero:wdf-u23-world-ranking-open",
        badgeAssetKey: "badge:wdf-u23-world-ranking-open",
      },
    };
    if (event.content) {
      event.content = {
        ...identity(event, "wdf-u23-world-ranking-open", "INTERNATIONAL_OPEN"),
        summary: `${name}. A Career-authored Under-23 ranking fixture for players aged 18–22; it is not an official WDF calendar event.`,
      };
    }
    out.push(event);
  };

  addU23("u23-world-ranking-open", "Under-23 World Ranking Open", U23_OPEN, false);
  addU23("u23-girls-world-ranking-open", "Under-23 Girls Ranking Open", U23_GIRLS, true);
  return Object.freeze(out);
}
