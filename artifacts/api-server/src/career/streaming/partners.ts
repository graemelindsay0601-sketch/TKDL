import { scopedRandom } from "../world/random.ts";
import { CUPS } from "./cups.ts";
import { STREAM, brandViewers, tierAtLeast, type TierKey } from "./model.ts";

/**
 * Brand partners: how real creators are sponsored beyond one headline name. Alongside the sponsor ladder you hold a few
 * category partners at once (one brand per category, so two energy drinks never share your stream), and each offer comes
 * as a different kind of deal:
 * - Retainer: a weekly fee for every live week, for a run of weeks.
 * - Giveaway: run a giveaway on your next stream: a fee and a burst of new followers.
 * - Gifted kit: product sent to you to use on stream. No fee, but the brand gets to know you (faster to bigger deals).
 * - Ambassador: a season-long partnership with a brand you've worked with before: the biggest weekly fee.
 * - Cup title sponsor: the brand puts its name on the next Creator Cup and pays you when you play it.
 * - Appearance: turn up at the brand's event (a shop opening, a trade show): a one-off fee and a few followers.
 * Brands remember you: every finished deal with a brand makes its next offers better. A manager finds more of them.
 * Money and followers only; none of it touches your darts.
 */
/** A manager's cut-better rate (the same as on brand deals). */
export const PARTNER_MANAGER = 1.2;

export const BRAND_CATEGORIES = {
  DRINKS: "Energy and soft drinks", GEAR: "Gaming and streaming gear", DARTS: "Darts equipment", APPAREL: "Clothing",
  FOOD: "Food and takeaway", TECH: "Tech and apps", MOTORS: "Motors", LOCAL: "Local business", GAMES: "Games", TRAVEL: "Travel",
} as const;
export type BrandCategory = keyof typeof BRAND_CATEGORIES;

/** The roster: each brand has a category and the smallest channel it will work with. */
export const BRAND_ROSTER: readonly { key: string; name: string; category: BrandCategory; minTier: TierKey; what: string }[] = [
  { key: "double-top-kebabs", name: "Double Top Kebabs", category: "FOOD", minTier: "NEWCOMER", what: "a late-night takeaway chain" },
  { key: "bullseye-arms", name: "The Bullseye Arms", category: "LOCAL", minTier: "NEWCOMER", what: "a darts pub" },
  { key: "arrows-and-ale", name: "Arrows & Ale", category: "LOCAL", minTier: "NEWCOMER", what: "a darts shop" },
  { key: "corner-chippy", name: "The Golden Fryer", category: "FOOD", minTier: "NEWCOMER", what: "a chip shop" },
  { key: "checkout-cabs", name: "Checkout Cabs", category: "MOTORS", minTier: "AFFILIATE", what: "a taxi firm" },
  { key: "gripline", name: "GripLine", category: "DARTS", minTier: "AFFILIATE", what: "finger wax and grips" },
  { key: "oche-threads", name: "Oche Threads", category: "APPAREL", minTier: "AFFILIATE", what: "darts shirts" },
  { key: "pixel-mic", name: "PixelMic", category: "GEAR", minTier: "AFFILIATE", what: "streaming microphones" },
  { key: "fizz-rocket", name: "Fizz Rocket", category: "DRINKS", minTier: "AFFILIATE", what: "a fizzy drink" },
  { key: "bed-and-board", name: "Bed & Board", category: "TRAVEL", minTier: "AFFILIATE", what: "a hotel chain" },
  { key: "pocket-oche", name: "Pocket Oche", category: "GAMES", minTier: "AFFILIATE", what: "a darts mobile game" },
  { key: "northern-oche-motors", name: "Northern Oche Motors", category: "MOTORS", minTier: "PARTNER", what: "a car dealership" },
  { key: "flightdeck", name: "FlightDeck", category: "DARTS", minTier: "PARTNER", what: "flights and stems" },
  { key: "oche-energy", name: "Oche Energy", category: "DRINKS", minTier: "PARTNER", what: "an energy drink" },
  { key: "boardroom-gaming", name: "Boardroom Gaming", category: "GEAR", minTier: "PARTNER", what: "gaming chairs" },
  { key: "shieldnet-vpn", name: "ShieldNet", category: "TECH", minTier: "PARTNER", what: "a VPN" },
  { key: "triple-twenty-wear", name: "Triple Twenty", category: "APPAREL", minTier: "PARTNER", what: "a streetwear label" },
  { key: "hot-slice", name: "Hot Slice", category: "FOOD", minTier: "PARTNER", what: "a pizza delivery app" },
  { key: "wing-it-air", name: "Wing It Air", category: "TRAVEL", minTier: "PARTNER", what: "a budget airline" },
  { key: "legends-of-the-oche", name: "Legends of the Oche", category: "GAMES", minTier: "PARTNER", what: "a console darts game" },
  { key: "tungsten-toms", name: "Tungsten Tom's", category: "DARTS", minTier: "STAR", what: "darts and barrels" },
  { key: "voltline-mobile", name: "Voltline", category: "TECH", minTier: "STAR", what: "a mobile network" },
  { key: "apex-audio", name: "Apex Audio", category: "GEAR", minTier: "STAR", what: "headsets and webcams" },
  { key: "glacier-cola", name: "Glacier Cola", category: "DRINKS", minTier: "STAR", what: "a big cola brand" },
  { key: "crown-motors", name: "Crown Motors", category: "MOTORS", minTier: "STAR", what: "a national car maker" },
];
export const brandByKey = (key: string) => BRAND_ROSTER.find(b => b.key === key) ?? null;

