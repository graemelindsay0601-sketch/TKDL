import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { post } from "../finance/ledger.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { CLIP_OF_WEEK, STREAM, STREAM_MONEY, adRevenuePence, brandFor, clipOutcome, creatorSeriesFor, dealFee, goalBonus, renewals, subPayout, tierFor, type ClipKind, type TierKey } from "./model.ts";
import { settleCommunity } from "./community.ts";
import { holdAwards } from "./awards.ts";
import { CONTENT, shortOutcome, vodPence, vodViews } from "./content.ts";
import { AFFILIATE, EDITOR_SHORT, EDITOR_VOD, MANAGER_FEES, MERCH, PLATFORM, TEAM, SPONSOR, SPONSOR_LADDER, affiliateBrand, affiliatePayout, merchSales, platformOfferPence, sponsorBrand, sponsorWeeklyPence, tierAtLeast, type TeamRole } from "./business.ts";
import { CURRENT_SPONSOR_DATABASE_VERSION, sponsorCatalogue } from "../finance/sponsors.catalogue.ts";
import { CUPS } from "./cups.ts";
import { DEAL_KINDS, PARTNERS, brandByKey, dealTerms, nextOffer, type DealKind } from "./partners.ts";

/** Once the tables are known to exist they always will (the schema repair adds them at startup; some test databases skip it). */
let seen = false;
async function ready(tx: CareerExecutor) {
  if (!seen) seen = (await tx.execute(sql`SELECT to_regclass('career_stream_deals') IS NOT NULL AS ok`)).rows[0]?.ok === true;
  return seen;
}

