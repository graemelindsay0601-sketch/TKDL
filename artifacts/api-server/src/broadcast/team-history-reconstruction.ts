// TKDL LIVE — Historical Reconstruction for Doubles Event and Shift Wars.
// Doubles/Shift Wars matches live in hand-rolled SQL tables (doubles_teams/
// doubles_matches, shift_wars_teams/shift_wars_matches — see app.ts's
// table-creation block) rather than a proper Drizzle schema, so this file
// queries them the same way the existing routes/doubles.ts and
// routes/shift-wars.ts already do: db.execute(sql\`...\`) with a local row
// type, not the Drizzle query builder. Formalizing those tables into real
// Drizzle schema files would be a good follow-up, but it's a separate
// data-layer cleanup, not something folded into TKDL LIVE — every function
// below is fully real and working against the tables as they exist today.
//
// Two real differences from Singles' history-reconstruction.ts drive the
// design here:
//
//   1. Doubles teams are REDRAWN every season (drawDoublesTeams() deletes
//      and recreates doubles_teams rows per season_id) — a team id is only
//      ever meaningful within the one season it was drawn for. That's why
//      the handover doc itself scopes the Doubles predictor's team H2H to
//      "current-season" only (section 7.7) rather than career-wide: there
//      is no cross-season team identity for it to span. Shift Wars teams
//      are the opposite — three fixed departments that persist forever, so
//      Shift Wars team H2H is career-wide, the same shape as Singles H2H.
//
//   2. Shift Wars matches carry no season_id at all (it's a standing
//      competition whose points/wins/losses get reset in place every month
//      — see lib/seasonReset.ts's performShiftWarsSeasonReset — rather than
//      getting fresh per-season rows the way Doubles teams do). To ask "what
//      happened in Shift Wars during season X" at all, this file has to
//      infer a date window from that season's startDate/endDate and select
//      shift_wars_matches by played_at falling inside it. That's a real,
//      correct reconstruction of what happened in that window, but it does
//      carry one honest data-availability limitation, called out at
//      buildShiftWarsTeamTimeline() below: a team's starting_points is a
//      live, admin-editable value with no history of its own, so a team
//      whose starting_points was edited AFTER a past season closed will be
//      reconstructed slightly wrong for that old season. There's no way to
//      fix that from data the app never recorded — it's not a gap in this
//      code, it's a gap in what was ever stored.
import { desc, eq, sql } from "drizzle-orm";
import { db, seasonsTable, type Season } from "@workspace/db";
import { DOUBLES_STARTING_POINTS } from "../lib/doublesDraw";
import { replayTeamTimeline, type TeamMatchState, type TeamState } from "./team-timeline-replay";

export type { TeamMatchState, TeamState } from "./team-timeline-replay";

export const DOUBLES_STARTING_ELO = 1000; // matches lib/doublesDraw.ts's drawDoublesTeams() insert

/**
 * A team's record/streak/form as it stood immediately before `cutoff`,
 * read off an already-built timeline (see buildDoublesTeamTimeline /
 * buildShiftWarsTeamTimeline) — the team-league counterpart to reading a
 * SinglesMatchState's winnerBefore/loserBefore. Falls back to `initial`
 * when the team hasn't played yet as of cutoff (timeline is assumed
 * ascending, matching how both builders above construct it).
 */
export function teamStateAsOf(timeline: TeamMatchState[], teamId: number, cutoff: Date, initial: TeamState): TeamState {
  let latest: TeamState = initial;
  for (const entry of timeline) {
    if (entry.playedAt >= cutoff) break;
    if (entry.winnerTeamId === teamId) latest = entry.winnerAfter;
    else if (entry.loserTeamId === teamId) latest = entry.loserAfter;
  }
  return latest;
}

/** Fetches every Shift Wars team's current (live, admin-editable) starting_points — see the module header's data-availability note. */
export async function getShiftWarsStartingPoints(): Promise<Map<number, number>> {
  const rows = (await db.execute(sql`SELECT id, starting_points FROM shift_wars_teams`)).rows as { id: number; starting_points: number }[];
  return new Map(rows.map(t => [t.id, t.starting_points]));
}

// ── Doubles Event ────────────────────────────────────────────────────────