export const DEAL_KINDS = {
  RETAINER: { name: "Retainer", blurb: "A weekly fee for every week you go live." },
  GIVEAWAY: { name: "Giveaway", blurb: "Give away their product on your next stream: a fee and new followers." },
  SEEDING: { name: "Gifted kit", blurb: "They send you kit to use on stream. No fee, but they get to know you." },
  AMBASSADOR: { name: "Ambassador", blurb: "A long partnership with a brand that knows you: the biggest weekly fee." },
  CUP_TITLE: { name: "Cup title sponsor", blurb: "Their name on the next Creator Cup; paid when you play it." },
  APPEARANCE: { name: "Appearance", blurb: "Turn up at their event: a one-off fee and a few followers." },
} as const;
export type DealKind = keyof typeof DEAL_KINDS;

export const PARTNERS = Object.freeze({
  /** Category partners you can hold at once, by tier. */
  slots: { NEWCOMER: 0, AFFILIATE: 1, PARTNER: 2, STAR: 3, ICON: 4, LEGEND: 5 } as Record<TierKey, number>,
  /** An offer every this many weeks while a slot is free (a manager finds one every two). */
  offerEvery: 3, managerOfferEvery: 2, offerWeeks: 2,
  /** Weekly retainer base by tier, plus a share of the average audience. */
  retainerBase: { NEWCOMER: 1_000, AFFILIATE: 1_500, PARTNER: 2_000, STAR: 7_000, ICON: 14_000, LEGEND: 24_000 } as Record<TierKey, number>,
  retainerPerViewer: 6, retainerWeeks: 8, ambassadorWeeks: 26, ambassadorRate: 2,
  giveawayFee: 3, giveawayFollowers: { NEWCOMER: 10, AFFILIATE: 40, PARTNER: 200, STAR: 900, ICON: 3_000, LEGEND: 10_000 } as Record<TierKey, number>,
  seedingWeeks: 6, seedingTrust: 2,
  cupTitleFee: 4, appearanceFee: 2, appearanceFollowers: { NEWCOMER: 5, AFFILIATE: 20, PARTNER: 80, STAR: 300, ICON: 1_000, LEGEND: 3_000 } as Record<TierKey, number>,
  /** Each finished deal with a brand adds this to its next fees, up to the cap. Ambassador needs this much history. */
  trustStep: 0.1, trustCap: 0.5, ambassadorTrust: 2,
});

