import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlayerIds, pickFromRoster, picksByTeam, buildEntries } from "../team-match-players.ts";

test("parsePlayerIds: missing field means 'not sent'", () => {
  assert.equal(parsePlayerIds(undefined), null);
  assert.deepEqual(parsePlayerIds([3, "7", 3, -1, "x"]), [3, 7]);
});

test("pickFromRoster keeps only real team members", () => {
  assert.deepEqual(pickFromRoster([3, 7], [3, 15], "Scott & Richard"), { ids: [3] });
  assert.ok(pickFromRoster([7], [3, 15], "Scott & Richard").error);
  assert.deepEqual(pickFromRoster(null, [3, 15], "x"), { ids: null });
});

test("buildEntries rejects a side with nobody valid picked", () => {
  const fail = (m: string): never => { throw new Error(m); };
  const sent = picksByTeam([{ teamId: 5, playerIds: [3] }, { teamId: 2, playerIds: [99] }]);
  assert.throws(() => buildEntries([
    { teamId: 5, teamName: "A", roster: [3, 15], sent: sent.get(5) ?? null, won: true },
    { teamId: 2, teamName: "B", roster: [7, 9], sent: sent.get(2) ?? null, won: false },
  ], fail), /B/);
});
