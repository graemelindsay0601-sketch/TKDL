import test from "node:test";
import assert from "node:assert/strict";
import { assertSafeDevelopmentDatabase } from "../local-db-guard.ts";

const safe = {
  nodeEnv: "development",
  environment: "local-development",
  databaseUrl: "postgresql://tkdl_dev:local-only@127.0.0.1:55432/tkdl_dev",
};

test("accepts only the dedicated loopback development database", () => {
  assert.doesNotThrow(() => assertSafeDevelopmentDatabase(safe));
});

test("preserves production startup configuration", () => {
  assert.doesNotThrow(() =>
    assertSafeDevelopmentDatabase({
      nodeEnv: "production",
      environment: undefined,
      databaseUrl: "postgresql://deployment-managed/production",
    }),
  );
});

test("rejects missing development identity or URL", () => {
  assert.throws(() =>
    assertSafeDevelopmentDatabase({
      nodeEnv: "development",
      environment: undefined,
      databaseUrl: undefined,
    }),
    /Unsafe TKDL API startup blocked/,
  );
});

test("rejects the shared Replit database and other remote hosts", () => {
  for (const databaseUrl of [
    "postgresql://user:pass@helium:5432/heliumdb",
    "postgresql://user:pass@db.example.test:5432/tkdl_dev",
    "postgresql://user:pass@127.0.0.1:5432/tkdl_dev",
    "postgresql://user:pass@127.0.0.1:55432/heliumdb",
    "postgresql://user:pass@127.0.0.1:55432/tkdl_dev",
    "postgresql://tkdl_dev@127.0.0.1:55432/tkdl_dev",
  ]) {
    assert.throws(
      () => assertSafeDevelopmentDatabase({ ...safe, databaseUrl }),
      /Unsafe TKDL API startup blocked/,
    );
  }
});
