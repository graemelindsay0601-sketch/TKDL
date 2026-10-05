/**
 * A4 finance content, version 1. Every value is integer pence (GBP), matching A1.
 * Shipped versions are immutable: retune by publishing FINANCE_VERSION 2 and
 * pinning saves explicitly. Historic events keep the snapshot they were charged
 * and paid under (career_event_finance / career_prize_awards / prize tables).
 */
export const FINANCE_VERSION = 1;
export const SPONSOR_DATABASE_VERSION = 1;
export const SUPPORTED_FINANCE_VERSIONS = [1] as const;
export const CURRENCY = "GBP";
export const WEEKS = 52;

export const LEDGER_CATEGORIES = [
  "CAREER_START", "ENTRY_FEE", "TRAVEL", "ACCOMMODATION", "PRIZE",
  "SPONSOR_SIGNING_BONUS", "SPONSOR_EVENT_PAYMENT", "SPONSOR_PERFORMANCE_BONUS",
  "COMMERCIAL_APPEARANCE", "MERCHANDISE_ROYALTY",
  "REFUND", "ADJUSTMENT",
] as const;
export type LedgerCategory = typeof LEDGER_CATEGORIES[number];
/** Every row belongs to exactly one headline, so start + earnings + sponsor − expenses = balance. */
export const HEADLINES = ["START", "EARNINGS", "SPONSOR", "EXPENSE"] as const;
export type Headline = typeof HEADLINES[number];
export const HEADLINE_OF: Record<Exclude<LedgerCategory, "ADJUSTMENT" | "REFUND">, Headline> = {
  CAREER_START: "START", ENTRY_FEE: "EXPENSE", TRAVEL: "EXPENSE", ACCOMMODATION: "EXPENSE", PRIZE: "EARNINGS",
  SPONSOR_SIGNING_BONUS: "SPONSOR", SPONSOR_EVENT_PAYMENT: "SPONSOR", SPONSOR_PERFORMANCE_BONUS: "SPONSOR",
  COMMERCIAL_APPEARANCE: "SPONSOR", MERCHANDISE_ROYALTY: "SPONSOR",
};

// ------------------------------------------------------------------ entry fees
export type FeeProfile = { key: string; entryFeePence: number; basis: "PER_EVENT" | "PER_SERIES"; refundPolicy: string };
const fee = (key: string, entryFeePence: number, refundPolicy = "standard", basis: FeeProfile["basis"] = "PER_EVENT"): FeeProfile => ({ key, entryFeePence, basis, refundPolicy });
/** Keyed by the A3 snapshot reference `profiles.entryFee`. */
export const FEE_PROFILES: Record<string, FeeProfile> = {
  "fee:grassroots": fee("fee:grassroots", 500, "local"),
  /** A6.5: Junior Development Circuit entries are free (youth development). */
  "fee:junior": fee("fee:junior", 0, "local"),
  "fee:special": fee("fee:special", 300, "local"),
  "fee:county": fee("fee:county", 1000, "local"),
  "fee:regional": fee("fee:regional", 2000),
  "fee:national_amateur": fee("fee:national_amateur", 3500),
  "fee:challenger": fee("fee:challenger", 5000),
  "fee:vault": fee("fee:vault", 3000),
  "fee:q_school": fee("fee:q_school", 30000, "q_school", "PER_SERIES"),
  "fee:pro_circuit": fee("fee:pro_circuit", 10000),
  "fee:european_series": fee("fee:european_series", 15000),
  "fee:world_series": fee("fee:world_series", 0),
  "fee:invitational": fee("fee:invitational", 0),
  "fee:major": fee("fee:major", 0),
  "fee:world_championship": fee("fee:world_championship", 0),
};
/** Definition-level overrides (still data, not service branches). */
export const FEE_OVERRIDES: Record<string, FeeProfile> = {
  "sunday-league-sprint": fee("fee:sunday-league", 0, "local"),
  "sudden-death-night": fee("fee:sudden-death", 0, "local"),
  "open-championship-qualifier": fee("fee:open-qualifier", 4000),
  "european-series-qualifier": fee("fee:eds-qualifier", 5000),
  "world-championship-qualifier": fee("fee:wc-qualifier", 7500),
  "amateur-world-qualifier": fee("fee:amateur-wc-qualifier", 4000),
  "vault-qualifier": fee("fee:vault-qualifier", 4000),
  "q-school-final-uk_ireland-d1": fee("fee:q-school-final", 45000, "q_school", "PER_SERIES"),
  "q-school-final-uk_ireland-d2": fee("fee:q-school-final", 45000, "q_school", "PER_SERIES"),
  "q-school-final-uk_ireland-d3": fee("fee:q-school-final", 45000, "q_school", "PER_SERIES"),
  "q-school-final-uk_ireland-d4": fee("fee:q-school-final", 45000, "q_school", "PER_SERIES"),
  "q-school-final-europe-d1": fee("fee:q-school-final", 45000, "q_school", "PER_SERIES"),
  "q-school-final-europe-d2": fee("fee:q-school-final", 45000, "q_school", "PER_SERIES"),
  "q-school-final-europe-d3": fee("fee:q-school-final", 45000, "q_school", "PER_SERIES"),
  "q-school-final-europe-d4": fee("fee:q-school-final", 45000, "q_school", "PER_SERIES"),
};

// ------------------------------------------------------------------ refunds
/** Percentages are whole numbers 0..100. */
export type RefundPolicy = { key: string; withdrawBeforeCloseEntryPercent: number; lateWithdrawEntryPercent: number;
  cancelledEntryPercent: number; cancelledTravelPercent: number; cancelledAccommodationPercent: number };
