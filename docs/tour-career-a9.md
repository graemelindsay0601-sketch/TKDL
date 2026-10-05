# Tour Career 2.0 — A9 balance, establishment and viewport

## Baseline and publication

Starting SHA: `841c308683964f840cec17dbdaa8332bf1671ea8`.
Starting parent: `9beb0f1598a9b8c1bdb5ae00c96faaef3aa2e34b`.
Starting tree: `4577ac3617565c22f79a09ed0412b5cd2f89d6b6`.

Final SHA / final tree SHA: the single A9 commit containing this document.
Resolve with `git rev-parse HEAD HEAD^{tree}` after publication; the immutable
values and independent remote verification are recorded in the completion
report. A commit cannot embed its own final hash in its tree without changing
that hash. There is no follow-up documentation-only commit.

This is focused A9 work, **not A10, release certification, deployment or a
Career-save wipe**.

## A9.0 — global viewport

### Root cause

The loaded entry stylesheet did not establish the complete document/root
contract. Layout's own `h-screen h-dvh` did not make its ancestor document/root
non-scrollable, and its flex column/main did not both have explicit
`min-height:0`. The dormant `styles/responsive.css` still described a
`100vw`, `overflow:auto` body and body-owned safe-area padding. It was not
imported by the running entry; editing only that file would not fix the app.
Root padding plus a separately viewport-sized shell can exceed the viewport.

An additional real cascade conflict: the unlayered `.sidebar-collapse-btn`
rule set `display:flex`, defeating Tailwind's layered mobile `hidden`.
Its negative right offset left a small desktop-toggle sliver visible beside
the closed mobile drawer. Visual review found this, not just width assertions.

### Fix

`index.css` now imports active `styles/viewport.css`. `html/body/#root` have
bounded width/height, hidden overflow and no document overscroll; body uses
`100vh` fallback then `100dvh`, with zero padding/margin/min-height.
One `.tkdl-app-shell` fills that root. Shell owns top/left/right safe areas;
main owns vertical scrolling and bottom clearance, with explicit
`min-width:0/min-height:0` through the flex hierarchy. Main alone suppresses
unintentional horizontal page scrolling. Children retain their own scrollers.

The drawer owns its top/bottom safe areas. Ordinary bottom nav owns its side
insets and existing bottom inset. Career nav is inset from left/right and
retains its bottom inset; small-screen labels have bounded sizing rather than
breaking "Calendar" mid-word. The collapse toggle is explicitly hidden below
1024px and restored on desktop. Login, which lives outside Layout, owns a
bounded internal vertical scroller with safe centring. Practice's back-to-top
listener/action now target main, not the locked window.

Dormant responsive rules were reconciled to this contract, not loaded wholesale
with their unrelated rules. No global descendant `overflow:hidden`, no
`user-scalable=no`, and no shared fixed-width clipping wrapper were added.

### Browser evidence

Production global/Tailwind/Career CSS, real Layout and real page SSR:
Hub, Standings (35 seeded rows), Practice, long Account, Classic Tour, Career
Home, Map, Calendar and tournament ("Palace") plus standalone Login.
Widths/heights: **320×720, 360×800, 375×812, 390×844, 768×1024,
1024×768, 1440×1000, 844×390**.

The reproducible Chromium script checks document/root width and height,
internal main scrolling, closed/open/closed CSS drawer geometry, mobile versus
desktop collapse-toggle visibility, actual Account tab horizontal scrolling,
an explicit independently scrollable child probe, and an actual map SVG
viewBox change without document movement. Same-page transitions additionally
exercise 390×844 → 844×390 → 390×700 → 390×844. CSS-variable inset simulation
checks top 20px and left/right 16px without changing outer width.

