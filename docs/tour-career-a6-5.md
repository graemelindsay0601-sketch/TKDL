# Tour Career 2.0 — A6.5: scorer hardening, live Career matches, Career identity

A6.5 sits between A6 (the Career UI shell) and A7 (narrative). It does three things:

1. **Audits and hardens the TKDL X01 scorer**: one shared rules engine for browser and server.
2. **Connects Career to the real scorer**: the human plays Career matches on the existing
   `GameScorer`, the server verifies every dart, and A3 records the result.
3. **Gives the Career player an identity and age**: date of birth, Career-time age, a junior
   pathway and the Q-School minimum age.

Nothing here starts A7. There is no news, narrative, rivalry or age-based decline.

---

## 1. Shared darts rules (`artifacts/api-server/src/shared/darts-rules/`)

The X01 rules exist once, as pure TypeScript with no DOM and no Node APIs:

| Module | Contents |
|---|---|
| `x01.ts` | `createMatch`, `throwDart`, `replay`, `starterFor`, `isValidFinish`, `opensLeg`, `validateDart`, `settledDartCount`, `visitsBy`, `describeFormat` |
| `bull-up.ts` | `resolveBullUp(firstOrder, throws)`, `botBullThrow(hitAcc, rng)` |
| `bot.ts` | `planBotX01Visit(remaining, skill, { doubleOut, opened, rng })`. This is the Classic Tour bot algorithm, unchanged, plus a double-in opening strategy. |
| `random.ts` | `seededRandom(...scope)` (cyrb128 + SFC32), identical in browser and Node |

The frontend imports these modules through `artifacts/tkdl/src/lib/darts-rules.ts`.

**Contract.** A match is fully defined by `(format, firstThrower, dart log)`. Every other value
is derived by `replay`: scores, opened state, legs, sets, starter, winner and visits. This is
what lets the server verify a match and lets a refresh resume it.

Format lengths are always best-of: `bestOfLegs`, or `bestOfSets` + `bestOfLegsPerSet`. The
`GameScorer` props `setsToWin` / `legsToWinSet` are also best-of values (`ceil(n/2)` is applied
inside). The names are misleading but are used consistently by every caller, so they were
documented rather than renamed.

### Capability matrix

| Rule | Shared rules engine | GameScorer X01 (UI) | Career live play (A6.5) |
|---|---|---|---|
| 301 / 501 / 701 / 1001 | yes (any starting score) | yes | **501 only** |
| Straight in | yes | yes | yes |
| Double in (dart order) | yes | yes | yes (Double Crown) |
| Master in | yes | — | no |
| Double out | yes | yes | yes |
| Straight out | yes | yes | no |
| Master / treble out, bull finish | yes (master/treble/bull) | local flags for TKDL specials | no |
| Legs (best of N) | yes | yes | yes |
| Sets (best of N sets, odd legs per set) | yes | yes | yes |
| Bull-up | yes | yes | yes (server-recorded) |
| Recovery (refresh / route change) | replay | v2 snapshot | server dart log |

Career formats outside the executable set stay **`UNSUPPORTED_FORMAT`** and are never faked:

- 301/701 variants
- master/treble-out
- groups/leagues and multi-stage events
- pairs
- non-X01 games

This is decided by `assessCapability` (`career/calendar/formats.ts`, `CAPABILITY_ENGINE_VERSION = 2`).
`refreshCapabilities` re-assesses the SCHEDULED / REGISTRATION_OPEN instances of existing saves
when the calendar opens.

---

## 2. Scorer audit

The audit covered `GameScorer`, `X01Scorer`, `CricketScorer`, the bot engine, scorer recovery and
the Classic Tour bull-up.

**Already correct (and now tested):**

- the opening double scores;
- a bust restores the start-of-visit score;
- leaving 1, or reaching 0 without a double, is a bust;
- the inner bull is a valid double and the outer bull cannot finish;
- the checkout dart ends the leg immediately;
- bot checkout plans are always legal.

### Bugs found and fixed

