import {sql} from "drizzle-orm";
import {pgTable,uuid,integer,text,jsonb,timestamp,primaryKey,foreignKey,index,check} from "drizzle-orm/pg-core";
import {careerSavesTable} from "./career-saves";
import {careerWorldPlayersTable} from "./career-world";

/** Initialization marker prevents new worlds from re-rolling their sponsor content. */
export const careerSponsorWorldStateTable=pgTable("career_sponsor_world_state",{
  careerSaveId:uuid("career_save_id").notNull().primaryKey().references(()=>careerSavesTable.id,{onDelete:"cascade"}),
  contentVersion:integer("content_version").notNull(),
  generationVersion:integer("generation_version").notNull(),
  npcCount:integer("npc_count").notNull(),
  relationshipCount:integer("relationship_count").notNull(),
  initializedAt:timestamp("initialized_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  check("career_sponsor_world_state_content_version_check",sql`${t.contentVersion}>0`),
  check("career_sponsor_world_state_generation_version_check",sql`${t.generationVersion}>0`),
  check("career_sponsor_world_state_counts_check",sql`${t.npcCount}>=0 AND ${t.relationshipCount}>=0 AND ${t.relationshipCount}<=${t.npcCount}`),
]);

/** Immutable brand/representative snapshot and save-scoped NPC relationship history. */
export const careerNpcSponsorRelationshipsTable=pgTable("career_npc_sponsor_relationships",{
  careerSaveId:uuid("career_save_id").notNull(),
  id:uuid("id").notNull(),
  npcId:uuid("npc_id").notNull(),
  sponsorKey:text("sponsor_key").notNull(),
  category:text("category").notNull(),
  representativeId:text("representative_id"),
  status:text("status").notNull(),
  startSeason:integer("start_season").notNull(),
  startWeek:integer("start_week").notNull(),
  endSeason:integer("end_season"),
  endWeek:integer("end_week"),
  sponsorSnapshot:jsonb("sponsor_snapshot").notNull(),
  createdAt:timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
},t=>[
  primaryKey({columns:[t.careerSaveId,t.id]}),
  foreignKey({columns:[t.careerSaveId],foreignColumns:[careerSavesTable.id]}).onDelete("cascade"),
  foreignKey({columns:[t.careerSaveId,t.npcId],foreignColumns:[careerWorldPlayersTable.careerSaveId,careerWorldPlayersTable.id]}).onDelete("cascade"),
  check("career_npc_sponsor_relationships_category_check",sql`${t.category} IN ('MAIN_PARTNER','EQUIPMENT_PARTNER','TRAVEL_PARTNER','LOCAL_PARTNER','APPAREL_PARTNER','SECONDARY_PARTNER')`),
  check("career_npc_sponsor_relationships_status_check",sql`${t.status} IN ('ACTIVE','ENDED')`),
  check("career_npc_sponsor_relationships_period_check",sql`${t.startSeason}>0 AND ${t.startWeek} BETWEEN 1 AND 52
    AND ((${t.endSeason} IS NULL) = (${t.endWeek} IS NULL))
    AND (${t.endSeason} IS NULL OR ${t.endSeason}>0 AND ${t.endWeek} BETWEEN 1 AND 52)
    AND ((${t.status}='ACTIVE') = (${t.endSeason} IS NULL))
    AND (${t.endSeason} IS NULL OR ${t.endSeason}>${t.startSeason} OR (${t.endSeason}=${t.startSeason} AND ${t.endWeek}>=${t.startWeek}))`),
  check("career_npc_sponsor_relationships_snapshot_check",sql`jsonb_typeof(${t.sponsorSnapshot})='object'`),
  index("career_npc_sponsor_relationships_npc_idx").on(t.careerSaveId,t.npcId,t.status),
  index("career_npc_sponsor_relationships_sponsor_idx").on(t.careerSaveId,t.sponsorKey,t.startSeason,t.startWeek),
]);
