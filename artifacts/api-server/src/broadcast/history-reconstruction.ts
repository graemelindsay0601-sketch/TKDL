// TKDL LIVE — Historical Reconstruction and Baseline Layer (handover doc,
// section 6). The five functions here are the foundation everything else in
// TKDL LIVE builds on: the Match Predictor, Title Predictor and Story Engine
// all need to know what a player's (or team's) record/points/streak looked
// like right BEFORE a given result, and the players/team tables can't
// answer that — they only ever hold current totals, already including
// every later match.
//
// SCOPE NOTE: buildSinglesTimeline, buildH2HBefore and buildPlayerBaselines
// are Singles-only BY DESIGN, not as a gap to come back to — all three take
// player ids in their handover-spec signature (section 6.3), and Doubles/
// Shift Wars are team-vs-team, a genuinely different entity for H2H/
// baselines purposes (see team-history-reconstruction.ts's own header for
// exactly why: Doubles team ids don't even persist across seasons, and
// Shift Wars intentionally attributes no result to individual players —
// handover section 7.8). buildPlayerBaselines already covers Doubles' own
// need for it, too: section 7.7's roster-strength stabilizer wants each
// team member's individual SINGLES record, which is exactly what this
// function already returns regardless of which other leagues that player
// also appears in.
//
// buildLeagueActivityProfile is the one function the handover doc's own
// signature (section 6.3: `(league, seasonId)`) explicitly parameterizes
// by league, and getPreMatchContext's bare `matchId` is ambiguous the
// moment more than one league exists (matches/doubles_matches/
// shift_wars_matches are separate tables, each with their own id
// sequence) — so both are implemented here for all three leagues, dispatching
// to team-history-reconstruction.ts for Doubles/Shift Wars, which holds the
// Drizzle-schema-free (raw SQL) equivalents of this file's Singles logic.
//
// Per section 6.4's reconstruction rules: sort by playedAt asc, id asc as a
// deterministic tie-break; use real stake transfers only (never Elo); do
// not use matches from later dates when evaluating an older event. Results
// are computed fresh on every call and cached only within one Edition build
// process (per the caller, not here) — nothing here persists a duplicated
// timeline, matching the doc's explicit "unless profiling later proves
// necessary."
import { and, asc, desc, eq, lt, or, sql } from "drizzle-orm";
import { db, matchesTable, seasonsTable } from "@workspace/db";
import { replaySinglesTimeline, type SinglesMatchState } from "./timeline-replay";
import {
  getDoublesPreMatchContext,
  getShiftWarsPreMatchContext,
  resolveShiftWarsSeasonWindow,
  type TeamMatchState,
} from "./team-history-reconstruction";

export type { SinglesMatchState, SinglesPlayerState } from "./timeline-replay";
export type {
  TeamMatchState, TeamState, TeamH2HRecord,
} from "./team-history-reconstruction";
export {
  buildDoublesTeamTimeline, getDoublesPreMatchContext, buildDoublesTeamH2HBefore,
  buildShiftWarsTeamTimeline, getShiftWarsPreMatchContext, buildShiftWarsTeamH2HBefore,
} from "./team-history-reconstruction";

// True for genuine 1v1 Singles matches — excludes team-mode games, which
// share this same table but use match_participants instead of a single
// winnerId/loserId pair (see routes/team-matches.ts's own inverse filter).
export const SINGLES_ONLY = sql`NOT (${matchesTable.gameType} LIKE 'team_%' OR ${matchesTable.gameType} = 'multi_killer')`;

// ── 6.3: buildSinglesTimeline(seasonId) ─────────────────────────────────

export async function buildSinglesTimeline(seasonId: number): Promise<SinglesMatchState[]> {
  const rows = await db
    .select({
      id: matchesTable.id,
      playedAt: matchesTable.playedAt,
      winnerId: matchesTable.winnerId,
      loserId: matchesTable.loserId,
      stake: matchesTable.stake,
    })
    .from(matchesTable)
    .where(and(eq(matchesTable.seasonId, seasonId), SINGLES_ONLY))
    .orderBy(asc(matchesTable.playedAt), asc(matchesTable.id));

  return replaySinglesTimeline(rows);
}

