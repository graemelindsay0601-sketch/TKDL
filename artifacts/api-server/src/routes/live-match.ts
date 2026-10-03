import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { z } from "zod";

const router = Router();
const LIVE_MAX_AGE_MS = 15_000;
const FINISHED_MAX_AGE_MS = 12_000;
const PREMATCH_MAX_AGE_MS = 30 * 60_000;

export type LiveMatch = {
  sessionId: string;
  format: string;
  game: string;
  sides: [string[], string[]];
  status: "prematch" | "live" | "finished";
  winnerSide?: 0 | 1;
  winnerName?: string;
  matchKey?: string;
  score: null | { mode: "x01" | "cricket"; scores: [number, number]; turn: 0 | 1; detail?: [string, string]; currentPlayer?: string; lastVisit?: string; checkout?: string };
  updatedAt: string;
  ownerPlayerId: number;
  presentation?: {
    headline?: string;
    sideA?: { points?: number; elo?: number; form?: string[]; kit?: string };
    sideB?: { points?: number; elo?: number; form?: string[]; kit?: string };
    h2h?: { aWins: number; bWins: number; total: number } | null;
    spotlight?: { level: "featured" | "major"; kicker: string; reason: string };
  };
};

let active: LiveMatch | null = null;
let lastPromoted: { match: Omit<LiveMatch, "ownerPlayerId">; promotedAt: string } | null = null;

function publicMatch(match: LiveMatch): Omit<LiveMatch, "ownerPlayerId"> {
  const { ownerPlayerId: _ownerPlayerId, ...safe } = match;
  return safe;
}

function expireActive(): void {
  if (!active) return;
  const maxAge = active.status === "finished" ? FINISHED_MAX_AGE_MS : active.status === "prematch" ? PREMATCH_MAX_AGE_MS : LIVE_MAX_AGE_MS;
  if (Date.now() - Date.parse(active.updatedAt) > maxAge) active = null;
}

async function readOverride(): Promise<{ action:"PIN"|"DISMISS"; payload:any; expiresAt:string } | null> {
  const result = await db.execute(sql`SELECT action, payload, expires_at FROM match_spotlight_override WHERE id=1`);
  const row:any=result.rows[0];
  if(!row)return null;
  if(Date.parse(row.expires_at)<=Date.now()){await db.execute(sql`DELETE FROM match_spotlight_override WHERE id=1`);return null;}
  return {action:row.action,payload:row.payload,expiresAt:new Date(row.expires_at).toISOString()};
}

router.get("/live-match", (_req, res) => {
  expireActive();
  res.set("Cache-Control", "no-store");
  res.json({ active: active ? publicMatch(active) : null });
});

