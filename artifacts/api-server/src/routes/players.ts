import { Router } from "express";
import { eq, or, desc, and, inArray, sql } from "drizzle-orm";
import { db, playersTable, matchesTable, matchParticipantsTable, playerAchievementsTable, achievementsTable, seasonStandingsTable, seasonsTable, currencyTransactionsTable } from "@workspace/db";
import { z } from "zod";
import { computeIdentity } from "../lib/identity";
import { calcTier } from "../lib/elo";
import { gamerscoreForRarity, SHADOW_BOT_ACHIEVEMENT_DEFS } from "../lib/shadow-bot-achievements";
import { logger } from "../lib/logger";
import { TITLE_DEFINITIONS, getAllPlayerTitles, checkAndGrantTitles } from "../lib/titles";
import { requireAdminSession } from "../middleware/requireAdminSession";

const progressCache = new Map<number, { data: unknown; expiresAt: number }>();
const PROGRESS_TTL_MS = 60_000;
export function invalidateProgressCache(playerIds: number[]): void {
  for (const id of playerIds) progressCache.delete(id);
}

const CreatePlayerBody = z.object({
  name:     z.string().min(1),
  playerId: z.string().optional(),
});
const UpdatePlayerBody = z.object({
  name:             z.string().min(1).optional(),
  isActive:         z.boolean().optional(),
  // Was z.string() — accepted any string at all, so a typo'd value (wrong
  // case, a stray space) would silently pass validation and desync that
  // player from every status-based query in the app (leaderboard, practice
  // eligibility, title checks — each reads this column with a slightly
  // different subset of the three real values). These three are the only
  // values anything in the codebase actually checks for.
  status:           z.enum(["ACTIVE", "ELIMINATED", "INACTIVE"]).optional(),
  practiceEnabled:  z.boolean().optional(),
  tourEnabled:      z.boolean().optional(),
  m501Enabled:      z.boolean().optional(),
  shadowBotEnabled: z.boolean().optional(),
});
const IdParam = z.object({ id: z.coerce.number().int().positive() });

const router = Router();

router.get("/players", async (_req, res): Promise<void> => {
  try {
    const players = await db.select().from(playersTable).orderBy(playersTable.name);

    // Fetch recent form (last 5 W/L) and active_title for each player in one query
    const extras = await db.execute(sql`
      SELECT
        p.id,
        p.active_title,
        (
          SELECT COALESCE(json_agg(r.form ORDER BY r.played_at DESC), '[]'::json)
          FROM (
            SELECT
              CASE WHEN m.winner_id = p.id THEN 'W' ELSE 'L' END AS form,
              m.played_at
            FROM matches m
            WHERE m.winner_id = p.id OR m.loser_id = p.id
            ORDER BY m.played_at DESC
            LIMIT 5
          ) r
        ) AS recent_form
      FROM players p
    `);

    const titleMap  = new Map(TITLE_DEFINITIONS.map(d => [d.key, d]));
    const extrasMap = new Map((extras.rows as any[]).map(r => [r.id as number, r]));

    const result = players.map(p => {
      const ex  = extrasMap.get(p.id);
      const def = ex?.active_title ? titleMap.get(ex.active_title as string) : undefined;
      return {
        ...p,
        tier:              calcTier(p.elo),
        recentForm:        ex?.recent_form ?? [],
        activeTitleLabel:  def?.title  ?? null,
        activeTitleRarity: def?.rarity ?? null,
        activeTitleIcon:   def?.icon   ?? null,
      };
    });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "GET /players failed");
    res.status(500).json({ error: "Failed" });
  }
});

// These three general-purpose CRUD routes had no auth at all — anyone who
// could reach the public URL could delete, rename, or re-flag any player's
// status with a plain curl request. The only frontend callers of any of
// these are the admin pages (user-accounts-manager.tsx and admin/index.tsx),
// so gating them behind the admin session matches how they're actually used
// and closes the hole without changing legitimate behavior. (Note:
// PATCH /players/:id/active-title and /notification-prefs are separate
// sub-routes further down used by players' own account pages — this only
// covers the general update route.)
router.post("/players", requireAdminSession, async (req, res): Promise<void> => {
  const parsed = CreatePlayerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, playerId } = parsed.data;
  const count = await db.select({ id: playersTable.id }).from(playersTable);
  const autoId = `P${String(count.length + 1).padStart(3, "0")}`;
  const [player] = await db.insert(playersTable).values({
    name,
    playerId: playerId ?? autoId,
    status: "ACTIVE",
    points: 25,
    peakPoints: 25,
  }).returning();
  res.status(201).json(player);
});

router.get("/players/:id", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, params.data.id));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(player);
});

router.patch("/players/:id", requireAdminSession, async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdatePlayerBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [player] = await db.update(playersTable).set(parsed.data).where(eq(playersTable.id, params.data.id)).returning();
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }
  res.json(player);
});

// A DELETE /players/:id used to live here too — no auth, and a bare
// `db.delete(playersTable)` with none of the cascade cleanup that
// DELETE /admin/players/:id does (achievements, season standings, titles,
// shadow bot data, tour history, practice sessions, the linked user
// account, matches, season champion references). It had zero frontend
// callers — the admin UI already uses the admin route — so rather than
// duplicate (and now have to keep in sync) a second, less-safe deletion
// path, it's removed. Use DELETE /admin/players/:id.

