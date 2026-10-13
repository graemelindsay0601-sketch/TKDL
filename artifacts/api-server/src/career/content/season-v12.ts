import type { EventDefinition } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";

/**
 * Event database v12 (new saves only; v1–v11 definitions and established instances are untouched).
 *
 * The Development Tour is the real PDC Development Tour shape: open to players aged 16 to 23 (under 24 on
 * the event date), Tour Card holders included, with its own season Order of Merit (ranking rules v4). The
 * Order of Merit top two without a card earn a two-season Tour Card; 3rd–16th go straight to the Q-School
 * Final Stage and 3rd–10th also get an Open Championship place (Tour Card rules v3). The Youth Masters and
 * Youth World Championship move to the same under-24 age line.
 */
export const DEVELOPMENT_AGE = Object.freeze({ minAge: 16, maxAgeExclusive: 24 });
const YOUTH_EVENTS = new Set(["youth-masters", "youth-world-championship"]);

export function buildCatalogueV12(v11: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v11.map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 12 };
    if (d.key === "development-tour") {
      d.eligibility = R.age(DEVELOPMENT_AGE);
      d.rankingCategory = "DEVELOPMENT";
      if (d.content) d.content = { ...d.content, summary: "Development Tour: ranking events for players aged 16 to 23. The season Order of Merit top two earn a Tour Card; 3rd–16th go straight to the Q-School Final Stage and 3rd–10th also reach the Open Championship." };
    }
    if (YOUTH_EVENTS.has(d.key)) d.eligibility = R.age({ maxAgeExclusive: DEVELOPMENT_AGE.maxAgeExclusive });
    return d;
  }));
}
