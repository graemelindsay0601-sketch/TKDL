import { test } from "node:test";
import assert from "node:assert/strict";
import { calibratedNpc, HARNESS_SEED } from "../../career/world/harness.ts";
import { generateInitialWorld } from "../../career/world/generation.ts";
import { simulateNpcMatch } from "../../career/world/simulation.ts";
import { starterFor } from "../../shared/darts-rules/x01.ts";
import type { Npc, MatchContext } from "../../career/world/types.ts";

/** A6.5: A2 NPC simulation for set play and double-in, using the same conventions as the live scorer. */
const seed = HARNESS_SEED;
const world = generateInitialWorld(seed, 1);
const context: MatchContext = { category: "major", roundImportance: 0.5, elimination: true };
const players: [Npc, Npc] = [calibratedNpc(world[0], 66), calibratedNpc(world[1], 60)];
const base = { players, context, seed, generationVersion: 1, difficulty: "STANDARD" as const };

test("set play is modelled with real set boundaries: best of 5 sets, best of 5 legs per set", () => {
  for (let i = 0; i < 40; i++) {
    const r = simulateNpcMatch({ ...base, matchKey: `sets:${i}`, format: { bestOf: 5, firstThrow: (i % 2) as 0 | 1, unit: "SETS", legsPerSet: 5 } });
    const sets = [r.stats[0].setsWon!, r.stats[1].setsWon!];
    assert.equal(Math.max(...sets), 3, "first to 3 sets"); assert.ok(Math.min(...sets) < 3);
    assert.equal(r.winnerId, players[sets[0] === 3 ? 0 : 1].id);
    // Replay set boundaries from the leg log: each set ends when someone reaches 3 legs.
    let legsInSet = [0, 0], setNo = 1, legInSet = 1;
    const recount = [0, 0];
    for (const leg of r.legs) {
      assert.equal(leg.set, setNo);
      const expected = starterFor({ unit: "SETS" } as never, (i % 2) as 0 | 1, setNo, legInSet).legStarter;
      assert.equal(leg.firstThrow, expected, `starter set ${setNo} leg ${legInSet}`);
      legsInSet[leg.winner]++;
      if (legsInSet[leg.winner] === 3) { recount[leg.winner]++; setNo++; legInSet = 1; legsInSet = [0, 0]; } else legInSet++;
    }
    assert.deepEqual(recount, sets);
    assert.equal(r.stats[0].legsWon + r.stats[1].legsWon, r.legs.length);
  }
});

test("double-in: NPCs must open with a double; it costs darts and lowers the 3-dart average versus straight-in", () => {
  let si = 0, di = 0, diOpen = 0, siDarts = 0, diDarts = 0;
  for (let i = 0; i < 60; i++) {
    const a = simulateNpcMatch({ ...base, matchKey: `si:${i}`, format: { bestOf: 7, firstThrow: 0 } });
    const b = simulateNpcMatch({ ...base, matchKey: `di:${i}`, format: { bestOf: 7, firstThrow: 0, inRule: "DOUBLE" } });
    si += a.stats[0].points; siDarts += a.stats[0].darts;
    di += b.stats[0].points; diDarts += b.stats[0].darts;
    diOpen += b.stats[0].openingAttempts ?? 0;
    assert.equal(a.stats[0].openingAttempts, undefined);
    for (const leg of b.legs) assert.ok(leg.points[leg.winner] === 501, "a won leg still scores exactly 501");
  }
  assert.ok(diOpen > 60, "opening attempts are recorded");
  assert.ok(di / diDarts < si / siDarts, `double-in avg ${(di / diDarts * 3).toFixed(1)} < straight-in ${(si / siDarts * 3).toFixed(1)}`);
});

test("legacy 501 straight-in legs format is unchanged by the optional A6.5 fields", () => {
  const a = simulateNpcMatch({ ...base, matchKey: "legacy", format: { bestOf: 9, firstThrow: 1 } });
  const b = simulateNpcMatch({ ...base, matchKey: "legacy", format: { bestOf: 9, firstThrow: 1 } });
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(a.format).sort(), ["bestOf", "firstThrow"]);
  assert.throws(() => simulateNpcMatch({ ...base, matchKey: "bad", format: { bestOf: 5, firstThrow: 0, unit: "SETS" } }), /legsPerSet/);
});