type DoublesMatchRow = {
  id: number;
  played_at: string | Date;
  winner_team_id: number;
  loser_team_id: number;
  stake: number;
};

export async function buildDoublesTeamTimeline(seasonId: number): Promise<TeamMatchState[]> {
  const rows = (await db.execute(sql`
    SELECT id, played_at, winner_team_id, loser_team_id, stake
    FROM doubles_matches
    WHERE season_id = ${seasonId}
    ORDER BY played_at ASC, id ASC
  `)).rows as DoublesMatchRow[];

  return replayTeamTimeline(
    rows.map(r => ({
      id: r.id,
      playedAt: new Date(r.played_at),
      winnerTeamId: r.winner_team_id,
      loserTeamId: r.loser_team_id,
      stake: r.stake,
    })),
    {
      // Every doubles_teams row is inserted with the same fixed starting
      // balance and Elo (see lib/doublesDraw.ts) — safe to hardcode, unlike
      // Shift Wars' per-team configurable starting_points below.
      initialState: () => ({ points: DOUBLES_STARTING_POINTS, elo: 1000 }),
      trackElo: true,
    },
  );
}

export async function getDoublesPreMatchContext(matchId: number): Promise<{
  matchId: number; playedAt: Date; winnerTeamId: number; loserTeamId: number;
  winnerBefore: TeamMatchState["winnerBefore"]; loserBefore: TeamMatchState["loserBefore"];
} | null> {
  const [row] = (await db.execute(sql`SELECT season_id FROM doubles_matches WHERE id = ${matchId}`)).rows as { season_id: number }[];
  if (!row) return null;

  const timeline = await buildDoublesTeamTimeline(row.season_id);
  const entry = timeline.find(t => t.matchId === matchId);
  if (!entry) return null;

  return {
    matchId: entry.matchId, playedAt: entry.playedAt,
    winnerTeamId: entry.winnerTeamId, loserTeamId: entry.loserTeamId,
    winnerBefore: entry.winnerBefore, loserBefore: entry.loserBefore,
  };
}

export type TeamH2HRecord = {
  teamA: number;
  teamB: number;
  cutoff: Date;
  aWins: number;
  bWins: number;
  gamesPlayed: number;
  recentMeetings: { matchId: number; playedAt: Date; winnerTeamId: number; stake: number }[];
};

/**
 * Doubles team H2H is inherently season-scoped — see the module header for
 * why team ids don't mean anything across seasons here. `seasonId` is
 * required (not optional) for exactly that reason: there is no sensible
 * "career" H2H to fall back to.
 */
export async function buildDoublesTeamH2HBefore(
  teamA: number, teamB: number, cutoff: Date, seasonId: number,
): Promise<TeamH2HRecord> {
  const rows = (await db.execute(sql`
    SELECT id, played_at, winner_team_id, stake
    FROM doubles_matches
    WHERE season_id = ${seasonId}
      AND played_at < ${cutoff}
      AND ((winner_team_id = ${teamA} AND loser_team_id = ${teamB})
        OR (winner_team_id = ${teamB} AND loser_team_id = ${teamA}))
    ORDER BY played_at DESC, id DESC
  `)).rows as { id: number; played_at: string | Date; winner_team_id: number; stake: number }[];

  let aWins = 0, bWins = 0;
  for (const r of rows) { if (r.winner_team_id === teamA) aWins++; else bWins++; }

  return {
    teamA, teamB, cutoff, aWins, bWins, gamesPlayed: rows.length,
    recentMeetings: rows.slice(0, 10).map(r => ({
      matchId: r.id, playedAt: new Date(r.played_at), winnerTeamId: r.winner_team_id, stake: r.stake,
    })),
  };
}

// ── Shift Wars ───────────────────────────────────────────────────────────

type ShiftWarsMatchRow = {
  id: number;
  played_at: string | Date;
  winner_team_id: number;
  loser_team_id: number;
  stake: number;
};

/**
 * Shift Wars matches carry no season_id (see module header) — this
 * resolves a shift_wars-league season row to the [start, end) window its
 * matches must be inferred from. `end` is exclusive and is either the day
 * after the season's recorded endDate, or `referenceNow` for a season
 * that's still open.
 */
