import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { seedAchievements } from "./lib/achievements";
import { maybeAutoResetSeason } from "./lib/seasonReset";
import { db } from "@workspace/db";
import { playersTable, seasonsTable, matchesTable, seasonStandingsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";

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

async function init() {
  try {
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
