import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

export type ResultPosterInput = {
  resultRef: string;
  // Team Match wagers against individual players on the singles ladder (see
  // routes/team-matches.ts) rather than owning its own season row, so it has
  // no "team_match" row in seasons.league_type — normalised to "singles"
  // below for the active-season fallback lookup.
  leagueType: "singles" | "doubles" | "shift_wars" | "team_match";
  format: string;
  winnerName: string;
  loserName: string;
  stake: number;
  gameType: string;
  seasonId?: number | null;
  createdBy?: number | null;
  resultType?: "standard" | "uneven" | "combined" | "multi";
};

/** Persist the ingredients for a final-result image. The browser recreates
 * the PNG on demand, so this adds no binary/object-storage cost. */
export async function upsertResultPoster(input: ResultPosterInput): Promise<void> {
  try {
    const seasonLeagueType = input.leagueType === "team_match" ? "singles" : input.leagueType;
    const season = await db.execute(sql`
      SELECT id,name FROM seasons
      WHERE (${input.seasonId ?? null}::int IS NOT NULL AND id=${input.seasonId ?? null})
         OR (${input.seasonId ?? null}::int IS NULL AND league_type=${seasonLeagueType} AND is_active=true)
      ORDER BY CASE WHEN id=${input.seasonId ?? null} THEN 0 ELSE 1 END,id DESC
      LIMIT 1
    `);
    const seasonRow:any=season.rows[0]??{};
    const major=input.stake>=20;
    const featured=input.stake>=10;
    const kicker=major?"BIG RESULT":featured?"MATCH RESULT":"FINAL WHISTLE";
    const reason=`${input.gameType.replaceAll("_"," ")} · ${input.stake} point${input.stake===1?"":"s"} at stake`;
    await db.execute(sql`
      INSERT INTO match_posters(
        session_id,format,side_a,side_b,kicker,reason,level,status,winner_name,
        match_key,result_ref,stake,result_type,game_type,created_by,season_id,season_name,updated_at
      ) VALUES (
        ${`result-${input.resultRef}`},${input.format},${input.winnerName},${input.loserName},${kicker},${reason},
        ${major?"major":featured?"featured":"standard"},'finished',${input.winnerName},${input.resultRef},
        ${input.resultRef},${input.stake},${input.resultType??"standard"},${input.gameType},${input.createdBy??null},
        ${seasonRow.id??input.seasonId??null},${seasonRow.name??null},NOW()
      )
      ON CONFLICT (result_ref) WHERE result_ref IS NOT NULL DO UPDATE SET
        format=EXCLUDED.format,side_a=EXCLUDED.side_a,side_b=EXCLUDED.side_b,
        kicker=EXCLUDED.kicker,reason=EXCLUDED.reason,level=EXCLUDED.level,
        status='finished',winner_name=EXCLUDED.winner_name,match_key=EXCLUDED.match_key,
        stake=EXCLUDED.stake,result_type=EXCLUDED.result_type,game_type=EXCLUDED.game_type,
        season_id=EXCLUDED.season_id,season_name=EXCLUDED.season_name,withdrawn_at=NULL,updated_at=NOW()
    `);
  } catch (err) {
    logger.warn({err,resultRef:input.resultRef},"Could not create automatic result poster");
  }
}
