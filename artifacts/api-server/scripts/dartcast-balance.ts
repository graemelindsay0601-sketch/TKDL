/**
 * DartCast balance: plays a channel forward week by week with the real stream formulas (opening viewers, every visit's
 * chat, follows, cheers and subs, ads, renewals) and the business layers (brand deals, campaigns, the sponsor ladder,
 * brand partners, affiliate codes), and reports followers, tier and income per season. Darts results are sampled
 * (moments per visit), not thrown. Usage: node scripts/dartcast-balance.ts [seasons=6] [streamsPerWeek=3] [seed]
 */
import { CAMPAIGN_PAY, STREAM, STREAM_MONEY, adRevenuePence, chatForMoment, monthlyChurn, dealFee, openingViewers, renewals, streamIncome, subPayout, tierFor, type Tally } from "../src/career/streaming/model.ts";
import { SPONSOR_LADDER, sponsorWeeklyPence, affiliatePayout } from "../src/career/streaming/business.ts";
import { PARTNERS, retainerPence } from "../src/career/streaming/partners.ts";
import { scopedRandom } from "../src/career/world/random.ts";

const seasons = Number(process.argv[2] ?? 6), perWeek = Number(process.argv[3] ?? 3), seed = process.argv[4] ?? "b".repeat(64);
const MOMENTS: [string, number][] = [["IDLE", 0.46], ["YOU_TON", 0.2], ["YOU_LOW", 0.1], ["YOU_180", 0.03], ["YOU_CHECKOUT", 0.06], ["YOU_BIG_CHECKOUT", 0.01],
  ["THEM_CHECKOUT", 0.05], ["YOU_BUST", 0.04], ["THEM_180", 0.02], ["WON", 0.02], ["LOST", 0.01]];
const momentOf = (r: number) => { let a = 0; for (const [m, p] of MOMENTS) { a += p; if (r < a) return m; } return "IDLE"; };
const VISITS = 34;

let followers = 20, subscribers = 0, ladderRung = 0, ladderWeeks = 0;
const rows: Record<string, unknown>[] = [];
for (let season = 1; season <= seasons; season++) {
  const pay = { streams: 0, ads: 0, subs: 0, deals: 0, campaigns: 0, ladder: 0, partners: 0, affiliate: 0 };
  let viewerMinutesMonth = 0, avgViewers = 0, viewSamples = 0, streamedWeeksInMonth = 0, dealsThisSeason = 0, dealStreamsLeft = 0, dealFeeNow = 0;
  for (let week = 1; week <= 52; week++) {
    const tier = tierFor(followers).key;
    let liveThisWeek = false;
    for (let n = 0; n < perWeek; n++) {
      const key = `${season}:${week}:${n}`;
      const open = Math.max(1, Math.round(openingViewers(seed, key, followers, 0, 2 + n * 2, n === 0 ? 4 : 2)));
      let tally: Tally = { viewers: open, peak: open, hype: 0, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0,
        ov: { startFollowers: followers, openedWith: open } } as Tally;
      const rng = scopedRandom(seed, 1, "balance-moments", key);
      for (let v = 0; v < VISITS; v++) tally = chatForMoment(seed, key, v, momentOf(rng()), tally, tier).tally;
      followers += tally.followersGained; subscribers += tally.subs;
      pay.streams += streamIncome(tally); viewerMinutesMonth += tally.viewerMinutes ?? 0;
      avgViewers += (tally.viewers + tally.peak) / 2; viewSamples++; liveThisWeek = true;
      if (dealStreamsLeft > 0) { pay.deals += dealFeeNow; dealStreamsLeft--; }
    }
    if (liveThisWeek) streamedWeeksInMonth++;
    const avg = viewSamples ? avgViewers / viewSamples : 0;
    // A brand deal when a Partner has none on the go (two a season); one campaign a month.
    if (tierFor(followers).key !== "NEWCOMER" && tierFor(followers).key !== "AFFILIATE") {
      if (dealStreamsLeft === 0 && dealsThisSeason < STREAM_MONEY.dealsPerSeason && week % 13 === 1) { dealsThisSeason++; dealStreamsLeft = STREAM_MONEY.dealStreams; dealFeeNow = dealFee(avg); }
      if (week % 4 === 1) pay.campaigns += Math.round(Math.min(CAMPAIGN_PAY.capPence, Math.max(CAMPAIGN_PAY.floorPence, dealFee(avg) * CAMPAIGN_PAY.multiple)));
    }
    // The ladder: always signed at the highest rung open, paid each live week.
    const open = SPONSOR_LADDER.filter(r => followers >= r.minFollowers && ["NEWCOMER", "AFFILIATE", "PARTNER", "STAR", "ICON", "LEGEND"].indexOf(tierFor(followers).key) >= ["NEWCOMER", "AFFILIATE", "PARTNER", "STAR", "ICON", "LEGEND"].indexOf(r.minTier));
    if (open.length && ladderRung < open.length) { if (ladderWeeks === 0) ladderRung = Math.min(open.length, ladderRung + 1); }
    if (ladderRung > 0 && liveThisWeek) { pay.ladder += sponsorWeeklyPence(ladderRung, avg, false); ladderWeeks++; if (ladderWeeks >= SPONSOR_LADDER[ladderRung - 1].weeks) ladderWeeks = 0; }
    // Brand partners: every slot filled with a retainer, paid each live week.
    const slots = PARTNERS.slots[tierFor(followers).key] ?? 0;
    if (liveThisWeek) pay.partners += slots * retainerPence(tierFor(followers).key, avg, 2, false);
    if (week % 4 === 0) {
      followers -= monthlyChurn(followers, streamedWeeksInMonth > 0);
      const renewed = renewals(subscribers, streamedWeeksInMonth > 0); pay.subs += subPayout(renewed); subscribers = renewed;
      pay.ads += adRevenuePence(viewerMinutesMonth, streamedWeeksInMonth, followers);
      if (tierFor(followers).key !== "NEWCOMER") pay.affiliate += affiliatePayout(seed, `${season}:${week}`, followers, streamedWeeksInMonth, false);
      viewerMinutesMonth = 0; streamedWeeksInMonth = 0;
    }
  }
  const total = Object.values(pay).reduce((a, b) => a + b, 0);
  rows.push({ season, followers, tier: tierFor(followers).name, avgViewers: Math.round(avgViewers / Math.max(1, viewSamples)),
    totalPounds: Math.round(total / 100), ...Object.fromEntries(Object.entries(pay).map(([k, v]) => [k, Math.round(v / 100)])) });
}
console.table(rows);