router.get("/players/:id/stats", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  // Recent matches (as captain or team participant)
  const captainMatches = await db.select().from(matchesTable)
    .where(or(eq(matchesTable.winnerId, id), eq(matchesTable.loserId, id)))
    .orderBy(desc(matchesTable.playedAt))
    .limit(10);

  // Find team matches where this player is a non-captain participant
  const participantRows = await db.select({
    matchId: matchParticipantsTable.matchId,
    team:    matchParticipantsTable.team,
  }).from(matchParticipantsTable).where(eq(matchParticipantsTable.playerId, id));

  const captainMatchIdSet = new Set(captainMatches.map(m => m.id));
  const participantTeamMap = new Map(participantRows.map(r => [r.matchId, r.team]));
  const nonCaptainIds = participantRows
    .filter(r => !captainMatchIdSet.has(r.matchId))
    .map(r => r.matchId);

  let participantMatches: typeof captainMatches = [];
  if (nonCaptainIds.length > 0) {
    participantMatches = await db.select().from(matchesTable)
      .where(inArray(matchesTable.id, nonCaptainIds))
      .orderBy(desc(matchesTable.playedAt))
      .limit(10);
  }

  const teamMatchIdSet = new Set(participantRows.map(r => r.matchId));

  const recentMatches = [...captainMatches, ...participantMatches]
    .sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime())
    .slice(0, 10)
    .map(m => {
      const isTeamMatch = teamMatchIdSet.has(m.id);
      const isWin = isTeamMatch && participantTeamMap.has(m.id)
        ? participantTeamMap.get(m.id) === "winner"
        : m.winnerId === id;
      return { ...m, isTeamMatch, isWin };
    });

  // Season history
  const standings = await db.select({
    seasonId:   seasonStandingsTable.seasonId,
    seasonName: seasonsTable.name,
    position:   seasonStandingsTable.position,
    wins:       seasonStandingsTable.wins,
    losses:     seasonStandingsTable.losses,
    points:     seasonStandingsTable.points,
    elo:        seasonStandingsTable.elo,
    isChampion: seasonStandingsTable.isChampion,
  })
    .from(seasonStandingsTable)
    .innerJoin(seasonsTable, eq(seasonsTable.id, seasonStandingsTable.seasonId))
    .where(eq(seasonStandingsTable.playerId, id))
    .orderBy(seasonStandingsTable.seasonId);

  // Achievements
  const playerAchievements = await db.select({
    achievement: achievementsTable,
    unlockedAt:  playerAchievementsTable.unlockedAt,
  })
    .from(playerAchievementsTable)
    .innerJoin(achievementsTable, eq(achievementsTable.id, playerAchievementsTable.achievementId))
    .where(eq(playerAchievementsTable.playerId, id))
    .orderBy(playerAchievementsTable.unlockedAt);

  // Head-to-head stats
  const allMatches = await db.select().from(matchesTable)
    .where(or(eq(matchesTable.winnerId, id), eq(matchesTable.loserId, id)))
    .orderBy(matchesTable.playedAt);
  const h2h = new Map<number, {
    wins: number; losses: number; name: string;
    matches: Array<{ id: number; playedAt: Date; isWin: boolean; eloChange: number; stake: number; gameType: string }>;
  }>();
  const allPlayers = await db.select({ id: playersTable.id, name: playersTable.name }).from(playersTable);
  const nameMap = new Map(allPlayers.map(p => [p.id, p.name]));

  for (const m of allMatches) {
    if (m.winnerId === id) {
      const entry = h2h.get(m.loserId) ?? { wins: 0, losses: 0, name: nameMap.get(m.loserId) ?? "Unknown", matches: [] };
      entry.wins++;
      entry.matches.push({ id: m.id, playedAt: m.playedAt, isWin: true, eloChange: m.eloChange, stake: m.stake, gameType: m.gameType });
      h2h.set(m.loserId, entry);
    } else {
      const entry = h2h.get(m.winnerId) ?? { wins: 0, losses: 0, name: nameMap.get(m.winnerId) ?? "Unknown", matches: [] };
      entry.losses++;
      entry.matches.push({ id: m.id, playedAt: m.playedAt, isWin: false, eloChange: m.eloChange, stake: m.stake, gameType: m.gameType });
      h2h.set(m.winnerId, entry);
    }
  }
  const headToHead = [...h2h.entries()]
    .map(([opponentId, v]) => ({
      opponentId,
      opponentName: v.name,
      wins: v.wins,
      losses: v.losses,
      matches: [...v.matches].reverse(),
    }))
    .sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses));

  // Identity
  const isChampion = standings.some(s => s.isChampion);
  const rank = 0; // approximate — full rank calc is in leaderboard
  const identity = computeIdentity(player, rank, isChampion);

  res.json({
    player: { ...player, tier: calcTier(player.elo) },
    seasonHistory: standings,
    recentMatches,
    achievements: playerAchievements,
    headToHead,
    identity,
  });
});

// ── Full Elo history for career chart ──────────────────────────────────────────
router.get("/players/:id/elo-history", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const allMatches = await db.select().from(matchesTable)
    .where(or(eq(matchesTable.winnerId, id), eq(matchesTable.loserId, id)))
    .orderBy(matchesTable.playedAt);

  const currentElo = player.elo;
  // Reconstruct Elo at each match point by working backwards from current value
  const reversed = [...allMatches].reverse();
  const eloPoints: number[] = [currentElo];
  let elo = currentElo;
  for (const m of reversed) {
    const isWin = m.winnerId === id;
    elo = isWin ? elo - m.eloChange : elo + m.eloChange;
    elo = Math.max(800, Math.min(1600, elo));
    eloPoints.unshift(elo);
  }

  const history = allMatches.map((m, i) => ({
    date: m.playedAt,
    elo: eloPoints[i + 1],
    eloChange: m.winnerId === id ? m.eloChange : -m.eloChange,
    opponent: m.winnerId === id ? m.loserName : m.winnerName,
    isWin: m.winnerId === id,
  }));

  res.json({ history, startElo: eloPoints[0], currentElo });
});

router.get("/players/:id/achievements", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const playerAchievements = await db.select({
    achievement: achievementsTable,
    unlockedAt:  playerAchievementsTable.unlockedAt,
  })
    .from(playerAchievementsTable)
    .innerJoin(achievementsTable, eq(achievementsTable.id, playerAchievementsTable.achievementId))
    .where(eq(playerAchievementsTable.playerId, params.data.id))
    .orderBy(playerAchievementsTable.unlockedAt);
  res.json(playerAchievements);
});

// ── Career Journey: chronological timeline of milestones ───────────────────────
router.get("/players/:id/career-journey", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  type JourneyEvent = {
    date: any;
    type: "joined" | "achievement" | "tier" | "champion" | "peak_elo";
    title: string;
    description?: string;
    icon?: string;
    rarity?: string;
    // Present only on "achievement" events — lets the frontend link through
    // to the unified trophy detail page (/achievements/core/:key) instead of
    // dead-ending on the player's own profile.
    achievementKey?: string;
  };
  const events: JourneyEvent[] = [];

  events.push({
    date: player.createdAt,
    type: "joined",
    title: "Joined TKDL",
    icon: "🎯",
  });

  const achievementRows = await db.select({
    key:         achievementsTable.key,
    name:        achievementsTable.name,
    description: achievementsTable.description,
    icon:        achievementsTable.icon,
    rarity:      achievementsTable.rarity,
    unlockedAt:  playerAchievementsTable.unlockedAt,
  })
    .from(playerAchievementsTable)
    .innerJoin(achievementsTable, eq(achievementsTable.id, playerAchievementsTable.achievementId))
    .where(eq(playerAchievementsTable.playerId, id));
  for (const a of achievementRows) {
    events.push({
      date: a.unlockedAt,
      type: "achievement",
      title: a.name,
      description: a.description ?? undefined,
      icon: a.icon ?? "🏆",
      rarity: a.rarity ?? undefined,
      achievementKey: a.key,
    });
  }

  const championRows = await db.select({
    seasonName: seasonsTable.name,
    endDate:    seasonsTable.endDate,
    startDate:  seasonsTable.startDate,
  })
    .from(seasonStandingsTable)
    .innerJoin(seasonsTable, eq(seasonsTable.id, seasonStandingsTable.seasonId))
    .where(and(eq(seasonStandingsTable.playerId, id), eq(seasonStandingsTable.isChampion, true)));
  for (const c of championRows) {
    events.push({
      date: c.endDate ?? c.startDate,
      type: "champion",
      title: `Champion — ${c.seasonName}`,
      icon: "👑",
    });
  }

  // Elo tier crossings + peak Elo — reconstructed the same way as /elo-history
  const allMatches = await db.select().from(matchesTable)
    .where(or(eq(matchesTable.winnerId, id), eq(matchesTable.loserId, id)))
    .orderBy(matchesTable.playedAt);

  if (allMatches.length > 0) {
    const currentElo = player.elo;
    const reversed = [...allMatches].reverse();
    const eloPoints: number[] = [currentElo];
    let elo = currentElo;
    for (const m of reversed) {
      const isWin = m.winnerId === id;
      elo = isWin ? elo - m.eloChange : elo + m.eloChange;
      elo = Math.max(800, Math.min(1600, elo));
      eloPoints.unshift(elo);
    }

    // One milestone event the first time a player's Elo crosses into each
    // tier — driven by calcTier() so these always agree with the tier badge
    // shown everywhere else, across the full Silver→Diamond ladder. Ordered
    // low-to-high so a match that jumps straight past a tier (e.g. Bronze
    // to Gold in one win) still credits every tier passed through, not just
    // the one landed on.
    const TIER_LADDER: { tier: string; title: string; icon: string }[] = [
      { tier: "Silver",   title: "Reached Silver Tier",   icon: "🥈" },
      { tier: "Gold",     title: "Reached Gold Tier",     icon: "🥇" },
      { tier: "Platinum", title: "Reached Platinum Tier", icon: "🏆" },
      { tier: "Diamond",  title: "Reached Diamond Tier",  icon: "💎" },
    ];
    const reachedTiers = new Set<string>();
    let peakElo = eloPoints[0];
    let peakDate: any = allMatches[0]?.playedAt;
    for (let i = 0; i < allMatches.length; i++) {
      const eloAfter = eloPoints[i + 1];
      const playedAt = allMatches[i].playedAt;
      if (eloAfter > peakElo) { peakElo = eloAfter; peakDate = playedAt; }
      const tierAfter = calcTier(eloAfter);
      const reachedIdx = TIER_LADDER.findIndex(t => t.tier === tierAfter);
      for (let j = 0; j <= reachedIdx; j++) {
        const { tier, title, icon } = TIER_LADDER[j]!;
        if (!reachedTiers.has(tier)) {
          reachedTiers.add(tier);
          events.push({ date: playedAt, type: "tier", title, icon });
        }
      }
    }

    events.push({ date: peakDate, type: "peak_elo", title: `Peak ELO: ${peakElo}`, icon: "📈" });
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  res.json({ player: { id: player.id, name: player.name }, events });
});

