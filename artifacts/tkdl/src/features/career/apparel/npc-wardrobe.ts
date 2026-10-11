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