/** Your stream nights this season (absolute day to stream id): a stream night is booked like any other night. */
export async function streamNights(tx: CareerExecutor, saveId: string, season: number): Promise<Map<number, string>> {
  if (!await ready(tx)) return new Map();
  return new Map((await tx.execute(sql`SELECT day, id FROM career_streams WHERE career_save_id=${saveId} AND season=${season} AND format NOT IN ('MATCH','CUP')`)).rows.map(r => [Number(r.day), String(r.id)]));
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
  const ch = (await tx.execute(sql`SELECT followers, subscribers, renewed_through, sub_goal, team, platform, emotes FROM career_stream_channels WHERE career_save_id=${root.id}`)).rows[0];
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
  // VODs: every stream keeps earning views for a few weeks (paid at the ad rate); Shorts run and settle.
  const team = (ch.team as string[] | null) ?? [];
  await settleContent(tx, root, season, week, Number(ch.followers), team.includes("EDITOR"));
  await settleBusiness(tx, root, season, week, ch);
  // Clip of the Week: DartCast's weekly vote. Your best clip of the week is in it; win and the spotlight brings followers.
  const already = (await tx.execute(sql`SELECT 1 FROM career_stream_clips WHERE career_save_id=${root.id} AND season=${season} AND week=${week} AND clip_of_week LIMIT 1`)).rows.length > 0;
  const best = already ? undefined : (await tx.execute(sql`SELECT id, status, views FROM career_stream_clips WHERE career_save_id=${root.id} AND season=${season} AND week=${week}
    AND status IN ('VIRAL','SETTLED') ORDER BY (status='VIRAL') DESC, views DESC, id LIMIT 1`)).rows[0];
  if (best) {
    const rng = scopedRandom(root.world_seed, STREAM.version, "clip-of-week", season, week);
    const viral = best.status === "VIRAL";
    if (rng() < (viral ? CLIP_OF_WEEK.viral : CLIP_OF_WEEK.plain)) {
      const bonus = Math.max(CLIP_OF_WEEK.minFollowers, Math.round(Number(best.views) * CLIP_OF_WEEK.share));
      await tx.execute(sql`UPDATE career_stream_clips SET clip_of_week=true, followers_gained=followers_gained+${bonus}::int WHERE career_save_id=${root.id} AND id=${String(best.id)}`);
      await tx.execute(sql`UPDATE career_stream_channels SET followers = followers + ${bonus}::int WHERE career_save_id=${root.id}`);
      ch.followers = Number(ch.followers) + bonus;
    }
  }
  if(week%STREAM_MONEY.monthWeeks===0){
    const firstWeek=week-STREAM_MONEY.monthWeeks+1;
    const monthStreams=(await tx.execute(sql`SELECT week,processed_visits,tally FROM career_streams WHERE career_save_id=${root.id}
      AND season=${season} AND week BETWEEN ${firstWeek} AND ${week} AND status='ENDED' AND format<>'CHARITY'`)).rows;
    const streamedWeeks=new Set(monthStreams.map(r=>Number(r.week))).size;
    const viewerMinutes=monthStreams.reduce((sum,r)=>{
      const t=r.tally as {viewerMinutes?:number;viewers?:number;peak?:number};
      const minutes=Number(t.viewerMinutes??Math.round(((Number(t.viewers??0)+Number(t.peak??0))/2)*Number(r.processed_visits)*STREAM_MONEY.adMinutesPerVisit));
      return sum+minutes;
    },0);
    const adPayout=adRevenuePence(viewerMinutes,streamedWeeks,Number(ch.followers));
    if(adPayout>0)await post(tx,root,{operationKey:`stream-ads:${season}:${Math.ceil(week/STREAM_MONEY.monthWeeks)}`,category:"STREAM_INCOME",
      amountPence:adPayout,reason:`DartCast platform ads: ${viewerMinutes.toLocaleString("en-GB")} audience minutes`,season,week,
      detail:{viewerMinutes,streamedWeeks,consistencyWeeks:STREAM_MONEY.adFullRateWeeks,followers:Number(ch.followers)}});
  }
  // The season's last week: the Creator Awards.
  if (week === 52) await holdAwards(tx, root, season);
  // Regulars fade if you've gone quiet (and drift away at zero loyalty).
  await settleCommunity(tx, root.id, season, week);
  await tx.execute(sql`UPDATE career_stream_deals SET status='EXPIRED' WHERE career_save_id=${root.id} AND status='OFFERED' AND (season < ${season} OR expires_week <= ${week})`);
  await tx.execute(sql`UPDATE career_stream_campaigns SET status='EXPIRED' WHERE career_save_id=${root.id}
    AND status IN ('OFFERED','ACTIVE') AND (season < ${season} OR expires_week < ${week})`);
  const followers = Number(ch.followers), tier = tierFor(followers).key;
  const absoluteWeek=(season-1)*52+week;
  const recentStreams=(await tx.execute(sql`SELECT processed_visits,tally FROM career_streams WHERE career_save_id=${root.id}
    AND status='ENDED' AND format<>'CHARITY' AND ((season-1)*52+week) BETWEEN ${Math.max(1,absoluteWeek-4)} AND ${absoluteWeek-1}
    ORDER BY season DESC,week DESC,id DESC LIMIT 12`)).rows;
  const audienceMinutes=recentStreams.reduce((sum,r)=>{
    const tally=r.tally as {viewerMinutes?:number;viewers?:number;peak?:number};
    const minutes=Number(tally.viewerMinutes??Math.round(((Number(tally.viewers??0)+Number(tally.peak??0))/2)*Number(r.processed_visits??0)*STREAM_MONEY.adMinutesPerVisit));
    return sum+minutes;
  },0);
  const audienceVisits=recentStreams.reduce((sum,r)=>sum+Number(r.processed_visits??0),0);
  const averageViewers=audienceVisits>0?audienceMinutes/(audienceVisits*STREAM_MONEY.adMinutesPerVisit):0;
  await settleSponsorLadder(tx, root, season, week, followers, averageViewers, ((ch.team as string[] | null) ?? []).includes("MANAGER"));
  await settlePartners(tx, root, season, week, followers, averageViewers, ((ch.team as string[] | null) ?? []).includes("MANAGER"));
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
      const seriesRow=(await tx.execute(sql`SELECT series_key FROM career_stream_creator_series WHERE career_save_id=${root.id} AND season=${season}`)).rows[0];
      const series=seriesRow?creatorSeriesFor(String(seriesRow.series_key)):null;
      const formats=series ? series.formats.filter(f=>f!=="MATCH"&&f!=="INVITATIONAL") :
        ["CHALLENGER","KING","CHECKOUTS","BOBS_27","SCORING"] as const;
      const requiredFormat=formats[Math.floor(rng()*formats.length)]!;
      const profile=brand.terms.commercialProfile;
      const payout=Math.round(Math.min(100_000,Math.max(5_000,dealFee(averageViewers)*4))*(team.includes("MANAGER")?MANAGER_FEES:1));
      const id=stableUuid(root.world_seed,STREAM.version,"dartcast-sponsored-campaign",root.id,season,campaignMonth);
      const brief=`${series?`For your ${series.name} series, `:""}showcase ${profile?.benefitFocus.toLowerCase()??"the brand"} and tell viewers why ${brand.terms.displayName} backs your channel.`;
      await tx.execute(sql`INSERT INTO career_stream_campaigns
        (career_save_id,id,season,offered_week,expires_week,sponsor_key,sponsor_name,required_format,brief,reward_pence,status,series_key)
        VALUES (${root.id},${id},${season},${week},${week+STREAM_MONEY.dealOfferWeeks},${brand.key},${brand.terms.displayName},
          ${requiredFormat},${brief},${payout},'OFFERED',${series?.key??null}) ON CONFLICT DO NOTHING`);
    }
  }
  if (tier !== "PARTNER" && tier !== "STAR") return;
  const open = (await tx.execute(sql`SELECT 1 FROM career_stream_deals WHERE career_save_id=${root.id} AND status IN ('OFFERED','ACTIVE') LIMIT 1`)).rows.length > 0;
  const thisSeason = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_stream_deals WHERE career_save_id=${root.id} AND season=${season}`)).rows[0].n);
  if (open || thisSeason >= STREAM_MONEY.dealsPerSeason || week > 46) return;
  const brand = brandFor(root.world_seed, season, thisSeason);
  await tx.execute(sql`INSERT INTO career_stream_deals (career_save_id, id, season, offered_week, expires_week, brand_key, brand_name, per_stream_pence, streams_total, status)
    VALUES (${root.id}, ${stableUuid(root.world_seed, STREAM.version, "stream-deal", root.id, season, thisSeason)}, ${season}, ${week}, ${week + STREAM_MONEY.dealOfferWeeks},
      ${brand.key}, ${brand.name}, ${Math.round(dealFee(averageViewers) * (team.includes("MANAGER") ? MANAGER_FEES : 1))}, ${STREAM_MONEY.dealStreams}, 'OFFERED') ON CONFLICT DO NOTHING`);
}
/** New subs from streams that ended in this month's weeks. */
export async function subsThisMonth(tx: CareerExecutor, saveId: string, season: number, month: number) {
  const last = month * STREAM_MONEY.monthWeeks;
  return Number((await tx.execute(sql`SELECT COALESCE(SUM((tally->>'subs')::int),0)::int AS n FROM career_streams WHERE career_save_id=${saveId} AND season=${season}
    AND status='ENDED' AND week BETWEEN ${last - STREAM_MONEY.monthWeeks + 1} AND ${last}`)).rows[0].n);
}


/** The week's VOD views and Shorts: views, a few followers and a little money. Settled once per week. */
async function settleContent(tx: CareerExecutor, root: Root, season: number, week: number, followers: number, editor = false) {
  const abs = (season - 1) * 52 + week;
  let views = 0, gained = 0;
  for (const r of (await tx.execute(sql`SELECT id, season, week, processed_visits, tally FROM career_streams WHERE career_save_id=${root.id} AND status='ENDED'
      AND ((season-1)*52 + week) BETWEEN ${abs - CONTENT.vodWeeks} AND ${abs - 1}`)).rows) {
    const after = abs - ((Number(r.season) - 1) * 52 + Number(r.week));
    const v = Math.round(vodViews(Number((r.tally as { peak?: number }).peak ?? 0), Number(r.processed_visits ?? 0), after) * (editor ? EDITOR_VOD : 1));
    if (!v) continue;
    // Each stream's VOD week is counted once: the views are stored as they accrue, keyed by how many weeks have been paid.
    const done = (await tx.execute(sql`UPDATE career_streams SET vod_views = vod_views + ${v}::int,
        tally = jsonb_set(tally, '{vodWeeks}', to_jsonb(${after}::int)) WHERE career_save_id=${root.id} AND id=${String(r.id)}
        AND COALESCE((tally->>'vodWeeks')::int, 0) < ${after}::int RETURNING 1`)).rows.length > 0;
    if (done) { views += v; gained += Math.floor(v / 1000 * CONTENT.vodFollowersPerThousand); }
  }
  const pay = vodPence(views);
  if (pay > 0) await post(tx, root, { operationKey: `stream-vod:${season}:${week}`, category: "STREAM_INCOME", amountPence: pay,
    reason: `DartCast VODs: ${views.toLocaleString("en-GB")} views this week`, season, week, detail: { views } });
  for (const sh of (await tx.execute(sql`SELECT id, kind, boosted FROM career_stream_shorts WHERE career_save_id=${root.id} AND status='NEW'
      AND (season < ${season} OR week <= ${week})`)).rows) {
    const raw = shortOutcome(root.world_seed, String(sh.id), sh.kind as never, followers, sh.boosted === true);
    const views = Math.round(raw.views * (editor ? EDITOR_SHORT : 1));
    const o = { views, followers: Math.round(raw.followers * views / Math.max(1, raw.views)), pence: Math.floor(raw.pence * views / Math.max(1, raw.views)) };
    const settled = (await tx.execute(sql`UPDATE career_stream_shorts SET status='SETTLED', views=${o.views}, followers=${o.followers}, pence=${o.pence}
      WHERE career_save_id=${root.id} AND id=${String(sh.id)} AND status='NEW' RETURNING 1`)).rows.length > 0;
    if (!settled) continue;
    gained += o.followers;
    if (o.pence > 0) await post(tx, root, { operationKey: `stream-short:${sh.id}`, category: "STREAM_INCOME", amountPence: o.pence,
      reason: `DartCast Short: ${o.views.toLocaleString("en-GB")} views`, season, week, detail: { shortId: String(sh.id), views: o.views } });
  }
  if (gained) await tx.execute(sql`UPDATE career_stream_channels SET followers = followers + ${gained}::int WHERE career_save_id=${root.id}`);
}

/** Business, weekly: merch sells, the team is paid, affiliate codes are offered and pay monthly, the platform comes calling. */
async function settleBusiness(tx: CareerExecutor, root: Root, season: number, week: number, ch: Record<string, unknown>) {
  const abs = (season - 1) * 52 + week, followers = Number(ch.followers), tier = tierFor(followers).key;
  const team = (ch.team as string[] | null) ?? [];
  // Merch: each drop sells for a few weeks after it's made (once per week of sale).
  const loyal = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_stream_regulars WHERE career_save_id=${root.id} AND status='ACTIVE' AND loyalty >= 50`)).rows[0]?.n ?? 0);
  const emotes = ((ch.emotes as (string | null)[] | null) ?? []).filter(Boolean).length;
  for (const d of (await tx.execute(sql`SELECT * FROM career_stream_merch WHERE career_save_id=${root.id} AND sold < units AND weeks_paid < ${MERCH.weeks}`)).rows) {
    const weekOfDrop = abs - ((Number(d.season) - 1) * 52 + Number(d.week)) + 1;
    if (weekOfDrop <= Number(d.weeks_paid)) continue;
    const sold = merchSales(root.world_seed, String(d.id), weekOfDrop, d.item as never, followers, loyal, emotes, Number(d.units) - Number(d.sold));
    const pence = sold * Number(d.price_pence);
    const done = (await tx.execute(sql`UPDATE career_stream_merch SET sold = sold + ${sold}::int, revenue_pence = revenue_pence + ${pence}::int, weeks_paid = ${weekOfDrop}::int
      WHERE career_save_id=${root.id} AND id=${String(d.id)} AND weeks_paid < ${weekOfDrop}::int RETURNING 1`)).rows.length > 0;
    if (done && pence > 0) await post(tx, root, { operationKey: `stream-merch:${d.id}:${weekOfDrop}`, category: "STREAM_INCOME", amountPence: pence,
      reason: `DartCast merch: ${sold} sold`, season, week, detail: { dropId: String(d.id), sold } });
  }
  // Wages for the team you've hired.
  for (const role of team as TeamRole[]) {
    const def = TEAM[role];
    if (def) await post(tx, root, { operationKey: `adjustment:stream-wage:${role}:${season}:${week}`, category: "ADJUSTMENT", headline: "EXPENSE", amountPence: -def.wagePence,
      reason: `DartCast ${def.name.toLowerCase()} wage`, season, week, detail: { type: "DARTCAST_TEAM_WAGE", role } });
  }
  // Affiliate codes: an offer every few weeks from Affiliate; an active code pays at each month's end; offers lapse after two weeks.
  await tx.execute(sql`UPDATE career_stream_affiliates SET status='EXPIRED' WHERE career_save_id=${root.id} AND status='OFFERED' AND ((season-1)*52 + week) <= ${abs - 2}`);
  if (tierAtLeast(tier, AFFILIATE.minTier) && week % AFFILIATE.offerEveryWeeks === 0) {
    const open = (await tx.execute(sql`SELECT 1 FROM career_stream_affiliates WHERE career_save_id=${root.id} AND status IN ('OFFERED','ACTIVE') LIMIT 1`)).rows.length > 0;
    if (!open) {
      const n = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_stream_affiliates WHERE career_save_id=${root.id}`)).rows[0]?.n ?? 0);
      const brand = affiliateBrand(root.world_seed, n);
      await tx.execute(sql`INSERT INTO career_stream_affiliates (career_save_id, id, n, brand_key, brand_name, season, week, status)
        VALUES (${root.id}, ${stableUuid(root.world_seed, STREAM.version, "stream-affiliate", root.id, n)}, ${n}, ${brand.key}, ${brand.name}, ${season}, ${week}, 'OFFERED') ON CONFLICT DO NOTHING`);
    }
  }
  if (week % STREAM_MONEY.monthWeeks === 0) {
    const active = (await tx.execute(sql`SELECT * FROM career_stream_affiliates WHERE career_save_id=${root.id} AND status='ACTIVE'`)).rows[0];
    if (active) {
      const streamed = new Set((await tx.execute(sql`SELECT week FROM career_streams WHERE career_save_id=${root.id} AND season=${season} AND status='ENDED'
        AND week BETWEEN ${week - STREAM_MONEY.monthWeeks + 1} AND ${week}`)).rows.map(r => Number(r.week))).size;
      const pay = affiliatePayout(root.world_seed, `${active.id}:${season}:${week}`, followers, streamed, team.includes("MANAGER"));
      const opKey = `stream-affiliate:${active.id}:${season}:${week}`;
      const already = (await tx.execute(sql`SELECT 1 FROM career_finance_entries WHERE career_save_id=${root.id} AND operation_key=${opKey} LIMIT 1`)).rows.length > 0;
      if (pay > 0 && !already) {
        await post(tx, root, { operationKey: opKey, category: "STREAM_INCOME", amountPence: pay,
          reason: `${active.brand_name} affiliate code: this month's sales`, season, week, detail: { affiliateId: String(active.id) } });
        await tx.execute(sql`UPDATE career_stream_affiliates SET paid_pence = paid_pence + ${pay}::int WHERE career_save_id=${root.id} AND id=${String(active.id)}`);
      }
    }
  }
  // The platform offer: a Star gets one in week 20 each season (unless already exclusive).
  const p = ch.platform as { status?: string; season?: number } | null;
  if (tier === "STAR" && week === PLATFORM.offerWeek && p?.season !== season)
    await tx.execute(sql`UPDATE career_stream_channels SET platform=${JSON.stringify({ status: "OFFERED", season, offerPence: platformOfferPence(followers) })}::jsonb
      WHERE career_save_id=${root.id}`);
  if (p?.status === "OFFERED" && p.season === season && week > PLATFORM.offerWeek + 2)
    await tx.execute(sql`UPDATE career_stream_channels SET platform = platform || '{"status":"DECLINED"}'::jsonb WHERE career_save_id=${root.id}`);
}

