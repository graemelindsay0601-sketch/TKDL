# Tour Career 2.0 — sporting-completeness certification

Sporting implementation and focused integration evidence delivered. All 505
executed regression tests pass. This is **not an all-green release certificate**:
the full frontend TypeScript check did not finish within the attempted limits.
No A10 work, release, deployment, production migration, tuning or data wipe occurred.

## STARTING SHA

`75c679ad4e919e48754775b8a34283b711595a88`, on local `main`, initially clean.
Starting tree: `30fa56696e1f9e80684832cd30c5ba5c580a18a8`.
Remote main was rechecked and still matched this approved baseline.

## FINAL SHA

Recorded in the delivery message after committing this report. A report cannot
contain its own enclosing commit hash without changing that hash.

## FINAL TREE SHA

Recorded in the delivery message; obtain independently with
`git rev-parse HEAD^{tree}`.

## COMMITS CREATED

One retained certification commit, made on local `main`. An earlier unpublished
local commit (`424ecf9`) was created, but a workspace restart reset local Git
metadata before delivery; source edits survived. Thus there were two local
commit creations, with one retained certification commit in the final history.
A separate remote review branch points at the delivered tree for draft-PR
delivery; no force-push or intentional history rewrite.

## FILES CHANGED

Calendar capability, season rhythm, future-event refresh, qualifying-seat
reservation and champion diagnostics; bootstrap-provider naming and A5 comments;
Career presentation/entry guards; regression fixtures and certification tests;
test-only native PostgreSQL adapters and Classic seed harness; catalogue matrix
and this report. No shared GameScorer, A2 scoring kernel, Classic seed or Classic
routes were changed.

The complete authoritative list is `git show --stat --oneline HEAD`:

```text
artifacts/api-server/scripts/career-cert-postgres-fixture.mjs
artifacts/api-server/scripts/career-cert-postgres-loader.mjs
artifacts/api-server/scripts/career-certification-matrix.ts
artifacts/api-server/scripts/classic-tour-certification.mjs
artifacts/api-server/src/career/calendar/catalogue.ts
artifacts/api-server/src/career/calendar/certification.ts
artifacts/api-server/src/career/calendar/config.ts
artifacts/api-server/src/career/calendar/engine.ts
artifacts/api-server/src/career/calendar/formats.ts
artifacts/api-server/src/career/calendar/harness.ts
artifacts/api-server/src/career/calendar/providers.ts
artifacts/api-server/src/career/content/world.ts
artifacts/api-server/src/career/sporting/cards.ts
artifacts/api-server/src/career/sporting/engine.ts
artifacts/api-server/src/lib/__tests__/career-a6-http.test.ts
artifacts/api-server/src/lib/__tests__/career-a65-identity.test.ts
artifacts/api-server/src/lib/__tests__/career-a65-live.test.ts
artifacts/api-server/src/lib/__tests__/career-calendar-season.test.ts
artifacts/api-server/src/lib/__tests__/career-calendar.test.ts
artifacts/api-server/src/lib/__tests__/career-certification.test.ts
artifacts/api-server/src/lib/__tests__/career-content-service.test.ts
artifacts/api-server/src/lib/__tests__/career-content.test.ts
artifacts/api-server/src/lib/__tests__/career-finance.test.ts
artifacts/api-server/src/lib/__tests__/career-world-service.test.ts
artifacts/api-server/src/lib/__tests__/career.test.ts
artifacts/tkdl/src/features/career/model.ts
artifacts/tkdl/src/features/career/pages/event.tsx
artifacts/tkdl/src/features/career/pages/match-boundary.tsx
artifacts/tkdl/src/features/career/pages/palace.tsx
artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts
artifacts/tkdl/src/lib/__tests__/career-ui.test.ts
artifacts/tkdl/src/lib/__tests__/team-result-graphic.test.ts
docs/career-certification-matrix.json
docs/tour-career-sporting-certification.md
```

## EVENT CERTIFICATION SUMMARY

See [the complete machine-readable matrix](career-certification-matrix.json):
**92 definitions, 55 families; baseline A=69, B=20, C=3, D=0; final 72
adapter-supported/playable definitions and 20 intentionally benched definitions.**
This is exhaustive catalogue/adapter classification, not a claim that every
definition received an independent human playthrough.

Each matrix row records identity, internal inspiration, circuit, competition
classification, ranking category, field/sides, schedule, game/score/in/out rules,
scoring unit, legs per set, every stage and round length, eligibility,
qualification dependencies/outputs, original selection quotas/weights/geography,
minimum attendance, presentation tier, human/NPC/framework support, finance
settlement, baseline class, correction and final status.

