/**
 * Notifications for League Target and The Gaffer. Only sent while the feature is live for everyone (the callers
 * check), at most a handful a month, and each one only ever once: createNotification re-sends the push when a
 * dedupe key already exists, so this checks the key first.
 */
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { createNotification } from "../services/notificationService";
import { logger } from "./logger";

export async function notifyOnce(playerId: number, dedupeKey: string, title: string, body: string, url = "/"): Promise<void> {
  try {
    const seen = await db.execute(sql`SELECT 1 FROM notifications WHERE dedupe_key = ${dedupeKey} LIMIT 1`);
    if (seen.rows.length) return;
    await createNotification({ playerId, type: "league_challenge", title, body, data: { url }, dedupeKey });
  } catch (err) {
    logger.error({ err, dedupeKey }, "League challenge notification failed");
  }
}

export async function notifyAll(ids: Iterable<number>, key: string, title: string, body: string, url = "/"): Promise<void> {
  for (const id of new Set(ids)) await notifyOnce(id, `${key}:${id}`, title, body, url);
}

/** One push per newly granted exclusive unlock. */
export async function notifyUnlocks(given: { playerId: number; cosmeticId: string }[], names: Record<string, string>, source: string): Promise<void> {
  for (const g of given) await notifyOnce(g.playerId, `unlock:${g.cosmeticId}:${g.playerId}`, "🔓 Exclusive unlock",
    `${names[g.cosmeticId] ?? "A new cosmetic"} — only from ${source}. Equip it in the Store.`, "/account?tab=cosmetics");
}

export const monthName = (key: string) => new Date(`${key}-01T12:00:00Z`).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
