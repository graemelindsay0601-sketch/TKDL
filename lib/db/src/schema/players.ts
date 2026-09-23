import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  elo: integer("elo").notNull().default(1000),
  points: integer("points").notNull().default(25),
  peakPoints: integer("peak_points").notNull().default(25),
  seasonWins: integer("season_wins").notNull().default(0),
  seasonLosses: integer("season_losses").notNull().default(0),
  seasonGamesPlayed: integer("season_games_played").notNull().default(0),
  careerWins: integer("career_wins").notNull().default(0),
  careerLosses: integer("career_losses").notNull().default(0),
  careerGamesPlayed: integer("career_games_played").notNull().default(0),
  careerPoints: integer("career_points").notNull().default(0),
  careerPeakElo: integer("career_peak_elo").notNull().default(1000),
  currentWinStreak: integer("current_win_streak").notNull().default(0),
  longestWinStreak: integer("longest_win_streak").notNull().default(0),
  currentLossStreak: integer("current_loss_streak").notNull().default(0),
  longestLossStreak: integer("longest_loss_streak").notNull().default(0),
  // All-time high-water mark of "how far below my own in-season peak did I
  // ever fall" (peakPoints - points at the moment of a loss). points and
  // peakPoints both reset to 25 every season, so this is captured at the
  // moment it happens and kept forever -- it survives resets on purpose,
  // unlike the fields it's derived from.
  careerBiggestPointsFall: integer("career_biggest_points_fall").notNull().default(0),
  eliminationsCount: integer("eliminations_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  practiceEnabled:  boolean("practice_enabled").notNull().default(true),
  tourEnabled:      boolean("tour_enabled").notNull().default(true),
  m501Enabled:      boolean("m501_enabled").notNull().default(true),
  shadowBotEnabled: boolean("shadow_bot_enabled").notNull().default(true),
  lastFreePackClaimTime: timestamp("last_free_pack_claim_time", { withTimezone: true }),
  // Which broadcast_editions.id this player last opened /tkdl-live at —
  // compared against the latest PUBLISHED edition to drive the "new
  // edition" dot on the TKDL LIVE nav item. See
  // db/migrations/add_last_seen_broadcast_edition.ts for why there's no FK.
  lastSeenBroadcastEditionId: integer("last_seen_broadcast_edition_id"),
  // Equipped cosmetics (see schema/cosmetics.ts) — plain text references to
  // cosmetic_definitions.id, no DB foreign key (same reasoning as
  // lastSeenBroadcastEditionId just above: keeps this table's migration
  // independent of cosmetics' tables existing yet — equip's own route
  // already validates the id is real and owned before writing it here).
  // Null means "nothing equipped in that slot" — the existing default look.
  equippedNameStyleId: text("equipped_name_style_id"),
  equippedProfileIconId: text("equipped_profile_icon_id"),
  // Same no-FK reasoning as the two columns above — added for the
  // BANNER/FRAME cosmetic categories (see db/migrations/add_banner_frame_cosmetics.ts).
  equippedBannerId: text("equipped_banner_id"),
  equippedFrameId: text("equipped_frame_id"),
  // GLOW cosmetic category (see db/migrations/add_glow_cosmetic.ts) — a
  // highlight colour for this player's own leaderboard row.
  equippedGlowId: text("equipped_glow_id"),
  // RESULT_THEME cosmetic category (see db/migrations/add_result_theme_cosmetic.ts)
  // — an accent colour for this player's own practice-mode result screens.
  equippedResultThemeId: text("equipped_result_theme_id"),
  // BUBBLE_COLOR cosmetic category (see db/migrations/add_bubble_color_cosmetic.ts)
  // — a tint for this player's own outgoing chat bubbles in account-page DMs.
  equippedBubbleColorId: text("equipped_bubble_color_id"),
  // When this player last loaded the Hub — drives the "welcome back, last
  // visit X ago" freshness bar and the Pulse feed's "since your last visit"
  // divider (Hub rework). Same no-FK-needed shape as
  // lastSeenBroadcastEditionId above; unlike that field this isn't compared
  // against another table's id, just read/written directly by
  // GET /api/hub/visit/:playerId.
  lastSeenHubAt: timestamp("last_seen_hub_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
