# Temporary read-only Career diagnostic deployment

This prepares safe inspection; it does **not** repair the Career database.

## Safety and availability

Set `TKDL_DIAGNOSTIC_ONLY=1` **before the first start of this build**.
The mode skips all startup ledgers, migrations, seeds, deferred maintenance,
broadcast generation and application schedulers. It permits only startup,
health and the existing admin Career schema diagnostic API. Normal application
APIs, including login, PIN verification and gameplay, return 503.

Sessions use the normal signed cookie and existing database lookup, but cannot
be saved, repaired, touched, destroyed or pruned. Missing, expired, unverified
or malformed admin sessions fail closed. No admin bypass or alternative secret
has been added.

Unset or `0` retains normal startup, including its existing database writers.
Any other value fails startup rather than silently running those writers.

## Coordinated Render procedure — approval required

1. Obtain approval for a temporary pause of normal TKDL API usage.
2. Before the window, retain a valid, verified-admin session from the existing
   application. Do not change `SESSION_SECRET`. Diagnostic mode cannot perform
   a fresh login or verify a PIN because those operations persist session data.
3. Confirm the service's deployed branch/commit and effective build/start
   commands in Render. Dashboard overrides have not been audited here.
4. Prevent an automatic deployment from starting an intermediate build. Arrange
   for the diagnostic flag and the reviewed combined diagnostic/startup-safety
   code to take effect together. If Render provides a save-without-deploy
   operation, use it to stage the flag. Do **not** restart the old build merely
   to set the flag: that old build ignores it and can run normal startup writers.
   If the changes cannot be coordinated without such a restart, stop.
5. Deploy only after that configuration is confirmed. Keep the repository's
   existing build/start commands; no shell, migration command or ledger edits
   are needed. Do not merge first and add the flag afterwards.
6. Open `/api/startup` and verify both `ready: true` and `diagnosticOnly: true`.
7. In the same browser/origin with the existing admin session, open
   `/api/admin/career/schema-diagnostic`. Save the JSON privately.
   A 403 means the session is not verified; do not bypass that authorization.
8. Review the actual production schema before choosing any repair. Do not
   delete the failed Career or reset either migration ledger.

Removing the flag/restarting normally can run the original startup writers.
Restoring normal service therefore needs its own approved plan after inspection;
it is not automatically safe merely because the diagnostic succeeded.

## Verification

Focused native PostgreSQL tests cover current and stale-schema diagnostics,
read-only enforcement, full built-server startup with no initial database
connection, verified/non-admin/legacy/malformed sessions, blocked ordinary APIs,
and unchanged session rows and schema. A scoped TypeScript check and API build
pass; the previously timed-out full API typecheck is not claimed as passing.
