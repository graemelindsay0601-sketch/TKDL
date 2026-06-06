---
name: TKDL Architecture
description: Key decisions for the Tesco Kilbirnie Darts League app — wager system, identity engine, OpenAPI type gaps, broadcast removal
---

## Points-Wager System
- Players start each season with 25 pts. Wager agreed between players; max = min(winner.points, loser.points).
- Loser transfers `stake` pts to winner. If loser reaches 0 → status=ELIMINATED (skull indicator on leaderboard).
- Elo is secondary (tiebreak only). Primary sort = `points` desc.

**Why:** Requested by user for a "skin in the game" mechanic.

**How to apply:** Any match submission goes through `lib/wager.ts` — validate stake ≤ min(p1.pts, p2.pts), deduct/add, check for zero.

## Identity System
- `lib/identity.ts` computes archetype (TITAN/HUNTER/etc), aura (DOMINANT/RISING/etc), title ("The Champion"/"The Veteran"/etc) per player from stats + season context.
- Leaderboard endpoint computes identity on every request. Player stats endpoint also returns `identity` at the top level of the response object (NOT nested inside `player`).

**How to apply:** Frontend reads `(stats as any).identity` not `player.identity`.

## OpenAPI / Generated Type Gaps
- The generated `Player` type is missing: `tier`, `nickname`. Access both via `(player as any).tier` / `(player as any).nickname`.
- `Achievement` type missing `threshold`. Use `(achievement as any).threshold`.
- `LeaderboardEntry` type missing `isChampion`, `playerNickname`. Use `(entry as any).isChampion`.
- Tier is NOT stored in the DB seed — always derive it from elo on the frontend: `elo >= 1100 → Gold, ≥ 980 → Silver, else Bronze`.

**Why:** Spec was written pragmatically; codegen types are narrower than actual API responses.

## Broadcast
- Broadcast page and route deliberately removed. Do not re-add.

## Seeded Data (June 2026 baseline)
- 15 players: 11 ACTIVE, 4 INACTIVE (Aiden P011, Brodie P012, Joanna P013, Roddie P014).
- Seasons: FEB_2026 (champion=Robert), MAY_2026 (champion=Sean), JUNE_2026 (active, 5 matches).
- Sean: 44pts, 3W-0L, Elo 1036, DOMINANT aura, TITAN archetype.

## React falsy-0 gotcha
- `{player.currentWinStreak && ...}` renders "0" when streak is zero. Always use `{(player.currentWinStreak ?? 0) >= N && ...}`.
