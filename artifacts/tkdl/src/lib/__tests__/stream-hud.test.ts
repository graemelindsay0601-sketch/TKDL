import { test } from "node:test";
import assert from "node:assert/strict";
import { hudAlertText, isHudAlert } from "../../features/career/pages/stream-hud-model.ts";

test("stream overlay: alerts, subs and super chats take the chip; ordinary chat stays in the tray", () => {
  assert.ok(isHudAlert({ kind: "ALERT", alert: "TRAIN", text: "Hype train level 2!" }));
  assert.ok(isHudAlert({ kind: "SUB", user: "a", months: 1 }));
  assert.ok(isHudAlert({ kind: "SUPERCHAT", user: "a", pence: 500, text: "gg" }));
  assert.ok(!isHudAlert({ kind: "CHAT", user: "a", text: "hi" }));
  assert.ok(!isHudAlert({ kind: "BITS", user: "a", pence: 100, text: "" }), "bits are too frequent for the chip");
  assert.equal(hudAlertText({ kind: "ALERT", alert: "REQUEST_IN", text: "Request from Dave", user: "Dave" }), "📩 Request from Dave");
  assert.equal(hudAlertText({ kind: "SUPERCHAT", user: "Sam", pence: 250, text: "" }), "💬 Sam: £2.50");
});
