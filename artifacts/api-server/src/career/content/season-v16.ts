import type { EventDefinition } from "../calendar/catalogue.ts";
import { MIDWEEK_KEYS } from "./season-v15.ts";

/**
 * Event database v16: the midweek pub circuit in every home area, not just the UK and Ireland. The Monday League and the
 * Wednesday Flier keep their v15 rules (local, small stakes, a pot from the entries); only the countries widen. Careers on
 * older editions get the new areas added from the next week of their current season (see ensureMidweekCircuit).
 */
export const MIDWEEK_WORLD_EVENT_DATABASE = 16;

export function buildCatalogueV16(v15: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v15.map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 16 };
    if ((MIDWEEK_KEYS as readonly string[]).includes(d.key) && d.schedule.kind === "LOCAL_ROTATION") {
      const { countries: _uk, ...schedule } = d.schedule;
      d.schedule = schedule;
    }
    return d;
  }));
}
