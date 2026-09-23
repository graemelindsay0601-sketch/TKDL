# TKDL Coin Economy — Game Plan

A working checklist to tick off before anything gets built. Nothing here is built yet — this is the menu to approve from.

Guiding rule for everything below, per your steer: **vanity-first, nothing that touches league or season outcomes.** Self-play unlocks (drills, bot difficulty) are the one category that isn't pure cosmetic, but they only affect practice-mode content — never a real match, standing, or season result.

---

## Phase 0 — Foundations (recommend doing regardless of the rest)

These aren't new features — they're cleanup that everything else will otherwise inherit.

- [ ] **Close the card-shop account-protection gap.** Buying packs, opening packs, selling cards, and buying featured cards currently trust a client-supplied player ID with no server-side check — a player could currently spend/grant against someone else's account. The cosmetics shop already does this correctly (checks the real login session, rejects a mismatch); this is the same fix applied to four more endpoints. Low risk, proven pattern, and every new spend option below adds another endpoint that needs this same protection — better to fix the pattern once now.
- [ ] **Settle the currency's display name.** Right now the same balance is called five different things depending on which screen you're on: "Wallet" (dashboard), "Card Coins" (the balance widget used almost everywhere), "Available Coins" / "Your Coins" (the two shops), "Card Points" (achievement reward popup), and `card_points` under the hood in the database. Pick one player-facing name and it gets applied everywhere in one pass. My suggestion: plain **"Coins"** — it's already what most screens lean toward and reads naturally next to "Wallet." Your call though.

---

## Phase 1 — The Wallet hub (this is the "hook it into the account page" part)

- [ ] A new **Wallet** tab/section on the account page, becoming the one place that shows: current balance, a simple history log (e.g. "+20 League win", "-50 Card pack"), and a set of links out to everywhere the balance can be spent — instead of spending being scattered across separate Cosmetics/Cards tabs with no shared home.
- [ ] Decide: do you actually want the transaction history log, or is just the current balance + shop links enough? (History is a nice touch but is its own small chunk of build work — worth confirming before it's assumed in.)

---

## Phase 2 — Cosmetic / vanity spends (the priority category, per your steer)

Everything here is visual only — no effect on stats, rankings, or match outcomes.

- [ ] **Profile banners** — a background/header treatment on the account page and player-detail view.
- [ ] **Avatar frames** — decorative border around the profile picture.
- [ ] **Leaderboard badge/title tag** — a small unlockable label shown next to your name on the leaderboard (e.g. a title like "Iron Arm" or a seasonal badge), purely decorative.
- [ ] **Animated name effects** — building on the name-colour styles that already exist in Cosmetics, an extra tier of flashier/animated versions.
- [ ] **Personalised match/result screen accent** — a colour theme applied to your own Practice/Master501/Tour result screens.

These slot naturally into the existing Cosmetics shop as new item categories rather than needing a whole new shop.

## Phase 3 — Self-play unlocks (practice-only, never touches real matches)

- [ ] **Extra Shadow Bot personas** — unlock additional bot opponents to practice against.
- [ ] **Early access to harder bot difficulty tiers** — jump ahead of the normal unlock pace in Shadow Bot / Master501-style ladders.
- [ ] **Bonus drills in Coach's Corner** — extra drill content beyond what's normally available.
- [ ] **Extra saved dart-profile slots** — if there's a cap today, coins could raise it.

Worth flagging explicitly since it's the one category with any functional effect: this only ever unlocks *more practice content*, never anything that changes a real league match, a season standing, or head-to-head results.

## Phase 4 — Smaller utility & social spends (lowest priority, nice-to-haves)

- [ ] **Name-colour / display-name change token** — a one-off cosmetic change outside the normal flow.
- [ ] **Custom profile tagline/status** — a short personal line shown on your profile.
- [ ] **Chat reactions** — if worth building into the existing Messages feature.

---

## What I need back from you

1. Tick (or cross out) whichever items above you actually want — doesn't need to be all-or-nothing, and Phase 4 can just be dropped if it's not interesting.
2. A name for the currency (Phase 0) — "Coins," or your own preference.
3. History log in the Wallet hub — yes or no (Phase 1).
4. Green light on the Phase 0 security fix — happy to do that one on its own, independent of everything else, whenever you say go.

Once I know which of these are in, I'll break the approved list into a build order (smallest/safest first) and we can start ticking them off for real.
