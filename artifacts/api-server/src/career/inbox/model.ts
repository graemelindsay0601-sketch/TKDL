/**
 * The Career inbox: one place that tells you what's new for you this week. Every item is worked out from facts the
 * Career already records (events you can now enter, offers waiting for an answer, milestones); nothing here changes a
 * rule or your darts. Read state (seen, dismissed, muted categories) is kept per save.
 */
export const INBOX_CATEGORIES = {
  QUALIFIED: "Qualified",
  OPEN: "Now open",
  WAITING: "Waiting for your answer",
  CLOSING: "Running out soon",
  MILESTONE: "Milestones",
} as const;
export type InboxCategory = keyof typeof INBOX_CATEGORIES;
export type InboxItem = {
  key: string; category: InboxCategory; title: string; body: string;
  action: { label: string; href: string } | null;
  /** Career week this item is about (for ordering), and when it runs out, if it does. */
  week: number; expiresWeek: number | null;
};
/** Circuits worth a "you've qualified" note: anything beyond the open grassroots and county nights. */
export const QUALIFIED_CIRCUITS = new Set(["MAJOR", "WORLD_CHAMPIONSHIP", "WORLD_SERIES", "INVITATIONAL", "PRO_CIRCUIT", "EUROPEAN_SERIES", "CHALLENGER", "Q_SCHOOL"]);
/** Circuits worth a "now open" note. */
export const OPEN_CIRCUITS = new Set(["NATIONAL_AMATEUR", "REGIONAL", "VAULT", "SOFT_TIP"]);
export const INBOX = Object.freeze({ lookAheadWeeks: 3, keep: 400 });

/** A manager says it in their own words; without one it's said plainly. */
export function voiced(manager: { name: string } | null, item: InboxItem): InboxItem & { from: string } {
  if (!manager) return { ...item, from: "Career" };
  const lead: Record<InboxCategory, string> = {
    QUALIFIED: "Good news: ", OPEN: "Worth a look: ", WAITING: "I've had a call. ", CLOSING: "Don't leave this too late. ", MILESTONE: "Well done. ",
  };
  return { ...item, body: lead[item.category] + item.body, from: manager.name };
}

/** A multi-day series ("… — Day 1", "Day 2") is one thing to tell you about. */
export const seriesName = (name: string) => name.replace(/\s*[—–-]\s*Day\s*\d+$/i, "").trim();
