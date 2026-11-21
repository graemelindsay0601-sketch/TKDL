import { sql } from "drizzle-orm";
import { CATALOGUE, type Metal } from "./catalogue.ts";
import { evaluate, catalogueFor, type AchievementState } from "./evaluate.ts";
import { evaluateDoubles, evaluateShiftWars, evaluatePractice, evaluateMaster501, evaluateModes, type DoublesTeam, type DoublesResult, type ShiftResult } from "./areas.ts";
import type { Area } from "./catalogue.ts";
import type { AreaFacts } from "./evaluate.ts";
import { evaluateCareer, type CareerData } from "./career.ts";
import { evaluateLeague, type LeagueContext, type LeagueMatch, type LeagueSeason, type LeagueStanding } from "./league.ts";

export type Exec = { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> };
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
  const seasons: LeagueSeason[] = (await db.execute(sql`SELECT id, start_date, end_date, is_active, champion_id, league_type FROM seasons`)).rows.map(r => ({
    id: num(r.id), startDate: date(r.start_date), endDate: date(r.end_date), isActive: r.is_active === true, championId: opt(r.champion_id),
    leagueType: r.league_type == null ? "singles" : String(r.league_type) }));
  const standings: LeagueStanding[] = (await db.execute(sql`SELECT season_id, player_id, position, wins, losses, points, is_champion FROM season_standings`)).rows.map(r => ({
    seasonId: num(r.season_id), playerId: num(r.player_id), position: num(r.position), wins: num(r.wins), losses: num(r.losses), points: num(r.points), isChampion: r.is_champion === true }));
  const players = (await db.execute(sql`SELECT id, name, career_peak_elo, eliminations_count, longest_win_streak FROM players`)).rows.map(r => ({
    id: num(r.id), name: String(r.name), careerPeakElo: num(r.career_peak_elo), eliminationsCount: num(r.eliminations_count), longestWinStreak: num(r.longest_win_streak) }));
  // Team matches store only each side's captain on the match row; everyone else is in match_participants.
  // The league credits every player on the team (career wins and losses), so each teammate gets their own row too.
  const byId = new Map(matches.map(m => [m.id, m]));
  let partRows: Record<string, unknown>[] = [];
  try { partRows = (await db.execute(sql`SELECT match_id, player_id, team FROM match_participants`)).rows; } catch { partRows = []; }
  for (const r of partRows) {
    const m = byId.get(num(r.match_id)), pid = num(r.player_id); if (!m || pid === m.winnerId || pid === m.loserId) continue;
    const blank = { winner180s: null, loser180s: null, winner140s: null, loser140s: null, winner170s: null, loser170s: null, winner100s: null, loser100s: null,
      winnerDarts: null, loserDarts: null, winnerCheckoutAttempts: null, winnerCheckoutHits: null, loserCheckoutAttempts: null, loserCheckoutHits: null };
    matches.push(r.team === "winner" ? { ...m, ...blank, winnerId: pid, onlyFor: pid } : { ...m, ...blank, loserId: pid, onlyFor: pid });
  }
  matches.sort((a, b) => a.playedAt.getTime() - b.playedAt.getTime() || a.id - b.id);
  const participants = new Map<number, Set<number>>();
  for (const m of matches) { const s = participants.get(m.seasonId) ?? new Set<number>(); s.add(m.winnerId); s.add(m.loserId); participants.set(m.seasonId, s); }
  return { matches, seasons, standings, players, participants };
}

export type PlayerAchievements = { playerId: number; name: string; states: AchievementState[]; score: number };

/** Every player's League achievements as history credit would give them (read only: nothing is saved or awarded). */
export async function leagueHistoryCredit(db: Exec): Promise<PlayerAchievements[]> {
  const data = await loadLeague(db);
  const defs = catalogueFor("LEAGUE");
  // Anyone with a league match, or a place in a season table entered without match rows (the first season).
  return data.players.filter(p => data.matches.some(m => m.winnerId === p.id || m.loserId === p.id)
    || data.standings.some(st => st.playerId === p.id && st.wins + st.losses > 0)).map(p => {
    const ctx: LeagueContext = { matches: data.matches, seasons: data.seasons, standings: data.standings, participants: data.participants, player: p };
    const states = evaluate(defs, evaluateLeague(ctx));
    return { playerId: p.id, name: p.name, states, score: states.reduce((n, s) => n + s.points, 0) };
  });
}

