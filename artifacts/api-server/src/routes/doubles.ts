import { Router } from "express";
import { wagerPot } from "../lib/wager-pot";
import { eq, and, sql } from "drizzle-orm";
import { db, seasonsTable } from "@workspace/db";
import { z } from "zod";
import { applyEloChange, calcEloChange, calcTier, ELO_FLOOR } from "../lib/elo";
import { validateStake, applyWager, combinedPot, validateCombinedStake, applyCombinedWager, splitProportional, multiMatchPot, validateMultiStake, applyMultiWager } from "../lib/wager";
import { matchSubmitRateLimit } from "../middleware/writeRateLimit";
import { sendDoublesMatchResultNotification, sendMatchResultBroadcast, sendRankChangeNotifications } from "../services/notificationService";
import { createAutoPost } from "../lib/communityNotify";
import { checkDoublesAchievements } from "../lib/doubles-achievements";
import { rankDoublesTeams, type RankableDoublesTeam } from "../lib/leaderboardRank";
import { upsertResultPoster } from "../services/matchPosterService";

const GetSeasonParams = z.object({ id: z.coerce.number().int().positive() });

const RecordDoublesMatchBody = z.object({
  winnerTeamId: z.number().int().positive(),
  loserTeamId:  z.number().int().positive(),
  stake:        z.number().int().min(1), // Rules minimum is 1 — see wager.ts validateStake for why 0 has no legitimate case here.
  stakeMode: z.enum(["per-player", "total"]).optional().default("per-player"),
  gameType:     z.string().optional().default("doubles_501"),
  notes:        z.string().optional(),
  // Fielded counts support legacy per-player wagers. Total mode moves
  // the entered stake between official team accounts regardless of count.
  winnerFieldedCount: z.number().int().positive().max(3).optional().default(1),
  loserFieldedCount:  z.number().int().positive().max(3).optional().default(1),
  // Optional client-supplied key — see db/migrations/add_match_result_idempotency.ts.
  idempotencyKey: z.string().min(1).max(100).optional(),
});

// A "combined side" match: one official pairing (solo) plays a single live
// game against a temporary group made up of two or more OTHER official
// pairings (combined) — e.g. Graeme's pairing taking on a made-up group
// pulled from two different other pairings, as a handicap. See lib/wager.ts
// (combinedPot/validateCombinedStake/applyCombinedWager) for the settlement
// math and db/migrations/add_combined_matches.ts for the tables this writes
// to. Deliberately a separate endpoint from POST /doubles/matches above —
// that one keeps its existing exactly-two-teams shape untouched.
const RecordDoublesCombinedMatchBody = z.object({
  soloTeamId: z.number().int().positive(),
  soloFieldedCount: z.number().int().positive().max(3).optional().default(1),
  soloWon: z.boolean(),
  combinedTeams: z.array(z.object({
    teamId: z.number().int().positive(),
    fieldedCount: z.number().int().positive().max(3).optional().default(1),
  })).min(2, "A combined side needs at least 2 different pairings"),
  stake: z.number().int().min(1),
  stakeMode: z.enum(["per-player", "total"]).optional().default("per-player"),
  gameType: z.string().optional().default("doubles_501"),
  notes: z.string().optional(),
  // Optional client-supplied key — see db/migrations/add_match_result_idempotency.ts.
  idempotencyKey: z.string().min(1).max(100).optional(),
});

// A "multi-team" match: 3 or more official pairings play ONE live elimination
// game together (MultiKillerScorer on the frontend — the same engine Singles'
// Killer Free-for-All already uses), with a single overall winner. See
// lib/wager.ts (multiMatchPot/validateMultiStake/applyMultiWager) for the
// settlement math and db/migrations/add_multi_matches.ts for the tables this
// writes to. Every losing pairing pays the flat entered stake; the winning
// pairing takes the whole pot in one go — same simple model Killer FFA
// already uses via team-matches.ts, not the combined-side match's
// proportional split (every participant here is a full, independent team).
const RecordDoublesMultiMatchBody = z.object({
  participantTeamIds: z.array(z.number().int().positive()).min(3, "A multi-team match needs at least 3 pairings").max(6),
  winnerTeamId: z.number().int().positive(),
  stake: z.number().int().min(1),
  gameType: z.string().optional().default("doubles_501"),
  notes: z.string().optional(),
  // Optional client-supplied key — see db/migrations/add_match_result_idempotency.ts.
  idempotencyKey: z.string().min(1).max(100).optional(),
});

const router = Router();

class DoublesConflictError extends Error {}

// ── Partnership chemistry across every Doubles season ────────────────────────

router.get("/doubles/chemistry", async (_req, res): Promise<void> => {
  const rows = await db.execute(sql`
    WITH team_members AS (
      SELECT dt.id AS team_id, dt.season_id, dt.wins, dt.losses,
             s.name AS season_name, s.start_date, s.is_active,
             member.player_id
      FROM doubles_teams dt
      JOIN seasons s ON s.id = dt.season_id AND s.league_type = 'doubles'
      CROSS JOIN LATERAL (
        VALUES (dt.player1_id), (dt.player2_id), (dt.player3_id)
      ) AS member(player_id)
      WHERE member.player_id IS NOT NULL
    ), partnerships AS (
      SELECT left_member.player_id AS player1_id,
             right_member.player_id AS player2_id,
             left_member.season_id, left_member.season_name,
             left_member.start_date, left_member.is_active,
             left_member.wins, left_member.losses
      FROM team_members left_member
      JOIN team_members right_member
        ON right_member.team_id = left_member.team_id
       AND right_member.player_id > left_member.player_id
    )
    SELECT partnership.player1_id, p1.name AS player1_name,
           partnership.player2_id, p2.name AS player2_name,
           COUNT(*)::int AS seasons_together,
           SUM(partnership.wins)::int AS wins,
           SUM(partnership.losses)::int AS losses,
           BOOL_OR(partnership.is_active) AS current_pairing,
           (ARRAY_AGG(partnership.season_name ORDER BY partnership.start_date DESC))[1] AS latest_season_name,
           MAX(partnership.start_date) AS last_teamed_at
    FROM partnerships partnership
    JOIN players p1 ON p1.id = partnership.player1_id
    JOIN players p2 ON p2.id = partnership.player2_id
    GROUP BY partnership.player1_id, p1.name, partnership.player2_id, p2.name
    ORDER BY (SUM(partnership.wins) + SUM(partnership.losses)) DESC,
             SUM(partnership.wins) DESC, COUNT(*) DESC,
             p1.name ASC, p2.name ASC
  `);

  res.json((rows.rows as any[]).map(row => {
    const wins = Number(row.wins ?? 0);
    const losses = Number(row.losses ?? 0);
    const matches = wins + losses;
    return {
      player1Id: Number(row.player1_id),
      player1Name: row.player1_name,
      player2Id: Number(row.player2_id),
      player2Name: row.player2_name,
      seasonsTogether: Number(row.seasons_together),
      wins,
      losses,
      matches,
      winRate: matches > 0 ? Math.round((wins / matches) * 100) : null,
      currentPairing: Boolean(row.current_pairing),
      latestSeasonName: row.latest_season_name,
      lastTeamedAt: row.last_teamed_at,
    };
  }));
});

