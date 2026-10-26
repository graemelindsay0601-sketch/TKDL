import type { EventDefinition } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";

/**
 * WDF Seniors World Ranking Systems Criteria, edition 50 (17 August 2026),
 * rule 2.05: current PDC Tour Card holders are not eligible for WDF-ranked
 * tournaments. Keep this as a new catalogue edition so played event snapshots
 * and existing calendar history retain their original eligibility rules.
 */
export const V32_WDF_RANKED_EVENT_KEYS = [
  "wdf-world-championship",
  "wdf-world-masters",
  "wdf-gold-open",
  "wdf-silver-open",
  "wdf-bronze-open",
  "wdf-nevada-open",
  "wdf-low-countries-open",
  "wdf-caledonian-open",
  "wdf-manx-open",
  "wdf-ulster-open",
  "wdf-baltic-open",
  "wdf-britannia-open",
  "wdf-danube-masters",
  "wdf-emerald-open",
  "wdf-bohemian-open",
  "wdf-mediterranean-masters",
  "wdf-southern-cross-open",
  "world-ranking-open",
  "women-world-ranking-open",
  "youth-world-ranking-open",
  "girls-world-ranking-open",
  "women-world-championship",
  "women-masters",
  "women-tour",
  "youth-world-championship",
  "youth-masters",
  "wdf-world-girls-championship",
] as const;

export function buildCatalogueV32(v31: readonly EventDefinition[]): readonly EventDefinition[] {
  const rankedKeys = new Set<string>(V32_WDF_RANKED_EVENT_KEYS);
  return Object.freeze(v31.map(original => {
    const definition = { ...structuredClone(original), eventDatabaseVersion: 32 };
    if (rankedKeys.has(definition.key) && definition.classification === "RANKING" && definition.rankingCategory) {
      definition.eligibility = R.all(definition.eligibility, R.nonTourCard());
      if (definition.content) {
        definition.content = {
          ...definition.content,
          summary: `${definition.content.summary} Current PDC Tour Card holders are not eligible for this WDF-ranked event.`,
        };
      }
    }
    return definition;
  }));
}
