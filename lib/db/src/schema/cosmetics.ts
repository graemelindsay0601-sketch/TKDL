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
// AVATAR_BADGE is a small decorative sticker icon pinned to the bottom-right
// corner of the avatar square — a third, independent visual layer alongside
// PROFILE_ICON (fills the square) and FRAME (borders it), so a player can
// stack all three. Reuses iconKey (its own separate whitelist — see
// AVATAR_BADGE_MAP in lib/cosmetics.ts, deliberately different glyphs from
// PROFILE_ICON_MAP so the two pickers don't feel redundant) and color for
// the badge's ring/background tint.
//
// LEADERBOARD_TAG is a small colour-coded flair chip shown next to a
// player's name on the leaderboard (Season + Career rows) — distinct from
// GLOW (recolours the whole row) and from the earned title system (a plain
// text line under the name): this is a short purchasable word/phrase in a
// fixed catalog (never free text, so nothing needs moderating), rendered as
// a compact pill. This is the one cosmetic slot that's actually visible to
// every other player scanning the leaderboard, not just to visitors of a
// single profile.
//
// TAGLINE_STYLE recolours a player's own tagline — a short free-text line
// (players.tagline, added alongside this wave) shown under their name on
// both their own account page and (new — see player-detail/index.tsx)
// their public profile. Reuses color/gradient/glow exactly like NAME_STYLE.
// The tagline's *content* is plain player-entered text (length-capped,
// same posture as community posts/DMs elsewhere in this app, which also
// accept free text with just a length cap) — never itself a cosmetic;
// TAGLINE_STYLE only ever controls how it's rendered.
//
// POST_ACCENT reuses `color` for a border/background tint on a player's own
// posts in the Community feed (see community.tsx's PostCard) — the feed
// already colour-codes pending/system-auto posts, this extends the same
// treatment to a purchasable personal accent on a player's own manual
// posts. Priced like GLOW/BUBBLE_COLOR — a flat colour swap.
//
// STICKER is different from every other category: it's not equipped to a
// slot, it's attached per-message when sending an account-page DM (see
// account.tsx's message composer and direct_messages.sticker_id). A player
// picks from their owned stickers per message, same as choosing to attach
// a photo. Its payload rides in `iconKey`, but unlike PROFILE_ICON/
// AVATAR_BADGE that key is the literal emoji character itself rather than
// a lookup into a lucide-icon map — plain unicode text, not markup or a
// URL, so it's exactly as safe to render directly as any other player-
// visible text in this table (a cosmetic's own `name`, for instance).
//
// CHECKOUT_EFFECT plays a short decorative particle-burst animation on a
// player's own Practice result screen, when they were the one who won (see
// practice.tsx's PracticeOverScreen and lib/cosmetics.ts's
// CHECKOUT_EFFECT_MAP). Deliberately Practice-only, same reasoning as
// RESULT_THEME above (Master501/Tour's result screens have no neutral
// decorative surface to add an effect to without competing with their
// win/loss-semantic colouring). Reuses `iconKey` as a whitelisted effect
// key (frontend picks the animation/emoji for it) and `color` for its tint.
//
// SCORER_THEME reuses `color` for an accent applied to the live scorer UI
// during a Practice-mode session — specifically the SectionCard wrapping
// the active visit/scoring surface in X01Scorer and CricketScorer (see
// lib/scorers.tsx), plus the Cricket title. Deliberately threaded through
// only from pages/practice.tsx's <GameScorer scorerThemeColor=.../> — every
// other caller of GameScorer (real league matches, Boss Battle, Board
// Curse, Shadow Bot, Card Clash matches) simply never passes a value, so
// this can only ever appear during an actual Practice session, same
// Practice-only reasoning as RESULT_THEME/CHECKOUT_EFFECT above. Narrower
// than "every self-play surface" on purpose — soloMode isn't reliably
// wired through GameScorer for every engine (Cricket's case doesn't thread
// it at all, a pre-existing gap this cosmetic doesn't attempt to fix), so
// gating on an explicit prop only the one confirmed-safe caller supplies is
// simpler and safer than trying to infer solo-vs-real from soloMode
// everywhere.
//
// PLAYER_CARD_FINISH is a texture/shimmer overlay layered on top of the
// "CINEMATIC HERO" block on a player's own player-detail page (see
// player-detail/index.tsx, ~line 344) — the closest real analog to a
// "player card" this app has (there's no separate mini stat-card component;
// TKDLCard.tsx is Card Clash's own game-card renderer, a different feature
// entirely and off-limits while Card Clash is paused). Deliberately
// independent of BANNER, which already colours that same hero block's
// background — this adds a finish (matte grain / foil shimmer / holo
// gradient sweep) as a separate overlay layer on top, so the two combine
// rather than compete. Reuses `iconKey` as a whitelisted finish key (see
// PLAYER_CARD_FINISH_MAP in lib/cosmetics.ts) and `color` for its tint.
//
// TROPHY_CASE_STYLE reuses color for a background/border/glow skin on the
// pinned "Trophy Case" strip (the up-to-5 pinned achievements shown on a
// player's own account page and their public player-detail page) — see the
// new shared <TrophyCase> component in components/TrophyCase.tsx and
// lib/cosmetics.ts's trophyCaseStyle(). Named deliberately narrow (not just
// "SHOWCASE") because PERSONALIZATION_IDEAS.md already uses "Trophy Case &
// Showcase" as the name for a broader profile-curation feature area (trophy
// shelf + stat spotlight + season recap + milestone plaques) that this one
// purchasable skin is only a small piece of — reusing that name for the
// category risked exactly the ambiguity that doc flagged. Falls back to the
// strip's existing gold/pink gradient when nothing's equipped, unchanged.
//
// RECAP_STYLE reuses color/gradient for a background skin on a player's own
// Season Recap Card — a shareable-looking summary of one of their own
// completed seasons (final position, win-loss record, points, ELO, and a
// couple of computed highlights: longest win streak and biggest single win
// within that season), browsable per-season from the player-detail page's
// existing Season History section. Deliberately named "RECAP_STYLE" not
// "SEASON_RECAP" — the recap itself (which stats it shows, which seasons
// exist) isn't a cosmetic, only this background skin is; see
// components/SeasonRecapCard.tsx and routes/players.ts's
// GET /players/:id/seasons/:seasonId/recap. Also distinct from the
// unrelated broadcast "Season Review" special (seasons.broadcastReviewedAt)
// — that's a TKDL LIVE league-wide feature, this is a per-player personal
// card, different surface and audience entirely.
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
export const COSMETIC_CATEGORIES = ["NAME_STYLE", "PROFILE_ICON", "BANNER", "FRAME", "GLOW", "RESULT_THEME", "BUBBLE_COLOR", "AVATAR_BADGE", "LEADERBOARD_TAG", "TAGLINE_STYLE", "POST_ACCENT", "STICKER", "CHECKOUT_EFFECT", "SCORER_THEME", "PLAYER_CARD_FINISH", "TROPHY_CASE_STYLE", "RECAP_STYLE"] as const;
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
