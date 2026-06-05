import { Router } from "express";
import { eq, desc, and } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable } from "@workspace/db";
import { SubmitMatchBody, GetMatchParams, DeleteMatchParams, ListMatchesQueryParams } from "@workspace/api-zod";
import { calcEloChange, calcTier, calcPoints } from "../lib/elo";
import { checkAndGrantAchievements } from "../lib/achievements";

const router = Router();

router.get("/matches", async (req, res): Promise<void> => {
  const query = ListMatchesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const limit = query.data.limit ?? 20;
  let q = db.select().from(matchesTable).orderBy(desc(matchesTable.playedAt)).limit(limit);

  if (query.data.seasonId) {
    const matches = await db
      .select().from(matchesTable)
      .where(eq(matchesTable.seasonId, query.data.seasonId))
      .orderBy(desc(matchesTable.playedAt))
      .limit(limit);
    res.json(matches);
    return;
  }

  const matches = await q;
  res.json(matches);
});

router.post("/matches", async (req, res): Promise<void> => {
  const parsed = SubmitMatchBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { winnerId, loserId, notes } = parsed.data;

  if (winnerId === loserId) {
    res.status(400).json({ error: "Winner and loser must be different players" });
    return;
  }

  const [winner] = await db.select().from(playersTable).where(eq(playersTable.id, winnerId));
  const [loser] = await db.select().from(playersTable).where(eq(playersTable.id, loserId));
  if (!winner) { res.status(400).json({ error: "Winner not found" }); return; }
  if (!loser) { res.status(400).json({ error: "Loser not found" }); return; }

  const [activeSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  if (!activeSeason) { res.status(400).json({ error: "No active season found" }); return; }

  const eloChange = calcEloChange(winner.elo, loser.elo);
  const points = calcPoints(winner.elo, loser.elo);

  const [match] = await db.insert(matchesTable).values({
    seasonId: activeSeason.id,
    winnerId,
    loserId,
    winnerName: winner.name,
    loserName: loser.name,
    pointsAwarded: points,
    eloChange,
    notes: notes ?? null,
  }).returning();

  // Update winner
  const newWinnerElo = winner.elo + eloChange;
  const newWinnerStreak = winner.currentWinStreak + 1;
  await db.update(playersTable).set({
    elo: newWinnerElo,
    tier: calcTier(newWinnerElo),
    careerWins: winner.careerWins + 1,
    careerGamesPlayed: winner.careerGamesPlayed + 1,
    careerWinRate: (winner.careerWins + 1) / (winner.careerGamesPlayed + 1),
    currentSeasonWins: winner.currentSeasonWins + 1,
    currentSeasonPoints: winner.currentSeasonPoints + points,
    currentWinStreak: newWinnerStreak,
    longestWinStreak: Math.max(winner.longestWinStreak, newWinnerStreak),
  }).where(eq(playersTable.id, winnerId));

  // Update loser
  const newLoserElo = Math.max(800, loser.elo - eloChange);
  await db.update(playersTable).set({
    elo: newLoserElo,
    tier: calcTier(newLoserElo),
    careerLosses: loser.careerLosses + 1,
    careerGamesPlayed: loser.careerGamesPlayed + 1,
    careerWinRate: loser.careerWins / (loser.careerGamesPlayed + 1),
    currentSeasonLosses: loser.currentSeasonLosses + 1,
    currentWinStreak: 0,
  }).where(eq(playersTable.id, loserId));

  // Update season match count
  await db.update(seasonsTable).set({ totalMatches: activeSeason.totalMatches + 1 }).where(eq(seasonsTable.id, activeSeason.id));

  // Check achievements
  await checkAndGrantAchievements(winnerId, true);
  await checkAndGrantAchievements(loserId, false);

  res.status(201).json(match);
});

router.get("/matches/:id", async (req, res): Promise<void> => {
  const params = GetMatchParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, params.data.id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  res.json(match);
});

router.delete("/matches/:id", async (req, res): Promise<void> => {
  const params = DeleteMatchParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [match] = await db.delete(matchesTable).where(eq(matchesTable.id, params.data.id)).returning();
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  res.sendStatus(204);
});

export default router;
