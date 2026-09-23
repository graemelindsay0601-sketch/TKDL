import { db } from "@workspace/db";
import { cosmeticDefinitionsTable, type CosmeticCategory } from "@workspace/db";
import { logger } from "../lib/logger";

interface SeedCosmetic {
  id: string;
  category: CosmeticCategory;
  name: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  price: number;
  color?: string;
  gradient?: string;
  glow?: string;
  iconKey?: string;
  sortOrder: number;
  // false = never buyable in the shop, only grantable by server-side code.
  // Omitted (undefined) means true, same as every existing cosmetic.
  purchasable?: boolean;
}

// Priced above single/five-pack card coins (50/200) since these are a
// permanent, repeatable-use cosmetic rather than a one-shot consumable —
// roughly the ten-pack price (350) through to a real "saved up for it"
// legendary at 1000. Colours reuse this session's own NAV_SECTIONS brand
// palette (layout.tsx) so anything a player equips still feels native to
// the app rather than an arbitrary swatch.
const NAME_STYLES: SeedCosmetic[] = [
  { id: "name-ice",       category: "NAME_STYLE", name: "Ice",             rarity: "COMMON",    price: 150,  color: "#38bdf8", sortOrder: 0 },
  { id: "name-ember",     category: "NAME_STYLE", name: "Ember",           rarity: "COMMON",    price: 150,  color: "#ff8c00", sortOrder: 1 },
  { id: "name-venom",     category: "NAME_STYLE", name: "Venom",           rarity: "COMMON",    price: 150,  color: "#22c55e", sortOrder: 2 },
  { id: "name-sunset",    category: "NAME_STYLE", name: "Sunset",          rarity: "RARE",      price: 350,  gradient: "linear-gradient(90deg,#ff005c,#ffd24a)", sortOrder: 3 },
  { id: "name-deepspace", category: "NAME_STYLE", name: "Deep Space",      rarity: "RARE",      price: 350,  gradient: "linear-gradient(90deg,#6366f1,#0066ff)", sortOrder: 4 },
  { id: "name-inferno",   category: "NAME_STYLE", name: "Inferno",         rarity: "EPIC",      price: 600,  gradient: "linear-gradient(90deg,#ff005c,#ff8c00,#ffd24a,#ff8c00,#ff005c)", glow: "#ff005c", sortOrder: 5 },
  { id: "name-frostbite", category: "NAME_STYLE", name: "Frostbite",       rarity: "EPIC",      price: 600,  gradient: "linear-gradient(90deg,#00e5ff,#38bdf8,#a78bfa,#38bdf8,#00e5ff)", glow: "#00e5ff", sortOrder: 6 },
  { id: "name-champion",  category: "NAME_STYLE", name: "Champion's Gold", rarity: "LEGENDARY", price: 1000, gradient: "linear-gradient(90deg,#ffd24a,#fff7d6,#ffd24a,#fff7d6)", glow: "#ffd24a", sortOrder: 7 },
  { id: "name-prismatic", category: "NAME_STYLE", name: "Prismatic",       rarity: "LEGENDARY", price: 1000, gradient: "linear-gradient(90deg,#ff005c,#ffd24a,#22c55e,#38bdf8,#a78bfa,#ff005c)", glow: "#ffffff", sortOrder: 8 },
  { id: "name-magenta",  category: "NAME_STYLE", name: "Magenta",         rarity: "COMMON",    price: 150,  color: "#ec4899", sortOrder: 10 },
  { id: "name-slate",    category: "NAME_STYLE", name: "Slate",           rarity: "COMMON",    price: 150,  color: "#64748b", sortOrder: 11 },
  { id: "name-cyanwave", category: "NAME_STYLE", name: "Cyan Wave",       rarity: "RARE",      price: 350,  gradient: "linear-gradient(90deg,#06b6d4,#38bdf8)", sortOrder: 12 },
  { id: "name-bloodmoon", category: "NAME_STYLE", name: "Blood Moon",     rarity: "EPIC",      price: 600,  gradient: "linear-gradient(90deg,#7f1d1d,#ff005c,#7f1d1d)", glow: "#ff005c", sortOrder: 13 },
  { id: "name-voidwalker", category: "NAME_STYLE", name: "Voidwalker",    rarity: "LEGENDARY", price: 1000, gradient: "linear-gradient(90deg,#0a0a12,#6366f1,#0a0a12,#a855f7)", glow: "#6366f1", sortOrder: 14 },
];

