import { Router } from "express";
import { eq, desc, and, sql, or, inArray } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable, matchParticipantsTable } from "@workspace/db";
import { invalidateProgressCache } from "./players";
import { z } from "zod";
import { applyEloChange, calcTier, ELO_FLOOR } from "../lib/elo";
import { validateStake, applyWager } from "../lib/wager";
import { matchSubmitRateLimit } from "../middleware/writeRateLimit";
import { checkMatchAchievements, checkStatAchievements } from "../lib/achievements";
import { checkAndGrantTitles } from "../lib/titles";
import { createAutoPost } from "../lib/communityNotify";
import { sendMatchResultNotification, sendThreatAlertNotifications, sendMatchResultBroadcast } from "../services/notificationService";
import { addCoinsToPlayer, removeCardFromPlayer } from "../services/card-shop-service";
import { requireAdminSession } from "../middleware/requireAdminSession";

const SubmitMatchBody = z.object({
  winnerId:                z.number().int().positive(),
  loserId:                 z.number().int().positive(),
  stake:                   z.number().int().min(1), // Rules minimum is 1 — see wager.ts validateStake for why 0 has no legitimate case here.
  gameType:                z.string().optional().default("501"),
  notes:                   z.string().optional(),
  // Per-leg stats — all counts, so none of them can legitimately be
  // negative, and a checkout can't record more hits than attempts.
  winnerDarts:             z.number().int().nonnegative().optional(),
  winner100s:              z.number().int().nonnegative().optional(),
  winner140s:              z.number().int().nonnegative().optional(),
  winner170s:              z.number().int().nonnegative().optional(),
  winner180s:              z.number().int().nonnegative().optional(),
  winnerCheckoutAttempts:  z.number().int().nonnegative().optional(),
  winnerCheckoutHits:      z.number().int().nonnegative().optional(),
  loserDarts:              z.number().int().nonnegative().optional(),
  loser100s:               z.number().int().nonnegative().optional(),
  loser140s:               z.number().int().nonnegative().optional(),
  loser170s:               z.number().int().nonnegative().optional(),
  loser180s:               z.number().int().nonnegative().optional(),
  loserCheckoutAttempts:   z.number().int().nonnegative().optional(),
  loserCheckoutHits:       z.number().int().nonnegative().optional(),
  // Card Clash integration: cards used in this match, keyed by winner/loser
  // (not player1/player2) so cards get consumed from — and coins awarded
  // to — whichever player actually equipped them.
  cardsUsedInMatch:        z.object({
    winner: z.object({
      goodCards: z.array(z.object({ id: z.string(), name: z.string() })).optional().default([]),
      badCards:  z.array(z.object({ id: z.string(), name: z.string() })).optional().default([]),
    }).optional().default({ goodCards: [], badCards: [] }),
    loser: z.object({
      goodCards: z.array(z.object({ id: z.string(), name: z.string() })).optional().default([]),
      badCards:  z.array(z.object({ id: z.string(), name: z.string() })).optional().default([]),
    }).optional().default({ goodCards: [], badCards: [] }),
  }).optional(),
}).refine(
  d => d.winnerCheckoutHits === undefined || d.winnerCheckoutAttempts === undefined || d.winnerCheckoutHits <= d.winnerCheckoutAttempts,
  { message: "winnerCheckoutHits cannot exceed winnerCheckoutAttempts", path: ["winnerCheckoutHits"] },
).refine(
  d => d.loserCheckoutHits === undefined || d.loserCheckoutAttempts === undefined || d.loserCheckoutHits <= d.loserCheckoutAttempts,
  { message: "loserCheckoutHits cannot exceed loserCheckoutAttempts", path: ["loserCheckoutHits"] },
);

const ListMatchesQuery = z.object({
  limit:    z.coerce.number().int().positive().max(500).optional().default(20),
  seasonId: z.coerce.number().int().positive().optional(),
});

const router = Router();

