# Career 2.0 A3: calendar, event universe and tournament foundation

This phase extends approved A2 commit `92b09c74f07d4f06f8bfddc3f41aa28c5dd7dc27` on `feature/tour-career-2-foundation`. A1/A2 behaviour is preserved. The only A2 change is additive: the body of `simulateMatch` was extracted into an exported transaction-level batch helper, `simulateMatchesInTransaction`, which `simulateMatch` now calls. Each request keeps identical semantics (stored-result retries, conflicting-key rejection, per-match form updates in order). The existing Classic Tour (61 events, five difficulties, 305 trophies) is untouched. No economy, rankings, Tour Cards, UI or story is implemented.

## Ownership

| Phase | Owns |
| --- | --- |
| A1 | Saves, ownership, lifecycle, versions, seed, the root `current_season`/`current_week` columns |
| A2 | NPC identity/ability/form/development/retirement, 501 DO match simulation, `advancePeriod`, `processOffSeason` (sole off-season authority, the only writer of `current_season`) |
| **A3** | Calendar, event definitions/instances, eligibility orchestration, entries, conflicts, fields, draws, tournament progression, results/history, qualification entitlements, `current_week` advancement |
| A4 (future) | Money: entry fees, travel, accommodation, prizes, sponsors. A3 only stores profile references |
| A5 (future) | Rankings, seeding orders, Tour Cards, Q-School Order of Merit, ranking-derived qualification. A3 only exposes provider boundaries |

Every A3 mutation authenticates the actor, locates the owned save, requires ACTIVE, and locks the `career_saves` row `FOR UPDATE` in the same transaction, using A2's `lockRoot`. The deterministic result is then persisted. Reads lock the root too, which is the A2 convention. Unknown and cross-owner resources return 404.

## Season model

- The season has 52 weeks of 7 days, so event windows use absolute days 1–364. Conflicts are detected on day ranges, not week numbers.
- Season groupings are presentation-only: Opening Swing 1–8, Spring Circuit 9–16, Summer Tour 17–32, Major Season 33–44, World Championship Period 45–52.
- `career_saves.current_week` is "this week". Players can see and enter events that start this week. **Advancing plays out the week**:
  1. Close registration and lock fields for events starting this week, highest `calendarPriority` first, so conflicts resolve towards bigger events.
  2. Explicitly cancel unsupported or unfillable events.
  3. Draw.
  4. Progress every live tournament through all rounds scheduled up to the end of the week.

## Canonical A2 development cadence

**Exactly one A2 `PERIOD` per played Career week; period N = week N; `elapsedYears = 1/52`; `opportunity = 0.5` (fixed).**

Each week step runs as three idempotent transactions:

1. **A3 transaction.** Play out week N, then set `career_seasons.played_week = N`.
2. **A2 call.** `advancePeriod({season, period: N, elapsedYears: 1/52, opportunity: 0.5})`. A2 returns the stored summary on retry and rejects any other period.
3. **A3 transaction.** Verify the A2 `career_world_periods` row exists, set `developed_week = N`, and move `current_week` to N+1.

Advancing week 10 → 14 plays out weeks 10, 11, 12 and 13 and processes A2 periods 10–13 exactly once each. The brief's example numbers the same four periods 11–14; here the numbering follows "elapsed week". Matches never advance development: a week with 300 matches still produces one period, and `career_world_state.period` always equals the number of played weeks (tested).

After week 52 is played and developed, every season instance must be terminal (COMPLETED or CANCELLED), otherwise the step fails with 409. A3 then calls A2 `processOffSeason({season, opportunity: 0.5})` exactly once. That call is A2's sole aging, retirement and replacement transition, and it increments `current_season` and resets `current_week` to 1. A3 then finalises the old season (expire unused entitlements, prune derived bookings, mark COMPLETED) and generates the next season. A crash between any two steps is safe: each step detects completed work and every A2 request is deterministic, so retries replay stored results.

`career_seasons` constraints enforce `developed_week <= played_week <= developed_week + 1` and refuse COMPLETED unless the off-season was processed and week 52 developed.

## Advancement API

`advance(actor, saveId, {operationKey, expectedSeason, expectedWeek, target})`. `target` is one of:

- `NEXT_MEANINGFUL`
- `WEEKS: n`
- `WEEK: n` (wraps into the next season when earlier than or equal to the current week)

Behaviour:

- `operationKey` plus the canonical request is persisted in `career_calendar_operations`. Retrying a completed operation returns the stored result. Reusing a key with different inputs gives 409. A stale `expectedSeason`/`expectedWeek` gives 409.
- A stop because a human match is pending (`HUMAN_MATCH_PENDING`) is not stored as final. Once the human result is recorded, the same key resumes.
- A meaningful date is a week containing any of:
  - an event the human entered;
  - a registration deadline for an enterable FEATURED-or-higher event or a QUALIFIER;
  - an event the human holds a qualification entitlement for;
  - season start.
- Season end stops at `SEASON_BOUNDARY`. Each call advances at most 53 weeks.

## Event model

### Definitions

The definitions are `career/calendar/catalogue.ts`, event database v1: 73 authored definitions and templates. Each carries structured fields:

- key/family/circuit/classification;
- ranking category (A5 placeholder; null unless RANKING);
- presentation (tier, brandingFamily, heroAssetKey, badgeAssetKey, featured, calendarPriority);
- structured format;
- field size and minimum entrants;
- NPC fill range and tier weights;
- geography policy;
- composable eligibility rule;
- field policy and entitlement intake;
- invitation policy;
- qualification outputs;
- seeding policy (A5 boundary);
- A4 profile references (entryFee/travel/accommodation/prize);
- registration lead;
- series/Q-School/exclusive-group metadata;
- legacy Classic Tour concept;
- schedule.

The migration syncs them into the global `career_event_definitions` table with a canonical SHA-256 hash. A changed definition under a shipped version is refused: publish a new `eventDatabaseVersion` instead.

### Season instances

Instances (`career_event_instances`) snapshot the fully resolved definition: placeholders filled, eligibility resolved, capability assessed, `resolvedFrom {definitionKey, eventDatabaseVersion, definitionHash, calendarGenerationVersion}`. Key columns are also stored for querying.

A trigger enforces:

- the lifecycle transition matrix;
- an immutable identity/schedule;
- no change at all once COMPLETED or CANCELLED.

Results and final matches have their own no-update triggers. Deletion is only possible through the save cascade.

### Event database version

`career_saves.event_database_version` (A1) now selects the catalogue. It is never rewritten on read. An unsupported version returns 409 "requires a version migration". Season generation is a pure function of `(world_seed, eventDatabaseVersion, CALENDAR_GENERATION_VERSION=1, season)`.

### Classifications

`RANKING | QUALIFIER | INVITATIONAL_EXHIBITION | SPECIAL`. A database check makes `classification = SPECIAL ⇔ circuit = SPECIAL`, requires a SPECIAL to have a null `ranking_category`, and requires every RANKING event to carry a category. SPECIAL therefore cannot carry ranking metadata for A5 to pick up. Completed SPECIAL results are tagged with their classification in the results metadata.

### Circuits

All 14 circuits are present: GRASSROOTS, COUNTY, REGIONAL, NATIONAL_AMATEUR, CHALLENGER, VAULT, Q_SCHOOL, PRO_CIRCUIT, EUROPEAN_SERIES, WORLD_SERIES, INVITATIONAL, MAJOR, WORLD_CHAMPIONSHIP, SPECIAL.

### Authored backbone (fixed weeks/venues, identical across seeds)

- **Q-School.** UK/IE and Europe pathways. Each has a 3-day First Stage and a 4-day Final Stage (weeks 2–4).
- **Pro Circuit Championships.** 32 events on Tue/Wed doubles.
- **European Dart Series.** 12 cities plus 3 associate qualifiers.
- **World Dart Series.** 6 cities plus Finals.
- **Vault.** 3 qualifiers, 12 series nights and the Masters. Vault is not a progression gate and grants no Tour Card.
- **Challenger Series.** 20 events.
- **Regional.** 12 regional opens and 2 Regional Champions League instances.
- **National amateur.** 7 national amateur championships, plus Amateur Masters, International Amateur Open and Amateur World Masters.
- **Majors.** Open Championship plus 6 qualifiers, Summer Matchplay, Double Start Grand Prix, European Championship, Grand Slam of Champions, Pro Circuit Finals.
- **Invitationals.** Champions Masters, Thursday Night Darts.
- **World Championship.** 3 World Championship qualifiers, the Amateur World qualifier, and the World Darts Championship at The Palace, London (weeks 50–52, up to 128, sets).
- **National specials.** 11.

### Controlled deterministic rotation (seeded per season/locality)

Grassroots club nights (Friday Night 501, Sunday League Sprint, Sudden Death Night, Pub Doubles, local specials) and county events (501 Open, Championship, 301 Sprint, Classic DIDO, 701 Open). Density per locality uses stochastic rounding of authored weights, and weeks are chosen by seeded shuffle. Different seeds and seasons rotate; the backbone does not move.