Scope: static seeded page/auth/data fixtures, not a logged-in account. Drawer
classes and SVG viewBox are changed directly: this proves CSS/layout boundaries,
not real React click/gesture handling. Headless emulation does not prove iOS
Safari rubber-band behaviour, physical notches, software keyboards or installed
PWA behaviour. File fixtures also lack normal production asset serving.
Screenshots of Account, Home and Map were visually inspected; no physical
device test is claimed.

## A9.1 — establishment and first Q-School

New roots pin event database **5**, player database remains **2**,
`careerStartPolicy:"ESTABLISHMENT_V1"` and `travelVersion:2`.
The initial clock is still Season 1, Week 1. `generateSeason` skips only
`Q_SCHOOL` definitions for **v5 Season 1**. It does not invent results,
fast-forward the clock, convert sporting money, change NPCs or skip other
Season 1 events. New-save Home explains establishment, savings and optional
professional ambition. Lifelong amateur careers remain valid.

Catalogue v5 clones immutable v4 content. v1–v4 roots retain their original
calendar generation/hashes, Q-School timing and terms. No migration rewrites
existing instances, contracts, entries, trophies or histories.

In Season 2 and later, the ordinary full annual catalogue returns, including
both Q-School pathways. A live PGlite check created a genuinely new root,
initialised twice, verified £250 once, pin 5/travel 2/sponsor 3, no Season 1
Q-School and other Season 1 opportunities. It used a **TEST-ONLY boundary
fixture** (terminal Season 1 events, week 52 / period 51), then real A3/A2
advance to Season 2 Week 1 with open Q-School and no forced human entries.
This is not a simulation of all 600+ events in a first season.

Q-School £300 First / £450 Final fees remain **PER_SERIES**. Qualification,
direct day winners, points, Tour Cards and review remain A5 authorities.
Failure adds no sporting prize/refund, bailout, forced participation or debt.

## A9.2 — travel reconciliation

Audit covers **60 canonical venues and 35 home localities**, including authored
and locality-generated venues. The reproducible report emits a venue-by-venue
classification from Ayrshire. The seed used here yields 631 Season 1 events
(558 executable), 634 Season 2 events, and 28 Pro Circuit events. Season counts
can differ through existing seeded scheduling; the catalogue was not shrunk.

v1 incorrectly reused broad **County sporting catchments** as free travel
catchments. Ayrshire's sporting catchment included Highlands; Australian and
Canadian sporting pools also span distances inappropriate for local travel.
Authored Glasgow venues were inconsistently absent from nearby overrides.

New `travelVersion:2` uses exact home locality or authored same-region venues,
plus a small canonical nearby-venue map. Nearby Ayrshire/Glasgow is reconciled:
Burns Hall / Ayr Pavilion and Glasgow Hall / Foundry / Clyde Arena /
Kelvin Assembly are LOCAL from Ayrshire. Aberdeen and Highlands are DOMESTIC,
not free. Midlands is DOMESTIC, Dublin UK_IRELAND, Berlin EUROPE and Las Vegas
LONG_HAUL. Auckland from a Sydney home and Calgary from Toronto are not LOCAL.
Sporting catchments themselves are unchanged.

Finance chooses v2 only when the root is v5+ **and** its snapshot requests v2.
Old roots remain v1 even if a test copied newer settings onto them. Entry
reservation snapshots now include the travel version. Destination grouping,
paired trips, fee basis, hotel assumptions and actual tariff values are
unchanged. A domestic two-day pair is one trip: £60 travel + two £70 nights.

## A9.3 — sponsorship

New finance states for v5 roots select sponsor catalogue **3**. v1/v2 definitions,
accepted contracts and historical terms are not mutated. Existing eligibility,
sporting retention, relationship slots, exclusivity, portfolio limits, signing
idempotency and A4 monetary authority remain unchanged.

Measured v2 Ironflight paid £150/event, covered 100% Pro entry and 60%
travel/hotel, and signed for £3,000. A no-prize domestic pair produced **£220
profit solely for attendance**. Reducing it initially to £75/event did not solve
the real problem: a compatible equipment/logistics/apparel portfolio still
generated £190 per domestic pair; even a genuinely local pair was profitable.
That intermediate proposal was rejected.

