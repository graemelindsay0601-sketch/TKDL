import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { logAdminAction } from "../lib/adminAudit";
import { flushDuePushNotifications } from "../services/notificationService";
import { getSeasonAutomationStatus, maybeAutoResetLeagueSeasons } from "../lib/seasonReset";
import { londonMonthKey, londonSeasonName } from "../lib/season-calendar";
import { getStartupStatus } from "../lib/startup-state";
import { deploymentBootstrapKey } from "../lib/deployment-bootstrap";

const router = Router();

router.get("/admin/operations/broadcast-health", requireAdminSession, async (_req, res): Promise<void> => {
  const [editionRows, publishedRows, storyRows, diagnosticRows] = await Promise.all([
    db.execute(sql`
      SELECT id,slot_key,slot_type,status,created_at,published_at,data_cutoff,diagnostic
      FROM broadcast_editions ORDER BY id DESC LIMIT 1
    `),
    db.execute(sql`
      SELECT id,slot_key,slot_type,status,created_at,published_at,data_cutoff,diagnostic
      FROM broadcast_editions WHERE status='PUBLISHED'
      ORDER BY published_at DESC NULLS LAST,id DESC LIMIT 1
    `),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE lifecycle='NEW')::int new_count,
        COUNT(*) FILTER (WHERE lifecycle IN ('HOT','ACTIVE','COOLING'))::int active_count,
        COUNT(*) FILTER (
          WHERE lifecycle IN ('NEW','HOT','ACTIVE','COOLING')
            AND updated_at < NOW()-INTERVAL '14 days'
        )::int stale_count,
        COUNT(*) FILTER (WHERE story_key LIKE '%:superseded:%')::int invalidated_count,
        COUNT(*) FILTER (
          WHERE (lifecycle IN ('NEW','HOT','ACTIVE','COOLING') AND resolved_at IS NOT NULL)
             OR (lifecycle='RESOLVED' AND resolved_at IS NULL)
        )::int invalid_count,
        MAX(updated_at) latest_story_at
      FROM broadcast_stories
    `),
    db.execute(sql`
      SELECT id,slot_key,status,created_at,diagnostic
      FROM broadcast_editions
      WHERE status IN ('FAILED','SKIPPED') OR diagnostic IS NOT NULL
      ORDER BY id DESC LIMIT 5
    `),
  ]);

  const serialiseEdition = (row: any) => row ? ({
    id:Number(row.id), slotKey:row.slot_key, slotType:row.slot_type, status:row.status,
    createdAt:row.created_at, publishedAt:row.published_at, dataCutoff:row.data_cutoff,
    diagnostic:row.diagnostic,
  }) : null;
  const stories:any=storyRows.rows[0]??{};
  res.json({
    generatedAt:new Date().toISOString(),
    latestEdition:serialiseEdition(editionRows.rows[0]),
    lastPublishedEdition:serialiseEdition(publishedRows.rows[0]),
    stories:{
      new:Number(stories.new_count??0), active:Number(stories.active_count??0),
      stale:Number(stories.stale_count??0), invalidated:Number(stories.invalidated_count??0),
      invalid:Number(stories.invalid_count??0), latestUpdatedAt:stories.latest_story_at??null,
    },
    recentDiagnostics:(diagnosticRows.rows as any[]).map(row=>({
      id:Number(row.id),slotKey:row.slot_key,status:row.status,createdAt:row.created_at,diagnostic:row.diagnostic,
    })),
  });
});

router.get("/admin/operations/season-preview", requireAdminSession, async (_req, res): Promise<void> => {
  const [seasons, singles, doubles, shiftWars, playerCountRows] = await Promise.all([
    db.execute(sql`SELECT id,name,league_type,start_date FROM seasons WHERE is_active=true ORDER BY league_type,id DESC`),
    db.execute(sql`
      WITH ranked AS (
        SELECT id,name,points,elo,DENSE_RANK() OVER(ORDER BY points DESC) place
        FROM players WHERE is_active=true AND status='ACTIVE'
      )
      SELECT id,name,points,elo,place FROM ranked WHERE place=1 ORDER BY name
    `),
    db.execute(sql`
      WITH current_season AS (
        SELECT id FROM seasons WHERE league_type='doubles' AND is_active=true ORDER BY id DESC LIMIT 1
      ), leader AS (
        SELECT dt.id,dt.team_name,dt.player1_id,dt.player2_id,dt.player3_id,dt.points,dt.elo
        FROM doubles_teams dt JOIN current_season cs ON cs.id=dt.season_id
        ORDER BY dt.points DESC,dt.elo DESC,dt.id ASC LIMIT 1
      )
      SELECT l.*,
        (SELECT COUNT(*)::int FROM players WHERE is_active=true) active_players,
        COALESCE((SELECT bool_and(p.is_active) FROM players p WHERE p.id IN (l.player1_id,l.player2_id)),false) pair_active
      FROM leader l
    `),
    db.execute(sql`SELECT id,name,points,starting_points,wins,losses FROM shift_wars_teams ORDER BY points DESC,id ASC`),
    db.execute(sql`SELECT COUNT(*)::int count FROM players WHERE is_active=true`),
  ]);
  const now=new Date();
  const nextMonth=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1,0,5));
  const seasonRows=seasons.rows as any[];
  const singlesLeaders=singles.rows as any[];
  const dbl:any=doubles.rows[0]??{};
  const activePlayers=Number((playerCountRows.rows[0] as any)?.count??0);
  const nextTeamCount=activePlayers<2?0:Math.floor(activePlayers/2);
  res.json({
    generatedAt:now.toISOString(), nextSeasonName:londonSeasonName(nextMonth),
    currentSeasons:seasonRows.map(row=>({id:Number(row.id),name:row.name,leagueType:row.league_type,startDate:row.start_date})),
    singles:{
      activePlayers,
      leaders:singlesLeaders.map(row=>({id:Number(row.id),name:row.name,points:Number(row.points),elo:Number(row.elo)})),
      blockedByTie:singlesLeaders.length>1,
      effect:"Active players reset to 25 points; Elo and career records remain.",
    },
    doubles:{
      champion:dbl.team_name??null, championPoints:dbl.points==null?null:Number(dbl.points), activePlayers,
      nextTeamCount, createsThreePlayerTeam:activePlayers>=3&&activePlayers%2===1,
      defendingPairKept:Boolean(dbl.team_name&&dbl.player3_id==null&&dbl.pair_active===true),
      effect:"Current teams and results remain in season history; a fresh draw opens for the new season.",
    },
    shiftWars:{
      champion:(shiftWars.rows[0] as any)?.name??null,
      teams:(shiftWars.rows as any[]).map(row=>({id:Number(row.id),name:row.name,currentPoints:Number(row.points),resetTo:Number(row.starting_points)})),
      effect:"Each department returns to its configured monthly starting points; roster assignments stay in place.",
    },
    writesPerformed:false,
  });
});

router.get("/admin/notifications/delivery-history", requireAdminSession, async (req, res): Promise<void> => {
  const requestedLimit = Number(req.query.limit ?? 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(250, Math.max(10, Math.trunc(requestedLimit))) : 100;
  const result = await db.execute(sql`
    WITH analytics AS (
      SELECT notification_id, MAX(sent_at) sent_at, MAX(opened_at) opened_at,
        MAX(clicked_at) clicked_at, MAX(clicked_link) clicked_link
      FROM notification_analytics GROUP BY notification_id
    )
    SELECT n.id,n.player_id,p.name player_name,n.type,
      COALESCE(n.title,n.message,'Notification') title,n.created_at,n.read_at,
      q.send_after,q.sent_at queue_sent_at,q.attempt_count,q.last_attempt_at,q.last_error,
      a.sent_at analytics_sent_at,a.opened_at,a.clicked_at,a.clicked_link,
      CASE
        WHEN a.clicked_at IS NOT NULL THEN 'clicked'
        WHEN a.opened_at IS NOT NULL THEN 'opened'
        WHEN COALESCE(q.sent_at,a.sent_at) IS NOT NULL THEN 'delivered'
        WHEN q.id IS NOT NULL AND q.attempt_count > 0 THEN 'retrying'
        WHEN q.id IS NOT NULL THEN 'queued'
        ELSE 'in_app'
      END delivery_status
    FROM notifications n
    JOIN players p ON p.id=n.player_id
    LEFT JOIN pending_push_notifications q ON q.notification_id=n.id
    LEFT JOIN analytics a ON a.notification_id=n.id
    ORDER BY n.created_at DESC,n.id DESC
    LIMIT ${limit}
  `);
  res.json((result.rows as any[]).map(row => ({
    id:Number(row.id), playerId:Number(row.player_id), playerName:row.player_name,
    type:row.type, title:row.title, createdAt:row.created_at, readAt:row.read_at,
    sendAfter:row.send_after, sentAt:row.queue_sent_at??row.analytics_sent_at??null,
    attemptCount:Number(row.attempt_count??0), lastAttemptAt:row.last_attempt_at,
    lastError:row.last_error, openedAt:row.opened_at, clickedAt:row.clicked_at,
    clickedLink:row.clicked_link, status:row.delivery_status,
  })));
});

router.get("/admin/operations", requireAdminSession, async (_req, res): Promise<void> => {
  const [seasonRows, queueRows, doublesRows, lockRows, recentRows] = await Promise.all([
    db.execute(sql`
      SELECT id,name,league_type,start_date,end_date
      FROM seasons WHERE is_active=true ORDER BY league_type,id DESC
    `),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE sent_at IS NULL)::int pending,
        COUNT(*) FILTER (WHERE sent_at IS NULL AND send_after<=NOW())::int due,
        COUNT(*) FILTER (WHERE sent_at IS NULL AND attempt_count>0)::int retrying,
        MIN(created_at) FILTER (WHERE sent_at IS NULL) oldest_pending,
        MAX(last_attempt_at) last_attempt,
        (SELECT last_error FROM pending_push_notifications WHERE sent_at IS NULL AND last_error IS NOT NULL ORDER BY last_attempt_at DESC NULLS LAST LIMIT 1) last_error
      FROM pending_push_notifications
    `),
    db.execute(sql`
      WITH current_season AS (
        SELECT id FROM seasons WHERE league_type='doubles' AND is_active=true ORDER BY id DESC LIMIT 1
      ), previous_season AS (
        SELECT id FROM seasons WHERE league_type='doubles' AND is_active=false ORDER BY end_date DESC NULLS LAST,id DESC LIMIT 1
      ), previous_champion AS (
        SELECT dt.player1_id,dt.player2_id,dt.player3_id,dt.team_name
        FROM doubles_teams dt JOIN previous_season ps ON ps.id=dt.season_id
        ORDER BY dt.points DESC,dt.elo DESC,dt.id ASC LIMIT 1
      )
      SELECT cs.id season_id,
        (SELECT COUNT(*)::int FROM doubles_teams WHERE season_id=cs.id) team_count,
        (SELECT COUNT(*)::int FROM doubles_teams WHERE season_id=cs.id AND player3_id IS NOT NULL) three_player_teams,
        pc.team_name defending_team,
        (pc.team_name IS NOT NULL AND pc.player3_id IS NULL) defending_pair_available,
        CASE WHEN pc.team_name IS NULL OR pc.player3_id IS NOT NULL THEN NULL ELSE EXISTS(
          SELECT 1 FROM doubles_teams dt WHERE dt.season_id=cs.id AND dt.player3_id IS NULL
          AND ((dt.player1_id=pc.player1_id AND dt.player2_id=pc.player2_id) OR (dt.player1_id=pc.player2_id AND dt.player2_id=pc.player1_id))
        ) END defending_pair_kept
      FROM current_season cs LEFT JOIN previous_champion pc ON true
    `),
    db.execute(sql`SELECT league_type,locked_at FROM season_reset_lock WHERE locked_at IS NOT NULL ORDER BY league_type`),
    db.execute(sql`SELECT action,created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 1`),
  ]);

  const now = new Date();
  const londonNow = new Intl.DateTimeFormat("en-GB", { timeZone:"Europe/London", dateStyle:"medium", timeStyle:"short", hourCycle:"h23" }).format(now);
  const currentMonthKey = londonMonthKey(now);
  const seasons = (seasonRows.rows as any[]).map(row => ({
    id:Number(row.id), name:row.name, leagueType:row.league_type, startDate:row.start_date,
    currentMonth:String(row.start_date).slice(0,7) === currentMonthKey,
  }));
  const queue:any = queueRows.rows[0] ?? {};
  const doubles:any = doublesRows.rows[0] ?? {};
  res.json({
    generatedAt:new Date().toISOString(), database:"online", londonNow,
    seasonAutomation:{...getSeasonAutomationStatus(),schedule:"League midnight plus hourly recovery at 5 minutes past"},
    seasons,
    notificationQueue:{ pending:Number(queue.pending??0),due:Number(queue.due??0),retrying:Number(queue.retrying??0),oldestPending:queue.oldest_pending??null,lastAttempt:queue.last_attempt??null,lastError:queue.last_error??null },
    doubles:{ seasonId:doubles.season_id?Number(doubles.season_id):null,teamCount:Number(doubles.team_count??0),threePlayerTeams:Number(doubles.three_player_teams??0),defendingTeam:doubles.defending_team??null,defendingPairAvailable:doubles.defending_pair_available===true,defendingPairKept:doubles.defending_pair_kept??null },
    resetLocks:(lockRows.rows as any[]).map(row=>({leagueType:row.league_type,lockedAt:row.locked_at})),
    lastAdminAction:recentRows.rows[0]??null,
  });
});