// iconKey values are looked up against a small whitelisted map on the
// frontend (lib/cosmetics.ts's PROFILE_ICON_MAP) — adding a new one here
// means adding it to that map too, deliberately, rather than this table
// ever driving an arbitrary icon/URL straight into the page.
const PROFILE_ICONS: SeedCosmetic[] = [
  { id: "icon-flame",  category: "PROFILE_ICON", name: "Flame",   rarity: "COMMON",    price: 150,  iconKey: "flame",  sortOrder: 0 },
  { id: "icon-bolt",   category: "PROFILE_ICON", name: "Bolt",    rarity: "COMMON",    price: 150,  iconKey: "zap",    sortOrder: 1 },
  { id: "icon-skull",  category: "PROFILE_ICON", name: "Skull",   rarity: "RARE",      price: 350,  iconKey: "skull",  sortOrder: 2 },
  { id: "icon-crown",  category: "PROFILE_ICON", name: "Crown",   rarity: "RARE",      price: 350,  iconKey: "crown",  sortOrder: 3 },
  { id: "icon-trophy", category: "PROFILE_ICON", name: "Trophy",  rarity: "EPIC",      price: 600,  iconKey: "trophy", sortOrder: 4 },
  { id: "icon-rocket", category: "PROFILE_ICON", name: "Rocket",  rarity: "EPIC",      price: 600,  iconKey: "rocket", sortOrder: 5 },
  { id: "icon-ghost",  category: "PROFILE_ICON", name: "Ghost",   rarity: "LEGENDARY", price: 1000, iconKey: "ghost",  sortOrder: 6 },
  { id: "icon-gem",    category: "PROFILE_ICON", name: "Diamond", rarity: "LEGENDARY", price: 1000, iconKey: "gem",    sortOrder: 7 },
  { id: "icon-star",   category: "PROFILE_ICON", name: "Star",    rarity: "COMMON",    price: 150,  iconKey: "star",   sortOrder: 8 },
  { id: "icon-shield", category: "PROFILE_ICON", name: "Shield",  rarity: "RARE",      price: 350,  iconKey: "shield", sortOrder: 9 },
  { id: "icon-swords", category: "PROFILE_ICON", name: "Crossed Swords", rarity: "EPIC", price: 600, iconKey: "swords", sortOrder: 10 },
  { id: "icon-target", category: "PROFILE_ICON", name: "Bullseye",       rarity: "COMMON",    price: 150,  iconKey: "target",   sortOrder: 11 },
  { id: "icon-beer",   category: "PROFILE_ICON", name: "Pint",           rarity: "COMMON",    price: 150,  iconKey: "beer",     sortOrder: 12 },
  { id: "icon-award",  category: "PROFILE_ICON", name: "Award Ribbon",   rarity: "RARE",      price: 350,  iconKey: "award",    sortOrder: 13 },
  { id: "icon-sparkles", category: "PROFILE_ICON", name: "Sparkles",     rarity: "EPIC",      price: 600,  iconKey: "sparkles", sortOrder: 14 },
  { id: "icon-anchor", category: "PROFILE_ICON", name: "Anchor",         rarity: "LEGENDARY", price: 1000, iconKey: "anchor",   sortOrder: 15 },
];

// BANNER payload rides in `gradient` — a full CSS background-image string
// applied behind the account-page hero (see account.tsx's equippedBanner).
const BANNERS: SeedCosmetic[] = [
  { id: "banner-skyline",    category: "BANNER", name: "Kilbirnie Skyline",   rarity: "COMMON",    price: 150,  gradient: "linear-gradient(135deg,#1a2a3d 0%,#0e1420 55%,rgba(255,0,92,0.13) 100%)", sortOrder: 0 },
  { id: "banner-chalkboard", category: "BANNER", name: "Chalkboard Pub",      rarity: "COMMON",    price: 150,  gradient: "repeating-linear-gradient(45deg,#241a10,#241a10 8px,#1a120a 8px,#1a120a 16px)", sortOrder: 1 },
  { id: "banner-fireworks",  category: "BANNER", name: "Checkout Fireworks",  rarity: "RARE",      price: 350,  gradient: "radial-gradient(circle at 30% 30%,rgba(255,210,74,0.22),#0a0a12 65%)", sortOrder: 2 },
  { id: "banner-carbon",     category: "BANNER", name: "Carbon Weave",        rarity: "RARE",      price: 350,  gradient: "repeating-linear-gradient(45deg,#141420,#141420 8px,#0d0d16 8px,#0d0d16 16px)", sortOrder: 3 },
  { id: "banner-storm",      category: "BANNER", name: "Storm on the Oche",   rarity: "EPIC",      price: 600,  gradient: "linear-gradient(160deg,#0f1a2e 0%,#1a0f2e 55%,#0a0a12 100%)", sortOrder: 4 },
  { id: "banner-aurora",     category: "BANNER", name: "Champion's Aurora",   rarity: "LEGENDARY", price: 1000, gradient: "linear-gradient(100deg,rgba(255,210,74,0.25),rgba(255,0,92,0.2),rgba(0,102,255,0.2))", glow: "#ffd24a", sortOrder: 5 },
  { id: "banner-frost",      category: "BANNER", name: "Frosted Glass",       rarity: "RARE",      price: 350,  gradient: "linear-gradient(135deg,rgba(56,189,248,0.18) 0%,rgba(8,6,20,0.98) 60%)", sortOrder: 6 },
  { id: "banner-velvet",     category: "BANNER", name: "Midnight Velvet",     rarity: "EPIC",      price: 600,  gradient: "linear-gradient(160deg,#2a0e2e 0%,#0a0a12 65%,rgba(168,85,247,0.15) 100%)", sortOrder: 7 },
  { id: "banner-copper",     category: "BANNER", name: "Copper Foil",         rarity: "RARE",      price: 350,  gradient: "linear-gradient(120deg,rgba(255,140,0,0.2),#0a0a12 65%)", sortOrder: 8 },
  { id: "banner-emerald",    category: "BANNER", name: "Emerald Isle",        rarity: "COMMON",    price: 150,  gradient: "linear-gradient(135deg,rgba(34,197,94,0.16) 0%,#0a0a12 60%)", sortOrder: 9 },
  { id: "banner-harborfog",  category: "BANNER", name: "Harbour Fog",         rarity: "COMMON",    price: 150,  gradient: "linear-gradient(180deg,#1c2530 0%,#0a0a12 70%)", sortOrder: 10 },
  { id: "banner-solarflare", category: "BANNER", name: "Solar Flare",         rarity: "RARE",      price: 350,  gradient: "radial-gradient(circle at 70% 20%,rgba(255,140,0,0.25),#0a0a12 65%)", sortOrder: 11 },
  { id: "banner-trench",     category: "BANNER", name: "Deep Trench",         rarity: "EPIC",      price: 600,  gradient: "linear-gradient(180deg,#04101c 0%,#0a0a12 45%,rgba(6,182,212,0.14) 100%)", glow: "#06b6d4", sortOrder: 12 },
  { id: "banner-rosegold",   category: "BANNER", name: "Rose Gold Shimmer",   rarity: "LEGENDARY", price: 1000, gradient: "linear-gradient(110deg,rgba(255,210,74,0.22),rgba(236,72,153,0.2),rgba(255,210,74,0.22))", glow: "#ec4899", sortOrder: 13 },
];