// ── Team standings for a season ─────────────────────────────────────────────────

router.get("/seasons/:id/doubles/teams", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.execute(sql`
    SELECT dt.id, dt.season_id, dt.team_name, dt.points, dt.peak_points, dt.elo,
           dt.wins, dt.losses, dt.is_eliminated, dt.created_at,
           dt.player1_id, p1.name AS player1_name,
           dt.player2_id, p2.name AS player2_name,
           dt.player3_id, p3.name AS player3_name
    FROM doubles_teams dt
    JOIN players p1 ON p1.id = dt.player1_id
    JOIN players p2 ON p2.id = dt.player2_id
    LEFT JOIN players p3 ON p3.id = dt.player3_id
    WHERE dt.season_id = ${params.data.id}
  `);

  const teams = (rows.rows as any[]).map(t => ({
    id: t.id,
    seasonId: t.season_id,
    teamName: t.team_name,
    points: t.points,
    peakPoints: t.peak_points,
    elo: t.elo,
    tier: calcTier(t.elo),
    wins: t.wins,
    losses: t.losses,
    isEliminated: t.is_eliminated,
    players: [
      { id: t.player1_id, name: t.player1_name },
      { id: t.player2_id, name: t.player2_name },
      ...(t.player3_id ? [{ id: t.player3_id, name: t.player3_name }] : []),
    ],
  }));

  const active = teams.filter(t => !t.isEliminated).sort((a, b) => b.points - a.points || b.elo - a.elo);
  const eliminated = teams.filter(t => t.isEliminated).sort((a, b) => b.points - a.points);
  const sorted = [...active, ...eliminated].map((t, i) => ({ position: i + 1, ...t }));

  res.json(sorted);
});

// ── Match history for a season ──────────────────────────────────────────────────

router.get("/seasons/:id/doubles/matches", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const rows = await db.execute(sql`
    SELECT dm.id, dm.played_at, dm.stake, dm.elo_change, dm.game_type, dm.notes,
           dm.winner_team_id, wt.team_name AS winner_team_name,
           dm.loser_team_id, lt.team_name AS loser_team_name
    FROM doubles_matches dm
    JOIN doubles_teams wt ON wt.id = dm.winner_team_id
    JOIN doubles_teams lt ON lt.id = dm.loser_team_id
    WHERE dm.season_id = ${params.data.id}
    ORDER BY dm.played_at DESC
    LIMIT 200
  `);

  res.json((rows.rows as any[]).map(r => ({
    id: r.id,
    playedAt: r.played_at,
    stake: r.stake,
    eloChange: r.elo_change,
    gameType: r.game_type,
    notes: r.notes,
    winnerTeamId: r.winner_team_id,
    winnerTeamName: r.winner_team_name,
    loserTeamId: r.loser_team_id,
    loserTeamName: r.loser_team_name,
  })));
});

// ── Record a doubles match (against the currently active season) ───────────────

