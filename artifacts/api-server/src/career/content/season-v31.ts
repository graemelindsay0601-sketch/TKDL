import type { EventDefinition } from "../calendar/catalogue.ts";

/**
 * WDF ranking criteria edition 50 (17 Aug 2026), rule 2.02: only singles
 * tournaments or singles events within a tournament are ranked. These three
 * national team cups are competitive team events, not singles ranking events.
 */
export const V31_CALENDAR_REFRESH_KEYS = [
  "wdf-world-cup",
  "wdf-europe-cup",
  "wdf-asia-pacific-cup",
] as const;

export function buildCatalogueV31(v30: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v30.map(original => {
    const definition = { ...structuredClone(original), eventDatabaseVersion: 31 };
    if ((V31_CALENDAR_REFRESH_KEYS as readonly string[]).includes(definition.key)) {
      definition.classification = "TEAM";
      definition.rankingCategory = null;
      if (definition.content) {
        definition.content = {
          ...definition.content,
          summary: `${definition.content.summary} This is a team competition and does not count toward WDF singles rankings.`,
        };
      }
    }
    return definition;
  }));
}
