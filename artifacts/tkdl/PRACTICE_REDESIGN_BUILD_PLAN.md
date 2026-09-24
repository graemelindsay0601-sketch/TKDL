# Practice Mode Redesign — Build Plan

Follows five rounds of mockups (v1–v5, published as Artifacts during the brainstorm session) ending on v5 — "lets lock that in." v5's core idea: replace the old fixed 4-tab game switcher (which still needed its own internal scroll box on top of the page's own scroll) with a searchable, filterable, collapsible browser covering all games at once, plus a way to jump straight back to favourites. Everything below is the agreed scope, broken into a build order so nothing from the mockup discussion gets lost.

The mockups (v1–v5) were built against invented placeholder data — a hardcoded 87-game list with fields the real app doesn't have (per-game "quick/marathon" length, "official/original" pedigree, "best for" tags, a curated diagram per game). The real game catalog comes from `/api/game-types` and only carries `{ id, key, name, engine, category, description, config, enabled, rulesText }`. Phase 1 below is scoped to what the real data actually supports, honestly — no invented taxonomy got ported in as if it were real.

---

## Phase 1 — Browsable game picker — **shipped 2026-09-24**

`src/pages/practice.tsx`, `SetupScreen`'s "Game Type" section.

- [x] **Sticky search + category bar** — replaces the old 4-tab switcher (Competitive/Practice/Party/Mini-Games) with an always-visible search box (`Search N games…`, filters by name + description) and "All / Competitive / Practice / Party / Mini-Games" quick-nav pills with live counts, `position: sticky` so it stays reachable while scrolling.
- [x] **Collapsible category sections** — instead of one category hidden behind a tab at a time, all matching categories render as sections you can collapse/expand independently, so you can see the shape of the whole catalog and drill into just what you want.
- [x] **Favourites** — star any game card; a favourites row appears above the sections once you've starred anything, click to jump straight to that card (auto-expands its category if collapsed, scrolls to it). Device-local (`localStorage`), not per-player — Practice has no login requirement (shared walk-up device), so there's no "who's about to play" to hang a per-player favourites list off before they've even picked a game.
- [x] **Expandable info card** — click the chevron on a card to reveal its description and a "Full rules" button straight into the existing rules modal, without leaving the browsing flow. Clicking the card body still selects the game for setup, same as before — star and chevron are separate hit targets.
- [x] **Surprise Me** — picks a random game from whatever's currently visible (respects your search/filter), selects it, expands it, and scrolls to it.
- [x] **Back-to-top button** — floating button appears once you've scrolled past ~480px.
- [x] Custom/Handicap card kept pinned above the browser, unaffected by search/filters — unchanged behaviour.
- [x] Everything else on the setup screen is untouched: mode toggle (2 Players/Solo vs CPU/Solo Play), Coach-drill deep-link banner, bot picker (Level Bot/Play a Pro/Player Clone), per-game leaderboard, X01 format picker (legs/sets), Bull Up toggle, start button.

## Set aside (from the mockups, not ported)

- **Invented "quick/marathon/official/original" tags and "best for" labels** — these were placeholder flavour text for the mockup demo, not real data. Doing this honestly would mean a schema change (`game_types` columns) plus someone actually curating length/pedigree for 87 games, which nobody's asked for — left out rather than faked.
- **Literal animated flying-dart for Surprise Me** — the mockup's version computes a trajectory between two DOM rects and animates an SVG dart along it. Kept the *result* (Surprise Me still picks, selects, and scrolls to a game) but dropped the flight animation itself — this session has no way to actually run the app and watch it, so a purely decorative animation with real layout-math risk (wrong rect timing, wrong z-index over the sticky bar) wasn't worth shipping unverified. Can be revisited with the animation once someone's watched it work live.
- **87-game hardcoded catalog** — the mockup's list was for demo purposes only; Phase 1 reads the real `/api/game-types` catalog, whatever games are actually enabled.

---

## Phase 2 — Not started: visual reskin

The jewel-tone "all-out premium" look from v3–v5 (void-black background, magenta/violet stage glow, gold gradient CTAs, Anton display font, per-category colour accents) was designed and approved for the *mockup*, but Phase 1 above ported the v5 **structure** into the existing Practice page's current visual language (Oswald font, purple `#a78bfa` accent, `rgba(255,255,255,x)` panels) rather than the mockup's bespoke palette/fonts, to keep the change reviewable as "does the browsing behaviour work" separate from "does the whole page look different." Applying the actual v3–v5 visual identity to the live page — new fonts, background glow, gold/magenta gradients — is unstarted and would touch more than just the game picker (header, mode switch, player fields, CTA button).

## Phase 3 — Not started: real player avatars

v4's player-picker mockup (avatar circles with cosmetic frame rings, click-to-open dropdown) is achievable for real — the app already has a working FRAME cosmetics system (`frameStyle()` in `src/lib/cosmetics.ts`) used elsewhere. Not done yet because it needs equipped-cosmetics data for *every* player in the picker list at once; today that's only ever fetched for a single logged-in player (`/api/players/:id/cosmetics`, used in the post-game result screen). Would need either a bulk endpoint or N parallel fetches for the player dropdown.

## Phase 4 — Not started: live stats

The "Jump back in" resume card and "Trending this month" stats strip from the mockups both need real backend aggregation that doesn't exist yet — most-recent-session-per-device/player, and monthly popularity/streak counts. Not attempted blind; would need its own small design pass on what "trending" honestly means before building a query for it.

---

## What's next

Phase 1 is live — the actual complaint ("still seems like a scroll fest, can we make it easier to navigate") is addressed: search, jump-to-category, collapsible sections, and favourites replace the old tab-plus-inner-scrollbox layout. Phases 2–4 are visual polish and features that need either a design decision (Phase 2) or backend work (Phases 3–4) — none of them blocking, just not done yet.
