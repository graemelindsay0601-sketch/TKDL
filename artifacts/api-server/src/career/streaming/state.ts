import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { post } from "../finance/ledger.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { STREAM, STREAM_MONEY, brandFor, clipOutcome, dealFee, goalBonus, renewals, subPayout, tierFor, type ClipKind, type TierKey } from "./model.ts";
import { CURRENT_SPONSOR_DATABASE_VERSION, sponsorCatalogue } from "../finance/sponsors.catalogue.ts";

/** Once the tables are known to exist they always will (the schema repair adds them at startup; some test databases skip it). */
let seen = false;
async function ready(tx: CareerExecutor) {
  if (!seen) seen = (await tx.execute(sql`SELECT to_regclass('career_stream_deals') IS NOT NULL AS ok`)).rows[0]?.ok === true;
  return seen;
}

/** Your stream nights this season (absolute day to stream id): a stream night is booked like any other night. */
export async function streamNights(tx: CareerExecutor, saveId: string, season: number): Promise<Map<number, string>> {
  if (!await ready(tx)) return new Map();
  return new Map((await tx.execute(sql`SELECT day, id FROM career_streams WHERE career_save_id=${saveId} AND season=${season} AND format <> 'MATCH'`)).rows.map(r => [Number(r.day), String(r.id)]));
}

/** Your step on the streamer route (null with no channel yet). */
export async function streamTier(tx: CareerExecutor, saveId: string): Promise<TierKey | null> {
  if (!await ready(tx)) return null;
  const row = (await tx.execute(sql`SELECT followers FROM career_stream_channels WHERE career_save_id=${saveId}`)).rows[0];
  return row ? tierFor(Number(row.followers)).key : null;
}

type Root = { id: string; world_seed: string };
/**
 * The channel's week, after the week is played: at the end of every fourth week subscribers renew (fewer if you didn't
 * stream that month) and pay; unanswered brand offers lapse; a Partner with no deal on the go may get a new one.
 */
