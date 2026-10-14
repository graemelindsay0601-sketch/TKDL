import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const workerSource = readFileSync(
  new URL("../../../public/service-worker.js", import.meta.url),
  "utf8",
);

function createWorker(fetchImpl: typeof fetch, initialCache: Record<string, Response> = {}) {
  const handlers: Record<string, (event: any) => void> = {};
  const stored = new Map(Object.entries(initialCache));
  const requestKey = (request: Request | string) => typeof request === "string" ? request : request.url;
  const caches = {
    open: async () => ({
      put: async (request: Request, response: Response) => {
        stored.set(requestKey(request), response);
      },
    }),
    match: async (request: Request | string) => stored.get(requestKey(request)),
    keys: async () => [],
    delete: async () => true,
  };
  const self = {
    addEventListener: (name: string, callback: (event: any) => void) => { handlers[name] = callback; },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
    location: { href: "https://tkdl-wt7y.onrender.com/service-worker.js" },
    registration: { showNotification: async () => undefined },
  };
  vm.runInNewContext(workerSource, {
    self, caches, fetch: fetchImpl, URL, Response, Promise, Date, console,
    clients: self.clients,
  });
  return handlers;
}

async function runGet(
  fetchHandler: (event: any) => void,
  url: string,
  mode: RequestMode,
  accept = "*/*",
) {
  let responsePromise: Promise<Response> | undefined;
  fetchHandler({
    request: {
      url, method: "GET", mode, destination: "",
      headers: { get: (name: string) => name.toLowerCase() === "accept" ? accept : null },
    },
    respondWith: (response: Promise<Response> | Response) => { responsePromise = Promise.resolve(response); },
    waitUntil: (promise: Promise<unknown>) => { void promise.catch(() => undefined); },
  });
  assert.ok(responsePromise, "the service worker should handle this GET");
  return responsePromise;
}

test("Career route fetch failures fall back to the cached app shell without rejecting FetchEvent", async () => {
  const handlers = createWorker(async () => { throw new TypeError("Failed to fetch"); }, {
    "/index.html": new Response("<main>TKDL shell</main>", { status: 200 }),
  });
  const response = await runGet(
    handlers.fetch,
    "https://tkdl-wt7y.onrender.com/career/f08eb7ad-8374-4971-a5e1-a34aec4a02c4",
    "same-origin",
  );
  assert.equal(response.status, 200);
  assert.match(await response.text(), /TKDL shell/);
});

test("failed non-shell asset fetches resolve to 503 instead of rejecting FetchEvent", async () => {
  const handlers = createWorker(async () => { throw new TypeError("Failed to fetch"); });
  const response = await runGet(
    handlers.fetch,
    "https://tkdl-wt7y.onrender.com/assets/missing.png",
    "no-cors",
  );
  assert.equal(response.status, 503);
  assert.equal(await response.text(), "Network error");
});
