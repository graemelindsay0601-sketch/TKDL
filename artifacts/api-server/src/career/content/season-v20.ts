import type { EventDefinition } from "../calendar/catalogue.ts";

export const V20_RENAMED_EVENT_KEYS = [
  "youth-world-championship",
  "women-world-championship",
  "women-masters",
  "youth-masters",
  "pdc-youth-world-championship",
  "wdf-world-championship",
  "wdf-gold-open",
  "wdf-silver-open",
  "wdf-bronze-open",
] as const;

const NAMES: Record<string, string> = {
  "youth-world-championship": "Youth World Championship",
  "women-world-championship": "Women's World Championship",
  "women-masters": "Women's World Masters",
  "youth-masters": "Youth World Masters",
  "pdc-youth-world-championship": "Pro Youth World Championship",
  "wdf-world-championship": "Lakeside World Championship",
  "wdf-gold-open": "Gold-Ranked International Open",
  "wdf-silver-open": "Silver-Ranked International Open",
  "wdf-bronze-open": "Bronze-Ranked International Open",
};

/** v20 makes the remaining displayed event names distinct from official brands. */
export function buildCatalogueV20(v19: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v19.map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 20 };
    const name = NAMES[d.key];
    if (name) d.name = name;
    return d;
  }));
}
