# Off the Oche — Build Plan

Supersedes `COMMUNITY_TAB_REWORK.md`. Name settled after two rounds of mockups and two rounds of naming/feature brainstorm: **Off the Oche** — the tab for everything that isn't the competitive, on-the-line stuff. Everything below is the agreed scope, broken into a build order so nothing from the discussion gets lost.

---

## Phase 1 — Rename + core visual rework — **shipped 2026-09-24**

- [x] Renamed nav label and page header: Community → Off the Oche (`layout.tsx`, `community.tsx`)
- [x] Added the tagline ("Whatever's on your mind — on or off the oche.")
- [x] Relabeled the two existing rails to match the new identity — "Active this week" → "Who's about", "Best of the week" → "Top of the board" (same features underneath, just renamed)
- [x] Composer is now always present in the feed flow instead of gated behind a header button — collapses to a one-line "Chalk something up…" bar, expands to the real form on click
- [x] Post header simplified — dropped the tier-badge pill next to each name; the avatar ring colour and win-streak flame already carry that signal without it
- [x] Photos given a bit more room (360px cap → 440px)
- [x] *(already shipped in an earlier session, not new today)* auto-generated match/tier/elimination posts no longer appear here — Hub → Pulse only

Tabs (All/Photos/Mine) and the New/Top sort toggle already matched the mockup and needed no changes.

---

## Phase 2 — Structural additions — **shipped 2026-09-24**

- [x] **Pinned admin posts** — `pinned`/`pinned_at` on `community_posts` (`add_community_post_pin.ts`), `POST /community/posts/:id/pin` and `/unpin` (admin-only, approved manual posts only), feed query floats `pinned DESC` first, client-side sort keeps pinned on top regardless of New/Top. Pin toggle button lives next to edit/delete on each post for admins; pinned posts get a small "📌 PINNED" strip.
- [x] **Search within the feed** — `GET /community/posts?q=` does an `ILIKE` over content + player name; frontend has a search bar above the tabs that swaps the feed to server-side results while active (tabs/sort hide during a search rather than stacking two filters).
- [x] **Who reacted** — `GET /community/posts/:id/reactions` groups reactors by emoji; tap the eye icon next to the reaction bar to reveal names inline.
- [x] **Comments shown inline** — first 2 comments now load automatically and show under the post; "View all N comments" expands the rest. Reply box is always available to signed-in users instead of being behind a toggle.
- [x] **@mentions** — `mentioned_player_ids` on `community_posts` (`add_community_post_mentions.ts`). Deliberately conservative resolution: a `@token` only resolves when it matches exactly one player's name (spaces/underscores stripped, case-insensitive); anything ambiguous or unmatched stays plain text. Notifies (`post_mentioned`) once the post is actually approved and visible, not at submit time. Rendered as real profile links in the feed.
- [x] **Sticker reactions** — five darts-themed multi-character reactions ("🎯 BULLSEYE", "🔥 ON FIRE", "💥 180!", "🍀 LUCKY", "🤝 GG") reusing the existing free-text reaction column, shown as a second gold-tinted row under the plain emoji. Deliberately not gated by owned STICKER cosmetics — a flat set anyone can use; cosmetic-gated stickers are a possible future enhancement, not this one.

## Phase 3 — Retention & incentive features — **shipped 2026-09-24**

- [x] **Wall of Fame** — `GET /community/wall-of-fame`, all-time top 8 approved posts by reaction+comment score. Collapsed by default under the feed (page's already dense), fetched lazily the first time it's opened.
- [x] **Coin reward** for the weekly Top of the Board winner — `services/communityTopPostScheduler.ts` runs hourly, checks the currency ledger (`reason = 'community_top_post'`, `detail` = the paid week's `getIsoWeekKey()`) so it can't double-pay no matter how often it runs or how many restarts it survives. Pays the post with the highest reaction+comment score in the most recently completed ISO week (+25 coins), skips paying if nothing scored above zero that week, and sends a `top_post_reward` notification.
- [x] **Quick-post templates** — five chip buttons in the composer (Match result / Session recap / Funny moment / Looking for a game / Shoutout) that just prefill the text box; never post on their own.
- [x] **Save/bookmark** — `post_bookmarks` table (`add_community_post_bookmarks.ts`), `POST /community/posts/:id/bookmark` toggle, a new "Saved" tab (signed-in users only) alongside All/Photos/Mine.
- [x] **"This day last year"** — `GET /community/throwback`, a fuzzy ±3 day window around exactly 365 days ago, closest match wins. Shows as a dismissible card near the top of the page when one exists; dismissal is session-only.

## Phase 4 — Lower priority (not started)

- [ ] **Status line** next to avatars in Who's About — reuses the existing tagline cosmetic field, just surfaced in a new spot
- [ ] **Grouped photo galleries** — collapse same-night multi-photo posts into one card; worth doing once photo-posting volume actually justifies it
- [ ] **Actionable RSVP** ("I'm in") on pinned/event posts instead of just comments
- [ ] **Lightweight polls** for practical things (next friendly night, etc.)

## Set aside

- A real "online now" presence dot — this app has no presence-tracking infrastructure, so it would need real work to back honestly rather than fake. Left out of the mockup's "Who's about" rail for the same reason.

---

## What's next

Phases 1–3 are all live. What's left is Phase 4 — status line, grouped photo galleries, actionable RSVP, lightweight polls — deliberately lower priority and not started yet. None of it's blocking anything; it's just next in line whenever it's worth picking up.
