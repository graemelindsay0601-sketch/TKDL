import { Router } from "express";
import { wagerPot } from "../lib/wager-pot";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { z } from "zod";
import { validateStake, applyWager, combinedPot, validateCombinedStake, applyCombinedWager, multiMatchPot, validateMultiStake, applyMultiWager } from "../lib/wager";
import { matchSubmitRateLimit } from "../middleware/writeRateLimit";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { sendShiftWarsMatchResultNotification, sendMatchResultBroadcast, sendRankChangeNotifications } from "../services/notificationService";
import { createAutoPost } from "../lib/communityNotify";
import { checkShiftWarsAchievements } from "../lib/shift-wars-achievements";
import { rankShiftWarsTeams, type RankableShiftWarsTeam } from "../lib/leaderboardRank";
import { logAdminAction } from "../lib/adminAudit";
import { upsertResultPoster } from "../services/matchPosterService";

/**
 * Shift Wars — 3 fixed department teams (Fresh, Twilight, Shift Leader) competing
 * on the same points/wager mechanic as the Doubles Event, but:
 *   - no random draw/reroll: the roster is a manual, permanent, admin-assigned
 *     department, not a season-drawn pairing
 *   - points-only, no ELO/tier ladder
 *   - fixed teams persist, while each result is attached to its monthly
 *     Shift Wars season so history and corrections cannot cross a reset
 * A match is recorded purely as "Team A beat Team B, stake X" — same as Doubles
 * Event — no individual player attribution is needed for the match itself; the
 * roster exists only to show who's on which team.
 */

const RecordShiftWarsMatchBody = z.object({
  winnerTeamId: z.number().int().positive(),
  loserTeamId:  z.number().int().positive(),
  stake:        z.number().int().min(1), // Rules minimum is 1 — see wager.ts validateStake for why 0 has no legitimate case here.
  stakeMode: z.enum(["per-player", "total"]).optional().default("per-player"),
  gameType:     z.string().optional().default("shift_wars_501"),
  notes:        z.string().optional(),
  // Fielded counts support legacy per-player wagers. Total mode moves
  // the entered stake between official team accounts regardless of count.
  winnerFieldedCount: z.number().int().positive().max(6).optional().default(1),
  loserFieldedCount:  z.number().int().positive().max(6).optional().default(1),
  // Optional client-supplied key — see db/migrations/add_match_result_idempotency.ts.
  idempotencyKey: z.string().min(1).max(100).optional(),
});

// A "combined side" match: one department plays alone (solo) against a
// temporary group made up of the other department(s) combined — e.g. Fresh
// alone vs Twilight + Shift Leader combined, as a handicap. See lib/wager.ts
// (combinedPot/validateCombinedStake/applyCombinedWager, shared with
// doubles.ts's own combined-match endpoint) for the settlement math and
// db/migrations/add_combined_matches.ts for the tables this writes to.
// Points-only, like every other Shift Wars match — no Elo here.
const RecordShiftWarsCombinedMatchBody = z.object({
  soloTeamId: z.number().int().positive(),
  soloFieldedCount: z.number().int().positive().max(6).optional().default(1),
  soloWon: z.boolean(),
  combinedTeams: z.array(z.object({
    teamId: z.number().int().positive(),
    fieldedCount: z.number().int().positive().max(6).optional().default(1),
  })).min(2, "A combined side needs at least 2 different departments"),
  stake: z.number().int().min(1),
  stakeMode: z.enum(["per-player", "total"]).optional().default("per-player"),
  gameType: z.string().optional().default("shift_wars_501"),
  notes: z.string().optional(),
  // Optional client-supplied key — see db/migrations/add_match_result_idempotency.ts.
  idempotencyKey: z.string().min(1).max(100).optional(),
});

// A "multi-team" match: all 3 departments play ONE live elimination game
// together (MultiKillerScorer on the frontend — the same engine Singles'
// Killer Free-for-All already uses), with a single overall winner. Shift
// Wars only ever has 3 fixed departments, so this is always exactly 3 —
// unlike Doubles Event's multi-team match, which can have more pairings.
// See lib/wager.ts (multiMatchPot/validateMultiStake/applyMultiWager) for
// the settlement math and db/migrations/add_multi_matches.ts for the tables
// this writes to. Points-only, like every other Shift Wars match — no Elo.
const RecordShiftWarsMultiMatchBody = z.object({
  participantTeamIds: z.array(z.number().int().positive()).length(3, "Shift Wars multi-team matches are always all 3 departments"),
  winnerTeamId: z.number().int().positive(),
  stake: z.number().int().min(1),
  gameType: z.string().optional().default("shift_wars_501"),
  notes: z.string().optional(),
  // Optional client-supplied key — see db/migrations/add_match_result_idempotency.ts.
  idempotencyKey: z.string().min(1).max(100).optional(),
});

const UpdateTeamPointsBody = z.object({
  points:         z.number().int().min(0).optional(),
  startingPoints: z.number().int().min(0).optional(),
}).refine(d => d.points !== undefined || d.startingPoints !== undefined, {
  message: "Provide points and/or startingPoints",
});

const AssignPlayerTeamBody = z.object({
  teamId: z.number().int().positive().nullable(),
});

const router = Router();

class ShiftWarsConflictError extends Error {}

