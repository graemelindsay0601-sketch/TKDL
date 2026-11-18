import { test } from "node:test";
import assert from "node:assert/strict";
import { londonHour, startKeepAwake, withinWindow } from "../keep-awake.ts";

test("keep-awake window: daytime on, night off, and windows that cross midnight", () => {
  assert.equal(withinWindow(8, 8, 24), true);
  assert.equal(withinWindow(23, 8, 24), true);
  assert.equal(withinWindow(0, 8, 24), false);
  assert.equal(withinWindow(7, 8, 24), false);
  assert.equal(withinWindow(23, 18, 2), true);
  assert.equal(withinWindow(1, 18, 2), true);
  assert.equal(withinWindow(12, 18, 2), false);
});

test("London hour follows GMT and BST", () => {
  assert.equal(londonHour(new Date("2026-01-15T07:30:00Z")), 7);   // GMT
  assert.equal(londonHour(new Date("2026-07-15T07:30:00Z")), 8);   // BST
});

test("keep-awake stays off away from Render or when switched off", () => {
  const saved = { url: process.env.RENDER_EXTERNAL_URL, flag: process.env.KEEP_AWAKE };
  delete process.env.RENDER_EXTERNAL_URL;
  assert.equal(startKeepAwake(), null);
  process.env.RENDER_EXTERNAL_URL = "https://example.onrender.com"; process.env.KEEP_AWAKE = "0";
  assert.equal(startKeepAwake(), null);
  delete process.env.KEEP_AWAKE;
  const timer = startKeepAwake();
  assert.ok(timer); clearInterval(timer!);
  if (saved.url === undefined) delete process.env.RENDER_EXTERNAL_URL; else process.env.RENDER_EXTERNAL_URL = saved.url;
  if (saved.flag !== undefined) process.env.KEEP_AWAKE = saved.flag;
});
