import { sql } from "drizzle-orm";

export type Competition = "doubles" | "shift_wars";
export type MatchKind = "match" | "combined" | "multi";

/** Normalise an optional id list from a request body. null = not sent. */
export function parsePlayerIds(raw: unknown): number[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return [];
  const ids = raw.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(ids)];
}

/**
 * Keep only ids that really belong to the team's roster. If the caller sent
 * a list but none are valid, returns an error message.
 */
export function pickFromRoster(sent: number[] | null, roster: number[], teamName: string): { ids: number[] | null; error?: string } {
  if (sent == null) return { ids: null };
  const set = new Set(roster);
  const ids = sent.filter((id) => set.has(id));
  if (ids.length === 0) return { ids: null, error: `Pick at least one ${teamName} player who played` };
  return { ids };
}

export interface PlayedEntry { teamId: number; playerIds: number[] | null; won: boolean }

export async function recordTeamMatchPlayers(
  tx: { execute: (q: any) => Promise<any> },
  competition: Competition,
  matchKind: MatchKind,
  matchId: number,
  seasonId: number | null,
  entries: PlayedEntry[],
): Promise<void> {
  for (const e of entries) {
    if (!e.playerIds) continue;
    for (const pid of e.playerIds) {
      await tx.execute(sql`
        INSERT INTO team_match_players (competition, match_kind, match_id, team_id, player_id, won, season_id)
        VALUES (${competition}, ${matchKind}, ${matchId}, ${e.teamId}, ${pid}, ${e.won}, ${seasonId})
        ON CONFLICT (competition, match_kind, match_id, player_id) DO NOTHING
      `);
    }
  }
}

export interface TeamEventLine { played: number; won: number; lost: number; winPct: number; teams: { teamId: number; played: number; won: number }[] }

export async function playerTeamEvents(
  db: { execute: (q: any) => Promise<any> },
  playerId: number,
): Promise<Record<Competition, TeamEventLine>> {
  const r = await db.execute(sql`
    SELECT competition, team_id, COUNT(*)::int AS played, SUM(CASE WHEN won THEN 1 ELSE 0 END)::int AS won
    FROM team_match_players WHERE player_id = ${playerId}
    GROUP BY competition, team_id
  `);
  const out: Record<Competition, TeamEventLine> = {
    doubles: { played: 0, won: 0, lost: 0, winPct: 0, teams: [] },
    shift_wars: { played: 0, won: 0, lost: 0, winPct: 0, teams: [] },
  };
  for (const row of (r.rows ?? r) as any[]) {
    const line = out[row.competition as Competition];
    if (!line) continue;
    line.played += Number(row.played);
    line.won += Number(row.won);
    line.teams.push({ teamId: Number(row.team_id), played: Number(row.played), won: Number(row.won) });
  }
  for (const l of Object.values(out)) {
    l.lost = l.played - l.won;
    l.winPct = l.played ? Math.round((l.won / l.played) * 100) : 0;
  }
  return out;
}

/** Body shape for multi matches: [{ teamId, playerIds }]. */
export function picksByTeam(raw: unknown): Map<number, number[] | null> {
  const m = new Map<number, number[] | null>();
  if (!Array.isArray(raw)) return m;
  for (const e of raw as any[]) {
    const id = Number(e?.teamId);
    if (Number.isInteger(id)) m.set(id, parsePlayerIds(e?.playerIds));
  }
  return m;
}

/**
 * Validate every side's picks against its roster and return the entries to
 * record. Throws via `fail` on a bad pick so the surrounding transaction
 * rolls back.
 */
export function buildEntries(
  sides: { teamId: number; teamName: string; roster: number[]; sent: number[] | null; won: boolean }[],
  fail: (msg: string) => never,
): PlayedEntry[] {
  return sides.map((s) => {
    const pick = pickFromRoster(s.sent, s.roster, s.teamName);
    if (pick.error) fail(pick.error);
    return { teamId: s.teamId, playerIds: pick.ids, won: s.won };
  });
}