### Legacy mapping

The Classic Tour concepts are recorded in `legacyConcept`: Friday Night 501, County events, the Q School Days, Players → Pro Circuit, and so on. Names are fictional, not trademark copies.

## International structure

Geography lives in `geography.ts`. It covers 16 countries in 3 zones (UK_IRELAND, EUROPE, REST_OF_WORLD) and 23 localities: the A2 NPC home regions plus Ayrshire, the default human home. Venues are all fictional and keyed stably. The five required venues are The Foundry (Manchester), Dockyard Arena (Liverpool), Glasgow Hall, Midlands Oche (Wolverhampton) and The Palace (London), plus 25 others.

Geography is a **participation weighting**, never an ability input and never a permanent lock:

| Event policy | Weighting |
| --- | --- |
| LOCALITY | same locality 1; same country 0.25 |
| REGION | locality 1; country 0.3 |
| COUNTRY | 1; same zone 0.25; elsewhere 0.03 |
| ZONE | 1; other zones 0.3 |
| INTERNATIONAL | 1, with a host-nation bonus |

Eligibility rules (COUNTRY/ZONE/county catchment) restrict amateur-level events only. Professional circuits are international. The harness reports entrant and champion nationality, plus venue zones, for professional-level events.

**Q-School pathways.**

- UK_IRELAND: UK_IRELAND and REST_OF_WORLD zones.
- EUROPE: EUROPE and REST_OF_WORLD zones.
- An exclusive group (`q-school`) prevents any participant, NPC or human, entering both pathways in a season.
- First Stage entrants get a `SERIES_ACCESS challenger-tour` pass.
- Each First Stage day's last 16 get `STAGE_ENTRY q-school-final:<pathway>`.
- Final Stage fields are entitlement-only.
- Results store `{pathway, stage, day}` metadata as the A5 Order-of-Merit input.

A3 awards **no** Tour Cards.

## Formats and capability

`EventFormat` is structured. It records:

- gameType, startingScore;
- in/out rule;
- LEGS or SETS, plus legsPerSet;
- structure: KNOCKOUT, GROUP_KNOCKOUT, ROUND_ROBIN, LEAGUE or MULTI_DAY_KNOCKOUT;
- stages, each with bestOfByRound, groupSize and advancePerGroup;
- days;
- firstThrowMethod;
- sideSize (singles or pairs);
- A2 match context.

`assessCapability` executes **only 501, straight-in, double-out, legs, singles, single-stage knockout**. Everything else returns `{executable: false, code: "UNSUPPORTED_FORMAT", reasons}`, with reasons from GAME_TYPE, STARTING_SCORE, IN_RULE, OUT_RULE, SET_PLAY, STRUCTURE and PAIRS.

Unsupported instances keep their full definition and calendar slot. The human cannot enter them (denial `UNSUPPORTED_FORMAT`). When their start week is played they move REGISTRATION_CLOSED → CANCELLED with reason `UNSUPPORTED_FORMAT`, with no field, no draw and no A2 match. They are never run as 501. This includes the sets-play World Championship and Double Start Grand Prix, the group-stage Grand Slam, the league formats, pairs, DIDO, 301/701 and every non-X01 game.

## Eligibility, entries and conflicts

Rules are JSON data, so historical instances keep the rules they used:

- combinators: `all`, `any`, `not`;
- leaves: OPEN, COUNTRY, ZONE, LOCALITY, PRO_STATUS, TOUR_CARD, NON_TOUR_CARD, QUALIFICATION, INVITATION, RANKING, EVENT_RESULT, DEFENDING_CHAMPION.

Evaluation returns `{eligible, reasons}`. A defending champion is never auto-qualified; it is only eligible where a rule says so.

The human view adds actionable denials: CAREER_NOT_ACTIVE, EVENT_FINISHED, FIELD_LOCKED, REGISTRATION_CLOSED, REGISTRATION_NOT_OPEN, UNSUPPORTED_FORMAT, ALREADY_ENTERED, SCHEDULE_CONFLICT (with `conflictsWith` event ids), NOT_ELIGIBLE (exclusive group), plus the rule reasons (REQUIRES_TOUR_CARD, REQUIRES_QUALIFICATION, OUTSIDE_REGION, ...).

The relationship state is one of AVAILABLE, QUALIFIED, ENTERED, CONFIRMED, PLAYING, COMPLETED, MISSED, WITHDRAWN or NOT_ELIGIBLE. INVITED is reserved: no human invitation source exists until A5/A7.

**Entries:**

