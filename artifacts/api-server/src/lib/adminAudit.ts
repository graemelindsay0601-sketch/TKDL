/**
 * Admin audit log — a plain, append-only record of who did what through the
 * admin panel: match edits, standings edits, Elo overrides, player deletes,
 * season resets, and playoff results. None of these write paths left any
 * trace before this — a wrong click on "Delete Player" or a season reset
 * fired at the wrong moment was simply gone, with nothing to say it
 * happened, when, or what the values were before the change.
 *
 * Admin auth in this app is a single shared PIN (see
 * middleware/requireAdminSession.ts) rather than per-admin login, so this
 * can't attribute an action to a specific admin by identity — only to
 * whichever player, if any, happened to also be logged in as themselves in
 * the same browser session at the time (adminPlayerId, best-effort, often
 * null). What it does reliably give: a timestamped history of every
 * consequential admin action and the values involved, which is the part
 * that actually matters for "what happened to the league data and when."
 *
 * Logging is deliberately best-effort and never blocks or fails the admin
 * action itself — see logAdminAction's try/catch.
 */
import type { Request } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

export async function ensureAdminAuditTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id               SERIAL PRIMARY KEY,
      admin_player_id  INTEGER REFERENCES players(id) ON DELETE SET NULL,
      action           TEXT NOT NULL,
      entity_type      TEXT NOT NULL,
      entity_id        TEXT,
      details          JSONB,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  try {
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC)`);
  } catch (e) {
    logger.warn({ err: e }, "Could not create idx_admin_audit_log_created_at");
  }
}

export async function logAdminAction(
  req: Request,
  action: string,
  entityType: string,
  entityId: string | number | null,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    const adminPlayerId = (req.session as any)?.playerId ?? null;
    await db.execute(sql`
      INSERT INTO admin_audit_log (admin_player_id, action, entity_type, entity_id, details)
      VALUES (${adminPlayerId}, ${action}, ${entityType}, ${entityId != null ? String(entityId) : null}, ${details ? JSON.stringify(details) : null})
    `);
  } catch (err) {
    // Never let audit logging break the actual admin action it's recording.
    logger.error({ err, action, entityType, entityId }, "Failed to write admin audit log entry");
  }
}

export async function getRecentAdminActions(limit = 100): Promise<unknown[]> {
  const rows = await db.execute(sql`
    SELECT
      aal.id, aal.action, aal.entity_type, aal.entity_id, aal.details, aal.created_at,
      pl.name AS admin_player_name
    FROM admin_audit_log aal
    LEFT JOIN players pl ON pl.id = aal.admin_player_id
    ORDER BY aal.created_at DESC
    LIMIT ${limit}
  `);
  return rows.rows;
}
