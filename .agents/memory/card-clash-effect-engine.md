---
name: Card Clash effect engine
description: How Card Clash card effects are wired into the scoring engine, entry-point gap, and a double-application bug pattern to watch for.
---

## Entry point (updated 2026-07-06 — the "no UI entry point" note below was stale)
Card Clash mode is activated by `sessionStorage` flags (`card_clash_mode`, `card_clash_p1_cards`, `card_clash_p2_cards`) written by `CardClashMatchScorer.tsx` and read inside `X01Scorer`/`CricketScorer` in `scorers.tsx`. The full live flow exists at `pages/card-clash.tsx` → `components/CardClashMatchLauncher.tsx` (steps: opponent → gamemode → matchlength → equipment-p1 → equipment-p2 → match, each using `components/CardEquipmentSelector.tsx`) → `CardClashMatchScorer.tsx` → `X01Scorer`/`CricketScorer`. This is a live, deployed (Render) production flow, not dev-only.

**Two-codebase trap:** the live/deployed TKDL app's Card Clash flow lives in the separate GitHub repo `graemelindsay0601-sketch/TKDL` (worked on via a `/tmp/gh-worktree` checkout, pushed via GitHub REST API using the `github` connector token), NOT in this Replit workspace's `artifacts/tkdl` — the local copy has diverged and lacks `card-clash.tsx`/`CardClashMatchLauncher.tsx` entirely. Always confirm which codebase a bug report is about before touching files; grep the local workspace for the page name first, and if absent, check `/tmp/gh-worktree` before assuming the feature doesn't exist.

## Double-application bug pattern
Conditional Wildcard cards (e.g. "Lucky Streak", "Momentum Surge", "Underdog", "Match Point") had two independent code paths: a manual hand-play activation (`ccActivateCard`) and an automatic per-turn global evaluation (`ccEvaluateConditionalWildcards`/`ccEvaluateOpponentWildcards`) that granted the same bonus to both players regardless of ownership — bypassing the card economy entirely.

**Why this matters:** when a card system has both a "played from hand" trigger and a "passively re-evaluated every turn" trigger for the same effect, always check whether the passive path duplicates/bypasses the active one before assuming a gap needs filling — the fix may be to remove the passive path, not add to either.

**How to apply:** condition-check bonuses are now computed inline in `ccActivateCard` (IIFE pattern checking `gs.legHistory`/`legWins`/`legsNeeded`) only at play time; the old passive evaluator functions are left defined-but-unused in `card-effect-engine.ts` for reference, not called.

## Cricket now has leg/set support (added 2026-07-06, supersedes earlier "no leg concept" decision)
`CricketScorer` was originally single-game-only by design (see git history), but the user explicitly asked to be able to choose match length (single/best-of) for Card Clash matches including Cricket. `legs`/`setsToWin`/`legsToWinSet` props + `legWins`/`setWins`/`legHistory`/`legStarter` state + `resetForLeg`/`handleLegWin` were ported over from `X01Scorer`'s pattern (same prop/state names, same `legsNeeded`/`setsNeeded` formulas) directly in `scorers.tsx`. Leg-conditioned Wildcard cards still only pass `legHistory: [], legsNeeded: 0` into `ccActivateCard` from Cricket's hand-play path (unchanged) — only match-length/leg-win progression was added, not full wildcard leg-awareness. If asked to extend wildcards to Cricket legs too, that's a separate follow-up.
**Also fixed the same day:** `CricketScorer` already referenced `legWins`/`legsNeeded` in `isCardClash` branches (leg-reset effect hooks, `useRef(legWins)`) from an earlier uncommitted card-effect audit, but those variables were never declared — a live ReferenceError once `isCardClash` was true. Declaring the state above fixed it as a side effect.

## checkoutOnly / "on a double" cards use range-based approximation (confirmed with user, 2026-07-06)
Cards like Unstoppable Checkout / Exact Finish that read "while on a checkout" or "hit your double" are implemented as "remaining score is checkout range (≤50 etc.)", not "you actually just hit a double." Confirmed as an acceptable simplification — don't flag this pattern as a bug in future audits of this card set.

## Unused-but-defined effect fields are a recurring bug source
Several `CCEffect` fields were defined on the type/data (e.g. `opponentMustBeAhead`, `maxMarksPerTurn`, `allowedMarkSegments` with wrong count) but never read/enforced anywhere in `scorers.tsx`. When auditing this card system, grep every `CCEffect` field name across `scorers.tsx` to confirm it's actually consumed somewhere — a field existing in the type is not evidence the behavior is implemented.

**Confirmed instance (2026-07-06):** `deferPenaltyToNextLeg` (Dark Cloud, Total Annihilation) was set on activation but never read in `ccExpireOnTurnEnd`, so pending penalties promoted straight to `active` on the opponent's very next turn instead of waiting for their next leg. Fixed by routing them into the existing `deferred_next_leg` status (already consumed at leg boundaries by `ccActivateDeferredNextLegEffects`), mirroring the pattern already used for `deferBonusToNextLeg`.

**Verification method that works for this card set:** don't trust the activation-map entry alone — some cards (Leg Reset, Streak Crusher, Win Bonus Removed, Momentum Killer, Number Prison, Perfect Game shutout) are implemented via `card.name === "..."` special-casing elsewhere in `scorers.tsx` rather than generic `CCEffect` field reads, so an apparently-empty activation object isn't automatically a no-op — grep for the exact card name too, not just its declared fields, before concluding it's dead.

## Chaos Mode (added 2026-07-09) — separate no-equip variant, bypasses the hand-play lookup
A second Card Clash sub-mode ("Chaos Mode", toggled at setup alongside "Equip Cards") skips pre-match card selection entirely: `sessionStorage.card_clash_chaos_mode="true"` + empty p1/p2 card arrays. Each fresh visit (gated on `visitDarts.length === 0`, keyed by `${turn}:${turnCounter}` in Cricket / `${turn}:${history.length}` in X01 to dedupe re-renders) deals 3 random cards via `drawChaosOptions(gameType, 3)` in `cards-data.ts`, rendered face-down by `ChaosCardReveal.tsx`; picking one flips and calls a dedicated `handleChaosCardActivation(card)` that calls `ccActivateCard` directly with the raw card — it does NOT go through the normal `handleCardActivation(cardId)` path, which looks the card up in `p1Cards`/`p2Cards` by id and would find nothing since Chaos mode's arrays are empty by design.
**Why:** keeping Chaos as a fully separate activation path avoids threading an "is this a lookup-by-id or a raw card object" branch through the existing equipped-card flow, at the cost of near-duplicate `ccActivateCard` call sites in X01Scorer and CricketScorer.
**Bot behavior:** on the bot's own visit-start trigger, the same effect auto-picks a random one of the 3 drawn options via the same handler (no UI shown to the human for the bot's picks).
