/**
 * Rate limiting for match-submission endpoints (singles, team, doubles).
 *
 * These write directly to a player/team's points balance and can be hit
 * with no login required, so a scripted flood of requests could otherwise
 * spam the DB or manipulate standings faster than any human could play
 * real darts. This is deliberately generous — a genuinely busy league
 * night, possibly all submitted from one shared kiosk device (one IP),
 * should never come close to the limit.
 *
 * Mirrors the pattern already used for loginRateLimit (app.ts) and
 * pinRateLimit (routes/admin.ts).
 */
import rateLimit from "express-rate-limit";

export const matchSubmitRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 60,                  // 60 match submissions per IP per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many matches submitted too quickly — please wait a few minutes and try again" },
  skip: () => process.env.NODE_ENV !== "production",
});

/** Boss Battle attempts don't touch points/Elo, but they're still an
 *  unauthenticated write endpoint, so the same "don't let a script hammer
 *  the DB" reasoning as matchSubmitRateLimit applies. A real player retrying
 *  a boss fight over and over is still nowhere near this — it's sized for
 *  a scripted flood, not a frustrated human. */
export const bossBattleRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 120,                 // 120 fight results per IP per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many boss battle results submitted too quickly — please wait a few minutes and try again" },
  skip: () => process.env.NODE_ENV !== "production",
});

/** Shared limiter for authenticated, no-per-action-cost write endpoints —
 *  community posts/reactions/comments and direct messages so far. These are
 *  authenticated (unlike the two above) but still cost nothing to fire, so a
 *  compromised session or a buggy client loop could otherwise hammer the
 *  feed or another player's inbox far faster than a real person. This is
 *  sized generously above genuine human usage — reacting to a dozen posts,
 *  firing off a burst of comments, or sending several DMs in a minute is
 *  normal; hundreds per minute isn't. Named generically (not
 *  communityWriteRateLimit) since it's shared across unrelated features —
 *  reach for this one first for any new authenticated write route before
 *  adding another near-identical limiter. */
export const authedWriteRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 200,                 // 200 actions per IP per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many actions too quickly — please wait a few minutes and try again" },
  skip: () => process.env.NODE_ENV !== "production",
});
