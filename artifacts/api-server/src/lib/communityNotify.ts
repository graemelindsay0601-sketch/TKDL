import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import webpush from "web-push";
import { logger } from "./logger";

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
    const rows = await db.execute(sql`SELECT value FROM settings WHERE key = 'notifications_enabled'`);
    if ((rows.rows[0] as any)?.value !== "true") return;
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
    const communityRows = await db.execute(sql`SELECT value FROM settings WHERE key = 'community_enabled'`);
    if ((communityRows.rows[0] as any)?.value !== "true") return;

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
