import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Flame, Zap, Skull, Crown, Trophy, Rocket, Ghost, Gem, type LucideIcon } from "lucide-react";

export interface CosmeticDefinition {
  id: string;
  category: "NAME_STYLE" | "PROFILE_ICON";
  name: string;
  rarity: "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
  price: number;
  color: string | null;
  gradient: string | null;
  glow: string | null;
  iconKey: string | null;
  enabled: boolean;
  sortOrder: number;
}

// Whitelisted icon keys a PROFILE_ICON cosmetic can reference — the server
// only ever stores one of these short keys (see cosmetics-service.ts's
// seed), never markup or a URL, so an unrecognised key just falls back to
// the default rather than rendering nothing.
export const PROFILE_ICON_MAP: Record<string, LucideIcon> = {
  flame: Flame, zap: Zap, skull: Skull, crown: Crown,
  trophy: Trophy, rocket: Rocket, ghost: Ghost, gem: Gem,
};

export const RARITY_COLORS: Record<string, string> = {
  COMMON: "#9ca3af", RARE: "#3b82f6", EPIC: "#a855f7", LEGENDARY: "#ffd24a",
};

let catalogCache: CosmeticDefinition[] | null = null;
let catalogPromise: Promise<CosmeticDefinition[]> | null = null;

function loadCatalog(): Promise<CosmeticDefinition[]> {
  if (catalogCache) return Promise.resolve(catalogCache);
  if (!catalogPromise) {
    catalogPromise = fetch("/api/cosmetics/catalog")
      .then(r => (r.ok ? r.json() : []))
      .then((rows: CosmeticDefinition[]) => { catalogCache = rows; return rows; })
      .catch(() => []);
  }
  return catalogPromise;
}

// Shared, module-level cache — the catalog rarely changes and several
// components on the same page (the shop, an account header, a player-detail
// hero) all need it, so this avoids a duplicate fetch per component.
export function useCosmeticsCatalog(): CosmeticDefinition[] {
  const [catalog, setCatalog] = useState<CosmeticDefinition[]>(catalogCache ?? []);
  useEffect(() => {
    let live = true;
    loadCatalog().then(rows => { if (live) setCatalog(rows); });
    return () => { live = false; };
  }, []);
  return catalog;
}

// CSS for a NAME_STYLE cosmetic — a solid colour, or a gradient-text
// treatment with an optional glow. Returns {} for null/unknown, which
// renders as the existing default look, unchanged.
export function nameStyleCSS(cosmetic: CosmeticDefinition | undefined | null): CSSProperties {
  if (!cosmetic) return {};
  if (cosmetic.gradient) {
    return {
      backgroundImage: cosmetic.gradient,
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      color: "transparent",
      filter: cosmetic.glow ? `drop-shadow(0 0 10px ${cosmetic.glow}99)` : undefined,
    };
  }
  if (cosmetic.color) {
    return {
      color: cosmetic.color,
      textShadow: cosmetic.glow ? `0 0 14px ${cosmetic.glow}99` : undefined,
    };
  }
  return {};
}

// LEGENDARY gradients get a slow animated shimmer (index.css's
// .cosmetic-name-legendary) — everything else renders static.
export function nameStyleClassName(cosmetic: CosmeticDefinition | undefined | null): string {
  return cosmetic?.gradient && cosmetic.rarity === "LEGENDARY" ? "cosmetic-name-legendary" : "";
}
