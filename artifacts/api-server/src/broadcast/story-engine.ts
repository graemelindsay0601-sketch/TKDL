// TKDL LIVE — Story Engine: the DB-facing orchestrator (handover doc
// section 9). This is the last piece of Section 9: every story-detectors-*.ts
// file is a pure function of already-gathered facts to StoryCandidate[]
// (zero DB access, unit tested directly); this file is what actually
// gathers those facts from real data — reusing history-reconstruction.ts,
// match-predictor.ts, title-predictor.ts and their team equivalents exactly
// the way those files already reuse each other — resolves each candidate's
// persistent identity, fills in the two components only an orchestrator can
// compute (freshness, narrativeContinuity), and upserts the result into
// broadcast_stories.
//
// DB-FACING, NOT UNIT TESTED: like history-reconstruction.ts, match-
// predictor.ts, title-predictor.ts and their team-*.ts equivalents — every
// other file in this folder that talks to the real database — this file has
// no dedicated test file. It's verified the same way those are: typecheck +
// build clean, and by construction from the already-tested pure layers
// underneath it (story-engine-math.ts, story-types.ts, every
// story-detectors-*.ts). Introducing a DB-mocking harness just for this one
// file would be inconsistent with how every sibling orchestration file in
// this codebase is already held to the same bar.
//
// SCOPE BOUNDARY — 9.6's story merging is NOT implemented here. Appendix
// C.1's own buildEdition() pseudocode settles this precisely:
//   storyState = detectAndUpdateStories(newMatches, cutoffEnd)   <- this file
//   ...
//   pool = collectNewAndActiveStories()
//   merged = mergeStoriesByAnchorAndNarrative(pool)              <- NOT this file
//   runningOrder = directorSelect(merged, titleSnapshots)
// mergeStoriesByAnchorAndNarrative runs OVER the pool AFTER detection, as
// part of Edition Assembly (sections 10-11), which remain a later phase per
// the project's own "build the full spec, in order" plan. This file's job
// ends at producing correctly-identified, correctly-scored, correctly-
// lifecycled rows in broadcast_stories — one row per real situation, never
// artificially merged. detectAndUpdateStories() is this file's equivalent of
// the pseudocode's own function of the same name; collectNewAndActiveStories()
// is also implemented here (it's a trivial read of this file's own output),
// ready for the Director to call once section 10 exists.
//
// SEASON-SCOPED IDENTITY — a judgment call worth flagging up front. Most
// story-detectors-*.ts files hand back a StoryCandidate with no seasonId at
// all; story-engine-math.ts's subjectAnchoredStoryKey() (leagueType +
// storyType + sorted subjectKeys) is enough for most of them because their
// own underlying facts already reset naturally at a season boundary (a win
// streak, a season-vs-career rate). But standings-based situations don't:
// the SAME Singles player can be crowned CHAMPION in season 3 and again in
// season 11, and Shift Wars' three departments are permanent, fixed teams
// that play every single month — reusing bare subjectAnchoredStoryKey for
// those would collide two genuinely different seasons' events onto the same
// row. story-engine-math.ts's new seasonAnchoredStoryKey() (added alongside
// this file) fixes that; it's used for the whole LEAGUE and SHIFT_WARS
// families plus ARCHIVE's SEASON_COMPARISON. Doubles doesn't need it — its
// team ids are fresh, never-reused per-season rows (team-history-
// reconstruction.ts's own header), so a Doubles team id can't collide
// across seasons in the first place.
//
// TITLE PREDICTOR CACHING — Appendix C.1 lists `titleSnapshots =
// runTitlePredictorsOnce()` as happening AFTER `detectAndUpdateStories(...)`,
// yet the LEAGUE family (TITLE_SWING, NEW_FAVOURITE, DEAD_HEAT, TITLE_RACE)
// needs real title probabilities as its core input, which only the Title
// Predictor can supply. The schema comment on broadcast_prediction_snapshots
// resolves this: "Title Predictor runs are explicitly not meant to re-run on
// every viewer request" — the whole point of that table is ONE canonical run
// per something, cached and reused everywhere else. This file is the thing
// that runs it (once per league/season per detectAndUpdateStories() call),
// stores the result there, and reads back the immediately preceding stored
// snapshot as the `previous` comparison point every "since last Edition"
// LEAGUE detector needs. A future Director reads the same cached row rather
// than re-simulating — consistent with, not a contradiction of, the doc's
// own stated intent.
import { and, asc, desc, eq, gt, inArray, like, lt, lte, or, sql } from "drizzle-orm";
import {
  db,
  matchesTable,
  playersTable,
  seasonsTable,
  seasonStandingsTable,
  broadcastStoriesTable,
  broadcastPredictionSnapshotsTable,
  type LeagueType,
  type BroadcastStory,
} from "@workspace/db";
import {
  buildSinglesTimeline, buildH2HBefore, buildPlayerBaselines, buildLeagueActivityProfile,
  getDoublesPreMatchContext,
  buildDoublesTeamTimeline,
  buildShiftWarsTeamTimeline,
  SINGLES_ONLY,
  type SinglesMatchState, type PlayerBaselines, type H2HRecord,
} from "./history-reconstruction";
import { teamStateAsOf, getShiftWarsStartingPoints, DOUBLES_STARTING_ELO } from "./team-history-reconstruction";
import type { TeamMatchState, TeamState } from "./team-timeline-replay";
import { SINGLES_SEASON_STARTING_POINTS, type SinglesPlayerState } from "./timeline-replay";
import { DOUBLES_STARTING_POINTS } from "../lib/doublesDraw";
import { predictSinglesMatch, buildGameTypeCohort } from "./match-predictor";
import { predictSinglesTitle } from "./title-predictor";
import { predictDoublesMatch, getDoublesTeamRoster, resolveShiftWarsSeasonForCutoff } from "./team-match-predictor";
import { predictDoublesTitle, predictShiftWarsTitle } from "./team-title-predictor";
import { daysRemainingInMonth } from "./title-predictor-math";
import {
  smoothedRate, PRIOR_GAMES, scoringEvents, scoringRate30, percentileRank, MIN_CHECKOUT_ATTEMPTS,
  confidenceScore,
} from "./predictor-math";
import {
  SCORE_MAX, totalScore, freshnessComponent, highStakeThreshold, treatmentForScore,
  subjectKey, matchAnchoredStoryKey, subjectAnchoredStoryKey, seasonAnchoredStoryKey, seasonAnchoredStoryKeyPrefix,
  nextLifecycle,
  type StoryScoreComponents, type StoryFreshnessClass, type StoryLifecycle,
} from "./story-engine-math";
import {
  familyForStoryType, FORM_STORY_TYPES, H2H_STORY_TYPES, SHIFT_WARS_STORY_TYPES,
  type StoryCandidate, type StoryType, type StoryFamily,
} from "./story-types";
import { detectResultStories, type SinglesResultMatchFacts } from "./story-detectors-result";
import { detectFormStories, type SinglesFormFacts } from "./story-detectors-form";
import { detectH2HStories, type SinglesH2HFacts } from "./story-detectors-h2h";
import { detectPerformanceStories, type SinglesPerformanceFacts } from "./story-detectors-performance";
import { detectLeagueStories, detectChampion as detectChampionOnly, type LeagueStandingsFacts, type LeagueEntityStanding } from "./story-detectors-league";
import { detectMilestoneStories, type SinglesMilestoneFacts } from "./story-detectors-milestone";
import { detectDoublesMatchStories, detectDoublesFormStories, type DoublesMatchResultFacts, type DoublesTeamFormFacts } from "./story-detectors-doubles";
import { detectShiftWarsStories, type ShiftWarsStandingsFacts, type ShiftWarsTeamStanding, type ShiftWarsDeficitWindow } from "./story-detectors-shift-wars";
import { detectArchiveH2HStories, detectSeasonComparison, type ArchiveH2HFacts, type SeasonComparisonFacts } from "./story-detectors-archive";

const MODEL_VERSION = "story-engine-v1";
const DEFAULT_GAME_TYPE = "501";

// ═══════════════════════════════════════════════════════════════════════
// Shared identity, scoring and persistence helpers
// ═══════════════════════════════════════════════════════════════════════

/**
 * The freshness class (9.5) for a story type. RESULT, PERFORMANCE (a
 * single match's own darts stats) and DOUBLES' match-anchored pair are all
 * one-off match snapshots -> "result" (12h half-life). MILESTONE plus
 * PERFORMANCE's two record types (SEASON_BEST/PERSONAL_BEST really ARE
 * milestones/records, just filed under PERFORMANCE by Appendix A) -> 72h.
 * Everything else — ongoing form/standings/rivalry situations — is
 * "persistent" (48h), matching 9.5's own "persistent form/title stories"
 * language.
 */
function freshnessClassForStoryType(storyType: StoryType): StoryFreshnessClass {
  if (storyType === "SEASON_BEST" || storyType === "PERSONAL_BEST") return "milestone";
  const family = familyForStoryType(storyType);
  switch (family) {
    case "RESULT":
      return "result";
    case "PERFORMANCE":
      return "result";
    case "MILESTONE":
      return "milestone";
    case "DOUBLES":
      return storyType === "PAIR_UPSET" || storyType === "PAIR_ELIMINATED" ? "result" : "persistent";
    case "FORM":
    case "H2H":
    case "LEAGUE":
    case "SHIFT_WARS":
    case "ARCHIVE":
    // Evergreen filler is re-upserted every single edition build (see this
    // file's own FILLER section, and story-detectors-filler.ts's header),
    // so detectedAt barely ever ages in the first place — "persistent"
    // just means it doesn't get penalised for that the way a one-off
    // "result" story would.
    case "FILLER":
      return "persistent";
  }
}

