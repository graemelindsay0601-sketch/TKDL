// TKDL LIVE — logical slot resolution (handover doc 16.3 step 1: "resolve
// latest logical slot in Europe/London"). Pure date/timezone math, zero
// @workspace/db runtime imports (same reasoning as every other *-math.ts
// file in this folder) — the only DB-shaped thing this file touches is the
// `SlotType` string union, imported type-only from @workspace/db/schema so
// it's erased before module resolution and this file stays directly
// testable via `node --test`.
//
// ── Why "night" is the FIRST slot of a calendar day, not the last ────────
// Appendix B's defaults are midday 11:30, evening 19:00, night 00:00. Taken
// literally as three instants on one calendar date D, that puts night(D) at
// the very first moment of D — chronologically BEFORE midday(D) and
// evening(D), not after. That's not a bug to work around: TKDL matches are
// played in the evening, so a "night" edition firing at 00:00 is the wrap-up
// of the evening's just-finished results, landing right at the boundary
// into the next calendar date — exactly the natural reading of "night"
// bulletin. So the daily cycle, in chronological order, is
// night(D)@00:00 -> midday(D)@11:30 -> evening(D)@19:00 -> night(D+1)@00:00,
// and resolveLogicalSlot() below picks the LATEST of a day's three slot
// instants that is not in the future, which for any "now" always resolves
// correctly because night(D)@00:00 is by construction never later than any
// other instant on date D.
//
// ── Timezone conversion, without a new dependency ─────────────────────────
// Converting a LOCAL wall-clock time in an arbitrary IANA zone (the
// `broadcast_timezone` setting, Europe/London by default) into the correct
// UTC instant needs to account for that zone's actual DST offset on that
// specific date — a fixed "+01:00"/"+00:00" table would silently misfire
// across the BST/GMT transition. Rather than add a timezone library for one
// file, this uses the standard pure-Intl technique: format a UTC guess back
// through the target zone, read off the offset that was actually applied,
// and correct for it (two passes handles the rare case where the first
// guess lands on the wrong side of a DST transition).
import type { SlotType } from "@workspace/db/schema";

export type ResolvedSlot = {
  slotType: Exclude<SlotType, "manual">;
  /** YYYY-MM-DD, in the configured timezone — the same calendar date all three of that day's slots share. */
  slotDate: string;
  /** `${slotDate}:${slotType}` — matches broadcast_editions.slot_key's own documented shape (13.1: "e.g. 2026-09-02:evening"). */
  slotKey: string;
  /** The real UTC instant this slot instance represents — what broadcast_editions.scheduled_for should store. */
  scheduledFor: Date;
};

type HourMinute = { hour: number; minute: number };
type DateParts = { year: number; month: number; day: number };

/** Splits an already-validated "HH:MM" setting string (config-math.ts's parseHHMM is what guarantees the shape) into numeric parts. */
function splitHHMM(hhmm: string): HourMinute {
  const [hourStr, minuteStr] = hhmm.split(":");
  return { hour: Number(hourStr), minute: Number(minuteStr) };
}

/** The wall-clock date (and, incidentally, time) `date` reads as inside `timeZone`. */
function zonedParts(date: Date, timeZone: string): DateParts & HourMinute {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), minute: Number(parts.minute) };
}

/** How far ahead of UTC `timeZone` is, in minutes, at the instant `date` — positive for BST/east-of-UTC zones, negative west of UTC. */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const zoned = zonedParts(date, timeZone);
  const asUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute);
  return (asUtc - date.getTime()) / 60000;
}

/** The correct UTC instant for wall-clock `{year, month, day, hour, minute}` as read in `timeZone`. */
function zonedTimeToUtc(dateParts: DateParts, time: HourMinute, timeZone: string): Date {
  const naiveGuessAsUtc = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, time.hour, time.minute);
  let instant = new Date(naiveGuessAsUtc);
  // One correction pass is enough for any real-world IANA zone's offset
  // (at most a small number of fixed steps, never continuously varying);
  // a second pass costs nothing and guards the rare guess that lands
  // exactly on the wrong side of a DST transition boundary.
  for (let i = 0; i < 2; i++) {
    const offsetMinutes = tzOffsetMinutes(instant, timeZone);
    instant = new Date(naiveGuessAsUtc - offsetMinutes * 60000);
  }
  return instant;
}

