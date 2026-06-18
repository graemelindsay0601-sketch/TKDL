import { Router } from "express";
import { eq, sql, desc, inArray } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable, matchParticipantsTable } from "@workspace/db";
import { z } from "zod";
import { calcEloChange } from "../lib/elo";

const TeamMatchBody = z.object({
  winnerIds: z.array(z.number().int().positive()).min(1).max(6),
  loserIds:  z.array(z.number().int().positive()).min(1).max(6),
  stake:     z.number().int().min(0),
  gameType:  z.string().optional().default("team_501"),
  notes:     z.string().optional(),
});

const router = Router();

router.get("/team-matches", async (req, res): Promise<void> => {
  const limit = Number(req.query.limit) || 20;
  const matches = await db.select().from(matchesTable)
    .where(sql`${matchesTable.gameType} LIKE 'team_%' OR ${matchesTable.gameType} = 'multi_killer'`)
    .orderBy(desc(matchesTable.playedAt))
    .limit(limit);
  if (matches.length === 0) { res.json([]); return; }
  const matchIds = matches.map(m => m.id);
  const allParticipants = await db.select().from(matchParticipantsTable)
    .where(inArray(matchParticipantsTable.matchId, matchIds));
  const byMatch = new Map<number, typeof allParticipants>();
  for (const p of allParticipants) {
    if (!byMatch.has(p.matchId)) byMatch.set(p.matchId, []);
    byMatch.get(p.matchId)!.push(p);
  }
  res.json(matches.map(m => ({ ...m, participants: byMatch.get(m.id) ?? [] })));
});

