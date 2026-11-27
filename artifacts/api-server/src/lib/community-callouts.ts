// Off the Oche call-outs: pure rules (unit-tested). A call-out is a post where one
// player challenges another to a league match; others predict the winner; it
// settles itself when the two next play a singles match.

export type CalloutStatus = "open" | "accepted" | "declined" | "settled" | "expired";

export type CalloutMeta = {
  challengerId: number; challengerName: string;
  targetId: number; targetName: string;
  game: string | null; message: string | null;
  status: CalloutStatus;
  createdAt: string;
  respondedAt?: string | null;
  matchId?: number | null; winnerId?: number | null; settledAt?: string | null;
};

/** An open call-out lapses after 7 days unanswered; an accepted one after 21 days unplayed. */
export const OPEN_DAYS = 7;
export const ACCEPTED_DAYS = 21;

export function expired(meta: Pick<CalloutMeta, "status" | "createdAt" | "respondedAt">, now = new Date()): boolean {
  const age = (iso: string | null | undefined) => (now.getTime() - new Date(iso ?? 0).getTime()) / 86400000;
  if (meta.status === "open") return age(meta.createdAt) > OPEN_DAYS;
  if (meta.status === "accepted") return age(meta.respondedAt ?? meta.createdAt) > ACCEPTED_DAYS;
  return false;
}

export function validateNewCallout(me: number, target: number, targetActive: boolean, openBetween: number): string | null {
  if (!Number.isInteger(target) || target <= 0) return "Pick who you're calling out";
  if (target === me) return "You can't call yourself out";
  if (!targetActive) return "That player isn't in the league right now";
  if (openBetween > 0) return "There's already a call-out between you two";
  return null;
}

export function canPredict(meta: Pick<CalloutMeta, "status" | "challengerId" | "targetId">, me: number, pick: number): string | null {
  if (meta.status !== "open" && meta.status !== "accepted") return "Predictions are closed";
  if (me === meta.challengerId || me === meta.targetId) return "No tipping yourself";
  if (pick !== meta.challengerId && pick !== meta.targetId) return "Pick one of the two players";
  return null;
}

export function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim().slice(0, max);
  return t || null;
}

/** Feed line for the post (also what search matches). */
export function calloutLine(m: Pick<CalloutMeta, "challengerName" | "targetName" | "game">): string {
  return `${m.challengerName} called out ${m.targetName}${m.game ? ` to ${m.game}` : ""}.`;
}

/** Call-outs carry a preset line, not free text: they go live straight away, so nothing needs moderating. */
export const CALLOUT_LINES = [
  "Fancy your chances?",
  "Name the time.",
  "Bring your A game.",
  "You've been ducking me.",
  "Loser buys the brews.",
  "Time to settle this.",
  "Rematch. Now.",
  "Let's see what you've got.",
] as const;

export const CALLOUT_GAMES = ["501", "301", "Cricket", "Around the World"] as const;
