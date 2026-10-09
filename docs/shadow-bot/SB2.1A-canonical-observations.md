# SB2.1A — canonical observations and Career live

This checkpoint records evidence only. Existing Shadow profiles, unlocks, leaderboard, league, achievements, simulation and Practice clones remain on their existing data paths. No other source adapters, backfill, Player DNA, scorer changes or Replay UI are included.

## Commit boundary and authority

After the Career live service validates the submitted stream (including seeded opponent verification), settles a completed result through its existing calendar authority, and updates `career_match_sessions`, it calls `ingestCareerLive` inside the same transaction. That internal adapter reloads the persisted row and joins `career_saves.player_id`; no client-selected player ID is trusted. If the transaction rolls back, neither source nor projection is committed. A projection error propagates and rolls back the checkpoint; it does not silently lose evidence or leave a partial sporting result. This introduces an operational dependency on the new schema being initialized successfully.

Reading/opening a session or retrying an already-completed match does not import history. Only newly accepted dart checkpoints are projected. A resumed older session's newly accepted full checkpoint can contain its already-recorded prefix; there is no scan or historical backfill operation.

## Persistence and revision semantics

New ledger migration `createShadowObservationsSB21A_v1` creates:

- `shadow_activities`: unique source namespace/source ID; stable canonical ID and owner; current revision/hash; versioned JSON metadata with participants, source aliases, game/rules/config, timestamps and verification.
- `shadow_activity_revisions`: append-only ingestion audit, keyed by activity and authoritative source revision. Its `snapshot` holds metadata, changed/new observations (`upserts`) and removed event keys (`retractions`). Applying deltas in source-revision order reconstructs evidence; these rows are not a training dataset.
- `shadow_observations`: current active evidence only. Unique activity/participant/source ordinal, deterministic observation ID, player/seat/provenance/quality/eligibility columns, and contextual JSON evidence. The observation revision references its audit revision.

The generic contract supports DART, VISIT and RESULT units. Aggregates cannot claim physical dart detail. Physical hit and effective value are distinct; intended target is nullable and never inferred. Game/source metadata live once on the activity rather than being repeated on every dart.

Ingestion locks the canonical activity, rejects stale revisions and conflicting same-revision payloads, and treats identical retries as no-ops. JSON hashing is key-order independent and supplements stable identity. Accepted revisions replace the active projection; shortening/undo retracts removed darts. Surviving logical event IDs remain stable. Audit deltas retain superseded evidence without making it active twice. Inserts are batched to stay below PostgreSQL's bind-parameter limit.

The migration is additive, registered as a new startup-ledger entry, propagates failures, and uses repeat-safe table/index creation. No historical migration was modified. Shared DB schema definitions describe the same three tables.

## Career mapping

- Source key: `CAREER_LIVE` plus save/session ID; alias: `CAREER_MATCH` plus save/match ID.
- Only this adapter knows Career normalizes human to seat 0. The universal contract allows a human in any seat.
- Human participant maps to the save owner's TKDL player ID, provenance HUMAN, verification `SERVER_VALIDATED_SELF_REPORTED`. Real-board hits are self-reported, not independently sensor-verified.
- Opponent is an NPC participant with no TKDL player ID; provenance NPC and exclusion reason NPC. Its historical darts remain both in Career and the contextual projection, but are never human training evidence.
- Existing shared X01 `createMatch`/`throwDart` derives ordered actor, set/leg/visit/dart indexes and pre/post context. No scoring rules are copied into Shadow.
- Valid records have quality 4, never 5. Aim and per-dart wall-clock occurrence are unknown/null. Session timestamps are preserved as session timestamps.
- `phase` stores the rule authority's outcome (e.g. UNOPENED/BUST), not inferred aiming intent. `effectiveValue` stays null: pre/post context retains scoring transitions without inventing a per-dart attribution for a visit-wide bust rollback. The physical hit remains available unchanged.
- Bull-up labels/config remain linked in activity metadata and authoritative history; they are not manufactured into exact segment observations.
- Malformed/unsupported sessions fail projection instead of being promoted to quality 4. Unknown/generated/unverified/unsupported-game evidence is explicitly excluded by the generic eligibility function.

## Access and lifecycle

There is no new HTTP ingestion, read, reset or diagnostic endpoint. Existing Career session authentication, save ownership, strict request schemas and revision checks remain in force. Source bodies cannot choose another observation owner. No public raw-stream access is added.

Shadow tables reference players; deleting a Shadow activity cannot delete a player or source record. The generic source references are logical: deleting/restarting a Career save does not currently delete the private Shadow evidence. Source deletion/learning reset/retention policy and user controls are later work; do not expose archived projections as Replay without that policy. Account deletion cascades the owned activity. There is no new DNA consumer in this checkpoint.

## Validation and limits

Focused PGlite tests cover fresh/repeated migration, uniqueness, human/NPC attribution, seat independence, retry/correction/retraction, audit reconstruction, physical hits/unknown aim, quality rejection, generated exclusion, aggregates, rollback and account preservation. Existing Career live HTTP checks now assert projection parity, cross-owner/anonymous denial, forged player ID rejection and real undo/re-entry. Existing tournament fixture setup includes the new migration.

Existing rules/live-model/bot-adapter tests and selected Career live/tournament tests are the regression boundary; no multi-season simulation or production database test is required. Shared-library and API typechecks pass. The API production build was attempted but Windows sandbox directory access prevents esbuild resolving even existing entry points; no dependency, lockfile, build or deployment setting was changed to work around it.

Current projection replacement and authoritative replay operate on the full accepted stream (Career already caps it at 6,000 darts). Revision audit stores deltas to avoid retaining every full prefix. Future optimization should preserve the same identities and transaction semantics. No performance/load certification is claimed.

No production deployment or backfill was performed. Stop at SB2.1A.
