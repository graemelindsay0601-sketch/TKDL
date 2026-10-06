/** Native test-only Classic seed regression. Never imports a real application DB. */
import {test,mock} from "node:test";
import assert from "node:assert/strict";
import {sql} from "drizzle-orm";
import {PGlite,drizzle} from "./career-cert-postgres-fixture.mjs";

test("Classic: actual idempotent seed retains 61 tours, five bot difficulties and 305 trophy definitions",async()=>{
  const pg=new PGlite(),db=drizzle(pg);
  const mocked=mock.module("@workspace/db",{namedExports:{db}});
  try{
    const {seedTourSystem,getPersonaPool}=await import("../src/lib/tourSeed.ts");
    await seedTourSystem();
    const q=async query=>(await db.execute(query)).rows;
    const tours=await q(sql`SELECT * FROM tour_definitions ORDER BY sort_order`);
    assert.equal(tours.length,61);
    const difficulties=["amateur","club","county","pro","elite"];
    for(const d of difficulties)assert.ok(getPersonaPool(d).length>0,`${d} has actual bot personas`);
    const trophies=await q(sql`SELECT * FROM tour_achievement_definitions WHERE category='trophy'`);
    assert.equal(trophies.length,305);
    let combinations=0;
    for(const tour of tours){
      assert.ok(tour.bracket_size>=2&&Number.isInteger(tour.bracket_size));
      assert.ok(tour.legs_per_match>=1&&tour.legs_per_match%2===1);
      assert.ok(tour.game_type_key&&tour.format);
      if(tour.format==="sets"){assert.ok(tour.sets_per_match%2===1);assert.ok(tour.legs_per_set%2===1);}
      for(const d of difficulties){
        const matches=trophies.filter(t=>t.key===`tour_win_${tour.slug}_${d}`);
        assert.equal(matches.length,1);assert.ok(matches[0].gamerscore>0);combinations++;
      }
    }
    assert.equal(combinations,305);
    const before=await q(sql`SELECT * FROM tour_definitions ORDER BY id`);
    await seedTourSystem();
    assert.deepEqual(await q(sql`SELECT * FROM tour_definitions ORDER BY id`),before);
    assert.equal((await q(sql`SELECT count(*)::int n FROM tour_achievement_definitions WHERE category='trophy'`))[0].n,305);
    console.info("CLASSIC_EVIDENCE",JSON.stringify({tours:61,difficulties:5,trophyDefinitions:305,combinations}));
  }finally{mocked.restore();await pg.close();}
});