// FRAME payload rides in `color` (border) and `glow` (glow colour) — drawn
// around the avatar square (see account.tsx's equippedFrame).
const FRAMES: SeedCosmetic[] = [
  { id: "frame-steel",   category: "FRAME", name: "Oche Steel",       rarity: "COMMON",    price: 150,  color: "#9ca3af", sortOrder: 0 },
  { id: "frame-emerald", category: "FRAME", name: "Emerald Veteran",  rarity: "RARE",      price: 350,  color: "#22c55e", glow: "#22c55e", sortOrder: 1 },
  { id: "frame-frost",   category: "FRAME", name: "Frost",            rarity: "RARE",      price: 350,  color: "#38bdf8", glow: "#38bdf8", sortOrder: 2 },
  { id: "frame-molten",  category: "FRAME", name: "Molten",           rarity: "EPIC",      price: 600,  color: "#ff8c00", glow: "#ff8c00", sortOrder: 3 },
  { id: "frame-gold",    category: "FRAME", name: "Champion's Gold",  rarity: "LEGENDARY", price: 1000, color: "#ffd24a", glow: "#ffd24a", sortOrder: 4 },
  { id: "frame-copper",  category: "FRAME", name: "Copper",           rarity: "COMMON",    price: 150,  color: "#ff8c00", sortOrder: 5 },
  { id: "frame-royal",   category: "FRAME", name: "Royal Purple",     rarity: "RARE",      price: 350,  color: "#a855f7", glow: "#a855f7", sortOrder: 6 },
  { id: "frame-platinum", category: "FRAME", name: "Platinum",        rarity: "EPIC",      price: 600,  color: "#e5e7eb", glow: "#ffffff", sortOrder: 7 },
  { id: "frame-crimson",  category: "FRAME", name: "Crimson",         rarity: "RARE",      price: 350,  color: "#ff005c", glow: "#ff005c", sortOrder: 8 },
  { id: "frame-cyan",     category: "FRAME", name: "Cyan",            rarity: "COMMON",    price: 150,  color: "#06b6d4", sortOrder: 9 },
  { id: "frame-magenta",  category: "FRAME", name: "Magenta",         rarity: "RARE",      price: 350,  color: "#ec4899", glow: "#ec4899", sortOrder: 10 },
  { id: "frame-obsidian", category: "FRAME", name: "Obsidian",        rarity: "EPIC",      price: 600,  color: "#1f2937", glow: "#a855f7", sortOrder: 11 },
  { id: "frame-diamond",  category: "FRAME", name: "Diamond",         rarity: "LEGENDARY", price: 1000, color: "#e0f2fe", glow: "#38bdf8", sortOrder: 12 },
];

// GLOW payload rides in `color` — a highlight colour applied to this
// player's own row on the leaderboard (see leaderboard.tsx's glowRowStyle()
// usage). Priced lower than the other categories since it's a single flat
// colour swap with no gradient/animated variant.
const GLOWS: SeedCosmetic[] = [
  { id: "glow-gold",   category: "GLOW", name: "Gold Row Glow",   rarity: "COMMON", price: 90,  color: "#ffd24a", sortOrder: 0 },
  { id: "glow-red",    category: "GLOW", name: "Red Row Glow",    rarity: "COMMON", price: 90,  color: "#ff005c", sortOrder: 1 },
  { id: "glow-blue",   category: "GLOW", name: "Blue Row Glow",   rarity: "COMMON", price: 90,  color: "#0066ff", sortOrder: 2 },
  { id: "glow-green",  category: "GLOW", name: "Green Row Glow",  rarity: "COMMON", price: 90,  color: "#22c55e", sortOrder: 3 },
  { id: "glow-purple", category: "GLOW", name: "Purple Row Glow", rarity: "RARE",   price: 180, color: "#a855f7", sortOrder: 4 },
  { id: "glow-white",  category: "GLOW", name: "White Row Glow",  rarity: "COMMON", price: 90,  color: "#ffffff", sortOrder: 5 },
  { id: "glow-orange", category: "GLOW", name: "Orange Row Glow", rarity: "COMMON", price: 90,  color: "#ff8c00", sortOrder: 6 },
  { id: "glow-cyan",     category: "GLOW", name: "Cyan Row Glow",       rarity: "COMMON",    price: 90,  color: "#06b6d4", sortOrder: 7 },
  { id: "glow-magenta",  category: "GLOW", name: "Magenta Row Glow",    rarity: "RARE",      price: 180, color: "#ec4899", sortOrder: 8 },
  { id: "glow-indigo",   category: "GLOW", name: "Indigo Row Glow",     rarity: "RARE",      price: 180, color: "#6366f1", sortOrder: 9 },
  { id: "glow-emerald",  category: "GLOW", name: "Emerald Row Glow",    rarity: "EPIC",      price: 320, color: "#00e5a0", sortOrder: 10 },
  { id: "glow-sapphire", category: "GLOW", name: "Sapphire Row Glow",   rarity: "EPIC",      price: 320, color: "#0066ff", sortOrder: 11 },
  { id: "glow-prismatic", category: "GLOW", name: "Prismatic Row Glow", rarity: "LEGENDARY", price: 550, color: "#a855f7", sortOrder: 12 },
  { id: "glow-champion", category: "GLOW", name: "Champion Row Glow",   rarity: "LEGENDARY", price: 550, color: "#ffd24a", sortOrder: 13 },
];

