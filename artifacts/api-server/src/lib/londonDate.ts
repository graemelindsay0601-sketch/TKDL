/**
 * Converts a calendar-day string (YYYY-MM-DD) that's meant to represent a
 * Europe/London day — a season's startDate/endDate, in particular — into
 * the real UTC instant for midnight at the start of that day in London.
 *
 * Several places in the broadcast system (team-history-reconstruction.ts's
 * resolveShiftWarsSeasonWindow, edition-engine.ts's anySeasonEndedInWindow,
 * story-engine.ts's resolveClosedLeagueSeasons) used to do
 * `new Date(`${dateStr}T00:00:00Z`)` directly — i.e. UTC midnight, not
 * London midnight. During BST (roughly late March–late October, UTC+1),
 * London midnight is actually 23:00 UTC the PRIOR day, so a match played
 * between 00:00 and 01:00 local time right at a season boundary could be
 * attributed to the wrong season's window, or a season could be reported as
 * "ended" up to an hour before/after it actually did in league-local time.
 * The rest of this codebase already treats Europe/London as the one true
 * clock for season/day boundaries (lib/seasonReset.ts's cron jobs, the
 * batchingService.ts send-window check) — this closes the same gap here.
 *
 * Implementation: start from a naive UTC-midnight guess, ask Intl what the
 * London wall-clock reading is AT that instant, and the difference between
 * that reading and the guess is exactly the UTC offset in effect for this
 * date (0 in winter, 1 hour during BST) — subtracting it from the guess
 * gives the real UTC instant for London midnight, correct across the DST
 * transition without hardcoding either offset or the transition dates.
 */
export function londonMidnightUtc(dateStr: string): Date {
  const guess = new Date(`${dateStr}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(guess);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const londonWallClockAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offsetMs = londonWallClockAsUtc - guess.getTime();
  return new Date(guess.getTime() - offsetMs);
}
