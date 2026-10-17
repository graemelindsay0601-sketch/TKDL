import type { EventDefinition } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { knockout501 } from "../calendar/formats.ts";
import { identity } from "./events.ts";

/**
 * Event database v15: the midweek pub circuit in the UK and Ireland. Real darts players grind small money on weeknights
 * and spend it on the weekend opens; until v15 most home areas had little or nothing on a Monday or a Wednesday.
 *
 * - Monday League: a club league night at the local social club every other Monday, £2 to play, for amateurs from
 *   the area (computer players from the wider region top up thin nights).
 * - Wednesday Flier: a quick-fire best-of-three night every other Wednesday, £3 to play, open to anyone from the area.
 *
 * Both are local (no travel), pay small cash prizes and carry no ranking points, so the rankings are unchanged; finishes
 * still count for your home club. Unlike other editions these nights are also added to Careers on older versions, from
 * the next enterable week of their current season (see ensureMidweekCircuit); nothing already played changes.
 */
export const MIDWEEK_EVERY_WEEKS = 2;
export const MIDWEEK_COUNTRIES = ["GBR", "IRL"];
export const MIDWEEK_KEYS = ["monday-league-night", "wednesday-flier"] as const;
export const MIDWEEK_FROM_EVENT_DATABASE = 15;
/** A good midweek turnout: 70–100% of the 16 places (the pot grows with it). Applies to every midweek night, old saves included. */
export const MIDWEEK_FIELD_FILL: [number, number] = [0.7, 1];

export function buildCatalogueV15(v14: readonly EventDefinition[]): readonly EventDefinition[] {
  const out: EventDefinition[] = v14.map(original => ({ ...structuredClone(original), eventDatabaseVersion: 15 }));
  const free = out.find(d => d.key === "free-entry-night")!;
  const night = (key: string, name: string, day: number, format: EventDefinition["format"], eligibility: EventDefinition["eligibility"],
    priority: number, circuitName: string, summary: string): EventDefinition => {
    const d: EventDefinition = { ...structuredClone(free), key, name, family: key, eventDatabaseVersion: 15, format, eligibility,
      presentation: { ...free.presentation, calendarPriority: priority },
      schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight: 0, everyWeeks: MIDWEEK_EVERY_WEEKS, day, weekRange: [1, 52], countries: MIDWEEK_COUNTRIES } };
    d.content = { ...identity(d, "grassroots"), circuitName, summary };
    return d;
  };
  out.push(night("monday-league-night", "{city} Monday League", 1, knockout501([3, 3, 5, 5], "local"),
    R.any(R.all(R.nonTourCard(), R.locality("{locality}")), R.all(R.computerPlayer(), R.nonTourCard(), R.zone("{zone}" as Parameters<typeof R.zone>[0]))), 7,
    "Club league", "The club league night at your local social club, every other Monday: £2 to play, short 501 matches for a small pot (£20 to the winner). For amateurs from the area. No ranking points, but every win counts for your club."));
  out.push(night("wednesday-flier", "{city} Wednesday Flier", 3, knockout501([3, 3, 3, 3], "local"),
    R.any(R.locality("{locality}"), R.all(R.computerPlayer(), R.zone("{zone}" as Parameters<typeof R.zone>[0]))), 6,
    "Midweek fliers", "A quick-fire flier every other Wednesday: £3 to play, every match best of three legs, £30 to the winner. Open to anyone from the area. No ranking points."));
  return Object.freeze(out);
}
