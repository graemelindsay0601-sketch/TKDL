import type { EventDefinition } from "../calendar/catalogue.ts";

/** v27 keeps v26's country-locked club nights and refreshes them in existing saves. */
export const V26_CALENDAR_REFRESH_KEYS = ["club-league-night"] as const;

export function buildCatalogueV27(v26: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v26.map(original => ({ ...structuredClone(original), eventDatabaseVersion: 27 })));
}
