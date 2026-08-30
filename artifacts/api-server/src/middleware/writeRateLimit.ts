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
