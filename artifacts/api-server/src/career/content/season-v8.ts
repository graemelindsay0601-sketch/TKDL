import type { EventDefinition } from "../calendar/catalogue.ts";
import { softTip501 } from "../calendar/formats.ts";

/**
 * Event database v8 (new saves only; v1–v7 definitions and established instances are untouched).
 *
 * Soft-tip events play real soft-tip rules (DARTSLIVE-style), which both the live scorer and the NPC
 * simulation now implement: open in, master out (finish on a double, a treble or the bull), a fat bull
 * (outer and inner bull both score 50), and a 15-round limit per leg — if neither player has checked out
 * after 15 visits each, a cork at the bull decides the leg.
 */
const SOFT_TIP_FORMATS: Record<string, EventDefinition["format"]> = {
  "soft-tip-series": softTip501([5, 5, 7, 7, 7, 9], "floor"),
  "soft-tip-masters": softTip501([7, 9, 9, 11], "stage", 2),
  "soft-tip-series-finals": softTip501([7, 7, 9, 9, 11], "stage", 2),
};
export const SOFT_TIP_RULES_SUMMARY = "Legs are 501 on electronic boards with soft-tip rules: open in, master out (finish on a double, a treble or the bull), a fat bull (outer and inner bull both score 50) and a 15-round limit — if nobody has checked out after 15 visits each, a cork at the bull decides the leg.";

export function buildCatalogueV8(v7: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v7.map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 8 };
    const format = SOFT_TIP_FORMATS[d.key];
    if (format) {
      d.format = structuredClone(format);
      if (d.content?.summary) d.content = { ...d.content, summary: d.content.summary.replace(/ ?Matches are 501 with a double to finish over the shorter soft-tip match lengths \(best of 5 to 9 legs\)\./, "") + ` ${SOFT_TIP_RULES_SUMMARY}` };
    }
    return d;
  }));
}