router.get("/players/:id/achievement-progress", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  const cached = progressCache.get(id);
  if (cached && Date.now() < cached.expiresAt) { res.json(cached.data); return; }

  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
  if (!player) { res.status(404).json({ error: "Player not found" }); return; }

  const allAchievements = await db.select().from(achievementsTable).orderBy(achievementsTable.priority, achievementsTable.id);
  const unlocked = await db.select({ achievementId: playerAchievementsTable.achievementId, unlockedAt: playerAchievementsTable.unlockedAt })
    .from(playerAchievementsTable).where(eq(playerAchievementsTable.playerId, id));
  const unlockedMap = new Map(unlocked.map(u => [u.achievementId, u.unlockedAt]));

  // Load season standings for season-based progress
  const standings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.playerId, id));
  const maxSeasonWins   = standings.reduce((m, s) => Math.max(m, s.wins), 0);
  const maxSeasonPoints = standings.reduce((m, s) => Math.max(m, s.points), 0);
  const seasonsPlayed   = standings.length;
  const seasonsWon      = standings.filter(s => s.isChampion).length;

  // Load matches for match-based progress
  const allMatches = await db.select().from(matchesTable)
    .where(or(eq(matchesTable.winnerId, id), eq(matchesTable.loserId, id)));
  const wins = allMatches.filter(m => m.winnerId === id);
  const highStakeWins25 = wins.filter(m => (m.stake ?? 0) >= 25).length;
  const highStakeWins10 = wins.filter(m => (m.stake ?? 0) >= 10).length;
  const highStakeMatches10 = allMatches.filter(m => (m.stake ?? 0) >= 10).length;

  // Max wins vs same opponent
  const oppWins = new Map<number, number>();
  for (const m of wins) oppWins.set(m.loserId, (oppWins.get(m.loserId) ?? 0) + 1);
  const maxSameOppWins = Math.max(0, ...[...oppWins.values()]);

  // Format wins
  const fmtWinCounts: Record<string, number> = {};
  for (const m of wins) {
    const t = normalizeGameType(m.gameType);
    fmtWinCounts[t] = (fmtWinCounts[t] ?? 0) + 1;
  }
  const cricketWins      = fmtWinCounts["Cricket"] ?? 0;
  const wins301          = fmtWinCounts["301"] ?? 0;
  const wins501          = fmtWinCounts["501"] ?? 0;
  const trebleWins       = fmtWinCounts["Treble"] ?? 0;
  const uniqueFormatsWon = Object.keys(fmtWinCounts).length;
  const uniqueOppBeaten  = new Set(wins.map(m => m.loserId)).size;
  const allInWins        = wins.filter(m => (m.stake ?? 0) >= 20).length;
  const juneWins         = wins.filter(m => m.seasonId === 3).length;
  const playedSeason1    = allMatches.some(m => m.seasonId === 1) ? 1 : 0;

  // Rivalry match count (max vs single opponent)
  const oppGamesAll = new Map<number, number>();
  for (const m of allMatches) {
    const opp = m.winnerId === id ? m.loserId : m.winnerId;
    oppGamesAll.set(opp, (oppGamesAll.get(opp) ?? 0) + 1);
  }
  const maxRivalryMatches = Math.max(0, ...[...oppGamesAll.values()]);

  // Same-day and same-week max wins
  const wByDay: Record<string, number> = {};
  const wByWeek: Record<string, number> = {};
  for (const m of wins) {
    const day = new Date(m.playedAt).toISOString().split("T")[0];
    wByDay[day] = (wByDay[day] ?? 0) + 1;
    const d = new Date(m.playedAt); const mon = new Date(d);
    mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const wk = mon.toISOString().split("T")[0];
    wByWeek[wk] = (wByWeek[wk] ?? 0) + 1;
  }
  const maxSameDayWins  = Math.max(0, ...Object.values(wByDay));
  const maxSameWeekWins = Math.max(0, ...Object.values(wByWeek));

  // Consecutive high-stake wins
  const sortedWins = [...wins].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());
  let maxConsecHigh = 0; let curConsecHigh = 0;
  for (const m of sortedWins) {
    if ((m.stake ?? 0) >= 10) { curConsecHigh++; maxConsecHigh = Math.max(maxConsecHigh, curConsecHigh); }
    else curConsecHigh = 0;
  }

  // Season-based new stats
  const top3Finishes    = standings.filter(s => s.position <= 3).length;
  const unbeatenSeasons = standings.filter(s => s.losses === 0 && s.wins >= 5).length;
  const sortedS         = [...standings].sort((a, b) => a.seasonId - b.seasonId);
  let consecTitles = 0;
  for (let i = 1; i < sortedS.length; i++) {
    if (sortedS[i - 1].isChampion && sortedS[i].isChampion) { consecTitles = 1; break; }
  }
  const multiSeasonWins    = standings.filter(s => s.wins > 0).length;
  const unelimSeasons      = standings.filter(s => s.points > 0 && (s.wins + s.losses) >= 5).length;
  const firstSeasonPoints  = sortedS[0]?.points ?? 0;
  const firstSeasonIsTop3  = (sortedS[0] && sortedS[0].position <= 3) ? 1 : 0;

  const totalGames = player.careerGamesPlayed;
  const winRate = totalGames > 0 ? (player.careerWins / totalGames) * 100 : 0;

  // Top-ranked-win counts (GIANT_KILLER/KING_SLAYER/CONQUEROR) and the
  // comeback-streak scan (COMEBACK_KING) — same "top-ranked = best finishing
  // position that season" approximation and same chronological scan used by
  // the real grant logic in lib/achievements.ts's
  // checkTopRankedAndComebackAchievements, so the progress bar shown here
  // always agrees with what actually unlocks the achievement.
  let top3Wins = 0, top1Wins = 0, uniqueTop5Beaten = 0;
  const winOpponentIds = [...new Set(wins.map(m => m.loserId))];
  if (winOpponentIds.length > 0) {
    const oppStandings = await db.select({
      seasonId: seasonStandingsTable.seasonId,
      playerId: seasonStandingsTable.playerId,
      position: seasonStandingsTable.position,
    }).from(seasonStandingsTable).where(inArray(seasonStandingsTable.playerId, winOpponentIds));
    const posOf = new Map(oppStandings.map(r => [`${r.seasonId}:${r.playerId}`, r.position]));
    const top5Set = new Set<number>();
    for (const m of wins) {
      const pos = posOf.get(`${m.seasonId}:${m.loserId}`);
      if (pos == null) continue;
      if (pos <= 3) top3Wins++;
      if (pos === 1) top1Wins++;
      if (pos <= 5) top5Set.add(m.loserId);
    }
    uniqueTop5Beaten = top5Set.size;
  }

  let comebackStreak = 0;
  {
    const chrono = [...allMatches].sort((a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime());
    let lossStreak = 0, winStreakAfterSlump = 0, sawSlump = false;
    for (const m of chrono) {
      if (m.winnerId !== id) { lossStreak++; sawSlump = false; winStreakAfterSlump = 0; continue; }
      if (lossStreak >= 2) sawSlump = true;
      lossStreak = 0;
      if (!sawSlump) { winStreakAfterSlump = 0; continue; }
      winStreakAfterSlump++;
      comebackStreak = Math.max(comebackStreak, winStreakAfterSlump);
    }
  }

  const massiveSwingWins = wins.filter(m => (m.eloChange ?? 0) >= 100).length;

  const totalHiddenAchievements = allAchievements.filter(a => a.hidden && a.key !== "MYSTIC").length;
  const hiddenUnlockedCount = allAchievements.filter(a => a.hidden && a.key !== "MYSTIC" && unlockedMap.has(a.id)).length;
  const hiddenUnlockedFraction = totalHiddenAchievements > 0 ? hiddenUnlockedCount / totalHiddenAchievements : 0;

  function getProgress(key: string, criteriaType: string, criteriaValue: number, secondaryCriteria: string | null, secondaryValue: number | null): number {
    // GIANT_KILLER/KING_SLAYER/CONQUEROR all share criteriaType
    // TOP_RANKED_WINS but mean three different things ("beat a top-3
    // player N times" / "beat the #1 player N times" / "beat all of the
    // top 5") — criteriaType+criteriaValue alone can't tell them apart, so
    // switch on the achievement key for these first.
    if (key === "GIANT_KILLER") return top3Wins;
    if (key === "KING_SLAYER")  return top1Wins;
    if (key === "CONQUEROR")    return uniqueTop5Beaten;
    switch (criteriaType) {
      case "CAREER_WINS":          return player.careerWins;
      case "CAREER_GAMES":         return player.careerGamesPlayed;
      case "WIN_STREAK":           return player.longestWinStreak;
      case "PEAK_ELO":             return player.careerPeakElo;
      case "WIN_RATE":             return Math.round(winRate);
      case "CAREER_POINTS":        return player.careerPoints;
      case "ELIMINATIONS":         return player.eliminationsCount;
      case "TOTAL_ACHIEVEMENTS":   return unlocked.length;
      case "NEVER_ELIMINATED":     return player.eliminationsCount === 0 ? 1 : 0;
      case "HIGH_STAKE_WIN":       return criteriaValue >= 25 ? highStakeWins25 : highStakeWins10;
      case "HIGH_STAKES_TOTAL":    return highStakeMatches10;
      case "HIGH_STAKES_MATCHES":  return highStakeMatches10;
      case "SAME_OPPONENT_WINS":   return maxSameOppWins;
      case "SEASON_WINS":          return maxSeasonWins;
      case "SEASON_POINTS":        return maxSeasonPoints;
      case "MULTI_SEASON_PLAYS":   return seasonsPlayed;
      case "SEASON_CHAMPION_COUNT":return seasonsWon;
      case "SEASON_POINTS_LEADER":          return seasonsWon > 0 ? 1 : 0;
      case "CRICKET_WINS":                  return cricketWins;
      case "WINS_301":                      return wins301;
      case "WINS_501":                      return wins501;
      case "TREBLE_WINS":                   return trebleWins;
      case "UNIQUE_FORMATS_WON":            return uniqueFormatsWon;
      case "UNIQUE_OPPONENTS_BEATEN":       return uniqueOppBeaten;
      case "RIVALRY_MATCH_COUNT":           return maxRivalryMatches;
      case "SEASON_WINS_JUNE":              return juneWins;
      case "ALL_IN_WINS":                   return allInWins;
      case "TOP3_SEASON_FINISHES":          return top3Finishes;
      case "SEASON_UNBEATEN_COUNT":         return unbeatenSeasons;
      case "CONSECUTIVE_TITLES":            return consecTitles;
      case "SEASON_1_PLAYED":               return playedSeason1;
      case "SAME_DAY_WINS":                 return maxSameDayWins;
      case "SAME_WEEK_WINS":                return maxSameWeekWins;
      case "CONSECUTIVE_HIGH_STAKE_WINS":   return maxConsecHigh;
      case "FIRST_MATCH_SEASON_WIN":        return 0;
      case "MULTI_SEASON_WINS":             return multiSeasonWins;
      case "MULTI_SEASON_SURVIVOR":         return unelimSeasons;
      case "SEASON_UNELIMINATED":           return unelimSeasons >= 1 ? 1 : 0;
      case "SEASON_TOP3":                   return top3Finishes >= 1 ? 1 : 0;
      case "TOP3_FULL_SEASON":              return top3Finishes >= 1 ? 1 : 0;
      case "FIRST_SEASON_POINTS":           return firstSeasonPoints;
      case "FIRST_SEASON_TOP3":             return firstSeasonIsTop3;
      case "ELIMINATED_SEASON":             return standings.some(s => s.points === 0) ? 1 : 0;
      case "RIVAL_WINS":                    return maxSameOppWins;
      case "PLAYER_ELIMINATIONS":           return player.eliminationsCount;
      case "UNIQUE_ELIMINATIONS":           return player.eliminationsCount;
      case "SEASON_ELIMINATIONS":           return player.eliminationsCount;
      case "UPSET_WIN":                     return 0;
      case "TOP_RANKED_WINS":               return top3Wins;
      case "TOP_RANKED_ELIMS":              return 0; // retired (ASSASSIN/APOCALYPSE) — no per-match elimination data exists to reconstruct this
      case "MASSIVE_SWING":                 return massiveSwingWins;
      case "WEEKLY_WINS":                   return 0;
      case "SEASON_START_WINS":             return 0;
      case "COMEBACK_STREAK":               return comebackStreak;
      case "ALL_HIDDEN_UNLOCKED":           return hiddenUnlockedFraction;
      case "SINGLE_SEASON_INACTIVE":        return 0;
      case "SEASON_POINTS_LOSS":            return 0;
      default:                              return 0;
    }
  }

  const result = allAchievements.map(a => {
    const isUnlocked = unlockedMap.has(a.id);
    const currentProgress = getProgress(a.key, a.criteriaType, a.criteriaValue, a.secondaryCriteria ?? null, a.secondaryValue ?? null);
    const pct = Math.min(100, Math.round((currentProgress / a.criteriaValue) * 100));
    return {
      ...a,
      isUnlocked,
      unlockedAt: isUnlocked ? unlockedMap.get(a.id) : null,
      currentProgress,
      progressPct: pct,
    };
  });

  progressCache.set(id, { data: result, expiresAt: Date.now() + PROGRESS_TTL_MS });
  res.json(result);
});

