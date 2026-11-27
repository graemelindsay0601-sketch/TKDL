import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

/**
 * Each player's preferred X01 scorer ("total" | "perdart" | "classic").
 * Additive and nullable: null means "not chosen yet" and the app uses its default.
 * Kept out of the Drizzle users schema on purpose so nothing that selects users
 * depends on this column existing.
 */
export async function addUsersScorerStyle(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS scorer_style TEXT`);
    logger.info("users.scorer_style ready");
  } catch (err) {
    logger.error({ err }, "Failed to add users.scorer_style");
  }
}
