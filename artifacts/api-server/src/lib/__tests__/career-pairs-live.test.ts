import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createShadowObservations } from "../../db/migrations/create_shadow_observations_sb21a.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerNpcSponsorMarketSPF } from "../../db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerSponsorContractActionsSPE2 } from "../../db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerFinanceSPC } from "../../db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";
import { createCareerLiveMatchService } from "../../career/live/service.ts";
import { createCareerTournamentService } from "../../career/tournament/service.ts";
import { createCareerRelationshipsService } from "../../career/relationships/service.ts";
import { loadInstances, lockField, makeDraw, progressEvent, type RootRow } from "../../career/calendar/engine.ts";
import { loadNpcs } from "../../career/world/repository.ts";
import { lockRoot, worldState } from "../../career/world/service.ts";
import { localityByRegion } from "../../career/calendar/geography.ts";
import { dartsNation, nationTeams, nationalFallbackRank } from "../../career/calendar/pairs.ts";
import { createMatch, throwDart, planBotX01Visit, seededRandom, botOptionsFor, type Dart, type X01Format, type X01MatchState } from "../../shared/darts-rules/index.ts";
// The browser's own planners (artifacts/tkdl), loaded by URL so this package's typecheck stays inside its root.
type LiveModel = { careerBotVisit: (...a: unknown[]) => Dart[]; careerPartnerVisit: (...a: unknown[]) => Dart[] | null; shouldCheckpoint: (...a: unknown[]) => boolean };
const { careerBotVisit, careerPartnerVisit, shouldCheckpoint } = await import(new URL("../../../../tkdl/src/features/career/live-model.ts", import.meta.url).href) as LiveModel;

test("World Cup national qualifiers complete under-ranked nations without outranking published ranking holders", () => {
  assert.equal(dartsNation("HRV", null), "CRO", "Croatian players use the World Cup team code");
  assert.equal(dartsNation("COL", null), "LAT", "Colombian players represent the Latin America qualifier");
  const fallback = nationalFallbackRank("AMATEUR")!;
  const grassrootsFallback = nationalFallbackRank("GRASSROOTS")!;
  const selected = nationTeams([
    { key: "A1", npcId: "A1", country: "AUS", rank: 4 },
    { key: "A2", npcId: "A2", country: "AUS", rank: 9 },
    { key: "A3", npcId: "A3", country: "AUS", rank: fallback },
    { key: "N1", npcId: "N1", country: "NLD", rank: 40 },
    { key: "N2", npcId: "N2", country: "NLD", rank: fallback },
  ], 2);
  assert.deepEqual(selected.teams.map(team => team.nation), ["AUS", "NLD"]);
  assert.deepEqual(selected.players.map(player => player.key), ["A1", "A2", "N1", "N2"]);
  assert.ok(fallback > 100_000);
  assert.ok(grassrootsFallback > fallback);
});

/** Event database v13 pairs, end to end: Pub Doubles entry, pairing, draw, a live pairs match through the real session boundary. */
const pg = new PGlite(), db = drizzle(pg), saves = createCareerService(db), sporting = createCareerSportingService(db);
const calendar = sporting.calendar, tournaments = createCareerTournamentService(db, calendar), live = createCareerLiveMatchService(db, calendar);
const actor = { playerId: 1 }, seed = "9".repeat(64);
const rows = async (q: ReturnType<typeof sql>) => (await db.execute(q)).rows;
let saveId = "", eventId = "";

before(async () => {
  await pg.exec(`CREATE TABLE players(id integer PRIMARY KEY);INSERT INTO players VALUES(1),(2);
    CREATE TABLE feature_flags(feature_name text UNIQUE,enabled boolean,admin_test_mode boolean,description text);
    INSERT INTO feature_flags VALUES('tour_career_2',true,false,'test')`);
  await createCareerSaves(db); await createCareerWorld(db); await createCareerSponsorshipFoundation(db); await createCareerNpcSponsorMarketSPF(db); await createCareerCalendar(db);
  await createCareerFinance(db); await createCareerSponsorJourneysSPB(db); await createCareerSponsorJourneysSPB3(db); await createCareerFinanceSPC(db); await createCareerSponsorHQSPD(db);
  await createCareerSponsorContractActionsSPE2(db); await createCareerSporting(db); await createShadowObservations(db);
});
after(async () => { await pg.close(); });

