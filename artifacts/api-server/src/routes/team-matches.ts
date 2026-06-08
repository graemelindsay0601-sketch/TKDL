import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, playersTable, seasonsTable, teamMatchesTable, teamMatchParticipantsTable } from "@workspace/db";
import { z } from "zod";
import { calcEloChange } from "../lib/elo";

const ELO_FLOOR = 800;

const SubmitTeamMatchBody = z.object({
  winnerIds:      z.array(z.number().int().positive()).min(1).max(4),
  loserIds:       z.array(z.number().int().positive()).min(1).max(4),
  stakePerPerson: z.number().int().min(0),
  gameType:       z.string().optional().default("501"),
  notes:          z.string().optional(),
});

const router = Router();

router.get("/team-matches", async (req, res): Promise<void> => {
  const limit = Number(req.query.limit) || 20;
  const matches = await db.select().from(teamMatchesTable)
    .orderBy(desc(teamMatchesTable.playedAt))
    .limit(limit);
  res.json(matches);
});

router.post("/team-matches", async (req, res): Promise<void> => {
  const parsed = SubmitTeamMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.message });
    return;
  }

  const { winnerIds, loserIds, stakePerPerson, gameType, notes } = parsed.data;

  if (winnerIds.length !== loserIds.length) {
    res.status(400).json({ error: "Teams must have equal size" });
    return;
  }

  const allIds = [...winnerIds, ...loserIds];
  if (new Set(allIds).size !== allIds.length) {
    res.status(400).json({ error: "Duplicate player IDs — each player must appear only once" });
    return;
  }

  const allPlayers = await Promise.all(
    allIds.map(id => db.select().from(playersTable).where(eq(playersTable.id, id)).then(r => r[0]))
  );

  for (const p of allPlayers) {
    if (!p) { res.status(400).json({ error: "Player not found" }); return; }
    if (p.status === "ELIMINATED") {
      res.status(400).json({ error: `${p.name} is eliminated and cannot play` });
      return;
    }
  }

  const winners = allPlayers.slice(0, winnerIds.length);
  const losers  = allPlayers.slice(winnerIds.length);

  for (const loser of losers) {
    if (stakePerPerson > loser!.points) {
      res.status(400).json({ error: `Stake exceeds ${loser!.name}'s balance (${loser!.points} pts)` });
      return;
    }
  }

  const [activeSeason] = await db.select().from(seasonsTable)
    .where(eq(seasonsTable.isActive, true)).limit(1);
  if (!activeSeason) { res.status(400).json({ error: "No active season" }); return; }

  const avgWinnerElo = winners.reduce((s, p) => s + p!.elo, 0) / winners.length;
  const avgLoserElo  = losers.reduce((s, p)  => s + p!.elo, 0) / losers.length;

  // Points: total pool = stakePerPerson × numLosers, split evenly among winners
  const totalPool        = stakePerPerson * losers.length;
  const baseEachWinner   = Math.floor(totalPool / winners.length);
  const remainder        = totalPool - baseEachWinner * winners.length;

  const [teamMatch] = await db.insert(teamMatchesTable).values({
    seasonId:       activeSeason.id,
    gameType:       gameType ?? "501",
    stakePerPerson,
    teamSize:       winnerIds.length,
    notes:          notes ?? null,
  }).returning();

  await Promise.all([
    ...winners.map(async (winner, idx) => {
      const eloChange    = calcEloChange(winner!.elo, avgLoserElo);
      const newElo       = winner!.elo + eloChange;
      const earnedPoints = baseEachWinner + (idx === 0 ? remainder : 0);
      const newPoints    = winner!.points + earnedPoints;
      const newWinStreak = winner!.currentWinStreak + 1;

      await db.update(playersTable).set({
        elo:               newElo,
        careerPeakElo:     Math.max(winner!.careerPeakElo, newElo),
        points:            newPoints,
        peakPoints:        Math.max(winner!.peakPoints, newPoints),
        seasonWins:        winner!.seasonWins + 1,
        seasonGamesPlayed: winner!.seasonGamesPlayed + 1,
        careerWins:        winner!.careerWins + 1,
        careerGamesPlayed: winner!.careerGamesPlayed + 1,
        careerPoints:      winner!.careerPoints + earnedPoints,
        currentWinStreak:  newWinStreak,
        longestWinStreak:  Math.max(winner!.longestWinStreak, newWinStreak),
        currentLossStreak: 0,
      }).where(eq(playersTable.id, winner!.id));

      await db.insert(teamMatchParticipantsTable).values({
        teamMatchId: teamMatch.id,
        playerId:    winner!.id,
        playerName:  winner!.name,
        team:        0,
        eloChange,
        pointsChange: earnedPoints,
      });
    }),

    ...losers.map(async (loser) => {
      const eloChange      = calcEloChange(avgWinnerElo, loser!.elo);
      const newElo         = Math.max(ELO_FLOOR, loser!.elo - eloChange);
      const newPoints      = Math.max(0, loser!.points - stakePerPerson);
      const loserEliminated = newPoints === 0;

      await db.update(playersTable).set({
        elo:               newElo,
        points:            newPoints,
        seasonLosses:      loser!.seasonLosses + 1,
        seasonGamesPlayed: loser!.seasonGamesPlayed + 1,
        careerLosses:      loser!.careerLosses + 1,
        careerGamesPlayed: loser!.careerGamesPlayed + 1,
        careerPoints:      loser!.careerPoints - stakePerPerson,
        currentWinStreak:  0,
        currentLossStreak: loser!.currentLossStreak + 1,
        status:            loserEliminated ? "ELIMINATED" : loser!.status,
      }).where(eq(playersTable.id, loser!.id));

      await db.insert(teamMatchParticipantsTable).values({
        teamMatchId:  teamMatch.id,
        playerId:     loser!.id,
        playerName:   loser!.name,
        team:         1,
        eloChange:    -eloChange,
        pointsChange: -stakePerPerson,
      });
    }),
  ]);

  await db.update(seasonsTable).set({
    totalMatches: activeSeason.totalMatches + 1,
  }).where(eq(seasonsTable.id, activeSeason.id));

  const participants = await db.select().from(teamMatchParticipantsTable)
    .where(eq(teamMatchParticipantsTable.teamMatchId, teamMatch.id));

  res.status(201).json({ ...teamMatch, participants });
});

export default router;
