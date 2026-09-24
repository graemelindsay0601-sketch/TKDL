import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

// Self-play unlocks: coin-purchasable extras scoped to solo/practice play
// only (extra Shadow Bot "Play a Pro" personas, bonus Coach's Corner
// drills) — never anything that touches real matchmaking, standings, or
// league play. Same two-table shape as the cosmetics system (see
// cosmetics.ts's cosmetic_definitions + player_cosmetics): a text-slug
// catalog + a per-player ownership join table, reused across every unlock
// type here instead of separate near-identical schemas per feature.
//
// category:
//  - "SHADOW_PERSONA" — unlocks one specific locked BOT_PERSONAS entry
//    (bot-engine.ts). id is "persona-<personaId>".
//  - "PERSONA_PREVIEW_PASS" — one catalog row. A cheaper, time-limited
//    unlock of every currently-locked persona at once (see durationDays
//    below), instead of buying each one permanently. Repurposes what was
//    originally scoped as "early bot-difficulty access" — that request's
//    literal premise didn't hold (every numeric Level Bot difficulty is
//    already fully open, so there's no existing pace to jump ahead of;
//    see LevelBotPicker in components/BotPickers.tsx) — this is the
//    closest real feature to it: a taste of the locked roster without
//    committing to a permanent per-persona purchase.
//  - "COACH_DRILL" — unlocks the bonus Coach's Corner training block(s)
//    (see generatePracticeRoutine() in routes/practice.ts). Deliberately
//    one bundle purchase rather than per-drill unlocks — there are only
//    ever a couple of bonus drills, and per-item pricing added complexity
//    with no real benefit at this scale.
export const SELF_PLAY_UNLOCK_CATEGORIES = ["SHADOW_PERSONA", "PERSONA_PREVIEW_PASS", "COACH_DRILL"] as const;
export type SelfPlayUnlockCategory = (typeof SELF_PLAY_UNLOCK_CATEGORIES)[number];

export const selfPlayUnlockDefinitionsTable = pgTable("self_play_unlock_definitions", {
  id: text("id").primaryKey(), // stable slug, e.g. "persona-luke_harbours"
  category: text("category").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  // Ownership rows for this definition expire after this many days instead
  // of lasting forever — used only by PERSONA_PREVIEW_PASS today. Null
  // (every other unlock) means permanent, same posture as every cosmetic.
  durationDays: integer("duration_days"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerSelfPlayUnlocksTable = pgTable("player_self_play_unlocks", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  unlockId: text("unlock_id").notNull().references(() => selfPlayUnlockDefinitionsTable.id),
  unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  // Set only for a PERSONA_PREVIEW_PASS row (unlockedAt + durationDays at
  // purchase time). Null for every permanent unlock. Whether a row is
  // still active is a read-time check (expiresAt IS NULL OR expiresAt >
  // now()) — nothing prunes expired rows, they just stop counting as owned.
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

export const insertSelfPlayUnlockDefinitionSchema = createInsertSchema(selfPlayUnlockDefinitionsTable).omit({
  createdAt: true,
});
export const insertPlayerSelfPlayUnlockSchema = createInsertSchema(playerSelfPlayUnlocksTable).omit({
  id: true,
  unlockedAt: true,
});

export type InsertSelfPlayUnlockDefinition = z.infer<typeof insertSelfPlayUnlockDefinitionSchema>;
export type SelfPlayUnlockDefinition = typeof selfPlayUnlockDefinitionsTable.$inferSelect;
export type InsertPlayerSelfPlayUnlock = z.infer<typeof insertPlayerSelfPlayUnlockSchema>;
export type PlayerSelfPlayUnlock = typeof playerSelfPlayUnlocksTable.$inferSelect;
