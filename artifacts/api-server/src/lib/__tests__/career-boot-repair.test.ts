import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { skippingNoOps } from "../../db/migrations/repair_career_schema.ts";

const db = drizzle(new PGlite());
const run = (work: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<void>) => db.transaction(async tx => {
  const quiet = skippingNoOps(tx as never); await work(quiet.tx as never); await quiet.flush();
});
const one = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows[0] as Record<string, unknown> | undefined;
const checkDef = () => one(sql`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'kind_check'`);

test("every-boot repairs: unchanged statements are skipped, real changes still apply", async () => {
  await db.execute(sql`CREATE TABLE things (id int PRIMARY KEY, kind text NOT NULL)`);
  await db.execute(sql`CREATE FUNCTION things_guard() RETURNS trigger AS $$ BEGIN RETURN NEW; END $$ LANGUAGE plpgsql`);
  const repairs = (kinds: string, timing: "BEFORE" | "AFTER") => run(async tx => {
    await tx.execute(sql`ALTER TABLE things ADD COLUMN IF NOT EXISTS note text`);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS things_kind_idx ON things (kind)`);
    await tx.execute(sql`ALTER TABLE things DROP CONSTRAINT IF EXISTS kind_check`);
    await tx.execute(sql.raw(`ALTER TABLE things ADD CONSTRAINT kind_check CHECK (kind IN (${kinds}))`));
    await tx.execute(sql`DROP TRIGGER IF EXISTS things_guard_trg ON things`);
    await tx.execute(sql.raw(`CREATE TRIGGER things_guard_trg ${timing} UPDATE ON things FOR EACH ROW EXECUTE FUNCTION things_guard()`));
    await tx.execute(sql`ALTER TABLE things DROP CONSTRAINT IF EXISTS long_gone_check`);
  });
  await repairs("'a','b'", "BEFORE");
  const first = { check: await checkDef(), trigger: await one(sql`SELECT oid FROM pg_trigger WHERE tgname = 'things_guard_trg'`),
    constraintOid: await one(sql`SELECT oid FROM pg_constraint WHERE conname = 'kind_check'`) };
  assert.match(String(first.check?.def), /'a'.*'b'/);
  assert.ok(await one(sql`SELECT 1 FROM information_schema.columns WHERE table_name = 'things' AND column_name = 'note'`));
  // Same again: nothing is dropped and re-created (same object ids).
  await repairs("'a','b'", "BEFORE");
  assert.deepEqual(await one(sql`SELECT oid FROM pg_trigger WHERE tgname = 'things_guard_trg'`), first.trigger, "trigger left alone");
  assert.deepEqual(await one(sql`SELECT oid FROM pg_constraint WHERE conname = 'kind_check'`), first.constraintOid, "constraint left alone");
  // A changed definition is applied.
  await repairs("'a','b','c'", "AFTER");
  assert.match(String((await checkDef())?.def), /'c'/, "new constraint values applied");
  assert.match(String((await one(sql`SELECT pg_get_triggerdef(oid) AS def FROM pg_trigger WHERE tgname = 'things_guard_trg'`))?.def), /AFTER UPDATE/, "changed trigger applied");
  // A drop with nothing following still drops when there's something to drop.
  await run(async tx => { await tx.execute(sql`ALTER TABLE things DROP CONSTRAINT IF EXISTS kind_check`); });
  assert.equal(await checkDef(), undefined);
});