async function activeShiftWarsSeasonId(): Promise<number | null> {
  const rows = await db.execute(sql`
    SELECT id FROM seasons WHERE is_active = true AND league_type = 'shift_wars' LIMIT 1
  `);
  return ((rows.rows as any[])[0]?.id as number | undefined) ?? null;
}

// ── Team standings + roster ─────────────────────────────────────────────────

router.get("/shift-wars/teams", async (_req, res): Promise<void> => {
  const teamRows = await db.execute(sql`SELECT * FROM shift_wars_teams ORDER BY points DESC, name ASC`);
  const teams = teamRows.rows as any[];

  const playerRows = await db.execute(sql`
    SELECT id, name, shift_wars_team_id FROM players WHERE shift_wars_team_id IS NOT NULL
  `);
  const players = playerRows.rows as any[];

  res.json(teams.map((t, i) => ({
    position:       i + 1,
    id:             t.id,
    name:           t.name,
    points:         t.points,
    peakPoints:     t.peak_points,
    startingPoints: t.starting_points,
    wins:           t.wins,
    losses:         t.losses,
    players:        players.filter(p => p.shift_wars_team_id === t.id).map(p => ({ id: p.id, name: p.name })),
  })));
});

// ── Monthly champion history ────────────────────────────────────────────────
// Snapshotted at every reset (lib/seasonReset.ts) right before points/record
// are cleared for the new month, so a department's whole month isn't lost.
//
// With ?seasonId=NNN this instead returns every team's snapshot row for that
// one season (used by the season archive's Shift Wars tab) rather than just
// the champion across all seasons.

router.get("/shift-wars/history", async (req, res): Promise<void> => {
  const seasonId = req.query.seasonId ? Number(req.query.seasonId) : undefined;

  if (seasonId !== undefined) {
    if (!Number.isInteger(seasonId) || seasonId <= 0) { res.status(400).json({ error: "Invalid seasonId" }); return; }
    const rows = await db.execute(sql`
      SELECT h.team_id, h.team_name, h.points, h.wins, h.losses, h.is_champion
      FROM shift_wars_season_history h
      WHERE h.season_id = ${seasonId}
      ORDER BY h.points DESC, h.team_name ASC
    `);
    res.json((rows.rows as any[]).map((r, i) => ({
      position:     i + 1,
      teamId:       r.team_id,
      teamName:     r.team_name,
      points:       r.points,
      wins:         r.wins,
      losses:       r.losses,
      isChampion:   r.is_champion,
    })));
    return;
  }

  const rows = await db.execute(sql`
    SELECT h.season_id, s.name AS season_name, h.team_name, h.points, h.wins, h.losses
    FROM shift_wars_season_history h
    JOIN seasons s ON s.id = h.season_id
    WHERE h.is_champion = true
    ORDER BY h.season_id DESC
    LIMIT 24
  `);

  res.json((rows.rows as any[]).map(r => ({
    seasonId:     r.season_id,
    seasonName:   r.season_name,
    championName: r.team_name,
    points:       r.points,
    wins:         r.wins,
    losses:       r.losses,
  })));
});

// ── Match history ────────────────────────────────────────────────────────────

router.get("/shift-wars/matches", async (_req, res): Promise<void> => {
  const rows = await db.execute(sql`
    SELECT sm.id, sm.played_at, sm.stake, sm.game_type, sm.notes,
           sm.winner_team_id, wt.name AS winner_team_name,
           sm.loser_team_id, lt.name AS loser_team_name
    FROM shift_wars_matches sm
    JOIN shift_wars_teams wt ON wt.id = sm.winner_team_id
    JOIN shift_wars_teams lt ON lt.id = sm.loser_team_id
    ORDER BY sm.played_at DESC
    LIMIT 200
  `);

  res.json((rows.rows as any[]).map(r => ({
    id:             r.id,
    playedAt:       r.played_at,
    stake:          r.stake,
    gameType:       r.game_type,
    notes:          r.notes,
    winnerTeamId:   r.winner_team_id,
    winnerTeamName: r.winner_team_name,
    loserTeamId:    r.loser_team_id,
    loserTeamName:  r.loser_team_name,
  })));
});

// ── Record a Shift Wars match ────────────────────────────────────────────────

