/**
 * Achievements v2 evaluators for Doubles, Shift Wars, Practice (with Shadow Bot), Master-501, Board Curse and Boss Battle.
 * Pure: loaders hand over plain rows. Every area returns the same shape (metrics, feats with the time earned, per-season
 * values), so the catalogue, the report and the page treat them alike.
 */
import { londonParts } from "./league.ts";
import type { AreaFacts } from "./evaluate.ts";

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const earner = (feats: Record<string, Date | null>) => (key: string, at: Date | null | undefined) => { if (at && !feats[key]) feats[key] = at; };
const bestRunOf = (results: boolean[]) => { let r = 0, best = 0; for (const w of results) { r = w ? r + 1 : 0; best = Math.max(best, r); } return best; };

// ---------------------------------------------------------------- Doubles
export type DoublesTeam = { id: number; seasonId: number; players: number[]; points: number; wins: number; losses: number; isEliminated: boolean };
/** Every doubles result a team took part in: head-to-head, combined (solo side or a combined side) and multi-team. */
export type DoublesResult = { teamId: number; opponentTeamIds: number[]; won: boolean; stake: number; playedAt: Date; kind: "MATCH" | "COMBINED_SOLO" | "COMBINED_SIDE" | "MULTI"; seasonId: number | null };
export type DoublesContext = { playerId: number; teams: DoublesTeam[]; results: DoublesResult[]; finishedSeasons: Set<number> };

export function evaluateDoubles(ctx: DoublesContext): AreaFacts {
  const mineTeams = ctx.teams.filter(t => t.players.includes(ctx.playerId));
  const ids = new Set(mineTeams.map(t => t.id));
  const list = ctx.results.filter(r => ids.has(r.teamId)).sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const feats: Record<string, Date | null> = {}, earn = earner(feats);
  let run = 0;
  const partnersWonWith = new Set<number>(), beaten = new Set<number>();
  if (list[0]?.won) earn("doublesDebut", list[0].playedAt);
  for (const r of list) {
    if (r.won) {
      run++; if (run >= 5) earn("inSync", r.playedAt);
      const team = mineTeams.find(t => t.id === r.teamId)!; team.players.filter(p => p !== ctx.playerId).forEach(p => partnersWonWith.add(p));
      r.opponentTeamIds.forEach(o => beaten.add(o));
      if (r.stake >= 20) earn("safePair", r.playedAt);
      if (r.kind === "COMBINED_SOLO") earn("loneWolf", r.playedAt);
    } else run = 0;
  }
  const seasons = new Map<number, Record<string, number>>();
  for (const t of mineTeams) {
    const wins = list.filter(r => r.teamId === t.id && r.won).length;
    seasons.set(t.seasonId, { seasonTeamWins: wins });
    if (ctx.finishedSeasons.has(t.seasonId)) {
      const table = ctx.teams.filter(x => x.seasonId === t.seasonId).sort((a, b) => b.points - a.points || b.wins - a.wins);
      const last = list.filter(r => r.teamId === t.id).at(-1)?.playedAt ?? new Date();
      if (table[0]?.id === t.id && t.wins > 0) earn("topPair", last);
      if (table.slice(0, 3).some(x => x.id === t.id) && t.wins > 0) earn("neverSplit", last);
      if (table[0]?.id === t.id && t.wins > 0 && t.losses === 0) earn("inseparable", last);
    }
    if (t.players.length >= 3) earn("threesCompany", list.find(r => r.teamId === t.id)?.playedAt);
  }
  // reunited: drawn with the same partner in two different seasons
  const seen = new Map<number, number>();
  for (const t of [...mineTeams].sort((a, b) => a.seasonId - b.seasonId)) for (const p of t.players) { if (p === ctx.playerId) continue;
    const first = seen.get(p); if (first !== undefined && first !== t.seasonId) earn("reunited", list.find(r => r.teamId === t.id)?.playedAt); else if (first === undefined) seen.set(p, t.seasonId); }
  return { metrics: { teamWins: list.filter(r => r.won).length, teamMatches: list.length, partnersWonWith: partnersWonWith.size, teamsBeaten: beaten.size,
    teamSeasons: new Set(mineTeams.map(t => t.seasonId)).size }, feats, seasons };
}

