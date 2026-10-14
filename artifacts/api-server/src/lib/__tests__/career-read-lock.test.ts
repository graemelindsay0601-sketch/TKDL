import { test } from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { lockRoot } from "../../career/world/service.ts";
import { careerRequestScope, readRetryingCareerDatabase } from "../../career/request-scope.ts";
import { WORLD_GENERATION_VERSION } from "../../career/world/config.ts";
import type { CareerDatabase, CareerExecutor } from "../../career/database.ts";

const SAVE = "00000000-0000-4000-8000-000000000001";
const dialect = new PgDialect();
function recorder() {
  const seen: string[] = [];
  const tx: CareerExecutor = { async execute(query: SQL) {
    const text = dialect.sqlToQuery(query).sql; seen.push(text);
    if (text.includes("feature_flags")) return { rows: [{ enabled: true, admin_test_mode: false }] };
    return { rows: [{ id: SAVE, status: "ACTIVE", world_generation_version: WORLD_GENERATION_VERSION }] };
  } };
  return { tx, seen };
}
const inScope = <T>(method: string, work: () => Promise<T>) => new Promise<T>((resolve, reject) =>
  careerRequestScope({ method } as never, {} as never, () => { work().then(resolve, reject); }));

test("Career GET requests share the save lock; writes keep it exclusive", async () => {
  for (const [method, lock] of [["GET", "for share of"], ["POST", "for update of"], ["PUT", "for update of"]] as const) {
    const { tx, seen } = recorder();
    await inScope(method, () => lockRoot(tx, { playerId: 1 }, SAVE));
    assert.match(seen.find(s => s.includes("career_saves"))!.toLowerCase(), new RegExp(lock), method);
  }
  const { tx, seen } = recorder();
  await lockRoot(tx, { playerId: 1 }, SAVE); // outside a request (jobs, harnesses): exclusive
  assert.match(seen.find(s => s.includes("career_saves"))!.toLowerCase(), /for update of/);
});

test("read transactions retry a deadlock between concurrent reads; writes never retry", async () => {
  const flaky = (failures: number) => {
    let calls = 0;
    const db: CareerDatabase = { execute: async () => ({ rows: [] }), async transaction(work) {
      calls++; if (calls <= failures) throw Object.assign(new Error("deadlock detected"), { code: "40P01" });
      return work(db);
    } };
    return { db: readRetryingCareerDatabase(db), calls: () => calls };
  };
  const read = flaky(2);
  assert.equal(await inScope("GET", () => read.db.transaction(async () => "ok")), "ok");
  assert.equal(read.calls(), 3);
  const write = flaky(1);
  await assert.rejects(inScope("POST", () => write.db.transaction(async () => "ok")), /deadlock/);
  assert.equal(write.calls(), 1);
});
