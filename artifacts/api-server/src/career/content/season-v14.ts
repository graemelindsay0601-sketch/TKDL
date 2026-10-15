import type { EventDefinition } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { knockout501 } from "../calendar/formats.ts";
import { identity } from "./events.ts";

/**
 * Event database v14 (new saves only; v1–v13 definitions and established instances are untouched).
 *
 * A way back from an empty bank. Before v14 a player at £0 could enter only the odd free Sunday League
 * Sprint or Sudden Death Night near home (1–5 a season, with gaps of up to 36 weeks), so a Career that ran
 * out of money could stall for most of a season. v14 adds the Free Entry Night: a club night in every home
 * area, every four weeks all year, free to enter, local (no travel cost), open to every player from that area
 * (Tour Card holders too) and paying a small cash pot. No ranking points, so the amateur rankings are unchanged.
 */
export const FREE_ENTRY_EVERY_WEEKS = 4;

export function buildCatalogueV14(v13: readonly EventDefinition[]): readonly EventDefinition[] {
  const out: EventDefinition[] = v13.map(original => ({ ...structuredClone(original), eventDatabaseVersion: 14 }));
  const sprint = out.find(d => d.key === "sunday-league-sprint")!;
  const free: EventDefinition = {
    ...structuredClone(sprint), key: "free-entry-night", name: "{city} Free Entry Night", family: "free-entry-night",
    classification: "INVITATIONAL_EXHIBITION", rankingCategory: null, legacyConcept: null, eventDatabaseVersion: 14,
    // Same club-night art as the Sunday League Sprint.
    presentation: { ...sprint.presentation, calendarPriority: 8 },
    format: knockout501([3, 3, 5, 5], "local"), fieldSize: 16, minimumEntrants: 4, npcFill: [0.25, 0.5],
    // You enter in your own area only (a local night; the calendar stays uncluttered). Computer players from
    // the wider zone top the field up behind the locals, so thinly populated areas still get their night.
    eligibility: R.any(R.locality("{locality}"), R.all(R.computerPlayer(), R.zone("{zone}" as Parameters<typeof R.zone>[0]))),
    schedule: { kind: "LOCAL_ROTATION", venueKind: "CLUB", perWeight: 0, everyWeeks: FREE_ENTRY_EVERY_WEEKS, day: 2, weekRange: [1, 52] },
  };
  free.content = { ...identity(free, "grassroots"), circuitName: "Free entry nights",
    summary: "A free-to-enter club night near home, every four weeks all year: short 501 matches for a small cash pot (£40 to the winner). Open to every player from the area, Tour Card or not, so there is always a way to earn when money is tight. No ranking points." };
  out.push(free);
  return Object.freeze(out);
}