router.get("/match-spotlight", async (_req, res): Promise<void> => {
  expireActive();
  const override=await readOverride().catch(()=>null);
  if(override?.action==="DISMISS"){res.set("Cache-Control","no-store");res.json({spotlight:null,source:"dismissed"});return;}
  if(override?.action==="PIN"&&override.payload){res.set("Cache-Control","no-store");res.json({spotlight:override.payload,source:"pinned"});return;}
  const current = active?.presentation?.spotlight ? publicMatch(active) : null;
  const fallback = lastPromoted && Date.now() - Date.parse(lastPromoted.promotedAt) < 6 * 60 * 60_000 ? lastPromoted.match : null;
  res.set("Cache-Control", "no-store");
  if (current || fallback) { res.json({ spotlight: current ?? fallback }); return; }

  // Recover the latest notable persisted result directly from every league
  // table. This makes the Hub/TKDL LIVE promotion survive Render sleeps and
  // also catches results submitted without first using Matchday Control.
  try {
    const result = await db.execute(sql`
      WITH recent_results AS (
        SELECT 'league-' || m.id AS match_key, 'Singles' AS format, m.played_at,
          m.winner_name, m.loser_name, m.stake, m.was_upset_win
        FROM matches m WHERE m.played_at > NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT 'doubles-' || m.id, 'Doubles Event', m.played_at,
          wt.team_name, lt.team_name, m.stake, false
        FROM doubles_matches m JOIN doubles_teams wt ON wt.id=m.winner_team_id JOIN doubles_teams lt ON lt.id=m.loser_team_id
        WHERE m.played_at > NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT 'shift-' || m.id, 'Shift Wars', m.played_at,
          wt.name, lt.name, m.stake, false
        FROM shift_wars_matches m JOIN shift_wars_teams wt ON wt.id=m.winner_team_id JOIN shift_wars_teams lt ON lt.id=m.loser_team_id
        WHERE m.played_at > NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT 'doubles-combined-' || m.id, 'Doubles Event', m.played_at,
          CASE WHEN m.solo_won THEN st.team_name ELSE (SELECT string_agg(t.team_name, ' + ' ORDER BY x.id) FROM doubles_combined_match_sides x JOIN doubles_teams t ON t.id=x.team_id WHERE x.match_id=m.id) END,
          CASE WHEN m.solo_won THEN (SELECT string_agg(t.team_name, ' + ' ORDER BY x.id) FROM doubles_combined_match_sides x JOIN doubles_teams t ON t.id=x.team_id WHERE x.match_id=m.id) ELSE st.team_name END,
          m.pot, false
        FROM doubles_combined_matches m JOIN doubles_teams st ON st.id=m.solo_team_id WHERE m.played_at > NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT 'shift-combined-' || m.id, 'Shift Wars', m.played_at,
          CASE WHEN m.solo_won THEN st.name ELSE (SELECT string_agg(t.name, ' + ' ORDER BY x.id) FROM shift_wars_combined_match_sides x JOIN shift_wars_teams t ON t.id=x.team_id WHERE x.match_id=m.id) END,
          CASE WHEN m.solo_won THEN (SELECT string_agg(t.name, ' + ' ORDER BY x.id) FROM shift_wars_combined_match_sides x JOIN shift_wars_teams t ON t.id=x.team_id WHERE x.match_id=m.id) ELSE st.name END,
          m.pot, false
        FROM shift_wars_combined_matches m JOIN shift_wars_teams st ON st.id=m.solo_team_id WHERE m.played_at > NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT 'doubles-multi-' || m.id, 'Doubles Event', m.played_at, wt.team_name,
          (SELECT string_agg(t.team_name, ' + ' ORDER BY p.id) FROM doubles_multi_match_participants p JOIN doubles_teams t ON t.id=p.team_id WHERE p.match_id=m.id AND p.is_winner=false), m.pot, false
        FROM doubles_multi_matches m JOIN doubles_teams wt ON wt.id=m.winner_team_id WHERE m.played_at > NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT 'shift-multi-' || m.id, 'Shift Wars', m.played_at, wt.name,
          (SELECT string_agg(t.name, ' + ' ORDER BY p.id) FROM shift_wars_multi_match_participants p JOIN shift_wars_teams t ON t.id=p.team_id WHERE p.match_id=m.id AND p.is_winner=false), m.pot, false
        FROM shift_wars_multi_matches m JOIN shift_wars_teams wt ON wt.id=m.winner_team_id WHERE m.played_at > NOW() - INTERVAL '24 hours'
      ) SELECT * FROM recent_results ORDER BY played_at DESC LIMIT 30
    `);
    const deadlineWindow = new Date().getDate() >= new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - 1;
    const row = (result.rows as any[]).find(item => Boolean(item.was_upset_win) || Number(item.stake) >= (deadlineWindow ? 5 : 10));
    if (!row) { res.json({ spotlight: null }); return; }
    const reason = row.was_upset_win
      ? `${row.winner_name} produced an upset result against ${row.loser_name}`
      : deadlineWindow ? `${row.winner_name} took a deadline-day result worth ${row.stake} points` : `${row.winner_name} won a high-stakes contest worth ${row.stake} points`;
    res.json({ spotlight: {
      sessionId: `result-${row.match_key}`, matchKey: row.match_key, format: row.format, game: "Match Result",
      sides: [[row.winner_name], [row.loser_name]], status: "finished", winnerSide: 0, winnerName: row.winner_name,
      score: null, updatedAt: new Date(row.played_at).toISOString(),
      presentation: { headline: row.was_upset_win ? "SHOCK RESULT" : deadlineWindow ? "DEADLINE DAY RESULT" : "BIG RESULT", spotlight: { level: row.was_upset_win || deadlineWindow ? "major" : "featured", kicker: row.was_upset_win ? "SHOCK RESULT" : deadlineWindow ? "DEADLINE DAY" : "BIG RESULT", reason } },
    } });
  } catch (err) {
    _req.log.error({ err }, "GET /match-spotlight failed");
    res.json({ spotlight: null });
  }
});

