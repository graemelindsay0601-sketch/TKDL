import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../../lib/logger";

/**
 * Creates the audit ledger behind the Wallet's real transaction history (see
 * lib/db/src/schema/player-currency.ts's currencyTransactionsTable and
 * CURRENCY_REASONS). player_currency.card_points stays the authoritative
 * balance — this table only ever gets an additional row appended alongside
 * that same write, inside the same transaction, so a row here always
 * matches a real balance change and the two can never drift apart.
 */
export async function addCurrencyTransactionsTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS currency_transactions (
        id SERIAL PRIMARY KEY,
        player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        delta INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        reason TEXT NOT NULL,
        detail TEXT,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS currency_transactions_player_id_created_at_idx
      ON currency_transactions(player_id, created_at)
    `);
  } catch (err) {
    logger.error({ err }, "Failed to create currency_transactions table");
  }
}
