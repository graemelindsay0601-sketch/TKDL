import type { EventDefinition } from "../calendar/catalogue.ts";
import { league501, knockout501 } from "../calendar/formats.ts";

/**
 * Event database v18: a playable, real-world-shaped darts calendar.
 *
 * Novelty games (Cricket, Halve-It, Golf, and similar) are not Career tour
 * stops. Keep the club/county/national amateur ladder, but replace those
 * fixtures with recognised 501 competition types. Previous catalogue versions
 * remain immutable for historical saves.
 */
const NOVELTY_EVENT_KEYS = new Set([
  "cricket-classic", "national-cricket",
  "halve-it-night", "national-halve-it",
  "killer-night", "football-darts", "golf-night", "golf-18-open",
  "count-up-challenge", "shanghai-showdown", "bobs-27-challenge",
  "scram-shootout", "baseball-darts-classic", "fives-festival",
  "snooker-darts-cup", "noughts-and-crosses-trophy", "treble-out-trophy",
]);

/** Distinct names for real-circuit event types; these are not official event marks. */
const CIRCUIT_NAMES: Record<string, string> = {
  "pro-circuit-championship": "Pro Players Championship {n}",
  "european-dart-series": "European Darts Tour — {city}",
  "world-dart-series": "Global Darts Series — {city}",
  "world-dart-series-finals": "Global Darts Series Finals",
  "open-championship": "Great Britain Open",
  "long-format-matchplay": "Summer Matchplay",
  "double-crown": "Double-Start Grand Prix",
  "european-championship": "Continental Championship",
  "grand-slam-of-champions": "Grand Slam Darts Championship",
  "pro-circuit-finals": "Players Tour Finals",
  "world-darts-championship": "World Darts Championship",
  "champions-masters": "Masters Invitational",
  "world-cup-of-darts": "International Pairs Cup",
  "challenger-event": "Challenge Tour {n}",
  "development-tour": "Youth Development Tour {n}",
  "women-tour": "Women's Series {n}",
  "amateur-world-masters": "International Amateur Masters",
};

export function buildCatalogueV18(v17: readonly EventDefinition[]): readonly EventDefinition[] {
  const out = v17.filter(d => !NOVELTY_EVENT_KEYS.has(d.key)).map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 18 };
    const name = CIRCUIT_NAMES[d.key];
    if (name) d.name = name;

    // The regional team league is a genuine darts format, not a novelty game.
    // Run it as an authored eight-player 501 league rather than leaving it benched.
    if (d.key === "regional-champions-league") {
      d.name = "Regional Team League";
      d.format = { ...league501(5, "stage", 21), leagueNights: true };
    }

    // A one-leg 501 night is a valid grassroots entry point. Keep the fixture,
    // but classify it as a local amateur ranking event rather than a special tour.
    if (d.key === "sudden-death-night") {
      d.name = "{city} Club Knockout Open";
      d.circuit = "GRASSROOTS";
      d.classification = "RANKING";
      d.rankingCategory = "AMATEUR_LOCAL";
      d.family = "club-501-open";
      d.format = knockout501([1], "local");
    }
    return d;
  });
  return Object.freeze(out);
}
