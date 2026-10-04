# Career 2.0 A2: persistent world and NPC simulation

This phase extends approved A1 commit `dc20d9fffb10cd8b92c151c08f1c5bda8f4a434c` on `feature/tour-career-2-foundation`. Existing Tour, its 61-event structure, trophies, scorer, bots and economies are unchanged. No A3 calendar, event universe, rankings, qualification, economy or news is implemented.

## Integration contract

`createCareerWorldService(database)` is an internal server boundary. The authenticated actor supplies `playerId` and trusted `isAdmin`; clients must never supply those authority fields. All operations check the A1 feature flag and owning save. Every mutation locks the owning `career_saves` row with `FOR UPDATE` and requires ACTIVE status. Callers must not bypass this service with direct child-table writes.

- `initialize(actor, saveId)` explicitly and lazily creates the world after A1 save creation. A1 save creation remains unchanged. Initialization, 220 NPC inserts and world-state insertion are one transaction. An existing initialized world is returned without regeneration. An uninitialized advanced-season save is rejected rather than inventing history.
- `listPlayers(actor, saveId)` returns a whitelist of presentable identity/state fields, including for retired saves. Ability, potential, development coefficients and seeds stay internal.
- `simulateMatch(actor, saveId, {matchKey, playerAId, playerBId, context, format})` simulates two active NPCs and persists the result and both form updates atomically. Match keys belong to the entire save, so future event keys must include event/edition/round identity.
- `advancePeriod(actor, saveId, {season, period, elapsedYears, opportunity})` accepts only the next period and a cumulative development allocation of at most one year per season. Opportunity is 0..1 and elapsedYears is greater than zero and at most one. This is an internal development clock, not a calendar.
- `processOffSeason(actor, saveId, {season, opportunity})` develops the unallocated fraction of the year, retires NPCs, replenishes the population, ages survivors once and advances the root/world season together. A3 must use this transition rather than independently advancing the root season.

Completed match/period/off-season retries return their stored result; reuse of an operation identity with different canonical inputs is rejected. Root locking serializes concurrent mutations. Rollback preserves pre-operation state. Retired NPC rows retain identity and match references. A1 root deletion/restart cascades all A2 children; retirement preserves them. Restart receives A1's new root UUID and seed. No A1 versions, balances, standings or unrelated summary fields are rewritten.

## Files and responsibilities

All world modules below are in `artifacts/api-server/src/career/world/`:

| File | Purpose |
| --- | --- |
| config.ts | Version constants and central population, ability, difficulty, development, retirement, simulation and adapter settings |
| types.ts | Strict domain validation and separate NPC, ability, context, performance and result types |
| random.ts | Scoped SHA-256 seed derivation, SFC32 streams, sampling and stable UUIDs |
| identities.ts | Original fictional curated identities and regional procedural name pools |
| generation.ts | Initial population, stable identities, individual attributes/development and replacement generations |
| performance.ts | Match-day state/context transformation and contextual finishing probabilities |
| simulation.ts | Pure legal 501 double-out NPC competition and statistics |
| form.ts | Bounded performance-based form updates and time regression |
| development.ts | Potential, growth, plateaus, decline, aging, retirement and replenishment |
| bot-adapter.ts | Structural adapter to the existing four-field BotConfig |
| repository.ts | Validated bulk persistence, selective reads and safe presentation projection |
| service.ts | Ownership, root locks, transactions and idempotent world operations |
| harness.ts | Deterministic world and 10,000-match balance reports |

Other new files:

| File | Purpose |
| --- | --- |
| artifacts/api-server/src/db/migrations/create_career_world.ts | Transactional additive four-table migration |
| lib/db/src/schema/career-world.ts | Matching Drizzle tables, constraints and indexes |
| artifacts/api-server/scripts/career-world.ts | World report CLI |
| artifacts/api-server/scripts/career-balance.ts | Balance CLI with count/seed/difficulty arguments |
| artifacts/api-server/src/lib/__tests__/career-world.test.ts | Generation, deterministic streams, development, retirement and prospects |
| artifacts/api-server/src/lib/__tests__/career-simulation.test.ts | Competition, statistics, probabilities, form and adapter tests |
| artifacts/api-server/src/lib/__tests__/career-world-service.test.ts | PostgreSQL-compatible PGlite integration, isolation, retries, rollback and lifecycle tests |
| artifacts/tkdl/src/lib/__tests__/career-bot-adapter.test.ts | Actual frontend BotConfig structural compatibility and runtime adapter check |
| docs/tour-career-a2.md | Architecture and integration handoff |

