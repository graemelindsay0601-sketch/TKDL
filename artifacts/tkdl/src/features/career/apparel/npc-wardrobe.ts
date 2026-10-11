import { CAREER_KIT_BY_ID, CAREER_KIT_DESIGNS } from "../kit-catalog.ts";

// Preserve wardrobe selection when new collections are appended. Never base NPC
// clothing on current rank, form, or season: those values change during a career.
const legacyWardrobePool = CAREER_KIT_DESIGNS.slice(0, 50);

export function stableNpcKitDesignId(npcId: string, savedKitDesignId?: string | null): string {
  if (savedKitDesignId && CAREER_KIT_BY_ID.has(savedKitDesignId)) return savedKitDesignId;
  let hash = 2166136261;
  for (const char of npcId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return legacyWardrobePool[hash % legacyWardrobePool.length]!.id;
}

export type NpcWardrobeTier = "LOCAL" | "REGIONAL" | "PROFESSIONAL" | "ELITE";

/** Stable, tier-aware resolver for the Career-shell integration owner. */
export function stableNpcWardrobeKitDesignId(
  npcId: string,
  options: { tier: NpcWardrobeTier; activeMakerBrandIds?: readonly string[]; savedKitDesignId?: string | null },
): string {
  if (options.savedKitDesignId && CAREER_KIT_BY_ID.has(options.savedKitDesignId)) return options.savedKitDesignId;
  const activeMakers = new Set(options.activeMakerBrandIds ?? []);
  const maxNumber = options.tier === "LOCAL" ? 100 : options.tier === "REGIONAL" ? 150 : 250;
  const pool = CAREER_KIT_DESIGNS.filter(kit =>
    Number(kit.number) <= maxNumber && (!kit.makerBrandId || activeMakers.has(kit.makerBrandId)),
  );
  let hash = 2166136261;
  for (const char of npcId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return pool[hash % pool.length]!.id;
}
