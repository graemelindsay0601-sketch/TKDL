import { Router, type Request, type Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db, broadcastEditionsTable, broadcastStoriesTable, broadcastPredictionSnapshotsTable,
  type LeagueType,
} from "@workspace/db";
import { getFeatureStatus, isFeatureAvailable, FEATURES } from "../services/feature-flags-service";
import { requireAdminSession } from "../middleware/requireAdminSession";
import { paramStr } from "../lib/http";
import {
  createManualBroadcastEpisode, ensureCurrentBroadcastEdition, forceRebuildCurrentEdition, latestPublishedEdition, isEditionProgramme,
} from "../broadcast/edition-engine";
import { getLivePayload } from "../broadcast/live-events";
import { diagnoseSeasonHighlights, resetSeasonReviewForLeague } from "../broadcast/story-engine";
import {
  getBroadcastConfig, setBroadcastSettings, BROADCAST_SETTING_KEYS, validateBroadcastSettingValue,
  type BroadcastSettingKey,
} from "../broadcast/config";
import { resolveNextLogicalSlot } from "../broadcast/edition-slots";
import { serializeSegment, editionTitle } from "../broadcast/api-shapes";
import {
  programmeSegmentId, programmeModeOf, totalEstimatedSecondsForProgramme, classifyEditionLength,
  type EditionProgramme,
} from "../broadcast/director-math";

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
 * req.user, which is never actually populated anywhere in this codebase
 * (see the now-dead isAdmin check in card-clash.ts's /feature-status route).
 */

const router = Router();

function sessionIsAdmin(req: Request): boolean {
  return (req.session as any)?.isAdmin === true;
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