// RESULT_THEME payload rides in `color` — the accent used across your own
// practice-mode result screens (icon tint, headline detail colour, match
// stats card accent). When nothing's equipped, practice.tsx falls back to
// its existing hardcoded default (#a78bfa) unchanged — "theme-violet"
// below just happens to match that default, it isn't special-cased.
const RESULT_THEMES: SeedCosmetic[] = [
  { id: "theme-violet", category: "RESULT_THEME", name: "Violet Dream", rarity: "COMMON",    price: 120, color: "#a78bfa", sortOrder: 0 },
  { id: "theme-neon",   category: "RESULT_THEME", name: "Neon Oche",    rarity: "RARE",      price: 250, color: "#ff005c", sortOrder: 1 },
  { id: "theme-ice",    category: "RESULT_THEME", name: "Ice Cold",     rarity: "RARE",      price: 250, color: "#38bdf8", sortOrder: 2 },
  { id: "theme-toxic",  category: "RESULT_THEME", name: "Toxic",        rarity: "EPIC",      price: 400, color: "#22c55e", sortOrder: 3 },
  { id: "theme-gold",   category: "RESULT_THEME", name: "Champion",     rarity: "LEGENDARY", price: 700, color: "#ffd24a", sortOrder: 4 },
  { id: "theme-mono",   category: "RESULT_THEME", name: "Monochrome",   rarity: "RARE",      price: 250, color: "#e5e7eb", sortOrder: 5 },
  { id: "theme-copper", category: "RESULT_THEME", name: "Copper",       rarity: "EPIC",      price: 400, color: "#ff8c00", sortOrder: 6 },
  { id: "theme-cyan",     category: "RESULT_THEME", name: "Cyan Burst",  rarity: "COMMON",    price: 120, color: "#06b6d4", sortOrder: 7 },
  { id: "theme-slate",    category: "RESULT_THEME", name: "Slate",       rarity: "COMMON",    price: 120, color: "#64748b", sortOrder: 8 },
  { id: "theme-magenta",  category: "RESULT_THEME", name: "Magenta",     rarity: "RARE",      price: 250, color: "#ec4899", sortOrder: 9 },
  { id: "theme-indigo",   category: "RESULT_THEME", name: "Indigo",      rarity: "EPIC",      price: 400, color: "#6366f1", sortOrder: 10 },
  { id: "theme-amethyst", category: "RESULT_THEME", name: "Amethyst",    rarity: "LEGENDARY", price: 700, color: "#a855f7", sortOrder: 11 },
];

// BUBBLE_COLOR payload rides in `color` — the tint for a player's own
// outgoing DM chat bubbles (see account.tsx's threadMessages.map, `mine`
// bubble only). Priced like GLOW — a single flat colour swap, no
// gradient/animated variant.
const BUBBLE_COLORS: SeedCosmetic[] = [
  { id: "bubble-crimson", category: "BUBBLE_COLOR", name: "Crimson",    rarity: "COMMON", price: 90,  color: "#ff005c", sortOrder: 0 },
  { id: "bubble-cobalt",  category: "BUBBLE_COLOR", name: "Cobalt",     rarity: "COMMON", price: 90,  color: "#0066ff", sortOrder: 1 },
  { id: "bubble-emerald", category: "BUBBLE_COLOR", name: "Emerald",    rarity: "COMMON", price: 90,  color: "#22c55e", sortOrder: 2 },
  { id: "bubble-amber",   category: "BUBBLE_COLOR", name: "Amber",      rarity: "COMMON", price: 90,  color: "#ffd24a", sortOrder: 3 },
  { id: "bubble-violet",  category: "BUBBLE_COLOR", name: "Violet",     rarity: "RARE",   price: 180, color: "#a855f7", sortOrder: 4 },
  { id: "bubble-teal",    category: "BUBBLE_COLOR", name: "Teal",       rarity: "COMMON", price: 90,  color: "#00e5a0", sortOrder: 5 },
  { id: "bubble-mono",    category: "BUBBLE_COLOR", name: "Monochrome", rarity: "COMMON", price: 90,  color: "#e5e7eb", sortOrder: 6 },
  { id: "bubble-cyan",     category: "BUBBLE_COLOR", name: "Cyan",             rarity: "COMMON",    price: 90,  color: "#06b6d4", sortOrder: 7 },
  { id: "bubble-rose",     category: "BUBBLE_COLOR", name: "Rose",             rarity: "COMMON",    price: 90,  color: "#f43f5e", sortOrder: 8 },
  { id: "bubble-lime",     category: "BUBBLE_COLOR", name: "Lime",             rarity: "COMMON",    price: 90,  color: "#84cc16", sortOrder: 9 },
  { id: "bubble-magenta",  category: "BUBBLE_COLOR", name: "Magenta",          rarity: "RARE",      price: 180, color: "#ec4899", sortOrder: 10 },
  { id: "bubble-indigo",   category: "BUBBLE_COLOR", name: "Indigo",           rarity: "RARE",      price: 180, color: "#6366f1", sortOrder: 11 },
  { id: "bubble-sapphire", category: "BUBBLE_COLOR", name: "Sapphire",         rarity: "EPIC",      price: 320, color: "#0066ff", sortOrder: 12 },
  { id: "bubble-prismatic", category: "BUBBLE_COLOR", name: "Prismatic",       rarity: "LEGENDARY", price: 550, color: "#a855f7", sortOrder: 13 },
];

