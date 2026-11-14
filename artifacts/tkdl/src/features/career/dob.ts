/** Date-of-birth dropdown logic (kept free of React so the node tests can import it). */
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
export const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Day, month and year as "YYYY-MM-DD" once all three are chosen (the day clamped to the month), else "". */
export function composeDob(day: string, month: string, year: string): string {
  if (!day || !month || !year) return "";
  const y = Number(year), m = Number(month), d = Math.min(Number(day), daysIn(y, m));
  return `${y}-${pad(m)}-${pad(d)}`;
}

