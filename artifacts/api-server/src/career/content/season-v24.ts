import type { EventDefinition, ScheduleSlot } from "../calendar/catalogue.ts";
import { R } from "../calendar/eligibility.ts";

export const V24_CALENDAR_REFRESH_KEYS = ["development-tour", "european-dart-series"] as const;

function fixedSlots(event: EventDefinition): ScheduleSlot[] {
  if (event.schedule.kind !== "FIXED") throw new Error(`${event.key} must use a fixed schedule`);
  return [...event.schedule.slots];
}

/** Adds PDC series fixtures confirmed by 2026 notices and the official tour format pages. */
export function buildCatalogueV24(v23: readonly EventDefinition[]): readonly EventDefinition[] {
  const out = v23.map(original => ({ ...structuredClone(original), eventDatabaseVersion: 24 }));
  const find = (key: string) => {
    const d = out.find(event => event.key === key);
    if (!d) throw new Error(`Missing v24 event template: ${key}`);
    return d;
  };

  const development = find("development-tour");
  const developmentSlots = fixedSlots(development);
  const weekendWeeks = [8, 15, 22, 29, 36, 43];
  const venues = ["stirling-civic", "midlands-oche", "canal-conference"];
  // PDC's Development Tour format is 24 events over six weekends. Career uses one
  // playable event per day, so each four-event weekend occupies Thu–Sun.
  development.schedule = {
    kind: "FIXED",
    slots: weekendWeeks.flatMap((week, index) =>
      [4, 5, 6, 7].map(day => ({
        week,
        day,
        venue: venues[index % venues.length],
      })),
    ),
  };
  development.eligibility = R.age({ minAge: 16, maxAgeExclusive: 24 });
  if (development.content) {
    development.content = {
      ...development.content,
      summary: "A 24-event youth development ranking tour across six weekends, open to players aged 16–23.",
    };
  }
  // Guard the authored v23 calendar shape: it must still represent twelve prior fixtures.
  if (developmentSlots.length !== 12) throw new Error("Unexpected prior Development Tour fixture count");

  const european = find("european-dart-series");
  const existingEuropeanSlots = fixedSlots(european);
  if (existingEuropeanSlots.length !== 12) throw new Error("Unexpected prior European Tour fixture count");
  const addedEuropeanSlots: ScheduleSlot[] = [
    { week: 39, day: 5, endDay: 7, venue: "meuse-hall-liege", label: "European Stop 13" },
    { week: 41, day: 5, endDay: 7, venue: "rhein-hall-basel", label: "Basel" },
    { week: 42, day: 5, endDay: 7, venue: "maas-valley-hall-maastricht", label: "Maastricht" },
  ];
  european.schedule = { kind: "FIXED", slots: [...existingEuropeanSlots, ...addedEuropeanSlots] };
  if (european.content) {
    european.content = {
      ...european.content,
      summary: "A 15-stop European ranking tour. The final three stops complete the current PDC-style annual route through ET15.",
    };
  }
  return Object.freeze(out);
}
