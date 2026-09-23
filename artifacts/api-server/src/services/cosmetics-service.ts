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

// Upsert-by-id rather than seedCardDefinitions' delete-and-reseed pattern —
// deleting a cosmetic_definitions row here would cascade-delete every
// player's purchase of it (ON DELETE CASCADE in add_cosmetics_tables.ts),
// silently taking back something someone actually bought. This only ever
// adds or updates rows, on every boot, so tweaking a price/colour just
// means editing the arrays above and redeploying.
export async function seedCosmeticDefinitions(): Promise<void> {
  for (const c of [...NAME_STYLES, ...PROFILE_ICONS]) {
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
            sortOrder: c.sortOrder,
          },
        });
    } catch (err) {
      logger.error({ err, cosmeticId: c.id }, "Failed to seed cosmetic definition");
    }
  }
}