router.post("/shift-wars/matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = RecordShiftWarsMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { winnerTeamId, loserTeamId, stake, stakeMode, gameType, notes, winnerFieldedCount, loserFieldedCount, idempotencyKey } = parsed.data;

  // A retried submission reuses the same key — return the match already
  // recorded instead of re-running the whole handler. See matches.ts's own
  // identical check for the full reasoning; the partial unique index from
  // add_match_result_idempotency.ts is the real backstop for a true
  // concurrent double-submit, caught further below.
  if (idempotencyKey) {
    const existingRows = (await db.execute(sql`SELECT m.*, wt.name AS winner_name, lt.name AS loser_name FROM shift_wars_matches m JOIN shift_wars_teams wt ON wt.id = m.winner_team_id JOIN shift_wars_teams lt ON lt.id = m.loser_team_id WHERE m.idempotency_key = ${idempotencyKey} LIMIT 1`)).rows as any[];
    if (existingRows[0]) {
      const existing = existingRows[0];
      res.status(200).json({
        match: existing, winnerName: existing.winner_name, loserName: existing.loser_name,
        newWinnerTeamRank: null, newLoserTeamRank: null, winnerTeamRankChange: 0, loserTeamRankChange: 0,
      });
      return;
    }
  }

  if (winnerTeamId === loserTeamId) { res.status(400).json({ error: "A team cannot play itself" }); return; }

  const seasonId = await activeShiftWarsSeasonId();
  if (!seasonId) { res.status(400).json({ error: "No active Shift Wars season found" }); return; }

  // New live matches send a total; omitted mode preserves old clients.
  const effectiveStake = wagerPot(stake, winnerFieldedCount, loserFieldedCount, stakeMode);

  // Locked transaction for the same reason as doubles/matches.ts: reading
  // team balances, computing new ones in JS, and writing them back as
  // separate unguarded statements lets two concurrent submissions for the
  // same team race and lose one match's points to the other.
  try {
    const { match, winnerName, loserName, winnerPointsBefore, loserPointsBefore } = await db.transaction(async (tx) => {
      const teamRows = await tx.execute(sql`SELECT * FROM shift_wars_teams WHERE id IN (${winnerTeamId}, ${loserTeamId}) FOR UPDATE`);
      const teams = teamRows.rows as any[];
      const winner = teams.find(t => t.id === winnerTeamId);
      const loser  = teams.find(t => t.id === loserTeamId);

      if (!winner || !loser) throw new ShiftWarsConflictError("One or both teams not found");

      const stakeError = validateStake(
        effectiveStake,
        { points: winner.points, name: winner.name },
        { points: loser.points, name: loser.name },
      );
      if (stakeError) throw new ShiftWarsConflictError(stakeError);

      const { newWinnerPoints, newLoserPoints } = applyWager(
        effectiveStake,
        { points: winner.points },
        { points: loser.points },
      );

      await tx.execute(sql`
        UPDATE shift_wars_teams SET
          points = ${newWinnerPoints},
          peak_points = GREATEST(peak_points, ${newWinnerPoints}),
          wins = wins + 1
        WHERE id = ${winner.id}
      `);
      await tx.execute(sql`
        UPDATE shift_wars_teams SET
          points = ${newLoserPoints},
          losses = losses + 1
        WHERE id = ${loser.id}
      `);

      // Store the effective (already-scaled) stake, not the nominal input —
      // Shift Wars has no per-side breakdown to show elsewhere the way Team
      // Match returns winnerShares, so this "stake" column is the only
      // number the match history/notifications have for how many points
      // actually moved between the two departments.
      const [match] = (await tx.execute(sql`
        INSERT INTO shift_wars_matches (season_id, winner_team_id, loser_team_id, stake, game_type, notes, idempotency_key)
        VALUES (${seasonId}, ${winner.id}, ${loser.id}, ${effectiveStake}, ${gameType}, ${notes ?? null}, ${idempotencyKey ?? null})
        RETURNING *
      `)).rows as any[];

      return { match, winnerName: winner.name, loserName: loser.name, winnerPointsBefore: winner.points, loserPointsBefore: loser.points };
    });

    // Team-position rank diff (see lib/leaderboardRank.ts) — only 3 fixed
    // department teams, points-only, so "before" just needs the two
    // touched teams patched back rather than a second query.
    let winnerTeamRankChange = 0, loserTeamRankChange = 0, newWinnerTeamRank = 0, newLoserTeamRank = 0;
    try {
      const teamRows = await db.execute(sql`SELECT id, points, name FROM shift_wars_teams`);
      const roster: RankableShiftWarsTeam[] = (teamRows.rows as any[]).map(t => ({ id: t.id, points: t.points, name: t.name }));

      const afterRanks = rankShiftWarsTeams(roster);
      const beforeRoster = roster.map(t => {
        if (t.id === winnerTeamId) return { ...t, points: winnerPointsBefore };
        if (t.id === loserTeamId)  return { ...t, points: loserPointsBefore };
        return t;
      });
      const beforeRanks = rankShiftWarsTeams(beforeRoster);

      newWinnerTeamRank = afterRanks.get(winnerTeamId) ?? 0;
      newLoserTeamRank  = afterRanks.get(loserTeamId) ?? 0;
      winnerTeamRankChange = (beforeRanks.get(winnerTeamId) ?? 0) - newWinnerTeamRank;
      loserTeamRankChange  = (beforeRanks.get(loserTeamId)  ?? 0) - newLoserTeamRank;
    } catch (err) {
      console.error("Shift Wars rank-change computation error:", err);
    }

    void upsertResultPoster({
      resultRef: `shift-${match.id}`,
      leagueType: "shift_wars",
      format: "Shift Wars",
      winnerName,
      loserName,
      stake: effectiveStake,
      gameType,
      seasonId,
    });

    res.status(201).json({
      match, winnerName, loserName,
      newWinnerTeamRank, newLoserTeamRank,
      winnerTeamRankChange, loserTeamRankChange,
    });

    void checkShiftWarsAchievements(winnerTeamId)
      .catch(err => console.error("Shift Wars achievement check error:", err));

    // Push notifications (fire and forget — never delay the response). Shift
    // Wars had no notification integration at all before this. The match
    // itself only records team ids/names — no individual player attribution
    // — so the roster to notify is looked up fresh from players.shift_wars_
    // team_id rather than threaded through the transaction above.
    void (async () => {
      try {
        const rosterRows = await db.execute(sql`
          SELECT id, shift_wars_team_id FROM players WHERE shift_wars_team_id IN (${winnerTeamId}, ${loserTeamId})
        `);
        const roster = rosterRows.rows as any[];
        const winnerPlayerIds = roster.filter(p => p.shift_wars_team_id === winnerTeamId).map(p => p.id);
        const loserPlayerIds  = roster.filter(p => p.shift_wars_team_id === loserTeamId).map(p => p.id);
        await sendShiftWarsMatchResultNotification(winnerName, loserName, winnerPlayerIds, loserPlayerIds, effectiveStake);

        // Rank-change notifications for whichever department's standing
        // actually moved (see the diff computed above, before this IIFE).
        if (winnerTeamRankChange !== 0) {
          void sendRankChangeNotifications(
            winnerPlayerIds.map((id: number) => ({ id, name: winnerName, newRank: newWinnerTeamRank, oldRank: newWinnerTeamRank - winnerTeamRankChange })),
          );
        }
        if (loserTeamRankChange !== 0) {
          void sendRankChangeNotifications(
            loserPlayerIds.map((id: number) => ({ id, name: loserName, newRank: newLoserTeamRank, oldRank: newLoserTeamRank - loserTeamRankChange })),
          );
        }

        // League-wide ping — every other opted-in player, not just the two
        // departments who played.
        void sendMatchResultBroadcast(
          [...winnerPlayerIds, ...loserPlayerIds],
          "🎯 Shift Wars Result",
          `${winnerName} beat ${loserName}`,
          { winnerName, loserName },
        );

        // Auto community post. Shift Wars had the identical missing-post bug
        // as Doubles/Team Matches — mirrors the "Auto community posts" block
        // in matches.ts, posted under the first winning-team player since
        // community_posts.player_id is a single-player FK and, like Doubles,
        // there's no individual "submitter" for a team-vs-team result.
        if (winnerPlayerIds.length > 0) {
          await createAutoPost({
            playerId:        winnerPlayerIds[0],
            content:         `🎯 ${winnerName} defeated ${loserName} (+${effectiveStake} pts)`,
            autoMeta:        { type: "shift_wars_match", matchId: match.id, winnerTeamId, loserTeamId, stake: effectiveStake },
            notifyPlayerIds: loserPlayerIds,
          });
        }
      } catch (err) {
        req.log?.error?.({ err }, "Failed to send Shift Wars match result notifications");
      }
    })();
  } catch (err) {
    if (err instanceof ShiftWarsConflictError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (idempotencyKey && (err as { code?: string }).code === "23505") {
      const existingRows = (await db.execute(sql`SELECT m.*, wt.name AS winner_name, lt.name AS loser_name FROM shift_wars_matches m JOIN shift_wars_teams wt ON wt.id = m.winner_team_id JOIN shift_wars_teams lt ON lt.id = m.loser_team_id WHERE m.idempotency_key = ${idempotencyKey} LIMIT 1`)).rows as any[];
      if (existingRows[0]) {
        const existing = existingRows[0];
        res.status(200).json({
          match: existing, winnerName: existing.winner_name, loserName: existing.loser_name,
          newWinnerTeamRank: null, newLoserTeamRank: null, winnerTeamRankChange: 0, loserTeamRankChange: 0,
        });
        return;
      }
    }
    throw err;
  }
});

