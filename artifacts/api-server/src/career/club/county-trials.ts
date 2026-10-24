import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import type { CountyCategory } from "./county-squads.ts";

export const COUNTY_TRIAL_REQUIREMENT = Object.freeze({ appearances: 5, wins: 2 });

export type CountyTrialStatus = "NOT_EARNED" | "INVITED" | "LIVE" | "WON" | "LOST" | "EXPIRED";
export type CountyTrialView = {
  status: CountyTrialStatus;
  season: number | null;
  sourceSeason: number | null;
  appearances: number;
  wins: number;
  category: CountyCategory | null;
  matchId: string | null;
  opponentName: string | null;
};

type TrialRow = Record<string, unknown>;
const viewFrom = (row: TrialRow): CountyTrialView => ({
  status: String(row.status) as CountyTrialStatus,
  season: Number(row.season),
  sourceSeason: Number(row.source_season),
  appearances: Number(row.appearances),
  wins: Number(row.wins),
  category: row.category === "MEN" || row.category === "WOMEN" ? row.category : null,
  matchId: row.match_id ? String(row.match_id) : null,
  opponentName: row.opponent_name ? String(row.opponent_name) : null,
});

/** Only a played human rubber counts; simulated team-mates and missed fixtures never pad trial eligibility. */
export async function clubTrialRecord(tx: CareerExecutor, saveId: string, sourceSeason: number) {
  if (sourceSeason < 1) return { appearances: 0, wins: 0 };
  const member = (await tx.execute(sql`SELECT 1 FROM career_club_team_memberships
    WHERE career_save_id=${saveId} AND season=${sourceSeason} LIMIT 1`)).rows[0];
  if (!member) return { appearances: 0, wins: 0 };
  const rows = (await tx.execute(sql`SELECT rubbers FROM career_club_fixtures
    WHERE career_save_id=${saveId} AND season=${sourceSeason} AND status='COMPLETED'`)).rows;
  let appearances = 0, wins = 0;
  for (const row of rows) for (const rubber of Array.isArray(row.rubbers) ? row.rubbers as { humanMatch?: { status?: string; won?: boolean } }[] : []) {
    if (rubber.humanMatch?.status !== "PLAYED") continue;
    appearances++;
    if (rubber.humanMatch.won === true) wins++;
  }
  return { appearances, wins };
}

/** Create the season-scoped invitation lazily. Existing saves receive no invented appearances or wins. */
export async function ensureCountyTrialInvitation(tx: CareerExecutor, saveId: string, season: number): Promise<CountyTrialView> {
  if (season <= 1) return { status: "NOT_EARNED", season: null, sourceSeason: null, appearances: 0, wins: 0, category: null, matchId: null, opponentName: null };
  await tx.execute(sql`UPDATE career_county_trials SET status='EXPIRED'
    WHERE career_save_id=${saveId} AND season < ${season} AND status='INVITED'`);
  const existing = (await tx.execute(sql`SELECT * FROM career_county_trials WHERE career_save_id=${saveId} AND season=${season}`)).rows[0];
  if (existing) return viewFrom(existing);
  const record = await clubTrialRecord(tx, saveId, season - 1);
  if (record.appearances < COUNTY_TRIAL_REQUIREMENT.appearances || record.wins < COUNTY_TRIAL_REQUIREMENT.wins) {
    return { status: "NOT_EARNED", season, sourceSeason: season - 1, ...record, category: null, matchId: null, opponentName: null };
  }
  await tx.execute(sql`INSERT INTO career_county_trials(career_save_id,season,source_season,status,appearances,wins)
    VALUES (${saveId},${season},${season - 1},'INVITED',${record.appearances},${record.wins}) ON CONFLICT DO NOTHING`);
  const row = (await tx.execute(sql`SELECT * FROM career_county_trials WHERE career_save_id=${saveId} AND season=${season}`)).rows[0];
  return row ? viewFrom(row) : { status: "NOT_EARNED", season, sourceSeason: season - 1, ...record, category: null, matchId: null, opponentName: null };
}

export async function countyTrialQualifiedCategory(tx: CareerExecutor, saveId: string, season: number): Promise<CountyCategory | null> {
  const row = (await tx.execute(sql`SELECT category FROM career_county_trials
    WHERE career_save_id=${saveId} AND season=${season} AND status='WON' AND category IN ('MEN','WOMEN')`)).rows[0];
  return row?.category === "MEN" || row?.category === "WOMEN" ? row.category : null;
}