### Final new-save terms

| Template/brand | Signing | Fixed attendance cash | Expense support |
|---|---:|---:|---|
| Ironflight | £2,000 | none | 75% Pro entry, £150/event and £4,000/season cap; 40% travel/hotel, £400/event and £8,000/season cap |
| Other emerging professional primary/commercial templates | £2,000 | none | same 75% Pro entry rule |
| Professional logistics/automotive | £1,000 | none | 70% travel/hotel, £200/event and £3,000/season cap |
| Professional apparel | £1,500 | none | 25% entry, £50/event and £750/season cap |
| Ochre / generic regional equipment/commercial | £350 | £20 on existing circuit/annual limits | 75% amateur/development entry, £50/event and £600/season; Ochre also 25% travel, £60/event and £350/season |
| Redpoint | £500 | £25 on existing circuit/annual limits | 60% development entry and 30% travel/hotel; separate £100/event, £1,000/season rules |
| Regional logistics/automotive | £200 | £10 on existing limits | 60% travel/hotel, £200/event and £750/season |
| Regional apparel | £250 | £15 on existing limits | 25% entry, £50/event and £750/season |

Emerging-professional cash becomes an existing **A4 performance bonus**:
£75 primary/commercial, £25 logistics or £50 apparel, for an actual top-32
finish in **RANKING Pro Circuit / European Series** events only. It is not a
qualifier attendance payment. Other existing authored performance bonuses are
retained, and all applicable bonus keys pay under the existing authority.

Northline established backing and all elite templates are deliberately retained.
LOCAL monetary values are also retained: no concrete evidence justified changing
them. Version metadata changes to 3; local/established/elite monetary equality is
asserted in the focused test. No eligibility reduction is used to disguise an
otherwise overpowered professional deal.

### Paired attendance before / after

No signing cash, no prizes and no qualifying finishes in this table; pounds:

| Destination from Ayrshire | Gross pair | v2 Ironflight net | v3 Ironflight net | v3 compatible Ironflight + Relay Freight + Northstar Performance |
|---|---:|---:|---:|---:|
| Midlands | £400 | +£220 | −£170 | −£110 |
| Dublin | £450 | +£200 | −£200 | −£125 |
| Berlin | £650 | +£120 | −£320 | −£185 |
| Genuinely local | £200 | +£300 | −£50 | −£50 |

The local professional pair is an explicit cost/geography stress fixture, not
a claim that the calendar places a Pro pair in Ayrshire.
Coverage uses **best applicable**, not additive percentages. Tests verify the
non-winning contract's cap is not consumed, each rule has its own usage, caps
exhaust deterministically, and competing equipment deals still conflict.
Cash bonuses may legitimately add across compatible deals after performance;
coverage never exceeds the actual expense.

Holding the same schedules, finishes and v2 geography fixed isolates sponsor
changes: Strong amateur closing £3,070 → £2,613.75; elite lifelong amateur
£12,230 → £11,676; new-card professional £11,620 → £8,180; struggling
professional £7,030 → £4,420. Full Q-School already-held Redpoint support
leaves £755 → £448 from £1,250; First-only failure leaves £305 → £186
from £500. Regional backing still makes a substantive contribution, while
the amateur season gives strong play time to save before Q-School.
Average unsponsored, established, Top-32 and champion fixture outputs are
unchanged. These comparisons isolate sponsor terms, not a prediction of pace.

## A9.4 — reproducible scoring, world and economic evidence

Run `artifacts/api-server/scripts/career-a9-evidence.ts`, seed
`a12e` repeated 16 times. It writes `/tmp/tkdl-a9-evidence/evidence.json`.
No live account/save is touched.

### Actual darts output