// ── Admin: edit a team's points directly ────────────────────────────────────
// `points` is the live, currently-in-play value — safe to correct any time.
// `startingPoints` is only the baseline the monthly reset restores points to;
// changing it doesn't touch the team's current points until the next reset.

router.patch("/admin/shift-wars/teams/:id", requireAdminSession, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid team id" }); return; }
  const parsed = UpdateTeamPointsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { points, startingPoints } = parsed.data;

  const existingRows = (await db.execute(sql`SELECT * FROM shift_wars_teams WHERE id = ${id}`)).rows as any[];
  const existing = existingRows[0];
  if (!existing) { res.status(404).json({ error: "Team not found" }); return; }

  const newPoints = points ?? existing.points;
  const newStartingPoints = startingPoints ?? existing.starting_points;

  const rows = (await db.execute(sql`
    UPDATE shift_wars_teams SET
      points          = ${newPoints},
      peak_points     = GREATEST(peak_points, ${newPoints}),
      starting_points = ${newStartingPoints}
    WHERE id = ${id}
    RETURNING *
  `)).rows as any[];
  if(points!==undefined&&Number(existing.points)!==Number(newPoints)){
    void logAdminAction(req,"shift_wars.team_points.edit","shift_wars_team",id,{teamName:existing.name,before:Number(existing.points),after:Number(newPoints)});
  }
  if(startingPoints!==undefined&&Number(existing.starting_points)!==Number(newStartingPoints)){
    void logAdminAction(req,"shift_wars.starting_points.edit","shift_wars_team",id,{teamName:existing.name,before:Number(existing.starting_points),after:Number(newStartingPoints)});
  }
  res.json(rows[0]);
});

// ── Admin: assign (or clear) a player's department team ─────────────────────

