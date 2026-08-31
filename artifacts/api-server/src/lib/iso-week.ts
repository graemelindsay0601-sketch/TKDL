/**
 * Standard ISO-8601 week number for a given date (Monday-start weeks, week 1
 * is the week containing the year's first Thursday). Used by weekly-challenge
 * tracking to bucket progress by week — extracted into its own zero-dependency
 * module so it has direct, fast unit test coverage (see __tests__/iso-week.test.ts)
 * without pulling in the rest of the app (and its DB layer) just to exercise
 * one pure date calculation.
 */
export function getIsoWeekNumber(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
