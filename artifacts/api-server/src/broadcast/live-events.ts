// TKDL LIVE — Live layer: the DB-facing half (handover doc sections
// 11.4-11.6, Appendix C.2's own `getLivePayload`). live-events-math.ts owns
// every pure rule (score bands, the 10-minute ageing window, validity-rule
// generation); this file resolves real current standings, recent matches
// and stored title-probability snapshots, and evaluates already-persisted
// validity rules against that live state — GET /api/broadcast/live's own
// backing implementation (routes/broadcast.ts, task 134, is just a thin
// HTTP wrapper around getLivePayload() below).
//
// DB-FACING, NOT UNIT TESTED — same convention as story-engine.ts,
// director.ts, commentary-engine.ts, edition-engine.ts: no dedicated test
// file, verified by typecheck + build clean and by construction from
// live-events-math.ts's own fully-tested pure layer underneath.
//
// ── Why this calls detectAndUpdateStories() on every poll, and why that
// stays cheap per 16.5 ──────────────────────────────────────────────────
// C.2's own pseudocode classifies new results "from deterministic current/
// pre-match facts" — exactly the same scoring pipeline section 9 already
// built, not a second, simplified reimplementation. Reusing
// detectAndUpdateStories() directly (scoped from the current published
// Edition's own dataCutoff) means live and Edition-build classification can
// never drift apart, and its own upserts are idempotent by storyKey, so
// concurrent polls only ever race harmlessly, the same tolerance 16.4
// already accepts for Edition builds. In the overwhelmingly common case —
// no genuinely new match since the last poll — every per-league loop inside
// detectAndUpdateStories() finds an empty match set and skips straight
// through (including, critically, never invoking the Title Predictor,
// which only runs for a season with real match activity or a closure in the
// window): the real cost is a handful of cheap indexed SELECTs, not a
// re-run of anything resembling a full batch.
//
// ── Why ageing (11.5) can't just use a story's own detectedAt ───────────
// detectedAt records when the Story Engine noticed a situation, which can
// lag well behind when the underlying match was actually PLAYED (detection
// itself only ever runs from an Edition build or a live poll, not
// synchronously on match submission) — 11.5 is explicit that the 10-minute
// overlay window is anchored to playedAt. For match-anchored stories this
// file resolves the real playedAt via the same recent-matches read tickerItems
// already needs; only for the rare non-match-anchored fresh detection (a
// LEAGUE-family swing with no single anchor match) does this fall back to
// detectedAt as the least-bad available reference instant.
import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import {
  db, matchesTable, playersTable, seasonsTable,
  broadcastStoriesTable, broadcastPredictionSnapshotsTable,
  type BroadcastStory, type LeagueType,
} from "@workspace/db";
import { SINGLES_ONLY } from "./history-reconstruction.ts";
import { detectAndUpdateStories, type StoredStandingSnapshot } from "./story-engine.ts";
import { latestPublishedEdition, isEditionProgramme } from "./edition-engine.ts";
import { programmeSegmentId, type EditionProgramme } from "./director-math.ts";
import {
  classifyLiveScore, isWithinOverlayAgeWindow, titleProbabilityBand,
  type ValidityRule, type LiveOverlayClass, type TitleProbabilityBand,
} from "./live-events-math.ts";

// ═══════════════════════════════════════════════════════════════════════
// Recent matches — shared by tickerItems (11.4) and overlay ageing (11.5)
// ═══════════════════════════════════════════════════════════════════════

type RecentMatch = { matchId: number; leagueType: LeagueType; winnerId: number; loserId: number; playedAt: Date };