router.patch("/admin/shift-wars/players/:id/team", requireAdminSession, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid player id" }); return; }
  const parsed = AssignPlayerTeamBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }

  const existingResult=await db.execute(sql`SELECT p.id,p.name,p.shift_wars_team_id,st.name team_name FROM players p LEFT JOIN shift_wars_teams st ON st.id=p.shift_wars_team_id WHERE p.id=${id}`);
  const existing:any=existingResult.rows[0];
  if(!existing){res.status(404).json({error:"Player not found"});return;}
  let targetTeam:any=null;
  if(parsed.data.teamId!==null){
    const targetResult=await db.execute(sql`SELECT id,name FROM shift_wars_teams WHERE id=${parsed.data.teamId}`);
    targetTeam=targetResult.rows[0];
    if(!targetTeam){res.status(400).json({error:"Shift Wars team not found"});return;}
  }

  const rows = (await db.execute(sql`
    UPDATE players SET shift_wars_team_id = ${parsed.data.teamId}
    WHERE id = ${id}
    RETURNING id, name, shift_wars_team_id
  `)).rows as any[];
  if(Number(existing.shift_wars_team_id)!==Number(parsed.data.teamId)){
    void logAdminAction(req,"shift_wars.roster.assign","player",id,{playerName:existing.name,beforeTeamId:existing.shift_wars_team_id,beforeTeamName:existing.team_name,afterTeamId:parsed.data.teamId,afterTeamName:targetTeam?.name??null});
  }
  res.json(rows[0]);
});

// ── Record a "combined side" Shift Wars match ────────────────────────────────

// Reconstructs the exact success-response shape for an already-recorded
// combined-side match, by idempotency key — see
// loadDoublesCombinedMatchResponse in doubles.ts for the identical reasoning
// (used by both the pre-check below and the race fallback in the catch
// block). Returns null when no match with that key exists yet.
async function loadShiftWarsCombinedMatchResponse(idempotencyKey: string): Promise<unknown | null> {
  const matchRows = (await db.execute(sql`
    SELECT scm.*, st.name AS solo_team_name
    FROM shift_wars_combined_matches scm
    JOIN shift_wars_teams st ON st.id = scm.solo_team_id
    WHERE scm.idempotency_key = ${idempotencyKey}
    LIMIT 1
  `)).rows as any[];
  const match = matchRows[0];
  if (!match) return null;

  const sideRows = (await db.execute(sql`
    SELECT s.team_id, t.name AS team_name, s.fielded_count, s.points_delta
    FROM shift_wars_combined_match_sides s
    JOIN shift_wars_teams t ON t.id = s.team_id
    WHERE s.match_id = ${match.id}
  `)).rows as any[];

  return {
    match, soloTeamId: match.solo_team_id, soloTeamName: match.solo_team_name, soloWon: match.solo_won,
    pot: match.pot, soloPointsDelta: match.solo_points_delta,
    combinedSides: sideRows.map(s => ({ teamId: s.team_id, teamName: s.team_name, fieldedCount: s.fielded_count, pointsDelta: s.points_delta })),
  };
}