function normalizeGameType(gt: string): string {
  const g = gt.toLowerCase();
  if (g.includes("cricket"))                                                          return "Cricket";
  if (g.includes("around the world") || g.includes("round the world"))               return "Around the World";
  if (g.includes("killer"))                                                           return "Killer";
  if (g.includes("shanghai"))                                                         return "Shanghai";
  if (g.includes("bull finish") || g.includes("closest to bull"))                    return "Bull Finish";
  if (g.includes("treble") || g.includes("treble out"))                              return "Treble";
  if (g.includes("1001"))                                                             return "1001";
  if (g.includes("501"))                                                              return "501";
  if (g.includes("301") || g.includes("no black") || g.includes("no point black")
      || g.includes("pick a double") || g.includes("double or nothing"))             return "301";
  return gt.length < 20 ? gt : "Other";
}

router.get("/players/:id/game-types", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  const allMatches = await db.select().from(matchesTable)
    .where(or(eq(matchesTable.winnerId, id), eq(matchesTable.loserId, id)));

  const byType: Record<string, { wins: number; losses: number; pointsWon: number; pointsLost: number }> = {};
  for (const m of allMatches) {
    const type = normalizeGameType(m.gameType);
    if (!byType[type]) byType[type] = { wins: 0, losses: 0, pointsWon: 0, pointsLost: 0 };
    if (m.winnerId === id) {
      byType[type].wins++;
      byType[type].pointsWon += m.stake;
    } else {
      byType[type].losses++;
      byType[type].pointsLost += m.stake;
    }
  }

  const result = Object.entries(byType)
    .map(([gameType, s]) => ({
      gameType,
      wins: s.wins,
      losses: s.losses,
      total: s.wins + s.losses,
      winRate: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
      pointsWon: s.pointsWon,
      pointsLost: s.pointsLost,
      netPoints: s.pointsWon - s.pointsLost,
    }))
    .filter(g => g.total > 0)
    .sort((a, b) => b.total - a.total);

  res.json(result);
});