/**
 * 9.2: "Develops or resolves an existing active story." Awarded in full
 * when this detection continues a story that was already NEW/HOT/ACTIVE/
 * COOLING as of the previous pass — a brand-new story (previousLifecycle
 * null) or one restarting fresh after RESOLVED/ARCHIVED (nextLifecycle's
 * own rule reads that as "NEW", not a continuation) hasn't developed
 * anything yet, so it scores 0 here.
 */
function narrativeContinuityComponent(previousLifecycle: StoryLifecycle | null): number {
  if (previousLifecycle === "NEW" || previousLifecycle === "HOT" || previousLifecycle === "ACTIVE" || previousLifecycle === "COOLING") {
    return SCORE_MAX.narrativeContinuity;
  }
  return 0;
}

/**
 * Every LEAGUE/SHIFT_WARS/SEASON_COMPARISON story is season-anchored (see
 * module header); everything else uses the plain match- or
 * subject-anchored key. story-engine.ts is the one place that decides
 * which shape applies — detectors never compute a storyKey themselves.
 */
const SEASON_ANCHORED_TYPES: ReadonlySet<StoryType> = new Set<StoryType>([
  "NEW_LEADER", "LEAD_TIGHTENS", "LEAD_WIDENS", "TITLE_SWING", "NEW_FAVOURITE",
  "DEAD_HEAT", "TITLE_RACE", "CHAMPION", "TIE_PENDING",
  "SHIFT_LEAD_CHANGE", "SHIFT_MOMENTUM", "SHIFT_COMEBACK", "SHIFT_DOMINANCE",
  "SEASON_COMPARISON",
]);

function resolveStoryKey(candidate: StoryCandidate, seasonId: number | null): string {
  if (SEASON_ANCHORED_TYPES.has(candidate.storyType)) {
    if (seasonId === null) {
      throw new Error(`resolveStoryKey: ${candidate.storyType} is season-anchored but no seasonId was supplied`);
    }
    return seasonAnchoredStoryKey(candidate.leagueType, candidate.storyType, seasonId, candidate.subjectKeys);
  }
  if (candidate.anchorMatchId !== undefined) {
    return matchAnchoredStoryKey(candidate.leagueType, candidate.storyType, candidate.anchorMatchId);
  }
  return subjectAnchoredStoryKey(candidate.leagueType, candidate.storyType, candidate.subjectKeys);
}

export type UpsertedStory = { row: BroadcastStory; isNew: boolean };

/**
 * Resolves identity, fills in freshness + narrativeContinuity (the two
 * components no detector can compute itself — see story-engine-math.ts's
 * own PartialStoryScoreComponents comment), computes score/lifecycle, and
 * upserts. `confidence` is passed in separately rather than added to
 * StoryCandidate: the doc's 9.1 story object has a confidence field, but
 * section 9 gives no formula for it at all, and every already-committed
 * detector file's StoryCandidate return type has no such field. Rather
 * than retrofit nine already-tested files for an undocumented column, this
 * file computes confidence itself at each gather site (see e.g.
 * gatherSinglesResultFacts's caller) from whatever real predictor/sample-
 * size data is already on hand there — documented per family below, same
 * 0-100 scale confidenceScore()/titleConfidenceScore() already use
 * everywhere else in this codebase.
 */
async function upsertStoryCandidate(candidate: StoryCandidate, confidence: number, now: Date, seasonId: number | null): Promise<UpsertedStory> {
  const storyKey = resolveStoryKey(candidate, seasonId);
  const [existing] = await db.select().from(broadcastStoriesTable).where(eq(broadcastStoriesTable.storyKey, storyKey)).limit(1);

  const previousLifecycle: StoryLifecycle | null = (existing?.lifecycle as StoryLifecycle | undefined) ?? null;
  const previousScore = existing?.score ?? null;
  const detectedAt = existing?.detectedAt ?? now;

  const freshnessClass = freshnessClassForStoryType(candidate.storyType);
  const hoursSinceDetected = (now.getTime() - detectedAt.getTime()) / (1000 * 60 * 60);
  const freshness = freshnessComponent(hoursSinceDetected, freshnessClass);
  const narrativeContinuity = narrativeContinuityComponent(previousLifecycle);

  const fullComponents: StoryScoreComponents = { ...candidate.components, freshness, narrativeContinuity };
  const score = totalScore(fullComponents);
  const lifecycle = nextLifecycle({ previousLifecycle, stillDetected: true, previousScore, currentScore: score });

  // typeof ...$inferInsert, not the exported InsertBroadcastStory (drizzle-zod's
  // createInsertSchema widens every text().$type<T>() override — leagueType,
  // lifecycle, sentiment — back down to plain `string`, which is too loose to
  // safely assign candidate.leagueType/lifecycle/sentiment into). $inferInsert
  // respects the column-level $type<T>() overrides directly.
  const values: typeof broadcastStoriesTable.$inferInsert = {
    storyKey,
    leagueType: candidate.leagueType,
    storyType: candidate.storyType,
    subjectKeys: candidate.subjectKeys,
    anchorMatchId: candidate.anchorMatchId ?? null,
    detectedAt,
    updatedAt: now,
    resolvedAt: null,
    lifecycle,
    score,
    confidence,
    sentiment: candidate.sentiment,
    facts: candidate.facts,
    tags: candidate.tags,
    lastFullEditionId: existing?.lastFullEditionId ?? null,
    lastHeadlineEditionId: existing?.lastHeadlineEditionId ?? null,
    fullCount: existing?.fullCount ?? 0,
    headlineCount: existing?.headlineCount ?? 0,
  };

  const [row] = await db
    .insert(broadcastStoriesTable)
    .values(values)
    .onConflictDoUpdate({
      target: broadcastStoriesTable.storyKey,
      set: {
        leagueType: values.leagueType,
        storyType: values.storyType,
        subjectKeys: values.subjectKeys,
        anchorMatchId: values.anchorMatchId,
        updatedAt: values.updatedAt,
        resolvedAt: values.resolvedAt,
        lifecycle: values.lifecycle,
        score: values.score,
        confidence: values.confidence,
        sentiment: values.sentiment,
        facts: values.facts,
        tags: values.tags,
      },
    })
    .returning();

  return { row, isNew: !existing };
}

/**
 * For a subject-anchored family with ONE fixed subject-key list per
 * evaluation (FORM: one player; H2H/ARCHIVE H2H: one pair; DOUBLES form:
 * one team) — resolves any of that family's OTHER story types, for this
 * exact subject list, that fired last time but didn't fire this pass, to
 * RESOLVED. This is the "stillDetected: false" half of nextLifecycle()
 * that a pure detector can never trigger on its own (it only ever returns
 * candidates for what IS true right now, never a list of what stopped
 * being true).
 */
async function resolveUndetectedSubjectStories(params: {
  leagueType: LeagueType;
  storyTypesInFamily: readonly string[];
  subjectKeys: string[];
  detectedTypes: ReadonlySet<string>;
  now: Date;
}): Promise<void> {
  for (const storyType of params.storyTypesInFamily) {
    if (params.detectedTypes.has(storyType)) continue;
    const key = subjectAnchoredStoryKey(params.leagueType, storyType, params.subjectKeys);
    const [existingRow] = await db.select().from(broadcastStoriesTable).where(eq(broadcastStoriesTable.storyKey, key)).limit(1);
    if (!existingRow) continue;
    if (existingRow.lifecycle === "RESOLVED" || existingRow.lifecycle === "ARCHIVED") continue;
    await db.update(broadcastStoriesTable)
      .set({ lifecycle: "RESOLVED", resolvedAt: params.now, updatedAt: params.now })
      .where(eq(broadcastStoriesTable.id, existingRow.id));
  }
}

/**
 * The season-anchored equivalent, for LEAGUE/SHIFT_WARS: these families
 * DON'T share one fixed subject list across all their story types within
 * one evaluation (TITLE_RACE's subjects are whichever entities are
 * currently viable, which shrinks as the race narrows), so there's no
 * single storyKey to check per type the way resolveUndetectedSubjectStories
 * can. Instead this scans every currently-unresolved row under this
 * (league, storyType, season)'s own key PREFIX and resolves whichever ones
 * aren't among this pass's own freshly-computed keys.
 */
