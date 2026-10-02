import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

const router: IRouter = Router();

type ResultRow = {
  match_key: string; season_id: number | null; played_at: string | Date;
  stake: number; winner_name: string; loser_name: string; league_type: string;
};

function monthKey(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", timeZone: "Europe/London" }).slice(0, 7);
}

async function resultFeed(): Promise<ResultRow[]> {
  const result = await db.execute(sql`
    SELECT 'league-' || m.id AS match_key, m.season_id, m.played_at, m.stake,
      m.winner_name, m.loser_name, 'singles'::text AS league_type
    FROM matches m
    UNION ALL
    SELECT 'doubles-' || m.id, m.season_id, m.played_at, m.stake,
      w.team_name, l.team_name, 'doubles'::text
    FROM doubles_matches m JOIN doubles_teams w ON w.id=m.winner_team_id JOIN doubles_teams l ON l.id=m.loser_team_id
    UNION ALL
    SELECT 'doubles-combined-' || m.id, m.season_id, m.played_at, m.pot,
      CASE WHEN m.solo_won THEN solo.team_name ELSE 'Combined side' END,
      CASE WHEN m.solo_won THEN 'Combined side' ELSE solo.team_name END, 'doubles'::text
    FROM doubles_combined_matches m JOIN doubles_teams solo ON solo.id=m.solo_team_id
    UNION ALL
    SELECT 'doubles-multi-' || m.id, m.season_id, m.played_at, m.pot,
      w.team_name, 'Multi-team field', 'doubles'::text
    FROM doubles_multi_matches m JOIN doubles_teams w ON w.id=m.winner_team_id
    UNION ALL
    SELECT 'shift-' || m.id, m.season_id, m.played_at, m.stake,
      w.name, l.name, 'shift_wars'::text
    FROM shift_wars_matches m JOIN shift_wars_teams w ON w.id=m.winner_team_id JOIN shift_wars_teams l ON l.id=m.loser_team_id
    UNION ALL
    SELECT 'shift-combined-' || m.id, m.season_id, m.played_at, m.pot,
      CASE WHEN m.solo_won THEN solo.name ELSE 'Combined side' END,
      CASE WHEN m.solo_won THEN 'Combined side' ELSE solo.name END, 'shift_wars'::text
    FROM shift_wars_combined_matches m JOIN shift_wars_teams solo ON solo.id=m.solo_team_id
    UNION ALL
    SELECT 'shift-multi-' || m.id, m.season_id, m.played_at, m.pot,
      w.name, 'Multi-team field', 'shift_wars'::text
    FROM shift_wars_multi_matches m JOIN shift_wars_teams w ON w.id=m.winner_team_id
  `);
  return result.rows as unknown as ResultRow[];
}

router.get("/insights/records", async (_req, res): Promise<void> => {
  const [feed, upset, streak, night, closest] = await Promise.all([
    resultFeed(),
    db.execute(sql`SELECT id, winner_id, winner_name, loser_name, elo_change, played_at FROM matches WHERE was_upset_win=true ORDER BY elo_change DESC, played_at ASC LIMIT 1`),
    db.execute(sql`SELECT id, name, longest_win_streak FROM players WHERE longest_win_streak > 0 ORDER BY longest_win_streak DESC, name LIMIT 1`),
    db.execute(sql`
      WITH player_wins AS (
        SELECT winner_id player_id, winner_name player_name, played_at::date day FROM matches
        WHERE game_type NOT LIKE 'team_%' AND game_type <> 'multi_killer'
        UNION ALL
        SELECT mp.player_id, mp.player_name, m.played_at::date FROM match_participants mp
        JOIN matches m ON m.id=mp.match_id WHERE mp.team='winner'
      )
      SELECT player_id, player_name, day, COUNT(*)::int wins FROM player_wins
      GROUP BY player_id, player_name, day ORDER BY wins DESC, day ASC LIMIT 1
    `),
    db.execute(sql`
      WITH ranked AS (
        SELECT ss.season_id, s.name season_name, ss.player_id, p.name player_name, ss.points,
          ROW_NUMBER() OVER (PARTITION BY ss.season_id ORDER BY ss.points DESC, ss.elo DESC) position
        FROM season_standings ss JOIN seasons s ON s.id=ss.season_id JOIN players p ON p.id=ss.player_id
        WHERE s.is_active=false AND s.league_type='singles'
      ), gaps AS (
        SELECT a.season_id, a.season_name, a.player_id, a.player_name, a.points,
          (a.points-b.points)::int gap, b.player_name runner_up
        FROM ranked a JOIN ranked b ON b.season_id=a.season_id AND b.position=2 WHERE a.position=1
      ) SELECT * FROM gaps ORDER BY gap ASC, season_id ASC LIMIT 1
    `),
  ]);

  const biggest = [...feed].sort((a, b) => Number(b.stake) - Number(a.stake))[0];
  const upsetRow: any = upset.rows[0];
  const streakRow: any = streak.rows[0];
  const nightRow: any = night.rows[0];
  const closestRow: any = closest.rows[0];
  const records = [
    biggest && { key:"biggest-wager", label:"Biggest Wager", value:Number(biggest.stake), valueSuffix:" pts", holder:biggest.winner_name, detail:`Beat ${biggest.loser_name}`, matchKey:biggest.match_key, date:biggest.played_at },
    upsetRow && { key:"biggest-upset", label:"Biggest Upset", value:Number(upsetRow.elo_change), valueSuffix:" Elo", holder:upsetRow.winner_name, holderId:Number(upsetRow.winner_id), detail:`Beat ${upsetRow.loser_name}`, matchKey:`league-${upsetRow.id}`, date:upsetRow.played_at },
    streakRow && { key:"winning-streak", label:"Longest Winning Streak", value:Number(streakRow.longest_win_streak), valueSuffix:" wins", holder:streakRow.name, holderId:Number(streakRow.id), detail:"Best recorded consecutive run" },
    nightRow && { key:"wins-night", label:"Most Wins in One Night", value:Number(nightRow.wins), valueSuffix:" wins", holder:nightRow.player_name, holderId:Number(nightRow.player_id), detail:new Date(`${nightRow.day}T12:00:00`).toLocaleDateString("en-GB", { day:"numeric", month:"short", year:"numeric" }) },
    closestRow && { key:"closest-title", label:"Closest Title Finish", value:Number(closestRow.gap), valueSuffix:" pts", holder:closestRow.player_name, holderId:Number(closestRow.player_id), detail:`${closestRow.season_name} · ahead of ${closestRow.runner_up}` },
  ].filter(Boolean);
  res.json({ generatedAt: new Date().toISOString(), records });
});

