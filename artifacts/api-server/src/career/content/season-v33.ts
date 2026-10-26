import type { EventDefinition } from "../calendar/catalogue.ts";

/**
 * Ranking-system edition: preserves every v32 event snapshot while allowing
 * the sporting rules to add separately versioned WDF ranking tables.
 */
export function buildCatalogueV33(v32: readonly EventDefinition[]): readonly EventDefinition[] {
  const venueCorrections: Record<string, string> = {
    "wdf-world-championship": "lakeside-country-club",
    "wdf-world-masters": "desert-pavilion-las-vegas",
    "women-world-championship": "lakeside-country-club",
    "women-masters": "desert-pavilion-las-vegas",
    "wdf-manx-open": "isle-of-man-oche",
    "wdf-ulster-open": "lagan-exchange",
    "wdf-baltic-open": "baltic-exchange",
    "wdf-danube-masters": "danube-halle-vienna",
    "wdf-bohemian-open": "vltava-arena-prague",
    "wdf-mediterranean-masters": "ramblas-arena-barcelona",
  };
  return Object.freeze(v32.map(original => {
    const event = structuredClone(original);
    const venue = venueCorrections[event.key];
    if (venue && event.schedule.kind === "FIXED") {
      event.schedule = { ...event.schedule, slots: event.schedule.slots.map(slot => ({ ...slot, venue })) };
    }
    return { ...event, eventDatabaseVersion: 33 };
  }));
}
