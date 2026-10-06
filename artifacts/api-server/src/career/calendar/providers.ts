import type { Npc, Tier } from "../world/types.ts";
import { zoneOf, localityByRegion, localityByKey, type Zone } from "./geography.ts";
import type { CareerExecutor } from "../database.ts";
import type { DenialReason } from "./eligibility.ts";
import type { InstanceRow, RootRow } from "./engine.ts";

/**
 * Provider boundaries for authority A3 does not own.
 *
 * Production composes A5's persisted `sportingStatus` and `seeding`.
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
  /** A5: NPC professional status as a sporting fact (Tour Card), replacing the A2 tier label. */
  npcProfessionalStatus?(npc: Npc): "AMATEUR" | "PROFESSIONAL";
  /**
   * A5: tier used ONLY for A3 participation weighting (who is likely to enter).
   * A3's authored weights assume "professional tier == card holder"; A5 maps card
   * holders/non-holders onto those weights. Never affects ability or results.
   */
  selectionTier?(npc: Npc): Tier;
}

export interface SeedingProvider {
  readonly id: string;
  /** Ordered participant keys for a list, best first. Empty = unseeded draw. */
  order(list: string, entrants: readonly string[]): string[];
}

/**
 * Bootstrap/isolated-A3-test adapter ONLY. Production is bound by A5_SPORTING.
 * Reads the human's A5-maintained cache and A2's founding labels; never awards
 * cards, writes professional status, publishes rankings or invents positions.
 */
export const BOOTSTRAP_STATUS: SportingStatusProvider = {
  id: "BOOTSTRAP_UNRANKED_STATUS",
  human(root) {
    const home = (root.settings_snapshot?.homeLocality as string | undefined) ?? "ayrshire";
    // A6.5 fix: `homeLocality` is a locality KEY ("leinster"); the region-name lookup ("Leinster") never
    // matched, so every chosen home outside Ayrshire was treated as GBR (no local events for IRL/NLD/DEU…).
    // Unreachable before A6.5 made the home region selectable; GBR homes are unaffected.
    const country = home === "ayrshire" ? "GBR" : ((localityByKey(home) ?? localityByRegion(home))?.country ?? "GBR");
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

/**
 * A5 sporting boundary. A3 stays the event/result authority; A5 owns rankings,
 * Tour Cards and Q-School. `bind` returns status/seeding providers backed by the
 * save's persisted A5 state, loaded inside the caller's (root-locked) transaction.
 */
export type SportingResult = { participant_key: string; participant_kind: string; npc_id: string | null; finishing_position: number; is_champion: boolean; legs_for: number; legs_against: number };
export interface CalendarSportingHooks {
  bind(tx: CareerExecutor, root: RootRow): Promise<{ sportingStatus: SportingStatusProvider; seeding: SeedingProvider }>;
  /** Immutable results exist (after A4 prize processing), same transaction. */
  onEventCompleted(tx: CareerExecutor, root: RootRow, event: InstanceRow, results: readonly SportingResult[]): Promise<void>;
  /** A week has been fully played out (not blocked), same transaction that marks it played. */
  afterWeek(tx: CareerExecutor, root: RootRow, season: number, week: number): Promise<void>;
  /** The calendar clock moved to (season, week). */
  onCalendarMoved(tx: CareerExecutor, root: RootRow, season: number, week: number): Promise<void>;
}

export type CalendarProviders = { sportingStatus: SportingStatusProvider; seeding: SeedingProvider; finance?: CalendarFinanceHooks; sporting?: CalendarSportingHooks;
  history?: { afterSeason(tx:CareerExecutor,root:RootRow,season:number):Promise<void>; pending(tx:CareerExecutor,root:RootRow):Promise<number|null> } };
export const DEFAULT_PROVIDERS: CalendarProviders = { sportingStatus: BOOTSTRAP_STATUS, seeding: NO_SEEDING };

export function npcFacts(npc: Npc) {
  const locality = localityByRegion(npc.homeRegion);
  return { country: npc.nationality, zone: zoneOf(npc.nationality), locality: locality?.key ?? null };
}