// ── 6.3: getPreMatchContext(leagueType, matchId) ────────────────────────
//
// The handover's own pseudocode signature is just `(matchId)`, but a bare
// match id is ambiguous the instant more than one league exists — matches/
// doubles_matches/shift_wars_matches are separate tables, each with their
// own id sequence starting at 1, so "match 7" could mean three different
// results. `leagueType` disambiguates that; every real caller already
// knows which league's Edition it's building anyway.

// A Singles result is player-vs-player; a Doubles/Shift Wars result is
// team-vs-team — genuinely different shapes, so this is a discriminated
// union rather than one flat type papering over the difference.
export type PreMatchContext =
  | {
      leagueType: "singles";
      matchId: number;
      playedAt: Date;
      winnerId: number;
      loserId: number;
      winnerBefore: SinglesMatchState["winnerBefore"];
      loserBefore: SinglesMatchState["loserBefore"];
    }
  | {
      leagueType: "doubles" | "shift_wars";
      matchId: number;
      playedAt: Date;
      winnerTeamId: number;
      loserTeamId: number;
      winnerBefore: TeamMatchState["winnerBefore"];
      loserBefore: TeamMatchState["loserBefore"];
    };

async function getSinglesPreMatchContext(matchId: number): Promise<PreMatchContext | null> {
  const [match] = await db
    .select({ seasonId: matchesTable.seasonId, gameType: matchesTable.gameType })
    .from(matchesTable)
    .where(eq(matchesTable.id, matchId))
    .limit(1);
  if (!match) return null;
  if (match.gameType.startsWith("team_") || match.gameType === "multi_killer") {
    // A team-mode game recorded in the same table, not a Singles 1v1 match.
    return null;
  }

  const timeline = await buildSinglesTimeline(match.seasonId);
  const entry = timeline.find(t => t.matchId === matchId);
  if (!entry) return null;

  return {
    leagueType: "singles",
    matchId: entry.matchId,
    playedAt: entry.playedAt,
    winnerId: entry.winnerId,
    loserId: entry.loserId,
    winnerBefore: entry.winnerBefore,
    loserBefore: entry.loserBefore,
  };
}

export async function getPreMatchContext(
  leagueType: "singles" | "doubles" | "shift_wars",
  matchId: number,
): Promise<PreMatchContext | null> {
  if (leagueType === "singles") return getSinglesPreMatchContext(matchId);

  if (leagueType === "doubles") {
    const ctx = await getDoublesPreMatchContext(matchId);
    return ctx ? { leagueType: "doubles", ...ctx } : null;
  }

  const ctx = await getShiftWarsPreMatchContext(matchId);
  return ctx ? { leagueType: "shift_wars", ...ctx } : null;
}

// ── 6.3: buildH2HBefore(playerA, playerB, cutoff) ───────────────────────

export type H2HRecord = {
  playerA: number;
  playerB: number;
  cutoff: Date;
  aWins: number;
  bWins: number;
  gamesPlayed: number;
  /** Most recent meetings first, capped at 10 — for display, not stats. */
  recentMeetings: { matchId: number; playedAt: Date; winnerId: number; stake: number }[];
};

export async function buildH2HBefore(playerA: number, playerB: number, cutoff: Date): Promise<H2HRecord> {
  const rows = await db
    .select({
      id: matchesTable.id,
      playedAt: matchesTable.playedAt,
      winnerId: matchesTable.winnerId,
      loserId: matchesTable.loserId,
      stake: matchesTable.stake,
    })
    .from(matchesTable)
    .where(and(
      SINGLES_ONLY,
      lt(matchesTable.playedAt, cutoff),
      or(
        and(eq(matchesTable.winnerId, playerA), eq(matchesTable.loserId, playerB)),
        and(eq(matchesTable.winnerId, playerB), eq(matchesTable.loserId, playerA)),
      ),
    ))
    .orderBy(desc(matchesTable.playedAt), desc(matchesTable.id));

  let aWins = 0, bWins = 0;
  for (const r of rows) {
    if (r.winnerId === playerA) aWins++; else bWins++;
  }

  return {
    playerA, playerB, cutoff,
    aWins, bWins, gamesPlayed: rows.length,
    recentMeetings: rows.slice(0, 10).map(r => ({
      matchId: r.id, playedAt: r.playedAt, winnerId: r.winnerId, stake: r.stake,
    })),
  };
}

