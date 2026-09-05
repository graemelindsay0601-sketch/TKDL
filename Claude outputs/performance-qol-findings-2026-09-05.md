# TKDL performance/QoL pass — what changed and what's left (2026-09-05)

Follow-on from the full-app correctness sweep. This pass audited DB query patterns, API payload/pagination, frontend bundle/load, frontend runtime performance, the broadcast subsystem specifically, and server infra/logging — then fixed the safest, highest-value findings directly. Everything below is either done (delivered, verified, ready for you to commit) or deliberately deferred (with the reason why).

---

## Delivered this pass (14 files)

All verified together: `tsc --build --force` clean on the API server, `npm test` 642/642 passing, frontend `tsc --noEmit` clean, frontend `npm run build` clean.

### Backend

- **`app.ts`** — removed a duplicate `maybeAutoResetLeagueSeasons()` boot call (it was running twice on every startup), and wired in the new indexes migration below.
- **`db/migrations/add_performance_indexes_2.ts`** (new) — three indexes: `matches(winner_id, played_at)`, `matches(loser_id, played_at)`, `master501_runs(player_id)`. Speeds up per-player history/stats queries that filter or sort on these columns.
- **`routes/stats.ts`** — `GET /stats/summary` now counts matches with SQL `COUNT(*)` instead of fetching every row and reading `.length`.
- **`routes/achievements.ts`** — `GET /achievements` now computes unlock counts with one `GROUP BY` SQL query instead of loading every `player_achievements` row into Node and counting client-side. Also added 5-minute `Cache-Control` headers here and on the two achievement-definitions sub-routes (shadow-bot, card-clash) — these are static catalogs that don't need a fresh DB hit on every request.
- **`routes/game-types.ts`** — same 5-minute cache header on `GET /game-types` (another near-static catalog).
- **`routes/players.ts`** — `GET /players/:id/stats` restructured from 6 sequential database round-trips into 3 batches: independent queries now run in parallel via `Promise.all`, and the two queries that genuinely depend on the first batch's results stay sequential. Also scoped the opponent-name lookup — it was pulling the *entire* players table just to get a few names — down to only the actual opponents in that player's match history.
- **`lib/seasonReset.ts`** — fixed a typecheck error (`currentSeason` needed an explicit `| undefined` type) left over from a concurrency-lock fix earlier in the day; this was blocking the build and had nothing to do with this pass, but it needed fixing to verify anything else.
- **`broadcast/live-events.ts`** — see "The live-poll fix" below.
- **`broadcast/story-engine.ts`** — see "The live-poll fix" below.

### Frontend

- **`index.html` / `src/index.css`** — consolidated font loading. Previously `index.css` had a render-blocking `@import` pulling Oswald/Inter/Share Tech Mono while `index.html` separately `<link>`'d a *different* set (Inter/Montserrat/Nunito) — Inter was being fetched twice, and Oswald (used everywhere for scores, ranks, headings) sat behind the slower path. Now there's one `<link>` in `index.html` for the fonts actually used app-wide, and the `@import` is gone from the CSS.
- **`pages/leaderboard.tsx`** — wrapped the `active`/`eliminated`/`maxElo`/`maxCarElo` derived arrays in `useMemo` so they're not recomputed on every render.
- **`pages/achievements.tsx`** — same treatment for the League tab's `base`/`filtered`/`sorted`/`counts`/`totalUnlocked` — these were recomputing on every render including every card hover, since `hoveredId` state lives in the same component. The memoization deliberately does not depend on `hoveredId`.
- **`pages/player-detail/index.tsx`** — this 1900+ line page had zero `useMemo` anywhere. The achievement-grid pipeline (normalizing Shadow Bot/Tour achievements, filtering by system/status, sorting, slicing for "show more") was being rebuilt from scratch on every render, including every tab/filter toggle. This required a bit more care than the other two pages: the achievement data doesn't depend on the player's own stats, so I hoisted the whole `useMemo` chain above the page's loading/not-found early returns (React's rules of hooks don't allow hooks after a conditional return) rather than leaving it in place and only wrapping it — the actual computations are unchanged, just memoized and moved a bit earlier in the function.

### Deploy size

- Deleted 20 unreferenced original PNGs from `public/assets` and `public/cards` (pack art, hub images, card grids) — each has a `.webp` version that's what the app actually references; the PNG originals were dead weight only counted in deploy size. This shrank those two folders from 61MB combined to about 10MB. **I can't delete files on your machine from here** — you'll need to remove these 20 files yourself; I've listed them below.

---

## The live-poll fix (the audit's headline finding)

The original concern: `broadcast/live-events.ts`'s `getLivePayload()` — hit by every connected viewer roughly every 30 seconds while a show is live — re-runs full story detection on every single poll, including (once a match has been played since the last published Edition) a real Title Predictor run with a 2,500-iteration Monte Carlo simulation. Since the "since when" cutoff only advances when the next Edition actually publishes (which can be up to a day away), that expensive recomputation could run on a ~30-second cadence, per viewer, for hours.

