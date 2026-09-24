# TKDL Coin Economy — Game Plan

**Status check 2026-09-24: this doc was badly out of date.** It still opened with "Nothing here is built yet" — but Phase 0, Phase 1, and nearly all of Phase 2 already exist in the code on your machine. This looks like a large build session's work that was never reflected back into this checklist. Rewritten below to match what's actually there, confirmed by reading the real files (not guessed from file names).

**The likely reason this didn't feel true:** nothing has been committed/pushed via GitHub Desktop yet this session, so your live Render site is still running old code. All of this exists locally but hasn't shipped — worth pushing before assuming anything here still needs building.

Guiding rule that was followed throughout: **vanity-first, nothing that touches league or season outcomes.**

---

## Phase 0 — Foundations

- [x] **Card-shop account-protection gap** — closed. All four routes in `routes/card-clash.ts` check the real session player ID.
- [x] **Currency display name settled: "Coins".** Confirmed live in `CoinBalance.tsx`, `CosmeticsShop.tsx`, and `AchievementRewardModal.tsx`. One straggler found and fixed 2026-09-24: `CardClashShop.tsx` said "Available Coins:", now just "Coins:". The database column stays named `card_points` underneath — a display-only rename, not a schema change.

---

## Phase 1 — The Wallet hub

- [x] **Built.** `account.tsx` has a "Wallet" tab (nav entry + `SectionCard`) showing `<CoinBalance>`, an "Open Store" link, and `<TransactionHistory>` underneath.
- [x] **Transaction history: yes, included** — `TransactionHistory.tsx` is live, backed by `currency_transactions` and its `GET /players/:id/currency-transactions` route.

---

## Phase 2 — Cosmetic / vanity spends

Far more built than originally scoped. `lib/cosmetics.ts` now defines 18 categories, all purchasable/equippable through `CosmeticsShop.tsx`'s tabbed UI (search, rarity filter, owned/afford filters):

- [x] Profile banners, avatar frames, animated name effects, expanded profile icons, tagline style
- [x] Leaderboard badge/title tag, row highlight glow, flair icon (avatar badge), rank-up celebration effect
- [x] Personalized result-screen accent, victory/checkout effect, personal scorer theme — wired into `practice.tsx` and `play.tsx`'s result screens
- [x] Trophy Case (`TrophyCase.tsx`, pins up to 5), featured stat spotlight (`FeaturedStatBadge.tsx` + `lib/statSpotlight.ts`), season recap card (`SeasonRecapCard.tsx`)
- [x] Player card finish (matte/foil/holo/prismatic)
- [x] Custom profile tagline (free text, not just a style)
- [ ] **Not started:** a sitewide personal accent colour (tints buttons/highlights across your own profile page — flagged in `PERSONALIZATION_IDEAS.md` as a mini-project on its own), dartboard skin, milestone plaques (e.g. "100 matches played")
- [~] **Partial:** season-exclusive / tenure-gated cosmetics — a `purchasable: false` flag exists and one hardcoded exclusive (League Champion name style, awarded not sold), but no general rotating-by-season or tenure-unlock system
- [~] **Partial:** chat reactions — stickers can be attached to DMs, but there's no tap-to-react on messages/posts the way the original idea described

## Phase 3 — Self-play unlocks

**Status not yet confirmed** — this wasn't checked in the 2026-09-24 pass (extra Shadow Bot personas, early bot-difficulty access, bonus Coach's Corner drills, extra dart-profile slots). Worth a real look before assuming either way.

## Phase 4 — Smaller utility & social spends

- [x] Custom profile tagline (see Phase 2)
- [~] Chat reactions (see Phase 2 — partial)
- [ ] Name-colour change token as a standalone one-off (not built as a distinct mechanic — a new name style is just a normal shop purchase today)

---

## What's actually left to decide

1. **Push what's already built.** This is the biggest thing — a lot of real work is sitting unshipped.
2. Phase 3 needs an actual look before we know its status.
3. The not-started items above (sitewide accent colour, dartboard skin, milestone plaques, real season/tenure-gated cosmetics) are still open if you want them — the accent colour in particular was flagged as its own mini-project.