/** How much better a brand pays you for the history you have with it. */
export const trustBonus = (trust: number) => Math.min(PARTNERS.trustCap, Math.max(0, trust) * PARTNERS.trustStep);

/** A retainer's weekly fee: by tier and audience, with brand trust and a manager. Rounded to whole pounds. */
export function retainerPence(tier: TierKey, averageViewers: number, trust: number, manager: boolean) {
  const base = PARTNERS.retainerBase[tier] + brandViewers(averageViewers) * PARTNERS.retainerPerViewer;
  return Math.round(base * (1 + trustBonus(trust)) * (manager ? PARTNER_MANAGER : 1) / 100) * 100;
}

/** The fee and run of an offer of a given kind (weekly kinds: per live week; one-offs: in full). */
export function dealTerms(kind: DealKind, tier: TierKey, averageViewers: number, trust: number, manager: boolean) {
  const weekly = retainerPence(tier, averageViewers, trust, manager);
  switch (kind) {
    case "RETAINER": return { feePence: weekly, weeks: PARTNERS.retainerWeeks, followers: 0 };
    case "AMBASSADOR": return { feePence: Math.round(weekly * PARTNERS.ambassadorRate / 100) * 100, weeks: PARTNERS.ambassadorWeeks, followers: 0 };
    case "GIVEAWAY": return { feePence: weekly * PARTNERS.giveawayFee, weeks: 1, followers: PARTNERS.giveawayFollowers[tier] };
    case "SEEDING": return { feePence: 0, weeks: PARTNERS.seedingWeeks, followers: 0 };
    case "CUP_TITLE": return { feePence: weekly * PARTNERS.cupTitleFee, weeks: 1, followers: 0 };
    case "APPEARANCE": return { feePence: weekly * PARTNERS.appearanceFee, weeks: 1, followers: PARTNERS.appearanceFollowers[tier] };
  }
}

/** The Creator Cup a title sponsor would put its name on: one opening within the next four weeks, if any. */
export const upcomingCup = (week: number) => {
  const i = CUPS.weeks.findIndex(w => w > week && w - week <= 4);
  return i < 0 ? null : { n: i + 1, name: CUPS.names[i], opens: CUPS.weeks[i], closes: CUPS.weeks[i] + CUPS.window - 1 };
};

/**
 * The next offer, deterministic per save and offer number: a brand that will work with your tier, in a category you're
 * free in, and a kind of deal that suits it (an ambassadorship only from a brand that knows you well; a cup title only
 * with a cup coming up). Null when no brand fits.
 */
export function nextOffer(seed: string, n: number, tier: TierKey, week: number, blocked: ReadonlySet<string>, trust: ReadonlyMap<string, number>) {
  const rng = scopedRandom(seed, STREAM.version, "stream-partner-offer", n);
  const fits = BRAND_ROSTER.filter(b => tierAtLeast(tier, b.minTier) && !blocked.has(b.category));
  if (!fits.length) return null;
  // Brands that already know you call a little more often.
  const weighted = fits.flatMap(b => Array(1 + Math.min(2, trust.get(b.key) ?? 0)).fill(b) as typeof fits);
  const brand = weighted[Math.floor(rng() * weighted.length)];
  const t = trust.get(brand.key) ?? 0, cup = upcomingCup(week);
  const kinds: DealKind[] = ["RETAINER", "RETAINER", "GIVEAWAY", "SEEDING", "APPEARANCE"];
  if (t >= PARTNERS.ambassadorTrust) kinds.push("AMBASSADOR", "AMBASSADOR");
  if (cup && tierAtLeast(tier, "AFFILIATE")) kinds.push("CUP_TITLE");
  const kind = kinds[Math.floor(rng() * kinds.length)];
  return { brand, kind, cup: kind === "CUP_TITLE" ? cup : null };
}
