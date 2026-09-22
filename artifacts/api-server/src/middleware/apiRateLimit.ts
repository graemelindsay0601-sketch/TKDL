/**
 * A blanket rate limit across every /api/* request.
 *
 * Every write path that actually costs something (match submission, boss
 * battle results, community posts/reactions/DMs, login, the admin PIN) has
 * its own tight limiter already (see writeRateLimit.ts, and loginRateLimit /
 * pinRateLimit where they're defined) — but every GET endpoint (leaderboard,
 * players, matches, stats, achievements, ...) had no limit at all. Fine for
 * a small club on a private link; not fine once this is meant to hold up to
 * a "real professional app" that might one day be reachable by the public
 * internet, where an unthrottled read endpoint is a standing invitation to
 * scrape the whole dataset or run the DB bill up with a scripted loop.
 *
 * One generous, method-agnostic ceiling per IP is simpler and more robust
 * than hand-picking which GET routes "matter" (new routes get covered for
 * free, and it also backstops any write route that doesn't have its own
 * limiter yet). The specific limiters above still apply on top of this and
 * will trip first for their routes, since they're all stricter — this is
 * only meant to catch everything else.
 *
 * Sized well above real usage: a page load can easily fire a dozen-plus
 * parallel /api calls, the broadcast screen and the unread-count badge both
 * poll every 30s, and an admin session can fire off a burst of writes —
 * none of that comes remotely close to 300/minute from one IP. A scripted
 * flood does.
 */
import rateLimit from "express-rate-limit";

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300,             // 300 requests per IP per minute
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests — please slow down and try again shortly" },
  skip: () => process.env.NODE_ENV !== "production",
});
