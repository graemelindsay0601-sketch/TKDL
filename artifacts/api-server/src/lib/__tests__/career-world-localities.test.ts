import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { CareerDatabase } from "../../career/database.ts";
import type { CareerSportingService } from "../../career/sporting/service.ts";
import { createCareerContentService, createCareerContentRouter } from "../../career/content/service.ts";

const content = createCareerContentService({} as unknown as CareerDatabase, {} as unknown as CareerSportingService);
const app = express();
app.use((req, _res, next) => {
  if (req.header("x-test-session") === "authenticated") Object.assign(req, { session: { playerId: 7 } });
  next();
});
app.use("/api/career", createCareerContentRouter(content));
let server: ReturnType<typeof app.listen>;
let url = "";

before(async () => {
  server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    listener.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Local test server did not bind a TCP port");
  url = `http://127.0.0.1:${address.port}/api/career/saves/11111111-1111-4111-8111-111111111111/world-localities`;
});
after(async () => { if (server) await new Promise<void>(resolve => server.close(() => resolve())); });

test("world locality identities are served read-only and require authentication", async () => {
  assert.equal((await fetch(url)).status, 401);
  const response = await fetch(url, { headers: { "x-test-session": "authenticated" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const localities = await response.json() as { key: string; venues: { id: string; capacityBand: string }[] }[];
  assert.equal(localities.length, 35);
  assert.equal(localities.reduce((count, locality) => count + locality.venues.length, 0), 70);
  assert.equal(new Set(localities.flatMap(locality => locality.venues.map(venue => venue.id))).size, 70);
});