- Entry is idempotent: the primary key is (save, event, participant), and a repeat call returns `created: false`.
- Entering a multi-day series day enters the whole series.
- Withdrawal before the field lock releases the bookings.
- Withdrawal after the lock is auditable: the entry stays as WITHDRAWN, and each of the participant's matches becomes a WALKOVER once the opponent is known. The tournament continues.

**Conflicts:** `career_participant_bookings` holds one row per participant per occupied day, with primary key (save, season, participant, day). Double booking of a human or NPC is impossible at the database level. Bookings are derived and pruned at season close; the history lives in entries, matches and results. Conflicts never choose an event for the human.

## Fields

`lockField` runs once per event, in the REGISTRATION_CLOSED → DRAW_PENDING transition. Entries come in this order:

1. human entries;
2. series day-1 carry-over (multi-day events);
3. entitlement intake (eligible NPC holders; SINGLE_USE entitlements are consumed against the event);
4. invitations (`invitationPolicy`, tier-weighted, only when no ranking provider lists exist);
5. deterministic weighted open selection.

Open selection uses Efraimidis–Spirakis sampling with the scoped RNG `("field", season, instanceKey)` over `tierWeight × geographyWeight`. The fill target is drawn in the definition's range.

The eligible pool excludes:

- retired NPCs;
- anyone booked on overlapping days;
- the exclusive-group opposite variant;
- the ineligible.

Fields contain only persistent A2 NPCs. Below `minimumEntrants`, the event is CANCELLED with reason `INSUFFICIENT_ENTRANTS`; entrants are not invented. NPC Tour Card status uses the **labelled placeholder provider** `A3_PLACEHOLDER_PROFESSIONAL_STATUS` (A2 professionalStatus) until A5 replaces it.

## Draws

`generateKnockoutDraw` produces the draw:

- **Bracket.** The size is the next power of two, using the standard seed order (seed 1 and seed 2 can only meet in the final).
- **Seeds.** Taken from the `SeedingProvider` boundary (default `NONE`, so the draw is unseeded).
- **Unseeded players.** Shuffled with the scoped RNG `("draw", season, instanceKey)`.
- **Byes.** The top seed numbers get the byes, so a bye never meets another bye.
- **Persistence.** The full bracket (every round and slot) is persisted at once. A unique constraint on (save, event, stage, round, slot) protects it, and makeDraw refuses unless the event is DRAW_PENDING, so the official draw is never regenerated.
- **Best-of.** Best-of tables align from the final backwards.
- **Scheduling.** Rounds are spread across the event's days.

## Tournament progression

`progressEvents` works in waves across every live tournament in the week:

- **Each wave.** One bracket load, winner propagation, walkovers, then one A2 batch (`simulateMatchesInTransaction`) and one bulk update.
- **Determinism.** The order is stable (event start day, instance key, round, slot).
- **Match keys.** `a3:<eventId>:<stage>:r<round>:m<slot>`, which is unique per save and immutable.
- **Context.** `{category: format.matchContext, roundImportance: round/rounds, elimination: true}`.
- **First throw.** For NPC matches, a deterministic simulated bull-up: nearest to the bull throws first, with the spread narrowing with finishing/consistency. The throws are persisted with method `SIMULATED_BULL_UP`. There is no coin flip.
- **Human matches.** The match stops at `AWAITING_HUMAN` with method BULL_UP; everything else continues.
- **Human result boundary.** `recordHumanMatchResult` is a service-only boundary for the future GameScorer integration (no HTTP route). It validates a completed best-of, records `HUMAN_LIVE`, and resumes the tournament.
- **Elimination.** The human losing or withdrawing never stops a tournament: NPCs play on to a champion.
- **Completion.** The final completes the event. Every drawn participant gets a permanent `career_event_results` row (position, stage reached, wins/losses, legs, byes, walkovers, Q-School metadata). The champion is set, and qualification outputs are issued.

## Qualification entitlements

`career_qualification_entitlements` records:

- the recipient;
- the type (EVENT_ENTRY, STAGE_ENTRY or SERIES_ACCESS);
- the source (EVENT_RESULT with event and position, or PROVIDER with providerId);
- the season awarded;
- the target key and season;
- consumption (SINGLE_USE or SEASON_PASS);
- the status (ACTIVE, CONSUMED or EXPIRED) and the consuming event.

The unique idempotency key is per result for SINGLE_USE grants, and one pass per (target, season, participant) for SEASON_PASS. `issueProviderEntitlement` is the A5 boundary and reuses the same model idempotently.

## Services and API

The service is `createCareerCalendarService(database, {providers?})` in `career/calendar/service.ts`. Its methods are:

- `initialize` (idempotent; ensures the A2 world, then the current season);
- `calendar` (scope WORLD, MY_SCHEDULE, AVAILABLE or FEATURED; filters season, fromWeek, toWeek, circuit, classification, family; returns the overview with grouping, played/developed weeks, pending human matches, current-week actions and the next meaningful date);
- `event` (details, field, draw, progress, the human's next match and opponent, results, champion);
- `enter`;
- `withdraw`;
- `advance`;
- `history`;
- `entitlements`;
- `recordHumanMatchResult` (service only);
- `issueProviderEntitlement` (A5 boundary).

The HTTP routes (`career/calendar/router.ts`) are mounted under `/api/career` with A1 auth and feature gating:

| Method | Route |
| --- | --- |
| POST | `/saves/:id/calendar/initialize` |
| GET | `/saves/:id/calendar` |
| POST | `/saves/:id/calendar/advance` |
| GET | `/saves/:id/events/:eventId` |
| POST | `/saves/:id/events/:eventId/entry` |
| DELETE | `/saves/:id/events/:eventId/entry` |
| GET | `/saves/:id/history` |
| GET | `/saves/:id/entitlements` |

Data transfer objects (DTOs) are structured, so the UI never parses strings.

Calendar queries load a season once, along with the human's entries, bookings, entitlements and results, and compute every event's eligibility and conflict state in memory. There is no per-event query.

## Database

Migration `create_career_calendar.ts` (startup step `createCareerCalendarA3`), mirrored in `lib/db/src/schema/career-calendar.ts`:

| Table | Key | Notes |
| --- | --- | --- |
| career_event_definitions | (version, definition_key) | global, hashed, immutable per version |
| career_seasons | (save, season) | played/developed week, off-season flag, calendar hash |
| career_event_instances | (save, id); unique (save, season, instance_key) | FK season and definition; lifecycle/history trigger; SPECIAL/RANKING checks; champion check |
| career_event_entries | (save, event, participant) | composite FKs to instance and NPC; human/NPC shape check |
| career_participant_bookings | (save, season, participant, day) | double-booking guard |
| career_tournament_matches | (save, id); unique (save, event, stage, round, slot) | FKs to NPCs and to A2 `career_simulated_matches(save, match_key)`; final-match trigger |
| career_event_results | (save, event, participant) | FK to entry; one champion per event (partial unique); no-update trigger |
| career_qualification_entitlements | (save, id); unique (save, idempotency_key) | composite FKs to source/consumer events and NPC; state checks |
| career_calendar_operations | (save, operation_key) | advance idempotency |

Every save-owned table has `career_save_id NOT NULL REFERENCES career_saves ON DELETE CASCADE`, and all child references are composite (save, …). Restart and delete therefore cascade every A3 row, and no row can reference another save.

## Validation

`pnpm --filter @workspace/api-server run career:calendar [seed] [--replay]` runs `scripts/career-calendar.ts`. It prints the static calendar report and plays a complete season with no human, using the real services on in-memory PostgreSQL (PGlite).

Tests are in `src/lib/__tests__/career-calendar.test.ts` (17) and `career-calendar-season.test.ts` (10, including the full 52-week season).

## Known limitations

- **Unsupported formats are cancelled, not played.** That includes the flagship World Championship (sets). Its qualifiers run and issue entitlements, which expire unused. Sets, groups, leagues, pairs, DIDO, 301/701 and alternative games need future engines.
- **Rankings and Tour Cards are placeholders.** No ranking lists exist, so ranking-qualified majors are filled by A3 invitations (tier-weighted participation, not a ranking). NPC Tour Cards use the labelled professional-status placeholder.
- **The human profile is a placeholder.** The default home is Ayrshire/GBR, amateur, read from `settings_snapshot.homeLocality`. There is no human invitation source.
- **Human live play is not integrated.** The boundary exists; the GameScorer integration is later work.
- **Local fields are thin.** There are only 220 NPCs, about 125 of them amateur, so some small-country club and county events are honestly cancelled (19 in the harness season), and local fields average about 11–14.
- **Opportunity counts run above the band for serious amateurs.** These are uncapped balance figures (see the harness) and are for A8 balancing.
- **Storage is heavy.** A2's persisted match records (full input snapshot and leg log) total about 34 MB per simulated season per save in PGlite (10.3k matches). Fine for tests; it needs an A2 retention/compaction decision before long production careers.
- **Runtime.** About 45 s per full season in PGlite (around 10.6k statements). Production PostgreSQL has not been benchmarked. Advancing many weeks in one HTTP request may need a background job later.
