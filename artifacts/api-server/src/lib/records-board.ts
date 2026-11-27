/**
 * The League Records page: every record worked out live from real results and scorer data, with the top 3
 * for each, recent record breaks, and who's close to a record right now. Read-only; nothing here is stored.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { winRuns } from "./league-records";
import { recentRecords } from "./league-records-db";

export type Entry = { playerId: number | null; name: string; value: number; date: string | null; matchKey: string | null; detail: string | null };
export type BoardRecord = { key: string; group: "oche" | "results" | "teams"; label: string; unit: string; better: "low" | "high"; scorer?: boolean; note?: string; entries: Entry[] };

const SINGLES = sql`m.game_type NOT LIKE 'team_%' AND m.game_type <> 'multi_killer'`;

async function q(query: ReturnType<typeof sql>): Promise<any[]> {
  try { return (await db.execute(query)).rows as any[]; } catch { return []; } // a table this database doesn't have yet = no entries
}

/** Best value per holder, top 3 holders, with ties going to whoever got there first. */
function top3(rows: any[], better: "low" | "high", holder = (r: any) => String(r.player_id ?? r.name)): any[] {
  const sorted = [...rows].sort((a, b) => (better === "low" ? Number(a.value) - Number(b.value) : Number(b.value) - Number(a.value))
    || String(a.date ?? "").localeCompare(String(b.date ?? "")));
  const seen = new Set<string>(), out: any[] = [];
  for (const r of sorted) { const k = holder(r); if (seen.has(k)) continue; seen.add(k); out.push(r); if (out.length === 3) break; }
  return out;
}

const entry = (r: any, detail: string | null = null): Entry => ({
  playerId: r.player_id != null ? Number(r.player_id) : null, name: String(r.name), value: Number(r.value),
  date: r.date ? new Date(r.date).toISOString() : null, matchKey: r.match_id != null ? `league-${r.match_id}` : r.match_key ?? null, detail: detail ?? r.detail ?? null,
});

