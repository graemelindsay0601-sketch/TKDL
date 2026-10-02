import test from "node:test";
import assert from "node:assert/strict";
import { simulateStanding } from "../standings-what-if.ts";

test("projects a wager and reorders the table", () => {
  const result = simulateStanding([{id:1,name:"A",points:90},{id:2,name:"B",points:100},{id:3,name:"C",points:95}], 1, 2, 10)!;
  assert.deepEqual(result.rows.map(row=>[row.name,row.points]), [["A",100],["C",95],["B",90]]);
  assert.equal(result.winnerRank, 1);
});

test("rejects an unaffordable wager", () => {
  assert.equal(simulateStanding([{id:1,name:"A",points:10},{id:2,name:"B",points:5}],1,2,6), null);
});
