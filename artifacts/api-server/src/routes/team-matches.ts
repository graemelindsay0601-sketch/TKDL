import { Router } from "express";
import { eq, and, sql, desc, inArray } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable, matchParticipantsTable } from "@workspace/db";
import { z } from "zod";
import { calcEloChange } from "../lib/elo";
import { matchSubmitRateLimit } from "../middleware/writeRateLimit";
import { createAutoPost } from "../lib/communityNotify";
import { sendRankChangeNotifications, sendTeamMatchResultNotification } from "../services/notificationService";
import { rankPlayersByPoints, type RankablePlayer } from "../lib/leaderboardRank";

const TeamMatchBody = z.object({
  winnerIds: z.array(z.number().int().positive()).min(1).max(6),
  loserIds:  z.array(z.number().int().positive()).min(1).max(6),
  stake:     z.number().int().min(1), // Rules minimum is 1 — see wager.ts validateStake for why 0 has no legitimate case here.
  gameType:  z.string().optional().default("team_501"),
  notes:     z.string().optional(),
});

const ListTeamMatchesQuery = z.object({
  limit: z.coerce.number().int().positive().max(500).optional().default(20),
});

// Splits a pot evenly across `count` recipients, remainder going to the
// first ones by index — the same "base + remainder" pattern used for
// winner shares below, now shared with the loser side too.
function splitEvenly(pot: number, count: number): number[] {
  const base = Math.floor(pot / count);
  const remainder = pot - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Every player pays/gains a flat `stake` when the teams are the same size —
// that's the whole league's baseline expectation and must not change here.
// Once the sides are uneven (Uneven Teams), the smaller side is genuinely
// outnumbered: e.g. a lone player facing a pair of separate individuals
// (not a shared-wallet doubles pair) is up against two independent stakes,
// not one. So the pot moved is stake × the BIGGER side's size — not the
// loser count — and is split evenly across whichever side is currently
// losing, with the same remainder-to-the-first-few rule used everywhere
// else in this file. For equal sizes, biggerSide === winnerCount ===
// loserCount, so this reduces to the original flat-stake behavior exactly.
function computeWagerShares(stake: number, winnerCount: number, loserCount: number) {
  const pot = stake * Math.max(winnerCount, loserCount);
  return {
    pot,
    winnerShares: splitEvenly(pot, winnerCount),
    loserShares:  splitEvenly(pot, loserCount),
  };
}

const router = Router();

router.get("/team-matches", async (req, res): Promise<void> => {
  const parsedQuery = ListTeamMatchesQuery.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: "Invalid query", details: parsedQuery.error.message });
    return;
  }
  const { limit } = parsedQuery.data;
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

