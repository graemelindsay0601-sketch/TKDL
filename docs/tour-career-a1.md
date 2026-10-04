# Tour Career 2.0 — A1 foundation

Career is a separate domain under `artifacts/api-server/src/career`. It does not
read, copy, reinterpret or write Classic Tour runs, trophies, achievements,
currencies or progression. No Career frontend or navigation is added in A1.

## Enablement and deployment

The additive `createCareerSavesA1` migration runs through the existing startup
migration ledger, after feature flags are initialized and before API readiness.
It is transactional, re-runnable and propagates errors to the startup runner.
It creates only `career_saves`, `career_finance_entries`, their constraints/indexes
and the `tour_career_2` feature flag. Existing flag values survive reruns.

The flag starts with `enabled=false, admin_test_mode=false`. Use the existing
admin feature-flag settings to enable admin preview in a development/test
environment. An administrator still accesses only their session player's saves.
`enabled=true` makes the API available to authenticated players. Missing/disabled
flags fail closed. There is no replacement or redirect for `/tour`.

The Drizzle definitions in `lib/db/src/schema/career-saves.ts` mirror the migration.
Application defaults are supplied explicitly at creation, not by drifting database
defaults. The migration is immutable: future schema changes need a new migration
key, not edits to A1. No production database was used during implementation.

## Save identity, slots and archive

`career_saves.id` is a server-generated UUID and the universe boundary.
`player_id` is its authenticated owner. `slot_number` is 1, 2 or 3, constrained
in PostgreSQL. A partial unique index on `(player_id, slot_number)` **where status
is ACTIVE** prevents concurrent slot duplication and enforces at most three active
careers. An archive retains its historical slot number but does not occupy it.
There is no lifetime record cap.

Only ACTIVE and RETIRED are supported in A1. A retired timestamp is required
exactly when status is RETIRED. No fake archive statistics are generated.
Archives persist until the owner explicitly deletes them or the player account
is deleted; deleting an account cascades its private Career data.

## API contract

All paths are under `/api/career`. Session identity comes from TKDL's existing
`express-session` middleware, after legacy-session repair. Request `playerId`,
seed, versions and balance are never authoritative and unexpected body fields
are rejected. Responses are not cacheable.

| Method/path | Behaviour |
| --- | --- |
| GET `/saves` | `{ slots: [{slotNumber, career}], archived: [...] }`; always three ordered slots, with `career: null` for empty slots |
| POST `/saves` | Body `{slot: 1\|2\|3, difficulty?: "ACCESSIBLE"\|"STANDARD"\|"CHALLENGING", careerName?: string}`; returns 201 and the new save |
| GET `/saves/:id` | Returns the owned active or retired save |
| POST `/saves/:id/restart` | Empty body or `{}`; returns 200 with a **new save ID** in the same slot |
| POST `/saves/:id/retire` | Empty body or `{}`; returns 200 with the archived save |
| DELETE `/saves/:id` | Empty body or `{}`; removes an owned active or retired universe; returns 204 |

Authentication failure is 401. Validation failure is 400. Unknown/not-owned IDs
return the identical 404, even for administrators. A disabled feature returns
404. Slot conflicts and attempting restart/re-retire on an archive return 409.
Unexpected database errors are logged and return a generic 500, never SQL details.
Writes use the existing authenticated-write rate limiter. Thin routes delegate to
the service, which validates creation again for internal callers.

The explicit response projection includes save/slot identity, display name,
status, difficulty, season/week, timestamps, version metadata and initial player
state. It omits owner IDs, world seed and the internal settings snapshot. Money
is `balancePence` plus currency `GBP`, not a floating-point pound value.

## Lifecycle transactions

Creation inserts the save and one `CAREER_START` ledger entry atomically. The
database unique index, not a preflight availability query, decides slot conflicts.

