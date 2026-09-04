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
import { and, asc, desc, eq, gt, gte, inArray, isNull, like, lt, lte, or, sql } from "drizzle-orm";
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
  nextLifecycle, computeSeasonRecapAggregate,
  type StoryScoreComponents, type StoryFreshnessClass, type StoryLifecycle,
} from "./story-engine-math";
import {
  familyForStoryType, FORM_STORY_TYPES, H2H_STORY_TYPES, LEAGUE_STORY_TYPES, SHIFT_WARS_STORY_TYPES,
  STORY_TYPES_BY_FAMILY,
  type StoryCandidate, type StoryType, type StoryFamily,
} from "./story-types";
import { detectResultStories, type SinglesResultMatchFacts } from "./story-detectors-result";
import { detectFormStories, type SinglesFormFacts } from "./story-detectors-form";
import { detectH2HStories, type SinglesH2HFacts } from "./story-detectors-h2h";
import { detectPerformanceStories, type SinglesPerformanceFacts } from "./story-detectors-performance";
import { detectLeagueStories, detectChampion as detectChampionOnly, detectSeasonRecap, type LeagueStandingsFacts, type LeagueEntityStanding } from "./story-detectors-league";
import { detectMilestoneStories, type SinglesMilestoneFacts } from "./story-detectors-milestone";
import { detectDoublesMatchStories, detectDoublesFormStories, type DoublesMatchResultFacts, type DoublesTeamFormFacts } from "./story-detectors-doubles";
import { detectShiftWarsStories, type ShiftWarsStandingsFacts, type ShiftWarsTeamStanding, type ShiftWarsDeficitWindow } from "./story-detectors-shift-wars";
import { detectArchiveH2HStories, detectSeasonComparison, type ArchiveH2HFacts, type SeasonComparisonFacts } from "./story-detectors-archive";
import { detectShadowBotPromo, detectPracticeActivity, detectFeatureSpotlight, type PracticeActivityFacts } from "./story-detectors-filler";
import { listEnabledFeatureSpotlights } from "./feature-spotlight-registry";

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
  "DEAD_HEAT", "TITLE_RACE", "CHAMPION", "TIE_PENDING", "SEASON_KICKOFF",
  "SHIFT_LEAD_CHANGE", "SHIFT_MOMENTUM", "SHIFT_COMEBACK", "SHIFT_DOMINANCE",
  "SEASON_COMPARISON", "SEASON_RECAP",
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
    // The column existed but was never actually written here — every row's
    // real season context lived only inside the storyKey string (for
    // season-anchored types) or nowhere at all. Persisting it directly is
    // what lets collectSeasonHighlights (this file, below) query "every
    // real story from season X" straight off the column, instead of every
    // caller having to re-derive a season from detectedAt/anchorMatchId
    // after the fact.
    seasonId: seasonId ?? existing?.seasonId ?? null,
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
        seasonId: values.seasonId,
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
  /** Which active season ids (if any) neverScannedActiveSeasonIds found and
   * folded into this batch's singles/doubles queries — surfaced all the way
   * out to buildEdition's own scanSummary diagnostic (edition-engine.ts) so
   * "is the catch-up even firing at all" is a direct field to read instead
   * of something to infer from match counts. Empty on every normal batch;
   * non-empty only for a season that still has zero broadcast_stories rows. */
  catchUpSeasonIds: { singles: number[]; doubles: number[] };
};

/**
 * Active seasons (per league) that have literally never had a single
 * broadcast_stories row created for them — the concrete signal that a
 * season is genuinely brand new AND that the plain (cutoffStart, cutoffEnd]
 * window has never once included any of its matches.
 *
 * This exists because of a real, reported incident: a new singles season
 * (id 9) started 1 Sept, three real matches were played and correctly
 * saved (confirmed against the live standings and /api/matches), and yet
 * four days later the show still had zero coverage of any of it — no
 * SEASON_KICKOFF, no standings talk, no result commentary, nothing. The
 * cause traced back to how cutoffStart works: every Edition's window starts
 * where the previous one's ended, and that watermark only ever moves
 * forward. The very first Edition that ever ran (the one whose own window
 * should have covered 1-3 Sept) happened to find zero new matches for
 * reasons lost to history now (it published before this file recorded
 * per-build diagnostics) — but whatever the reason, the watermark still
 * advanced past all three matches' playedAt when it published. Every
 * regenerate since has correctly scanned forward from there, which by
 * definition can never reach back far enough to find them again. A single
 * missed batch, for a genuinely new season, meant that season's entire
 * history became permanently invisible to normal incremental scanning —
 * exactly the same "one bad window = gone forever" failure mode this
 * project already solved for CLOSED seasons via broadcastReviewedAt (a
 * durable state check, not an incremental window — see
 * resolveClosedLeagueSeasons's own header for the identical reasoning).
 * This is that same fix applied to a season's FIRST coverage instead of
 * its LAST: as long as a season has zero broadcast_stories rows, treat
 * ALL of its matches to date as "new" for this batch, regardless of
 * cutoffStart. The instant it gets its first real story, this stops
 * applying to it forever — a healthy, already-covered season is never
 * re-scanned in full, so this can't manufacture duplicate or stale
 * detections for anything that isn't in exactly this "never once seen"
 * state. Doubles gets the same treatment (its matches carry seasonId the
 * same way singles' do); Shift Wars matches don't carry a seasonId column
 * at all (see NewTeamMatch's own header) so it's left on plain incremental
 * scanning here — it has zero real matches today, so there's nothing yet
 * for this gap to have silently swallowed.
 */
