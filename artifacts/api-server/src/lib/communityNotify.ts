import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import webpush from "web-push";
import { logger } from "./logger";
import { getDefaultLeagueId } from "./currentLeague";
import { getSettingBool } from "./settingsService";

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL ?? "mailto:admin@tkdl.app";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export type NotificationType =
  | "post_approved"
  | "post_liked"
  | "post_commented"
  | "dm_received"
  | "auto_post_fired"
  | "match_result"
  | "achievement_unlocked";

// Which notification_preferences column gates each type, per-player,
// instead of the league-wide "notifications_enabled" switch below.
// dm_received moved first (see git history) because that switch defaults
// to false and is only reachable via a hidden admin debug route or the
// Feature Flags page — every one of these was being silently dropped for
// everyone, regardless of what a player actually wanted, not just DMs.
// post_approved/post_liked/post_commented/auto_post_fired share one
// "community_activity" toggle (mirrors match_results already covering
// singles/doubles/Shift Wars under one switch) since they're all the same
// kind of social ping; achievement_unlocked gets its own since unlocking
// something is a more personal moment than someone liking your post.
// match_result isn't listed — nothing calls createNotification with it;
// real match results go through notificationService.ts's own pipeline.
const TYPE_TO_PREF_COLUMN: Partial<Record<NotificationType, "direct_messages" | "achievements" | "community_activity">> = {
  dm_received:          "direct_messages",
  achievement_unlocked: "achievements",
  post_approved:        "community_activity",
  post_liked:            "community_activity",
  post_commented:        "community_activity",
  auto_post_fired:       "community_activity",
};

// ── Send a Web Push to all subscriptions for a player ────────────────────────
export async function sendPushToPlayer(
  playerId: number,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try {
    const rows = await db.execute(sql`
      SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE player_id = ${playerId}
    `);
    for (const row of rows.rows as any[]) {
      const sub = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      await webpush.sendNotification(sub, JSON.stringify({
        title: payload.title,
        body:  payload.body,
        icon:  "/icon-192.png",
        badge: "/icon-192.png",
        url:   payload.url ?? "/",
      })).catch(err => {
        // Subscription gone — clean it up
        if ((err as any)?.statusCode === 410) {
          void db.execute(sql`DELETE FROM push_subscriptions WHERE endpoint = ${row.endpoint}`);
        }
      });
    }
  } catch { /* non-fatal */ }
}

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
    const prefColumn = TYPE_TO_PREF_COLUMN[opts.type];
    if (prefColumn) {
      // Mirrors the push_enabled + per-type check notificationService.ts
      // already does for match results — see TYPE_TO_PREF_COLUMN above.
      const rows = await db.execute(sql`
        SELECT push_enabled, direct_messages, achievements, community_activity
        FROM notification_preferences WHERE player_id = ${opts.playerId}
      `);
      const prefs = rows.rows[0] as Record<string, boolean> | undefined;
      // No row yet (player never touched their settings) defaults to on,
      // matching notification_preferences' own column defaults.
      if (prefs && (prefs.push_enabled === false || prefs[prefColumn] === false)) return;
    } else {
      // No `req` reaches this deep — it's called from event handlers
      // (matches.ts, etc.) with just a playerId, not a request. Foundation
      // phase: resolve to the single default league (see lib/currentLeague.ts)
      // rather than a per-request one, matching the single-tenant reality
      // today; this is the one seam a real "notify across leagues" flow would
      // need to widen later.
      if (!(await getSettingBool(await getDefaultLeagueId(), "notifications_enabled"))) return;
    }
    await db.execute(sql`
      INSERT INTO notifications (player_id, type, actor_id, entity_id, entity_type, message)
      VALUES (
        ${opts.playerId}, ${opts.type},
        ${opts.actorId ?? null}, ${opts.entityId ?? null}, ${opts.entityType ?? null},
        ${opts.message}
      )
    `);
    void sendPushToPlayer(opts.playerId, { title: "TKDL 🎯", body: opts.message, url: "/notifications" });
  } catch { /* non-fatal — notifications must never crash the main flow */ }
}

// ── Create an auto community post (system-generated, auto-approved) ───────────
export async function createAutoPost(opts: {
  playerId: number;
  content: string;
  autoMeta: Record<string, unknown>;
  notifyPlayerIds?: number[];
}): Promise<void> {
  try {
    // Same no-`req` situation as createNotification above.
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

// ── VAPID public key for frontend subscription ────────────────────────────────
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC;
}