### Every class C definition

| Definition | Finding and implemented decision |
|---|---|
| `county-301-sprint` | Obsolete 501-only capability guard hid an existing shared-scorer/A2 301 path. Enable the existing legal X01 adapter; actual public entry, human scoring, NPC progression, finance, completion and earned sponsor acceptance pass. No new game engine. |
| `county-701-open` | Same obsolete capability restriction for 701. Existing adapters reused; actual public entry, human scoring, NPC progression and ledger reconciliation pass. |
| `world-darts-championship` | Palace SETS were executable but presentation still claimed otherwise. Additionally, zero-general-filler selection omitted genuine qualifying seats outside the invitation quota. Reserve those seats before invitation sampling using existing eligibility and weights. The same controlled fixture gives 109 entrants without that fix and 128 with it. |

### Every class B definition

These remain informational, explicitly non-playable. Future unplayed instances
are terminal `CANCELLED / INTENTIONALLY_BENCHED`, without fields, draws or fees.
No unsupported ruleset was converted into fake X01.

| Definition | Retained identity / reason for bench |
|---|---|
| `pub-doubles` | Pairs; singles Career does not provide partner rotation, team match records or equivalent NPC execution. |
| `cricket-classic` | Cricket; standalone support is not a verified Career live/replay/NPC/tournament adapter. |
| `halve-it-night` | Halve-It targets/halving; no equivalent Career adapter. |
| `killer-night` | Killer elimination; no equivalent Career adapter. |
| `football-darts` | Football goals/saves; no equivalent Career adapter. |
| `golf-night` | Golf course scoring; no equivalent Career adapter. |
| `count-up-challenge` | Fixed-dart Count-Up; no equivalent Career adapter. |
| `regional-champions-league` | Authored league identity/schedule, not fixed Vault 4×4-to-8 progression. No arbitrary league conversion. |
| `thursday-night-darts` | Distinct league/playoff identity, not fixed Vault progression. No arbitrary league conversion. |
| `shanghai-showdown` | Shanghai targets; no equivalent Career adapter. |
| `bobs-27-challenge` | Bob's 27 doubles challenge; no equivalent Career adapter. |
| `scram-shootout` | Scram roles/targets; no equivalent Career adapter. |
| `baseball-darts-classic` | Baseball innings; no equivalent Career adapter. |
| `fives-festival` | Fives scoring; no equivalent Career adapter. |
| `national-halve-it` | National Halve-It identity retained; no equivalent Career adapter. |
| `national-cricket` | National Cricket identity retained; no equivalent Career adapter. |
| `golf-18-open` | Eighteen-hole golf identity retained; no equivalent Career adapter. |
| `snooker-darts-cup` | Snooker scoring/colours; no equivalent Career adapter. |
| `noughts-and-crosses-trophy` | Grid/line objectives; no equivalent Career adapter. |
| `treble-out-trophy` | Master/treble-out identity retained. Shared scorer options alone are insufficient: Career NPC finishing has no certified equivalent adapter. |

There are no class D definitions requiring a new product decision.

## SPORTING FORMAT DECISIONS

- Palace: 128-capacity singles, 501 SI/DO, SETS, BO5 legs per set;
  rounds BO`[3,3,5,5,7,7,13]` sets; Sovereign Trophy identity retained.
- Double Crown: 32 singles, 501 DI/DO, SETS, BO5 legs per set;
  rounds BO`[3,3,5,5,7]` sets. Same shared kernel, not a Palace-only fork.
- Vault Nights: 16 singles, four groups of four, top two into fixed eight-player
  knockout. Existing sporting tie/bull-playoff rules retained; no random
  promotion or reseeding. All five natural season instances completed with
  24 group matches and seven knockout matches apiece.
- Grand Championship: retain the locked A8.1 long straight-leg knockout.
  Historical group inspiration does not override the fictional authored identity.
- Amateur World Masters: deliberately retain authored long-leg knockout.
  Historical set inspiration is not authority to rewrite fictional v5 identity
  or immutable historical snapshots.
- Champions Masters: likewise retain authored straight-leg knockout.
- Legal 301/701 reuse existing shared X01 and A2 capabilities. No generic scoring
  engine, pairs framework, special game, league framework or tuning was added.

## IMPLEMENTED FIXES

1. Capability version 4 recognises legal existing X01 starting scores rather
   than treating all non-501 formats as unsupported.
