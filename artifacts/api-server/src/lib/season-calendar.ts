const LEAGUE_TIME_ZONE = "Europe/London";

type LondonDateParts = {
  year: number;
  month: number;
  day: number;
};

function londonDateParts(now: Date): LondonDateParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LEAGUE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find(part => part.type === type)?.value);

  return { year: value("year"), month: value("month"), day: value("day") };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function londonDateKey(now = new Date()): string {
  const { year, month, day } = londonDateParts(now);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function londonMonthKey(now = new Date()): string {
  const { year, month } = londonDateParts(now);
  return `${year}-${pad(month)}`;
}

export function londonSeasonName(now = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LEAGUE_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(now);
}

export type SeasonResetTiming = {
  now: Date;
  startDate: string;
  endDate: string;
};

/**
 * Gives a calendar-month rollover a stable boundary even if a sleeping
 * Render service does not wake until the second or third day of the month.
 * The old season still ends on the final London date of the previous month
 * and the replacement season is recorded as starting on day one.
 */
export function monthlyRolloverTiming(now = new Date()): SeasonResetTiming {
  const { year, month } = londonDateParts(now);
  const previousMonthEnd = new Date(Date.UTC(year, month - 1, 0));

  return {
    now,
    startDate: `${year}-${pad(month)}-01`,
    endDate: previousMonthEnd.toISOString().slice(0, 10),
  };
}

export function manualResetTiming(now = new Date()): SeasonResetTiming {
  const date = londonDateKey(now);
  return { now, startDate: date, endDate: date };
}