// ---------------------------------------------------------------- Shift Wars
export type ShiftResult = { won: boolean; stake: number; playedAt: Date; opponentTeamIds: number[]; kind: "MATCH" | "MULTI" | "COMBINED" };
export type ShiftContext = { departmentId: number | null; results: ShiftResult[]; championMonths: { seasonId: number; at: Date }[]; seasonsOnRota: number;
  /** Finished league seasons and how many weeks each ran, for Full rota. */
  seasonWeeks?: Map<number, number> };

/** Departments are fixed and admin-assigned, so a member is credited with their department's recorded results. */
/** Shift Wars resets with the league season, so its season goals are keyed by league season (seasonOf maps a date to one). */
export function evaluateShiftWars(ctx: ShiftContext, seasonOf: (d: Date) => number | null): AreaFacts {
  const feats: Record<string, Date | null> = {}, earn = earner(feats);
  if (ctx.departmentId === null) return { metrics: {}, feats, seasons: new Map() };
  const list = [...ctx.results].sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime());
  const beaten = new Set<number>(), perDay = new Map<string, number>();
  const months = new Map<number, { matches: number; weeks: Set<string> }>();
  for (const r of list) {
    perDay.set(dayKey(r.playedAt), (perDay.get(dayKey(r.playedAt)) ?? 0) + 1); if ((perDay.get(dayKey(r.playedAt)) ?? 0) >= 3) earn("nightShift", r.playedAt);
    if (r.won) { r.opponentTeamIds.forEach(o => beaten.add(o)); if (r.stake >= 20) earn("bigShift", r.playedAt); if (r.kind === "MULTI") earn("overtime", r.playedAt);
      if (londonParts(r.playedAt).wd === "Fri") earn("fridayFeeling", r.playedAt); }
    const mk = seasonOf(r.playedAt);
    if (mk === null) continue;
    const m = months.get(mk) ?? { matches: 0, weeks: new Set<string>() };
    m.matches++; const wk = new Date(r.playedAt); wk.setUTCDate(wk.getUTCDate() - ((wk.getUTCDay() + 6) % 7)); m.weeks.add(dayKey(wk)); months.set(mk, m);
  }
  for (const c of ctx.championMonths) earn("employeeOfMonth", c.at);
  const seasons = new Map<number, Record<string, number>>();
  for (const [mk, m] of months) { seasons.set(mk, { monthMatches: m.matches, monthWeeks: m.weeks.size });
    const need = ctx.seasonWeeks?.get(mk); if (need && m.weeks.size >= need) earn("fullRota", list.filter(r => seasonOf(r.playedAt) === mk).at(-1)?.playedAt); }
  return { metrics: { deptWins: list.filter(r => r.won).length, deptMatches: list.length, deptsBeaten: beaten.size, seasonsOnRota: ctx.seasonsOnRota }, feats, seasons };
}

