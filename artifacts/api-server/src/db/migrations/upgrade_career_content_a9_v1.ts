import {sql} from "drizzle-orm";
import type {CareerDatabase} from "../../career/database.ts";
import {createCareerSaves} from "./create_career_saves.ts";
import {createCareerWorld} from "./create_career_world.ts";
import {createCareerCalendar} from "./create_career_calendar.ts";
import {createCareerFinance} from "./create_career_finance.ts";
import {createCareerSporting} from "./create_career_sporting.ts";
import {createCareerGoals} from "./create_career_goals.ts";
import {createCareerLife} from "./create_career_life.ts";
import {createCareerLegacy} from "./create_career_legacy.ts";

// Never reuse the old A1/A2/A3/A4 migration keys for later content upgrades.
export const CAREER_CONTENT_UPGRADE_A9_V1="upgradeCareerContentA9V1";

/**
 * Reconcile the certified Career schema/catalogue on installations whose old
 * migration keys skipped the A8/A9 additions. Existing save versions, seeds
 * and generated worlds are not regenerated. Definition hash conflicts abort.
 *
 * All helpers and the completion marker share ONE transaction: their normal
 * nested transaction callbacks are deliberately bound to this same executor.
 */
export async function upgradeCareerContentA9V1(database:CareerDatabase):Promise<void> {
  await database.transaction(async tx=>{
    await tx.execute(sql`SET LOCAL lock_timeout='5s'`);
    await tx.execute(sql`SET LOCAL statement_timeout='30s'`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${CAREER_CONTENT_UPGRADE_A9_V1},0))`);
    await tx.execute(sql`CREATE TABLE IF NOT EXISTS app_schema_migrations(
      migration_key TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    const completed=await tx.execute(sql`SELECT 1 FROM app_schema_migrations WHERE migration_key=${CAREER_CONTENT_UPGRADE_A9_V1}`);
    if(completed.rows.length)return;

    const atomic:CareerDatabase={
      execute:query=>tx.execute(query),
      transaction:work=>work(tx),
    };
    for(const migrate of [createCareerSaves,createCareerWorld,createCareerCalendar,
      createCareerFinance,createCareerSporting,createCareerGoals,createCareerLife,createCareerLegacy]){
      await migrate(atomic);
    }
    // Do not invalidate historical keys or record success after a partial upgrade.
    await tx.execute(sql`INSERT INTO app_schema_migrations(migration_key)
      VALUES(${CAREER_CONTENT_UPGRADE_A9_V1}) ON CONFLICT(migration_key) DO NOTHING`);
  });
}