// ── 6.3: buildPlayerBaselines(playerId, cutoff) ─────────────────────────
//
// Returns RAW counts and RAW recent results only — no Bayesian smoothing
// applied here on purpose. The smoothing formula and its priorGames
// constants (section 7.2) belong conceptually to the Match Predictor
// (Phase B, not built yet), which is the only consumer that needs them;
// this layer's job is just to gather the facts correctly.
//
// `currentSeasonId`, if given, is used as-is for the season split (so a
// player with zero matches yet this season correctly comes back as 0-0
// rather than silently falling back to their previous season's record).
// If omitted, it's inferred from the most recent pre-cutoff match's
// seasonId — the handover's own pseudocode signature doesn't take a season
// id, but without one there's no way to tell "no matches this season yet"
// apart from "this season doesn't exist yet" — so callers that already
// know which season they're building for (every real caller will) should
// pass it explicitly.

export type DetailedMatchStat = {
  matchId: number;
  playedAt: Date;
  gameType: string;
  won: boolean;
  darts: number;
  scoring100s: number;
  scoring140s: number;
  scoring170s: number;
  scoring180s: number;
  checkoutAttempts: number;
  checkoutHits: number;
};

export type PlayerBaselines = {
  playerId: number;
  cutoff: Date;
  career: { wins: number; losses: number; gamesPlayed: number };
  currentSeason: { seasonId: number; wins: number; losses: number; gamesPlayed: number } | null;
  /** Newest first, capped at 10 — the future Match Predictor slices/weights this itself (section 7.3). */
  recentResults: ("W" | "L")[];
  /** Most recent 10 matches with full darts detail present, before cutoff — raw inputs for the future darts-performance feature (section 7.4), not scored here. */
  detailedMatches: DetailedMatchStat[];
};

export async function buildPlayerBaselines(
  playerId: number,
  cutoff: Date,
  currentSeasonId?: number,
): Promise<PlayerBaselines> {
  const rows = await db
    .select({
      id: matchesTable.id,
      playedAt: matchesTable.playedAt,
      seasonId: matchesTable.seasonId,
      winnerId: matchesTable.winnerId,
      loserId: matchesTable.loserId,
      gameType: matchesTable.gameType,
      winnerDarts: matchesTable.winnerDarts,
      winner100s: matchesTable.winner100s,
      winner140s: matchesTable.winner140s,
      winner170s: matchesTable.winner170s,
      winner180s: matchesTable.winner180s,
      winnerCheckoutAttempts: matchesTable.winnerCheckoutAttempts,
      winnerCheckoutHits: matchesTable.winnerCheckoutHits,
      loserDarts: matchesTable.loserDarts,
      loser100s: matchesTable.loser100s,
      loser140s: matchesTable.loser140s,
      loser170s: matchesTable.loser170s,
      loser180s: matchesTable.loser180s,
      loserCheckoutAttempts: matchesTable.loserCheckoutAttempts,
      loserCheckoutHits: matchesTable.loserCheckoutHits,
    })
    .from(matchesTable)
    .where(and(
      SINGLES_ONLY,
      lt(matchesTable.playedAt, cutoff),
      or(eq(matchesTable.winnerId, playerId), eq(matchesTable.loserId, playerId)),
    ))
    .orderBy(desc(matchesTable.playedAt), desc(matchesTable.id));

  let careerWins = 0, careerLosses = 0;
  let seasonWins = 0, seasonLosses = 0;
  let inferredSeasonId: number | null = null;
  const recentResults: ("W" | "L")[] = [];
  const detailedMatches: DetailedMatchStat[] = [];

  for (const r of rows) {
    const won = r.winnerId === playerId;
    if (won) careerWins++; else careerLosses++;

    if (inferredSeasonId === null) inferredSeasonId = r.seasonId;
    const targetSeasonId = currentSeasonId ?? inferredSeasonId;
    if (r.seasonId === targetSeasonId) {
      if (won) seasonWins++; else seasonLosses++;
    }

    if (recentResults.length < 10) recentResults.push(won ? "W" : "L");

    const hasDetail = won
      ? r.winnerDarts != null && r.winnerCheckoutAttempts != null
      : r.loserDarts != null && r.loserCheckoutAttempts != null;
    if (hasDetail && detailedMatches.length < 10) {
      detailedMatches.push(won ? {
        matchId: r.id, playedAt: r.playedAt, gameType: r.gameType, won: true,
        darts: r.winnerDarts!,
        scoring100s: r.winner100s ?? 0, scoring140s: r.winner140s ?? 0,
        scoring170s: r.winner170s ?? 0, scoring180s: r.winner180s ?? 0,
        checkoutAttempts: r.winnerCheckoutAttempts ?? 0, checkoutHits: r.winnerCheckoutHits ?? 0,
      } : {
        matchId: r.id, playedAt: r.playedAt, gameType: r.gameType, won: false,
        darts: r.loserDarts!,
        scoring100s: r.loser100s ?? 0, scoring140s: r.loser140s ?? 0,
        scoring170s: r.loser170s ?? 0, scoring180s: r.loser180s ?? 0,
        checkoutAttempts: r.loserCheckoutAttempts ?? 0, checkoutHits: r.loserCheckoutHits ?? 0,
      });
    }
  }

  const resolvedSeasonId = currentSeasonId ?? inferredSeasonId;

  return {
    playerId, cutoff,
    career: { wins: careerWins, losses: careerLosses, gamesPlayed: careerWins + careerLosses },
    currentSeason: resolvedSeasonId === null
      ? null
      : { seasonId: resolvedSeasonId, wins: seasonWins, losses: seasonLosses, gamesPlayed: seasonWins + seasonLosses },
    recentResults,
    detailedMatches,
  };
}

