import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/**
 * SP-C extends A4's immutable ledger vocabulary and SP-B3's existing sponsor
 * timeline. It preserves every historical row and adds no parallel balance,
 * wallet, ledger, or payment backfill.
 */
export async function createCareerFinanceSPC(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`ALTER TABLE career_finance_entries
      DROP CONSTRAINT IF EXISTS career_finance_entries_category_check`);
    await tx.execute(sql`ALTER TABLE career_finance_entries
      ADD CONSTRAINT career_finance_entries_category_check CHECK (
        category IN ('CAREER_START','ENTRY_FEE','TRAVEL','ACCOMMODATION','PRIZE','SPONSOR_SIGNING_BONUS','SPONSOR_GUARANTEED_PAYMENT','SPONSOR_EVENT_PAYMENT','SPONSOR_PERFORMANCE_BONUS','COMMERCIAL_APPEARANCE','MERCHANDISE_ROYALTY','REFUND','ADJUSTMENT')
        AND headline IN ('START','EARNINGS','SPONSOR','EXPENSE')
        AND (category <> 'CAREER_START' OR (headline = 'START' AND amount_pence >= 0))
        AND (category NOT IN ('ENTRY_FEE','TRAVEL','ACCOMMODATION') OR (headline = 'EXPENSE' AND amount_pence <= 0))
        AND (category <> 'PRIZE' OR (headline = 'EARNINGS' AND amount_pence > 0))
        AND (category NOT IN ('SPONSOR_SIGNING_BONUS','SPONSOR_GUARANTEED_PAYMENT','SPONSOR_EVENT_PAYMENT','SPONSOR_PERFORMANCE_BONUS','COMMERCIAL_APPEARANCE','MERCHANDISE_ROYALTY') OR (headline = 'SPONSOR' AND amount_pence > 0))
        AND (category <> 'REFUND' OR (headline = 'EXPENSE' AND amount_pence > 0 AND reverses_entry_id IS NOT NULL))
        AND (category <> 'ADJUSTMENT' OR reverses_entry_id IS NOT NULL OR operation_key LIKE 'legacy:%' OR operation_key LIKE 'adjustment:%')
        AND sponsor_covered_pence >= 0 AND (gross_amount_pence IS NULL OR gross_amount_pence >= 0)
        AND (week IS NULL OR week BETWEEN 1 AND 52) AND (season IS NULL OR season > 0))`);

    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events
      DROP CONSTRAINT IF EXISTS career_sponsor_journey_events_event_type_check`);
    await tx.execute(sql`ALTER TABLE career_sponsor_journey_events
      ADD CONSTRAINT career_sponsor_journey_events_event_type_check CHECK (event_type IN (
        'INTEREST','APPROACH','OFFER_RECEIVED','PLAYER_COUNTERED','SPONSOR_COUNTERED',
        'SPONSOR_ACCEPTED_REQUEST','SPONSOR_REJECTED','SPONSOR_WITHDREW','PLAYER_DECLINED',
        'PLAYER_WALKED_AWAY','SIGNED','OFFER_EXPIRED','FINANCIAL_PAYMENT'
      ))`);
  });
}