async function neverScannedActiveSeasonIds(leagueType: "singles" | "doubles"): Promise<Set<number>> {
  const rows = (await db.execute(sql`
    SELECT s.id FROM seasons s
    WHERE s.league_type = ${leagueType} AND s.is_active = true
      AND NOT EXISTS (SELECT 1 FROM broadcast_stories bs WHERE bs.season_id = s.id)
  `)).rows as { id: number }[];
  return new Set(rows.map(r => r.id));
}

async function loadNewMatchesSince(cutoffStart: Date, cutoffEnd: Date): Promise<NewMatchesWindow> {
  const catchUpSingles = await neverScannedActiveSeasonIds("singles");
  const catchUpDoubles = await neverScannedActiveSeasonIds("doubles");

  const singlesRows = await db
    .select({ id: matchesTable.id, seasonId: matchesTable.seasonId, playedAt: matchesTable.playedAt, winnerId: matchesTable.winnerId, loserId: matchesTable.loserId, gameType: matchesTable.gameType })
    .from(matchesTable)
    .where(and(
      SINGLES_ONLY,
      or(
        and(gt(matchesTable.playedAt, cutoffStart), lte(matchesTable.playedAt, cutoffEnd)),
        catchUpSingles.size > 0 ? inArray(matchesTable.seasonId, [...catchUpSingles]) : sql`false`,
      ),
    ))
    .orderBy(asc(matchesTable.playedAt), asc(matchesTable.id));

  // A JS array bound straight into a raw sql`` template does NOT arrive on
  // the other side as a Postgres array literal the way drizzle's own
  // inArray() query-builder helper (used for singles, above) does — it gets
  // bound as a single scalar parameter, so `= ANY($n::int[])` fails to cast
  // it ("malformed array literal", surfaced here as a 500 on regenerate).
  // A real captured error confirmed this exactly: the bound parameter came
  // through as the bare number 10, not an array containing it. Building the
  // Postgres array-literal STRING ourselves ("{10}" / "{}") and casting
  // that sidesteps the whole issue — these ids are our own trusted query
  // output, not user input, so this is safe string construction, not
  // injection-prone concatenation.
  const catchUpDoublesLiteral = `{${[...catchUpDoubles].join(",")}}`;
  const doublesRows = (await db.execute(sql`
    SELECT id, played_at, winner_team_id, loser_team_id, season_id FROM doubles_matches
    WHERE (played_at > ${cutoffStart} AND played_at <= ${cutoffEnd})
       OR season_id = ANY(${catchUpDoublesLiteral}::int[])
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
    catchUpSeasonIds: { singles: [...catchUpSingles], doubles: [...catchUpDoubles] },
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
  // Fetched once per (player, season) call, same as priorSeason below — not
  // hoisted out of this per-player function, matching this function's own
  // existing per-player query pattern (priorStanding is looked up the same
  // way). See SeasonComparisonFacts's own comment for why these two names
  // matter: without them, several different SEASON_COMPARISON stories (each
  // genuinely about a different pair of months) are indistinguishable once
  // more than one of them airs in the same edition.
  const [currentSeason] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, currentSeasonId)).limit(1);
  const currentSeasonName = currentSeason?.name ?? "the current season";

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
    return { leagueType: "singles", entityId: playerId, currentSeasonName, currentSeasonWinRate, previousSeasonName: null, previousSeasonWinRate: null, currentSeasonPosition: currentPosition, previousSeasonFinalPosition: null };
  }

  const [priorStanding] = await db
    .select()
    .from(seasonStandingsTable)
    .where(and(eq(seasonStandingsTable.seasonId, priorSeason.id), eq(seasonStandingsTable.playerId, playerId)))
    .limit(1);
  if (!priorStanding) {
    // Player wasn't part of that closed season at all (e.g. joined since) -- no prior data to compare against.
    return { leagueType: "singles", entityId: playerId, currentSeasonName, currentSeasonWinRate, previousSeasonName: priorSeason.name, previousSeasonWinRate: null, currentSeasonPosition: currentPosition, previousSeasonFinalPosition: null };
  }

  const priorGames = priorStanding.wins + priorStanding.losses;
  return {
    leagueType: "singles", entityId: playerId,
    currentSeasonName, currentSeasonWinRate,
    previousSeasonName: priorSeason.name,
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

/** SEASON_KICKOFF's own counterpart to seasonEndedInWindow above — same window-boundary check, against startDate instead. Every season has a startDate (NOT NULL in the schema), so unlike seasonEndedInWindow there's no "still active" guard needed here. */
function seasonStartedInWindow(season: typeof seasonsTable.$inferSelect, cutoffStart: Date, cutoffEnd: Date): boolean {
  const startedAt = new Date(`${season.startDate}T00:00:00Z`);
  return startedAt >= new Date(cutoffStart.toISOString().slice(0, 10)) && startedAt <= cutoffEnd;
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
 * The real numbers behind SEASON_RECAP (see story-detectors-league.ts's
 * own header on why this exists): who won the most matches this closed
 * season, and how many were played at all. Reuses the SAME real replayed
 * timelines every other history-driven story in this file already trusts
 * (buildSinglesTimeline/buildDoublesTeamTimeline/buildShiftWarsTeamTimeline
 * — the fact firewall this whole file operates under means there's no
 * OTHER source for "real, verified" match data), so this can never disagree
 * with what the rest of the show already knows happened. The actual
 * "who's top" math is computeSeasonRecapAggregate (story-engine-math.ts),
 * kept pure and directly unit tested; this function's only job is the DB
 * read and handing it a plain winner-id list.
 */
async function computeSeasonRecapFacts(leagueType: LeagueType, seasonId: number): Promise<{ matchesPlayed: number; topEntityId: number | null; topWins: number }> {
  const winnerIds =
    leagueType === "singles" ? (await buildSinglesTimeline(seasonId)).map(m => m.winnerId)
    : leagueType === "doubles" ? (await buildDoublesTeamTimeline(seasonId)).map(m => m.winnerTeamId)
    : (await buildShiftWarsTeamTimeline(seasonId)).map(m => m.winnerTeamId);
  return computeSeasonRecapAggregate(winnerIds);
}

export type ClosedLeagueSeason = {
  leagueType: LeagueType;
  seasonId: number;
  seasonName: string;
  seasonStart: Date;
  /** Exclusive upper bound (the instant after the season's own endDate) — a `< seasonEndExclusive` comparison naturally includes the last day itself. */
  seasonEndExclusive: Date;
  championEntityId: number | null;
  matchesPlayed: number;
  topEntityId: number | null;
  topWins: number;
};

/**
 * Every closed league season that STILL OWES a Season Review — a durable
 * state check against seasons.broadcastReviewedAt (see that column's own
 * schema comment and add_season_broadcast_reviewed_at.ts's migration
 * header), not the (cutoffStart, cutoffEnd] incremental window this
 * function originally used.
 *
 * That window-based version was a real, shipped bug: it reused
 * processLeagueFamily's own seasonEndedInWindow check, which answers "did a
 * new result happen this batch" — correct for a match, wrong for a one-off
 * retrospective, because the window only ever contains the season-close
 * instant on the very FIRST build after it happens. A real user hit this
 * directly: regenerating the current Edition a second time (exactly what
 * previewing a new feature involves) landed outside that window, silently
 * fell back to an ordinary Edition, and reported it back as "way too
 * short" with the champion "brought up multiple times" — the ordinary
 * CHAMPION/H2H/FORM rotation about the same dominant player standing in
 * for the review that never actually ran a second time.
 *
 * `broadcastReviewedAt IS NULL` has none of that fragility: it stays true
 * across as many rebuilds/regenerates of the same slot as it takes to
 * actually clear the quality gate and publish, and once it publishes,
 * edition-engine.ts sets the column and this season stops being offered
 * again — a state transition, not a shrinking time window.
 */
export async function resolveClosedLeagueSeasons(now: Date): Promise<ClosedLeagueSeason[]> {
  const candidateSeasons = await db.select().from(seasonsTable).where(and(
    sql`${seasonsTable.endDate} IS NOT NULL`,
    eq(seasonsTable.isActive, false),
    isNull(seasonsTable.broadcastReviewedAt),
  ));
  const result: ClosedLeagueSeason[] = [];
  for (const season of candidateSeasons) {
    const endedAt = new Date(`${season.endDate}T00:00:00Z`);
    if (endedAt > now) continue; // defensive only — isActive/endDate already imply this, but never review a season "ahead of" the build's own cutoff
    const leagueType = season.leagueType as LeagueType;

    let championEntityId: number | null;
    if (leagueType === "singles") championEntityId = season.championId;
    else if (leagueType === "doubles") championEntityId = await resolveDoublesChampionTeamId(season.id);
    else championEntityId = await resolveShiftWarsChampionTeamId(season.id);

    const recap = await computeSeasonRecapFacts(leagueType, season.id);
    result.push({
      leagueType, seasonId: season.id, seasonName: season.name,
      seasonStart: new Date(`${season.startDate}T00:00:00Z`),
      seasonEndExclusive: new Date(endedAt.getTime() + 24 * 60 * 60 * 1000),
      championEntityId,
      matchesPlayed: recap.matchesPlayed, topEntityId: recap.topEntityId, topWins: recap.topWins,
    });
  }
  return result;
}

/**
 * Marks a batch of closed seasons as having had their Season Review
 * actually air — called by edition-engine.ts ONLY after a Season Review
 * programme clears the quality gate and publishes, never on a
 * failed/skipped attempt (a thin or gate-failing build should keep
 * retrying as a Season Review on the next build, exactly like every other
 * "keep previous published Edition" quality-gate case already works). Once
 * set, resolveClosedLeagueSeasons above stops offering that season again.
 */
export async function markSeasonsReviewed(seasonIds: readonly number[], reviewedAt: Date): Promise<void> {
  if (seasonIds.length === 0) return;
  await db.update(seasonsTable).set({ broadcastReviewedAt: reviewedAt }).where(inArray(seasonsTable.id, seasonIds as number[]));
}

const HIGHLIGHT_ELIGIBLE_FAMILIES: Record<LeagueType, StoryFamily[]> = {
  singles: ["RESULT", "FORM", "H2H", "PERFORMANCE", "MILESTONE"],
  doubles: ["DOUBLES"],
  shift_wars: ["SHIFT_WARS"],
};

/**
 * The season's own real individual storylines — a real user report ("not
 * covering... any of the matches from the league at all") named exactly
 * this gap: SEASON_RECAP's aggregate numbers and CHAMPION's own outcome
 * are both real, but neither one is an actual match or storyline FROM the
 * season. This is that — every RESULT/FORM/H2H/PERFORMANCE/MILESTONE (or
 * the league-appropriate DOUBLES/SHIFT_WARS equivalent) story genuinely
 * detected during this season, regardless of its CURRENT lifecycle.
 * collectNewAndActiveStories() deliberately excludes RESOLVED/ARCHIVED rows
 * (11.2's own "one resolution segment, then cool/archive" cap) — correct
 * for a normal Edition, wrong here: a season review is explicitly a look
 * BACK, so a story that's long since resolved is exactly the real content
 * it should feature.
 *
 * Prefers the `seasonId` column (persisted on every upsert as of this fix
 * — see upsertStoryCandidate's own comment); falls back to a
 * detection-window match for older rows written before that column was
 * ever populated, so a season that closed before this fix shipped still
 * gets a real reel rather than an empty one.
 */
export async function collectSeasonHighlights(params: {
  leagueType: LeagueType; seasonId: number; seasonStart: Date; seasonEndExclusive: Date; limit: number;
}): Promise<BroadcastStory[]> {
  const eligibleTypes = HIGHLIGHT_ELIGIBLE_FAMILIES[params.leagueType].flatMap(family => STORY_TYPES_BY_FAMILY[family]) as StoryType[];
  if (eligibleTypes.length === 0) return [];

  const rows = await db.select().from(broadcastStoriesTable)
    .where(and(
      eq(broadcastStoriesTable.leagueType, params.leagueType),
      inArray(broadcastStoriesTable.storyType, eligibleTypes),
      or(
        eq(broadcastStoriesTable.seasonId, params.seasonId),
        and(isNull(broadcastStoriesTable.seasonId), gte(broadcastStoriesTable.detectedAt, params.seasonStart), lt(broadcastStoriesTable.detectedAt, params.seasonEndExclusive)),
      ),
    ))
    .orderBy(desc(broadcastStoriesTable.score));

  // Diversify: at most 2 highlights featuring any ONE individual entity
  // (player or team), so a single dominant season champion can't fill the
  // whole reel just by appearing against a different opponent each time —
  // capping by the exact subjectKeys SET alone doesn't catch that, since
  // "Graeme vs Richard" and "Graeme vs Sean" are different groups but the
  // same real problem a real user reported ("brings up Graeme being
  // champion multiple times"): CHAMPION, SEASON_RECAP and several
  // highlights can all legitimately be about the same top player, reading
  // as the show repeating itself even though every individual segment is
  // technically distinct. This is the same "no single subject hogs the
  // show" principle 10.4's exposure cap already applies to a normal Edition
  // (director-math.ts's isWithinSubjectExposureCap), re-applied per
  // INDIVIDUAL subject key rather than per exact group, since this pool
  // never goes through that normal slot-filling machinery at all.
  const MAX_HIGHLIGHTS_PER_SUBJECT = 2;
  const perSubjectCount = new Map<string, number>();
  const picked: BroadcastStory[] = [];
  for (const row of rows) {
    const overCap = row.subjectKeys.some(key => (perSubjectCount.get(key) ?? 0) >= MAX_HIGHLIGHTS_PER_SUBJECT);
    if (overCap) continue;
    for (const key of row.subjectKeys) perSubjectCount.set(key, (perSubjectCount.get(key) ?? 0) + 1);
    picked.push(row);
    if (picked.length >= params.limit) break;
  }
  return picked;
}

/**
 * Read-only diagnostic for GET /admin/broadcast/status: WHY did
 * collectSeasonHighlights come back empty (or thin) for a league's most
 * recently closed season, when the story pool clearly isn't empty (a real
 * case: 292 ACTIVE singles stories, zero highlights aired). Surfaces the
 * exact same eligible-type filter and seasonId/detection-window match logic
 * collectSeasonHighlights itself uses, plus a raw sample, so a mismatch
 * (wrong/missing seasonId, a detectedAt outside the season's own window, or
 * genuinely zero eligible-type stories at all) is visible directly rather
 * than guessed at from outside the database.
 */
export type SeasonHighlightDiagnostic = {
  leagueType: LeagueType;
  seasonId: number;
  seasonName: string;
  seasonStart: string;
  seasonEndExclusive: string;
  broadcastReviewedAt: string | null;
  eligibleStoryTypes: string[];
  totalEligibleTypeStoriesForLeague: number;
  matchedBySeasonIdColumn: number;
  matchedByDetectionWindowFallback: number;
  sample: { id: number; storyType: string; seasonId: number | null; detectedAt: string; score: number; lifecycle: string }[];
};

export async function diagnoseSeasonHighlights(leagueType: LeagueType): Promise<SeasonHighlightDiagnostic | null> {
  const [season] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.leagueType, leagueType), sql`${seasonsTable.endDate} IS NOT NULL`))
    .orderBy(desc(seasonsTable.endDate))
    .limit(1);
  if (!season || !season.endDate) return null;

  const eligibleTypes = HIGHLIGHT_ELIGIBLE_FAMILIES[leagueType].flatMap(family => STORY_TYPES_BY_FAMILY[family]) as StoryType[];
  const seasonStart = new Date(`${season.startDate}T00:00:00Z`);
  const endedAt = new Date(`${season.endDate}T00:00:00Z`);
  const seasonEndExclusive = new Date(endedAt.getTime() + 24 * 60 * 60 * 1000);

  const allEligible = eligibleTypes.length === 0 ? [] : await db.select().from(broadcastStoriesTable).where(and(
    eq(broadcastStoriesTable.leagueType, leagueType),
    inArray(broadcastStoriesTable.storyType, eligibleTypes),
  ));

  const matchedBySeasonIdColumn = allEligible.filter(s => s.seasonId === season.id).length;
  const matchedByDetectionWindowFallback = allEligible.filter(s => s.seasonId === null && s.detectedAt >= seasonStart && s.detectedAt < seasonEndExclusive).length;

  const sample = allEligible
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(s => ({ id: s.id, storyType: s.storyType, seasonId: s.seasonId, detectedAt: s.detectedAt.toISOString(), score: s.score, lifecycle: s.lifecycle }));

  return {
    leagueType, seasonId: season.id, seasonName: season.name,
    seasonStart: seasonStart.toISOString(), seasonEndExclusive: seasonEndExclusive.toISOString(),
    broadcastReviewedAt: season.broadcastReviewedAt ? season.broadcastReviewedAt.toISOString() : null,
    eligibleStoryTypes: eligibleTypes,
    totalEligibleTypeStoriesForLeague: allEligible.length,
    matchedBySeasonIdColumn, matchedByDetectionWindowFallback,
    sample,
  };
}

/**
 * Admin-only escape hatch: clears broadcastReviewedAt on a league's most
 * recently closed season so resolveClosedLeagueSeasons offers it again on
 * the next build/regenerate. Needed because markSeasonsReviewed (correctly)
 * fires the moment a Season Review publishes at all — including a thin one
 * that published successfully despite finding zero real highlights due to a
 * since-fixed bug. Without this, fixing the underlying bug wouldn't be
 * enough on its own: the season would stay marked "reviewed" and never get
 * rebuilt with the fix in effect.
 */
export async function resetSeasonReviewForLeague(leagueType: LeagueType): Promise<{ seasonId: number; seasonName: string } | null> {
  const [season] = await db.select().from(seasonsTable)
    .where(and(eq(seasonsTable.leagueType, leagueType), sql`${seasonsTable.endDate} IS NOT NULL`))
    .orderBy(desc(seasonsTable.endDate))
    .limit(1);
  if (!season) return null;
  await db.update(seasonsTable).set({ broadcastReviewedAt: null }).where(eq(seasonsTable.id, season.id));
  return { seasonId: season.id, seasonName: season.name };
}

/**
 * Builds LeagueStandingsFacts and runs the full LEAGUE family for one
 * league/season — OR, when that season just closed this batch, skips
 * straight to CHAMPION (plus SEASON_RECAP — see that detector's own
 * header) alone. Every OTHER LEAGUE detector depends on real
 * title-probability data (predictSinglesTitle/predictDoublesTitle/
 * predictShiftWarsTitle all THROW once a season has an endDate — "nothing
 * left to predict"), so forcing the full family through a fabricated
 * standings shape for a season that's already over would either crash or
 * risk manufacturing fake DEAD_HEAT/TITLE_RACE stories for a race that
 * doesn't exist anymore. CHAMPION and SEASON_RECAP are the two LEAGUE
 * types that are ABOUT a season having just ended, so they're handled on
 * their own here.
 */
async function processLeagueFamily(leagueType: LeagueType, seasonId: number, cutoffStart: Date, cutoffEnd: Date): Promise<LeagueGatherResult> {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId)).limit(1);
  if (!season) return { candidates: [], confidence: 0, storyTypesRun: [] };

  if (seasonEndedInWindow(season, cutoffStart, cutoffEnd)) {
    let championEntityId: number | null = null;
    if (leagueType === "singles") championEntityId = season.championId;
    else if (leagueType === "doubles") championEntityId = await resolveDoublesChampionTeamId(seasonId);
    else championEntityId = await resolveShiftWarsChampionTeamId(seasonId);

    const recapFacts = await computeSeasonRecapFacts(leagueType, seasonId);
    const recapCandidates = detectSeasonRecap({ leagueType, seasonId, seasonName: season.name, ...recapFacts });
    const storyTypesRun: StoryType[] = ["CHAMPION", "SEASON_RECAP"];

    if (championEntityId === null) return { candidates: recapCandidates, confidence: 100, storyTypesRun };

    const facts: LeagueStandingsFacts = {
      leagueType, seasonId, current: [], previous: null,
      singlesTiePending: false, seasonJustEnded: true, championEntityId,
      seasonJustStarted: false, seasonName: season.name,
    };
    return { candidates: [...detectChampionOnly(facts), ...recapCandidates], confidence: 100, storyTypesRun };
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
    // seasonStartedInWindow alone is the fragile half of this check — it
    // depends on the season's calendar startDate falling inside THIS
    // batch's own (cutoffStart, cutoffEnd], which is exactly the incremental
    // window that neverScannedActiveSeasonIds's own header explains can
    // silently slide past a brand-new season's entire history in one bad
    // build and never come back. `previousSnapshot === null` is the robust
    // half: it's true precisely on the first time THIS season's LEAGUE
    // family has ever actually run (writeSnapshot below guarantees it's
    // non-null on every run after), so SEASON_KICKOFF still fires exactly
    // once per season even when the calendar-window check alone would have
    // missed it entirely.
    seasonJustStarted: seasonStartedInWindow(season, cutoffStart, cutoffEnd) || previousSnapshot === null, seasonName: season.name,
  };

  return { candidates: detectLeagueStories(facts), confidence, storyTypesRun: ["NEW_LEADER", "LEAD_TIGHTENS", "LEAD_WIDENS", "TITLE_SWING", "NEW_FAVOURITE", "DEAD_HEAT", "TITLE_RACE", "TIE_PENDING", "SEASON_KICKOFF"] };
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

// ═══════════════════════════════════════════════════════════════════════
// FILLER family gathering — PRACTICE_ACTIVITY (real query, see below);
// SHADOW_BOT_PROMO takes no facts at all (story-detectors-filler.ts's own
// header); FEATURE_SPOTLIGHT reads feature-spotlight-registry.ts's own
// enabled rows directly, gathered inline at the FILLER wiring call site
// below rather than through a dedicated function here (a plain read, no
// aggregation to name and isolate the way this one has).
// ═══════════════════════════════════════════════════════════════════════

/** A rolling window ending "now," not "since the last batch" — see story-detectors-filler.ts's own header on why PRACTICE_ACTIVITY has no real "new since X" concept; a short gap between Edition builds shouldn't make a genuinely active week read as quiet just because most of its sessions fall outside a tiny cutoffStart..cutoffEnd slice. */
const PRACTICE_ACTIVITY_WINDOW_DAYS = 7;

/**
 * Real, verified COUNT(*)/COUNT(DISTINCT ...) aggregates over practice_sessions
 * — never Shadow Bot sessions, which store their marker in
 * session_data->>'shadowPlayerId' rather than as a separate table (see
 * routes/practice.ts's own shadow-bot-matches query, which filters the same
 * way), per this feature's own product decision that Shadow Bot stays pure
 * promotional content with no real-result reporting attached to it.
 */
async function gatherPracticeActivityFacts(cutoffEnd: Date): Promise<PracticeActivityFacts> {
  const windowStart = new Date(cutoffEnd.getTime() - PRACTICE_ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const rows = (await db.execute(sql`
    SELECT player1_id, COUNT(*)::int AS session_count
    FROM practice_sessions
    WHERE created_at > ${windowStart} AND created_at <= ${cutoffEnd}
      AND session_data->>'shadowPlayerId' IS NULL
      AND player1_id IS NOT NULL
    GROUP BY player1_id
    ORDER BY session_count DESC
  `)).rows as { player1_id: number; session_count: number }[];

  const sessionCount = rows.reduce((sum, r) => sum + r.session_count, 0);
  const top = rows[0] ?? null;

  return {
    windowDays: PRACTICE_ACTIVITY_WINDOW_DAYS,
    sessionCount,
    distinctPlayerCount: rows.length,
    topPlayerId: top?.player1_id ?? null,
    topPlayerSessionCount: top?.session_count ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Time-based ARCHIVED sweep — story-engine-math.ts's own nextLifecycle()
// comment flags this as a real scope boundary: "the actual time-based
// ARCHIVED sweep... needs wall-clock tracking across Edition builds, which
// is the Director's job, not this pure function's." This is that sweep. It
// lives here rather than in director.ts because it needs the SAME
// season-closing knowledge processLeagueFamily already reads
// (seasons.endDate) to decide when a season is "done," and because it
// writes broadcast_stories.lifecycle directly — director.ts never touches
// that column, it only ever reads whatever collectNewAndActiveStories()
// already handed it.
//
// SCOPE — deliberately narrow, not a general "everything ages out"
// mechanism. CHAMPION and the rest of the season-anchored LEAGUE/
// SHIFT_WARS family (NEW_LEADER, TITLE_RACE, SHIFT_LEAD_CHANGE, etc.) are
// detected exactly once per season by processLeagueFamily/
// buildShiftWarsFamilyFacts, and — once that season stops appearing in
// relevantSeasonIdsForLeague's own window — can structurally NEVER be
// re-detected again (a closed season never re-enters that set). That's
// exactly the real bug a user report traced this to: a champion crowned
// months ago, or a since-closed season's standings comparison, sat frozen
// at whatever lifecycle it got on the one pass it was ever written, with
// nothing to ever move it past NEW/ACTIVE — looking permanently "current"
// next to whatever's actually happening now. Sweeping these to ARCHIVED
// is safe precisely because that structural "can never be re-detected"
// guarantee rules out the one risk this kind of sweep would otherwise
// have: colliding with a genuine still-ongoing re-detection (which is
// exactly why FORM/H2H/RESULT/PERFORMANCE/MILESTONE — families that DO
// keep getting legitimately re-upserted for as long as the underlying
// situation stays true, and whose own freshness decay already keeps them
// correctly deprioritised without a hard cutoff — are deliberately left
// alone here, rather than folded into one "sweep everything" pass).
//
// SEASON_COMPARISON is season-anchored too but deliberately EXCLUDED from
// this sweep, even though it's detected the exact same "once, then never
// again" way — see story-detectors-archive.ts / director.ts's own slot-8
// header: it's part of the ARCHIVE family on purpose, the same "lighter,
// evergreen flashback" content LAST_MEETING/HISTORICAL_H2H are, meant to
// stay available for a callback slot indefinitely, not something that
// should ever disappear from the pool outright.
const SEASON_STORY_ARCHIVAL_GRACE_DAYS = 14;

/** LEAGUE ∪ SHIFT_WARS — every season-anchored type EXCEPT ARCHIVE's own SEASON_COMPARISON (see this section's header for why that one stays out). */
const ARCHIVABLE_SEASON_STORY_TYPES: readonly StoryType[] = [...LEAGUE_STORY_TYPES, ...SHIFT_WARS_STORY_TYPES];

/** Every closed season (endDate set) whose endDate is more than `graceDays` before `now`. Fetched and filtered in JS rather than compared in SQL: seasons.endDate is a plain `date` column (mode: "string", e.g. "2026-03-15"), and every other site in this file that needs to compare it against a real Date already does the same `` new Date(`${endDate}T00:00:00Z`) `` conversion client-side (see seasonEndedInWindow above) rather than pushing date arithmetic into the query. */
async function closedSeasonsOlderThan(now: Date, graceDays: number): Promise<{ id: number; leagueType: LeagueType }[]> {
  const cutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);
  const rows = await db.select({ id: seasonsTable.id, leagueType: seasonsTable.leagueType, endDate: seasonsTable.endDate })
    .from(seasonsTable)
    .where(sql`${seasonsTable.endDate} IS NOT NULL`);
  return rows
    .filter(row => new Date(`${row.endDate}T00:00:00Z`) < cutoff)
    // seasonsTable.leagueType is a plain text() column (no $type<LeagueType>()
    // override — see lib/db/src/schema/seasons.ts), so a raw select always
    // comes back typed as `string`; every real row is one of the three
    // values LEAGUE_TYPES enforces at the application layer (there's no DB
    // check constraint), same trust boundary story.storyType/lifecycle
    // already cross via `as StoryType`/`as StoryLifecycle` casts elsewhere
    // in this file.
    .map(row => ({ id: row.id, leagueType: row.leagueType as LeagueType }));
}

/**
 * Archives every still-live (NEW/HOT/ACTIVE/COOLING) row for the
 * archivable season-anchored types, for every season that closed more than
 * SEASON_STORY_ARCHIVAL_GRACE_DAYS ago — see this section's own header for
 * the full reasoning. Returns how many rows it actually changed, purely
 * for the caller's own result/observability reporting.
 */
async function sweepStaleSeasonStories(now: Date): Promise<number> {
  const closedSeasons = await closedSeasonsOlderThan(now, SEASON_STORY_ARCHIVAL_GRACE_DAYS);
  let archivedCount = 0;
  for (const season of closedSeasons) {
    for (const storyType of ARCHIVABLE_SEASON_STORY_TYPES) {
      const prefix = seasonAnchoredStoryKeyPrefix(season.leagueType, storyType, season.id);
      const updated = await db.update(broadcastStoriesTable)
        .set({ lifecycle: "ARCHIVED", resolvedAt: now, updatedAt: now })
        .where(and(
          like(broadcastStoriesTable.storyKey, `${prefix}%`),
          inArray(broadcastStoriesTable.lifecycle, ["NEW", "HOT", "ACTIVE", "COOLING"]),
        ))
        .returning({ id: broadcastStoriesTable.id });
      archivedCount += updated.length;
    }
  }
  return archivedCount;
}

export type DetectAndUpdateStoriesResult = {
  cutoffStart: Date;
  cutoffEnd: Date;
  newMatchesProcessed: { singles: number; doubles: number; shiftWars: number };
  storiesUpserted: number;
  storiesArchived: number;
  byFamily: Partial<Record<StoryFamily, number>>;
  /** Straight passthrough of loadNewMatchesSince's own catchUpSeasonIds — see its header. */
  catchUpSeasonIds: { singles: number[]; doubles: number[] };
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

  // ── FILLER family: all three detectors, now that the infrastructure the
  // other two needed actually exists ──────────────────────────────────────
  // story-detectors-filler.ts was fully written well before any of it was
  // wired in here — real content this show is specifically designed to
  // fall back on "when there isn't enough real match news" (that file's
  // own header) was sitting completely unused, which made the exact
  // content-drought scenario it exists for (an off-season/no-new-matches
  // batch) worse than it needed to be: with FILLER contributing nothing,
  // the story pool in that situation was left with nothing BUT the frozen,
  // never-resolved multi-season ARCHIVE/CHAMPION/SEASON_COMPARISON
  // backlog, which is what a real user report ("the catch-up episode is
  // just a clump of all seasons") traced back to. SHADOW_BOT_PROMO was
  // wired in first (it needs no real supporting data — pure explainer
  // copy). PRACTICE_ACTIVITY's own real aggregate query
  // (gatherPracticeActivityFacts above) and FEATURE_SPOTLIGHT's own
  // registry table (feature-spotlight-registry.ts, broadcast_feature_
  // spotlights) now exist too, so all three are wired in together.
  //
  // Confidence is 100 for both of the newly-added ones, same reasoning as
  // SEASON_COMPARISON/MILESTONE elsewhere in this file: PRACTICE_ACTIVITY
  // is a real COUNT(*)/COUNT(DISTINCT ...) aggregate, not a prediction, and
  // FEATURE_SPOTLIGHT is a direct registry read — neither has any
  // uncertainty to express.
  await recordUpsert(detectShadowBotPromo(), 100, null);

  const practiceActivityFacts = await gatherPracticeActivityFacts(cutoffEnd);
  const practiceActivityCandidate = detectPracticeActivity(practiceActivityFacts);
  if (practiceActivityCandidate) await recordUpsert(practiceActivityCandidate, 100, null);

  const enabledSpotlights = await listEnabledFeatureSpotlights();
  for (const spotlight of enabledSpotlights) {
    await recordUpsert(detectFeatureSpotlight(spotlight), 100, null);
  }

  // ── Time-based ARCHIVED sweep — see this file's own section header above
  // buildOrder-wise, this runs LAST: it only ever touches season-anchored
  // rows for seasons that are long closed, so it can never interact with
  // anything this same batch just upserted above. ─────────────────────────
  const storiesArchived = await sweepStaleSeasonStories(cutoffEnd);

  return {
    cutoffStart, cutoffEnd,
    newMatchesProcessed: { singles: newMatches.singles.length, doubles: newMatches.doubles.length, shiftWars: newMatches.shiftWars.length },
    storiesUpserted, storiesArchived, byFamily,
    catchUpSeasonIds: newMatches.catchUpSeasonIds,
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