// ---------------------------------------------------------------- Practice and Shadow Bot
export type PracticeSession = { gameTypeKey: string; darts: number; score: number; s180: number; checkoutAttempts: number; checkoutHits: number; won: boolean | null; createdAt: Date };
/** The Shadow Bot's level from practice averages (same thresholds as shadow-bot-achievements.ts botLevelIndex). */
export const shadowLevel = (darts: number, score: number) => {
  if (darts < 150) return 0; const avg = (score / darts) * 3;
  return avg >= 108 ? 5 : avg >= 95 ? 4 : avg >= 80 ? 3 : avg >= 62 ? 2 : avg >= 45 ? 1 : 0;
};
/** seasonDays: finished league seasons and how many calendar days each ran (for Iron discipline). */
export function evaluatePractice(sessions: PracticeSession[], seasonOf: (d: Date) => number | null, seasonDays?: Map<number, number>): AreaFacts {
  const list = [...sessions].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const feats: Record<string, Date | null> = {}, earn = earner(feats);
  let darts = 0, score = 0, s180 = 0, hits = 0;
  const days = new Set<string>(), games = new Set<string>();
  const seasons = new Map<number, { days: Set<string>; s180: number; att: number; hits: number }>();
  const gamesByDay = new Map<string, Set<string>>(), weekend = new Map<string, Set<string>>();
  for (const s of list) {
    darts += s.darts; score += s.score; s180 += s.s180; hits += s.checkoutHits;
    days.add(dayKey(s.createdAt)); games.add(s.gameTypeKey);
    if (s.darts >= 300) earn("longSession", s.createdAt);
    const t = londonParts(s.createdAt);
    if (t.h >= 4 && t.h < 8) earn("earlyBird", s.createdAt);
    if (t.h < 4) earn("midnightOil", s.createdAt);
    if (t.m === 1 && t.d === 1) earn("newYear", s.createdAt);
    if (s.s180 >= 3) earn("tonUpSession", s.createdAt);
    const gd = gamesByDay.get(t.day) ?? new Set<string>(); gd.add(s.gameTypeKey); gamesByDay.set(t.day, gd); if (gd.size >= 5) earn("varietyPack", s.createdAt);
    if (t.wd === "Sat" || t.wd === "Sun") { const wk = new Date(s.createdAt); wk.setUTCDate(wk.getUTCDate() - ((wk.getUTCDay() + 6) % 7)); const k = dayKey(wk), w = weekend.get(k) ?? new Set<string>(); w.add(t.wd); weekend.set(k, w); if (w.size === 2) earn("weekendGrinder", s.createdAt); }
    const sid = seasonOf(s.createdAt);
    if (sid !== null) { const x = seasons.get(sid) ?? { days: new Set<string>(), s180: 0, att: 0, hits: 0 }; x.days.add(dayKey(s.createdAt)); x.s180 += s.s180; x.att += s.checkoutAttempts; x.hits += s.checkoutHits; seasons.set(sid, x); }
  }
  // longest run of consecutive practice days
  const sorted = [...days].sort(); let streak = 0, best = 0, prev: number | null = null;
  for (const d of sorted) { const t = Date.parse(d + "T00:00:00Z") / 86400000; streak = prev !== null && t - prev === 1 ? streak + 1 : 1; best = Math.max(best, streak); prev = t; }
  // checkout rate over the most recent 100 darts at a double
  let att = 0, h = 0; for (const s of [...list].reverse()) { att += s.checkoutAttempts; h += s.checkoutHits; if (att >= 100) break; }
  for (const [sid, x] of seasons) { const need = seasonDays?.get(sid); if (need && x.days.size >= need) earn("ironDiscipline", list.filter(s => seasonOf(s.createdAt) === sid).at(-1)?.createdAt); }
  const seasonRows = new Map<number, Record<string, number>>();
  const ordered = [...seasons].sort((a, b) => a[0] - b[0]);
  ordered.forEach(([sid, x], i) => {
    const prevRate = i > 0 && ordered[i - 1][1].att >= 30 ? ordered[i - 1][1].hits / ordered[i - 1][1].att : null;
    const rate = x.att >= 30 ? x.hits / x.att : null;
    seasonRows.set(sid, { seasonPracticeDays: x.days.size, seasonPractice180s: x.s180, seasonRateUp: prevRate !== null && rate !== null && rate > prevRate ? 1 : 0 });
  });
  return { metrics: { practiceSessions: list.length, practiceDarts: darts, practice180s: s180, practiceCheckouts: hits,
    practiceCheckoutRate: att >= 100 ? Math.floor((h / att) * 100) : 0, practiceGames: games.size, practiceDays: days.size, practiceStreak: best,
    shadowLevel: shadowLevel(darts, score) }, feats, seasons: seasonRows };
}