router.get("/admin/match-spotlight",requireAdminSession,async(_req,res):Promise<void>=>{
  res.json({override:await readOverride()});
});

const SpotlightControl=z.discriminatedUnion("action",[
  z.object({action:z.literal("automatic")}),
  z.object({action:z.literal("dismiss"),hours:z.number().min(1).max(168)}),
  z.object({action:z.literal("pin"),hours:z.number().min(1).max(168),format:z.string().min(1).max(80),sideA:z.string().min(1).max(160),sideB:z.string().min(1).max(160),kicker:z.string().min(1).max(40),reason:z.string().min(1).max(180),matchKey:z.string().max(100).optional()}),
]);
router.put("/admin/match-spotlight",requireAdminSession,async(req,res):Promise<void>=>{
  const parsed=SpotlightControl.safeParse(req.body);
  if(!parsed.success){res.status(400).json({error:"Invalid spotlight control"});return;}
  if(parsed.data.action==="automatic"){await db.execute(sql`DELETE FROM match_spotlight_override WHERE id=1`);res.json({override:null});return;}
  const expiresAt=new Date(Date.now()+parsed.data.hours*3_600_000);
  const payload=parsed.data.action==="pin"?{
    sessionId:`admin-spotlight-${Date.now()}`,matchKey:parsed.data.matchKey,format:parsed.data.format,game:"Admin Spotlight",sides:[[parsed.data.sideA],[parsed.data.sideB]],status:"prematch",score:null,updatedAt:new Date().toISOString(),presentation:{headline:parsed.data.kicker,spotlight:{level:"major",kicker:parsed.data.kicker,reason:parsed.data.reason}},
  }:null;
  await db.execute(sql`INSERT INTO match_spotlight_override(id,action,payload,expires_at,updated_at) VALUES(1,${parsed.data.action==="pin"?"PIN":"DISMISS"},${payload?JSON.stringify(payload):null}::jsonb,${expiresAt},NOW()) ON CONFLICT(id) DO UPDATE SET action=EXCLUDED.action,payload=EXCLUDED.payload,expires_at=EXCLUDED.expires_at,updated_at=NOW()`);
  res.json({override:{action:parsed.data.action==="pin"?"PIN":"DISMISS",payload,expiresAt:expiresAt.toISOString()}});
});

