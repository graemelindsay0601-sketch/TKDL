# Career 2.0 A6: Career UI/UX and playable frontend

A6 builds on the locked A5 checkpoint (`8367d2a`) on `feature/tour-career-2-foundation`. It is the player-facing Career frontend inside the existing TKDL app (React, Tailwind, wouter, React Query, `pdc-card` surfaces, Oswald, Lucide, the TKDL palette).

Every number, status and name on screen comes from the A1–A5 APIs. There is no mock data in production code; fixtures exist only in tests and in a dev-only validation server.

## Routes

| URL | Screen |
| --- | --- |
| `/career` | Save entry: 3 slots and retired archive |
| `/career/:saveId` | 1. Career Home |
| `/career/:saveId/calendar` | 2. Calendar |
| `/career/:saveId/events/:eventId` | 3. Event / Tournament |
| `/career/:saveId/rankings` | 4. Rankings |
| `/career/:saveId/q-school` | 5. Q-School |
| `/career/:saveId/world-championship` | 6. World Championship at The Palace |
| `/career/:saveId/journey` | 7. Career Journey |
| `/career/:saveId/finances` | 8. Finances & Sponsorship |
| `/career/:saveId/history` | 9. My Career / History & Trophy Room |

**Why `/career` and not `/tour/career`:**

- `/tour/:runId` is the Classic Tour run route.
- `layout.tsx` treats `^/tour/[^/]+` as a match-in-progress route.

**One lazy chunk.** The Career is a single lazy chunk (`features/career/index.tsx`) registered in `App.tsx`.

**Navigation.** The global navigation is unchanged except for the Tour Mode section, which now lists:

- **Career:** shown only when `tour_career_2` is available to the signed-in account (detected by `GET /api/career/saves`).
- **Classic Tour:** the existing `/tour`, relabelled.

**Career's own navigation** is one horizontally scrollable row of three layers, separated by dividers and exposed as `role="group"`:

- **Home**
- **My Career:** Journey, History, Finances
- **Darts World:** Calendar, Rankings, Q-School, The Palace

On phones the Career nav sits under the header; no second bottom bar was added.

## Structure

| File | Role |
| --- | --- |
| `features/career/api.ts` | Typed client and React Query hooks over `/api/career`. Mutations invalidate the whole save. |
| `features/career/types.ts` | DTO types mirroring the server projections |
| `features/career/model.ts` | Pure view-model: labels, status, primary action, next-event choice, Q-School state, finance headlines, routes, tiers, nav. It never computes sporting or financial truth. |
| `features/career/components.tsx` | Shared primitives: `CareerSection`, `StatusBadge`, `StatTile`, `CareerEventCard`, `SeasonProgress`, `Movement`, `Flag`, `TierBadge`, `Segmented`, `ConfirmButton`, `CareerLoading`, `CareerError`, `CareerEmptyState`, `QueryState` |
| `features/career/shell.tsx` | `CareerShell`, `CareerHeader`, `CareerNav`, the advance control, the uninitialized-save initialize action |
| `features/career/pages/*` | The nine screens, the saves screen and the match boundary |
| `features/career/career.css` | Scoped `career-*` buttons, chips, nav, tables, the Palace treatment and reduced-motion handling |

**Shared data:**

- **Shell:** the save root and the current-week calendar overview are fetched once in the shell and passed to screens as `ctx`.
- **Repeated reads:** React Query de-duplicates them.
- **Freshness:** every Career response is `Cache-Control: no-store`.
- **Bounded reads:**
  - Home uses an 8-week calendar window.
  - Rankings use `AROUND`, `TOP` or `PAGE` slices.
  - The ledger is keyset-paginated.

## Brand treatment

Career styling is scoped under `.career-root` in `career.css`, so the rest of the app is untouched:

- **Surfaces:** cards use TKDL navy glass (lighter than the base `pdc-card`), with the club's red (`#ff005c`) and blue (`#0066ff`) radial glows.
- **Header:** red-to-blue crest stripe and a blue/red "TKDL Career" wordmark, echoing the logo.
- **Navigation:** the active tab is solid TKDL red.
- **Sections:** headings carry a red, blue or gold accent bar.
- **Contrast:** secondary text was lifted for legibility.
- **The Palace** keeps its black-and-gold World Championship identity.

## Backend changes (minimal, additive)

| Change | Why |
| --- | --- |
| `POST /api/career/saves/:id/initialize` (A5 router → `sporting.initialize`) | One idempotent call initializes the whole composed Career (A2 world, A3 calendar, A4 finance with career-start offers, A5 state with founding cards). The existing `calendar/initialize` only did A2+A3. |
| A5 publication also syncs A1 `professional_ranking` (World Ranking position) | A1 save slots can show the ranking without extra calls. It is a display cache like `has_tour_card`. |

No A1–A5 rule, schema or behaviour changed otherwise.

## Screens

- **Saves:**
  - three A1 slots, plus the retired archive;
  - each slot shows season and week, World Rank, balance, Tour Card, sponsor and last played;
  - actions: Continue, New Career (name and opposition difficulty), Restart, Retire, Delete;
  - destructive actions need an in-place second confirmation;
  - unauthenticated (401) and unavailable (404) states are handled.
- **Home:**
  - **Next event** is the dominant card: the pending match first, then your next entered event, then the best open entry. It shows circuit, venue, date, format, entry, travel and accommodation, sponsor coverage, your cost, available money, top prize, ranking eligibility, status and one action.
  - **Status tiles:** World Rank (movement, career high, gap to the next cut), Balance (available after reserved travel), Tour Card (source, review season), Sponsor.
  - **Lists:** your schedule, open entries, recent results, list positions, factual targets and milestones.
  - **Retired saves** show their record instead of a next event.
- **Calendar:**
  - views: My schedule (default), Next 12 weeks, Whole season, Featured, with a season selector;
  - filters: circuit, event level (tier), status;
  - events are grouped by season swing; each row expands in place (format, venue, field, entry window, cost, prize, ranking, denials) without leaving the calendar.
- **Event / Tournament:**
  - lifecycle from persisted A3 data: pre-entry, entered, draw, active, eliminated, completed, cancelled, unsupported;
  - tabs appear only with real data: Overview, Draw (the persisted bracket one round at a time, seeds from A3), Schedule, My matches, Players, Prize (A4 preview and actuals, including your prize and ranking money), Ranking (category, seeding list, A5 qualification routes);
  - Enter and Withdraw follow the server's rules (pre-lock refund policy; post-lock concession).
- **Rankings:**
  - lists come from A5 metadata, not hard-coded;
  - summary: position, movement, ranking money and window, career and season high, next cut with gap and places;
  - Around me (default when ranked), Top 32 and Full table (50 per page);
  - the human is highlighted, and cut lines from A5 metadata are drawn between rows;
  - ranking history (snapshots, season highs) and "Why this ranking?" (counting contributions, totals, expired count);
  - no hidden ability or potential is ever shown.
- **Q-School:**
  - the two pathways side by side, with a season selector;
  - Your Q-School: status, First Stage days, how the Final Stage place was earned, days played, Order of Merit position and points, inside or outside the card line;
  - What you need: structured facts only (cards available, days left, points behind the line);
  - the Order of Merit with day-winner and OoM-card markers;
  - the allocation summary, and a clear Tour Card result banner (won directly, won via the OoM, or no card);
  - the pathway's events with entry.
- **The Palace (WORLD tier):**
  - black and gold treatment;
  - dates, prize, engine status, your qualification routes, previous champions, the qualifiers;
  - the World Championship's own event view.
  - The set-play format is not executable in A3, so it is shown as "Set-play format not supported yet". If cancelled, the UI says no field, draw or result was invented. Previous champions say none exists.
