// TKDL LIVE — Edition Engine: the top-level orchestrator (handover doc
// sections 16.3/16.4, Appendix C.1's own `buildEdition(slot)`). Everything
// below it is already built and independently verified — story-engine.ts
// (section 9, detection/persistence), director.ts/director-math.ts
// (sections 10-11, running-order selection + the quality gate rule),
// commentary-engine.ts/commentary-math.ts (section 12, dialogue rendering)
// — this file's own job is purely the ORCHESTRATION Appendix C.1 and 16.3
// describe: resolve which logical slot we're building for, decide whether a
// rebuild is even warranted, claim exclusive ownership of that build, walk
// the running order calling into the Commentary Engine for each real story,
// apply the quality gate, and persist the result — with 16.4's concurrency
// contract and 17's own failure-handling table honoured throughout.
//
// DB-FACING, NOT UNIT TESTED — same convention as story-engine.ts,
// director.ts, commentary-engine.ts and config.ts: no dedicated test file,
// verified by typecheck + build clean and by construction from the already-
// tested pure layers underneath (director-math.ts, commentary-math.ts,
// story-engine-math.ts, edition-slots.ts).
//
// ── Title Predictor caching — Appendix C.1's `titleSnapshots =
// runTitlePredictorsOnce()` needs NO separate call here ─────────────────────
// story-engine.ts's own module header ("TITLE PREDICTOR CACHING") already
// explains this precisely: the LEAGUE family's detectors need real title
// probabilities, so story-engine.ts's own processLeagueFamily() already runs
// the Title Predictor once per league/season as PART OF detectAndUpdateStories(),
// storing the result in broadcast_prediction_snapshots and embedding whatever
// a story actually needs straight into that story's own persisted `facts`.
// There is no separate "titleSnapshots" object directorSelect() takes as a
// parameter (its real signature is `{pool, previousProgramme}` — confirmed
// against director.ts's own source) — this pseudocode step is already fully
// covered by the detectAndUpdateStories() call below, not a gap.
//
// ── Why "playersWithRepeatedNegativeBanterInCooldown" is empty below ─────
// 12.7's hard gates are
//     enforced INSIDE commentary-engine.ts's eligiblePhrasesForTurn() before
//     a phrase is ever selectable, using the real per-subject banterContext
//     this file computes (buildBanterContext, from broadcast_memory's
//     PLAYER_NEGATIVE rows plus this build's own running counters) — so no
//     segment this file assembles can ever violate that gate, PROVIDED this
//     file's own banterContext is itself computed honestly, which is exactly
//     what buildBanterContext does.
// Both are still scanned defensively below (hasUnresolvedPlaceholders,
// hasInvalidFutureMatchLanguage) as cheap, genuine double-checks over the
// final rendered text — not the primary enforcement mechanism, which lives
// one layer down, but a real safety net per 17's own reliability table.
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  broadcastEditionsTable, broadcastStoriesTable, broadcastMemoryTable, seasonsTable, playersTable, matchesTable,
  type BroadcastEdition, type EditionStatus, type LeagueType, type BroadcastStory,
} from "@workspace/db";
import { getBroadcastConfig, type BroadcastConfig } from "./config.ts";
import { maybeAutoResetLeagueSeasons } from "../lib/seasonReset.ts";
import { londonMidnightUtc } from "../lib/londonDate.ts";
import {
  manualEpisodeSlotKey, rebuildAttemptSlotKey, resolveLogicalSlot, type ResolvedSlot,
} from "./edition-slots.ts";
import {
  detectAndUpdateStories, collectNewAndActiveStories, collectUnairedActiveSeasonCatchUpStories,
  collectActiveSeasonSweepStories, resolveClosedLeagueSeasons, markSeasonsReviewed, collectSeasonHighlights,
} from "./story-engine.ts";
import { directorSelect, selectProgrammeMode, type RunningOrderEntry } from "./director.ts";
import { treatmentForScore } from "./story-engine-math.ts";
import { selectSeasonReviewRunningOrder } from "./director-season-review.ts";
import { selectWeeklyHighlightSegments, type WeeklySourceEdition } from "./director-weekly-highlights.ts";
import {
  editionChangeScore, newlyCreatedGroupTreatments, isForcedRefresh, mergeStoriesByAnchorAndNarrative,
  evaluateQualityGate, programmeSegmentId, totalEstimatedSecondsForProgramme, isRuntimeWithinProgrammeMode,
  programmeModeOf,
  type EditionProgramme, type ProgrammeSegment, type QualityGateInput, type QualityGateSegment, type ProgrammeMode,
} from "./director-math.ts";
import { validityRulesForStory } from "./live-events-math.ts";
import { renderConversation, buildGraphicFacts, buildTemplateFacts, type DialogueTurn, type BanterContext } from "./commentary-engine.ts";
import { commentaryRng, dialogueHoldSeconds, interpolateTemplate } from "./commentary-math.ts";
import { CLOSING_TEASE_TEMPLATES, hasClosingTease } from "./closing-tease-math.ts";
import { COLD_OPEN_TEASE_TEMPLATES, hasColdOpenTease } from "./cold-open-math.ts";
import { pickEligibleRunningJoke, type RunningJoke } from "./running-jokes-math.ts";
import { GUEST_CAMEO_TEMPLATES, hasGuestCameo } from "./guest-cameo-math.ts";
import {
  PREDICTION_MAKE_TEMPLATES, PREDICTION_CORRECT_TEMPLATES, PREDICTION_INCORRECT_TEMPLATES,
  gradeWinStreakPrediction, MAX_EDITIONS_BEFORE_PREDICTION_EXPIRES, MIN_WIN_STREAK_FOR_PREDICTION,
} from "./presenter-prediction-math.ts";
import { pickFrom } from "./seeded-rng.ts";
import {
  ARCHIVE_STORY_TYPES, DOUBLES_STORY_TYPES, FORM_STORY_TYPES, H2H_STORY_TYPES,
  LEAGUE_STORY_TYPES, PERFORMANCE_STORY_TYPES, SHIFT_WARS_STORY_TYPES,
  type StoryFamily, type StoryType, type Treatment,
} from "./story-types.ts";
import { validateStoryFactCutoffs } from "./cutoff-snapshot-math.ts";
import { buildEditorialFeatures, weaveStudioSegments } from "./editorial-features.ts";
import { collectInterviewSegments } from "./interview-feature.ts";
import { collectFanVerdictSegments } from "./fan-verdict.ts";
import type { PowerRankingMatch } from "./power-rankings.ts";
import { SHADOW_BOT_ACHIEVEMENT_DEFS, gamerscoreForRarity } from "../lib/shadow-bot-achievements.ts";

// ── Fixed utility dialogue (11.1's required "opening" and "closing" slots,
// and slot 10's own documented no-LEAGUE-story fallback — see director.ts's
// own header) ──────────────────────────────────────────────────────────
// These reference no facts at all (deliberately — there is no story behind
// any of the three for a template to interpolate from), so they're
// hand-written, finished lines rather than anything templated, picked with
// the same seeded-per-Edition RNG every other piece of commentary uses so a
// viewer doesn't hear the identical line every single Edition.
const OPENING_DIALOGUE_OPTIONS: Record<ProgrammeMode, readonly { a: string; b: string }[]> = {
  NEWS: [
    { a: "Welcome to TKDL LIVE. This is a News Edition, and the board has moved.", b: "Results first, questions afterwards. Let's get into it." },
    { a: "TKDL LIVE is on air with a proper stack of league news.", b: "No warm-up needed tonight. Start with the result everyone is talking about." },
  ],
  BALANCED: [
    { a: "Welcome to TKDL LIVE. We have league movement, analysis, and a little more from around TKDL.", b: "A bit of everything, then — but the main story leads." },
    { a: "TKDL LIVE is back with a Balanced Edition from across the league.", b: "News at the top, features later. That sounds like a decent programme to me." },
  ],
  MAGAZINE: [
    { a: "Welcome to TKDL LIVE. The match board is quiet, so tonight we are going beyond the table.", b: "Players, practice, history and whatever else deserves a proper look. Much better than inventing a crisis." },
    { a: "This is a Magazine Edition of TKDL LIVE — fewer breaking results, more of the stories around them.", b: "Which means you finally let me finish a point without shouting 'breaking news' over it." },
  ],
  SEASON_REVIEW: [
    { a: "Welcome to the TKDL LIVE Season Review.", b: "The titles are settled. Now we can work out how it really happened." },
    { a: "TKDL LIVE is on air for the final word on the season.", b: "Champions, turning points, and a few predictions we may want quietly deleted." },
  ],
  // createWeeklyHighlightsEpisode builds its own opening segment directly
  // (never through this file's own per-entry running-order loop, since a
  // repackaged reel has no running order of its own to walk), but still
  // reads from this same pool rather than a separate one-off line — one
  // dialogue-options convention for "opening," not two.
  WEEKLY_HIGHLIGHTS: [
    { a: "Welcome to the TKDL LIVE weekly highlights reel.", b: "Everything worth seeing from the last seven days, back to back." },
    { a: "TKDL LIVE here with the best of the week.", b: "No new news tonight — just the moments that earned their place the first time round." },
  ],
};

const CLOSING_DIALOGUE_OPTIONS: readonly { a: string; b: string }[] = [
  { a: "That's everything from Kilbirnie for this Edition.", b: "We'll have the next update as soon as there's something worth saying." },
  { a: "And that wraps things up for now.", b: "Get those matches in — we'll be back with more." },
  { a: "That's your lot from us until the next Edition.", b: "Same place, same board, next time." },
];

const WHAT_TO_WATCH_FALLBACK_OPTIONS: readonly { a: string; b: string }[] = [
  { a: "Nothing firm to flag on the title front just yet.", b: "Give it a few more results and there'll be plenty to talk about." },
  { a: "Too early in the picture to call anything just now.", b: "We'll have a proper watch-list once more matches are in the books." },
  { a: "Not enough on the board yet for a real title steer.", b: "Check back once the standings have had a chance to move." },
];

function buildFixedDialogue(pair: { a: string; b: string }): ProgrammeSegment["dialogue"] {
  return [
    { speaker: "A", text: pair.a, holdSeconds: dialogueHoldSeconds(pair.a) },
    { speaker: "B", text: pair.b, holdSeconds: dialogueHoldSeconds(pair.b) },
  ];
}

type LeaderboardMovementRow = {
  id: number;
  name: string;
  beforePosition: number;
  afterPosition: number;
  movement: "up" | "down" | "same";
  points: number;
  wins: number;
  losses: number;
};

function positionsById(rows: { id: number; points: number; elo: number; eliminated: boolean }[]): Map<number, number> {
  const ordered = [...rows].sort((a, b) =>
    Number(a.eliminated) - Number(b.eliminated)
    || b.points - a.points
    || b.elo - a.elo
    || a.id - b.id
  );
  return new Map(ordered.map((row, index) => [row.id, index + 1]));
}

/** Builds the sports-show table beat from the same baseline result stories
 * that make up the catch-up rundown. Reversing each participant to their
 * earliest verified pre-match points makes the arrows describe this update's
 * results, even if an earlier failed/rebuilt Edition already wrote a title
 * snapshot after those matches. */
async function buildCatchUpLeaderboardSegments(pool: readonly BroadcastStory[]): Promise<ProgrammeSegment[]> {
  const result: ProgrammeSegment[] = [];

  const singlesResults = pool
    .filter(story => story.storyType === "MATCH_RESULT")
    .sort((a, b) => Date.parse(String(a.facts.playedAt)) - Date.parse(String(b.facts.playedAt)) || a.id - b.id);
  if (singlesResults.length > 0) {
    const current = await db.select({
      id: playersTable.id,
      name: playersTable.name,
      points: playersTable.points,
      wins: playersTable.seasonWins,
      losses: playersTable.seasonLosses,
      elo: playersTable.elo,
      status: playersTable.status,
    }).from(playersTable).where(eq(playersTable.isActive, true));

    const beforePoints = new Map(current.map(row => [row.id, row.points]));
    const firstSeen = new Set<number>();
    for (const story of singlesResults) {
      const facts = story.facts;
      const winnerId = Number(facts.winnerId);
      const loserId = Number(facts.loserId);
      if (!firstSeen.has(winnerId) && Number.isFinite(Number(facts.winnerPointsBefore))) {
        beforePoints.set(winnerId, Number(facts.winnerPointsBefore));
        firstSeen.add(winnerId);
      }
      if (!firstSeen.has(loserId) && Number.isFinite(Number(facts.loserPointsBefore))) {
        beforePoints.set(loserId, Number(facts.loserPointsBefore));
        firstSeen.add(loserId);
      }
    }

    const beforePositions = positionsById(current.map(row => ({
      id: row.id, points: beforePoints.get(row.id) ?? row.points, elo: row.elo, eliminated: false,
    })));
    const afterPositions = positionsById(current.map(row => ({
      id: row.id, points: row.points, elo: row.elo, eliminated: row.status === "ELIMINATED",
    })));
    const rows: LeaderboardMovementRow[] = [...current]
      .sort((a, b) => (afterPositions.get(a.id) ?? 999) - (afterPositions.get(b.id) ?? 999))
      .map(row => {
        const beforePosition = beforePositions.get(row.id) ?? afterPositions.get(row.id) ?? 1;
        const afterPosition = afterPositions.get(row.id) ?? beforePosition;
        return {
          id: row.id, name: row.name, beforePosition, afterPosition,
          movement: afterPosition < beforePosition ? "up" : afterPosition > beforePosition ? "down" : "same",
          points: row.points, wins: row.wins, losses: row.losses,
        };
      });

    const count = new Set(singlesResults.map(story => story.anchorMatchId)).size;
    const eliminatedIds = new Set(pool
      .filter(story => story.storyType === "ELIMINATION")
      .map(story => Number(story.facts.loserId))
      .filter(Number.isFinite));
    const eliminatedNames = current
      .filter(row => eliminatedIds.has(row.id))
      .map(row => row.name);
    const dangerPlayer = current
      .filter(row => row.status !== "ELIMINATED" && row.points > 0)
      .sort((a, b) => a.points - b.points || a.name.localeCompare(b.name))[0];
    const consequenceLine = eliminatedNames.length > 0
      ? `${eliminatedNames.join(" and ")} ${eliminatedNames.length === 1 ? "has" : "have"} hit zero and ${eliminatedNames.length === 1 ? "is" : "are"} eliminated.${dangerPlayer ? ` ${dangerPlayer.name} is now closest to the danger zone on ${dangerPlayer.points} points.` : ""}`
      : dangerPlayer
        ? `${dangerPlayer.name} is closest to the danger zone on ${dangerPlayer.points} points — one heavy wager can change a season quickly.`
        : "Green arrows mark the climbers and red marks the players pushed down.";
    result.push({
      slot: 7,
      purpose: "leaderboard_after_results",
      importance: "utility",
      storyId: null,
      supportingStoryIds: [],
      storyType: null,
      leagueType: "singles",
      lifecycleAtBroadcast: null,
      dialogue: buildFixedDialogue({
        a: `Those ${count === 1 ? "result has" : `${count} results have`} changed the Singles picture. Here is the table after the matches.`,
        b: consequenceLine,
      }),
      validityRules: [],
      facts: { rows, resultCount: count },
      graphicKind: "LeagueTableGraphic",
    });
  }

  const doublesResults = pool
    .filter(story => story.storyType === "PAIR_RESULT")
    .sort((a, b) => Date.parse(String(a.facts.playedAt)) - Date.parse(String(b.facts.playedAt)) || a.id - b.id);
  if (doublesResults.length > 0) {
    const current = (await db.execute(sql`
      SELECT id, team_name, points, wins, losses, elo, is_eliminated
      FROM doubles_teams
      WHERE season_id IN (
        SELECT id FROM seasons WHERE league_type = 'doubles' AND is_active = true
      )
    `)).rows as { id: number; team_name: string; points: number; wins: number; losses: number; elo: number; is_eliminated: boolean }[];
    const beforePoints = new Map(current.map(row => [row.id, row.points]));
    const firstSeen = new Set<number>();
    for (const story of doublesResults) {
      const facts = story.facts;
      const winnerId = Number(facts.winnerTeamId);
      const loserId = Number(facts.loserTeamId);
      if (!firstSeen.has(winnerId) && Number.isFinite(Number(facts.winnerPointsBefore))) {
        beforePoints.set(winnerId, Number(facts.winnerPointsBefore));
        firstSeen.add(winnerId);
      }
      if (!firstSeen.has(loserId) && Number.isFinite(Number(facts.loserPointsBefore))) {
        beforePoints.set(loserId, Number(facts.loserPointsBefore));
        firstSeen.add(loserId);
      }
    }
    const beforePositions = positionsById(current.map(row => ({
      id: row.id, points: beforePoints.get(row.id) ?? row.points, elo: row.elo, eliminated: false,
    })));
    const afterPositions = positionsById(current.map(row => ({
      id: row.id, points: row.points, elo: row.elo, eliminated: row.is_eliminated,
    })));
    const rows: LeaderboardMovementRow[] = [...current]
      .sort((a, b) => (afterPositions.get(a.id) ?? 999) - (afterPositions.get(b.id) ?? 999))
      .map(row => {
        const beforePosition = beforePositions.get(row.id) ?? afterPositions.get(row.id) ?? 1;
        const afterPosition = afterPositions.get(row.id) ?? beforePosition;
        return {
          id: row.id, name: row.team_name, beforePosition, afterPosition,
          movement: afterPosition < beforePosition ? "up" : afterPosition > beforePosition ? "down" : "same",
          points: row.points, wins: row.wins, losses: row.losses,
        };
      });
    const count = new Set(doublesResults.map(story => story.anchorMatchId)).size;
    result.push({
      slot: 8,
      purpose: "leaderboard_after_results",
      importance: "utility",
      storyId: null,
      supportingStoryIds: [],
      storyType: null,
      leagueType: "doubles",
      lifecycleAtBroadcast: null,
      dialogue: buildFixedDialogue({
        a: `Now the Doubles table after ${count === 1 ? "that result" : `${count} new results`}.`,
        b: "The arrows show exactly who moved and who was pushed the other way.",
      }),
      validityRules: [],
      facts: { rows, resultCount: count },
      graphicKind: "LeagueTableGraphic",
    });
  }

  return result;
}

