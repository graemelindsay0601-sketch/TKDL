---
name: Tour Mode system
description: Full career-progression darts tour — 61 events, 6 tiers, KO + PL brackets, bot personas, trophies, achievements, scorer integration, nav + player-profile trophy cabinet
---

# Tour Mode — architecture summary

## What exists

All T001–T007 from the build plan are fully implemented and both packages typecheck clean.

### DB tables (raw SQL via app.ts startup)
- `tour_definitions` — 61 seeded tours across 6 tiers
- `player_tour_runs` — active/completed/eliminated/abandoned runs with JSONB bracket state
- `tour_trophies` — one row per player+tour+difficulty win, with gamerscore
- `tour_achievement_definitions` — seeded via `seedTourSystem()` in tourSeed.ts
- `player_tour_achievements` — awarded automatically on PATCH /api/tour/runs/:runId

### Key files
- `artifacts/api-server/src/lib/tourSeed.ts` — 25 personas, 61 tour definitions, TROPHY_GAMERSCORE, TOUR_ACHIEVEMENT_DEFS
- `artifacts/api-server/src/lib/bracketEngine.ts` — generateKOBracket, generatePLBracket, advanceKOBracket, advancePLBracket
- `artifacts/api-server/src/routes/tour.ts` — all API routes
- `artifacts/tkdl/src/pages/tour.tsx` — lobby: hero, tier collapse sections, difficulty picker, trophy pips, leaderboard
- `artifacts/tkdl/src/pages/tour-run.tsx` — bracket view: KO tree + PL standings/fixtures, bull-up overlay, GameScorer portal

### Tier structure (6 tiers, not 7)
T1 Pub & Local (12), T2 County Circuit (15), T3 Regional Circuit (18), T4 Q-School (4), T5 PDC Tour (11), T6 PDC Majors (1) = 61 total

### Routes registered
- GET /api/tour/definitions?playerId=N
- GET /api/tour/runs/:playerId
- GET /api/tour/runs/run/:runId  ← must come BEFORE /runs/:playerId
- POST /api/tour/runs
- PATCH /api/tour/runs/:runId
- GET /api/tour/trophies/:playerId
- GET /api/tour/achievements/:playerId
- GET /api/tour/summary
- GET /api/tour/all-trophies
- DELETE /api/tour/runs/:runId, DELETE /api/tour/trophies/:trophyId

### Scoring integration
- Bull-up phase (createPortal overlay) → setBullup → then setScoring
- GameScorer receives botConfig mapped from opponent.level via PERSONA_TO_BOT_LEVEL
- onWin fires handleMatchResult(playerWon) → PATCH → updates bracket + awards trophies/achievements

### Player profile
- Trophy Cabinet section in player-detail.tsx (collapsible, grouped by tour, difficulty pips)
- Tour achievements tab in achTab state

### Nav
- layout.tsx: tourModeNav + Tour Mode NavSection
- App.tsx routes: /tour and /tour/:runId

**Why:** Needed long-term memory for the tour system since tour-system.md topic file was missing from .agents/memory.
**How to apply:** Before building any tour feature, read this file to avoid recreating what exists.
