import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const playerCurrencyTable = pgTable("player_currency", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().unique().references(() => playersTable.id),
  cardPoints: integer("card_points").notNull().default(0), // Card Clash coins (currency for shop)
  lifetimeCoinsEarned: integer("lifetime_coins_earned").notNull().default(0),
  packTokens: integer("pack_tokens").notNull().default(0), // Legacy column (not currently used)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlayerCurrencySchema = createInsertSchema(playerCurrencyTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPlayerCurrency = z.infer<typeof insertPlayerCurrencySchema>;
export type PlayerCurrency = typeof playerCurrencyTable.$inferSelect;

// Every code path that changes player_currency.card_points (see
// db/migrations/add_currency_transactions_table.ts) tags itself with one of
// these — the shared "why" vocabulary shown in the Wallet's real
// transaction history (account.tsx) instead of a raw string anyone could
// misspell into a new, silently-uncategorized bucket.
export const CURRENCY_REASONS = [
  "match_win",              // Practice / Tour / Master 501 flat win bonus, and the League match flat win/loss bonus
  "card_clash_match",       // Card Clash match win/loss payout
  "card_clash_card_bonus",  // League match Card Clash card-usage bonus
  "achievement",            // Any achievement unlock, any game mode
  "daily_login",            // Card Clash daily login streak reward
  "season_reward",          // Card Clash season-end rank reward
  "challenge",              // Daily/weekly challenge completion
  "quest",                  // Seasonal quest completion
  "card_sell",              // Selling a duplicate card
  "cosmetic_purchase",      // Cosmetics shop purchase
  "card_pack_purchase",     // Card Clash pack purchase (shop or pre-owned-pack redemption)
  "pack_redeem_credit",     // Paired with card_pack_purchase — crediting a pre-owned pack's cost right before spending it to open it
  "featured_card_purchase", // Featured card shop purchase
  "admin_grant",            // Admin "give coins"
  "admin_removal",          // Admin "remove coins"
  "admin_reset",            // Admin "reset player card data" (full wipe)
  "community_top_post",     // Off the Oche weekly Top of the Board coin reward
  "self_play_unlock",       // Self-play unlocks shop: extra Shadow Bot personas, preview pass, Coach's Corner bonus drills
] as const;
export type CurrencyReason = (typeof CURRENCY_REASONS)[number];

// An audit ledger, not a second source of truth — player_currency.card_points
// stays authoritative and every writer updates it directly; this table only
// ever gets an additional row appended alongside that same write, inside the
// same transaction, so the two can never drift. delta is signed (positive =
// credit, negative = debit) and balanceAfter is the resulting balance at the
// moment of that transaction, so the Wallet's history reads directly off
// this table without recomputing a running total.
export const currencyTransactionsTable = pgTable("currency_transactions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  reason: text("reason").notNull(), // one of CURRENCY_REASONS
  detail: text("detail"), // optional human-readable extra context (a cosmetic's name, a challenge's title, ...)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("currency_transactions_player_id_created_at_idx").on(t.playerId, t.createdAt),
]);

export type CurrencyTransaction = typeof currencyTransactionsTable.$inferSelect;