2. Future capability refresh always runs, even when execution booleans do not
   flip. Already-played/history rows remain immutable.
3. Unsupported future events are deliberately benched immediately, rather than
   advertised as opportunities that later fail at close.
4. Zero-general-filler selection reserves the qualifying portion of capacity
   before invitation sampling. Original invitation quotas, eligibility,
   geography, weights and minimum-attendance rules remain unchanged.
5. One six-phase rhythm is exported to calendar and content: Opening Swing
   1–6; Spring Circuit 7–17; Summer Tour 18–28; Championship Race 29–38;
   Major Season 39–46; World Championship Period 47–52. Fractional, invalid and
   out-of-range weeks are rejected. No authored event dates were moved.
6. The cached founding/home status fallback is explicitly bootstrap/unranked,
   not an A3 ranking authority. Live composition binds A5; no fake ranks added.
7. Palace/event/match presentation no longer claims supported sets or 301/701
   are unavailable; benched formats cannot launch matches. Trophies appear only
   for completed events.
8. Champion diagnostics now inspect the final stage, not a group-stage win
   with the same round number as a knockout final.
9. Stale tests were corrected: historical version pins, immutable terminal
   statuses, original A2 tier snapshots, current creation/retirement contracts,
   nine ranking lists, explicit sponsorship replacement, asynchronous denial
   probes and genuine pairs bench fixtures.
10. Two pre-existing broadcast graphic test failures reproduced at the approved
    baseline. Fixtures now use the numeric winner/loser counts emitted by the
    actual producer; production graphic rendering was not changed.

## FULL INTEGRATION FINDINGS

The final composed live suite passes **19/19**. The Palace and Double Crown
cases use current v5 definitions, public human entry, actual bull-up/shared
scoring, pause/reload, validated human throws, remaining A2 NPC bracket
progression, final placement/champion, A4 reconciliation, A5 contributions,
A7 real-match evidence and completed-event identity.

Duplicate completion is tested against both counts and deterministic row-content
digests for every table owned by that save, plus the root balance. This detects
updates as well as accidental additional rows; the retries change neither.

The major cases intentionally use labelled, controlled historical sporting
fixtures: a legal 32-entry prior `long-format-matchplay` result awards the
authored £5,000 R32 prize through A4 and publishes standings through A5. It was
not a manually played past trophy. Three actual regional World qualifiers run
through A2 from preconfirmed legal minimum-size eight-player fields and produce
12 real qualification grants. The fixture supplies eligible fields, not
scripted qualifier winners, direct cash credits, fabricated human ranks or
fabricated human Tour Cards. Boundary-clock setup and cancellation of unrelated
pending opportunities are test-only. Do not confuse these controlled cases with
a naturally played human year.

Separately, a fresh current-v5 NPC year runs **all 52 real weekly advances** with
no clock jumps, funding/rank/result injections or human entry fixtures:

- 631 event instances: **518 COMPLETED**, **65 intentionally benched**, and
  **48 cancelled for insufficient entrants**.
- **518/518** completed events have valid final-stage champions.
- **12,785/12,785** A2 simulated matches link to tournament matches.
- Five full 16-player Vaults; Double Crown full 32; Palace naturally **124**.
- Zero remaining bookings, invalid entries or duplicate entitlements.
- Exactly 52 A2 periods and one off-season; 98 actual A5 card changes.
- Real season-2/week-1 review boundary, captured review, replay stability and
  season-begin confirmation; the non-entering human has zero invented titles.

The natural Palace field of 124 is lawful under the unchanged minimum of 64;
the controlled full-128 result does not imply every natural seed fills capacity.
No force-fill, eligibility, invitation-quota or sporting-weight tuning was made.

The other suites cover earned amateur/pro paths, qualification/card lifecycle,
ranking expiry, sponsor and travel/ledger contracts, three active slots,
save isolation, restart/retirement, live forgery/stale revisions/races,
relationships/goals/life/recognition/legacy and evidence-driven A7 projections.
Default v5 intentionally omits first-season Q-School under its approved
`ESTABLISHMENT_V1` policy; legacy fixtures pin their original content versions
rather than changing that policy or moving Q-School dates.

## TESTS

Final executed unit/integration totals: **505 tests, 505 pass, zero fail**,
plus 84 independent A9 browser checks and simulated safe-inset geometry.
These verified results were recorded before a workspace restart. Temporary TAP
logs, browser fixtures, build outputs and the private PostgreSQL server did not
survive it; this report records the results, not a claim of a post-restart rerun.