router.get("/matches", async (req, res): Promise<void> => {
  const parsedQuery = ListMatchesQuery.safeParse(req.query);
  if (!parsedQuery.success) {
    res.status(400).json({ error: "Invalid query", details: parsedQuery.error.message });
    return;
  }
  const { limit, seasonId } = parsedQuery.data;

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

router.post("/matches", matchSubmitRateLimit, async (req, res): Promise<void> => {
  const parsed = SubmitMatchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.message });
    return;
  }

  const {
    winnerId, loserId, stake, gameType, notes,
    winnerDarts, winner100s, winner140s, winner170s, winner180s, winnerCheckoutAttempts, winnerCheckoutHits,
    loserDarts, loser100s, loser140s, loser170s, loser180s, loserCheckoutAttempts, loserCheckoutHits,
    cardsUsedInMatch,
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

  const [activeSeason] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "singles")))
    .limit(1);
  if (!activeSeason) { res.status(400).json({ error: "No active season found" }); return; }

  // The checks above use a plain, unlocked read — fine as a cheap early
  // reject for obviously bad requests, but not safe to build the actual
  // writes from: two matches for the same player submitted close together
  // (e.g. two boards finishing at once, or a double-tap) could both read
  // the same starting elo/points/streak here and the second write would
  // silently clobber the first match's stat gains. The transaction below
  // re-reads both players FOR UPDATE (in a fixed id order, to avoid two
  // concurrent transactions deadlocking on each other's locks) and
  // recomputes every derived value from that locked, authoritative state.
  class MatchConflictError extends Error {}
  let match: typeof matchesTable.$inferSelect;
  let eloChange: number, newWinnerElo: number, newLoserElo: number;
  let newWinnerPoints: number, newLoserPoints: number, loserEliminated: boolean;
  let winnerPointsBefore: number, loserPointsBefore: number;
  let winnerEloBefore: number, loserEloBefore: number;

  try {
    const result = await db.transaction(async (tx) => {
      const [lowerId, higherId] = winnerId < loserId ? [winnerId, loserId] : [loserId, winnerId];
      const [lowerRow] = await tx.select().from(playersTable).where(eq(playersTable.id, lowerId)).for("update");
      const [higherRow] = await tx.select().from(playersTable).where(eq(playersTable.id, higherId)).for("update");
      const rowById = new Map([lowerRow, higherRow].map(r => [r.id, r]));
      const w = rowById.get(winnerId)!;
      const l = rowById.get(loserId)!;

      if (w.status === "ELIMINATED") throw new MatchConflictError(`${w.name} is eliminated and cannot play`);
      if (l.status === "ELIMINATED") throw new MatchConflictError(`${l.name} is eliminated and cannot play`);
      const lockedStakeErr = validateStake(stake, w, l);
      if (lockedStakeErr) throw new MatchConflictError(lockedStakeErr);

      const eloResult = applyEloChange(w.elo, l.elo);
      const wagerResult = applyWager(stake, w, l);
      const winnerStreak = w.currentWinStreak + 1;
      const loserStreak = l.currentLossStreak + 1;

      const [newMatch] = await tx.insert(matchesTable).values({
        seasonId:               activeSeason.id,
        winnerId,
        loserId,
        winnerName:             w.name,
        loserName:              l.name,
        stake,
        eloChange:              eloResult.change,
        gameType:               gameType ?? "501",
        notes:                  notes ?? null,
        winnerDarts:            winnerDarts ?? null,
        winner100s:             winner100s ?? null,
        winner140s:             winner140s ?? null,
        winner170s:             winner170s ?? null,
        winner180s:             winner180s ?? null,
        winnerCheckoutAttempts: winnerCheckoutAttempts ?? null,
        winnerCheckoutHits:     winnerCheckoutHits ?? null,
        loserDarts:             loserDarts ?? null,
        loser100s:              loser100s ?? null,
        loser140s:              loser140s ?? null,
        loser170s:              loser170s ?? null,
        loser180s:              loser180s ?? null,
        loserCheckoutAttempts:  loserCheckoutAttempts ?? null,
        loserCheckoutHits:      loserCheckoutHits ?? null,
        wasUpsetWin:            w.points < l.points,
      }).returning();

      await tx.update(playersTable).set({
        elo:              eloResult.newWinnerElo,
        careerPeakElo:    Math.max(w.careerPeakElo, eloResult.newWinnerElo),
        points:           wagerResult.newWinnerPoints,
        peakPoints:       Math.max(w.peakPoints, wagerResult.newWinnerPoints),
        seasonWins:       w.seasonWins + 1,
        seasonGamesPlayed: w.seasonGamesPlayed + 1,
        careerWins:       w.careerWins + 1,
        careerGamesPlayed: w.careerGamesPlayed + 1,
        careerPoints:     w.careerPoints + stake,
        currentWinStreak: winnerStreak,
        longestWinStreak: Math.max(w.longestWinStreak, winnerStreak),
        currentLossStreak: 0,
      }).where(eq(playersTable.id, winnerId));

      await tx.update(playersTable).set({
        elo:              eloResult.newLoserElo,
        points:           wagerResult.newLoserPoints,
        seasonLosses:     l.seasonLosses + 1,
        seasonGamesPlayed: l.seasonGamesPlayed + 1,
        careerLosses:     l.careerLosses + 1,
        careerGamesPlayed: l.careerGamesPlayed + 1,
        careerPoints:     l.careerPoints - stake,
        currentWinStreak: 0,
        currentLossStreak: loserStreak,
        longestLossStreak: Math.max(l.longestLossStreak, loserStreak),
        careerBiggestPointsFall: Math.max(l.careerBiggestPointsFall, l.peakPoints - wagerResult.newLoserPoints),
        status:           wagerResult.loserEliminated ? "ELIMINATED" : l.status,
        eliminationsCount: l.eliminationsCount,
      }).where(eq(playersTable.id, loserId));

      if (wagerResult.loserEliminated) {
        await tx.update(playersTable).set({
          eliminationsCount: w.eliminationsCount + 1,
        }).where(eq(playersTable.id, winnerId));
      }

      await tx.update(seasonsTable).set({
        totalMatches: sql`${seasonsTable.totalMatches} + 1`,
      }).where(eq(seasonsTable.id, activeSeason.id));

      return {
        newMatch,
        eloChange: eloResult.change,
        newWinnerElo: eloResult.newWinnerElo,
        newLoserElo: eloResult.newLoserElo,
        newWinnerPoints: wagerResult.newWinnerPoints,
        newLoserPoints: wagerResult.newLoserPoints,
        loserEliminated: wagerResult.loserEliminated,
        winnerPointsBefore: w.points,
        loserPointsBefore: l.points,
        winnerEloBefore: w.elo,
        loserEloBefore: l.elo,
      };
    });

    match               = result.newMatch;
    eloChange           = result.eloChange;
    newWinnerElo        = result.newWinnerElo;
    newLoserElo         = result.newLoserElo;
    newWinnerPoints     = result.newWinnerPoints;
    newLoserPoints      = result.newLoserPoints;
    loserEliminated     = result.loserEliminated;
    winnerPointsBefore  = result.winnerPointsBefore;
    loserPointsBefore   = result.loserPointsBefore;
    winnerEloBefore     = result.winnerEloBefore;
    loserEloBefore      = result.loserEloBefore;
  } catch (err) {
    if (err instanceof MatchConflictError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }

  // Bust achievement-progress cache for both players
  invalidateProgressCache([winnerId, loserId]);

  // Handle Card Clash integration (fire and forget — never delay the response)
  // Cards are attributed per-side: whichever player equipped them is who
  // gets the coin bonus and who has them consumed from their own inventory
  // (previously this always charged the winner's inventory for every card
  // used by either player, and only fired at all if a "cardsUsedInMatch"
  // field was sent — which the frontend never actually sent, so this whole
  // block was silently dead for every regular match).
  void (async () => {
    const winnerCards = cardsUsedInMatch?.winner ?? { goodCards: [], badCards: [] };
    const loserCards  = cardsUsedInMatch?.loser  ?? { goodCards: [], badCards: [] };
    const winnerAllCards = [...winnerCards.goodCards, ...winnerCards.badCards];
    const loserAllCards  = [...loserCards.goodCards,  ...loserCards.badCards];

    if (winnerAllCards.length === 0 && loserAllCards.length === 0) {
      return; // No cards used
    }

    try {
      if (winnerAllCards.length > 0) {
        await addCoinsToPlayer(winnerId, 50 + winnerAllCards.length * 10, "card_clash_card_bonus", "League match win — Card Clash bonus"); // 50 base + 10 per card
        for (const card of winnerAllCards) {
          try {
            await removeCardFromPlayer(winnerId, card.id, 1);
          } catch (e) {
            console.error(`Failed to consume card ${card.id} for winner ${winnerId}:`, e);
          }
        }
      }

      if (loserAllCards.length > 0) {
        await addCoinsToPlayer(loserId, 25 + loserAllCards.length * 10, "card_clash_card_bonus", "League match loss — Card Clash bonus"); // 25 base + 10 per card
        for (const card of loserAllCards) {
          try {
            await removeCardFromPlayer(loserId, card.id, 1);
          } catch (e) {
            console.error(`Failed to consume card ${card.id} for loser ${loserId}:`, e);
          }
        }
      }
    } catch (e) {
      console.error("Card Clash integration error:", e);
      // Silently fail — don't disrupt match submission
    }
  })();

  // Check achievements
  await checkMatchAchievements(winnerId, loserId, true,  stake, loserPointsBefore, winnerPointsBefore, loserEliminated, match.seasonId, eloChange);
  await checkMatchAchievements(loserId,  winnerId, false, stake, loserPointsBefore, winnerPointsBefore, false, match.seasonId, eloChange);
  void checkAndGrantTitles(winnerId);
  void checkAndGrantTitles(loserId);

  // Auto community posts (fire and forget — never delay the response)
  void (async () => {
    const winnerTierBefore = calcTier(winnerEloBefore);
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
    const loserTierBefore = calcTier(loserEloBefore);
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
      await sendMatchResultNotification(winnerId, loserId, winner.name, loser.name, stake, eloChange);

      // League-wide ping — every other opted-in player, not just the two
      // who played. Uses the same "Match Results" preference toggle as the
      // personal notification above.
      void sendMatchResultBroadcast(
        [winnerId, loserId],
        "🎯 Match Result",
        `${winner.name} beat ${loser.name} • ${gameType === "Cricket" ? "Cricket" : `${gameType} Singles`}`,
        { winnerId, loserId, gameType },
      );

      // Note: leaderboard-position rank-change notifications aren't wired up here —
      // sendRankChangeNotifications() expects each player's actual leaderboard
      // position (see routes/leaderboard.ts), not a raw ELO delta, and computing
      // that live for every match is a separate piece of work from this cleanup.

      // Threat alert notifications (if gap < 15 points) — sent to whichever
      // player is now ahead, warning them the other is closing in.
      const eloGap = Math.abs(newWinnerElo - newLoserElo);
      const winnerIsAhead = newWinnerElo >= newLoserElo;
      await sendThreatAlertNotifications([
        {
          playerId: winnerIsAhead ? winnerId : loserId,
          playerName: winnerIsAhead ? winner.name : loser.name,
          threatenerId: winnerIsAhead ? loserId : winnerId,
          threateningPlayerName: winnerIsAhead ? loser.name : winner.name,
          pointGap: eloGap,
        },
      ]);

      // Award Card Clash coins (fire and forget)
      try {
        const winCoins = 20; // League win bonus
        const lossCoins = 10; // League loss bonus
        await addCoinsToPlayer(winnerId, winCoins, "match_win", "League match win");
        await addCoinsToPlayer(loserId, lossCoins, "match_win", "League match loss");

        // Update challenge progress using new manager system
        const { challengeManager } = await import("../services/challenge-manager");
        
        // Map game type to game mode for challenges
        let gameMode: "X01" | "CRICKET" | "LEAGUE" = "LEAGUE";
        if (gameType === "501") gameMode = "X01";
        if (gameType === "Cricket") gameMode = "CRICKET";
        
        // Update winner's challenges
        await challengeManager.updateProgressFromGameResult(winnerId, {
          gameMode,
          won: true,
          score: winnerDarts || 0,
        });
        
        // Update loser's challenges
        await challengeManager.updateProgressFromGameResult(loserId, {
          gameMode,
          won: false,
          score: loserDarts || 0,
        });

        // Update seasonal quests
        const { seasonalQuestService } = await import("../services/seasonal-quest-service");
        await seasonalQuestService.updateSeasonalProgress(winnerId, "league_dominator", 1);
      } catch (coinErr) {
        // Log coin errors but don't fail the match
        console.error("Card Clash coin/challenge/quest awarding error:", coinErr);
      }
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

const IdParam = z.object({ id: z.coerce.number().int().positive() });

router.get("/matches/:id", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id } = params.data;
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }
  res.json(match);
});

