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
];

// FRAME payload rides in `color` (border) and `glow` (glow colour) — drawn
// around the avatar square (see account.tsx's equippedFrame).
const FRAMES: SeedCosmetic[] = [
  { id: "frame-steel",   category: "FRAME", name: "Oche Steel",       rarity: "COMMON",    price: 150,  color: "#9ca3af", sortOrder: 0 },
  { id: "frame-emerald", category: "FRAME", name: "Emerald Veteran",  rarity: "RARE",      price: 350,  color: "#22c55e", glow: "#22c55e", sortOrder: 1 },
  { id: "frame-frost",   category: "FRAME", name: "Frost",            rarity: "RARE",      price: 350,  color: "#38bdf8", glow: "#38bdf8", sortOrder: 2 },
  { id: "frame-molten",  category: "FRAME", name: "Molten",           rarity: "EPIC",      price: 600,  color: "#ff8c00", glow: "#ff8c00", sortOrder: 3 },
  { id: "frame-gold",    category: "FRAME", name: "Champion's Gold",  rarity: "LEGENDARY", price: 1000, color: "#ffd24a", glow: "#ffd24a", sortOrder: 4 },
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
  for (const c of [...NAME_STYLES, ...PROFILE_ICONS, ...BANNERS, ...FRAMES, ...GLOWS, ...RESULT_THEMES, ...BUBBLE_COLORS, ...CHAMPION_EXCLUSIVES]) {
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
