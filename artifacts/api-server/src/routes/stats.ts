import { Router } from "express";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { db, playersTable, matchesTable, seasonsTable, seasonStandingsTable, matchParticipantsTable } from "@workspace/db";
import { sql as drizzleSql } from "drizzle-orm";
import { calcTier } from "../lib/elo";
import { computeIdentity } from "../lib/identity";
import { buildNarrativeCards } from "../lib/narrative";
import { getPositionChanges } from "../lib/leaderboardRank";

const router = Router();

let liveFeedCache: { data: unknown; expiresAt: number } | null = null;
const LIVE_FEED_TTL_MS = 15_000;

router.get("/stats/summary", async (_req, res): Promise<void> => {
  const allPlayers   = await db.select().from(playersTable);
  const activePlayers = allPlayers.filter(p => p.isActive);
  const [currentSeason] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "singles")))
    .limit(1);
  const completedSeasons = await db.select({ id: seasonsTable.id }).from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, false), eq(seasonsTable.leagueType, "singles")));
  const [lastMatch] = await db.select().from(matchesTable).orderBy(desc(matchesTable.playedAt)).limit(1);

  let currentSeasonMatches = 0;
  if (currentSeason) {
    const [{ value: seasonMatchCount }] = await db.select({ value: count() }).from(matchesTable)
      .where(eq(matchesTable.seasonId, currentSeason.id));
    currentSeasonMatches = seasonMatchCount;
  }

  const [{ value: totalMatches }] = await db.select({ value: count() }).from(matchesTable);
  const sorted = [...activePlayers]
    .filter(p => p.status !== "ELIMINATED")
    .sort((a, b) => b.points - a.points || b.elo - a.elo);
  const topElo = [...activePlayers].sort((a, b) => b.elo - a.elo)[0] ?? null;
  const leader = sorted[0];
  const eliminatedCount = activePlayers.filter(p => p.status === "ELIMINATED").length;

  const allStandings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, true));
  const titleCounts = new Map<number, number>();
  for (const s of allStandings) titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);

  let currentLeader = null;
  if (leader) {
    const isChampion = (titleCounts.get(leader.id) ?? 0) > 0;
    const identity = computeIdentity(leader, 1, isChampion);
    const games = leader.seasonWins + leader.seasonLosses;
    // The league leader is always rank 1 right now by definition — what's
    // worth diffing is whether they *were* rank 1 yesterday (see
    // lib/leaderboardRank.ts). A positive change here means they just
    // took the lead; 0 means they've held it since the last snapshot.
    const leaderRankChange = (await getPositionChanges(new Map([[leader.id, 1]]))).get(leader.id) ?? 0;
    currentLeader = {
      position: 1, positionChange: leaderRankChange,
      playerId: leader.id, playerName: leader.name,
      wins: leader.seasonWins, losses: leader.seasonLosses, gamesPlayed: games,
      points: leader.points, peakPoints: leader.peakPoints,
      elo: leader.elo, tier: calcTier(leader.elo),
      winRate: games > 0 ? leader.seasonWins / games : 0,
      currentStreak: leader.currentWinStreak,
      status: leader.status, ...identity,
    };
  }

  res.json({
    totalPlayers: activePlayers.length,
    activePlayers: activePlayers.filter(p => p.status === "ACTIVE").length,
    eliminatedCount,
    totalMatches,
    currentSeasonMatches,
    currentSeasonName: currentSeason?.name ?? "No active season",
    currentLeader,
    topEloPlayer: topElo,
    lastMatch: lastMatch ?? null,
    seasonsCompleted: completedSeasons.length,
  });
});

router.get("/stats/career-leaders", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
  const standings = await db.select().from(seasonStandingsTable).where(eq(seasonStandingsTable.isChampion, true));
  const titleCounts = new Map<number, number>();
  for (const s of standings) titleCounts.set(s.playerId, (titleCounts.get(s.playerId) ?? 0) + 1);

  const leaders = [...players]
    .sort((a, b) => b.careerWins - a.careerWins || b.careerPeakElo - a.careerPeakElo)
    .map(p => ({
      player: p,
      careerWins: p.careerWins,
      careerWinRate: p.careerGamesPlayed > 0 ? p.careerWins / p.careerGamesPlayed : 0,
      elo: p.elo,
      seasonTitles: titleCounts.get(p.id) ?? 0,
    }));

  res.json(leaders);
});