/** Totals for the sign-off report: how many players reach each metal on each track, earn each feat and complete each season goal. */
export function summarise(players: PlayerAchievements[], area: Area = "LEAGUE") {
  const defs = catalogueFor(area);
  const metals: Metal[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
  const tracks = defs.filter(d => d.kind === "TRACK").map(d => {
    const states = players.map(p => p.states.find(s => s.key === d.key)).filter((s): s is Extract<AchievementState, { kind: "TRACK" }> => s?.kind === "TRACK");
    const byMetal = Object.fromEntries(metals.map(m => [m, states.filter(s => s.metal === m).length])) as Record<Metal, number>;
    return { key: d.key, title: d.title, players: states.length, none: states.filter(s => !s.metal).length, ...byMetal };
  });
  const feats = defs.filter(d => d.kind === "FEAT").map(d => ({ key: d.key, title: d.title, earned: players.filter(p => p.states.some(s => s.key === d.key && s.kind === "FEAT" && s.earnedAt)).length,
    liveOnly: d.kind === "FEAT" && !!d.liveOnly }));
  const seasonGoals = defs.filter(d => d.kind === "SEASON").map(d => ({ key: d.key, title: d.title,
    completions: players.reduce((n, p) => { const s = p.states.find(x => x.key === d.key); return n + (s?.kind === "SEASON" ? s.perSeason.filter(x => x.completed > 0).length : 0); }, 0) }));
  const ranked = [...players].sort((a, b) => b.score - a.score).map(p => ({ name: p.name, score: p.score,
    diamonds: p.states.filter(s => s.kind === "TRACK" && s.metal === "DIAMOND").length, feats: p.states.filter(s => s.kind === "FEAT" && s.earnedAt).length }));
  return { players: players.length, tracks, feats, seasonGoals, ranked };
}

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const AREA_NAMES: Record<Area, string> = { LEAGUE: "League", TEAMS: "Doubles and Shift Wars", PRACTICE: "Practice and Shadow Bot", MASTER501: "Master-501", MODES: "Board Curse and Boss Battle", CAREER: "Career" };
const AREA_NOTES: Partial<Record<Area, string>> = {
  TEAMS: "Shift Wars never recorded who played, so a department's results count for everyone in it now.",
  MODES: "These modes only keep totals, so feats found in history would be dated at launch.",
  CAREER: "Counted across all of a player's saves. Darts feats (180s, checkouts, averages, nine-darters) count live matches only. Hall of Fame has no recorded date, so it is dated at retirement or launch.",
};
/** A plain admin page for the sign-off: no styling dependencies, readable on a phone. One section per area. */
export type RewardCount = { name: string; category: string; earnedBy: string; players: number };
export function reportHtml(reports: AreaReport[] | ReturnType<typeof summarise>, checks?: WinsCheck[], rewards?: RewardCount[]) {
  const list: AreaReport[] = Array.isArray(reports) ? reports : [{ area: "LEAGUE", summary: reports }];
  const table = (head: string[], rows: unknown[][]) => `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const section = ({ area, summary }: AreaReport) => `<section id="${area.toLowerCase()}"><h2>${esc(AREA_NAMES[area])}</h2>
<p>${summary.players} players with activity here.${AREA_NOTES[area] ? " " + esc(AREA_NOTES[area]) : ""}</p>
<h3>Tracks</h3>${table(["Track", "None", "Bronze", "Silver", "Gold", "Platinum", "Diamond"], summary.tracks.map(t => [t.title, t.none, t.BRONZE, t.SILVER, t.GOLD, t.PLATINUM, t.DIAMOND]))}
<h3>Feats</h3>${table(["Feat", "Players who'd have it"], summary.feats.map(f => [f.title + (f.liveOnly ? " (from launch only)" : ""), f.earned]))}
${summary.seasonGoals.length ? `<h3>Season goals</h3>${table(["Goal", "Seasons completed (all players)"], summary.seasonGoals.map(s => [s.title, s.completions]))}` : ""}
<h3>Players by score</h3>${table(["Player", "Score", "Diamonds", "Feats"], summary.ranked.map(r => [r.name, r.score, r.diamonds, r.feats]))}</section>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Achievements v2: history credit report</title>
<style>body{font:14px/1.45 system-ui,sans-serif;margin:24px;color:#111;background:#fafafa}h1{font-size:22px}h2{font-size:19px;margin-top:36px;border-top:2px solid #ddd;padding-top:16px}h3{font-size:15px;margin-top:20px}table{border-collapse:collapse;background:#fff;margin:8px 0;min-width:min(100%,640px)}th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}th{background:#f0f0f0}td:not(:first-child){text-align:right}p{max-width:720px}nav a{margin-right:12px}</style></head><body>
<h1>Achievements v2: what history credit would give</h1>
<p>Read only. Nothing has been saved or awarded. Each track row counts players at their current metal.</p>
<nav>${list.map(r => `<a href="#${r.area.toLowerCase()}">${esc(AREA_NAMES[r.area])}</a>`).join("")}</nav>
${checks ? `<section id="checks"><h2>Check: league wins against the Hall of Fame</h2>
<p>${checks.length ? `${checks.length} players' league wins here differ from the career win total on the Hall of Fame. Any gap is usually wins from before match records were kept, or matches since deleted.` : "Every player's league wins match the Hall of Fame."}</p>
${checks.length ? table(["Player", "Achievements", "Hall of Fame", "Difference"], checks.map(c => [c.name, c.achievements, c.hallOfFame, c.hallOfFame - c.achievements])) : ""}</section>` : ""}
${rewards ? `<section id="cosmetics"><h2>Cosmetics earned from achievements</h2>
<p>Award-only cosmetics (never sold in the shop). Granted automatically on each sync once the system is on, history included.</p>
${table(["Cosmetic", "Type", "Earned by", "Players who'd get it"], rewards.map(r => [r.name, r.category, r.earnedBy, r.players]))}</section>` : ""}
${list.map(section).join("\n")}
</body></html>`;
}

// ---------------------------------------------------------------- every other area

const ts = (v: unknown) => new Date(String(v));
const group = <T,>(rows: T[], key: (r: T) => number) => { const m = new Map<number, T[]>(); for (const r of rows) { const k = key(r); m.set(k, [...(m.get(k) ?? []), r]); } return m; };
const mergeFacts = (a: AreaFacts, b: AreaFacts): AreaFacts => {
  const seasons = new Map(a.seasons);
  for (const [k, v] of b.seasons) seasons.set(k, { ...(seasons.get(k) ?? {}), ...v });
  return { metrics: { ...a.metrics, ...b.metrics }, feats: { ...a.feats, ...b.feats }, seasons };
};

/** Maps a date to the league season it falls in (start inclusive; the active season runs on with no end). */
export function seasonFinder(seasons: { id: number; startDate: Date | null; endDate: Date | null; isActive: boolean }[]) {
  const list = seasons.filter(s => s.startDate).sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());
  return (d: Date) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const s = list[i];
      if (d >= s.startDate! && (s.isActive || !s.endDate || d <= s.endDate)) return s.id;
    }
    return null;
  };
}

