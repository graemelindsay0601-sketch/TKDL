import type { Npc } from "../world/types.ts";
import { zoneOf, localityByRegion, type Zone } from "./geography.ts";
import type { CareerExecutor } from "../database.ts";
import type { DenialReason } from "./eligibility.ts";
import type { InstanceRow, RootRow } from "./engine.ts";

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

/**
 * A4 finance boundary. A3 stays the sporting authority and calls these hooks inside
 * its own transactions so sporting + financial effects commit or roll back together.
 * Absent hooks = A3 behaves exactly as locked (all A3 tests run without them).
 */
export interface CalendarFinanceHooks {
  /** Extra denials (e.g. INSUFFICIENT_FUNDS) for entering this event/series now. */
  entryCheck(tx: CareerExecutor, root: RootRow, event: InstanceRow, siblings: readonly InstanceRow[]): Promise<DenialReason[]>;
  /** Called after the human's entry rows exist, same transaction. Throw to roll back the entry. */
  onHumanEntry(tx: CareerExecutor, root: RootRow, event: InstanceRow, siblings: readonly InstanceRow[]): Promise<void>;
  onHumanWithdraw(tx: CareerExecutor, root: RootRow, targets: readonly InstanceRow[], postLock: boolean): Promise<void>;
  /** Start of a week's play-out, before any field locks (trip/travel commitment). */
  beforeWeek(tx: CareerExecutor, root: RootRow, season: number, week: number): Promise<void>;
  onEventCancelled(tx: CareerExecutor, root: RootRow, event: InstanceRow, reason: string): Promise<void>;
  onEventCompleted(tx: CareerExecutor, root: RootRow, event: InstanceRow, results: readonly { participant_key: string; finishing_position: number; is_champion: boolean }[]): Promise<void>;
  /** The calendar clock moved to (season, week) — offers/contract lifecycle. */
  onCalendarMoved(tx: CareerExecutor, root: RootRow, season: number, week: number): Promise<void>;
  /** Batch previews for calendar DTOs (no N+1). */
  previews(tx: CareerExecutor, root: RootRow, season: number, events: readonly InstanceRow[]): Promise<Map<string, { affordable: boolean } & Record<string, unknown>>>;
}

export type CalendarProviders = { sportingStatus: SportingStatusProvider; seeding: SeedingProvider; finance?: CalendarFinanceHooks };
export const DEFAULT_PROVIDERS: CalendarProviders = { sportingStatus: A3_PLACEHOLDER_STATUS, seeding: NO_SEEDING };

export function npcFacts(npc: Npc) {
  const locality = localityByRegion(npc.homeRegion);
  return { country: npc.nationality, zone: zoneOf(npc.nationality), locality: locality?.key ?? null };
}
