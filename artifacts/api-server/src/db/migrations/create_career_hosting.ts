import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";
import { constraintAlreadyAdmits } from "./career_constraint_guard.ts";

/** Ledger categories for running your own tournament, streaming, webcam leagues and Pro-Am nights. Every startup; checks first. */
export async function ensureHostingLedger(tx: CareerExecutor): Promise<void> {
  if (await constraintAlreadyAdmits(tx, "career_finance_entries_category_check", "PROAM_APPEARANCE")) return;
  await tx.execute(sql`ALTER TABLE career_finance_entries DROP CONSTRAINT IF EXISTS career_finance_entries_category_check`);
  await tx.execute(sql`ALTER TABLE career_finance_entries ADD CONSTRAINT career_finance_entries_category_check CHECK (
    category IN ('CAREER_START','ENTRY_FEE','TRAVEL','ACCOMMODATION','PRIZE','SPONSOR_SIGNING_BONUS','SPONSOR_GUARANTEED_PAYMENT','SPONSOR_EVENT_PAYMENT','SPONSOR_PERFORMANCE_BONUS','COMMERCIAL_APPEARANCE','MERCHANDISE_ROYALTY','SPONSOR_RELEASE_SETTLEMENT','MONEY_MATCH_WIN','MONEY_MATCH_STAKE','MANAGER_COMMISSION','HOSTING_COST','HOSTING_INCOME','STREAM_INCOME','CAM_LEAGUE_FEE','CAM_LEAGUE_PRIZE','PROAM_FEE','PROAM_WIN','PROAM_APPEARANCE','REFUND','ADJUSTMENT')
    AND headline IN ('START','EARNINGS','SPONSOR','EXPENSE')
    AND (category <> 'CAREER_START' OR (headline = 'START' AND amount_pence >= 0))
    AND (category NOT IN ('ENTRY_FEE','TRAVEL','ACCOMMODATION','SPONSOR_RELEASE_SETTLEMENT','MONEY_MATCH_STAKE','MANAGER_COMMISSION','HOSTING_COST','CAM_LEAGUE_FEE','PROAM_FEE') OR (headline = 'EXPENSE' AND amount_pence <= 0))
    AND (category NOT IN ('PRIZE','MONEY_MATCH_WIN','HOSTING_INCOME','STREAM_INCOME','CAM_LEAGUE_PRIZE','PROAM_WIN','PROAM_APPEARANCE') OR (headline = 'EARNINGS' AND amount_pence > 0))
    AND (category NOT IN ('SPONSOR_SIGNING_BONUS','SPONSOR_GUARANTEED_PAYMENT','SPONSOR_EVENT_PAYMENT','SPONSOR_PERFORMANCE_BONUS','COMMERCIAL_APPEARANCE','MERCHANDISE_ROYALTY') OR (headline = 'SPONSOR' AND amount_pence > 0))
    AND (category <> 'REFUND' OR (headline = 'EXPENSE' AND amount_pence > 0 AND reverses_entry_id IS NOT NULL))
    AND (category <> 'ADJUSTMENT' OR reverses_entry_id IS NOT NULL OR operation_key LIKE 'legacy:%' OR operation_key LIKE 'adjustment:%')
    AND sponsor_covered_pence >= 0 AND (gross_amount_pence IS NULL OR gross_amount_pence >= 0)
    AND (week IS NULL OR week BETWEEN 1 AND 52) AND (season IS NULL OR season > 0))`);
}
