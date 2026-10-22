import type { EventDefinition } from "../calendar/catalogue.ts";

/** Refresh youth divisions with a real NPC field; previously their zero-fill selection policy cancelled them. */
export const V28_CALENDAR_REFRESH_KEYS = [
  "continental-youth-cup-singles",
  "continental-youth-cup-pairs",
  "continental-girls-youth-cup-singles",
  "continental-girls-youth-cup-pairs",
] as const;

const YOUTH_SINGLE_KEYS = new Set([
  "continental-youth-cup-singles",
  "continental-girls-youth-cup-singles",
]);

export function buildCatalogueV28(v27: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v27.map(original => {
    const definition = { ...structuredClone(original), eventDatabaseVersion: 28 };
    if (YOUTH_SINGLE_KEYS.has(definition.key)) definition.npcFill = [0.5, 0.75];
    return definition;
  }));
}
