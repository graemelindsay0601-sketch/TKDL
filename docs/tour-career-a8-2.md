# A8.2 — Tournament Experience

## Checkpoint and scope

Starting main: `e363e41b19e414d3c3052bc49db960dd5c9e397f`.
Starting tree: `ae87533d1d4a429b1ddcb8485b45dee2e8b2e297`.
Both were independently checked against GitHub before implementation. The starting working tree was clean.

This phase adds a temporary Career Tournament Mode, not a replacement Career application.
It stops at A8.2: no A8.3, A9 or A10 work, XP, boosts, scripted outcomes, second scorer,
second wallet, invented pre-save history or new reputation-based eligibility.

## Architecture and authority

| Concern | Authority |
| --- | --- |
| Eligible/confirmed field, seeding, immutable draw, fixture progression, placements | A3 calendar and existing providers |
| NPC X01 matches and sporting inputs | Existing A2 simulation, performance and bot adapter |
| Bull throws and ties | Shared `botBullThrow` / `resolveBullUp` |
| Human darts, server verification and recovery | A6.5 session log and shared GameScorer |
| Entry fees, refunds, travel, prize credit | A4 ledger / financial completion hooks |
| Rankings, invitations, Q-School and tour cards | A5, unchanged |
| Played statistics and history | A7.1 |
| Opponent/H2H/rivalry context | Read-only A7.2 projection |
| Season review, NPC histories and trophy cabinet | Existing A7.6 / A8.1 results |
| Arrival, reveal, walk-on, acknowledgement | Presentation only |

`career/tournament/service.ts` reads owned sporting facts and exposes the hub.
It does not simulate, mint prizes, classify a new rivalry or accept a browser winner.
Cosmetic preferences and terminal acknowledgement use save settings; sporting progression
still goes through A3 under the existing root lock. Public projection selects identity,
published ranking, recorded titles, contracts and fixture facts, not ability/potential/bot seeds.

## Routes and lifecycle

- `/career/:saveId/tournaments/:eventId`: hub, next action, saved result and terminal summary.
- `/career/:saveId/tournaments/:eventId/matches/:matchId`: match preparation for the same stored fixture.
- `/career/:saveId/matches/:matchId/play`: existing server-authoritative GameScorer.

Home offers active/resumable tournaments and recent, unacknowledged completed summaries.
Acknowledgement records up to 128 event IDs and cannot restart an event or change a result.
Historical tournaments remain available through event/history routes. Multiple terminal
acknowledgements do not make an older summary reappear.

The projected phases include preview, arrival, draw ready, match ready, bull-up, live match,
between sessions, group bull playoff, elimination, withdrawal, championship, completion and cancellation.
Phases derive from entries, matches, session status and permanent results, not a client state machine.
NPC matches progress in round waves; later rounds cannot run ahead of a pending human round.
Future sporting days continue through A3's actual calendar.

The hub includes the official draw and round/stage filters, confirmed field/entry routes,
completed fixtures, actual placements, group tables, current opponent and played H2H,
A4 secured/settled prize information, A5 qualification links, tournament run and history links.
Unavailable fields/results remain unavailable rather than receiving fictional values.

## Presentation

Five levels: floor/local, featured, televised/stage, major and World Championship.
A World Championship qualifier remains a qualifier, not a World Championship victory.
Default depth is **BALANCED**. **FULL** adds available ceremony/context; **QUICK** omits ceremony.
Reduced-motion settings and the OS preference disable animation. Ceremonies can be skipped.
Nothing about these choices changes field, draw, bull, bot, score, RNG history, prize or qualification.

Opponent cards show nationality, nickname, published World position where present, recorded
titles, at most two factual badges and contract-controlled human sponsor identity.
NPC commercial identity uses the existing deterministic A8.1 commercial model.
Rivalry labels and meetings come from A7.2 and do not feed seeding or performance.

The Palace keeps its authored Alexandra Grand Hall/London identity and escalating set play.
Its champion screen uses an original tall silver **Sovereign Trophy** SVG, not a crown.
World Championship runner-up is labelled explicitly. Trophy/history links use existing
ownership evidence; no trophy ownership table is added.

Prior appearances are confirmed A3 draw appearances. Recent champions, previous best finish,
debut/appearance count and former World Champion context come only from this save's draw/result
history. A first confirmed Palace field receives debut context; a later appearance does not.
Walkovers are still labelled unplayed, even when they belong to a confirmed field appearance.
Q-School session winners are not presented as a newly awarded tour card or an ordinary title.

## Executable structures

Existing X01 single knockout remains supported: straight-in/double-out, DIDO and set play,
with the existing authored round lengths and fields up to the A3 maximum of 128.
Unsupported game/structure combinations remain honest unsupported content.

