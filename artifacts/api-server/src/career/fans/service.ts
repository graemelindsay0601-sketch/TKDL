import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { LOCALITIES } from "../calendar/geography.ts";
import { fanFollowing, type FanEvidence, type FanFollowing } from "./model.ts";

/** Fan following from the human's own recorded results, nine-darters and interview answers (small, per-save reads). */
export async function loadFanFollowing(tx: CareerExecutor, saveId: string): Promise<FanFollowing> {
  return fanFollowing(await loadFanEvidence(tx, saveId));
}

export async function loadFanEvidence(tx: CareerExecutor, saveId: string): Promise<FanEvidence> {
  const root = (await tx.execute(sql`SELECT s.current_season,s.settings_snapshot,p.home_locality FROM career_saves s
    LEFT JOIN career_profiles p ON p.career_save_id=s.id WHERE s.id=${saveId}`)).rows[0];
  const locality = String(root?.home_locality ?? (root?.settings_snapshot as { homeLocality?: string } | undefined)?.homeLocality ?? "");
  const homeCountry = LOCALITIES.find(l => l.key === locality)?.country ?? null;
  const results = (await tx.execute(sql`SELECT i.season,i.presentation_tier,i.country,r.is_champion,r.stage_reached,i.classification
    FROM career_event_results r JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
    WHERE r.career_save_id=${saveId} AND r.participant_key='HUMAN' AND i.status='COMPLETED'`)).rows;
  const nines = (await tx.execute(sql`SELECT w.season,i.presentation_tier,i.country FROM career_world_records w
    JOIN career_event_instances i ON i.career_save_id=w.career_save_id AND i.id=w.event_id
    WHERE w.career_save_id=${saveId} AND w.record_key='nine-darter' AND w.participant_key='HUMAN'`)).rows;
  const showman = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_life_decisions
    WHERE career_save_id=${saveId} AND kind='DIALOGUE' AND choice IN ('SHOWMAN','CONFIDENT')`)).rows[0]?.n ?? 0);
  return {
    currentSeason: Number(root?.current_season ?? 1), homeCountry, showmanAnswers: showman,
    results: results.map(r => ({ season: Number(r.season), tier: String(r.presentation_tier), country: String(r.country), champion: r.is_champion === true,
      final: r.stage_reached === "FINAL", qualifier: r.classification === "QUALIFIER" })),
    nineDarters: nines.map(r => ({ season: Number(r.season), televised: ["TELEVISED", "MAJOR", "WORLD"].includes(String(r.presentation_tier)), country: String(r.country) })),
  };
}

/** Saves from this player database version on feel their following in sponsor offers and product sales. */
export const FAN_EFFECTS_FROM_PLAYER_DATABASE = 7;
/** Fans for economic effects, or null for a save created before they existed (its economy keeps its original rules). */
export async function fansForEffects(tx: CareerExecutor, saveId: string): Promise<number | null> {
  const version = Number((await tx.execute(sql`SELECT player_database_version FROM career_saves WHERE id=${saveId}`)).rows[0]?.player_database_version ?? 1);
  return version >= FAN_EFFECTS_FROM_PLAYER_DATABASE ? (await loadFanFollowing(tx, saveId)).total : null;
}