router.post("/shift-wars/combined-matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = RecordShiftWarsCombinedMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { soloTeamId, soloFieldedCount, soloWon, combinedTeams, stake, stakeMode, gameType, notes, idempotencyKey } = parsed.data;

  // A retried submission reuses the same key — return the match already
  // recorded instead of re-running the whole handler. See matches.ts's own
  // identical check for the full reasoning.
  if (idempotencyKey) {
    const existing = await loadShiftWarsCombinedMatchResponse(idempotencyKey);
    if (existing) { res.status(200).json(existing); return; }
  }

  const combinedTeamIds = combinedTeams.map(c => c.teamId);
  if (new Set(combinedTeamIds).size !== combinedTeamIds.length) {
    res.status(400).json({ error: "Combined side cannot list the same department twice" }); return;
  }
  if (combinedTeamIds.includes(soloTeamId)) {
    res.status(400).json({ error: "The solo department cannot also be part of the combined side" }); return;
  }

  const seasonId = await activeShiftWarsSeasonId();
  if (!seasonId) { res.status(400).json({ error: "No active Shift Wars season found" }); return; }

  try {
    const result = await db.transaction(async (tx) => {
      const allIds = [soloTeamId, ...combinedTeamIds];
      const teamRows = await tx.execute(sql`
        SELECT * FROM shift_wars_teams
        WHERE id = ANY(ARRAY[${sql.join(allIds.map(id => sql`${id}`), sql`, `)}]::int[])
        FOR UPDATE
      `);
      const teams = teamRows.rows as any[];
      if (teams.length !== allIds.length) throw new ShiftWarsConflictError("One or more departments not found");

      const solo = teams.find(t => t.id === soloTeamId)!;
      const combined = combinedTeamIds.map(id => teams.find(t => t.id === id)!);

      const pot = stakeMode === "total" ? stake : combinedPot(stake, soloFieldedCount, combinedTeams);
      const losingSide: "solo" | "combined" = soloWon ? "combined" : "solo";

      const stakeError = validateCombinedStake(
        pot, losingSide,
        { points: solo.points, name: solo.name },
        combined.map((c, i) => ({ points: c.points, name: c.name, fieldedCount: combinedTeams[i].fieldedCount })),
      );
      if (stakeError) throw new ShiftWarsConflictError(stakeError);

      const { newSoloPoints, soloPointsDelta, combinedResults } = applyCombinedWager(
        pot, losingSide,
        { points: solo.points },
        combined.map((c, i) => ({ points: c.points, fieldedCount: combinedTeams[i].fieldedCount })),
      );

      await tx.execute(sql`
        UPDATE shift_wars_teams SET
          points = ${newSoloPoints},
          peak_points = GREATEST(peak_points, ${newSoloPoints}),
          wins = wins + ${soloWon ? 1 : 0},
          losses = losses + ${soloWon ? 0 : 1}
        WHERE id = ${solo.id}
      `);

      const sideRows: { teamId: number; teamName: string; fieldedCount: number; pointsDelta: number }[] = [];
      for (let i = 0; i < combined.length; i++) {
        const c = combined[i];
        const cr = combinedResults[i];
        const combinedWon = !soloWon;
        await tx.execute(sql`
          UPDATE shift_wars_teams SET
            points = ${cr.newPoints},
            peak_points = GREATEST(peak_points, ${cr.newPoints}),
            wins = wins + ${combinedWon ? 1 : 0},
            losses = losses + ${combinedWon ? 0 : 1}
          WHERE id = ${c.id}
        `);
        sideRows.push({ teamId: c.id, teamName: c.name, fieldedCount: combinedTeams[i].fieldedCount, pointsDelta: cr.pointsDelta });
      }

      const [match] = (await tx.execute(sql`
        INSERT INTO shift_wars_combined_matches
          (season_id, solo_team_id, solo_fielded_count, solo_won, stake, pot, solo_points_delta, game_type, notes, idempotency_key)
        VALUES (${seasonId}, ${solo.id}, ${soloFieldedCount}, ${soloWon}, ${stake}, ${pot}, ${soloPointsDelta}, ${gameType}, ${notes ?? null}, ${idempotencyKey ?? null})
        RETURNING *
      `)).rows as any[];

      for (const side of sideRows) {
        await tx.execute(sql`
          INSERT INTO shift_wars_combined_match_sides (match_id, team_id, fielded_count, points_delta)
          VALUES (${match.id}, ${side.teamId}, ${side.fieldedCount}, ${side.pointsDelta})
        `);
      }

      return { match, solo, combined, sideRows, pot, soloPointsDelta };
    });

    const combinedPosterNames = result.sideRows.map(s => s.teamName).join(" & ");
    void upsertResultPoster({
      resultRef: `shift-combined-${result.match.id}`,
      leagueType: "shift_wars",
      format: "Shift Wars",
      winnerName: soloWon ? result.solo.name : combinedPosterNames,
      loserName: soloWon ? combinedPosterNames : result.solo.name,
      stake: result.pot,
      gameType,
      seasonId,
      resultType: "combined",
    });

    res.status(201).json({
      match: result.match,
      soloTeamId: result.solo.id,
      soloTeamName: result.solo.name,
      soloWon,
      pot: result.pot,
      soloPointsDelta: result.soloPointsDelta,
      combinedSides: result.sideRows,
    });

    // .catch() required — a bare `void` call with no handler becomes an
    // unhandled promise rejection if checkShiftWarsAchievements ever throws,
    // which crashes the whole Node process (Node >=15 default behavior),
    // taking down the server for every connected player after this match
    // already committed and responded successfully.
    void checkShiftWarsAchievements(soloWon ? result.solo.id : result.sideRows[0].teamId)
      .catch(err => console.error("Shift Wars achievement check error:", err));
    if (!soloWon) {
      for (const side of result.sideRows.slice(1)) {
        void checkShiftWarsAchievements(side.teamId)
          .catch(err => console.error("Shift Wars achievement check error:", err));
      }
    }

    // Push notifications + auto community post (fire and forget) — same
    // spirit as the normal Shift Wars match, phrased for a combined result.
    void (async () => {
      try {
        const rosterRows = await db.execute(sql`
          SELECT id, shift_wars_team_id FROM players
          WHERE shift_wars_team_id = ANY(ARRAY[${sql.join([result.solo.id, ...result.combined.map(c => c.id)].map(id => sql`${id}`), sql`, `)}]::int[])
        `);
        const roster = rosterRows.rows as any[];
        const soloPlayerIds = roster.filter(p => p.shift_wars_team_id === result.solo.id).map(p => p.id);
        const combinedPlayerIds = roster.filter(p => result.combined.some(c => c.id === p.shift_wars_team_id)).map(p => p.id);

        const combinedNames = result.sideRows.map(s => s.teamName).join(" & ");
        const winnerText = soloWon ? result.solo.name : combinedNames;
        const loserText = soloWon ? combinedNames : result.solo.name;
        const winnerPlayerIds = soloWon ? soloPlayerIds : combinedPlayerIds;
        const loserPlayerIds = soloWon ? combinedPlayerIds : soloPlayerIds;

        await sendShiftWarsMatchResultNotification(winnerText, loserText, winnerPlayerIds, loserPlayerIds, result.pot);
        void sendMatchResultBroadcast(
          [...winnerPlayerIds, ...loserPlayerIds],
          "🎯 Shift Wars Result",
          `${winnerText} beat ${loserText}`,
          { winnerText, loserText },
        );
        if (winnerPlayerIds.length > 0) {
          await createAutoPost({
            playerId: winnerPlayerIds[0],
            content: `🎯 ${winnerText} defeated ${loserText} in a combined-side handicap match (+${result.pot} pts)`,
            autoMeta: {
              type: "shift_wars_combined_match", matchId: result.match.id,
              soloTeamId: result.solo.id, combinedTeamIds: result.sideRows.map(s => s.teamId),
              pot: result.pot, soloWon,
            },
            notifyPlayerIds: loserPlayerIds,
          });
        }
      } catch (err) {
        req.log?.error?.({ err }, "Failed to send Shift Wars combined-match result notifications");
      }
    })();
  } catch (err) {
    if (err instanceof ShiftWarsConflictError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (idempotencyKey && (err as { code?: string }).code === "23505") {
      const existing = await loadShiftWarsCombinedMatchResponse(idempotencyKey);
      if (existing) { res.status(200).json(existing); return; }
    }
    throw err;
  }
});