// ── 6.3: buildLeagueActivityProfile(league, seasonId) ───────────────────
//
// The one function whose handover-spec signature is explicitly
// league-parameterized, so it's implemented here for all three leagues.
// Reuses the exact formulas the Title Predictor (section 8.3/8.5) will
// need — elapsedDays, daily match/result rate, and an empirical
// positive-stake sample — computed here once as facts rather than
// re-derived per predictor run.
//
// `participantAppearances` holds player ids for Singles and team ids for
// Doubles/Shift Wars — whichever entity that league's matches are actually
// between. Callers already know which league they asked for.

export type LeagueActivityProfile = {
  leagueType: "singles" | "doubles" | "shift_wars";
  seasonId: number;
  elapsedDays: number;
  matchesThisSeason: number;
  currentDailyRate: number;
  /**
   * Simple mean of up to the previous 3 closed seasons' own daily match
   * rates for this same league, or null if none exist yet. The handover
   * doc says "weighted mean" without specifying weights, so this uses an
   * equal-weighted mean as the most defensible reading until you tell us
   * otherwise — flagging that explicitly rather than guessing at weights
   * silently.
   */
  historicalDailyRate: number | null;
  /** Player ids for Singles, team ids for Doubles/Shift Wars — raw appearance counts; the Title Predictor's own activity-propensity smoothing (section 8.4) is applied on top of this, not here. */
  participantAppearances: { participantId: number; matchesPlayed: number }[];
  /** Up to 60 positive stakes, current season first then earlier seasons (section 8.5) — a raw sample, not a fitted distribution. */
  positiveStakes: number[];
};

const STAKE_SAMPLE_SIZE = 60;
const HISTORICAL_SEASON_WINDOW = 3;

