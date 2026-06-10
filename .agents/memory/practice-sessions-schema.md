---
name: practice_sessions schema quirks
description: Column naming in the practice_sessions raw SQL table — commonly misnamed in queries
---

# practice_sessions column naming

**Rule:** The player FK column is `player1_id`, not `player_id`. The 180s column is `p1_180s`.

**Why:** The table was created as a raw SQL raw table (not Drizzle schema) with a two-player design (`player1_id`, `player2_id`). Any code that references `player_id` will get a SQL error.

**How to apply:**
- Aggregate per-player: `SELECT player1_id AS player_id, ... FROM practice_sessions WHERE player1_id IS NOT NULL GROUP BY player1_id`
- 180s column: `SUM(p1_180s)` (integer, default 0)
- Other per-player columns: `p1_darts`, `p1_score`, `p1_checkout_attempts`, `p1_checkout_hits`
- Bot/opponent columns use `p2_*` equivalents and `player2_id`
