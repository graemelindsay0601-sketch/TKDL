import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type NotificationType =
  | "post_approved"
  | "post_liked"
  | "post_commented"
  | "dm_received"
  | "auto_post_fired";

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
        ${opts.playerId},
        ${opts.type},
        ${opts.actorId ?? null},
        ${opts.entityId ?? null},
        ${opts.entityType ?? null},
        ${opts.message}
      )
    `);
  } catch { /* non-fatal — notifications must never crash the main flow */ }
}