// 2026-09-25: this used to query only the plain `matches` table, so Doubles
// Event and Shift Wars results — which live in their own dedicated tables
// (doubles_matches/doubles_teams, shift_wars_matches/shift_wars_teams; see
// routes/doubles.ts and routes/shift-wars.ts) — never showed up here even
// though this is the Hub's actual "Recent Matches" card. Same root cause,
// and same fix, as the /hub/pulse gap fixed the same day (see hub.ts) —
// merged in below alongside the plain matches query. "Team matches"
// (2v2/3v3/multi-Killer) already lived in the plain `matches` table and were
// already included via teamMatchIdSet, so those needed no change.
router.get("/stats/recent-activity", async (_req, res): Promise<void> => {
  const matches = await db.select().from(matchesTable).orderBy(desc(matchesTable.playedAt)).limit(15);
  const matchIds = matches.map(m => m.id);
  const teamMatchIdSet = new Set<number>();
  if (matchIds.length > 0) {
    const participants = await db.selectDistinct({ matchId: matchParticipantsTable.matchId })
      .from(matchParticipantsTable)
      .where(inArray(matchParticipantsTable.matchId, matchIds));
    for (const p of participants) teamMatchIdSet.add(p.matchId);
  }
  const activity: any[] = matches.map(m => ({
    matchId:       m.id,
    winnerId:      m.winnerId,
    loserId:       m.loserId,
    winnerName:    m.winnerName,
    loserName:     m.loserName,
    stake:         m.stake,
    pointsAwarded: m.stake,
    eloChange:     m.eloChange,
    gameType:      m.gameType,
    isTeamMatch:   teamMatchIdSet.has(m.id),
    playedAt:      m.playedAt,
    seasonId:      m.seasonId,
  }));

  // Negative, offset-namespaced matchIds so these never collide with a real
  // (positive, serial) matches.id — this field is only ever used as a React
  // list key on the frontend, never looked up against the matches table, so
  // a synthetic id is safe here. Doubles matches do track an elo_change
  // column (see doubles.ts); Shift Wars has no Elo system at all (points
  // only — see shift-wars.ts's own insert/select, neither of which touches
  // an elo column), so its eloChange is honestly 0 rather than invented.
  const doublesRows = (await db.execute(drizzleSql`
    SELECT dm.id, wt.team_name AS winner_team_name, lt.team_name AS loser_team_name, dm.stake, dm.elo_change, dm.played_at
    FROM doubles_matches dm
    JOIN doubles_teams wt ON wt.id = dm.winner_team_id
    JOIN doubles_teams lt ON lt.id = dm.loser_team_id
    ORDER BY dm.played_at DESC
    LIMIT 15
  `)).rows as any[];
  for (const m of doublesRows) {
    activity.push({
      matchId: -(1_000_000 + m.id),
      winnerName: m.winner_team_name, loserName: m.loser_team_name,
      stake: m.stake, pointsAwarded: m.stake, eloChange: m.elo_change ?? 0,
      gameType: "Doubles Event", isTeamMatch: true, playedAt: m.played_at,
    });
  }

  const shiftWarsRows = (await db.execute(drizzleSql`
    SELECT sm.id, wt.name AS winner_team_name, lt.name AS loser_team_name, sm.stake, sm.played_at
    FROM shift_wars_matches sm
    JOIN shift_wars_teams wt ON wt.id = sm.winner_team_id
    JOIN shift_wars_teams lt ON lt.id = sm.loser_team_id
    ORDER BY sm.played_at DESC
    LIMIT 15
  `)).rows as any[];
  for (const m of shiftWarsRows) {
    activity.push({
      matchId: -(2_000_000 + m.id),
      winnerName: m.winner_team_name, loserName: m.loser_team_name,
      stake: m.stake, pointsAwarded: m.stake, eloChange: 0,
      gameType: "Shift Wars", isTeamMatch: true, playedAt: m.played_at,
    });
  }

  activity.sort((a, b) => new Date(b.playedAt).getTime() - new Date(a.playedAt).getTime());
  res.json(activity.slice(0, 15));
});

