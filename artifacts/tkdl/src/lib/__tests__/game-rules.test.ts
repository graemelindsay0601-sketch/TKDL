import test from "node:test";
import assert from "node:assert/strict";
import { buildFallbackGameRules } from "../game-rules.ts";

test("builds complete X01 instructions from the real scorer config", () => {
  const rules=buildFallbackGameRules({name:"701",engine:"X01",description:"Long X01 format.",config:JSON.stringify({startingScore:701,doubleOut:true,legs:3})});
  assert.match(rules,/starts on 701/i);
  assert.match(rules,/best of 3 legs/i);
  assert.match(rules,/winning dart must be a double/i);
});

test("every scoring engine gets structured instructions instead of an empty fallback", () => {
  for(const engine of ["Cricket","TeamCricket","Sequence","HalveIt","CountUp","Killer","MultiKiller","Gotcha","NearestBull","HighLow","NinetyNine","DeadCentre","ShootingGallery","JDCChallenge41","ExponentialBundle","TeamX01","Custom"]){
    const rules=buildFallbackGameRules({name:`${engine} game`,engine,description:"Complete the stated challenge."});
    assert.match(rules,/OBJECTIVE:/);
    assert.match(rules,/HOW TO PLAY:/);
    assert.match(rules,/WINNING:/);
    assert.ok(rules.length>180,`${engine} should have useful detail`);
  }
});

test("an admin-created format with no description still receives playable guidance", () => {
  const rules=buildFallbackGameRules({name:"Custom House Game",engine:"Custom"});
  assert.match(rules,/on-screen scorer/i);
  assert.doesNotMatch(rules,/No detailed rules available/i);
});
