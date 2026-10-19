import type { EventDefinition } from "../calendar/catalogue.ts";

export const V21_CALENDAR_REFRESH_KEYS = [
  "vault-qualifier",
  "vault-tour",
  "vault-nights",
  "vault-championship",
  "world-dart-series",
  "world-dart-series-finals",
  "wdf-world-cup",
  "wdf-europe-cup",
  "pdc-youth-world-championship",
] as const;

const VAULT_WEEKS: Record<string, readonly number[]> = {
  "vault-qualifier": [2, 20, 35],
  "vault-tour": [7, 13, 19, 25, 33, 37, 45],
  "vault-nights": [12, 16, 22, 29, 39],
  "vault-championship": [44],
};

/** Restore Vault as an optional in-game route, spaced around the headline calendar. */
export function buildCatalogueV21(
  v20: readonly EventDefinition[],
  v18: readonly EventDefinition[],
): readonly EventDefinition[] {
  const current = v20.map(original => ({
    ...structuredClone(original),
    eventDatabaseVersion: 21,
  })).map(d => {
    const placements: Record<string, { week: number; day: number; endDay: number }> = {
      "wdf-world-cup": { week: 17, day: 1, endDay: 3 },
      "wdf-europe-cup": { week: 23, day: 1, endDay: 3 },
      "pdc-youth-world-championship": { week: 42, day: 5, endDay: 7 },
    };
    if (d.key === "world-dart-series") {
      if (d.schedule.kind !== "FIXED" || d.schedule.slots.length !== 6)
        throw new Error("Unexpected v21 World Series calendar");
      const weeks = [9, 14, 20, 26, 35, 38];
      d.schedule = { kind: "FIXED", slots: d.schedule.slots.map((slot, i) => ({ ...slot, week: weeks[i] })) };
      return d;
    }
    if (d.key === "world-dart-series-finals") {
      if (d.schedule.kind !== "FIXED" || d.schedule.slots.length !== 1)
        throw new Error("Unexpected v21 World Series Finals calendar");
      d.schedule = { kind: "FIXED", slots: [{ ...d.schedule.slots[0], week: 41 }] };
      return d;
    }
    const placement = placements[d.key];
    if (!placement) return d;
    if (d.schedule.kind !== "FIXED") throw new Error(`Unexpected v21 headline schedule: ${d.key}`);
    const template = d.schedule.slots[0];
    if (!template) throw new Error(`Missing v21 headline schedule template: ${d.key}`);
    d.schedule = { kind: "FIXED", slots: [{ ...template, ...placement }] };
    return d;
  });
  const vault = v18.filter(d => d.circuit === "VAULT").map(original => {
    const d: EventDefinition = { ...structuredClone(original), eventDatabaseVersion: 21 };
    const weeks = VAULT_WEEKS[d.key];
    if (!weeks) throw new Error(`Missing v21 Vault calendar placement: ${d.key}`);
    if (d.schedule.kind !== "FIXED") throw new Error(`Unexpected v21 Vault schedule: ${d.key}`);
    const template = d.schedule.slots[0];
    if (!template) throw new Error(`Missing v21 Vault schedule template: ${d.key}`);
    const days = d.key === "vault-tour" ? [1, 2] :
      d.key === "vault-qualifier" ? [1] :
      d.key === "vault-nights" ? [5] : [template.day ?? 5];
    d.schedule = {
      kind: "FIXED",
      slots: weeks.flatMap(week => days.map(day => ({ ...template, week, day }))),
    };
    return d;
  });
  return Object.freeze([...current, ...vault]);
}