/** How many Monday-start weeks each finished season touched (Full rota needs a match in every one). */
export function seasonWeeks(seasons: { id: number; startDate: Date | null; endDate: Date | null; isActive: boolean }[]) {
  const out = new Map<number, number>();
  for (const s of seasons) { if (s.isActive || !s.startDate || !s.endDate) continue;
    const monday = (d: Date) => { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.getTime(); };
    out.set(s.id, Math.round((monday(s.endDate) - monday(s.startDate)) / (7 * 86400000)) + 1); }
  return out;
}
/** How many calendar days each finished season ran (inclusive). */
export function seasonDays(seasons: { id: number; startDate: Date | null; endDate: Date | null; isActive: boolean }[]) {
  const out = new Map<number, number>(), day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  for (const s of seasons) if (!s.isActive && s.startDate && s.endDate) out.set(s.id, Math.round((day(s.endDate) - day(s.startDate)) / 86400000) + 1);
  return out;
}
/** The first Shift Wars match of each season and the departments in it. */
function shiftFirsts(data: AreaData, seasonOf: (d: Date) => number | null) {
  const firsts = new Map<number, { at: Date; teams: Set<number> }>();
  for (const [team, results] of data.shift) for (const r of results) { const sid = seasonOf(r.playedAt); if (sid === null) continue;
    const f = firsts.get(sid);
    if (!f || r.playedAt < f.at) firsts.set(sid, { at: r.playedAt, teams: new Set([team]) }); else if (r.playedAt.getTime() === f.at.getTime()) f.teams.add(team); }
  return firsts;
}
export type AreaData = Awaited<ReturnType<typeof loadAreas>>;
/** Every row the non-league evaluators need, for every player (an admin report; these tables are small). */
export async function loadAreas(db: Exec) {
  const q = async (s: ReturnType<typeof sql>) => (await db.execute(s)).rows;
  const seasons = (await q(sql`SELECT id, start_date, end_date, is_active FROM seasons`)).map(r => ({ id: num(r.id), startDate: date(r.start_date), endDate: date(r.end_date), isActive: r.is_active === true }));
  const finished = new Set(seasons.filter(s => !s.isActive).map(s => s.id));
  const players = (await q(sql`SELECT id, name, shift_wars_team_id FROM players`)).map(r => ({ id: num(r.id), name: String(r.name), department: opt(r.shift_wars_team_id) }));

  // Doubles: one row per team per result, whatever the format
  const teams: DoublesTeam[] = (await q(sql`SELECT * FROM doubles_teams`)).map(r => ({ id: num(r.id), seasonId: num(r.season_id),
    players: [r.player1_id, r.player2_id, r.player3_id].filter(p => p !== null && p !== undefined).map(Number), points: num(r.points), wins: num(r.wins), losses: num(r.losses), isEliminated: r.is_eliminated === true }));
  const doubles: DoublesResult[] = [];
  for (const r of await q(sql`SELECT * FROM doubles_matches`)) {
    const base = { stake: num(r.stake), playedAt: ts(r.played_at), kind: "MATCH" as const, seasonId: opt(r.season_id) };
    doubles.push({ ...base, teamId: num(r.winner_team_id), opponentTeamIds: [num(r.loser_team_id)], won: true });
    doubles.push({ ...base, teamId: num(r.loser_team_id), opponentTeamIds: [num(r.winner_team_id)], won: false });
  }
  const dSides = group(await q(sql`SELECT match_id, team_id FROM doubles_combined_match_sides`), r => num(r.match_id));
  for (const r of await q(sql`SELECT * FROM doubles_combined_matches`)) {
    const sides = (dSides.get(num(r.id)) ?? []).map(s => num(s.team_id)), solo = num(r.solo_team_id), soloWon = r.solo_won === true;
    const base = { stake: num(r.stake), playedAt: ts(r.played_at), seasonId: opt(r.season_id) };
    doubles.push({ ...base, teamId: solo, opponentTeamIds: sides, won: soloWon, kind: "COMBINED_SOLO" });
    for (const t of sides) doubles.push({ ...base, teamId: t, opponentTeamIds: [solo], won: !soloWon, kind: "COMBINED_SIDE" });
  }
  const dParts = group(await q(sql`SELECT match_id, team_id, is_winner FROM doubles_multi_match_participants`), r => num(r.match_id));
  for (const r of await q(sql`SELECT * FROM doubles_multi_matches`)) {
    const parts = dParts.get(num(r.id)) ?? [];
    for (const p of parts) doubles.push({ stake: num(r.stake), playedAt: ts(r.played_at), seasonId: opt(r.season_id), kind: "MULTI", teamId: num(p.team_id),
      won: p.is_winner === true, opponentTeamIds: parts.filter(o => o !== p).map(o => num(o.team_id)) });
  }

  // Shift Wars: results per department
  const shift = new Map<number, ShiftResult[]>();
  const addShift = (team: number, r: ShiftResult) => shift.set(team, [...(shift.get(team) ?? []), r]);
  for (const r of await q(sql`SELECT * FROM shift_wars_matches`)) {
    addShift(num(r.winner_team_id), { won: true, stake: num(r.stake), playedAt: ts(r.played_at), opponentTeamIds: [num(r.loser_team_id)], kind: "MATCH" });
    addShift(num(r.loser_team_id), { won: false, stake: num(r.stake), playedAt: ts(r.played_at), opponentTeamIds: [num(r.winner_team_id)], kind: "MATCH" });
  }
  const sParts = group(await q(sql`SELECT match_id, team_id, is_winner FROM shift_wars_multi_match_participants`), r => num(r.match_id));
  for (const r of await q(sql`SELECT * FROM shift_wars_multi_matches`)) {
    const parts = sParts.get(num(r.id)) ?? [];
    for (const p of parts) addShift(num(p.team_id), { won: p.is_winner === true, stake: num(r.stake), playedAt: ts(r.played_at), kind: "MULTI", opponentTeamIds: parts.filter(o => o !== p).map(o => num(o.team_id)) });
  }
  const sSides = group(await q(sql`SELECT match_id, team_id FROM shift_wars_combined_match_sides`), r => num(r.match_id));
  for (const r of await q(sql`SELECT * FROM shift_wars_combined_matches`)) {
    const sides = (sSides.get(num(r.id)) ?? []).map(s => num(s.team_id)), solo = num(r.solo_team_id), soloWon = r.solo_won === true;
    addShift(solo, { won: soloWon, stake: num(r.stake), playedAt: ts(r.played_at), opponentTeamIds: sides, kind: "COMBINED" });
    for (const t of sides) addShift(t, { won: !soloWon, stake: num(r.stake), playedAt: ts(r.played_at), opponentTeamIds: [solo], kind: "COMBINED" });
  }
  const history = await q(sql`SELECT season_id, team_id, is_champion, recorded_at FROM shift_wars_season_history`);

  const practice = group((await q(sql`SELECT player1_id, game_type_key, p1_darts, p1_score, p1_180s, p1_checkout_attempts, p1_checkout_hits, winner_idx, created_at
    FROM practice_sessions WHERE player1_id IS NOT NULL`)).map(r => ({ playerId: num(r.player1_id), gameTypeKey: String(r.game_type_key), darts: num(r.p1_darts), score: num(r.p1_score),
    s180: num(r.p1_180s), checkoutAttempts: num(r.p1_checkout_attempts), checkoutHits: num(r.p1_checkout_hits), won: r.winner_idx === null || r.winner_idx === undefined ? null : num(r.winner_idx) === 0,
    createdAt: ts(r.created_at) })), r => r.playerId);
  const m501 = group((await q(sql`SELECT * FROM master501_runs`)).map(r => ({ playerId: num(r.player_id), tier: num(r.tier), round: num(r.round), legsFormat: num(r.legs_format),
    legsWon: num(r.legs_won), legsLost: num(r.legs_lost), result: r.result ? String(r.result) : null, completedAt: date(r.completed_at) })), r => r.playerId);
  const bcRecords = group((await q(sql`SELECT * FROM board_curse_records`)).map(r => ({ playerId: num(r.player_id), format: String(r.format), wins: num(r.wins), losses: num(r.losses) })), r => r.playerId);
  const bcBest = group((await q(sql`SELECT * FROM board_curse_best`)).map(r => ({ playerId: num(r.player_id), bestVisits: opt(r.best_visits), bestStreak: opt(r.best_streak) })), r => r.playerId);
  const bosses = group((await q(sql`SELECT * FROM boss_battle_stats`)).map(r => ({ playerId: num(r.player_id), bossId: String(r.boss_id), attempts: num(r.attempts), wins: num(r.wins),
    cleanSweep: r.clean_sweep === true, highestAscension: num(r.highest_ascension) })), r => r.playerId);
  return { seasons, finished, players, teams, doubles, shift, history, practice, m501, bcRecords, bcBest, bosses };
}

