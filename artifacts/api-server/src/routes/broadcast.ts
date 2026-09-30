import { Router, type Request, type Response } from "express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  db, broadcastEditionsTable, broadcastStoriesTable, broadcastPredictionSnapshotsTable,
  playersTable, matchesTable, playerAchievementsTable, achievementsTable,
  type LeagueType,
} from "@workspace/db";
import { getFeatureStatus, isFeatureAvailable, FEATURES } from "../services/feature-flags-service";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { paramStr } from "../lib/http";
import {
  createBroadcastCleanSweep, createManualBroadcastEpisode, ensureCurrentBroadcastEdition,
  forceRebuildCurrentEdition, latestPublishedEdition, isEditionProgramme, AdminBuildLockedError,
} from "../broadcast/edition-engine";
import { getLivePayload } from "../broadcast/live-events";
import { diagnoseSeasonHighlights, resetSeasonReviewForLeague } from "../broadcast/story-engine";
import {
  getBroadcastConfig, setBroadcastSettings, BROADCAST_SETTING_KEYS, validateBroadcastSettingValue,
  type BroadcastSettingKey,
} from "../broadcast/config";
import { resolveNextLogicalSlot } from "../broadcast/edition-slots";
import { serializeSegment, editionTitle, SLOT_TYPE_LABELS } from "../broadcast/api-shapes";
import {
  programmeSegmentId, programmeModeOf, totalEstimatedSecondsForProgramme, classifyEditionLength,
  type EditionProgramme,
} from "../broadcast/director-math";
import { buildPowerRankings } from "../broadcast/power-rankings";

/**
 * TKDL LIVE — the automated broadcast "show" feature (handover doc section
 * 14). See this file's own long-standing header (unchanged below) for the
 * tkdl_live feature-flag gating pattern GET /broadcast/status already
 * established; every other route in this file reuses the exact same
 * isFeatureAvailable(FEATURES.TKDL_LIVE, isAdmin) check via
 * requireBroadcastAvailable() below, so a non-admin curling one of these
 * endpoints directly during the admin-preview period gets the same
 * "not available yet" the frontend's coming-soon placeholder already implies
 * server-side, not just a UI-level hide.
 *
 * This is a beta feature gated behind the tkdl_live flag using the same
 * enabled/adminTestMode pattern as card_shop/coins/card_clash: while
 * adminTestMode is on and the flag isn't yet enabled for everyone, only an
 * admin session sees it "available" — regular players get `available: false`
 * and the frontend shows a coming-soon placeholder instead. Once an admin
 * flips it live (POST /admin/feature-flags/tkdl_live/enable-all, via the
 * existing generic admin panel), everyone sees `available: true`.
 *
 * isAdmin comes from req.session.isAdmin (set at login in routes/auth.ts,
 * the same real session flag requireAdminSession.ts checks) — NOT from
 * req.user, which is never actually populated anywhere in this codebase.
 * Card Clash's feature-status route now follows this same session pattern.
 */

const router = Router();

function sessionIsAdmin(req: Request): boolean {
  return (req.session as any)?.isAdmin === true;
}

function sessionPlayerId(req: Request): number | null {
  return (req.session as any)?.playerId ?? null;
}

