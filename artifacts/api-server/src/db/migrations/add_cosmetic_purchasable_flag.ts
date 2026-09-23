import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Idempotent ALTER TABLE. Adds cosmetic_definitions.purchasable, defaulting
 * true so every existing cosmetic stays exactly as buyable as it already
 * was. Backs the new "Seasonal & Limited" cosmetic category — a row with
 * purchasable=false can only ever be granted by server-side code (see
 * schema/cosmetics.ts's header comment and services/cosmetics-service.ts's
 * "name-crowned" for the first example).
 */
export async function addCosmeticPurchasableFlag(): Promise<void> {
  try {
    await db.execute(sql`ALTER TABLE cosmetic_definitions ADD COLUMN IF NOT EXISTS purchasable BOOLEAN NOT NULL DEFAULT true`);
  } catch (err) {
    logger.error({ err }, "Failed to add purchasable flag to cosmetic_definitions");
  }
}