export async function settleStreamingWeek(tx: CareerExecutor, root: Root, season: number, week: number) {
  if (!await ready(tx)) return;
  const ch = (await tx.execute(sql`SELECT followers, subscribers, renewed_through, sub_goal FROM career_stream_channels WHERE career_save_id=${root.id}`)).rows[0];
  if (!ch) return;
  const month = `${season}:${week}`;
  // The month's sub goal: hit it and the buzz wins followers; either way it's settled once.
  const goal = ch.sub_goal as { season: number; month: number; target: number; status: string } | null;
  if (week % STREAM_MONEY.monthWeeks === 0 && goal && goal.status === "ON" && goal.season === season && goal.month === week / STREAM_MONEY.monthWeeks) {
    const hit = await subsThisMonth(tx, root.id, season, goal.month) >= goal.target;
    await tx.execute(sql`UPDATE career_stream_channels SET sub_goal = sub_goal || ${JSON.stringify({ status: hit ? "HIT" : "MISSED" })}::jsonb,
      followers = followers + ${hit ? goalBonus(goal.target) : 0} WHERE career_save_id=${root.id}`);
    if (hit) ch.followers = Number(ch.followers) + goalBonus(goal.target);
  }
  if (week % STREAM_MONEY.monthWeeks === 0 && ch.renewed_through !== month && Number(ch.subscribers) > 0) {
    const streamed = (await tx.execute(sql`SELECT 1 FROM career_streams WHERE career_save_id=${root.id} AND season=${season} AND status='ENDED'
      AND week BETWEEN ${week - STREAM_MONEY.monthWeeks + 1} AND ${week} LIMIT 1`)).rows.length > 0;
    const renewed = renewals(Number(ch.subscribers), streamed), pay = subPayout(renewed);
    if (pay > 0) await post(tx, root, { operationKey: `stream-subs:${month}`, category: "STREAM_INCOME", amountPence: pay,
      reason: `DartCast subscriptions: ${renewed} renewed this month`, season, week, detail: { renewed, before: Number(ch.subscribers), streamed } });
    await tx.execute(sql`UPDATE career_stream_channels SET subscribers=${renewed}, renewed_through=${month} WHERE career_save_id=${root.id}`);
  }
  // This week's clips: some go viral, bringing followers (and fans for your darts, counted in your fan following).
  for (const c of (await tx.execute(sql`SELECT id, kind, peak FROM career_stream_clips WHERE career_save_id=${root.id} AND status='NEW'
      AND (season < ${season} OR week <= ${week}) ORDER BY season, week, id`)).rows) {
    const o = clipOutcome(root.world_seed, String(c.id), c.kind as ClipKind, Number(c.peak), Number(ch.followers));
    await tx.execute(sql`UPDATE career_stream_clips SET status=${o.viral ? "VIRAL" : "SETTLED"}, views=${o.views}, followers_gained=${o.followers}, fans_gained=${o.fans}
      WHERE career_save_id=${root.id} AND id=${String(c.id)} AND status='NEW'`);
    if (o.followers) { await tx.execute(sql`UPDATE career_stream_channels SET followers = followers + ${o.followers} WHERE career_save_id=${root.id}`); ch.followers = Number(ch.followers) + o.followers; }
  }
  await tx.execute(sql`UPDATE career_stream_deals SET status='EXPIRED' WHERE career_save_id=${root.id} AND status='OFFERED' AND (season < ${season} OR expires_week <= ${week})`);
  await tx.execute(sql`UPDATE career_stream_campaigns SET status='EXPIRED' WHERE career_save_id=${root.id}
    AND status IN ('OFFERED','ACTIVE') AND (season < ${season} OR expires_week < ${week})`);
  const followers = Number(ch.followers), tier = tierFor(followers).key;
  if(tier==="PARTNER"||tier==="STAR"){
    const campaignOpen=(await tx.execute(sql`SELECT 1 FROM career_stream_campaigns WHERE career_save_id=${root.id}
      AND status IN ('OFFERED','ACTIVE','IN_PROGRESS') LIMIT 1`)).rows.length>0;
    const campaignMonthStart=Math.floor((week-1)/STREAM_MONEY.monthWeeks)*STREAM_MONEY.monthWeeks+1;
    const campaignCount=Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_stream_campaigns WHERE career_save_id=${root.id}
      AND season=${season} AND offered_week BETWEEN ${campaignMonthStart} AND ${week}`)).rows[0]?.n??0);
    const isCampaignMonthOpenWeek=week===campaignMonthStart;
    if(isCampaignMonthOpenWeek&&!campaignOpen&&campaignCount<STREAM_MONEY.campaignsPerMonth){
      const campaignMonth=Math.ceil(week/STREAM_MONEY.monthWeeks);
      const rng=scopedRandom(root.world_seed,STREAM.version,"dartcast-sponsored-campaign",season,campaignMonth);
      const brands=sponsorCatalogue(CURRENT_SPONSOR_DATABASE_VERSION);
      const brand=brands[Math.floor(rng()*brands.length)]!;
      const formats=["CHALLENGER","KING","CHECKOUTS","BOBS_27","SCORING"] as const;
      const requiredFormat=formats[Math.floor(rng()*formats.length)]!;
      const profile=brand.terms.commercialProfile;
      const payout=Math.min(300_000,Math.max(10_000,dealFee(followers)*4));
      const id=stableUuid(root.world_seed,STREAM.version,"dartcast-sponsored-campaign",root.id,season,campaignMonth);
      const brief=`Showcase ${profile?.benefitFocus.toLowerCase()??"the brand"} and tell viewers why ${brand.terms.displayName} backs your channel.`;
      await tx.execute(sql`INSERT INTO career_stream_campaigns
        (career_save_id,id,season,offered_week,expires_week,sponsor_key,sponsor_name,required_format,brief,reward_pence,status)
        VALUES (${root.id},${id},${season},${week},${week+STREAM_MONEY.dealOfferWeeks},${brand.key},${brand.terms.displayName},
          ${requiredFormat},${brief},${payout},'OFFERED') ON CONFLICT DO NOTHING`);
    }
  }
  if (tier !== "PARTNER" && tier !== "STAR") return;
  const open = (await tx.execute(sql`SELECT 1 FROM career_stream_deals WHERE career_save_id=${root.id} AND status IN ('OFFERED','ACTIVE') LIMIT 1`)).rows.length > 0;
  const thisSeason = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_stream_deals WHERE career_save_id=${root.id} AND season=${season}`)).rows[0].n);
  if (open || thisSeason >= STREAM_MONEY.dealsPerSeason || week > 46) return;
  const brand = brandFor(root.world_seed, season, thisSeason);
  await tx.execute(sql`INSERT INTO career_stream_deals (career_save_id, id, season, offered_week, expires_week, brand_key, brand_name, per_stream_pence, streams_total, status)
    VALUES (${root.id}, ${stableUuid(root.world_seed, STREAM.version, "stream-deal", root.id, season, thisSeason)}, ${season}, ${week}, ${week + STREAM_MONEY.dealOfferWeeks},
      ${brand.key}, ${brand.name}, ${dealFee(followers)}, ${STREAM_MONEY.dealStreams}, 'OFFERED') ON CONFLICT DO NOTHING`);
}
/** New subs from streams that ended in this month's weeks. */
export async function subsThisMonth(tx: CareerExecutor, saveId: string, season: number, month: number) {
  const last = month * STREAM_MONEY.monthWeeks;
  return Number((await tx.execute(sql`SELECT COALESCE(SUM((tally->>'subs')::int),0)::int AS n FROM career_streams WHERE career_save_id=${saveId} AND season=${season}
    AND status='ENDED' AND week BETWEEN ${last - STREAM_MONEY.monthWeeks + 1} AND ${last}`)).rows[0].n);
}

