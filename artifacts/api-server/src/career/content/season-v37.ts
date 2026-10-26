import type { EventDefinition } from "../calendar/catalogue.ts";

export const V37_U23_WDF_FIXTURE_KEYS = [
  "u23-world-ranking-open",
  "u23-girls-world-ranking-open",
] as const;

const OFFICIAL_WDF_REFERENCE =
  "Based on the official 2027 WDF Las Vegas Open U23 event (14–17 January, Category B/Bronze); annual Career dates are an in-game approximation.";

/** v37 replaces generic U23 fixtures with source-verified WDF event identities. */
export function buildCatalogueV37(v36: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v36.map(definition => {
    if (!V37_U23_WDF_FIXTURE_KEYS.includes(definition.key as typeof V37_U23_WDF_FIXTURE_KEYS[number])) {
      return { ...structuredClone(definition), eventDatabaseVersion: 37 };
    }

    const girls = definition.key === "u23-girls-world-ranking-open";
    const name = girls ? "Las Vegas Open U23 Girls" : "Las Vegas Open U23 Youth";
    const event = {
      ...structuredClone(definition),
      name,
      eventDatabaseVersion: 37,
      legacyConcept: OFFICIAL_WDF_REFERENCE,
      schedule: {
        kind: "FIXED" as const,
        slots: [{
          week: 2,
          day: 7,
          endWeek: 3,
          endDay: 3,
          venue: "desert-pavilion-las-vegas",
          label: "Las Vegas",
        }],
      },
    };
    if (event.content) {
      event.content = {
        ...event.content,
        summary: `${name}. Career fixture based on the 2027 WDF event; the WDF lists it as Category B (Bronze), 14–17 January 2027.`,
      };
    }
    return event;
  }));
}
