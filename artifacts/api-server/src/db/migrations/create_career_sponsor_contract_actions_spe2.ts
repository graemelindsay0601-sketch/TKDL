import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../../career/database.ts";

/** Additive SP-E2 records. Existing signed contract snapshots are never rewritten. */
export async function createCareerSponsorContractActionsSPE2(database: CareerDatabase): Promise<void> {
  await database.transaction(async tx => {
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_compliance_notices (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        contract_id UUID NOT NULL,
        activity_id UUID NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('OPEN','ACKNOWLEDGED','RESOLVED')),
        notice_type TEXT NOT NULL CHECK (notice_type = 'MISSED_REQUIRED_ACTIVITY'),
        details JSONB NOT NULL CHECK (jsonb_typeof(details) = 'object'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id,id),
        UNIQUE (career_save_id,activity_id),
        FOREIGN KEY (career_save_id,contract_id) REFERENCES career_sponsor_contracts(career_save_id,id) ON DELETE CASCADE,
        FOREIGN KEY (career_save_id,activity_id) REFERENCES career_sponsor_commitments(career_save_id,id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS career_sponsor_release_cases (
        career_save_id UUID NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
        id UUID NOT NULL,
        contract_id UUID NOT NULL,
        operation_key TEXT NOT NULL CHECK (length(operation_key) BETWEEN 8 AND 180),
        release_type TEXT NOT NULL CHECK (release_type IN ('IMMEDIATE_NO_COST','MUTUAL','PRICED_BUYOUT')),
        status TEXT NOT NULL CHECK (status IN ('REQUESTED','OFFERED','ACCEPTED','DECLINED','CANCELLED')),
        amount_pence INTEGER NOT NULL DEFAULT 0 CHECK (amount_pence >= 0),
        sponsor_decision TEXT CHECK (sponsor_decision IN ('APPROVED','DECLINED')),
        terms_snapshot JSONB NOT NULL CHECK (jsonb_typeof(terms_snapshot) = 'object'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (career_save_id,id),
        UNIQUE (career_save_id,operation_key),
        FOREIGN KEY (career_save_id,contract_id) REFERENCES career_sponsor_contracts(career_save_id,id) ON DELETE CASCADE
      )
    `);
    await tx.execute(sql`CREATE INDEX IF NOT EXISTS career_sponsor_release_cases_contract_idx
      ON career_sponsor_release_cases(career_save_id,contract_id,created_at DESC)`);
    await tx.execute(sql`ALTER TABLE career_finance_entries DROP CONSTRAINT IF EXISTS career_finance_entries_category_check`);
    await tx.execute(sql`ALTER TABLE career_finance_entries ADD CONSTRAINT career_finance_entries_category_check CHECK (
      category IN ('CAREER_START','ENTRY_FEE','TRAVEL','ACCOMMODATION','PRIZE','SPONSOR_SIGNING_BONUS','SPONSOR_GUARANTEED_PAYMENT','SPONSOR_EVENT_PAYMENT','SPONSOR_PERFORMANCE_BONUS','COMMERCIAL_APPEARANCE','MERCHANDISE_ROYALTY','SPONSOR_RELEASE_SETTLEMENT','REFUND','ADJUSTMENT')
      AND headline IN ('START','EARNINGS','SPONSOR','EXPENSE')
      AND (category <> 'CAREER_START' OR (headline = 'START' AND amount_pence >= 0))
      AND (category NOT IN ('ENTRY_FEE','TRAVEL','ACCOMMODATION','SPONSOR_RELEASE_SETTLEMENT') OR (headline = 'EXPENSE' AND amount_pence <= 0))
      AND (category <> 'PRIZE' OR (headline = 'EARNINGS' AND amount_pence > 0))
      AND (category NOT IN ('SPONSOR_SIGNING_BONUS','SPONSOR_GUARANTEED_PAYMENT','SPONSOR_EVENT_PAYMENT','SPONSOR_PERFORMANCE_BONUS','COMMERCIAL_APPEARANCE','MERCHANDISE_ROYALTY') OR (headline = 'SPONSOR' AND amount_pence > 0))
      AND (category <> 'REFUND' OR (headline = 'EXPENSE' AND amount_pence > 0 AND reverses_entry_id IS NOT NULL))
      AND (category <> 'ADJUSTMENT' OR reverses_entry_id IS NOT NULL OR operation_key LIKE 'legacy:%' OR operation_key LIKE 'adjustment:%')
      AND sponsor_covered_pence >= 0 AND (gross_amount_pence IS NULL OR gross_amount_pence >= 0)
      AND (week IS NULL OR week BETWEEN 1 AND 52) AND (season IS NULL OR season > 0))`);
  });
}