The harness creates real 501 straight-in/double-out best-of-five-legs matches.
NPC `createPerformance` → existing `toCareerBotConfig` → shared
`planBotX01Visit` → legal `throwDart` until completion, including busts and
checkouts. It measures points per actual dart, not adapter attributes or
pre-drawn tournament leg scores.

There are **1,200 same-tier matches**: 4 tiers × 3 difficulties × 5 contexts
× 20 matches, 2,400 player samples. Contexts are local, floor, stage, qualifier,
major. Another **1,440 matches** cover six pairings × three difficulties × 80.
All 2,640 matches complete under the real rules.

Mean actual three-dart averages, equally weighted over the five contexts:

| Difficulty | Grassroots | Amateur | Professional | Elite |
|---|---:|---:|---:|---:|
| Accessible | 34.02 | 43.13 | 56.29 | 65.83 |
| Standard | 37.23 | 46.78 | 59.31 | 69.19 |
| Challenging | 39.38 | 49.01 | 61.13 | 71.71 |

Standard context means span 35.0–40.4 grassroots, 44.5–47.7 amateur,
58.0–60.1 professional, 67.3–71.3 elite. Representative Standard local
p10–p90 averages: grassroots 25.9–49.4; amateur 36.2–57.8; professional
46.0–70.3; elite 57.0–77.2. Tier separation coexists with overlap/variance.
These are game-engine observations, not claimed televised-professional
calibration. Human throw/checkout experience still needs playtest.

Checkout evidence reports **checkouts divided by visits starting at ≤170**.
It is not doubles accuracy; the denominator includes bogey numbers. Standard
means across contexts: grassroots 17.3–22.7%, amateur 24.1–26.8%, professional
26.5–36.1%, elite 34.3–46.1%. Raw summaries include all contexts/difficulties.
Different contexts use representative samples; this is not a causal,
same-player pressure-only experiment.

Standard weaker-player win rates:
grassroots over amateur 23.75%; amateur over professional 15%;
professional over elite 21.25%; grassroots over elite 1.25%.
Top-amateur over lower-professional Q-School-calibre pairing: 40%
(Accessible 43.75%, Challenging 38.75%).
Top-amateur/new-card-calibre over upper established professionals: 18.75% in
each sampled difficulty. A Tour Card itself does not upgrade human ability.
Each pairing has 80 matches/difficulty, so small fluctuations are not a basis
for another tuning pass. These are individual matches, **not full Q-School
allocation probabilities**.

### Long-term world

Fifteen seasons of real weekly development and off-season
retirement/intake functions: 52 periods/year, standard exposure, existing
junior and women intakes. It deliberately excludes match-form feedback,
rankings, Tour Card turnover and full event calendars.

Season-start active population: 340 → 432 (5) → 510 (10) → 560 (15).
Elite: 40 → 37 → 33 → 27; professional: 79 → 65 → 60 → 62.
No elite explosion or total-pool collapse in this fixture. The active
population grows appreciably; this does not certify future event field
eligibility/completeness or arbitrary seeds. No NPC volume/attribute/intake/
retirement values were changed based on this limited run.

### Economic profiles

Real authored fee/prize profiles, actual deterministic geography/trip grouping,
all applicable authored bonuses and real non-stacking coverage/caps.
Schedules do not overlap; eligibility/finishes/held sponsors are **explicit
assumptions**, not predicted human outcomes. Signing is included once except
Q-School, where a sponsor is already held. Costs are aggregated (fees before
travel), not replayed through the live ledger or every reservation order.
These outputs are stress illustrations, not a probability/affordability model.