/**
 * The sponsor ladder, once a week: the headline sponsor pays for a week you went live (and the rung is banked when its run
 * is done, with fans for your darts career); unanswered offers lapse; with no sponsor on the go, the next rung up comes
 * calling once your channel is big enough (and again a few weeks after one is turned down or lapses).
 */
async function settleSponsorLadder(tx: CareerExecutor, root: Root, season: number, week: number, followers: number, averageViewers: number, manager: boolean) {
  const abs = (season - 1) * 52 + week, tag = `${season}:${week}`;
  const active = (await tx.execute(sql`SELECT * FROM career_stream_sponsors WHERE career_save_id=${root.id} AND status='ACTIVE' LIMIT 1`)).rows[0];
  if (active && active.last_paid !== tag) {
    const live = (await tx.execute(sql`SELECT 1 FROM career_streams WHERE career_save_id=${root.id} AND season=${season} AND week=${week} AND status='ENDED' LIMIT 1`)).rows.length > 0;
    if (live) {
      const pay = Number(active.weekly_pence), done = Number(active.weeks_paid) + 1 >= Number(active.weeks_total);
      const rung = SPONSOR_LADDER[Number(active.rung) - 1];
      const updated = (await tx.execute(sql`UPDATE career_stream_sponsors SET weeks_paid = weeks_paid + 1, paid_pence = paid_pence + ${pay}::int, last_paid=${tag},
        status=${done ? "COMPLETED" : "ACTIVE"}, fans=${done ? rung.fans : 0}::int, closed_week=${done ? abs : null}
        WHERE career_save_id=${root.id} AND id=${String(active.id)} AND status='ACTIVE' AND last_paid IS DISTINCT FROM ${tag} RETURNING 1`)).rows.length > 0;
      if (updated && pay > 0) await post(tx, root, { operationKey: `stream-sponsor:${active.id}:${tag}`, category: "STREAM_INCOME", amountPence: pay,
        reason: `${active.brand_name}: headline sponsor (${rung.name.toLowerCase()})`, season, week, detail: { sponsorId: String(active.id), rung: rung.rung } });
    }
  }
  await tx.execute(sql`UPDATE career_stream_sponsors SET status='EXPIRED', closed_week=${abs} WHERE career_save_id=${root.id} AND status='OFFERED' AND ((season-1)*52 + week) <= ${abs - SPONSOR.offerWeeks}`);
  const rows = (await tx.execute(sql`SELECT n, rung, status, season, week, closed_week FROM career_stream_sponsors WHERE career_save_id=${root.id} ORDER BY n`)).rows;
  if (rows.some(r => r.status === "OFFERED" || r.status === "ACTIVE")) return;
  const banked = Math.max(0, ...rows.filter(r => r.status === "COMPLETED").map(r => Number(r.rung)));
  if (banked >= SPONSOR_LADDER.length) return;
  const next = SPONSOR_LADDER[banked], tier = tierFor(followers).key;
  if (!tierAtLeast(tier, next.minTier) || followers < next.minFollowers) return;
  const last = rows.at(-1);
  // A few weeks' breather after one is turned down, lapses or is walked away from (the next rung after a finished run comes straight away).
  if (last && last.status !== "COMPLETED" && abs - Number(last.closed_week ?? (Number(last.season) - 1) * 52 + Number(last.week)) < SPONSOR.retryWeeks) return;
  const n = rows.length, brand = sponsorBrand(root.world_seed, next.rung, n);
  await tx.execute(sql`INSERT INTO career_stream_sponsors (career_save_id, id, n, rung, brand_key, brand_name, season, week, weekly_pence, weeks_total, status)
    VALUES (${root.id}, ${stableUuid(root.world_seed, STREAM.version, "stream-sponsor", root.id, n)}, ${n}, ${next.rung}, ${brand.key}, ${brand.name}, ${season}, ${week},
      ${sponsorWeeklyPence(next.rung, averageViewers, manager)}, ${next.weeks}, 'OFFERED') ON CONFLICT DO NOTHING`);
}