export const REFUND_POLICIES: Record<string, RefundPolicy> = {
  local: { key: "local", withdrawBeforeCloseEntryPercent: 100, lateWithdrawEntryPercent: 0, cancelledEntryPercent: 100, cancelledTravelPercent: 0, cancelledAccommodationPercent: 0 },
  standard: { key: "standard", withdrawBeforeCloseEntryPercent: 80, lateWithdrawEntryPercent: 0, cancelledEntryPercent: 100, cancelledTravelPercent: 0, cancelledAccommodationPercent: 0 },
  q_school: { key: "q_school", withdrawBeforeCloseEntryPercent: 50, lateWithdrawEntryPercent: 0, cancelledEntryPercent: 100, cancelledTravelPercent: 0, cancelledAccommodationPercent: 0 },
};

// ------------------------------------------------------------------ travel / accommodation
export const TRAVEL_BANDS = ["LOCAL", "DOMESTIC", "UK_IRELAND", "EUROPE", "LONG_HAUL"] as const;
export type TravelBand = typeof TRAVEL_BANDS[number];
/** Round trip per trip (not per event) and nightly rate, by band. */
export const TRAVEL_PROFILE: Record<TravelBand, { roundTripPence: number; nightlyPence: number; extraNights: number; overnightFromDays: number }> = {
  LOCAL: { roundTripPence: 0, nightlyPence: 0, extraNights: 0, overnightFromDays: 99 },
  DOMESTIC: { roundTripPence: 6000, nightlyPence: 7000, extraNights: 0, overnightFromDays: 2 },
  UK_IRELAND: { roundTripPence: 9000, nightlyPence: 8000, extraNights: 0, overnightFromDays: 1 },
  EUROPE: { roundTripPence: 18000, nightlyPence: 9000, extraNights: 1, overnightFromDays: 1 },
  LONG_HAUL: { roundTripPence: 90000, nightlyPence: 12000, extraNights: 2, overnightFromDays: 1 },
};
/** Venues within easy reach of a home locality (no travel, no hotel). */
export const NEARBY_VENUES: Record<string, string[]> = {
  ayrshire: ["glasgow-hall", "castle-exchange-edinburgh"],
  highlands: ["glasgow-hall", "castle-exchange-edinburgh"],
  "north-east": ["northern-forum-newcastle"],
  midlands: ["midlands-oche"],
  "south-wales": ["riverside-hall-cardiff"],
  leinster: ["harbour-rooms-dublin"],
};
/** Consecutive entered events at the same destination within this gap form one trip. */
export const TRIP_MAX_GAP_DAYS = 1;

// ------------------------------------------------------------------ prizes
/** Bands by finishing position: 1 champion, 2 runner-up, 3 semi, 5 quarter, 9 L16, 17 L32, 33 L64, 65 L128. */
export type PrizeProfile = { key: string; bands: { upToPosition: number; amountPence: number }[] };
const prize = (key: string, ...amounts: number[]): PrizeProfile => {
  const positions = [1, 2, 4, 8, 16, 32, 64, 128];
  return { key, bands: amounts.map((amountPence, i) => ({ upToPosition: positions[i], amountPence })).filter(b => b.amountPence > 0) };
};
export const PRIZE_PROFILES: Record<string, PrizeProfile> = {
  "prize:grassroots": prize("prize:grassroots", 2500, 1000),
  "prize:special": prize("prize:special", 2000, 500),
  "prize:county": prize("prize:county", 7500, 3000, 1500),
  "prize:regional": prize("prize:regional", 15000, 6000, 3000, 1500),
  "prize:national_amateur": prize("prize:national_amateur", 50000, 20000, 10000, 5000, 2500),
  "prize:challenger": prize("prize:challenger", 200000, 100000, 50000, 25000, 12500, 6000, 3000),
  "prize:vault": prize("prize:vault", 100000, 50000, 25000, 10000, 5000),
  "prize:q_school": prize("prize:q_school"),
  "prize:pro_circuit": prize("prize:pro_circuit", 1500000, 1000000, 500000, 300000, 200000, 150000, 100000),
  "prize:european_series": prize("prize:european_series", 2500000, 1200000, 800000, 500000, 300000, 200000),
  "prize:world_series": prize("prize:world_series", 2000000, 1000000, 600000, 400000),
  "prize:invitational": prize("prize:invitational", 6000000, 3000000, 1500000, 800000, 500000),
  "prize:major": prize("prize:major", 10000000, 5000000, 2500000, 1500000, 750000, 500000, 250000, 100000),
  "prize:world_championship": prize("prize:world_championship", 50000000, 20000000, 10000000, 5000000, 3500000, 2500000, 1500000),
};
export const PRIZE_OVERRIDES: Record<string, PrizeProfile> = {
  "sunday-league-sprint": prize("prize:sunday-league", 1000),
  "open-championship-qualifier": prize("prize:qualifier-small", 5000, 2500),
  "european-series-qualifier": prize("prize:qualifier-small", 5000, 2500),
  "world-championship-qualifier": prize("prize:qualifier-medium", 10000, 5000, 2500),
  "amateur-world-qualifier": prize("prize:qualifier-medium", 10000, 5000, 2500),
  "vault-qualifier": prize("prize:qualifier-small", 5000, 2500),
};
export const prizeForPosition = (profile: PrizeProfile, position: number) =>
  profile.bands.find(b => position <= b.upToPosition)?.amountPence ?? 0;

export const OFFER_LIFETIME_WEEKS = 4;
export const MAX_OFFERS_PER_EVALUATION = 2;
