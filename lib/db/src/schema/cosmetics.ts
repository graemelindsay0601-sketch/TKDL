import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

// Six cosmetic slots today: a colour/gradient treatment for a player's
// displayed name (rendered wherever their name shows large — their own
// account page and their player-detail page, as seen by anyone else), the
// icon shown in the avatar square on their own account page, a background
// banner behind the account-page hero, a decorative border/glow frame
// around the avatar square, a highlight colour for a player's own row on
// the leaderboard, and an accent colour for a player's own practice-mode
// result screens. All six spend from the same shared coin balance
// (player_currency.card_points) that match wins, achievements etc. already
// earn app-wide — this is a new place to spend that balance, alongside the
// existing Card Clash pack shop, not a second currency.
//
// Deliberately NOT included: a purchasable "title" cosmetic — the
// leaderboard already has a separate EARNED active-title system
// (players.ts / identity.ts's computeIdentity(), rendered as entry.title
// under a player's name on leaderboard.tsx) and a purchasable one would
// occupy the exact same slot and compete with it. Same reasoning ruled out
// a purchasable "streak flair icon" — leaderboard.tsx already renders a
// flame + win count for any streak >= 3 (SeasonRow, ~line 194).
//
// BANNER and FRAME reuse the same color/gradient/glow columns NAME_STYLE
// already uses rather than adding new ones — a banner's "gradient" is its
// full CSS background-image, a frame's "color"/"glow" are its border and
// glow colour. GLOW reuses `color` for the leaderboard row highlight
// colour. RESULT_THEME reuses `color` for the practice/self-play result
// screen accent. See lib/cosmetics.ts's bannerCSS()/frameStyle()/
// glowRowStyle()/resultThemeColor().
//
// RESULT_THEME is deliberately Practice-only, not app-wide. Checked
// Master501 and Tour Mode's own result screens specifically: every accent
// colour on them (pages/master501.tsx's `phase === "result"` block —
// headline, stats strip, buttons) is `won ? "#22c55e" : "#ff005c"`, i.e.
// semantically tied to win/loss, not decorative. There's no separate
// neutral element on those screens a purchased theme could safely recolour
// without either overriding that win/loss signal or being confined to
// something as marginal as the shared full-screen ambient-blob background
// (used identically on many unrelated pages, not a per-result-screen
// surface). Practice's result screen (PracticeOverScreen in
// pages/practice.tsx) has no such constraint — its accent is a flat
// decorative purple with no other meaning — which is why it was the target
// for this cosmetic and Master501/Tour weren't extended to match it.
//
// Also considered and dropped: a "dartboard skin" cosmetic for
// components/dartboard-bg.tsx's SVG board. That component is never
// actually rendered anywhere in the app today (only its sibling
// `useDartHit` hook is imported, by lib/dartboard.tsx, for the dart-throw
// animation state — the visible scoring UI is DartInputBoard's numeric
// keypad, not this SVG) — so a skin for it would have no visible surface
// to appear on. Left alone rather than reskinning dead code.
//
// BUBBLE_COLOR reuses `color` for the background/border tint of a
// player's own outgoing chat bubbles in the account-page DMs (see
// account.tsx's message thread, threadMessages.map — only the `mine`
// bubble, never the other party's, so this only ever changes how a
// player's own sent messages look to them and to whoever they're
// messaging, the same low-stakes reach as a leaderboard row glow.
//
// `purchasable` (default true) backs the "Seasonal & Limited" idea without
// reaching for calendar-holiday theming the club never asked for: a
// cosmetic with purchasable=false can never be bought in the shop (see
// routes/cosmetics.ts's purchase route) — it can only be granted directly
// by server-side code. The one example today is "name-crowned" (see
// cosmetics-service.ts), auto-granted to whoever is crowned Singles
// champion at season close (lib/seasonReset.ts's performSeasonResetLocked)
// — a genuinely limited, achievement-locked cosmetic tied to the league's
// own real season data, not a purchasable stand-in for winning.
export const COSMETIC_CATEGORIES = ["NAME_STYLE", "PROFILE_ICON", "BANNER", "FRAME", "GLOW", "RESULT_THEME", "BUBBLE_COLOR"] as const;
export type CosmeticCategory = (typeof COSMETIC_CATEGORIES)[number];

export const cosmeticDefinitionsTable = pgTable("cosmetic_definitions", {
  id: text("id").primaryKey(), // stable slug, e.g. "name-inferno"
  category: text("category").notNull(), // NAME_STYLE | PROFILE_ICON | BANNER | FRAME | GLOW | RESULT_THEME
  name: text("name").notNull(),
  rarity: text("rarity").notNull().default("COMMON"), // COMMON, RARE, EPIC, LEGENDARY — same vocabulary as the titles system
  price: integer("price").notNull(),
  // NAME_STYLE / BANNER payload — a solid colour, or a CSS gradient string
  // (used for a gradient-text treatment on names, or a full background on
  // banners), plus an optional glow colour. FRAME reuses color for its
  // border colour and glow for its glow colour.
  color: text("color"),
  gradient: text("gradient"),
  glow: text("glow"),
  // PROFILE_ICON payload — a key into a small whitelisted lucide-icon map
  // on the frontend. Never raw markup or a URL from this table.
  iconKey: text("icon_key"),
  enabled: boolean("enabled").notNull().default(true),
  // false = never purchasable in the shop, only ever grantable by
  // server-side code (e.g. a season-champion award). See the header
  // comment above for the one cosmetic that uses this today.
  purchasable: boolean("purchasable").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const playerCosmeticsTable = pgTable("player_cosmetics", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id),
  cosmeticId: text("cosmetic_id").notNull().references(() => cosmeticDefinitionsTable.id),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCosmeticDefinitionSchema = createInsertSchema(cosmeticDefinitionsTable).omit({
  createdAt: true,
});
export const insertPlayerCosmeticSchema = createInsertSchema(playerCosmeticsTable).omit({
  id: true,
  purchasedAt: true,
});

export type InsertCosmeticDefinition = z.infer<typeof insertCosmeticDefinitionSchema>;
export type CosmeticDefinition = typeof cosmeticDefinitionsTable.$inferSelect;
export type InsertPlayerCosmetic = z.infer<typeof insertPlayerCosmeticSchema>;
export type PlayerCosmetic = typeof playerCosmeticsTable.$inferSelect;