router.get("/insights/monthly-reports", async (_req, res): Promise<void> => {
  const [seasonResult, feed, singlesWins] = await Promise.all([
    db.execute(sql`SELECT id,name,start_date,end_date,is_active,league_type,champion_id,champion_name FROM seasons ORDER BY start_date DESC,id DESC`),
    resultFeed(),
    db.execute(sql`
      SELECT m.season_id, m.winner_id player_id, m.winner_name player_name, COUNT(*)::int wins
      FROM matches m WHERE m.game_type NOT LIKE 'team_%' AND m.game_type <> 'multi_killer'
      GROUP BY m.season_id,m.winner_id,m.winner_name
    `),
  ]);
  const seasons = seasonResult.rows as any[];
  const wins = singlesWins.rows as any[];
  const groups = new Map<string, any>();
  for (const season of seasons) {
    const key = monthKey(season.start_date);
    const group = groups.get(key) ?? { monthKey:key, isCurrent:false, seasons:[], results:[] };
    group.isCurrent ||= Boolean(season.is_active);
    group.seasons.push(season);
    groups.set(key, group);
  }
  for (const result of feed) {
    const season = seasons.find(s => Number(s.id) === Number(result.season_id));
    const key = season ? monthKey(season.start_date) : monthKey(result.played_at);
    const group = groups.get(key) ?? { monthKey:key, isCurrent:false, seasons:[], results:[] };
    group.results.push(result); groups.set(key, group);
  }
  const reports = [...groups.values()].sort((a,b)=>b.monthKey.localeCompare(a.monthKey)).slice(0,24).map(group => {
    const competitions = ["singles","doubles","shift_wars"].map(leagueType => {
      const season = group.seasons.find((s:any)=>s.league_type===leagueType);
      const results = group.results.filter((r:ResultRow)=>r.league_type===leagueType && (!season || Number(r.season_id)===Number(season.id)));
      return { leagueType, seasonId:season ? Number(season.id):null, seasonName:season?.name ?? null, championId:season?.champion_id ? Number(season.champion_id):null, championName:season?.champion_name ?? null, isActive:Boolean(season?.is_active), matchCount:results.length };
    });
    const biggest = [...group.results].sort((a:ResultRow,b:ResultRow)=>Number(b.stake)-Number(a.stake))[0];
    const singlesSeason = group.seasons.find((s:any)=>s.league_type==="singles");
    const topPlayer = wins.filter((w:any)=>Number(w.season_id)===Number(singlesSeason?.id)).sort((a:any,b:any)=>Number(b.wins)-Number(a.wins))[0];
    const label = new Date(`${group.monthKey}-15T12:00:00Z`).toLocaleDateString("en-GB", { month:"long", year:"numeric", timeZone:"Europe/London" });
    return { monthKey:group.monthKey, label, isCurrent:group.isCurrent, totalMatches:group.results.length, competitions,
      playerOfMonth:topPlayer ? { playerId:Number(topPlayer.player_id), playerName:topPlayer.player_name, wins:Number(topPlayer.wins) }:null,
      headlineResult:biggest ? { matchKey:biggest.match_key, winnerName:biggest.winner_name, loserName:biggest.loser_name, stake:Number(biggest.stake), playedAt:biggest.played_at }:null };
  });
  res.json({ generatedAt:new Date().toISOString(), reports });
});

export default router;