function daysBetween(a: Date, b: Date): number {
  return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

// Handover 8.3: elapsedDays = max(hours since season start / 24, 1) — a
// season that's only hours old is still floored to 1 full day so the daily
// rate doesn't spike from a tiny denominator.
function elapsedDaysSince(startDate: string, referenceNow: Date): number {
  return Math.max(daysBetween(new Date(startDate), referenceNow), 1);
}

function buildPositiveStakeSample(
  currentSeasonPositiveStakes: { stake: number; playedAt: Date }[],
): number[] {
  return currentSeasonPositiveStakes
    .sort((a, b) => b.playedAt.getTime() - a.playedAt.getTime())
    .map(m => m.stake)
    .slice(0, STAKE_SAMPLE_SIZE);
}

// `callerNow`, when given, stands in for "now" throughout — used only when
// the season is still open (a CLOSED season's own end date is always its
// correct reference point regardless of what a caller passes). Every real
// caller before the Title Predictor (section 8) only ever asked about the
// current moment, so this defaults to `new Date()` and nothing about their
// behavior changes; the Title Predictor's own `cutoff` option (defaulting
// to now too) needs this to actually flow through here, or its
// elapsedDays/currentDailyRate/stake-backfill numbers would silently be
// computed against the real wall clock instead of the cutoff it was asked
// to simulate as of.
export async function buildLeagueActivityProfile(
  leagueType: "singles" | "doubles" | "shift_wars",
  seasonId: number,
  callerNow: Date = new Date(),
): Promise<LeagueActivityProfile> {
  if (leagueType === "singles") return buildSinglesActivityProfile(seasonId, callerNow);
  if (leagueType === "doubles") return buildDoublesActivityProfile(seasonId, callerNow);
  return buildShiftWarsActivityProfile(seasonId, callerNow);
}

async function buildSinglesActivityProfile(seasonId: number, callerNow: Date): Promise<LeagueActivityProfile> {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
  if (!season || season.leagueType !== "singles") {
    throw new Error(`buildLeagueActivityProfile: season ${seasonId} is not a singles season`);
  }

  const referenceNow = season.endDate ? new Date(season.endDate) : callerNow;
  const elapsedDaysFloor = elapsedDaysSince(season.startDate, referenceNow);

  const seasonMatches = await db
    .select({
      id: matchesTable.id,
      winnerId: matchesTable.winnerId,
      loserId: matchesTable.loserId,
      stake: matchesTable.stake,
      playedAt: matchesTable.playedAt,
    })
    .from(matchesTable)
    .where(and(eq(matchesTable.seasonId, seasonId), SINGLES_ONLY));

  const matchesThisSeason = seasonMatches.length;
  const currentDailyRate = matchesThisSeason / elapsedDaysFloor;

  const priorSeasons = await db
    .select()
    .from(seasonsTable)
    .where(and(eq(seasonsTable.leagueType, "singles"), sql`${seasonsTable.id} < ${seasonId}`, sql`${seasonsTable.endDate} IS NOT NULL`))
    .orderBy(desc(seasonsTable.id))
    .limit(HISTORICAL_SEASON_WINDOW);

  let historicalDailyRate: number | null = null;
  if (priorSeasons.length > 0) {
    const rates: number[] = [];
    for (const s of priorSeasons) {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(matchesTable)
        .where(and(eq(matchesTable.seasonId, s.id), SINGLES_ONLY));
      const seasonSpanDays = Math.max(daysBetween(new Date(s.startDate), new Date(s.endDate!)), 1);
      rates.push(count / seasonSpanDays);
    }
    historicalDailyRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  }

  const appearanceCounts = new Map<number, number>();
  for (const m of seasonMatches) {
    appearanceCounts.set(m.winnerId, (appearanceCounts.get(m.winnerId) ?? 0) + 1);
    appearanceCounts.set(m.loserId, (appearanceCounts.get(m.loserId) ?? 0) + 1);
  }
  const participantAppearances = [...appearanceCounts.entries()]
    .map(([participantId, matchesPlayed]) => ({ participantId, matchesPlayed }))
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed);

  const currentSeasonStakes = buildPositiveStakeSample(
    seasonMatches.filter(m => m.stake > 0).map(m => ({ stake: m.stake, playedAt: m.playedAt })),
  );

  let positiveStakes = currentSeasonStakes;
  if (positiveStakes.length < STAKE_SAMPLE_SIZE) {
    const backfill = await db
      .select({ stake: matchesTable.stake })
      .from(matchesTable)
      .where(and(
        SINGLES_ONLY,
        sql`${matchesTable.seasonId} != ${seasonId}`,
        sql`${matchesTable.stake} > 0`,
        lt(matchesTable.playedAt, referenceNow),
      ))
      .orderBy(desc(matchesTable.playedAt))
      .limit(STAKE_SAMPLE_SIZE - positiveStakes.length);
    positiveStakes = [...positiveStakes, ...backfill.map(r => r.stake)];
  }

  return {
    leagueType: "singles", seasonId,
    elapsedDays: elapsedDaysFloor, matchesThisSeason, currentDailyRate,
    historicalDailyRate, participantAppearances, positiveStakes,
  };
}

