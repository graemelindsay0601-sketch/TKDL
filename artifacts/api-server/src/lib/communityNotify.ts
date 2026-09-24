import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";
import { getDefaultLeagueId } from "./currentLeague";
import { getSettingBool } from "./settingsService";
import { createNotification as createCanonicalNotification } from "../services/notificationService";

// This file used to run its OWN parallel notification pipeline — a second
// createNotification() with a different notifications-table column shape
// (actor_id/entity_id/entity_type/message instead of title/body/data), its
// own push-send implementation (sendPushToPlayer, duplicating
// notificationService.ts's sendPushNotification down to the 410-cleanup
// logic), and its own preferences lookup (a second TYPE_TO_PREF_COLUMN map).
// Two systems that happened to share one table, not one system — which is
// exactly the kind of thing that produces bugs nobody can fully explain:
// a stale "Rank Changes (Singles)" label, a notifications table stitched
// together from two shapes via COALESCE, /admin/test-comms writing raw rows
// that skip both real pipelines entirely.
//
// createNotification below is now a thin adapter: it keeps this file's old
// call signature (so the 8 call sites across achievement-grant.ts,
// shadow-bot-achievements.ts, community.ts, and messages.ts don't need to
// change) but forwards to notificationService.ts's real createNotification,
// which does the one real insert, the one real preference check, and the
// one real push send. sendPushToPlayer and getVapidPublicKey are gone —
// nothing outside this file ever called either of them, and the push send
// they existed for is now handled centrally.

export type NotificationType =
  | "post_approved"
  | "post_liked"
  | "post_commented"
  | "dm_received"
  | "auto_post_fired"
  | "match_result"
  | "achievement_unlocked"
  | "post_mentioned"
  | "top_post_reward";

// A short, generic title per type — the old pipeline never had a title at
// all (message-only), so this is new, not a behavior change to preserve.
const TITLE_BY_TYPE: Record<NotificationType, string> = {
  dm_received:          "New Message",
  achievement_unlocked: "Achievement Unlocked!",
  post_approved:        "Post Approved",
  post_liked:            "New Like",
  post_commented:        "New Comment",
  auto_post_fired:       "Community Update",
  match_result:          "Match Result", // dead in practice — nothing calls createNotification with this type; real match results go through notificationService.ts's own sendMatchResultNotification family.
  post_mentioned:        "You Were Mentioned",
  top_post_reward:       "Top of the Board!",
};

// ── Create an in-app notification + fire push ────────────────────────────────
export async function createNotification(opts: {
  playerId: number;
  type: NotificationType;
  actorId?: number | null;
  entityId?: number | null;
  entityType?: string | null;
  message: string;
}): Promise<void> {
  try {
    await createCanonicalNotification({
      playerId:   opts.playerId,
      type:       opts.type,
      title:      TITLE_BY_TYPE[opts.type] ?? "TKDL",
      body:       opts.message,
      actorId:    opts.actorId ?? null,
      entityId:   opts.entityId ?? null,
      entityType: opts.entityType ?? null,
    });
  } catch (err) {
    // Non-fatal — notifications must never crash the main flow. Matches
    // this function's own previous behavior.
    logger.warn({ err, type: opts.type, playerId: opts.playerId }, "communityNotify.createNotification failed (non-fatal)");
  }
}

// ── Create an auto community post (system-generated, auto-approved) ───────────
export async function createAutoPost(opts: {
  playerId: number;
  content: string;
  autoMeta: Record<string, unknown>;
  notifyPlayerIds?: number[];
}): Promise<void> {
  try {
    // No `req` reaches this deep — it's called from event handlers
    // (matches.ts, doubles.ts, shift-wars.ts, team-matches.ts), not a
    // request. Foundation phase: resolve to the single default league (see
    // lib/currentLeague.ts) rather than a per-request one, matching the
    // single-tenant reality today.
    if (!(await getSettingBool(await getDefaultLeagueId(), "community_enabled"))) return;

    const result = await db.execute(sql`
      INSERT INTO community_posts (player_id, content, post_type, auto_meta, status)
      VALUES (${opts.playerId}, ${opts.content}, 'auto', ${JSON.stringify(opts.autoMeta)}, 'approved')
      RETURNING id
    `);
    const postId = (result.rows[0] as any)?.id as number | undefined;
    if (!postId) return;

    for (const pid of (opts.notifyPlayerIds ?? [])) {
      void createNotification({
        playerId:   pid,
        type:       "auto_post_fired",
        entityId:   postId,
        entityType: "post",
        message:    opts.content.slice(0, 120),
      });
    }
  } catch (err) {
    logger.warn({ err }, "createAutoPost failed (non-fatal)");
  }
}