router.post("/doubles/matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = RecordDoublesMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { winnerTeamId, loserTeamId, stake, stakeMode, gameType, notes, winnerFieldedCount, loserFieldedCount, idempotencyKey } = parsed.data;

  // A retried submission reuses the same key — return the match already
  // recorded instead of re-running the whole handler. See matches.ts's own
  // identical check for the full reasoning; the partial unique index from
  // add_match_result_idempotency.ts is the real backstop for a true
  // concurrent double-submit, caught further below.
  if (idempotencyKey) {
    const existingRows = (await db.execute(sql`SELECT * FROM doubles_matches WHERE idempotency_key = ${idempotencyKey} LIMIT 1`)).rows as any[];
    if (existingRows[0]) {
      const existing = existingRows[0];
      res.status(200).json({
        match: existing, eloChange: existing.elo_change, loserEliminated: existing.loser_eliminated,
        newWinnerTeamRank: null, newLoserTeamRank: null, winnerTeamRankChange: 0, loserTeamRankChange: 0,
      });
      return;
    }
  }

  if (winnerTeamId === loserTeamId) { res.status(400).json({ error: "A team cannot play itself" }); return; }

  // New live matches send a total; omitted mode preserves old clients.
  const effectiveStake = wagerPot(stake, winnerFieldedCount, loserFieldedCount, stakeMode);

  // Doubles now runs its own independent season lifecycle, separate from
  // Singles — filtering by league_type is required, not just isActive,
  // since both can be active at once.
  const [activeSeason] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "doubles")))
    .limit(1);
  if (!activeSeason) { res.status(400).json({ error: "No active Doubles Event season found" }); return; }

  // Everything from here on reads two team rows, computes new balances in JS,
  // then writes them back — that read-modify-write must happen inside a
  // single locked transaction, or two doubles matches submitted for the same
  // team close together (or the process crashing mid-way) could either lose
  // one match's stat gains to the other, or leave the points/Elo update
  // applied but the match row never inserted. FOR UPDATE locks both team
  // rows for the rest of the transaction so a concurrent submission for
  // either team has to wait for this one to commit before it reads.
  try {
    const {
      match, eloChange, loserEliminated,
      winnerTeamName, loserTeamName, winnerPlayerIds, loserPlayerIds,
      winnerPointsBefore, loserPointsBefore, winnerEloBefore, loserEloBefore,
    } = await db.transaction(async (tx) => {
      const teamRows = await tx.execute(sql`
        SELECT * FROM doubles_teams WHERE id IN (${winnerTeamId}, ${loserTeamId}) AND season_id = ${activeSeason.id} FOR UPDATE
      `);
      const teams = teamRows.rows as any[];
      const winner = teams.find(t => t.id === winnerTeamId);
      const loser  = teams.find(t => t.id === loserTeamId);

      if (!winner || !loser) throw new DoublesConflictError("One or both teams not found in the active season's doubles event");
      if (winner.is_eliminated) throw new DoublesConflictError(`${winner.team_name} has been eliminated from doubles and cannot play`);
      if (loser.is_eliminated)  throw new DoublesConflictError(`${loser.team_name} has been eliminated from doubles and cannot play`);

      const stakeError = validateStake(
        effectiveStake,
        { points: winner.points, name: winner.team_name },
        { points: loser.points, name: loser.team_name },
      );
      if (stakeError) throw new DoublesConflictError(stakeError);

      const { newWinnerPoints, newLoserPoints, loserEliminated } = applyWager(
        effectiveStake,
        { points: winner.points },
        { points: loser.points },
      );
      const { newWinnerElo, newLoserElo, change: eloChange } = applyEloChange(winner.elo, loser.elo);

      await tx.execute(sql`
        UPDATE doubles_teams SET
          points = ${newWinnerPoints},
          peak_points = GREATEST(peak_points, ${newWinnerPoints}),
          elo = ${newWinnerElo},
          wins = wins + 1
        WHERE id = ${winner.id}
      `);
      await tx.execute(sql`
        UPDATE doubles_teams SET
          points = ${newLoserPoints},
          elo = ${newLoserElo},
          losses = losses + 1,
          is_eliminated = is_eliminated OR ${loserEliminated}
        WHERE id = ${loser.id}
      `);

      // Store the effective (already-scaled) stake, not the nominal input —
      // like Shift Wars, Doubles has no per-player breakdown to show
      // elsewhere, so this "stake" column is the only number the match
      // history/notifications have for how many points actually moved.
      const [match] = (await tx.execute(sql`
        INSERT INTO doubles_matches
          (season_id, winner_team_id, loser_team_id, stake, elo_change,
           winner_elo_delta, loser_elo_delta, loser_eliminated, game_type, notes, idempotency_key)
        VALUES
          (${activeSeason.id}, ${winner.id}, ${loser.id}, ${effectiveStake}, ${eloChange},
           ${newWinnerElo - winner.elo}, ${newLoserElo - loser.elo}, ${loserEliminated}, ${gameType}, ${notes ?? null}, ${idempotencyKey ?? null})
        RETURNING *
      `)).rows as any[];

      const teamPlayerIds = (t: any): number[] =>
        [t.player1_id, t.player2_id, t.player3_id].filter((id): id is number => id != null);

      return {
        match, eloChange, loserEliminated,
        winnerTeamName: winner.team_name, loserTeamName: loser.team_name,
        winnerPlayerIds: teamPlayerIds(winner), loserPlayerIds: teamPlayerIds(loser),
        winnerPointsBefore: winner.points, loserPointsBefore: loser.points,
        winnerEloBefore: winner.elo, loserEloBefore: loser.elo,
      };
    });

    // Team-position rank diff — same idea as the singles one in
    // routes/matches.ts (see lib/leaderboardRank.ts), applied to this
    // season's doubles_teams instead of players. Only the winner/loser
    // team actually changed points/elo/elimination, so the roster fetched
    // here for the "after" ranking is patched back to pre-match values for
    // the "before" half rather than queried twice.
    let winnerTeamRankChange = 0, loserTeamRankChange = 0, newWinnerTeamRank = 0, newLoserTeamRank = 0;
    try {
      const teamRows = await db.execute(sql`
        SELECT id, points, elo, is_eliminated FROM doubles_teams WHERE season_id = ${activeSeason.id}
      `);
      const roster: RankableDoublesTeam[] = (teamRows.rows as any[]).map(t => ({
        id: t.id, points: t.points, elo: t.elo, isEliminated: t.is_eliminated,
      }));

      const afterRanks = rankDoublesTeams(roster);
      const beforeRoster = roster.map(t => {
        if (t.id === winnerTeamId) return { ...t, points: winnerPointsBefore, elo: winnerEloBefore };
        if (t.id === loserTeamId)  return { ...t, points: loserPointsBefore, elo: loserEloBefore, isEliminated: loserEliminated ? false : t.isEliminated };
        return t;
      });
      const beforeRanks = rankDoublesTeams(beforeRoster);

      newWinnerTeamRank = afterRanks.get(winnerTeamId) ?? 0;
      newLoserTeamRank  = afterRanks.get(loserTeamId) ?? 0;
      const oldWinnerTeamRank = beforeRanks.get(winnerTeamId) ?? 0;
      const oldLoserTeamRank  = beforeRanks.get(loserTeamId) ?? 0;
      winnerTeamRankChange = oldWinnerTeamRank - newWinnerTeamRank;
      loserTeamRankChange  = oldLoserTeamRank  - newLoserTeamRank;

      if (winnerTeamRankChange !== 0) {
        void sendRankChangeNotifications(
          winnerPlayerIds.map(id => ({ id, name: winnerTeamName, newRank: newWinnerTeamRank, oldRank: oldWinnerTeamRank })),
        );
      }
      if (loserTeamRankChange !== 0) {
        void sendRankChangeNotifications(
          loserPlayerIds.map(id => ({ id, name: loserTeamName, newRank: newLoserTeamRank, oldRank: oldLoserTeamRank })),
        );
      }
    } catch (err) {
      console.error("Doubles rank-change computation error:", err);
    }

    void upsertResultPoster({
      resultRef: `doubles-${match.id}`,
      leagueType: "doubles",
      format: "Doubles Event",
      winnerName: winnerTeamName,
      loserName: loserTeamName,
      stake: effectiveStake,
      gameType,
      seasonId: activeSeason.id,
    });

    res.status(201).json({
      match, eloChange, loserEliminated,
      newWinnerTeamRank, newLoserTeamRank,
      winnerTeamRankChange, // positive = winner's team moved up the doubles standings
      loserTeamRankChange,
    });

    // .catch() is required here, not cosmetic — a bare `void` call with no
    // handler becomes an unhandled promise rejection if checkDoublesAchievements
    // ever throws, which crashes the whole Node process under default behavior
    // (Node >=15), taking down the server for every connected player well after
    // this match already committed and responded successfully.
    void checkDoublesAchievements(winnerPlayerIds, winnerTeamId, eloChange, effectiveStake)
      .catch(err => console.error("Doubles achievement check error:", err));

    // Push notifications (fire and forget — never delay the response). Doubles
    // had no notification integration at all before this; see the "no
    // individual player attribution" comment on shift-wars.ts for why the
    // team's own roster is looked up here rather than passed in.
    void sendDoublesMatchResultNotification(
      winnerTeamName, loserTeamName,
      winnerPlayerIds, loserPlayerIds,
      effectiveStake, eloChange,
    );

    // League-wide ping — every other opted-in player, not just the two teams
    // who played.
    void sendMatchResultBroadcast(
      [...winnerPlayerIds, ...loserPlayerIds],
      "🎯 Doubles Result",
      `${winnerTeamName} beat ${loserTeamName}`,
      { winnerTeamName, loserTeamName },
    );

    // Auto community post (fire and forget — never delay the response).
    // Doubles results never made it to the Community tab before this — this
    // mirrors the "Auto community posts" block in matches.ts, adapted for a
    // team-vs-team result (the post is authored under the first winning
    // player, since community_posts.player_id is a single-player FK and
    // doubles has no single "submitter" the way singles matches do).
    void (async () => {
      const parts: string[] = [`🎯 ${winnerTeamName} defeated ${loserTeamName} (+${eloChange} Elo, +${effectiveStake} pts)`];
      if (loserEliminated) parts.push(`💀 ${loserTeamName} has been ELIMINATED!`);

      await createAutoPost({
        playerId:        winnerPlayerIds[0] ?? loserPlayerIds[0],
        content:         parts.join(" · "),
        autoMeta:        { type: "doubles_match", matchId: match.id, winnerTeamId, loserTeamId, eloChange, stake: effectiveStake, loserEliminated },
        notifyPlayerIds: loserPlayerIds,
      });
    })();
  } catch (err) {
    if (err instanceof DoublesConflictError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (idempotencyKey && (err as { code?: string }).code === "23505") {
      const existingRows = (await db.execute(sql`SELECT * FROM doubles_matches WHERE idempotency_key = ${idempotencyKey} LIMIT 1`)).rows as any[];
      if (existingRows[0]) {
        const existing = existingRows[0];
        res.status(200).json({
          match: existing, eloChange: existing.elo_change, loserEliminated: existing.loser_eliminated,
          newWinnerTeamRank: null, newLoserTeamRank: null, winnerTeamRankChange: 0, loserTeamRankChange: 0,
        });
        return;
      }
    }
    throw err;
  }
});