async function resolveUndetectedSeasonStories(params: {
  leagueType: LeagueType;
  storyTypesInFamily: readonly string[];
  seasonId: number;
  detectedKeysByType: ReadonlyMap<string, Set<string>>;
  now: Date;
}): Promise<void> {
  for (const storyType of params.storyTypesInFamily) {
    const prefix = seasonAnchoredStoryKeyPrefix(params.leagueType, storyType, params.seasonId);
    const detectedKeys = params.detectedKeysByType.get(storyType) ?? new Set<string>();
    const candidateRows = await db.select().from(broadcastStoriesTable).where(
      and(
        like(broadcastStoriesTable.storyKey, `${prefix}%`),
        inArray(broadcastStoriesTable.lifecycle, ["NEW", "HOT", "ACTIVE", "COOLING"]),
      ),
    );
    for (const row of candidateRows) {
      if (detectedKeys.has(row.storyKey)) continue;
      await db.update(broadcastStoriesTable)
        .set({ lifecycle: "RESOLVED", resolvedAt: params.now, updatedAt: params.now })
        .where(eq(broadcastStoriesTable.id, row.id));
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Small cross-cutting helpers
// ═══════════════════════════════════════════════════════════════════════

/** The Singles counterpart to team-history-reconstruction.ts's own teamStateAsOf() — same logic, SinglesPlayerState shape. */
function playerStateAsOf(timeline: SinglesMatchState[], playerId: number, cutoff: Date, initial: SinglesPlayerState): SinglesPlayerState {
  let latest = initial;
  for (const entry of timeline) {
    if (entry.playedAt >= cutoff) break;
    if (entry.winnerId === playerId) latest = entry.winnerAfter;
    else if (entry.loserId === playerId) latest = entry.loserAfter;
  }
  return latest;
}

function initialSinglesPlayerState(): SinglesPlayerState {
  return {
    points: SINGLES_SEASON_STARTING_POINTS,
    seasonWins: 0, seasonLosses: 0, seasonGamesPlayed: 0,
    currentWinStreak: 0, currentLossStreak: 0,
    recentForm: [], isEliminated: false,
  };
}

/** Days in the Europe/London calendar month `referenceNow` falls in — timezone-independent (a month's length doesn't depend on which zone you're reading the date in), just needs the right YEAR/MONTH, hence the Intl lookup. */
function daysInLondonMonth(referenceNow: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/London", year: "numeric", month: "2-digit" })
    .formatToParts(referenceNow)
    .reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {} as Record<string, string>);
  const year = Number(parts.year);
  const month = Number(parts.month);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 9.2: "stronger late in month." 0 at the start of the calendar month, 1 at its end — title-predictor-math.ts's own daysRemainingInMonth(), inverted and normalized by that month's actual length. */
function monthProgress(referenceNow: Date): number {
  const remaining = daysRemainingInMonth(referenceNow);
  const total = daysInLondonMonth(referenceNow);
  return Math.max(0, Math.min(1, 1 - remaining / total));
}

/** Ranks `standings` (entityId -> points) descending and returns entityId's 1-based rank, or null if entityId isn't present. */
function rankByPointsDesc(standings: { entityId: number; points: number }[], entityId: number): number | null {
  const sorted = [...standings].sort((a, b) => b.points - a.points);
  const idx = sorted.findIndex(s => s.entityId === entityId);
  return idx === -1 ? null : idx + 1;
}

// ═══════════════════════════════════════════════════════════════════════
// New-match loading
// ═══════════════════════════════════════════════════════════════════════

export type NewSinglesMatch = { id: number; seasonId: number; playedAt: Date; winnerId: number; loserId: number; gameType: string };
export type NewTeamMatch = { id: number; playedAt: Date; winnerTeamId: number; loserTeamId: number };
export type NewDoublesMatch = NewTeamMatch & { seasonId: number };

export type NewMatchesWindow = {
  singles: NewSinglesMatch[];
  doubles: NewDoublesMatch[];
  shiftWars: NewTeamMatch[];
};

async function loadNewMatchesSince(cutoffStart: Date, cutoffEnd: Date): Promise<NewMatchesWindow> {
  const singlesRows = await db
    .select({ id: matchesTable.id, seasonId: matchesTable.seasonId, playedAt: matchesTable.playedAt, winnerId: matchesTable.winnerId, loserId: matchesTable.loserId, gameType: matchesTable.gameType })
    .from(matchesTable)
    .where(and(SINGLES_ONLY, gt(matchesTable.playedAt, cutoffStart), lte(matchesTable.playedAt, cutoffEnd)))
    .orderBy(asc(matchesTable.playedAt), asc(matchesTable.id));

  const doublesRows = (await db.execute(sql`
    SELECT id, played_at, winner_team_id, loser_team_id, season_id FROM doubles_matches
    WHERE played_at > ${cutoffStart} AND played_at <= ${cutoffEnd}
    ORDER BY played_at ASC, id ASC
  `)).rows as { id: number; played_at: string | Date; winner_team_id: number; loser_team_id: number; season_id: number }[];

  const shiftWarsRows = (await db.execute(sql`
    SELECT id, played_at, winner_team_id, loser_team_id FROM shift_wars_matches
    WHERE played_at > ${cutoffStart} AND played_at <= ${cutoffEnd}
    ORDER BY played_at ASC, id ASC
  `)).rows as { id: number; played_at: string | Date; winner_team_id: number; loser_team_id: number }[];

  return {
    singles: singlesRows,
    doubles: doublesRows.map(r => ({ id: r.id, playedAt: new Date(r.played_at), winnerTeamId: r.winner_team_id, loserTeamId: r.loser_team_id, seasonId: r.season_id })),
    shiftWars: shiftWarsRows.map(r => ({ id: r.id, playedAt: new Date(r.played_at), winnerTeamId: r.winner_team_id, loserTeamId: r.loser_team_id })),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Singles: RESULT + PERFORMANCE + MILESTONE (match-anchored)
// ═══════════════════════════════════════════════════════════════════════

/**
 * A player's full (uncapped) Singles match history with darts detail,
 * gathered ONCE per (player, cutoff) and reused for both the
 * MILESTONE family's career-total scans and the PERFORMANCE family's
 * season/career record scans — buildPlayerBaselines' own detailedMatches
 * is capped at 10 (a deliberate "recent baseline" cap, section 7.4), which
 * is exactly wrong for "has this player EVER thrown this many 180s" or
 * "is this their all-time-best scoring match" — both need the whole
 * history, not the last 10.
 */
type FullSinglesHistoryRow = {
  seasonId: number;
  playedAt: Date;
  won: boolean;
  darts: number | null;
  scoring100s: number;
  scoring140s: number;
  scoring170s: number;
  /** Kept nullable, unlike the others — a null here (as opposed to a genuine 0) means this specific match's 180 count was never recorded, which matters for 180_MILESTONE's own reliability check below. */
  scoring180sRaw: number | null;
  checkoutAttempts: number;
  checkoutHits: number;
};

async function fetchFullSinglesHistory(playerId: number, cutoff: Date): Promise<FullSinglesHistoryRow[]> {
  const rows = await db
    .select({
      seasonId: matchesTable.seasonId, playedAt: matchesTable.playedAt,
      winnerId: matchesTable.winnerId, loserId: matchesTable.loserId,
      winnerDarts: matchesTable.winnerDarts, winner100s: matchesTable.winner100s, winner140s: matchesTable.winner140s, winner170s: matchesTable.winner170s, winner180s: matchesTable.winner180s,
      winnerCheckoutAttempts: matchesTable.winnerCheckoutAttempts, winnerCheckoutHits: matchesTable.winnerCheckoutHits,
      loserDarts: matchesTable.loserDarts, loser100s: matchesTable.loser100s, loser140s: matchesTable.loser140s, loser170s: matchesTable.loser170s, loser180s: matchesTable.loser180s,
      loserCheckoutAttempts: matchesTable.loserCheckoutAttempts, loserCheckoutHits: matchesTable.loserCheckoutHits,
    })
    .from(matchesTable)
    .where(and(SINGLES_ONLY, lt(matchesTable.playedAt, cutoff), or(eq(matchesTable.winnerId, playerId), eq(matchesTable.loserId, playerId))));

  return rows.map(r => {
    const won = r.winnerId === playerId;
    return {
      seasonId: r.seasonId,
      playedAt: r.playedAt,
      won,
      darts: won ? r.winnerDarts : r.loserDarts,
      scoring100s: (won ? r.winner100s : r.loser100s) ?? 0,
      scoring140s: (won ? r.winner140s : r.loser140s) ?? 0,
      scoring170s: (won ? r.winner170s : r.loser170s) ?? 0,
      scoring180sRaw: won ? r.winner180s : r.loser180s,
      checkoutAttempts: (won ? r.winnerCheckoutAttempts : r.loserCheckoutAttempts) ?? 0,
      checkoutHits: (won ? r.winnerCheckoutHits : r.loserCheckoutHits) ?? 0,
    };
  });
}

/** null if ANY prior match in this player's own recorded history is missing 180 data — an undercounted "career total" would be worse than none, per Appendix A's own "only if reliable historical totals can be derived." */
function sumCareer180sReliably(rows: FullSinglesHistoryRow[]): number | null {
  let total = 0;
  for (const r of rows) {
    if (r.scoring180sRaw === null) return null;
    total += r.scoring180sRaw;
  }
  return total;
}

/** The max scoringRate30 among this player's own prior detailed matches — season-scoped when `seasonId` is given, career-wide when null. Null with no prior detailed match to compare against (nothing to prove a record against). */
function maxPriorScoringRate30(rows: FullSinglesHistoryRow[], seasonId: number | null): number | null {
  const relevant = rows.filter(r => r.darts !== null && (seasonId === null || r.seasonId === seasonId));
  if (relevant.length === 0) return null;
  return Math.max(...relevant.map(r =>
    scoringRate30(scoringEvents({ s100: r.scoring100s, s140: r.scoring140s, s170: r.scoring170s, s180: r.scoring180sRaw ?? 0 }), r.darts!),
  ));
}

/** Raw (not percentile) own-baseline rates from a player's capped recent-10 detailedMatches — the same aggregation match-predictor.ts's dartsFeature() does internally, just exposing the rate itself instead of blending it into a percentile-combined predictor value. */
function ownDartsBaseline(baselines: PlayerBaselines): { scoringRate30: number | null; checkoutRate: number | null } {
  const n = baselines.detailedMatches.length;
  if (n === 0) return { scoringRate30: null, checkoutRate: null };
  let totalEvents = 0, totalDarts = 0, totalHits = 0, totalAttempts = 0;
  for (const m of baselines.detailedMatches) {
    totalEvents += scoringEvents({ s100: m.scoring100s, s140: m.scoring140s, s170: m.scoring170s, s180: m.scoring180s });
    totalDarts += m.darts;
    totalHits += m.checkoutHits;
    totalAttempts += m.checkoutAttempts;
  }
  return {
    scoringRate30: scoringRate30(totalEvents, totalDarts),
    checkoutRate: totalAttempts >= MIN_CHECKOUT_ATTEMPTS ? totalHits / totalAttempts : null,
  };
}

type SinglesBatchContext = {
  cutoffEnd: Date;
  /** Cached per season within one detectAndUpdateStories() call. */
  timelines: Map<number, SinglesMatchState[]>;
  highStakeThresholds: Map<number, number>;
  activePlayerIds: number[];
};

async function getSinglesTimeline(ctx: SinglesBatchContext, seasonId: number): Promise<SinglesMatchState[]> {
  let timeline = ctx.timelines.get(seasonId);
  if (!timeline) {
    timeline = await buildSinglesTimeline(seasonId);
    ctx.timelines.set(seasonId, timeline);
  }
  return timeline;
}

async function getHighStakeThreshold(ctx: SinglesBatchContext, seasonId: number): Promise<number> {
  let threshold = ctx.highStakeThresholds.get(seasonId);
  if (threshold === undefined) {
    const profile = await buildLeagueActivityProfile("singles", seasonId, ctx.cutoffEnd);
    threshold = highStakeThreshold(profile.positiveStakes);
    ctx.highStakeThresholds.set(seasonId, threshold);
  }
  return threshold;
}

/** True if `loserId` held the outright points lead among currently-active players immediately before this match. */
async function wasLoserLeaderBefore(ctx: SinglesBatchContext, timeline: SinglesMatchState[], loserId: number, matchPlayedAt: Date): Promise<boolean> {
  const standings = ctx.activePlayerIds.map(id => ({
    entityId: id,
    points: playerStateAsOf(timeline, id, matchPlayedAt, initialSinglesPlayerState()).points,
  }));
  const maxPoints = Math.max(...standings.map(s => s.points));
  const leaders = standings.filter(s => s.points === maxPoints);
  // A pre-existing multi-way tie for the lead has no single "the leader" to
  // have beaten — LEADER_BEATEN's own doc trigger ("current points leader
  // loses") reads as there being one.
  return leaders.length === 1 && leaders[0].entityId === loserId;
}

export type ScoredCandidate = { candidate: StoryCandidate; confidence: number };

async function processSinglesMatch(ctx: SinglesBatchContext, match: NewSinglesMatch): Promise<ScoredCandidate[]> {
  const timeline = await getSinglesTimeline(ctx, match.seasonId);
  const entry = timeline.find(t => t.matchId === match.id);
  if (!entry) return [];

  const [prediction, h2hBeforeMatch, highStake, leaderBefore] = await Promise.all([
    predictSinglesMatch(match.winnerId, match.loserId, match.seasonId, { cutoff: match.playedAt, gameType: match.gameType }),
    buildH2HBefore(match.winnerId, match.loserId, match.playedAt),
    getHighStakeThreshold(ctx, match.seasonId),
    wasLoserLeaderBefore(ctx, timeline, match.loserId, match.playedAt),
  ]);

  const resultFacts: SinglesResultMatchFacts = {
    matchId: match.id, playedAt: match.playedAt, winnerId: match.winnerId, loserId: match.loserId, stake: entry.stake,
    winnerBefore: entry.winnerBefore, loserBefore: entry.loserBefore, loserAfter: entry.loserAfter,
    winnerProbability: prediction.pA,
    h2hBeforeMatch,
    wasLoserLeaderBefore: leaderBefore,
    highStakeThreshold: highStake,
    monthProgress: monthProgress(match.playedAt),
  };
  const items: ScoredCandidate[] = detectResultStories(resultFacts).map(candidate => ({
    candidate,
    confidence: prediction.confidence,
  }));

  // ── PERFORMANCE (both sides, independently scored against their own history) ──
  const cohort = await buildGameTypeCohort(match.gameType, match.playedAt);
  for (const side of [{ playerId: match.winnerId, won: true }, { playerId: match.loserId, won: false }] as const) {
    const [baselines, fullHistory] = await Promise.all([
      buildPlayerBaselines(side.playerId, match.playedAt, match.seasonId),
      fetchFullSinglesHistory(side.playerId, match.playedAt),
    ]);
    const ownBaseline = ownDartsBaseline(baselines);
    const row = await matchRow(match.id);
    const checkoutAttempts = (side.won ? row.winnerCheckoutAttempts : row.loserCheckoutAttempts) ?? 0;
    const darts = side.won ? row.winnerDarts : row.loserDarts;
    const checkoutHits = side.won ? (row.winnerCheckoutHits ?? 0) : (row.loserCheckoutHits ?? 0);
    const events = scoringEvents({
      s100: (side.won ? row.winner100s : row.loser100s) ?? 0,
      s140: (side.won ? row.winner140s : row.loser140s) ?? 0,
      s170: (side.won ? row.winner170s : row.loser170s) ?? 0,
      s180: (side.won ? row.winner180s : row.loser180s) ?? 0,
    });
    const thisScoringRate30 = darts !== null ? scoringRate30(events, darts) : 0;
    const scoringPercentile = darts !== null ? percentileRank(thisScoringRate30, cohort.scoringRates) : null;
    const checkoutPercentile = checkoutAttempts >= MIN_CHECKOUT_ATTEMPTS ? percentileRank(checkoutHits / checkoutAttempts, cohort.checkoutRates) : null;

    const seasonBestBar = maxPriorScoringRate30(fullHistory, match.seasonId);
    const careerBestBar = maxPriorScoringRate30(fullHistory, null);
    const isVerifiedSeasonBest = darts !== null && seasonBestBar !== null && thisScoringRate30 > seasonBestBar;
    const isVerifiedPersonalBest = darts !== null && careerBestBar !== null && thisScoringRate30 > careerBestBar;

    const performanceFacts: SinglesPerformanceFacts = {
      playerId: side.playerId, matchId: match.id, won: side.won,
      checkoutAttempts, checkoutHits, scoringRate30: thisScoringRate30,
      ownBaselineCheckoutRate: ownBaseline.checkoutRate, ownBaselineScoringRate30: ownBaseline.scoringRate30,
      checkoutPercentile, scoringPercentile,
      isVerifiedSeasonBest, isVerifiedPersonalBest,
      recordMetricLabel: (isVerifiedSeasonBest || isVerifiedPersonalBest) ? "scoringRate30" : null,
      recordMetricValue: (isVerifiedSeasonBest || isVerifiedPersonalBest) ? thisScoringRate30 : null,
    };
    const sideConfidence = confidenceScore({
      seasonGames: baselines.currentSeason?.gamesPlayed ?? 0,
      careerGames: baselines.career.gamesPlayed,
      h2hGames: h2hBeforeMatch.gamesPlayed,
      detailedMatches: baselines.detailedMatches.length,
      recentGames: baselines.recentResults.length,
    });
    for (const candidate of detectPerformanceStories(performanceFacts)) {
      items.push({ candidate, confidence: sideConfidence });
    }

    // ── MILESTONE (same side) ──
    const careerGamesBefore = baselines.career.gamesPlayed;
    const careerWinsBefore = baselines.career.wins;
    const career180sBefore = sumCareer180sReliably(fullHistory);
    const justEliminated = side.won ? false : (entry.loserAfter.isEliminated && !entry.loserBefore.isEliminated);

    const milestoneFacts: SinglesMilestoneFacts = {
      playerId: side.playerId, matchId: match.id, won: side.won,
      careerGamesPlayedAfter: careerGamesBefore + 1,
      careerWinsAfter: side.won ? careerWinsBefore + 1 : careerWinsBefore,
      career180sAfter: (career180sBefore === null || row.winner180s === null && row.loser180s === null)
        ? null
        : (career180sBefore + ((side.won ? row.winner180s : row.loser180s) ?? 0)),
      matchThrown180s: (side.won ? row.winner180s : row.loser180s) ?? 0,
      // eliminationsCount on players is the wrong direction (opponents THIS
      // player has eliminated, not times THIS player has been eliminated —
      // verified against routes/matches.ts's own increment site) and no
      // other counter tracks "times eliminated" at all, so per Appendix A's
      // own "only if EXISTING COUNTER supports the claim" (a narrower bar
      // than 180_MILESTONE's "only if reliable historical totals can be
      // DERIVED"), this always passes null — ELIMINATION_MILESTONE
      // structurally never fires in this implementation, which is the
      // honest answer given what this schema actually tracks, not a gap.
      careerEliminationsAfter: null,
      justEliminatedThisMatch: justEliminated,
    };
    // Milestones are exact counts straight off recorded match history, not
    // predictions — maximal confidence, same reasoning as SEASON_COMPARISON/
    // LAST_MEETING below.
    for (const candidate of detectMilestoneStories(milestoneFacts)) {
      items.push({ candidate, confidence: 100 });
    }
  }

  return items;
}

// A single match row is read multiple times above (once per side, for
// several different fields) — memoized per matchId within one batch run so
// repeatedly reading the SAME already-fetched match doesn't turn into
// repeated round trips.
const matchRowCache = new Map<number, Promise<typeof matchesTable.$inferSelect>>();
function matchRow(matchId: number): Promise<typeof matchesTable.$inferSelect> {
  let cached = matchRowCache.get(matchId);
  if (!cached) {
    cached = db.select().from(matchesTable).where(eq(matchesTable.id, matchId)).limit(1).then(rows => rows[0]);
    matchRowCache.set(matchId, cached);
  }
  return cached;
}

// ═══════════════════════════════════════════════════════════════════════
// Singles: FORM + H2H + ARCHIVE H2H + SEASON_COMPARISON (subject-anchored)
// ═══════════════════════════════════════════════════════════════════════

function ownMatchesAscending(timeline: SinglesMatchState[], playerId: number): SinglesMatchState[] {
  return timeline.filter(e => e.winnerId === playerId || e.loserId === playerId);
}

const POSITION_WINDOW_REFERENCE_MATCHES = 5;
const POSITION_WINDOW_MIN_MATCHES = 3; // mirrors story-detectors-form.ts's own POSITION_WINDOW_MIN_MATCHES; gather-side just needs to know whether attempting a window is worthwhile

function computeSinglesPositionWindow(ctx: SinglesBatchContext, timeline: SinglesMatchState[], playerId: number): { matches: number; positionBefore: number } | null {
  const own = ownMatchesAscending(timeline, playerId);
  const n = Math.min(POSITION_WINDOW_REFERENCE_MATCHES, own.length);
  if (n < POSITION_WINDOW_MIN_MATCHES) return null;
  const referenceCutoff = own[own.length - n].playedAt;
  const standings = ctx.activePlayerIds.map(id => ({ entityId: id, points: playerStateAsOf(timeline, id, referenceCutoff, initialSinglesPlayerState()).points }));
  const positionBefore = rankByPointsDesc(standings, playerId);
  return positionBefore === null ? null : { matches: n, positionBefore };
}

async function gatherSinglesFormFacts(
  ctx: SinglesBatchContext, timeline: SinglesMatchState[], playerId: number, currentPointsById: Map<number, number>, majorStoryPlayers: ReadonlySet<number>,
): Promise<{ facts: SinglesFormFacts; confidence: number }> {
  const baselines = await buildPlayerBaselines(playerId, ctx.cutoffEnd, undefined);
  const state = playerStateAsOf(timeline, playerId, ctx.cutoffEnd, initialSinglesPlayerState());
  const seasonRate = baselines.currentSeason ? smoothedRate(baselines.currentSeason.wins, baselines.currentSeason.gamesPlayed, PRIOR_GAMES.season) : 0.5;

  const currentStandings = ctx.activePlayerIds.map(id => ({ entityId: id, points: currentPointsById.get(id) ?? 0 }));
  const currentPosition = rankByPointsDesc(currentStandings, playerId) ?? currentStandings.length;

  const facts: SinglesFormFacts = {
    playerId,
    recentResultsNewestFirst: baselines.recentResults,
    currentWinStreak: state.currentWinStreak,
    currentLossStreak: state.currentLossStreak,
    seasonRate,
    currentPosition,
    positionWindow: computeSinglesPositionWindow(ctx, timeline, playerId),
    majorStoryAlreadyExplainsMove: majorStoryPlayers.has(playerId),
  };

  const confidence = confidenceScore({
    seasonGames: baselines.currentSeason?.gamesPlayed ?? 0,
    careerGames: baselines.career.gamesPlayed,
    h2hGames: 0,
    detailedMatches: 0,
    recentGames: baselines.recentResults.length,
  });

  return { facts, confidence };
}

function h2hRecordToSinglesFacts(playerAId: number, playerBId: number, h2h: H2HRecord): SinglesH2HFacts {
  return { playerAId, playerBId, aWins: h2h.aWins, bWins: h2h.bWins, gamesPlayed: h2h.gamesPlayed, recentMeetings: h2h.recentMeetings };
}

function h2hRecordToArchiveFacts(leagueType: LeagueType, entityAId: number, entityBId: number, h2h: H2HRecord): ArchiveH2HFacts {
  const last = h2h.recentMeetings[0] ?? null;
  return {
    leagueType, entityAId, entityBId, aWins: h2h.aWins, bWins: h2h.bWins, gamesPlayed: h2h.gamesPlayed,
    lastMeeting: last ? { matchId: last.matchId, playedAt: last.playedAt, winnerId: last.winnerId, stake: last.stake } : null,
  };
}

async function gatherSeasonComparisonFactsForPlayer(playerId: number, currentSeasonId: number, cutoffEnd: Date, currentPosition: number | null): Promise<SeasonComparisonFacts | null> {
  const [priorSeason] = await db
    .select()
    .from(seasonsTable)
    .where(and(eq(seasonsTable.leagueType, "singles"), sql`${seasonsTable.id} < ${currentSeasonId}`, sql`${seasonsTable.endDate} IS NOT NULL`))
    .orderBy(desc(seasonsTable.id))
    .limit(1);

  const baselines = await buildPlayerBaselines(playerId, cutoffEnd, currentSeasonId);
  const currentSeasonWinRate = baselines.currentSeason && baselines.currentSeason.gamesPlayed > 0
    ? baselines.currentSeason.wins / baselines.currentSeason.gamesPlayed
    : 0;

  if (!priorSeason) {
    return { leagueType: "singles", entityId: playerId, currentSeasonWinRate, previousSeasonWinRate: null, currentSeasonPosition: currentPosition, previousSeasonFinalPosition: null };
  }

  const [priorStanding] = await db
    .select()
    .from(seasonStandingsTable)
    .where(and(eq(seasonStandingsTable.seasonId, priorSeason.id), eq(seasonStandingsTable.playerId, playerId)))
    .limit(1);
  if (!priorStanding) {
    // Player wasn't part of that closed season at all (e.g. joined since) -- no prior data to compare against.
    return { leagueType: "singles", entityId: playerId, currentSeasonWinRate, previousSeasonWinRate: null, currentSeasonPosition: currentPosition, previousSeasonFinalPosition: null };
  }

  const priorGames = priorStanding.wins + priorStanding.losses;
  return {
    leagueType: "singles", entityId: playerId,
    currentSeasonWinRate,
    previousSeasonWinRate: priorGames > 0 ? priorStanding.wins / priorGames : 0,
    currentSeasonPosition: currentPosition,
    previousSeasonFinalPosition: priorStanding.position,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// LEAGUE family (cross-league — Singles, Doubles, Shift Wars alike)
// ═══════════════════════════════════════════════════════════════════════

/**
 * What story-engine.ts stores in broadcast_prediction_snapshots for
 * snapshotType "TITLE" — a superset of LeagueEntityStanding (adds wins/
 * losses) so the SAME cached snapshot row can serve both the LEAGUE
 * family's own diffing (current/previous LeagueEntityStanding[]) and, for
 * Shift Wars, the SHIFT_WARS family's own ShiftWarsTeamStanding[] "previous"
 * comparison — one Title Predictor run, reused for everything that needs
 * "what did the table look like last time", per the module header's
 * caching rationale.
 */
// Exported (not just for this file's own internal diffing) so live-events.ts
// can read back the identical shape when resolving a titleProbabilityBand
// validity rule's CURRENT probability, without a second, potentially-
// drifting redefinition of what this table's payload actually contains.
export type StoredStandingSnapshot = { entityId: number; points: number; wins: number; losses: number; titleProbability: number; isEliminated: boolean };

async function readPreviousSnapshot(leagueType: LeagueType, seasonId: number, before: Date): Promise<StoredStandingSnapshot[] | null> {
  const [row] = await db
    .select()
    .from(broadcastPredictionSnapshotsTable)
    .where(and(
      eq(broadcastPredictionSnapshotsTable.snapshotType, "TITLE"),
      eq(broadcastPredictionSnapshotsTable.leagueType, leagueType),
      eq(broadcastPredictionSnapshotsTable.seasonId, seasonId),
      lt(broadcastPredictionSnapshotsTable.generatedAt, before),
    ))
    .orderBy(desc(broadcastPredictionSnapshotsTable.generatedAt))
    .limit(1);
  return row ? (row.payload as StoredStandingSnapshot[]) : null;
}

async function writeSnapshot(leagueType: LeagueType, seasonId: number, generatedAt: Date, payload: StoredStandingSnapshot[]): Promise<void> {
  await db.insert(broadcastPredictionSnapshotsTable).values({
    snapshotType: "TITLE", leagueType, seasonId, matchId: null, editionId: null,
    generatedAt, modelVersion: MODEL_VERSION, payload,
  });
}

function toLeagueEntityStandings(snapshot: StoredStandingSnapshot[] | null): LeagueEntityStanding[] | null {
  return snapshot === null ? null : snapshot.map(s => ({ entityId: s.entityId, points: s.points, titleProbability: s.titleProbability, isEliminated: s.isEliminated }));
}

function toShiftWarsStandings(snapshot: StoredStandingSnapshot[] | null): ShiftWarsTeamStanding[] | null {
  return snapshot === null ? null : snapshot.map(s => ({ teamId: s.entityId, points: s.points, wins: s.wins, losses: s.losses }));
}

/** Whether `season` (already known to be closed) closed during this batch's own window — the concrete, checkable proxy this file uses for "a season just ended," since there's no Edition-level state yet to compare against directly (section 10-11 territory). */
function seasonEndedInWindow(season: typeof seasonsTable.$inferSelect, cutoffStart: Date, cutoffEnd: Date): boolean {
  if (season.isActive || !season.endDate) return false;
  const endedAt = new Date(`${season.endDate}T00:00:00Z`);
  return endedAt >= new Date(cutoffStart.toISOString().slice(0, 10)) && endedAt <= cutoffEnd;
}

async function resolveDoublesChampionTeamId(seasonId: number): Promise<number | null> {
  const rows = (await db.execute(sql`SELECT id FROM doubles_teams WHERE season_id = ${seasonId} ORDER BY points DESC, elo DESC LIMIT 1`)).rows as { id: number }[];
  return rows[0]?.id ?? null;
}

async function resolveShiftWarsChampionTeamId(seasonId: number): Promise<number | null> {
  const rows = (await db.execute(sql`SELECT team_id FROM shift_wars_season_history WHERE season_id = ${seasonId} AND is_champion = true LIMIT 1`)).rows as { team_id: number }[];
  return rows[0]?.team_id ?? null;
}

type LeagueGatherResult = { candidates: StoryCandidate[]; confidence: number; storyTypesRun: readonly StoryType[] };

/**
 * Builds LeagueStandingsFacts and runs the full LEAGUE family for one
 * league/season — OR, when that season just closed this batch, skips
 * straight to CHAMPION alone. Every OTHER LEAGUE detector depends on real
 * title-probability data (predictSinglesTitle/predictDoublesTitle/
 * predictShiftWarsTitle all THROW once a season has an endDate — "nothing
 * left to predict"), so forcing the full family through a fabricated
 * standings shape for a season that's already over would either crash or
 * risk manufacturing fake DEAD_HEAT/TITLE_RACE stories for a race that
 * doesn't exist anymore. CHAMPION is the one LEAGUE type that's ABOUT a
 * season having just ended, so it's handled on its own here.
 */
async function processLeagueFamily(leagueType: LeagueType, seasonId: number, cutoffStart: Date, cutoffEnd: Date): Promise<LeagueGatherResult> {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
  if (!season) return { candidates: [], confidence: 0, storyTypesRun: [] };

  if (seasonEndedInWindow(season, cutoffStart, cutoffEnd)) {
    let championEntityId: number | null = null;
    if (leagueType === "singles") championEntityId = season.championId;
    else if (leagueType === "doubles") championEntityId = await resolveDoublesChampionTeamId(seasonId);
    else championEntityId = await resolveShiftWarsChampionTeamId(seasonId);

    if (championEntityId === null) return { candidates: [], confidence: 100, storyTypesRun: ["CHAMPION"] };

    const facts: LeagueStandingsFacts = {
      leagueType, seasonId, current: [], previous: null,
      singlesTiePending: false, seasonJustEnded: true, championEntityId,
    };
    return { candidates: detectChampionOnly(facts), confidence: 100, storyTypesRun: ["CHAMPION"] };
  }

  if (season.endDate) {
    // Already closed, but not within THIS batch's window (an older season
    // that closed before story-engine.ts ever ran, or between runs in a way
    // this batch's cutoffStart doesn't cover) — nothing live to predict and
    // its CHAMPION moment (if any) isn't ours to (re)detect this pass.
    return { candidates: [], confidence: 0, storyTypesRun: [] };
  }

  let current: LeagueEntityStanding[];
  let confidence: number;
  if (leagueType === "singles") {
    const [prediction, players] = await Promise.all([
      predictSinglesTitle(seasonId, { cutoff: cutoffEnd }),
      db.select({ id: playersTable.id, points: playersTable.points }).from(playersTable).where(eq(playersTable.isActive, true)),
    ]);
    const pointsById = new Map(players.map(p => [p.id, p.points]));
    current = prediction.probabilities.map(p => ({ entityId: p.playerId, points: pointsById.get(p.playerId) ?? 0, titleProbability: p.probability, isEliminated: (pointsById.get(p.playerId) ?? 0) === 0 }));
    confidence = prediction.confidence;
  } else if (leagueType === "doubles") {
    const [prediction, teams] = await Promise.all([
      predictDoublesTitle(seasonId, { cutoff: cutoffEnd }),
      db.execute(sql`SELECT id, points, is_eliminated FROM doubles_teams WHERE season_id = ${seasonId}`).then(r => r.rows as { id: number; points: number; is_eliminated: boolean }[]),
    ]);
    const teamById = new Map(teams.map(t => [t.id, t]));
    current = prediction.probabilities.map(p => ({ entityId: p.teamId, points: teamById.get(p.teamId)?.points ?? 0, titleProbability: p.probability, isEliminated: teamById.get(p.teamId)?.is_eliminated ?? false }));
    confidence = prediction.confidence;
  } else {
    const [prediction, teams] = await Promise.all([
      predictShiftWarsTitle({ cutoff: cutoffEnd, seasonId }),
      db.execute(sql`SELECT id, points FROM shift_wars_teams`).then(r => r.rows as { id: number; points: number }[]),
    ]);
    const teamById = new Map(teams.map(t => [t.id, t]));
    // Shift Wars has no elimination mechanic at all (shift_wars_teams has no
    // is_eliminated column — a fixed 3-department competition, unlike
    // Singles/Doubles' zero-point knockout rule).
    current = prediction.probabilities.map(p => ({ entityId: p.teamId, points: teamById.get(p.teamId)?.points ?? 0, titleProbability: p.probability, isEliminated: false }));
    confidence = prediction.confidence;
  }

  const previousSnapshot = await readPreviousSnapshot(leagueType, seasonId, cutoffEnd);
  const previous = toLeagueEntityStandings(previousSnapshot);

  const teamsWithWinsLosses: StoredStandingSnapshot[] = leagueType === "singles"
    ? current.map(c => ({ ...c, wins: 0, losses: 0 })) // Singles LEAGUE snapshot is never read back as ShiftWarsTeamStanding, so wins/losses are unused filler here
    : await attachWinsLosses(leagueType, seasonId, current);
  await writeSnapshot(leagueType, seasonId, cutoffEnd, teamsWithWinsLosses);

  const facts: LeagueStandingsFacts = {
    leagueType, seasonId, current, previous,
    singlesTiePending: leagueType === "singles" && season.playoffPending,
    seasonJustEnded: false, championEntityId: null,
  };

  return { candidates: detectLeagueStories(facts), confidence, storyTypesRun: ["NEW_LEADER", "LEAD_TIGHTENS", "LEAD_WIDENS", "TITLE_SWING", "NEW_FAVOURITE", "DEAD_HEAT", "TITLE_RACE", "TIE_PENDING"] };
}

async function attachWinsLosses(leagueType: "doubles" | "shift_wars", seasonId: number, current: LeagueEntityStanding[]): Promise<StoredStandingSnapshot[]> {
  if (leagueType === "doubles") {
    const rows = (await db.execute(sql`SELECT id, wins, losses FROM doubles_teams WHERE season_id = ${seasonId}`)).rows as { id: number; wins: number; losses: number }[];
    const byId = new Map(rows.map(r => [r.id, r]));
    return current.map(c => ({ ...c, wins: byId.get(c.entityId)?.wins ?? 0, losses: byId.get(c.entityId)?.losses ?? 0 }));
  }
  const rows = (await db.execute(sql`SELECT id, wins, losses FROM shift_wars_teams`)).rows as { id: number; wins: number; losses: number }[];
  const byId = new Map(rows.map(r => [r.id, r]));
  return current.map(c => ({ ...c, wins: byId.get(c.entityId)?.wins ?? 0, losses: byId.get(c.entityId)?.losses ?? 0 }));
}

// ═══════════════════════════════════════════════════════════════════════
// DOUBLES family (match-anchored PAIR_UPSET/PAIR_ELIMINATED + subject-anchored UNBEATEN_PAIR/PAIR_SURGE)
// ═══════════════════════════════════════════════════════════════════════

type DoublesMatchGatherResult = { candidates: StoryCandidate[]; confidence: number };

async function processDoublesMatch(match: NewDoublesMatch): Promise<DoublesMatchGatherResult> {
  const ctx = await getDoublesPreMatchContext(match.id);
  if (!ctx) return { candidates: [], confidence: 0 };

  const [prediction, timeline] = await Promise.all([
    predictDoublesMatch(match.winnerTeamId, match.loserTeamId, match.seasonId, { cutoff: match.playedAt }),
    buildDoublesTeamTimeline(match.seasonId),
  ]);
  const entry = timeline.find(t => t.matchId === match.id);
  if (!entry) return { candidates: [], confidence: 0 };

  const facts: DoublesMatchResultFacts = {
    matchId: match.id, winnerTeamId: match.winnerTeamId, loserTeamId: match.loserTeamId,
    loserBefore: ctx.loserBefore, loserAfter: entry.loserAfter,
    winnerProbability: prediction.pA,
  };
  return { candidates: detectDoublesMatchStories(facts), confidence: prediction.confidence };
}

const DOUBLES_POSITION_WINDOW_REFERENCE_MATCHES = 5;
const DOUBLES_POSITION_WINDOW_MIN_MATCHES = 3;

function ownTeamMatchesAscending(timeline: TeamMatchState[], teamId: number): TeamMatchState[] {
  return timeline.filter(e => e.winnerTeamId === teamId || e.loserTeamId === teamId);
}

function computeDoublesPositionWindow(timeline: TeamMatchState[], allTeamIds: number[], teamId: number): { matches: number; positionBefore: number } | null {
  const own = ownTeamMatchesAscending(timeline, teamId);
  const n = Math.min(DOUBLES_POSITION_WINDOW_REFERENCE_MATCHES, own.length);
  if (n < DOUBLES_POSITION_WINDOW_MIN_MATCHES) return null;
  const referenceCutoff = own[own.length - n].playedAt;
  const initial = (): TeamState => ({ points: DOUBLES_STARTING_POINTS, elo: DOUBLES_STARTING_ELO, wins: 0, losses: 0, currentWinStreak: 0, currentLossStreak: 0, recentForm: [], isEliminated: false });
  const standings = allTeamIds.map(id => ({ entityId: id, points: teamStateAsOf(timeline, id, referenceCutoff, initial()).points }));
  const positionBefore = rankByPointsDesc(standings, teamId);
  return positionBefore === null ? null : { matches: n, positionBefore };
}

type DoublesFormGatherResult = { facts: DoublesTeamFormFacts; confidence: number };

async function gatherDoublesTeamFormFacts(teamId: number, seasonId: number, cutoffEnd: Date, timeline: TeamMatchState[], allTeamIds: number[], currentPointsById: Map<number, number>): Promise<DoublesFormGatherResult> {
  const initial = (): TeamState => ({ points: DOUBLES_STARTING_POINTS, elo: DOUBLES_STARTING_ELO, wins: 0, losses: 0, currentWinStreak: 0, currentLossStreak: 0, recentForm: [], isEliminated: false });
  const state = teamStateAsOf(timeline, teamId, cutoffEnd, initial());
  const currentStandings = allTeamIds.map(id => ({ entityId: id, points: currentPointsById.get(id) ?? 0 }));
  const currentPosition = rankByPointsDesc(currentStandings, teamId);

  const facts: DoublesTeamFormFacts = {
    teamId, state,
    positionWindow: computeDoublesPositionWindow(timeline, allTeamIds, teamId),
    currentPosition,
  };

  const roster = await getDoublesTeamRoster(teamId);
  const rosterBaselines = await Promise.all(roster.map(playerId => buildPlayerBaselines(playerId, cutoffEnd)));
  const confidence = confidenceScore({
    seasonGames: state.wins + state.losses,
    careerGames: state.wins + state.losses,
    h2hGames: 0,
    detailedMatches: rosterBaselines.length > 0 ? rosterBaselines.reduce((sum, b) => sum + b.detailedMatches.length, 0) / rosterBaselines.length : 0,
    recentGames: state.recentForm.length,
  });

  return { facts, confidence };
}

// ═══════════════════════════════════════════════════════════════════════
// SHIFT_WARS family (all standings-based; every detector returns an array)
// ═══════════════════════════════════════════════════════════════════════

const SHIFT_WARS_DEFICIT_WINDOW_REFERENCE_MATCHES = 5;
const SHIFT_WARS_DEFICIT_WINDOW_MIN_MATCHES = 3;

async function buildShiftWarsDeficitWindows(seasonId: number, cutoffEnd: Date): Promise<ShiftWarsDeficitWindow[]> {
  const [timeline, startingPointsByTeam, teams] = await Promise.all([
    buildShiftWarsTeamTimeline(seasonId, cutoffEnd),
    getShiftWarsStartingPoints(),
    db.execute(sql`SELECT id, points FROM shift_wars_teams`).then(r => r.rows as { id: number; points: number }[]),
  ]);
  const teamIds = teams.map(t => t.id);
  const initial = (teamId: number): TeamState => ({ points: startingPointsByTeam.get(teamId) ?? 0, elo: null, wins: 0, losses: 0, currentWinStreak: 0, currentLossStreak: 0, recentForm: [], isEliminated: false });

  const currentPointsById = new Map(teams.map(t => [t.id, t.points]));
  const currentLeaderPoints = Math.max(...teams.map(t => t.points));

  const windows: ShiftWarsDeficitWindow[] = [];
  for (const teamId of teamIds) {
    if (currentPointsById.get(teamId) === currentLeaderPoints) continue; // the leader has no deficit to recover
    const own = ownTeamMatchesAscending(timeline, teamId);
    const n = Math.min(SHIFT_WARS_DEFICIT_WINDOW_REFERENCE_MATCHES, own.length);
    if (n < SHIFT_WARS_DEFICIT_WINDOW_MIN_MATCHES) continue;
    const referenceCutoff = own[own.length - n].playedAt;

    const pointsAt = (id: number, cutoff: Date) => teamStateAsOf(timeline, id, cutoff, initial(id)).points;
    const beforeLeaderPoints = Math.max(...teamIds.map(id => pointsAt(id, referenceCutoff)));
    const deficitBefore = beforeLeaderPoints - pointsAt(teamId, referenceCutoff);
    const deficitNow = currentLeaderPoints - (currentPointsById.get(teamId) ?? 0);

    windows.push({ teamId, matches: n, deficitBefore, deficitNow });
  }
  return windows;
}

/**
 * `leagueFamilyConfidence` is whatever processLeagueFamily("shift_wars", ...)
 * already computed for this exact batch — reused here rather than running a
 * second, separate Monte Carlo simulation just to derive a confidence
 * number for this family too. Falls back to a flat mid-value only when the
 * LEAGUE pass didn't run one this batch (e.g. the season just closed).
 */
async function buildShiftWarsFamilyFacts(seasonId: number, cutoffEnd: Date, leagueFamilyConfidence: number | null): Promise<{ facts: ShiftWarsStandingsFacts; confidence: number } | null> {
  const teams = (await db.execute(sql`SELECT id, points, wins, losses FROM shift_wars_teams`)).rows as { id: number; points: number; wins: number; losses: number }[];
  if (teams.length === 0) return null;
  const current: ShiftWarsTeamStanding[] = teams.map(t => ({ teamId: t.id, points: t.points, wins: t.wins, losses: t.losses }));

  const previousSnapshot = await readPreviousSnapshot("shift_wars", seasonId, cutoffEnd);
  const previous = toShiftWarsStandings(previousSnapshot);
  const deficitRecoveryWindows = await buildShiftWarsDeficitWindows(seasonId, cutoffEnd);

  const facts: ShiftWarsStandingsFacts = { current, previous, deficitRecoveryWindows };
  return { facts, confidence: leagueFamilyConfidence ?? 50 };
}

// ═══════════════════════════════════════════════════════════════════════
// Top-level orchestration — Appendix C.1's detectAndUpdateStories() and
// collectNewAndActiveStories()
// ═══════════════════════════════════════════════════════════════════════

/** First-ever run has nothing to diff against — `new Date(0)` reads every match in history as "new," which is exactly right the first time this ever runs against a populated DB. */
async function resolveCutoffStart(): Promise<Date> {
  const rows = (await db.execute(sql`SELECT MAX(updated_at) AS max FROM broadcast_stories`)).rows as { max: string | Date | null }[];
  const max = rows[0]?.max;
  return max ? new Date(max) : new Date(0);
}

const DOUBLES_FORM_STORY_TYPES = ["UNBEATEN_PAIR", "PAIR_SURGE"] as const;

/**
 * Combines match-derived season ids (real activity this batch — Singles/
 * Doubles matches carry their own seasonId; Shift Wars matches don't, so
 * the caller resolves theirs via resolveShiftWarsSeasonForCutoff first)
 * with any season of this league that closed within the window. This is
 * also the gate that keeps the LEAGUE family's "ongoing" branch (which
 * re-runs the Title Predictor's Monte Carlo simulation) from firing for a
 * season with zero real match activity this batch — Monte Carlo re-runs on
 * pure noise could otherwise manufacture a spurious TITLE_SWING with
 * nothing real behind it. The season-just-closed branch never simulates
 * anything (CHAMPION reads a stored result), so including closed-this-
 * window seasons here is always safe.
 */
async function relevantSeasonIdsForLeague(
  leagueType: LeagueType, matchSeasonIds: ReadonlySet<number>, cutoffStart: Date, cutoffEnd: Date,
): Promise<Set<number>> {
  const ids = new Set(matchSeasonIds);
  const closedSeasons = await db.select().from(seasonsTable).where(and(eq(seasonsTable.leagueType, leagueType), sql`${seasonsTable.endDate} IS NOT NULL`));
  for (const season of closedSeasons) {
    if (seasonEndedInWindow(season, cutoffStart, cutoffEnd)) ids.add(season.id);
  }
  return ids;
}

export type DetectAndUpdateStoriesResult = {
  cutoffStart: Date;
  cutoffEnd: Date;
  newMatchesProcessed: { singles: number; doubles: number; shiftWars: number };
  storiesUpserted: number;
  byFamily: Partial<Record<StoryFamily, number>>;
};

/**
 * The orchestrator itself — Appendix C.1's `detectAndUpdateStories(newMatches,
 * cutoffEnd)`. Gathers every real fact this batch's new match activity (plus
 * any season that just closed) could possibly affect, runs all nine
 * detect*Stories() families over those facts, resolves identity, scores and
 * upserts each result, and reconciles (resolves to RESOLVED) whatever this
 * same evaluation no longer detects. Story MERGING (9.6) is explicitly out
 * of scope — see this file's own header.
 */
export async function detectAndUpdateStories(opts?: { cutoffStart?: Date; cutoffEnd?: Date }): Promise<DetectAndUpdateStoriesResult> {
  const cutoffEnd = opts?.cutoffEnd ?? new Date();
  const cutoffStart = opts?.cutoffStart ?? await resolveCutoffStart();

  matchRowCache.clear();

  const newMatches = await loadNewMatchesSince(cutoffStart, cutoffEnd);

  const byFamily: Partial<Record<StoryFamily, number>> = {};
  let storiesUpserted = 0;
  async function recordUpsert(candidate: StoryCandidate, confidence: number, seasonId: number | null): Promise<UpsertedStory> {
    const result = await upsertStoryCandidate(candidate, confidence, cutoffEnd, seasonId);
    storiesUpserted++;
    byFamily[familyForStoryType(candidate.storyType)] = (byFamily[familyForStoryType(candidate.storyType)] ?? 0) + 1;
    return result;
  }

  // ── Shared Singles context ──────────────────────────────────────────────
  const activePlayers = await db.select({ id: playersTable.id, points: playersTable.points }).from(playersTable).where(eq(playersTable.isActive, true));
  const currentPointsById = new Map(activePlayers.map(p => [p.id, p.points]));
  const ctx: SinglesBatchContext = {
    cutoffEnd, timelines: new Map(), highStakeThresholds: new Map(),
    activePlayerIds: activePlayers.map(p => p.id),
  };

  // ── Singles: RESULT + PERFORMANCE + MILESTONE (one pass per new match) ──
  const majorStoryPlayers = new Set<number>();
  const singlesMatchSeasonIds = new Set<number>();
  const playerSeasonId = new Map<number, number>();
  const playersInvolvedThisBatch = new Set<number>();
  const playedPairsThisBatch = new Map<string, { a: number; b: number }>();

  for (const match of newMatches.singles) {
    singlesMatchSeasonIds.add(match.seasonId);
    playerSeasonId.set(match.winnerId, match.seasonId);
    playerSeasonId.set(match.loserId, match.seasonId);
    playersInvolvedThisBatch.add(match.winnerId);
    playersInvolvedThisBatch.add(match.loserId);
    const pairKey = [match.winnerId, match.loserId].sort((a, b) => a - b).join(":");
    playedPairsThisBatch.set(pairKey, { a: match.winnerId, b: match.loserId });

    const scored = await processSinglesMatch(ctx, match);
    for (const { candidate, confidence } of scored) {
      const { row } = await recordUpsert(candidate, confidence, match.seasonId);
      if (familyForStoryType(candidate.storyType) === "RESULT" && treatmentForScore(row.score) === "major") {
        majorStoryPlayers.add(match.winnerId);
        majorStoryPlayers.add(match.loserId);
      }
    }
  }

  // ── Singles: FORM (subject-anchored, one fixed subject per player) ──────
  for (const playerId of playersInvolvedThisBatch) {
    const seasonId = playerSeasonId.get(playerId)!;
    const timeline = await getSinglesTimeline(ctx, seasonId);
    const { facts, confidence } = await gatherSinglesFormFacts(ctx, timeline, playerId, currentPointsById, majorStoryPlayers);
    const detected = detectFormStories(facts);
    for (const candidate of detected) await recordUpsert(candidate, confidence, seasonId);
    await resolveUndetectedSubjectStories({
      leagueType: "singles", storyTypesInFamily: FORM_STORY_TYPES,
      subjectKeys: [subjectKey("singles", playerId)],
      detectedTypes: new Set(detected.map(c => c.storyType)),
      now: cutoffEnd,
    });
  }

  // ── Singles: H2H (subject-anchored, one fixed pair) + ARCHIVE H2H ───────
  // (LAST_MEETING/HISTORICAL_H2H are evergreen — once true, permanently
  // true, per story-detectors-archive.ts's own header — so there is never
  // anything for a reconciliation pass to resolve; upsert-only is correct,
  // not a shortcut.)
  for (const { a, b } of playedPairsThisBatch.values()) {
    const seasonId = playerSeasonId.get(a)!;
    const h2h = await buildH2HBefore(a, b, cutoffEnd);

    const h2hFacts = h2hRecordToSinglesFacts(a, b, h2h);
    const detected = detectH2HStories(h2hFacts);
    const h2hConfidence = confidenceScore({ seasonGames: 0, careerGames: 0, h2hGames: h2h.gamesPlayed, detailedMatches: 0, recentGames: 0 });
    for (const candidate of detected) await recordUpsert(candidate, h2hConfidence, seasonId);
    await resolveUndetectedSubjectStories({
      leagueType: "singles", storyTypesInFamily: H2H_STORY_TYPES,
      subjectKeys: [subjectKey("singles", a), subjectKey("singles", b)],
      detectedTypes: new Set(detected.map(c => c.storyType)),
      now: cutoffEnd,
    });

    // Exact, already-recorded head-to-head history, not a prediction — same
    // maximal-confidence reasoning as SEASON_COMPARISON/MILESTONE.
    const archiveFacts = h2hRecordToArchiveFacts("singles", a, b, h2h);
    for (const candidate of detectArchiveH2HStories(archiveFacts)) {
      await recordUpsert(candidate, 100, seasonId);
    }
  }

  // ── Singles: SEASON_COMPARISON (season-anchored; standings can move a
  // player even when THEY didn't play, so every active player is
  // re-evaluated for any season that had real activity this batch, and all
  // of them are reconciled together in one pass per season — the same
  // "whole current subject set together" contract resolveUndetectedSeasonStories
  // already requires for LEAGUE/SHIFT_WARS). ─────────────────────────────
  for (const seasonId of singlesMatchSeasonIds) {
    const currentStandings = ctx.activePlayerIds.map(id => ({ entityId: id, points: currentPointsById.get(id) ?? 0 }));
    const detectedKeys = new Set<string>();
    for (const playerId of ctx.activePlayerIds) {
      const currentPosition = rankByPointsDesc(currentStandings, playerId);
      const facts = await gatherSeasonComparisonFactsForPlayer(playerId, seasonId, cutoffEnd, currentPosition);
      if (!facts) continue;
      const candidate = detectSeasonComparison(facts);
      if (!candidate) continue;
      // Exact standings/win-rate arithmetic off closed-season records, not a
      // prediction — maximal confidence, same reasoning as ARCHIVE above.
      await recordUpsert(candidate, 100, seasonId);
      detectedKeys.add(resolveStoryKey(candidate, seasonId));
    }
    await resolveUndetectedSeasonStories({
      leagueType: "singles", storyTypesInFamily: ["SEASON_COMPARISON"], seasonId,
      detectedKeysByType: new Map([["SEASON_COMPARISON", detectedKeys]]),
      now: cutoffEnd,
    });
  }

  // ── Doubles: PAIR_UPSET/PAIR_ELIMINATED (match-anchored) ────────────────
  const doublesMatchSeasonIds = new Set<number>();
  const doublesTeamsInvolvedBySeasonId = new Map<number, Set<number>>();

  for (const match of newMatches.doubles) {
    doublesMatchSeasonIds.add(match.seasonId);
    let teams = doublesTeamsInvolvedBySeasonId.get(match.seasonId);
    if (!teams) { teams = new Set(); doublesTeamsInvolvedBySeasonId.set(match.seasonId, teams); }
    teams.add(match.winnerTeamId);
    teams.add(match.loserTeamId);

    const { candidates, confidence } = await processDoublesMatch(match);
    for (const candidate of candidates) await recordUpsert(candidate, confidence, match.seasonId);
  }

  // ── Doubles: UNBEATEN_PAIR/PAIR_SURGE (subject-anchored, one team) ──────
  for (const [seasonId, teamIds] of doublesTeamsInvolvedBySeasonId) {
    const [timeline, teamRows] = await Promise.all([
      buildDoublesTeamTimeline(seasonId),
      db.execute(sql`SELECT id, points FROM doubles_teams WHERE season_id = ${seasonId}`).then(r => r.rows as { id: number; points: number }[]),
    ]);
    const allTeamIds = teamRows.map(t => t.id);
    const doublesCurrentPointsById = new Map(teamRows.map(t => [t.id, t.points]));

    for (const teamId of teamIds) {
      const { facts, confidence } = await gatherDoublesTeamFormFacts(teamId, seasonId, cutoffEnd, timeline, allTeamIds, doublesCurrentPointsById);
      const detected = detectDoublesFormStories(facts);
      for (const candidate of detected) await recordUpsert(candidate, confidence, seasonId);
      await resolveUndetectedSubjectStories({
        leagueType: "doubles", storyTypesInFamily: DOUBLES_FORM_STORY_TYPES,
        subjectKeys: [subjectKey("doubles", teamId)],
        detectedTypes: new Set(detected.map(c => c.storyType)),
        now: cutoffEnd,
      });
    }
  }

  // ── Shift Wars: resolve which season(s) this batch's matches belong to —
  // shift_wars_matches carries no season_id column of its own, unlike
  // doubles_matches, so each match's date is resolved against the season
  // calendar directly. ─────────────────────────────────────────────────────
  const shiftWarsMatchSeasonIds = new Set<number>();
  for (const match of newMatches.shiftWars) {
    try {
      shiftWarsMatchSeasonIds.add(await resolveShiftWarsSeasonForCutoff(match.playedAt));
    } catch {
      // No Shift Wars season covers this match's date — nothing to attribute it to.
    }
  }

  // ── LEAGUE family (all three leagues) ───────────────────────────────────
  const shiftWarsLeagueConfidenceBySeasonId = new Map<number, number>();

  for (const leagueType of ["singles", "doubles", "shift_wars"] as const) {
    const matchSeasonIds =
      leagueType === "singles" ? singlesMatchSeasonIds :
      leagueType === "doubles" ? doublesMatchSeasonIds :
      shiftWarsMatchSeasonIds;
    const seasonIds = await relevantSeasonIdsForLeague(leagueType, matchSeasonIds, cutoffStart, cutoffEnd);

    for (const seasonId of seasonIds) {
      const result = await processLeagueFamily(leagueType, seasonId, cutoffStart, cutoffEnd);
      const detectedKeysByType = new Map<string, Set<string>>();
      for (const candidate of result.candidates) {
        const { row } = await recordUpsert(candidate, result.confidence, seasonId);
        let set = detectedKeysByType.get(candidate.storyType);
        if (!set) { set = new Set<string>(); detectedKeysByType.set(candidate.storyType, set); }
        set.add(row.storyKey);
      }
      // Only reconcile the story types THIS pass actually evaluated — a
      // CHAMPION-only pass (season just closed) mustn't resolve
      // NEW_LEADER/TITLE_RACE/etc, which simply weren't run this time, as
      // if they'd stopped being true.
      if (result.storyTypesRun.length > 0) {
        await resolveUndetectedSeasonStories({ leagueType, storyTypesInFamily: result.storyTypesRun, seasonId, detectedKeysByType, now: cutoffEnd });
      }
      if (leagueType === "shift_wars") {
        shiftWarsLeagueConfidenceBySeasonId.set(seasonId, result.confidence);
      }
    }
  }

  // ── SHIFT_WARS family (standings-based; reuses the SAME Title Predictor
  // confidence the LEAGUE pass above just computed for this exact season,
  // rather than re-simulating) ────────────────────────────────────────────
  for (const seasonId of shiftWarsMatchSeasonIds) {
    const built = await buildShiftWarsFamilyFacts(seasonId, cutoffEnd, shiftWarsLeagueConfidenceBySeasonId.get(seasonId) ?? null);
    if (!built) continue;

    const detected = detectShiftWarsStories(built.facts);
    const detectedKeysByType = new Map<string, Set<string>>();
    for (const candidate of detected) {
      const { row } = await recordUpsert(candidate, built.confidence, seasonId);
      let set = detectedKeysByType.get(candidate.storyType);
      if (!set) { set = new Set<string>(); detectedKeysByType.set(candidate.storyType, set); }
      set.add(row.storyKey);
    }
    await resolveUndetectedSeasonStories({ leagueType: "shift_wars", storyTypesInFamily: SHIFT_WARS_STORY_TYPES, seasonId, detectedKeysByType, now: cutoffEnd });
  }

  return {
    cutoffStart, cutoffEnd,
    newMatchesProcessed: { singles: newMatches.singles.length, doubles: newMatches.doubles.length, shiftWars: newMatches.shiftWars.length },
    storiesUpserted, byFamily,
  };
}

/**
 * A trivial read of this file's own output — Appendix C.1's own
 * `collectNewAndActiveStories()`, ready for the future Director (section
 * 10) to call once it exists. "New and active" is every lifecycle stage
 * short of COOLING's terminal neighbours — NEW/HOT/ACTIVE/COOLING itself,
 * same set every reconciliation helper above already treats as "still
 * live" — ordered by score so a caller can take the top N without
 * re-sorting.
 */
export async function collectNewAndActiveStories(leagueType?: LeagueType): Promise<BroadcastStory[]> {
  const conditions = [inArray(broadcastStoriesTable.lifecycle, ["NEW", "HOT", "ACTIVE", "COOLING"] as const)];
  if (leagueType) conditions.push(eq(broadcastStoriesTable.leagueType, leagueType));
  return db.select().from(broadcastStoriesTable).where(and(...conditions)).orderBy(desc(broadcastStoriesTable.score));
}
