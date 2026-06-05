# TKDL – Tesco Kitchen Darts League

A fully automated, gamified workplace darts league platform. Players earn Elo ratings, unlock achievements, build career legacies, and compete in monthly seasons — all tracked automatically with zero manual admin.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at `/api`)
- `pnpm --filter @workspace/tkdl run dev` — run the frontend (proxied at `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (dark mode by default, teal/amber palette)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle table definitions (players, seasons, matches, achievements, season_standings, player_achievements)
- `artifacts/api-server/src/routes/` — Express route handlers (players, matches, seasons, leaderboard, achievements, stats, broadcast)
- `artifacts/api-server/src/lib/elo.ts` — Elo rating calculation, tier assignment, points calculation
- `artifacts/api-server/src/lib/achievements.ts` — Achievement definitions and unlock logic (15 achievements)
- `artifacts/api-server/src/lib/seasonReset.ts` — Season close + new season creation + auto-reset logic
- `artifacts/tkdl/src/pages/` — All frontend pages (dashboard, leaderboard, players, submit-match, seasons, achievements, broadcast, admin)
- `artifacts/tkdl/src/components/` — Shared components (layout, tier-badge, rank-change)

## Architecture decisions

- **Automatic monthly season reset**: On every server startup, `maybeAutoResetSeason()` checks if the current season started in a previous calendar month. If so, it automatically closes the season (saves standings snapshot, crowns champion) and opens a new one. Zero admin required.
- **Elo rating system**: K=32, floor at 800. Points awarded per win scale with Elo difference (1–5 pts), rewarding upsets. Elo changes are bounded to at least 1.
- **Tier system**: Bronze < 950, Silver 950–1099, Gold 1100–1249, Platinum 1250–1399, Diamond 1400+. Recalculated on every match.
- **Season standings snapshot**: When a season closes, final standings are saved to `season_standings` table for permanent historical reference.
- **Broadcast mode**: `/broadcast` is a fullscreen, no-nav-bar page designed for workplace TVs — auto-refreshes every 30 seconds.

## Product

- **Dashboard** — Live stats summary, top 5 leaderboard, recent activity feed
- **Full Leaderboard** — Season rankings with Elo, tier badges, rank movement indicators
- **Submit Match** — Pick winner/loser from dropdowns (validates no self-play), auto-updates all stats
- **Player Profiles** — Career stats, season history, achievement showcase, recent matches
- **Season Archive** — Historical seasons with final standings snapshots and champions
- **Achievement System** — 15 achievements across wins, streaks, Elo milestones, and season titles
- **Broadcast Mode** — TV display with rotating leaderboard, recent matches ticker, featured player
- **Admin Panel** — Season reset (with confirmation), player activation, match deletion

## Gotchas

- The `seasons/reset` endpoint and `seasons/current` must come before `seasons/:id` in the router or Express will try to match "reset" and "current" as IDs. They do in `seasons.ts`.
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml` before touching frontend code.
- Seed achievements via `seedAchievements()` called in app startup — safe to call repeatedly (idempotent).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