/** How well each brand knows you: finished deals (gifted kit counts double) and headline runs you've seen through. */
export async function brandTrust(tx: CareerExecutor, saveId: string) {
  const trust = new Map<string, number>();
  for (const r of (await tx.execute(sql`SELECT brand_key, kind FROM career_stream_partner_deals WHERE career_save_id=${saveId} AND status='COMPLETED'`)).rows)
    trust.set(String(r.brand_key), (trust.get(String(r.brand_key)) ?? 0) + (r.kind === "SEEDING" ? PARTNERS.seedingTrust : 1));
  for (const r of (await tx.execute(sql`SELECT brand_key FROM career_stream_sponsors WHERE career_save_id=${saveId} AND status='COMPLETED'`)).rows)
    trust.set(String(r.brand_key), (trust.get(String(r.brand_key)) ?? 0) + 1);
  return trust;
}

/**
 * Brand partners, once a week: running deals pay (weekly kinds for a live week; a giveaway on your next live week; a cup
 * title when you've played that cup) and finish; gifted kit runs its weeks; unanswered offers lapse; and while you've a
 * free slot a new offer arrives every few weeks (more often with a manager).
 */
async function settlePartners(tx: CareerExecutor, root: Root, season: number, week: number, followers: number, averageViewers: number, manager: boolean) {
  const abs = (season - 1) * 52 + week, tag = `${season}:${week}`, tier = tierFor(followers).key;
  const live = (await tx.execute(sql`SELECT 1 FROM career_streams WHERE career_save_id=${root.id} AND season=${season} AND week=${week} AND status='ENDED' LIMIT 1`)).rows.length > 0;
  for (const d of (await tx.execute(sql`SELECT * FROM career_stream_partner_deals WHERE career_save_id=${root.id} AND status='ACTIVE' AND last_paid IS DISTINCT FROM ${tag}`)).rows) {
    const kind = d.kind as DealKind, fee = Number(d.fee_pence);
    let pay = 0, tick = false, close: "COMPLETED" | "EXPIRED" | null = null;
    if (kind === "RETAINER" || kind === "AMBASSADOR") { if (live) { pay = fee; tick = true; if (Number(d.weeks_paid) + 1 >= Number(d.weeks_total)) close = "COMPLETED"; } }
    else if (kind === "GIVEAWAY") { if (live) { pay = fee; tick = true; close = "COMPLETED"; } }
    else if (kind === "SEEDING") { tick = true; if (Number(d.weeks_paid) + 1 >= Number(d.weeks_total)) close = "COMPLETED"; }
    else if (kind === "CUP_TITLE") {
      const played = (await tx.execute(sql`SELECT 1 FROM career_stream_cups WHERE career_save_id=${root.id} AND season=${Number(d.cup_season)} AND cup_no=${Number(d.cup_no)} LIMIT 1`)).rows.length > 0;
      if (played) { pay = fee; tick = true; close = "COMPLETED"; }
      else if (season > Number(d.cup_season) || week > (CUPS.weeks[Number(d.cup_no) - 1] ?? 0) + CUPS.window - 1) close = "EXPIRED";
    }
    if (!tick && !close) continue;
    const gained = close === "COMPLETED" && kind === "GIVEAWAY" ? Number(d.followers) : 0;
    const done = (await tx.execute(sql`UPDATE career_stream_partner_deals SET weeks_paid = weeks_paid + ${tick ? 1 : 0}::int, paid_pence = paid_pence + ${pay}::int,
      last_paid=${tag}, status=${close ?? "ACTIVE"}, closed_week=${close ? abs : null}
      WHERE career_save_id=${root.id} AND id=${String(d.id)} AND status='ACTIVE' AND last_paid IS DISTINCT FROM ${tag} RETURNING 1`)).rows.length > 0;
    if (!done) continue;
    if (pay > 0) await post(tx, root, { operationKey: `stream-partner:${d.id}:${tag}`, category: "STREAM_INCOME", amountPence: pay,
      reason: `${d.brand_name}: ${DEAL_KINDS[kind].name.toLowerCase()}`, season, week, detail: { partnerDealId: String(d.id), kind } });
    if (gained > 0) await tx.execute(sql`UPDATE career_stream_channels SET followers = followers + ${gained}::int WHERE career_save_id=${root.id}`);
  }
  await tx.execute(sql`UPDATE career_stream_partner_deals SET status='EXPIRED', closed_week=${abs} WHERE career_save_id=${root.id} AND status='OFFERED'
    AND ((season-1)*52 + week) <= ${abs - PARTNERS.offerWeeks}`);
  // A new offer while you've room for another partner.
  const slots = PARTNERS.slots[tier] ?? 0;
  if (slots === 0) return;
  const rows = (await tx.execute(sql`SELECT n, brand_key, category, status, season, week FROM career_stream_partner_deals WHERE career_save_id=${root.id} ORDER BY n`)).rows;
  const open = rows.filter(r => r.status === "ACTIVE" || r.status === "OFFERED");
  if (open.length >= slots || open.some(r => r.status === "OFFERED")) return;
  const last = rows.at(-1), every = manager ? PARTNERS.managerOfferEvery : PARTNERS.offerEvery;
  if (last && abs - ((Number(last.season) - 1) * 52 + Number(last.week)) < every) return;
  const headline = (await tx.execute(sql`SELECT brand_key FROM career_stream_sponsors WHERE career_save_id=${root.id} AND status='ACTIVE' LIMIT 1`)).rows[0];
  const blocked = new Set(open.map(r => String(r.category)));
  const hc = headline ? brandByKey(String(headline.brand_key))?.category : null;
  if (hc) blocked.add(hc);
  const trust = await brandTrust(tx, root.id), n = rows.length;
  const offer = nextOffer(root.world_seed, n, tier, week, blocked, trust);
  if (!offer) return;
  const terms = dealTerms(offer.kind, tier, averageViewers, trust.get(offer.brand.key) ?? 0, manager);
  await tx.execute(sql`INSERT INTO career_stream_partner_deals (career_save_id, id, n, brand_key, brand_name, category, kind, season, week, fee_pence, weeks_total, followers,
      cup_season, cup_no, status)
    VALUES (${root.id}, ${stableUuid(root.world_seed, STREAM.version, "stream-partner", root.id, n)}, ${n}, ${offer.brand.key}, ${offer.brand.name}, ${offer.brand.category},
      ${offer.kind}, ${season}, ${week}, ${terms.feePence}, ${terms.weeks}, ${terms.followers}, ${offer.cup ? season : null}, ${offer.cup?.n ?? null}, 'OFFERED') ON CONFLICT DO NOTHING`);
}
