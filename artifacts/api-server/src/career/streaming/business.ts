import { scopedRandom } from "../world/random.ts";
import { BRANDS, STREAM, brandViewers, tierAtLeast, type TierKey } from "./model.ts";
import { BRAND_ROSTER } from "./partners.ts";

/**
 * The business side of a channel: what turns an audience into a living.
 * - Merch drops: choose an item and how many to make. You pay for the stock up front; it sells over a few weeks to your
 *   loyal regulars and followers (named emotes on the design sell better). The stock you bought is the most you can lose.
 * - Affiliate codes (from Affiliate): a brand gives you a code; each month your viewers' purchases pay you a cut. One at a
 *   time, end it whenever you like.
 * - Your team: an editor (more VOD and Short views) and a manager (better brand fees and campaign rewards), on weekly wages.
 * - The platform offer (Star, once a season): a rival platform pays a big guaranteed sum for a season of exclusivity: no
 *   collabs and a smaller room while it lasts. Take it or leave it.
 * Real money in your Career balance; none of it touches your darts.
 */
export const MERCH_ITEMS = [
  { key: "SHIRT", name: "Channel shirt", unitCostPence: 900, pricePence: 2500, appeal: 1 },
  { key: "FLIGHTS", name: "Signature flights", unitCostPence: 250, pricePence: 800, appeal: 1.3 },
  { key: "MUG", name: "Mug", unitCostPence: 400, pricePence: 1200, appeal: 0.9 },
  { key: "HOODIE", name: "Hoodie", unitCostPence: 1800, pricePence: 4500, appeal: 0.7 },
] as const;
export type MerchKey = typeof MERCH_ITEMS[number]["key"];
export const MERCH = Object.freeze({ batches: [25, 50, 100, 250, 500] as readonly number[], weeks: 4, emoteBoost: 0.25, minFollowers: 50 });

/** This week's sales of a drop: a share of loyal regulars and followers, fading after launch week. */
export function merchSales(seed: string, dropId: string, weekOfDrop: number, item: MerchKey, followers: number, loyalRegulars: number, namedEmotes: number, left: number) {
  if (left <= 0 || weekOfDrop < 1 || weekOfDrop > MERCH.weeks) return 0;
  const rng = scopedRandom(seed, STREAM.version, "stream-merch", dropId, weekOfDrop);
  const def = MERCH_ITEMS.find(m => m.key === item)!;
  const fade = [1, 0.55, 0.3, 0.15][weekOfDrop - 1];
  const demand = (followers * 0.006 + loyalRegulars * 0.5) * def.appeal * (1 + Math.min(3, namedEmotes) * MERCH.emoteBoost) * fade * (0.75 + rng() * 0.5);
  return Math.max(0, Math.min(left, Math.round(demand)));
}

export const AFFILIATE = Object.freeze({ minTier: "AFFILIATE" as TierKey, offerEveryWeeks: 8, pencePerThousandFollowers: 600, managerBonus: 0.15 });
/** A month's affiliate payout: purchases through your code, by audience size. */
export function affiliatePayout(seed: string, key: string, followers: number, streamedWeeks: number, manager: boolean) {
  if (streamedWeeks <= 0) return 0;
  const rng = scopedRandom(seed, STREAM.version, "stream-affiliate", key);
  const base = followers / 1000 * AFFILIATE.pencePerThousandFollowers * Math.min(1, streamedWeeks / 3) * (0.7 + rng() * 0.6);
  return Math.round(base * (manager ? 1 + AFFILIATE.managerBonus : 1) / 100) * 100;
}
/** Which brand offers a code (the n-th offer). */
export const affiliateBrand = (seed: string, n: number) => BRANDS[Math.floor(scopedRandom(seed, STREAM.version, "stream-affiliate-brand", n)() * BRANDS.length)];

