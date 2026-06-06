import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedAchievements } from "./lib/achievements";
import { maybeAutoResetSeason } from "./lib/seasonReset";
import { db } from "@workspace/db";
import { playersTable, seasonsTable, matchesTable, seasonStandingsTable, settingsTable, gameTypesTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", router);

// In production, serve the built frontend and handle client-side routing
if (process.env.NODE_ENV === "production") {
  const frontendDist = process.env.FRONTEND_DIST
    ?? path.resolve(process.cwd(), "artifacts/tkdl/dist/public");
  app.use(express.static(frontendDist));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

async function seedRealData() {
  const [{ c }] = await db.select({ c: count() }).from(playersTable);
  if (Number(c) > 0) {
    logger.info("Players already seeded, skipping");
    return;
  }

  logger.info("Seeding real TKDL data...");

  // ── Seasons ────────────────────────────────────────────────────────────────
  const [feb] = await db.insert(seasonsTable).values({
    name: "February 2026",
    startDate: "2026-02-01",
    endDate:   "2026-02-28",
    isActive:  false,
    championName: "Sean",
    format: "301",
    totalMatches: 50,
  }).returning();

  const [may] = await db.insert(seasonsTable).values({
    name: "May 2026",
    startDate: "2026-05-01",
    endDate:   "2026-05-31",
    isActive:  false,
    championName: "Richard",
    totalMatches: 35,
  }).returning();

  const [june] = await db.insert(seasonsTable).values({
    name: "June 2026",
    startDate: "2026-06-01",
    isActive: true,
    totalMatches: 9,
  }).returning();

  // ── Players ─────────────────────────────────────────────────────────────────
  // Exact values from local DB as of June 6 2026 (9 June matches played)
  const playerData = [
    { name: "Graeme",           playerId: "P001", status: "ACTIVE",   points: 25, seasonWins: 0,  seasonLosses: 0,  seasonGamesPlayed: 0,  elo: 1052, careerWins: 16, careerLosses:  9, careerGamesPlayed: 25, careerPeakElo: 1119, peakPoints: 25, careerPoints:   46, currentWinStreak:  0, currentLossStreak: 1, longestWinStreak:  9, eliminationsCount: 0 },
    { name: "Sean",             playerId: "P002", status: "ACTIVE",   points: 49, seasonWins: 5,  seasonLosses: 0,  seasonGamesPlayed: 5,  elo: 1203, careerWins: 22, careerLosses:  3, careerGamesPlayed: 25, careerPeakElo: 1203, peakPoints: 49, careerPoints:   68, currentWinStreak: 13, currentLossStreak: 0, longestWinStreak: 13, eliminationsCount: 1 },
    { name: "Richard",          playerId: "P003", status: "ACTIVE",   points: 18, seasonWins: 1,  seasonLosses: 2,  seasonGamesPlayed: 3,  elo: 1071, careerWins: 16, careerLosses: 12, careerGamesPlayed: 28, careerPeakElo: 1094, peakPoints: 25, careerPoints:   52, currentWinStreak:  1, currentLossStreak: 0, longestWinStreak:  4, eliminationsCount: 0 },
    { name: "Ryan",             playerId: "P004", status: "ACTIVE",   points: 10, seasonWins: 1,  seasonLosses: 4,  seasonGamesPlayed: 5,  elo:  952, careerWins:  6, careerLosses: 14, careerGamesPlayed: 20, careerPeakElo: 1004, peakPoints: 25, careerPoints:  -40, currentWinStreak:  0, currentLossStreak: 2, longestWinStreak:  2, eliminationsCount: 0 },
    { name: "Robert",           playerId: "P005", status: "ACTIVE",   points: 26, seasonWins: 1,  seasonLosses: 1,  seasonGamesPlayed: 2,  elo: 1064, careerWins: 12, careerLosses:  5, careerGamesPlayed: 17, careerPeakElo: 1101, peakPoints: 26, careerPoints:   -5, currentWinStreak:  1, currentLossStreak: 0, longestWinStreak:  9, eliminationsCount: 1 },
    { name: "Cavan",            playerId: "P006", status: "ACTIVE",   points: 25, seasonWins: 0,  seasonLosses: 0,  seasonGamesPlayed: 0,  elo: 1035, careerWins:  9, careerLosses:  6, careerGamesPlayed: 15, careerPeakElo: 1085, peakPoints: 25, careerPoints:  -14, currentWinStreak:  0, currentLossStreak: 1, longestWinStreak:  7, eliminationsCount: 0 },
    { name: "Kyle",             playerId: "P007", status: "ACTIVE",   points: 23, seasonWins: 0,  seasonLosses: 1,  seasonGamesPlayed: 1,  elo:  916, careerWins:  2, careerLosses: 11, careerGamesPlayed: 13, careerPeakElo: 1000, peakPoints: 25, careerPoints:  -27, currentWinStreak:  0, currentLossStreak: 4, longestWinStreak:  2, eliminationsCount: 0 },
    { name: "Ronald Augustine", playerId: "P008", status: "ACTIVE",   points: 25, seasonWins: 0,  seasonLosses: 0,  seasonGamesPlayed: 0,  elo:  949, careerWins:  3, careerLosses:  9, careerGamesPlayed: 12, careerPeakElo: 1000, peakPoints: 35, careerPoints:  -25, currentWinStreak:  0, currentLossStreak: 3, longestWinStreak:  3, eliminationsCount: 0 },
    { name: "Jamie",            playerId: "P009", status: "ACTIVE",   points: 25, seasonWins: 0,  seasonLosses: 0,  seasonGamesPlayed: 0,  elo:  945, careerWins:  0, careerLosses:  2, careerGamesPlayed:  2, careerPeakElo: 1000, peakPoints: 25, careerPoints:  -25, currentWinStreak:  0, currentLossStreak: 2, longestWinStreak:  0, eliminationsCount: 0 },
    { name: "Cameron",          playerId: "P010", status: "ACTIVE",   points: 25, seasonWins: 0,  seasonLosses: 0,  seasonGamesPlayed: 0,  elo:  958, careerWins:  0, careerLosses:  3, careerGamesPlayed:  3, careerPeakElo: 1000, peakPoints: 25, careerPoints:  -25, currentWinStreak:  0, currentLossStreak: 3, longestWinStreak:  0, eliminationsCount: 0 },
    { name: "Aiden",            playerId: "P011", status: "INACTIVE", points:  0, seasonWins: 0,  seasonLosses: 0,  seasonGamesPlayed: 0,  elo: 1060, careerWins:  4, careerLosses:  0, careerGamesPlayed:  4, careerPeakElo: 1060, peakPoints:  0, careerPoints:  -25, currentWinStreak:  4, currentLossStreak: 0, longestWinStreak:  4, eliminationsCount: 0 },
    { name: "Brodie",           playerId: "P012", status: "INACTIVE", points:  0, seasonWins: 0,  seasonLosses: 0,  seasonGamesPlayed: 0,  elo:  921, careerWins:  0, careerLosses:  5, careerGamesPlayed:  5, careerPeakElo: 1000, peakPoints:  0, careerPoints:  -25, currentWinStreak:  0, currentLossStreak: 5, longestWinStreak:  0, eliminationsCount: 0 },
    { name: "Joanna",           playerId: "P013", status: "INACTIVE", points:  0, seasonWins: 0,  seasonLosses: 0,  seasonGamesPlayed: 0,  elo:  913, careerWins:  0, careerLosses:  6, careerGamesPlayed:  6, careerPeakElo: 1000, peakPoints:  0, careerPoints:  -25, currentWinStreak:  0, currentLossStreak: 6, longestWinStreak:  0, eliminationsCount: 0 },
    { name: "Roddie",           playerId: "P014", status: "INACTIVE", points:  0, seasonWins: 0,  seasonLosses: 0,  seasonGamesPlayed: 0,  elo:  920, careerWins:  0, careerLosses:  6, careerGamesPlayed:  6, careerPeakElo: 1000, peakPoints:  0, careerPoints:  -25, currentWinStreak:  0, currentLossStreak: 6, longestWinStreak:  0, eliminationsCount: 0 },
    { name: "Scott",            playerId: "P015", status: "ACTIVE",   points: 24, seasonWins: 1,  seasonLosses: 1,  seasonGamesPlayed: 2,  elo: 1041, careerWins:  4, careerLosses:  3, careerGamesPlayed:  7, careerPeakElo: 1058, peakPoints: 27, careerPoints:    2, currentWinStreak:  0, currentLossStreak: 1, longestWinStreak:  3, eliminationsCount: 0 },
  ];

  const insertedPlayers = await db.insert(playersTable).values(
    playerData.map(p => ({
      ...p,
      isActive: p.status !== "INACTIVE",
    }))
  ).returning();

  const byName      = new Map(insertedPlayers.map(p => [p.name, p]));
  const sean        = byName.get("Sean")!;
  const richard     = byName.get("Richard")!;
  const ryan        = byName.get("Ryan")!;
  const graeme      = byName.get("Graeme")!;
  const robert      = byName.get("Robert")!;
  const kyle        = byName.get("Kyle")!;
  const cameron     = byName.get("Cameron")!;
  const ronald      = byName.get("Ronald Augustine")!;
  const jamie       = byName.get("Jamie")!;
  const cavan       = byName.get("Cavan")!;
  const scott       = byName.get("Scott")!;

  // ── MAY_2026 matches (35 real wager matches from DB) ────────────────────────
  type MatchSeed = { w: typeof sean; l: typeof sean; stake: number; eloChange: number; gameType: string; playedAt: Date };
  const mayMatches: MatchSeed[] = [
    { w: ryan,    l: graeme,  stake:  3, eloChange: 20, gameType: "No black",                       playedAt: new Date("2026-05-13T11:51:31Z") },
    { w: richard, l: ryan,    stake:  3, eloChange: 17, gameType: "301 double in",                  playedAt: new Date("2026-05-14T17:49:24Z") },
    { w: richard, l: ryan,    stake:  3, eloChange: 15, gameType: "No point black",                 playedAt: new Date("2026-05-14T17:51:32Z") },
    { w: ryan,    l: cavan,   stake:  2, eloChange: 19, gameType: "Closest to bullseye",            playedAt: new Date("2026-05-15T10:29:30Z") },
    { w: graeme,  l: richard, stake:  3, eloChange: 14, gameType: "Bull finish",                    playedAt: new Date("2026-05-16T10:53:13Z") },
    { w: richard, l: ryan,    stake:  6, eloChange: 15, gameType: "Double or nothing 301",          playedAt: new Date("2026-05-16T11:11:59Z") },
    { w: ryan,    l: graeme,  stake:  5, eloChange: 20, gameType: "Pick a double",                  playedAt: new Date("2026-05-16T11:15:44Z") },
    { w: graeme,  l: richard, stake:  3, eloChange: 15, gameType: "Shanghai",                       playedAt: new Date("2026-05-17T10:15:50Z") },
    { w: richard, l: graeme,  stake:  3, eloChange: 19, gameType: "501",                            playedAt: new Date("2026-05-17T10:16:12Z") },
    { w: richard, l: sean,    stake:  4, eloChange: 19, gameType: "501 first to 3",                 playedAt: new Date("2026-05-18T11:46:18Z") },
    { w: sean,    l: ryan,    stake: 10, eloChange: 12, gameType: "301",                            playedAt: new Date("2026-05-19T11:16:26Z") },
    { w: sean,    l: richard, stake:  5, eloChange: 14, gameType: "301",                            playedAt: new Date("2026-05-20T12:18:01Z") },
    { w: sean,    l: ryan,    stake:  5, eloChange: 11, gameType: "Killer",                         playedAt: new Date("2026-05-20T12:18:31Z") },
    { w: sean,    l: ryan,    stake:  8, eloChange: 10, gameType: "Bull finish",                    playedAt: new Date("2026-05-20T12:18:53Z") },
    { w: sean,    l: kyle,    stake:  5, eloChange:  8, gameType: "Cricket",                        playedAt: new Date("2026-05-21T04:53:53Z") },
    { w: sean,    l: graeme,  stake:  4, eloChange: 12, gameType: "Cricket",                        playedAt: new Date("2026-05-21T09:26:24Z") },
    { w: richard, l: graeme,  stake:  3, eloChange: 16, gameType: "1001",                           playedAt: new Date("2026-05-21T11:19:54Z") },
    { w: sean,    l: kyle,    stake:  5, eloChange:  7, gameType: "Killer",                         playedAt: new Date("2026-05-22T03:43:58Z") },
    { w: sean,    l: cavan,   stake:  6, eloChange: 10, gameType: "Treble finish",                  playedAt: new Date("2026-05-22T06:51:17Z") },
    { w: graeme,  l: cameron, stake:  5, eloChange: 15, gameType: "Cricket",                        playedAt: new Date("2026-05-23T04:22:45Z") },
    { w: kyle,    l: jamie,   stake: 10, eloChange: 20, gameType: "Cricket",                        playedAt: new Date("2026-05-24T04:22:45Z") },
    { w: kyle,    l: jamie,   stake: 15, eloChange: 18, gameType: "Around the World",               playedAt: new Date("2026-05-24T04:25:45Z") },
    { w: richard, l: kyle,    stake:  5, eloChange: 12, gameType: "Around the world",               playedAt: new Date("2026-05-24T05:52:15Z") },
    { w: cavan,   l: richard, stake: 10, eloChange: 18, gameType: "Treble out",                     playedAt: new Date("2026-05-24T11:51:56Z") },
    { w: cavan,   l: richard, stake: 10, eloChange: 16, gameType: "Treble out (Double or nothing)", playedAt: new Date("2026-05-24T11:52:54Z") },
    { w: richard, l: robert,  stake:  5, eloChange: 19, gameType: "501 double in double",           playedAt: new Date("2026-05-25T07:39:54Z") },
    { w: graeme,  l: cameron, stake: 10, eloChange: 14, gameType: "Cricket",                        playedAt: new Date("2026-05-26T07:03:41Z") },
    { w: graeme,  l: cameron, stake: 10, eloChange: 13, gameType: "Around the world",               playedAt: new Date("2026-05-26T07:04:00Z") },
    { w: robert,  l: graeme,  stake:  5, eloChange: 15, gameType: "501",                            playedAt: new Date("2026-05-26T07:04:17Z") },
    { w: richard, l: cavan,   stake: 26, eloChange: 16, gameType: "501 double in double out",       playedAt: new Date("2026-05-26T07:05:14Z") },
    { w: graeme,  l: ronald,  stake: 25, eloChange: 11, gameType: "Cricket (3 bull finish)",        playedAt: new Date("2026-05-29T09:00:48Z") },
    { w: robert,  l: kyle,    stake: 10, eloChange:  9, gameType: "301",                            playedAt: new Date("2026-05-30T04:07:54Z") },
    { w: graeme,  l: kyle,    stake: 25, eloChange: 11, gameType: "301",                            playedAt: new Date("2026-05-30T04:24:26Z") },
    { w: richard, l: robert,  stake: 20, eloChange: 18, gameType: "Cricket",                        playedAt: new Date("2026-05-31T06:36:54Z") },
    { w: richard, l: graeme,  stake: 12, eloChange: 16, gameType: "501",                            playedAt: new Date("2026-05-31T09:44:55Z") },
  ];

  for (const m of mayMatches) {
    await db.insert(matchesTable).values({
      seasonId:   may.id,
      winnerId:   m.w.id,
      loserId:    m.l.id,
      winnerName: m.w.name,
      loserName:  m.l.name,
      stake:      m.stake,
      eloChange:  m.eloChange,
      gameType:   m.gameType,
      playedAt:   m.playedAt,
    });
  }

  // ── JUNE_2026 matches (9 real matches from DB) ──────────────────────────────
  const juneMatches: MatchSeed[] = [
    { w: sean,    l: richard, stake: 7, eloChange: 13, gameType: "Round the world (trebles)", playedAt: new Date("2026-06-03T11:41:35Z") },
    { w: sean,    l: ryan,    stake: 7, eloChange:  7, gameType: "Cricket",                   playedAt: new Date("2026-06-03T11:43:05Z") },
    { w: sean,    l: ryan,    stake: 5, eloChange:  7, gameType: "301",                       playedAt: new Date("2026-06-03T11:43:24Z") },
    { w: ryan,    l: richard, stake: 5, eloChange: 22, gameType: "Cricket",                   playedAt: new Date("2026-06-03T11:55:00Z") },
    { w: richard, l: ryan,    stake: 5, eloChange: 12, gameType: "501",                       playedAt: new Date("2026-06-04T10:21:44Z") },
    { w: sean,    l: kyle,    stake: 2, eloChange:  6, gameType: "301",                       playedAt: new Date("2026-06-06T01:57:38Z") },
    { w: scott,   l: robert,  stake: 2, eloChange: 19, gameType: "Round the clock",           playedAt: new Date("2026-06-06T05:33:22Z") },
    { w: robert,  l: scott,   stake: 3, eloChange: 17, gameType: "Round the clock",           playedAt: new Date("2026-06-06T05:33:53Z") },
    { w: sean,    l: ryan,    stake: 3, eloChange:  7, gameType: "301",                       playedAt: new Date("2026-06-06T07:01:34Z") },
  ];

  for (const m of juneMatches) {
    await db.insert(matchesTable).values({
      seasonId:   june.id,
      winnerId:   m.w.id,
      loserId:    m.l.id,
      winnerName: m.w.name,
      loserName:  m.l.name,
      stake:      m.stake,
      eloChange:  m.eloChange,
      gameType:   m.gameType,
      playedAt:   m.playedAt,
    });
  }

  // ── FEB_2026 standings snapshot (301 round-robin, Sean champion via playoff) ─
  // Robert pos1, Graeme pos2, Sean pos3 in league table — Sean won playoff
  const febStandings = [
    { player: "Robert",           pos:  1, wins: 9, losses: 2, points: 0, elo: 1017, champ: false },
    { player: "Graeme",           pos:  2, wins: 9, losses: 2, points: 0, elo: 1010, champ: false },
    { player: "Sean",             pos:  3, wins: 9, losses: 2, points: 0, elo: 1036, champ: true  },
    { player: "Cavan",            pos:  4, wins: 7, losses: 3, points: 0, elo:  998, champ: false },
    { player: "Aiden",            pos:  5, wins: 4, losses: 0, points: 0, elo: 1000, champ: false },
    { player: "Richard",          pos:  6, wins: 4, losses: 5, points: 0, elo: 1000, champ: false },
    { player: "Scott",            pos:  7, wins: 3, losses: 2, points: 0, elo: 1000, champ: false },
    { player: "Ronald Augustine", pos:  8, wins: 3, losses: 8, points: 0, elo:  990, champ: false },
    { player: "Ryan",             pos:  9, wins: 2, losses: 4, points: 0, elo:  985, champ: false },
    { player: "Brodie",           pos: 10, wins: 0, losses: 5, points: 0, elo:  985, champ: false },
    { player: "Kyle",             pos: 11, wins: 0, losses: 5, points: 0, elo:  980, champ: false },
    { player: "Joanna",           pos: 12, wins: 0, losses: 6, points: 0, elo:  975, champ: false },
    { player: "Roddie",           pos: 13, wins: 0, losses: 6, points: 0, elo:  977, champ: false },
  ];
  for (const s of febStandings) {
    const p = byName.get(s.player);
    if (!p) continue;
    await db.insert(seasonStandingsTable).values({
      seasonId: feb.id, playerId: p.id,
      position: s.pos, wins: s.wins, losses: s.losses,
      points: s.points, elo: s.elo, isChampion: s.champ,
    });
  }
  await db.update(seasonsTable).set({ championId: sean.id, championName: "Sean" }).where(eq(seasonsTable.id, feb.id));

  // ── MAY_2026 standings snapshot (Richard champion, wager-based) ─────────────
  // Richard 11W-5L 84pts (started at 25, won big wagers)
  const mayStandings = [
    { player: "Richard",          pos:  1, wins: 11, losses:  5, points:  84, elo: 1094, champ: true  },
    { player: "Graeme",           pos:  2, wins:  8, losses:  6, points:  71, elo: 1052, champ: false },
    { player: "Sean",             pos:  3, wins:  8, losses:  1, points:  69, elo: 1090, champ: false },
    { player: "Scott",            pos:  4, wins:  0, losses:  0, points:  25, elo: 1000, champ: false },
    { player: "Robert",           pos:  5, wins:  2, losses:  2, points:  15, elo:  990, champ: false },
    { player: "Cavan",            pos:  6, wins:  2, losses:  3, points:  11, elo: 1035, champ: false },
    { player: "Ryan",             pos:  7, wins:  3, losses:  6, points:   0, elo:  960, champ: false },
    { player: "Kyle",             pos:  8, wins:  2, losses:  5, points:   0, elo:  965, champ: false },
    { player: "Cameron",          pos:  9, wins:  0, losses:  3, points:   0, elo:  955, champ: false },
    { player: "Ronald Augustine", pos: 10, wins:  0, losses:  1, points:   0, elo:  950, champ: false },
    { player: "Jamie",            pos: 11, wins:  0, losses:  2, points:   0, elo:  950, champ: false },
  ];
  for (const s of mayStandings) {
    const p = byName.get(s.player);
    if (!p) continue;
    await db.insert(seasonStandingsTable).values({
      seasonId: may.id, playerId: p.id,
      position: s.pos, wins: s.wins, losses: s.losses,
      points: s.points, elo: s.elo, isChampion: s.champ,
    });
  }
  await db.update(seasonsTable).set({ championId: richard.id, championName: "Richard" }).where(eq(seasonsTable.id, may.id));

  logger.info("Real TKDL data seeded successfully");
}

async function seedSettings() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  const existing = await db.select().from(settingsTable);
  if (existing.length === 0) {
    await db.insert(settingsTable).values([{ key: "live_scorer_enabled", value: "false" }]);
    logger.info("Settings seeded with defaults");
  }
}

async function seedGameTypes() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS game_types (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      engine TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'competitive',
      description TEXT DEFAULT '',
      config TEXT NOT NULL DEFAULT '{}',
      enabled BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  type GT = typeof gameTypesTable.$inferInsert;
  const defaults: GT[] = [
    // ── Competitive — X01 ──────────────────────────────────────────────────
    { key: "501_double_out",       name: "501 – Double Out",         engine: "X01",         category: "competitive", description: "Standard PDC format. Must finish on a double.",                           config: JSON.stringify({ startingScore: 501,  doubleIn: false, doubleOut: true,  trebleOut: false }),              enabled: true, sortOrder: 1  },
    { key: "501_straight_out",     name: "501 – Straight Out",       engine: "X01",         category: "competitive", description: "No double required to finish.",                                           config: JSON.stringify({ startingScore: 501,  doubleIn: false, doubleOut: false, trebleOut: false }),              enabled: true, sortOrder: 2  },
    { key: "501_double_in",        name: "501 – Double In/Out",      engine: "X01",         category: "competitive", description: "Must start AND finish on a double.",                                      config: JSON.stringify({ startingScore: 501,  doubleIn: true,  doubleOut: true,  trebleOut: false }),              enabled: true, sortOrder: 3  },
    { key: "501_treble_out",       name: "501 – Treble Out",         engine: "X01",         category: "competitive", description: "Must finish on a treble. No bull finish.",                                config: JSON.stringify({ startingScore: 501,  doubleIn: false, doubleOut: false, trebleOut: true  }),              enabled: true, sortOrder: 4  },
    { key: "501_master_out",       name: "501 – Master Out",         engine: "X01",         category: "competitive", description: "Finish on any double or treble.",                                         config: JSON.stringify({ startingScore: 501,  doubleIn: false, masterOut: true                    }),              enabled: true, sortOrder: 5  },
    { key: "301_double_out",       name: "301 – Double Out",         engine: "X01",         category: "competitive", description: "Shorter format, double to finish.",                                       config: JSON.stringify({ startingScore: 301,  doubleIn: false, doubleOut: true,  trebleOut: false }),              enabled: true, sortOrder: 6  },
    { key: "301_double_in",        name: "301 – Double In/Out",      engine: "X01",         category: "competitive", description: "Must start AND finish on a double.",                                      config: JSON.stringify({ startingScore: 301,  doubleIn: true,  doubleOut: true,  trebleOut: false }),              enabled: true, sortOrder: 7  },
    { key: "1001_double_out",      name: "1001 – Double Out",        engine: "X01",         category: "competitive", description: "Endurance format. Double to finish.",                                     config: JSON.stringify({ startingScore: 1001, doubleIn: false, doubleOut: true                   }),              enabled: true, sortOrder: 8  },
    { key: "cricket",              name: "Cricket",                  engine: "Cricket",     category: "competitive", description: "Close 15–20 and bull. Score when opponent hasn't closed.",                config: JSON.stringify({ cutThroat: false, includesBull: true }),                                                 enabled: true, sortOrder: 9  },
    { key: "cutthroat_cricket",    name: "Cut-Throat Cricket",       engine: "Cricket",     category: "competitive", description: "Scoring points hurts opponents instead of helping you.",                  config: JSON.stringify({ cutThroat: true,  includesBull: true }),                                                 enabled: true, sortOrder: 10 },
    // ── Practice — skill games ──────────────────────────────────────────────
    { key: "around_the_world",     name: "Around the World",         engine: "Sequence",    category: "practice",    description: "Hit 1–20 in order, then bull to win.",                                    config: JSON.stringify({ type: "sequential", maxNumber: 20, includeBull: true  }),                               enabled: true, sortOrder: 11 },
    { key: "around_world_trebles", name: "Round the World (Trebles)",engine: "Sequence",    category: "practice",    description: "As above, but must hit the treble of each number.",                       config: JSON.stringify({ type: "sequential", maxNumber: 20, treblesOnly: true  }),                               enabled: true, sortOrder: 12 },
    { key: "round_the_clock",      name: "Round the Clock",          engine: "Sequence",    category: "practice",    description: "Hit 1–20 in order. No bull required.",                                    config: JSON.stringify({ type: "sequential", maxNumber: 20, includeBull: false }),                               enabled: true, sortOrder: 13 },
    { key: "shanghai",             name: "Shanghai",                 engine: "Sequence",    category: "practice",    description: "Rounds 1–7. Hit single, double, and treble of the round number to win.", config: JSON.stringify({ type: "shanghai", rounds: 7 }),                                                          enabled: true, sortOrder: 14 },
    { key: "halve_it",             name: "Halve-It",                 engine: "HalveIt",     category: "practice",    description: "Hit each target. Miss = your score halves. Highest score wins.",           config: JSON.stringify({ targets: [20, 16, "double", 17, "bull", 18, 19, "treble"] }),                            enabled: true, sortOrder: 15 },
    { key: "count_up",             name: "Count Up",                 engine: "CountUp",     category: "practice",    description: "Score as many points as possible. First to 501 wins.",                    config: JSON.stringify({ target: 501 }),                                                                          enabled: true, sortOrder: 16 },
    // ── Party / Fun ─────────────────────────────────────────────────────────
    { key: "killer",               name: "Killer",                   engine: "Killer",      category: "party",       description: "Hit your own double to become a Killer, then eliminate others.",           config: JSON.stringify({ lives: 3 }),                                                                             enabled: true, sortOrder: 17 },
    { key: "gotcha",               name: "Gotcha",                   engine: "Gotcha",      category: "party",       description: "Race to exactly 301. Hit opponent's score to reset them to zero.",         config: JSON.stringify({ target: 301 }),                                                                          enabled: true, sortOrder: 18 },
    { key: "no_black",             name: "No Black",                 engine: "Custom",      category: "party",       description: "TKDL special: any dart in the outer bull scores zero for that throw.",    config: JSON.stringify({ noOuterBull: true }),                                                                    enabled: true, sortOrder: 19 },
    { key: "bull_finish",          name: "Bull Finish",              engine: "X01",         category: "party",       description: "501 where you must finish on the bullseye (50) only.",                    config: JSON.stringify({ startingScore: 501, bullFinish: true }),                                                 enabled: true, sortOrder: 20 },
    { key: "nearest_bull",         name: "Nearest the Bull",         engine: "NearestBull", category: "party",       description: "Each player throws 3 darts. Closest to bull wins the round.",             config: JSON.stringify({ dartsEach: 3, rounds: 1 }),                                                              enabled: true, sortOrder: 21 },
    { key: "pick_a_double",        name: "Pick a Double",            engine: "Custom",      category: "party",       description: "TKDL custom: must call your double before throwing.",                      config: JSON.stringify({ callDouble: true }),                                                                     enabled: true, sortOrder: 22 },
    { key: "double_or_nothing",    name: "Double or Nothing",        engine: "X01",         category: "party",       description: "Play 301. If you miss your out-shot, the stake doubles.",                  config: JSON.stringify({ startingScore: 301, doubleOut: true, stakeDoubles: true }),                             enabled: true, sortOrder: 23 },

    // ── Competitive — Legs formats ───────────────────────────────────────────
    { key: "501_bo3",              name: "501 – Best of 3 Legs",     engine: "X01",         category: "competitive", description: "First to win 2 legs. PDC World Championship format.",                      config: JSON.stringify({ startingScore: 501, doubleIn: false, doubleOut: true, legs: 3 }),                       enabled: true, sortOrder: 24 },
    { key: "501_bo5",              name: "501 – Best of 5 Legs",     engine: "X01",         category: "competitive", description: "First to win 3 legs. Grand Prix / Matchplay format.",                      config: JSON.stringify({ startingScore: 501, doubleIn: false, doubleOut: true, legs: 5 }),                       enabled: true, sortOrder: 25 },
    { key: "501_bo7",              name: "501 – Best of 7 Legs",     engine: "X01",         category: "competitive", description: "First to win 4 legs. Players Championship format.",                        config: JSON.stringify({ startingScore: 501, doubleIn: false, doubleOut: true, legs: 7 }),                       enabled: true, sortOrder: 26 },
    { key: "301_bo3",              name: "301 – Best of 3 Legs",     engine: "X01",         category: "competitive", description: "Shorter game, first to 2 legs, double out.",                               config: JSON.stringify({ startingScore: 301, doubleIn: false, doubleOut: true, legs: 3 }),                       enabled: true, sortOrder: 27 },
    { key: "701_double_out",       name: "701 – Double Out",         engine: "X01",         category: "competitive", description: "Marathon singles format. Must finish on a double.",                         config: JSON.stringify({ startingScore: 701, doubleIn: false, doubleOut: true }),                               enabled: true, sortOrder: 28 },

    // ── Practice ─────────────────────────────────────────────────────────────
    { key: "bobs_27",              name: "Bob's 27",                 engine: "HalveIt",     category: "practice",    description: "Start with 27 points. Hit each double in order (1–20). Miss = subtract that double's value. Highest score wins.", config: JSON.stringify({ startingScore: 27, targets: "doubles", sequence: "1-20" }),                             enabled: true, sortOrder: 29 },
    { key: "bermuda_triangle",     name: "Bermuda Triangle",         engine: "Sequence",    category: "practice",    description: "Hit 12, 13, 14, Double Bull, 15, 16, 17, Triple Bull, 18, 19, 20, Bull in order. Miss costs you all darts that round.", config: JSON.stringify({ sequence: [12,13,14,"DB",15,16,17,"TB",18,19,20,"Bull"] }),                              enabled: true, sortOrder: 30 },
    { key: "round_the_board",      name: "Round the Board",          engine: "Sequence",    category: "practice",    description: "Hit 1 through 20 in order, then back from 20 to 1. First to finish wins.",  config: JSON.stringify({ sequence: "1-20-1", direction: "both" }),                                               enabled: true, sortOrder: 31 },
    { key: "high_score",           name: "High Score",               engine: "CountUp",     category: "practice",    description: "Each player throws 3 rounds of 3 darts. Most cumulative points wins.",      config: JSON.stringify({ rounds: 3, dartsPerRound: 3 }),                                                          enabled: true, sortOrder: 32 },
    { key: "doubles_challenge",    name: "Doubles Challenge",        engine: "Sequence",    category: "practice",    description: "Hit all 20 doubles in order then finish on double bull. Times each player.", config: JSON.stringify({ sequence: "doubles1-20+bull" }),                                                        enabled: true, sortOrder: 33 },

    // ── Party / Fun ─────────────────────────────────────────────────────────
    { key: "baseball",             name: "Baseball",                 engine: "Custom",      category: "party",       description: "9 innings. Each inning hit that inning's number — singles=1 run, doubles=2, trebles=3. Most runs wins.", config: JSON.stringify({ innings: 9, scoreDoubles: 2, scoreTrebles: 3 }),                                         enabled: true, sortOrder: 34 },
    { key: "scram",                name: "Scram",                    engine: "Custom",      category: "party",       description: "Two phases: Stopper closes numbers 20 down to 1. Scorer scores on open numbers. Swap halfway. Highest scorer wins.", config: JSON.stringify({ numbers: "20-1", phases: 2 }),                                                        enabled: true, sortOrder: 35 },
    { key: "legs",                 name: "Legs",                     engine: "Custom",      category: "party",       description: "Winner of each leg picks the starting score for the next leg (101–501). First to 3 legs wins.",  config: JSON.stringify({ minScore: 101, maxScore: 501, legsToWin: 3 }),                                          enabled: true, sortOrder: 36 },
    { key: "sudden_death",         name: "Sudden Death 501",         engine: "X01",         category: "party",       description: "Standard 501. Bust and you're reset to 50. No second chances.",             config: JSON.stringify({ startingScore: 501, doubleOut: false, bustResetTo: 50 }),                               enabled: true, sortOrder: 37 },
    { key: "football_darts",       name: "Football Darts",           engine: "Custom",      category: "party",       description: "TKDL custom: score 'goals' by hitting doubles. First to 5 goals wins. Hit a single = possession.", config: JSON.stringify({ goalsToWin: 5, goalZone: "doubles", possession: "singles" }),                            enabled: true, sortOrder: 38 },
    { key: "pairs_501",            name: "Pairs 501 (Teams)",        engine: "X01",         category: "party",       description: "2v2 team format. Teammates alternate throws. Double out. First team to 0 wins.", config: JSON.stringify({ startingScore: 501, doubleOut: true, teams: 2, playersPerTeam: 2 }),                   enabled: true, sortOrder: 39 },
    { key: "shanghai",             name: "Shanghai (Sudden Death)",  engine: "Custom",      category: "party",       description: "7 rounds hitting 1 through 7. Hit a Shanghai (single+double+treble in one round) and you instantly win.", config: JSON.stringify({ rounds: 7, shanghaiWin: true }),                                                        enabled: true, sortOrder: 40 },
  ];

  // ── 22 new games — total 62 ───────────────────────────────────────────────
  const extra: GT[] = [
    { key: "golf_darts",           name: "Golf Darts (9 Holes)",      engine: "Custom",   category: "mini-games",  description: "9 holes targeting 1–9. Fewest darts to hit each target wins. Lowest total strokes wins.",          config: JSON.stringify({ holes: 9  }),                                                                            enabled: true, sortOrder: 41 },
    { key: "golf_darts_18",        name: "Golf Darts (18 Holes)",     engine: "Custom",   category: "mini-games",  description: "18-hole golf darts — targets 1–18. Longest format for serious players.",                          config: JSON.stringify({ holes: 18 }),                                                                            enabled: true, sortOrder: 42 },
    { key: "chase_the_dragon",     name: "Chase the Dragon",           engine: "Sequence", category: "practice",    description: "Hit T10→T11→...→T20, then D20→D19→...→D10, then finish on double bull.",                        config: JSON.stringify({ sequence: "chase_dragon" }),                                                             enabled: true, sortOrder: 43 },
    { key: "snooker_darts",        name: "Snooker Darts",             engine: "Custom",   category: "mini-games",  description: "Score like snooker: pot a red (15–20), then a colour (1–6). Reds=1pt, colours 2–7. 15 reds.",   config: JSON.stringify({ reds: 15, colours: [2,3,4,5,6,7] }),                                                     enabled: true, sortOrder: 44 },
    { key: "noughts_crosses",      name: "Noughts & Crosses",         engine: "Custom",   category: "mini-games",  description: "Claim numbers 1–9 in a 3×3 grid by hitting them. Three in a row wins — darts tic-tac-toe!",    config: JSON.stringify({ grid: [[1,2,3],[4,5,6],[7,8,9]] }),                                                      enabled: true, sortOrder: 45 },
    { key: "three_in_a_bed",       name: "Three-in-a-Bed",            engine: "Custom",   category: "mini-games",  description: "Call a treble segment, throw all 3 darts. All 3 in same treble bed = win. First to 5 rounds.",  config: JSON.stringify({ winsNeeded: 5 }),                                                                        enabled: true, sortOrder: 46 },
    { key: "bull_rush",            name: "Bull Rush",                 engine: "CountUp",  category: "mini-games",  description: "Race to 5 bull hits. Inner bull (50) or outer bull (25) both count. First to 5 wins.",          config: JSON.stringify({ target: 5, bullsOnly: true }),                                                           enabled: true, sortOrder: 47 },
    { key: "checkout_challenge",   name: "Checkout Challenge",        engine: "Custom",   category: "practice",    description: "Start at 170 (max checkout). Throw 3 darts — check out in one visit to win. Honour the double!", config: JSON.stringify({ startScore: 170, doubleOut: true }),                                                     enabled: true, sortOrder: 48 },
    { key: "fives",                name: "Fives",                     engine: "Custom",   category: "party",       description: "Each visit must score a multiple of 5 or score zero. Race to 51 points. Changes target strategy.", config: JSON.stringify({ target: 51, multiplier: 5 }),                                                           enabled: true, sortOrder: 49 },
    { key: "shanghai_20",          name: "Shanghai – 20 Rounds",      engine: "Sequence", category: "practice",    description: "20 rounds hitting numbers 1–20. Hit single+double+treble in one round for an instant win.",       config: JSON.stringify({ type: "shanghai", rounds: 20 }),                                                         enabled: true, sortOrder: 50 },
    { key: "round_clock_doubles",  name: "Round the Clock (Doubles)", engine: "Sequence", category: "practice",    description: "Hit the DOUBLE of each number 1–20 in order. Only the outer double ring counts. First to D20.",  config: JSON.stringify({ sequence: "doubles1-20" }),                                                              enabled: true, sortOrder: 51 },
    { key: "around_clock_quick",   name: "Around the Clock (Quick)",  engine: "Sequence", category: "practice",    description: "Race 1–20. A treble/double advances 2 numbers instead of 1. Fastest Around-the-World format.",   config: JSON.stringify({ type: "atw", quick: true }),                                                             enabled: true, sortOrder: 52 },
    { key: "killer_1_life",        name: "Sudden Death Killer",       engine: "Killer",   category: "party",       description: "Killer with 1 life only. Hit opponent's double ONCE and they're instantly eliminated. No mercy!", config: JSON.stringify({ lives: 1 }),                                                                             enabled: true, sortOrder: 53 },
    { key: "501_no_trebles",       name: "501 – No Treble Ring",      engine: "X01",      category: "party",       description: "501 Double Out but trebles don't count — darts landing in the treble ring score as singles only.", config: JSON.stringify({ startingScore: 501, doubleOut: true, noTrebles: true }),                                enabled: true, sortOrder: 54 },
    { key: "tactics",              name: "Tactics (Mickey Mouse)",    engine: "Cricket",  category: "competitive", description: "Cricket on numbers 10–20 and Bull — wider range adds more tactical depth.",                      config: JSON.stringify({ cutThroat: false, includesBull: true }),                                                 enabled: true, sortOrder: 55 },
    { key: "cricket_no_bull",      name: "Cricket – No Bull",         engine: "Cricket",  category: "competitive", description: "Standard Cricket but the bull is removed. Only 15–20 in play — six targets not seven.",          config: JSON.stringify({ cutThroat: false, includesBull: false }),                                               enabled: true, sortOrder: 56 },
    { key: "2001_double_out",      name: "2001 – Double Out",         engine: "X01",      category: "competitive", description: "Ultra-endurance: 2001 to start, double out to finish. The ultimate long-session challenge.",     config: JSON.stringify({ startingScore: 2001, doubleIn: false, doubleOut: true }),                                 enabled: true, sortOrder: 57 },
    { key: "701_bo3",              name: "701 – Best of 3 Legs",      engine: "X01",      category: "competitive", description: "Marathon best of 3 legs at 701 Double Out. Serious endurance test.",                            config: JSON.stringify({ startingScore: 701, doubleIn: false, doubleOut: true, legs: 3 }),                        enabled: true, sortOrder: 58 },
    { key: "accumulator",          name: "Accumulator",               engine: "CountUp",  category: "practice",    description: "Each visit must score MORE than the previous — or your total is halved. Forces consistent rounds.", config: JSON.stringify({ accumulate: true }),                                                                     enabled: true, sortOrder: 59 },
    { key: "high_score_9",         name: "Best of 9 Darts",           engine: "CountUp",  category: "practice",    description: "Exactly 9 darts each (3 visits). Highest total from those 9 darts wins. Pure scoring challenge.", config: JSON.stringify({ maxVisits: 3, dartsPerRound: 3 }),                                                       enabled: true, sortOrder: 60 },
    { key: "oche_roulette",        name: "Oche Roulette",             engine: "Custom",   category: "party",       description: "Random target called each round. Both must hit it in 3 darts. Miss = 0. Most pts after 9 rounds.", config: JSON.stringify({ rounds: 9, randomTarget: true }),                                                       enabled: true, sortOrder: 61 },
    { key: "one_eighty_challenge", name: "180 Challenge",             engine: "Custom",   category: "mini-games",  description: "Race to hit a perfect 180 (T20 T20 T20). First player to land one wins. 10 attempts each.",     config: JSON.stringify({ attempts: 10 }),                                                                         enabled: true, sortOrder: 62 },
  ];

  await db.insert(gameTypesTable).values([...defaults, ...extra]).onConflictDoNothing();

  // Add rules_text column if not present (safe to run every boot)
  await db.execute(sql`ALTER TABLE game_types ADD COLUMN IF NOT EXISTS rules_text TEXT`);

  logger.info(`Game types seeded (${defaults.length + extra.length} declared, skipping existing)`);
}

async function seedPractice() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS practice_sessions (
      id               SERIAL PRIMARY KEY,
      player1_id       INTEGER REFERENCES players(id) ON DELETE SET NULL,
      player2_id       INTEGER REFERENCES players(id) ON DELETE SET NULL,
      game_type_key    TEXT NOT NULL,
      game_type_name   TEXT NOT NULL,
      winner_idx       INTEGER,
      detail           TEXT,
      darts_thrown     INTEGER,
      duration_seconds INTEGER,
      session_data     JSONB,
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add columns introduced after initial table creation (safe to run every boot)
  await db.execute(sql`ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS p1_darts              INTEGER`);
  await db.execute(sql`ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS p1_score              INTEGER`);
  await db.execute(sql`ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS p1_180s              INTEGER DEFAULT 0`);
  await db.execute(sql`ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS p1_checkout_attempts  INTEGER DEFAULT 0`);
  await db.execute(sql`ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS p1_checkout_hits      INTEGER DEFAULT 0`);
  // P2 stat columns — populated in human-vs-human sessions tracked via the live scorer
  await db.execute(sql`ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS p2_darts              INTEGER`);
  await db.execute(sql`ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS p2_score              INTEGER`);
  await db.execute(sql`ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS p2_180s              INTEGER DEFAULT 0`);
  await db.execute(sql`ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS p2_checkout_attempts  INTEGER DEFAULT 0`);
  await db.execute(sql`ALTER TABLE practice_sessions ADD COLUMN IF NOT EXISTS p2_checkout_hits      INTEGER DEFAULT 0`);
  logger.info("Practice sessions table ready");
}

async function init() {
  try {
    await seedSettings();
    await seedPractice();
    await seedGameTypes();
    await seedAchievements();
    await seedRealData();
    await maybeAutoResetSeason();
    logger.info("Startup init complete");
  } catch (err) {
    logger.error({ err }, "Startup init failed");
  }
}

init();

export default app;