Two changes, both purely additive — same return shape, same data, no change to what stories/overlays get shown:

1. **Throttled the expensive call.** Added a small in-memory cache (10-second window) around the `detectAndUpdateStories()` call inside `getLivePayload()`. Concurrent viewers polling within that window now share one real computation instead of each triggering their own; a newly published Edition naturally busts the cache because it changes the cutoff the cache is keyed on. Everything else in the payload (leaders, ticker, overlays) still reads fresh from the database on every single call — only the expensive detection/prediction side effect is throttled.
2. **Wired up the simulation-count setting.** The Title Predictor's simulation count was already admin-configurable (`broadcast_simulation_count`, default 2500) but silently ignored — the three predictor call sites always hardcoded the default regardless of what was configured. `story-engine.ts` now reads the real setting once per detection batch and passes it through. If you ever want lighter/heavier simulations, the admin setting will now actually take effect.

Worth knowing: the file's own existing design already meant the common case (no new match since the cutoff) was cheap — it skips the Title Predictor entirely when there's nothing new to evaluate. This fix specifically targets the busier case: once there IS new activity, keeping repeat polls from each re-running the same expensive computation.

---

## Files to delete on your end

These 20 PNGs are safe to delete — confirmed zero references anywhere in the frontend source, each has a working `.webp` replacement already in use:

**`public/assets/`**: `card-clash-bg.png`, `packs-sheet.png`, `pack-purple-front.png`, `pack-purple-back.png`, `pack-league-front.png`, `pack-gold-front.png`, `pack-gold-back.png`, `hub-shop.png`, `hub-achievements.png`, `pack-league-back.png`, `hub-rules.png`, `hub-collection.png`, `hub-standings.png`, `hub-reference.png`

**`public/cards/`**: `cricket-good-grid.png`, `x01-good-grid.png`, `x01-bad-grid.png`, `cricket-bad-grid.png`, `card-types-template.png`, `card-backs.png`

(These happen to be Card Clash art assets, but this is pure dead-file cleanup with zero code or behavior change — nothing about Card Clash itself was touched.)

---

## Deliberately deferred — not done in this pass, with why

Roughly in order of how much it'd be worth coming back to:

- **Re-enabling the response-cache middleware** (`middleware/cache.ts`) — a working, already-built TTL response cache, currently commented out in `app.ts` with a note that it broke match submission at some point in the past. This is probably the single highest-leverage remaining fix, but it needs someone to actually figure out *why* it broke things first (or scope it away from mutation-heavy routes) rather than blindly flipping it back on. `routes/stats-detailed.ts` still calls `invalidateCache()` assuming it's live, which is currently dead code.
- **List virtualization on `leaderboard.tsx` / `season-detail.tsx`** — a proper windowed-list component (`VirtualizedLeaderboard.tsx`) already exists and is used by Card Clash pages, but the main leaderboard and season pages still render long lists with a plain `.map()`. Skipped because current player/team counts are small enough that it isn't a real problem yet — worth revisiting if the roster grows a lot.
- **Memoizing `BroadcastPlayer.tsx`'s child components** — its 500ms clock tick currently re-renders `StudioBackdrop`, `ScreenPanel`, `LiveTicker`, etc. even though their real props only change every several seconds. I deferred this because verifying it safely means visually checking the broadcast player render (via the dev-preview harness), and I'd rather do that as a deliberate, focused pass than fold it into a batch of other changes given how much careful work has already gone into that subsystem.
- **Collapsing serial per-player queries in `practice-achievements.ts` / `master501-achievements.ts`** into single set-based queries — these are admin/fire-and-forget paths, lower urgency.
- **Batching `lib/achievements.ts`'s `retroactiveSweep()`** — admin-only, not user-facing.
- **`edition-engine.ts` tweaks** (reordering `resolveClosedLeagueSeasons()`, adding a limit/season-scope to `diagnoseSeasonHighlights()`) — both admin/broadcast-internal, deferred given how much broadcast debugging already happened today; these deserve their own focused look rather than a drive-by change.
- **Parallelizing independent `init()` boot steps** — only affects cold-start/deploy latency, not runtime performance; deferred to avoid disturbing the careful sequencing the correctness pass just finished hardening.
- **Pruning unused npm dependencies** (`framer-motion`, `recharts`, `@uppy/*`, `onnxruntime-web` if truly unused) — worth a dedicated check before removing, since a false positive here breaks the build rather than just being slow.
- **Gating a couple of migrations' unconditional per-boot scans** (`add_performance_indexes.ts`'s dedupe delete, `backfill_broadcast_story_season_id.ts`'s update) behind existence checks — low cost today, but pure cleanup, not correctness or speed.

---

## Suggested order if you want to keep going

The response-cache middleware is the one that would move the needle most on a live-viewer night, but it needs investigation, not a flip of a switch. Everything else on the deferred list is optional, low-urgency polish — happy to tackle any of it whenever you want.