router.post("/team-matches", async (req, res): Promise<void> => {
  const parsed = TeamMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.message });
    return;
  }

  const { winnerIds, loserIds, stake, gameType, notes } = parsed.data;

  // Validate no overlap between teams
  const overlap = winnerIds.filter(id => loserIds.includes(id));
  if (overlap.length > 0) {
    res.status(400).json({ error: "A player cannot be on both teams" });
    return;
  }

  // Validate no duplicate IDs within each team
  const allIds = [...winnerIds, ...loserIds];
  if (new Set(allIds).size !== allIds.length) {
    res.status(400).json({ error: "Duplicate player IDs — each player must appear only once" });
    return;
  }

  // Fetch all players
  const allPlayers = await db.select().from(playersTable)
    .where(sql`${playersTable.id} = ANY(ARRAY[${sql.join(allIds.map(id => sql`${id}`), sql`, `)}]::int[])`);

  const byId = new Map(allPlayers.map(p => [p.id, p]));
  const winnerPlayers = winnerIds.map(id => byId.get(id)).filter(Boolean) as typeof allPlayers;
  const loserPlayers  = loserIds.map(id  => byId.get(id)).filter(Boolean) as typeof allPlayers;

  if (winnerPlayers.length !== winnerIds.length) {
    res.status(400).json({ error: "One or more winning players not found" });
    return;
  }
  if (loserPlayers.length !== loserIds.length) {
    res.status(400).json({ error: "One or more losing players not found" });
    return;
  }

  // Check no eliminated players
  for (const p of [...winnerPlayers, ...loserPlayers]) {
    if (p.status === "ELIMINATED") {
      res.status(400).json({ error: `${p.name} is eliminated and cannot play` });
      return;
    }
  }

  // Validate stake — must not exceed any player's balance
  for (const p of [...winnerPlayers, ...loserPlayers]) {
    if (stake > p.points) {
      res.status(400).json({ error: `Stake (${stake}) exceeds ${p.name}'s balance (${p.points})` });
      return;
    }
  }

  const [activeSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.isActive, true)).limit(1);
  if (!activeSeason) {
    res.status(400).json({ error: "No active season found" });
    return;
  }

  // ELO: use average team ELO, apply same change to all individuals
  const avgWinnerElo = Math.round(winnerPlayers.reduce((s, p) => s + p.elo, 0) / winnerPlayers.length);
  const avgLoserElo  = Math.round(loserPlayers.reduce((s, p)  => s + p.elo, 0) / loserPlayers.length);
  const eloChange = calcEloChange(avgWinnerElo, avgLoserElo);

  const winnerName = winnerPlayers.map(p => p.name).join(" & ");
  const loserName  = loserPlayers.map(p  => p.name).join(" & ");

  const { match, loserResults } = await db.transaction(async (tx) => {
    // Insert match record (first player in each team is the "captain")
    const [newMatch] = await tx.insert(matchesTable).values({
      seasonId:   activeSeason.id,
      winnerId:   winnerPlayers[0].id,
      loserId:    loserPlayers[0].id,
      winnerName,
      loserName,
      stake,
      eloChange,
      gameType:   gameType ?? "team_501",
      notes:      notes ?? null,
    }).returning();

    // Insert all participants
    const participantRows = [
      ...winnerPlayers.map((p, i) => ({ matchId: newMatch.id, playerId: p.id, playerName: p.name, team: "winner" as const, position: i })),
      ...loserPlayers.map((p, i)  => ({ matchId: newMatch.id, playerId: p.id, playerName: p.name, team: "loser" as const,  position: i })),
    ];
    await tx.insert(matchParticipantsTable).values(participantRows);

    // Update winner players
    for (const p of winnerPlayers) {
      const newElo = p.elo + eloChange;
      const newPoints = p.points + stake;
      const newWinStreak = p.currentWinStreak + 1;
      await tx.update(playersTable).set({
        elo:               newElo,
        careerPeakElo:     Math.max(p.careerPeakElo, newElo),
        points:            newPoints,
        peakPoints:        Math.max(p.peakPoints, newPoints),
        seasonWins:        p.seasonWins + 1,
        seasonGamesPlayed: p.seasonGamesPlayed + 1,
        careerWins:        p.careerWins + 1,
        careerGamesPlayed: p.careerGamesPlayed + 1,
        careerPoints:      p.careerPoints + stake,
        currentWinStreak:  newWinStreak,
        longestWinStreak:  Math.max(p.longestWinStreak, newWinStreak),
        currentLossStreak: 0,
      }).where(eq(playersTable.id, p.id));
    }

    // Update loser players
    const txLoserResults: { id: number; newPoints: number; eliminated: boolean }[] = [];
    for (const p of loserPlayers) {
      const newPoints = Math.max(0, p.points - stake);
      const eliminated = newPoints === 0;
      await tx.update(playersTable).set({
        elo:               Math.max(800, p.elo - eloChange),
        points:            newPoints,
        seasonLosses:      p.seasonLosses + 1,
        seasonGamesPlayed: p.seasonGamesPlayed + 1,
        careerLosses:      p.careerLosses + 1,
        careerGamesPlayed: p.careerGamesPlayed + 1,
        careerPoints:      p.careerPoints - stake,
        currentWinStreak:  0,
        currentLossStreak: p.currentLossStreak + 1,
        status:            eliminated ? "ELIMINATED" : p.status,
      }).where(eq(playersTable.id, p.id));
      txLoserResults.push({ id: p.id, newPoints, eliminated });
    }

    // If any loser was eliminated, increment elimination count for all winners
    const anyEliminated = txLoserResults.some(r => r.eliminated);
    if (anyEliminated) {
      for (const p of winnerPlayers) {
        await tx.update(playersTable).set({
          eliminationsCount: p.eliminationsCount + 1,
        }).where(eq(playersTable.id, p.id));
      }
    }

    // Update season match count
    await tx.update(seasonsTable).set({
      totalMatches: activeSeason.totalMatches + 1,
    }).where(eq(seasonsTable.id, activeSeason.id));

    return { match: newMatch, loserResults: txLoserResults };
  });

  res.status(201).json({
    match,
    eloChange,
    eliminations: loserResults.filter(r => r.eliminated).map(r => r.id),
  });
});

export default router;
