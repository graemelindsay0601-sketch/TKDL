---
name: Scorer Platform Architecture
description: Live Scorer + Practice Mode architecture decisions and schema patterns
---

## GameScorer orchestrator
- `artifacts/tkdl/src/components/game-scorer.tsx` — central router; maps `gameType.engine` to scorer component
- Engines: X01, Cricket, Killer, Sequence, HalveIt, CountUp, Gotcha, NearestBull, Custom (then checks `gameType.key`)
- `GameTypeOption` type lives here — must include `enabled?: boolean` (not in original DB schema response until added)
- All scorer components live in `artifacts/tkdl/src/lib/scorers.tsx`

## Game types DB
- 62 game types seeded in `game_types` table; categories: competitive, practice, party, mini-games
- `rules_text` column added via `ALTER TABLE game_types ADD COLUMN IF NOT EXISTS rules_text TEXT` in `seedGameTypes()` — NOT in Drizzle schema
- Frontend `rules-modal.tsx` has static RULES object as fallback when `rules_text` is null/empty

## practice_sessions table
- Created via raw SQL in `seedPractice()` in `artifacts/api-server/src/app.ts` — NOT in Drizzle schema (same pattern as playoff_matches)
- Routes: POST /api/practice/sessions, GET /api/admin/practice/stats in `artifacts/api-server/src/routes/practice.ts`
- Practice page saves here on game-over; NOT submitted to leaderboard

## Nav / routing
- Practice nav item is always visible (no feature flag) — `Dumbbell` icon, `/practice` route
- Live Scorer (/play) is feature-flag gated via settings table `live_scorer_enabled`
- Admin has "Test Live Scorer" and "Test Practice" direct links (bypass feature flag) in FeatureFlags section

**Why:** Practice mode must never pollute the competitive leaderboard. Keep it structurally separate (different table, different save path, different nav item).