async function loadRecentMatches(cutoffStart: Date, cutoffEnd: Date): Promise<RecentMatch[]> {
  const singles = await db
    .select({ id: matchesTable.id, winnerId: matchesTable.winnerId, loserId: matchesTable.loserId, playedAt: matchesTable.playedAt })
    .from(matchesTable)
    .where(and(SINGLES_ONLY, gt(matchesTable.playedAt, cutoffStart), lte(matchesTable.playedAt, cutoffEnd)))
    .orderBy(desc(matchesTable.playedAt));

  const doublesRows = (await db.execute(sql`
    SELECT id, winner_team_id, loser_team_id, played_at FROM doubles_matches
    WHERE played_at > ${cutoffStart} AND played_at <= ${cutoffEnd} ORDER BY played_at DESC
  `)).rows as { id: number; winner_team_id: number; loser_team_id: number; played_at: string | Date }[];

  const shiftWarsRows = (await db.execute(sql`
    SELECT id, winner_team_id, loser_team_id, played_at FROM shift_wars_matches
    WHERE played_at > ${cutoffStart} AND played_at <= ${cutoffEnd} ORDER BY played_at DESC
  `)).rows as { id: number; winner_team_id: number; loser_team_id: number; played_at: string | Date }[];

  return [
    ...singles.map((m): RecentMatch => ({ matchId: m.id, leagueType: "singles", winnerId: m.winnerId, loserId: m.loserId, playedAt: m.playedAt })),
    ...doublesRows.map((m): RecentMatch => ({ matchId: m.id, leagueType: "doubles", winnerId: m.winner_team_id, loserId: m.loser_team_id, playedAt: new Date(m.played_at) })),
    ...shiftWarsRows.map((m): RecentMatch => ({ matchId: m.id, leagueType: "shift_wars", winnerId: m.winner_team_id, loserId: m.loser_team_id, playedAt: new Date(m.played_at) })),
  ];
}

// ═══════════════════════════════════════════════════════════════════════
// Current standings — shared by "leaders" and the leaderIs/entityActive
// validity-rule evaluators, cached per league within one getLivePayload()
// call so evaluating many segments' rules never re-fetches the same
// league's standings twice.
// ═══════════════════════════════════════════════════════════════════════

type StandingsRow = { entityId: number; name: string; points: number; isEliminated: boolean };
type StandingsCache = Map<LeagueType, Promise<StandingsRow[]>>;

async function fetchSinglesStandings(): Promise<StandingsRow[]> {
  const rows = await db
    .select({ id: playersTable.id, name: playersTable.name, points: playersTable.points })
    .from(playersTable)
    .where(eq(playersTable.isActive, true));
  // Singles elimination reads as points === 0 — the same convention
  // story-engine.ts's own processLeagueFamily() already uses for this league.
  return rows.map(r => ({ entityId: r.id, name: r.name, points: r.points, isEliminated: r.points === 0 }));
}

async function activeSeasonId(leagueType: LeagueType): Promise<number | null> {
  const [row] = await db.select({ id: seasonsTable.id }).from(seasonsTable).where(and(eq(seasonsTable.leagueType, leagueType), eq(seasonsTable.isActive, true))).limit(1);
  return row?.id ?? null;
}

async function fetchDoublesStandings(): Promise<StandingsRow[]> {
  const seasonId = await activeSeasonId("doubles");
  if (seasonId === null) return [];
  const rows = (await db.execute(sql`SELECT id, team_name, points, is_eliminated FROM doubles_teams WHERE season_id = ${seasonId}`))
    .rows as { id: number; team_name: string; points: number; is_eliminated: boolean }[];
  return rows.map(r => ({ entityId: r.id, name: r.team_name, points: r.points, isEliminated: r.is_eliminated }));
}

async function fetchShiftWarsStandings(): Promise<StandingsRow[]> {
  // Permanent, fixed set of teams — no season scoping, no elimination concept (story-engine.ts's own module header).
  const rows = (await db.execute(sql`SELECT id, name, points FROM shift_wars_teams`)).rows as { id: number; name: string; points: number }[];
  return rows.map(r => ({ entityId: r.id, name: r.name, points: r.points, isEliminated: false }));
}

function getStandings(cache: StandingsCache, leagueType: LeagueType): Promise<StandingsRow[]> {
  let cached = cache.get(leagueType);
  if (!cached) {
    cached = leagueType === "singles" ? fetchSinglesStandings() : leagueType === "doubles" ? fetchDoublesStandings() : fetchShiftWarsStandings();
    cache.set(leagueType, cached);
  }
  return cached;
}

function currentLeaderOf(standings: readonly StandingsRow[]): StandingsRow | null {
  const active = standings.filter(s => !s.isEliminated);
  if (active.length === 0) return null;
  return [...active].sort((a, b) => b.points - a.points)[0];
}