router.get("/admin/operations/deployment-health", requireAdminSession, async (_req, res): Promise<void> => {
  const versionKey=deploymentBootstrapKey();
  const [tableRows,scoringRows,standingRows,seasonRows,queueRows,broadcastRows,bootstrapRows]=await Promise.all([
    db.execute(sql`
      SELECT name,to_regclass(name) IS NOT NULL present FROM unnest(ARRAY[
        'matches','match_participants','doubles_matches','doubles_combined_matches','doubles_multi_matches',
        'shift_wars_matches','shift_wars_combined_matches','shift_wars_multi_matches','match_posters',
        'notifications','pending_push_notifications','broadcast_editions','broadcast_stories'
      ]) name
    `),
    db.execute(sql`
      SELECT COUNT(*)::int total,MAX(played_at) latest FROM (
        SELECT played_at FROM matches UNION ALL SELECT played_at FROM doubles_matches
        UNION ALL SELECT played_at FROM doubles_combined_matches UNION ALL SELECT played_at FROM doubles_multi_matches
        UNION ALL SELECT played_at FROM shift_wars_matches UNION ALL SELECT played_at FROM shift_wars_combined_matches
        UNION ALL SELECT played_at FROM shift_wars_multi_matches
      ) results
    `),
    db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM players WHERE points<0) player_negative,
        (SELECT COUNT(*)::int FROM doubles_teams WHERE points<0) doubles_negative,
        (SELECT COUNT(*)::int FROM shift_wars_teams WHERE points<0) shift_negative,
        (SELECT COUNT(*)::int FROM players WHERE season_games_played<>season_wins+season_losses) record_mismatch
    `),
    db.execute(sql`SELECT league_type,COUNT(*)::int count,BOOL_AND(TO_CHAR(start_date,'YYYY-MM')=${londonMonthKey(new Date())}) current_month FROM seasons WHERE is_active=true GROUP BY league_type`),
    db.execute(sql`
      SELECT COUNT(*) FILTER(WHERE sent_at IS NULL AND send_after<=NOW())::int due,
        COUNT(*) FILTER(WHERE sent_at IS NULL AND send_after<NOW()-INTERVAL '15 minutes')::int overdue,
        COUNT(*) FILTER(WHERE sent_at IS NULL AND attempt_count>0)::int retrying,
        MAX(last_attempt_at) last_attempt
      FROM pending_push_notifications
    `),
    db.execute(sql`
      SELECT
        (SELECT status FROM broadcast_editions ORDER BY id DESC LIMIT 1) latest_status,
        (SELECT published_at FROM broadcast_editions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST,id DESC LIMIT 1) latest_published,
        (SELECT COUNT(*)::int FROM broadcast_stories WHERE lifecycle IN ('NEW','HOT','ACTIVE','COOLING')) active_stories,
        (SELECT COUNT(*)::int FROM broadcast_editions WHERE status='FAILED' AND created_at>NOW()-INTERVAL '7 days') recent_failures
    `),
    versionKey?db.execute(sql`SELECT completed_at FROM app_bootstrap_versions WHERE version_key=${versionKey} LIMIT 1`):Promise.resolve({rows:[{completed_at:null}]}) as any,
  ]);
  const missing=(tableRows.rows as any[]).filter(row=>!row.present).map(row=>String(row.name));
  const scoring:any=scoringRows.rows[0]??{};
  const standings:any=standingRows.rows[0]??{};
  const queue:any=queueRows.rows[0]??{};
  const broadcast:any=broadcastRows.rows[0]??{};
  const startup=getStartupStatus();
  const activeSeasons=new Map((seasonRows.rows as any[]).map(row=>[String(row.league_type),{count:Number(row.count),current:row.current_month===true}]));
  const seasonReady=["singles","doubles","shift_wars"].every(type=>activeSeasons.get(type)?.count===1&&activeSeasons.get(type)?.current);
  const negative=Number(standings.player_negative??0)+Number(standings.doubles_negative??0)+Number(standings.shift_negative??0);
  const checks=[
    {key:"deployment",label:"Deployment & schema",status:missing.length||!startup.ready||(versionKey&&!bootstrapRows.rows.length)?"fail":"pass",detail:missing.length?`Missing tables: ${missing.join(", ")}`:!startup.ready?startup.message:versionKey?`Bootstrap complete for ${versionKey.slice(0,8)}`:"Local development schema ready"},
    {key:"scoring",label:"Scoring pipeline",status:missing.some(x=>["matches","match_participants","doubles_matches","shift_wars_matches"].includes(x))?"fail":"pass",detail:`${Number(scoring.total??0)} stored results${scoring.latest?` · latest ${new Date(scoring.latest).toLocaleString("en-GB",{timeZone:"Europe/London"})}`:""}`},
    {key:"standings",label:"Standings integrity",status:negative||Number(standings.record_mismatch??0)?"fail":"pass",detail:negative||Number(standings.record_mismatch??0)?`${negative} negative balances · ${Number(standings.record_mismatch??0)} player record mismatches`:"Balances and player totals are consistent"},
    {key:"notifications",label:"Notification delivery",status:Number(queue.overdue??0)>0?"review":"pass",detail:Number(queue.overdue??0)>0?`${Number(queue.overdue)} notifications overdue by 15+ minutes`:`${Number(queue.due??0)} due · ${Number(queue.retrying??0)} retrying`},
    {key:"seasons",label:"Monthly season rollover",status:seasonReady?"pass":"fail",detail:seasonReady?"Singles, Doubles and Shift Wars are on the current London month":"One or more competitions needs a current monthly season"},
    {key:"broadcast",label:"TKDL LIVE",status:Number(broadcast.recent_failures??0)>0?"review":broadcast.latest_status?"pass":"review",detail:broadcast.latest_status?`${broadcast.latest_status} latest edition · ${Number(broadcast.active_stories??0)} active stories${Number(broadcast.recent_failures??0)?` · ${Number(broadcast.recent_failures)} recent failures`:""}`:"No broadcast edition has been generated yet"},
  ] as const;
  const overall=checks.some(check=>check.status==="fail")?"attention":checks.some(check=>check.status==="review")?"review":"healthy";
  res.json({generatedAt:new Date().toISOString(),overall,versionKey,startup,checks});
});

router.post("/admin/operations/retry-notifications", requireAdminSession, async (req, res): Promise<void> => {
  const result = await flushDuePushNotifications();
  void logAdminAction(req,"notifications.retry_due","notification_queue",null,result);
  res.json({ok:true,...result});
});

router.post("/admin/operations/run-season-check", requireAdminSession, async (req, res): Promise<void> => {
  await maybeAutoResetLeagueSeasons();
  void logAdminAction(req,"season.automation_check","season",null,{});
  res.json({ok:true,checkedAt:new Date().toISOString()});
});

router.get("/admin/integrity-health", requireAdminSession, async (_req, res): Promise<void> => {
  const [seasonRows, negativeRows, recordRows, orphanRows, malformedTeamRows, shiftSeasonRows, duplicateUnlockRows, orphanUnlockRows, legacyRollbackRows, doublesUnlockRows, activityRows, inactiveRows, titleTieRows, acknowledgementRows, lifecycleRows] = await Promise.all([
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
    db.execute(sql`SELECT id,name,is_active,status FROM players WHERE (is_active=true AND status='INACTIVE') OR (is_active=false AND status<>'INACTIVE') ORDER BY name`),
  ]);

  const issues: any[] = [];
  const active = new Map((seasonRows.rows as any[]).map(r => [String(r.league_type), Number(r.count)]));
  for (const league of ["singles", "doubles", "shift_wars"]) {
    const count = active.get(league) ?? 0;
    if (count !== 1) issues.push({ area:"Seasons", severity:"error", title:`${league.replace("_", " ")} has ${count} active seasons`, detail:"Each competition should have exactly one active season.", action:"Open season management and check which season should be current before changing anything.", href:"/admin" });
  }
  for (const row of negativeRows.rows as any[]) issues.push({ area:"Balances", severity:"error", title:`${row.entity_name} has ${row.value} points`, detail:`Negative balance on ${row.entity_type.toLowerCase()}.`, action:"Check recent results and the admin audit before correcting the balance.", href:row.entity_type==="Player"?`/players/${row.entity_id}`:undefined });
  for (const row of recordRows.rows as any[]) issues.push({ area:"Player records", severity:"error", title:`${row.name}'s played totals do not add up`, detail:`Season ${row.season_games_played} vs ${Number(row.season_wins)+Number(row.season_losses)}; career ${row.career_games_played} vs ${Number(row.career_wins)+Number(row.career_losses)}.`, action:"Compare the player's match history with their totals before editing the record.", href:`/players/${row.id}` });
  for(const row of lifecycleRows.rows as any[])issues.push({area:"Player access",severity:"warning",title:`${row.name} has conflicting league status`,detail:`League access is ${row.is_active?"on":"off"}, but their record status is ${row.status}.`,action:"Open Roster and toggle League access off and on once to synchronise the record.",href:"/admin"});
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
    { name:"Player lifecycle", status:lifecycleRows.rows.length?"review":"pass", detail:lifecycleRows.rows.length?`${lifecycleRows.rows.length} access/status mismatches`:"League access and status agree" },
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
