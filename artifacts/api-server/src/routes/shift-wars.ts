import { Router } from "express";
import { wagerPot } from "../lib/wager-pot";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { z } from "zod";
import { validateStake, applyWager, combinedPot, validateCombinedStake, applyCombinedWager } from "../lib/wager";
import { matchSubmitRateLimit } from "../middleware/writeRateLimit";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { sendShiftWarsMatchResultNotification, sendMatchResultBroadcast, sendRankChangeNotifications } from "../services/notificationService";
import { createAutoPost } from "../lib/communityNotify";
import { checkShiftWarsAchievements } from "../lib/shift-wars-achievements";
import { rankShiftWarsTeams, type RankableShiftWarsTeam } from "../lib/leaderboardRank";
import { logAdminAction } from "../lib/adminAudit";

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
  const { winnerTeamId, loserTeamId, stake, stakeMode, gameType, notes, winnerFieldedCount, loserFieldedCount } = parsed.data;

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
        INSERT INTO shift_wars_matches (season_id, winner_team_id, loser_team_id, stake, game_type, notes)
        VALUES (${seasonId}, ${winner.id}, ${loser.id}, ${effectiveStake}, ${gameType}, ${notes ?? null})
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

    res.status(201).json({
      match, winnerName, loserName,
      newWinnerTeamRank, newLoserTeamRank,
      winnerTeamRankChange, loserTeamRankChange,
    });

    void checkShiftWarsAchievements(winnerTeamId);

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

router.post("/shift-wars/combined-matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = RecordShiftWarsCombinedMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { soloTeamId, soloFieldedCount, soloWon, combinedTeams, stake, stakeMode, gameType, notes } = parsed.data;

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
          (season_id, solo_team_id, solo_fielded_count, solo_won, stake, pot, solo_points_delta, game_type, notes)
        VALUES (${seasonId}, ${solo.id}, ${soloFieldedCount}, ${soloWon}, ${stake}, ${pot}, ${soloPointsDelta}, ${gameType}, ${notes ?? null})
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

    res.status(201).json({
      match: result.match,
      soloTeamId: result.solo.id,
      soloTeamName: result.solo.name,
      soloWon,
      pot: result.pot,
      soloPointsDelta: result.soloPointsDelta,
      combinedSides: result.sideRows,
    });

    void checkShiftWarsAchievements(soloWon ? result.solo.id : result.sideRows[0].teamId);
    if (!soloWon) {
      for (const side of result.sideRows.slice(1)) void checkShiftWarsAchievements(side.teamId);
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

export default router;
