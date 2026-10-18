import type { EventDefinition } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { knockout501 } from "../calendar/formats.ts";
import { identity } from "./events.ts";

/**
 * Event database v17: every route stays open.
 *
 * - Q-School runs in season 1 too (weeks 2–4, normal fees), so a new player with the money can try it straight away
 *   (v5–v16 skipped the first Q-School).
 * - Challenger Tour Qualifiers: two open days a season (weeks 14 and 27). The last 16 earn this season's Challenger
 *   Tour pass, so missing Q-School no longer shuts the Challenger Tour for a whole year. Season 1 has none (the
 *   season-1 Challenger Tour is open to everyone). Unlike other editions the qualifiers are also added to Careers on
 *   older versions, from the next week of their current season (see ensurePathwayEvents).
 * - Pro Circuit associates: the best Q-School players who miss a card (Order of Merit, after the cards) can enter the
 *   Pro Circuit Championships that season, as Q-School's next best fill real Pro Tour fields (older saves: their
 *   Pro Circuit events still ahead take the same rule, see ensurePathwayEvents).
 */
export const PATHWAYS_EVENT_DATABASE = 17;
export const CHALLENGER_QUALIFIER_KEY = "challenger-qualifier";
export const CHALLENGER_QUALIFIER_WEEKS = [14, 27] as const;
/** Finishing positions 1–16 (the last 16) earn the Challenger Tour pass. */
export const CHALLENGER_QUALIFIER_PLACES = 16;

/** Pro Circuit Championships: a Tour Card, or a Pro Circuit associate place from this season's Q-School. */
export const PRO_CIRCUIT_RULE = R.any(R.tourCard(), R.qualified("pro-circuit-associate"));

export function buildCatalogueV17(v16: readonly EventDefinition[]): readonly EventDefinition[] {
  const out: EventDefinition[] = v16.map(original => ({ ...structuredClone(original), eventDatabaseVersion: PATHWAYS_EVENT_DATABASE }));
  const pro = out.find(d => d.key === "pro-circuit-championship")!;
  pro.eligibility = PRO_CIRCUIT_RULE;
  const challenger = out.find(d => d.key === "challenger-event")!;
  const venues = ["midlands-oche", "rhein-hall-dusseldorf"];
  const d: EventDefinition = {
    ...structuredClone(challenger), key: CHALLENGER_QUALIFIER_KEY, name: "Challenger Tour Qualifier {n}", family: "challenger-series", classification: "QUALIFIER",
    rankingCategory: null, presentation: { ...challenger.presentation, calendarPriority: 49 }, format: knockout501([7, 7, 7, 9, 9, 9, 11], "qualifier"),
    fieldSize: 128, minimumEntrants: 8, npcFill: [0.5, 0.85], eligibility: R.nonTourCard(), entitlementIntake: [], legacyConcept: "Challenge Tour qualifier",
    qualificationOutputs: [{ maxPosition: CHALLENGER_QUALIFIER_PLACES, entitlementType: "SERIES_ACCESS", targetKey: "challenger-tour", targetSeason: "SAME", consumption: "SEASON_PASS" }],
    schedule: { kind: "FIXED", slots: CHALLENGER_QUALIFIER_WEEKS.map((week, i) => ({ week, day: 6, venue: venues[i % venues.length] })) },
  };
  d.content = { ...identity(d, "challenger"), circuitName: "Challenger Tour",
    summary: "An open qualifier for anyone without a Tour Card. Reach the last 16 and you can play every Challenger Tour event for the rest of the season, even if you missed Q-School." };
  out.push(d);
  return Object.freeze(out);
}
