import type { EventDefinition } from "../calendar/catalogue.ts";

/** Prioritise the annual World Cup field before overlapping national fixtures. */
export const V30_CALENDAR_REFRESH_KEYS = ["world-cup-of-darts"] as const;

export function buildCatalogueV30(v29: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v29.map(original => {
    const definition = { ...structuredClone(original), eventDatabaseVersion: 30 };
    if (definition.key === "world-cup-of-darts") {
      definition.presentation = { ...definition.presentation, calendarPriority: 96 };
    }
    return definition;
  }));
}