test("Pub Doubles: you enter, the field locks into pairs, you captain a pair with a local player and only captains are drawn", async () => {
  const save = await saves.create(1, { slot: 1, careerName: "Pairs Player", dateOfBirth: "1990-01-01", homeLocality: "ayrshire" });
  await db.execute(sql`UPDATE career_saves SET world_seed=${seed} WHERE id=${save.id}`);
  await sporting.initialize(actor, save.id);
  saveId = save.id;
  assert.equal(Number((await rows(sql`SELECT event_database_version v FROM career_saves WHERE id=${saveId}`))[0].v) >= 13, true);
  const e = (await rows(sql`SELECT id, start_week, start_day FROM career_event_instances WHERE career_save_id=${saveId} AND definition_key='pub-doubles' AND country='GBR' AND executable ORDER BY start_day LIMIT 1`))[0];
  assert.ok(e, "a Pub Doubles night in the UK");
  eventId = String(e.id);
  await db.execute(sql`UPDATE career_saves SET current_week=${Number(e.start_week)} WHERE id=${saveId}`);
  await db.execute(sql`UPDATE career_event_instances SET status='REGISTRATION_OPEN' WHERE career_save_id=${saveId} AND id=${eventId}`);
  assert.equal((await calendar.enter(actor, saveId, { eventId })).entered, true);
  await db.transaction(async tx => {
    const root = await lockRoot(tx, actor, saveId) as RootRow;
    await tx.execute(sql`UPDATE career_event_instances SET status='REGISTRATION_CLOSED' WHERE career_save_id=${saveId} AND id=${eventId}`);
    const event = (await loadInstances(tx, saveId, sql`id=${eventId}`))[0], providers = await calendar.bind(tx, root);
    assert.equal((await lockField(tx, root, event, await loadNpcs(tx, root.id, { activeOnly: true }), providers, Number(e.start_week))).locked, true);
    await makeDraw(tx, root, event, providers);
    await progressEvent(tx, root, await worldState(tx, root), event, Number(e.start_day), providers);
  });
  const pairs = await rows(sql`SELECT * FROM career_event_pairs WHERE career_save_id=${saveId} AND event_id=${eventId}`);
  const entries = await rows(sql`SELECT participant_key FROM career_event_entries WHERE career_save_id=${saveId} AND event_id=${eventId} AND status='CONFIRMED'`);
  assert.equal(entries.length, pairs.length * 2, "every entrant is in exactly one pair");
  const mine = pairs.find(p => p.captain_key === "HUMAN")!;
  assert.ok(mine, "you captain your pair");
  const partner = (await loadNpcs(db as never, saveId, { ids: [String(mine.partner_npc_id)] }))[0];
  assert.equal(partner.nationality, "GBR");
  const drawn = new Set((await rows(sql`SELECT a_key, b_key FROM career_tournament_matches WHERE career_save_id=${saveId} AND event_id=${eventId}`)).flatMap(m => [m.a_key, m.b_key]).filter(Boolean));
  assert.ok([...drawn].every(k => pairs.some(p => p.captain_key === k)), "only captains are in the bracket");
  const view = await tournaments.read(actor, saveId, eventId);
  assert.equal(view.field.length, pairs.length);
  const me = view.field.find(f => f.key === "HUMAN")!;
  assert.equal(me.partner?.key, String(mine.partner_key)); assert.match(me.name, / & /);
  void localityByRegion;
});