All commands below run from repository root. Database socket:
`/tmp/tkdl-certification/postgres-socket`. Native tests run serially.
The native invocation is shown with its reproducible 180-second guard; earlier
individual suite runs also used a 100-second guard. Neither guard substitutes
for or changes the recorded test outcome.

```sh
# Run each of the 25 career*.test.ts API files individually (305 total).
CAREER_CERT_PG_SOCKET=/tmp/tkdl-certification/postgres-socket \
timeout -k 5s 180s node --max-old-space-size=384 \
  --import ./artifacts/api-server/scripts/career-cert-postgres-loader.mjs \
  --test --test-isolation=none --test-force-exit --test-reporter=tap \
  artifacts/api-server/src/lib/__tests__/<file>.test.ts

# Shared ordinary X01/bull-up/bot rules: 27/27.
node --max-old-space-size=384 --test --test-reporter=tap \
  artifacts/api-server/src/lib/__tests__/darts-rules.test.ts

# Actual Classic native seed/idempotence: 1/1, all 305 combinations asserted.
CAREER_CERT_PG_SOCKET=/tmp/tkdl-certification/postgres-socket \
node --max-old-space-size=384 --experimental-test-module-mocks \
  --import ./artifacts/api-server/scripts/career-cert-postgres-loader.mjs \
  --test --test-isolation=none --test-force-exit --test-reporter=tap \
  artifacts/api-server/scripts/classic-tour-certification.mjs

# All frontend library tests except the separate SSR suite: 114/114.
files=$(find artifacts/tkdl/src/lib/__tests__ -maxdepth 1 -name '*.test.ts' \
  ! -name 'career-ui.test.ts' | sort)
NODE_ENV=production node --max-old-space-size=384 --test \
  --test-concurrency=1 --test-force-exit --test-reporter=tap $files

# Actual component SSR + generated browser fixtures: 58/58.
NODE_ENV=production A9_BROWSER_DIR=/tmp/tkdl-a9-browser \
A83_BROWSER_DIR=/tmp/tkdl-a83-browser \
A83_CSS_DIR="$PWD/artifacts/tkdl/dist/public/assets" \
node --max-old-space-size=400 --test --test-force-exit --test-isolation=none \
  --test-reporter=tap artifacts/tkdl/src/lib/__tests__/career-ui.test.ts

# Chromium: 80 viewport/page + 4 orientation/dvh transitions, insets also checked.
NODE_ENV=production node --max-old-space-size=384 \
  scripts/check-career-a9-browser.mjs /tmp/tkdl-a9-browser
```

| API Career file | Passing tests |
|---|---:|
| career | 18 |
| career-a6-http | 7 |
| career-a65-identity | 9 |
| career-a65-live | 19 |
| career-a65-simulation | 3 |
| career-a66-flags | 1 |
| career-a82-tournament | 15 |
| career-a9 | 6 |
| career-calendar | 17 |
| career-calendar-season | 10 |
| career-certification | 7 |
| career-content | 15 |
| career-content-service | 14 |
| career-facts | 3 |
| career-finance | 18 |
| career-goals | 10 |
| career-legacy | 18 |
| career-life | 24 |
| career-recognition | 21 |
| career-relationships | 6 |
| career-relationships-http | 4 |
| career-simulation | 8 |
| career-sporting | 28 |
| career-world | 8 |
| career-world-service | 16 |
| **Total** | **305** |

Four v1/v2 season-1/season-2 immutable-content hashes were independently
measured in a detached approved-baseline worktree and matched current content,
excluding exactly `draft.executable` and `snapshot.capability`. Dates, rules,
fees, eligibility, identities and definition hashes are otherwise byte-identical.
Historical persisted immutability and version compatibility have separate DB tests.

The intentionally failing reservation regression is additional diagnostic
evidence, not counted as a passing test: temporarily removing only the fix from
the same valid major fixture gives 109 versus the required 128. The fix was
restored before the final 19/19 live-suite rerun.

## DATABASE TEST RESULT

**PASS for the executed isolated native PostgreSQL regressions.** PostgreSQL
16.15, private Unix socket, no TCP; fsync and synchronous commit enabled. Each
test fixture creates and drops only its own random `career_cert_*` database.
Application credentials/production data are never used.

The loader adapts test-only PGlite/Drizzle imports to node-postgres and executes
real SQL, migrations, transactions and concurrency. It is not imported by the
application. This proves native PostgreSQL behaviour, **not** a complete
PGlite/WASM-driver certification. Migration/old-root/current-v5/snapshot/live/
A7/cascade and accounting paths are covered by the suites above.