export type LiveLeader = { entityId: number; name: string; points: number } | null;
export type LiveLeaders = { singles: LiveLeader; doubles: LiveLeader; shift_wars: LiveLeader };

async function getLeaders(cache: StandingsCache): Promise<LiveLeaders> {
  async function leaderFor(leagueType: LeagueType): Promise<LiveLeader> {
    const leader = currentLeaderOf(await getStandings(cache, leagueType));
    return leader ? { entityId: leader.entityId, name: leader.name, points: leader.points } : null;
  }
  const [singles, doubles, shift_wars] = await Promise.all([leaderFor("singles"), leaderFor("doubles"), leaderFor("shift_wars")]);
  return { singles, doubles, shift_wars };
}

// ═══════════════════════════════════════════════════════════════════════
// 11.6 validity-rule evaluation against current live state
// ═══════════════════════════════════════════════════════════════════════

async function hasLostSince(leagueType: LeagueType, entityId: number, sinceInstant: Date): Promise<boolean> {
  if (leagueType === "singles") {
    const rows = await db.select({ id: matchesTable.id }).from(matchesTable)
      .where(and(SINGLES_ONLY, eq(matchesTable.loserId, entityId), gt(matchesTable.playedAt, sinceInstant)))
      .limit(1);
    return rows.length > 0;
  }
  if (leagueType === "doubles") {
    const rows = (await db.execute(sql`SELECT id FROM doubles_matches WHERE loser_team_id = ${entityId} AND played_at > ${sinceInstant} LIMIT 1`)).rows;
    return rows.length > 0;
  }
  const rows = (await db.execute(sql`SELECT id FROM shift_wars_matches WHERE loser_team_id = ${entityId} AND played_at > ${sinceInstant} LIMIT 1`)).rows;
  return rows.length > 0;
}

async function isEntityActiveNow(cache: StandingsCache, leagueType: LeagueType, entityId: number): Promise<boolean> {
  if (leagueType === "shift_wars") return true; // permanent teams — no elimination concept
  const row = (await getStandings(cache, leagueType)).find(s => s.entityId === entityId);
  // Not found at all (singles: already filtered to isActive; doubles: not on the active season's roster) reads the same as "not active".
  return row ? !row.isEliminated : false;
}

async function isEntityCurrentLeader(cache: StandingsCache, leagueType: LeagueType, entityId: number): Promise<boolean> {
  const leader = currentLeaderOf(await getStandings(cache, leagueType));
  return leader !== null && leader.entityId === entityId;
}

async function currentTitleProbabilityBand(leagueType: LeagueType, entityId: number): Promise<TitleProbabilityBand | null> {
  const [row] = await db
    .select()
    .from(broadcastPredictionSnapshotsTable)
    .where(and(eq(broadcastPredictionSnapshotsTable.snapshotType, "TITLE"), eq(broadcastPredictionSnapshotsTable.leagueType, leagueType)))
    .orderBy(desc(broadcastPredictionSnapshotsTable.generatedAt))
    .limit(1);
  if (!row) return null;
  const payload = row.payload as StoredStandingSnapshot[];
  const entity = payload.find(p => p.entityId === entityId);
  return entity ? titleProbabilityBand(entity.titleProbability) : null; // not found in the latest snapshot at all -> treated as stale by the caller
}

async function isStoryRowStillActive(storyId: number): Promise<boolean> {
  const [row] = await db.select({ lifecycle: broadcastStoriesTable.lifecycle }).from(broadcastStoriesTable).where(eq(broadcastStoriesTable.id, storyId)).limit(1);
  if (!row) return false;
  // RESOLVED is still a legitimate "this happened, and is now closed" state
  // a segment can validly describe (e.g. an ELIMINATION segment about a
  // player who has since been formally resolved out); ARCHIVED is the point
  // 11.6 actually means by "no longer active".
  return row.lifecycle !== "ARCHIVED";
}

async function isRuleStillValid(rule: ValidityRule, cache: StandingsCache): Promise<boolean> {
  switch (rule.kind) {
    case "storyStillActive": return isStoryRowStillActive(rule.storyId);
    case "leaderIs": return isEntityCurrentLeader(cache, rule.leagueType, rule.entityId);
    case "entityActive": return isEntityActiveNow(cache, rule.leagueType, rule.entityId);
    case "winStreakIntactSince": return !(await hasLostSince(rule.leagueType, rule.entityId, new Date(rule.sinceInstant)));
    case "titleProbabilityBand": return (await currentTitleProbabilityBand(rule.leagueType, rule.entityId)) === rule.band;
  }
}

