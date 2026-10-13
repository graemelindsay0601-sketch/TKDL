import type { EventDefinition } from "../calendar/catalogue.ts";
import { softTipMix } from "../calendar/formats.ts";

/**
 * Event database v9 (new saves only; v1–v8 definitions and established instances are untouched).
 *
 * Soft-tip matches are played the way soft-tip tournaments are (DARTSLIVE format): games mixed leg by
 * leg — 01, Cricket, Cricket, 01, … — with a deciding Choice leg, where a cork decides who picks the game
 * and the other player throws first. 01 legs keep the soft-tip rules (fat bull, master out, 15-round limit);
 * Cricket legs are standard cricket with a 20-round limit (higher points wins; level points go to a cork).
 */
const SOFT_TIP_FORMATS: Record<string, EventDefinition["format"]> = {
  "soft-tip-series": softTipMix([5, 5, 7, 7, 7, 9], "floor"),
  "soft-tip-masters": softTipMix([7, 9, 9, 11], "stage", 2),
  "soft-tip-series-finals": softTipMix([7, 7, 9, 9, 11], "stage", 2),
};
export const SOFT_TIP_MIX_SUMMARY = "Matches mix games leg by leg as soft-tip tournaments do: 01, Cricket, Cricket, 01 and a deciding Choice leg, where the cork winner picks the game. 01 legs are 501 with a fat bull, master out and a 15-round limit; Cricket legs are standard cricket with a 20-round limit (higher points wins). A level finish at a round limit goes to a cork at the bull.";

export function buildCatalogueV9(v8: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v8.map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 9 };
    const format = SOFT_TIP_FORMATS[d.key];
    if (format) {
      d.format = structuredClone(format);
      if (d.content?.summary) d.content = { ...d.content, summary: d.content.summary.replace(/ ?Legs are 501 on electronic boards with soft-tip rules:.*$/, "") + ` ${SOFT_TIP_MIX_SUMMARY}` };
    }
    return d;
  }));
}