/** Every player's Career evidence, across all their saves (only the human's own rows). Empty when Career isn't set up. */
export async function loadCareer(db: Exec): Promise<Map<number, CareerData>> {
  const out = new Map<number, CareerData>();
  try {
    const saves = (await db.execute(sql`SELECT id, player_id, status, retired_at FROM career_saves`)).rows;
    if (!saves.length) return out;
    const owner = new Map<string, number>();
    for (const r of saves) {
      owner.set(String(r.id), num(r.player_id));
      const d = out.get(num(r.player_id)) ?? { saves: [], matches: [], results: [], cards: [], bestRank: null, inducted: [] };
      d.saves.push({ id: String(r.id), status: String(r.status), retiredAt: date(r.retired_at) }); out.set(num(r.player_id), d);
    }
    const of = (saveId: unknown) => out.get(owner.get(String(saveId)) ?? -1);
    for (const r of (await db.execute(sql`SELECT m.career_save_id, m.id, m.event_id, m.round, m.slot, m.scheduled_day, m.winner_key, m.completed_at, i.season,
        m.summary->'live'->'facts'->'human' AS live
      FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
      WHERE (m.a_key='HUMAN' OR m.b_key='HUMAN') AND m.status='COMPLETED' AND COALESCE(m.result_source,'') NOT IN ('BYE','WALKOVER')`)).rows) {
      const l = r.live as Record<string, unknown> | null;
      of(r.career_save_id)?.matches.push({ saveId: String(r.career_save_id), id: String(r.id), eventId: String(r.event_id), season: num(r.season), day: num(r.scheduled_day),
        round: num(r.round), slot: num(r.slot), won: r.winner_key === "HUMAN", completedAt: date(r.completed_at),
        live: l && typeof l === "object" ? { average: num(l.average), maximums: num(l.maximums), highestCheckout: num(l.highestCheckout), nineDarters: num(l.nineDarters) } : null });
    }
    for (const r of (await db.execute(sql`SELECT r.career_save_id, r.event_id, r.season, r.is_champion, r.stage_reached, r.recorded_at, i.end_day, i.classification, i.presentation_tier, i.circuit
      FROM career_event_results r JOIN career_event_instances i ON i.career_save_id=r.career_save_id AND i.id=r.event_id
      WHERE r.participant_key='HUMAN' AND i.status='COMPLETED'`)).rows)
      of(r.career_save_id)?.results.push({ saveId: String(r.career_save_id), eventId: String(r.event_id), season: num(r.season), endDay: num(r.end_day),
        champion: r.is_champion === true, final: r.is_champion !== true && r.stage_reached === "FINAL", qualifier: r.classification === "QUALIFIER",
        tier: String(r.presentation_tier ?? ""), circuit: String(r.circuit ?? ""), recordedAt: date(r.recorded_at) });
    for (const r of (await db.execute(sql`SELECT career_save_id, status, source, awarded_season, awarded_week, ended_season, ended_week, created_at
      FROM career_tour_cards WHERE participant_key='HUMAN'`)).rows)
      of(r.career_save_id)?.cards.push({ saveId: String(r.career_save_id), status: String(r.status), source: String(r.source), awardedSeason: num(r.awarded_season),
        awardedWeek: num(r.awarded_week), endedSeason: opt(r.ended_season), endedWeek: opt(r.ended_week), createdAt: date(r.created_at) });
    for (const r of (await db.execute(sql`SELECT career_save_id, MIN(position) AS best FROM career_ranking_snapshot_rows
      WHERE participant_key='HUMAN' AND list_key='pro-world' GROUP BY career_save_id`)).rows) {
      const d = of(r.career_save_id); if (d && opt(r.best)) d.bestRank = d.bestRank === null ? num(r.best) : Math.min(d.bestRank, num(r.best));
    }
    for (const r of (await db.execute(sql`SELECT career_save_id FROM career_legacy_inductions WHERE participant_key='HUMAN'`)).rows) of(r.career_save_id)?.inducted.push(String(r.career_save_id));
  } catch { return new Map(); }
  return out;
}

