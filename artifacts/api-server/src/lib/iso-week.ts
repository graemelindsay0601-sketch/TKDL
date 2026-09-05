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

/**
 * A year-qualified ISO week key (e.g. 202601 for ISO week 1 of 2026),
 * suitable for storing in an integer "week number" column so it can't
 * collide across a year boundary the way a bare 1-53 week number can (week
 * 1 of a new year vs. a stale week 1 row from a prior year). Encodes as
 * isoYear * 100 + isoWeek — isoWeek never exceeds 53, so the two never
 * overlap. Uses the same Monday-start/Thursday-anchored ISO year as
 * getIsoWeekNumber (which late-December/early-January dates can belong to a
 * different calendar year than date.getFullYear() would suggest), not the
 * plain calendar year.
 */
export function getIsoWeekKey(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const isoYear = d.getFullYear();
  return isoYear * 100 + getIsoWeekNumber(date);
}
