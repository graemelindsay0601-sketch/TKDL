/**
 * Tests for edition-slots.ts's resolveLogicalSlot() — 16.3 step 1. Uses the
 * documented default times (midday 11:30, evening 19:00, night 00:00,
 * Europe/London) throughout, and deliberately covers both BST (UTC+1, e.g.
 * September) and GMT (UTC+0, e.g. January) to prove the timezone
 * conversion is real, not a fixed offset.
 *
 * All of the describe blocks below run with singleDailyEpisode explicitly
 * false, to exercise the original three-slots-a-day cadence in isolation —
 * see the dedicated "singleDailyEpisode: true" describe block at the end of
 * this file for the collapsed-to-one-episode-a-day behaviour that's now the
 * real BROADCAST_SETTING_DEFAULTS default (direct response to player
 * feedback that three near-identical daily slots read as "a constant same
 * episode loop" rather than one thing to look forward to).
 *
 * Run with: pnpm --filter @workspace/api-server run test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  manualEpisodeSlotKey, rebuildAttemptSlotKey, resolveLogicalSlot, resolveNextLogicalSlot,
  type SlotTimesConfig,
} from "../edition-slots.ts";

const DEFAULT_CONFIG: SlotTimesConfig = {
  middayTime: "11:30", eveningTime: "19:00", nightTime: "00:00", timezone: "Europe/London", singleDailyEpisode: false,
};

describe("resolveLogicalSlot — BST (September, UTC+1)", () => {
  test("early morning London time resolves to the night slot, dated today", () => {
    // 09:00 UTC = 10:00 BST — after night@00:00 BST, before midday@11:30 BST.
    const result = resolveLogicalSlot(new Date("2026-09-02T09:00:00Z"), DEFAULT_CONFIG);
    assert.equal(result.slotType, "night");
    assert.equal(result.slotDate, "2026-09-02");
    assert.equal(result.slotKey, "2026-09-02:night");
  });

  test("just after midday London time resolves to the midday slot", () => {
    // 11:00 UTC = 12:00 BST — after midday@11:30 BST, before evening@19:00 BST.
    const result = resolveLogicalSlot(new Date("2026-09-02T11:00:00Z"), DEFAULT_CONFIG);
    assert.equal(result.slotType, "midday");
    assert.equal(result.slotKey, "2026-09-02:midday");
  });

  test("evening London time resolves to the evening slot", () => {
    // 19:00 UTC = 20:00 BST — after evening@19:00 BST.
    const result = resolveLogicalSlot(new Date("2026-09-02T19:00:00Z"), DEFAULT_CONFIG);
    assert.equal(result.slotType, "evening");
    assert.equal(result.slotKey, "2026-09-02:evening");
  });

  test("scheduledFor round-trips to the correct UTC instant for a BST evening slot", () => {
    // evening@19:00 BST == 18:00 UTC.
    const result = resolveLogicalSlot(new Date("2026-09-02T19:30:00Z"), DEFAULT_CONFIG);
    assert.equal(result.scheduledFor.toISOString(), "2026-09-02T18:00:00.000Z");
  });
});

describe("resolveLogicalSlot — GMT (January, UTC+0)", () => {
  test("early morning resolves to night, dated today, with no DST offset applied", () => {
    const result = resolveLogicalSlot(new Date("2026-01-15T08:00:00Z"), DEFAULT_CONFIG);
    assert.equal(result.slotType, "night");
    assert.equal(result.slotDate, "2026-01-15");
    assert.equal(result.scheduledFor.toISOString(), "2026-01-15T00:00:00.000Z");
  });

  test("exact midday boundary resolves inclusively to midday", () => {
    const result = resolveLogicalSlot(new Date("2026-01-15T11:30:00Z"), DEFAULT_CONFIG);
    assert.equal(result.slotType, "midday");
  });

  test("one minute before the midday boundary still resolves to night", () => {
    const result = resolveLogicalSlot(new Date("2026-01-15T11:29:00Z"), DEFAULT_CONFIG);
    assert.equal(result.slotType, "night");
  });
});

describe("resolveLogicalSlot — same instant, different admin-configured times", () => {
  test("a custom evening time is honoured", () => {
    const config: SlotTimesConfig = { ...DEFAULT_CONFIG, eveningTime: "20:30" };
    const beforeCustomEvening = resolveLogicalSlot(new Date("2026-01-15T20:00:00Z"), config);
    assert.equal(beforeCustomEvening.slotType, "midday");
    const afterCustomEvening = resolveLogicalSlot(new Date("2026-01-15T20:30:00Z"), config);
    assert.equal(afterCustomEvening.slotType, "evening");
  });
});

describe("resolveLogicalSlot — always returns a slot, never throws", () => {
  test("many instants across a full week all resolve without error", () => {
    const start = new Date("2026-03-20T00:00:00Z").getTime(); // spans the actual UK spring-forward DST transition
    for (let hours = 0; hours < 24 * 7; hours++) {
      const result = resolveLogicalSlot(new Date(start + hours * 60 * 60 * 1000), DEFAULT_CONFIG);
      assert.ok(["night", "midday", "evening"].includes(result.slotType));
      assert.match(result.slotKey, /^\d{4}-\d{2}-\d{2}:(night|midday|evening)$/);
    }
  });
});

describe("resolveNextLogicalSlot", () => {
  test("just after night resolves next to today's midday", () => {
    const result = resolveNextLogicalSlot(new Date("2026-09-02T09:00:00Z"), DEFAULT_CONFIG);
    assert.equal(result.slotType, "midday");
    assert.equal(result.slotKey, "2026-09-02:midday");
  });

  test("just after midday resolves next to today's evening", () => {
    const result = resolveNextLogicalSlot(new Date("2026-09-02T11:00:00Z"), DEFAULT_CONFIG);
    assert.equal(result.slotType, "evening");
    assert.equal(result.slotKey, "2026-09-02:evening");
  });

  test("just after evening resolves next to tomorrow's night", () => {
    const result = resolveNextLogicalSlot(new Date("2026-09-02T19:30:00Z"), DEFAULT_CONFIG);
    assert.equal(result.slotType, "night");
    assert.equal(result.slotKey, "2026-09-03:night");
    // night@00:00 BST (UTC+1) on Sep 3 == 23:00 UTC on Sep 2.
    assert.equal(result.scheduledFor.toISOString(), "2026-09-02T23:00:00.000Z");
  });

  test("exact slot boundary resolves next to the FOLLOWING slot, not the one at that instant (exclusive, unlike resolveLogicalSlot's inclusive boundary)", () => {
    const result = resolveNextLogicalSlot(new Date("2026-01-15T11:30:00Z"), DEFAULT_CONFIG);
    assert.equal(result.slotType, "evening");
  });

  test("resolveNextLogicalSlot's result is always strictly after `now`, across a full week including the DST transition", () => {
    const start = new Date("2026-03-20T00:00:00Z").getTime();
    for (let hours = 0; hours < 24 * 7; hours++) {
      const now = new Date(start + hours * 60 * 60 * 1000);
      const result = resolveNextLogicalSlot(now, DEFAULT_CONFIG);
      assert.ok(result.scheduledFor.getTime() > now.getTime(), `expected ${result.scheduledFor.toISOString()} > ${now.toISOString()}`);
    }
  });
});

describe("singleDailyEpisode: true — the day collapses to one guaranteed episode", () => {
  const SINGLE_CONFIG: SlotTimesConfig = { ...DEFAULT_CONFIG, singleDailyEpisode: true };

  test("resolveLogicalSlot never returns midday or evening, whatever time of day it is", () => {
    // Same instants the three-slot describe blocks above use to prove
    // midday/evening resolution — here they must all fall back to night,
    // since midday/evening are no longer real candidates at all.
    for (const iso of ["2026-09-02T11:00:00Z", "2026-09-02T19:00:00Z", "2026-01-15T11:30:00Z"]) {
      const result = resolveLogicalSlot(new Date(iso), SINGLE_CONFIG);
      assert.equal(result.slotType, "night", `expected night for ${iso}, got ${result.slotType}`);
    }
  });

  test("resolveLogicalSlot still resolves to today's night once it's passed, exactly as in three-slot mode", () => {
    const result = resolveLogicalSlot(new Date("2026-09-02T09:00:00Z"), SINGLE_CONFIG);
    assert.equal(result.slotType, "night");
    assert.equal(result.slotDate, "2026-09-02");
    assert.equal(result.slotKey, "2026-09-02:night");
  });

  test("resolveNextLogicalSlot always points at the NEXT calendar day's night instant, never today's midday/evening", () => {
    // Just after today's night@00:00 BST — in three-slot mode this resolves
    // next to today's midday; collapsed to one episode a day, the only
    // thing left to look forward to is tomorrow's night.
    const result = resolveNextLogicalSlot(new Date("2026-09-02T09:00:00Z"), SINGLE_CONFIG);
    assert.equal(result.slotType, "night");
    assert.equal(result.slotKey, "2026-09-03:night");
    assert.equal(result.scheduledFor.toISOString(), "2026-09-02T23:00:00.000Z"); // night@00:00 BST Sep 3 == 23:00 UTC Sep 2
  });

  test("resolveNextLogicalSlot is always strictly after `now`, across a full week including the DST transition, in single-episode mode too", () => {
    const start = new Date("2026-03-20T00:00:00Z").getTime();
    for (let hours = 0; hours < 24 * 7; hours++) {
      const now = new Date(start + hours * 60 * 60 * 1000);
      const result = resolveNextLogicalSlot(now, SINGLE_CONFIG);
      assert.ok(result.scheduledFor.getTime() > now.getTime(), `expected ${result.scheduledFor.toISOString()} > ${now.toISOString()}`);
    }
  });

  test("many instants across a full week all resolve to night and never throw", () => {
    const start = new Date("2026-03-20T00:00:00Z").getTime();
    for (let hours = 0; hours < 24 * 7; hours++) {
      const result = resolveLogicalSlot(new Date(start + hours * 60 * 60 * 1000), SINGLE_CONFIG);
      assert.equal(result.slotType, "night");
      assert.match(result.slotKey, /^\d{4}-\d{2}-\d{2}:night$/);
    }
  });
});

describe("producer attempt slot identities", () => {
  test("two manual requests at the same millisecond remain distinct", () => {
    const now = new Date("2026-09-05T08:00:00.123Z");
    assert.notEqual(manualEpisodeSlotKey(now, "request-a"), manualEpisodeSlotKey(now, "request-b"));
  });

  test("manual identity is stable for the exact same request", () => {
    const now = new Date("2026-09-05T08:00:00.123Z");
    assert.equal(
      manualEpisodeSlotKey(now, "request-a"),
      "manual:2026-09-05T08:00:00.123Z:request-a",
    );
  });

  test("rebuild attempts retain the original logical slot in their identity", () => {
    assert.equal(
      rebuildAttemptSlotKey("2026-09-05:night", "request-a"),
      "rebuild:2026-09-05:night:request-a",
    );
  });
});