function dateKey(parts: DateParts): string {
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

export type SlotTimesConfig = {
  middayTime: string;
  eveningTime: string;
  nightTime: string;
  timezone: string;
  /** When true, the day has exactly one logical slot ("night", fired at nightTime) instead of three — see the "single daily episode" section below both slot functions build their candidate list from. */
  singleDailyEpisode: boolean;
};

/** The day's logical slot instants, in the configured timezone — three (midday/evening/night) normally, or just "night" alone when config.singleDailyEpisode collapses the day to one guaranteed episode (direct response to player feedback that three near-identical slots a day felt like "a constant same episode loop" rather than one thing to look forward to). Both resolveLogicalSlot and resolveNextLogicalSlot build their candidate list from this single place so the two functions can never disagree about how many slots a day has. */
function daySlotCandidates(dateParts: DateParts, config: SlotTimesConfig): { slotType: Exclude<SlotType, "manual">; instant: Date }[] {
  if (config.singleDailyEpisode) {
    return [{ slotType: "night", instant: zonedTimeToUtc(dateParts, splitHHMM(config.nightTime), config.timezone) }];
  }
  return [
    { slotType: "night", instant: zonedTimeToUtc(dateParts, splitHHMM(config.nightTime), config.timezone) },
    { slotType: "midday", instant: zonedTimeToUtc(dateParts, splitHHMM(config.middayTime), config.timezone) },
    { slotType: "evening", instant: zonedTimeToUtc(dateParts, splitHHMM(config.eveningTime), config.timezone) },
  ];
}

/**
 * 16.3 step 1: "resolve latest logical slot in Europe/London." Returns the
 * most recent of today's slot instants (in the configured timezone)
 * that isn't in the future — see this file's own header for why "night"
 * being the day's first instant (00:00) makes that always well-defined,
 * whether today has three slot candidates or (with singleDailyEpisode) one.
 */
export function resolveLogicalSlot(now: Date, config: SlotTimesConfig, recursionGuard = 3): ResolvedSlot {
  const today = zonedParts(now, config.timezone);
  const todayDateParts: DateParts = { year: today.year, month: today.month, day: today.day };

  const unsorted = daySlotCandidates(todayDateParts, config);
  const candidates = unsorted.sort((a, b) => b.instant.getTime() - a.instant.getTime()); // latest first

  const chosen = candidates.find(c => c.instant.getTime() <= now.getTime());

  // Reachable only if an admin has configured nightTime later than 00:00
  // (so it's no longer guaranteed <= every "now" on the same local date)
  // AND now is earlier than all three of today's slots — fall back to
  // yesterday's slots rather than ever returning nothing, since 16.3's
  // whole flow needs *some* current logical slot. recursionGuard bounds
  // this defensively; the default config can never actually need more than
  // one step back, since night@00:00 is always <= any "now" on that date.
  if (!chosen) {
    if (recursionGuard <= 0) {
      const slotDate = dateKey(todayDateParts);
      return { slotType: "night", slotDate, slotKey: `${slotDate}:night`, scheduledFor: now };
    }
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return resolveLogicalSlot(yesterday, config, recursionGuard - 1);
  }

  const slotDate = dateKey(todayDateParts);
  return { slotType: chosen.slotType, slotDate, slotKey: `${slotDate}:${chosen.slotType}`, scheduledFor: chosen.instant };
}

/**
 * The slot AFTER the one resolveLogicalSlot() would currently return — 14.4's
 * `channel.nextLogicalSlot`, so the frontend can show "next update due" even
 * though nothing schedules a build to actually fire at that instant (16.3's
 * whole design is lazy: the NEXT real Edition is only ever built by whichever
 * request happens to land after this instant, not by a timer). Mirrors
 * resolveLogicalSlot's own structure for today's three candidates, sorted
 * earliest-first, picking the first one strictly AFTER `now`.
 *
 * Deliberately NOT implemented by recursing on `now + 24h` when nothing is
 * left today (the way resolveLogicalSlot's OWN fallback recurses backward a
 * day): adding 24 real hours preserves `now`'s wall-clock time-of-day, so a
 * `now` already past today's evening slot would land at the exact same
 * past-evening wall-clock time on every future day too, looping without
 * ever finding a "still in the future" candidate. Once today has nothing
 * left, the next slot is instead deterministically TOMORROW's night instant
 * (night is always the earliest of the three, by construction — see this
 * file's own header) computed directly from tomorrow's own calendar date,
 * with one extra zonedParts() pass to land on the correct calendar date
 * even across a DST transition (the same "compute an instant, then re-read
 * which day it actually falls on" caution zonedTimeToUtc's own two-pass
 * correction already uses).
 */
export function resolveNextLogicalSlot(now: Date, config: SlotTimesConfig): ResolvedSlot {
  const today = zonedParts(now, config.timezone);
  const todayDateParts: DateParts = { year: today.year, month: today.month, day: today.day };

  const unsorted = daySlotCandidates(todayDateParts, config);
  const candidates = unsorted.sort((a, b) => a.instant.getTime() - b.instant.getTime()); // earliest first — the opposite order from resolveLogicalSlot, which wants latest-not-yet-future

  const chosen = candidates.find(c => c.instant.getTime() > now.getTime());
  if (chosen) {
    const slotDate = dateKey(todayDateParts);
    return { slotType: chosen.slotType, slotDate, slotKey: `${slotDate}:${chosen.slotType}`, scheduledFor: chosen.instant };
  }

  // Nothing left today (past today's evening slot, the last chronological
  // slot of the day) — resolve tomorrow's night instant directly.
  const approxTomorrowInstant = new Date(candidates[0].instant.getTime() + 24 * 60 * 60 * 1000); // candidates[0] is today's night, the earliest
  const tomorrow = zonedParts(approxTomorrowInstant, config.timezone);
  const tomorrowDateParts: DateParts = { year: tomorrow.year, month: tomorrow.month, day: tomorrow.day };
  const tomorrowNightInstant = zonedTimeToUtc(tomorrowDateParts, splitHHMM(config.nightTime), config.timezone);
  const slotDate = dateKey(tomorrowDateParts);
  return { slotType: "night", slotDate, slotKey: `${slotDate}:night`, scheduledFor: tomorrowNightInstant };
}