const monthLabel = (d: string) => new Date(`${d}-01T12:00:00Z`).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export async function buildRecordsBoard() {
  const records: BoardRecord[] = [];
  const add = (r: Omit<BoardRecord, "entries">, entries: Entry[]) => { if (entries.length) records.push({ ...r, entries }); };

  // ── On the oche (scorer data) ──
  for (const [key, start] of [["fewest_darts_501", "501"], ["fewest_darts_301", "301"]] as const) {
    const rows = await q(sql`SELECT m.id match_id, m.winner_id player_id, m.winner_name name, m.winner_darts value, m.played_at date, m.loser_name opp FROM matches m
      WHERE ${SINGLES} AND m.game_type ~* ${`^${start}(_double_out)?$`} AND m.winner_darts >= 9`);
    add({ key, group: "oche", label: `Fewest darts to win a ${start}`, unit: "darts", better: "low", scorer: true },
      top3(rows, "low").map(r => entry(r, `v ${r.opp}`)));
  }
  {
    const rows = await q(sql`SELECT m.id match_id, m.winner_id player_id, m.winner_name name, m.winner_180s value, m.played_at date, m.loser_name opp FROM matches m WHERE ${SINGLES} AND m.winner_180s > 0
      UNION ALL SELECT m.id, m.loser_id, m.loser_name, m.loser_180s, m.played_at, m.winner_name FROM matches m WHERE ${SINGLES} AND m.loser_180s > 0`);
    add({ key: "most_180s_match", group: "oche", label: "Most 180s in a match", unit: "180s", better: "high", scorer: true },
      top3(rows, "high").map(r => entry(r, `v ${r.opp}`)));
  }
  {
    const rows = await q(sql`SELECT x.player_id, MAX(x.name) name, x.season_id, MAX(s.name) season, SUM(x.n)::int value, MAX(x.date) date FROM (
        SELECT m.winner_id player_id, m.winner_name name, m.season_id, COALESCE(m.winner_180s,0) n, m.played_at date FROM matches m WHERE ${SINGLES}
        UNION ALL SELECT m.loser_id, m.loser_name, m.season_id, COALESCE(m.loser_180s,0), m.played_at FROM matches m WHERE ${SINGLES}) x
      LEFT JOIN seasons s ON s.id = x.season_id GROUP BY x.player_id, x.season_id HAVING SUM(x.n) > 0`);
    add({ key: "most_180s_season", group: "oche", label: "Most 180s in a season", unit: "180s", better: "high", scorer: true },
      top3(rows, "high").map(r => entry({ ...r, match_id: null }, r.season ?? null)));
  }
  {
    // The winning visit of a match played on the scorer: the last 1-3 darts of the winner's log.
    const rows = await q(sql`SELECT m.id match_id, m.winner_id player_id, m.winner_name name, m.played_at date, m.loser_name opp, l.winner_darts log
      FROM match_dart_logs l JOIN matches m ON m.id = l.match_id WHERE ${SINGLES} AND jsonb_array_length(l.winner_darts) > 0`);
    const outs = rows.flatMap(r => {
      const log = (r.log as { val: number }[]) ?? [];
      const last = log.slice(-(((log.length - 1) % 3) + 1));
      const value = last.reduce((n, d) => n + Number(d.val || 0), 0);
      return value >= 2 && value <= 170 ? [{ ...r, value }] : [];
    });
    add({ key: "highest_checkout", group: "oche", label: "Highest match-winning checkout", unit: "", better: "high", scorer: true },
      top3(outs, "high").map(r => entry(r, `v ${r.opp}`)));
  }
  {
    const rows = await q(sql`SELECT x.player_id, MAX(x.name) name, x.mon, SUM(x.h)::int hits, SUM(x.a)::int att, MAX(x.date) date FROM (
        SELECT m.winner_id player_id, m.winner_name name, to_char(m.played_at AT TIME ZONE 'Europe/London', 'YYYY-MM') mon, COALESCE(m.winner_checkout_hits,0) h, COALESCE(m.winner_checkout_attempts,0) a, m.played_at date FROM matches m WHERE ${SINGLES}
        UNION ALL SELECT m.loser_id, m.loser_name, to_char(m.played_at AT TIME ZONE 'Europe/London', 'YYYY-MM'), COALESCE(m.loser_checkout_hits,0), COALESCE(m.loser_checkout_attempts,0), m.played_at FROM matches m WHERE ${SINGLES}
        UNION ALL SELECT t.player_id, p.name, to_char(t.played_at AT TIME ZONE 'Europe/London', 'YYYY-MM'), t.checkout_hits, t.checkout_attempts, t.played_at FROM team_thrower_stats t JOIN players p ON p.id = t.player_id) x
      GROUP BY x.player_id, x.mon HAVING SUM(x.a) >= 15`);
    add({ key: "best_checkout_month", group: "oche", label: "Best checkout % in a month", unit: "%", better: "high", scorer: true, note: "At least 15 darts at a double that month." },
      top3(rows.map(r => ({ ...r, value: Math.round((Number(r.hits) / Number(r.att)) * 1000) / 10 })), "high").map(r => entry(r, `${monthLabel(r.mon)} · ${r.hits}/${r.att}`)));
  }

  // ── Results ──
  const results = await q(sql`SELECT m.id, m.winner_id, m.loser_id, m.winner_name, m.loser_name, m.played_at FROM matches m WHERE ${SINGLES} ORDER BY m.played_at, m.id`);
  const names = new Map<number, string>();
  for (const r of results) { names.set(Number(r.winner_id), r.winner_name); names.set(Number(r.loser_id), r.loser_name); }
  const runs = winRuns(results.map(r => ({ winnerId: Number(r.winner_id), loserId: Number(r.loser_id) })));
  // When each player's longest run ended (or reached its length), for the date.
  const runDates = new Map<number, string>();
  { const cur = new Map<number, number>(); for (const r of results) { const w = Number(r.winner_id); const n = (cur.get(w) ?? 0) + 1; cur.set(w, n); cur.set(Number(r.loser_id), 0); if (n === runs.longest.get(w)) runDates.set(w, r.played_at); } }
  const runRows = [...runs.longest].map(([id, value]) => ({ player_id: id, name: names.get(id) ?? "?", value, date: runDates.get(id) ?? null }));
  add({ key: "win_streak", group: "results", label: "Longest winning run", unit: "wins in a row", better: "high" }, top3(runRows, "high").map(r => entry(r)));
  {
    const rows = await q(sql`SELECT player_id, MAX(player_name) name, dday, COUNT(*)::int value, MIN(at) date FROM (
        SELECT m.winner_id player_id, m.winner_name player_name, (m.played_at AT TIME ZONE 'Europe/London')::date dday, m.played_at at FROM matches m WHERE ${SINGLES}
        UNION ALL SELECT mp.player_id, mp.player_name, (m.played_at AT TIME ZONE 'Europe/London')::date, m.played_at FROM match_participants mp JOIN matches m ON m.id = mp.match_id WHERE mp.team = 'winner') x
      GROUP BY player_id, dday`);
    add({ key: "wins_night", group: "results", label: "Most wins in one day", unit: "wins", better: "high" },
      top3(rows, "high").map(r => entry(r, new Date(r.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }))));
  }
  {
    const rows = await q(sql`SELECT m.id match_id, m.winner_id player_id, m.winner_name name, m.elo_change value, m.played_at date, m.loser_name opp FROM matches m WHERE ${SINGLES} AND m.elo_change > 0`);
    add({ key: "biggest_upset", group: "results", label: "Biggest upset", unit: "Elo", better: "high", note: "The most Elo won in a single match: the bigger the gap, the bigger the shock." },
      top3(rows, "high").map(r => entry(r, `beat ${r.opp}`)));
  }
  {
    const rows = await q(sql`SELECT m.id match_id, m.winner_id player_id, m.winner_name name, m.stake value, m.played_at date, m.loser_name opp FROM matches m WHERE ${SINGLES} AND m.stake > 0`);
    add({ key: "biggest_wager", group: "results", label: "Biggest wager won", unit: "pts", better: "high" }, top3(rows, "high").map(r => entry(r, `beat ${r.opp}`)));
  }
  {
    const rows = await q(sql`SELECT m.winner_id player_id, MAX(m.winner_name) name, m.season_id, MAX(s.name) season, COUNT(*)::int value, MAX(m.played_at) date
      FROM matches m LEFT JOIN seasons s ON s.id = m.season_id WHERE ${SINGLES} GROUP BY m.winner_id, m.season_id`);
    add({ key: "most_wins_season", group: "results", label: "Most wins in a season", unit: "wins", better: "high" }, top3(rows, "high").map(r => entry(r, r.season ?? null)));
  }
  {
    const rows = await q(sql`SELECT player_id, MAX(name) name, mon, COUNT(*)::int value, MAX(at) date FROM (
        SELECT m.winner_id player_id, m.winner_name name, to_char(m.played_at AT TIME ZONE 'Europe/London', 'YYYY-MM') mon, m.played_at at FROM matches m WHERE ${SINGLES}
        UNION ALL SELECT m.loser_id, m.loser_name, to_char(m.played_at AT TIME ZONE 'Europe/London', 'YYYY-MM'), m.played_at FROM matches m WHERE ${SINGLES}
        UNION ALL SELECT mp.player_id, mp.player_name, to_char(m.played_at AT TIME ZONE 'Europe/London', 'YYYY-MM'), m.played_at FROM match_participants mp JOIN matches m ON m.id = mp.match_id) x
      GROUP BY player_id, mon`);
    add({ key: "most_matches_month", group: "results", label: "Most matches in a month", unit: "matches", better: "high" }, top3(rows, "high").map(r => entry(r, monthLabel(r.mon))));
  }

  // ── Teams ──
  {
    const rows = await q(sql`SELECT t.team_name name, d.season_id, MAX(s.name) season, COUNT(*)::int value, MAX(d.played_at) date
      FROM doubles_matches d JOIN doubles_teams t ON t.id = d.winner_team_id LEFT JOIN seasons s ON s.id = d.season_id GROUP BY t.team_name, d.season_id`);
    add({ key: "doubles_wins_season", group: "teams", label: "Doubles: most wins in a season", unit: "wins", better: "high" },
      top3(rows, "high", r => String(r.name)).map(r => entry({ ...r, player_id: null }, r.season ?? null)));
  }
  {
    const rows = await q(sql`SELECT d.id, t.team_name name, d.stake value, d.played_at date, l.team_name opp FROM doubles_matches d JOIN doubles_teams t ON t.id = d.winner_team_id JOIN doubles_teams l ON l.id = d.loser_team_id WHERE d.stake > 0`);
    add({ key: "doubles_wager", group: "teams", label: "Doubles: biggest wager won", unit: "pts", better: "high" },
      top3(rows, "high", r => String(r.name)).map(r => entry({ ...r, player_id: null, match_key: `doubles-${r.id}` }, `beat ${r.opp}`)));
  }
  {
    const rows = await q(sql`SELECT w.name, sw.season_id, MAX(s.name) season, COUNT(*)::int value, MAX(sw.played_at) date
      FROM shift_wars_matches sw JOIN shift_wars_teams w ON w.id = sw.winner_team_id LEFT JOIN seasons s ON s.id = sw.season_id GROUP BY w.name, sw.season_id`);
    add({ key: "shift_wins_season", group: "teams", label: "Shift Wars: most wins in a season", unit: "wins", better: "high" },
      top3(rows, "high", r => String(r.name)).map(r => entry({ ...r, player_id: null }, r.season ?? null)));
  }
  {
    const rows = await q(sql`SELECT t.player_id, MAX(p.name) name, SUM(t.one_eighties)::int value, MAX(t.played_at) date FROM team_thrower_stats t JOIN players p ON p.id = t.player_id GROUP BY t.player_id HAVING SUM(t.one_eighties) > 0`);
    add({ key: "team_180s", group: "teams", label: "Most 180s in team matches", unit: "180s", better: "high", scorer: true }, top3(rows, "high").map(r => entry(r)));
  }

  // ── Record watch: live runs close to the record ──
  const watch: { playerId: number; name: string; label: string; current: number; record: number; holder: string }[] = [];
  const best = records.find(r => r.key === "win_streak")?.entries[0];
  if (best) for (const [id, cur] of runs.current) {
    if (cur >= 3 && cur >= best.value - 4 && cur > 0) watch.push({ playerId: id, name: names.get(id) ?? "?", label: "Winning run", current: cur, record: best.value, holder: best.name });
  }
  watch.sort((a, b) => (b.current / b.record) - (a.current / a.record));

  const broken = await recentRecords(120).catch(() => []);
  return { generatedAt: new Date().toISOString(), records, watch: watch.slice(0, 5), broken };
}