| # | Bug | Fix |
|---|---|---|
| 1 | **Set starter**: the legStarter alternated every leg, including the first leg of a new set. The wrong player started a set after an even number of legs. | `starterFor(format, firstThrower, setNo, legInSet)`; set starters alternate by set |
| 2 | **Bot hang**: if the bot won a leg on its own visit and also started the next leg, `turn` stayed `1`, the effect never re-fired and the match hung. | The bot effect is keyed on `[turn, botConfig, legNo, bust]` |
| 3 | **Bot-won bull-up**: the names were swapped but the bot stayed hard-wired to seat 1, so the human threw under the bot's name and the human's win was reported as the bot's. | X01/Cricket are "swapless": `firstThrower` is passed in and the winner is never inverted |
| 4 | **Bot bull-up throw was `Math.random` (15/20/65)**, unrelated to ability, and a tie re-threw in the same order. | `botBullThrow(hitAcc, rng)`; a tied ring or two misses re-throws in **reverse order** |
| 5 | **Classic Tour bull-up was cosmetic**: the result never reached the scorer, so the player always threw first. | `TourBullUp` uses the shared board, and its winner becomes `GameScorer firstThrower` |
| 6 | **Undo**: unopened (double-in) visits and bust visits were not in history, so undo popped the wrong visit. Opening state was not restored, and undo crossed leg boundaries. | History records bust/unopened visits with `leg` + `openedBefore`; undo is leg-scoped and trims the dart log |
| 7 | **Double-in bot was strategy-blind**: it obeyed the rule but only opened by accident. | Aims D20 at a per-dart rate of `1-(1-checkoutPct)^(1/3)` until opened |

Recovery snapshots are now **version 2**: they add `legNo`, `legInSet`, `dartLog`, and history
`leg` / `openedBefore`. A v1 X01/Cricket snapshot with `starterIdx` 1 is rejected, because it
was produced under bug 3. A local bull-up is persisted once the scorer mounts (the snapshot
includes the starter). A Career bull-up is persisted server-side on every throw.

### Rules as implemented

- **Double in**: darts score only from the opening double, in dart order. S20, S20, D20 = 40 scored (461 left). D20, S20, S20 = 80. The inner bull opens. Opened state is per player and resets every leg and set.
- **Double out / busts**: going below 0, leaving 1, or reaching 0 without a double (inner bull counts) is a bust. The visit ends and the start-of-visit score and opened state are restored.
- **Sets**: best of N sets; each set is best of `legsPerSet` (odd). Leg counters reset per set. Legs alternate within a set, and the first leg of each set alternates by set.
- **Bull-up**: inner beats outer beats miss. A tied ring or two misses re-throws in reverse order (WDF / national rules). There is no coin flip. Bot throws come from ability (`botBullThrow`, seeded).

### Scorer test harness

`api-server/src/lib/__tests__/darts-rules.test.ts` (27 tests) covers the 30 audit categories:

- straight in; double in, including dart order, bull opening and per-player/per-leg/per-set opening;
- double-out checkouts and every bust kind; straight/master out;
- legs and sets completion; set starters and leg starters;
- bull-up ties and reverse order; bot bull ability;
- bot double-in legality; bot checkout legality; seeded reproducibility;
- replay recovery mid-leg, between legs and mid-set; undo as replay;
- single completion; settled darts; winner mapping after a P2 bull-up win; dart validation.

`tkdl/src/lib/__tests__/scorer-recovery.test.ts` covers the v2 snapshots.

---

## 3. Live Career matches

### Session architecture (`career/live/`)

`career_match_sessions` holds one row per Career match (UNIQUE on match):

- `format` (from `liveMatchFormat`), `firstThrower`, and `bullUp` `{firstOrder, throws}`;
- `darts` (the canonical log), `revision` (optimistic concurrency) and `status` (`BULL_UP → IN_PLAY → COMPLETED`, or `SUPERSEDED`);
- the opponent's A2 performance mapped to a scorer bot config (`toCareerBotConfig`) and a random 16-byte `bot_seed`.

| Route | Purpose |
|---|---|
| `POST /saves/:id/matches/:matchId/session` | Open (idempotent, `ON CONFLICT DO NOTHING`). The server takes the opponent's bull throws immediately if they throw first. |
| `GET  …/session` | Read (404 = no session yet) |
| `POST …/session/bull` | One human bull throw `{throw, expectedRevision}`; the server answers with the bot's throws |
| `PUT  …/session/darts` | Checkpoint the full dart log `{darts, expectedRevision}` |

