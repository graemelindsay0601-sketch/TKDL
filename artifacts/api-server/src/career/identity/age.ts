/**
 * A6.5 Career identity: dates and ages.
 *
 * A Career has a persisted in-world start date. Every Career day maps to a real
 * calendar date deterministically: day 1 of season 1 is the start date, and each
 * season is 52 weeks (364 days). Ages are computed from the date of birth on that
 * Career date — never from the computer's clock — so the player ages naturally as
 * seasons pass (a 15-year-old starter turns 16, 18, 21 ... in later seasons).
 *
 * Age is an ELIGIBILITY fact only. It never touches scoring, bots, RNG, prize or
 * ranking money, or difficulty. There is no human age decline.
 */
import { DAYS_PER_SEASON, DAYS_PER_WEEK } from "../calendar/config.ts";

/** All age thresholds live here (data/config), never scattered through code. */
export const AGE_POLICY = Object.freeze({
  /** Youngest a Career may start (DOB validated on the Career start date). */
  minimumCareerStartAge: 15,
  /** Data sanity bound only — not a sporting rule. */
  maximumCareerStartAge: 99,
  /** Junior Development Circuit: under this age on the event's start date. */
  juniorMaxAgeExclusive: 18,
  /**
   * Fictional Q-School minimum age. Real-world inspiration: the PDC Qualifying School
   * is open to players aged 16 and over (e.g. 2026 edition: "aged 16 and above" on the
   * opening day). Applied to every event database version by circuit.
   */
  circuitMinimumAge: { Q_SCHOOL: 16 } as Readonly<Record<string, number>>,
});

const MS_PER_DAY = 86_400_000;
const parse = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) throw new Error("Invalid date");
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) throw new Error("Invalid date");
  return d;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const isIsoDate = (value: unknown): value is string => { try { return typeof value === "string" && !!parse(value); } catch { return false; } };

/** A new Career starts on 1 January of the year it is created (persisted; never recomputed). */
export const careerStartDateFor = (createdAt: Date) => `${createdAt.getUTCFullYear()}-01-01`;

/** Real calendar date of a Career day (season 1+, day-of-season 1..364). */
export function careerDate(startDate: string, season: number, dayOfSeason: number): string {
  if (!Number.isInteger(season) || season < 1 || !Number.isInteger(dayOfSeason) || dayOfSeason < 1 || dayOfSeason > DAYS_PER_SEASON) throw new Error("Invalid Career day");
  return iso(new Date(parse(startDate).getTime() + ((season - 1) * DAYS_PER_SEASON + dayOfSeason - 1) * MS_PER_DAY));
}
/** First day of a Career week. */
export const careerWeekDate = (startDate: string, season: number, week: number) => careerDate(startDate, season, (week - 1) * DAYS_PER_WEEK + 1);

/** Whole years on `onDate` (birthdays on 29 Feb count from 1 March in non-leap years). */
export function ageOn(dateOfBirth: string, onDate: string): number {
  const b = parse(dateOfBirth), d = parse(onDate);
  let age = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function validateDateOfBirth(dateOfBirth: string, startDate: string): void {
  if (!isIsoDate(dateOfBirth)) throw new Error("Date of birth must be a real date (YYYY-MM-DD)");
  const age = ageOn(dateOfBirth, startDate);
  if (age < AGE_POLICY.minimumCareerStartAge) throw new Error(`You must be at least ${AGE_POLICY.minimumCareerStartAge} on the Career start date (${startDate})`);
  if (age > AGE_POLICY.maximumCareerStartAge) throw new Error("Date of birth is outside the supported range");
}

export type CareerIdentity = { dateOfBirth: string | null; careerStartDate: string };

/** Age on a Career day, or null when the save has no DOB yet (PROFILE_INCOMPLETE). */
export function careerAge(identity: CareerIdentity | null | undefined, season: number, dayOfSeason: number): number | null {
  if (!identity?.dateOfBirth) return null;
  return ageOn(identity.dateOfBirth, careerDate(identity.careerStartDate, season, dayOfSeason));
}

/**
 * First Career (season, week) from which the player is at least `minAge`, searching
 * forward from (fromSeason, fromWeek). Deterministic; purely a function of dates.
 */
export function eligibleFrom(identity: CareerIdentity, minAge: number, fromSeason: number, fromWeek: number) {
  if (!identity.dateOfBirth) return null;
  const b = parse(identity.dateOfBirth);
  const birthday = `${b.getUTCFullYear() + minAge}-${String(b.getUTCMonth() + 1).padStart(2, "0")}-${String(b.getUTCDate()).padStart(2, "0")}`;
  const target = isIsoDate(birthday) ? parse(birthday) : parse(`${b.getUTCFullYear() + minAge}-03-01`);
  const start = parse(identity.careerStartDate);
  const days = Math.ceil((target.getTime() - start.getTime()) / MS_PER_DAY);
  const absolute = Math.max(days, ((fromSeason - 1) * DAYS_PER_SEASON + (fromWeek - 1) * DAYS_PER_WEEK));
  const season = Math.floor(absolute / DAYS_PER_SEASON) + 1;
  const week = Math.floor((absolute % DAYS_PER_SEASON) / DAYS_PER_WEEK) + 1;
  return { season, week, date: iso(new Date(start.getTime() + absolute * MS_PER_DAY)) };
}
