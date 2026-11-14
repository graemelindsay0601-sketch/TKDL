import type { EventDefinition } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { knockout501 } from "../calendar/formats.ts";
import { identity } from "./events.ts";

/**
 * Event database v38: routes back for players without a Tour Card.
 *
 * Real darts has open events "for the everyday player" that feed Q-School (Red Dragon's Champion of Champions pays its
 * winner's way to Q-School), and losing a card is a step back, not the end. v38 adds the Grassroots Champions Cup: a free,
 * end-of-season event for players without a card who have won a local, club or county event this season. The two
 * finalists go straight to next season's Q-School Final Stage; the last eight carry a Challenger Tour pass into next
 * season. Every earlier edition is unchanged; older Careers get the Cup from the next week of their current season
 * (the catalogue upgrade, see ensureCurrentEventCatalogue).
 */
export const ROUTES_BACK_EVENT_DATABASE = 38;
export const CHAMPIONS_CUP_KEY = "grassroots-champions-cup";
export const CHAMPIONS_CUP_WEEK = 46;
/** Finishing positions 1–2 (the finalists) skip next season's Q-School First Stage. */
export const CHAMPIONS_CUP_FINAL_STAGE_PLACES = 2;
/** Finishing positions 1–8 (the last eight) carry a Challenger Tour pass into next season. */
export const CHAMPIONS_CUP_CHALLENGER_PLACES = 8;
/** Every key added to existing Careers by the v38 catalogue upgrade. */
export const V38_ADDED_EVENT_KEYS = [CHAMPIONS_CUP_KEY] as const;
/** Local, club and county events whose winners are champions for the Cup. */
const CHAMPION_CIRCUITS = new Set(["GRASSROOTS", "COUNTY"]);

export function championsCupFeederKeys(catalogue: readonly EventDefinition[]): string[] {
  return catalogue.filter(d => CHAMPION_CIRCUITS.has(d.circuit) && d.key !== CHAMPIONS_CUP_KEY).map(d => d.key).sort();
}

export function buildCatalogueV38(v37: readonly EventDefinition[]): readonly EventDefinition[] {
  const out: EventDefinition[] = v37.map(original => ({ ...structuredClone(original), eventDatabaseVersion: ROUTES_BACK_EVENT_DATABASE }));
  const base = out.find(d => d.key === "regional-open")!;
  const feeders = championsCupFeederKeys(out);
  const cup: EventDefinition = {
    ...structuredClone(base), key: CHAMPIONS_CUP_KEY, name: "Grassroots Champions Cup", family: CHAMPIONS_CUP_KEY, circuit: "NATIONAL_AMATEUR",
    classification: "INVITATIONAL_EXHIBITION", rankingCategory: null,
    presentation: { ...base.presentation, tier: "STANDARD", featured: true, calendarPriority: 48 },
    format: knockout501([7, 7, 7, 9, 9, 11], "stage"), fieldSize: 64, minimumEntrants: 8, npcFill: [0.6, 1],
    geography: { kind: "INTERNATIONAL", hostBonus: 1.1 },
    eligibility: R.all(R.nonTourCard(), R.any(...feeders.map(key => R.result(key, 1, "SAME")))),
    fieldPolicy: "SELECTION", entitlementIntake: [], invitationPolicy: null, seedingPolicy: { list: null, seeds: 0 },
    profiles: { entryFee: "fee:invitational", travel: base.profiles.travel, accommodation: base.profiles.accommodation, prize: "prize:invitational" },
    registrationLeadWeeks: 6, series: null, qSchool: null, exclusiveGroup: null,
    qualificationOutputs: [
      ...(["UK_IRELAND", "EUROPE"] as const).map(pathway => ({ maxPosition: CHAMPIONS_CUP_FINAL_STAGE_PLACES, entitlementType: "STAGE_ENTRY" as const,
        targetKey: `q-school-final:${pathway}`, targetSeason: "NEXT" as const, consumption: "SEASON_PASS" as const })),
      { maxPosition: CHAMPIONS_CUP_CHALLENGER_PLACES, entitlementType: "SERIES_ACCESS", targetKey: "challenger-tour", targetSeason: "NEXT", consumption: "SEASON_PASS" },
    ],
    legacyConcept: "Champion of Champions (open grassroots event feeding Q-School)",
    schedule: { kind: "FIXED", slots: [{ week: CHAMPIONS_CUP_WEEK, day: 6, venue: "midlands-oche" }] },
  };
  cup.content = { ...identity(cup, "open", "NATIONAL"), circuitName: "Grassroots Champions Cup", fieldDescription: "Local, club and county champions",
    summary: "Free entry for players without a Tour Card who have won a local, club or county event this season. Reach the final and you go straight to next season's Q-School Final Stage; reach the last eight and you can play the Challenger Tour next season." };
  out.push(cup);
  return Object.freeze(out);
}