/** Returns true (and sends nothing) when the caller may use TKDL LIVE right now; otherwise sends the 403 itself and returns false, so callers can `if (!(await requireBroadcastAvailable(req, res))) return;`. */
async function requireBroadcastAvailable(req: Request, res: Response): Promise<boolean> {
  const available = await isFeatureAvailable(FEATURES.TKDL_LIVE, sessionIsAdmin(req));
  if (!available) {
    res.status(403).json({ error: "TKDL LIVE is not available yet" });
    return false;
  }
  return true;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

router.get("/broadcast/status", async (req, res): Promise<void> => {
  const status = await getFeatureStatus(FEATURES.TKDL_LIVE, sessionIsAdmin(req));
  res.json(status);
});

// ── GET /broadcast/live-status ────────────────────────────────────────────
// Backs the "new edition" dot on the sidebar's TKDL LIVE nav item — true
// when a published edition exists that this player hasn't opened yet (see
// players.last_seen_broadcast_edition_id). This is a background poll, not
// a gated page load, so it degrades to hasNewEdition:false rather than
// erroring for anyone logged out or without access, instead of the 403
// requireBroadcastAvailable would send.
router.get("/broadcast/live-status", async (req, res): Promise<void> => {
  try {
    const playerId = sessionPlayerId(req);
    if (!playerId) { res.json({ hasNewEdition: false }); return; }

    const available = await isFeatureAvailable(FEATURES.TKDL_LIVE, sessionIsAdmin(req));
    if (!available) { res.json({ hasNewEdition: false }); return; }

    const latest = await latestPublishedEdition();
    if (!latest) { res.json({ hasNewEdition: false }); return; }

    const [player] = await db.select({ lastSeen: playersTable.lastSeenBroadcastEditionId })
      .from(playersTable).where(eq(playersTable.id, playerId));

    res.json({ hasNewEdition: player?.lastSeen !== latest.id });
  } catch {
    res.json({ hasNewEdition: false });
  }
});

// ── POST /broadcast/mark-seen ─────────────────────────────────────────────
// Called once the TKDL LIVE screen has actually loaded, so the sidebar dot
// clears after a player has genuinely seen the latest edition.
router.post("/broadcast/mark-seen", async (req, res): Promise<void> => {
  try {
    const playerId = sessionPlayerId(req);
    if (!playerId) { res.json({ ok: true }); return; }

    const latest = await latestPublishedEdition();
    if (!latest) { res.json({ ok: true }); return; }

    await db.update(playersTable)
      .set({ lastSeenBroadcastEditionId: latest.id })
      .where(eq(playersTable.id, playerId));
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

// ── GET /broadcast/hub-spotlight ──────────────────────────────────────────
// Backs the "Right Now" TKDL LIVE card on the Hub (dashboard.tsx). Same
// always-200, degrade-gracefully shape as /broadcast/live-status above —
// this is a landing-page widget, not a gated page load — but also returns a
// human-readable slot label so the card can say *what* just published
// rather than just flashing a dot. Deliberately doesn't call editionTitle()
// (api-shapes.ts), which needs the full rebuilt EditionProgramme just for
// its optional headline suffix; a Hub teaser card doesn't need that story
// detail, only enough to read as real rather than generic.
router.get("/broadcast/hub-spotlight", async (req, res): Promise<void> => {
  try {
    const available = await isFeatureAvailable(FEATURES.TKDL_LIVE, sessionIsAdmin(req));
    if (!available) { res.json({ available: false, hasNewEdition: false, title: null }); return; }

    const latest = await latestPublishedEdition();
    if (!latest) { res.json({ available: true, hasNewEdition: false, title: null }); return; }

    const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "Europe/London" }).format(latest.scheduledFor);
    const slotLabel = latest.slotType === "manual" ? "Special" : SLOT_TYPE_LABELS[latest.slotType];
    const title = `${slotLabel} Edition, ${dateLabel}`;

    const playerId = sessionPlayerId(req);
    let hasNewEdition = false;
    if (playerId) {
      const [player] = await db.select({ lastSeen: playersTable.lastSeenBroadcastEditionId })
        .from(playersTable).where(eq(playersTable.id, playerId));
      hasNewEdition = player?.lastSeen !== latest.id;
    }

    res.json({ available: true, hasNewEdition, title });
  } catch {
    res.json({ available: false, hasNewEdition: false, title: null });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 14.1 Public endpoints
// ═══════════════════════════════════════════════════════════════════════

router.get("/broadcast/current", async (req, res): Promise<void> => {
  if (!(await requireBroadcastAvailable(req, res))) return;
  try {
    const [edition, config] = await Promise.all([ensureCurrentBroadcastEdition(), getBroadcastConfig()]);
    const nextSlot = resolveNextLogicalSlot(new Date(), {
      middayTime: config.middayTime, eveningTime: config.eveningTime, nightTime: config.nightTime, timezone: config.timezone, singleDailyEpisode: config.singleDailyEpisode,
    });
    const channel = { nextLogicalSlot: nextSlot.slotKey, programmeVersion: config.programmeVersion, commentaryVersion: config.commentaryVersion };
    const live = { pollSeconds: config.livePollSeconds };

    // 17's own "No previous Edition exists" fallback row: nothing has ever
    // cleared the quality gate yet. `edition: null` lets the frontend fall
    // back to a live standings/results view rather than an empty player.
    if (!edition || !isEditionProgramme(edition.programme)) {
      res.json({ edition: null, channel, live });
      return;
    }

    const programme = edition.programme as EditionProgramme;
    // 14.4's own split: `headlines` is slot 2's tease list (up to 3 brief
    // mentions, director.ts) — slot 1's fixed opening sign-on has no story of
    // its own and stays in `segments` as the body's first entry, alongside
    // every other purpose. Both `headlines` and `body` are just the same
    // persisted list partitioned by purpose, not two independently-fetched
    // things.
    const headlines = programme.segments.filter(s => s.purpose === "headlines");
    const body = programme.segments.filter(s => s.purpose !== "headlines");

    res.json({
      edition: {
        id: edition.id,
        slotKey: edition.slotKey,
        slotType: edition.slotType,
        generatedAt: (edition.publishedAt ?? edition.createdAt).toISOString(),
        dataCutoff: edition.dataCutoff.toISOString(),
        title: editionTitle({ slotType: edition.slotType, scheduledFor: edition.scheduledFor }, programme),
        mode: programmeModeOf(programme),
        headlines: headlines.map(s => serializeSegment(s, programmeSegmentId(s))),
        segments: body.map(s => serializeSegment(s, programmeSegmentId(s))),
      },
      channel,
      live,
    });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

// ── GET /broadcast/archive ──────────────────────────────────────────────
// Previous Editions are already persisted in full in broadcast_editions.
// The replay library therefore only needs a small, read-only listing; it
// never rebuilds an Edition or writes anything when viewers browse it.
router.get("/broadcast/archive", async (req, res): Promise<void> => {
  if (!(await requireBroadcastAvailable(req, res))) return;
  try {
    const rows = await db.select().from(broadcastEditionsTable)
      .where(eq(broadcastEditionsTable.status, "PUBLISHED"))
      .orderBy(desc(broadcastEditionsTable.publishedAt), desc(broadcastEditionsTable.id))
      .limit(40);

    const items = rows.flatMap(row => {
      if (!isEditionProgramme(row.programme)) return [];
      const programme = row.programme as EditionProgramme;
      return [{
        id: row.id,
        title: editionTitle({ slotType: row.slotType, scheduledFor: row.scheduledFor }, programme),
        mode: programmeModeOf(programme),
        slotType: row.slotType,
        publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
        durationSeconds: totalEstimatedSecondsForProgramme(programme),
        segmentCount: programme.segments.length,
        leagueTypes: [...new Set(programme.segments.map(segment => segment.leagueType).filter(Boolean))],
      }];
    });
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

// ── GET /broadcast/archive/:id ─────────────────────────────────────────
// Returns the same public, serialised scene shape as /broadcast/current,
// without live overlays or lazy-build behaviour. The browser supplies a
// fresh playback start time so every selected replay begins at its opening.
router.get("/broadcast/archive/:id", async (req, res): Promise<void> => {
  if (!(await requireBroadcastAvailable(req, res))) return;
  const id = Number(paramStr(req.params.id));
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid Edition id" }); return; }
  try {
    const [row] = await db.select().from(broadcastEditionsTable)
      .where(and(eq(broadcastEditionsTable.id, id), eq(broadcastEditionsTable.status, "PUBLISHED")))
      .limit(1);
    if (!row || !isEditionProgramme(row.programme)) { res.status(404).json({ error: "Edition not found" }); return; }

    const programme = row.programme as EditionProgramme;
    const headlines = programme.segments.filter(segment => segment.purpose === "headlines");
    const body = programme.segments.filter(segment => segment.purpose !== "headlines");
    res.json({
      edition: {
        id: row.id,
        slotKey: row.slotKey,
        slotType: row.slotType,
        generatedAt: (row.publishedAt ?? row.createdAt).toISOString(),
        dataCutoff: row.dataCutoff.toISOString(),
        title: editionTitle({ slotType: row.slotType, scheduledFor: row.scheduledFor }, programme),
        mode: programmeModeOf(programme),
        headlines: headlines.map(segment => serializeSegment(segment, programmeSegmentId(segment))),
        segments: body.map(segment => serializeSegment(segment, programmeSegmentId(segment))),
      },
    });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

router.get("/broadcast/live", async (req, res): Promise<void> => {
  if (!(await requireBroadcastAvailable(req, res))) return;
  try {
    res.json(await getLivePayload());
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

const PREDICTOR_LEAGUE_TYPES = ["singles", "doubles", "shift_wars"] as const;

router.get("/broadcast/predictor/:league", async (req, res): Promise<void> => {
  if (!(await requireBroadcastAvailable(req, res))) return;
  const league = paramStr(req.params.league);
  if (!(PREDICTOR_LEAGUE_TYPES as readonly string[]).includes(league)) {
    res.status(400).json({ error: `league must be one of ${PREDICTOR_LEAGUE_TYPES.join(", ")}` });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(broadcastPredictionSnapshotsTable)
      .where(and(eq(broadcastPredictionSnapshotsTable.snapshotType, "TITLE"), eq(broadcastPredictionSnapshotsTable.leagueType, league as LeagueType)))
      .orderBy(desc(broadcastPredictionSnapshotsTable.generatedAt))
      .limit(1);

    if (!row) {
      res.json({ league, generatedAt: null, modelVersion: null, standings: [] });
      return;
    }
    res.json({ league, generatedAt: row.generatedAt.toISOString(), modelVersion: row.modelVersion, standings: row.payload });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

type PunditSnapshotRow = {
  season_id: number;
  season_name: string;
  champion_id: number | null;
  champion_name: string | null;
  generated_at: Date;
  payload: unknown;
};

type PunditPick = { playerId: number; playerName: string; probability: number };

function rankedSinglesPicks(payload: unknown, names: ReadonlyMap<number, string>): PunditPick[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .filter((entry): entry is { entityId: number; titleProbability: number; isEliminated?: boolean } =>
      !!entry && typeof entry === "object" && Number.isInteger((entry as any).entityId) && typeof (entry as any).titleProbability === "number" && !(entry as any).isEliminated,
    )
    .sort((a, b) => b.titleProbability - a.titleProbability)
    .map(entry => ({ playerId: entry.entityId, playerName: names.get(entry.entityId) ?? `Player ${entry.entityId}`, probability: entry.titleProbability }));
}

// Chalky calls the model favourite; Ton backs the leading challenger. The
// picks come from the first predictor snapshot saved for each season, so a
// pundit cannot quietly change their answer once the title race develops.
// Completed seasons are scored against the real stored champion.
router.get("/broadcast/pundit-scoreboard", async (req, res): Promise<void> => {
  if (!(await requireBroadcastAvailable(req, res))) return;
  try {
    const [historyResult, currentResult, playerRows] = await Promise.all([
      db.execute(sql`
        SELECT DISTINCT ON (ps.season_id)
          ps.season_id, s.name AS season_name, s.champion_id, s.champion_name,
          ps.generated_at, ps.payload
        FROM broadcast_prediction_snapshots ps
        JOIN seasons s ON s.id = ps.season_id
        WHERE ps.snapshot_type = 'TITLE' AND ps.league_type = 'singles'
          AND s.is_active = false AND s.champion_id IS NOT NULL
        ORDER BY ps.season_id, ps.generated_at ASC
      `),
      db.execute(sql`
        SELECT ps.season_id, s.name AS season_name, s.champion_id, s.champion_name,
               ps.generated_at, ps.payload
        FROM broadcast_prediction_snapshots ps
        JOIN seasons s ON s.id = ps.season_id
        WHERE ps.snapshot_type = 'TITLE' AND ps.league_type = 'singles' AND s.is_active = true
        ORDER BY ps.generated_at DESC
        LIMIT 1
      `),
      db.select({ id: playersTable.id, name: playersTable.name }).from(playersTable),
    ]);

    const names = new Map(playerRows.map(player => [player.id, player.name]));
    const history = (historyResult.rows as unknown as PunditSnapshotRow[]).flatMap(row => {
      const ranked = rankedSinglesPicks(row.payload, names);
      if (ranked.length === 0) return [];
      const chalky = ranked[0];
      const ton = ranked[1] ?? ranked[0];
      return [{
        seasonId: row.season_id,
        seasonName: row.season_name,
        champion: { playerId: row.champion_id!, playerName: row.champion_name ?? names.get(row.champion_id!) ?? `Player ${row.champion_id}` },
        generatedAt: new Date(row.generated_at).toISOString(),
        chalky: { ...chalky, correct: chalky.playerId === row.champion_id },
        ton: { ...ton, correct: ton.playerId === row.champion_id },
      }];
    }).sort((a, b) => b.seasonId - a.seasonId);

    const currentRow = currentResult.rows[0] as unknown as PunditSnapshotRow | undefined;
    const currentRanked = currentRow ? rankedSinglesPicks(currentRow.payload, names) : [];
    const current = currentRow && currentRanked.length > 0 ? {
      seasonId: currentRow.season_id,
      seasonName: currentRow.season_name,
      generatedAt: new Date(currentRow.generated_at).toISOString(),
      chalky: currentRanked[0],
      ton: currentRanked[1] ?? currentRanked[0],
    } : null;

    res.json({
      totals: {
        chalky: history.filter(item => item.chalky.correct).length,
        ton: history.filter(item => item.ton.correct).length,
        seasonsScored: history.length,
      },
      current,
      history: history.slice(0, 8),
    });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

// The public TKDL LIVE archive contains only finished, real interviews.
// Test fires, declined requests and half-finished conversations stay out of
// the programme-facing history.
router.get("/broadcast/voices", async (req, res): Promise<void> => {
  if (!(await requireBroadcastAvailable(req, res))) return;
  try {
    const { rows } = await db.execute(sql`
      SELECT r.id, r.trigger_type, r.created_at, p.name AS player_name,
             oq.presenter AS opener_presenter, oq.prompt_text AS opener_prompt,
             oa.answer_text AS opener_answer,
             fq.presenter AS followup_presenter, fq.prompt_text AS followup_prompt,
             fa.answer_text AS followup_answer
      FROM interview_requests r
      JOIN players p ON p.id = r.player_id
      JOIN interview_questions oq ON oq.id = r.question_id
      JOIN interview_answers oa ON oa.request_id = r.id AND oa.turn = 'opener' AND oa.response_type = 'comment'
      LEFT JOIN interview_questions fq ON fq.id = r.followup_question_id
      LEFT JOIN interview_answers fa ON fa.request_id = r.id AND fa.turn = 'followup' AND fa.response_type = 'comment'
      WHERE r.status = 'answered' AND r.is_test = false
      ORDER BY r.created_at DESC
      LIMIT 30
    `);
    res.json({
      voices: rows.map((row: any) => ({
        id: Number(row.id), triggerType: row.trigger_type, createdAt: new Date(row.created_at).toISOString(), playerName: row.player_name,
        opener: { presenter: row.opener_presenter, question: row.opener_prompt, answer: row.opener_answer },
        followup: row.followup_prompt && row.followup_answer
          ? { presenter: row.followup_presenter, question: row.followup_prompt, answer: row.followup_answer }
          : null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

function playerStory(player: { rank: number; seasonWins: number; seasonLosses: number; currentWinStreak: number; currentLossStreak: number }): string {
  const played = player.seasonWins + player.seasonLosses;
  if (player.rank === 1 && played > 0) return "Sets the pace at the top of the current Singles standings.";
  if (player.currentWinStreak >= 3) return `Carries a ${player.currentWinStreak}-match winning run into the next chapter of the season.`;
  if (player.currentLossStreak >= 3) return `Looking for a response after ${player.currentLossStreak} consecutive defeats.`;
  if (played === 0) return "Still waiting to write the first result of the current season.";
  if (player.seasonWins === player.seasonLosses) return "The current campaign is balanced exactly between wins and defeats.";
  return player.seasonWins > player.seasonLosses
    ? "A winning current-season record keeps the campaign moving in the right direction."
    : "The numbers leave room for a strong second-half response.";
}

function punditLines(player: { rank: number; seasonWins: number; seasonLosses: number; currentWinStreak: number; currentLossStreak: number; longestWinStreak: number }): { chalky: string; ton: string } {
  const played = player.seasonWins + player.seasonLosses;
  const winRate = played > 0 ? Math.round(player.seasonWins / played * 100) : 0;
  const chalky = player.rank === 1 && played > 0
    ? "Top of the table earns the attention. The challenge now is staying there."
    : player.currentWinStreak >= 3
      ? `${player.currentWinStreak} wins in a row is proper form. Confidence should be high.`
      : played > 0
        ? `${winRate}% wins this season tells you exactly where the campaign stands.`
        : "No league result yet, so the first night will tell us far more than any prediction.";
  const ton = player.currentLossStreak >= 3
    ? `The response matters now. A ${player.currentLossStreak}-match losing run is there to be broken.`
    : player.longestWinStreak >= 4
      ? `We've already seen a ${player.longestWinStreak}-match career run. That ceiling is real.`
      : "The next step is turning isolated results into a run the whole league notices.";
  return { chalky, ton };
}

// One compact, read-only dataset for the Player Focus library. It reuses
// existing league records and never writes a new profile or editorial claim.
router.get("/broadcast/player-focus", async (req, res): Promise<void> => {
  if (!(await requireBroadcastAvailable(req, res))) return;
  try {
    const players = await db.select({
      id: playersTable.id, name: playersTable.name, elo: playersTable.elo, points: playersTable.points,
      seasonWins: playersTable.seasonWins, seasonLosses: playersTable.seasonLosses,
      careerWins: playersTable.careerWins, careerLosses: playersTable.careerLosses,
      careerGamesPlayed: playersTable.careerGamesPlayed, careerPeakElo: playersTable.careerPeakElo,
      currentWinStreak: playersTable.currentWinStreak, currentLossStreak: playersTable.currentLossStreak,
      longestWinStreak: playersTable.longestWinStreak, eliminationsCount: playersTable.eliminationsCount,
      avatarUpdatedAt: playersTable.avatarUpdatedAt,
    }).from(playersTable).where(eq(playersTable.isActive, true));

    if (players.length === 0) { res.json({ players: [] }); return; }
    const playerIds = players.map(player => player.id);
    const [matches, achievementRows, championRows, quoteResult, predictorRows] = await Promise.all([
      db.select({
        id: matchesTable.id, winnerId: matchesTable.winnerId, loserId: matchesTable.loserId,
        winnerName: matchesTable.winnerName, loserName: matchesTable.loserName, playedAt: matchesTable.playedAt,
        winner180s: matchesTable.winner180s, loser180s: matchesTable.loser180s,
      }).from(matchesTable)
        .where(or(inArray(matchesTable.winnerId, playerIds), inArray(matchesTable.loserId, playerIds)))
        .orderBy(desc(matchesTable.playedAt)),
      db.select({
        playerId: playerAchievementsTable.playerId, name: achievementsTable.name,
        icon: achievementsTable.icon, rarity: achievementsTable.rarity, unlockedAt: playerAchievementsTable.unlockedAt,
      }).from(playerAchievementsTable)
        .innerJoin(achievementsTable, eq(achievementsTable.id, playerAchievementsTable.achievementId))
        .where(inArray(playerAchievementsTable.playerId, playerIds)),
      db.execute(sql`SELECT player_id, COUNT(*)::int AS titles FROM season_standings WHERE player_id = ANY(${playerIds}) AND is_champion = true GROUP BY player_id`),
      db.execute(sql`
        SELECT DISTINCT ON (r.player_id) r.player_id, a.answer_text, r.created_at
        FROM interview_requests r
        JOIN interview_answers a ON a.request_id = r.id AND a.response_type = 'comment'
        WHERE r.player_id = ANY(${playerIds}) AND r.status = 'answered' AND r.is_test = false
        ORDER BY r.player_id, r.created_at DESC, CASE WHEN a.turn = 'followup' THEN 0 ELSE 1 END
      `),
      db.select({ payload: broadcastPredictionSnapshotsTable.payload })
        .from(broadcastPredictionSnapshotsTable)
        .where(and(eq(broadcastPredictionSnapshotsTable.snapshotType, "TITLE"), eq(broadcastPredictionSnapshotsTable.leagueType, "singles")))
        .orderBy(desc(broadcastPredictionSnapshotsTable.generatedAt)).limit(1),
    ]);

    const rankById = new Map([...players].sort((a, b) => b.points - a.points || b.elo - a.elo).map((player, index) => [player.id, index + 1]));
    const champions = new Map((championRows.rows as any[]).map(row => [Number(row.player_id), Number(row.titles)]));
    const quotes = new Map((quoteResult.rows as any[]).map(row => [Number(row.player_id), { text: String(row.answer_text), createdAt: new Date(row.created_at).toISOString() }]));
    const predictor = new Map<number, number>();
    const predictionPayload = predictorRows[0]?.payload;
    if (Array.isArray(predictionPayload)) for (const item of predictionPayload as any[]) {
      if (Number.isInteger(item?.entityId) && typeof item?.titleProbability === "number") predictor.set(item.entityId, item.titleProbability);
    }
    const rarityWeight: Record<string, number> = { Mythic: 5, Legendary: 4, Epic: 3, Rare: 2, Common: 1 };

    const profiles = players.map(player => {
      const ownMatches = matches.filter(match => match.winnerId === player.id || match.loserId === player.id);
      const recentForm = ownMatches.slice(0, 5).map(match => match.winnerId === player.id ? "W" : "L");
      const rivalries = new Map<number, { opponentId: number; opponentName: string; meetings: number; wins: number; losses: number }>();
      let total180s = 0;
      for (const match of ownMatches) {
        const won = match.winnerId === player.id;
        const opponentId = won ? match.loserId : match.winnerId;
        const entry = rivalries.get(opponentId) ?? { opponentId, opponentName: won ? match.loserName : match.winnerName, meetings: 0, wins: 0, losses: 0 };
        entry.meetings += 1; won ? entry.wins += 1 : entry.losses += 1; rivalries.set(opponentId, entry);
        total180s += Number(won ? match.winner180s ?? 0 : match.loser180s ?? 0);
      }
      const mainRivalry = [...rivalries.values()].sort((a, b) => b.meetings - a.meetings || Math.abs(a.wins - a.losses) - Math.abs(b.wins - b.losses))[0] ?? null;
      const achievements = achievementRows.filter(row => row.playerId === player.id);
      const standoutAchievement = [...achievements].sort((a, b) => (rarityWeight[b.rarity] ?? 0) - (rarityWeight[a.rarity] ?? 0) || b.unlockedAt.getTime() - a.unlockedAt.getTime())[0] ?? null;
      const rank = rankById.get(player.id) ?? players.length;
      const profileFacts = { rank, seasonWins: player.seasonWins, seasonLosses: player.seasonLosses, currentWinStreak: player.currentWinStreak, currentLossStreak: player.currentLossStreak, longestWinStreak: player.longestWinStreak };
      return {
        ...player, rank, championshipCount: champions.get(player.id) ?? 0, achievementCount: achievements.length,
        standoutAchievement: standoutAchievement ? { name: standoutAchievement.name, icon: standoutAchievement.icon, rarity: standoutAchievement.rarity } : null,
        total180s, recentForm, mainRivalry, titleProbability: predictor.get(player.id) ?? null,
        latestQuote: quotes.get(player.id) ?? null, seasonStory: playerStory(profileFacts), pundits: punditLines(profileFacts),
      };
    }).sort((a, b) => a.rank - b.rank);

    res.json({ players: profiles });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

type ChannelMatchRow = {
  league_type: LeagueType; id: number; season_id: number | null; season_name: string | null;
  season_active: boolean | null;
  winner_id: number; winner_name: string; loser_id: number; loser_name: string;
  stake: number; game_type: string; played_at: Date | string; was_upset_win: boolean;
};

function londonDateKey(value: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function titleCaseIdentifier(value: string): string {
  return value.toLowerCase().split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

// Channel Home is a single read-only editorial payload. Fetching it once
// replaces three separate archive requests and keeps Render/database work
// bounded when a viewer browses between Match Nights, Rivalry Files and
// Season Documentaries.
router.get("/broadcast/channel", async (req, res): Promise<void> => {
  if (!(await requireBroadcastAvailable(req, res))) return;
  try {
    const [matchResult, seasonsResult, standingsResult, storyResult] = await Promise.all([
      db.execute(sql`
        SELECT 'singles'::text AS league_type, m.id, m.season_id, s.name AS season_name, s.is_active AS season_active,
               m.winner_id, m.winner_name, m.loser_id, m.loser_name,
               m.stake, m.game_type, m.played_at, m.was_upset_win
        FROM matches m LEFT JOIN seasons s ON s.id = m.season_id
        UNION ALL
        SELECT 'doubles'::text, m.id, m.season_id, s.name, s.is_active,
               m.winner_team_id, wt.team_name, m.loser_team_id, lt.team_name,
               m.stake, m.game_type, m.played_at, false
        FROM doubles_matches m
        JOIN doubles_teams wt ON wt.id = m.winner_team_id JOIN doubles_teams lt ON lt.id = m.loser_team_id
        LEFT JOIN seasons s ON s.id = m.season_id
        UNION ALL
        SELECT 'shift_wars'::text, m.id, m.season_id, s.name, s.is_active,
               m.winner_team_id, wt.name, m.loser_team_id, lt.name,
               m.stake, m.game_type, m.played_at, false
        FROM shift_wars_matches m
        JOIN shift_wars_teams wt ON wt.id = m.winner_team_id JOIN shift_wars_teams lt ON lt.id = m.loser_team_id
        LEFT JOIN seasons s ON s.id = m.season_id
        ORDER BY played_at DESC
      `),
      db.execute(sql`
        SELECT id, name, start_date, end_date, champion_id, champion_name, total_matches, league_type
        FROM seasons WHERE is_active = false
        ORDER BY end_date DESC NULLS LAST, id DESC
        LIMIT 30
      `),
      db.execute(sql`
        SELECT ss.season_id, ss.player_id, p.name AS player_name, ss.position, ss.wins, ss.losses, ss.points, ss.elo, ss.is_champion
        FROM season_standings ss JOIN players p ON p.id = ss.player_id
        JOIN seasons s ON s.id = ss.season_id
        WHERE s.is_active = false
        ORDER BY ss.season_id DESC, ss.position ASC
      `),
      db.execute(sql`
        SELECT season_id, story_type, score, sentiment, facts
        FROM broadcast_stories
        WHERE season_id IS NOT NULL
        ORDER BY season_id DESC, score DESC, id ASC
      `),
    ]);

    const matches = (matchResult.rows as unknown as ChannelMatchRow[]).map(row => ({
      leagueType: row.league_type, id: Number(row.id), seasonId: row.season_id === null ? null : Number(row.season_id), seasonName: row.season_name, seasonActive: row.season_active,
      winnerId: Number(row.winner_id), winnerName: row.winner_name, loserId: Number(row.loser_id), loserName: row.loser_name,
      stake: Number(row.stake ?? 0), gameType: row.game_type, playedAt: new Date(row.played_at).toISOString(), wasUpsetWin: !!row.was_upset_win,
    }));

    const byNight = new Map<string, typeof matches>();
    for (const match of matches) {
      const key = londonDateKey(match.playedAt);
      const rows = byNight.get(key) ?? []; rows.push(match); byNight.set(key, rows);
    }
    const matchNights = [...byNight.entries()].slice(0, 18).map(([date, rows]) => {
      const chronological = [...rows].sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt));
      const winnerCounts = new Map<string, number>();
      for (const row of rows) winnerCounts.set(row.winnerName, (winnerCounts.get(row.winnerName) ?? 0) + 1);
      const playerOfNight = [...winnerCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? null;
      const biggestWager = [...rows].sort((a, b) => b.stake - a.stake || a.id - b.id)[0] ?? null;
      const upset = rows.find(row => row.wasUpsetWin) ?? null;
      return {
        date, matchCount: rows.length, leagueTypes: [...new Set(rows.map(row => row.leagueType))], pointsMoved: rows.reduce((sum, row) => sum + row.stake, 0),
        playerOfNight: playerOfNight ? { name: playerOfNight[0], wins: playerOfNight[1] } : null,
        biggestWager: biggestWager ? { matchId: biggestWager.id, leagueType: biggestWager.leagueType, stake: biggestWager.stake, winnerName: biggestWager.winnerName, loserName: biggestWager.loserName } : null,
        upset: upset ? { matchId: upset.id, winnerName: upset.winnerName, loserName: upset.loserName } : null,
        matches: chronological,
      };
    });

    const singles = matches.filter(match => match.leagueType === "singles");
    const rivalryMap = new Map<string, { player1Id: number; player1Name: string; player2Id: number; player2Name: string; player1Wins: number; player2Wins: number; matches: typeof singles }>();
    for (const match of [...singles].reverse()) {
      const lowFirst = match.winnerId < match.loserId;
      const player1Id = lowFirst ? match.winnerId : match.loserId;
      const player2Id = lowFirst ? match.loserId : match.winnerId;
      const key = `${player1Id}:${player2Id}`;
      const item = rivalryMap.get(key) ?? { player1Id, player1Name: lowFirst ? match.winnerName : match.loserName, player2Id, player2Name: lowFirst ? match.loserName : match.winnerName, player1Wins: 0, player2Wins: 0, matches: [] };
      if (match.winnerId === player1Id) item.player1Wins++; else item.player2Wins++;
      item.matches.push(match); rivalryMap.set(key, item);
    }
    const rivalries = [...rivalryMap.values()].filter(item => item.matches.length >= 2)
      .sort((a, b) => b.matches.length - a.matches.length || Math.abs(a.player1Wins - a.player2Wins) - Math.abs(b.player1Wins - b.player2Wins))
      .slice(0, 20).map((item, index) => ({
        id: `${item.player1Id}-${item.player2Id}`, rank: index + 1, ...item,
        latestMatch: item.matches[item.matches.length - 1], totalStake: item.matches.reduce((sum, match) => sum + match.stake, 0),
        lead: item.player1Wins === item.player2Wins ? "Level" : `${item.player1Wins > item.player2Wins ? item.player1Name : item.player2Name} leads by ${Math.abs(item.player1Wins - item.player2Wins)}`,
      }));

    const standings = standingsResult.rows as any[];
    const stories = storyResult.rows as any[];
    const documentaries = (seasonsResult.rows as any[]).map(season => {
      const seasonMatches = matches.filter(match => match.seasonId === Number(season.id));
      const seasonStandings = standings.filter(row => Number(row.season_id) === Number(season.id)).map(row => ({
        playerId: Number(row.player_id), playerName: row.player_name, position: Number(row.position), wins: Number(row.wins), losses: Number(row.losses), points: Number(row.points), elo: Number(row.elo), isChampion: !!row.is_champion,
      }));
      const highlights = stories.filter(row => Number(row.season_id) === Number(season.id)).slice(0, 8).map(row => ({ storyType: row.story_type, label: titleCaseIdentifier(row.story_type), score: Number(row.score), sentiment: row.sentiment, facts: row.facts }));
      const biggestWager = [...seasonMatches].sort((a, b) => b.stake - a.stake || a.id - b.id)[0] ?? null;
      const wins = new Map<string, number>(); for (const match of seasonMatches) wins.set(match.winnerName, (wins.get(match.winnerName) ?? 0) + 1);
      const mostWins = [...wins].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? null;
      return {
        id: Number(season.id), name: season.name, leagueType: season.league_type, startDate: season.start_date, endDate: season.end_date,
        championId: season.champion_id === null ? null : Number(season.champion_id), championName: season.champion_name,
        matchCount: seasonMatches.length || Number(season.total_matches ?? 0), standings: seasonStandings, highlights,
        biggestWager: biggestWager ? { stake: biggestWager.stake, winnerName: biggestWager.winnerName, loserName: biggestWager.loserName } : null,
        mostWins: mostWins ? { name: mostWins[0], wins: mostWins[1] } : null,
      };
    });

    const rankingSource = (["singles", "doubles", "shift_wars"] as LeagueType[]).flatMap(leagueType => {
      const leagueMatches = matches.filter(match => match.leagueType === leagueType);
      const activeMatches = leagueMatches.filter(match => match.seasonActive === true);
      return activeMatches.length ? activeMatches : leagueMatches;
    });
    const powerRankings = {
      singles: buildPowerRankings(rankingSource, "singles"),
      doubles: buildPowerRankings(rankingSource, "doubles"),
      shift_wars: buildPowerRankings(rankingSource, "shift_wars"),
    };

    res.json({ matchNights, rivalries, documentaries, powerRankings });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 14.2 Admin endpoints
// ═══════════════════════════════════════════════════════════════════════

router.get("/admin/broadcast/status", requireAdminSession, async (_req, res): Promise<void> => {
  try {
    const [recentEditions, storyCountsRaw, currentSeasonStoriesRaw, currentPublished, config, ...predictorRows] = await Promise.all([
      db
        .select({
          id: broadcastEditionsTable.id, slotKey: broadcastEditionsTable.slotKey, slotType: broadcastEditionsTable.slotType,
          status: broadcastEditionsTable.status, changeScore: broadcastEditionsTable.changeScore,
          dataCutoff: broadcastEditionsTable.dataCutoff, publishedAt: broadcastEditionsTable.publishedAt,
          diagnostic: broadcastEditionsTable.diagnostic, createdAt: broadcastEditionsTable.createdAt,
          programme: broadcastEditionsTable.programme,
        })
        .from(broadcastEditionsTable)
        .orderBy(desc(broadcastEditionsTable.id))
        .limit(10),
      db.execute(sql`SELECT lifecycle, league_type, COUNT(*)::int AS count FROM broadcast_stories GROUP BY lifecycle, league_type ORDER BY league_type, lifecycle`),
      // Diagnostic-only, added mid-incident: storyCounts above is an
      // all-time aggregate and can't answer "does the CURRENT season have
      // any real coverage yet" — exactly the question a real report kept
      // coming back to ("nothing about September at all"). This joins each
      // league's currently active season straight to broadcast_stories so
      // that question has a direct, one-look answer instead of another
      // round of inference from match/changeScore counts. A season with a
      // LEFT JOIN row showing story_type: null truly has zero stories yet —
      // proof the detection/upsert side never produced anything for it, as
      // opposed to producing something the Director simply isn't airing.
      db.execute(sql`
        SELECT s.league_type, s.id AS season_id, s.name AS season_name, bs.story_type, bs.lifecycle, COUNT(*)::int AS count
        FROM seasons s
        LEFT JOIN broadcast_stories bs ON bs.season_id = s.id
        WHERE s.is_active = true
        GROUP BY s.league_type, s.id, s.name, bs.story_type, bs.lifecycle
        ORDER BY s.league_type, count DESC
      `),
      latestPublishedEdition(),
      getBroadcastConfig(),
      ...PREDICTOR_LEAGUE_TYPES.map(leagueType =>
        db
          .select({ generatedAt: broadcastPredictionSnapshotsTable.generatedAt, modelVersion: broadcastPredictionSnapshotsTable.modelVersion })
          .from(broadcastPredictionSnapshotsTable)
          .where(and(eq(broadcastPredictionSnapshotsTable.snapshotType, "TITLE"), eq(broadcastPredictionSnapshotsTable.leagueType, leagueType)))
          .orderBy(desc(broadcastPredictionSnapshotsTable.generatedAt))
          .limit(1),
      ),
    ]);

    const predictorDiagnostics = Object.fromEntries(
      PREDICTOR_LEAGUE_TYPES.map((leagueType, i) => {
        const [row] = predictorRows[i];
        return [leagueType, row ? { generatedAt: row.generatedAt.toISOString(), modelVersion: row.modelVersion } : null];
      }),
    );

    res.json({
      // Show Bible v1 §1 "Programme lengths" — diagnostic-only runtime band
      // (Quiet/Normal/Busy/Exceptional), never a publish gate (see director-
      // math.ts's own header on classifyEditionLength). null for any
      // Edition row with no real programme yet (SKIPPED/FAILED/BUILDING).
      recentEditions: recentEditions.map(e => {
        const runtimeSeconds = isEditionProgramme(e.programme) ? totalEstimatedSecondsForProgramme(e.programme) : null;
        return {
          id: e.id, slotKey: e.slotKey, slotType: e.slotType, status: e.status, changeScore: e.changeScore,
          dataCutoff: e.dataCutoff.toISOString(), publishedAt: e.publishedAt?.toISOString() ?? null,
          diagnostic: e.diagnostic, createdAt: e.createdAt.toISOString(),
          runtimeSeconds, runtimeBand: runtimeSeconds !== null ? classifyEditionLength(runtimeSeconds) : null,
        };
      }),
      currentPublished: currentPublished
        ? { id: currentPublished.id, slotKey: currentPublished.slotKey, changeScore: currentPublished.changeScore, publishedAt: currentPublished.publishedAt?.toISOString() ?? null }
        : null,
      storyCounts: (storyCountsRaw.rows as { lifecycle: string; league_type: string; count: number }[]).map(r => ({
        lifecycle: r.lifecycle, leagueType: r.league_type, count: r.count,
      })),
      // See this query's own comment above for why this exists.
      currentSeasonStories: (currentSeasonStoriesRaw.rows as { league_type: string; season_id: number; season_name: string; story_type: string | null; lifecycle: string | null; count: number }[]).map(r => ({
        leagueType: r.league_type, seasonId: r.season_id, seasonName: r.season_name,
        storyType: r.story_type, lifecycle: r.lifecycle, count: r.count,
      })),
      predictorDiagnostics,
      config,
      // Diagnostic-only: why did the Season Review find zero/thin real
      // content for a league's most recently closed season, when the story
      // pool clearly isn't empty — see diagnoseSeasonHighlights's own
      // header. null per league with no closed season at all yet.
      seasonReviewDiagnostics: await Promise.all(
        PREDICTOR_LEAGUE_TYPES.map(leagueType => diagnoseSeasonHighlights(leagueType)),
      ),
    });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

/**
 * Admin-only: clears broadcastReviewedAt on a league's most recently closed
 * season, so it's offered to the Season Review pipeline again on the next
 * build/regenerate — see resetSeasonReviewForLeague's own header for why
 * this exists (a thin Season Review can publish successfully and mark
 * itself "reviewed" before a since-fixed bug is corrected; without this,
 * fixing the bug alone wouldn't be enough to see it actually take effect).
 */
router.post("/admin/broadcast/season-review/reset", requireAdminSession, async (req, res): Promise<void> => {
  const leagueType = typeof req.body?.leagueType === "string" ? req.body.leagueType : "";
  if (!(PREDICTOR_LEAGUE_TYPES as readonly string[]).includes(leagueType)) {
    res.status(400).json({ error: `leagueType must be one of ${PREDICTOR_LEAGUE_TYPES.join(", ")}` });
    return;
  }
  try {
    const result = await resetSeasonReviewForLeague(leagueType as LeagueType);
    if (!result) {
      res.status(404).json({ error: `no closed season found for ${leagueType}` });
      return;
    }
    res.json({ ok: true, leagueType, ...result });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

router.post("/admin/broadcast/regenerate", requireAdminSession, async (_req, res): Promise<void> => {
  try {
    const result = await forceRebuildCurrentEdition();
    if (result.kind === "already_building") {
      res.status(409).json({ error: "This slot is already being built by another request — try again shortly" });
      return;
    }
    const attemptProgramme = isEditionProgramme(result.attempt.programme) ? result.attempt.programme : null;
    const attempt = {
      id: result.attempt.id,
      slotKey: result.attempt.slotKey,
      status: result.attempt.status,
      changeScore: result.attempt.changeScore,
      diagnostic: result.attempt.diagnostic,
      publishedAt: result.attempt.publishedAt?.toISOString() ?? null,
      mode: attemptProgramme ? programmeModeOf(attemptProgramme) : null,
      runtimeSeconds: attemptProgramme ? totalEstimatedSecondsForProgramme(attemptProgramme) : null,
      runtimeBand: attemptProgramme ? classifyEditionLength(totalEstimatedSecondsForProgramme(attemptProgramme)) : null,
    };
    if (result.attempt.status !== "PUBLISHED") {
      res.status(422).json({
        error: "The rebuild did not clear the quality gate. The previous published Edition remains live.",
        attempt,
        retainedEditionId: result.edition?.id ?? null,
      });
      return;
    }
    res.json({ edition: attempt });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

router.post("/admin/broadcast/episodes", requireAdminSession, async (_req, res): Promise<void> => {
  try {
    const result = await createManualBroadcastEpisode();
    const attemptProgramme = isEditionProgramme(result.attempt.programme) ? result.attempt.programme : null;
    const runtimeSeconds = attemptProgramme ? totalEstimatedSecondsForProgramme(attemptProgramme) : null;
    const attempt = {
      id: result.attempt.id,
      slotKey: result.attempt.slotKey,
      status: result.attempt.status,
      changeScore: result.attempt.changeScore,
      diagnostic: result.attempt.diagnostic,
      publishedAt: result.attempt.publishedAt?.toISOString() ?? null,
      mode: attemptProgramme ? programmeModeOf(attemptProgramme) : null,
      runtimeSeconds,
      runtimeBand: runtimeSeconds === null ? null : classifyEditionLength(runtimeSeconds),
    };

    if (result.attempt.status !== "PUBLISHED") {
      res.status(422).json({
        error: "The new episode did not clear the quality gate. The previous published Edition remains live.",
        attempt,
        retainedEditionId: result.edition?.id ?? null,
      });
      return;
    }

    res.status(201).json({ edition: attempt });
  } catch (err) {
    if (err instanceof AdminBuildLockedError) {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: errorMessage(err) });
  }
});

router.post("/admin/broadcast/clean-sweep", requireAdminSession, async (req, res): Promise<void> => {
  const startDate = typeof req.body?.startDate === "string" ? req.body.startDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    res.status(400).json({ error: "startDate must use YYYY-MM-DD" });
    return;
  }

  // Include the complete selected calendar day. The one-hour BST edge is
  // deliberately widened rather than risk missing a just-after-midnight match;
  // active-season filtering prevents this from pulling prior-season content.
  const start = new Date(`${startDate}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime())) {
    res.status(400).json({ error: "startDate is not a valid calendar date" });
    return;
  }
  start.setUTCHours(start.getUTCHours() - 1);

  try {
    const result = await createBroadcastCleanSweep(start);
    const attemptProgramme = isEditionProgramme(result.attempt.programme) ? result.attempt.programme : null;
    const runtimeSeconds = attemptProgramme ? totalEstimatedSecondsForProgramme(attemptProgramme) : null;
    const matchResults = attemptProgramme
      ? attemptProgramme.segments.filter(segment => segment.storyId !== null && segment.facts?.playedAt).length
      : 0;
    const editorialFeatures = attemptProgramme
      ? attemptProgramme.segments.filter(segment => typeof segment.facts?.featureTitle === "string").length
      : 0;
    const attempt = {
      id: result.attempt.id,
      slotKey: result.attempt.slotKey,
      status: result.attempt.status,
      diagnostic: result.attempt.diagnostic,
      publishedAt: result.attempt.publishedAt?.toISOString() ?? null,
      mode: attemptProgramme ? programmeModeOf(attemptProgramme) : null,
      runtimeSeconds,
      runtimeBand: runtimeSeconds === null ? null : classifyEditionLength(runtimeSeconds),
      matchResults,
      editorialFeatures,
      startDate,
    };
    if (result.attempt.status !== "PUBLISHED") {
      res.status(422).json({
        error: "The clean sweep did not clear the quality gate. The previous published Edition remains live.",
        attempt,
        retainedEditionId: result.edition?.id ?? null,
      });
      return;
    }
    res.status(201).json({ edition: attempt });
  } catch (err) {
    if (err instanceof AdminBuildLockedError) {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: errorMessage(err) });
  }
});

router.patch("/admin/broadcast/settings", requireAdminSession, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const knownKeys = new Set<string>(BROADCAST_SETTING_KEYS);
  const updates: Partial<Record<BroadcastSettingKey, string>> = {};
  const errors: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(body)) {
    if (!knownKeys.has(key)) { errors[key] = "not a recognised broadcast setting"; continue; }
    const value = String(rawValue);
    const validationError = validateBroadcastSettingValue(key as BroadcastSettingKey, value);
    if (validationError) { errors[key] = validationError; continue; }
    updates[key as BroadcastSettingKey] = value;
  }

  if (Object.keys(errors).length > 0) {
    res.status(400).json({ error: "one or more settings were invalid", details: errors });
    return;
  }
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no valid broadcast settings provided" });
    return;
  }

  try {
    await setBroadcastSettings(updates);
    res.json({ ok: true, config: await getBroadcastConfig() });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

export default router;
