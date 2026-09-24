# Self-Play Unlocks + remaining Personalization gaps — Build Plan

Follows the 2026-09-24 status check on `PERSONALIZATION_IDEAS.md` / `CURRENCY_GAME_PLAN.md` (both now annotated as mostly stale — see those files). This covers the genuine remaining gaps you picked to prioritize: the three self-play unlocks (extra Shadow Bot personas, early bot-difficulty access, bonus Coach's Corner drills), dartboard skin, and account-page accent colour.

## Status check 2026-09-24 — shipped

Everything below except dartboard skin is built. What actually landed, and where it differs from the plan:

- **Shared foundation** — `self_play_unlock_definitions` + `player_self_play_unlocks` tables (`db/migrations/add_self_play_unlocks.ts`), a new `"self_play_unlock"` `CurrencyReason`, and `POST /api/players/:id/self-play-unlocks/purchase` (`routes/self-play-unlocks.ts`) — same session-ownership guard + `FOR UPDATE`-locked transaction pattern as the cosmetics purchase route.
- **Extra Shadow Bot personas** — you said "pick for me": locked the top two Elite personas by avg, **Luke Harbours** (109 avg, 300 coins) and **Luca Scrawler** (107 avg, 275 coins), leaving Mikkel van Garwin and Bill Tailor free so "Play a Pro" isn't gutted for non-spenders. `PersonaCard` (`BotPickers.tsx`) now has a locked variant reusing `ShadowPlayerPicker`'s existing lock visual.
- **Early bot-difficulty access → Preview Pass** — repurposed per your "Repurpose" answer, then refined once during scoping: a literal "preview a tier above yours" was redundant (Practice never touches real matchmaking, so nothing was actually gated). Landed as a **7-day Preview Pass** (120 coins) unlocking every currently-locked persona at once — cheaper than buying both permanently (575 combined), the trade being it expires. `expiresAt` on the ownership row, checked at read time.
- **Bonus Coach's Corner drills** — you said "pick for me, grounded in what the app tracks": two always-on advanced drills behind a single 200-coin "Coach's Corner Bonus Pack" — **180 Factory** (max-output scoring, targets your real logged 180 count) and **Bogey Number Buster** (bail-out practice from darts' real bogey numbers — 169/168/166/165/163/162/159 — the classic no-3-dart-finish scores). Folded straight into `generatePracticeRoutine()` alongside the free stat-conditional drills.
- **Account-page accent colour** — 6 purchasable swatches (new `ACCOUNT_ACCENT` cosmetic category, 120–250 coins), wired into the existing Cosmetics Shop as its own tab. Applied to the account page's tab bar (the active-tab indicator, previously hardcoded brand red) as a component-local constant rather than a CSS custom property — same scoping guarantee (only this file's own JSX reads it, nothing else can pick it up), simpler to reason about. **Not yet threaded through every other accent-coloured element on the page** (buttons elsewhere, other highlights) — the tab bar was the clearest, most-visible real touch point for a first pass; spreading it further is a small, mechanical follow-up if you want it.
- **Dartboard skin — dropped.** Found before building it: `dartboard-bg.tsx` is confirmed dead code, never rendered anywhere (only its sibling `useDartHit` hook is used, for animation state — the real scoring UI is a numeric keypad). There's an existing comment in `cosmetics.ts` from an earlier pass that already looked at this exact idea and rejected it for the same reason. You confirmed: skip it.

All new/edited files passed the established `tsc --noEmit` scratch-project check (filtered for the same implicit-any/unresolved-alias noise seen on already-shipped code throughout this app — no real errors).

---

## Self-play unlocks

**Shared foundation (new):** one migration, `add_self_play_unlocks.ts` — a catalog table (`self_play_unlock_definitions`: id, category, name, description, price, enabled) + an ownership table (`player_self_play_unlocks`: player_id, unlock_id, unlocked_at, unique pair) — same two-table shape as the existing cosmetics tables (`add_cosmetics_tables.ts`), reused across all three unlock types instead of three near-identical schemas. Spending goes through the existing `removeCoinsFromPlayer(playerId, amount, reason, detail?)` in `services/card-shop-service.ts` (row-locked, ledger-logged, already handles the race-condition class) — needs one new `CurrencyReason` literal added to the closed union in `lib/db/src/schema/player-currency.ts` (e.g. `"self_play_unlock"`). The purchase route needs the same session-ownership check as `card-clash.ts`'s spend routes (`sessionId !== Number(playerId)` → 403) — this is spend-money code, so it gets that guard from day one, not retrofitted later.

