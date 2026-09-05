# TKDL full-app sweep — findings (2026-09-04)

Read-only audit across the whole monorepo (backend routes/lib, Card Clash, achievements, broadcast, frontend, DB migrations). Nothing below has been changed yet — this is the punch list for you to prioritize. Findings are grouped by area, most severe first within each group. File:line references are relative to the repo root.

---

## 0. The one structural issue that makes everything else riskier

**`artifacts/api-server/src/app.ts:1042-1127` (`init()`)** — every startup migration/seed call (~40 of them) runs inside **one single try/catch wrapping the whole sequence**, with no per-call isolation. If any one call throws, the outer catch just logs it and returns normally — it does **not** rethrow, so the server reports healthy and comes up anyway. Everything sequenced *after* the failing call silently never runs, on every single boot, until someone happens to read the logs. This is exactly the mechanism that hid the `team_matches` bug fixed earlier today, undetected, for an unknown stretch of boots. `add_performance_indexes.ts` already shows the right pattern (per-statement try/catch) — worth using as the template to wrap each `init()` call individually so one bad migration can never again take out everything below it.

---

## 1. Security — money and access (fix soonest)

These are all live, unauthenticated, on the public URL:

- **`card-clash.ts:220`** — `POST /shop/purchase` takes `playerId` straight from the request body with no session check. Anyone can spend another player's coins on packs via a plain request.
- **`card-clash.ts:1203`** — `POST /sell-card` same pattern — sell another player's cards, coins land wherever the request says.
- **`card-clash.ts:1551,1572,1621,1682`** — purchase-status/featured-purchase routes use `session.playerId ?? body.playerId` — if a request simply carries no session cookie, it falls through to the attacker-supplied id, which defeats the check entirely.
- **`storage.ts:156`** — `GET /storage/objects/*` serves any private object with the ACL check (`canAccessObjectEntity`) present in the code but **commented out**. Anyone who obtains an object's UUID can read it regardless of ownership. Object ids are random UUIDs (not enumerable), which limits but doesn't eliminate exposure.
- **`auth.ts:22`** — `POST /auth/login` has no rate limiting at all (contrast with `/admin/verify-pin`, which does) — open to unlimited brute-force attempts.
- **`card-clash-favorites.ts:70,122`**, **`card-clash-settings.ts:300`** — no ownership check; anyone can edit another player's favorites/equipment preference by id (low impact, cosmetic data).
- **`card-clash.ts:264,282,243`** — `/debug/coins/:playerId`, `/pity/:playerId`, `/inventory/:playerId` are unauthenticated and leak another player's currency/pity/inventory. `/debug/coins` in particular looks like a leftover dev endpoint.

Everything else checked (admin.ts, settings.ts, players.ts, messages.ts, notifications.ts, community.ts, game-types.ts, broadcast admin routes) was properly gated — no other holes found, and no SQL-injection risk anywhere (all `sql` usage binds parameters correctly).

---

## 2. Money/currency correctness (Card Clash)

- **`card-shop-service.ts:418-420` (High)** — `removeCardFromPlayer` unconditionally pays a flat 10 coins internally, but `POST /sell-card` (`card-clash.ts:1203-1226`) *also* pays rarity-based coins afterward. **Every card sale is double-paid** — a Common pays 20 instead of 10, a Legendary pays 110 instead of 100. Same double-payout fires by accident on admin `POST /admin/card/remove` (`card-clash.ts:821-832`).
- **`featured-card-shop-service.ts:190-235` (High)** — `purchaseFeaturedCard` reads the player's coin balance outside the transaction and never row-locks it (unlike the ordinary pack purchase path, which does this correctly). Two concurrent purchases (double-click, two tabs) can both pass the affordability check against the same stale balance — both deliver a card, only one deduction survives.
- **`card-clash-service.ts:138-154` / `card-clash-season-rewards.ts:87-110` (High)** — matches are inserted with `seasonId` always NULL, but season-end reward calculation filters matches by `season_id = X`. **`POST /admin/season/end` will find zero matches for any season and pay out nothing**, even after a season of real play. This is admin-triggerable today.
- **`card-clash-achievements.ts:269-290` / `free-pack-service.ts:92-147` (Medium)** — both pack-open and free-pack-claim use a separate read-then-write instead of one atomic update, so two concurrent requests can both pass the check and double-claim.
- **`card-clash.ts:498-506`** — `/standings/:seasonId` reads from a table (`card_clash_standings`) nobody writes to anymore (standings moved to a live computation and the old write path was removed, but not this read path) — always returns stale/empty data. Low blast radius since the frontend calls the live `/standings` endpoint instead.
- **`card-effects.ts`** — two duplicate `case` labels in `applyCricketBadCard` (lines 393/471 and 411/488) are dead code, likely a copy-paste that masks an intended second effect; `"Lowest dart +10"` (lines 121-124) computes a value it never uses and always applies a flat +10 regardless.

