import { Router } from "express";
import { eq, desc, and, sql, or } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable } from "@workspace/db";
import { invalidateProgressCache } from "./players";
import { z } from "zod";
import { applyEloChange, calcTier } from "../lib/elo";
import { validateStake, applyWager } from "../lib/wager";
import { checkMatchAchievements, checkStatAchievements } from "../lib/achievements";
import { checkAndGrantTitles } from "../lib/titles";
import { createAutoPost } from "../lib/communityNotify";
import { sendMatchResultNotification, sendRankChangeNotifications, sendThreatAlertNotifications } from "../services/notificationService";

const SubmitMatchBody = z.object({
  winnerId:                z.number().int().positive(),
  loserId:                 z.number().int().positive(),
  stake:                   z.number().int().min(0),
  gameType:                z.string().optional().default("501"),
  notes:                   z.string().optional(),
  winnerDarts:             z.number().int().optional(),
  winner180s:              z.number().int().optional(),
  winnerCheckoutAttempts:  z.number().int().optional(),
  winnerCheckoutHits:      z.number().int().optional(),
  loserDarts:              z.number().int().optional(),
  loser180s:               z.number().int().optional(),
  loserCheckoutAttempts:   z.number().int().optional(),
  loserCheckoutHits:       z.number().int().optional(),
});

const router = Router();

router.get("/matches", async (req, res): Promise<void> => {
  const limit = Number(req.query.limit) || 20;
  const seasonId = req.query.seasonId ? Number(req.query.seasonId) : undefined;

  let matches;
  if (seasonId) {
    matches = await db.select().from(matchesTable)
      .where(eq(matchesTable.seasonId, seasonId))
      .orderBy(desc(matchesTable.playedAt))
      .limit(limit);
  } else {
    matches = await db.select().from(matchesTable)
      .orderBy(desc(matchesTable.playedAt))
      .limit(limit);
  }
  res.json(matches);
});