// GET /api/players/:id/gamerscore — total gamerscore for a player
router.get("/players/:id/gamerscore", async (req, res): Promise<void> => {
  try {
    const playerId = parseInt(req.params.id, 10);
    if (!playerId) { res.status(400).json({ error: "Invalid player id" }); return; }

    const [leagueQ, shadowQ, trophyQ, tourAchievQ, m501Q] = await Promise.all([
      db.execute(sql`
        SELECT a.rarity FROM player_achievements pa
        JOIN achievements a ON a.id = pa.achievement_id
        WHERE pa.player_id = ${playerId} AND a.key NOT LIKE 'M501_%'
      `),
      db.execute(sql`
        SELECT achievement_key FROM shadow_bot_achievements WHERE player_id = ${playerId}
      `),
      db.execute(sql`
        SELECT COALESCE(SUM(gamerscore), 0)::int AS total FROM tour_trophies WHERE player_id = ${playerId}
      `).catch(() => ({ rows: [{ total: 0 }] })),
      db.execute(sql`
        SELECT COALESCE(SUM(tad.gamerscore), 0)::int AS total
        FROM player_tour_achievements pta
        JOIN tour_achievement_definitions tad ON tad.key = pta.achievement_key
        WHERE pta.player_id = ${playerId}
      `).catch(() => ({ rows: [{ total: 0 }] })),
      db.execute(sql`
        SELECT a.rarity FROM player_achievements pa
        JOIN achievements a ON a.id = pa.achievement_id
        WHERE pa.player_id = ${playerId} AND a.key LIKE 'M501_%'
      `),
    ]);

    const leagueTotal = (leagueQ.rows as { rarity: string }[])
      .reduce((sum, r) => sum + gamerscoreForRarity(r.rarity), 0);

    const shadowTotal = (shadowQ.rows as { achievement_key: string }[])
      .reduce((sum, r) => {
        const def = SHADOW_BOT_ACHIEVEMENT_DEFS.find(d => d.key === r.achievement_key);
        return sum + (def ? gamerscoreForRarity(def.rarity) : 0);
      }, 0);

    const tourTrophyTotal = (trophyQ.rows[0] as { total: number }).total ?? 0;
    const tourAchievTotal = (tourAchievQ.rows[0] as { total: number }).total ?? 0;
    const m501Total       = (m501Q.rows as { rarity: string }[])
      .reduce((sum, r) => sum + gamerscoreForRarity(r.rarity), 0);

    res.json({
      total: leagueTotal + shadowTotal + tourTrophyTotal + tourAchievTotal + m501Total,
      league:       leagueTotal,
      shadowBot:    shadowTotal,
      tourTrophies: tourTrophyTotal,
      tourAchievements: tourAchievTotal,
      master501:    m501Total,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get gamerscore");
    res.status(500).json({ error: "Failed to get gamerscore" });
  }
});

// GET /players/:id/titles  — returns ALL titles (earned + locked), auto-grants on fetch
router.get("/players/:id/titles", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;
  try {
    await checkAndGrantTitles(id); // idempotent — picks up any newly earned achievements
    res.json(await getAllPlayerTitles(id));
  } catch (err) {
    req.log.error({ err }, "GET /players/:id/titles failed");
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /players/:id/active-title
router.patch("/players/:id/active-title", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  // Only reachable from account.tsx's <LoginGate>-wrapped titles picker — no
  // ownership check meant anyone could equip any earned title onto any
  // player's profile by id. Same fix as the notification-prefs routes above.
  const sessionPlayerId = (req.session as any)?.playerId ?? null;
  if (!sessionPlayerId) { res.status(401).json({ error: "Login required" }); return; }
  if (sessionPlayerId !== id) { res.status(403).json({ error: "You can only change your own active title" }); return; }

  try {
    const { titleKey } = z.object({ titleKey: z.string().nullable() }).parse(req.body);
    if (titleKey !== null) {
      const earnedRow = await db.execute(sql`
        SELECT id FROM player_titles WHERE player_id = ${id} AND title_key = ${titleKey}
      `);
      if ((earnedRow.rows as any[]).length === 0) {
        res.status(403).json({ error: "Title not earned" }); return;
      }
    }
    await db.execute(sql`UPDATE players SET active_title = ${titleKey} WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "PATCH /players/:id/active-title failed");
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /players/:id/tagline — a short player-entered line shown under
// their name on both their own account page and their public profile (see
// schema/players.ts's tagline column). Same ownership pattern as
// active-title above. Length-capped (60 chars) at the same posture as
// community posts/DMs elsewhere in this app, which also accept free text
// with just a length cap and no separate profanity filter.
router.patch("/players/:id/tagline", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  const sessionPlayerId = (req.session as any)?.playerId ?? null;
  if (!sessionPlayerId) { res.status(401).json({ error: "Login required" }); return; }
  if (sessionPlayerId !== id) { res.status(403).json({ error: "You can only change your own tagline" }); return; }

  try {
    const { tagline } = z.object({ tagline: z.string().max(60).nullable() }).parse(req.body);
    const trimmed = tagline?.trim() || null;
    await db.execute(sql`UPDATE players SET tagline = ${trimmed} WHERE id = ${id}`);
    res.json({ success: true, tagline: trimmed });
  } catch (err) {
    req.log.error({ err }, "PATCH /players/:id/tagline failed");
    res.status(500).json({ error: "Failed" });
  }
});

// Featured Stat Spotlight — a free (not coin-gated) profile customization,
// separate from the coin-cosmetics system: one stat a player picks to
// headline next to their Trophy Case (see components/TrophyCase.tsx and
// lib/statSpotlight.ts's SPOTLIGHT_STATS for the frontend-side labels/
// formatting). Fixed shortlist validated here, never free text.
const SPOTLIGHT_STAT_KEYS = ["bestCheckout", "highestAverage", "longestWinStreak", "most180s", "matchesPlayed", "bestLeg"] as const;

// PATCH /players/:id/featured-stat — same ownership pattern as tagline above.
router.patch("/players/:id/featured-stat", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  const sessionPlayerId = (req.session as any)?.playerId ?? null;
  if (!sessionPlayerId) { res.status(401).json({ error: "Login required" }); return; }
  if (sessionPlayerId !== id) { res.status(403).json({ error: "You can only change your own featured stat" }); return; }

  try {
    const { statKey } = z.object({ statKey: z.enum(SPOTLIGHT_STAT_KEYS).nullable() }).parse(req.body);
    await db.execute(sql`UPDATE players SET featured_stat_key = ${statKey} WHERE id = ${id}`);
    res.json({ success: true, statKey });
  } catch (err) {
    req.log.error({ err }, "PATCH /players/:id/featured-stat failed");
    res.status(400).json({ error: "Invalid stat key" });
  }
});

// GET /players/:id/stats/spotlight — current values for every stat in the
// shortlist (not just whichever one is currently featured), so the picker UI
// can preview all six before choosing. Public, same reasoning as the
// cosmetics/pinned-achievements GETs — anyone viewing a profile needs to be
// able to render its featured stat.
//
// bestCheckout / highestAverage / bestLeg are Practice-mode/singles-ladder
// only (same real-data limits already accepted by /stats/checkout-records
// and the hall-of-fame endpoints elsewhere in this file) — competitive
// matches only store checkout hit/attempt *counts*, never the actual
// checkout score, and only single-leg 501 matches have a meaningful
// "average"/"fewest darts" reading. highestAverage and bestLeg both derive
// from the same MIN(winner_darts) row on purpose: this app's singles-ladder
// matches are single-leg 501, so a player's fastest leg and their highest
// per-match average are mathematically the same match, just two different
// ways of describing it.
router.get("/players/:id/stats/spotlight", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  try {
    const [player] = await db
      .select({ careerGamesPlayed: playersTable.careerGamesPlayed, longestWinStreak: playersTable.longestWinStreak })
      .from(playersTable)
      .where(eq(playersTable.id, id));
    if (!player) { res.status(404).json({ error: "Player not found" }); return; }

    const [checkoutResult, legResult, s180Matches, s180Practice] = await Promise.all([
      db.execute(sql`
        WITH session_darts AS (
          SELECT ps.id AS session_id, ps.game_type_name, ps.created_at,
                 (dart->>'val')::int AS val, ordinality::int AS pos,
                 COUNT(*) OVER (PARTITION BY ps.id)::int AS total_darts
          FROM practice_sessions ps,
               jsonb_array_elements(ps.session_data->'dartLog') WITH ORDINALITY AS t(dart, ordinality)
          WHERE ps.player1_id = ${id}
            AND ps.session_data ? 'dartLog'
            AND ps.p1_checkout_hits > 0
            AND ps.game_type_key IN (SELECT key FROM game_types WHERE engine = 'X01')
        ),
        last_visits AS (
          SELECT session_id, SUM(val) AS co_val
          FROM session_darts
          WHERE pos > total_darts - ((total_darts - 1) % 3 + 1)
          GROUP BY session_id
          HAVING SUM(val) BETWEEN 2 AND 170
        )
        SELECT MAX(co_val) AS best_checkout FROM last_visits
      `),
      db.execute(sql`
        SELECT MIN(winner_darts) AS best_leg_darts
        FROM matches
        WHERE winner_id = ${id} AND game_type = '501' AND winner_darts IS NOT NULL
      `),
      db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN winner_id = ${id} THEN winner_180s ELSE 0 END), 0)
          + COALESCE(SUM(CASE WHEN loser_id = ${id} THEN loser_180s ELSE 0 END), 0) AS total
        FROM matches
        WHERE winner_id = ${id} OR loser_id = ${id}
      `),
      db.execute(sql`
        SELECT
          COALESCE(SUM(CASE WHEN player1_id = ${id} THEN p1_180s ELSE 0 END), 0)
          + COALESCE(SUM(CASE WHEN player2_id = ${id} THEN p2_180s ELSE 0 END), 0) AS total
        FROM practice_sessions
        WHERE player1_id = ${id} OR player2_id = ${id}
      `),
    ]);

    const bestCheckout: number | null = (checkoutResult.rows[0] as any)?.best_checkout ?? null;
    const bestLegDarts: number | null = (legResult.rows[0] as any)?.best_leg_darts ?? null;
    const highestAverage = bestLegDarts ? Math.round((501 * 3 / bestLegDarts) * 100) / 100 : null;
    const most180s = Number((s180Matches.rows[0] as any)?.total ?? 0) + Number((s180Practice.rows[0] as any)?.total ?? 0);

    res.json({
      bestCheckout,
      highestAverage,
      longestWinStreak: player.longestWinStreak ?? 0,
      most180s,
      matchesPlayed: player.careerGamesPlayed ?? 0,
      bestLeg: bestLegDarts,
    });
  } catch (err) {
    req.log.error({ err }, "GET /players/:id/stats/spotlight failed");
    res.status(500).json({ error: "Failed to get stat spotlight" });
  }
});

// GET /players/:id/seasons/:seasonId/recap — a Season Recap Card's content:
// the season's frozen end-of-season standings row (see seasonStandingsTable
// — a snapshot taken at season close, so this stays accurate even if season
// data changes later) plus two computed highlights (longest win streak and
// biggest single win by ELO swing, both scoped to just this player's
// matches within this one season). Public, same reasoning as the other
// profile-display GETs above — anyone viewing a profile's Season History
// can open a past season's recap. 404s for a season this player never
// played in, rather than returning an empty/zeroed card.
router.get("/players/:id/seasons/:seasonId/recap", async (req, res): Promise<void> => {
  const params = z.object({ id: z.coerce.number().int(), seasonId: z.coerce.number().int() }).safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const { id, seasonId } = params.data;

  try {
    const [standing] = await db.select({
      position:   seasonStandingsTable.position,
      wins:       seasonStandingsTable.wins,
      losses:     seasonStandingsTable.losses,
      points:     seasonStandingsTable.points,
      elo:        seasonStandingsTable.elo,
      isChampion: seasonStandingsTable.isChampion,
      seasonName: seasonsTable.name,
      startDate:  seasonsTable.startDate,
      endDate:    seasonsTable.endDate,
      leagueType: seasonsTable.leagueType,
    })
      .from(seasonStandingsTable)
      .innerJoin(seasonsTable, eq(seasonsTable.id, seasonStandingsTable.seasonId))
      .where(and(eq(seasonStandingsTable.playerId, id), eq(seasonStandingsTable.seasonId, seasonId)));
    if (!standing) { res.status(404).json({ error: "This player has no standings row for that season" }); return; }

    const matchResult = await db.execute(sql`
      SELECT winner_id, loser_id, elo_change, played_at
      FROM matches
      WHERE season_id = ${seasonId} AND (winner_id = ${id} OR loser_id = ${id})
      ORDER BY played_at ASC
    `);
    const rows = matchResult.rows as any[];

    let longestStreak = 0, curStreak = 0, biggestWin = 0;
    for (const m of rows) {
      const won = m.winner_id === id;
      curStreak = won ? curStreak + 1 : 0;
      longestStreak = Math.max(longestStreak, curStreak);
      if (won) biggestWin = Math.max(biggestWin, m.elo_change ?? 0);
    }

    res.json({
      ...standing,
      matchesPlayed: standing.wins + standing.losses,
      winRate: (standing.wins + standing.losses) > 0 ? Math.round((standing.wins / (standing.wins + standing.losses)) * 100) : 0,
      longestStreak,
      biggestWin,
    });
  } catch (err) {
    req.log.error({ err }, "GET /players/:id/seasons/:seasonId/recap failed");
    res.status(500).json({ error: "Failed to get season recap" });
  }
});

// GET /players/:id/currency-transactions — the Wallet tab's real transaction
// history (account.tsx). Owner-only, same reasoning as active-title above:
// a player's coin history is personal, not something any id should be able
// to read. Paginated with a simple offset/limit — this table only ever
// grows by a few rows per session, nowhere near needing a keyset cursor.
router.get("/players/:id/currency-transactions", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const id = params.data.id;

  const sessionPlayerId = (req.session as any)?.playerId ?? null;
  if (!sessionPlayerId) { res.status(401).json({ error: "Login required" }); return; }
  if (sessionPlayerId !== id) { res.status(403).json({ error: "You can only view your own transaction history" }); return; }

  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  try {
    const rows = await db
      .select()
      .from(currencyTransactionsTable)
      .where(eq(currencyTransactionsTable.playerId, id))
      .orderBy(desc(currencyTransactionsTable.createdAt), desc(currencyTransactionsTable.id))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    res.json({ transactions: rows.slice(0, limit), hasMore });
  } catch (err) {
    req.log.error({ err }, "GET /players/:id/currency-transactions failed");
    res.status(500).json({ error: "Failed to load transaction history" });
  }
});