async function buildDoublesActivityProfile(seasonId: number, callerNow: Date): Promise<LeagueActivityProfile> {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
  if (!season || season.leagueType !== "doubles") {
    throw new Error(`buildLeagueActivityProfile: season ${seasonId} is not a doubles season`);
  }

  const referenceNow = season.endDate ? new Date(season.endDate) : callerNow;
  const elapsedDaysFloor = elapsedDaysSince(season.startDate, referenceNow);

  type Row = { id: number; winner_team_id: number; loser_team_id: number; stake: number; played_at: string | Date };
  const seasonMatches = ((await db.execute(sql`
    SELECT id, winner_team_id, loser_team_id, stake, played_at FROM doubles_matches WHERE season_id = ${seasonId}
  `)).rows as Row[]).map(r => ({ ...r, playedAt: new Date(r.played_at) }));

  const matchesThisSeason = seasonMatches.length;
  const currentDailyRate = matchesThisSeason / elapsedDaysFloor;

  const priorSeasons = await db
    .select()
    .from(seasonsTable)
    .where(and(eq(seasonsTable.leagueType, "doubles"), sql`${seasonsTable.id} < ${seasonId}`, sql`${seasonsTable.endDate} IS NOT NULL`))
    .orderBy(desc(seasonsTable.id))
    .limit(HISTORICAL_SEASON_WINDOW);

  let historicalDailyRate: number | null = null;
  if (priorSeasons.length > 0) {
    const rates: number[] = [];
    for (const s of priorSeasons) {
      const [{ count }] = ((await db.execute(sql`
        SELECT count(*)::int AS count FROM doubles_matches WHERE season_id = ${s.id}
      `)).rows as { count: number }[]);
      const seasonSpanDays = Math.max(daysBetween(new Date(s.startDate), new Date(s.endDate!)), 1);
      rates.push(count / seasonSpanDays);
    }
    historicalDailyRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  }

  const appearanceCounts = new Map<number, number>();
  for (const m of seasonMatches) {
    appearanceCounts.set(m.winner_team_id, (appearanceCounts.get(m.winner_team_id) ?? 0) + 1);
    appearanceCounts.set(m.loser_team_id, (appearanceCounts.get(m.loser_team_id) ?? 0) + 1);
  }
  const participantAppearances = [...appearanceCounts.entries()]
    .map(([participantId, matchesPlayed]) => ({ participantId, matchesPlayed }))
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed);

  // Doubles teams are redrawn every season (see team-history-reconstruction.ts's
  // header), so "earlier seasons" backfill below is still meaningful for the
  // STAKE sample (stakes are just numbers, no team identity involved) even
  // though team ids themselves don't carry over.
  const currentSeasonStakes = buildPositiveStakeSample(
    seasonMatches.filter(m => m.stake > 0).map(m => ({ stake: m.stake, playedAt: m.playedAt })),
  );

  let positiveStakes = currentSeasonStakes;
  if (positiveStakes.length < STAKE_SAMPLE_SIZE) {
    const backfill = (await db.execute(sql`
      SELECT stake FROM doubles_matches
      WHERE season_id != ${seasonId} AND stake > 0 AND played_at < ${referenceNow}
      ORDER BY played_at DESC
      LIMIT ${STAKE_SAMPLE_SIZE - positiveStakes.length}
    `)).rows as { stake: number }[];
    positiveStakes = [...positiveStakes, ...backfill.map(r => r.stake)];
  }

  return {
    leagueType: "doubles", seasonId,
    elapsedDays: elapsedDaysFloor, matchesThisSeason, currentDailyRate,
    historicalDailyRate, participantAppearances, positiveStakes,
  };
}

