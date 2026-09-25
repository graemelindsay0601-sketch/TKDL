/**
 * REMOVED 2026-09-25 — this file is now inert and unreferenced.
 *
 * This used to be a virtualized-scrolling version of the leaderboard list
 * (see git history for the full original implementation). It claimed
 * "-95% DOM, instant scroll" but was never actually imported anywhere —
 * pages/leaderboard.tsx still renders its full lists via plain .map()s.
 *
 * It also could not have compiled as-is: it imported useVirtualization
 * from "@/hooks/useVirtualization", a hook file that doesn't exist
 * anywhere in this repo (hooks/ only has use-fetch.ts, use-mobile.tsx,
 * use-push-notifications.ts, use-settings.ts). Abandoned mid-build,
 * same as its sibling VirtualizedAchievements.tsx.
 *
 * Decision: remove rather than finish. The leaderboard isn't large enough
 * today for virtualization to be a known, felt problem, so writing the
 * missing hook and wiring this in was speculative work against a
 * performance issue that doesn't currently exist — revisit if the league
 * grows enough that scroll performance actually becomes a complaint.
 *
 * Left in place only because this session couldn't delete files on the
 * user's machine — safe to delete this file entirely; nothing references
 * it anymore.
 */
export {};