// ── Card collection favorites (account page "collection book") ─────────────────
// Deliberately separate from the Card Clash equip-loadout favorites system
// (card-clash-favorites.ts) — this is a simple per-player boolean against the
// static COLLECTIBLE_CARDS numeric ids, with no game-mode concept.

router.get("/player/:id/cards/favorites", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const rows = await db.execute(sql`
      SELECT card_id FROM card_favorites WHERE player_id = ${params.data.id}
    `);
    res.json({ favorites: (rows.rows as any[]).map(r => ({ id: r.card_id })) });
  } catch (err) {
    req.log.error({ err }, "GET /player/:id/cards/favorites failed");
    res.status(500).json({ error: "Failed to load favorites" });
  }
});

router.post("/cards/:cardId/favorite", async (req, res): Promise<void> => {
  const cardId = Number(req.params.cardId);
  if (isNaN(cardId)) { res.status(400).json({ error: "Invalid card id" }); return; }

  // This trusted a client-supplied playerId in the body with no session
  // check at all — the one mutating route in this file missed by the
  // ownership-check pass applied to its siblings (active-title above,
  // notification-prefs below, pinned-achievements in achievements.ts).
  // Anyone, even unauthenticated, could toggle favorites on any player's
  // collection book. Same fix as those: take the player id from the
  // session, not the request body.
  const playerId = (req.session as any)?.playerId ?? null;
  if (!playerId) { res.status(401).json({ error: "Login required" }); return; }

  try {
    const existing = await db.execute(sql`
      SELECT 1 FROM card_favorites WHERE player_id = ${playerId} AND card_id = ${cardId}
    `);
    let isFavorite: boolean;
    if ((existing.rows as any[]).length > 0) {
      await db.execute(sql`DELETE FROM card_favorites WHERE player_id = ${playerId} AND card_id = ${cardId}`);
      isFavorite = false;
    } else {
      await db.execute(sql`INSERT INTO card_favorites (player_id, card_id) VALUES (${playerId}, ${cardId})`);
      isFavorite = true;
    }
    res.json({ isFavorite });
  } catch (err) {
    req.log.error({ err }, "POST /cards/:cardId/favorite failed");
    res.status(500).json({ error: "Failed to toggle favorite" });
  }
});

