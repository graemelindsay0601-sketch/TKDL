import type { Npc } from "../world/types.ts";
import { zoneOf, localityByRegion, type Zone } from "./geography.ts";

/**
 * Provider boundaries for authority A3 does not own.
 *
 * A5 (Rankings/Tour Cards) will replace `sportingStatus` and `seeding`.
 * A4 (Economy) will read instance `profiles` references and attach financial
 * commitment to entries. A3 ships only conservative placeholders and never
 * calculates rankings, awards Tour Cards or moves money.
 */
export type HumanProfile = { country: string; zone: Zone; locality: string; professionalStatus: "AMATEUR" | "PROFESSIONAL"; tourCard: boolean | null };

export interface SportingStatusProvider {
  readonly id: string;
  /** Human sporting facts. tourCard null = unknown/no authority. */
  human(root: { has_tour_card: boolean; settings_snapshot: Record<string, unknown> }): HumanProfile;
  /** NPC Tour Card status; null = unknown/no authority. */
  npcTourCard(npc: Npc): boolean | null;
  /** Ranking positions for a participant by ranking list key. Empty until A5. */
  rankings(participantKey: string): Record<string, number>;
}

export interface SeedingProvider {
  readonly id: string;
  /** Ordered participant keys for a list, best first. Empty = unseeded draw. */
  order(list: string, entrants: readonly string[]): string[];
}

/**
 * A3 placeholder: NPC Tour Card status mirrors A2 professionalStatus; the human
 * reads A1's has_tour_card column (never written by A3). Labelled so reports
 * and A5 can identify it. No rankings exist yet.
 */
export const A3_PLACEHOLDER_STATUS: SportingStatusProvider = {
  id: "A3_PLACEHOLDER_PROFESSIONAL_STATUS",
  human(root) {
    const home = (root.settings_snapshot?.homeLocality as string | undefined) ?? "ayrshire";
    const country = home === "ayrshire" ? "GBR" : (localityByRegion(home)?.country ?? "GBR");
    return { country, zone: zoneOf(country), locality: home, professionalStatus: root.has_tour_card ? "PROFESSIONAL" : "AMATEUR", tourCard: root.has_tour_card };
  },
  npcTourCard: npc => npc.professionalStatus === "PROFESSIONAL",
  rankings: () => ({}),
};

export const NO_SEEDING: SeedingProvider = { id: "NONE", order: () => [] };

export type CalendarProviders = { sportingStatus: SportingStatusProvider; seeding: SeedingProvider };
export const DEFAULT_PROVIDERS: CalendarProviders = { sportingStatus: A3_PLACEHOLDER_STATUS, seeding: NO_SEEDING };

export function npcFacts(npc: Npc) {
  const locality = localityByRegion(npc.homeRegion);
  return { country: npc.nationality, zone: zoneOf(npc.nationality), locality: locality?.key ?? null };
}