/**
 * Season Finale-only ceremony content: "gamerscore leaderboard" and "Hall of
 * Fame nods", named explicitly as their own moments (task's own "Season
 * Finale / Awards Night special episode" ask) alongside champion crowning
 * and the season's biggest upset (director-season-review.ts's own
 * findBiggestUpset). Built the same way the two catch-up leaderboard
 * segments above are: a real DB query straight into a utility ProgrammeSegment
 * with an explicit graphicKind override, never a broadcast_stories row — a
 * career-wide, whole-club shoutout genuinely isn't "this season's news," so
 * it has no place in the Story Engine's own per-season detection pipeline,
 * only in this one special episode's own running order. Each board is
 * omitted outright (never fabricated with placeholder zeros) if the data
 * behind it doesn't exist yet — same "never a story and nothing to show"
 * discipline director-season-review.ts's own pickFillerPromo documents.
 */
async function buildSeasonFinaleSpecialSegments(): Promise<ProgrammeSegment[]> {
  const result: ProgrammeSegment[] = [];

  // ── Gamerscore leaderboard — the same three DB-backed sources routes/
  // leaderboard.ts's own /leaderboard/achievements totals (league
  // achievements, Tour achievements + trophies), plus Shadow Bot's own
  // achievements, which that route also only resolves in application code
  // (SHADOW_BOT_ACHIEVEMENT_DEFS has no DB-side gamerscore column to SUM).
  // Top 5 active players only — a season finale board, not the full roster.
  const [achievementRows, shadowRows] = await Promise.all([
    db.execute(sql`
      WITH lg AS (
        SELECT pa.player_id,
          COALESCE(SUM(CASE a.rarity
            WHEN 'Common' THEN 5 WHEN 'Uncommon' THEN 10 WHEN 'Rare' THEN 25
            WHEN 'Epic' THEN 50 WHEN 'Legendary' THEN 100 WHEN 'Mythic' THEN 250
            ELSE 5 END), 0)::int AS league_gs
        FROM player_achievements pa JOIN achievements a ON a.id = pa.achievement_id
        GROUP BY pa.player_id
      ),
      tg AS (
        SELECT pta.player_id, COALESCE(SUM(tad.gamerscore), 0)::int AS tour_gs
        FROM player_tour_achievements pta
        JOIN tour_achievement_definitions tad ON tad.key = pta.achievement_key
        GROUP BY pta.player_id
      ),
      tt AS (
        SELECT player_id, COALESCE(SUM(gamerscore), 0)::int AS trophy_gs
        FROM tour_trophies GROUP BY player_id
      )
      SELECT p.id, p.name,
        COALESCE(lg.league_gs, 0) + COALESCE(tg.tour_gs, 0) + COALESCE(tt.trophy_gs, 0) AS total_gs
      FROM players p
      LEFT JOIN lg ON lg.player_id = p.id
      LEFT JOIN tg ON tg.player_id = p.id
      LEFT JOIN tt ON tt.player_id = p.id
      WHERE p.is_active = true
    `),
    db.execute(sql`
      SELECT player_id, achievement_key FROM shadow_bot_achievements
      WHERE player_id IN (SELECT id FROM players WHERE is_active = true)
    `),
  ]);
  const shadowGsByPlayer = new Map<number, number>();
  for (const row of shadowRows.rows as { player_id: number; achievement_key: string }[]) {
    const def = SHADOW_BOT_ACHIEVEMENT_DEFS.find(d => d.key === row.achievement_key);
    const gs = def ? gamerscoreForRarity(def.rarity) : 0;
    shadowGsByPlayer.set(Number(row.player_id), (shadowGsByPlayer.get(Number(row.player_id)) ?? 0) + gs);
  }
  const gamerscoreRows = (achievementRows.rows as { id: number; name: string; total_gs: number }[])
    .map(row => ({ id: Number(row.id), name: row.name, totalGs: Number(row.total_gs) + (shadowGsByPlayer.get(Number(row.id)) ?? 0) }))
    .filter(row => row.totalGs > 0)
    .sort((a, b) => b.totalGs - a.totalGs || a.name.localeCompare(b.name))
    .slice(0, 5);

  if (gamerscoreRows.length > 0) {
    result.push({
      slot: 0, purpose: "season_finale_board", importance: "utility",
      storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
      dialogue: buildFixedDialogue({
        a: "Before the credits roll, the gamerscore board — every achievement, trophy and milestone across the whole club.",
        b: `${gamerscoreRows[0].name} leads the way on ${gamerscoreRows[0].totalGs.toLocaleString()} gamerscore.`,
      }),
      validityRules: [],
      facts: {
        specialKind: "gamerscore_leaderboard",
        title: "Gamerscore Leaderboard",
        rows: gamerscoreRows.map((row, index) => ({ rank: index + 1, name: row.name, gamerscore: row.totalGs })),
      },
      graphicKind: "SeasonSpecialGraphic",
    });
  }

  // ── Hall of Fame nods — career-wide record shoutouts (stats.ts's own
  // /stats/hall-of-fame already surfaces these as a standalone page; this is
  // the same real numbers, read directly rather than over HTTP, voiced as a
  // short "nod" rather than that page's own full leaderboard). Any league's
  // title counts toward "Most League Titles" — a finale closing out one or
  // two leagues' seasons still airs this as a whole-club honour, same as
  // LeagueAwardsShow.tsx's own champions-across-every-league intro slide.
  const [players, titleRows, achievementCountRows] = await Promise.all([
    db.select({ id: playersTable.id, name: playersTable.name, careerWins: playersTable.careerWins, careerPeakElo: playersTable.careerPeakElo })
      .from(playersTable).where(eq(playersTable.isActive, true)),
    db.select({ championId: seasonsTable.championId }).from(seasonsTable).where(eq(seasonsTable.isActive, false)),
    db.execute(sql`
      SELECT player_id, SUM(cnt)::int AS cnt FROM (
        SELECT player_id, COUNT(*) AS cnt FROM player_achievements      GROUP BY player_id
        UNION ALL
        SELECT player_id, COUNT(*) AS cnt FROM shadow_bot_achievements  GROUP BY player_id
        UNION ALL
        SELECT player_id, COUNT(*) AS cnt FROM player_tour_achievements GROUP BY player_id
      ) t GROUP BY player_id
    `),
  ]);
  const titleCounts = new Map<number, number>();
  for (const row of titleRows) {
    if (row.championId) titleCounts.set(row.championId, (titleCounts.get(row.championId) ?? 0) + 1);
  }
  const achievementCounts = new Map<number, number>();
  for (const row of achievementCountRows.rows as { player_id: number; cnt: number }[]) {
    achievementCounts.set(Number(row.player_id), Number(row.cnt));
  }
  const byId = new Map(players.map(p => [p.id, p]));

  const nods: { category: string; name: string; stat: string }[] = [];
  const mostTitled = [...titleCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (mostTitled && byId.has(mostTitled[0])) {
    nods.push({ category: "Most League Titles", name: byId.get(mostTitled[0])!.name, stat: `${mostTitled[1]} title${mostTitled[1] === 1 ? "" : "s"}` });
  }
  const highestElo = [...players].filter(p => p.careerPeakElo > 0).sort((a, b) => b.careerPeakElo - a.careerPeakElo)[0];
  if (highestElo) nods.push({ category: "Highest Peak Elo", name: highestElo.name, stat: `${highestElo.careerPeakElo} Elo` });
  const mostWins = [...players].filter(p => p.careerWins > 0).sort((a, b) => b.careerWins - a.careerWins)[0];
  if (mostWins) nods.push({ category: "Most Career Wins", name: mostWins.name, stat: `${mostWins.careerWins} win${mostWins.careerWins === 1 ? "" : "s"}` });
  const mostAchievements = [...achievementCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (mostAchievements && byId.has(mostAchievements[0])) {
    nods.push({ category: "Most Achievements", name: byId.get(mostAchievements[0])!.name, stat: `${mostAchievements[1]} earned` });
  }

  if (nods.length > 0) {
    result.push({
      slot: 0, purpose: "season_finale_board", importance: "utility",
      storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
      dialogue: buildFixedDialogue({
        a: "And a nod to the Hall of Fame — the records that stand across every season this club has played.",
        b: `${nods[0].name} leads "${nods[0].category}" on ${nods[0].stat}.`,
      }),
      validityRules: [],
      facts: { specialKind: "hall_of_fame_nods", title: "Hall of Fame Nods", nods },
      graphicKind: "SeasonSpecialGraphic",
    });
  }

  return result;
}

/**
 * Slot 11's required sign-off (11.1) — always present, never a full segment
 * of its own. The A-line stays one of the fixed CLOSING_DIALOGUE_OPTIONS
 * wrap-ups exactly as before. The B-line is where "what's coming up" lives:
 * when director.ts has attached a genuinely forward-looking storyline to
 * this entry (the same LEAGUE story driving slot 10's "what to watch" recap,
 * or a live win/loss streak — see director.ts's own header on slot 11) AND
 * that story's type has a closing-tease-math.ts template, the B-line
 * becomes a real, fact-checked tease ("keep an eye on the title race...")
 * instead of always repeating the same handful of fixed generic lines —
 * direct response to player feedback that the show felt like "a constant
 * same episode loop" with no reason to check back. Any failure along that
 * path (a story type with no template, or — defensively — an interpolation
 * error) falls straight back to the original fixed B-line: a decorative
 * aside is never worth risking the segment over.
 *
 * storyId/storyType/leagueType/facts stay null exactly as before, even when
 * a tease renders successfully: this is presenter narration ABOUT a story
 * already given its own real segment elsewhere (or, for a streak, about to
 * get one via the normal FORM slot), not a second segment about it — so
 * findDuplicateStoryIds' and the frontend's "closing has no story of its
 * own" invariant is unchanged, and no 10.4 exposure/airtime accounting is
 * needed (director.ts never calls commit() for this attachment either).
 */
async function buildClosingSegment(entry: RunningOrderEntry, slotKey: string, config: BroadcastConfig): Promise<ProgrammeSegment> {
  const aLine = pickFrom(CLOSING_DIALOGUE_OPTIONS, commentaryRng(slotKey, "utility:closing:a", config.commentaryVersion)).a;

  let bLine: string | null = null;
  const story = entry.group?.primary ?? null;
  if (story && hasClosingTease(story.storyType as StoryType)) {
    try {
      const templates = CLOSING_TEASE_TEMPLATES[story.storyType as StoryType]!;
      const template = pickFrom(templates, commentaryRng(slotKey, "utility:closing:tease", config.commentaryVersion));
      const templateFacts = await buildTemplateFacts(story.leagueType, story.facts);
      bLine = interpolateTemplate(template, templateFacts);
    } catch {
      bLine = null; // e.g. MissingFactError — fall back below rather than ever throwing over a decorative aside.
    }
  }
  if (bLine === null) {
    bLine = pickFrom(CLOSING_DIALOGUE_OPTIONS, commentaryRng(slotKey, "utility:closing:b", config.commentaryVersion)).b;
  }

  return {
    slot: entry.slot, purpose: "closing", importance: "utility",
    storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
    dialogue: [
      { speaker: "A", text: aLine, holdSeconds: dialogueHoldSeconds(aLine) },
      { speaker: "B", text: bLine, holdSeconds: dialogueHoldSeconds(bLine) },
    ],
    validityRules: [],
    facts: null,
  };
}

/**
 * A brief, high-energy flash of this Edition's single most dramatic result,
 * aired BEFORE slot 1's own fixed "opening" sign-on — see cold-open-math.ts's
 * own header for the full design reasoning. storyId stays null (the exact
 * same convention buildClosingSegment's own forward-looking tease already
 * uses, immediately above): this is presenter narration ABOUT a story that
 * gets its own full, separate segment moments later in the real running
 * order, never a second segment about it, so it needs no graphic of its
 * own, no 10.4 exposure/airtime accounting, and can never trip
 * findDuplicateStoryIds. Returns null (no cold open this Edition) on any
 * interpolation failure or if this story type simply has no template — a
 * decorative hook is never worth risking a build over, exactly like
 * buildClosingSegment's own tease falls back rather than ever throwing.
 */
async function buildColdOpenSegment(story: BroadcastStory, slotKey: string, config: BroadcastConfig): Promise<ProgrammeSegment | null> {
  if (!hasColdOpenTease(story.storyType as StoryType)) return null;
  try {
    const templates = COLD_OPEN_TEASE_TEMPLATES[story.storyType as keyof typeof COLD_OPEN_TEASE_TEMPLATES];
    const pair = pickFrom(templates, commentaryRng(slotKey, "utility:cold_open", config.commentaryVersion));
    const templateFacts = await buildTemplateFacts(story.leagueType, story.facts);
    const aLine = interpolateTemplate(pair.a, templateFacts);
    const bLine = interpolateTemplate(pair.b, templateFacts);
    return {
      slot: 0, purpose: "cold_open", importance: "utility",
      storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
      dialogue: [
        { speaker: "A", text: aLine, holdSeconds: dialogueHoldSeconds(aLine) },
        { speaker: "B", text: bLine, holdSeconds: dialogueHoldSeconds(bLine) },
      ],
      validityRules: [],
      facts: null,
    };
  } catch {
    return null; // e.g. MissingFactError — skip the cold open rather than ever risking broken/placeholder text.
  }
}

/**
 * A brief "come and join us at the desk" invitation for a real player who
 * just hit a genuine, celebratory career milestone this Edition — see
 * guest-cameo-math.ts's own header for the full design, especially why
 * neither line is ever attributed to the guest themselves. storyId stays
 * null (the same convention buildColdOpenSegment/buildClosingSegment both
 * already use): this is presenter narration ABOUT a story that gets its
 * own full, separate segment elsewhere in the running order, never a
 * second segment about it. Returns null (no cameo) on any interpolation
 * failure or if this story type has no template — a decorative moment is
 * never worth risking a build over.
 */
async function buildGuestCameoSegment(story: BroadcastStory, slotKey: string, config: BroadcastConfig): Promise<ProgrammeSegment | null> {
  if (!hasGuestCameo(story.storyType as StoryType)) return null;
  try {
    const templates = GUEST_CAMEO_TEMPLATES[story.storyType as StoryType]!;
    const pair = pickFrom(templates, commentaryRng(slotKey, `utility:guest_cameo:${story.id}`, config.commentaryVersion));
    const templateFacts = await buildTemplateFacts(story.leagueType, story.facts);
    const aLine = interpolateTemplate(pair.a, templateFacts);
    const bLine = interpolateTemplate(pair.b, templateFacts);
    return {
      slot: 0, purpose: "guest_cameo", importance: "utility",
      storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
      dialogue: [
        { speaker: "A", text: aLine, holdSeconds: dialogueHoldSeconds(aLine) },
        { speaker: "B", text: bLine, holdSeconds: dialogueHoldSeconds(bLine) },
      ],
      validityRules: [],
      facts: null,
    };
  } catch {
    return null; // e.g. MissingFactError — skip the cameo rather than ever risking broken/placeholder text.
  }
}

/**
 * The presenters making a specific, later-checkable call on a player
 * currently on a win streak — see presenter-prediction-math.ts's own header.
 * storyId stays null, same convention as every other utility beat above:
 * this is narration ABOUT the WIN_STREAK story that just aired its own real
 * segment elsewhere, never a second segment about it. Returns null on any
 * interpolation failure, same fail-soft behaviour as every sibling builder.
 */
async function buildPresenterPredictionSegment(playerId: number, currentWinStreak: number, slotKey: string, config: BroadcastConfig): Promise<ProgrammeSegment | null> {
  try {
    const pair = pickFrom(PREDICTION_MAKE_TEMPLATES, commentaryRng(slotKey, `utility:presenter_prediction:make:${playerId}`, config.commentaryVersion));
    const templateFacts = await buildTemplateFacts("singles", { playerId, currentWinStreak });
    const aLine = interpolateTemplate(pair.a, templateFacts);
    const bLine = interpolateTemplate(pair.b, templateFacts);
    return {
      slot: 0, purpose: "presenter_prediction", importance: "utility",
      storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
      dialogue: [
        { speaker: "A", text: aLine, holdSeconds: dialogueHoldSeconds(aLine) },
        { speaker: "B", text: bLine, holdSeconds: dialogueHoldSeconds(bLine) },
      ],
      validityRules: [],
      facts: null,
    };
  } catch {
    return null;
  }
}

/**
 * The follow-up on an earlier presenter_prediction call, once it's actually
 * resolved (see findResolvedPresenterPrediction below) — graded purely from
 * the subject's own real, live win-streak number, never anything invented.
 * storyId stays null for the same reason as buildPresenterPredictionSegment.
 */
async function buildPresenterPredictionGradedSegment(
  playerId: number, streakAtPrediction: number, currentWinStreak: number, outcome: "correct" | "incorrect", slotKey: string, config: BroadcastConfig,
): Promise<ProgrammeSegment | null> {
  try {
    const templates = outcome === "correct" ? PREDICTION_CORRECT_TEMPLATES : PREDICTION_INCORRECT_TEMPLATES;
    const pair = pickFrom(templates, commentaryRng(slotKey, `utility:presenter_prediction:grade:${playerId}`, config.commentaryVersion));
    const templateFacts = await buildTemplateFacts("singles", { playerId, currentWinStreak, streakAtPrediction });
    const aLine = interpolateTemplate(pair.a, templateFacts);
    const bLine = interpolateTemplate(pair.b, templateFacts);
    return {
      slot: 0, purpose: "presenter_prediction_graded", importance: "utility",
      storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
      dialogue: [
        { speaker: "A", text: aLine, holdSeconds: dialogueHoldSeconds(aLine) },
        { speaker: "B", text: bLine, holdSeconds: dialogueHoldSeconds(bLine) },
      ],
      validityRules: [],
      facts: null,
    };
  } catch {
    return null;
  }
}

// ── Presenter prediction bookkeeping (13.4's own "PRESENTER_PREDICTION"
// memory type) — one pending call per subject at a time: recordPresenterPrediction
// only ever INSERTs (onConflictDoNothing), so a subject already carrying an
// unresolved call never has its original streakAtPrediction baseline
// clobbered by a fresh one before the first gets a chance to resolve.
const PRESENTER_PREDICTION_MEMORY_KEY = "win_streak";

type PendingPresenterPrediction = { subjectKey: string; playerId: number; streakAtPrediction: number; lastEditionId: number };

async function loadPendingPresenterPredictions(): Promise<PendingPresenterPrediction[]> {
  const rows = await db.select().from(broadcastMemoryTable).where(eq(broadcastMemoryTable.memoryType, "PRESENTER_PREDICTION"));
  const result: PendingPresenterPrediction[] = [];
  for (const row of rows) {
    const payload = row.payload as { playerId?: number; streakAtPrediction?: number } | null;
    if (!row.subjectKey || row.lastEditionId === null || !payload || typeof payload.playerId !== "number" || typeof payload.streakAtPrediction !== "number") continue;
    result.push({ subjectKey: row.subjectKey, playerId: payload.playerId, streakAtPrediction: payload.streakAtPrediction, lastEditionId: row.lastEditionId });
  }
  return result;
}

async function clearPresenterPrediction(subjectKey: string): Promise<void> {
  await db.delete(broadcastMemoryTable).where(and(
    eq(broadcastMemoryTable.memoryType, "PRESENTER_PREDICTION"),
    eq(broadcastMemoryTable.memoryKey, PRESENTER_PREDICTION_MEMORY_KEY),
    eq(broadcastMemoryTable.subjectKey, subjectKey),
  ));
}

async function recordPresenterPrediction(subjectKey: string, playerId: number, streakAtPrediction: number, editionId: number): Promise<void> {
  await db
    .insert(broadcastMemoryTable)
    .values({ memoryType: "PRESENTER_PREDICTION", memoryKey: PRESENTER_PREDICTION_MEMORY_KEY, subjectKey, lastUsedAt: new Date(), lastEditionId: editionId, usageCount: 1, payload: { playerId, streakAtPrediction } })
    .onConflictDoNothing({ target: [broadcastMemoryTable.memoryType, broadcastMemoryTable.memoryKey, broadcastMemoryTable.subjectKey] });
}

/**
 * Finds (at most) one pending call that's actually ready to follow up on —
 * either resolved (the subject's real, live win-streak now reads higher or
 * lower than it did when the call was made) or stale enough to drop
 * silently (see MAX_EDITIONS_BEFORE_PREDICTION_EXPIRES). Only ever returns
 * the first one found; any others stay pending and get another chance next
 * build, exactly like a real pundit only gets to revisit one old call at a
 * time rather than opening every Edition with a scoreboard of them.
 */
async function findResolvedPresenterPrediction(currentEditionId: number): Promise<{ playerId: number; streakAtPrediction: number; currentWinStreak: number; outcome: "correct" | "incorrect"; subjectKey: string } | null> {
  const pending = await loadPendingPresenterPredictions();
  if (pending.length === 0) return null;

  const playerIds = [...new Set(pending.map(p => p.playerId))];
  const playerRows = await db.select({ id: playersTable.id, currentWinStreak: playersTable.currentWinStreak }).from(playersTable).where(inArray(playersTable.id, playerIds));
  const streakByPlayerId = new Map(playerRows.map(r => [r.id, r.currentWinStreak]));

  for (const prediction of pending) {
    const editionsElapsed = Math.max(0, currentEditionId - prediction.lastEditionId);
    if (editionsElapsed === 0) continue; // never grade in the same build the call was made

    const currentWinStreak = streakByPlayerId.get(prediction.playerId);
    if (currentWinStreak === undefined) {
      await clearPresenterPrediction(prediction.subjectKey); // player record no longer exists — drop rather than risk a stale read
      continue;
    }

    const outcome = gradeWinStreakPrediction(prediction.streakAtPrediction, currentWinStreak);
    if (outcome === "pending") {
      if (editionsElapsed >= MAX_EDITIONS_BEFORE_PREDICTION_EXPIRES) await clearPresenterPrediction(prediction.subjectKey);
      continue;
    }
    return { playerId: prediction.playerId, streakAtPrediction: prediction.streakAtPrediction, currentWinStreak, outcome, subjectKey: prediction.subjectKey };
  }
  return null;
}

// A lightweight defensive scan over final rendered text — see this file's
// own header for why this is a real (if simple) safety net, not the primary
// enforcement mechanism. TKDL has no fixture/scheduling system at all
// (matches are recorded after the fact, never scheduled ahead of time), so
// no detector or phrase template should ever produce future-fixture
// language in the first place (Appendix D's own acceptance checklist: "No
// code assumes a future fixture exists").
const FUTURE_MATCH_LANGUAGE_PATTERN = /\b(will (face|play|meet)|next (match|fixture|game)|upcoming (match|fixture|game)|is (scheduled|set) to (play|face)|forthcoming (match|fixture))\b/i;

function hasFutureMatchLanguage(segments: readonly ProgrammeSegment[]): boolean {
  return segments.some(seg => seg.dialogue.some(d => FUTURE_MATCH_LANGUAGE_PATTERN.test(d.text)));
}

/** Should always be false — interpolateTemplate() (commentary-math.ts) throws MissingFactError rather than ever emitting a raw "{{...}}" — kept as a genuine, cheap double-check rather than trusting that invariant blindly. */
function hasUnresolvedPlaceholderText(segments: readonly ProgrammeSegment[]): boolean {
  return segments.some(seg => seg.dialogue.some(d => d.text.includes("{{")));
}

/**
 * Guards against the real repetition bug — the SAME story airing as two
 * separate FULL segments in one Edition (director.ts's own slot-filling
 * already marks a group `used` precisely to prevent this, so seeing it here
 * would mean that guarantee broke). Two purposes are deliberately excluded
 * from this check because they're DESIGNED to repeat a storyId that already
 * has a full segment elsewhere, per director.ts's own header comments:
 * "headlines" is explicitly "a brief tease of up to 3 of the stories
 * ALREADY placed above," and "what_to_watch" is explicitly allowed to
 * "legitimately re-reference the best LEAGUE candidate already placed
 * elsewhere (recapping the open question is real content, not duplication)"
 * when no unused LEAGUE story remains. Counting either of those as a
 * "duplicate" would fail the quality gate on the ordinary, intended case of
 * a successful story getting both a headline tease and its own segment —
 * discarding the whole Edition over the very thing the tease/recap slots
 * exist to do.
 */
function findDuplicateStoryIds(segments: readonly ProgrammeSegment[]): boolean {
  const seen = new Set<number>();
  for (const seg of segments) {
    if (seg.storyId === null) continue;
    if (seg.purpose === "headlines" || seg.purpose === "what_to_watch") continue;
    if (seen.has(seg.storyId)) return true;
    seen.add(seg.storyId);
  }
  return false;
}

/** Exported for live-events.ts's own reuse when reading back the current published Edition's programme — the same runtime guard, not a second copy of it. */
export function isEditionProgramme(value: unknown): value is EditionProgramme {
  return typeof value === "object" && value !== null && Array.isArray((value as { segments?: unknown }).segments);
}

// ═══════════════════════════════════════════════════════════════════════
// broadcast_editions reads
// ═══════════════════════════════════════════════════════════════════════

/** Exported for live-events.ts's own reuse — the live endpoint needs the same "current published Edition" read this file already implements, rather than a second, potentially-drifting copy of the same query. */
export async function latestPublishedEdition(): Promise<BroadcastEdition | null> {
  const [row] = await db
    .select()
    .from(broadcastEditionsTable)
    .where(eq(broadcastEditionsTable.status, "PUBLISHED"))
    .orderBy(desc(broadcastEditionsTable.publishedAt), desc(broadcastEditionsTable.id))
    .limit(1);
  return row ?? null;
}

// ═══════════════════════════════════════════════════════════════════════
// 16.4 Concurrency — claim exclusive build ownership of one logical slot
// ═══════════════════════════════════════════════════════════════════════

type ClaimResult =
  | { kind: "owned"; row: BroadcastEdition }
  /** Already PUBLISHED or SKIPPED — nothing to build; the caller returns this (or the latest published Edition) directly. */
  | { kind: "terminal"; row: BroadcastEdition }
  /** Another request is BUILDING this exact slot right now — 16.4: "other requests serve the last published Edition while the build completes." */
  | { kind: "building_elsewhere" };

/**
 * INSERT ... ON CONFLICT DO NOTHING on the unique slot_key, exactly as 16.4
 * specifies, plus one real enhancement the doc leaves unspecified but the
 * existing schema already supports cleanly: a slot stuck FAILED from a
 * previous attempt is reclaimed via a conditional UPDATE ... WHERE
 * status='FAILED' rather than being permanently unbuildable (the unique
 * slot_key constraint would otherwise block every future INSERT for that
 * slot forever, meaning one bad build could never be retried even on the
 * very next lazy check).
 */
async function claimBuildOwnership(slot: ResolvedSlot, now: Date, programmeVersion: number): Promise<ClaimResult> {
  const [existing] = await db.select().from(broadcastEditionsTable).where(eq(broadcastEditionsTable.slotKey, slot.slotKey)).limit(1);

  if (existing) {
    if (existing.status === "PUBLISHED" || existing.status === "SKIPPED") return { kind: "terminal", row: existing };
    if (existing.status === "BUILDING") return { kind: "building_elsewhere" };

    // existing.status === "FAILED" — attempt to reclaim it for a fresh build.
    const [reclaimed] = await db
      .update(broadcastEditionsTable)
      .set({ status: "BUILDING" satisfies EditionStatus })
      .where(and(eq(broadcastEditionsTable.id, existing.id), eq(broadcastEditionsTable.status, "FAILED")))
      .returning();
    if (reclaimed) return { kind: "owned", row: reclaimed };

    // Lost the reclaim race to a concurrent retry — defer to whatever it now is.
    const [afterRace] = await db.select().from(broadcastEditionsTable).where(eq(broadcastEditionsTable.id, existing.id)).limit(1);
    if (afterRace?.status === "PUBLISHED" || afterRace?.status === "SKIPPED") return { kind: "terminal", row: afterRace };
    return { kind: "building_elsewhere" };
  }

  const [inserted] = await db
    .insert(broadcastEditionsTable)
    .values({
      slotKey: slot.slotKey, slotType: slot.slotType, scheduledFor: slot.scheduledFor,
      dataCutoff: now, status: "BUILDING", changeScore: 0, programmeVersion,
      programme: null, diagnostic: null, publishedAt: null,
    })
    .onConflictDoNothing({ target: broadcastEditionsTable.slotKey })
    .returning();
  if (inserted) return { kind: "owned", row: inserted };

  // Lost the INSERT race to a concurrent request — defer to whatever it is now.
  const [afterRace] = await db.select().from(broadcastEditionsTable).where(eq(broadcastEditionsTable.slotKey, slot.slotKey)).limit(1);
  if (afterRace?.status === "PUBLISHED" || afterRace?.status === "SKIPPED") return { kind: "terminal", row: afterRace };
  return { kind: "building_elsewhere" };
}

// ═══════════════════════════════════════════════════════════════════════
// Admin build lock — mutual exclusion between the three producer-triggered
// build actions (regenerate / create episode / clean sweep)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Each of forceRebuildCurrentEdition/createManualBroadcastEpisode/
 * createBroadcastCleanSweep mints its own always-unique slot_key
 * specifically so it never collides with the scheduled path's logical slot
 * — but that also means none of the three collide with EACH OTHER, or with
 * a second concurrent call to themselves. This is a separate, dedicated
 * single-row lock (see add_broadcast_admin_build_lock.ts's own header for
 * why it isn't just broadcast_editions' own slot_key uniqueness) that all
 * three claim before doing any real work and release when they're done,
 * whether they succeed or fail.
 *
 * Stale-reclaim mirrors claimBuildOwnership()'s own FAILED-reclaim: a
 * process that crashed mid-build without reaching its release would
 * otherwise leave every future admin build action permanently refused.
 *
 * The stale check is heartbeat-based, not "how long since the lock was
 * claimed": a real build's own duration scales with the admin-configurable
 * broadcast_simulation_count (up to MAX_BROADCAST_SIMULATION_COUNT,
 * config-math.ts) and the number of active league/season combinations
 * processLeagueFamily runs the Title Predictor for, sequentially, in
 * story-engine.ts — there's no fixed upper bound on a legitimately slow
 * build. A flat "claimed more than N minutes ago = stale" timeout would
 * have to either be short enough to fight a real slow build (a second
 * admin action reclaiming the lock mid-build — exactly the bug this lock
 * exists to prevent) or long enough that a genuinely crashed holder blocks
 * every admin action for an uncomfortably long time. Refreshing locked_at
 * on a heartbeat while the build is actually running decouples the two:
 * staleness now means "this holder stopped heartbeating," which is a much
 * tighter and still-safe signal regardless of how long the build itself
 * takes.
 */
const ADMIN_BUILD_LOCK_HEARTBEAT_MS = 2 * 60 * 1000;
const ADMIN_BUILD_LOCK_STALE_MS = 3 * ADMIN_BUILD_LOCK_HEARTBEAT_MS; // a few missed heartbeats, not just one, before assuming the holder is gone

async function claimAdminBuildLock(holder: string, now: Date): Promise<boolean> {
  try {
    const staleCutoff = new Date(now.getTime() - ADMIN_BUILD_LOCK_STALE_MS);
    const result = await db.execute(sql`
      UPDATE broadcast_admin_build_lock
      SET locked_by = ${holder}, locked_at = ${now}
      WHERE id = 1 AND (locked_by IS NULL OR locked_at < ${staleCutoff})
    `);
    return (result.rowCount ?? 0) > 0;
  } catch (err) {
    // Missing table (migration hasn't run yet), connection hiccup, etc. —
    // fail closed: refuse the build rather than risk running it unguarded.
    // A real DB outage would fail buildEdition() itself moments later
    // anyway, so this doesn't hide anything; it just fails at the safer
    // point.
    console.error("edition-engine: claimAdminBuildLock failed, refusing to build:", err);
    return false;
  }
}

/** Keeps a held lock's locked_at fresh for as long as a build actually runs — see the lock's own header on why staleness is heartbeat-based rather than a flat claim-time timeout. Call stopAdminBuildLockHeartbeat with the returned handle in the same finally block that releases the lock. */
function startAdminBuildLockHeartbeat(holder: string): NodeJS.Timeout {
  const handle = setInterval(() => {
    void db.execute(sql`
      UPDATE broadcast_admin_build_lock
      SET locked_at = ${new Date()}
      WHERE id = 1 AND locked_by = ${holder}
    `).catch(err => {
      // Best-effort — a missed heartbeat just brings this holder closer to
      // the stale threshold above; it doesn't need to abort the build.
      console.error("edition-engine: admin build lock heartbeat failed:", err);
    });
  }, ADMIN_BUILD_LOCK_HEARTBEAT_MS);
  handle.unref?.(); // never keeps the process alive on its own
  return handle;
}

function stopAdminBuildLockHeartbeat(handle: NodeJS.Timeout): void {
  clearInterval(handle);
}

async function releaseAdminBuildLock(holder: string): Promise<void> {
  try {
    await db.execute(sql`
      UPDATE broadcast_admin_build_lock
      SET locked_by = NULL, locked_at = NULL
      WHERE id = 1 AND locked_by = ${holder}
    `);
  } catch (err) {
    // Best-effort — worst case this holder's lock sits until the stale
    // timeout above reclaims it.
    console.error("edition-engine: releaseAdminBuildLock failed:", err);
  }
}

/** Thrown by the two admin build actions with no "already busy" result kind of their own (createManualBroadcastEpisode/createBroadcastCleanSweep) when the admin build lock is already held; routes/broadcast.ts catches this specifically and returns 409. forceRebuildCurrentEdition doesn't need this — it already has an "already_building" ForceRebuildResult kind to reuse. */
export class AdminBuildLockedError extends Error {
  constructor() {
    super("Another producer build is already in progress — try again shortly");
    this.name = "AdminBuildLockedError";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 10.1 change score inputs — has a season boundary event occurred this batch?
// ═══════════════════════════════════════════════════════════════════════

/** True if any of the three leagues' seasons closed strictly within (cutoffStart, cutoffEnd] — the concrete, checkable proxy for 10.2's "seasonChampionOrResetEventOccurred", mirroring story-engine.ts's own private seasonEndedInWindow() (not exported, so re-derived here rather than reaching into that file's internals). */
async function anySeasonEndedInWindow(cutoffStart: Date, cutoffEnd: Date): Promise<boolean> {
  const closedSeasons = await db.select().from(seasonsTable).where(sql`${seasonsTable.endDate} IS NOT NULL`);
  for (const season of closedSeasons) {
    if (season.isActive || !season.endDate) continue;
    // endDate is a Europe/London calendar day, not UTC — see
    // lib/londonDate.ts's header for why a bare `T00:00:00Z` parse drifts
    // by an hour during BST.
    const endedAt = londonMidnightUtc(season.endDate);
    if (endedAt > cutoffStart && endedAt <= cutoffEnd) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════
// 12.7 banter guardrails — the real counters commentary-math.ts's
// isNegativeBanterAllowed() needs, which only this orchestration layer can
// supply (see commentary-engine.ts's own header on the exposure/banter
// split for exactly why)
// ═══════════════════════════════════════════════════════════════════════

/** A monotonic proxy for "how many full segments have ever aired across the show's history" — no dedicated counter exists in the schema, but SUM(full_count) across every broadcast_stories row (each incremented once per full segment that story itself received) serves the same ordinal purpose: comparing two readings of it tells you how many full segments elapsed in between. */
async function getGlobalFullSegmentCounter(): Promise<number> {
  const rows = (await db.execute(sql`SELECT COALESCE(SUM(full_count), 0)::int AS total FROM broadcast_stories`)).rows as { total: number }[];
  return rows[0]?.total ?? 0;
}

const PLAYER_NEGATIVE_MEMORY_KEY = "negative";

async function getPlayerNegativeState(subjectKey: string): Promise<{ lastEditionId: number; fullSegmentCounterAtUse: number } | null> {
  const [row] = await db
    .select()
    .from(broadcastMemoryTable)
    .where(and(
      eq(broadcastMemoryTable.memoryType, "PLAYER_NEGATIVE"),
      eq(broadcastMemoryTable.memoryKey, PLAYER_NEGATIVE_MEMORY_KEY),
      eq(broadcastMemoryTable.subjectKey, subjectKey),
    ))
    .limit(1);
  if (!row || row.lastEditionId === null) return null;
  const payload = row.payload as { fullSegmentCounterAtUse?: number } | null;
  if (!payload || typeof payload.fullSegmentCounterAtUse !== "number") return null;
  return { lastEditionId: row.lastEditionId, fullSegmentCounterAtUse: payload.fullSegmentCounterAtUse };
}

async function recordPlayerNegativeUse(subjectKey: string, editionId: number, fullSegmentCounterAtUse: number): Promise<void> {
  await db
    .insert(broadcastMemoryTable)
    .values({ memoryType: "PLAYER_NEGATIVE", memoryKey: PLAYER_NEGATIVE_MEMORY_KEY, subjectKey, lastUsedAt: new Date(), lastEditionId: editionId, usageCount: 1, payload: { fullSegmentCounterAtUse } })
    .onConflictDoUpdate({
      target: [broadcastMemoryTable.memoryType, broadcastMemoryTable.memoryKey, broadcastMemoryTable.subjectKey],
      set: { lastUsedAt: new Date(), lastEditionId: editionId, usageCount: sql`${broadcastMemoryTable.usageCount} + 1`, payload: { fullSegmentCounterAtUse } },
    });
}

// ── Presenter running jokes (13.4's own "RUNNING_JOKE" memory type, unused
// until now) — see running-jokes-math.ts's own header for the full design.
// subjectKey is an explicit "presenters" sentinel, deliberately NEVER a real
// NULL: broadcast.ts's own schema comment on idx_broadcast_memory_type_key_
// subject already flags that Postgres treats NULLs as distinct for
// uniqueness, so a genuinely NULL subjectKey here would never hit
// onConflictDoUpdate's target index — every Edition would silently INSERT a
// fresh duplicate row instead of updating the one real cooldown row, and
// cooldowns would never actually accumulate. A fixed non-null sentinel
// string sidesteps that trap entirely.
const PRESENTER_MEMORY_SUBJECT = "presenters";

/** Maps each RUNNING_JOKE's own id to editions-since-last-use. A joke with no row yet is simply absent — pickEligibleRunningJoke treats "absent" as "never used, always eligible". */
async function loadRunningJokeCooldowns(currentEditionId: number): Promise<Map<string, number>> {
  const rows = await db
    .select({ memoryKey: broadcastMemoryTable.memoryKey, lastEditionId: broadcastMemoryTable.lastEditionId })
    .from(broadcastMemoryTable)
    .where(and(
      eq(broadcastMemoryTable.memoryType, "RUNNING_JOKE"),
      eq(broadcastMemoryTable.subjectKey, PRESENTER_MEMORY_SUBJECT),
    ));
  const result = new Map<string, number>();
  for (const row of rows) {
    if (row.lastEditionId !== null) result.set(row.memoryKey, Math.max(0, currentEditionId - row.lastEditionId));
  }
  return result;
}

async function recordRunningJokeUsage(jokeId: string, editionId: number): Promise<void> {
  await db
    .insert(broadcastMemoryTable)
    .values({ memoryType: "RUNNING_JOKE", memoryKey: jokeId, subjectKey: PRESENTER_MEMORY_SUBJECT, lastUsedAt: new Date(), lastEditionId: editionId, usageCount: 1, payload: null })
    .onConflictDoUpdate({
      target: [broadcastMemoryTable.memoryType, broadcastMemoryTable.memoryKey, broadcastMemoryTable.subjectKey],
      set: { lastUsedAt: new Date(), lastEditionId: editionId, usageCount: sql`${broadcastMemoryTable.usageCount} + 1` },
    });
}

/** The two-line exchange for one already-chosen running joke — a fresh, separately-seeded pick among that joke's own variants (never the same seed the eligibility/fire roll used) so which joke fires and which of its lines gets read are independent decisions, exactly like buildClosingSegment's own A-line/tease/B-line each drawing their own seed. */
function buildRunningJokeSegment(joke: RunningJoke, slotKey: string, config: BroadcastConfig): ProgrammeSegment {
  const variant = pickFrom(joke.variants, commentaryRng(slotKey, `utility:running_joke:variant:${joke.id}`, config.commentaryVersion));
  return {
    slot: 0, purpose: "presenter_bit", importance: "utility",
    storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
    dialogue: [
      { speaker: "A", text: variant.a, holdSeconds: dialogueHoldSeconds(variant.a) },
      { speaker: "B", text: variant.b, holdSeconds: dialogueHoldSeconds(variant.b) },
    ],
    validityRules: [],
    facts: null,
  };
}

async function buildBanterContext(
  subjectKey: string, editionId: number, negativeJokesThisEdition: ReadonlyMap<string, number>, currentGlobalFullSegmentCounter: number,
): Promise<BanterContext> {
  const state = await getPlayerNegativeState(subjectKey);
  return {
    negativeJokesAlreadyThisEditionForSubject: negativeJokesThisEdition.get(subjectKey) ?? 0,
    fullSegmentsSinceLastNegativeJokeForSubject: state ? Math.max(0, currentGlobalFullSegmentCounter - state.fullSegmentCounterAtUse) : null,
    editionsSinceLastNegativeJokeForSubject: state ? Math.max(0, editionId - state.lastEditionId) : null,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Per-story usage bookkeeping (broadcast_stories.fullCount/headlineCount)
// ═══════════════════════════════════════════════════════════════════════

async function updateStoryUsageBookkeeping(storyId: number, editionId: number, kind: "full" | "headline"): Promise<void> {
  if (kind === "full") {
    await db.update(broadcastStoriesTable)
      .set({
        fullCount: sql`CASE WHEN ${broadcastStoriesTable.lastFullEditionId} = ${editionId} THEN ${broadcastStoriesTable.fullCount} ELSE ${broadcastStoriesTable.fullCount} + 1 END`,
        lastFullEditionId: editionId,
      })
      .where(eq(broadcastStoriesTable.id, storyId));
  } else {
    await db.update(broadcastStoriesTable)
      .set({
        headlineCount: sql`CASE WHEN ${broadcastStoriesTable.lastHeadlineEditionId} = ${editionId} THEN ${broadcastStoriesTable.headlineCount} ELSE ${broadcastStoriesTable.headlineCount} + 1 END`,
        lastHeadlineEditionId: editionId,
      })
      .where(eq(broadcastStoriesTable.id, storyId));
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Segment assembly — one running-order entry -> one ProgrammeSegment
// ═══════════════════════════════════════════════════════════════════════

type SegmentBuildContext = {
  editionId: number;
  slotKey: string;
  commentaryVersion: number;
  banterLevel: number;
  programmeMode: ProgrammeMode;
  editorialCutoff: Date;
  phraseIdsUsedThisBuild: Set<string>;
  /** subjectKey -> negative-targeted jokes already used for it THIS Edition build — resets fresh on every call to buildEdition(), unlike the broadcast_memory-backed cross-Edition counters below. */
  negativeJokesThisEdition: Map<string, number>;
  globalFullSegmentCounter: { value: number };
};

/**
 * Renders one real story's segment (director.ts guarantees `entry.group` is
 * non-null here, so `entry.treatment` is always a genuine Treatment, never
 * "utility" — only a null-group entry ever carries "utility"). Falls back to
 * Supporting/QUICK_HIT once if the entry's own treatment couldn't produce
 * anything — 17's own "Commentary assembly fails for story -> Replace with
 * deterministic fact-only graphic/quick-hit": QUICK_HIT (Supporting's own,
 * only, blueprint) IS exactly that deterministic fact+reaction minimum, so
 * this fallback satisfies that requirement directly rather than needing a
 * second, hand-rolled "plain fact string" renderer that would duplicate what
 * QUICK_HIT already is. Returns null only if even that fails (e.g. this
 * exact story already exhausted its own QUICK_HIT pool earlier in this same
 * Edition) — 11.6's own stale-segment-invalidation philosophy: drop rather
 * than publish broken or empty content.
 */
async function buildSegmentForEntry(entry: RunningOrderEntry, ctx: SegmentBuildContext): Promise<ProgrammeSegment | null> {
  if (!entry.group) return null;

  const story = entry.group.primary;
  const subjectKey = story.subjectKeys[0];
  const isHeadlineTease = entry.purpose === "headlines";

  async function attempt(treatment: Treatment): Promise<DialogueTurn[]> {
    const banterContext = await buildBanterContext(subjectKey, ctx.editionId, ctx.negativeJokesThisEdition, ctx.globalFullSegmentCounter.value);
    return renderConversation({
      storyKey: story.storyKey,
      storyType: story.storyType as StoryType,
      leagueType: story.leagueType,
      facts: story.facts,
      primarySubjectKey: subjectKey,
      treatment,
      slotKey: ctx.slotKey,
      commentaryVersion: ctx.commentaryVersion,
      editionId: ctx.editionId,
      banterContext,
      banterLevel: ctx.banterLevel,
      programmeMode: ctx.programmeMode,
      editorialCutoff: ctx.editorialCutoff,
      phraseIdsUsedThisBuild: ctx.phraseIdsUsedThisBuild,
      isHeadlineTease,
      preferredBlueprint: !isHeadlineTease
        && (H2H_STORY_TYPES as readonly string[]).includes(story.storyType)
        && treatment === "major"
        ? "DISAGREEMENT"
        : undefined,
    });
  }

  let dialogue = await attempt(entry.treatment as Treatment);
  if (dialogue.length === 0 && entry.treatment !== "supporting") {
    dialogue = await attempt("supporting");
  }
  if (dialogue.length === 0 && story.anchorMatchId !== null) {
    const baseline = [story, ...entry.group.supporting].find(candidate =>
      candidate.storyType === "MATCH_RESULT" || candidate.storyType === "PAIR_RESULT"
    );
    if (baseline) {
      const facts = await buildTemplateFacts(baseline.leagueType, baseline.facts);
      const winnerName = String(facts.winnerName ?? facts.winnerTeamName ?? "The winner");
      const loserName = String(facts.loserName ?? facts.loserTeamName ?? "their opponent");
      dialogue = buildFixedDialogue({
        a: `${winnerName} beats ${loserName} in the confirmed result.`,
        b: "That one is in the books, and we will show what it did to the table.",
      }).map((turn, index) => ({
        ...turn,
        sentiment: "neutral" as const,
        phraseId: `fallback-result-${story.leagueType}-${story.anchorMatchId}-${index}`,
        intent: index === 0 ? "quick_fact" : "quick_reaction",
        beat: index === 0 ? "setup" as const : "reaction" as const,
      }));
    }
  }
  if (dialogue.length === 0) return null;

  // See buildGraphicFacts's own header: graphic.data needs every id-shaped
  // fact resolved to a display name, not just the ones a dialogue template
  // happened to reference — computed only now that a segment is definitely
  // being produced, since a dropped (dialogue.length === 0) entry never
  // needs a graphic at all.
  const graphicFacts = await buildGraphicFacts(story.leagueType, story.facts);

  const hasNegativeTurn = dialogue.some(d => d.sentiment === "negative");
  if (isHeadlineTease) {
    await updateStoryUsageBookkeeping(story.id, ctx.editionId, "headline");
  } else {
    await updateStoryUsageBookkeeping(story.id, ctx.editionId, "full");
    ctx.globalFullSegmentCounter.value += 1;
    if (hasNegativeTurn) {
      ctx.negativeJokesThisEdition.set(subjectKey, (ctx.negativeJokesThisEdition.get(subjectKey) ?? 0) + 1);
      await recordPlayerNegativeUse(subjectKey, ctx.editionId, ctx.globalFullSegmentCounter.value);
    }
  }

  return {
    slot: entry.slot,
    purpose: entry.purpose,
    importance: entry.treatment,
    storyId: story.id,
    // 9.6's own merge contract: supporting stories are folded into ONE
    // shared segment (never given their own) but their facts are NOT blended
    // into the primary's own commentary facts — commentary-library.ts keys
    // phrases strictly by the PRIMARY's exact storyType, and no template
    // currently references another type's fact keys, so there is no safe,
    // documented namespacing convention for merging two differently-shaped
    // facts objects without risking a genuine key collision (e.g. both
    // stories independently having their own, differently-valued
    // "playerId"). supportingStoryIds is still persisted here so a future,
    // deliberately-designed cross-story fact scheme could use it — this file
    // just doesn't invent one blindly.
    supportingStoryIds: entry.group.supporting.map(s => s.id),
    storyType: story.storyType,
    leagueType: story.leagueType,
    lifecycleAtBroadcast: story.lifecycle,
    dialogue: dialogue.map(d => ({ speaker: d.speaker, text: d.text, holdSeconds: d.holdSeconds })),
    // 11.6: generated once, here, from the story's own already-known facts —
    // live-events.ts re-evaluates these against current state on every poll.
    validityRules: validityRulesForStory(story),
    // Carried forward for api-shapes.ts's own graphic.data serialization —
    // see ProgrammeSegment's own field comment (director-math.ts) for why
    // this is captured now rather than re-read at API-response time. Already
    // resolved to display-ready values (buildGraphicFacts, above) rather
    // than the story's own raw fact-firewalled ids — see that function's
    // own header for why a graphic needs that and dialogue doesn't.
    facts: graphicFacts,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// C.1 buildEdition
// ═══════════════════════════════════════════════════════════════════════

/**
 * Steps 5-7 of 16.3, plus C.1's own body, given an already-claimed BUILDING
 * row. Returns the fresh PUBLISHED row, the previous PUBLISHED row (on a
 * below-threshold skip, or a quality-gate failure — 17's own "keep previous
 * published Edition" rule), or null only when there is truly no previous
 * Edition AND this attempt still couldn't clear the quality gate (the
 * doc's own "No previous Edition exists ... if impossible, show live
 * standings/results fallback" row — a future routes/broadcast.ts's job to
 * render, not this file's).
 */
async function buildEdition(params: {
  claimedRow: BroadcastEdition;
  previous: BroadcastEdition | null;
  now: Date;
  config: BroadcastConfig;
  /** Stable Director/commentary seed. Copy-on-write rebuild attempts have a
   * unique database slotKey but intentionally retain the logical slot's seed. */
  seedSlotKey?: string;
  /** True only from forceRebuildCurrentEdition() (the admin regenerate endpoint, task 134) — threads straight into isForcedRefresh's own `adminForced` input, bypassing the change-score threshold exactly the way 14.2's "Force build current/manual Edition for testing" describes. Defaults false for the ordinary lazy-check path (ensureCurrentBroadcastEdition), which has no such admin request to honour. */
  adminForced?: boolean;
  /** Producer-only recovery: cover active-season matches that have never
   * appeared in a published programme before returning to normal selection. */
  seasonCatchUp?: boolean;
  /** Producer-only clean sweep: rebuild every active-season match from this
   * instant without treating any previous Edition as coverage. */
  seasonSweepStart?: Date;
}): Promise<BroadcastEdition | null> {
  const {
    claimedRow, previous, now: cutoffEnd, config, seedSlotKey = claimedRow.slotKey,
    adminForced = false, seasonCatchUp = false, seasonSweepStart,
  } = params;

  // Appendix C.1: "cutoffStart = previous?.dataCutoff ?? beginningOfRelevantHistory".
  // Omitting cutoffStart entirely for a genuinely first-ever build lets
  // story-engine.ts's own resolveCutoffStart() apply ITS default (new Date(0)
  // when broadcast_stories is empty) — exactly "beginningOfRelevantHistory".
  const storyState = seasonSweepStart
    ? await detectAndUpdateStories({ cutoffStart: seasonSweepStart, cutoffEnd })
    : previous
    ? await detectAndUpdateStories({ cutoffStart: previous.dataCutoff, cutoffEnd })
    : await detectAndUpdateStories({ cutoffEnd });

  const [interviewSegments, fanVerdictSegments] = await Promise.all([
    collectInterviewSegments(storyState.cutoffStart, cutoffEnd, 1),
    collectFanVerdictSegments(storyState.cutoffStart, cutoffEnd),
  ]);
  const audienceSegments = [...interviewSegments, ...fanVerdictSegments];

  const catchUpPool = seasonSweepStart
    ? await collectActiveSeasonSweepStories(seasonSweepStart, cutoffEnd)
    : seasonCatchUp
      ? await collectUnairedActiveSeasonCatchUpStories(cutoffEnd)
      : [];
  const isSeasonCatchUp = catchUpPool.length > 0;
  let pool = isSeasonCatchUp ? catchUpPool : await collectNewAndActiveStories(cutoffEnd);
  if (isSeasonCatchUp) {
    const spotlightCandidates = (await collectNewAndActiveStories(cutoffEnd))
      .filter(story => story.storyType === "FEATURE_SPOTLIGHT")
      .sort((a, b) => a.fullCount - b.fullCount || (a.lastFullEditionId ?? 0) - (b.lastFullEditionId ?? 0) || a.id - b.id);
    const requiredSpotlight = spotlightCandidates[0];
    if (requiredSpotlight && !pool.some(story => story.id === requiredSpotlight.id)) {
      pool = [...pool, requiredSpotlight];
    }
  }
  const mergedForChangeScore = mergeStoriesByAnchorAndNarrative(pool);
  const newMatchCount = storyState.newMatchesProcessed.singles + storyState.newMatchesProcessed.doubles + storyState.newMatchesProcessed.shiftWars + storyState.newMatchesProcessed.teamMatch;
  const changeScore = editionChangeScore({
    newCompletedMatchCount: newMatchCount,
    newlyCreatedGroupTreatments: newlyCreatedGroupTreatments(mergedForChangeScore),
  });

  // A real, repeated user report ("I entered new matches, regenerated, and
  // nothing changed") turned out to be genuinely unanswerable from the data
  // this table used to keep: `diagnostic` was only ever written on SKIPPED
  // (a fixed "below threshold" string) or FAILED (the quality-gate reasons),
  // and explicitly nulled out on PUBLISHED — so a published Edition with an
  // unexpectedly low changeScore left no trace of what window it actually
  // scanned or how many matches it actually found there. Reconstructing one
  // real incident from timestamps alone (this file's own git history has the
  // full trail) took far longer than it should have and still ended in
  // "plausible, not certain." This scanSummary is recorded on EVERY outcome
  // — published, skipped, or failed — precisely so the next report like that
  // is a five-second read instead of an hour of archaeology.
  // storyState.cutoffStart (not previous?.dataCutoff) is the actual window
  // boundary detectAndUpdateStories used — the two only diverge when
  // `previous` is null, in which case story-engine.ts's own
  // resolveCutoffStart() picked the real starting point instead, and THAT is
  // the value worth seeing if a match ever again goes missing at the seam
  // between "no previous Edition yet" and "first one published."
  const scanSummary = `scanned (${storyState.cutoffStart.toISOString()}, ${storyState.cutoffEnd.toISOString()}]: singles=${storyState.newMatchesProcessed.singles} doubles=${storyState.newMatchesProcessed.doubles} shiftWars=${storyState.newMatchesProcessed.shiftWars} teamMatch=${storyState.newMatchesProcessed.teamMatch}, storiesUpserted=${storyState.storiesUpserted}, interviews=${interviewSegments.length}, fanVerdicts=${fanVerdictSegments.length}, previousEditionId=${previous?.id ?? "none"}, catchUp(singles)=${JSON.stringify(storyState.catchUpSeasonIds.singles)} catchUp(doubles)=${JSON.stringify(storyState.catchUpSeasonIds.doubles)}`;

  const seasonBoundaryEventOccurred = await anySeasonEndedInWindow(previous?.dataCutoff ?? new Date(0), cutoffEnd);

  // Season Review: which closed leagues STILL OWE a review, per seasons.
  // broadcastReviewedAt (a durable state check, not an incremental window —
  // see resolveClosedLeagueSeasons's own header for exactly why this has to
  // be resolved BEFORE the change-score skip-check below, not gated behind
  // seasonBoundaryEventOccurred the way the first version of this feature
  // had it: a season that closed hours or days ago and still hasn't been
  // reviewed must keep being offered on every later build/regenerate, not
  // only the one build whose own tiny window happened to contain the close
  // instant. A real user's report ("way way too short", champion "brought
  // up multiple times") traced straight back to that original window-gated
  // version silently reverting to an ordinary Edition on a second
  // regenerate. See director-season-review.ts's own header for the rest of
  // the reasoning behind building a dedicated special at all.
  const closedLeagueSeasons = await resolveClosedLeagueSeasons(cutoffEnd);

  const forced = isForcedRefresh({
    seasonChampionOrResetEventOccurred: seasonBoundaryEventOccurred || closedLeagueSeasons.length > 0 || audienceSegments.length > 0,
    noPublishedEditionExists: previous === null,
    adminForced,
  });

  if (!forced && changeScore < config.changeThreshold) {
    const [skipped] = await db
      .update(broadcastEditionsTable)
      .set({ status: "SKIPPED", dataCutoff: cutoffEnd, changeScore, diagnostic: `change score ${changeScore} below threshold ${config.changeThreshold} | ${scanSummary}` })
      .where(eq(broadcastEditionsTable.id, claimedRow.id))
      .returning();
    // 16.3 step 6: "return previous" — the previously PUBLISHED Edition is
    // still what viewers should see. previous is only null here if
    // noPublishedEditionExists also forced this build past the skip branch
    // above, so this fallback to the SKIPPED row itself is unreachable in
    // practice; kept only so the function stays well-typed rather than
    // asserting.
    return previous ?? skipped ?? null;
  }

  const previousProgramme = previous && isEditionProgramme(previous.programme) ? previous.programme : null;
  const recentProgrammeRows = await db
    .select({ programme: broadcastEditionsTable.programme })
    .from(broadcastEditionsTable)
    .where(eq(broadcastEditionsTable.status, "PUBLISHED"))
    .orderBy(desc(broadcastEditionsTable.publishedAt), desc(broadcastEditionsTable.id))
    .limit(3);
  const recentProgrammes = recentProgrammeRows
    .map(row => row.programme)
    .filter(isEditionProgramme);

  let runningOrder: RunningOrderEntry[];
  let programmeMode: ProgrammeMode;
  if (closedLeagueSeasons.length > 0) {
    programmeMode = "SEASON_REVIEW";
    const highlightsByLeague = new Map<LeagueType, BroadcastStory[]>();
    for (const closed of closedLeagueSeasons) {
      const highlights = await collectSeasonHighlights({
        leagueType: closed.leagueType, seasonId: closed.seasonId,
        seasonStart: closed.seasonStart, seasonEndExclusive: closed.seasonEndExclusive,
        cutoffEnd,
        // Raised alongside director-season-review.ts's own MAX_HIGHLIGHTS_PER_LEAGUE (4 -> 6) — fetch enough real candidates that the per-subject diversity cap (story-engine.ts's collectSeasonHighlights) has real headroom to still hand back 6 after trimming, rather than starving that slice back down to fewer than the league actually has.
        limit: 12,
      });
      highlightsByLeague.set(closed.leagueType, highlights);
    }
    runningOrder = selectSeasonReviewRunningOrder({ closedSeasons: closedLeagueSeasons, pool, highlightsByLeague });
  } else {
    programmeMode = selectProgrammeMode(pool, cutoffEnd);
    runningOrder = directorSelect({
      pool,
      previousProgramme,
      recentProgrammes,
      slotKey: seedSlotKey,
      mode: programmeMode,
      pacing: config.programmeProfiles[programmeMode],
    }).runningOrder;
    if (isSeasonCatchUp) {
      const allMatchGroups = mergeStoriesByAnchorAndNarrative(pool)
        .filter(group => group.primary.anchorMatchId !== null)
        .sort((a, b) => {
          const aTime = Date.parse(String(a.primary.facts.playedAt ?? a.primary.detectedAt));
          const bTime = Date.parse(String(b.primary.facts.playedAt ?? b.primary.detectedAt));
          return aTime - bTime || a.primary.id - b.primary.id;
        });
      const opening = runningOrder.find(entry => entry.purpose === "opening") ?? {
        slot: 1, purpose: "opening" as const, group: null, treatment: "supporting" as const, carryForwardState: null,
      };
      const closing = runningOrder.find(entry => entry.purpose === "closing") ?? {
        slot: 11, purpose: "closing" as const, group: null, treatment: "supporting" as const, carryForwardState: null,
      };
      const matchEntries: RunningOrderEntry[] = allMatchGroups.map(group => ({
          slot: 6,
          purpose: "supporting_story_or_checkin",
          group,
          treatment: treatmentForScore(group.primary.score),
          carryForwardState: null,
      }));
      const familyForStory = (storyType: StoryType): StoryFamily | null => {
        if ((H2H_STORY_TYPES as readonly string[]).includes(storyType)) return "H2H";
        if ((FORM_STORY_TYPES as readonly string[]).includes(storyType)) return "FORM";
        if ((LEAGUE_STORY_TYPES as readonly string[]).includes(storyType)) return "LEAGUE";
        if ((PERFORMANCE_STORY_TYPES as readonly string[]).includes(storyType)) return "PERFORMANCE";
        if ((DOUBLES_STORY_TYPES as readonly string[]).includes(storyType)) return "DOUBLES";
        if ((SHIFT_WARS_STORY_TYPES as readonly string[]).includes(storyType)) return "SHIFT_WARS";
        if ((ARCHIVE_STORY_TYPES as readonly string[]).includes(storyType)) return "ARCHIVE";
        return null;
      };
      const aggregateGroups = mergeStoriesByAnchorAndNarrative(pool)
        .filter(group =>
          group.primary.anchorMatchId === null
          && group.primary.storyType !== "FEATURE_SPOTLIGHT"
        );
      const selectedAggregateGroups = new Set<number>();
      const aggregateEntries: RunningOrderEntry[] = [];
      const usedSubjectKeys = new Set<string>();
      const addAggregate = (family: StoryFamily, limit: number, treatment: Treatment = "supporting") => {
        const candidates = aggregateGroups
          .filter(group =>
            !selectedAggregateGroups.has(group.primary.id)
            && familyForStory(group.primary.storyType as StoryType) === family
            && group.primary.subjectKeys.every(subject => !usedSubjectKeys.has(subject))
          )
          .sort((a, b) => b.primary.score - a.primary.score || a.primary.id - b.primary.id)
          .slice(0, limit);
        for (const group of candidates) {
          selectedAggregateGroups.add(group.primary.id);
          for (const subject of group.primary.subjectKeys) usedSubjectKeys.add(subject);
          aggregateEntries.push({
            slot: family === "LEAGUE" || family === "H2H" ? 5 : 7,
            purpose: family === "LEAGUE" || family === "H2H"
              ? "analysis_or_predictor"
              : "form_h2h_or_spotlight",
            group,
            // The primary H2H/form item is the host prediction desk: use the
            // full evidence/counter-opinion treatment so Chalky and Ton make
            // and challenge a pick rather than merely reciting the numbers.
            treatment,
            carryForwardState: null,
          });
        }
      };
      addAggregate("LEAGUE", 2);
      addAggregate("FORM", 2, "major");
      addAggregate("H2H", 1, "major");
      addAggregate("PERFORMANCE", 1, "major");
      addAggregate("DOUBLES", 1);
      addAggregate("SHIFT_WARS", 1);
      addAggregate("ARCHIVE", 1);
      const spotlightGroup = mergeStoriesByAnchorAndNarrative(pool)
        .find(group => group.primary.storyType === "FEATURE_SPOTLIGHT");
      const spotlightEntry: RunningOrderEntry[] = spotlightGroup ? [{
        slot: 9,
        purpose: "form_h2h_or_spotlight",
        group: spotlightGroup,
        treatment: "supporting",
        carryForwardState: null,
      }] : [];
      // Catch-up Editions are intentionally structured like a sports results
      // programme: sign-on, every result, analysis, one rotating mode prompt,
      // then the sign-off. Headline teases are omitted here so the same result
      // is not immediately spoken twice.
      runningOrder = [opening, ...matchEntries, ...aggregateEntries, ...spotlightEntry, closing];
    }
  }

  const negativeJokesThisEdition = new Map<string, number>();
  const globalFullSegmentCounter = { value: await getGlobalFullSegmentCounter() };
  const segCtx: SegmentBuildContext = {
    editionId: claimedRow.id, slotKey: seedSlotKey, commentaryVersion: config.commentaryVersion,
    banterLevel: config.banterLevel, programmeMode, editorialCutoff: cutoffEnd,
    phraseIdsUsedThisBuild: new Set<string>(), negativeJokesThisEdition, globalFullSegmentCounter,
  };

  const segments: ProgrammeSegment[] = [];
  const attemptedStoryIds = new Set<number>();
  for (const entry of runningOrder) {
    // 11.1's required "closing" sign-off (always present, slot 11) — handled
    // before the `!entry.group` branch below because, unlike every other
    // slot, "closing" can now carry a group (director.ts's own "what's
    // coming up" attachment) WITHOUT that meaning "render this as a full
    // segment about that story" — see buildClosingSegment's own header.
    if (entry.purpose === "closing") {
      segments.push(await buildClosingSegment(entry, seedSlotKey, config));
      continue;
    }
    if (!entry.group) {
      // Slot 1's fixed opening sign-on (director.ts never gives it a group,
      // by design — see its own header) and slot 10's documented no-LEAGUE-
      // story fallback both land here: no story behind either one, so fixed
      // hand-written dialogue rather than anything templated. "opening" gets
      // its own line pool; everything else (only "what_to_watch" in
      // practice) keeps the original fallback pool.
      const fallbackOptions = entry.purpose === "opening" ? OPENING_DIALOGUE_OPTIONS[programmeMode] : WHAT_TO_WATCH_FALLBACK_OPTIONS;
      const rng = commentaryRng(seedSlotKey, `utility:${entry.purpose}`, config.commentaryVersion);
      segments.push({
        slot: entry.slot, purpose: entry.purpose, importance: "utility",
        storyId: null, supportingStoryIds: [], storyType: null, leagueType: null, lifecycleAtBroadcast: null,
        dialogue: buildFixedDialogue(pickFrom(fallbackOptions, rng)),
        // No story behind a fixed fallback line — nothing about it can go stale, so genuinely no rules apply, not a placeholder.
        validityRules: [],
        facts: null,
      });
      continue;
    }
    attemptedStoryIds.add(entry.group.primary.id);
    const segment = await buildSegmentForEntry(entry, segCtx);
    if (segment) segments.push(segment);
  }

  // Season Finale ceremony content (gamerscore leaderboard, Hall of Fame
  // nods) — see buildSeasonFinaleSpecialSegments's own header. Spliced in
  // before "what's next"/closing (whichever comes first — selectSeasonReview
  // RunningOrder always places both, in that order, last) so the show still
  // signs off looking forward, not immediately after a stats board; never
  // built for an ordinary Edition, exactly like editorialSegments below.
  if (closedLeagueSeasons.length > 0) {
    const finaleSegments = await buildSeasonFinaleSpecialSegments();
    if (finaleSegments.length > 0) {
      const insertAt = segments.findIndex(segment => segment.purpose === "what_to_watch" || segment.purpose === "closing");
      segments.splice(insertAt >= 0 ? insertAt : segments.length, 0, ...finaleSegments);
    }
  }

  // Commentary eligibility is deliberately stricter than story eligibility:
  // a Director pick can have valid facts yet exhaust every suitable phrase.
  // Do not let those silent render drops turn a busy match day into a one-story
  // programme. Re-run the Director against unattempted candidates and use its
  // body picks as deterministic reserves until the quality gate has four real
  // segments, reaches the mode's minimum runtime, or exhausts the configured
  // story-segment budget / genuinely usable pool.
  const meaningfulCount = () => segments.filter(s =>
    s.storyId !== null && s.purpose !== "headlines" && s.purpose !== "opening" && s.purpose !== "closing"
  ).length;
  const bodyStoryCount = () => segments.filter(s =>
    s.storyId !== null && s.purpose !== "headlines" && s.purpose !== "closing"
  ).length;
  const ordinaryProgrammeMode = programmeMode === "SEASON_REVIEW" ? "MAGAZINE" : programmeMode;
  const minimumRuntime = config.programmeProfiles[ordinaryProgrammeMode].estimatedRuntimeSeconds.min;
  const needsReserve = () =>
    meaningfulCount() < 4
    || totalEstimatedSecondsForProgramme({ mode: programmeMode, segments }) < minimumRuntime;
  const storySegmentCap = config.programmeProfiles[ordinaryProgrammeMode].maxStorySegments;
  if (closedLeagueSeasons.length === 0 && needsReserve()) {
    for (let pass = 0; pass < 3 && needsReserve() && bodyStoryCount() < storySegmentCap; pass++) {
      const reservePool = pool.filter(story => !attemptedStoryIds.has(story.id));
      if (reservePool.length === 0) break;
      const reserveOrder = directorSelect({
        pool: reservePool,
        previousProgramme,
        recentProgrammes,
        slotKey: `${seedSlotKey}:reserve:${pass}`,
        mode: ordinaryProgrammeMode,
        pacing: config.programmeProfiles[ordinaryProgrammeMode],
      }).runningOrder;
      const reserveEntries = reserveOrder.filter(entry =>
        entry.group !== null
        && entry.purpose !== "headlines"
        && entry.purpose !== "opening"
        && entry.purpose !== "closing"
      );
      if (reserveEntries.length === 0) break;
      for (const entry of reserveEntries) {
        if (!entry.group || attemptedStoryIds.has(entry.group.primary.id)) continue;
        attemptedStoryIds.add(entry.group.primary.id);
        const segment = await buildSegmentForEntry(entry, segCtx);
        if (segment) {
          segments.push(segment);
          runningOrder.push(entry);
        }
        if (!needsReserve() || bodyStoryCount() >= storySegmentCap) break;
      }
    }
  }

  if (isSeasonCatchUp) {
    const leaderboards = await buildCatchUpLeaderboardSegments(pool);
    const opening = segments.filter(segment => segment.purpose === "opening");
    const matchSegments = segments.filter(segment => {
      if (segment.storyId === null) return false;
      const story = pool.find(candidate => candidate.id === segment.storyId);
      return story?.anchorMatchId !== null && story?.anchorMatchId !== undefined;
    });
    const aggregateSegments = segments.filter(segment =>
      segment.purpose !== "opening"
      && segment.purpose !== "headlines"
      && segment.purpose !== "closing"
      && !matchSegments.includes(segment)
    );
    const closing = segments.filter(segment => segment.purpose === "closing");
    segments.splice(0, segments.length, ...opening, ...matchSegments, ...leaderboards, ...aggregateSegments, ...closing);
  }

  // Recurring editorial desk features are snapshot-derived utility segments,
  // not new story rows. Keep ordinary programmes focused with one rotating
  // feature; catch-up/clean-sweep programmes may carry a broader set.
  // Persisted result stories remain the sole result narrative for a match:
  // represented match ids are excluded from Points Swing, while the other
  // features describe aggregates/current state rather than replaying winners.
  let editorialSegments: ProgrammeSegment[] = [];
  if (closedLeagueSeasons.length === 0) {
    const [editorialPlayers, editorialMatches, editorialStories, powerRankingResult] = await Promise.all([
      db.select({
        id: playersTable.id, name: playersTable.name, elo: playersTable.elo, points: playersTable.points,
        wins: playersTable.seasonWins, losses: playersTable.seasonLosses, status: playersTable.status,
        eliminationsCount: playersTable.eliminationsCount,
        currentWinStreak: playersTable.currentWinStreak, longestWinStreak: playersTable.longestWinStreak,
      }).from(playersTable).where(eq(playersTable.isActive, true)),
      db.select({
        id: matchesTable.id, winnerId: matchesTable.winnerId, loserId: matchesTable.loserId,
        winnerName: matchesTable.winnerName, loserName: matchesTable.loserName,
        stake: matchesTable.stake, playedAt: matchesTable.playedAt,
      }).from(matchesTable).where(and(
        sql`${matchesTable.playedAt} <= ${cutoffEnd}`,
        sql`${matchesTable.seasonId} IN (SELECT id FROM seasons WHERE league_type = 'singles' AND is_active = true)`,
      )),
      db.select({
        id: broadcastStoriesTable.id, storyType: broadcastStoriesTable.storyType,
        score: broadcastStoriesTable.score,
        anchorMatchId: broadcastStoriesTable.anchorMatchId, facts: broadcastStoriesTable.facts,
      }).from(broadcastStoriesTable).where(and(
        eq(broadcastStoriesTable.leagueType, "singles"),
        sql`${broadcastStoriesTable.detectedAt} <= ${cutoffEnd}`,
        sql`${broadcastStoriesTable.seasonId} IN (SELECT id FROM seasons WHERE league_type = 'singles' AND is_active = true)`,
      )),
      db.execute(sql`
        SELECT 'singles'::text AS league_type, m.id, m.winner_id, m.winner_name, m.loser_id, m.loser_name,
               m.stake, m.played_at, m.was_upset_win
        FROM matches m JOIN seasons s ON s.id = m.season_id AND s.is_active = true
        WHERE m.played_at <= ${cutoffEnd}
        UNION ALL
        SELECT 'doubles'::text, m.id, m.winner_team_id, wt.team_name, m.loser_team_id, lt.team_name,
               m.stake, m.played_at, false
        FROM doubles_matches m
        JOIN doubles_teams wt ON wt.id = m.winner_team_id JOIN doubles_teams lt ON lt.id = m.loser_team_id
        JOIN seasons s ON s.id = m.season_id AND s.is_active = true
        WHERE m.played_at <= ${cutoffEnd}
        UNION ALL
        SELECT 'shift_wars'::text, m.id, m.winner_team_id, wt.name, m.loser_team_id, lt.name,
               m.stake, m.played_at, false
        FROM shift_wars_matches m
        JOIN shift_wars_teams wt ON wt.id = m.winner_team_id JOIN shift_wars_teams lt ON lt.id = m.loser_team_id
        JOIN seasons s ON s.id = m.season_id AND s.is_active = true
        WHERE m.played_at <= ${cutoffEnd}
      `),
    ]);
    const powerRankingMatches = (powerRankingResult.rows as unknown as Array<{
      league_type: LeagueType; id: number; winner_id: number; winner_name: string; loser_id: number;
      loser_name: string; stake: number; played_at: Date | string; was_upset_win: boolean;
    }>).map((row): PowerRankingMatch => ({
      leagueType: row.league_type, id: Number(row.id), winnerId: Number(row.winner_id), winnerName: row.winner_name,
      loserId: Number(row.loser_id), loserName: row.loser_name, stake: Number(row.stake ?? 0),
      playedAt: new Date(row.played_at).toISOString(), wasUpsetWin: !!row.was_upset_win,
    }));
    const representedMatchIds = new Set<number>();
    for (const segment of segments) {
      if (segment.storyId === null) continue;
      const source = pool.find(story => story.id === segment.storyId);
      if (source?.anchorMatchId !== null && source?.anchorMatchId !== undefined) {
        representedMatchIds.add(source.anchorMatchId);
      }
    }
    editorialSegments = buildEditorialFeatures({
      players: editorialPlayers,
      matches: editorialMatches,
      stories: editorialStories,
      cutoff: cutoffEnd,
      rotationKey: seedSlotKey,
      broad: isSeasonCatchUp,
      maxFeatures: programmeMode === "MAGAZINE" ? 2 : 1,
      recentlyAiredFeatureTitles: new Set(recentProgrammes.flatMap(programme =>
        programme.segments.flatMap(segment =>
          typeof segment.facts?.featureTitle === "string" ? [segment.facts.featureTitle] : [],
        ),
      )),
      representedMatchIds,
      powerRankingMatches,
    });
  }
  const studioSegments = audienceSegments.length > 0
    ? editorialSegments.flatMap((segment, index) => [segment, ...(audienceSegments[index] ? [audienceSegments[index]] : [])])
      .concat(audienceSegments.slice(editorialSegments.length))
    : editorialSegments;
  segments.splice(0, segments.length, ...weaveStudioSegments(segments, studioSegments));

  // Presenter running jokes: a small, recurring bit between Chalky and Ton
  // themselves, never about any one story — see running-jokes-math.ts's own
  // header. Spliced right after the fixed opening/headlines block (a quick
  // "before we get into it" moment between the two hosts), computed before
  // the cold open below so this scan of "where does opening/headlines end"
  // is never confused by a cold-open segment that hasn't been unshifted in
  // yet. Never built for a Season Review (its own ceremony tone has no room
  // for this kind of chat) or a Weekly Highlights reel (its own separate
  // function, createWeeklyHighlightsEpisode, never reaches this code path).
  if (programmeMode !== "SEASON_REVIEW") {
    const runningJokeCooldowns = await loadRunningJokeCooldowns(claimedRow.id);
    const runningJokeGateRng = commentaryRng(seedSlotKey, "utility:running_joke:gate", config.commentaryVersion);
    const runningJoke = pickEligibleRunningJoke(runningJokeCooldowns, runningJokeGateRng);
    if (runningJoke) {
      const runningJokeSegment = buildRunningJokeSegment(runningJoke, seedSlotKey, config);
      let insertAt = 0;
      while (insertAt < segments.length && (segments[insertAt].purpose === "opening" || segments[insertAt].purpose === "headlines")) insertAt++;
      segments.splice(insertAt, 0, runningJokeSegment);
      await recordRunningJokeUsage(runningJoke.id, claimedRow.id);
    }
  }

  // Guest presenter cameo: see buildGuestCameoSegment's own header. Scanned
  // from the FINAL segment list (after weaving, so the index found below is
  // where the milestone's own real segment actually ends up airing) for the
  // first segment whose story type earns a cameo invitation; spliced
  // immediately after that segment, so the desk literally invites the
  // player up right after celebrating them, rather than at some unrelated
  // point in the show. Only the first qualifying milestone gets a cameo —
  // never for a Season Review (its own distinct ceremony content covers
  // "celebrate a real player" a different way, via buildSeasonFinale
  // SpecialSegments' Hall of Fame nods).
  if (programmeMode !== "SEASON_REVIEW") {
    const cameoIndex = segments.findIndex(seg => seg.storyType !== null && hasGuestCameo(seg.storyType as StoryType));
    const cameoStory = cameoIndex >= 0 ? pool.find(s => s.id === segments[cameoIndex].storyId) ?? null : null;
    if (cameoStory) {
      const cameoSegment = await buildGuestCameoSegment(cameoStory, seedSlotKey, config);
      if (cameoSegment) segments.splice(cameoIndex + 1, 0, cameoSegment);
    }
  }

  // Presenter predictions — making a new call and following up on an old
  // one are independent of each other (a follow-up can fire in an Edition
  // with no WIN_STREAK story at all, and a fresh call doesn't wait on any
  // earlier one resolving first beyond the one-pending-per-subject guard
  // recordPresenterPrediction's own onConflictDoNothing enforces). See
  // presenter-prediction-math.ts's own header for why this is scoped to win
  // streaks and never a specific upcoming match result. Never for a Season
  // Review, same reasoning as every other utility beat in this block.
  if (programmeMode !== "SEASON_REVIEW") {
    const streakIndex = segments.findIndex(seg => seg.storyType === "WIN_STREAK" && seg.leagueType === "singles");
    const streakStory = streakIndex >= 0 ? pool.find(s => s.id === segments[streakIndex].storyId) ?? null : null;
    if (streakStory) {
      const playerId = streakStory.facts.playerId as number;
      const currentWinStreak = streakStory.facts.currentWinStreak as number;
      const predictionSubjectKey = streakStory.subjectKeys[0];
      if (currentWinStreak >= MIN_WIN_STREAK_FOR_PREDICTION) {
        const pending = await loadPendingPresenterPredictions();
        const alreadyPending = pending.some(p => p.subjectKey === predictionSubjectKey);
        if (!alreadyPending) {
          const predictionSegment = await buildPresenterPredictionSegment(playerId, currentWinStreak, seedSlotKey, config);
          if (predictionSegment) {
            segments.splice(streakIndex + 1, 0, predictionSegment);
            await recordPresenterPrediction(predictionSubjectKey, playerId, currentWinStreak, claimedRow.id);
          }
        }
      }
    }

    const resolved = await findResolvedPresenterPrediction(claimedRow.id);
    if (resolved) {
      const gradedSegment = await buildPresenterPredictionGradedSegment(
        resolved.playerId, resolved.streakAtPrediction, resolved.currentWinStreak, resolved.outcome, seedSlotKey, config,
      );
      if (gradedSegment) {
        let insertAt = 0;
        while (insertAt < segments.length && (segments[insertAt].purpose === "opening" || segments[insertAt].purpose === "headlines" || segments[insertAt].purpose === "presenter_bit")) insertAt++;
        segments.splice(insertAt, 0, gradedSegment);
        await clearPresenterPrediction(resolved.subjectKey);
      }
    }
  }

  // Cold open: see buildColdOpenSegment's own header. Scanned from the
  // FINAL segment list (after weaving, so it reflects whatever is actually
  // about to air) for the first already-selected "major" segment whose
  // story type earns BreakingScene's heaviest chrome — "first" rather than
  // "best-scoring" because segments are still in running-order sequence
  // here, and the running order itself already placed the Edition's single
  // best story first (main_story ahead of second_major_story). Never built
  // for a Season Review (its own ceremony framing already opens the show)
  // or a Weekly Highlights reel (built entirely outside this function, in
  // createWeeklyHighlightsEpisode, with no running order of its own to
  // scan). Show Bible v1's own "NO FAKE URGENCY" rule means a genuinely
  // quiet Edition with nothing breaking-worthy simply gets no cold open —
  // this is deliberately never manufactured.
  if (programmeMode !== "SEASON_REVIEW") {
    const coldOpenCandidate = segments.find(seg =>
      seg.importance === "major" && seg.storyType !== null && hasColdOpenTease(seg.storyType as StoryType)
    );
    const coldOpenStory = coldOpenCandidate ? pool.find(s => s.id === coldOpenCandidate.storyId) ?? null : null;
    if (coldOpenStory) {
      const coldOpen = await buildColdOpenSegment(coldOpenStory, seedSlotKey, config);
      if (coldOpen) segments.unshift(coldOpen);
    }
  }

  segments.forEach((segment, index) => { segment.slot = index + 1; });

  const selectedStoriesById = new Map<number, BroadcastStory>();
  for (const entry of runningOrder) {
    if (!entry.group) continue;
    selectedStoriesById.set(entry.group.primary.id, entry.group.primary);
    for (const supporting of entry.group.supporting) {
      selectedStoriesById.set(supporting.id, supporting);
    }
  }
  const cutoffViolations = validateStoryFactCutoffs(
    [...selectedStoriesById.values()],
    cutoffEnd,
  );

  const qualityGateSegments: QualityGateSegment[] = segments.map(seg => ({
    id: programmeSegmentId(seg),
    purpose: seg.purpose,
    leagueType: seg.leagueType,
    importance: seg.importance,
    sentiment: seg.storyId !== null ? (pool.find(s => s.id === seg.storyId)?.sentiment ?? null) : null,
    storyId: seg.storyId,
  }));

  const qualityInput: QualityGateInput = {
    segments: qualityGateSegments,
    // Tied to whether THIS build actually IS a Season Review (closedLeagueSeasons.length > 0), not the coarser seasonBoundaryEventOccurred window — a Season Review built on a regenerate long after the close-instant window has passed still needs this exemption exactly as much as the one built the same minute the season closed.
    isChampionOrSeasonBoundarySpecial: seasonBoundaryEventOccurred || closedLeagueSeasons.length > 0 || isSeasonCatchUp,
    hasFactsOutsideCutoffSnapshot: cutoffViolations.length > 0,
    hasInvalidFutureMatchLanguage: hasFutureMatchLanguage(segments),
    hasUnresolvedPlaceholders: hasUnresolvedPlaceholderText(segments),
    hasDuplicateStoryIds: findDuplicateStoryIds(segments),
    playersWithRepeatedNegativeBanterInCooldown: [], // structurally guaranteed — see this file's own header
  };

  const programme: EditionProgramme = { mode: programmeMode, segments };
  const baseQualityResult = evaluateQualityGate(qualityInput);
  const runtimeSeconds = totalEstimatedSecondsForProgramme(programme);
  const catchUpExpectedMatchKeys = isSeasonCatchUp
    ? new Set(pool
        .filter(story => story.anchorMatchId !== null)
        .map(story => `${story.leagueType}:${story.anchorMatchId}`))
    : new Set<string>();
  const catchUpRenderedMatchKeys = new Set(segments.flatMap(segment => {
    if (segment.storyId === null) return [];
    const story = pool.find(candidate => candidate.id === segment.storyId);
    return story?.anchorMatchId !== null && story?.anchorMatchId !== undefined
      ? [`${story.leagueType}:${story.anchorMatchId}`]
      : [];
  }));
  const missingCatchUpMatches = [...catchUpExpectedMatchKeys].filter(key => !catchUpRenderedMatchKeys.has(key));
  const runtimeReason = programmeMode !== "SEASON_REVIEW" && !isSeasonCatchUp
    && !isRuntimeWithinProgrammeMode(programmeMode, runtimeSeconds, config.programmeProfiles)
    ? `runtime ${runtimeSeconds}s is outside ${programmeMode} target ${config.programmeProfiles[programmeMode].estimatedRuntimeSeconds.min}-${config.programmeProfiles[programmeMode].estimatedRuntimeSeconds.max}s`
    : null;
  const qualityReasons = [
    ...(baseQualityResult.pass ? [] : baseQualityResult.reasons),
    ...(cutoffViolations.length > 0
      ? [`cutoff violations: ${cutoffViolations.map(v => `story ${v.storyId} ${v.reason}${v.timestamp ? ` (${v.timestamp})` : ""}`).join(", ")}`]
      : []),
    ...(missingCatchUpMatches.length > 0
      ? [`season catch-up did not render every unaired match: ${missingCatchUpMatches.join(", ")}`]
      : []),
    ...(runtimeReason ? [runtimeReason] : []),
  ];
  const qualityResult = qualityReasons.length === 0
    ? { pass: true as const }
    : { pass: false as const, reasons: qualityReasons };

  if (qualityResult.pass) {
    const [published] = await db
      .update(broadcastEditionsTable)
      .set({ status: "PUBLISHED", dataCutoff: cutoffEnd, changeScore, programmeVersion: config.programmeVersion, programme, diagnostic: scanSummary, publishedAt: cutoffEnd })
      .where(eq(broadcastEditionsTable.id, claimedRow.id))
      .returning();
    // Only NOW, once the Season Review has actually cleared the quality gate
    // and published, does its season stop being offered again — see
    // resolveClosedLeagueSeasons's own header. A failed/skipped attempt
    // below deliberately leaves broadcastReviewedAt untouched so the next
    // build keeps retrying it as a Season Review.
    if (closedLeagueSeasons.length > 0) {
      await markSeasonsReviewed(closedLeagueSeasons.map(c => c.seasonId), cutoffEnd);
    }
    return published ?? null;
  }

  await db
    .update(broadcastEditionsTable)
    .set({ status: "FAILED", dataCutoff: cutoffEnd, changeScore, diagnostic: `${qualityResult.reasons.join("; ")} | ${scanSummary}` })
    .where(eq(broadcastEditionsTable.id, claimedRow.id));

  // 17's own table: "New Edition fails quality gate -> Keep previous
  // published Edition." A null return here means there truly is no previous
  // Edition AND even this forced bootstrap attempt couldn't clear the
  // quality gate (e.g. too little real story data exists yet) — the same
  // table's "No previous Edition exists" row says the caller falls back to a
  // live standings/results view in that case (routes/broadcast.ts, task 134,
  // not yet written).
  return previous;
}

// ═══════════════════════════════════════════════════════════════════════
// 16.3 ensureCurrentBroadcastEdition — idempotent slot check, top to bottom
// ═══════════════════════════════════════════════════════════════════════

/**
 * The full 8-step slot check. It is called both by the background scheduler
 * and by viewer requests; database slot ownership makes repeated calls safe:
 *   1. resolve latest logical slot in Europe/London
 *   2. ensure monthly season state is current
 *   3. if slot row already PUBLISHED/SKIPPED -> return current published edition
 *   4. acquire build ownership using unique slot_key / transaction
 *   5. compute change score since last published cutoff
 *   6. if below threshold and no forced condition -> mark SKIPPED
 *   7. otherwise build and quality-gate Edition -> PUBLISHED
 *   8. on error -> FAILED; continue serving previous PUBLISHED Edition
 * Steps 5-7 live in buildEdition() above; this function is steps 1-4 plus
 * the step-8 error boundary around the call into it.
 */
export async function ensureCurrentBroadcastEdition(now: Date = new Date()): Promise<BroadcastEdition | null> {
  const config = await getBroadcastConfig();
  const slot = resolveLogicalSlot(now, { middayTime: config.middayTime, eveningTime: config.eveningTime, nightTime: config.nightTime, timezone: config.timezone, singleDailyEpisode: config.singleDailyEpisode });

  await maybeAutoResetLeagueSeasons(now);

  const claim = await claimBuildOwnership(slot, now, config.programmeVersion);
  if (claim.kind === "terminal") {
    // A producer-created manual Edition or copy-on-write rebuild can be newer
    // than this scheduled slot row. Always serve the latest publication.
    return latestPublishedEdition();
  }
  if (claim.kind === "building_elsewhere") {
    return latestPublishedEdition();
  }

  const previous = await latestPublishedEdition();
  try {
    return await buildEdition({ claimedRow: claim.row, previous, now, config });
  } catch (err) {
    console.error(`edition-engine: build failed for slot ${slot.slotKey}:`, err);
    try {
      await db
        .update(broadcastEditionsTable)
        .set({ status: "FAILED", diagnostic: err instanceof Error ? err.message : String(err) })
        .where(eq(broadcastEditionsTable.id, claim.row.id));
    } catch (markFailedErr) {
      console.error(`edition-engine: failed to mark slot ${slot.slotKey} as FAILED after a build error:`, markFailedErr);
    }
    return previous;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Admin regenerate — POST /api/admin/broadcast/regenerate (14.2)
// ═══════════════════════════════════════════════════════════════════════

export type ForceRebuildResult =
  | { kind: "built"; edition: BroadcastEdition | null; attempt: BroadcastEdition }
  /** The current slot is already BUILDING (an ordinary lazy check landed on it at the same moment) — reclaiming it here would race two builds against the same row, so this defers rather than doing that; the caller should just tell the admin to retry shortly. */
  | { kind: "already_building" };

/**
 * The admin-only counterpart to ensureCurrentBroadcastEdition() above, for
 * 14.2's "force build current/manual Edition for testing." The ordinary lazy
 * check's claimBuildOwnership() deliberately only ever reclaims a FAILED row
 * (16.4's own concurrency contract) — an admin explicitly asking to
 * regenerate wants a fresh build even when the current slot is already
 * PUBLISHED or SKIPPED, which claimBuildOwnership() would otherwise treat as
 * terminal and refuse to touch. A PUBLISHED row is never demoted: its rebuild
 * uses a copy-on-write attempt row while retaining the logical slot as the
 * deterministic Director/commentary seed. Terminal non-published rows can be
 * safely reclaimed with a compare-and-set update. The function always
 * passes adminForced: true into buildEdition(), so the change-score
 * threshold from 10.1 never blocks an admin's own explicit request.
 *
 * `previous` is read BEFORE this slot's own row is reclaimed, so if the
 * current slot was already the latest PUBLISHED Edition, `previous` legally
 * IS that same row's prior state — buildEdition() then re-scans
 * (previous.dataCutoff, now] for anything new exactly as it would for any
 * other rebuild, which is exactly "regenerate with current settings/data"
 * for an admin who, say, just bumped commentaryVersion or banterLevel and
 * wants to see the effect immediately rather than waiting for the next
 * natural change-score-driven rebuild.
 */
export async function forceRebuildCurrentEdition(now: Date = new Date()): Promise<ForceRebuildResult> {
  // Guards against a second concurrent admin action (regenerate/create
  // episode/clean sweep) racing this one — see the admin build lock's own
  // header above. Reuses this function's existing "already_building" result
  // kind rather than throwing, since the route already handles that case.
  const lockHolder = randomUUID();
  if (!(await claimAdminBuildLock(lockHolder, now))) return { kind: "already_building" };
  const lockHeartbeat = startAdminBuildLockHeartbeat(lockHolder);

  try {
    const config = await getBroadcastConfig();
    const slot = resolveLogicalSlot(now, { middayTime: config.middayTime, eveningTime: config.eveningTime, nightTime: config.nightTime, timezone: config.timezone, singleDailyEpisode: config.singleDailyEpisode });

    await maybeAutoResetLeagueSeasons();

    const previous = await latestPublishedEdition();
    const [existing] = await db.select().from(broadcastEditionsTable).where(eq(broadcastEditionsTable.slotKey, slot.slotKey)).limit(1);

    let claimedRow: BroadcastEdition;
    if (existing) {
      if (existing.status === "BUILDING") return { kind: "already_building" };
      if (existing.status === "PUBLISHED") {
        const [attempt] = await db
          .insert(broadcastEditionsTable)
          .values({
            slotKey: rebuildAttemptSlotKey(slot.slotKey, randomUUID()),
            slotType: existing.slotType,
            scheduledFor: existing.scheduledFor,
            dataCutoff: now,
            status: "BUILDING",
            changeScore: 0,
            programmeVersion: config.programmeVersion,
            programme: null,
            diagnostic: null,
            publishedAt: null,
          })
          .returning();
        if (!attempt) throw new Error("Could not create the broadcast rebuild attempt");
        claimedRow = attempt;
      } else {
        const [reclaimed] = await db
          .update(broadcastEditionsTable)
          .set({ status: "BUILDING" satisfies EditionStatus })
          .where(and(
            eq(broadcastEditionsTable.id, existing.id),
            eq(broadcastEditionsTable.status, existing.status),
          ))
          .returning();
        if (!reclaimed) return { kind: "already_building" };
        claimedRow = reclaimed;
      }
    } else {
      const [inserted] = await db
        .insert(broadcastEditionsTable)
        .values({
          slotKey: slot.slotKey, slotType: slot.slotType, scheduledFor: slot.scheduledFor,
          dataCutoff: now, status: "BUILDING", changeScore: 0, programmeVersion: config.programmeVersion,
          programme: null, diagnostic: null, publishedAt: null,
        })
        .onConflictDoNothing({ target: broadcastEditionsTable.slotKey })
        .returning();
      if (!inserted) return { kind: "already_building" }; // lost the INSERT race to a concurrent request
      claimedRow = inserted;
    }

    try {
      const edition = await buildEdition({
        claimedRow, previous, now, config, adminForced: true, seedSlotKey: slot.slotKey, seasonCatchUp: true,
      });
      const [attempt] = await db
        .select()
        .from(broadcastEditionsTable)
        .where(eq(broadcastEditionsTable.id, claimedRow.id))
        .limit(1);
      return { kind: "built", edition, attempt: attempt ?? claimedRow };
    } catch (err) {
      console.error(`edition-engine: admin-forced rebuild failed for slot ${slot.slotKey}:`, err);
      try {
        await db
          .update(broadcastEditionsTable)
          .set({ status: "FAILED", diagnostic: err instanceof Error ? err.message : String(err) })
          .where(eq(broadcastEditionsTable.id, claimedRow.id));
      } catch (markFailedErr) {
        console.error(`edition-engine: failed to mark slot ${slot.slotKey} as FAILED after an admin-forced rebuild error:`, markFailedErr);
      }
      const failedAttempt = { ...claimedRow, status: "FAILED" as const, diagnostic: err instanceof Error ? err.message : String(err) };
      return { kind: "built", edition: previous, attempt: failedAttempt };
    }
  } finally {
    stopAdminBuildLockHeartbeat(lockHeartbeat);
    await releaseAdminBuildLock(lockHolder);
  }
}

export type CreateManualEpisodeResult = {
  /** The unique manual Edition row created for this producer request. */
  attempt: BroadcastEdition;
  /** The Edition viewers should keep receiving. This is the new attempt when
   * it publishes, or the previous published Edition when the new attempt
   * fails its quality gate. */
  edition: BroadcastEdition | null;
};

/**
 * Creates a genuinely new producer-triggered episode rather than reclaiming
 * the current scheduled slot. The timestamped manual slot key gives the
 * Director and Commentary Engine a fresh deterministic seed while preserving
 * reproducibility for this exact Edition.
 */
export async function createManualBroadcastEpisode(now: Date = new Date()): Promise<CreateManualEpisodeResult> {
  // Guards against a second concurrent admin action racing this one — see
  // the admin build lock's own header above. This function's result type
  // has no "already busy" kind of its own (unlike forceRebuildCurrentEdition),
  // so it throws a distinguishable error instead; routes/broadcast.ts
  // catches it and returns 409.
  const lockHolder = randomUUID();
  if (!(await claimAdminBuildLock(lockHolder, now))) throw new AdminBuildLockedError();
  const lockHeartbeat = startAdminBuildLockHeartbeat(lockHolder);

  try {
    const config = await getBroadcastConfig();
    await maybeAutoResetLeagueSeasons();

    const previous = await latestPublishedEdition();
    const slotKey = manualEpisodeSlotKey(now, randomUUID());
    const [claimedRow] = await db
      .insert(broadcastEditionsTable)
      .values({
        slotKey,
        slotType: "manual",
        scheduledFor: now,
        dataCutoff: now,
        status: "BUILDING",
        changeScore: 0,
        programmeVersion: config.programmeVersion,
        programme: null,
        diagnostic: null,
        publishedAt: null,
      })
      .returning();

    if (!claimedRow) {
      throw new Error("Could not create the manual broadcast Edition");
    }

    try {
      const edition = await buildEdition({ claimedRow, previous, now, config, adminForced: true, seasonCatchUp: true });
      const [attempt] = await db
        .select()
        .from(broadcastEditionsTable)
        .where(eq(broadcastEditionsTable.id, claimedRow.id))
        .limit(1);
      return { attempt: attempt ?? claimedRow, edition };
    } catch (err) {
      const diagnostic = err instanceof Error ? err.message : String(err);
      console.error(`edition-engine: producer episode failed for slot ${slotKey}:`, err);
      const [failed] = await db
        .update(broadcastEditionsTable)
        .set({ status: "FAILED", diagnostic })
        .where(eq(broadcastEditionsTable.id, claimedRow.id))
        .returning();
      return { attempt: failed ?? { ...claimedRow, status: "FAILED", diagnostic }, edition: previous };
    }
  } finally {
    stopAdminBuildLockHeartbeat(lockHeartbeat);
    await releaseAdminBuildLock(lockHolder);
  }
}

/**
 * Creates one immutable, complete active-season programme from a
 * producer-selected boundary. It never deletes source or broadcast history,
 * and viewers retain the previous published Edition if this attempt fails.
 */
export async function createBroadcastCleanSweep(
  start: Date,
  now: Date = new Date(),
): Promise<CreateManualEpisodeResult> {
  if (!Number.isFinite(start.getTime()) || start >= now) {
    throw new Error("The clean-sweep start must be a valid time before now");
  }
  if (now.getTime() - start.getTime() > 93 * 24 * 60 * 60 * 1000) {
    throw new Error("The clean-sweep start cannot be more than 93 days ago");
  }

  // Guards against a second concurrent admin action racing this one — see
  // the admin build lock's own header above, and createManualBroadcastEpisode's
  // matching comment on why this throws rather than returning a result kind.
  const lockHolder = randomUUID();
  if (!(await claimAdminBuildLock(lockHolder, now))) throw new AdminBuildLockedError();
  const lockHeartbeat = startAdminBuildLockHeartbeat(lockHolder);

  try {
    const config = await getBroadcastConfig();
    await maybeAutoResetLeagueSeasons();
    const previous = await latestPublishedEdition();
    const slotKey = `season-sweep:${start.toISOString().slice(0, 10)}:${now.toISOString()}:${randomUUID()}`;
    const [claimedRow] = await db.insert(broadcastEditionsTable).values({
      slotKey,
      slotType: "manual",
      scheduledFor: now,
      dataCutoff: now,
      status: "BUILDING",
      changeScore: 0,
      programmeVersion: config.programmeVersion,
      programme: null,
      diagnostic: null,
      publishedAt: null,
    }).returning();
    if (!claimedRow) throw new Error("Could not create the clean-sweep Edition");

    try {
      const edition = await buildEdition({
        claimedRow,
        previous,
        now,
        config,
        adminForced: true,
        seasonCatchUp: true,
        seasonSweepStart: start,
      });
      const [attempt] = await db.select().from(broadcastEditionsTable)
        .where(eq(broadcastEditionsTable.id, claimedRow.id)).limit(1);
      return { attempt: attempt ?? claimedRow, edition };
    } catch (err) {
      const diagnostic = err instanceof Error ? err.message : String(err);
      console.error(`edition-engine: clean sweep failed for slot ${slotKey}:`, err);
      const [failed] = await db.update(broadcastEditionsTable)
        .set({ status: "FAILED", diagnostic })
        .where(eq(broadcastEditionsTable.id, claimedRow.id))
        .returning();
      return { attempt: failed ?? { ...claimedRow, status: "FAILED", diagnostic }, edition: previous };
    }
  } finally {
    stopAdminBuildLockHeartbeat(lockHeartbeat);
    await releaseAdminBuildLock(lockHolder);
  }
}

/**
 * Creates a genuinely REPACKAGED special — director-weekly-highlights.ts's
 * own "best of the week" reel (task's own ask, named explicitly as a
 * "repackaged edition stitching the week's top segments... into a show").
 * Unlike every other create-/forceRebuild-prefixed function in this file, this one
 * never calls buildEdition() at all: there is no fresh detection to run, no
 * Commentary Engine pass to make, no Director running order to walk — the
 * content is the last 7 days' own already-published segments, re-aired
 * verbatim. Still goes through the same admin build lock + BroadcastEdition
 * row lifecycle as createManualBroadcastEpisode/createBroadcastCleanSweep so
 * concurrent admin actions can never race each other, and so a failed
 * attempt is marked FAILED (never silently dropped) while viewers keep the
 * previous published Edition exactly as those two functions already do.
 */
export async function createWeeklyHighlightsEpisode(now: Date = new Date()): Promise<CreateManualEpisodeResult> {
  const lockHolder = randomUUID();
  if (!(await claimAdminBuildLock(lockHolder, now))) throw new AdminBuildLockedError();
  const lockHeartbeat = startAdminBuildLockHeartbeat(lockHolder);

  try {
    const config = await getBroadcastConfig();
    const previous = await latestPublishedEdition();
    const slotKey = manualEpisodeSlotKey(now, randomUUID());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [claimedRow] = await db.insert(broadcastEditionsTable).values({
      slotKey, slotType: "manual", scheduledFor: now, dataCutoff: now, status: "BUILDING",
      changeScore: 0, programmeVersion: config.programmeVersion, programme: null, diagnostic: null, publishedAt: null,
    }).returning();
    if (!claimedRow) throw new Error("Could not create the weekly highlights Edition");

    try {
      const sourceRows = await db.select({
        id: broadcastEditionsTable.id,
        publishedAt: broadcastEditionsTable.publishedAt,
        programme: broadcastEditionsTable.programme,
      }).from(broadcastEditionsTable).where(and(
        eq(broadcastEditionsTable.status, "PUBLISHED"),
        sql`${broadcastEditionsTable.publishedAt} >= ${weekStart}`,
        sql`${broadcastEditionsTable.publishedAt} <= ${now}`,
      ));

      const sourceEditions: WeeklySourceEdition[] = sourceRows
        // A previous highlights reel is itself already-repackaged content —
        // re-airing one of ITS segments would just reshow the same moment a
        // second time removed from when it actually happened, so the week's
        // own reel(s) are excluded as a source for this one.
        .filter(row => row.publishedAt !== null && isEditionProgramme(row.programme) && programmeModeOf(row.programme) !== "WEEKLY_HIGHLIGHTS")
        .map(row => ({ id: row.id, publishedAt: row.publishedAt as Date, segments: (row.programme as EditionProgramme).segments }));

      const picked = selectWeeklyHighlightSegments(sourceEditions);
      if (picked.length === 0) {
        throw new Error("No published segments from the last 7 days to build a highlights reel from.");
      }

      const openingRng = commentaryRng(slotKey, "utility:opening", config.commentaryVersion);
      const opening: ProgrammeSegment = {
        slot: 1, purpose: "opening", importance: "utility", storyId: null, supportingStoryIds: [], storyType: null,
        leagueType: null, lifecycleAtBroadcast: null,
        dialogue: buildFixedDialogue(pickFrom(OPENING_DIALOGUE_OPTIONS.WEEKLY_HIGHLIGHTS, openingRng)),
        validityRules: [], facts: null,
      };
      const closing: ProgrammeSegment = {
        slot: picked.length + 2, purpose: "closing", importance: "utility", storyId: null, supportingStoryIds: [], storyType: null,
        leagueType: null, lifecycleAtBroadcast: null,
        dialogue: buildFixedDialogue({
          a: "That's the best of the last seven days from TKDL LIVE.",
          b: "Regular coverage picks straight back up from here.",
        }),
        validityRules: [], facts: null,
      };
      const segments: ProgrammeSegment[] = [
        opening,
        ...picked.map((segment, index) => ({ ...segment, slot: index + 2 })),
        closing,
      ];
      const programme: EditionProgramme = { mode: "WEEKLY_HIGHLIGHTS", segments };

      const [published] = await db.update(broadcastEditionsTable)
        .set({ status: "PUBLISHED", programme, publishedAt: now })
        .where(eq(broadcastEditionsTable.id, claimedRow.id))
        .returning();
      if (!published) throw new Error("Could not publish the weekly highlights Edition");
      return { attempt: published, edition: published };
    } catch (err) {
      const diagnostic = err instanceof Error ? err.message : String(err);
      console.error(`edition-engine: weekly highlights reel failed for slot ${slotKey}:`, err);
      const [failed] = await db.update(broadcastEditionsTable)
        .set({ status: "FAILED", diagnostic })
        .where(eq(broadcastEditionsTable.id, claimedRow.id))
        .returning();
      return { attempt: failed ?? { ...claimedRow, status: "FAILED", diagnostic }, edition: previous };
    }
  } finally {
    stopAdminBuildLockHeartbeat(lockHeartbeat);
    await releaseAdminBuildLock(lockHolder);
  }
}