## TYPECHECK RESULT

**Full API PASS, exit 0:**

```sh
timeout -k 5s 90s node --max-old-space-size=512 \
  node_modules/typescript/bin/tsc -p artifacts/api-server/tsconfig.json --noEmit
```

**Full frontend INCOMPLETE, not a pass.** No scoped check is substituted.
Full-project commands timed out with exit 124 and no emitted diagnostics:

```sh
# 240-second initial full check, 768MB heap.
timeout -k 5s 240s node --max-old-space-size=768 \
  node_modules/typescript/bin/tsc -p artifacts/tkdl/tsconfig.json --noEmit
# 180-second nonincremental retry, 1024MB heap.
timeout -k 5s 180s node --max-old-space-size=1024 \
  node_modules/typescript/bin/tsc -p artifacts/tkdl/tsconfig.json \
  --noEmit --incremental false
# 300-second trace-enabled full check, 1280MB heap.
timeout -k 5s 300s node --max-old-space-size=1280 \
  node_modules/typescript/bin/tsc -p artifacts/tkdl/tsconfig.json \
  --noEmit --incremental false \
  --generateTrace /tmp/tkdl-certification/frontend-trace
```

The 300-second trace was still checking `pages/admin/feature-flags.tsx`.
A type-only Lucide-icon constraint experiment also timed out at 150 seconds;
it did not establish a remedy and was **reverted**. An independent approved
baseline full check at 1024MB/90 seconds also timed out, still in
`pages/submit-match.tsx`. Budgets differ: this does not establish the same
failure location or prove the current check would eventually pass.
The cause and eventual full diagnostic result remain unknown. A longer-running
full-project compiler/CI check remains the specific outstanding verification.

## PRODUCTION BUILD RESULT

**Both complete builds PASS, exit 0.** Not CSS-only substitutes.

```sh
NODE_ENV=production timeout -k 5s 120s node --max-old-space-size=512 \
  artifacts/api-server/build.mjs
NODE_ENV=production timeout -k 5s 150s node --max-old-space-size=768 \
  artifacts/tkdl/node_modules/vite/bin/vite.js build \
  --config artifacts/tkdl/vite.config.ts
```

API output `dist/index.mjs` and workers; frontend complete `dist/public`.
Building does not establish a completed TypeScript check or deployed runtime.

## CLASSIC REGRESSION RESULT

Actual unchanged Classic seed executes twice in its own native fixture:
61 tours, five nonempty actual bot-persona pools, 305 unique trophy definitions,
positive gamerscore, valid authored bracket/leg/set metadata, idempotent rows.
These are **305 configuration combinations, not 305 complete played tournaments**.
Ordinary shared darts rules pass 27/27; frontend setup/recovery/game-rule
regressions are included in the 114/114 result.
Classic routes, seed, page and shared kernel were checked byte-unchanged against
the approved baseline; no Career-specific assumption was injected into them.

## KNOWN LIMITATIONS

- Full frontend typecheck remains incomplete; do not claim an all-green release.
- Twenty intentional benches remain non-playable, by design and explicitly shown.
- Full-128 controlled Palace evidence differs from the natural 124-player year.
- Major intake/funding setup uses disclosed prior sporting/field/clock fixtures;
  it is not an uninterrupted human season or manually played prior trophy.
- Native PostgreSQL coverage does not certify the PGlite/WASM-specific driver.
- Automated geometry is not physical-device notch, keyboard, swipe or hydration
  verification. No claim of manual production/user-account playtesting.

## MANUAL TEST NOTES

Automated SSR, Chromium geometry and genuine HTTP/live-dart cases ran; no
human-operated end-to-end browser playthrough was performed.
Recommended local human checks: start a new adult and junior save; verify the
six phase labels/eligibility; enter a 301/701 event; play, pause and resume SI
Palace and DI Double Crown sets; inspect placement/ledger/ranking/trophy/history;
confirm a benched pairs/special/league cannot start; cross the actual review
boundary; test mobile drawer, keyboard and physical safe areas. Do not use the
historical format-lab fixture as evidence of natural major qualification.

## DEPLOYMENT STATUS

**NOT DEPLOYED.** No release, production migration, rollout, feature enabling
or A10 work.

## DATA WIPE STATUS

**NOT WIPED.** Only owned temporary certification fixtures were created/dropped;
no user Career, Classic or production data was altered.

## STOP

Stop here before A10, release, deployment or a wipe. Preserve the explicit
frontend-typecheck evidence gap for the next full CI/compiler verification.
