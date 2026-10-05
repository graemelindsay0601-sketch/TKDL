import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { ageOn, careerDate } from "../identity/age.ts";
import { relationshipModel } from "./model.ts";
import type { CareerRelationships, Cohort, Meeting, WorldIdentity } from "./types.ts";

type Row = Record<string, unknown>;
const str = (r: Row, key: string) => String(r[key] ?? "");
const nullableNumber = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
export function createCareerRelationshipsService(database: CareerDatabase) {
  return { async read(actor: CareerActor, saveId: string): Promise<CareerRelationships> {
    return database.transaction(async tx => {
      // A7.1 snapshot/authorization convention: serialize with writers; retired saves readable.
      const root = await lockRoot(tx, actor, saveId, false);
      const rr = root as unknown as Row, start = str(rr,"identity_start"), dob = str(rr,"identity_dob");
      const players = (await tx.execute(sql`SELECT n.id, n.first_name, n.surname, n.nationality, n.home_region, n.age, n.starting_age,
        n.status, n.created_season, n.retired_season, r.position
        FROM career_world_players n LEFT JOIN career_ranking_snapshot_rows r ON r.career_save_id=n.career_save_id AND r.npc_id=n.id
          AND r.snapshot_id=(SELECT id FROM career_ranking_snapshots WHERE career_save_id=${saveId} AND list_key='pro-world' ORDER BY sequence DESC LIMIT 1)
        WHERE n.career_save_id=${saveId} ORDER BY n.created_season,n.surname,n.first_name,n.id`)).rows.map(r=>({
          id:str(r,"id"), name:`${str(r,"first_name")} ${str(r,"surname")}`, nationality:str(r,"nationality"), homeRegion:str(r,"home_region"),
          age:Number(r.age), startingAge:Number(r.starting_age), createdSeason:Number(r.created_season),
          retiredSeason:nullableNumber(r.retired_season), status:r.status as WorldIdentity["status"], worldRanking:nullableNumber(r.position),
        }));
      const rows = (await tx.execute(sql`WITH finals AS (
          SELECT event_id, stage_key, MAX(round) AS final_round FROM career_tournament_matches WHERE career_save_id=${saveId} GROUP BY event_id,stage_key
        ) SELECT m.*, i.name, i.season, i.presentation_tier, i.circuit, i.classification, f.final_round
        FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
        JOIN finals f ON f.event_id=m.event_id AND f.stage_key=m.stage_key
        WHERE m.career_save_id=${saveId} AND m.status='COMPLETED' AND m.a_key IS NOT NULL AND m.b_key IS NOT NULL AND m.a_key<>m.b_key
          AND m.winner_key IN (m.a_key,m.b_key) AND (m.a_key='HUMAN' OR m.b_key='HUMAN')
          AND COALESCE(m.result_source,'') NOT IN ('BYE','WALKOVER')`)).rows;
      const meetings: Meeting[] = rows.map(r=>{
        const humanA = r.a_key==="HUMAN", season=Number(r.season), day=Number(r.scheduled_day);
        const date = start ? careerDate(start,season,day) : null;
        const summary = r.summary && typeof r.summary==="object" ? r.summary as Row : {};
        const sets = Array.isArray(summary.sets) && summary.sets.length===2 ? summary.sets : [];
        return { id:str(r,"id"), opponentId:str(r,humanA ? "b_npc_id" : "a_npc_id"), eventId:str(r,"event_id"), name:str(r,"name"),
          season, day, date, humanAge:date && dob ? ageOn(dob,date) : null, round:Number(r.round), stage:str(r,"stage_key"), won:r.winner_key==="HUMAN",
          final:!str(r,"stage_key").startsWith("groups:") && r.round===r.final_round, major:["MAJOR","WORLD"].includes(str(r,"presentation_tier")) || ["MAJOR","WORLD_CHAMPIONSHIP"].includes(str(r,"circuit")),
          qualification:r.circuit==="Q_SCHOOL" || r.classification==="QUALIFIER",
          legsHuman:nullableNumber(humanA ? r.legs_a : r.legs_b), legsNpc:nullableNumber(humanA ? r.legs_b : r.legs_a),
          setsHuman:nullableNumber(sets[humanA ? 0 : 1]), setsNpc:nullableNumber(sets[humanA ? 1 : 0]) };
      });
      // Only an actually played match proves attendance. Result/entry rows alone
      // also include post-lock withdrawals. Q-School session = season + pathway/stage
      // series; Junior overlap = same actual event, not merely same age/year.
      const shared = (await tx.execute(sql`WITH participation AS (
        SELECT DISTINCT i.season, i.name, i.id AS event_id, i.circuit, i.family,
          CASE WHEN i.circuit='Q_SCHOOL' THEN i.series_key ELSE i.id::text END AS session,
          p.key
        FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
        CROSS JOIN LATERAL (VALUES(m.a_key),(m.b_key)) p(key)
        WHERE m.career_save_id=${saveId} AND m.status='COMPLETED' AND m.a_key IS NOT NULL AND m.b_key IS NOT NULL AND m.a_key<>m.b_key
          AND m.winner_key IN (m.a_key,m.b_key) AND COALESCE(m.result_source,'') NOT IN ('BYE','WALKOVER')
          AND (i.circuit='Q_SCHOOL' OR i.family='junior-development-circuit')
      )
      SELECT DISTINCT n.key, n.season, n.session,
        CASE WHEN n.circuit='Q_SCHOOL' THEN 'Q-School Class' ELSE 'Junior Contemporary' END AS kind,
        CASE WHEN n.circuit='Q_SCHOOL' THEN n.session ELSE n.name END AS name
      FROM participation h JOIN participation n ON n.season=h.season AND n.session=h.session AND n.circuit=h.circuit AND n.family=h.family
      WHERE h.key='HUMAN' AND n.key<>'HUMAN'`)).rows;
      const cohorts: Cohort[] = shared.map(r=>({opponentId:str(r,"key"), kind:r.kind as Cohort["kind"], season:Number(r.season), session:str(r,"session"), name:str(r,"name")}));
      return relationshipModel(saveId,players,meetings,cohorts,Number(root.current_season));
    });
  } };
}
