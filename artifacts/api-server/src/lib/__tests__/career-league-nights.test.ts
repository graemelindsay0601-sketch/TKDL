import { test } from "node:test";
import assert from "node:assert/strict";
import { roundRobin, LEAGUE_LAYOUT, VAULT_LAYOUT, GROUP_SCHEDULE, groupTable, layoutFor, isGroupedStructure } from "../../career/calendar/groups.ts";
import { makeGroupRows, playingDays, leagueNight, resolvedGroups } from "../../career/calendar/group-engine.ts";
import { assessCapability } from "../../career/calendar/formats.ts";
import { catalogueFor } from "../../career/calendar/catalogue.ts";
import { generateSeason } from "../../career/calendar/generation.ts";
import { HARNESS_SEED } from "../../career/world/harness.ts";
import type { InstanceRow, MatchRow } from "../../career/calendar/engine.ts";

/** Event database v11: Thursday Night Darts as a real weekly league (Premier League shape). */
const tnd = (v: number) => catalogueFor(v).find(d => d.key === "thursday-night-darts")!;

test("double round robin: 14 rounds, every pair meets twice with sides swapped; Vault's schedule is unchanged", () => {
  const rounds = roundRobin(8, true);
  assert.equal(rounds.length, 14);
  for (const r of rounds) assert.equal(new Set(r.flat()).size, 8, "everyone plays once a night");
  const meetings = new Map<string, number>();
  for (const [a, b] of rounds.flat()) { const k = [a, b].sort().join("-"); meetings.set(k, (meetings.get(k) ?? 0) + 1); }
  assert.equal(meetings.size, 28); assert.ok([...meetings.values()].every(n => n === 2));
  assert.deepEqual(VAULT_LAYOUT.schedule, GROUP_SCHEDULE);
  assert.equal(LEAGUE_LAYOUT.fixtures, 59);
});

test("league nights are executable only where the definition opts in (v11); older saves keep the benched league", () => {
  assert.equal(assessCapability(tnd(10).format, true).executable, false);
  assert.equal(assessCapability(tnd(11).format, true).executable, true);
  assert.ok(isGroupedStructure("LEAGUE") && layoutFor("LEAGUE") === LEAGUE_LAYOUT && layoutFor("GROUP_KNOCKOUT") === VAULT_LAYOUT);
  const instance = generateSeason(HARNESS_SEED, 11, 1).find(d => d.definitionKey === "thursday-night-darts")!;
  assert.ok(instance.executable);
  assert.equal((instance.endDay - instance.startDay) / 7 + 1, 16, "sixteen Thursdays: fourteen league nights, play-off night last");
});

test("a league books and clashes only on its weekly nights; fixtures fall on those nights and the play-offs on the last", () => {
  const event = { id: "00000000-0000-4000-8000-000000000001", start_day: 39, end_day: 144, snapshot: { format: tnd(11).format } } as unknown as InstanceRow;
  const nights = playingDays(event);
  assert.equal(nights.length, 16); assert.ok(nights.every(d => (d - 39) % 7 === 0));
  assert.equal(playingDays({ ...event, snapshot: { format: { ...tnd(11).format, structure: "KNOCKOUT" } } } as unknown as InstanceRow).length, 106, "other events book every day");
  const keys = Array.from({ length: 8 }, (_, i) => `p${i}`);
  const rows = makeGroupRows({ world_seed: HARNESS_SEED } as never, event, keys, LEAGUE_LAYOUT);
  assert.equal(rows.length, 56);
  assert.deepEqual([...new Set(rows.map(r => r.scheduled_day))], Array.from({ length: 14 }, (_, i) => leagueNight(event, i + 1)));
});

test("the league table ranks all eight; the top four go to semi-finals 1st v 4th and 2nd v 3rd", () => {
  const event = { id: "00000000-0000-4000-8000-000000000002", start_day: 39, end_day: 144, snapshot: { format: tnd(11).format } } as unknown as InstanceRow;
  const keys = Array.from({ length: 8 }, (_, i) => `p${i}`);
  // Lower seat number always wins 6-2: p0 wins all fourteen, p7 none.
  const matches = makeGroupRows({ world_seed: HARNESS_SEED } as never, event, keys, LEAGUE_LAYOUT).map(r => {
    const winA = Number(String(r.a_key).slice(1)) < Number(String(r.b_key).slice(1));
    return { ...r, status: "COMPLETED", winner_key: winA ? r.a_key : r.b_key, legs_a: winA ? 6 : 2, legs_b: winA ? 2 : 6 } as unknown as MatchRow;
  });
  const sfs = [1, 2].map(slot => ({ stage_key: "knockout", round: 1, slot, a_key: null, b_key: null, status: "PENDING" }) as unknown as MatchRow);
  const table = groupTable(matches, "L", new Set(), LEAGUE_LAYOUT);
  assert.deepEqual(table.buckets.map(b => b.map(p => p.key)), keys.map(k => [k]));
  assert.equal(table.buckets[0][0].wins, 14);
  const [league] = resolvedGroups([...matches, ...sfs], [], new Set(), LEAGUE_LAYOUT);
  assert.deepEqual(league.qualifiers, ["p0", "p1", "p2", "p3"]);
});
