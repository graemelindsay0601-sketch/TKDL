# A8.3 — Career Presentation, UX & Visual Identity

## Starting SHA

`9beb0f1598a9b8c1bdb5ae00c96faaef3aa2e34b` (locked A8.2).
Starting tree: `613099c374e8cb20f515bf45d2a389c41e934fa2`.
Local and remote main matched and the starting worktree was clean.

## Final SHA / Final tree SHA

The immutable commit and tree are reported in the publication reply. This file is
part of that tree and intentionally does not contain its own self-referential hash.

## Files changed

32 files, including this document:

```text
artifacts/api-server/src/career/content/service.ts
artifacts/api-server/src/career/content/visual.ts
artifacts/api-server/src/career/tournament/service.ts
artifacts/api-server/src/lib/__tests__/career-content-service.test.ts
artifacts/tkdl/src/components/layout.tsx
artifacts/tkdl/src/features/career/api.ts
artifacts/tkdl/src/features/career/career.css
artifacts/tkdl/src/features/career/components.tsx
artifacts/tkdl/src/features/career/guidance.tsx
artifacts/tkdl/src/features/career/identity.tsx
artifacts/tkdl/src/features/career/index.tsx
artifacts/tkdl/src/features/career/model.ts
artifacts/tkdl/src/features/career/presentation.ts
artifacts/tkdl/src/features/career/pages/calendar.tsx
artifacts/tkdl/src/features/career/pages/event.tsx
artifacts/tkdl/src/features/career/pages/home.tsx
artifacts/tkdl/src/features/career/pages/legacy.tsx
artifacts/tkdl/src/features/career/pages/map.tsx
artifacts/tkdl/src/features/career/pages/my-career.tsx
artifacts/tkdl/src/features/career/pages/rankings.tsx
artifacts/tkdl/src/features/career/pages/saves.tsx
artifacts/tkdl/src/features/career/pages/tournament.tsx
artifacts/tkdl/src/features/career/pages/world.tsx
artifacts/tkdl/src/features/career/pages/world-hub.tsx
artifacts/tkdl/src/features/career/shell.tsx
artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-a83-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-ui.test.ts
scripts/build-career-a83-styles.mjs
scripts/check-career-a83-browser.mjs
docs/tour-career-a8-3.md
```

## Implemented

A Career-specific information architecture and decision flow, not a simulation
rewrite. Four surface roles distinguish standard/context/focus/prestige content.
Hot pink marks the primary action; information, positive, caution and problem
colours are separate. Gold is reserved for prestige/championship context, and
purple is associated with Vault identity rather than every ranking panel.
Inherited generic neon styling is neutralised for Career sections/stat tiles.

## Navigation

Five permanent destinations: **Home / Map / Calendar / Darts World / My Career**.
Only the active destination's contextual tabs appear. Darts World owns
Rankings, Players, Events & Circuits, Venues and History; My Career owns Overview,
Performance, Achievements, Career Life and History. Existing finances, goals,
recognition, relationships, profile, guide, legacy, tournament and scorer links
still resolve. The header retains save context, actual age/date, world search,
attention and a state-aware continuation action. Scoring suppresses discovery
chrome; mobile Career navigation replaces, rather than overlaps, global navigation.

## Home

Player/shirt status, Next Up, three position tiles, four relevant opportunities,
five entered commitments, three news items and three recent results.
Retired record and mandatory season review take priority over active tournament,
which takes priority over the calendar decision. Critical status reads have
loading/error states rather than implying there is no pending tournament.
A pending match goes to its existing preparation route, not a new scorer session.
Entry and the three-part cost display use A3/A4 provider data. Self-funded open
and amateur play remain normal career paths.

## Map

Original bundled SVG continent/island outlines, projected city anchors,
World/Europe/UK & Ireland/Scotland presets, zoom/reset, pointer and arrow-key pan,
screen-space clustering, circuit/activity filters, accessible location list,
20-row event list and an inspector. Default is My Opportunities; All Events
retains inaccessible championships. Query links can initialise region/filter/event.
The inspector shows source status, venue, week, field, denial/routes and finite
authoritative cost fields. It links to the existing event/tournament authority.
There are no tiles, road directions, geographic unlocks or fabricated travel costs.

## Calendar

Timeline / Season / My Entries, 52-week rhythm overview, historical season choice,
circuit/level/status filters and 30-event pages. Changing a filter resets pagination.
Qualified is not treated as entered. Entry/withdrawal and match preparation keep
their original providers, eligibility checks, deadlines and confirmation flows.

## Darts World