export function resolveShiftWarsSeasonWindow(season: Season, referenceNow: Date): { start: Date; end: Date } {
  if (season.leagueType !== "shift_wars") {
    throw new Error(`resolveShiftWarsSeasonWindow: season ${season.id} is not a shift_wars season`);
  }
  const start = new Date(`${season.startDate}T00:00:00Z`);
  const end = season.endDate
    ? new Date(new Date(`${season.endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000)
    : referenceNow;
  return { start, end };
}

export async function buildShiftWarsTeamTimeline(seasonId: number, referenceNow: Date = new Date()): Promise<TeamMatchState[]> {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
  if (!season) throw new Error(`buildShiftWarsTeamTimeline: season ${seasonId} not found`);
  const { start, end } = resolveShiftWarsSeasonWindow(season, referenceNow);

  const rows = (await db.execute(sql`
    SELECT id, played_at, winner_team_id, loser_team_id, stake
    FROM shift_wars_matches
    WHERE played_at >= ${start} AND played_at < ${end}
    ORDER BY played_at ASC, id ASC
  `)).rows as ShiftWarsMatchRow[];

  // Known, real data-availability limitation (see module header): teams'
  // starting_points is a live admin-editable value with no history of its
  // own, so this uses today's value even when reconstructing a past
  // season. Nothing in the app has ever recorded what it was back then.
  const startingPointsByTeam = await getShiftWarsStartingPoints();

  return replayTeamTimeline(
    rows.map(r => ({
      id: r.id,
      playedAt: new Date(r.played_at),
      winnerTeamId: r.winner_team_id,
      loserTeamId: r.loser_team_id,
      stake: r.stake,
    })),
    {
      initialState: (teamId) => ({ points: startingPointsByTeam.get(teamId) ?? 0, elo: null }),
      trackElo: false,
    },
  );
}

export async function getShiftWarsPreMatchContext(matchId: number): Promise<{
  matchId: number; playedAt: Date; winnerTeamId: number; loserTeamId: number;
  winnerBefore: TeamMatchState["winnerBefore"]; loserBefore: TeamMatchState["loserBefore"];
} | null> {
  const [row] = (await db.execute(sql`SELECT played_at FROM shift_wars_matches WHERE id = ${matchId}`)).rows as { played_at: string | Date }[];
  if (!row) return null;
  const playedAt = new Date(row.played_at);

  // Find the shift_wars season whose window contains this match.
  const seasons = await db.select().from(seasonsTable).where(eq(seasonsTable.leagueType, "shift_wars")).orderBy(desc(seasonsTable.id));
  const owningSeason = seasons.find(s => {
    const { start, end } = resolveShiftWarsSeasonWindow(s, new Date());
    return playedAt >= start && playedAt < end;
  });
  if (!owningSeason) return null;

  const timeline = await buildShiftWarsTeamTimeline(owningSeason.id);
  const entry = timeline.find(t => t.matchId === matchId);
  if (!entry) return null;

  return {
    matchId: entry.matchId, playedAt: entry.playedAt,
    winnerTeamId: entry.winnerTeamId, loserTeamId: entry.loserTeamId,
    winnerBefore: entry.winnerBefore, loserBefore: entry.loserBefore,
  };
}

/** Shift Wars team H2H is career-wide — teams are permanent, unlike Doubles. */
export async function buildShiftWarsTeamH2HBefore(teamA: number, teamB: number, cutoff: Date): Promise<TeamH2HRecord> {
  const rows = (await db.execute(sql`
    SELECT id, played_at, winner_team_id, stake
    FROM shift_wars_matches
    WHERE played_at < ${cutoff}
      AND ((winner_team_id = ${teamA} AND loser_team_id = ${teamB})
        OR (winner_team_id = ${teamB} AND loser_team_id = ${teamA}))
    ORDER BY played_at DESC, id DESC
  `)).rows as { id: number; played_at: string | Date; winner_team_id: number; stake: number }[];

  let aWins = 0, bWins = 0;
  for (const r of rows) { if (r.winner_team_id === teamA) aWins++; else bWins++; }

  return {
    teamA, teamB, cutoff, aWins, bWins, gamesPlayed: rows.length,
    recentMeetings: rows.slice(0, 10).map(r => ({
      matchId: r.id, playedAt: new Date(r.played_at), winnerTeamId: r.winner_team_id, stake: r.stake,
    })),
  };
}