/** One player's facts for every non-league area (null when they have done nothing there). */
export function areaFacts(data: AreaData, playerId: number, now = new Date()): Partial<Record<Area, AreaFacts>> {
  const player = data.players.find(p => p.id === playerId);
  const seasonOf = seasonFinder(data.seasons);
  const out: Partial<Record<Area, AreaFacts>> = {};
  const doubles = evaluateDoubles({ playerId, teams: data.teams, results: data.doubles, finishedSeasons: data.finished });
  const dept = player?.department ?? null;
  const deptHistory = data.history.filter(h => dept !== null && num(h.team_id) === dept);
  const shiftFacts = evaluateShiftWars({ departmentId: dept, results: dept === null ? [] : data.shift.get(dept) ?? [],
    championMonths: deptHistory.filter(h => h.is_champion === true).map(h => ({ seasonId: num(h.season_id), at: ts(h.recorded_at) })),
    seasonsOnRota: new Set(deptHistory.map(h => num(h.season_id))).size, seasonWeeks: seasonWeeks(data.seasons) }, seasonOf);
  if (dept !== null) for (const [sid, first] of shiftFirsts(data, seasonOf)) if (first.teams.has(dept) && !shiftFacts.feats.clockingIn) { shiftFacts.feats.clockingIn = first.at; void sid; }
  if ((doubles.metrics.teamMatches ?? 0) > 0 || (shiftFacts.metrics.deptMatches ?? 0) > 0) out.TEAMS = mergeFacts(doubles, shiftFacts);
  const practice = data.practice.get(playerId);
  if (practice?.length) out.PRACTICE = evaluatePractice(practice, seasonOf, seasonDays(data.seasons));
  const runs = data.m501.get(playerId);
  if (runs?.length) out.MASTER501 = evaluateMaster501(runs);
  const rec = data.bcRecords.get(playerId) ?? [], best = data.bcBest.get(playerId) ?? [], boss = data.bosses.get(playerId) ?? [];
  if (rec.length || best.length || boss.length) out.MODES = evaluateModes(rec, best, boss, now);
  return out;
}