// AVATAR_BADGE payload rides in `iconKey` (its own separate whitelist from
// PROFILE_ICON — see lib/cosmetics.ts's AVATAR_BADGE_MAP) and `color` for
// the badge's ring/background tint. Rendered as a small sticker pinned to
// the bottom-right corner of the avatar square, stacking on top of
// PROFILE_ICON + FRAME rather than replacing either.
const AVATAR_BADGES: SeedCosmetic[] = [
  { id: "badge-heart",   category: "AVATAR_BADGE", name: "Heart",        rarity: "COMMON",    price: 120, iconKey: "heart",    color: "#ff005c", sortOrder: 0 },
  { id: "badge-medal",   category: "AVATAR_BADGE", name: "Medal",        rarity: "RARE",      price: 280, iconKey: "medal",    color: "#ffd24a", sortOrder: 1 },
  { id: "badge-verified", category: "AVATAR_BADGE", name: "Verified",    rarity: "RARE",      price: 280, iconKey: "verified", color: "#38bdf8", sortOrder: 2 },
  { id: "badge-thumbsup", category: "AVATAR_BADGE", name: "Thumbs Up",   rarity: "COMMON",    price: 120, iconKey: "thumbsup", color: "#22c55e", sortOrder: 3 },
  { id: "badge-party",   category: "AVATAR_BADGE", name: "Party Popper", rarity: "EPIC",      price: 500, iconKey: "party",    color: "#a855f7", sortOrder: 4 },
  { id: "badge-fire",    category: "AVATAR_BADGE", name: "On Fire",      rarity: "LEGENDARY", price: 850, iconKey: "fire",     color: "#ff8c00", sortOrder: 5 },
  { id: "badge-star",    category: "AVATAR_BADGE", name: "Star",         rarity: "COMMON",    price: 120, iconKey: "star",     color: "#ffd24a", sortOrder: 6 },
  { id: "badge-bolt",    category: "AVATAR_BADGE", name: "Bolt",         rarity: "COMMON",    price: 120, iconKey: "bolt",     color: "#38bdf8", sortOrder: 7 },
  { id: "badge-target",  category: "AVATAR_BADGE", name: "Bullseye",     rarity: "RARE",      price: 280, iconKey: "target",   color: "#ff005c", sortOrder: 8 },
  { id: "badge-crown",   category: "AVATAR_BADGE", name: "Crowned",      rarity: "EPIC",      price: 500, iconKey: "crown",    color: "#ffd24a", sortOrder: 9 },
  { id: "badge-skull",   category: "AVATAR_BADGE", name: "Menace",       rarity: "LEGENDARY", price: 850, iconKey: "skull",    color: "#a855f7", sortOrder: 10 },
];

// LEADERBOARD_TAG payload rides in `name` (the tag text itself — a fixed
// catalog string, never free text, so nothing needs moderating) and `color`
// for its tint. Rendered as a small pill next to a player's name on the
// leaderboard (Season + Career rows) — the one cosmetic slot every other
// player actually sees while just scanning the standings.
const LEADERBOARD_TAGS: SeedCosmetic[] = [
  { id: "tag-grinder",     category: "LEADERBOARD_TAG", name: "GRINDER",      rarity: "COMMON",    price: 150, color: "#9ca3af", sortOrder: 0 },
  { id: "tag-sharpshooter", category: "LEADERBOARD_TAG", name: "SHARPSHOOTER", rarity: "RARE",      price: 350, color: "#38bdf8", sortOrder: 1 },
  { id: "tag-nightowl",    category: "LEADERBOARD_TAG", name: "NIGHT OWL",    rarity: "RARE",      price: 350, color: "#a855f7", sortOrder: 2 },
  { id: "tag-menace",      category: "LEADERBOARD_TAG", name: "MENACE",       rarity: "EPIC",      price: 600, color: "#ff005c", sortOrder: 3 },
  { id: "tag-legend",      category: "LEADERBOARD_TAG", name: "LEGEND",       rarity: "LEGENDARY", price: 1000, color: "#ffd24a", sortOrder: 4 },
  { id: "tag-rookie",      category: "LEADERBOARD_TAG", name: "ROOKIE",       rarity: "COMMON",    price: 150, color: "#22c55e", sortOrder: 5 },
  { id: "tag-clutch",      category: "LEADERBOARD_TAG", name: "CLUTCH",       rarity: "EPIC",      price: 600, color: "#00e5a0", sortOrder: 6 },
  { id: "tag-hustler",     category: "LEADERBOARD_TAG", name: "HUSTLER",      rarity: "COMMON",    price: 150,  color: "#ff8c00", sortOrder: 7 },
  { id: "tag-wildcard",    category: "LEADERBOARD_TAG", name: "WILDCARD",     rarity: "RARE",      price: 350,  color: "#ec4899", sortOrder: 8 },
  { id: "tag-iceman",      category: "LEADERBOARD_TAG", name: "ICEMAN",       rarity: "RARE",      price: 350,  color: "#06b6d4", sortOrder: 9 },
  { id: "tag-assassin",    category: "LEADERBOARD_TAG", name: "ASSASSIN",     rarity: "EPIC",      price: 600,  color: "#7c3aed", sortOrder: 10 },
  { id: "tag-goat",        category: "LEADERBOARD_TAG", name: "GOAT",         rarity: "LEGENDARY", price: 1000, color: "#f43f5e", sortOrder: 11 },
];

// TAGLINE_STYLE payload rides in color/gradient/glow — identical shape to
// NAME_STYLE, applied to a player's tagline line instead. Priced a notch
// below NAME_STYLE since the tagline is a smaller, secondary surface.
const TAGLINE_STYLES: SeedCosmetic[] = [
  { id: "tagline-mono",   category: "TAGLINE_STYLE", name: "Monochrome",  rarity: "COMMON", price: 100, color: "#e5e7eb", sortOrder: 0 },
  { id: "tagline-gold",   category: "TAGLINE_STYLE", name: "Gold",        rarity: "RARE",   price: 250, color: "#ffd24a", sortOrder: 1 },
  { id: "tagline-crimson", category: "TAGLINE_STYLE", name: "Crimson",    rarity: "RARE",   price: 250, color: "#ff005c", sortOrder: 2 },
  { id: "tagline-toxic",  category: "TAGLINE_STYLE", name: "Toxic",       rarity: "EPIC",   price: 450, gradient: "linear-gradient(90deg,#22c55e,#00e5a0)", glow: "#22c55e", sortOrder: 3 },
  { id: "tagline-royal",  category: "TAGLINE_STYLE", name: "Royal",       rarity: "EPIC",   price: 450, gradient: "linear-gradient(90deg,#a855f7,#6366f1)", glow: "#a855f7", sortOrder: 4 },
  { id: "tagline-cyan",     category: "TAGLINE_STYLE", name: "Cyan",       rarity: "COMMON",    price: 100, color: "#06b6d4", sortOrder: 5 },
  { id: "tagline-sapphire", category: "TAGLINE_STYLE", name: "Sapphire",   rarity: "RARE",      price: 250, color: "#0066ff", sortOrder: 6 },
  { id: "tagline-inferno",  category: "TAGLINE_STYLE", name: "Inferno",    rarity: "EPIC",      price: 450, gradient: "linear-gradient(90deg,#ff005c,#ff8c00,#ffd24a)", glow: "#ff8c00", sortOrder: 7 },
  { id: "tagline-champion", category: "TAGLINE_STYLE", name: "Champion's Gold", rarity: "LEGENDARY", price: 750, gradient: "linear-gradient(90deg,#ffd24a,#fff7d6,#ffd24a)", glow: "#ffd24a", sortOrder: 8 },
  { id: "tagline-prismatic", category: "TAGLINE_STYLE", name: "Prismatic", rarity: "LEGENDARY", price: 750, gradient: "linear-gradient(90deg,#ff005c,#ffd24a,#22c55e,#38bdf8,#a78bfa)", glow: "#ffffff", sortOrder: 9 },
];