Modified files: `artifacts/api-server/src/app.ts` registers the A2 migration immediately after A1; `artifacts/api-server/package.json` adds the two harness commands; `lib/db/src/schema/index.ts` exports the four tables. No dependencies were added.

## Database

All four tables have `career_save_id` referencing `career_saves(id) ON DELETE CASCADE`. No migration copies or updates legacy Tour data.

- **career_world_state:** primary key career_save_id; generation_version, simulation_version, season, period, elapsed_year, config_snapshot and initialized_at. Positive versions/season, nonnegative period, elapsed fraction 0..1 and object-valued JSON snapshot checks.
- **career_world_players:** composite primary key (career_save_id,id), unique (career_save_id,world_key), index (career_save_id,status,tier). Identity: world_key, first_name, surname, nickname, nationality, home_region, dominant_hand, starting_age, age. State: stage, tier, professional_status, detail_tier, template_key, status, created_season, retired_season. Attributes: scoring, finishing, consistency, pressure, power_scoring, clutch. Dynamic/hidden state: form, potential, development_rate, development_volatility, peak_start, peak_end, breakthrough_age, decline_profile, low_ability_years, recent_development, tendencies. Ability/potential bounds 1..100, form -1..1, ages 16..110, enum checks, valid peak ordering, development bounds, required numeric bounded context tendencies, retirement stage/status/season consistency and identity length checks.
- **career_world_periods:** composite primary key (career_save_id,season,kind,sequence); request, summary and created_at. PERIOD/OFF_SEASON kind, positive season, nonnegative sequence and object JSON checks. This is the idempotency/development history ledger.
- **career_simulated_matches:** composite primary key (career_save_id,id), unique (career_save_id,match_key); season, period, simulation_version, player_a_id, player_b_id, winner_id, request, input_snapshot, result, completed_at. Both participant foreign keys include career_save_id and cascade, preventing cross-save references. Participants must differ and winner must be a participant. Positive season/version, nonnegative period, bounded key and object JSON checks. Separate (career_save_id,player_a_id,completed_at) and B indexes support future H2H/history queries.

Input snapshots contain private NPC attributes and the world seed and must not be returned through public DTOs. Match-result JSON is validated/generated by the server, with relational identity integrity additionally enforced by the database. No production database was migrated during development.

## World generation and NPC model

Generation v1 produces exactly **220 active NPCs: 75 grassroots, 50 amateur, 63 professional and 32 elite**. Four original curated identities are mixed into the procedural population. Seven nationality pools supply names/regions; collision handling creates unique full names in a save. No legacy persona or real-player alter-ego data is imported. Stable world keys and derived UUIDs survive persistence and history references.

Each NPC has six independent bounded abilities: scoring, finishing, consistency, pressure, power scoring and clutch. Tier distributions overlap, attributes differ within each individual, and stage/age/development parameters vary. Professional status is an ability category, not a tour-card grant. Identity, underlying ability, temporary form, context, match-day performance and observed results are distinct concepts.

## RNG and versions

The persisted A1 64-hex world seed is the only world randomness root. SHA-256 of a JSON tuple containing root seed, generation version and scope components derives independent SFC32 streams. Identity, attributes, development, retirement, performance and per-player/per-leg darts have separate scopes. Stable UUIDs use separately scoped SHA-derived UUIDv8 values. No global Math.random or client-provided RNG override is used.

World generation v1 and simulation v1 are immutable shipped contracts. Unknown versions fail closed. The configuration snapshot records the initial rules for audit; it is not a runtime override. Future tuning requires retaining the old implementation or an explicit versioned migration. Persisted completed results are authoritative and are never regenerated on retry. Exact replay requires the recorded inputs and corresponding versioned code.

## Performance engine, upsets and match length

Underlying ability plus bounded form, sampled day variation, explicit difficulty offset and modest context/pressure effects produce a performance profile before play. Consistency controls variance; pressure primarily affects finishing/consistency; clutch modestly affects high-leverage finishes. Temporary momentum derives from actual 180s, large checkouts, breaks and missed doubles and is bounded and decayed. There is no catch-up mechanism or hidden human rating.

NPC matches play 501 double-out with legal dart scores, checkout routes, bust rules and actual alternating first throw by leg. A player wins by reaching the required legs first. Average, checkout rate, points, darts, legs, 180s and high checkout are calculated from play, not fitted after winner selection. A safety guard throws on pathological simulations instead of fabricating a winner. Initial first throw is supplied explicitly so future bull-up/event logic can own that decision.

Upsets emerge from overlapping performance distributions and finite competition. No explicit upset percentage or winner roll is used. The deterministic standard-preset harness runs five ability-gap pairings, 1,000 best-of-7 and 1,000 best-of-31 matches each, alternating first throw. Representative stronger-player win rates:

| Pairing | Best of 7 | Best of 31 |
| --- | ---: | ---: |
| Elite / top-32 calibre | 74.2% | 90.0% |
| Top-32 / established professional | 71.9% | 83.4% |
| Established / lower professional | 71.7% | 78.0% |
| Lower professional / regional | 74.9% | 82.0% |
| Regional / grassroots | 83.6% | 89.5% |

These are synthetic calibration labels, not a claim of empirically fitted professional darts. JSON output also records both average distributions, checkout rates, 180s, outlier rates and runtime. Broad deterministic statistical assertions guard hierarchy, variance, first-throw advantage and long-format effects without demanding exact incidental sample percentages.

## Form, development, prospects and retirement

Form persists on each NPC and is bounded -1..1. It reacts to scoring/finishing relative to contextual expectations, with a small opponent-quality adjustment; victory itself is not an input. Exponential time regression prevents permanent streak bonuses. Match form updates occur exactly once with the persisted result.

Hidden potential is a ceiling for growth, not destiny. Development uses headroom, opportunity, individual rate/volatility, breakthrough timing, stochastic plateaus and peak windows. Eighteen percent receive late breakthrough timing. Four decline profiles create gradual, delayed, sharp and early decline. Drift scales by elapsed years and noise by its square root. Low-ability duration accumulates elapsed years, not number of period calls. Different period partitions intentionally have different deterministic samples; they do not count as extra years. A3 must choose a consistent period cadence.

Replacement prospects are aged 16..23. Potential bands have weights 82%, 15%, 2.8% and **0.2% exceptional (95..100)**. There is no public wonderkid flag, guaranteed champion or forced breakout. Opportunity, timing, form, opposition, plateaus and decline still matter; many generations produce no exceptional prospect.

Retirement is a seeded annual probability influenced by age, ability, recent decline, sustained low ability, veteran stage and amateur/professional status. A defensive maximum age prevents storage overflow; normal retirement is probabilistic. Retired records and history remain intact. Each off-season replenishes the active population to 220 with a new uniquely keyed generation; initial tier counts are not artificially maintained forever.

## Existing bot integration

`toCareerBotConfig(performance, decisive?)` maps Career performance to the existing `{avg,sd,checkoutPct,hitAcc}` shape. A frontend type compatibility check uses the real BotConfig type. No shared bot engine, GameScorer, X01 scorer or human scoring code changed. The adapter is ready for a future caller, but is not wired into live matches in A2. The existing bot's per-visit checkout abstraction is coarser than the NPC simulator, so live scoring equivalence/calibration is not claimed.

## Harness commands

Run from the repository root with installed workspace dependencies:

```sh
pnpm --filter @workspace/api-server career:world
pnpm --filter @workspace/api-server career:balance 10000
# Optional seed, then difficulty for the balance command:
pnpm --filter @workspace/api-server career:balance 10000 <64-hex-seed> CHALLENGING
```

The scripts can also be run directly with Node's TypeScript support: `node artifacts/api-server/scripts/career-world.ts` and `node artifacts/api-server/scripts/career-balance.ts 10000`. World output includes seed/version, tier/stage counts, ability/attribute/age/potential distributions, nationality/region coverage, duplicate/invalid counts and generation timing. Balance output rejects fewer than 10,000 requested matches.

## Validation and deliberate limits

Tests cover deterministic generation and stream independence; fractional development time; improvement/plateaus/late bloom/decline; exceptional prospects; retirement/replacement; legal scoring and actual-stat reconciliation; context/pressure/clutch/consistency/first throw; difficulty hierarchy; bounded form; adapter compatibility; transactional initialization/matches/periods/off-seasons; duplicate operation identity; feature gates/ownership; composite ownership and direct database constraints; migration and write fault rollback; archive behavior; and A1 restart/delete cascades with another save intact.

PGlite exercises PostgreSQL constraints and transactions in isolated fixtures. Its serialized connection is not a multi-connection PostgreSQL load/concurrency test. The root-lock design should additionally receive deployment-environment concurrency validation before release.

The completed phase is an internal foundation. Calendar allocation, events/entries/brackets, qualification, rankings, H2H presentation, news, UI and human live matches are deferred to A3 or later. Simulation supports 501 double-out legs only, not set formats. The aiming model is intentionally simplified and still needs empirical/live play calibration. Historical retired records grow over time; persistence batches avoid per-dart SQL, but decades-long production scale has not been benchmarked. Existing repository test/typecheck failures and a Windows native build permission issue are recorded separately in the delivery report; no green production-build claim is made.