---

## 3. Match/points/season correctness (core league)

- **`matches.ts:446` (High)** — deleting/reversing a **team match** only reverts the two `matchesTable` captain rows; every other participant (tracked via `matchParticipantsTable`) keeps their points/elo/streak changes, and the participant rows are orphaned.
- **`matches.ts:493` (High)** — even the captain's own reversal is wrong for uneven teams: forward logic splits the pot unevenly per player, reversal subtracts the flat `stake` regardless.
- **`team-matches.ts:69` (High)** — this route never got the `SELECT ... FOR UPDATE` row-locking fix that `matches.ts`/`doubles.ts`/`shift-wars.ts` all already have, so two concurrent team-match submissions sharing a player can clobber each other's stat changes.
- **`seasons.ts:249` (High)** — the playoff PATCH endpoint builds a dynamic `sets`/`vals` array for the update but never actually uses it — the real query unconditionally does `SET winner_id = <value from this request, or NULL>`. Patching just `notes` on a playoff match **wipes out an already-recorded winner** with no error. Looks like an abandoned refactor.
- **`matches.ts:506` (Medium)** — Elo reversal doesn't respect the 800 floor the forward path clamps to, so undoing a match that hit the floor over-credits the loser's Elo.
- **`seasonReset.ts:260` (Medium)** — no lock between the nightly cron season-reset and an admin-triggered manual reset; landing in the same window could create two new season rows.
- **`matches.ts:22` (Low)** — per-leg stat fields (180s, checkout hits/attempts) accept negative numbers and don't check hits ≤ attempts.
- **Test coverage**: only the pure math (elo.ts, wager.ts, iso-week.ts, singles-champion.ts) is unit-tested. None of the route files above — where every finding in this section lives — have any test coverage at all.

---

## 4. Achievements & mini-games

- **`achievements.ts:698-706` (High)** — GENIUS ("win 3 times as underdog") actually fires on the **second** upset win, not the third, because it only checks whether TACTICAL (which fires on the first upset) was already held.
- **`practice.ts` + `achievements.ts:652` (High)** — the ~130 practice-mode achievement definitions only get checked as a side effect of a *league match* or an admin-triggered sweep. `POST /practice/sessions` never calls the practice-achievement check. **A player who only ever plays Practice mode can't organically unlock any practice achievement or title.** (Master501 does this correctly, by contrast.)
- **`format-and-meme-achievements.ts` (High)** — roughly 150 seeded achievements (all the X01/Cricket/Sequence/Halve-It/Count-Up/Killer/Specialty/Party groups, plus a handful of named ones) have no `grantIfNotHas` call anywhere in the codebase — they're visible in the catalog but **permanently unearnable**.
- **`format-and-meme-achievements.ts:212-217` (Medium)** — five achievement keys are defined a second time with different criteria than their original definition in achievements.ts; because seeding upserts in file order, the catalog's displayed description/criteria for these can silently disagree with what the code actually grants.
- **`titles.ts:65` (Medium)** — TITLE_ASSASSIN requires an achievement key (`ASSASSIN`) that was deliberately retired/deleted elsewhere — this title can never unlock.
- **`challenge-service.ts:90-97,254-260` (Medium)** — weekly challenge uniqueness key is the ISO week number with no year attached; at a year boundary a stale prior-year "week 1" row can be reused instead of resetting.
- **`practice-achievements.ts:162-171` (Low)** — the "100+ checkout" achievement is approximated as session-average score-per-checkout, so it can both false-positive and false-negative against a real single 100+ finish.

