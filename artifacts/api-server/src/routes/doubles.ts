import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, seasonsTable } from "@workspace/db";
import { z } from "zod";
import { applyEloChange, calcTier, ELO_FLOOR } from "../lib/elo";
import { validateStake, applyWager, combinedPot, validateCombinedStake, applyCombinedWager, splitProportional } from "../lib/wager";
import { matchSubmitRateLimit } from "../middleware/writeRateLimit";
import { sendDoublesMatchResultNotification, sendMatchResultBroadcast, sendRankChangeNotifications } from "../services/notificationService";
import { createAutoPost } from "../lib/communityNotify";
import { checkDoublesAchievements } from "../lib/doubles-achievements";
import { rankDoublesTeams, type RankableDoublesTeam } from "../lib/leaderboardRank";

const GetSeasonParams = z.object({ id: z.coerce.number().int().positive() });

const RecordDoublesMatchBody = z.object({
  winnerTeamId: z.number().int().positive(),
  loserTeamId:  z.number().int().positive(),
  stake:        z.number().int().min(1), // Rules minimum is 1 — see wager.ts validateStake for why 0 has no legitimate case here.
  gameType:     z.string().optional().default("doubles_501"),
  notes:        z.string().optional(),
  // How many of each official pairing's own players actually showed up and
  // played, when Uneven Teams' "short-handed" option was used (e.g. one
  // half of a pairing plays solo against the other pairing's full two).
  // Optional and defaults to 1v1 (a flat stake) — a normal Doubles Event
  // match never sends these. The official winner/loser TEAM ids are
  // unchanged either way — a short-handed side still fields only its own
  // pairing's players, so the result still belongs to that pairing and
  // still updates the real season standings, just at a scaled stake. This
  // never allows crossing two different pairings into one ad hoc side —
  // that has no team id of its own to settle against, so it's a separate
  // Team Match (/api/team-matches) instead, not a Doubles Event result.
  winnerFieldedCount: z.number().int().positive().max(3).optional().default(1),
  loserFieldedCount:  z.number().int().positive().max(3).optional().default(1),
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
  gameType: z.string().optional().default("doubles_501"),
  notes: z.string().optional(),
});

const router = Router();

class DoublesConflictError extends Error {}

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
  const { winnerTeamId, loserTeamId, stake, gameType, notes, winnerFieldedCount, loserFieldedCount } = parsed.data;

  if (winnerTeamId === loserTeamId) { res.status(400).json({ error: "A team cannot play itself" }); return; }

  // Short-handed Uneven Teams: the pot is stake × the bigger side's fielded
  // headcount, same principle as Team Match's uneven-size pot and Shift
  // Wars' fielded-headcount scaling — a pairing that fields fewer of its
  // own players against a fully-fielded opponent risks/gains more than a
  // flat stake, not the same amount. A normal match (both counts default
  // to 1) reduces this to stake × 1 = stake, unchanged.
  const effectiveStake = stake * Math.max(winnerFieldedCount, loserFieldedCount);

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
        INSERT INTO doubles_matches (season_id, winner_team_id, loser_team_id, stake, elo_change, game_type, notes)
        VALUES (${activeSeason.id}, ${winner.id}, ${loser.id}, ${effectiveStake}, ${eloChange}, ${gameType}, ${notes ?? null})
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

    res.status(201).json({
      match, eloChange, loserEliminated,
      newWinnerTeamRank, newLoserTeamRank,
      winnerTeamRankChange, // positive = winner's team moved up the doubles standings
      loserTeamRankChange,
    });

    void checkDoublesAchievements(winnerPlayerIds, winnerTeamId, eloChange, effectiveStake);

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
    throw err;
  }
});

// ── Record a "combined side" doubles match ──────────────────────────────────

router.post("/doubles/combined-matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = RecordDoublesCombinedMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.message }); return; }
  const { soloTeamId, soloFieldedCount, soloWon, combinedTeams, stake, gameType, notes } = parsed.data;

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

      const pot = combinedPot(stake, soloFieldedCount, combinedTeams);
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
          (season_id, solo_team_id, solo_fielded_count, solo_won, stake, pot, solo_points_delta, solo_elo_delta, game_type, notes)
        VALUES (${activeSeason.id}, ${solo.id}, ${soloFieldedCount}, ${soloWon}, ${stake}, ${pot}, ${soloPointsDelta}, ${soloEloDelta}, ${gameType}, ${notes ?? null})
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
      void checkDoublesAchievements(teamPlayerIds(result.solo), result.solo.id, result.soloEloDelta, result.pot);
    } else {
      for (const side of result.sideRows) {
        const team = result.combined.find(c => c.id === side.teamId)!;
        void checkDoublesAchievements(teamPlayerIds(team), team.id, side.eloDelta, side.pointsDelta);
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

export default router;