router.put("/live-match", async (req, res): Promise<void> => {
  const ownerPlayerId = Number((req.session as any)?.playerId);
  if (!Number.isInteger(ownerPlayerId) || ownerPlayerId < 1) { res.status(401).json({ error: "Login required" }); return; }
  const body = req.body as Partial<LiveMatch>;
  if (typeof body.sessionId !== "string" || body.sessionId.length < 8 || body.sessionId.length > 100 ||
      typeof body.format !== "string" || typeof body.game !== "string" ||
      !Array.isArray(body.sides) || body.sides.length !== 2 ||
      !body.sides.every(side => Array.isArray(side) && side.length > 0 && side.length <= 12 && side.every(name => typeof name === "string" && name.length <= 80))) {
    res.status(400).json({ error: "Invalid live match update" });
    return;
  }
  const score = body.score;
  if (score != null && (typeof score !== "object" || !["x01", "cricket"].includes(score.mode) ||
      !Array.isArray(score.scores) || score.scores.length !== 2 || score.scores.some(value => !Number.isFinite(value)) ||
      (score.turn !== 0 && score.turn !== 1) ||
      (score.lastVisit !== undefined && (typeof score.lastVisit !== "string" || score.lastVisit.length > 120)) ||
      (score.checkout !== undefined && (typeof score.checkout !== "string" || score.checkout.length > 120)))) {
    res.status(400).json({ error: "Invalid live score" });
    return;
  }
  const retainedPresentation = active?.sessionId === body.sessionId ? active.presentation : undefined;
  active = {
    sessionId: body.sessionId,
    format: body.format.slice(0, 80),
    game: body.game.slice(0, 80),
    sides: body.sides.map(side => side.map(name => name.trim()).filter(Boolean)) as [string[], string[]],
    score: score ?? null,
    status: body.status === "finished" ? "finished" : body.status === "prematch" ? "prematch" : "live",
    ...((body.presentation && typeof body.presentation === "object") || retainedPresentation ? { presentation: (body.presentation && typeof body.presentation === "object") ? body.presentation : retainedPresentation } : {}),
    ...(body.status === "finished" && (body.winnerSide === 0 || body.winnerSide === 1)
      ? { winnerSide: body.winnerSide, winnerName: typeof body.winnerName === "string" ? body.winnerName.slice(0, 160) : body.sides[body.winnerSide].join(" & ") }
      : {}),
    updatedAt: new Date().toISOString(),
    ownerPlayerId,
  };
  if (active.presentation?.spotlight) lastPromoted = { match: publicMatch(active), promotedAt: active.updatedAt };
  // Save the poster ingredients, not a binary PNG. The browser can recreate
  // the original full-resolution graphic at any time without object storage.
  try {
    if (active.status === "prematch") {
      const leagueType=active.format.toLowerCase().includes("double")?"doubles":active.format.toLowerCase().includes("shift")?"shift_wars":"singles";
      await db.execute(sql`INSERT INTO match_posters(session_id,format,side_a,side_b,kicker,reason,level,side_a_points,side_b_points,status,created_by,season_id,season_name,updated_at) SELECT ${active.sessionId},${active.format},${active.sides[0].join(" & ")},${active.sides[1].join(" & ")},${active.presentation?.spotlight?.kicker ?? "MATCHDAY"},${active.presentation?.spotlight?.reason ?? null},${active.presentation?.spotlight?.level ?? "standard"},${active.presentation?.sideA?.points ?? null},${active.presentation?.sideB?.points ?? null},'prematch',${ownerPlayerId},s.id,s.name,NOW() FROM seasons s WHERE s.is_active=true AND s.league_type=${leagueType} ORDER BY s.id DESC LIMIT 1 ON CONFLICT(session_id) DO UPDATE SET format=EXCLUDED.format,side_a=EXCLUDED.side_a,side_b=EXCLUDED.side_b,kicker=EXCLUDED.kicker,reason=EXCLUDED.reason,level=EXCLUDED.level,side_a_points=EXCLUDED.side_a_points,side_b_points=EXCLUDED.side_b_points,season_id=EXCLUDED.season_id,season_name=EXCLUDED.season_name,updated_at=NOW()`);
    } else if (active.status === "finished") {
      await db.execute(sql`UPDATE match_posters SET status='finished',winner_name=${active.winnerName ?? null},match_key=${active.matchKey ?? null},updated_at=NOW() WHERE session_id=${active.sessionId}`);
    }
  } catch (err) { req.log.warn({err},"Could not update Match Poster Library"); }
  res.json({ ok: true });
});

router.get("/match-posters",async(_req,res):Promise<void>=>{
  try{const result=await db.execute(sql`SELECT id,session_id,format,side_a,side_b,kicker,reason,level,side_a_points,side_b_points,status,winner_name,match_key,season_id,season_name,created_at FROM match_posters ORDER BY created_at DESC LIMIT 120`);res.json((result.rows as any[]).map(row=>({id:row.id,sessionId:row.session_id,format:row.format,sideA:row.side_a,sideB:row.side_b,kicker:row.kicker,reason:row.reason,level:row.level,sideAPoints:row.side_a_points,sideBPoints:row.side_b_points,status:row.status,winnerName:row.winner_name,matchKey:row.match_key,seasonId:row.season_id,seasonName:row.season_name,createdAt:new Date(row.created_at).toISOString()})));}catch(err){_req.log.error({err},"GET /match-posters failed");res.status(500).json({error:"Poster library unavailable"});}
});

router.delete("/live-match/:sessionId", (req, res) => {
  const ownerPlayerId = Number((req.session as any)?.playerId);
  if (active?.sessionId === req.params.sessionId && active.ownerPlayerId === ownerPlayerId) active = null;
  res.sendStatus(204);
});

export default router;