/** Recent games this player actually threw in, newest first. */
export async function playerTeamEventGames(db: { execute: (q: any) => Promise<any> }, playerId: number, limit = 10) {
  const r = await db.execute(sql`
    SELECT tmp.competition, tmp.match_kind, tmp.match_id, tmp.team_id, tmp.won, tmp.played_at,
      CASE WHEN tmp.competition = 'doubles' THEN dt.team_name ELSE st.name END AS team_name,
      (SELECT string_agg(p.name, ' & ' ORDER BY p.name) FROM team_match_players o JOIN players p ON p.id = o.player_id
        WHERE o.competition = tmp.competition AND o.match_kind = tmp.match_kind AND o.match_id = tmp.match_id
          AND o.team_id = tmp.team_id AND o.player_id <> tmp.player_id) AS partners
    FROM team_match_players tmp
    LEFT JOIN doubles_teams dt ON tmp.competition = 'doubles' AND dt.id = tmp.team_id
    LEFT JOIN shift_wars_teams st ON tmp.competition = 'shift_wars' AND st.id = tmp.team_id
    WHERE tmp.player_id = ${playerId}
    ORDER BY tmp.played_at DESC, tmp.id DESC
    LIMIT ${limit}
  `);
  return ((r.rows ?? r) as any[]).map((x) => ({
    competition: x.competition as Competition, kind: x.match_kind as MatchKind, matchId: Number(x.match_id),
    teamId: Number(x.team_id), teamName: x.team_name ?? null, won: !!x.won, playedAt: x.played_at, partners: x.partners ?? null,
  }));
}

/** One thrower's numbers from the team X01 scorer (so team results count toward 180s and checkout targets). */
export type ThrowerStat = { playerId: number; darts: number; points: number; oneEighties: number; checkoutAttempts: number; checkoutHits: number };

/**
 * Parse `playerStats` from a request body. Only players in `allowed` (who belong to the match) are kept, and
 * every number is held to what a single team match could produce, so a bad client can't invent figures.
 */
export function parseThrowerStats(raw: unknown, allowed: number[]): ThrowerStat[] {
  if (!Array.isArray(raw)) return [];
  const ok = new Set(allowed);
  const int = (v: unknown, max: number) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= max ? n : null; };
  const out = new Map<number, ThrowerStat>();
  for (const r of raw.slice(0, 16)) {
    const playerId = Number((r as any)?.playerId);
    if (!ok.has(playerId)) continue;
    const darts = int((r as any).darts, 600), points = int((r as any).points, 30000), oneEighties = int((r as any).oneEighties, 60);
    const checkoutAttempts = int((r as any).checkoutAttempts, 300), checkoutHits = int((r as any).checkoutHits, 30);
    if (darts == null || points == null || oneEighties == null || checkoutAttempts == null || checkoutHits == null) continue;
    if (checkoutHits > checkoutAttempts || oneEighties * 3 > darts || points > darts * 60) continue;
    out.set(playerId, { playerId, darts, points, oneEighties, checkoutAttempts, checkoutHits });
  }
  return [...out.values()];
}

let throwerTable: Promise<void> | null = null;
export function ensureThrowerStatsTable(db: { execute: (q: any) => Promise<any> }): Promise<void> {
  throwerTable ??= db.execute(sql`CREATE TABLE IF NOT EXISTS team_thrower_stats (
    competition TEXT NOT NULL, match_kind TEXT NOT NULL, match_id INTEGER NOT NULL, player_id INTEGER NOT NULL,
    darts INTEGER NOT NULL, points INTEGER NOT NULL, one_eighties INTEGER NOT NULL,
    checkout_attempts INTEGER NOT NULL, checkout_hits INTEGER NOT NULL, played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition, match_kind, match_id, player_id))`).then(() => undefined).catch((err: unknown) => { throwerTable = null; throw err; });
  return throwerTable;
}

/** Store thrower stats for a team match (competition "doubles" | "shift_wars" | "team"). */
export async function recordThrowerStats(tx: { execute: (q: any) => Promise<any> }, competition: string, matchKind: string, matchId: number, stats: ThrowerStat[]): Promise<void> {
  for (const s of stats) await tx.execute(sql`
    INSERT INTO team_thrower_stats (competition, match_kind, match_id, player_id, darts, points, one_eighties, checkout_attempts, checkout_hits)
    VALUES (${competition}, ${matchKind}, ${matchId}, ${s.playerId}, ${s.darts}, ${s.points}, ${s.oneEighties}, ${s.checkoutAttempts}, ${s.checkoutHits})
    ON CONFLICT DO NOTHING`);
}