// ── Record a "combined side" doubles match ──────────────────────────────────

// Reconstructs the exact success-response shape for an already-recorded
// combined-side match, by idempotency key — used both by the pre-check at
// the top of the handler below (the common sequential-retry path) and by
// the race fallback in its catch block (a true concurrent double-submit
// caught by the partial unique index from
// add_match_result_idempotency.ts). Returns null when no match with that
// key exists yet, so the caller falls through to the normal insert path.
async function loadDoublesCombinedMatchResponse(idempotencyKey: string): Promise<unknown | null> {
  const matchRows = (await db.execute(sql`
    SELECT dcm.*, st.team_name AS solo_team_name
    FROM doubles_combined_matches dcm
    JOIN doubles_teams st ON st.id = dcm.solo_team_id
    WHERE dcm.idempotency_key = ${idempotencyKey}
    LIMIT 1
  `)).rows as any[];
  const match = matchRows[0];
  if (!match) return null;

  const sideRows = (await db.execute(sql`
    SELECT s.team_id, t.team_name, s.fielded_count, s.points_delta, s.elo_delta, s.eliminated
    FROM doubles_combined_match_sides s
    JOIN doubles_teams t ON t.id = s.team_id
    WHERE s.match_id = ${match.id}
  `)).rows as any[];

  return {
    match, soloTeamId: match.solo_team_id, soloTeamName: match.solo_team_name, soloWon: match.solo_won,
    pot: match.pot, soloPointsDelta: match.solo_points_delta, soloEloDelta: match.solo_elo_delta,
    combinedSides: sideRows.map(s => ({
      teamId: s.team_id, teamName: s.team_name, fieldedCount: s.fielded_count,
      pointsDelta: s.points_delta, eloDelta: s.elo_delta, eliminated: s.eliminated,
    })),
  };
}