// ── Combined-side match history ─────────────────────────────────────────────

router.get("/shift-wars/combined-matches", async (_req, res): Promise<void> => {
  const matchRows = await db.execute(sql`
    SELECT scm.id, scm.played_at, scm.solo_team_id, st.name AS solo_team_name,
           scm.solo_fielded_count, scm.solo_won, scm.stake, scm.pot,
           scm.solo_points_delta, scm.game_type, scm.notes
    FROM shift_wars_combined_matches scm
    JOIN shift_wars_teams st ON st.id = scm.solo_team_id
    ORDER BY scm.played_at DESC
    LIMIT 100
  `);
  const matches = matchRows.rows as any[];
  if (matches.length === 0) { res.json([]); return; }

  const matchIds = matches.map(m => m.id);
  const sideRows = await db.execute(sql`
    SELECT s.match_id, s.team_id, t.name AS team_name, s.fielded_count, s.points_delta
    FROM shift_wars_combined_match_sides s
    JOIN shift_wars_teams t ON t.id = s.team_id
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
    gameType: m.game_type,
    notes: m.notes,
    combinedSides: sides.filter(s => s.match_id === m.id).map(s => ({
      teamId: s.team_id, teamName: s.team_name, fieldedCount: s.fielded_count, pointsDelta: s.points_delta,
    })),
  })));
});

// ── Record a "multi-team" Shift Wars match (all 3 departments, one winner) ──

// Same purpose as loadShiftWarsCombinedMatchResponse above, for the
// multi-team shape — used by both the pre-check below and the catch-block
// race fallback.
async function loadShiftWarsMultiMatchResponse(idempotencyKey: string): Promise<unknown | null> {
  const matchRows = (await db.execute(sql`
    SELECT mm.*, wt.name AS winner_team_name
    FROM shift_wars_multi_matches mm
    JOIN shift_wars_teams wt ON wt.id = mm.winner_team_id
    WHERE mm.idempotency_key = ${idempotencyKey}
    LIMIT 1
  `)).rows as any[];
  const match = matchRows[0];
  if (!match) return null;

  const loserRows = (await db.execute(sql`
    SELECT p.team_id, t.name AS team_name, p.points_delta
    FROM shift_wars_multi_match_participants p
    JOIN shift_wars_teams t ON t.id = p.team_id
    WHERE p.match_id = ${match.id} AND p.is_winner = false
  `)).rows as any[];

  return {
    match, winnerTeamId: match.winner_team_id, winnerTeamName: match.winner_team_name, pot: match.pot,
    losers: loserRows.map(l => ({ teamId: l.team_id, teamName: l.team_name, pointsDelta: l.points_delta })),
  };
}

router.post("/shift-wars/multi-matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = RecordShiftWarsMultiMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { participantTeamIds, winnerTeamId, stake, gameType, notes, idempotencyKey } = parsed.data;

  // A retried submission reuses the same key — return the match already
  // recorded instead of re-running the whole handler. See matches.ts's own
  // identical check for the full reasoning.
  if (idempotencyKey) {
    const existing = await loadShiftWarsMultiMatchResponse(idempotencyKey);
    if (existing) { res.status(200).json(existing); return; }
  }

  if (new Set(participantTeamIds).size !== participantTeamIds.length) {
    res.status(400).json({ error: "A department cannot play itself twice in the same multi-team match" }); return;
  }
  if (!participantTeamIds.includes(winnerTeamId)) {
    res.status(400).json({ error: "The winning department must be one of the participants" }); return;
  }

  const seasonId = await activeShiftWarsSeasonId();
  if (!seasonId) { res.status(400).json({ error: "No active Shift Wars season found" }); return; }

  try {
    const result = await db.transaction(async (tx) => {
      const teamRows = await tx.execute(sql`
        SELECT * FROM shift_wars_teams
        WHERE id = ANY(ARRAY[${sql.join(participantTeamIds.map(id => sql`${id}`), sql`, `)}]::int[])
        FOR UPDATE
      `);
      const teams = teamRows.rows as any[];
      if (teams.length !== participantTeamIds.length) throw new ShiftWarsConflictError("One or more departments not found");

      const winner = teams.find(t => t.id === winnerTeamId)!;
      const losers = teams.filter(t => t.id !== winnerTeamId);

      const pot = multiMatchPot(stake, participantTeamIds.length);
      const stakeError = validateMultiStake(stake, losers.map(l => ({ points: l.points, name: l.name })));
      if (stakeError) throw new ShiftWarsConflictError(stakeError);

      const { newWinnerPoints, loserResults } = applyMultiWager(
        pot,
        { points: winner.points },
        losers.map(l => ({ points: l.points })),
        stake,
      );

      await tx.execute(sql`
        UPDATE shift_wars_teams SET
          points = ${newWinnerPoints},
          peak_points = GREATEST(peak_points, ${newWinnerPoints}),
          wins = wins + 1
        WHERE id = ${winner.id}
      `);

      const loserRows: { teamId: number; teamName: string; pointsDelta: number; eliminated: boolean }[] = [];
      for (let i = 0; i < losers.length; i++) {
        const l = losers[i];
        const lr = loserResults[i];
        await tx.execute(sql`
          UPDATE shift_wars_teams SET points = ${lr.newPoints}, losses = losses + 1 WHERE id = ${l.id}
        `);
        loserRows.push({ teamId: l.id, teamName: l.name, pointsDelta: lr.newPoints - l.points, eliminated: lr.eliminated });
      }

      const [match] = (await tx.execute(sql`
        INSERT INTO shift_wars_multi_matches
          (season_id, winner_team_id, participant_count, stake, pot, game_type, notes, idempotency_key)
        VALUES (${seasonId}, ${winner.id}, ${participantTeamIds.length}, ${stake}, ${pot}, ${gameType}, ${notes ?? null}, ${idempotencyKey ?? null})
        RETURNING *
      `)).rows as any[];

      await tx.execute(sql`
        INSERT INTO shift_wars_multi_match_participants (match_id, team_id, is_winner, points_delta, eliminated)
        VALUES (${match.id}, ${winner.id}, true, ${pot}, false)
      `);
      for (const lr of loserRows) {
        await tx.execute(sql`
          INSERT INTO shift_wars_multi_match_participants (match_id, team_id, is_winner, points_delta, eliminated)
          VALUES (${match.id}, ${lr.teamId}, false, ${lr.pointsDelta}, ${lr.eliminated})
        `);
      }

      return { match, winner, losers, loserRows, pot };
    });

    void upsertResultPoster({
      resultRef: `shift-multi-${result.match.id}`,
      leagueType: "shift_wars",
      format: "Shift Wars",
      winnerName: result.winner.name,
      loserName: result.loserRows.map(l => l.teamName).join(", "),
      stake: result.pot,
      gameType,
      seasonId,
      resultType: "multi",
    });

    res.status(201).json({
      match: result.match,
      winnerTeamId: result.winner.id,
      winnerTeamName: result.winner.name,
      pot: result.pot,
      losers: result.loserRows,
    });

    void checkShiftWarsAchievements(result.winner.id)
      .catch(err => console.error("Shift Wars achievement check error:", err));

    // Push notifications + auto community post (fire and forget) — same
    // spirit as the normal Shift Wars match, phrased for a multi-team result.
    void (async () => {
      try {
        const rosterRows = await db.execute(sql`
          SELECT id, shift_wars_team_id FROM players
          WHERE shift_wars_team_id = ANY(ARRAY[${sql.join(participantTeamIds.map(id => sql`${id}`), sql`, `)}]::int[])
        `);
        const roster = rosterRows.rows as any[];
        const winnerPlayerIds = roster.filter(p => p.shift_wars_team_id === result.winner.id).map(p => p.id);
        const loserPlayerIds  = roster.filter(p => result.losers.some(l => l.id === p.shift_wars_team_id)).map(p => p.id);
        const loserNames = result.loserRows.map(l => l.teamName).join(", ");

        await sendShiftWarsMatchResultNotification(result.winner.name, loserNames, winnerPlayerIds, loserPlayerIds, result.pot);
        void sendMatchResultBroadcast(
          [...winnerPlayerIds, ...loserPlayerIds],
          "🎯 Shift Wars Result",
          `${result.winner.name} won a 3-way multi-match`,
          { winnerName: result.winner.name, loserNames },
        );
        if (winnerPlayerIds.length > 0) {
          await createAutoPost({
            playerId: winnerPlayerIds[0],
            content: `🎯 ${result.winner.name} won a 3-way Shift Wars multi-match (beat ${loserNames}) (+${result.pot} pts)`,
            autoMeta: { type: "shift_wars_multi_match", matchId: result.match.id, winnerTeamId: result.winner.id, loserTeamIds: result.loserRows.map(l => l.teamId), pot: result.pot },
            notifyPlayerIds: loserPlayerIds,
          });
        }
      } catch (err) {
        req.log?.error?.({ err }, "Failed to send Shift Wars multi-match result notifications");
      }
    })();
  } catch (err) {
    if (err instanceof ShiftWarsConflictError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (idempotencyKey && (err as { code?: string }).code === "23505") {
      const existing = await loadShiftWarsMultiMatchResponse(idempotencyKey);
      if (existing) { res.status(200).json(existing); return; }
    }
    throw err;
  }
});

// ── Multi-team match history ─────────────────────────────────────────────────

router.get("/shift-wars/multi-matches", async (_req, res): Promise<void> => {
  const matchRows = await db.execute(sql`
    SELECT mm.id, mm.played_at, mm.winner_team_id, wt.name AS winner_team_name,
           mm.participant_count, mm.stake, mm.pot, mm.game_type, mm.notes
    FROM shift_wars_multi_matches mm
    JOIN shift_wars_teams wt ON wt.id = mm.winner_team_id
    ORDER BY mm.played_at DESC
    LIMIT 100
  `);
  const matches = matchRows.rows as any[];
  if (matches.length === 0) { res.json([]); return; }

  const matchIds = matches.map(m => m.id);
  const participantRows = await db.execute(sql`
    SELECT p.match_id, p.team_id, t.name AS team_name, p.is_winner, p.points_delta, p.eliminated
    FROM shift_wars_multi_match_participants p
    JOIN shift_wars_teams t ON t.id = p.team_id
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
    gameType: m.game_type,
    notes: m.notes,
    participants: participants.filter(p => p.match_id === m.id).map(p => ({
      teamId: p.team_id, teamName: p.team_name, isWinner: p.is_winner,
      pointsDelta: p.points_delta, eliminated: p.eliminated,
    })),
  })));
});

export default router;
