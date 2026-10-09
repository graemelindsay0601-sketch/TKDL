import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createShadowObservations } from "../../db/migrations/create_shadow_observations_sb21a.ts";
import { careerSnapshot } from "../../shadow/career-live-adapter.ts";
import { ingestSnapshot } from "../../shadow/ingestion-service.ts";
import { validateSnapshot } from "../../shadow/observation-validation.ts";

const pg = new PGlite(), db = drizzle(pg);
const q = async (query: ReturnType<typeof sql>) => (await db.execute(query)).rows as any[];
const hit = (segment: number, multiplier = 1) => ({ segment, multiplier, value: segment * multiplier });
const row = (darts: unknown[] = [hit(20), hit(20), hit(20), hit(19)]) => ({
  id: randomUUID(), career_save_id: randomUUID(), match_id: randomUUID(), player_id: 7, session_version: 1,
  status: "IN_PLAY", first_thrower: 0, first_throw_method: "BULL_UP", bull_first_order: 0, bull_throws: ["INNER", "MISS"],
  opponent_key: "npc-one", revision: 1, format: { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: 3 },
  darts, created_at: new Date("2026-10-08T12:00:00Z"), completed_at: null,
});
before(async () => { await pg.exec("CREATE TABLE players(id INTEGER PRIMARY KEY); INSERT INTO players VALUES(7),(8)"); });
after(async () => { await pg.close(); });

test("migration fresh and repeat apply preserve existing rows and enforce uniqueness/eligibility", async () => {
  await createShadowObservations(db);
  const s = careerSnapshot(row());
  const result = await db.transaction(tx => ingestSnapshot(tx, s));
  const before = await q(sql`SELECT * FROM shadow_observations ORDER BY id`);
  await createShadowObservations(db); await createShadowObservations(db);
  assert.deepEqual(await q(sql`SELECT * FROM shadow_observations ORDER BY id`), before);
  await assert.rejects(db.execute(sql`INSERT INTO shadow_activities(id,source_namespace,source_id) VALUES(${randomUUID()},${s.namespace},${s.sourceId})`));
  await assert.rejects(db.execute(sql`UPDATE shadow_observations SET training_eligible=true,exclusion_reason=NULL WHERE activity_id=${result.activityId} AND provenance='NPC'`));
  await assert.rejects(db.execute(sql`INSERT INTO shadow_observations
    SELECT ${randomUUID()}::uuid,activity_id,source_revision,participant_key,player_id,player_slot,source_ordinal,unit,provenance,data_quality,training_eligible,exclusion_reason,payload_hash,evidence,received_at
    FROM shadow_observations WHERE activity_id=${result.activityId} LIMIT 1`),"database rejects duplicate event even with a different observation ID");
  assert.equal((await q(sql`SELECT count(*)::int n FROM players`))[0].n, 2);
});

test("Career human attribution, NPC exclusion, order, physical hits, quality and unknown aim", async () => {
  const source = row(); const original = structuredClone(source);
  const s = careerSnapshot(source); const result = await db.transaction(tx => ingestSnapshot(tx, s));
  const observations = await q(sql`SELECT * FROM shadow_observations WHERE activity_id=${result.activityId} ORDER BY source_ordinal`);
  assert.equal(observations.length, 4);
  assert.deepEqual(observations.map(o=>o.source_ordinal), [0,1,2,3]);
  assert.deepEqual(observations.map(o=>o.player_id), [7,7,7,null]);
  assert.deepEqual(observations.map(o=>o.provenance), ['HUMAN','HUMAN','HUMAN','NPC']);
  assert.deepEqual(observations.map(o=>o.training_eligible), [true,true,true,false]);
  assert.equal(observations[3].exclusion_reason,'NPC');
  assert.deepEqual(observations.map(o=>o.evidence.physicalHit),source.darts);
  assert.ok(observations.every(o=>o.data_quality===4 && o.evidence.intendedTarget===null && o.evidence.effectiveValue===null));
  assert.deepEqual(source,original,"projection cannot mutate authoritative source");
  const again = await db.transaction(tx => ingestSnapshot(tx, structuredClone(s)));
  assert.deepEqual(again,{activityId:result.activityId,duplicate:true});
  assert.deepEqual(await q(sql`SELECT * FROM shadow_observations WHERE activity_id=${result.activityId} ORDER BY source_ordinal`),observations);
  assert.equal((await q(sql`SELECT count(*)::int n FROM shadow_activity_revisions WHERE activity_id=${result.activityId}`))[0].n,1);
});

