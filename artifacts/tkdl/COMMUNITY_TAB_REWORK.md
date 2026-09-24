# Community Tab — Rework Proposal

**Superseded 2026-09-24.** The questions this doc raised got answered — Pulse/Community split shipped, the tab now renamed "Off the Oche", and a full feature list got worked through across two rounds of mockups. See `OFF_THE_OCHE_BUILD_PLAN.md` for the actual build order and current status. Keeping this file for the original reasoning, but treat that one as current.

---

You flagged this as feeling basic across the board — visual polish, missing features, and confusing to use. Read through the actual code before proposing anything (not guessing from memory), so this is grounded in what's really there. Nothing here is built yet.

---

## What's already there (so we don't re-propose it)

Posts with text + photo, a 5-emoji reaction bar, threaded comments, edit/delete for your own posts, an admin moderation queue (pending → approve/reject), automatic system posts for match results/eliminations/tier changes (each with its own colour + icon), cosmetics integration (your equipped name style and post accent show on your posts), a "Best of the week" highlights carousel, an "Active this week" avatar rail, four tabs (All / Celebrations / Photos / Mine), a New/Top sort, and infinite-scroll load-more. This is a real feature set — the problems below are about how it's presented and a few real gaps, not a blank page.

---

## The confusing part — and it's a real structural issue, not just taste

Your dashboard (the Hub) already has its own **"League Pulse"** feed — a merged, filterable activity stream that includes community posts alongside league/tour/achievement activity, and you can react to a post right there on the Hub. That reaction hits the exact same endpoint as this page's reactions, so they do stay in sync — but visually and structurally, you now have **two different feeds showing overlapping community content**, styled differently, with no link between them and no obvious answer to "is Pulse a subset of Community, or something else?" If this page feels confusing, this is very likely a real part of why — a user has no way to know they're the same underlying data.

**Options, not a decision I'll make for you:**
1. Make it obvious: Pulse is explicitly "the highlights," with a clear "See full Community feed →" link, so the relationship is stated rather than implied.
2. Cut Pulse's community content down to just the "Best of the week" style items (its own current highlights carousel), and let the full feed live only on this page.
3. Leave them as-is but reconcile the visual language (same card style, same reaction bar) so they at least *look* like two views of one thing instead of two unrelated features.

## Other confusing point
Tabs (All/Celebrations/Photos/Mine) only filter posts *already loaded* on the page — they don't re-query the server. If you've only loaded the first 20 posts and none of them are yours, the "Mine" tab shows "YOU HAVEN'T POSTED" even if you have — which reads as a bug, not a design choice. Worth fixing regardless of anything else here: either tabs should query the server directly, or there should be a visible "still loading more to check" state instead of a flat empty message.

---

## Missing features (grouped, pick what you want)

**Likely quick wins:**
- See *who* reacted, not just a count (tap/hover a reaction to see names)
- @mention another player in a post or comment (auto-links to their profile, could tie into notifications)
- A permalink/share link for an individual post (the page already has scroll-anchor ids — just needs a shareable URL)

**Bigger asks:**
- Admin-pinned/featured posts (separate from the algorithmic "Best of the week")
- Search within the community feed (by player or keyword)
- Reactions beyond the fixed 5 emoji, or a "custom sticker" reaction using the STICKER cosmetics that already exist for DMs

**Not sure these fit this app, flagging rather than assuming:**
- Polls
- Events/meetup posts

---

## Visual polish

The current design leans on a lot of small bordered pill/badge elements (tier badge, event-type badge, streak flame, reaction pills) stacked close together in the post header — individually fine, but dense as a set. A pass here would likely mean: simplifying the header into a clearer hierarchy (name+avatar primary, metadata secondary/smaller), giving photos more visual weight (they're currently capped at the same card width as everything else), and tightening the colour palette — right now nearly every post type (pending/elimination/tier-up/tier-down/match/doubles/team/shift-wars/default-auto) has its own hard-coded accent colour, which adds up to a lot of different hues competing for attention in one feed.

---

## What I need back from you

1. Which of the three Pulse/Community relationship options above (or something else) — this is the one structural fix I'd actually recommend doing regardless of what else gets picked.
2. The tab-filtering bug — fix now regardless, or fold into the bigger rework?
3. Which missing features you actually want (doesn't need to be all of them).
4. Whether "visual polish" means a full redesign of the post card, or targeted fixes to the specific density/colour issues above.

Once I know what's in, I'll break it into a build order like the other plan docs and we start on it for real.
