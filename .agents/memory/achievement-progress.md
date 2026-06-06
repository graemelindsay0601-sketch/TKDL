---
name: Achievement Progress Endpoint
description: How per-player achievement progress is computed and displayed
---

## Endpoint

`GET /api/players/:id/achievement-progress`

Returns all 91 achievements enriched with:
- `isUnlocked`: boolean
- `unlockedAt`: timestamp or null
- `currentProgress`: number (how far along)
- `progressPct`: 0–100 percentage

## Progress Computation

STAT_BASED criteria map directly from player fields:
- `CAREER_WINS` → player.careerWins
- `CAREER_GAMES` → player.careerGamesPlayed
- `WIN_STREAK` → player.longestWinStreak
- `PEAK_ELO` → player.careerPeakElo
- `WIN_RATE` → computed (careerWins/careerGamesPlayed)*100
- `CAREER_POINTS` → player.careerPoints
- `ELIMINATIONS` → player.eliminationsCount
- `TOTAL_ACHIEVEMENTS` → count of unlocked
- `NEVER_ELIMINATED` → eliminationsCount===0 → 0 or 1

MATCH_EVENT criteria derived from match queries:
- `HIGH_STAKE_WIN` / `HIGH_STAKES_TOTAL` → count matches with stake >= threshold
- `SAME_OPPONENT_WINS` → max wins against any single opponent

SEASON_EVENT criteria from standings queries:
- `SEASON_WINS` → max wins in any single season
- `SEASON_POINTS` → max points in any single season
- `MULTI_SEASON_PLAYS` → seasons count
- `SEASON_CHAMPION_COUNT` → seasons with isChampion=true

Complex/event-based criteria (UPSET_WIN, TOP_RANKED_WINS, etc.) return 0.

## Frontend Usage

In `artifacts/tkdl/src/pages/player-detail.tsx`:
- Fetched separately via raw fetch() (not via generated hook, since endpoint isn't in OpenAPI spec)
- Filterable by status (all/unlocked/close/locked) and rarity
- Shows progress bar for locked non-hidden achievements
- Hidden locked achievements show as "🔒 ???"`