- **Career Journey:** a factual shell:
  - current state label (Amateur, Ranked without card, New professional, Tour Card professional, Established professional, Retired), the next objective;
  - the milestone timeline, Tour Card history, Q-School milestones, World Ranking progress, titles and finals, big-stage appearances;
  - `JourneyStoryExtension` is an empty A7 slot.
- **Finances & Sponsorship:**
  - the four A4 headlines (Balance, Career Earnings, Sponsor Earnings, Career Expenses), never mixed;
  - current sponsor terms (period, signing bonus, event payments, coverage, bonuses) and totals;
  - real offers with Accept (confirmation) and Decline only;
  - upcoming travel commitments;
  - the immutable ledger with category filters and keyset paging;
  - sponsor history.
  - There is no coin conversion, purchasing, loans, debt or gambling.
- **My Career / History:**
  - tabs: Overview, Timeline, Seasons, Titles & finals, Majors, Ranking, Trophy room;
  - Rivalries and Records are not shown (no data until A7);
  - the Trophy room lists Career titles only and states that the Classic Tour's 305 trophies are separate and untouched.

## Human match play (explicit status)

**A Career match cannot currently launch the real TKDL scorer and return a result.**

- **What the backend does today:**
  - A3 pauses a tournament at `AWAITING_HUMAN` for the human's match;
  - the calendar cannot advance past it;
  - the only way to record the result is the server-side `recordHumanMatchResult`, which A3 deliberately does not expose over HTTP (clients must not self-report results).
- **What A6 does:**
  - shows the real pending match (opponent, round, best-of) on Home, in the header ("Your match") and on the Event page;
  - shows **Play match — not connected yet** as a disabled button with the reason;
  - offers the one legal backend action: **Withdraw (concede)**, which A3 resolves as walkovers, with A4's late-withdrawal policy;
  - never launches GameScorer for a Career match, never simulates the human's result and never fabricates one.
- **Practical consequence in the live app today:** if the player enters an event, the Career calendar stops at their first match until they withdraw. Entering events is real (costs are charged), but playing them is not yet possible.

## Validation

- **Visual validation:** `node artifacts/api-server/scripts/career-ui-fixture-server.ts` is a dev-only server that serves the built frontend and the real A1–A5 routers on PGlite. It has a signed-in fixture player and seeds:
  - a Career played to week 9 with a real pending match;
  - a fresh Career;
  - a retired Career.

  The fixtures are labelled: one funding adjustment, and the human's results decided by a fixed policy through the server boundary. It was used for 390/768/1440 px screenshot passes.
- **Tests:**
  - `artifacts/tkdl/src/lib/__tests__/career-model.test.ts` (22) and `career-ui.test.ts` (18 SSR screen and mutation tests via Vite `ssrLoadModule`), with shared `career-fixtures.ts`;
  - `artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts` (17): further view-model and state rendering decisions, including `MATCH_PLAY_STATUS.connected === false`;
  - `artifacts/api-server/src/lib/__tests__/career-a6-http.test.ts`: the HTTP contract and every UI mutation.

## Known limitations / deferred

- **Human match play** is not connected (see above): integration checkpoint.
- **History** reads the latest 200 human results (A3 history default); a paged history endpoint is A10.
- **Calendar "Whole season"** loads the full season with finance previews (bounded by one season). Large-season latency is A10.
- **Render tests are server-side only:** `career-ui.test.ts` renders screens to HTML with SSR; there is no DOM/interaction runner. Visual checks were screenshot passes at 390/768/1440 px.
- **Balancing observations for A9:**
  - the fixture human reached the World top 30 within 9 weeks of winning a Q-School card (fixture policy wins the first two rounds of every Pro Circuit event);
  - Q-School costs (£300 + £450 + travel) exceed the £250 starting balance, so a fresh Career cannot enter Q-School in season 1 without earnings.