// ── Notification preferences ────────────────────────────────────────────────
// notification_preferences already exists and is pre-seeded for every player
// at startup (see lib/notificationsMigration.ts) — this was just missing its
// routes.

router.get("/players/:id/notification-prefs", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  // Unlike pinned achievements, a player's notification settings aren't
  // meant to be publicly browsable — there's no legitimate reason for one
  // player to read another's push/preference state, so this is gated the
  // same way the PATCH below is.
  const sessionPlayerId = (req.session as any)?.playerId ?? null;
  if (!sessionPlayerId) { res.status(401).json({ error: "Login required" }); return; }
  if (sessionPlayerId !== params.data.id) { res.status(403).json({ error: "You can only view your own notification settings" }); return; }

  try {
    const rows = await db.execute(sql`
      SELECT push_enabled, match_results, rank_changes, threat_alerts, coach_tips, announcements, private_mode, direct_messages, achievements, community_activity
      FROM notification_preferences WHERE player_id = ${params.data.id}
    `);
    const row = (rows.rows as any[])[0];
    res.json(row ?? {
      push_enabled: true, match_results: true, rank_changes: true, threat_alerts: true,
      coach_tips: true, announcements: true, private_mode: false, direct_messages: true,
      achievements: true, community_activity: true,
    });
  } catch (err) {
    req.log.error({ err }, "GET /players/:id/notification-prefs failed");
    res.status(500).json({ error: "Failed to load preferences" });
  }
});

