import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { logAdminAction } from "../lib/adminAudit";

const router = Router();

router.get("/admin/integrity-health", requireAdminSession, async (_req, res): Promise<void> => {
  const [seasonRows, negativeRows, recordRows, orphanRows, malformedTeamRows, shiftSeasonRows, duplicateUnlockRows, orphanUnlockRows, legacyRollbackRows, doublesUnlockRows, activityRows, inactiveRows, titleTieRows, acknowledgementRows] = await Promise.all([
    db.execute(sql`SELECT league_type, COUNT(*)::int count FROM seasons WHERE is_active=true GROUP BY league_type`),
    db.execute(sql`
      SELECT 'Player' entity_type, id entity_id, name entity_name, points value FROM players WHERE points < 0
      UNION ALL SELECT 'Doubles team', id, team_name, points FROM doubles_teams WHERE points < 0
      UNION ALL SELECT 'Shift Wars team', id, name, points FROM shift_wars_teams WHERE points < 0
    `),
    db.execute(sql`SELECT id, name, season_games_played, season_wins, season_losses, career_games_played, career_wins, career_losses FROM players WHERE season_games_played <> season_wins + season_losses OR career_games_played <> career_wins + career_losses`),
    db.execute(sql`SELECT mp.id, mp.match_id, mp.player_name FROM match_participants mp LEFT JOIN matches m ON m.id=mp.match_id LEFT JOIN players p ON p.id=mp.player_id WHERE m.id IS NULL OR p.id IS NULL`),
    db.execute(sql`SELECT m.id, m.game_type, COUNT(mp.id)::int participant_count FROM matches m LEFT JOIN match_participants mp ON mp.match_id=m.id WHERE m.game_type LIKE 'team_%' OR m.game_type='multi_killer' GROUP BY m.id,m.game_type HAVING COUNT(mp.id) < 2`),
    db.execute(sql`SELECT (SELECT COUNT(*)::int FROM shift_wars_matches WHERE season_id IS NULL) standard_count, (SELECT COUNT(*)::int FROM shift_wars_combined_matches WHERE season_id IS NULL) combined_count`),
    db.execute(sql`SELECT player_id, achievement_id, season_id, COUNT(*)::int count FROM player_achievements GROUP BY player_id,achievement_id,season_id HAVING COUNT(*) > 1`),
    db.execute(sql`SELECT pa.id, pa.player_id, pa.achievement_id FROM player_achievements pa LEFT JOIN players p ON p.id=pa.player_id LEFT JOIN achievements a ON a.id=pa.achievement_id WHERE p.id IS NULL OR a.id IS NULL`),
    db.execute(sql`SELECT (SELECT COUNT(*)::int FROM match_participants WHERE points_delta IS NULL OR elo_delta IS NULL) participant_rows, (SELECT COUNT(*)::int FROM doubles_matches WHERE winner_elo_delta IS NULL OR loser_elo_delta IS NULL) doubles_rows`),
    db.execute(sql`
      SELECT DISTINCT p.id player_id, p.name player_name, a.key, a.name achievement_name,
        COALESCE((SELECT MAX(dt.wins) FROM doubles_teams dt WHERE p.id IN (dt.player1_id,dt.player2_id,dt.player3_id)),0)::int best_team_wins
      FROM player_achievements pa JOIN players p ON p.id=pa.player_id JOIN achievements a ON a.id=pa.achievement_id
      WHERE a.key IN ('DBL_FIRST_WIN','DBL_TEAM_WINS_10','DBL_TEAM_WINS_20','DBL_TEAM_WINS_35')
    `),
    db.execute(sql`
      SELECT format, COUNT(*) FILTER (WHERE played_at >= NOW()-INTERVAL '7 days')::int week_count,
        COUNT(*) FILTER (WHERE played_at >= NOW()-INTERVAL '14 days')::int fortnight_count
      FROM (
        SELECT 'Singles & teams' format, played_at FROM matches
        UNION ALL SELECT 'Doubles', played_at FROM doubles_matches
        UNION ALL SELECT 'Doubles', played_at FROM doubles_combined_matches
        UNION ALL SELECT 'Shift Wars', played_at FROM shift_wars_matches
        UNION ALL SELECT 'Shift Wars', played_at FROM shift_wars_combined_matches
      ) activity GROUP BY format ORDER BY format
    `),
    db.execute(sql`
      WITH appearances AS (
        SELECT winner_id player_id, MAX(played_at) last_played FROM matches GROUP BY winner_id
        UNION ALL SELECT loser_id, MAX(played_at) FROM matches GROUP BY loser_id
        UNION ALL SELECT mp.player_id, MAX(m.played_at) FROM match_participants mp JOIN matches m ON m.id=mp.match_id GROUP BY mp.player_id
      ), latest AS (SELECT player_id, MAX(last_played) last_played FROM appearances GROUP BY player_id)
      SELECT p.id, p.name, l.last_played FROM players p LEFT JOIN latest l ON l.player_id=p.id
      WHERE p.is_active=true AND p.status <> 'ELIMINATED' AND (l.last_played IS NULL OR l.last_played < NOW()-INTERVAL '21 days')
      ORDER BY l.last_played NULLS FIRST, p.name
    `),
    db.execute(sql`
      WITH ranked AS (SELECT id,name,points,DENSE_RANK() OVER(ORDER BY points DESC) place FROM players WHERE is_active=true AND status <> 'ELIMINATED')
      SELECT id,name,points FROM ranked WHERE place=1 ORDER BY name
    `),
    db.execute(sql`SELECT issue_key, reviewed_at FROM integrity_review_acknowledgements`),
  ]);

  const issues: any[] = [];
  const active = new Map((seasonRows.rows as any[]).map(r => [String(r.league_type), Number(r.count)]));
  for (const league of ["singles", "doubles", "shift_wars"]) {
    const count = active.get(league) ?? 0;
    if (count !== 1) issues.push({ area:"Seasons", severity:"error", title:`${league.replace("_", " ")} has ${count} active seasons`, detail:"Each competition should have exactly one active season.", action:"Open season management and check which season should be current before changing anything.", href:"/admin" });
  }
  for (const row of negativeRows.rows as any[]) issues.push({ area:"Balances", severity:"error", title:`${row.entity_name} has ${row.value} points`, detail:`Negative balance on ${row.entity_type.toLowerCase()}.`, action:"Check recent results and the admin audit before correcting the balance.", href:row.entity_type==="Player"?`/players/${row.entity_id}`:undefined });
  for (const row of recordRows.rows as any[]) issues.push({ area:"Player records", severity:"error", title:`${row.name}'s played totals do not add up`, detail:`Season ${row.season_games_played} vs ${Number(row.season_wins)+Number(row.season_losses)}; career ${row.career_games_played} vs ${Number(row.career_wins)+Number(row.career_losses)}.`, action:"Compare the player's match history with their totals before editing the record.", href:`/players/${row.id}` });
  if (orphanRows.rows.length) issues.push({ area:"Match history", severity:"error", title:`${orphanRows.rows.length} orphaned match participant rows`, detail:"A participant points to a missing match or player.", action:"Inspect the source result and database backup before removing any orphaned row.", href:"/match-centre" });
  if (malformedTeamRows.rows.length) issues.push({ area:"Match history", severity:"error", title:`${malformedTeamRows.rows.length} team results have incomplete participant data`, detail:"These results cannot show or reverse every participant reliably.", action:"Open the first affected report and compare it with the original score sheet.", href:`/match-centre/league-${(malformedTeamRows.rows[0] as any).id}` });
  const missingShift:any=shiftSeasonRows.rows[0] ?? {};
  const missingShiftTotal=Number(missingShift.standard_count??0)+Number(missingShift.combined_count??0);
  if(missingShiftTotal) issues.push({area:"Season history",severity:"warning",title:`${missingShiftTotal} legacy Shift Wars results have no season link`,detail:"They remain visible, but cannot be assigned confidently to a historical season.",action:"Leave these unchanged unless a dated source confirms the correct season.",href:"/match-centre"});
  if(duplicateUnlockRows.rows.length) issues.push({area:"Achievements",severity:"error",title:`${duplicateUnlockRows.rows.length} duplicate achievement unlock groups`,detail:"The same player, achievement and season appears more than once.",action:"Verify the duplicate groups before removing any unlock; rewards may already have been paid."});
  if(orphanUnlockRows.rows.length) issues.push({area:"Achievements",severity:"error",title:`${orphanUnlockRows.rows.length} orphaned achievement unlocks`,detail:"An unlock points to a missing player or achievement definition.",action:"Check the admin audit and a backup before deleting orphaned unlocks."});

  const thresholds:Record<string,number>={DBL_FIRST_WIN:1,DBL_TEAM_WINS_10:10,DBL_TEAM_WINS_20:20,DBL_TEAM_WINS_35:35};
  const acknowledgements=new Map((acknowledgementRows.rows as any[]).map(row=>[String(row.issue_key),row.reviewed_at]));
  const achievementReview=(doublesUnlockRows.rows as any[]).filter(row=>Number(row.best_team_wins)<thresholds[row.key]).map(row=>({
    playerId:Number(row.player_id), playerName:row.player_name, achievementKey:row.key, achievementName:row.achievement_name,
    reason:`Current Doubles records show a best team total of ${row.best_team_wins}; this badge requires ${thresholds[row.key]}. Historical team changes may explain it.`,
    reviewed:acknowledgements.has(`achievement:${row.player_id}:${row.key}`),
    reviewedAt:acknowledgements.get(`achievement:${row.player_id}:${row.key}`)??null,
  })).sort((a,b)=>Number(a.reviewed)-Number(b.reviewed)||a.playerName.localeCompare(b.playerName));
  const unreviewedAchievements=achievementReview.filter(row=>!row.reviewed);
  const legacy:any=legacyRollbackRows.rows[0]??{};
  const checks = [
    { name:"Active seasons", status:["singles","doubles","shift_wars"].every(x=>(active.get(x)??0)===1)?"pass":"fail", detail:"One current season per competition" },
    { name:"Player records", status:recordRows.rows.length?"fail":"pass", detail:`${recordRows.rows.length} mismatched records` },
    { name:"Match links", status:(orphanRows.rows.length||malformedTeamRows.rows.length)?"fail":"pass", detail:`${orphanRows.rows.length} orphan rows, ${malformedTeamRows.rows.length} incomplete team results` },
    { name:"Balances", status:negativeRows.rows.length?"fail":"pass", detail:`${negativeRows.rows.length} negative balances` },
    { name:"Achievement records", status:(duplicateUnlockRows.rows.length||orphanUnlockRows.rows.length)?"fail":unreviewedAchievements.length?"review":"pass", detail:unreviewedAchievements.length?`${unreviewedAchievements.length} badges need a manual look`:achievementReview.length?`${achievementReview.length} flagged badges reviewed`:"No badges need a manual look" },
    { name:"Correction coverage", status:(Number(legacy.participant_rows)||Number(legacy.doubles_rows))?"review":"pass", detail:`${Number(legacy.participant_rows??0)+Number(legacy.doubles_rows??0)} legacy rows lack exact rollback deltas` },
  ];
  res.json({
    generatedAt:new Date().toISOString(), status:checks.some(x=>x.status==="fail")?"attention":checks.some(x=>x.status==="review")?"review":"healthy",
    summary:{passed:checks.filter(x=>x.status==="pass").length,review:checks.filter(x=>x.status==="review").length,failed:checks.filter(x=>x.status==="fail").length},
    checks, issues, achievementReview,
    activity:{
      formats:(activityRows.rows as any[]).map(r=>({name:r.format,matchesThisWeek:Number(r.week_count),matchesLast14Days:Number(r.fortnight_count),quiet:Number(r.fortnight_count)===0})),
      totalThisWeek:(activityRows.rows as any[]).reduce((n,r)=>n+Number(r.week_count),0),
      inactivePlayers:(inactiveRows.rows as any[]).map(r=>({id:Number(r.id),name:r.name,lastPlayed:r.last_played})),
      titleLeaders:(titleTieRows.rows as any[]).map(r=>({id:Number(r.id),name:r.name,points:Number(r.points)})),
    },
    note:"This report never removes badges, coins or match records. Achievement flags are for manual review because old roster changes can make a valid award impossible to prove from today's team rows.",
  });
});

