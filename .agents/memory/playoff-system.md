---
name: TKDL Playoff System
description: How the playoff match system works — DB, backend, frontend
---

## Database

`playoff_matches` table was created directly via psql, NOT through Drizzle schema migration:
```sql
CREATE TABLE playoff_matches (
  id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id),
  player1_id INTEGER NOT NULL REFERENCES players(id),
  player2_id INTEGER NOT NULL REFERENCES players(id),
  winner_id INTEGER REFERENCES players(id),
  round TEXT NOT NULL DEFAULT 'final',
  game_type TEXT NOT NULL DEFAULT 'Best of 3',
  notes TEXT,
  played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Why:** Adding to Drizzle schema would require a migration push; direct psql was faster and the table is simple.

**How to apply:** If DB is wiped, run the CREATE TABLE above before using the playoff features.

## Backend

Endpoints in `artifacts/api-server/src/routes/seasons.ts`:
- `GET /api/seasons/:id/playoff` — list playoff matches for a season
- `POST /api/seasons/:id/playoff` — create a playoff match (optional winner)
- `PATCH /api/seasons/:id/playoff/:matchId` — update winner (crowns champion if round=final)
- `DELETE /api/seasons/:id/playoff/:matchId` — remove a match

Setting winner on a `round=final` match automatically:
1. Sets seasons.championId
2. Sets seasons.playoffPending = false
3. Updates season_standings.is_champion

## Frontend

In `artifacts/tkdl/src/pages/seasons.tsx`:
- Each non-live season card has an expand button ("Playoff & Standings" / "View Standings")
- Expanded view shows league standings + PlayoffSection component
- PlayoffSection loads playoff matches, shows top-4 qualifiers from standings
- Add Match form: pick player1, player2, round, format
- Each pending match has "tap to win" buttons on both players → immediately sets result
- Final match winner triggers page reload to refresh champion data
