import type { EventDefinition } from "../calendar/catalogue.ts";

/**
 * Event database v11 (new saves only; v1–v10 definitions and established instances are untouched).
 *
 * League nights: Thursday Night Darts is played as a real weekly league, the Premier League shape — eight
 * invited players, a double round robin (each pair meets twice) on fourteen Thursday nights, a league table
 * (wins, then leg difference and legs won; real bull playoffs for ties that matter), then semi-finals
 * (1st v 4th, 2nd v 3rd) and the final on play-off night. Players are booked on league nights only, so the
 * Pro Tour carries on around it. The human is invited from the published World Ranking (top eight).
 */
export function buildCatalogueV11(v10: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v10.map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 11 };
    if (d.key === "thursday-night-darts") {
      d.format = { ...d.format, leagueNights: true };
      d.content = { ...d.content!, summary: "Thursday Night Darts: the invitational league for the world's top eight. Each pair meets twice over fourteen Thursday nights; the top four of the league table meet in the semi-finals and final on play-off night. Prize money only — no ranking points." };
    }
    return d;
  }));
}