Boss Battles and Board Curse were checked and are solid — atomic progress updates, no desync risk found.

---

## 5. Broadcast (follow-on from today's work)

- **`story-detectors-league.ts:371` (High)** — `SEASON_KICKOFF` has the *exact same* frozen-freshness bug CHAMPION had (fixed earlier today): it's written once on the first batch of a new season and never re-evaluated after, so its score never decays. Unlike CHAMPION/SEASON_RECAP, it was **not** added to the exclusion list in `director.ts`, so a month-old "new season begins" story can still squat on the main/supporting slots the same way CHAMPION used to. Same fix applies: add it to the closed-matter-style exclusion, or (more robust) re-run its detection every batch instead of only the first.
- Nothing else in the broadcast folder shows the same array-binding or wrong-table-name bug classes from earlier today — checked every `sql\`` call site and every raw table reference against the real schema, all clean.
- The diagnostic fields added to `/admin/broadcast/status` during today's investigation (`currentSeasonStories`, `seasonReviewDiagnostics`) are admin-gated and fine to leave, but worth a conscious decision on whether to keep them long-term or trim once things are stable.

---

## 6. Frontend — the exact bug class from today's points issue

- **`play.tsx:707-826` (High)** — **this is almost certainly today's actual points bug.** The "Play" match flow (as opposed to Submit Match) only invalidates the leaderboard/stats-summary/recent-activity/match-list caches after a match — it never invalidates the per-player stats query, unlike `submit-match.tsx`'s equivalent handlers, which do. Right after logging a match via Play, the leaderboard updates immediately but a player's own profile page keeps serving its cached data for up to 5 minutes (the profile query's `staleTime`) — which also explains why it "resolved itself" before we could pin it down further.
- **`admin/index.tsx:182-200` (Medium)** — the admin "edit match" action (which recalculates Elo) invalidates matches/leaderboard but not the two players' own stats/profile queries, unlike the adjacent delete-match handler right above it, which does.
- **Match/Play submission (Medium)** — no submission path invalidates the players list query, so the player-picker on Submit Match/Play can show pre-match points if you try to log a second match without reloading.
- **`admin/season-editor.tsx:61`, `admin/game-types-manager.tsx:32` (Low)** — a one-time load is triggered from `useState(() => {...})` instead of `useEffect` — works today but is fragile under React StrictMode/concurrent rendering.

Routes/links, hooks-usage, and mock/hardcoded data were all checked across the main pages — no issues found there.

---

## 7. Database / migrations

- **`add_achievement_season_column.ts:37-42` vs `add_performance_indexes.ts:42-45` (High)** — the season-column migration deliberately drops the old 2-column unique index on `player_achievements` and replaces it with a 3-column one so seasonal achievements can be re-earned each season. A *later* migration in the boot sequence recreates the old 2-column unique index under the same name with `IF NOT EXISTS` — which doesn't block it, since the name was freed up. Net effect: the seasonal-achievement fix is **silently undone on every boot**, and both indexes now coexist, blocking re-earning a seasonal achievement in a second season.
- **`lib/db/src/schema/team-matches.ts` (Medium)** — defines a `team_matches`/`team_match_participants` schema that is never created in the real database and never queried anywhere (the real team-match route uses the ordinary matches table filtered by game type). This orphaned schema is almost certainly what led to the `team_matches` bug fixed earlier today — worth deleting so it can't mislead anyone again.
- **`add_season_league_type.ts:87-94` (Low)** — runs an unconditional cleanup DELETE on every single boot rather than being a one-time cutover; currently harmless but not what "migration" implies.

---

## Suggested order of attack

If you want a place to start: the Card Clash purchase/sell auth gaps and the double-coin-payout bug (section 1 and 2) are the ones with direct real-money-equivalent impact on players and are quick, contained fixes. The `init()` failure-isolation fix (section 0) is the one change that would have caught today's bug hours sooner and would catch the next one just as fast — worth doing regardless of what else you prioritize. Everything else can be triaged at your own pace.

Happy to start working through any of these — just say which section(s) to tackle first.
