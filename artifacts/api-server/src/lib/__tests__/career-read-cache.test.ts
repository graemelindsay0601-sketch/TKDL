import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import express from "express";
import { careerReadCache, clearCareerReadCache } from "../../career/read-cache.ts";
import { bumpSaveVersion } from "../../career/save-version.ts";

const SAVE = "11111111-2222-4333-8444-555555555555";
let base = "", computed = 0, server: ReturnType<ReturnType<typeof express>["listen"]>;
before(async () => {
  process.env.CAREER_READ_CACHE_SETTLE_MS = "0";
  const app = express();
  app.use((req, _res, next) => { const p = Number(req.header("x-test-player") ?? 0); (req as unknown as { session: unknown }).session = p ? { playerId: p } : {}; next(); });
  app.use(careerReadCache);
  app.get("/saves/:id/guide", (req, res) => { computed++; res.json({ n: computed, q: req.query.q ?? null }); });
  app.get("/saves/:id/tournaments/:eventId", (_req, res) => { computed++; res.json({ n: computed }); });
  app.get("/saves/:id/inbox", (_req, res) => { computed++; res.status(409).json({ error: "not yet" }); });
  app.post("/saves/:id/calendar/advance", (_req, res) => { res.json({ ok: true }); });
  await new Promise<void>(r => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => { server.close(); delete process.env.CAREER_READ_CACHE_SETTLE_MS; });
beforeEach(() => { clearCareerReadCache(); computed = 0; });
const get = async (path: string, player = 1) => { const r = await fetch(base + path, { headers: { "x-test-player": String(player) } }); return { hit: r.headers.get("x-career-cache") === "hit", body: await r.json() as { n?: number } }; };

test("a repeated screen read is served from memory until the save changes", async () => {
  const first = await get(`/saves/${SAVE}/guide`), second = await get(`/saves/${SAVE}/guide`);
  assert.equal(first.hit, false); assert.equal(second.hit, true); assert.equal(second.body.n, first.body.n);
  await fetch(`${base}/saves/${SAVE}/calendar/advance`, { method: "POST", headers: { "x-test-player": "1" } });
  const third = await get(`/saves/${SAVE}/guide`);
  assert.equal(third.hit, false); assert.equal(third.body.n, 2);
  bumpSaveVersion(SAVE); // a write transaction locking the save (lockRoot) does this
  assert.equal((await get(`/saves/${SAVE}/guide`)).hit, false);
});

test("answers stay with their player and their exact query; live screens and errors are never kept", async () => {
  await get(`/saves/${SAVE}/guide`, 1);
  assert.equal((await get(`/saves/${SAVE}/guide`, 2)).hit, false);
  assert.equal((await get(`/saves/${SAVE}/guide?q=1`, 1)).hit, false);
  await get(`/saves/${SAVE}/tournaments/abc`); assert.equal((await get(`/saves/${SAVE}/tournaments/abc`)).hit, false);
  await get(`/saves/${SAVE}/inbox`); assert.equal((await get(`/saves/${SAVE}/inbox`)).hit, false);
  assert.equal((await get(`/saves/${SAVE}/guide`, 0)).hit, false);
});

test("nothing is kept straight after a change (the first reads run the week's upkeep)", async () => {
  process.env.CAREER_READ_CACHE_SETTLE_MS = "60000";
  try {
    bumpSaveVersion(SAVE);
    await get(`/saves/${SAVE}/guide`);
    assert.equal((await get(`/saves/${SAVE}/guide`)).hit, false);
  } finally { process.env.CAREER_READ_CACHE_SETTLE_MS = "0"; }
});
