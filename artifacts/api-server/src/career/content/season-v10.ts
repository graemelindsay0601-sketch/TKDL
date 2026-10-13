import type { EventDefinition } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";

/**
 * Event database v10 (new saves only; v1–v9 definitions and established instances are untouched).
 *
 * Fewer cancelled small events. A season-1 simulation of v9 cancelled ~110 club and county nights for
 * lack of entrants, almost all where the local player pool is thin:
 *  - weekly club/league nights drew 6–12 players each from the same small pool (outside Europe there are
 *    only ~40 amateur NPCs), so the first nights of a week took everyone and the rest were cancelled;
 *    they now take 4–8, as a real league night does, and the pool covers every night;
 *  - Friday Night 501 and the Sunday League Sprint were country-only, so in countries with almost no
 *    resident players (France, New Zealand) they could never run; locals still fill first, then the
 *    surrounding zone tops up, as the v7 events already do;
 *  - the Canadian regional series was locked to one small national pool with a minimum of eight; it now
 *    draws on the zone with locals first, and the small-pool series run with six;
 *  - there are fewer club league nights (about one a week per region instead of nearly five a week across
 *    a pool of ~40 players outside Europe);
 *  - Christmas and New Year opens and county events share their local pool rather than each trying to take
 *    most of it, and junior nights (which rely on the small under-18 pool) are less frequent.
 */
const AMATEUR_ONLY = R.all(R.amateur(), R.nonTourCard());
const SHARED_FILL: Record<string, [number, number]> = {
  "club-league-night": [0.25, 0.5], "midweek-league-night": [0.25, 0.5],
  "county-501-open": [0.3, 0.7], "county-championship": [0.4, 0.8], "junior-development-night": [0.4, 0.8],
  "friday-night-501": [0.35, 0.7], "sunday-league-sprint": [0.3, 0.6], "festive-open": [0.35, 0.7], "new-year-open": [0.35, 0.7],
};
const ZONE_TOP_UP = new Set(["friday-night-501", "sunday-league-sprint"]);
const SMALL_POOL_SERIES = ["can-regional-series"];
const SMALL_POOL_MINIMUM = new Set([...SMALL_POOL_SERIES, "fra-regional-series", "aus-regional-series", "nzl-regional-series", "swe-regional-series", "bel-regional-series"]);

export function buildCatalogueV10(v9: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v9.map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 10 };
    if (SHARED_FILL[d.key]) d.npcFill = SHARED_FILL[d.key];
    if (d.key === "club-league-night" && d.schedule.kind === "LOCAL_ROTATION") d.schedule = { ...d.schedule, perWeight: 24 };
    // Junior nights depend on the small under-18 pool: fewer of them, so each one can fill.
    if (d.key === "junior-development-night" && d.schedule.kind === "LOCAL_ROTATION") d.schedule = { ...d.schedule, perWeight: 0.35 };
    if (ZONE_TOP_UP.has(d.key)) d.eligibility = R.all(R.zone("{zone}" as Parameters<typeof R.zone>[0]), AMATEUR_ONLY);
    if (SMALL_POOL_SERIES.includes(d.key)) {
      d.eligibility = R.all(AMATEUR_ONLY, R.zone("REST_OF_WORLD"));
      d.presentation = { ...d.presentation, calendarPriority: 30 };
      if (d.content?.summary) d.content = { ...d.content, summary: d.content.summary.replace(/for amateurs based in [^.]*\./, "open to amateurs from across the region, with local players filling the field first.") };
    }
    if (SMALL_POOL_MINIMUM.has(d.key)) d.minimumEntrants = 6;
    return d;
  }));
}
