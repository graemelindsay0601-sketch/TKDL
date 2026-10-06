# Career content upgrade A9 V1

## Problem and scope

Older installations can have all eight original Career migration keys recorded
while lacking the later A8/A9 tables, constraints and event catalogue versions.
New saves require catalogue v5; an old v1/v2 database can therefore commit a
world and then fail calendar initialization. Missing signature products also
break the Career Life read.

`upgradeCareerContentA9V1` is a new migration key, registered after the original
Career setup steps. It reapplies the certified Career schema helpers in one
transaction and records its own completion inside that same transaction.
It does not invalidate old keys, regenerate NPCs, change save versions or seeds,
reset careers, alter scoring or introduce A10 functionality. Some existing
helper operations legitimately backfill legacy Career fields or replace old
constraints/indexes to match the already-shipped A9 schema.

The transaction has a five-second lock timeout and a thirty-second timeout per
statement. An advisory lock serializes simultaneous upgrade workers. Existing
shipped event-definition hash conflicts abort rather than overwrite content.
Failure rolls back the repair and its completion marker. Normal startup's
other existing initialization/runtime behavior is not changed by this patch.

## Verification

Six native PostgreSQL tests cover fresh installation, old recorded keys plus
missing content, recovery of a failed save with 340 existing NPCs, unchanged
current Careers, complete rollback even after marker insertion, conflicting
definition hashes, idempotency and concurrent workers.

An additional historical integration test uses the actual pre-A8.1 `7f47f2e`
schema helpers. It reproduces the missing-product and v5 foreign-key failures,
then upgrades to the same schema as a fresh certified installation. The
existing save root is unchanged; initialization and calendar, Life, finance,
sporting, history, profile and tournament-detail reads recover. Repeated
initialization does not duplicate owned rows.

The focused TypeScript check and API production build pass. A full-project
typecheck is not claimed; earlier full API checks timed out.

## Production boundary

This is a WRITE migration, not the read-only diagnostic mode. No diagnostic-only
flag or extended maintenance mode is required. A normal deployment of a new
commit runs it when full startup checks the new migration key. A previously
completed fast-wake bootstrap key can skip full startup, so confirm the new
deployment uses its new `RENDER_GIT_COMMIT` rather than a manually reused key.

Production inspection remains incomplete: supplied logs confirm the missing
product table, but the calendar error is truncated. Fixture recovery is not a
claim that production has already been repaired.

Before release, retain a recoverable database backup, verify the target
service/database and approve the schema-write deployment. Do not wipe saves,
clear either ledger, force old keys to rerun or deploy a diagnostic-only window.
After release, confirm this new key completed and that the same failed save can
initialize successfully without regenerated world rows.

Future additions need another new versioned migration key, not a mutation of an
already-recorded upgrade.