router.get("/stats/narrative", async (_req, res): Promise<void> => {
  const players = await db.select().from(playersTable).where(eq(playersTable.isActive, true));
  const [currentSeason] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.isActive, true), eq(seasonsTable.leagueType, "singles")))
    .limit(1);
  const recentMatches = currentSeason
    ? await db.select().from(matchesTable)
        .where(eq(matchesTable.seasonId, currentSeason.id))
        .orderBy(desc(matchesTable.playedAt)).limit(10)
    : [];
  const cards = buildNarrativeCards(players, recentMatches);
  res.json(cards);
});

router.get("/stats/live-feed", async (req, res): Promise<void> => {
  const now = Date.now();
  if (liveFeedCache && now < liveFeedCache.expiresAt) {
    res.json(liveFeedCache.data);
    return;
  }
  try {
    type FeedItem = { type: string; text: string; accent: string; ts: number };
    const items: FeedItem[] = [];

    // Recent matches — upset detection: winner current Elo < loser current Elo
    const matchRows = (await db.execute(drizzleSql`
      SELECT m.id, m.winner_name, m.loser_name, m.stake, m.elo_change, m.game_type, m.played_at,
             wp.elo AS winner_elo, lp.elo AS loser_elo
      FROM matches m
      JOIN players wp ON wp.id = m.winner_id
      JOIN players lp ON lp.id = m.loser_id
      ORDER BY m.played_at DESC LIMIT 20
    `)).rows as any[];

    for (const m of matchRows) {
      const isUpset = m.winner_elo < m.loser_elo;
      const stake   = m.stake ? ` ±${m.stake}pts` : "";
      const eloStr  = m.elo_change ? ` (+${m.elo_change} Elo)` : "";
      items.push({
        type:   "match",
        text:   isUpset
          ? `⚡ UPSET — ${m.winner_name.toUpperCase()} def. ${m.loser_name}${stake}${eloStr}`
          : `🎯 ${m.winner_name.toUpperCase()} def. ${m.loser_name}${stake}`,
        accent: isUpset ? "red" : "default",
        ts:     new Date(m.played_at).getTime(),
      });
    }

    // Recent league achievement unlocks
    const achRows = (await db.execute(drizzleSql`
      SELECT pa.unlocked_at, p.name AS player_name, a.name AS ach_name, a.icon, a.rarity
      FROM player_achievements pa
      JOIN players p ON p.id = pa.player_id
      JOIN achievements a ON a.id = pa.achievement_id
      ORDER BY pa.unlocked_at DESC LIMIT 12
    `)).rows as any[];

    for (const a of achRows) {
      const icon = a.icon ?? "🏅";
      items.push({
        type:   "achievement",
        text:   `${icon} ${a.player_name.toUpperCase()} · ${a.ach_name}`,
        accent: a.rarity === "legendary" ? "gold" : a.rarity === "epic" ? "purple" : "blue",
        ts:     new Date(a.unlocked_at).getTime(),
      });
    }

    // Recent tour trophies
    const trophyRows = (await db.execute(drizzleSql`
      SELECT tt.awarded_at, p.name AS player_name, td.name AS tour_name, td.emoji, td.tier, tt.difficulty, tt.gamerscore
      FROM tour_trophies tt
      JOIN players p ON p.id = tt.player_id
      JOIN tour_definitions td ON td.id = tt.tour_id
      ORDER BY tt.awarded_at DESC LIMIT 10
    `)).rows as any[];

    for (const t of trophyRows) {
      const emoji = t.emoji ?? "🏆";
      const gs    = t.gamerscore ? ` · +${t.gamerscore}G` : "";
      items.push({
        type:   "tour_trophy",
        text:   `${emoji} ${t.player_name.toUpperCase()} WON ${t.tour_name.toUpperCase()} [${t.difficulty.toUpperCase()}]${gs}`,
        accent: t.tier >= 5 ? "gold" : "purple",
        ts:     new Date(t.awarded_at).getTime(),
      });
    }

    // Recent tour achievements
    const tourAchRows = (await db.execute(drizzleSql`
      SELECT pta.awarded_at, p.name AS player_name, tad.name AS ach_name, tad.icon, tad.gamerscore
      FROM player_tour_achievements pta
      JOIN players p ON p.id = pta.player_id
      JOIN tour_achievement_definitions tad ON tad.key = pta.achievement_key
      ORDER BY pta.awarded_at DESC LIMIT 10
    `)).rows as any[];

    for (const a of tourAchRows) {
      const icon = a.icon ?? "🎯";
      const gs   = a.gamerscore ? ` +${a.gamerscore}G` : "";
      items.push({
        type:   "tour_achievement",
        text:   `${icon} ${a.player_name.toUpperCase()} · ${a.ach_name}${gs}`,
        accent: "green",
        ts:     new Date(a.awarded_at).getTime(),
      });
    }

    // Sort by timestamp newest-first and return top 40
    items.sort((a, b) => b.ts - a.ts);
    const feed = items.slice(0, 40);
    liveFeedCache = { data: feed, expiresAt: Date.now() + LIVE_FEED_TTL_MS };
    res.json(feed);
  } catch (err) {
    req.log.error({ err }, "Failed to get live feed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats/hall-of-fame", async (_req, res): Promise<void> => {
  const [players, practiceQ, tourQ, achievQ, biggestLossQ] = await Promise.all([
    db.select().from(playersTable),
    // Union both player1 and player2 perspectives — this used to only count
    // player1_id, so anyone who mostly played as P2 in two-player practice
    // sessions was undercounted (or missing entirely) on "Most Practice
    // Sessions" and "Most 180s". Session count includes every session either
    // side played in; darts/180s sums are null-safe per side via COALESCE.
    db.execute(drizzleSql`
      WITH all_sessions AS (
        SELECT player1_id AS player_id, p1_darts AS darts, p1_180s AS s180s
        FROM practice_sessions WHERE player1_id IS NOT NULL
        UNION ALL
        SELECT player2_id AS player_id, p2_darts AS darts, p2_180s AS s180s
        FROM practice_sessions WHERE player2_id IS NOT NULL
      )
      SELECT player_id, COUNT(*)::int AS sessions,
             COALESCE(SUM(darts),0)::int AS total_darts,
             COALESCE(SUM(s180s),0)::int AS total_180s
      FROM all_sessions GROUP BY player_id
    `),
    db.execute(drizzleSql`SELECT player_id, COUNT(*)::int AS trophies FROM tour_trophies GROUP BY player_id`).catch(() => ({ rows: [] })),
    db.execute(drizzleSql`
      SELECT player_id, SUM(cnt)::int AS cnt FROM (
        SELECT player_id, COUNT(*) AS cnt FROM player_achievements        GROUP BY player_id
        UNION ALL
        SELECT player_id, COUNT(*) AS cnt FROM shadow_bot_achievements    GROUP BY player_id
        UNION ALL
        SELECT player_id, COUNT(*) AS cnt FROM player_tour_achievements   GROUP BY player_id
      ) t GROUP BY player_id
    `),
    // Wall of Shame — biggest single-match loss: the largest stake any
    // player has ever handed over in one game. Scoped to `matches` (singles
    // + Shift Wars, same table every other shame stat already draws from —
    // see careerLosses/longestLossStreak/careerBiggestPointsFall below),
    // grouped by loser so this is "worst single moment", not a running total.
    db.execute(drizzleSql`
      SELECT loser_id AS player_id, MAX(stake)::int AS max_stake
      FROM matches
      GROUP BY loser_id
    `),
  ]);

  const practiceMap = new Map<number, { sessions: number; total_darts: number; total_180s: number }>();
  for (const r of practiceQ.rows as any[]) practiceMap.set(r.player_id, { sessions: Number(r.sessions), total_darts: Number(r.total_darts), total_180s: Number(r.total_180s) });

  const tourMap = new Map<number, number>();
  for (const r of tourQ.rows as any[]) tourMap.set(Number(r.player_id), Number(r.trophies));

  const achievMap = new Map<number, number>();
  for (const r of achievQ.rows as any[]) achievMap.set(Number(r.player_id), Number(r.cnt));

  const biggestLossMap = new Map<number, number>();
  for (const r of biggestLossQ.rows as any[]) biggestLossMap.set(Number(r.player_id), Number(r.max_stake));

  const all = players.map(p => ({
    id:                 p.id,
    name:               p.name,
    careerWins:         p.careerWins,
    careerLosses:       p.careerLosses,
    careerPeakElo:      p.careerPeakElo,
    careerPoints:       p.careerPoints,
    longestWinStreak:   p.longestWinStreak ?? 0,
    longestLossStreak:  p.longestLossStreak ?? 0,
    // All-time high-water mark, captured at the moment of each loss and kept
    // forever — unlike peakPoints/points themselves, this survives season
    // resets (see career_biggest_points_fall migration).
    careerBiggestPointsFall: p.careerBiggestPointsFall ?? 0,
    careerGamesPlayed:p.careerGamesPlayed ?? 0,
    sessions:         practiceMap.get(p.id)?.sessions    ?? 0,
    totalDarts:       practiceMap.get(p.id)?.total_darts ?? 0,
    total180s:        practiceMap.get(p.id)?.total_180s  ?? 0,
    tourTrophies:     tourMap.get(p.id)    ?? 0,
    achievements:     achievMap.get(p.id)  ?? 0,
    eliminationsCount: p.eliminationsCount ?? 0,
    biggestSingleLoss: biggestLossMap.get(p.id) ?? 0,
  }));

  const topBy = (key: keyof typeof all[0]) =>
    [...all].sort((a, b) => (b[key] as number) - (a[key] as number)).slice(0, 3);

  res.json({
    mostWins:          topBy("careerWins"),
    highestElo:        topBy("careerPeakElo"),
    mostPoints:        topBy("careerPoints"),
    longestStreak:     topBy("longestWinStreak"),
    mostSessions:      topBy("sessions"),
    most180s:          topBy("total180s"),
    mostTourTrophies:  topBy("tourTrophies"),
    mostAchievements:  topBy("achievements"),
    // Wall of Shame — same top-3-by-field shape, just sorted for the worst end.
    mostLosses:        topBy("careerLosses"),
    longestLossStreak: topBy("longestLossStreak"),
    biggestPointsFall: topBy("careerBiggestPointsFall"),
    mostEliminations:  topBy("eliminationsCount"),
    biggestSingleLoss: topBy("biggestSingleLoss"),
  });
});

router.get("/stats/checkout-records", async (req, res): Promise<void> => {
  try {
    const result = await db.execute(drizzleSql`
      WITH session_darts AS (
        SELECT
          p.id                               AS player_id,
          p.name                             AS player_name,
          ps.id                              AS session_id,
          ps.game_type_name,
          ps.created_at,
          (dart->>'val')::int               AS val,
          ordinality::int                    AS pos,
          COUNT(*) OVER (PARTITION BY ps.id)::int AS total_darts
        FROM players p
        JOIN practice_sessions ps ON ps.player1_id = p.id,
             jsonb_array_elements(ps.session_data->'dartLog') WITH ORDINALITY AS t(dart, ordinality)
        -- This is a practice-session record, not the ranked singles ladder —
        -- only players who've left the league (INACTIVE) should drop off
        -- it, same rule as Shadow Bot/Master-501. A player eliminated from
        -- the singles ladder this season can still set a practice record.
        WHERE p.status != 'INACTIVE'
          AND ps.session_data ? 'dartLog'
          AND ps.p1_checkout_hits > 0
          AND ps.game_type_key IN (SELECT key FROM game_types WHERE engine = 'X01')
      ),
      last_visits AS (
        SELECT player_id, player_name, session_id, game_type_name, created_at,
               SUM(val) AS co_val
        FROM session_darts
        WHERE pos > total_darts - ((total_darts - 1) % 3 + 1)
        GROUP BY player_id, player_name, session_id, game_type_name, created_at
        HAVING SUM(val) BETWEEN 2 AND 170
      )
      SELECT DISTINCT ON (player_id)
        player_id,
        player_name,
        co_val          AS highest_checkout,
        game_type_name,
        created_at
      FROM last_visits
      ORDER BY player_id, co_val DESC, created_at DESC
    `);
    const rows = (result.rows as any[]).sort((a, b) => b.highest_checkout - a.highest_checkout);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to get checkout records");
    res.status(500).json({ error: "Failed" });
  }
});

router.get("/stats/h2h", async (req, res): Promise<void> => {
  const p1 = parseInt(req.query.p1 as string, 10);
  const p2 = parseInt(req.query.p2 as string, 10);
  if (isNaN(p1) || isNaN(p2) || p1 === p2) { res.status(400).json({ error: "Invalid player IDs" }); return; }

  const [players, matchResult, favGameTypeResult] = await Promise.all([
    db.select().from(playersTable).where(inArray(playersTable.id, [p1, p2])),
    db.execute(drizzleSql`
      SELECT m.id, m.played_at, m.winner_id, m.winner_name, m.loser_id, m.loser_name,
             m.elo_change, m.stake, m.game_type,
             m.winner_darts, m.winner_100s, m.winner_140s, m.winner_170s, m.winner_180s,
             m.loser_darts, m.loser_100s, m.loser_140s, m.loser_170s, m.loser_180s,
             s.name AS season_name
      FROM matches m
      LEFT JOIN seasons s ON s.id = m.season_id
      WHERE (m.winner_id = ${p1} AND m.loser_id = ${p2})
         OR (m.winner_id = ${p2} AND m.loser_id = ${p1})
      ORDER BY m.played_at DESC
      LIMIT 100
    `),
    // Scouting Report addition (2026-09-25): each player's most-played
    // game type across ALL of their own matches (not just this h2h
    // pairing) — deliberately a separate, unscoped query, since "what do
    // they usually play" is a fact about the player, not about this
    // specific matchup. game_type is nullable on older rows, so those are
    // excluded rather than counted as a fake "no format" bucket.
    db.execute(drizzleSql`
      SELECT player_id, game_type, cnt FROM (
        SELECT winner_id AS player_id, game_type, COUNT(*) AS cnt
        FROM matches
        WHERE winner_id IN (${p1}, ${p2}) AND game_type IS NOT NULL AND game_type <> ''
        GROUP BY winner_id, game_type
        UNION ALL
        SELECT loser_id AS player_id, game_type, COUNT(*) AS cnt
        FROM matches
        WHERE loser_id IN (${p1}, ${p2}) AND game_type IS NOT NULL AND game_type <> ''
        GROUP BY loser_id, game_type
      ) combined
    `),
  ]);

  // Sum the winner-side and loser-side counts per (player, game_type), then
  // take the top game_type per player. Done in JS rather than a second
  // GROUP BY in SQL since the UNION ALL above already did the split — this
  // just merges it back down.
  const favGameTypeTotals = new Map<string, number>();
  for (const r of favGameTypeResult.rows as { player_id: number; game_type: string; cnt: number | string }[]) {
    const key = `${r.player_id}::${r.game_type}`;
    favGameTypeTotals.set(key, (favGameTypeTotals.get(key) ?? 0) + Number(r.cnt));
  }
  const favoriteGameTypeFor = (pid: number): string | null => {
    let best: string | null = null, bestCount = 0;
    for (const [key, count] of favGameTypeTotals) {
      const [keyPid, gameType] = key.split("::");
      if (Number(keyPid) !== pid) continue;
      if (count > bestCount) { best = gameType; bestCount = count; }
    }
    return best;
  };

  const player1 = players.find(p => p.id === p1);
  const player2 = players.find(p => p.id === p2);
  if (!player1 || !player2) { res.status(404).json({ error: "Player not found" }); return; }

  const rows = matchResult.rows as any[];
  const p1Wins = rows.filter(m => m.winner_id === p1).length;
  const p2Wins = rows.filter(m => m.winner_id === p2).length;

  let p1CurStreak = 0, p2CurStreak = 0;
  for (const m of rows) {
    if (p1CurStreak > 0 || p2CurStreak > 0) break;
    if (m.winner_id === p1) p1CurStreak++;
    else p2CurStreak++;
  }
  for (const m of rows.slice(1)) {
    if (m.winner_id === p1 && p1CurStreak > 0) p1CurStreak++;
    else if (m.winner_id === p2 && p2CurStreak > 0) p2CurStreak++;
    else break;
  }

  // Career Comparison extras — computed over every match in this h2h
  // (up to the 100-row cap above), not just the 25 returned as
  // recentMatches, so the numbers stay accurate for a long-running rivalry.
  // 180s are tracked on both the winner AND loser side of a match record
  // (you can hit a 180 in a match you still lose), so both sides get summed
  // per player rather than only counting their wins.
  const total180sFor = (pid: number) => rows.reduce((sum, m) => {
    if (m.winner_id === pid) return sum + (m.winner_180s || 0);
    if (m.loser_id === pid) return sum + (m.loser_180s || 0);
    return sum;
  }, 0);
  // Darts-to-win only makes sense from a player's own wins (the loser's
  // dart count in a single-leg match reflects an incomplete leg, not a
  // comparable finishing time) — null when they haven't beaten this
  // opponent yet, rather than a misleading 0.
  const avgDartsToWinFor = (pid: number) => {
    const darts = rows.filter(m => m.winner_id === pid && m.winner_darts != null).map(m => m.winner_darts as number);
    return darts.length ? Math.round(darts.reduce((a, b) => a + b, 0) / darts.length) : null;
  };

  res.json({
    player1: {
      id: player1.id, name: player1.name, elo: player1.elo, tier: calcTier(player1.elo), wins: p1Wins, currentStreak: p1CurStreak,
      total180s: total180sFor(p1), avgDartsToWin: avgDartsToWinFor(p1), favoriteGameType: favoriteGameTypeFor(p1),
    },
    player2: {
      id: player2.id, name: player2.name, elo: player2.elo, tier: calcTier(player2.elo), wins: p2Wins, currentStreak: p2CurStreak,
      total180s: total180sFor(p2), avgDartsToWin: avgDartsToWinFor(p2), favoriteGameType: favoriteGameTypeFor(p2),
    },
    totalMatches: rows.length,
    recentMatches: rows.slice(0, 25).map((m: any) => ({
      id:          m.id,
      playedAt:    m.played_at,
      winnerId:    m.winner_id,
      winnerName:  m.winner_name,
      loserId:     m.loser_id,
      loserName:   m.loser_name,
      eloChange:   m.elo_change,
      stake:       m.stake,
      gameType:    m.game_type,
      seasonName:  m.season_name,
      winnerDarts: m.winner_darts,
      winner100s:  m.winner_100s,
      winner140s:  m.winner_140s,
      winner170s:  m.winner_170s,
      winner180s:  m.winner_180s,
      loserDarts:  m.loser_darts,
      loser100s:   m.loser_100s,
      loser140s:   m.loser_140s,
      loser170s:   m.loser_170s,
      loser180s:   m.loser_180s,
    })),
  });
});

router.get("/stats/rivalries", async (_req, res): Promise<void> => {
  const rows = await db.execute(drizzleSql`
    SELECT
      LEAST(m.winner_id, m.loser_id)          AS p1_id,
      GREATEST(m.winner_id, m.loser_id)       AS p2_id,
      p1.name                                 AS p1_name,
      p2.name                                 AS p2_name,
      COUNT(*)::int                           AS total_matches,
      SUM(CASE WHEN m.winner_id = LEAST(m.winner_id, m.loser_id)     THEN 1 ELSE 0 END)::int AS p1_wins,
      SUM(CASE WHEN m.winner_id = GREATEST(m.winner_id, m.loser_id)  THEN 1 ELSE 0 END)::int AS p2_wins,
      MAX(m.played_at)                        AS last_played_at
    FROM matches m
    JOIN players p1 ON p1.id = LEAST(m.winner_id, m.loser_id)
    JOIN players p2 ON p2.id = GREATEST(m.winner_id, m.loser_id)
    WHERE m.winner_id IS NOT NULL AND m.loser_id IS NOT NULL
    GROUP BY LEAST(m.winner_id, m.loser_id), GREATEST(m.winner_id, m.loser_id), p1.name, p2.name
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC, MAX(m.played_at) DESC
    LIMIT 8
  `);
  res.json(rows.rows);
});

export default router;
