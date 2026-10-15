import { test } from "node:test";
import assert from "node:assert/strict";
import { CLUB, leagueSeason, memberPoints, clubName, type ClubLocality, type ClubResult } from "../../career/club/model.ts";

const clubs: ClubLocality[] = Array.from({ length: 12 }, (_, i) => ({ key: `area-${String(i).padStart(2, "0")}`, country: "GBR", city: `Town ${i}`, region: `Region ${i}`, weight: 12 - i }));
const win = (season: number, participantKey: string, locality: string, position = 1): ClubResult => ({ season, participantKey, locality, position });

test("club points come from members' local finishes; the captain is last season's top scorer", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 8, 9].map(CLUB.points), [5, 3, 2, 2, 1, 1, 0]);
  const points = memberPoints([win(1, "npc-a", "area-00"), win(1, "npc-a", "area-00", 2), win(1, "HUMAN", "area-00", 4), win(2, "npc-b", "area-00")], 1);
  assert.deepEqual([...points].map(([k, v]) => [k, v.points]), [["npc-a", 8], ["HUMAN", 2]]);
  const s2 = leagueSeason("GBR", clubs, [win(1, "HUMAN", "area-00"), win(1, "npc-a", "area-00", 2)], 2, null);
  assert.equal(s2.find(c => c.localityKey === "area-00")?.captainKey, "HUMAN", "you scored most last season");
  assert.equal(clubName(clubs[0]), "Town 0 Darts Club");
});

test("divisions of eight: seeded by area size, then the top two go up and the bottom two go down", () => {
  const s1 = leagueSeason("GBR", clubs, [], 1, null);
  assert.deepEqual([...new Set(s1.map(c => c.division))], [1, 2]);
  assert.equal(s1.filter(c => c.division === 1).length, CLUB.divisionSize);
  assert.ok(s1.filter(c => c.division === 1).every(c => Number(c.localityKey.slice(-2)) < 8), "the biggest areas start in division one");
  // Season 1: division two's area-10 and area-11 dominate; division one's area-00 is bottom with nothing.
  const results = [win(1, "x", "area-10"), win(1, "y", "area-11", 2), ...clubs.slice(1, 8).map((c, i) => win(1, `d1-${i}`, c.key, 3))];
  const table1 = leagueSeason("GBR", clubs, results, 1, null);
  const s2 = leagueSeason("GBR", clubs, [], 2, table1);
  const division = (key: string) => s2.find(c => c.localityKey === key)!.division;
  assert.deepEqual([division("area-10"), division("area-11")], [1, 1], "promoted");
  const relegated = table1.filter(c => c.division === 1).sort((a, b) => b.position - a.position).slice(0, 2).map(c => c.localityKey);
  assert.ok(relegated.every(k => division(k) === 2), "relegated");
  assert.deepEqual(leagueSeason("GBR", clubs, results, 1, null), table1, "deterministic");
});