// POST_ACCENT payload rides in `color` — a border/background tint on a
// player's own Community feed posts (see community.tsx's PostCard). Priced
// like GLOW/BUBBLE_COLOR — a flat colour swap.
const POST_ACCENTS: SeedCosmetic[] = [
  { id: "post-gold",   category: "POST_ACCENT", name: "Gold Post Accent",   rarity: "COMMON", price: 90,  color: "#ffd24a", sortOrder: 0 },
  { id: "post-red",    category: "POST_ACCENT", name: "Red Post Accent",    rarity: "COMMON", price: 90,  color: "#ff005c", sortOrder: 1 },
  { id: "post-blue",   category: "POST_ACCENT", name: "Blue Post Accent",   rarity: "COMMON", price: 90,  color: "#0066ff", sortOrder: 2 },
  { id: "post-green",  category: "POST_ACCENT", name: "Green Post Accent",  rarity: "COMMON", price: 90,  color: "#22c55e", sortOrder: 3 },
  { id: "post-purple", category: "POST_ACCENT", name: "Purple Post Accent", rarity: "RARE",   price: 180, color: "#a855f7", sortOrder: 4 },
  { id: "post-teal",   category: "POST_ACCENT", name: "Teal Post Accent",   rarity: "COMMON", price: 90,  color: "#00e5a0", sortOrder: 5 },
  { id: "post-cyan",      category: "POST_ACCENT", name: "Cyan Post Accent",      rarity: "COMMON",    price: 90,  color: "#06b6d4", sortOrder: 6 },
  { id: "post-rose",      category: "POST_ACCENT", name: "Rose Post Accent",      rarity: "COMMON",    price: 90,  color: "#f43f5e", sortOrder: 7 },
  { id: "post-magenta",   category: "POST_ACCENT", name: "Magenta Post Accent",   rarity: "RARE",      price: 180, color: "#ec4899", sortOrder: 8 },
  { id: "post-indigo",    category: "POST_ACCENT", name: "Indigo Post Accent",    rarity: "RARE",      price: 180, color: "#6366f1", sortOrder: 9 },
  { id: "post-sapphire",  category: "POST_ACCENT", name: "Sapphire Post Accent",  rarity: "EPIC",      price: 320, color: "#0066ff", sortOrder: 10 },
  { id: "post-prismatic", category: "POST_ACCENT", name: "Prismatic Post Accent", rarity: "LEGENDARY", price: 550, color: "#a855f7", sortOrder: 11 },
];

// STICKER payload rides in `iconKey` — the literal emoji character (plain
// unicode text, see schema/cosmetics.ts's header comment), attached
// per-message in account-page DMs rather than equipped to a slot.
const STICKERS: SeedCosmetic[] = [
  { id: "sticker-fire",    category: "STICKER", name: "Fire",         rarity: "COMMON", price: 60,  iconKey: "🔥", sortOrder: 0 },
  { id: "sticker-target",  category: "STICKER", name: "Bullseye",     rarity: "COMMON", price: 60,  iconKey: "🎯", sortOrder: 1 },
  { id: "sticker-trophy",  category: "STICKER", name: "Trophy",       rarity: "COMMON", price: 60,  iconKey: "🏆", sortOrder: 2 },
  { id: "sticker-laugh",   category: "STICKER", name: "Laughing",     rarity: "COMMON", price: 60,  iconKey: "😂", sortOrder: 3 },
  { id: "sticker-clap",    category: "STICKER", name: "Applause",     rarity: "COMMON", price: 60,  iconKey: "👏", sortOrder: 4 },
  { id: "sticker-skull",   category: "STICKER", name: "Skull",        rarity: "RARE",   price: 140, iconKey: "💀", sortOrder: 5 },
  { id: "sticker-100",     category: "STICKER", name: "Perfect",      rarity: "RARE",   price: 140, iconKey: "💯", sortOrder: 6 },
  { id: "sticker-crown",   category: "STICKER", name: "Crown",        rarity: "EPIC",   price: 280, iconKey: "👑", sortOrder: 7 },
  { id: "sticker-cheers",  category: "STICKER", name: "Cheers",       rarity: "COMMON",    price: 60,  iconKey: "🍻", sortOrder: 8 },
  { id: "sticker-gg",      category: "STICKER", name: "GG",           rarity: "COMMON",    price: 60,  iconKey: "🤝", sortOrder: 9 },
  { id: "sticker-shocked", category: "STICKER", name: "Shocked",      rarity: "COMMON",    price: 60,  iconKey: "😱", sortOrder: 10 },
  { id: "sticker-party",   category: "STICKER", name: "Party",        rarity: "RARE",      price: 140, iconKey: "🥳", sortOrder: 11 },
  { id: "sticker-goat",    category: "STICKER", name: "GOAT",         rarity: "EPIC",      price: 280, iconKey: "🐐", sortOrder: 12 },
  { id: "sticker-rainbow", category: "STICKER", name: "Rainbow",      rarity: "LEGENDARY", price: 450, iconKey: "🌈", sortOrder: 13 },
];