// Reverses ELO/points/streaks/season totals for both players — previously
// had no auth at all AND no rate limit, so anyone could erase league history
// and desync every affected player's stats with a single unauthenticated
// request. No frontend page currently calls this route at all (match
// corrections go through admin.ts's PATCH /admin/matches/:id instead), so
// gating it behind admin closes the hole with no change to real usage.
router.delete("/matches/:id", requireAdminSession, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id } = params.data;

  // Fetch match before deleting so we can revert stats
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  if (!match) { res.status(404).json({ error: "Match not found" }); return; }

  const [winner] = await db.select().from(playersTable).where(eq(playersTable.id, match.winnerId));
  const [loser]  = await db.select().from(playersTable).where(eq(playersTable.id, match.loserId));
  if (!winner || !loser) { res.status(404).json({ error: "Player not found" }); return; }

  // Team matches (gameType team_501 / multi_killer, submitted via
  // team-matches.ts) record every player involved in match_participants —
  // matchesTable.winnerId/loserId here are only the two team "captains".
  // Reversing just those two captains at a flat `stake` used to leave every
  // other participant's points/elo/streak changes uncorrected (and their
  // participant rows orphaned once the match row was gone), and even got
  // the captain's own share wrong for uneven teams — team-matches.ts pays
  // each WINNING player an uneven per-player SHARE of the pot (see the
  // comment there), never a flat `stake`. Look up every participant and
  // reverse each one's own share, reconstructed with the exact same
  // pot-splitting math the forward path used.
  const participants = await db.select().from(matchParticipantsTable)
    .where(eq(matchParticipantsTable.matchId, id));

  // All of this — delete the match, recompute streaks, revert every
  // affected player's stats, decrement the season counter — used to run as
  // separate unguarded statements. A crash or DB error partway through
  // (e.g. after the match row was gone but before the winner's stats were
  // reverted) would leave the league in a half-reverted state with no
  // record of what happened, since the match that would explain the
  // discrepancy is already deleted.
  await db.transaction(async (tx) => {
    // Delete the match record and its participant rows together — leaving
    // participant rows behind once the match is gone orphans them with
    // nothing left to explain what they refer to.
    await tx.delete(matchesTable).where(eq(matchesTable.id, id));
    if (participants.length > 0) {
      await tx.delete(matchParticipantsTable).where(eq(matchParticipantsTable.matchId, id));
    }

    // Recalculate current streaks from remaining matches for a player. Only
    // accurate for players who show up directly as a matchesTable
    // winner/loser — i.e. singles matches, and a team match's captain. A
    // team match's non-captain participants are never recorded in
    // `matches` at all, so their streaks can't be recomputed this way —
    // handled (left untouched) in the team-match branch below.
    const calcStreak = async (pid: number) => {
      const remaining = await tx.select().from(matchesTable)
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

    if (participants.length > 0) {
      // ── Team match: reverse every participant's own recorded change ────
      const winnerParticipants = participants.filter(p => p.team === "winner").sort((a, b) => a.position - b.position);
      const loserParticipants  = participants.filter(p => p.team === "loser").sort((a, b) => a.position - b.position);

      // Same pot-splitting math team-matches.ts used when paying winners
      // out of what the losing side actually staked — see that file's
      // comment for why a flat `stake` per winner is wrong for uneven teams.
      const pot = match.stake * loserParticipants.length;
      const baseShare = Math.floor(pot / winnerParticipants.length);
      const remainder = pot - baseShare * winnerParticipants.length;
      const winnerShares = winnerParticipants.map((_, i) => baseShare + (i < remainder ? 1 : 0));

      const allPlayerIds = [...winnerParticipants, ...loserParticipants].map(p => p.playerId);
      const allPlayerRows = await tx.select().from(playersTable).where(inArray(playersTable.id, allPlayerIds));
      const playerById = new Map(allPlayerRows.map(p => [p.id, p]));

      // Did any losing participant get eliminated by this match? The
      // forward path bumps every winner's eliminationsCount once per
      // eliminated loser on the losing team, so mirror that going back.
      const eliminatedLoserIds = new Set<number>();
      for (const lp of loserParticipants) {
        const p = playerById.get(lp.playerId);
        if (!p) continue; // player deleted since — nothing to revert for them
        if (p.status === "ELIMINATED" && p.points + match.stake > 0) eliminatedLoserIds.add(p.id);
      }
      const anyLoserWasEliminated = eliminatedLoserIds.size > 0;

      for (let i = 0; i < winnerParticipants.length; i++) {
        const wp = winnerParticipants[i];
        const p = playerById.get(wp.playerId);
        if (!p) continue;
        const share = winnerShares[i];
        const streak = wp.position === 0 ? await calcStreak(p.id) : null;
        await tx.update(playersTable).set({
          elo:               Math.max(ELO_FLOOR, p.elo - match.eloChange),
          points:            Math.max(0, p.points - share),
          seasonWins:        Math.max(0, p.seasonWins - 1),
          seasonGamesPlayed: Math.max(0, p.seasonGamesPlayed - 1),
          careerWins:        Math.max(0, p.careerWins - 1),
          careerGamesPlayed: Math.max(0, p.careerGamesPlayed - 1),
          careerPoints:      p.careerPoints - share,
          // Non-captain participants aren't recorded in `matches`, so their
          // streak can't be recomputed from match history the way the
          // captain's (position 0) can — left untouched rather than guessed.
          ...(wp.position === 0 ? { currentWinStreak: streak!.winStreak, currentLossStreak: streak!.lossStreak } : {}),
          ...(anyLoserWasEliminated ? { eliminationsCount: Math.max(0, p.eliminationsCount - 1) } : {}),
        }).where(eq(playersTable.id, p.id));
      }

      for (const lp of loserParticipants) {
        const p = playerById.get(lp.playerId);
        if (!p) continue;
        const restoredPoints = p.points + match.stake;
        const wasEliminated = eliminatedLoserIds.has(p.id);
        const streak = lp.position === 0 ? await calcStreak(p.id) : null;
        await tx.update(playersTable).set({
          // The forward path clamps a loser's Elo loss at ELO_FLOOR, so a
          // participant already at (or pushed to) the floor had less than
          // the nominal `eloChange` actually taken from them — blindly
          // adding the full amount back would over-credit them. We can't
          // recover the exact pre-match value once it's been floor-clamped,
          // so leave them at the floor rather than risk crediting more than
          // they legitimately lost; otherwise the subtraction was never
          // clamped and reversing it is exact.
          elo:               p.elo > ELO_FLOOR ? p.elo + match.eloChange : ELO_FLOOR,
          points:            restoredPoints,
          seasonLosses:      Math.max(0, p.seasonLosses - 1),
          seasonGamesPlayed: Math.max(0, p.seasonGamesPlayed - 1),
          careerLosses:      Math.max(0, p.careerLosses - 1),
          careerGamesPlayed: Math.max(0, p.careerGamesPlayed - 1),
          careerPoints:      p.careerPoints - match.stake,
          ...(lp.position === 0 ? { currentWinStreak: streak!.winStreak, currentLossStreak: streak!.lossStreak } : {}),
          ...(wasEliminated ? { status: "ACTIVE" } : {}),
        }).where(eq(playersTable.id, p.id));
      }
    } else {
      // ── Regular 1v1 match: revert the two recorded players ─────────────
      const [wStreak, lStreak] = await Promise.all([calcStreak(match.winnerId), calcStreak(match.loserId)]);

      // Did this match cause the loser's elimination?
      const restoredLoserPoints = loser.points + match.stake;
      const loserWasEliminated  = loser.status === "ELIMINATED" && restoredLoserPoints > 0;

      // Revert winner
      await tx.update(playersTable).set({
        elo:               Math.max(ELO_FLOOR, winner.elo - match.eloChange),
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

      // Revert loser — see the team-match branch above for why this isn't
      // always an exact `loser.elo + match.eloChange`.
      await tx.update(playersTable).set({
        elo:               loser.elo > ELO_FLOOR ? loser.elo + match.eloChange : ELO_FLOOR,
        points:            restoredLoserPoints,
        seasonLosses:      Math.max(0, loser.seasonLosses - 1),
        seasonGamesPlayed: Math.max(0, loser.seasonGamesPlayed - 1),
        careerLosses:      Math.max(0, loser.careerLosses - 1),
        careerGamesPlayed: Math.max(0, loser.careerGamesPlayed - 1),
        currentWinStreak:  lStreak.winStreak,
        currentLossStreak: lStreak.lossStreak,
        ...(loserWasEliminated ? { status: "ACTIVE" } : {}),
      }).where(eq(playersTable.id, match.loserId));
    }

    // Decrement season match count
    await tx.update(seasonsTable).set({
      totalMatches: sql`GREATEST(0, ${seasonsTable.totalMatches} - 1)`,
    }).where(eq(seasonsTable.id, match.seasonId));
  });

  res.sendStatus(204);
});

export default router;
