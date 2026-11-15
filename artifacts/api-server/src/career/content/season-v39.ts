import type { EventDefinition } from "../calendar/catalogue.ts";
import { knockout501 } from "../calendar/formats.ts";
import { identity } from "./events.ts";

/**
 * Event database v39: the early-week local nights. A real club player's week has darts most nights: a Monday knockout,
 * a Tuesday shootout, a Wednesday open, a Thursday club night. Earlier editions had almost nothing local from Monday to
 * Thursday (no executable local event on a Thursday all season), so v39 adds four local amateur knockouts on those
 * nights, at every club, built like the Friday Night 501. Every earlier edition is unchanged; older Careers get them
 * from the next week of their current season (the catalogue upgrade, see ensureCurrentEventCatalogue).
 */
export const WEEKNIGHTS_EVENT_DATABASE = 39;
const NIGHTS = [
  { key: "monday-night-knockout", name: "{city} Monday Night Knockout", day: 1, perWeight: 3.5, weekRange: [2, 48] as [number, number], legs: [3, 3, 5, 5],
    summary: "A Monday night knockout at a local club for amateurs without a Tour Card: short 501 matches, small prizes and local ranking points." },
  { key: "tuesday-shootout", name: "{city} Tuesday Shootout", day: 2, perWeight: 3.5, weekRange: [2, 48] as [number, number], legs: [3, 3, 3, 5],
    summary: "A quick-fire Tuesday shootout at a local club: best of three until the final, for amateurs without a Tour Card." },
  { key: "wednesday-open", name: "{city} Wednesday Open", day: 3, perWeight: 2, weekRange: [3, 47] as [number, number], legs: [5, 5, 5, 7],
    summary: "A midweek open at a local club for amateurs without a Tour Card (team nights come first if you're picked)." },
  { key: "thursday-club-open", name: "{city} Thursday Club Open", day: 4, perWeight: 4, weekRange: [2, 48] as [number, number], legs: [3, 5, 5, 7],
    summary: "The Thursday club open: a local amateur knockout for small prizes and local ranking points." },
] as const;
export const V39_ADDED_EVENT_KEYS = NIGHTS.map(n => n.key);

export function buildCatalogueV39(v38: readonly EventDefinition[]): readonly EventDefinition[] {
  const out: EventDefinition[] = v38.map(original => ({ ...structuredClone(original), eventDatabaseVersion: WEEKNIGHTS_EVENT_DATABASE }));
  const friday = out.find(d => d.key === "friday-night-501")!;
  for (const n of NIGHTS) {
    const d: EventDefinition = { ...structuredClone(friday), key: n.key, name: n.name, family: n.key, legacyConcept: null,
      presentation: { ...friday.presentation, calendarPriority: 9 }, format: knockout501([...n.legs], "local"), fieldSize: 16, minimumEntrants: 4,
      schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight: n.perWeight, day: n.day, weekRange: n.weekRange } };
    d.content = { ...identity(d, "grassroots"), summary: n.summary };
    out.push(d);
  }
  return Object.freeze(out);
}