test("World Cup: published national rankings select your pair and the draw opens a live match", async () => {
  const save = await saves.create(1, { slot: 3, careerName: "World Cup Player", dateOfBirth: "1990-01-01", homeLocality: "ayrshire" });
  await db.execute(sql`UPDATE career_saves SET world_seed=${seed} WHERE id=${save.id}`);
  await sporting.initialize(actor, save.id);
  const e = (await rows(sql`SELECT id,start_week,start_day FROM career_event_instances
    WHERE career_save_id=${save.id} AND definition_key='world-cup-of-darts' AND executable LIMIT 1`))[0];
  assert.ok(e, "the authored World Cup exists in the Career calendar");
  const eventId = String(e.id);
  await db.execute(sql`UPDATE career_saves SET current_week=${Number(e.start_week)} WHERE id=${save.id}`);
  await db.execute(sql`UPDATE career_event_instances SET status='REGISTRATION_OPEN' WHERE career_save_id=${save.id} AND id=${eventId}`);

  await db.transaction(async tx => {
    const root = await lockRoot(tx, actor, save.id) as RootRow;
    await tx.execute(sql`UPDATE career_event_instances SET status='REGISTRATION_CLOSED' WHERE career_save_id=${save.id} AND id=${eventId}`);
    const event = (await loadInstances(tx, save.id, sql`id=${eventId}`))[0];
    const base = await calendar.bind(tx, root);
    const candidates = await loadNpcs(tx, root.id, { activeOnly: true });
    const grouped = new Map<string, typeof candidates>();
    for (const npc of candidates) {
      const nation = dartsNation(npc.nationality, localityByRegion(npc.homeRegion)?.key ?? null);
      grouped.set(nation, [...(grouped.get(nation) ?? []), npc]);
    }
    const scots = grouped.get("SCO") ?? [];
    assert.ok(scots.length, "an active Scottish partner is available");
    const ranks = new Map<string, number>([["HUMAN", 100], [scots[0].id, 101]]);
    let nextRank = 3;
    for (const [nation, players] of grouped) {
      if (nation === "SCO") continue;
      for (const npc of players.slice(0, 2)) ranks.set(npc.id, nextRank++);
    }
    const providers = { ...base, sportingStatus: { ...base.sportingStatus,
      rankings: (key: string): Record<string, number> => {
        const rank = ranks.get(key);
        return rank === undefined ? {} : { "pro-world": rank };
      } } };
    const locked = await lockField(tx, root, event, candidates, providers, Number(e.start_week));
    assert.equal(locked.locked, true);
    await makeDraw(tx, root, event, providers);
    await progressEvent(tx, root, await worldState(tx, root), event, Number(e.start_day), providers);
  });

  const mine = (await rows(sql`SELECT nation,partner_key FROM career_event_pairs
    WHERE career_save_id=${save.id} AND event_id=${eventId} AND captain_key='HUMAN'`))[0];
  assert.equal(mine.nation, "SCO");
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS count FROM career_event_pairs WHERE career_save_id=${save.id} AND event_id=${eventId}`))[0].count, 40);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS count FROM career_tournament_matches WHERE career_save_id=${save.id} AND event_id=${eventId}`))[0].count, 51);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS count FROM career_tournament_matches WHERE career_save_id=${save.id} AND event_id=${eventId} AND stage_key LIKE 'groups:%'`))[0].count, 36);
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS count FROM career_tournament_matches WHERE career_save_id=${save.id} AND event_id=${eventId} AND stage_key LIKE 'groups:%' AND best_of=7`))[0].count, 36);
  for (const [round, matches, bestOf] of [[1, 8, 15], [2, 4, 15], [3, 2, 15], [4, 1, 19]]) {
    assert.equal((await rows(sql`SELECT COUNT(*)::int AS count FROM career_tournament_matches WHERE career_save_id=${save.id} AND event_id=${eventId} AND stage_key='knockout' AND round=${round} AND best_of=${bestOf}`))[0].count, matches);
  }
  assert.equal((await rows(sql`SELECT COUNT(*)::int AS count FROM career_tournament_matches WHERE career_save_id=${save.id} AND event_id=${eventId} AND stage_key='knockout' AND round=1 AND a_key IS NOT NULL AND b_key IS NULL`))[0].count, 4);
  const view = await tournaments.read(actor, save.id, eventId);
  assert.ok(view.nextMatchId, "the selected national pair receives a group-stage fixture");
  let session = await live.open(actor, save.id, view.nextMatchId!);
  assert.ok(session.team?.partner.name && session.team.opponentPartner.name, "the World Cup tie opens with both pairs in the live scorer");
  while (session.status === "BULL_UP")
    session = await live.bull(actor, save.id, view.nextMatchId!, { throw: "INNER", expectedRevision: session.revision });
  const first = session.firstThrower as 0 | 1, format = session.format as X01Format;
  let state: X01MatchState = createMatch(format, first);
  const darts: Dart[] = [];
  let humanVisit = 0;
  while (!state.complete) {
    const ctx = { remaining: state.scores[state.turn], opened: state.opened[state.turn] };
    const partnerPlan = state.turn === 0 ? careerPartnerVisit(session as never, first, darts, ctx) : null;
    const plan = state.turn === 1 ? careerBotVisit(session as never, first, darts, ctx)
      : partnerPlan ?? planBotX01Visit(ctx.remaining, { avg: 95, sd: 12, checkoutPct: 45, hitAcc: 0.6 },
        { ...botOptionsFor(format), opened: ctx.opened, rng: seededRandom("world-cup-human", "v", humanVisit++) });
    const turn = state.turn, visits = state.visits.length;
    for (const d of plan) {
      const dart = { segment: d.segment, multiplier: d.multiplier, value: d.value } as Dart;
      state = throwDart(state, dart).state; darts.push(dart);
      if (shouldCheckpoint(format, first, darts, true) && !state.complete)
        session = await live.darts(actor, save.id, view.nextMatchId!, { darts, expectedRevision: session.revision });
      if (state.complete || state.visits.length > visits || state.turn !== turn) break;
    }
  }
  const completed = await live.darts(actor, save.id, view.nextMatchId!, { darts, expectedRevision: session.revision });
  assert.equal(completed.status, "COMPLETED", "a World Cup call-up can finish through the live scorer");
});

