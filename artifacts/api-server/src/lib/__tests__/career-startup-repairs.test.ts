/**
 * Release-candidate verification of the G1 startup repairs (P0-1, P0-2) on PGlite: fresh install,
 * a database deployed without SP-F/SP-H, a database whose ledger the A9 upgrade had narrowed, and
 * full replays of every Career step (idempotence). Runs the dev check script as a child process;
 * the same check runs on real PostgreSQL with
 *   node scripts/career-startup-repair-check.ts --pg=postgres://…
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const API = path.resolve(import.meta.dirname, "../../..");

test("startup repairs: fresh, upgraded and replayed databases (PGlite)", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ["scripts/career-startup-repair-check.ts"], { cwd: API, maxBuffer: 1 << 24 });
  assert.doesNotMatch(stdout, /^FAIL/m, stdout);
  const m = stdout.match(/PGlite: (\d+)\/(\d+) checks pass/);
  assert.ok(m && m[1] === m[2] && Number(m[2]) >= 18, stdout.slice(-400));
});