// CHECKOUT_EFFECT payload rides in `iconKey` (a whitelisted key into
// lib/cosmetics.ts's CHECKOUT_EFFECT_MAP) and `color` for its tint —
// a particle-burst animation on a player's own Practice result screen when
// they win. Priced like RESULT_THEME — a decorative accent for that screen.
const CHECKOUT_EFFECTS: SeedCosmetic[] = [
  { id: "effect-confetti",  category: "CHECKOUT_EFFECT", name: "Confetti Burst",  rarity: "COMMON",    price: 150, iconKey: "confetti",  color: "#ffd24a", sortOrder: 0 },
  { id: "effect-fireworks", category: "CHECKOUT_EFFECT", name: "Fireworks",       rarity: "RARE",      price: 320, iconKey: "fireworks", color: "#38bdf8", sortOrder: 1 },
  { id: "effect-shockwave", category: "CHECKOUT_EFFECT", name: "Shockwave",       rarity: "EPIC",      price: 500, iconKey: "shockwave", color: "#ff005c", sortOrder: 2 },
  { id: "effect-goldrain",  category: "CHECKOUT_EFFECT", name: "Gold Rain",       rarity: "LEGENDARY", price: 800, iconKey: "goldrain",  color: "#ffd24a", sortOrder: 3 },
  { id: "effect-hearts",    category: "CHECKOUT_EFFECT", name: "Heart Burst",     rarity: "COMMON",    price: 150, iconKey: "hearts",    color: "#ec4899", sortOrder: 4 },
  { id: "effect-thunder",   category: "CHECKOUT_EFFECT", name: "Thunderclap",     rarity: "RARE",      price: 320, iconKey: "thunder",   color: "#a855f7", sortOrder: 5 },
  { id: "effect-rainbow",   category: "CHECKOUT_EFFECT", name: "Rainbow Burst",   rarity: "EPIC",      price: 500, iconKey: "rainbow",   color: "#22c55e", sortOrder: 6 },
  { id: "effect-snowburst", category: "CHECKOUT_EFFECT", name: "Snow Burst",      rarity: "LEGENDARY", price: 800, iconKey: "snowburst", color: "#38bdf8", sortOrder: 7 },
];

// SCORER_THEME payload rides in `color` — an accent applied to the live
// Practice-mode scorer UI (see lib/scorers.tsx's SectionCard usage in
// X01Scorer/CricketScorer, threaded through components/game-scorer.tsx and
// pages/practice.tsx). Priced like RESULT_THEME — a decorative accent for a
// self-play screen.
const SCORER_THEMES: SeedCosmetic[] = [
  { id: "scorer-violet",  category: "SCORER_THEME", name: "Violet Dream", rarity: "COMMON",    price: 120, color: "#a78bfa", sortOrder: 0 },
  { id: "scorer-ice",     category: "SCORER_THEME", name: "Ice Cold",     rarity: "RARE",      price: 250, color: "#38bdf8", sortOrder: 1 },
  { id: "scorer-toxic",   category: "SCORER_THEME", name: "Toxic",       rarity: "RARE",      price: 250, color: "#22c55e", sortOrder: 2 },
  { id: "scorer-neon",    category: "SCORER_THEME", name: "Neon Oche",    rarity: "EPIC",      price: 400, color: "#ff005c", sortOrder: 3 },
  { id: "scorer-gold",    category: "SCORER_THEME", name: "Champion",     rarity: "LEGENDARY", price: 700, color: "#ffd24a", sortOrder: 4 },
];

// PLAYER_CARD_FINISH payload rides in `iconKey` (a whitelisted key into
// lib/cosmetics.ts's PLAYER_CARD_FINISH_MAP) and `color` for its tint — a
// texture/shimmer overlay layered on top of the hero block on a player's
// own player-detail page, independent of whatever BANNER is equipped
// underneath it. Priced like CHECKOUT_EFFECT — one item per rarity tier.
const PLAYER_CARD_FINISHES: SeedCosmetic[] = [
  { id: "finish-matte",     category: "PLAYER_CARD_FINISH", name: "Matte",     rarity: "COMMON",    price: 150, iconKey: "matte",     color: "#9ca3af", sortOrder: 0 },
  { id: "finish-foil",      category: "PLAYER_CARD_FINISH", name: "Foil",      rarity: "RARE",      price: 320, iconKey: "foil",      color: "#e5e7eb", sortOrder: 1 },
  { id: "finish-holo",      category: "PLAYER_CARD_FINISH", name: "Holo",      rarity: "EPIC",      price: 500, iconKey: "holo",      color: "#38bdf8", sortOrder: 2 },
  { id: "finish-prismatic", category: "PLAYER_CARD_FINISH", name: "Prismatic", rarity: "LEGENDARY", price: 800, iconKey: "prismatic", color: "#ffd24a", sortOrder: 3 },
];

// TROPHY_CASE_STYLE payload rides in `color` only — a flat background/
// border/glow skin for the pinned Trophy Case strip. Priced like GLOW/
// POST_ACCENT (a flat colour swap), see lib/cosmetics.ts's
// trophyCaseStyle() and components/TrophyCase.tsx.
const TROPHY_CASE_STYLES: SeedCosmetic[] = [
  { id: "trophy-gold",   category: "TROPHY_CASE_STYLE", name: "Gold Case",   rarity: "COMMON", price: 90,  color: "#ffd24a", sortOrder: 0 },
  { id: "trophy-red",    category: "TROPHY_CASE_STYLE", name: "Red Case",    rarity: "COMMON", price: 90,  color: "#ff005c", sortOrder: 1 },
  { id: "trophy-blue",   category: "TROPHY_CASE_STYLE", name: "Blue Case",   rarity: "COMMON", price: 90,  color: "#0066ff", sortOrder: 2 },
  { id: "trophy-green",  category: "TROPHY_CASE_STYLE", name: "Green Case",  rarity: "COMMON", price: 90,  color: "#22c55e", sortOrder: 3 },
  { id: "trophy-purple", category: "TROPHY_CASE_STYLE", name: "Purple Case", rarity: "RARE",   price: 180, color: "#a855f7", sortOrder: 4 },
  { id: "trophy-white",  category: "TROPHY_CASE_STYLE", name: "Platinum Case", rarity: "EPIC", price: 400, color: "#ffffff", sortOrder: 5 },
];