router.post("/doubles/combined-matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = RecordDoublesCombinedMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { soloTeamId, soloFieldedCount, soloWon, combinedTeams, stake, stakeMode, gameType, notes, idempotencyKey } = parsed.data;

  // A retried submission reuses the same key — return the match already
  // recorded instead of re-running the whole handler. See matches.ts's own
  // identical check for the full reasoning.
  if (idempotencyKey) {
    const existing = await loadDoublesCombinedMatchResponse(idempotencyKey);
    if (existing) { res.status(200).json(existing); return; }
  }

  const combinedTeamIds = combinedTeams.map(c => c.teamId);
  if (new Set(combinedTeamIds).size !== combinedTeamIds.length) {
    res.status(400).json({ error: "Combined side cannot list the same pairing twice" }); return;
  }
  if (combinedTeamIds.includes(soloTeamId)) {
    res.status(400).json({ error: "The solo pairing cannot also be part of the combined side" }); return;
  }

  const [activeSeason] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "doubles")))
    .limit(1);
  if (!activeSeason) { res.status(400).json({ error: "No active Doubles Event season found" }); return; }

  try {
    const result = await db.transaction(async (tx) => {
      const allIds = [soloTeamId, ...combinedTeamIds];
      // FOR UPDATE on every involved pairing (solo + all combined) — same
      // "lock everything you're about to read-modify-write" reasoning as the
      // 2-team version above, just generalized to N teams.
      const teamRows = await tx.execute(sql`
        SELECT * FROM doubles_teams
        WHERE id = ANY(ARRAY[${sql.join(allIds.map(id => sql`${id}`), sql`, `)}]::int[])
          AND season_id = ${activeSeason.id}
        FOR UPDATE
      `);
      const teams = teamRows.rows as any[];
      if (teams.length !== allIds.length) {
        throw new DoublesConflictError("One or more pairings not found in the active season's doubles event");
      }

      const solo = teams.find(t => t.id === soloTeamId)!;
      const combined = combinedTeamIds.map(id => teams.find(t => t.id === id)!);

      if (solo.is_eliminated) throw new DoublesConflictError(`${solo.team_name} has been eliminated from doubles and cannot play`);
      for (const c of combined) {
        if (c.is_eliminated) throw new DoublesConflictError(`${c.team_name} has been eliminated from doubles and cannot play`);
      }

      const pot = stakeMode === "total" ? stake : combinedPot(stake, soloFieldedCount, combinedTeams);
      const losingSide: "solo" | "combined" = soloWon ? "combined" : "solo";

      const stakeError = validateCombinedStake(
        pot, losingSide,
        { points: solo.points, name: solo.team_name },
        combined.map((c, i) => ({ points: c.points, name: c.team_name, fieldedCount: combinedTeams[i].fieldedCount })),
      );
      if (stakeError) throw new DoublesConflictError(stakeError);

      const { newSoloPoints, soloPointsDelta, soloEliminated, combinedResults } = applyCombinedWager(
        pot, losingSide,
        { points: solo.points },
        combined.map((c, i) => ({ points: c.points, fieldedCount: combinedTeams[i].fieldedCount })),
      );

      // Elo: the solo team's rating moves against a fielded-count-weighted
      // average of the combined side's ratings — a stand-in for "how strong
      // was what actually got fielded" — computed exactly like a normal 1v1
      // Elo change, so the solo team takes that FULL swing (it genuinely
      // played one whole match). Each combined-side team's own rating only
      // moves by its proportional SHARE of that same swing, for the same
      // "don't double-count one physical result" reason as the points split
      // above — never the full swing each.
      const combinedWeights = combinedTeams.map(c => c.fieldedCount);
      const combinedTotalWeight = combinedWeights.reduce((a, b) => a + b, 0);
      const virtualCombinedElo = Math.round(
        combined.reduce((sum, c, i) => sum + c.elo * combinedWeights[i], 0) / combinedTotalWeight
      );
      const { newWinnerElo, newLoserElo, change: fullEloChange } = soloWon
        ? applyEloChange(solo.elo, virtualCombinedElo)
        : applyEloChange(virtualCombinedElo, solo.elo);
      const newSoloElo = soloWon ? newWinnerElo : newLoserElo;
      const soloEloDelta = newSoloElo - solo.elo;
      const eloShares = splitProportional(fullEloChange, combinedWeights);

      await tx.execute(sql`
        UPDATE doubles_teams SET
          points = ${newSoloPoints},
          peak_points = GREATEST(peak_points, ${newSoloPoints}),
          elo = ${newSoloElo},
          wins = wins + ${soloWon ? 1 : 0},
          losses = losses + ${soloWon ? 0 : 1},
          is_eliminated = is_eliminated OR ${soloEliminated}
        WHERE id = ${solo.id}
      `);

      const sideRows: { teamId: number; teamName: string; fieldedCount: number; pointsDelta: number; eloDelta: number; eliminated: boolean }[] = [];
      for (let i = 0; i < combined.length; i++) {
        const c = combined[i];
        const cr = combinedResults[i];
        const combinedWon = !soloWon;
        const newElo = combinedWon ? c.elo + eloShares[i] : Math.max(ELO_FLOOR, c.elo - eloShares[i]);
        const actualEloDelta = newElo - c.elo;
        await tx.execute(sql`
          UPDATE doubles_teams SET
            points = ${cr.newPoints},
            peak_points = GREATEST(peak_points, ${cr.newPoints}),
            elo = ${newElo},
            wins = wins + ${combinedWon ? 1 : 0},
            losses = losses + ${combinedWon ? 0 : 1},
            is_eliminated = is_eliminated OR ${cr.eliminated}
          WHERE id = ${c.id}
        `);
        sideRows.push({
          teamId: c.id, teamName: c.team_name, fieldedCount: combinedTeams[i].fieldedCount,
          pointsDelta: cr.pointsDelta, eloDelta: actualEloDelta, eliminated: cr.eliminated,
        });
      }

      const [match] = (await tx.execute(sql`
        INSERT INTO doubles_combined_matches
          (season_id, solo_team_id, solo_fielded_count, solo_won, stake, pot, solo_points_delta, solo_elo_delta, game_type, notes, idempotency_key)
        VALUES (${activeSeason.id}, ${solo.id}, ${soloFieldedCount}, ${soloWon}, ${stake}, ${pot}, ${soloPointsDelta}, ${soloEloDelta}, ${gameType}, ${notes ?? null}, ${idempotencyKey ?? null})
        RETURNING *
      `)).rows as any[];

      for (const side of sideRows) {
        await tx.execute(sql`
          INSERT INTO doubles_combined_match_sides (match_id, team_id, fielded_count, points_delta, elo_delta, eliminated)
          VALUES (${match.id}, ${side.teamId}, ${side.fieldedCount}, ${side.pointsDelta}, ${side.eloDelta}, ${side.eliminated})
        `);
      }

      return { match, solo, combined, sideRows, pot, soloPointsDelta, soloEloDelta };
    });

    const combinedPosterNames = result.sideRows.map(s => s.teamName).join(" & ");
    void upsertResultPoster({
      resultRef: `doubles-combined-${result.match.id}`,
      leagueType: "doubles",
      format: "Doubles Event",
      winnerName: soloWon ? result.solo.team_name : combinedPosterNames,
      loserName: soloWon ? combinedPosterNames : result.solo.team_name,
      stake: result.pot,
      gameType,
      seasonId: activeSeason.id,
      resultType: "combined",
    });

    res.status(201).json({
      match: result.match,
      soloTeamId: result.solo.id,
      soloTeamName: result.solo.team_name,
      soloWon,
      pot: result.pot,
      soloPointsDelta: result.soloPointsDelta,
      soloEloDelta: result.soloEloDelta,
      combinedSides: result.sideRows,
    });

    // Achievements — whichever side actually won gets credited, same as a
    // normal doubles match. A combined-side win credits EACH contributing
    // pairing's own win, since each of them genuinely did play and win.
    const teamPlayerIds = (t: any): number[] =>
      [t.player1_id, t.player2_id, t.player3_id].filter((id): id is number => id != null);
    if (soloWon) {
      void checkDoublesAchievements(teamPlayerIds(result.solo), result.solo.id, result.soloEloDelta, result.pot)
        .catch(err => console.error("Doubles achievement check error:", err));
    } else {
      for (const side of result.sideRows) {
        const team = result.combined.find(c => c.id === side.teamId)!;
        void checkDoublesAchievements(teamPlayerIds(team), team.id, side.eloDelta, side.pointsDelta)
          .catch(err => console.error("Doubles achievement check error:", err));
      }
    }

    // Push notifications + auto community post (fire and forget) — same
    // spirit as the normal doubles match integrations, phrased for a
    // combined-side result. eloChange in the push body uses the solo team's
    // own delta magnitude as the headline number, same as the pot.
    void (async () => {
      const combinedNames = result.sideRows.map(s => s.teamName).join(" & ");
      const winnerText = soloWon ? result.solo.team_name : combinedNames;
      const loserText = soloWon ? combinedNames : result.solo.team_name;
      const winnerPlayerIds = soloWon ? teamPlayerIds(result.solo) : result.sideRows.flatMap(s => teamPlayerIds(result.combined.find(c => c.id === s.teamId)!));
      const loserPlayerIds = soloWon ? result.sideRows.flatMap(s => teamPlayerIds(result.combined.find(c => c.id === s.teamId)!)) : teamPlayerIds(result.solo);
      const firstWinnerPlayerId = winnerPlayerIds[0] ?? loserPlayerIds[0];

      void sendDoublesMatchResultNotification(winnerText, loserText, winnerPlayerIds, loserPlayerIds, result.pot, Math.abs(result.soloEloDelta));
      void sendMatchResultBroadcast([...winnerPlayerIds, ...loserPlayerIds], "🎯 Doubles Result", `${winnerText} beat ${loserText}`, { winnerText, loserText });

      await createAutoPost({
        playerId: firstWinnerPlayerId,
        content: `🎯 ${winnerText} defeated ${loserText} in a combined-side handicap match (+${result.pot} pts)`,
        autoMeta: {
          type: "doubles_combined_match", matchId: result.match.id,
          soloTeamId: result.solo.id, combinedTeamIds: result.sideRows.map(s => s.teamId),
          pot: result.pot, soloWon,
        },
        notifyPlayerIds: loserPlayerIds,
      });
    })();
  } catch (err) {
    if (err instanceof DoublesConflictError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (idempotencyKey && (err as { code?: string }).code === "23505") {
      const existing = await loadDoublesCombinedMatchResponse(idempotencyKey);
      if (existing) { res.status(200).json(existing); return; }
    }
    throw err;
  }
});

