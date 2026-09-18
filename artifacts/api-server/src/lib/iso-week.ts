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
 * The ISO-8601 week-YEAR for a given date — not always the same as
 * date.getFullYear(). The two only diverge right at a year boundary: e.g.
 * Dec 31, 2029 is a Monday whose ISO week is week 1 of 2030 (see this file's
 * test suite), so getIsoWeekNumber(that date) === 1 and getFullYear() would
 * wrongly say 2029. Pairing (getIsoWeekYear(d), getIsoWeekNumber(d)) is what
 * actually uniquely identifies a week — week_number alone repeats every
 * calendar year (week 12 of 2026 and week 12 of 2027 are both just "12"),
 * which is exactly the bug this function exists to let callers avoid.
 */
export function getIsoWeekYear(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  return d.getFullYear();
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
 *
 * Restored September 18th after a since-reverted edit briefly replaced this
 * function with getIsoWeekYear above — the two aren't interchangeable:
 * routes/challenges.ts stores this combined key directly in a "week number"
 * column, while getIsoWeekYear exists for player_weekly_challenges, which
 * has a separate week_number and week_year column pair instead. Both are
 * genuinely in use; removing this one broke the production build (a
 * "No matching export" bundling error, not a runtime error) for every
 * deploy since, because routes/challenges.ts still imports it.
 */
export function getIsoWeekKey(date: Date): number {
  const isoYear = getIsoWeekYear(date);
  return isoYear * 100 + getIsoWeekNumber(date);
}