### Verification: the browser never reports a winner

On every checkpoint the server does the following:

1. Validates each dart (no impossible darts).
2. Replays the whole log with the shared rules.
3. Regenerates **every bot visit** from `seededRandom(botSeed, "bot-visit", n)` and rejects any difference.
4. Refuses changes to **settled darts** (darts of completed legs). Darts of the unfinished leg can change, which is how undo works.

When the replay says the match is complete, the server derives the result (legs, sets, facts,
averages, bull-up detail). In **the same transaction** it calls
`calendar.recordHumanMatchResultInTx`, which is the A3 boundary. A3 then:

- advances the bracket and publishes results;
- runs A4 money and A5 rankings and milestones.

Because this is one transaction, a session can never be COMPLETED without the A3 result, and
the reverse can't happen either.

- **Idempotency**: re-submitting the completed log returns `duplicate: true` and records nothing new.
- **Concurrency**:
  - Stale revisions get a 409.
  - Two racing completions produce exactly one result.
  - A completion racing a calendar advance resolves through A3's row locks (`FOR UPDATE`).
  - Withdrawal or a decided match marks the session `SUPERSEDED`.

### Frontend (`tkdl/src/features/career/`)

- `pages/live-match.tsx`, route `/career/:saveId/matches/:matchId/play`:
  - opens the session;
  - runs the bull-up on the shared `BullUpBoard` (server-recorded);
  - mounts the **existing `GameScorer`** (no `CareerScorer`) with the session's format, bot and starter;
  - `botVisitPlanner` gives the seeded bot visit the server expects, and `onDartLog` checkpoints the log;
  - waits for the server's COMPLETED and shows the post-match screen (Next match / Event result / Career Home / Calendar).
- `live-model.ts` holds the pure glue, unit-tested:
  - `careerGameType`, `scorerLength`;
  - `recoveryFromLog` (server log → v2 recovery snapshot);
  - `careerBotVisit`, `shouldCheckpoint`, `scoreLine`.
- **Checkpoint policy**: after every human dart and at the end of every visit, never mid bot visit. A refresh or route change therefore resumes at the exact dart, mid-visit included.
- `match-boundary.tsx`:
  - "Play match" / "Resume match" when the event is live-capable;
  - otherwise the honest unsupported reason;
  - Withdraw stays.
- The header "Play your match" / "Resume match" goes straight to the live session.
- Abandoning the scorer returns to the event; the session resumes later.

---

## 4. Career identity and age

| Rule | Value |
|---|---|
| Minimum Career start age | **15** (UI + server validation + DB CHECK) |
| Sanity upper bound | 99 |
| DOB | Required for new Careers. **Immutable**: set-once API plus a DB trigger. |
| Career start date | 1 January of the creation year, persisted (`career_profiles.career_start_date`) |
| Career date | start + (season−1)·364 + (day−1). Real-clock independent. |
| Age | Derived from DOB and Career date (crosses birthdays between and within seasons) |
| Junior | Age < 18 |
| Q-School minimum age | **16** (the real PDC Q-School minimum) |
| Age decline | None (not in A6.5) |

- `career_profiles` stores `date_of_birth`, `career_start_date`, `home_locality` and `display_name`. A restart clones the identity, so the age can never drift; delete removes it.
- **Legacy saves** (pre-A6.5, no DOB) are **`PROFILE_INCOMPLETE`**:
  - Browsing works.
  - Entering events, advancing the calendar and opening a match return `409 {code: "PROFILE_INCOMPLETE"}` until the DOB is set once (`PUT /saves/:id/profile`).
  - The UI shows a banner with the DOB form.
- **Eligibility** gains an `AGE` rule (`R.age({minAge?, maxAgeExclusive?})`) with the denials `BELOW_MINIMUM_AGE`, `ABOVE_MAXIMUM_AGE` and `PROFILE_INCOMPLETE`.
  - `humanView.age` carries `{minAge, maxAgeExclusive, eligibleFrom}`, so the UI shows "Minimum age 16 · eligible from Season 2, wk 12".