router.post("/admin/integrity-health/achievement-review", requireAdminSession, async (req, res): Promise<void> => {
  const playerId=Number(req.body?.playerId);
  const achievementKey=String(req.body?.achievementKey??"");
  const reviewed=req.body?.reviewed===true;
  const validKeys=new Set(["DBL_FIRST_WIN","DBL_TEAM_WINS_10","DBL_TEAM_WINS_20","DBL_TEAM_WINS_35"]);
  if(!Number.isInteger(playerId)||playerId<1||!validKeys.has(achievementKey)){
    res.status(400).json({error:"Invalid achievement review"}); return;
  }
  const issueKey=`achievement:${playerId}:${achievementKey}`;
  if(reviewed){
    const adminPlayerId=(req.session as any)?.playerId??null;
    await db.execute(sql`INSERT INTO integrity_review_acknowledgements (issue_key,reviewed_at,admin_player_id) VALUES (${issueKey},NOW(),${adminPlayerId}) ON CONFLICT (issue_key) DO UPDATE SET reviewed_at=NOW(),admin_player_id=EXCLUDED.admin_player_id`);
  }else{
    await db.execute(sql`DELETE FROM integrity_review_acknowledgements WHERE issue_key=${issueKey}`);
  }
  void logAdminAction(req,reviewed?"integrity.achievement_reviewed":"integrity.achievement_reopened","achievement_review",issueKey,{playerId,achievementKey});
  res.json({ok:true,reviewed});
});

export default router;