test("Career normalization is source-specific; generic human seat 1 is eligible", async () => {
  const s=careerSnapshot(row([hit(20)])); s.namespace='TEST_SOURCE';
  s.participants[0].slot=1;s.participants[1].slot=0;
  const a=await db.transaction(tx=>ingestSnapshot(tx,s));
  const [o]=await q(sql`SELECT * FROM shadow_observations WHERE activity_id=${a.activityId}`);
  assert.equal(o.player_slot,1);assert.equal(o.player_id,7);assert.equal(o.training_eligible,true);
  const npcFirst=careerSnapshot({...row([hit(20)]),first_thrower:1});
  assert.equal(npcFirst.observations[0].participantKey,'npc:npc-one');
});

test("revisions retract undone darts, retain audit history and stable surviving IDs; stale/conflicting retries reject",async()=>{
  const source=row();const s=careerSnapshot(source);const a=await db.transaction(tx=>ingestSnapshot(tx,s));
  const old=await q(sql`SELECT * FROM shadow_observations WHERE activity_id=${a.activityId} ORDER BY source_ordinal`);
  const revised=careerSnapshot({...source,revision:2,darts:[hit(18),hit(20)]});
  await db.transaction(tx=>ingestSnapshot(tx,revised));
  const active=await q(sql`SELECT * FROM shadow_observations WHERE activity_id=${a.activityId} ORDER BY source_ordinal`);
  assert.equal(active.length,2);assert.equal(active[0].id,old[0].id);assert.equal(active[1].id,old[1].id);
  assert.equal(active[0].evidence.physicalHit.segment,18);assert.ok(active.every(o=>o.source_revision===2));
  const revisions=await q(sql`SELECT * FROM shadow_activity_revisions WHERE activity_id=${a.activityId} ORDER BY source_revision`);
  assert.equal(revisions.length,2);assert.equal(revisions[0].snapshot.upserts.length,4);
  assert.equal(revisions[1].snapshot.upserts.length,2);assert.equal(revisions[1].snapshot.retractions.length,2);
  const reconstructed=new Map<string,unknown>();
  for(const rev of revisions){
    for(const o of rev.snapshot.upserts)reconstructed.set(JSON.stringify([o.participantKey,o.ordinal]),o);
    for(const o of rev.snapshot.retractions)reconstructed.delete(JSON.stringify([o.participantKey,o.ordinal]));
  }
  assert.deepEqual([...reconstructed.values()],active.map(o=>o.evidence),"audit deltas reconstruct current evidence without counting superseded versions");
  await assert.rejects(db.transaction(tx=>ingestSnapshot(tx,s)),/Stale/);
  await assert.rejects(db.transaction(tx=>ingestSnapshot(tx,{...revised,status:'SUPERSEDED'})),/Conflicting/);
  await db.transaction(tx=>ingestSnapshot(tx,{...revised,sourceRevision:3,observations:[]}));
  assert.equal((await q(sql`SELECT count(*)::int n FROM shadow_observations WHERE activity_id=${a.activityId}`))[0].n,0);
});