router.post("/matches", async (req, res): Promise<void> => {
  const parsed = SubmitMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.message });
    return;
  }

  const {
    winnerId, loserId, stake, gameType, notes,
    winnerDarts, winner180s, winnerCheckoutAttempts, winnerCheckoutHits,
    loserDarts, loser180s, loserCheckoutAttempts, loserCheckoutHits,
  } = parsed.data;

  if (winnerId === loserId) {
    res.status(400).json({ error: "Winner and loser must be different players" });
    return;
  }

  const [winner] = await db.select().from(playersTable).where(eq(playersTable.id, winnerId));
  const [loser]  = await db.select().from(playersTable).where(eq(playersTable.id, loserId));
  if (!winner) { res.status(400).json({ error: "Winner not found" }); return; }
  if (!loser)  { res.status(400).json({ error: "Loser not found" });  return; }

  if (winner.status === "ELIMINATED") {
    res.status(400).json({ error: `${winner.name} is eliminated and cannot play` });
    return;
  }
  if (loser.status === "ELIMINATED") {
    res.status(400).json({ error: `${loser.name} is eliminated and cannot play` });
    return;
  }

  const stakeErr = validateStake(stake, winner, loser);
  if (stakeErr) { res.status(400).json({ error: stakeErr }); return; }

  const [activeSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  if (!activeSeason) { res.status(400).json({ error: "No active season found" }); return; }

  // ELO update
  const { newWinnerElo, newLoserElo, change: eloChange } = applyEloChange(winner.elo, loser.elo);

  // Points wager
  const winnerPointsBefore = winner.points;
  const loserPointsBefore  = loser.points;
  const { newWinnerPoints, newLoserPoints, loserEliminated } = applyWager(stake, winner, loser);

  // Wrap all DB writes atomically
  const newWinnerStreak = winner.currentWinStreak + 1;
  const match = await db.transaction(async (tx) => {
    const [newMatch] = await tx.insert(matchesTable).values({
      seasonId:               activeSeason.id,
      winnerId,
      loserId,
      winnerName:             winner.name,
      loserName:              loser.name,
      stake,
      eloChange,
      gameType:               gameType ?? "501",
      notes:                  notes ?? null,
      winnerDarts:            winnerDarts ?? null,
      winner180s:             winner180s ?? null,
      winnerCheckoutAttempts: winnerCheckoutAttempts ?? null,
      winnerCheckoutHits:     winnerCheckoutHits ?? null,
      loserDarts:             loserDarts ?? null,
      loser180s:              loser180s ?? null,
      loserCheckoutAttempts:  loserCheckoutAttempts ?? null,
      loserCheckoutHits:      loserCheckoutHits ?? null,
    }).returning();

    await tx.update(playersTable).set({
      elo:              newWinnerElo,
      careerPeakElo:    Math.max(winner.careerPeakElo, newWinnerElo),
      points:           newWinnerPoints,
      peakPoints:       Math.max(winner.peakPoints, newWinnerPoints),
      seasonWins:       winner.seasonWins + 1,
      seasonGamesPlayed: winner.seasonGamesPlayed + 1,
      careerWins:       winner.careerWins + 1,
      careerGamesPlayed: winner.careerGamesPlayed + 1,
      careerPoints:     winner.careerPoints + stake,
      currentWinStreak: newWinnerStreak,
      longestWinStreak: Math.max(winner.longestWinStreak, newWinnerStreak),
      currentLossStreak: 0,
    }).where(eq(playersTable.id, winnerId));

    await tx.update(playersTable).set({
      elo:              newLoserElo,
      points:           newLoserPoints,
      seasonLosses:     loser.seasonLosses + 1,
      seasonGamesPlayed: loser.seasonGamesPlayed + 1,
      careerLosses:     loser.careerLosses + 1,
      careerGamesPlayed: loser.careerGamesPlayed + 1,
      careerPoints:     loser.careerPoints - stake,
      currentWinStreak: 0,
      currentLossStreak: loser.currentLossStreak + 1,
      status:           loserEliminated ? "ELIMINATED" : loser.status,
      eliminationsCount: loser.eliminationsCount,
    }).where(eq(playersTable.id, loserId));

    if (loserEliminated) {
      await tx.update(playersTable).set({
        eliminationsCount: winner.eliminationsCount + 1,
      }).where(eq(playersTable.id, winnerId));
    }

    await tx.update(seasonsTable).set({
      totalMatches: activeSeason.totalMatches + 1,
    }).where(eq(seasonsTable.id, activeSeason.id));

    return newMatch;
  });

  // Bust achievement-progress cache for both players
  invalidateProgressCache([winnerId, loserId]);

  // Check achievements
  await checkMatchAchievements(winnerId, loserId, true,  stake, loserPointsBefore, winnerPointsBefore, loserEliminated);
  await checkMatchAchievements(loserId,  winnerId, false, stake, loserPointsBefore, winnerPointsBefore, false);
  void checkAndGrantTitles(winnerId);
  void checkAndGrantTitles(loserId);

  // Auto community posts (fire and forget — never delay the response)
  void (async () => {
    const winnerTierBefore = calcTier(winner.elo);
    const winnerTierAfter  = calcTier(newWinnerElo);
    const loserTierAfter   = calcTier(newLoserElo);

    // Match result post
    const parts: string[] = [`🎯 ${winner.name} defeated ${loser.name} (+${eloChange} Elo, +${stake} pts)`];
    const winner180 = winner180s ?? 0;
    const loser180  = loser180s  ?? 0;
    if (winner180 > 0) parts.push(`${winner.name} scored ${winner180} × 180${winner180 > 1 ? "s" : ""}! 🏹`);
    if (loser180  > 0) parts.push(`${loser.name} scored ${loser180} × 180${loser180 > 1 ? "s" : ""}! 🏹`);
    if (loserEliminated) parts.push(`💀 ${loser.name} has been ELIMINATED!`);

    await createAutoPost({
      playerId:        winnerId,
      content:         parts.join(" · "),
      autoMeta:        { type: "match", matchId: match.id, winnerId, loserId, eloChange, stake, loserEliminated },
      notifyPlayerIds: [loserId], // notify loser; winner submitted so they know
    });

    // Tier upgrade post
    if (winnerTierAfter !== winnerTierBefore) {
      await createAutoPost({
        playerId:        winnerId,
        content:         `🏆 ${winner.name} has reached ${winnerTierAfter} tier!`,
        autoMeta:        { type: "tier_up", playerId: winnerId, from: winnerTierBefore, to: winnerTierAfter },
        notifyPlayerIds: [winnerId],
      });
    }

    // Tier drop post (losing can drop tier)
    const loserTierBefore = calcTier(loser.elo);
    if (loserTierAfter !== loserTierBefore && !loserEliminated) {
      await createAutoPost({
        playerId:        loserId,
        content:         `📉 ${loser.name} dropped to ${loserTierAfter} tier`,
        autoMeta:        { type: "tier_drop", playerId: loserId, from: loserTierBefore, to: loserTierAfter },
        notifyPlayerIds: [loserId],
      });
    }
  })();

  // Send push notifications (fire and forget)
  void (async () => {
    try {
      // Match result notification
      await sendMatchResultNotification(winnerId, loserId, match.id, stake, eloChange);
      
      // Rank change notifications (batched daily)
      const winnerRankBefore = winner.elo;
      const loserRankBefore = loser.elo;
      if (newWinnerElo !== winnerRankBefore || newLoserElo !== loserRankBefore) {
        await sendRankChangeNotifications([
          { playerId: winnerId, eloChange: newWinnerElo - winnerRankBefore },
          { playerId: loserId, eloChange: newLoserElo - loserRankBefore },
        ]);
      }
      
      // Threat alert notifications (if gap < 15 points)
      await sendThreatAlertNotifications(winnerId, loserId, newWinnerElo, newLoserElo);
    } catch (err) {
      // Log notification errors but don't fail the match submission
      console.error("Notification send error:", err);
    }
  })();

  res.status(201).json({
    ...match,
    loserEliminated,
    newWinnerPoints,
    newLoserPoints,
  });
});