export const TEAM = Object.freeze({
  EDITOR: { name: "Video editor", blurb: "Cuts your VODs and Shorts: +40% VOD views, +30% Short views.", wagePence: 6_000, minTier: "AFFILIATE" as TierKey },
  MANAGER: { name: "Talent manager", blurb: "Negotiates for you: +20% on brand deal fees and sponsored campaigns, +15% on affiliate codes.", wagePence: 15_000, minTier: "PARTNER" as TierKey },
});
export type TeamRole = keyof typeof TEAM;
export const EDITOR_VOD = 1.4, EDITOR_SHORT = 1.3, MANAGER_FEES = 1.2;

export const PLATFORM = Object.freeze({ name: "Tilt", offerWeek: 20, perFollowerPence: 40, minPence: 500_000, viewerPenalty: 0.8, seasons: 1 });
/** The platform offer: a guaranteed sum for a season of exclusivity. */
export const platformOfferPence = (followers: number) => Math.max(PLATFORM.minPence, Math.round(followers * PLATFORM.perFollowerPence / 100_00) * 100_00);

export { tierAtLeast };

/**
 * The sponsor ladder: one headline channel sponsor at a time, climbing from a local backer to a darts maker's signature
 * range. Each rung pays a weekly fee for every week you go live with their name on screen (a quiet week simply isn't
 * paid); see the run through and the next rung's brands come calling once your channel is big enough. Walking away early
 * costs nothing, but the rung isn't banked. Finishing a rung wins fans for your darts career too (bigger rungs, more
 * fans), and those fans count with darts sponsors as all your others do.
 */
const rosterFor = (tier: TierKey, darts: boolean) => BRAND_ROSTER.filter(b => b.minTier === tier && (b.category === "DARTS") === darts).map(b => ({ key: b.key, name: b.name, what: b.what }));
export const SPONSOR_LADDER = [
  { rung: 1, key: "LOCAL", name: "Local backer", minTier: "NEWCOMER" as TierKey, minFollowers: 100, weeks: 10, basePence: 1_000, perViewerPence: 5, fans: 25,
    blurb: "A business round the corner puts its name on your stream.", brands: rosterFor("NEWCOMER", false) },
  { rung: 2, key: "REGIONAL", name: "Regional partner", minTier: "AFFILIATE" as TierKey, minFollowers: 500, weeks: 12, basePence: 3_000, perViewerPence: 10, fans: 75,
    blurb: "A firm known across the region backs your channel.", brands: rosterFor("AFFILIATE", false) },
  { rung: 3, key: "NATIONAL", name: "National brand", minTier: "PARTNER" as TierKey, minFollowers: 0, weeks: 16, basePence: 8_000, perViewerPence: 20, fans: 250,
    blurb: "A brand people know nationally: adverts, a logo on your shirt, a launch event.", brands: [...rosterFor("PARTNER", false), ...rosterFor("STAR", false)] },
  { rung: 4, key: "SIGNATURE", name: "Signature range", minTier: "STAR" as TierKey, minFollowers: 0, weeks: 20, basePence: 20_000, perViewerPence: 35, fans: 800,
    blurb: "A darts maker launches a signature range with your name on it.", brands: BRAND_ROSTER.filter(b => b.category === "DARTS").map(b => ({ key: b.key, name: b.name, what: `your signature ${b.what}` })) },
];
export const SPONSOR = Object.freeze({ offerWeeks: 3, retryWeeks: 4 });
/** A rung's weekly fee, fixed when it's offered: a base plus your average audience, to the nearest pound. */
export const sponsorWeeklyPence = (rung: number, averageViewers: number, manager: boolean) => {
  const r = SPONSOR_LADDER[rung - 1];
  return Math.round((r.basePence + brandViewers(averageViewers) * r.perViewerPence) * (manager ? MANAGER_FEES : 1) / 100) * 100;
};
/** Which brand on the rung comes calling (the n-th sponsor offer). */
export const sponsorBrand = (seed: string, rung: number, n: number) => {
  const brands = SPONSOR_LADDER[rung - 1].brands;
  return brands[Math.floor(scopedRandom(seed, STREAM.version, "stream-sponsor-brand", rung, n)() * brands.length)];
};
