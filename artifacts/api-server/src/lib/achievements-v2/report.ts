import { sql } from "drizzle-orm";
import { CATALOGUE, type Metal } from "./catalogue.ts";
import { evaluate, catalogueFor, type AchievementState } from "./evaluate.ts";
import { evaluateLeague, type LeagueContext, type LeagueMatch, type LeagueSeason, type LeagueStanding } from "./league.ts";

type Exec = { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> };
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const opt = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const date = (v: unknown) => (v ? new Date(String(v)) : null);

/** Everything the league evaluator needs, for every player at once (an admin report; the league is a few thousand matches). */
export async function loadLeague(db: Exec) {
  const matches: LeagueMatch[] = (await db.execute(sql`SELECT * FROM matches ORDER BY played_at, id`)).rows.map(r => ({
    id: num(r.id), seasonId: num(r.season_id), winnerId: num(r.winner_id), loserId: num(r.loser_id), stake: num(r.stake), eloChange: num(r.elo_change),
    gameType: String(r.game_type ?? "501"), playedAt: new Date(String(r.played_at)),
    winner180s: opt(r.winner_180s), loser180s: opt(r.loser_180s), winner140s: opt(r.winner_140s), loser140s: opt(r.loser_140s),
    winner170s: opt(r.winner_170s), loser170s: opt(r.loser_170s), winner100s: opt(r.winner_100s), loser100s: opt(r.loser_100s),
    winnerDarts: opt(r.winner_darts), loserDarts: opt(r.loser_darts), winnerCheckoutAttempts: opt(r.winner_checkout_attempts), winnerCheckoutHits: opt(r.winner_checkout_hits),
    loserCheckoutAttempts: opt(r.loser_checkout_attempts), loserCheckoutHits: opt(r.loser_checkout_hits) }));
  const seasons: LeagueSeason[] = (await db.execute(sql`SELECT id, start_date, end_date, is_active, champion_id FROM seasons`)).rows.map(r => ({
    id: num(r.id), startDate: date(r.start_date), endDate: date(r.end_date), isActive: r.is_active === true, championId: opt(r.champion_id) }));
  const standings: LeagueStanding[] = (await db.execute(sql`SELECT season_id, player_id, position, wins, losses, points, is_champion FROM season_standings`)).rows.map(r => ({
    seasonId: num(r.season_id), playerId: num(r.player_id), position: num(r.position), wins: num(r.wins), losses: num(r.losses), points: num(r.points), isChampion: r.is_champion === true }));
  const players = (await db.execute(sql`SELECT id, name, career_peak_elo, eliminations_count, longest_win_streak FROM players`)).rows.map(r => ({
    id: num(r.id), name: String(r.name), careerPeakElo: num(r.career_peak_elo), eliminationsCount: num(r.eliminations_count), longestWinStreak: num(r.longest_win_streak) }));
  const participants = new Map<number, Set<number>>();
  for (const m of matches) { const s = participants.get(m.seasonId) ?? new Set<number>(); s.add(m.winnerId); s.add(m.loserId); participants.set(m.seasonId, s); }
  return { matches, seasons, standings, players, participants };
}

export type PlayerAchievements = { playerId: number; name: string; states: AchievementState[]; score: number };

/** Every player's League achievements as history credit would give them (read only: nothing is saved or awarded). */
export async function leagueHistoryCredit(db: Exec): Promise<PlayerAchievements[]> {
  const data = await loadLeague(db);
  const defs = catalogueFor("LEAGUE");
  return data.players.filter(p => data.matches.some(m => m.winnerId === p.id || m.loserId === p.id)).map(p => {
    const ctx: LeagueContext = { matches: data.matches, seasons: data.seasons, standings: data.standings, participants: data.participants, player: p };
    const states = evaluate(defs, evaluateLeague(ctx));
    return { playerId: p.id, name: p.name, states, score: states.reduce((n, s) => n + s.points, 0) };
  });
}

/** Totals for the sign-off report: how many players reach each metal on each track, earn each feat and complete each season goal. */
export function summarise(players: PlayerAchievements[]) {
  const metals: Metal[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
  const tracks = CATALOGUE.filter(d => d.kind === "TRACK").map(d => {
    const states = players.map(p => p.states.find(s => s.key === d.key)).filter((s): s is Extract<AchievementState, { kind: "TRACK" }> => s?.kind === "TRACK");
    const byMetal = Object.fromEntries(metals.map(m => [m, states.filter(s => s.metal === m).length])) as Record<Metal, number>;
    return { key: d.key, title: d.title, players: states.length, none: states.filter(s => !s.metal).length, ...byMetal };
  });
  const feats = CATALOGUE.filter(d => d.kind === "FEAT").map(d => ({ key: d.key, title: d.title, earned: players.filter(p => p.states.some(s => s.key === d.key && s.kind === "FEAT" && s.earnedAt)).length,
    liveOnly: d.kind === "FEAT" && !!d.liveOnly }));
  const seasonGoals = CATALOGUE.filter(d => d.kind === "SEASON").map(d => ({ key: d.key, title: d.title,
    completions: players.reduce((n, p) => { const s = p.states.find(x => x.key === d.key); return n + (s?.kind === "SEASON" ? s.perSeason.filter(x => x.completed > 0).length : 0); }, 0) }));
  const ranked = [...players].sort((a, b) => b.score - a.score).map(p => ({ name: p.name, score: p.score,
    diamonds: p.states.filter(s => s.kind === "TRACK" && s.metal === "DIAMOND").length, feats: p.states.filter(s => s.kind === "FEAT" && s.earnedAt).length }));
  return { players: players.length, tracks, feats, seasonGoals, ranked };
}

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
/** A plain admin page for the sign-off: no styling dependencies, readable on a phone. */
export function reportHtml(summary: ReturnType<typeof summarise>) {
  const table = (head: string[], rows: unknown[][]) => `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Achievements v2: history credit report</title>
<style>body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#111;background:#fafafa}h1{font-size:22px}h2{font-size:17px;margin-top:28px}table{border-collapse:collapse;background:#fff;margin:8px 0;min-width:min(100%,640px)}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}th{background:#f0f0f0}td:not(:first-child){text-align:right}p{max-width:720px}</style></head><body>
<h1>Achievements v2: what history credit would give (League)</h1>
<p>Read only. Nothing has been saved or awarded. ${summary.players} players with league matches. Each row counts players at their current metal on that track.</p>
<h2>Tracks</h2>${table(["Track", "None", "Bronze", "Silver", "Gold", "Platinum", "Diamond"], summary.tracks.map(t => [t.title, t.none, t.BRONZE, t.SILVER, t.GOLD, t.PLATINUM, t.DIAMOND]))}
<h2>Feats</h2>${table(["Feat", "Players who'd have it"], summary.feats.map(f => [f.title + (f.liveOnly ? " (from launch only)" : ""), f.earned]))}
<h2>Season goals</h2>${table(["Goal", "Seasons completed (all players)"], summary.seasonGoals.map(s => [s.title, s.completions]))}
<h2>Players by achievement score</h2>${table(["Player", "Score", "Diamonds", "Feats"], summary.ranked.map(r => [r.name, r.score, r.diamonds, r.feats]))}
</body></html>`;
}