// ── Combined-side match history for a season ────────────────────────────────

router.get("/seasons/:id/doubles/combined-matches", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const matchRows = await db.execute(sql`
    SELECT dcm.id, dcm.played_at, dcm.solo_team_id, st.team_name AS solo_team_name,
           dcm.solo_fielded_count, dcm.solo_won, dcm.stake, dcm.pot,
           dcm.solo_points_delta, dcm.solo_elo_delta, dcm.game_type, dcm.notes
    FROM doubles_combined_matches dcm
    JOIN doubles_teams st ON st.id = dcm.solo_team_id
    WHERE dcm.season_id = ${params.data.id}
    ORDER BY dcm.played_at DESC
    LIMIT 100
  `);
  const matches = matchRows.rows as any[];
  if (matches.length === 0) { res.json([]); return; }

  const matchIds = matches.map(m => m.id);
  const sideRows = await db.execute(sql`
    SELECT s.match_id, s.team_id, t.team_name, s.fielded_count, s.points_delta, s.elo_delta, s.eliminated
    FROM doubles_combined_match_sides s
    JOIN doubles_teams t ON t.id = s.team_id
    WHERE s.match_id = ANY(ARRAY[${sql.join(matchIds.map((id: number) => sql`${id}`), sql`, `)}]::int[])
  `);
  const sides = sideRows.rows as any[];

  res.json(matches.map(m => ({
    id: m.id,
    playedAt: m.played_at,
    soloTeamId: m.solo_team_id,
    soloTeamName: m.solo_team_name,
    soloFieldedCount: m.solo_fielded_count,
    soloWon: m.solo_won,
    stake: m.stake,
    pot: m.pot,
    soloPointsDelta: m.solo_points_delta,
    soloEloDelta: m.solo_elo_delta,
    gameType: m.game_type,
    notes: m.notes,
    combinedSides: sides.filter(s => s.match_id === m.id).map(s => ({
      teamId: s.team_id, teamName: s.team_name, fieldedCount: s.fielded_count,
      pointsDelta: s.points_delta, eloDelta: s.elo_delta, eliminated: s.eliminated,
    })),
  })));
});