Landing hub with published leader, last recorded World champion, upcoming
championships, news and directory links. Player name/country/region search and
All/Active/Retired filtering are server-side, owned and bounded to 50-row pages.
Direct player profiles retain public NPC legacy and real human H2H links.
Event/circuit and venue directories use 20-row pages; details use authored
organisation/format/venue/trophy content and current actual editions.
Champions come only from Career-era history. World History starts with the
world-history tab, not the human's default Career Record.
Unneeded world-map/legacy requests are disabled on unrelated directory views.

## My Career

Overview keeps personal identity and financial/sporting context together;
Performance links actual statistics/results and H2H; Achievements uses the
factual trophy cabinet; Career Life groups public tone, merchandise, sponsors,
goals, presentation and guidance; History retains seasons, honours, world records,
event lineage, Hall of Fame and retirement. Existing authorities are reused.

## Player identity

Shared accessible SVG shirts and player cards support compact, standard,
featured and profile scales. Classic / Chevron / Split templates and validated
three-colour palettes are cosmetic only. Active authored sponsor wordmarks use
compatible slots. Human cards use saved identity; directory and tournament NPC
shirts derive the same stable palette/template from the same immutable NPC key.
Ranking thumbnails link to owned player profiles. No fake photo/headshot,
NPC bank account, hidden ability or invented simulated darts statistics appear.

## Event/championship identity

Central canonical mapping distinguishes Match Trophy, Double Crown, Open Masters,
Grand Slam, Continental Finals, Pro Tour Finals and Palace. Names/title sponsors
do not determine identity. Shared silver cup, bowl, arch, column/sculpture,
globe and shield designs include a distinct Sovereign sculpture, not a crown.
The same identity wrapper is used in cards, event detail, map inspector,
world/championship details, recent results, trophy cabinet and tournament mode.
Repeated actual wins keep separate season/event evidence under a recurring
family. Q-School session wins are explicitly not titles or automatic Tour Cards.

## Tournament integration

Arrival/draw/match/opponent/ceremony surfaces reuse shirts and canonical event
themes. Active/resumable tournaments remain prominent. Existing Full/Balanced/
Quick presentation, skip/reduced motion, bull-up, tournament routes, concession,
withdrawal, verified log recovery and GameScorer execution are not rewritten.
Backend tournament change is limited to the public cosmetic shirt projection.

## Onboarding

Creation retains slot, immutable date-of-birth/start-age rules, home locality,
difficulty and actual category policy. Shirt/nickname and confirmation steps add
cosmetics without skill allocation. If the post-create cosmetic write is not
confirmed, the saved Career opens its presentation editor with an explicit
recovery message; the user is not told to create a duplicate save.
Full/Standard/Minimal help and dismissals are stored under root-locked settings.
Home, event, tournament, rankings and season-review contexts have concise authored
help; all topics, including Q-School, card status, major access and Palace, remain
readable in settings. Preferences never change sporting difficulty.

## Attention

Compact Action Required / Career Updates / World News panel uses current
tournament, review, finance, life and sporting projections. Counts are grouped,
not a second inbox authority. Ordinary defaults are capped at eight links.
No wall of rumours, compulsory story acknowledgement, or fake deadline is added.
Failed reads explicitly mark attention incomplete.

## Responsive/accessibility

Sticky desktop navigation; five-item mobile bottom navigation with safe-area
spacing; one-column mobile map and stacked match/player layouts; bounded tables;
44px control/navigation targets; visible keyboard focus and selected state;
map keyboard/list alternative; accessible SVG names; meaningful loading/error/
empty/read-only states. Reduced-motion preference disables Career animation.
The map inspector's long action wraps instead of overflowing at 360px.

## Long-career handling

Server-paged player/trophy/ranking reads, filtered 20/30-row directories/events,
20-record legacy lists, five world-season blocks, bounded nested champion lists,
searchable retired players and on-demand season/event/NPC detail. Aggregate
totals are not reduced to page totals. Original history records are never pruned.
The existing Legacy API still reads its full evidence: this phase bounds DOM
rendering, not every backend historic projection. A live 50-season stress run
is not claimed.

## Tests

Commands run from the repository root; final runs total **163 passed, 0 failed**.
Earlier stale-navigation/fixture assertions were corrected for the deliberate
redesign. An intermediate concurrent SSR run timed out; it is not counted as
a passing run. Final independent runs below completed.