test("malformed, unsupported, unverified and generated observations cannot masquerade as human evidence",async()=>{
  assert.throws(()=>careerSnapshot(row([{segment:20,multiplier:3,value:61}])));
  assert.throws(()=>careerSnapshot({...row(),session_version:99}));
  assert.throws(()=>careerSnapshot({...row(),first_thrower:null}));
  assert.throws(()=>careerSnapshot({...row(),status:'COMPLETED'}));
  const source=careerSnapshot(row([hit(20)]));
  assert.throws(()=>validateSnapshot({...source,observations:[{...source.observations[0],quality:5}]}),/aim/);
  assert.throws(()=>validateSnapshot({...source,observations:[{...source.observations[0],preState:null}]}),/Context/);
  assert.throws(()=>validateSnapshot({...source,observations:[source.observations[0],source.observations[0]]}),/duplicate/);
  for(const provenance of ['BOT','NPC','SIMULATION','REPLAY_GENERATED','UNKNOWN'] as const){
    const s=structuredClone(source);s.sourceId=randomUUID();s.participants[0].provenance=provenance;
    const a=await db.transaction(tx=>ingestSnapshot(tx,s));
    const [o]=await q(sql`SELECT * FROM shadow_observations WHERE activity_id=${a.activityId}`);
    assert.equal(o.training_eligible,false);assert.ok(o.exclusion_reason);
  }
  for(const change of [{gameFamily:'CRICKET'},{verification:'UNVERIFIED'},{status:'SUPERSEDED'}]){
    const a=await db.transaction(tx=>ingestSnapshot(tx,{...source,...change,sourceId:randomUUID()}));
    assert.equal((await q(sql`SELECT * FROM shadow_observations WHERE activity_id=${a.activityId}`))[0].training_eligible,false);
  }
});

test("physical hit remains distinct from double-in scoring; source updates roll back with projection",async()=>{
  const source=row([hit(20),hit(20,2)]);source.format.inRule='DOUBLE';
  const s=careerSnapshot(source);
  assert.equal(s.observations[0].physicalHit?.value,20);
  assert.deepEqual(s.observations[0].preState?.scores,s.observations[0].postState?.scores);
  await assert.rejects(db.transaction(async tx=>{await ingestSnapshot(tx,s);throw new Error('rollback');}),/rollback/);
  assert.equal((await q(sql`SELECT count(*)::int n FROM shadow_activities WHERE source_id=${s.sourceId}`))[0].n,0);
});

test("VISIT/RESULT contract keeps aggregate evidence separate; no fabricated darts",async()=>{
  for(const [unit,quality] of [['VISIT',2],['RESULT',1]] as const){
    const s=careerSnapshot(row([hit(20)]));s.sourceId=randomUUID();
    s.observations=[{...s.observations[0],unit,quality,physicalHit:null}];
    const a=await db.transaction(tx=>ingestSnapshot(tx,s));
    const [o]=await q(sql`SELECT * FROM shadow_observations WHERE activity_id=${a.activityId}`);
    assert.equal(o.unit,unit);assert.equal(o.training_eligible,false);assert.equal(o.evidence.physicalHit,null);
  }
});

test("new pipeline has no HTTP router; production wiring stays at committed Career boundary",async()=>{
  const service=await readFile(new URL('../../career/live/service.ts',import.meta.url),'utf8');
  assert.ok(service.indexOf('await ingestCareerLive(tx, root.id, updated.id)')>service.indexOf('if (!updated) throw'));
  const routes=await readFile(new URL('../../routes/index.ts',import.meta.url),'utf8');
  assert.doesNotMatch(routes,/shadow\/(?:ingestion|career-live-adapter|observation)/);
  const startup=await readFile(new URL('../../app.ts',import.meta.url),'utf8');
  assert.match(startup,/runMigrationStep\(SHADOW_OBSERVATIONS_SB21A/);
});

test("removing a Shadow projection never deletes the participant account",async()=>{
  const a=await db.transaction(tx=>ingestSnapshot(tx,careerSnapshot(row())));
  await db.execute(sql`DELETE FROM shadow_activities WHERE id=${a.activityId}`);
  assert.equal((await q(sql`SELECT count(*)::int n FROM shadow_observations WHERE activity_id=${a.activityId}`))[0].n,0);
  assert.equal((await q(sql`SELECT count(*)::int n FROM players WHERE id=7`))[0].n,1);
});