// RECAP_STYLE payload rides in `gradient` — a full CSS background-image
// string, same shape as BANNER. Priced like NAME_STYLE's gradient tier (a
// season recap is a bigger showpiece than a flat colour swap). See
// lib/cosmetics.ts's recapStyleCSS() and components/SeasonRecapCard.tsx.
const RECAP_STYLES: SeedCosmetic[] = [
  { id: "recap-classic",   category: "RECAP_STYLE", name: "Classic Gold",    rarity: "COMMON",    price: 200, gradient: "linear-gradient(135deg,#1a1625,#2a1f1a)", glow: "#ffd24a", sortOrder: 0 },
  { id: "recap-frost",     category: "RECAP_STYLE", name: "Frost Report",    rarity: "RARE",      price: 400, gradient: "linear-gradient(135deg,#0c2233,#1a3a4d)", glow: "#38bdf8", sortOrder: 1 },
  { id: "recap-inferno",   category: "RECAP_STYLE", name: "Inferno Recap",   rarity: "EPIC",      price: 650, gradient: "linear-gradient(135deg,#2a0f1a,#4d1020)", glow: "#ff005c", sortOrder: 2 },
  { id: "recap-champions", category: "RECAP_STYLE", name: "Champion's Ledger", rarity: "LEGENDARY", price: 1000, gradient: "linear-gradient(135deg,#2a2410,#3d3418)", glow: "#ffd24a", sortOrder: 3 },
];

// RANK_UP_EFFECT payload rides in `iconKey` (a whitelisted key into
// lib/cosmetics.ts's RANK_UP_EFFECT_MAP) and `color` for its tint — reuses
// the same <CheckoutBurst> component as CHECKOUT_EFFECT, just a separate
// owned/equipped slot so "won a leg" and "climbed the table" can look
// different. Priced like CHECKOUT_EFFECT — one item per rarity tier.
const RANK_UP_EFFECTS: SeedCosmetic[] = [
  { id: "rankup-arrow",  category: "RANK_UP_EFFECT", name: "Arrow Up",    rarity: "COMMON",    price: 150, iconKey: "arrow",  color: "#22c55e", sortOrder: 0 },
  { id: "rankup-rocket", category: "RANK_UP_EFFECT", name: "Blast Off",   rarity: "RARE",      price: 320, iconKey: "rocket", color: "#38bdf8", sortOrder: 1 },
  { id: "rankup-star",   category: "RANK_UP_EFFECT", name: "Rising Star", rarity: "EPIC",      price: 500, iconKey: "star",   color: "#ffd24a", sortOrder: 2 },
  { id: "rankup-crown",  category: "RANK_UP_EFFECT", name: "Crowning",    rarity: "LEGENDARY", price: 800, iconKey: "crown",  color: "#ffd24a", sortOrder: 3 },
];

// Not purchasable — auto-granted to whoever is crowned Singles champion at
// season close (see lib/seasonReset.ts's performSeasonResetLocked). Its own
// distinct id/gradient from the purchasable "name-champion" Legendary
// (Champion's Gold) on purpose: that one anyone can buy, this one only ever
// comes from actually winning a season, and re-winning just leaves it
// already-owned rather than granting a duplicate.
const CHAMPION_EXCLUSIVES: SeedCosmetic[] = [
  { id: "name-crowned", category: "NAME_STYLE", name: "League Champion", rarity: "LEGENDARY", price: 0,
    gradient: "linear-gradient(90deg,#ffd24a,#ff005c,#ffd24a,#ff005c)", glow: "#ffd24a", sortOrder: 9, purchasable: false },
];

// Upsert-by-id rather than seedCardDefinitions' delete-and-reseed pattern —
// deleting a cosmetic_definitions row here would cascade-delete every
// player's purchase of it (ON DELETE CASCADE in add_cosmetics_tables.ts),
// silently taking back something someone actually bought. This only ever
// adds or updates rows, on every boot, so tweaking a price/colour just
// means editing the arrays above and redeploying.
export async function seedCosmeticDefinitions(): Promise<void> {
  for (const c of [...NAME_STYLES, ...PROFILE_ICONS, ...BANNERS, ...FRAMES, ...GLOWS, ...RESULT_THEMES, ...BUBBLE_COLORS, ...AVATAR_BADGES, ...LEADERBOARD_TAGS, ...TAGLINE_STYLES, ...POST_ACCENTS, ...STICKERS, ...CHECKOUT_EFFECTS, ...SCORER_THEMES, ...PLAYER_CARD_FINISHES, ...TROPHY_CASE_STYLES, ...RECAP_STYLES, ...RANK_UP_EFFECTS, ...CHAMPION_EXCLUSIVES]) {
    try {
      await db
        .insert(cosmeticDefinitionsTable)
        .values({
          id: c.id,
          category: c.category,
          name: c.name,
          rarity: c.rarity,
          price: c.price,
          color: c.color ?? null,
          gradient: c.gradient ?? null,
          glow: c.glow ?? null,
          iconKey: c.iconKey ?? null,
          enabled: true,
          purchasable: c.purchasable ?? true,
          sortOrder: c.sortOrder,
        })
        .onConflictDoUpdate({
          target: cosmeticDefinitionsTable.id,
          set: {
            category: c.category,
            name: c.name,
            rarity: c.rarity,
            price: c.price,
            color: c.color ?? null,
            gradient: c.gradient ?? null,
            glow: c.glow ?? null,
            iconKey: c.iconKey ?? null,
            purchasable: c.purchasable ?? true,
            sortOrder: c.sortOrder,
          },
        });
    } catch (err) {
      logger.error({ err, cosmeticId: c.id }, "Failed to seed cosmetic definition");
    }
  }
}
