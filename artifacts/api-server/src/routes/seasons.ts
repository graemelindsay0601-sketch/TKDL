import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db, seasonsTable, playersTable, seasonStandingsTable } from "@workspace/db";
import { z } from "zod";
import { performSeasonReset, performDoublesSeasonReset, performShiftWarsSeasonReset, SeasonResetLockedError } from "../lib/seasonReset";
import { calcTier } from "../lib/elo";
import { computeIdentity } from "../lib/identity";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { logAdminAction } from "../lib/adminAudit";
import { getPositionChanges } from "../lib/leaderboardRank";

const GetSeasonParams  = z.object({ id: z.coerce.number().int().positive() });
const ResetSeasonBody  = z.object({ name: z.string().optional() });
const LeagueTypeQuery  = z.object({ leagueType: z.enum(["singles", "doubles", "shift_wars"]).optional().default("singles") });

const router = Router();

// Every existing caller of these two routes predates Doubles/Shift Wars
// having their own season lifecycle and never passes leagueType, so
// defaulting to "singles" keeps them all working unchanged.
router.get("/seasons", async (req, res): Promise<void> => {
  const leagueType = (LeagueTypeQuery.safeParse(req.query).data ?? { leagueType: "singles" as const }).leagueType;
  const seasons = await db.select().from(seasonsTable)
    .where(eq(seasonsTable.leagueType, leagueType))
    .orderBy(desc(seasonsTable.id));
  const allPlayers = await db.select({ id: playersTable.id, name: playersTable.name }).from(playersTable);
  const playerMap = new Map(allPlayers.map(p => [p.id, p.name]));
  const enriched = seasons.map(s => ({
    ...s,
    championName: s.championId ? (playerMap.get(s.championId) ?? null) : s.championName,
  }));
  res.json(enriched);
});

router.get("/seasons/current", async (req, res): Promise<void> => {
  const leagueType = (LeagueTypeQuery.safeParse(req.query).data ?? { leagueType: "singles" as const }).leagueType;
  const [season] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, leagueType)))
    .limit(1);
  res.json(season ?? null);
});

// These three had no auth at all — unlike the playoff routes further down
// this file, which already use requireAdminSession (imported above but
// never applied here). Each one force-ends the active season, crowns a
// champion, and resets every player's/team's points and record, so a plain
// unauthenticated request from anyone who found the URL could wipe the
// league's current standings. Same bug class as the notification-prefs/
// tour-delete fixes elsewhere this session.
router.post("/seasons/reset", requireAdminSession, async (req, res): Promise<void> => {
  const parsed = ResetSeasonBody.safeParse(req.body ?? {});
  const overrideName = parsed.success ? parsed.data.name : undefined;
  try {
    const newSeason = await performSeasonReset(overrideName);
    void logAdminAction(req, "season.reset", "season", newSeason.id, { leagueType: "singles", name: newSeason.name });
    res.status(201).json(newSeason);
  } catch (err) {
    if (err instanceof SeasonResetLockedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }
});

// Doubles and Shift Wars each get their own manual reset trigger now that
// they run independent of the singles season — mirrors /seasons/reset above.
router.post("/seasons/doubles/reset", requireAdminSession, async (req, res): Promise<void> => {
  const parsed = ResetSeasonBody.safeParse(req.body ?? {});
  const overrideName = parsed.success ? parsed.data.name : undefined;
  try {
    const newSeason = await performDoublesSeasonReset(overrideName);
    void logAdminAction(req, "season.reset", "season", newSeason.id, { leagueType: "doubles", name: newSeason.name });
    res.status(201).json(newSeason);
  } catch (err) {
    if (err instanceof SeasonResetLockedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }
});

router.post("/seasons/shift-wars/reset", requireAdminSession, async (req, res): Promise<void> => {
  const parsed = ResetSeasonBody.safeParse(req.body ?? {});
  const overrideName = parsed.success ? parsed.data.name : undefined;
  try {
    const newSeason = await performShiftWarsSeasonReset(overrideName);
    void logAdminAction(req, "season.reset", "season", newSeason.id, { leagueType: "shift_wars", name: newSeason.name });
    res.status(201).json(newSeason);
  } catch (err) {
    if (err instanceof SeasonResetLockedError) { res.status(409).json({ error: err.message }); return; }
    throw err;
  }
});

router.get("/seasons/:id/mvp", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.execute(sql`
    SELECT m.winner_id AS player_id, p.name AS player_name,
           COUNT(*)::int AS wins
    FROM matches m
    JOIN players p ON p.id = m.winner_id
    WHERE m.season_id = ${params.data.id} AND m.winner_id IS NOT NULL
    GROUP BY m.winner_id, p.name
    ORDER BY wins DESC
    LIMIT 1
  `);
  const mvp = rows.rows[0] ?? null;
  res.json(mvp ? { playerId: mvp.player_id, playerName: mvp.player_name, wins: mvp.wins } : null);
});

router.get("/seasons/:id", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, params.data.id));
  if (!season) { res.status(404).json({ error: "Season not found" }); return; }

  const allPlayers = await db.select().from(playersTable);
  const playerMap = new Map(allPlayers.map(p => [p.id, p]));

  const allStandings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, true));
  const titleCounts = new Map<number, number>();
  for (const s of allStandings) titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);

  let standings;
  if (season.isActive) {
    const players = allPlayers.filter(p => p.isActive);
    const active = players.filter(p => p.status !== "ELIMINATED");
    const eliminated = players.filter(p => p.status === "ELIMINATED");
    const sorted = [...active.sort((a,b) => b.points-a.points || b.elo-a.elo), ...eliminated.sort((a,b) => b.points-a.points)];
    // Same live diff as GET /leaderboard (see lib/leaderboardRank.ts) —
    // this branch is the active season, so it's the same ranking, just
    // rendered from the season-detail page instead of the dashboard.
    const currentRanks = new Map(sorted.map((p, i) => [p.id, i + 1]));
    const positionChanges = await getPositionChanges(currentRanks);
    standings = sorted.map((p, i) => {
      const isChampion = (titleCounts.get(p.id) ?? 0) > 0;
      const identity = computeIdentity(p, i+1, isChampion);
      const games = p.seasonWins + p.seasonLosses;
      return {
        position: i+1, positionChange: positionChanges.get(p.id) ?? 0,
        playerId: p.id, playerName: p.name,
        wins: p.seasonWins, losses: p.seasonLosses, gamesPlayed: games,
        points: p.points, peakPoints: p.peakPoints,
        elo: p.elo, tier: calcTier(p.elo),
        winRate: games > 0 ? p.seasonWins/games : 0,
        currentStreak: p.currentWinStreak, status: p.status, ...identity,
      };
    });
  } else {
    const rows = await db.select().from(seasonStandingsTable)
      .where(eq(seasonStandingsTable.seasonId, params.data.id))
      .orderBy(seasonStandingsTable.position);
    standings = rows.map(r => {
      const p = playerMap.get(r.playerId);
      const games = r.wins + r.losses;
      return {
        // A closed season's standings are a frozen end-of-season snapshot
        // (seasonStandingsTable) — there's no "yesterday" to diff against
        // once the season's over, so positionChange is genuinely 0 here,
        // not a stub. Only the active-season branch above has a real one.
        position: r.position, positionChange: 0,
        playerId: r.playerId, playerName: p?.name ?? "Unknown",
        wins: r.wins, losses: r.losses, gamesPlayed: games,
        points: r.points, peakPoints: r.points,
        elo: r.elo, tier: calcTier(r.elo),
        winRate: games > 0 ? r.wins/games : 0,
        currentStreak: 0, status: r.isChampion ? "CHAMPION" : "ACTIVE",
        archetype: "COMPETITOR", archetypeIcon: "🎲",
        aura: "BALANCED", auraColor: "#888899", title: r.isChampion ? "The Champion" : "—",
      };
    });
  }

  res.json({ season, standings });
});

