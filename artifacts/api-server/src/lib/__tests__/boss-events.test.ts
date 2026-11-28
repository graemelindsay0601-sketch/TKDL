import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyBoss, weeklyBoss, TWISTS, raidFor, raidHealth, leagueMatchDamage, validCustomCurses, parseCurseRef, bossHealth, BOSS_ROSTER } from "../../shared/darts-rules/index.ts";

test("daily and weekly bosses are the same for everyone on a day, and the twist fits the game", () => {
  assert.deepEqual(dailyBoss("2026-11-28"), dailyBoss("2026-11-28"));
  const seen = new Set<string>();
  for (let d = 1; d <= 28; d++) {
    const e = dailyBoss(`2026-11-${String(d).padStart(2, "0")}`);
    seen.add(e.bossId);
    const mode = BOSS_ROSTER.find(b => b.id === e.bossId)!.mode;
    assert.ok(TWISTS.find(t => t.id === e.twist)!.modes.includes(mode), `${e.bossId} ${e.twist}`);
  }
  assert.ok(seen.size >= 8, "a good spread of bosses over a month");
  const w = weeklyBoss("2026-11-23");
  assert.ok(["arena", "void"].includes(BOSS_ROSTER.find(b => b.id === w.bossId)!.world));
});

test("raid: a boss per month, health scales with the league, damage adds up", () => {
  assert.equal(raidFor("2026-11").name, "The Fog");
  assert.equal(raidHealth(5), 30000);
  assert.equal(raidHealth(31), 62000);
  assert.equal(leagueMatchDamage(true, 2), 400 + 150 + 200);
});

test("be the boss: three 501 curses from bosses you've beaten", () => {
  const beaten = new Set(["rookie-wall", "old-jinx", "the-warden"]);
  assert.equal(validCustomCurses(["rookie-wall:1", "old-jinx:2", "old-jinx:3"], beaten), null);
  assert.match(validCustomCurses(["rookie-wall:1"], beaten)!, /three/);
  assert.match(validCustomCurses(["rookie-wall:1", "old-jinx:2", "the-warden:1"], beaten)!, /501/);
  assert.match(validCustomCurses(["rookie-wall:1", "old-jinx:2", "lockdown:1"], beaten)!, /beaten/);
  assert.equal(parseCurseRef("nope:1"), null);
});

test("sudden death: one leg is the whole health bar", () => {
  assert.equal(bossHealth({ mode: "X01", start: 501, mine: 0, legsWon: 0, legsToWin: 1 }), 0);
});
