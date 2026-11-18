import { sql } from "drizzle-orm";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { careerIdSchema } from "../validation.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { MONEY_FORMATS, type MoneyGameFormat } from "../money/service.ts";
import type { X01Format } from "../../shared/darts-rules/x01.ts";
import { dartStats, type StoredMatch } from "./darts.ts";

/** Every match you threw yourself in this Career (tournament matches on the scorer and money matches), with its season. */
async function storedMatches(tx: CareerExecutor, saveId: string): Promise<(StoredMatch & { season: number })[]> {
  const live = (await tx.execute(sql`SELECT s.format, s.first_thrower, s.darts, i.season FROM career_match_sessions s
      JOIN career_event_instances i ON i.career_save_id = s.career_save_id AND i.id = s.event_id
    WHERE s.career_save_id = ${saveId} AND s.status = 'COMPLETED' AND s.team IS NULL AND s.first_thrower IS NOT NULL`)).rows
    .map(r => ({ format: r.format as X01Format, firstThrower: Number(r.first_thrower) as 0 | 1, darts: r.darts as unknown[], season: Number(r.season), source: "TOURNAMENT" as const }));
  const hasMoney = (await tx.execute(sql`SELECT to_regclass('career_money_match_sessions') IS NOT NULL AS ok`)).rows[0]?.ok === true;
  const money = !hasMoney ? [] : (await tx.execute(sql`SELECT game_format, darts, season FROM career_money_match_sessions
    WHERE career_save_id = ${saveId} AND status = 'PLAYED'`)).rows
    .flatMap(r => { const format = MONEY_FORMATS[String(r.game_format ?? "501") as MoneyGameFormat];
      return format ? [{ format, firstThrower: 0 as const, darts: r.darts as unknown[], season: Number(r.season), source: "MONEY_MATCH" as const }] : []; });
  return [...live, ...money];
}

export function createCareerStatsService(database: CareerDatabase) {
  return {
    /** Your dart-by-dart statistics: this season and the whole Career. */
    async read(actor: CareerActor, saveId: string) {
      careerIdSchema.parse(saveId);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false);
        const season = Number(root.current_season), matches = await storedMatches(tx, saveId);
        return { season, thisSeason: dartStats(matches.filter(m => m.season === season)), career: dartStats(matches) };
      });
    },
  };
}