// ---------------------------------------------------------------- Master-501
export type M501Run = { tier: number; round: number; legsFormat: number; legsWon: number; legsLost: number; result: string | null; completedAt: Date | null };
export function evaluateMaster501(runs: M501Run[]): AreaFacts {
  const done = runs.filter(r => r.result).sort((a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0));
  const feats: Record<string, Date | null> = {}, earn = earner(feats);
  let ladder = 0;
  for (const r of done) {
    const at = r.completedAt ?? new Date();
    if (r.result === "win") {
      ladder = Math.max(ladder, (r.tier - 1) * 3 + r.round);
      if (r.legsLost === 0 && r.legsFormat === 5) earn("flawless", at);
      if (r.legsWon + r.legsLost === r.legsFormat && r.legsLost > 0) earn("lastGasp", at);
      if (r.tier === 5 && r.round === 3) earn("worldChampion", at);
    }
  }
  // speed run: three ladder rounds won in one day; tier jumper: two tiers cleared within a week
  const winsByDay = new Map<string, number>(), cleared: Date[] = [];
  for (const r of done) { if (r.result !== "win" || !r.completedAt) continue;
    const k = londonParts(r.completedAt).day; winsByDay.set(k, (winsByDay.get(k) ?? 0) + 1); if ((winsByDay.get(k) ?? 0) >= 3) earn("speedRun", r.completedAt);
    if (r.round === 3) { cleared.push(r.completedAt); if (cleared.length >= 2 && r.completedAt.getTime() - cleared[cleared.length - 2].getTime() <= 7 * 86400000) earn("tierJumper", r.completedAt); } }
  for (let tier = 1; tier <= 5; tier++) {
    const inTier = done.filter(r => r.tier === tier);
    if ([1, 2, 3].every(round => inTier.some(r => r.round === round && r.result === "win")) && inTier.every(r => r.result === "win")) earn("cleanTier", inTier.at(-1)?.completedAt ?? new Date());
  }
  return { metrics: { m501Ladder: Math.min(15, ladder), m501Runs: done.length, m501Wins: done.filter(r => r.result === "win").length, m501Run: bestRunOf(done.map(r => r.result === "win")) },
    feats, seasons: new Map() };
}

// ---------------------------------------------------------------- Board Curse and Boss Battle
export type BoardCurseRecord = { format: string; wins: number; losses: number };
export type BoardCurseBest = { bestVisits: number | null; bestStreak: number | null };
export type BossStat = { bossId: string; attempts: number; wins: number; cleanSweep: boolean; highestAscension: number };
/** These modes keep totals only (no per-match dates), so feats found in history are credited at `now`. */
export function evaluateModes(records: BoardCurseRecord[], best: BoardCurseBest[], bosses: BossStat[], now: Date): AreaFacts {
  const feats: Record<string, Date | null> = {}, earn = earner(feats);
  if (best.some(b => b.bestVisits !== null && b.bestVisits <= 12)) earn("quickClear", now);
  const formatsWon = new Set(records.filter(r => r.wins > 0).map(r => r.format.toLowerCase()));
  if ([...formatsWon].some(f => f.includes("bot")) && [...formatsWon].some(f => !f.includes("bot"))) earn("bothSides", now);
  for (const b of bosses) {
    if (b.wins > 0 && b.attempts === b.wins) earn("firstTime", now);
    if (b.wins > 0 && b.attempts - b.wins >= 4) earn("neverGaveUp", now);
    if (b.cleanSweep) earn("bossCleanSweep", now);
  }
  // the whole ladder at the top ascension
  if (bosses.filter(b => b.wins > 0 && b.highestAscension >= 2).length >= 6) earn("bossSlayer", now);
  return { metrics: { bcWins: records.reduce((n, r) => n + r.wins, 0), bcStreak: Math.max(0, ...best.map(b => b.bestStreak ?? 0)),
    bossesDefeated: bosses.filter(b => b.wins > 0).length, bossAscension: Math.max(0, ...bosses.map(b => b.highestAscension)) }, feats, seasons: new Map() };
}
