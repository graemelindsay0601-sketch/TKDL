import type { EventDefinition } from "../calendar/catalogue.ts";
import type { Rule } from "../calendar/eligibility.ts";

export const V36_WDF_AGE_EVENT_KEYS = [
  "youth-world-championship",
  "wdf-world-girls-championship",
  "youth-masters",
  "youth-world-ranking-open",
  "girls-world-ranking-open",
  "u23-world-ranking-open",
  "u23-girls-world-ranking-open",
] as const;

function useCalendarYearEnd(rule: Rule): Rule {
  if ("all" in rule) return { all: rule.all.map(useCalendarYearEnd) };
  if ("any" in rule) return { any: rule.any.map(useCalendarYearEnd) };
  if ("not" in rule) return { not: useCalendarYearEnd(rule.not) };
  return rule.type === "AGE" ? { ...rule, basis: "CALENDAR_YEAR_END" } : rule;
}

/** v36 changes only WDF Youth/U23 age evaluation; all prior event editions remain immutable. */
export function buildCatalogueV36(v35: readonly EventDefinition[]): readonly EventDefinition[] {
  return Object.freeze(v35.map(definition => V36_WDF_AGE_EVENT_KEYS.includes(definition.key as typeof V36_WDF_AGE_EVENT_KEYS[number])
    ? { ...structuredClone(definition), eventDatabaseVersion: 36, eligibility: useCalendarYearEnd(definition.eligibility) }
    : { ...structuredClone(definition), eventDatabaseVersion: 36 }));
}
