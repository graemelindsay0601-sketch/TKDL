---
name: Shadow Bot detail page
description: Architecture of the dedicated /shadow-bot/:playerId bot detail page and related changes
---

## Shadow Bot improvements (June 2026)

**New page:** `artifacts/tkdl/src/pages/shadow-bot-detail.tsx` — `/shadow-bot/:playerId`
- Fetches `/api/players/:id/shadow-bot-stats` (stats/capabilities)
- Fetches `/api/shadow-bot/:id/matches` (match history vs this bot)

**Hub redesign:** `shadow-bot.tsx` — all roster cards are now `<Link href="/shadow-bot/:id">` (not scroll-to buttons). Removed "My Bot" inline section — replaced by detail pages.

**Match tracking:** `shadowPlayerId` added to `session_data` JSONB in practice_sessions for all shadow-bot games going forward (set in practice.tsx `buildSetupData()` + `PracticeOverScreen` handler).

**API endpoint:** `GET /api/shadow-bot/:playerId/matches` in `practice.ts` — queries `session_data->>'shadowPlayerId'::int = playerId`.

**Bug fixed:** API `shadow-bot-stats` locked branch had `darksNeeded` (typo) — corrected to `dartsNeeded` to match frontend types.

**Player profile link:** `/shadow-bot?player=${id}` → `/shadow-bot/${id}` (direct to detail page).