const NotificationPrefsBody = z.object({
  push_enabled:       z.boolean().optional(),
  match_results:      z.boolean().optional(),
  rank_changes:       z.boolean().optional(),
  threat_alerts:      z.boolean().optional(),
  coach_tips:         z.boolean().optional(),
  announcements:      z.boolean().optional(),
  private_mode:       z.boolean().optional(),
  direct_messages:    z.boolean().optional(),
  achievements:       z.boolean().optional(),
  community_activity: z.boolean().optional(),
});

router.patch("/players/:id/notification-prefs", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  // These routes had no ownership check at all — anyone who knew (or
  // guessed) a player's id could silently rewrite their notification
  // settings, e.g. muting match results for someone else with a plain curl
  // request. Same fix as PUT /players/:id/pinned-achievements.
  const sessionPlayerId = (req.session as any)?.playerId ?? null;
  if (!sessionPlayerId) { res.status(401).json({ error: "Login required" }); return; }
  if (sessionPlayerId !== params.data.id) { res.status(403).json({ error: "You can only edit your own notification settings" }); return; }

  const parsed = NotificationPrefsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const p = parsed.data;
  const id = params.data.id;

  try {
    await db.execute(sql`
      INSERT INTO notification_preferences (player_id, push_enabled, match_results, rank_changes, threat_alerts, coach_tips, announcements, private_mode, direct_messages, achievements, community_activity)
      VALUES (
        ${id},
        ${p.push_enabled ?? true}, ${p.match_results ?? true}, ${p.rank_changes ?? true}, ${p.threat_alerts ?? true},
        ${p.coach_tips ?? true}, ${p.announcements ?? true}, ${p.private_mode ?? false}, ${p.direct_messages ?? true},
        ${p.achievements ?? true}, ${p.community_activity ?? true}
      )
      ON CONFLICT (player_id) DO UPDATE SET
        push_enabled        = COALESCE(${p.push_enabled ?? null}, notification_preferences.push_enabled),
        match_results       = COALESCE(${p.match_results ?? null}, notification_preferences.match_results),
        rank_changes        = COALESCE(${p.rank_changes ?? null}, notification_preferences.rank_changes),
        threat_alerts       = COALESCE(${p.threat_alerts ?? null}, notification_preferences.threat_alerts),
        coach_tips          = COALESCE(${p.coach_tips ?? null}, notification_preferences.coach_tips),
        announcements       = COALESCE(${p.announcements ?? null}, notification_preferences.announcements),
        private_mode        = COALESCE(${p.private_mode ?? null}, notification_preferences.private_mode),
        direct_messages     = COALESCE(${p.direct_messages ?? null}, notification_preferences.direct_messages),
        achievements        = COALESCE(${p.achievements ?? null}, notification_preferences.achievements),
        community_activity  = COALESCE(${p.community_activity ?? null}, notification_preferences.community_activity),
        updated_at          = NOW()
    `);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "PATCH /players/:id/notification-prefs failed");
    res.status(500).json({ error: "Failed to save preferences" });
  }
});

// ── Profile photo ───────────────────────────────────────────────────────
// Stored as raw bytes directly on the players row (see db/migrations/
// add_player_avatar_image.ts for why: not through lib/objectStorage.ts,
// which depends on Replit-only infrastructure this app no longer runs on).
// The client resizes/compresses to a small square before ever sending it —
// this is a profile photo, not a general file upload — MAX_AVATAR_BYTES
// below is a real backstop, not the expected size.
const AvatarUploadBody = z.object({
  // The client's canvas export (toDataURL) includes the "data:image/...;
  // base64," prefix — accepted as-is, stripped below, rather than asking
  // the frontend to do that string surgery itself.
  imageBase64: z.string().min(1),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
const MAX_AVATAR_BYTES = 800_000;

router.post("/players/:id/avatar", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const sessionPlayerId = (req.session as any)?.playerId ?? null;
  if (!sessionPlayerId) { res.status(401).json({ error: "Login required" }); return; }
  if (sessionPlayerId !== params.data.id) { res.status(403).json({ error: "You can only change your own profile photo" }); return; }

  const parsed = AvatarUploadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Missing or invalid image" }); return; }

  let buffer: Buffer;
  try {
    const raw = parsed.data.imageBase64.includes(",") ? parsed.data.imageBase64.split(",", 2)[1] : parsed.data.imageBase64;
    buffer = Buffer.from(raw, "base64");
  } catch {
    res.status(400).json({ error: "Could not decode image" });
    return;
  }
  if (buffer.length === 0) { res.status(400).json({ error: "Empty image" }); return; }
  if (buffer.length > MAX_AVATAR_BYTES) { res.status(413).json({ error: "Image too large — please use a smaller photo" }); return; }

  try {
    await db.execute(sql`
      UPDATE players
      SET avatar_image = ${buffer}, avatar_content_type = ${parsed.data.contentType}, avatar_updated_at = NOW()
      WHERE id = ${params.data.id}
    `);
    res.json({ ok: true, avatarUpdatedAt: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, "POST /players/:id/avatar failed");
    res.status(500).json({ error: "Failed to save photo" });
  }
});

router.delete("/players/:id/avatar", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const sessionPlayerId = (req.session as any)?.playerId ?? null;
  if (!sessionPlayerId) { res.status(401).json({ error: "Login required" }); return; }
  if (sessionPlayerId !== params.data.id) { res.status(403).json({ error: "You can only change your own profile photo" }); return; }

  try {
    await db.execute(sql`
      UPDATE players SET avatar_image = NULL, avatar_content_type = NULL, avatar_updated_at = NOW()
      WHERE id = ${params.data.id}
    `);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "DELETE /players/:id/avatar failed");
    res.status(500).json({ error: "Failed to remove photo" });
  }
});

// Public — no auth. A player's avatar is shown anywhere their name shows,
// same visibility as their profile icon today (not a private resource).
router.get("/players/:id/avatar-image", async (req, res): Promise<void> => {
  const params = IdParam.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  try {
    const rows = (
      await db.execute(sql`
        SELECT avatar_image, avatar_content_type FROM players WHERE id = ${params.data.id}
      `)
    ).rows as { avatar_image: Buffer | null; avatar_content_type: string | null }[];
    const row = rows[0];
    if (!row || !row.avatar_image || !row.avatar_content_type) {
      res.status(404).json({ error: "No photo set" });
      return;
    }
    res.setHeader("Content-Type", row.avatar_content_type);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(row.avatar_image);
  } catch (err) {
    req.log.error({ err }, "GET /players/:id/avatar-image failed");
    res.status(500).json({ error: "Failed to load photo" });
  }
});

export default router;
