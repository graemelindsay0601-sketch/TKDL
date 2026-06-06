import { Router } from "express";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable } from "@workspace/db";
import { z } from "zod";
import { applyEloChange, calcTier } from "../lib/elo";
import { validateStake, applyWager } from "../lib/wager";
import { checkMatchAchievements, checkStatAchievements } from "../lib/achievements";

const SubmitMatchBody = z.object({
  winnerId: z.number().int().positive(),
  loserId:  z.number().int().positive(),
  stake:    z.number().int().min(0),
  gameType: z.string().optional().default("501"),
  notes:    z.string().optional(),
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

  const { winnerId, loserId, stake, gameType, notes } = parsed.data;

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

  // Insert match record
  const [match] = await db.insert(matchesTable).values({
    seasonId:   activeSeason.id,
    winnerId,
    loserId,
    winnerName: winner.name,
    loserName:  loser.name,
    stake,
    eloChange,
    gameType:   gameType ?? "501",
    notes:      notes ?? null,
  }).returning();

  // Update winner
  const newWinnerStreak = winner.currentWinStreak + 1;
  await db.update(playersTable).set({
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

  // Update loser
  await db.update(playersTable).set({
    elo:              newLoserElo,
    points:           newLoserPoints,
    seasonLosses:     loser.seasonLosses + 1,
    seasonGamesPlayed: loser.seasonGamesPlayed + 1,
    careerLosses:     loser.careerLosses + 1,
    careerGamesPlayed: loser.careerGamesPlayed + 1,
    currentWinStreak: 0,
    currentLossStreak: loser.currentLossStreak + 1,
    status:           loserEliminated ? "ELIMINATED" : loser.status,
    eliminationsCount: loser.eliminationsCount,
  }).where(eq(playersTable.id, loserId));

  // If loser eliminated, increment winner's elimination count
  if (loserEliminated) {
    await db.update(playersTable).set({
      eliminationsCount: winner.eliminationsCount + 1,
    }).where(eq(playersTable.id, winnerId));
  }

  // Update season match count
  await db.update(seasonsTable).set({
    totalMatches: activeSeason.totalMatches + 1,
  }).where(eq(seasonsTable.id, activeSeason.id));

  // Check achievements
  await checkMatchAchievements(winnerId, true,  stake, loserPointsBefore,  winnerPointsBefore, loserEliminated);
  await checkMatchAchievements(loserId,  false, stake, loserPointsBefore,  winnerPointsBefore, false);

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
  const [match] = await db.delete(matchesTable).where(eq(matchesTable.id, id)).returning();
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  res.sendStatus(204);
});

export default router;
