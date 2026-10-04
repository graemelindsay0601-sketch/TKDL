import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createCareerService } from "../../career/service.ts";

test("Career staged flag defaults Hidden, preserves admin choices, and agrees with the real Career gate", async () => {
  const pg = new PGlite();
  // The production node-postgres adapter reports rowCount; PGlite calls the
  // same affected-row count affectedRows. Match that adapter shape in this test.
  const query = pg.query.bind(pg);
  pg.query = (async (...args: Parameters<typeof query>) => {
    const result = await query(...args);
    return { ...result, rowCount: result.affectedRows };
  }) as typeof pg.query;
  try {
    await pg.exec(`CREATE TABLE feature_flags (
      id serial PRIMARY KEY, feature_name text UNIQUE NOT NULL,
      enabled boolean NOT NULL DEFAULT false, admin_test_mode boolean NOT NULL DEFAULT false,
      description text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    )`);
    const db = drizzle(pg);
    (globalThis as any).__a66Db = db;
    const schema = new URL("../../../../../lib/db/src/schema/feature-flags.ts", import.meta.url).href;
    const source = `export const db=globalThis.__a66Db; export {featureFlagsTable} from ${JSON.stringify(schema)};`;
    const hook = registerHooks({ resolve(specifier, context, next) {
      if (specifier === "@workspace/db") return { url: `data:text/javascript,${encodeURIComponent(source)}`, shortCircuit: true };
      return next(specifier, context);
    } });
    let flags: typeof import("../../services/feature-flags-service.ts");
    try { flags = await import("../../services/feature-flags-service.ts"); } finally { hook.deregister(); }
    const name = flags.FEATURES.TOUR_CAREER_2;
    const career = createCareerService(db);
    const check = async (admin: boolean, expected: boolean) => {
      assert.equal((await flags.getFeatureStatus(name, admin)).available, expected);
      assert.equal(await career.isAvailable(admin), expected);
    };
    await flags.initializeFeatureFlags();
    await check(false, false); await check(true, false);
    assert.equal(await flags.setAdminTestMode(name, true), true);
    await flags.initializeFeatureFlags();
    await check(false, false); await check(true, true);
    assert.equal(await flags.enableFeatureForAll(name), true);
    await flags.initializeFeatureFlags();
    await check(false, true); await check(true, true);
    assert.equal(await flags.disableFeature(name), true);
    assert.equal(await flags.setAdminTestMode(name, false), true);
    await flags.initializeFeatureFlags();
    await check(false, false); await check(true, false);
    assert.equal((await pg.query("SELECT * FROM feature_flags WHERE feature_name='tour_career_2'")).rows.length, 1);
  } finally { delete (globalThis as any).__a66Db; await pg.close(); }
});