async function buildShiftWarsActivityProfile(seasonId: number, callerNow: Date): Promise<LeagueActivityProfile> {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
  if (!season || season.leagueType !== "shift_wars") {
    throw new Error(`buildLeagueActivityProfile: season ${seasonId} is not a shift_wars season`);
  }

  // resolveShiftWarsSeasonWindow only actually uses `referenceNow` when the
  // season is still open (a closed season's window is fixed by its own
  // endDate) — same closed/open split buildSinglesActivityProfile and
  // buildDoublesActivityProfile apply explicitly above, just handled one
  // level down for Shift Wars since its window resolution already does it.
  const referenceNow = callerNow;
  const { start, end } = resolveShiftWarsSeasonWindow(season, referenceNow);
  const elapsedDaysFloor = Math.max(daysBetween(start, end), 1);

  type Row = { id: number; winner_team_id: number; loser_team_id: number; stake: number; played_at: string | Date };
  const seasonMatches = ((await db.execute(sql`
    SELECT id, winner_team_id, loser_team_id, stake, played_at FROM shift_wars_matches
    WHERE played_at >= ${start} AND played_at < ${end}
  `)).rows as Row[]).map(r => ({ ...r, playedAt: new Date(r.played_at) }));

  const matchesThisSeason = seasonMatches.length;
  const currentDailyRate = matchesThisSeason / elapsedDaysFloor;

  // Historical rate: up to the previous 3 closed shift_wars seasons, each
  // scoped by its own resolved date window (there's no season_id column to
  // filter by directly — see team-history-reconstruction.ts's header).
  const priorSeasons = await db
    .select()
    .from(seasonsTable)
    .where(and(eq(seasonsTable.leagueType, "shift_wars"), sql`${seasonsTable.id} < ${seasonId}`, sql`${seasonsTable.endDate} IS NOT NULL`))
    .orderBy(desc(seasonsTable.id))
    .limit(HISTORICAL_SEASON_WINDOW);

  let historicalDailyRate: number | null = null;
  if (priorSeasons.length > 0) {
    const rates: number[] = [];
    for (const s of priorSeasons) {
      const w = resolveShiftWarsSeasonWindow(s, referenceNow);
      const [{ count }] = ((await db.execute(sql`
        SELECT count(*)::int AS count FROM shift_wars_matches WHERE played_at >= ${w.start} AND played_at < ${w.end}
      `)).rows as { count: number }[]);
      const seasonSpanDays = Math.max(daysBetween(w.start, w.end), 1);
      rates.push(count / seasonSpanDays);
    }
    historicalDailyRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  }

  const appearanceCounts = new Map<number, number>();
  for (const m of seasonMatches) {
    appearanceCounts.set(m.winner_team_id, (appearanceCounts.get(m.winner_team_id) ?? 0) + 1);
    appearanceCounts.set(m.loser_team_id, (appearanceCounts.get(m.loser_team_id) ?? 0) + 1);
  }
  const participantAppearances = [...appearanceCounts.entries()]
    .map(([participantId, matchesPlayed]) => ({ participantId, matchesPlayed }))
    .sort((a, b) => b.matchesPlayed - a.matchesPlayed);

  const currentSeasonStakes = buildPositiveStakeSample(
    seasonMatches.filter(m => m.stake > 0).map(m => ({ stake: m.stake, playedAt: m.playedAt })),
  );

  let positiveStakes = currentSeasonStakes;
  if (positiveStakes.length < STAKE_SAMPLE_SIZE) {
    const backfill = (await db.execute(sql`
      SELECT stake FROM shift_wars_matches
      WHERE stake > 0 AND played_at < ${start}
      ORDER BY played_at DESC
      LIMIT ${STAKE_SAMPLE_SIZE - positiveStakes.length}
    `)).rows as { stake: number }[];
    positiveStakes = [...positiveStakes, ...backfill.map(r => r.stake)];
  }

  return {
    leagueType: "shift_wars", seasonId,
    elapsedDays: elapsedDaysFloor, matchesThisSeason, currentDailyRate,
    historicalDailyRate, participantAppearances, positiveStakes,
  };
}
