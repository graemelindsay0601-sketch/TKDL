import type { EventDefinition, ScheduleSlot } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { identity } from "./events.ts";

/**
 * Event database v6 (new saves only; v1–v5 definitions and every established instance are untouched).
 *
 * Season shape modelled on a real professional darts year (week 1 = early January):
 *  - Q-School weeks 2–4, Masters-style invitational week 5, Open week 10, Matchplay weeks 29–30,
 *    Grand Prix-style Double Crown in October, Continental Finals late October, Grand Championship
 *    mid-November, Tour Finals late November, Palace World Championship from mid-December.
 *  - Pro Tour double-headers (Tue/Wed) every one to three weeks from February to November and
 *    Continental Series weekends between them, so a professional is rarely without a ranking event.
 *  - Local New Year and Festive opens in the weeks that were empty. Like real Christmas pub opens they
 *    are open to everyone in the country, so professionals outside the World Championship can play.
 *
 * Progression fixes (audit career-audit/progression-and-pacing):
 *  - PROG-01: the Open International Championship and Vault Championship select from the NPCs that
 *    meet their own ranking rules, so both finals can reach their minimum field.
 *  - PROG-06: the Vault Qualifier no longer issues the redundant Vault Tour pass.
 *  - PROG-11: amateur opens are for players without a Tour Card.
 *  - PROG-02: season-1 Challenger access is applied by season generation (calendar/generation.ts).
 */
export const PRO_TOUR_WEEKS_V6 = [5, 6, 8, 9, 12, 14, 16, 18, 20, 22, 24, 26, 28, 31, 32, 34, 35, 36, 38, 39, 41, 42, 44] as const;
export const CONTINENTAL_SERIES_WEEKS_V6 = [7, 11, 13, 15, 17, 19, 21, 23, 25, 27, 33, 37] as const;
const CHALLENGER_VENUES_V6 = ["midlands-oche", "dockyard-arena-liverpool", "the-foundry-manchester", "northern-forum-newcastle", "rhein-hall-dusseldorf"];

const MOVED_MAJORS: Record<string, ScheduleSlot[]> = {
  "double-crown": [{ week: 40, day: 1, endDay: 7, venue: "harbour-rooms-dublin" }],
  "european-championship": [{ week: 43, day: 4, endDay: 7, venue: "ruhr-forum-dortmund" }],
  "grand-slam-of-champions": [{ week: 45, day: 6, endWeek: 46, endDay: 7, venue: "dockyard-arena-liverpool" }],
  "pro-circuit-finals": [{ week: 48, day: 5, endDay: 7, venue: "the-foundry-manchester" }],
};
/** Countries whose local NPC pools can fill extra same-day club events (as the county circuits use). */
const LOCAL_POOL_COUNTRIES = ["GBR", "IRL", "NLD", "DEU", "BEL"] as const;
const AMATEUR_OPENS = new Set(["national-open", "international-open", "premier-open", "northern-open", "asia-pacific-open", "north-american-open", "australasian-open"]);

const fixed = (d: EventDefinition) => { if (d.schedule.kind !== "FIXED") throw new Error(`${d.key} is not a fixed-slot event`); return d.schedule.slots; };
const venuesOf = (slots: ScheduleSlot[]) => [...new Set(slots.map(s => s.venue))];

export function buildCatalogueV6(v5: readonly EventDefinition[]): readonly EventDefinition[] {
  const out = v5.map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 6 };
    if (d.key === "pro-circuit-championship") {
      const venues = venuesOf(fixed(d));
      d.schedule = { kind: "FIXED", slots: PRO_TOUR_WEEKS_V6.flatMap((week, i) => [2, 3].map(day => ({ week, day, venue: venues[i % venues.length] }))) };
    }
    if (d.key === "european-dart-series") {
      const slots = fixed(d);
      if (slots.length !== CONTINENTAL_SERIES_WEEKS_V6.length) throw new Error("Continental Series weeks must match its cities");
      d.schedule = { kind: "FIXED", slots: slots.map((s, i) => ({ ...s, week: CONTINENTAL_SERIES_WEEKS_V6[i] })) };
    }
    if (MOVED_MAJORS[d.key]) d.schedule = { kind: "FIXED", slots: MOVED_MAJORS[d.key] };
    if (d.key === "world-championship-qualifier") d.schedule = { kind: "FIXED", slots: fixed(d).map((s, i) => ({ ...s, week: 47, day: 2 + i })) };
    if (d.key === "challenger-event") d.schedule = { kind: "FIXED", slots: fixed(d).map((s, i) => ({ ...s, venue: CHALLENGER_VENUES_V6[Math.floor(i / 2) % CHALLENGER_VENUES_V6.length] })) };
    if (d.key === "open-finals" || d.key === "vault-championship") d.npcFill = [1, 1];
    if (d.key === "vault-qualifier") d.qualificationOutputs = d.qualificationOutputs.filter(o => o.targetKey !== "vault-tour");
    if (AMATEUR_OPENS.has(d.key)) d.eligibility = R.all(d.eligibility, R.nonTourCard());
    if (d.key === "sunday-league-sprint" && d.schedule.kind === "LOCAL_ROTATION") d.schedule = { ...d.schedule, weekRange: [1, 52] };
    return d;
  });
  const fridayNight = out.find(d => d.key === "friday-night-501")!;
  const local = (key: string, name: string, weekRange: [number, number], perWeight: number): EventDefinition => {
    const d: EventDefinition = { ...structuredClone(fridayNight), key, name, family: key, legacyConcept: null, eligibility: R.country("{country}"),
      schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight, day: 6, weekRange, countries: [...LOCAL_POOL_COUNTRIES] } };
    d.content = identity(d, "grassroots");
    return d;
  };
  out.push(local("new-year-open", "{city} New Year Open", [1, 1], 0.5), local("festive-open", "{city} Festive Open", [49, 52], 1));
  return Object.freeze(out);
}
