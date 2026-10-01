import assert from "node:assert/strict";
import test from "node:test";
import { ApiRequestError, apiFetchJson } from "../api-fetch.ts";

test("rejects an HTTP error body instead of returning it as page data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "Standings unavailable" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
  try {
    await assert.rejects(
      apiFetchJson("/api/leaderboard"),
      (error: unknown) => error instanceof ApiRequestError && error.status === 500 && error.message === "Standings unavailable",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("does not automatically repeat a failed mutation", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ error: "Try again" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await assert.rejects(apiFetchJson("/api/matches", { method: "POST" }), ApiRequestError);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