- **Facts for A7**: the human participant facts carry `age` (NPCs too), the human result metadata carries `humanAge`, and human milestones carry `detail.humanAge`. A7 can consume these; A6.5 produces no narrative from them.
- **Age never changes opponent strength.** `toCareerBotConfig` depends on the NPC, the context and the difficulty only (tested).

### Junior Development Circuit (event database v2, new saves)

The circuit is fictional, configured in `catalogue.ts` and uses no protected branding:

- **`junior-development-night`**: local rotation, club venues, GBR/IRL/NLD/DEU/BEL, weeks 2–48. Country-restricted and under-18 only. Entry fee £0 (`fee:junior`).
- **`junior-development-championship`**: national finals, week 33, under-18 only.
- **Junior NPC cohort** (v2 worlds only): 40 NPCs aged 16–17 at creation, plus an annual intake of 18 aged 16. They live on separate `junior:` world keys, so v1 worlds stay byte-identical.

Junior events show a "Junior · U18" badge. Adults see "Junior event · under 18 only". Open
events stay open to juniors.

### Event database v2

`CURRENT_EVENT_DATABASE_VERSION = 2` applies to **new** saves only:

- the v1 events are kept;
- `double-start-grand-prix` is replaced by **The Double Crown** (fictional, 501 double-in double-out, sets);
- the junior circuit is added.

v1 saves stay on v1 (`SUPPORTED = [1, 2]`).

---

## 5. Validation

### Automated tests

| Suite | Tests |
|---|---|
| `darts-rules.test.ts` | 27: the scorer harness above |
| `career-a65-simulation.test.ts` | 3: NPC sets with real set boundaries; double-in costs darts and lowers the average; the legacy format is unchanged |
| `career-a65-identity.test.ts` | 8: Career dates, birthdays, start-age bounds, eligible-from, AGE rule, age-neutral opponents, event DB v2, junior cohort |
| `career-a65-live.test.ts` | 8 HTTP E2E tests on the composed routers. See the list below. |
| `tkdl career-a65-live-model.test.ts` | 5: GameScorer mapping, log → recovery (mid-visit), double-in display, checkpoint policy and bot seeding parity, score line and age helpers |

The 8 live E2E tests:

- identity, immutability and PROFILE_INCOMPLETE;
- age pathways (junior / adult / Q-School under 16);
- the **full human loop**: enter → match → bull-up → darts → verified → bracket/money/rankings/milestones;
- **losing** → eliminated and the calendar continues;
- a **sets** match (best of 3 sets × 5 legs);
- a **Double Crown** DIDO sets match;
- **concurrency**: duplicate and racing completion, and completion versus advance;
- the **sponsor facts fix**: a qualifier final is not a Major finish (§7).

Updated suites:

- `career-calendar*`, `career-world-service` (v1 pinned where world counts matter);
- A3 capability expectations (the WC now completes with a champion);
- `career-a6-model` and `career-ui` (Play match is live; no "not connected" copy).

### Browser validation (real UI, Playwright, fixture server)

| Width | Match | Checked |
|---|---|---|
| 390 | Junior Development Night, best of 3 legs | Bull-up (opponent threw first server-side), full match, **page reload mid-match**, post-match LOST / event complete |
| 1440 | Pro Circuit, best of 11 legs | Bull-up, **mid-visit resume** (the in-progress dart and "leaves 81" restored, correct checkout hint), full match, post-match WON 6–0 / "Next match" |
| 768 | Double Crown (dev method), best of 3 sets × 5 legs, double-in | "Double in required / Hit a double to start", sets/legs counters, reload, completion |

Also screenshotted:

- the PROFILE_INCOMPLETE banner (390);
- the junior Q-School lock with eligible-from date (768);
- the calendar with the Junior · U18 badge and "Play your match" (1440);
- the header age line.

### Amateur → Q-School grind

See §7, which has the figures and the sponsor bug it surfaced.

---

## 6. Manual playtest and dev methods

```bash
pnpm --filter @workspace/tkdl build        # or: cd artifacts/tkdl && npx vite build
cd artifacts/api-server
node --experimental-strip-types scripts/career-ui-fixture-server.ts --port=8787
# open http://localhost:8787/career
```