async function isSegmentStillValid(rules: readonly ValidityRule[], cache: StandingsCache): Promise<boolean> {
  const results = await Promise.all(rules.map(rule => isRuleStillValid(rule, cache)));
  return results.every(Boolean);
}

async function computeInvalidSegmentIds(programme: EditionProgramme | null, cache: StandingsCache): Promise<string[]> {
  if (!programme) return [];
  const invalid: string[] = [];
  for (const segment of programme.segments) {
    if (segment.validityRules.length === 0) continue; // utility segments — nothing to check, never invalid
    if (!(await isSegmentStillValid(segment.validityRules, cache))) invalid.push(programmeSegmentId(segment));
  }
  return invalid;
}

// ═══════════════════════════════════════════════════════════════════════
// 11.4/11.5 overlays
// ═══════════════════════════════════════════════════════════════════════

export type LiveOverlayItem = {
  storyId: number;
  leagueType: LeagueType;
  storyType: string;
  subjectKeys: string[];
  score: number;
  overlayClass: LiveOverlayClass;
};

function computeOverlays(freshStories: readonly BroadcastStory[], matchPlayedAtById: ReadonlyMap<number, Date>, now: Date): LiveOverlayItem[] {
  const overlays: LiveOverlayItem[] = [];
  for (const story of freshStories) {
    const overlayClass = classifyLiveScore(story.score);
    if (!overlayClass) continue;
    const ageReference = (story.anchorMatchId !== null ? matchPlayedAtById.get(story.anchorMatchId) : undefined) ?? story.detectedAt;
    if (!isWithinOverlayAgeWindow(ageReference, now)) continue;
    overlays.push({ storyId: story.id, leagueType: story.leagueType, storyType: story.storyType, subjectKeys: story.subjectKeys, score: story.score, overlayClass });
  }
  return overlays;
}

// ═══════════════════════════════════════════════════════════════════════
// C.2 getLivePayload
// ═══════════════════════════════════════════════════════════════════════

export type LiveTickerItem = { matchId: number; leagueType: LeagueType; winnerId: number; loserId: number; playedAt: string };

export type LivePayload = {
  currentEditionId: number | null;
  leaders: LiveLeaders;
  tickerItems: LiveTickerItem[];
  overlays: LiveOverlayItem[];
  invalidSegmentIds: string[];
};

export async function getLivePayload(now: Date = new Date()): Promise<LivePayload> {
  const previous = await latestPublishedEdition();
  const cutoffStart = previous?.dataCutoff ?? new Date(0); // "beginningOfRelevantHistory" — same convention as edition-engine.ts's own first-ever-build case

  // See this file's own header for why this stays cheap on every poll.
  await detectAndUpdateStories({ cutoffStart, cutoffEnd: now });

  const [recentMatches, freshStories] = await Promise.all([
    loadRecentMatches(cutoffStart, now),
    db.select().from(broadcastStoriesTable).where(and(gt(broadcastStoriesTable.updatedAt, cutoffStart), lte(broadcastStoriesTable.updatedAt, now))),
  ]);

  const matchPlayedAtById = new Map(recentMatches.map(m => [m.matchId, m.playedAt] as const));
  const standingsCache: StandingsCache = new Map();
  const previousProgramme = previous && isEditionProgramme(previous.programme) ? previous.programme : null;

  const [leaders, invalidSegmentIds] = await Promise.all([
    getLeaders(standingsCache),
    computeInvalidSegmentIds(previousProgramme, standingsCache),
  ]);

  return {
    currentEditionId: previous?.id ?? null,
    leaders,
    tickerItems: recentMatches.map(m => ({ matchId: m.matchId, leagueType: m.leagueType, winnerId: m.winnerId, loserId: m.loserId, playedAt: m.playedAt.toISOString() })),
    overlays: computeOverlays(freshStories, matchPlayedAtById, now),
    invalidSegmentIds,
  };
}