```sh
# 13/13: live PGlite service, ownership, HTTP, old pins, guidance isolation.
node --max-old-space-size=256 --liftoff-only --wasm-num-compilation-tasks=1 \
  --test --test-isolation=none --test-reporter=tap \
  artifacts/api-server/src/lib/__tests__/career-content-service.test.ts

# 15/15: existing A8.2 live tournament integration regression.
node --max-old-space-size=256 --liftoff-only --wasm-num-compilation-tasks=1 \
  --test --test-isolation=none --test-reporter=tap \
  artifacts/api-server/src/lib/__tests__/career-a82-tournament.test.ts

# 79/79: model, real dart rules, bot adapter and scorer/recovery regression.
node --max-old-space-size=320 --test --test-isolation=none --test-reporter=tap \
  artifacts/tkdl/src/lib/__tests__/career-a65-live-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-bot-adapter.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-a83-model.test.ts \
  artifacts/api-server/src/lib/__tests__/darts-rules.test.ts

# Production stylesheet build for the following fixture browser checks.
NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512 \
  node scripts/build-career-a83-styles.mjs

# 56/56: actual components, seeded TEST-ONLY provider-shaped DTOs, Vite SSR.
NODE_ENV=production A83_CSS_DIR=/tmp/tkdl-a83-styles/assets \
  A83_BROWSER_DIR=/tmp/tkdl-a83-browser \
  node --max-old-space-size=400 --test --test-isolation=none --test-reporter=tap \
  artifacts/tkdl/src/lib/__tests__/career-ui.test.ts

# 25/25 rendering/viewport checks, separate from the 163 test cases.
node scripts/check-career-a83-browser.mjs
```

## Typecheck/build

Verification commands:

```sh
node --max-old-space-size=640 scripts/check-career-types.mjs
NODE_OPTIONS=--max-old-space-size=512 node_modules/.bin/tsc \
  -p artifacts/api-server/tsconfig.json --noEmit
node --max-old-space-size=512 artifacts/api-server/build.mjs
NODE_ENV=production artifacts/api-server/node_modules/.bin/esbuild \
  artifacts/tkdl/src/features/career/index.tsx --bundle --platform=browser \
  --packages=external --format=esm --alias:@=./artifacts/tkdl/src \
  --outfile=/tmp/a83-career-ui.js
git diff --check
```

API typecheck: exit 0, no diagnostics. API production build: exit 0.
Scoped Career JS/CSS build: exit 0 (1006.0 kB JS, 23.5 kB CSS).
CSS-only Vite build: exit 0. `git diff --check`: exit 0.
Final Career checker: exit 0, `Career frontend diagnostics: 0`.
Final publication evidence is recorded in the reply.
The Career checker
filters diagnostics to Career files; it is not a whole-frontend typecheck.
The scoped bundle externalises packages; it is not a complete browser distribution.
The CSS-only Vite build uses the actual global/Tailwind and Career styles.
A whole-app Vite build was attempted and stopped after remaining in its
resource-heavy transform stage; no whole-app build success is claimed.

## Compatibility

A1–A8.2 save/player/event/sponsor pins, RNG, schedule/qualification/draw/ranking/
simulation/scoring/settlement/ledger rules, immutable age profiles and historical
evidence are retained. No migrations or catalogue balancing were introduced.
Guidance writes are owned, locked, feature-gated and rejected on retired saves.
HTTP responses remain no-store and strict inputs reject unrelated fields.
Classic Tour/ranked mode, coins, collection and other app navigation are not
replaced; only Career mobile chrome changes on Career routes.

## Known limitations

Coarse world outlines and city-level anchors, not road or venue-door maps.
No new portrait/audio/image assets, cartographic service or sponsor logo files.
No hosted live authenticated user click-through, physical-device check, formal
screen-reader/WCAG audit, production deploy, whole-app build pass or full
50-season backend load certification is claimed. Original grouped legacy DTO
size remains a backend limitation. Existing coarse trophy categories may share
an SVG archetype; the seven canonical event identities remain distinct.

## Manual/browser checks

Headless Chromium renders real SSR components with actual production-compiled
styles and explicitly TEST-ONLY seeded data. Five scenes (Home, selected Map,
World hub, Palace detail, identity) at 1440×1000, 820×1180, 390×844, 360×800 and
844×390: 25 passing viewport/overflow/semantic checks. Ten desktop/phone PNGs and
JSON measurements are generated under `/tmp/tkdl-a83-browser`.
Desktop Map, phone Home and Palace screenshots were visually inspected.
These static browser fixtures do not prove interactive panning, mutation,
authenticated entry/advancement or production GameScorer touch behaviour.
Service/scorer tests provide the separate authority/recovery regression evidence.

## Publication

Publish one coherent commit to `main`, without force; parent must be locked A8.2.
Independently read GitHub's main ref and commit tree, compare both to tested local
HEAD, fetch origin/main and check `0/0` ahead/behind and a clean working tree.
The publication reply records the immutable SHA/tree and observed verification.
Do not infer publication success merely from a successful local commit.

## STOP

A8.3 only. No A9 balancing/certification, A10 or production deployment.