The fixture is **DEV-ONLY**: PGlite, a fixed signed-in player, the real Career routers in
production order. It seeds:

- **Slot 1, Validation Career** (adult, Q-School played): a pending Pro Circuit match. Use **Play your match** to play it live.
- **Slot 2, Junior Career** (age 15): a pending **Junior Development Night** match. Q-School shows *Minimum age 16 · eligible from …*.
- **Slot 3, Legacy Career** (no DOB): the **PROFILE_INCOMPLETE** banner. Set a DOB to unlock entering and advancing.
- **Archive**: a retired Career.

Dev methods (labelled, never shipped):

- `--reach=double-crown`: the slot-1 pending match is re-authored to the **Double Crown** format (501 DIDO, best of 3 sets). This is the same format lab the tests use.
- `--reach=palace`: slot 1 receives a DEV provider entitlement `world-championship`, the same entitlement a WC qualifier awards. It enters the real **World Darts Championship** and is simulated to its pending Palace match. Slow: about 50 simulated weeks.
- **Junior event**: slot 2, or a new Career with a DOB giving age 15–17, then Calendar → Grassroots → "Junior Development Night".
- **Q-School**: a new adult Career; First Stage entries open at the start of each season (`q-school-first-*`). Under-16 Careers show the minimum-age notice.

Playtest checklist:

1. Create a Career and check the DOB is required, the age preview, the under-15 refusal and the home region.
2. Enter an event, Continue, then **Play your match**.
3. Bull-up, play a few visits, **refresh**: the match resumes at the same dart.
4. Undo inside the current leg works. Completed legs are final.
5. Finish: the post-match screen appears. **Event result** shows the bracket advanced. **Career Home** shows money and rankings.
6. Lose a match: eliminated, and the calendar continues.
7. Try the Double Crown dev method: no score before the opening double; sets display.

---

## 7. Amateur → Q-School grind validation

`scripts/career-a65-grind.ts`: a deterministic, DEV-only validation run.

- **Setup**: one new Career (current event DB, adult, home Ayrshire, **no fixture funding**), played from S1 W1 to S2 W7.
- **Every human match is played through the real live-session boundary**: open, bull-up, dart log, server verification, A3. The human's darts come from the shared planner with a fixed skill profile.
- **Entry policy**:
  - Q-School First Stage whenever it is enterable.
  - Otherwise any open event costing nothing, or ≤ 20% of available cash.
  - From S1 W40, the Q-School cost is held back.
  - Accept the first sponsor offer.

**Real Q-School First Stage cost** (A4 preview, UK & Ireland, Wolverhampton): **£570** from
Ayrshire or Leinster (£300 series fee + £60 travel + 3 nights £210), and £300 from the Midlands.

### Results (after the sponsor fix below)

| Profile (planner avg) | Seed | Matches | Win % | Earnings | Expenses | Sponsor | Cash at S2 W1 | Q-School | Tour Card |
|---|---|---|---|---|---|---|---|---|---|
| Competent (50) | 1 | 123 | 67.5% | £380 | £835 | £425 | **£280** | cannot afford | no |
| Competent (50) | 2 | 92 | 72.8% | £420 | £955 | £500 | **£290** | cannot afford | no |
| Competent (50) | 3 | 144 | 73.6% | £840 | £1,545 | £700 | **£360** | cannot afford | no |
| Strong (56) | 1 | 210 | 85.2% | £1,415 | £2,475 | £1,050 | £770 | entered | no |
| Strong (56) | 2 | 228 | 84.6% | £1,690 | £2,863 | £1,025 | £693 | entered | no |
| Strong (56) | 3 | 219 | 83.1% | £1,490 | £2,815 | £1,100 | £605 | entered | no |
| Dominant (62) | 1 | 346 | 90.5% | £6,855 | £5,760 | £1,475 | £3,530 | entered | no |
| Dominant (62) | 2 | 263 | 91.3% | £1,835 | £3,070 | £1,300 | £1,005 | entered | no |

Every run started on £250. Q-School Order of Merit cards in these worlds: 10–12 (line at 7–8 points).