router.get("/matches/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  res.json(match);
});

router.delete("/matches/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }

  // Fetch match before deleting so we can revert stats
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  const [winner] = await db.select().from(playersTable).where(eq(playersTable.id, match.winnerId));
  const [loser]  = await db.select().from(playersTable).where(eq(playersTable.id, match.loserId));
  if (!winner || !loser) { res.status(404).json({ error: "Player not found" }); return; }

  // Delete the record first
  await db.delete(matchesTable).where(eq(matchesTable.id, id));

  // Recalculate current streaks from remaining matches for a player
  const calcStreak = async (pid: number) => {
    const remaining = await db.select().from(matchesTable)
      .where(or(eq(matchesTable.winnerId, pid), eq(matchesTable.loserId, pid)))
      .orderBy(desc(matchesTable.playedAt));
    if (!remaining.length) return { winStreak: 0, lossStreak: 0 };
    const firstWon = remaining[0].winnerId === pid;
    let count = 0;
    for (const m of remaining) {
      if ((m.winnerId === pid) !== firstWon) break;
      count++;
    }
    return firstWon ? { winStreak: count, lossStreak: 0 } : { winStreak: 0, lossStreak: count };
  };

  const [wStreak, lStreak] = await Promise.all([calcStreak(match.winnerId), calcStreak(match.loserId)]);

  // Did this match cause the loser's elimination?
  const restoredLoserPoints = loser.points + match.stake;
  const loserWasEliminated  = loser.status === "ELIMINATED" && restoredLoserPoints > 0;

  // Revert winner
  await db.update(playersTable).set({
    elo:               Math.max(800, winner.elo - match.eloChange),
    points:            Math.max(0, winner.points - match.stake),
    seasonWins:        Math.max(0, winner.seasonWins - 1),
    seasonGamesPlayed: Math.max(0, winner.seasonGamesPlayed - 1),
    careerWins:        Math.max(0, winner.careerWins - 1),
    careerGamesPlayed: Math.max(0, winner.careerGamesPlayed - 1),
    careerPoints:      winner.careerPoints - match.stake,
    currentWinStreak:  wStreak.winStreak,
    currentLossStreak: wStreak.lossStreak,
    ...(loserWasEliminated ? { eliminationsCount: Math.max(0, winner.eliminationsCount - 1) } : {}),
  }).where(eq(playersTable.id, match.winnerId));

  // Revert loser
  await db.update(playersTable).set({
    elo:               loser.elo + match.eloChange,
    points:            restoredLoserPoints,
    seasonLosses:      Math.max(0, loser.seasonLosses - 1),
    seasonGamesPlayed: Math.max(0, loser.seasonGamesPlayed - 1),
    careerLosses:      Math.max(0, loser.careerLosses - 1),
    careerGamesPlayed: Math.max(0, loser.careerGamesPlayed - 1),
    currentWinStreak:  lStreak.winStreak,
    currentLossStreak: lStreak.lossStreak,
    ...(loserWasEliminated ? { status: "ACTIVE" } : {}),
  }).where(eq(playersTable.id, match.loserId));

  // Decrement season match count
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, match.seasonId));
  if (season) {
    await db.update(seasonsTable).set({
      totalMatches: Math.max(0, season.totalMatches - 1),
    }).where(eq(seasonsTable.id, match.seasonId));
  }

  res.sendStatus(204);
});

export default router;
