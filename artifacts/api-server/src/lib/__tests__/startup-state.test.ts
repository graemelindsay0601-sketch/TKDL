import test from "node:test";
import assert from "node:assert/strict";
import { getStartupStatus, markStartupFailed, markStartupReady, setStartupPhase } from "../startup-state.ts";

test("API readiness stays closed through startup phases and opens only when explicitly ready", () => {
  setStartupPhase("database", "Waking database");
  assert.equal(getStartupStatus().ready, false);
  assert.equal(getStartupStatus().phase, "database");
  setStartupPhase("schema", "Checking scoring");
  assert.equal(getStartupStatus().ready, false);
  markStartupReady();
  assert.deepEqual({ ready: getStartupStatus().ready, phase: getStartupStatus().phase }, { ready: true, phase: "ready" });
});

test("a failed retry closes readiness again", () => {
  markStartupReady();
  markStartupFailed("Retrying");
  assert.equal(getStartupStatus().ready, false);
  assert.equal(getStartupStatus().phase, "failed");
  assert.equal(getStartupStatus().message, "Retrying");
});