- [ ] **Extra Shadow Bot personas** — `lib/bot-engine.ts`'s `BOT_PERSONAS` (25 personas across elite/pro/county/club/amateur/beginner) are all fully open today, no locking at all. Proposal: gate a small curated set (need your pick — I'd suggest 2-3 of the Elite tier, since locking the *best* opponents behind a purchase is the usual shape for this kind of unlock, priced comparably to a big card pack, ~250-350 coins). `components/BotPickers.tsx`'s `PersonaCard` needs a locked variant — `ShadowPlayerPicker` in the same file already has one (lock icon, dimmed, disabled `onClick`, progress-bar-style copy) that's the right visual to copy, just swapping "darts logged" for "coins to unlock."
- [ ] **Bonus Coach's Corner drills** — drill content isn't a static list — `generatePracticeRoutine()` in `routes/practice.ts` (~line 1222) builds each player's drill set live from their real stats (e.g. a "checkout paths" drill only appears once avg ≥ 72 and checkout% ≥ 28). "Bonus" drills would be a small number of new always-eligible entries in that same function, additionally gated by an ownership check against the new unlock table. Needs 2-3 concrete drill ideas from you (what makes a "bonus" drill different from what's already there) before I write real content instead of filler.
- [ ] **Early bot-difficulty access — flagging a premise mismatch before building this one.** Checked `LevelBotPicker` in `BotPickers.tsx`: all 20 numeric bot levels are already fully open and clickable today, with zero unlock-pace gating of any kind. "Early access to jump ahead of the normal unlock pace" only means something if there's a pace to jump ahead of — there isn't one. Building this as originally scoped would mean *first* inventing a brand-new progression system that locks levels behind normal play, then selling a bypass for it — a much bigger, and backwards-feeling, project (you'd be adding a restriction that doesn't exist today just to sell removing it). Options: (a) skip this one, (b) repurpose it as something that already fits the app's shape — e.g. a coin-purchasable *preview* of a bot tier above your Elo/level without it affecting matchmaking, or (c) actually scope a real level-progression system as its own separate decision, unrelated to unlocks. Your call — I didn't want to quietly build (a fake gate) + (a key for it) without flagging that's what "early access" would actually require here.

## Dartboard skin

No `DARTBOARD_SKIN` category exists in `cosmetics.ts`'s `CosmeticDefinition.category` union today — needs adding there, a migration seeding a few skin definitions into `cosmetic_definitions` (reusing the existing cosmetics catalog/shop, not a new system), and `components/dartboard-bg.tsx` (confirmed zero cosmetic hooks currently) needs an actual skin-rendering path — right now it presumably renders one fixed look, so this also needs a few real skin designs (palette/pattern), not just plumbing. Smallest real design decision needed: how many skins, and what they look like (I can propose 3-4 starting options — e.g. classic/carbon/neon/chalkboard-pub, matching the profile-banner theme names already in `PERSONALIZATION_IDEAS.md`).

## Account-page accent colour

Scoped to account-page-only per your steer (not app-wide). Needs: a new cosmetic category (or a dedicated small `accent_color` field on `player_cosmetics`/equip state — a purchasable colour swatch is closer to `NAME_STYLE`'s shape than a discrete "definition" per colour), and `account.tsx` reading the equipped colour and applying it as a CSS custom property scoped to that page's own root container so it tints buttons/highlights there without touching shared components other players see (leaderboard rows, match screens, etc. must NOT pick this up — it's a personal page skin, not a name-tag people see elsewhere).

---

## Suggested build order (smallest/safest first)

1. Shared self-play-unlocks schema + purchase route (foundation everything else needs) — no visible feature yet, just plumbing, easiest to verify in isolation.
2. Extra Shadow Bot personas (the most mechanical of the three unlocks, reuses an existing locked-UI pattern almost exactly).
3. Bonus Coach's Corner drills (needs your input on drill content first).
4. Dartboard skin (needs a few real skin designs, not just wiring — smallest creative decision of the two cosmetic items).
5. Account-page accent colour (the app's own earlier proposal flagged this as the biggest single item on the list).
6. Early bot-difficulty access — held until you pick one of the three options above, since building it as literally described means building a fake gate first.

## What I need back from you before I keep building

1. Which 2-3 Shadow Bot personas to lock (or "pick for me").
2. 2-3 real bonus Coach's Corner drill ideas (or "pick for me, grounded in what stats the app already tracks").
3. Early bot-difficulty access — skip it, repurpose it, or treat it as its own separate progression-system project?
4. Dartboard skin — how many, and any theme preference (I can propose names/looks if you'd rather I just pick).
