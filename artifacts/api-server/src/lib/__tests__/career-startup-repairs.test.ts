/**
 * Release-candidate verification of the G1 startup repairs (P0-1, P0-2) on PGlite: fresh install,
 * a database deployed without SP-F/SP-H, a database whose ledger the A9 upgrade had narrowed, and
 * full replays of every Career step (idempotence). The same check runs on real PostgreSQL with
 *   node scripts/career-startup-repair-check.ts --pg=postgres://…
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStartupRepairs, pgliteFactory } from "../../../scripts/career-startup-repair-check.ts";

test("startup repairs: fresh, upgraded and replayed databases (PGlite)", async () => {
  const results = await checkStartupRepairs(pgliteFactory);
  assert.ok(results.length >= 18, `${results.length} checks`);
  assert.deepEqual(results.filter(r => !r.ok), []);
});
