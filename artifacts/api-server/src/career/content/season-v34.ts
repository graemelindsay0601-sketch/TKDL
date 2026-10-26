import type { EventDefinition } from "../calendar/catalogue.ts";

/**
 * Correct the girls' world championship classification so it enters the
 * existing Youth Order of Merit, not the adult Women's Order of Merit.
 * The event's under-18 and women eligibility rules remain unchanged.
 */
export function buildCatalogueV34(v33: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v33.map(original => {
    const event = structuredClone(original);
    return {
      ...event,
      eventDatabaseVersion: 34,
      ...(event.key === "wdf-world-girls-championship" ? { rankingCategory: "YOUTH" } : {}),
    };
  }));
}