// ── Season match history ───────────────────────────────────────────────────────

router.get("/seasons/:id/matches", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.execute(sql`
    SELECT m.id, m.played_at, m.stake, m.elo_change, m.game_type,
           m.winner_id, m.winner_name, m.loser_id, m.loser_name,
           m.winner_darts, m.winner_100s, m.winner_140s, m.winner_170s, m.winner_180s,
           m.loser_darts, m.loser_100s, m.loser_140s, m.loser_170s, m.loser_180s
    FROM matches m
    WHERE m.season_id = ${params.data.id}
    ORDER BY m.played_at DESC
    LIMIT 200
  `);

  res.json(rows.rows.map((r: any) => ({
    id:          r.id,
    playedAt:    r.played_at,
    stake:       r.stake,
    eloChange:   r.elo_change,
    gameType:    r.game_type,
    winnerId:    r.winner_id,
    winnerName:  r.winner_name,
    loserId:     r.loser_id,
    loserName:   r.loser_name,
    winnerDarts: r.winner_darts,
    winner100s:  r.winner_100s,
    winner140s:  r.winner_140s,
    winner170s:  r.winner_170s,
    winner180s:  r.winner_180s,
    loserDarts:  r.loser_darts,
    loser100s:   r.loser_100s,
    loser140s:   r.loser_140s,
    loser170s:   r.loser_170s,
    loser180s:   r.loser_180s,
  })));
});

// ── Playoff endpoints ──────────────────────────────────────────────────────────

const PlayoffMatchBody = z.object({
  player1Id: z.number().int().positive(),
  player2Id: z.number().int().positive(),
  winnerId:  z.number().int().positive().optional(),
  round:     z.string().default("final"),
  gameType:  z.string().default("Best of 3"),
  notes:     z.string().optional(),
});

router.get("/seasons/:id/playoff", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.execute(
    sql`SELECT pm.*, 
        p1.name as player1_name, p2.name as player2_name, 
        pw.name as winner_name
        FROM playoff_matches pm
        JOIN players p1 ON p1.id = pm.player1_id
        JOIN players p2 ON p2.id = pm.player2_id
        LEFT JOIN players pw ON pw.id = pm.winner_id
        WHERE pm.season_id = ${params.data.id}
        ORDER BY pm.played_at ASC`
  );
  res.json(rows.rows);
});

