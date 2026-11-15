import { test } from "node:test";
import assert from "node:assert/strict";
import { WORLD_CUP_LAYOUT, groupTable } from "../../career/calendar/groups.ts";
import { makeGroupRows, resolvedGroups } from "../../career/calendar/group-engine.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import type { InstanceRow, MatchRow } from "../../career/calendar/engine.ts";

/** Regression: a group tied at the top (settled by bull-off) must still give the drawn knockout exactly one winner. */
test("World Cup: once the knockout is drawn, each group's qualifier is the player the draw holds, even after a tie", () => {
  const event = { id: "00000000-0000-4000-8000-0000000000c1", start_day: 200, end_day: 206, snapshot: { format: { structure: "WORLD_CUP", stages: [{ bestOfByRound: [7] }], firstThrowMethod: "BULL" } } } as unknown as InstanceRow;
  const keys = Array.from({ length: 36 }, (_, i) => `p${i}`);
  const rows = makeGroupRows({ world_seed: HARNESS_SEED } as never, event, keys, WORLD_CUP_LAYOUT);
  const tiedGroup = "A";
  const tied = [...new Set(rows.filter(r => r.stage_key === rows[0].stage_key).flatMap(r => [r.a_key!, r.b_key!]))].sort();
  // Every game 4-2. In the tied group it's rock-paper-scissors: identical records and leg difference. Elsewhere lower seat wins.
  const beats = (a: string, b: string) => tied.includes(a)
    ? (tied.indexOf(a) + 1) % 3 === tied.indexOf(b)
    : Number(a.slice(1)) < Number(b.slice(1));
  const matches = rows.map(r => { const winA = beats(r.a_key!, r.b_key!);
    return { ...r, status: "COMPLETED", winner_key: winA ? r.a_key : r.b_key, legs_a: winA ? 4 : 2, legs_b: winA ? 2 : 4 } as unknown as MatchRow; });
  assert.equal(groupTable(matches, tiedGroup, new Set(), WORLD_CUP_LAYOUT).buckets[0].length, 3, "the test group really is a three-way tie");
  // The bull-off went to the tied group's third player; the draw already holds them with the other eleven winners and four seeds.
  const winners = WORLD_CUP_LAYOUT.keys.map(g => g === tiedGroup ? tied[2]
    : groupTable(matches, g, new Set(), WORLD_CUP_LAYOUT).buckets[0][0].key);
  const seeds = ["s0", "s1", "s2", "s3"];
  const firstRound = Array.from({ length: 8 }, (_, i) => ({ stage_key: "knockout", round: 1, slot: i + 1,
    a_key: i < 4 ? seeds[i] : winners[i * 2 - 8 + 4], b_key: i < 4 ? winners[i] : winners[i * 2 - 8 + 5], status: "PENDING" }) as unknown as MatchRow);
  assert.equal(new Set(firstRound.flatMap(m => [m.a_key, m.b_key])).size, 16);
  const groups = resolvedGroups([...matches, ...firstRound], [], new Set(), WORLD_CUP_LAYOUT);
  assert.ok(groups.every(g => g.qualifiers.length === 1), "one winner per group");
  assert.deepEqual(groups.flatMap(g => g.qualifiers).sort(), [...winners].sort());
  assert.deepEqual(groups[WORLD_CUP_LAYOUT.keys.indexOf(tiedGroup)].qualifiers, [tied[2]]);
});
