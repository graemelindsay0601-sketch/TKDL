import { test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { fixture } from "./career-events-fixture.ts";
import { createCareerEventRouter } from "../../career/events/router.ts";
test("authenticated API projects event data and refuses client identity/result/seed authority", async () => {
  const f = await fixture();
  const app = express(); app.use(express.json());
  // Test-only authentication fixture; production receives the existing signed session middleware.
  app.use((req, _res, next) => { Object.assign(req, { session: { playerId: req.headers["x-test-player"] ? Number(req.headers["x-test-player"]) : undefined } }); next(); });
  app.use(createCareerEventRouter(f.events));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/saves/${f.save.id}`;
  try {
    assert.equal((await fetch(`${url}/calendar`)).status, 401);
    assert.equal((await fetch(`${url}/calendar`, { headers: { "x-test-player": "2" } })).status, 404);
    const response = await fetch(`${url}/calendar?limit=3`, { headers: { "x-test-player": "1" } });
    assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
    const dto = await response.json(); assert.equal(dto.events.length, 3);
    const entered = await fetch(`${url}/events/${dto.events[0].id}/enter`, { method: "POST", headers: { "x-test-player": "1", "content-type": "application/json" }, body: JSON.stringify({ playerId: 2, seed: "evil" }) });
    assert.equal(entered.status, 400);
    assert.equal((await fetch(`${url}/events/${dto.events[0].id}/progress`, { method: "POST", headers: { "x-test-player": "1" } })).status, 404);
  } finally { server.close(); await f.pg.close(); }
});