New catalogue version **4** changes only Vault Nights' sporting structure relative to v3:

- Sixteen real confirmed entrants, exactly four groups of four; full-field fill/minimum 16.
- Three round-robin rounds: A–D/B–C; A–C/D–B; A–B/C–D, once per pair.
- Group matches best of nine legs; quarter-final/semi-final/final best of 11/13/15.
- Top two per group feed four stored QFs: A1–B2, C1–D2, B1–A2, D1–C2.
- Twenty-four group fixtures plus seven knockout fixtures, created once by A3.

Grand Championship retains its authored knockout fallback. Palace set play, Double Crown
DIDO and A5 Q-School session/card policies are not replaced.

### Standings and bull playoffs

Standings use sporting wins, leg difference, legs won, clean two-way H2H, then a real bull
playoff where a qualifying position/order is unresolved. Circular multi-player ties never
use premature two-way H2H, participant ID, hidden ability, an upset roll or a coin toss.
Equal positions are displayed as tied until sporting evidence resolves them.

P/W/L and legs count completed played matches. Walkover wins are tracked separately and count
toward sporting wins without inventing played darts. Double withdrawals create honest VOID paths.
Third/fourth equality need not be broken if it cannot affect the qualifying places.

Bull pair scheduling follows the original draw seats. Each required place is selected through
actual persisted shared bull wins, removing that winner before selecting the remaining place.
NPC throws use the existing performance/bot adapter and shared throw function. Human turns stop
for the real BullUpBoard, with revision validation, inner > outer > miss, and tied rethrows.
Unresolved bull rows are resumable and appear as a separate calendar tournament action,
not as a fabricated scoring-match UUID. Bull throws create no match, H2H, title or leg statistic.

Qualifiers feed the original QF slots exactly once. After qualification is locked, a withdrawal
does not re-rank/reseed or replace a participant in the knockout. Original fixtures and already
played results remain intact. A group-stage match loss/concession alone does not eliminate the human.

## Draws, withdrawal and settlement

The existing A3 seeding/field providers and draw random stream are reused. Draw reads, reveals
and reloads never reshuffle. Missing, extra, ambiguous or contradictory draw fixtures raise an
error; they are not repaired by generating a replacement draw.

Byes, walkovers and VOID paths are never recorded as played darts or H2H meetings.
Explicit match concession resolves only the requested pending human fixture as a walkover.
Explicit tournament withdrawal uses the existing A3/A4 policy and ends participation.
Late withdrawal does not grant a new refund. Pausing, navigation and browser loss do not withdraw.
An all-withdrawn final cancels with no invented champion and no late refund callback.

Permanent results are inserted once; existing A4/A5 completion hooks remain authoritative.
All confirmed drawn entrants receive factual placement, including group-out position 9.
A champion may legitimately have played group losses, but no knockout loss. The additive result
constraint accepts documented group losses while retaining the original zero-loss KO champion rule.
Played statistics exclude walkovers. Special cash is not converted into World-ranking money.

## Persistence and recovery

Additive `career_group_bull_playoffs` stores pair, throw list, revision and actual winner.
Completed bull rows and all completed match/result history retain database immutability guards.
The schema is installed by the existing calendar migration, without backfilling results.

Live recovery uses the existing session ID, server revision and verified dart log. Returning from
the hub/preparation or reopening a match resumes that same session. A stale or no-longer-pending
action is rejected. Existing session-lost recovery and shared replay/checkpoint logic are unchanged.
Pause/abandon navigation returns to the tournament; verified completion links to tournament
progress/preparation rather than reporting a winner from the browser.

Repeated reads, cosmetic changes, retry, completed-event progression and acknowledgement do not
duplicate simulated matches, result, prize, H2H, qualification or trophy ownership.

## Compatibility

New saves pin event database 4 and retain player database 2. All v1/v2/v3 catalogue definitions
remain immutable, and existing saves retain their event version for future seasons as well.
An older Vault stays its saved knockout structure; no existing live/completed event is migrated
into groups. Older unsupported group formats do not silently become executable.

Capability engine version 3 distinguishes the supported v4 group-knockout capability; A2 X01
simulation version is unchanged. Original A4/A5 regression fixtures explicitly pin v1; A8.1
content-service fixtures explicitly pin v3. Existing A6.5 fixtures retain their v1/v2 pins.

No Classic Tour screen/scorer, generic darts rules, A5 policy, wallet, reputation modifier,
public persona authority, Career save owner or retirement authority is replaced.

## Verification commands

Run from repository root. Resource-conscious native Node 24 / isolated PGlite processes:

```sh
# Run each file below separately (320 MiB for career-a65-live).
node --max-old-space-size=256 --liftoff-only --wasm-num-compilation-tasks=1 \
  --test --test-isolation=none --test-reporter=tap \
  artifacts/api-server/src/lib/__tests__/FILE.test.ts
```

Passing API files:

| FILE | Passed |
| --- | ---: |
| career-a82-tournament | 15 |
| career-calendar | 17 |
| career-content | 15 |
| career-content-service | 11 |
| career | 18 |
| career-facts | 3 |
| career-relationships | 6 |
| career-relationships-http | 4 |
| career-legacy | 18 |
| career-a65-simulation | 3 |
| career-a65-live | 14 |

```sh
node --max-old-space-size=256 --liftoff-only --wasm-num-compilation-tasks=1 \
  --test --test-isolation=none --test-reporter=tap \
  --test-name-pattern='prize bands map|trip grouping' \
  artifacts/api-server/src/lib/__tests__/career-finance.test.ts

NODE_ENV=production node --max-old-space-size=400 --test --test-isolation=none \
  --test-reporter=tap artifacts/tkdl/src/lib/__tests__/career-ui.test.ts

node --max-old-space-size=256 --test --test-isolation=none --test-reporter=tap \
  artifacts/tkdl/src/lib/__tests__/career-a65-live-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-a6-model.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-bot-adapter.test.ts \
  artifacts/tkdl/src/lib/__tests__/career-model.test.ts \
  artifacts/api-server/src/lib/__tests__/darts-rules.test.ts

node --max-old-space-size=640 scripts/check-career-types.mjs
NODE_OPTIONS=--max-old-space-size=512 node_modules/.bin/tsc \
  -p artifacts/api-server/tsconfig.json --noEmit
node --max-old-space-size=512 artifacts/api-server/build.mjs
NODE_ENV=production artifacts/api-server/node_modules/.bin/esbuild \
  artifacts/tkdl/src/features/career/index.tsx --bundle --platform=browser \
  --packages=external --format=esm --alias:@=./artifacts/tkdl/src \
  --outfile=/tmp/a82-career-ui.js
git diff --check
```

Scoped finance: 2 passed. Real-component production SSR: 46 passed (including three A8.2 cases).
Frontend models/shared darts: 73 passed. Total completed tests: **245 passed, 0 failed**.
API and Career type checks clean; API production build and scoped Career JS/CSS bundle pass.
The obsolete pre-A8.1 13-item navigation expectation is updated to the existing 17 items;
A8.2 does not add a permanent navigation layer.

The A8.2 tests exercise actual PGlite migrations/providers, 31 stable fixtures, round barriers,
read/preference sporting hashes, authentication/ownership/no-store, hidden-field exclusion,
shared live reopening, concession, complete group-to-title run, exact-once prize/result,
real persisted human bull turns and stale revisions, Q-School allocation refusal while its
pathway is unfinished, non-ranking cash, immutable final rows, late-withdrawal bracket lock,
corruption refusal, history derivation and resumable terminal acknowledgement.
Rare circular ties use explicitly controlled test-only A3 score fixtures, not a production
ability override or fabricated runtime results.

## Limits and manual checks

- Full legacy A4/A5 suites did not finish their setup/workload in the constrained runner.
  Full A4 was stopped after approximately four minutes; an A5 scoped invocation hit its
  60-second setup limit. These are not counted as passing. Historical v1 fixture pins were
  restored explicitly; scoped finance and current v4 A4/A5 integration checks pass.
- No whole-application Vite build success is claimed. The previously impractical full build
  was not repeated; the API production build and relevant Career bundle/SSR checks passed.
- No interactive browser, mobile hardware or production deployment walkthrough was performed.
  Real component SSR verifies meaningful controls/text; type checks and scoped bundling cover
  the new routes. CSS includes mobile layout, horizontal tables, visible controls and reduced
  motion. Mouse/touch/keyboard ceremony traversal still warrants a real-device walkthrough.
- No NPC live spectating, custom audio, hour-by-hour scheduling or format-specific mini-game.
  There are no fabricated retrospective champions, synthetic starter matches or mock API routes.
- Confirmed-draw appearance context is distinct from played-match statistics. Old roots retain
  their catalogue, including the older Vault knockout, rather than receiving a silent upgrade.

## Publication

Commit the tested implementation and this document to **main**, without force.
Independently re-read GitHub's main ref, commit and tree after publication and compare them to
local HEAD/tree. Verify zero ahead/behind divergence and a clean working tree. The completion
report supplies the final immutable SHA/tree; this document does not self-reference its own
future commit hash. Stop before A8.3.