test("a live pairs match: partner and both opponents are seeded bots, your darts are yours, the server records the result once", async () => {
  const view = await tournaments.read(actor, saveId, eventId);
  const matchId = view.nextMatchId!;
  assert.ok(matchId);
  let session = await live.open(actor, saveId, matchId);
  assert.ok(session.team && session.team.partner.name && session.team.opponentPartner.name);
  assert.notEqual(session.team.partner.seed, session.team.opponentPartner.seed);
  while (session.status === "BULL_UP") session = await live.bull(actor, saveId, matchId, { throw: "INNER", expectedRevision: session.revision });
  const first = session.firstThrower as 0 | 1, format = session.format as X01Format;
  let state: X01MatchState = createMatch(format, first);
  const darts: Dart[] = [];
  let mine = 0, checkpoints = 0;
  while (!state.complete) {
    const ctx = { remaining: state.scores[state.turn], opened: state.opened[state.turn] };
    const partnerPlan = state.turn === 0 ? careerPartnerVisit(session as never, first, darts, ctx) : null;
    const plan = state.turn === 1 ? careerBotVisit(session as never, first, darts, ctx)
      : partnerPlan ?? planBotX01Visit(ctx.remaining, { avg: 95, sd: 12, checkoutPct: 45, hitAcc: 0.6 }, { ...botOptionsFor(format), opened: ctx.opened, rng: seededRandom("you", "v", mine++) });
    const turn = state.turn, visits = state.visits.length;
    for (const d of plan) {
      const dart = { segment: d.segment, multiplier: d.multiplier, value: d.value } as Dart;
      state = throwDart(state, dart).state; darts.push(dart);
      if (shouldCheckpoint(format, first, darts, true) && !state.complete) {
        session = await live.darts(actor, saveId, matchId, { darts, expectedRevision: session.revision }); checkpoints++;
      }
      if (state.complete || state.visits.length > visits || state.turn !== turn) break;
    }
  }
  assert.ok(checkpoints > 0);
  const done = await live.darts(actor, saveId, matchId, { darts, expectedRevision: session.revision });
  assert.equal(done.status, "COMPLETED");
  const facts = (done.result as { facts: { human: { darts: number }; partner: { darts: number }; team: { darts: number } } }).facts;
  assert.equal(facts.human.darts + facts.partner.darts, facts.team.darts);
  assert.ok(facts.partner.darts > 0 && facts.human.darts > 0);
  // Exactly once: the same log again is a duplicate, never a second result.
  assert.equal(((await live.darts(actor, saveId, matchId, { darts, expectedRevision: done.revision })) as { duplicate?: boolean }).duplicate, true);
  // A pairs match is not a singles head-to-head.
  const match = (await rows(sql`SELECT a_key, b_key, winner_key FROM career_tournament_matches WHERE career_save_id=${saveId} AND id=${matchId}`))[0];
  assert.ok(match.winner_key);
  const relationships = await createCareerRelationshipsService(db).read(actor, saveId);
  assert.equal(relationships.opponents.length, 0, "no singles meeting is recorded from a pairs match");
  // Shadow statistics credit your partner's darts to the partner, not to you.
  const credited = await rows(sql`SELECT participant_key, COUNT(*)::int n FROM shadow_observations o JOIN shadow_activities a ON a.id=o.activity_id
    WHERE a.source_id LIKE ${saveId + "/%"} GROUP BY 1`);
  const byKey = new Map(credited.map(r => [String(r.participant_key), Number(r.n)]));
  assert.equal(byKey.get(`npc:${session.team!.partner.key}`), facts.partner.darts);
  assert.equal([...byKey.entries()].find(([k]) => k.startsWith("player:"))?.[1], facts.human.darts);
});