| Profile | Events | Opening | Gross costs | Covered | Prizes | Sponsor receipts incl. signing | Closing |
|---|---:|---:|---:|---:|---:|---:|---:|
| Average grassroots amateur | 20 | £250 | £70 | £0 | £45 | £0 | £225 |
| Strong amateur | 21 | £250 | £1,485 | £408.75 | £1,410 | £2,030 | £2,613.75 |
| Elite lifelong amateur | 20 | £250 | £2,230 | £861 | £9,345 | £3,450 | £11,676 |
| Q-School aspirant, full First + Final | 7 | £1,250 | £1,360 | £383 | £0 | £175 | £448 |
| Failed Q-School First Stage only | 3 | £500 | £570 | £181 | £0 | £75 | £186 |
| New Tour Card holder | 12 | £1,500 | £2,900 | £1,580 | £6,000 | £2,000 | £8,180 |
| Struggling professional | 8 | £1,250 | £1,850 | £1,020 | £2,000 | £2,000 | £4,420 |
| Established professional | 34 | £10,000 | £9,590 | £9,590 | £60,000 | £16,000 | £86,000 |
| Top 32 | 38 | £15,000 | £12,070 | £12,070 | £114,000 | £17,000 | £146,000 |
| Major champion | 15 | £20,000 | £3,440 | £3,440 | £75,050 | £105,000 | £200,050 |
| World champion / #1 | 13 | £50,000 | £3,035 | £3,035 | £180,100 | £193,000 | £423,100 |

The grassroots profile has five specified money finishes and fifteen
non-prize finishes, no sponsor. Strong/elite amateur fixtures deliberately
repeat strong finishes; professional fixtures assume prizes for their stated
finishes. These are not median careers, and they do not imply a brand-new
player can afford those schedules or sign those sponsors immediately.

Separate stage-level Q-School arithmetic requires £389 upfront for First,
then £588 for Final with already-held Redpoint. First-stage cash of £75 arrives
only after play. £500 can cover First, leaves £186 and cannot cover Final;
£900 leaves £586, £2 short of Final; £1,250 covers both, leaving £448.
No debt is simulated and no signing cash is silently supplied. An assumed
First-day win qualifies the full-budget fixture; First-only failure assumes
early losses throughout. A full campaign failing at Final has the same £802
net cost/£448 closing amount. Ordinary amateur routes remain available.
This is not live verification of Q-School sporting success or failure.

## Balance decisions

Changed only: new-save establishment policy/pins, geographically inconsistent
local travel classification, regional/emerging-professional support templates,
and performance-conditioning professional cash. Evidence and exact before/
after values are above and in the harness/tests.

Retained: £250 start once, no debt/bailout; Q-School fees/basis/no failure refund;
all other fees/prizes/night/travel tariffs; 28 Pro events and large catalogue;
large founding NPC universe; existing variance/context/intake/development/
retirement; difficulty shifts −4/0/+4; local, established and elite monetary
backing; sporting qualification/rank/card authorities; Classic Tour's five
difficulties and 305 trophies; A8.3 identity/navigation/guidance/state meaning.
No speculation-driven scoring, NPC or prize changes.

## Verification commands and scope

From repository root (Node 24):

