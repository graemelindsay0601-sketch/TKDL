import { sql } from "drizzle-orm";
import { pgTable, uuid, text, integer, jsonb, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { careerSavesTable } from "./career-saves";

export const careerPersonalGoalsTable = pgTable("career_personal_goals", {
  id: uuid("id").primaryKey(),
  careerSaveId: uuid("career_save_id").notNull().references(()=>careerSavesTable.id,{onDelete:"cascade"}),
  requestKey: uuid("request_key").notNull(),
  definition: jsonb("definition").$type<Record<string,unknown>>().notNull(),
  targetKey: text("target_key").notNull(),
  baselineEvidence: text("baseline_evidence").array().notNull().default(sql`'{}'::text[]`),
  status: text("status").$type<"ACTIVE"|"COMPLETED"|"ABANDONED">().notNull().default("ACTIVE"),
  createdSeason: integer("created_season").notNull(),
  createdWeek: integer("created_week").notNull(),
  createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
  completedEvidence: jsonb("completed_evidence").$type<Record<string,unknown>>(),
  abandonedAt: timestamp("abandoned_at",{withTimezone:true}),
},t=>[
  uniqueIndex("career_goals_request_unique").on(t.careerSaveId,t.requestKey),
  uniqueIndex("career_goals_active_target_unique").on(t.careerSaveId,t.targetKey).where(sql`${t.status}='ACTIVE'`),
  index("career_goals_save_idx").on(t.careerSaveId,t.createdAt,t.id),
  check("career_goals_status_check",sql`${t.status} IN ('ACTIVE','COMPLETED','ABANDONED')`),
  check("career_goals_definition_check",sql`jsonb_typeof(${t.definition})='object'`),
  check("career_goals_season_check",sql`${t.createdSeason}>0`),
  check("career_goals_week_check",sql`${t.createdWeek} BETWEEN 1 AND 52`),
  check("career_goals_completion_check",sql`(${t.status}='COMPLETED')=(${t.completedEvidence} IS NOT NULL)`),
  check("career_goals_abandoned_check",sql`(${t.status}='ABANDONED')=(${t.abandonedAt} IS NOT NULL)`),
]);