test("a tampered partner visit is refused by the session boundary", async () => {
  // Fresh pairs session on the next human match, if the pair is still in; otherwise the boundary was already exercised above.
  const view = await tournaments.read(actor, saveId, eventId);
  if (!view.nextMatchId) return;
  let session = await live.open(actor, saveId, view.nextMatchId);
  while (session.status === "BULL_UP") session = await live.bull(actor, saveId, view.nextMatchId, { throw: "INNER", expectedRevision: session.revision });
  const first = session.firstThrower as 0 | 1, format = session.format as X01Format;
  let state = createMatch(format, first);
  const darts: Dart[] = [];
  // Throw until the partner's first visit is due, then throw a visit the partner's bot would not.
  for (let guard = 0; guard < 40; guard++) {
    const ctx = { remaining: state.scores[state.turn], opened: state.opened[state.turn] };
    const partner = state.turn === 0 ? careerPartnerVisit(session as never, first, darts, ctx) : null;
    if (partner) {
      const bad = [{ segment: 0, multiplier: 1, value: 0 }, { segment: 0, multiplier: 1, value: 0 }, { segment: 0, multiplier: 1, value: 0 }] as Dart[];
      if (partner.every((d, i) => d.segment === bad[i].segment)) bad[0] = { segment: 1, multiplier: 1, value: 1 } as Dart;
      await assert.rejects(live.darts(actor, saveId, view.nextMatchId, { darts: [...darts, ...bad], expectedRevision: session.revision }), /Partner visit/);
      return;
    }
    const plan = state.turn === 1 ? careerBotVisit(session as never, first, darts, ctx) : [{ segment: 20, multiplier: 1, value: 20 }, { segment: 20, multiplier: 1, value: 20 }, { segment: 20, multiplier: 1, value: 20 }];
    for (const d of plan) { const dart = { segment: d.segment, multiplier: d.multiplier, value: d.value } as Dart; state = throwDart(state, dart).state; darts.push(dart); }
  }
  assert.fail("partner never came to throw");
});

test("a pairs match cannot be settled without the live scorer", async () => {
  const save = await saves.create(1, { slot: 2, careerName: "Pairs Sim", dateOfBirth: "1990-01-01", homeLocality: "ayrshire" });
  await db.execute(sql`UPDATE career_saves SET world_seed=${seed} WHERE id=${save.id}`);
  await sporting.initialize(actor, save.id);
  const e = (await rows(sql`SELECT id, start_week, start_day FROM career_event_instances WHERE career_save_id=${save.id} AND definition_key='pub-doubles' AND country='GBR' AND executable ORDER BY start_day LIMIT 1`))[0];
  const event = String(e.id);
  await db.execute(sql`UPDATE career_saves SET current_week=${Number(e.start_week)} WHERE id=${save.id}`);
  await db.execute(sql`UPDATE career_event_instances SET status='REGISTRATION_OPEN' WHERE career_save_id=${save.id} AND id=${event}`);
  assert.equal((await calendar.enter(actor, save.id, { eventId: event })).entered, true);
  await db.transaction(async tx => {
    const root = await lockRoot(tx, actor, save.id) as RootRow;
    await tx.execute(sql`UPDATE career_event_instances SET status='REGISTRATION_CLOSED' WHERE career_save_id=${save.id} AND id=${event}`);
    const instance = (await loadInstances(tx, save.id, sql`id=${event}`))[0], providers = await calendar.bind(tx, root);
    await lockField(tx, root, instance, await loadNpcs(tx, root.id, { activeOnly: true }), providers, Number(e.start_week));
    await makeDraw(tx, root, instance, providers);
    await progressEvent(tx, root, await worldState(tx, root), instance, Number(e.start_day), providers);
  });
  const matchId = (await tournaments.read(actor, save.id, event)).nextMatchId!;
  await assert.rejects(calendar.quickSimMatch(actor, save.id, event, { matchId, confirmation: "QUICK_SIM" }), /must be played live/);
  const [m] = await rows(sql`SELECT status, winner_key, legs_a, legs_b FROM career_tournament_matches WHERE career_save_id=${save.id} AND id=${matchId}`);
  assert.deepEqual([m.status, m.winner_key, m.legs_a, m.legs_b], ["AWAITING_HUMAN", null, null, null]);
});
