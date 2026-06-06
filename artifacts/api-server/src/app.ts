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
  app.get("*", (_req, res) => {
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
    championName: "Robert",
    totalMatches: 22,
  }).returning();

  const [may] = await db.insert(seasonsTable).values({
    name: "May 2026",
    startDate: "2026-05-01",
    endDate:   "2026-05-31",
    isActive:  false,
    championName: "Sean",
    totalMatches: 35,
  }).returning();

  const [june] = await db.insert(seasonsTable).values({
    name: "June 2026",
    startDate: "2026-06-01",
    isActive: true,
    totalMatches: 5,
  }).returning();

  // ── Players ────────────────────────────────────────────────────────────────
  // name | playerId | status | pts | seasonW | seasonL | seasonGP | elo | careerW | careerL | careerGP | careerPeakElo | peakPts | careerPoints | winStreak | lossStreak | eliminations
  const playerData = [
    { name: "Graeme",            playerId: "P001", status: "ACTIVE",   points: 25, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins: 16, careerLosses:  9, careerGamesPlayed: 25, careerPeakElo: 1017, peakPoints: 25, careerPoints: 200, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 4, eliminationsCount: 0 },
    { name: "Sean",              playerId: "P002", status: "ACTIVE",   points: 44, seasonWins: 3, seasonLosses: 0, seasonGamesPlayed: 3, elo: 1036, careerWins: 20, careerLosses:  3, careerGamesPlayed: 23, careerPeakElo: 1150, peakPoints: 44, careerPoints: 340, currentWinStreak: 3, currentLossStreak: 0, longestWinStreak: 7, eliminationsCount: 1 },
    { name: "Richard",           playerId: "P003", status: "ACTIVE",   points: 18, seasonWins: 1, seasonLosses: 2, seasonGamesPlayed: 3, elo:  986, careerWins: 16, careerLosses: 12, careerGamesPlayed: 28, careerPeakElo: 1087, peakPoints: 25, careerPoints: 185, currentWinStreak: 0, currentLossStreak: 1, longestWinStreak: 5, eliminationsCount: 0 },
    { name: "Ryan",              playerId: "P004", status: "ACTIVE",   points: 13, seasonWins: 1, seasonLosses: 3, seasonGamesPlayed: 4, elo:  978, careerWins:  6, careerLosses: 13, careerGamesPlayed: 19, careerPeakElo: 1000, peakPoints: 25, careerPoints:  75, currentWinStreak: 0, currentLossStreak: 2, longestWinStreak: 2, eliminationsCount: 0 },
    { name: "Robert",            playerId: "P005", status: "ACTIVE",   points: 25, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins: 11, careerLosses:  4, careerGamesPlayed: 15, careerPeakElo: 1017, peakPoints: 25, careerPoints: 130, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 4, eliminationsCount: 1 },
    { name: "Cavan",             playerId: "P006", status: "ACTIVE",   points: 25, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins:  9, careerLosses:  6, careerGamesPlayed: 15, careerPeakElo: 1008, peakPoints: 25, careerPoints:  90, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 3, eliminationsCount: 0 },
    { name: "Kyle",              playerId: "P007", status: "ACTIVE",   points: 25, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins:  2, careerLosses: 10, careerGamesPlayed: 12, careerPeakElo: 1000, peakPoints: 25, careerPoints:  20, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 1, eliminationsCount: 0 },
    { name: "Ronald Augustine",  playerId: "P008", status: "ACTIVE",   points: 25, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins:  3, careerLosses:  9, careerGamesPlayed: 12, careerPeakElo: 1000, peakPoints: 25, careerPoints:  30, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 2, eliminationsCount: 0 },
    { name: "Jamie",             playerId: "P009", status: "ACTIVE",   points: 25, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins:  0, careerLosses:  2, careerGamesPlayed:  2, careerPeakElo: 1000, peakPoints: 25, careerPoints:   0, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 0, eliminationsCount: 0 },
    { name: "Cameron",           playerId: "P010", status: "ACTIVE",   points: 25, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins:  0, careerLosses:  3, careerGamesPlayed:  3, careerPeakElo: 1000, peakPoints: 25, careerPoints:   0, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 0, eliminationsCount: 0 },
    { name: "Aiden",             playerId: "P011", status: "INACTIVE", points:  0, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins:  4, careerLosses:  0, careerGamesPlayed:  4, careerPeakElo: 1000, peakPoints:  0, careerPoints:   0, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 4, eliminationsCount: 0 },
    { name: "Brodie",            playerId: "P012", status: "INACTIVE", points:  0, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins:  0, careerLosses:  5, careerGamesPlayed:  5, careerPeakElo: 1000, peakPoints:  0, careerPoints:   0, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 0, eliminationsCount: 0 },
    { name: "Joanna",            playerId: "P013", status: "INACTIVE", points:  0, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins:  0, careerLosses:  6, careerGamesPlayed:  6, careerPeakElo: 1000, peakPoints:  0, careerPoints:   0, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 0, eliminationsCount: 0 },
    { name: "Roddie",            playerId: "P014", status: "INACTIVE", points:  0, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins:  0, careerLosses:  6, careerGamesPlayed:  6, careerPeakElo: 1000, peakPoints:  0, careerPoints:   0, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 0, eliminationsCount: 0 },
    { name: "Scott",             playerId: "P015", status: "ACTIVE",   points: 25, seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0, elo: 1000, careerWins:  3, careerLosses:  2, careerGamesPlayed:  5, careerPeakElo: 1000, peakPoints: 25, careerPoints:  30, currentWinStreak: 0, currentLossStreak: 0, longestWinStreak: 2, eliminationsCount: 0 },
  ];

  const insertedPlayers = await db.insert(playersTable).values(
    playerData.map(p => ({
      ...p,
      isActive: p.status !== "INACTIVE",
    }))
  ).returning();

  const byName = new Map(insertedPlayers.map(p => [p.name, p]));
  const sean    = byName.get("Sean")!;
  const richard = byName.get("Richard")!;
  const ryan    = byName.get("Ryan")!;
  const graeme  = byName.get("Graeme")!;
  const robert  = byName.get("Robert")!;

  // ── JUNE_2026 matches (5 real matches) ─────────────────────────────────────
  const juneMatches = [
    { winnerId: sean.id,    loserId: richard.id, stake: 7, eloChange: 16, playedAt: new Date("2026-06-01T10:00:00Z") },
    { winnerId: sean.id,    loserId: ryan.id,    stake: 5, eloChange: 16, playedAt: new Date("2026-06-02T10:00:00Z") },
    { winnerId: ryan.id,    loserId: richard.id, stake: 3, eloChange: 16, playedAt: new Date("2026-06-03T10:00:00Z") },
    { winnerId: richard.id, loserId: ryan.id,    stake: 3, eloChange: 16, playedAt: new Date("2026-06-04T10:00:00Z") },
    { winnerId: sean.id,    loserId: ryan.id,    stake: 7, eloChange: 14, playedAt: new Date("2026-06-05T10:00:00Z") },
  ];

  for (const m of juneMatches) {
    const winner = insertedPlayers.find(p => p.id === m.winnerId)!;
    const loser  = insertedPlayers.find(p => p.id === m.loserId)!;
    await db.insert(matchesTable).values({
      seasonId:  june.id,
      winnerId:  m.winnerId,
      loserId:   m.loserId,
      winnerName: winner.name,
      loserName:  loser.name,
      stake:      m.stake,
      eloChange:  m.eloChange,
      gameType:   "501",
      playedAt:   m.playedAt,
    });
  }

  // ── FEB_2026 season standings snapshot ─────────────────────────────────────
  const febStandings = [
    { player: "Robert",   pos: 1,  wins: 9,  losses: 2,  points: 37, elo: 1017, champ: true  },
    { player: "Graeme",   pos: 2,  wins: 8,  losses: 3,  points: 32, elo: 1010, champ: false },
    { player: "Richard",  pos: 3,  wins: 7,  losses: 4,  points: 29, elo: 1000, champ: false },
    { player: "Scott",    pos: 4,  wins: 3,  losses: 2,  points: 26, elo: 1000, champ: false },
    { player: "Aiden",    pos: 5,  wins: 4,  losses: 0,  points: 29, elo: 1000, champ: false },
    { player: "Cavan",    pos: 6,  wins: 5,  losses: 4,  points: 24, elo:  998, champ: false },
    { player: "Kyle",     pos: 7,  wins: 1,  losses: 5,  points: 22, elo:  990, champ: false },
    { player: "Joanna",   pos: 8,  wins: 0,  losses: 5,  points: 20, elo:  980, champ: false },
    { player: "Roddie",   pos: 9,  wins: 0,  losses: 5,  points: 20, elo:  982, champ: false },
    { player: "Brodie",   pos: 10, wins: 0,  losses: 4,  points: 21, elo:  985, champ: false },
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
  // Update FEB champion
  await db.update(seasonsTable).set({ championId: robert.id, championName: "Robert" }).where(eq(seasonsTable.id, feb.id));

  // ── MAY_2026 season standings snapshot ─────────────────────────────────────
  const mayStandings = [
    { player: "Sean",             pos: 1,  wins: 12, losses: 2,  points: 61, elo: 1088, champ: true  },
    { player: "Graeme",           pos: 2,  wins: 8,  losses: 4,  points: 44, elo: 1017, champ: false },
    { player: "Robert",           pos: 3,  wins: 7,  losses: 3,  points: 42, elo: 1008, champ: false },
    { player: "Richard",          pos: 4,  wins: 7,  losses: 5,  points: 38, elo: 1040, champ: false },
    { player: "Cavan",            pos: 5,  wins: 4,  losses: 2,  points: 30, elo: 1000, champ: false },
    { player: "Ryan",             pos: 6,  wins: 4,  losses: 8,  points: 20, elo:  992, champ: false },
    { player: "Cameron",          pos: 7,  wins: 0,  losses: 2,  points: 23, elo:  985, champ: false },
    { player: "Jamie",            pos: 8,  wins: 0,  losses: 2,  points: 23, elo:  985, champ: false },
    { player: "Ronald Augustine", pos: 9,  wins: 3,  losses: 6,  points: 22, elo:  988, champ: false },
    { player: "Kyle",             pos: 10, wins: 1,  losses: 5,  points: 21, elo:  992, champ: false },
    { player: "Scott",            pos: 11, wins: 0,  losses: 0,  points: 25, elo: 1000, champ: false },
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
  await db.update(seasonsTable).set({ championId: sean.id, championName: "Sean" }).where(eq(seasonsTable.id, may.id));

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
