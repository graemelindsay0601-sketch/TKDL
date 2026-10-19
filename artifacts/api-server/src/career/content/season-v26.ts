import type { EventDefinition } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";

/**
 * v26 keeps weekly club league nights local to the host country. The old
 * catalogue allowed a player to fly between continents for a grassroots purse.
 */
export function buildCatalogueV26(v25: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v25.map(original => {
    const event: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 26 };
    if (event.key === "club-league-night") {
      event.eligibility = R.all(event.eligibility, R.country("{country}"));
      event.content = { ...event.content!, summary: "A weekly local club league for amateurs without a Tour Card: short 501 matches for modest prizes and amateur ranking points." };
    }
    return event;
  }));
}