export type AreaReport = { area: Area; summary: ReturnType<typeof summarise> };
export type AreaPlayers = Record<Area, PlayerAchievements[]>;
/** Every player's achievement states in every area, worked out from the recorded data (read only). */
export async function computeAll(db: Exec, now = new Date()): Promise<AreaPlayers> {
  const out: AreaPlayers = { LEAGUE: await leagueHistoryCredit(db), TEAMS: [], PRACTICE: [], MASTER501: [], MODES: [], CAREER: [] };
  // live-only feats recorded as they happened
  let live: Record<string, unknown>[] = [];
  try { live = (await db.execute(sql`SELECT player_id, feat, at FROM achievement_v2_live`)).rows; } catch { live = []; }
  const data = await loadAreas(db), career = await loadCareer(db);
  for (const p of data.players) {
    const c = career.get(p.id);
    if (c && (c.matches.length || c.results.length || c.cards.length)) {
      const states = evaluate(catalogueFor("CAREER"), evaluateCareer(c, now));
      out.CAREER.push({ playerId: p.id, name: p.name, states, score: states.reduce((n, s) => n + s.points, 0) });
    }
    const facts = areaFacts(data, p.id, now);
    for (const area of ["TEAMS", "PRACTICE", "MASTER501", "MODES"] as const) {
      const f = facts[area]; if (!f) continue;
      const states = evaluate(catalogueFor(area), f);
      out[area].push({ playerId: p.id, name: p.name, states, score: states.reduce((n, s) => n + s.points, 0) });
    }
  }
  for (const r of live) for (const list of Object.values(out)) { const p = list.find(x => x.playerId === Number(r.player_id)); if (!p) continue;
    for (const s of p.states) { const d = CATALOGUE.find(c => c.key === s.key); if (s.kind === "FEAT" && d?.kind === "FEAT" && d.metric === r.feat && !s.earnedAt) { s.earnedAt = new Date(String(r.at)); s.points = d.points; p.score += d.points; } } }
  return out;
}
/** History credit for every area, each summarised on its own (read only). */
export async function allHistoryCredit(db: Exec, precomputed?: AreaPlayers): Promise<AreaReport[]> {
  const all = precomputed ?? await computeAll(db);
  return (Object.keys(all) as (keyof AreaPlayers)[]).map(area => ({ area, summary: summarise(all[area], area) }));
}

export type WinsCheck = { playerId: number; name: string; achievements: number; hallOfFame: number };
/** League wins as the achievements count them, against the career win total the Hall of Fame shows; only players that differ. */
export async function winsCheck(db: Exec): Promise<WinsCheck[]> {
  const league = await leagueHistoryCredit(db);
  const wins = new Map(league.map(p => { const s = p.states.find(x => x.key === "league-wins"); return [p.playerId, s?.kind === "TRACK" ? s.value : 0]; }));
  const rows = (await db.execute(sql`SELECT id, name, career_wins FROM players`)).rows;
  return rows.map(r => ({ playerId: num(r.id), name: String(r.name), achievements: wins.get(num(r.id)) ?? 0, hallOfFame: num(r.career_wins) }))
    .filter(r => r.achievements !== r.hallOfFame).sort((a, b) => Math.abs(b.hallOfFame - b.achievements) - Math.abs(a.hallOfFame - a.achievements));
}