router.post("/seasons/:id/playoff", requireAdminSession, async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = PlayoffMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { player1Id, player2Id, winnerId, round, gameType, notes } = parsed.data;

  // Recording the match and — when it's the deciding final — crowning the
  // champion (season row + standings) as one transaction: these used to be
  // several separate unguarded statements, so a crash partway through
  // could leave the season row's championId set with season_standings not
  // yet agreeing, or vice versa. Admin-only and a narrow window, but the
  // same fix shape as everywhere else this session.
  const row = await db.transaction(async (tx) => {
    const [inserted] = await tx.execute(
      sql`INSERT INTO playoff_matches (season_id, player1_id, player2_id, winner_id, round, game_type, notes)
          VALUES (${params.data.id}, ${player1Id}, ${player2Id}, ${winnerId ?? null}, ${round}, ${gameType}, ${notes ?? null})
          RETURNING *`
    ) as any;

    // If we have a winner and this is the final, crown them as season champion
    if (winnerId && round === "final") {
      await tx.update(seasonsTable)
        .set({ championId: winnerId, playoffPending: false } as any)
        .where(eq(seasonsTable.id, params.data.id));
      // Update standings isChampion
      await tx.execute(sql`UPDATE season_standings SET is_champion = false WHERE season_id = ${params.data.id}`);
      await tx.execute(sql`UPDATE season_standings SET is_champion = true WHERE season_id = ${params.data.id} AND player_id = ${winnerId}`);
    }

    return inserted;
  });

  void logAdminAction(req, "playoff.match_recorded", "playoff_match", (row as any)?.id ?? null, {
    seasonId: params.data.id, player1Id, player2Id, winnerId: winnerId ?? null, round,
  });

  res.status(201).json(row);
});

router.patch("/seasons/:id/playoff/:matchId", requireAdminSession, async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  const matchId = parseInt((req.params as any).matchId, 10);
  if (!params.success || isNaN(matchId)) { res.status(400).json({ error: "Invalid params" }); return; }
  const parsed = PlayoffMatchBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.winnerId === undefined && parsed.data.notes === undefined && parsed.data.round === undefined) {
    res.status(400).json({ error: "Nothing to update" }); return;
  }

  // Same transactional fix as POST /seasons/:id/playoff above — recording
  // the winner and any resulting champion-crowning as one unit, so a crash
  // partway through can't leave the season row and season_standings
  // disagreeing about who's champion.
  //
  // This used to build a `sets`/`vals` array meant for a dynamic
  // parameterized UPDATE (only touching whichever of winnerId/notes/round
  // was actually sent) but then never used it — the real query below was
  // hardcoded to always overwrite winner_id, and never touched notes/round
  // at all. That meant PATCHing just {notes: "..."} or {round: "semi"}
  // silently reset winner_id to NULL — un-recording a match's winner, and if
  // that match was the deciding final, un-crowning the season champion the
  // row previously reflected. COALESCE against the existing column value
  // keeps a field whenever the request didn't include it.
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      UPDATE playoff_matches SET
        winner_id = COALESCE(${parsed.data.winnerId ?? null}, winner_id),
        notes     = COALESCE(${parsed.data.notes ?? null}, notes),
        round     = COALESCE(${parsed.data.round ?? null}, round)
      WHERE id = ${matchId} AND season_id = ${params.data.id}
    `);

    // Crown champion if final match has winner
    if (parsed.data.winnerId && (parsed.data.round === "final" || !parsed.data.round)) {
      const [match] = (await tx.execute(sql`SELECT round FROM playoff_matches WHERE id = ${matchId}`)).rows as any[];
      if (match?.round === "final") {
        await tx.update(seasonsTable).set({ championId: parsed.data.winnerId, playoffPending: false } as any).where(eq(seasonsTable.id, params.data.id));
        await tx.execute(sql`UPDATE season_standings SET is_champion = false WHERE season_id = ${params.data.id}`);
        await tx.execute(sql`UPDATE season_standings SET is_champion = true WHERE season_id = ${params.data.id} AND player_id = ${parsed.data.winnerId}`);
      }
    }
  });

  void logAdminAction(req, "playoff.match_edit", "playoff_match", matchId, {
    seasonId: params.data.id, winnerId: parsed.data.winnerId, notes: parsed.data.notes, round: parsed.data.round,
  });

  res.json({ ok: true });
});

router.delete("/seasons/:id/playoff/:matchId", requireAdminSession, async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  const matchId = parseInt((req.params as any).matchId, 10);
  if (!params.success || isNaN(matchId)) { res.status(400).json({ error: "Invalid params" }); return; }
  await db.execute(sql`DELETE FROM playoff_matches WHERE id = ${matchId} AND season_id = ${params.data.id}`);
  void logAdminAction(req, "playoff.match_delete", "playoff_match", matchId, { seasonId: params.data.id });
  res.json({ ok: true });
});

export default router;