router.post("/team-matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
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

  // Fetch all players — a cheap, unlocked early-reject for obviously bad
  // requests (not-found, already-eliminated, stake beyond balance). Not
  // safe to build the actual writes from: two team matches sharing a
  // player, submitted close together, could both read the same starting
  // elo/points/streak here and the second write would silently clobber the
  // first match's stat gains — the same class of race matches.ts/doubles.ts
  // already guard against. The transaction below re-reads every involved
  // player FOR UPDATE (in a fixed id order, to avoid two concurrent
  // transactions deadlocking on each other's locks), re-validates
  // elimination/stake against that locked state, and recomputes every
  // derived value from it.
  const allPlayers = await db.select().from(playersTable)
    .where(sql`${playersTable.id} = ANY(ARRAY[${sql.join(allIds.map(id => sql`${id}`), sql`, `)}]::int[])`);

  const byId = new Map(allPlayers.map(p => [p.id, p]));
  const winnerPlayersPreCheck = winnerIds.map(id => byId.get(id)).filter(Boolean) as typeof allPlayers;
  const loserPlayersPreCheck  = loserIds.map(id  => byId.get(id)).filter(Boolean) as typeof allPlayers;

  if (winnerPlayersPreCheck.length !== winnerIds.length) {
    res.status(400).json({ error: "One or more winning players not found" });
    return;
  }
  if (loserPlayersPreCheck.length !== loserIds.length) {
    res.status(400).json({ error: "One or more losing players not found" });
    return;
  }

  // Check no eliminated players
  for (const p of [...winnerPlayersPreCheck, ...loserPlayersPreCheck]) {
    if (p.status === "ELIMINATED") {
      res.status(400).json({ error: `${p.name} is eliminated and cannot play` });
      return;
    }
  }

  // Validate stake — only the LOSING side's balance is actually at risk
  // (winners only ever gain, see the pot/share comment below), and once
  // the teams are uneven a loser's real exposure isn't a flat `stake` —
  // it's their share of a pot scaled to the bigger side. computeWagerShares
  // (below, reused inside the transaction on the locked balances) is the
  // single source of truth for what each loser actually owes; this is
  // just the same computation run early against the pre-lock read for a
  // cheap, obvious-case reject.
  const preCheckShares = computeWagerShares(stake, winnerPlayersPreCheck.length, loserPlayersPreCheck.length);
  for (let i = 0; i < loserPlayersPreCheck.length; i++) {
    const p = loserPlayersPreCheck[i];
    const owed = preCheckShares.loserShares[i];
    if (owed > p.points) {
      res.status(400).json({ error: `Stake exceeds ${p.name}'s balance (would owe ${owed}, has ${p.points})` });
      return;
    }
  }

  // Team Match is an ad-hoc singles-tab wager (individual players' own
  // points/Elo), not the Doubles Event — it belongs to the singles season.
  const [activeSeason] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "singles")))
    .limit(1);
  if (!activeSeason) {
    res.status(400).json({ error: "No active season found" });
    return;
  }

  class TeamMatchConflictError extends Error {}

  let match: typeof matchesTable.$inferSelect;
  let eloChange: number;
  let loserResults: { id: number; newPoints: number; eliminated: boolean; owed: number }[];
  let winnerResults: { id: number; share: number }[];
  let beforeSnapshot: RankablePlayer[];

  try {
    const result = await db.transaction(async (tx) => {
      // Lock every involved player in a fixed, deterministic order (sorted
      // by id) regardless of which team they're on — this is what keeps
      // two overlapping team matches from deadlocking on each other's locks.
      const sortedIds = [...allIds].sort((a, b) => a - b);
      const lockedById = new Map<number, typeof allPlayers[number]>();
      for (const id of sortedIds) {
        const [row] = await tx.select().from(playersTable).where(eq(playersTable.id, id)).for("update");
        if (!row) throw new TeamMatchConflictError("One or more players not found");
        lockedById.set(id, row);
      }
      const winnerPlayers = winnerIds.map(id => lockedById.get(id)!);
      const loserPlayers  = loserIds.map(id  => lockedById.get(id)!);

      // Re-validate against the locked, authoritative state — a concurrent
      // match resolved between the pre-check above and this lock could have
      // eliminated a player or changed their balance.
      for (const p of [...winnerPlayers, ...loserPlayers]) {
        if (p.status === "ELIMINATED") throw new TeamMatchConflictError(`${p.name} is eliminated and cannot play`);
      }
      // Only the losing side is actually at risk — winners never pay in
      // this scheme, regardless of team size — and once the sides are
      // uneven what a loser owes isn't the flat `stake` either. Recomputed
      // here (not just trusted from the pre-check above) against the
      // locked, authoritative balances, using the exact same shares that
      // are about to be written below.
      const { loserShares: lockedLoserShares } = computeWagerShares(stake, winnerPlayers.length, loserPlayers.length);
      for (let i = 0; i < loserPlayers.length; i++) {
        const p = loserPlayers[i];
        const owed = lockedLoserShares[i];
        if (owed > p.points) throw new TeamMatchConflictError(`Stake exceeds ${p.name}'s balance (would owe ${owed}, has ${p.points})`);
      }

      // ELO: use average team ELO, apply same change to all individuals
      const avgWinnerElo = Math.round(winnerPlayers.reduce((s, p) => s + p.elo, 0) / winnerPlayers.length);
      const avgLoserElo  = Math.round(loserPlayers.reduce((s, p)  => s + p.elo, 0) / loserPlayers.length);
      const lockedEloChange = calcEloChange(avgWinnerElo, avgLoserElo);

      const winnerName = winnerPlayers.map(p => p.name).join(" & ");
      const loserName  = loserPlayers.map(p  => p.name).join(" & ");

      // Insert match record (first player in each team is the "captain")
      const [newMatch] = await tx.insert(matchesTable).values({
        seasonId:   activeSeason.id,
        winnerId:   winnerPlayers[0].id,
        loserId:    loserPlayers[0].id,
        winnerName,
        loserName,
        stake,
        eloChange:  lockedEloChange,
        gameType:   gameType ?? "team_501",
        notes:      notes ?? null,
      }).returning();

      // Insert all participants
      const participantRows = [
        ...winnerPlayers.map((p, i) => ({ matchId: newMatch.id, playerId: p.id, playerName: p.name, team: "winner" as const, position: i })),
        ...loserPlayers.map((p, i)  => ({ matchId: newMatch.id, playerId: p.id, playerName: p.name, team: "loser" as const,  position: i })),
      ];
      await tx.insert(matchParticipantsTable).values(participantRows);

      // Wager split for uneven teams (e.g. 2v1, 3v2, or a lone player facing
      // a pair of separate individuals like Kyle & Cammy rather than a
      // shared-wallet doubles pair): the pot is stake × the BIGGER side's
      // size — not just the loser count — because the smaller side is
      // genuinely outnumbered and should risk/gain more than a flat stake,
      // the same amount either way regardless of which side ends up
      // winning. That pot is then split evenly across the losing side
      // (what each of them pays) and, separately, evenly across the
      // winning side (what each of them gains) — any remainder from an
      // uneven split goes to the first players in each list, so the total
      // credited to winners always exactly equals the total debited from
      // losers. For equal team sizes (including a plain 1v1) biggerSide
      // equals both counts, so this reduces to the exact same flat
      // per-player amount as before — no behavior change there.
      const { winnerShares, loserShares } = computeWagerShares(stake, winnerPlayers.length, loserPlayers.length);

      // Update winner players
      for (let i = 0; i < winnerPlayers.length; i++) {
        const p = winnerPlayers[i];
        const share = winnerShares[i];
        const newElo = p.elo + lockedEloChange;
        const newPoints = p.points + share;
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
          careerPoints:      p.careerPoints + share,
          currentWinStreak:  newWinStreak,
          longestWinStreak:  Math.max(p.longestWinStreak, newWinStreak),
          currentLossStreak: 0,
        }).where(eq(playersTable.id, p.id));
      }

      // Update loser players — each pays their own share (flat `stake` for
      // equal team sizes, more than that for whoever's on the smaller side
      // of an uneven match — see the pot/share comment above).
      const txLoserResults: { id: number; newPoints: number; eliminated: boolean; owed: number }[] = [];
      for (let i = 0; i < loserPlayers.length; i++) {
        const p = loserPlayers[i];
        const owed = loserShares[i];
        const newPoints = Math.max(0, p.points - owed);
        const eliminated = newPoints === 0;
        const newLossStreak = p.currentLossStreak + 1;
        await tx.update(playersTable).set({
          elo:               Math.max(800, p.elo - lockedEloChange),
          points:            newPoints,
          seasonLosses:      p.seasonLosses + 1,
          seasonGamesPlayed: p.seasonGamesPlayed + 1,
          careerLosses:      p.careerLosses + 1,
          careerGamesPlayed: p.careerGamesPlayed + 1,
          careerPoints:      p.careerPoints - owed,
          currentWinStreak:  0,
          currentLossStreak: newLossStreak,
          longestLossStreak: Math.max(p.longestLossStreak, newLossStreak),
          careerBiggestPointsFall: Math.max(p.careerBiggestPointsFall, p.peakPoints - newPoints),
          status:            eliminated ? "ELIMINATED" : p.status,
        }).where(eq(playersTable.id, p.id));
        txLoserResults.push({ id: p.id, newPoints, eliminated, owed });
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

      // Database-side increment, not activeSeason.totalMatches + 1 — that
      // outer read happened before any lock, and two team matches with
      // entirely non-overlapping players (so no row-lock contention between
      // them) can still race on this shared counter.
      await tx.update(seasonsTable).set({
        totalMatches: sql`${seasonsTable.totalMatches} + 1`,
      }).where(eq(seasonsTable.id, activeSeason.id));

      const txWinnerResults = winnerPlayers.map((p, i) => ({ id: p.id, share: winnerShares[i] }));
      // Snapshot of every involved player's pre-match points/elo/status —
      // this is the same players table the singles leaderboard reads, so
      // a rank-change diff can reuse rankPlayersByPoints() directly rather
      // than needing its own ranking logic (unlike Doubles/Shift Wars,
      // which rank a separate teams table).
      const beforeSnapshot: RankablePlayer[] = [...winnerPlayers, ...loserPlayers].map(p => ({
        id: p.id, points: p.points, elo: p.elo, status: p.status,
      }));
      return { match: newMatch, eloChange: lockedEloChange, loserResults: txLoserResults, winnerResults: txWinnerResults, beforeSnapshot };
    });

    match          = result.match;
    eloChange      = result.eloChange;
    loserResults   = result.loserResults;
    winnerResults  = result.winnerResults;
    beforeSnapshot = result.beforeSnapshot;
  } catch (err) {
    if (err instanceof TeamMatchConflictError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  // Leaderboard-position rank diff for every player who played — reuses
  // the exact same helper the singles flow uses (routes/matches.ts), since
  // Team Match wagers/settles against individual players' own points/elo,
  // not a separate teams table.
  const rankChanges: Record<number, { newRank: number; rankChange: number }> = {};
  try {
    const roster: RankablePlayer[] = await db
      .select({ id: playersTable.id, points: playersTable.points, elo: playersTable.elo, status: playersTable.status })
      .from(playersTable)
      .where(eq(playersTable.isActive, true));

    const beforeById = new Map(beforeSnapshot.map(p => [p.id, p]));
    const afterRanks = rankPlayersByPoints(roster);
    const beforeRoster = roster.map(p => beforeById.get(p.id) ?? p);
    const beforeRanks = rankPlayersByPoints(beforeRoster);

    const notifyList: { id: number; name: string; newRank: number; oldRank: number }[] = [];
    for (const id of allIds) {
      const newRank = afterRanks.get(id) ?? 0;
      const oldRank = beforeRanks.get(id) ?? 0;
      const rankChange = oldRank - newRank;
      rankChanges[id] = { newRank, rankChange };
      if (rankChange !== 0) notifyList.push({ id, name: byId.get(id)?.name ?? "", newRank, oldRank });
    }
    if (notifyList.length > 0) void sendRankChangeNotifications(notifyList);
  } catch (err) {
    console.error("Team match rank-change computation error:", err);
  }

  res.status(201).json({
    match,
    eloChange,
    eliminations: loserResults.filter(r => r.eliminated).map(r => r.id),
    // Per-player payout — only meaningful when team sizes differ (equal
    // teams all get the same `stake` share); lets the UI show an accurate
    // "who got what" instead of assuming a flat stake per winner/loser.
    winnerShares: winnerResults,
    loserShares:  loserResults.map(r => ({ id: r.id, owed: r.owed })),
    // Keyed by player id so the result screen can look up whichever player
    // is actually viewing (see lib/leaderboardRank.ts).
    rankChanges,
  });

  // Win/loss push to every player on both sides — Team Matches previously
  // only ever notified players whose leaderboard rank happened to move
  // (sendRankChangeNotifications above), so a team match result itself was
  // otherwise invisible outside the app. Matches how Singles/Doubles/Shift
  // Wars all already notify their own participants.
  void sendTeamMatchResultNotification(match.winnerName, match.loserName, winnerIds, loserIds, stake, eloChange);

  // Auto community post (fire and forget — never delay the response). Team
  // Matches never had any community-feed integration before this — mirrors
  // the "Auto community posts" block in matches.ts, adapted for a
  // multi-player team result (posted under the winning captain, i.e. the
  // first winning player, since community_posts.player_id is a single-player
  // FK and team matches have no single "submitter").
  void (async () => {
    const eliminatedIds = loserResults.filter(r => r.eliminated).map(r => r.id);
    const parts: string[] = [`🎯 ${match.winnerName} defeated ${match.loserName} (+${eloChange} Elo, +${stake} pts)`];
    if (eliminatedIds.length > 0) parts.push(`💀 ${match.loserName} has been ELIMINATED!`);

    await createAutoPost({
      playerId:        winnerIds[0],
      content:         parts.join(" · "),
      autoMeta:        { type: "team_match", matchId: match.id, winnerIds, loserIds, eloChange, stake, eliminatedIds },
      notifyPlayerIds: loserIds,
    });
  })();
});

export default router;