Restart locks the owner-scoped root with `SELECT ... FOR UPDATE`, requires ACTIVE,
deletes the old root (cascading children), and creates a fresh root plus starting
ledger entry in the same transaction. It preserves slot, name and difficulty.
The new universe has a fresh 256-bit `crypto.randomBytes` seed, new timestamps,
current version metadata/settings, £250, season/week 1, Unknown Amateur standing,
no rank, no sponsor, no Tour Card and zero professional ranking money. Failure
restores the old root and all children. Clients must adopt the returned ID; old
IDs return 404, so stale gameplay requests cannot reach the restarted universe.

Retirement locks the owned root, requires ACTIVE, then sets RETIRED and timestamps.
It keeps the seed, state and all child rows. The partial unique index frees the
slot without deleting the archived record. Restart and repeated retirement reject
retired roots. Explicit owner deletion remains available for archives.

Deletion locks the owned root and deletes that root in a transaction. Foreign-key
cascades remove only its universe. Cascades never point from a Career root toward
players, other game modes or currencies.

## Rules for future child tables and gameplay

Every Career-owned row must carry `career_save_id NOT NULL REFERENCES
career_saves(id) ON DELETE CASCADE`, with an index beginning with `career_save_id`.
Do not use `player_id` as the universe key. Scope every lookup by save ID.
For child-to-child references, use composite foreign keys including the save ID
so records from different universes cannot be joined accidentally. Do not create
non-cascading dependencies or outside-domain references to the replaceable root.

Every future gameplay write must lock and check the owner-scoped ACTIVE root in
the same transaction as its child/state writes, matching the lifecycle service.
This serializes gameplay against restart/retirement/deletion. The foreign key
alone does not make archived children immutable. Do not bypass the service with
new route-local SQL. Extend integration tests whenever a child table is added.

The real minimal ledger demonstrates this ownership contract. A4 must add its
own balance/ledger mutation service; A1 exposes no arbitrary balance-update API.
Career money is fictional, non-purchasable and disconnected from TKDL coins.

## Defaults and versions

`career/config.ts` is the single current-value source for slots, difficulty
presets, defaults and the four independent version constants. Each save persists
`careerSchemaVersion`, `worldGenerationVersion`, `eventDatabaseVersion`, and
`playerDatabaseVersion` as explicit columns. `settings_snapshot` records the
creation defaults and chosen difficulty. Reading a save never overwrites old
version metadata. Restart deliberately opts into the current versions.

All versions begin at 1; this does not claim A2 event/NPC databases exist.
Future forward migrations and incompatible LEGACY handling are deferred. Introduce
them explicitly rather than silently rebuilding existing worlds or relabelling
their versions. No A2 simulation, calendar, tournament or UI work is included.

## Verification

Run `node --test src/lib/__tests__/career.test.ts` from `artifacts/api-server`, or
the existing `pnpm --filter @workspace/api-server test` / `pnpm test` commands.
The dev-only PGlite dependency executes PostgreSQL DDL, foreign keys, partial
indexes, transactions and rollback in an isolated in-memory database. HTTP tests
use actual Express routes and signed express-session cookies, with a test-only
login harness. No production connection or account credentials are required.

Tests cover defaults, versions, seed uniqueness, validation, all ownership paths,
feature flags, three slots, archive reuse, reset/delete cascades, a hypothetical
future child, other-save isolation, unchanged unrelated-state fixtures, competing
requests, direct database constraint violations, migration idempotence/rollback,
and injected ledger failures rolling back creation/restart.

PGlite serializes database transactions: concurrent HTTP tests exercise the
constraint/error path but do not prove multi-connection PostgreSQL lock scheduling.
Run a staging concurrency/deployment smoke test before release. The unrelated-mode
fixtures prove lifecycle isolation; they are not a full running TKDL database.
The Tour regression review additionally compares existing Tour source and schema
creation byte-for-byte with the starting commit.

At the inspected main commit `9e3dc0865a300612e4d3bea2e23cbbd74c6e6b20`, the baseline
already has four failing API tests, two failing frontend tests and twelve API
typecheck diagnostics in broadcast code. These unrelated files are not changed
by A1. See the implementation completion report for actual command results and
environment-specific build limitations.