// ── Record a "multi-team" doubles match (3+ pairings, one winner) ──────────

// Same purpose as loadDoublesCombinedMatchResponse above, for the multi-team
// shape — see its comment for why this exists in both the pre-check and the
// catch-block race fallback below.
async function loadDoublesMultiMatchResponse(idempotencyKey: string): Promise<unknown | null> {
  const matchRows = (await db.execute(sql`
    SELECT dmm.*, wt.team_name AS winner_team_name
    FROM doubles_multi_matches dmm
    JOIN doubles_teams wt ON wt.id = dmm.winner_team_id
    WHERE dmm.idempotency_key = ${idempotencyKey}
    LIMIT 1
  `)).rows as any[];
  const match = matchRows[0];
  if (!match) return null;

  const loserRows = (await db.execute(sql`
    SELECT p.team_id, t.team_name, p.points_delta, p.elo_delta
    FROM doubles_multi_match_participants p
    JOIN doubles_teams t ON t.id = p.team_id
    WHERE p.match_id = ${match.id} AND p.is_winner = false
  `)).rows as any[];

  return {
    match, winnerTeamId: match.winner_team_id, winnerTeamName: match.winner_team_name,
    pot: match.pot, eloChange: match.elo_change,
    losers: loserRows.map(l => ({ teamId: l.team_id, teamName: l.team_name, pointsDelta: l.points_delta, eloDelta: l.elo_delta })),
  };
}

