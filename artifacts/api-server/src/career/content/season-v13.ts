import type { EventDefinition } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";
import { knockout501 } from "../calendar/formats.ts";
import { identity } from "./events.ts";

/**
 * Event database v13 (new saves only; v1–v12 definitions and established instances are untouched).
 *
 * Pairs darts. Both players of a team share one score and take alternate visits (A1, B1, A2, B2 …).
 *  - World Cup of Darts: each darts nation (the UK competes as England, Scotland, Wales and Northern Ireland)
 *    is represented by its two best players when the field locks — World Ranking first, then the Open World
 *    and Amateur rankings for players outside it; an unavailable player is replaced by the next best. Up to
 *    16 nations, the top four seeded on their captain's World Ranking, doubles knockout over four days in
 *    June. Prize money per player, no ranking points. A human inside their nation's top two is called up
 *    and captains the pair.
 *  - Pub Doubles (club pairs nights in the UK and Ireland) now runs: entrants are paired with a compatriot
 *    from the same area, and the human captains their pair.
 * Field sizes count players (the World Cup's 32 is 16 pairs).
 */
export function buildCatalogueV13(v12: readonly EventDefinition[]): readonly EventDefinition[] {
  const out: EventDefinition[] = v12.map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 13 };
    if (d.key === "pub-doubles") {
      d.format = { ...d.format, sideSize: 2, pairing: "LOCAL" };
      d.minimumEntrants = 8;
      if (d.content) d.content = { ...d.content, summary: "A pairs night at a local club: you and a partner from your area share one score and take alternate visits. Short 501 matches for small prizes; no ranking points." };
    }
    return d;
  });
  const from = out.find(d => d.key === "world-dart-series-finals")!;
  const worldCup: EventDefinition = {
    ...structuredClone(from), key: "world-cup-of-darts", name: "World Cup of Darts", family: "world-cup-of-darts", circuit: "INVITATIONAL",
    classification: "INVITATIONAL_EXHIBITION", rankingCategory: null, legacyConcept: null, eventDatabaseVersion: 13,
    presentation: { ...from.presentation, tier: "TELEVISED", featured: true, calendarPriority: 80, brandingFamily: "world-cup-of-darts", heroAssetKey: "hero:world-cup-of-darts", badgeAssetKey: "badge:world-cup-of-darts" },
    format: { ...knockout501([7, 9, 11, 11, 13], "stage", 4), sideSize: 2, pairing: "NATION" },
    fieldSize: 32, minimumEntrants: 16, npcFill: [0, 0], geography: { kind: "INTERNATIONAL", hostBonus: 1 },
    eligibility: R.invitation(), invitationPolicy: null, entitlementIntake: [], qualificationOutputs: [], fieldPolicy: "SELECTION",
    seedingPolicy: { list: "pro-world", seeds: 4 }, series: null, qSchool: null, exclusiveGroup: null,
    schedule: { kind: "FIXED", slots: [{ week: 24, day: 4, endDay: 7, venue: "isar-forum-munich" }] },
  };
  worldCup.content = { ...identity(worldCup, "international", "STAGE_SERIES"), trophyId: "international-globe",
    trophyIdentity: { id: "trophy:world-cup-of-darts", designId: "international-globe" }, circuitName: "World Cup of Darts",
    summary: "Nations compete in pairs: each nation's two best players share one score and take alternate visits — England, Scotland, Wales and Northern Ireland play separately. Up to 16 nations, doubles knockout over four days. Prize money per player; no ranking points. Be one of your nation's top two (World Ranking first, then the Open World and Amateur rankings) to be called up." };
  out.push(worldCup);
  return Object.freeze(out);
}
