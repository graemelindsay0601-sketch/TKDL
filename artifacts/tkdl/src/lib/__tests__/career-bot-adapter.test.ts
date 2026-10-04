import { test } from "node:test";
import assert from "node:assert/strict";
import type { BotConfig } from "../bot-engine.ts";
import { toCareerBotConfig } from "../../../../api-server/src/career/world/bot-adapter.ts";

test("Career adapter is assignable to the existing GameScorer BotConfig without changing the shared engine", () => {
  const bot: BotConfig = toCareerBotConfig({ npcId: "fixture", dayDeviation: 0, pressureIntensity: 0.2, visitSd: 5,
    expectedAverage: 60, expectedCheckout: 0.3,
    effective: { scoring: 60, finishing: 55, consistency: 70, pressure: 65, powerScoring: 60, clutch: 55 } });
  assert.ok(bot.avg > 0 && bot.sd > 0 && bot.checkoutPct > 0 && bot.checkoutPct < 1 && bot.hitAcc < 1);
  assert.equal(bot.shadowProfile, undefined);
});