router.post("/doubles/multi-matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = RecordDoublesMultiMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { participantTeamIds, winnerTeamId, stake, gameType, notes, idempotencyKey } = parsed.data;

  // A retried submission reuses the same key — return the match already
  // recorded instead of re-running the whole handler. See matches.ts's own
  // identical check for the full reasoning.
  if (idempotencyKey) {
    const existing = await loadDoublesMultiMatchResponse(idempotencyKey);
    if (existing) { res.status(200).json(existing); return; }
  }

  if (new Set(participantTeamIds).size !== participantTeamIds.length) {
    res.status(400).json({ error: "A pairing cannot play itself twice in the same multi-team match" }); return;
  }
  if (!participantTeamIds.includes(winnerTeamId)) {
    res.status(400).json({ error: "The winning pairing must be one of the participants" }); return;
  }

  const [activeSeason] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "doubles")))
    .limit(1);
  if (!activeSeason) { res.status(400).json({ error: "No active Doubles Event season found" }); return; }

  try {
    const result = await db.transaction(async (tx) => {
      // FOR UPDATE on every participant — same "lock everything you're about
      // to read-modify-write" reasoning as the combined-match endpoint above.
      const teamRows = await tx.execute(sql`
        SELECT * FROM doubles_teams
        WHERE id = ANY(ARRAY[${sql.join(participantTeamIds.map(id => sql`${id}`), sql`, `)}]::int[])
          AND season_id = ${activeSeason.id}
        FOR UPDATE
      `);
      const teams = teamRows.rows as any[];
      if (teams.length !== participantTeamIds.length) {
        throw new DoublesConflictError("One or more pairings not found in the active season's doubles event");
      }
      for (const t of teams) {
        if (t.is_eliminated) throw new DoublesConflictError(`${t.team_name} has been eliminated from doubles and cannot play`);
      }

      const winner = teams.find(t => t.id === winnerTeamId)!;
      const losers = teams.filter(t => t.id !== winnerTeamId);

      const pot = multiMatchPot(stake, participantTeamIds.length);
      const stakeError = validateMultiStake(stake, losers.map(l => ({ points: l.points, name: l.team_name })));
      if (stakeError) throw new DoublesConflictError(stakeError);

      const { newWinnerPoints, loserResults } = applyMultiWager(
        pot,
        { points: winner.points },
        losers.map(l => ({ points: l.points })),
        stake,
      );

      // One Elo change: the winner's rating moves against the average of
      // every losing pairing's rating, and that same magnitude is mirrored
      // onto every loser — same approximation Team Match already uses for
      // Killer FFA (one physical result, one Elo swing), not N separate
      // 1-vs-1 computations.
      const avgLoserElo = Math.round(losers.reduce((sum, l) => sum + l.elo, 0) / losers.length);
      const eloChange = calcEloChange(winner.elo, avgLoserElo);
      const newWinnerElo = winner.elo + eloChange;

      await tx.execute(sql`
        UPDATE doubles_teams SET
          points = ${newWinnerPoints},
          peak_points = GREATEST(peak_points, ${newWinnerPoints}),
          elo = ${newWinnerElo},
          wins = wins + 1
        WHERE id = ${winner.id}
      `);

      const loserRows: { teamId: number; teamName: string; pointsDelta: number; eloDelta: number; eliminated: boolean }[] = [];
      for (let i = 0; i < losers.length; i++) {
        const l = losers[i];
        const lr = loserResults[i];
        const newElo = Math.max(ELO_FLOOR, l.elo - eloChange);
        await tx.execute(sql`
          UPDATE doubles_teams SET
            points = ${lr.newPoints},
            elo = ${newElo},
            losses = losses + 1,
            is_eliminated = is_eliminated OR ${lr.eliminated}
          WHERE id = ${l.id}
        `);
        loserRows.push({ teamId: l.id, teamName: l.team_name, pointsDelta: lr.newPoints - l.points, eloDelta: newElo - l.elo, eliminated: lr.eliminated });
      }

      const [match] = (await tx.execute(sql`
        INSERT INTO doubles_multi_matches
          (season_id, winner_team_id, participant_count, stake, pot, elo_change, game_type, notes, idempotency_key)
        VALUES (${activeSeason.id}, ${winner.id}, ${participantTeamIds.length}, ${stake}, ${pot}, ${eloChange}, ${gameType}, ${notes ?? null}, ${idempotencyKey ?? null})
        RETURNING *
      `)).rows as any[];

      await tx.execute(sql`
        INSERT INTO doubles_multi_match_participants (match_id, team_id, is_winner, points_delta, elo_delta, eliminated)
        VALUES (${match.id}, ${winner.id}, true, ${pot}, ${eloChange}, false)
      `);
      for (const lr of loserRows) {
        await tx.execute(sql`
          INSERT INTO doubles_multi_match_participants (match_id, team_id, is_winner, points_delta, elo_delta, eliminated)
          VALUES (${match.id}, ${lr.teamId}, false, ${lr.pointsDelta}, ${lr.eloDelta}, ${lr.eliminated})
        `);
      }

      return { match, winner, losers, loserRows, pot, eloChange };
    });

    void upsertResultPoster({
      resultRef: `doubles-multi-${result.match.id}`,
      leagueType: "doubles",
      format: "Doubles Event",
      winnerName: result.winner.team_name,
      loserName: result.loserRows.map(l => l.teamName).join(", "),
      stake: result.pot,
      gameType,
      seasonId: activeSeason.id,
      resultType: "multi",
    });

    res.status(201).json({
      match: result.match,
      winnerTeamId: result.winner.id,
      winnerTeamName: result.winner.team_name,
      pot: result.pot,
      eloChange: result.eloChange,
      losers: result.loserRows,
    });

    const teamPlayerIds = (t: any): number[] =>
      [t.player1_id, t.player2_id, t.player3_id].filter((id): id is number => id != null);
    void checkDoublesAchievements(teamPlayerIds(result.winner), result.winner.id, result.eloChange, result.pot)
      .catch(err => console.error("Doubles achievement check error:", err));

    // Push notifications + auto community post (fire and forget) — same
    // spirit as every other doubles match integration, phrased for a
    // multi-team result.
    void (async () => {
      const loserNames = result.loserRows.map(l => l.teamName).join(", ");
      const winnerPlayerIds = teamPlayerIds(result.winner);
      const loserPlayerIds = result.losers.flatMap(teamPlayerIds);

      void sendDoublesMatchResultNotification(result.winner.team_name, loserNames, winnerPlayerIds, loserPlayerIds, result.pot, result.eloChange);
      void sendMatchResultBroadcast([...winnerPlayerIds, ...loserPlayerIds], "🎯 Doubles Result", `${result.winner.team_name} won a ${result.losers.length + 1}-team multi-match`, { winnerTeamName: result.winner.team_name, loserNames });

      await createAutoPost({
        playerId: winnerPlayerIds[0],
        content: `🎯 ${result.winner.team_name} won a ${result.losers.length + 1}-pairing multi-team match (beat ${loserNames}) (+${result.pot} pts)`,
        autoMeta: { type: "doubles_multi_match", matchId: result.match.id, winnerTeamId: result.winner.id, loserTeamIds: result.loserRows.map(l => l.teamId), pot: result.pot },
        notifyPlayerIds: loserPlayerIds,
      });
    })();
  } catch (err) {
    if (err instanceof DoublesConflictError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (idempotencyKey && (err as { code?: string }).code === "23505") {
      const existing = await loadDoublesMultiMatchResponse(idempotencyKey);
      if (existing) { res.status(200).json(existing); return; }
    }
    throw err;
  }
});

// ── Multi-team match history for a season ───────────────────────────────────

router.get("/seasons/:id/doubles/multi-matches", async (req, res): Promise<void> => {
  const params = GetSeasonParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const matchRows = await db.execute(sql`
    SELECT dmm.id, dmm.played_at, dmm.winner_team_id, wt.team_name AS winner_team_name,
           dmm.participant_count, dmm.stake, dmm.pot, dmm.elo_change, dmm.game_type, dmm.notes
    FROM doubles_multi_matches dmm
    JOIN doubles_teams wt ON wt.id = dmm.winner_team_id
    WHERE dmm.season_id = ${params.data.id}
    ORDER BY dmm.played_at DESC
    LIMIT 100
  `);
  const matches = matchRows.rows as any[];
  if (matches.length === 0) { res.json([]); return; }

  const matchIds = matches.map(m => m.id);
  const participantRows = await db.execute(sql`
    SELECT p.match_id, p.team_id, t.team_name, p.is_winner, p.points_delta, p.elo_delta, p.eliminated
    FROM doubles_multi_match_participants p
    JOIN doubles_teams t ON t.id = p.team_id
    WHERE p.match_id = ANY(ARRAY[${sql.join(matchIds.map((id: number) => sql`${id}`), sql`, `)}]::int[])
  `);
  const participants = participantRows.rows as any[];

  res.json(matches.map(m => ({
    id: m.id,
    playedAt: m.played_at,
    winnerTeamId: m.winner_team_id,
    winnerTeamName: m.winner_team_name,
    participantCount: m.participant_count,
    stake: m.stake,
    pot: m.pot,
    eloChange: m.elo_change,
    gameType: m.game_type,
    notes: m.notes,
    participants: participants.filter(p => p.match_id === m.id).map(p => ({
      teamId: p.team_id, teamName: p.team_name, isWinner: p.is_winner,
      pointsDelta: p.points_delta, eloDelta: p.elo_delta, eliminated: p.eliminated,
    })),
  })));
});

export default router;