```sh
# Final pure/model/rules run: 85/85.
node --max-old-space-size=320 --test --test-force-exit \
  --test-isolation=none --test-reporter=tap \
  artifacts/api-server/src/lib/__tests__/career-a9.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-a65-live-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-bot-adapter.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-a83-model.test.ts \
  artifacts/api-server/src/lib/__tests__/darts-rules.test.ts

# Earlier focused live DB run: 1/1; see rerun limitations below.
node --max-old-space-size=256 --liftoff-only \
  --wasm-num-compilation-tasks=1 --test --test-isolation=none \
  --test-name-pattern='A9 new root' --test-reporter=tap \
  artifacts/api-server/src/lib/__tests__/career-content-service.test.ts

NODE_ENV=production NODE_OPTIONS=--max-old-space-size=512 \
  node scripts/build-career-a83-styles.mjs /tmp/tkdl-a9-styles

# Final SSR fixture suite: 58/58.
NODE_ENV=production A9_BROWSER_DIR=/tmp/tkdl-a9-browser \
  A83_CSS_DIR=/tmp/tkdl-a9-styles/assets \
  node --max-old-space-size=400 --test --test-force-exit \
  --test-isolation=none --test-reporter=tap \
  artifacts/tkdl/src/lib/__tests__/career-ui.test.ts

node scripts/check-career-a9-browser.mjs
node --max-old-space-size=320 \
  artifacts/api-server/scripts/career-a9-evidence.ts
NODE_OPTIONS=--max-old-space-size=512 node_modules/.bin/tsc \
  -p artifacts/api-server/tsconfig.json --noEmit
node --max-old-space-size=640 scripts/check-career-types.mjs
node --max-old-space-size=512 artifacts/api-server/build.mjs
NODE_ENV=production artifacts/api-server/node_modules/.bin/esbuild \
  artifacts/tkdl/src/features/career/index.tsx --bundle --platform=browser \
  --packages=external --format=esm --alias:@=./artifacts/tkdl/src \
  --outfile=/tmp/a9-career-ui.js
git diff --check
```

Completed final runs: **85/85** pure/model/rules and **58/58** SSR tests
(143 final-code tests), **80/80** browser page/viewport checks, four additional
orientation/height transitions and simulated insets; all **2,640** scoring
matches complete. API typecheck exits 0 with no diagnostics. API production
build, scoped Career JS/CSS, scoped ordinary Layout/Login/Practice JS and
production stylesheet build exit 0. `git diff --check` exits 0.

Ordinary changed-entry bundle command:

```sh
NODE_ENV=production artifacts/api-server/node_modules/.bin/esbuild \
  artifacts/tkdl/src/components/layout.tsx \
  artifacts/tkdl/src/pages/login.tsx artifacts/tkdl/src/pages/practice.tsx \
  --bundle --platform=browser --packages=external --format=esm \
  --alias:@=./artifacts/tkdl/src --outdir=/tmp/a9-ordinary-ui
```

The Career frontend checker was stopped after approximately 12 minutes without
a result; **no final frontend typecheck pass is claimed**. No whole-app Vite
build or whole-frontend typecheck pass is claimed.
Publication outcomes are recorded in the completion report. The Career checker filters
to Career diagnostics and is not a whole-frontend typecheck. The scoped JS
bundle externalises packages and is not a full application distribution.
The CSS-only production build uses real entry/global/Tailwind/Career styles.

An intermediate full content-service run was stopped after nine minutes;
a full first-year simulation exceeded five minutes. Later legacy finance and
live-DB reruns also exceeded their bounded budgets and are not counted as
passes. The earlier successful 1/1 boundary run took 53.6 seconds, before the
final professional cash-conditioning refinement; its assertions concern pins,
start ledger, generation and annual transition, not final contract economics.
Do not misrepresent it as a fresh final-code full integration pass.
Earlier fixture/bonus assertions were corrected; only completed final passing
runs count as final-code tests. Heavy checks are resource-sensitive here.

## Compatibility and deferred work

A1–A8.3 authorities, save isolation, historical pins and accepted snapshots
remain intact by design; focused tests cover old calendar hashes/terms and
scorer/model compatibility, not every prior integration workflow.
Classic Tour code, seed, five difficulties and 305 trophies were not edited;
its actual menu also appears in shared-Layout browser fixtures.

Human playtest must assess full establishment pacing/savings, Q-School
qualification/failure and recovery, consecutive professional season
affordability, actual long-run sponsor acquisition/renewal, checkout feel,
actual drawer/map gestures and physical-device/PWA safe areas/keyboards.
The economics use selected finishes and cannot settle those questions.

A10 deferrals: whole-app/release hardening and regression certification,
independent remote audit, real multi-season playthroughs, arbitrary-seed and
complete event-field coverage, deployment and the separately authorised
Career-only beta wipe. **STOP after the single non-force A9 publication.**