### Bug found and fixed (smallest evidence-based change)

The first competent run (avg 50, seed 2) signed **Vantage Darts (ELITE)** in week 4 and
received **£58,000** in sponsorship as an amateur.

- **Cause**: A4's sponsor facts (`bestFinishByCircuit`) counted *qualifier* results as circuit finishes. Reaching the final of the amateur **Open Championship Qualifier**, which sits on the `MAJOR` circuit, satisfied "top 2 at a Major".
- **Fix**: `humanBestFinishByCircuit` (`career/finance/engine.ts`) ignores `QUALIFIER` events, except on the Q-School circuit, where the qualifier *is* the event (one sponsor rule deliberately counts Q-School finishes).
- **Test**: `career-a65-live.test.ts`, "sponsor facts (grind fix)".
- **Effect**: the same seed now signs a local sponsor and reaches S2 on £290. Contracts already signed are not touched.

### Finding not adjusted in A6.5: competent amateurs cannot fund Q-School

With the bug fixed:

- A **competent** amateur (winning 67–74% of matches) reaches Season 2 on **£280–£360**, against a **£570** First Stage. They cannot enter Q-School, and their cash stays roughly flat (net season result about £0).
- A **strong** amateur (83–85%) can just afford it.
- Only a **dominant** player builds a buffer.

**Cause.** Grassroots events return far less than they collect. A Friday Night 501 takes
24 × £5 = **£120** in entry fees but pays **£35** (£25 / £10), about 29% of the pot. Even a
player who reaches a final 1 time in 5 roughly breaks even, while travel to County and Regional
events costs more than they return at that level.

**Why it wasn't changed here.** Fixing this means retuning the A4 prize tables. Those values
feed the A5 ranking money, and A4's own rule (see `finance/config.ts`) says shipped finance
versions are immutable: a retune must ship as **`FINANCE_VERSION 2` with explicit per-save
pinning**, and the version is part of the ledger's stable IDs. That is a versioned A4 change,
not a "smallest adjustment", so A6.5 records the evidence and does not touch the economy.

**Proposed for the next finance version.** Grassroots and county prize tables pay out the entry
pot. For example, a 24-player £5 night would pay £60 / £30 / £15 / £15. Re-run this script to
confirm that competent profiles reach the First Stage within one season.

```bash
node --experimental-strip-types scripts/career-a65-grind.ts --avg=50 --seeds=3   # competent
node --experimental-strip-types scripts/career-a65-grind.ts --avg=56 --seeds=3   # strong
node --experimental-strip-types scripts/career-a65-grind.ts --avg=62 --seeds=3   # dominant
```

The script's `qSchoolCost.firstStageSeries` field adds up the standalone estimate of each of the
three days, so it over-counts. Use the A4 preview figure above (£570).

---

## 8. Known limitations

- **Economy**: competent (non-dominant) amateurs cannot fund the Q-School First Stage after one season (§7). This needs an A4 `FINANCE_VERSION 2` retune; it is not changed in A6.5.
- Career live play covers **X01 501, straight/double in, double out, singles knockout** only. Other Career formats remain `UNSUPPORTED_FORMAT` and cannot be entered.
- **Bot visit presentation**: the preserved Classic Tour planner samples a visit total and splits it into darts, so some bot visits read like `T20, D13, Miss`. The rules and verification are unaffected. Changing it would change Classic Tour difficulty, so it was left.
- The `GameScorer` sets/legs props keep their best-of semantics and misleading names.
- Practice and Classic Tour recovery stays local (v2 snapshot). Only Career matches are server-authoritative.
- A refresh during the **bot's** visit animation replays that bot visit from the seed. The darts are identical; only the animation restarts.
- The Palace dev method is slow (it simulates the whole season).

## 9. Deferred to A7+

- News, narrative, rivalries, journey prose (A7 reads `age` / `humanAge` facts).
- Age-related performance curves or decline (deliberately absent).
- Live play for 301/701, master/treble-out, groups/leagues, pairs and non-X01 Career events.
- Online/multi-device live sessions beyond the single-session lock.
- A4 finance version 2 (grassroots/county payouts), §7.
