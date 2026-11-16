/** The v15 midweek pub circuit: Monday League and Wednesday Flier nights, for new Careers and added to existing ones. */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { createCareerSaves } from "../../db/migrations/create_career_saves.ts";
import { createCareerWorld } from "../../db/migrations/create_career_world.ts";
import { createCareerSponsorshipFoundation } from "../../db/migrations/create_career_sponsorship_foundation.ts";
import { createCareerNpcSponsorMarketSPF } from "../../db/migrations/create_career_npc_sponsor_market_spf.ts";
import { createCareerCalendar } from "../../db/migrations/create_career_calendar.ts";
import { createCareerFinance } from "../../db/migrations/create_career_finance.ts";
import { createCareerSponsorJourneysSPB } from "../../db/migrations/create_career_sponsor_journeys_spb.ts";
import { createCareerSponsorJourneysSPB3 } from "../../db/migrations/create_career_sponsor_journeys_spb3.ts";
import { createCareerFinanceSPC } from "../../db/migrations/create_career_finance_spc.ts";
import { createCareerSponsorHQSPD } from "../../db/migrations/create_career_sponsor_hq_spd.ts";
import { createCareerSponsorContractActionsSPE2 } from "../../db/migrations/create_career_sponsor_contract_actions_spe2.ts";
import { createCareerSporting } from "../../db/migrations/create_career_sporting.ts";
import { createShadowObservations } from "../../db/migrations/create_shadow_observations_sb21a.ts";
import { repairCareerSchema } from "../../db/migrations/repair_career_schema.ts";
import { createCareerService } from "../../career/service.ts";
import { createCareerSportingService } from "../../career/sporting/service.ts";

const pg = new PGlite(), db = drizzle(pg);
const saves = createCareerService(db), career = createCareerSportingService(db);
const actor = { playerId: 1 };


before(async () => {
  await pg.exec(`CREATE TABLE players (id INTEGER PRIMARY KEY); INSERT INTO players VALUES (1);
    CREATE TABLE feature_flags (feature_name TEXT UNIQUE, enabled BOOLEAN, admin_test_mode BOOLEAN, description TEXT);
    INSERT INTO feature_flags VALUES ('tour_career_2', true, false, 'test')`);
  for (const m of [createCareerSaves, createCareerWorld, createCareerSponsorshipFoundation, createCareerNpcSponsorMarketSPF, createCareerCalendar, createCareerFinance,
    createCareerSponsorJourneysSPB, createCareerSponsorJourneysSPB3, createCareerFinanceSPC, createCareerSponsorHQSPD, createCareerSponsorContractActionsSPE2, createCareerSporting, createShadowObservations]) await m(db);
  await repairCareerSchema(db);
});
after(async () => { await pg.close(); });

test("an event that already holds results keeps them, and the player's match still goes through", async () => {
  const id = (await saves.create(1, { slot: 1, careerName: "Replayed", dateOfBirth: "1996-06-15", homeLocality: "ayrshire" })).id;
  await career.initialize(actor, id);
  // A cheap local knockout in the next couple of weeks.
  const cal = await career.calendar.calendar(actor, id, { scope: "AVAILABLE", fromWeek: 1, toWeek: 4 }) as { events: { id: string; circuit: string; human: { canEnter: boolean } | null; dates: { startWeek: number }; series?: unknown; capability: { executable: boolean } }[] };
  const ev = cal.events.find(e => e.circuit === "GRASSROOTS" && e.human?.canEnter && e.capability.executable && !e.series)!;
  assert.ok(ev, "a local event to play");
  assert.equal((await career.calendar.enter(actor, id, { eventId: ev.id }) as { entered: boolean }).entered, true);
  let before: Record<string, unknown>[] | null = null;
  // Play on, winning every match: no error, the event completes, the earlier champion stands.
  for (let i = 0; i < 40; i++) {
    const root = await saves.read(1, id);
    const r = await career.calendar.advance(actor, id, { operationKey: `replay-${i}`, expectedSeason: root.currentSeason, expectedWeek: root.currentWeek, target: { kind: "WEEKS", weeks: 1 } }) as { stop: { reason: string; detail?: { matchIds?: string[] } } };
    if (r.stop.reason === "HUMAN_MATCH_PENDING" && !before) {
      // Its history already has a champion (an interrupted week replayed, or an older save's records).
      await db.execute(sql`INSERT INTO career_event_results (career_save_id, event_id, participant_key, participant_kind, npc_id, season, definition_key, finishing_position,
          stage_reached, is_champion, matches_played, wins, losses, legs_for, legs_against, metadata)
        SELECT e.career_save_id, e.event_id, e.participant_key, e.participant_kind, e.npc_id, i.season, i.definition_key, 1, 'WINNER', true, 4, 4, 0, 8, 1, '{}'::jsonb
        FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
        WHERE e.career_save_id = ${id} AND e.event_id = ${ev.id} AND e.participant_key <> 'HUMAN' LIMIT 1`);
      before = (await db.execute(sql`SELECT participant_key FROM career_event_results WHERE career_save_id=${id} AND event_id=${ev.id} AND is_champion`)).rows;
      assert.equal(before.length, 1, "seeded an earlier champion");
    }
    if (r.stop.reason === "HUMAN_MATCH_PENDING") for (const matchId of r.stop.detail?.matchIds ?? []) {
      const m = (await db.execute(sql`SELECT best_of FROM career_tournament_matches WHERE career_save_id=${id} AND id=${matchId}`)).rows[0];
      await career.calendar.recordHumanMatchResult(actor, id, { matchId, humanLegs: (Number(m.best_of) + 1) / 2, opponentLegs: 0, humanThrewFirst: true });
    }
    const status = (await db.execute(sql`SELECT status FROM career_event_instances WHERE career_save_id=${id} AND id=${ev.id}`)).rows[0].status;
    if (status === "COMPLETED") break;
  }
  assert.equal((await db.execute(sql`SELECT status FROM career_event_instances WHERE career_save_id=${id} AND id=${ev.id}`)).rows[0].status, "COMPLETED");
  const champs = (await db.execute(sql`SELECT participant_key FROM career_event_results WHERE career_save_id=${id} AND event_id=${ev.id} AND is_champion`)).rows;
  assert.equal(champs.length, 1);
  assert.deepEqual(champs, before, "the earlier champion stands");
});
