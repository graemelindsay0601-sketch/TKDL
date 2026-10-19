import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../../career/database.ts";
import { constraintAlreadyAdmits } from "./career_constraint_guard.ts";

/**
 * Money matches at your club (one per opponent per week; the stake moves through the ledger) and the ledger
 * categories they and managers use. Runs on every startup (repairCareerSchema): every step checks first.
 */
export async function ensureMoneyMatches(tx: CareerExecutor): Promise<void> {
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_money_matches (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    season integer NOT NULL CHECK(season>0), week integer NOT NULL CHECK(week BETWEEN 1 AND 52),
    opponent_key text NOT NULL, stake_pence bigint NOT NULL CHECK(stake_pence>0),
    origin text NOT NULL CHECK(origin IN ('YOU_CHALLENGED','THEY_CHALLENGED')),
    status text NOT NULL CHECK(status IN ('PLAYED','DECLINED')),
    won boolean, legs_you integer, legs_them integer,
    detail jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(detail)='object'),
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id,id), UNIQUE(career_save_id,season,week,opponent_key))`);
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_money_match_sessions (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    season integer NOT NULL CHECK(season>0), week integer NOT NULL CHECK(week BETWEEN 1 AND 52),
    opponent_key text NOT NULL, opponent_name text NOT NULL, stake_pence bigint NOT NULL CHECK(stake_pence>0),
    origin text NOT NULL CHECK(origin IN ('YOU_CHALLENGED','THEY_CHALLENGED')),
    bot jsonb NOT NULL CHECK(jsonb_typeof(bot)='object'), bot_seed text NOT NULL,
    darts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(darts)='array'),
    status text NOT NULL CHECK(status IN ('LIVE','PLAYED')), won boolean,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id,id), UNIQUE(career_save_id,season,week,opponent_key))`);
  await tx.execute(sql`ALTER TABLE career_money_match_sessions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT NOW()`);
  // This week's haggling with each member: what was said, any figure they have put to you, and where it stands.
  await tx.execute(sql`CREATE TABLE IF NOT EXISTS career_money_talks (
    career_save_id uuid NOT NULL REFERENCES career_saves(id) ON DELETE CASCADE,
    season integer NOT NULL, week integer NOT NULL, opponent_key text NOT NULL,
    status text NOT NULL CHECK(status IN ('OPEN','AGREED','WALKED')),
    asks integer NOT NULL DEFAULT 0, their_offer_pence bigint, agreed_pence bigint,
    log jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(log)='array'),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    PRIMARY KEY(career_save_id,season,week,opponent_key))`);
  if (await constraintAlreadyAdmits(tx, "career_finance_entries_category_check", "MANAGER_COMMISSION")) return;
  await tx.execute(sql`ALTER TABLE career_finance_entries DROP CONSTRAINT IF EXISTS career_finance_entries_category_check`);
  await tx.execute(sql`ALTER TABLE career_finance_entries ADD CONSTRAINT career_finance_entries_category_check CHECK (
    category IN ('CAREER_START','ENTRY_FEE','TRAVEL','ACCOMMODATION','PRIZE','SPONSOR_SIGNING_BONUS','SPONSOR_GUARANTEED_PAYMENT','SPONSOR_EVENT_PAYMENT','SPONSOR_PERFORMANCE_BONUS','COMMERCIAL_APPEARANCE','MERCHANDISE_ROYALTY','SPONSOR_RELEASE_SETTLEMENT','MONEY_MATCH_WIN','MONEY_MATCH_STAKE','MANAGER_COMMISSION','REFUND','ADJUSTMENT')
    AND headline IN ('START','EARNINGS','SPONSOR','EXPENSE')
    AND (category <> 'CAREER_START' OR (headline = 'START' AND amount_pence >= 0))
    AND (category NOT IN ('ENTRY_FEE','TRAVEL','ACCOMMODATION','SPONSOR_RELEASE_SETTLEMENT','MONEY_MATCH_STAKE','MANAGER_COMMISSION') OR (headline = 'EXPENSE' AND amount_pence <= 0))
    AND (category NOT IN ('PRIZE','MONEY_MATCH_WIN') OR (headline = 'EARNINGS' AND amount_pence > 0))
    AND (category NOT IN ('SPONSOR_SIGNING_BONUS','SPONSOR_GUARANTEED_PAYMENT','SPONSOR_EVENT_PAYMENT','SPONSOR_PERFORMANCE_BONUS','COMMERCIAL_APPEARANCE','MERCHANDISE_ROYALTY') OR (headline = 'SPONSOR' AND amount_pence > 0))
    AND (category <> 'REFUND' OR (headline = 'EXPENSE' AND amount_pence > 0 AND reverses_entry_id IS NOT NULL))
    AND (category <> 'ADJUSTMENT' OR reverses_entry_id IS NOT NULL OR operation_key LIKE 'legacy:%' OR operation_key LIKE 'adjustment:%')
    AND sponsor_covered_pence >= 0 AND (gross_amount_pence IS NULL OR gross_amount_pence >= 0)
    AND (week IS NULL OR week BETWEEN 1 AND 52) AND (season IS NULL OR season > 0))`);
}
