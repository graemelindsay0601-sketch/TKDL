import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { stableUuid } from "../world/random.ts";
import { replay, type X01Format } from "../../shared/darts-rules/x01.ts";
import { replayDrill, type DrillSpec } from "../../shared/darts-rules/drills.ts";
import { absoluteDay } from "../calendar/generation.ts";
import { post } from "../finance/ledger.ts";
import { fansForEffects } from "../fans/service.ts";
import { subsThisMonth } from "./state.ts";
import { freeNightsInWeek } from "../nights.ts";
import { loadNpcs } from "../world/repository.ts";
import { STREAM, STREAM_MONEY, BRANDS, FORMATS, KING_ROUNDS, SUB_GOAL, CLIPS, COLLAB, clipFor, collabAnswer, collabBot, collabFollowers, STREAMERS, streamerFollowers, challengerFor, chatForDrillVisit, chatForMoment, chatForVisit, checkoutTargets, crowdFor, followersFromFans,
  formatByKey, INVITATIONAL, CHARITY, invitationalField, invitationalOpponent, invitationalPrize, nextTier, openingViewers, pollFor, scoringTarget, streamIncome, tierFor, type ChatEvent, type ClipKind, type StreamFormat, type Tally, type TierKey } from "./model.ts";

type Root = { id: string; world_seed: string; current_season: number | string; current_week: number | string; status: string; career_name?: string | null; settings_snapshot?: Record<string, unknown> };
const HUMAN = "HUMAN";
const MATCH: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: STREAM.legsToWin * 2 - 1 };
/** King of the Oche: one leg against each viewer. */
const KING_LEG: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: 1 };
/** The x01 format a stream's match is played in: one leg for King of the Oche, a real match's own format, otherwise first to 2. */
const x01For = (format: string, matchFormat?: unknown) => format === "MATCH" && matchFormat ? matchFormat as X01Format : format === "KING" ? KING_LEG : MATCH;
/** Formats that play round after round (a new opponent each time): how many rounds. */
const roundsIn = (format: string) => format === "KING" ? KING_ROUNDS : format === "INVITATIONAL" ? INVITATIONAL.rounds.length : 1;
const isDrill = (format: string) => format === "CHECKOUTS" || format === "BOBS_27" || format === "SCORING";

type Challenger = { name: string; avg: number; bot: { config: { avg: number; sd: number; checkoutPct: number; hitAcc: number }; seed: string } | null;
  /** A collab: the streamer and their audience when you went live. */
  streamer?: { key: string; followers: number } };
export type StreamSession = { id: string; status: "LIVE" | "ENDED"; season: number; week: number; dayOfWeek: number; handle: string; tier: TierKey;
  streamFormat: StreamFormat; formatName: string;
  /** The viewer you're playing (null on a drill). */
  challenger: Challenger;
  format: X01Format; drill: DrillSpec | null; firstThrower: 0 | 1;
  /** King of the Oche: the round now (0-based), out of `kingRounds`, and the viewers you've seen off. */
  round: number; kingRounds: number; rounds: { challenger: string; result: "WON" | "LOST" }[];
  tally: Tally; processedVisits: number; result: "WON" | "LOST" | null; incomePence: number | null; followersGained: number | null;
  chat: ChatEvent[]; darts: unknown[]; poll: ReturnType<typeof pollFor> | null };
/** Streaming a real match from the venue: allowed?, and the stream so far. */
export type MatchStream = { eligible: boolean; why: string | null; session: StreamSession | null; events: ChatEvent[] };
/** Events with their own TV coverage: no streaming from the venue. */
const TELEVISED = new Set(["TELEVISED", "MAJOR", "WORLD"]);
export type Deal = { id: string; brand: string; what: string; perStreamPence: number; streamsTotal: number; streamsDone: number; expiresWeek: number };
export type SubGoal = { season: number; month: number; endsWeek: number; target: number; promise: string; progress: number; status: "ON" | "HIT" | "MISSED" };
export type StreamingView = {
  season: number; week: number; handle: string; followers: number; tier: { key: TierKey; name: string; perks: string };
  next: { name: string; followers: number; perks: string } | null; tiers: { key: string; name: string; followers: number; perks: string; reached: boolean }[];
  streamsThisWeek: number; perWeek: number; freeNights: number[]; live: string | null;
  pathway: { focus: "OPEN" | "DARTCAST"; weeklyFrequency: number; scheduledNights: number[] };
  totals: { streams: number; earnedPence: number; won: number };
  /** Subscribers who renew every four weeks (half of each £2.50 to you), and the week the next renewals are paid. */
  subscribers: number; renewsWeek: number;
  /** A brand's offer to answer, and the deal you're doing now. */
  dealOffer: Deal | null; deal: Deal | null;
  /** Stars get invitations to the televised invitationals. */
  invitations: boolean;
  /** What you can stream, how big a crowd each would draw tonight (1 = a normal night), chat's pick and the last format played. */
  formats: { key: StreamFormat; name: string; blurb: string; crowd: number; why: string | null }[]; pollPick: StreamFormat | null; lastFormat: StreamFormat | null;
  /** This month's sub goal (Partner up), the targets and promises to choose from. */
  subGoal: SubGoal | null; goalOptions: { targets: readonly number[]; promises: readonly string[] } | null;
  /** Streamers you could collab with (their audience now, and whether they'd say yes). */
  collabs: { key: string; handle: string; followers: number; avg: number; blurb: string; ok: boolean; why: string | null }[];
  /** The DartCast Invitational: open to you now?, the field, and how you did this season. */
  invitational: { open: boolean; why: string | null; fromWeek: number; field: { handle: string; followers: number; avg: number }[]; prizePence: readonly number[];
    result: { wins: number; prizePence: number } | null };
  /** Charity streams: done this month, and raised so far in all. */
  charity: { doneThisMonth: boolean; raisedPence: number };
  /** Your clips, the viral ones first. */
  clips: { id: string; season: number; week: number; kind: ClipKind; title: string; status: "NEW" | "VIRAL" | "SETTLED"; views: number; followersGained: number; fansGained: number }[];
  videos: { id: string; season: number; week: number; dayOfWeek: number; format: StreamFormat; title: string; challenger: string; result: "WON" | "LOST" | null; peak: number; followersGained: number; incomePence: number }[];
};

const monthOf = (week: number) => Math.ceil(week / STREAM_MONEY.monthWeeks);

/** Your channel (made on first visit, its first followers drawn from your fan base). */
async function channel(tx: CareerExecutor, root: Root) {
  const row = (await tx.execute(sql`SELECT * FROM career_stream_channels WHERE career_save_id=${root.id}`)).rows[0];
  if (row) return { handle: String(row.handle), followers: Number(row.followers), subscribers: Number(row.subscribers ?? 0),
    pollPick: (row.poll_pick as StreamFormat | null) ?? null, subGoal: (row.sub_goal as Omit<SubGoal, "progress" | "endsWeek"> | null) ?? null };
  const fans = Math.max(0, (await fansForEffects(tx, root.id)) ?? 0);
  const name = String((await tx.execute(sql`SELECT career_name FROM career_saves WHERE id=${root.id}`)).rows[0]?.career_name ?? "Darts").replace(/[^A-Za-z0-9]/g, "").slice(0, 16) || "Darts";
  const handle = `${name}Darts`, followers = followersFromFans(fans);
  await tx.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${root.id}, ${handle}, ${followers}) ON CONFLICT DO NOTHING`);
  return { handle, followers, subscribers: 0, pollPick: null, subGoal: null };
}

const dealFrom = (r: Record<string, unknown>): Deal => ({ id: String(r.id), brand: String(r.brand_name), what: BRANDS.find(b => b.key === r.brand_key)?.what ?? "a brand",
  perStreamPence: Number(r.per_stream_pence), streamsTotal: Number(r.streams_total), streamsDone: Number(r.streams_done), expiresWeek: Number(r.expires_week) });

/** Nights this week you're free to stream (no event, commitment or other stream booked). */
async function freeNights(tx: CareerExecutor, root: Root) {
  return freeNightsInWeek(tx, root.id, Number(root.current_season), Number(root.current_week));
}

function pathwaySettings(root: Root) {
  const saved = root.settings_snapshot?.careerPathway as { focus?: string; weeklyFrequency?: number } | undefined;
  return { focus: saved?.focus === "DARTCAST" ? "DARTCAST" as const : "OPEN" as const,
    weeklyFrequency: Math.max(0, Math.min(STREAM.perWeek, Math.trunc(Number(saved?.weeklyFrequency) || 0))) };
}

/** Reserve this week's chosen DartCast nights as ordinary Career commitments, so every activity and event sees them. */
async function schedulePathwayWeek(tx: CareerExecutor, root: Root, replace = false): Promise<number[]> {
  const season = Number(root.current_season), week = Number(root.current_week), cfg = pathwaySettings(root);
  const from = absoluteDay(week, 1), to = absoluteDay(week, 7);
  await tx.execute(sql`DELETE FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season}
    AND family='DARTCAST' AND status='ACCEPTED' AND day < ${from}`);
  const existing = (await tx.execute(sql`SELECT day FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season}
    AND family='DARTCAST' AND status='ACCEPTED' AND day BETWEEN ${from} AND ${to} ORDER BY day`)).rows.map(r => Number(r.day));
  if (replace) {
    await tx.execute(sql`DELETE FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season}
      AND family='DARTCAST' AND status='ACCEPTED' AND day BETWEEN ${from} AND ${to}`);
  } else if (existing.length) return existing.map(day => ((day - 1) % 7) + 1);
  if (root.status !== "ACTIVE" || cfg.focus !== "DARTCAST" || cfg.weeklyFrequency === 0) return [];
  const completedOrLive = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_streams
    WHERE career_save_id=${root.id} AND season=${season} AND week=${week} AND format <> 'MATCH'`)).rows[0]?.n ?? 0);
  const remaining = Math.max(0, cfg.weeklyFrequency - completedOrLive);
  const free = await freeNightsInWeek(tx, root.id, season, week);
  const ordered = [2, 4, 6, 1, 5, 7, 3].filter(day => free.includes(day)).slice(0, remaining);
  for (const dayOfWeek of ordered) {
    const day = absoluteDay(week, dayOfWeek);
    const id = stableUuid(root.world_seed, STREAM.version, "dartcast-week-plan", root.id, season, week, dayOfWeek);
    await tx.execute(sql`INSERT INTO career_life_commitments (career_save_id,id,family,title,season,day,fee_pence,contract_id,status)
      VALUES (${root.id},${id},'DARTCAST','DartCast stream',${season},${day},0,NULL,'ACCEPTED') ON CONFLICT DO NOTHING`);
  }
  return ordered;
}

async function pathwaySchedule(tx: CareerExecutor, root: Root) {
  const cfg = pathwaySettings(root);
  const days = (await tx.execute(sql`SELECT day FROM career_life_commitments WHERE career_save_id=${root.id}
    AND season=${Number(root.current_season)} AND family='DARTCAST' AND status='ACCEPTED'
    AND day BETWEEN ${absoluteDay(Number(root.current_week), 1)} AND ${absoluteDay(Number(root.current_week), 7)} ORDER BY day`)).rows
    .map(r => ((Number(r.day) - 1) % 7) + 1);
  return { focus: cfg.focus, weeklyFrequency: cfg.weeklyFrequency, scheduledNights: days };
}

const titleOf = (format: string, challenger: string) => format === "CHALLENGER" ? `Stream vs ${challenger}` : format === "COLLAB" ? `Collab with ${challenger}` : formatByKey(format).name;
/** Keep the stream's best clip-worthy moment. */
const bestClip = (tally: Tally, kind: ClipKind | null): Tally => kind && (!tally.clip || CLIPS[kind].weight > CLIPS[tally.clip].weight) ? { ...tally, clip: kind } : tally;

const sessionFrom = (r: Record<string, unknown>, handle: string, tier: TierKey): StreamSession => {
  const format = String(r.format ?? "CHALLENGER") as StreamFormat;
  return {
    id: String(r.id), status: r.status as StreamSession["status"], season: Number(r.season), week: Number(r.week), dayOfWeek: ((Number(r.day) - 1) % 7) + 1, handle, tier,
    streamFormat: format, formatName: titleOf(format, (r.challenger as Challenger).name),
    challenger: r.challenger as Challenger, format: x01For(format, r.match_format), drill: (r.drill as DrillSpec | null) ?? null, firstThrower: Number(r.first_thrower) as 0 | 1,
    round: Number(r.round ?? 0), kingRounds: roundsIn(format), rounds: (r.rounds as StreamSession["rounds"]) ?? [],
    tally: r.tally as Tally, processedVisits: Number(r.processed_visits), result: (r.result as StreamSession["result"]) ?? null,
    incomePence: r.income_pence === null ? null : Number(r.income_pence), followersGained: r.followers_gained === null ? null : Number(r.followers_gained),
    chat: ((r.chat as ChatEvent[]) ?? []).slice(-60), darts: (r.darts as unknown[]) ?? [], poll: (r.poll as StreamSession["poll"]) ?? null };
};

/** A viewer for King of the Oche round `round`: each a little better than the last. */
function kingChallenger(seed: string, key: string, followers: number, round: number): Challenger {
  const c = challengerFor(seed, `${key}:king:${round}`, followers);
  const avg = Math.round((c.avg + round * 2.5) * 10) / 10;
  return { name: c.name, avg, bot: { config: { ...c.config, avg, checkoutPct: Math.min(0.45, c.config.checkoutPct + round * 0.02) },
    seed: stableUuid(seed, STREAM.version, "stream-bot", key, round) } };
}

/** The Invitational's opponent for round `round`: a streamer from the season's top seven, at their own level. */
function invitationalChallenger(seed: string, key: string, season: number, week: number, round: number): Challenger {
  const st = invitationalOpponent(invitationalField(season, week), round);
  return { name: st.handle, avg: st.avg, bot: { config: collabBot(st.avg), seed: stableUuid(seed, STREAM.version, "stream-bot", key, "inv", round) }, streamer: { key: st.key, followers: st.now } };
}

export function createCareerStreamingService(database: CareerDatabase) {
  async function view(tx: CareerExecutor, root: Root): Promise<StreamingView> {
    const season = Number(root.current_season), week = Number(root.current_week);
    const ch = await channel(tx, root);
    const tier = tierFor(ch.followers), next = nextTier(ch.followers);
    const rows = (await tx.execute(sql`SELECT id, season, week, day, status, format, challenger, result, tally, income_pence, followers_gained, rounds FROM career_streams
      WHERE career_save_id=${root.id} ORDER BY season DESC, week DESC, created_at DESC`)).rows;
    // A match streamed from an event is the event's night, not one of your stream nights.
    const nights = rows.filter(r => r.format !== "MATCH");
    const ended = rows.filter(r => r.status === "ENDED");
    const deals = (await tx.execute(sql`SELECT * FROM career_stream_deals WHERE career_save_id=${root.id} AND status IN ('OFFERED','ACTIVE')`)).rows;
    const offer = deals.find(d => d.status === "OFFERED"), deal = deals.find(d => d.status === "ACTIVE");
    const lastFormat = (ended[0]?.format as StreamFormat | undefined) ?? null;
    const collabbed = new Set((await tx.execute(sql`SELECT DISTINCT challenger->'streamer'->>'key' AS k FROM career_streams WHERE career_save_id=${root.id} AND season=${season} AND format='COLLAB'`)).rows.map(r => String(r.k)));
    const clips = (await tx.execute(sql`SELECT * FROM career_stream_clips WHERE career_save_id=${root.id} ORDER BY (status='VIRAL') DESC, views DESC, season DESC, week DESC LIMIT 8`)).rows;
    const partner = tier.key === "PARTNER" || tier.key === "STAR";
    const g = ch.subGoal, goalMonth = g && g.season === season ? g.month : null;
    const subGoal: SubGoal | null = g && goalMonth !== null && goalMonth >= monthOf(week) - 1
      ? { ...g, endsWeek: g.month * STREAM_MONEY.monthWeeks, progress: await subsThisMonth(tx, root.id, g.season, g.month) } : null;
    return { season, week, handle: ch.handle, followers: ch.followers, tier: { key: tier.key, name: tier.name, perks: tier.perks },
      next: next ? { name: next.name, followers: next.followers, perks: next.perks } : null,
      tiers: STREAM.tiers.map(t => ({ key: t.key, name: t.name, followers: t.followers, perks: t.perks, reached: ch.followers >= t.followers })),
      streamsThisWeek: nights.filter(r => Number(r.season) === season && Number(r.week) === week).length, perWeek: STREAM.perWeek,
      freeNights: root.status === "ACTIVE" ? await freeNights(tx, root) : [], live: nights.find(r => r.status === "LIVE")?.id as string ?? null,
      pathway: await pathwaySchedule(tx, root),
      totals: { streams: ended.length, earnedPence: ended.reduce((n, r) => n + Number(r.income_pence ?? 0), 0), won: ended.filter(r => r.result === "WON").length },
      videos: ended.slice(0, 24).map(r => {
        const format = String(r.format ?? "CHALLENGER") as StreamFormat, challenger = String((r.challenger as { name: string }).name);
        return { id: String(r.id), season: Number(r.season), week: Number(r.week), dayOfWeek: ((Number(r.day) - 1) % 7) + 1, format, title: titleOf(format, challenger), challenger,
          result: (r.result as "WON" | "LOST" | null) ?? null, peak: Number((r.tally as Tally).peak), followersGained: Number(r.followers_gained ?? 0), incomePence: Number(r.income_pence ?? 0) };
      }),
      subscribers: ch.subscribers, renewsWeek: monthOf(week) * STREAM_MONEY.monthWeeks,
      dealOffer: offer ? dealFrom(offer) : null, deal: deal ? dealFrom(deal) : null, invitations: tier.key === "STAR",
      invitational: (() => {
        const played = rows.find(r => r.format === "INVITATIONAL" && Number(r.season) === season && r.status === "ENDED");
        const wins = played ? ((played.rounds as StreamSession["rounds"]) ?? []).filter(r => r.result === "WON").length : 0;
        const why = played || rows.some(r => r.format === "INVITATIONAL" && Number(r.season) === season) ? "You've played this season's Invitational"
          : !partner ? "For Partners and Stars" : week < INVITATIONAL.fromWeek ? `Opens in week ${INVITATIONAL.fromWeek}` : week > INVITATIONAL.toWeek ? "Closed for this season" : null;
        return { open: why === null, why, fromWeek: INVITATIONAL.fromWeek, field: invitationalField(season, week).map(f => ({ handle: f.handle, followers: f.now, avg: f.avg })),
          prizePence: INVITATIONAL.prizePence, result: played ? { wins, prizePence: invitationalPrize(wins) } : null };
      })(),
      charity: { doneThisMonth: rows.some(r => r.format === "CHARITY" && Number(r.season) === season && monthOf(Number(r.week)) === monthOf(week)),
        raisedPence: ended.reduce((n, r) => n + Number((r.tally as Tally).raisedPence ?? 0), 0) },
      collabs: STREAMERS.map(st => { const followers = streamerFollowers(st.followers, season, week), a = collabAnswer(followers, ch.followers, collabbed.has(st.key));
        return { key: st.key, handle: st.handle, followers, avg: st.avg, blurb: st.blurb, ok: a.ok, why: a.ok ? null : a.why }; }),
      clips: clips.map(c => ({ id: String(c.id), season: Number(c.season), week: Number(c.week), kind: c.kind as ClipKind, title: String(c.title), status: c.status as "NEW" | "VIRAL" | "SETTLED",
        views: Number(c.views), followersGained: Number(c.followers_gained), fansGained: Number(c.fans_gained) })),
      formats: FORMATS.map(f => ({ key: f.key, name: f.name, blurb: f.blurb, crowd: Math.round(crowdFor(f.key, lastFormat, ch.pollPick) * 100) / 100,
        why: f.key !== "CHARITY" ? null : tier.key === "NEWCOMER" ? "From Affiliate (viewers can cheer)"
          : rows.some(r => r.format === "CHARITY" && Number(r.season) === season && monthOf(Number(r.week)) === monthOf(week)) ? "Done this month" : null })),
      pollPick: ch.pollPick, lastFormat,
      subGoal, goalOptions: partner ? { targets: SUB_GOAL.targets, promises: SUB_GOAL.promises } : null };
  }

  /** Finish a stream: followers banked (a bonus for wins), the night's money paid, and chat votes on what you play next. */
  async function finish(tx: CareerExecutor, root: Root, row: Record<string, unknown>, result: "WON" | "LOST" | null, tally: Tally, chat: ChatEvent[], processed: number, wins = result === "WON" ? 1 : 0) {
    // Each win on stream (a challenger beaten, a drill passed): a couple of follows even in a small room, more in a big one.
    const streamer = (row.challenger as Challenger).streamer;
    // A collab: the winner takes a share of the other's audience (a little even in defeat).
    const bonus = wins * (2 + Math.round(tally.peak * 0.05)) + (streamer && result ? collabFollowers(streamer.followers, result === "WON") : 0);
    const format = String(row.format ?? "CHALLENGER") as StreamFormat;
    const pledges = result === "WON" ? tally.pledgedPence ?? 0 : 0;
    // A charity stream: the night's cheers go to the cause (and win more followers); the Invitational pays prize money by round reached.
    const charity = format === "CHARITY";
    if (charity) tally = { ...tally, raisedPence: streamIncome(tally) };
    const prize = format === "INVITATIONAL" && processed > 0 ? invitationalPrize(wins) : 0;
    const gained = Math.round((tally.followersGained + bonus) * (charity ? CHARITY.followerBonus : 1)), income = charity ? 0 : streamIncome(tally) + pledges;
    const poll = processed > 0 ? pollFor(root.world_seed, String(row.id), format) : null;
    await tx.execute(sql`UPDATE career_streams SET status='ENDED', result=${result}, tally=${JSON.stringify(tally)}::jsonb, chat=${JSON.stringify(chat)}::jsonb,
      processed_visits=${processed}, income_pence=${income + prize}, followers_gained=${gained}, poll=${poll ? JSON.stringify(poll) : null}::jsonb, ended_at=NOW()
      WHERE career_save_id=${root.id} AND id=${String(row.id)} AND status='LIVE'`);
    await tx.execute(sql`UPDATE career_stream_channels SET followers = followers + ${gained}, subscribers = subscribers + ${tally.subs}
      ${poll ? sql`, poll_pick = ${poll.winner}` : sql``} WHERE career_save_id=${root.id}`);
    // The night's best moment is clipped (it may go viral when the week is settled).
    if (tally.clip) await tx.execute(sql`INSERT INTO career_stream_clips (career_save_id, id, stream_id, season, week, kind, title, peak, status)
      VALUES (${root.id}, ${stableUuid(root.world_seed, STREAM.version, "stream-clip", String(row.id))}, ${String(row.id)}, ${Number(row.season)}, ${Number(row.week)}, ${tally.clip},
        ${CLIPS[tally.clip].title}, ${tally.peak}, 'NEW') ON CONFLICT DO NOTHING`);
    // A brand deal pays for every stream that got going (at least one visit thrown).
    const deal = processed > 0 ? (await tx.execute(sql`SELECT * FROM career_stream_deals WHERE career_save_id=${root.id} AND status='ACTIVE'`)).rows[0] : undefined;
    if (deal) {
      const n = Number(deal.streams_done) + 1, total = Number(deal.streams_total);
      await post(tx, root, { operationKey: `stream-deal:${row.id}`, category: "STREAM_INCOME", amountPence: Number(deal.per_stream_pence),
        reason: `${deal.brand_name} brand deal: stream ${n} of ${total}`, season: Number(row.season), week: Number(row.week), detail: { streamId: String(row.id), dealId: String(deal.id) } });
      await tx.execute(sql`UPDATE career_stream_deals SET streams_done=${n}, status=${n >= total ? "COMPLETED" : "ACTIVE"} WHERE career_save_id=${root.id} AND id=${String(deal.id)}`);
    }
    if (prize > 0) await post(tx, root, { operationKey: `stream-invitational:${row.id}`, category: "STREAM_INCOME", amountPence: prize,
      reason: `DartCast Invitational: ${wins >= INVITATIONAL.rounds.length ? "champion" : `out in the ${INVITATIONAL.rounds[wins].toLowerCase()}`}`, season: Number(row.season), week: Number(row.week),
      detail: { streamId: String(row.id), wins } });
    if (income > 0) await post(tx, root, { operationKey: `stream-income:${row.id}`, category: "STREAM_INCOME", amountPence: income,
      reason: `DartCast stream: ${tally.subs ? `${tally.subs} new sub${tally.subs === 1 ? "" : "s"}, ` : ""}bits and super chats${pledges ? ", pledges" : ""}`, season: Number(row.season), week: Number(row.week),
      detail: { streamId: String(row.id), format, bitsPence: tally.bitsPence, superchatsPence: tally.superchatsPence, pledgesPence: pledges, subs: tally.subs, peak: tally.peak } });
  }

  async function live(tx: CareerExecutor, root: Root, streamId: string) {
    const row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND id=${streamId}`)).rows[0];
    if (!row) throw new CareerError(404, "Stream not found");
    return row;
  }

  /** A match format's darts (play a viewer, or this King of the Oche round). */
  async function matchDarts(tx: CareerExecutor, root: Root, row: Record<string, unknown>, darts: unknown[], tier: TierKey, followers: number) {
    const format = String(row.format), round = Number(row.round ?? 0), total = roundsIn(format), king = total > 1;
    let state;
    try { state = replay(x01For(format, row.match_format), Number(row.first_thrower) as 0 | 1, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
    const processed = Number(row.processed_visits);
    let tally = row.tally as Tally;
    const fresh: ChatEvent[] = [], visits = state.visits;
    // Chat is seeded per round, so each King of the Oche round has its own reactions.
    const key = king ? `${row.id}:${round}` : String(row.id);
    for (let i = processed; i < visits.length; i++) {
      const v = visits[i], last = state.complete && i === visits.length - 1;
      const over = last ? (state.winner === 0 ? (king && round + 1 < total ? null : "WON") : "LOST") : null;
      if (v.thrower === 0) {
        tally = { ...tally, myDarts: (tally.myDarts ?? 0) + v.darts.length, myScoredDarts: (tally.myScoredDarts ?? 0) + v.darts.length, myPoints: (tally.myPoints ?? 0) + v.points };
        const dartsInLeg = v.checkout ? visits.filter(x => x.thrower === 0 && x.legNo === v.legNo && x.setNo === v.setNo).reduce((n, x) => n + x.darts.length, 0) : undefined;
        tally = bestClip(tally, clipFor({ points: v.points, checkout: v.checkout, startScore: v.startScore, dartsInLeg }));
      }
      const out = last && king && state.winner === 0 && round + 1 < total
        ? chatForMoment(root.world_seed, key, i, format === "KING" ? "KING_DOWN" : "THROUGH", tally, tier)
        : chatForVisit(root.world_seed, key, i, { thrower: v.thrower, points: v.points, bust: v.bust, checkout: v.checkout, startScore: v.startScore, legNo: v.legNo }, tally, tier, over);
      tally = out.tally; fresh.push(...out.events);
    }
    const chat = [...(row.chat as ChatEvent[]), ...fresh].slice(-200);
    if (!state.complete) {
      await tx.execute(sql`UPDATE career_streams SET darts=${JSON.stringify(darts)}::jsonb, tally=${JSON.stringify(tally)}::jsonb, chat=${JSON.stringify(chat)}::jsonb,
        processed_visits=${Math.max(processed, visits.length)} WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
      return fresh;
    }
    const won = state.winner === 0, challenger = row.challenger as Challenger;
    if (!king) {
      await tx.execute(sql`UPDATE career_streams SET darts=${JSON.stringify(darts)}::jsonb WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
      await finish(tx, root, row, won ? "WON" : "LOST", tally, chat, visits.length);
      return fresh;
    }
    const rounds = [...((row.rounds as StreamSession["rounds"]) ?? []), { challenger: challenger.name, result: won ? "WON" as const : "LOST" as const }];
    const wins = rounds.filter(r => r.result === "WON").length;
    if (!won || round + 1 >= total) {
      await tx.execute(sql`UPDATE career_streams SET darts=${JSON.stringify(darts)}::jsonb, rounds=${JSON.stringify(rounds)}::jsonb WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
      await finish(tx, root, row, won ? "WON" : "LOST", tally, chat, Number(row.processed_visits) + visits.length, wins);
      return fresh;
    }
    // Next up: a fresh match, and they throw first every other round.
    const nextUp = format === "KING" ? kingChallenger(root.world_seed, String(row.id), followers, round + 1)
      : invitationalChallenger(root.world_seed, String(row.id), Number(row.season), Number(row.week), round + 1);
    const hello: ChatEvent = format === "KING" ? { kind: "CHAT", user: nextUp.name, text: `My turn. ${wins} down, let's see you beat me` }
      : { kind: "CHAT", user: "DartCast", text: `${INVITATIONAL.rounds[round + 1]}: ${nextUp.name} awaits` };
    await tx.execute(sql`UPDATE career_streams SET darts='[]'::jsonb, round=${round + 1}, rounds=${JSON.stringify(rounds)}::jsonb, challenger=${JSON.stringify(nextUp)}::jsonb,
      first_thrower=${(round + 1) % 2}, processed_visits=0, tally=${JSON.stringify(tally)}::jsonb, chat=${JSON.stringify([...chat, hello])}::jsonb
      WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
    return [...fresh, hello];
  }

  /** A drill's darts (checkouts, Bob's 27, the average challenge). */
  async function drillDarts(tx: CareerExecutor, root: Root, row: Record<string, unknown>, darts: unknown[], tier: TierKey) {
    const spec = row.drill as DrillSpec;
    let state;
    try { state = replayDrill(spec, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
    const processed = Number(row.processed_visits);
    let tally = row.tally as Tally;
    const fresh: ChatEvent[] = [];
    for (let i = processed; i < state.visits.length; i++) {
      const v = state.visits[i], over = state.complete && i === state.visits.length - 1 ? state.result : null;
      const scored = spec.kind === "SCORING";
      tally = { ...tally, myDarts: (tally.myDarts ?? 0) + v.darts.length, ...(scored ? { myScoredDarts: (tally.myScoredDarts ?? 0) + v.darts.length, myPoints: (tally.myPoints ?? 0) + v.points } : {}) };
      tally = bestClip(tally, v.note === "CHECKOUT" ? clipFor({ points: v.points, checkout: true, startScore: v.points }) : v.note === "HIT" && v.target === "Bull" ? "BOBS_BULL"
        : v.points === 180 ? "MAX" : null);
      const out = chatForDrillVisit(root.world_seed, String(row.id), i, { note: v.note, points: v.points, startScore: v.note === "CHECKOUT" ? v.points : undefined },
        tally, tier, over, spec.kind === "SCORING");
      tally = out.tally; fresh.push(...out.events);
    }
    const chat = [...(row.chat as ChatEvent[]), ...fresh].slice(-200);
    await tx.execute(sql`UPDATE career_streams SET darts=${JSON.stringify(darts)}::jsonb, tally=${JSON.stringify(tally)}::jsonb, chat=${JSON.stringify(chat)}::jsonb,
      processed_visits=${Math.max(processed, state.visits.length)} WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
    if (state.complete) await finish(tx, root, row, state.result, tally, chat, state.visits.length);
    return fresh;
  }

  return {
    async setPathway(actor: CareerActor, saveId: string, body: unknown) {
      const input = z.object({ focus: z.enum(["OPEN", "DARTCAST"]), weeklyFrequency: z.number().int().min(0).max(STREAM.perWeek) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        if (root.status !== "ACTIVE") throw new CareerError(409, "Career is retired");
        const settings = { ...(root.settings_snapshot ?? {}),
          careerPathway: { focus: input.focus, weeklyFrequency: input.focus === "DARTCAST" ? input.weeklyFrequency : 0 } };
        await tx.execute(sql`UPDATE career_saves SET settings_snapshot=${JSON.stringify(settings)}::jsonb WHERE id=${root.id}`);
        const updated = { ...root, settings_snapshot: settings };
        await schedulePathwayWeek(tx, updated, true);
        return view(tx, updated);
      });
    },
    async schedulePathway(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        await schedulePathwayWeek(tx, root);
        return view(tx, root);
      });
    },
    async read(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => view(tx, await lockRoot(tx, actor, saveId, false) as unknown as Root));
    },
    async session(actor: CareerActor, saveId: string, streamId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const ch = await channel(tx, root);
        return sessionFrom(await live(tx, root, streamId), ch.handle, tierFor(ch.followers).key);
      });
    },

    /** Go live on a free night this week (up to three a week, one at a time) in the format of your choice. */
    async goLive(actor: CareerActor, saveId: string, body: unknown) {
      const { dayOfWeek, format = "CHALLENGER", streamer: streamerKey } = z.object({ dayOfWeek: z.number().int().min(1).max(7),
        format: z.enum(["COLLAB", "INVITATIONAL", ...FORMATS.map(f => f.key)] as [StreamFormat, ...StreamFormat[]]).optional(), streamer: z.string().max(40).optional() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const v = await view(tx, root);
        if (v.live) throw new CareerError(409, "You're already live: finish that stream first");
        if (v.streamsThisWeek >= STREAM.perWeek) throw new CareerError(409, `You've streamed ${STREAM.perWeek} times this week`);
        const planned = (await tx.execute(sql`SELECT id FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season}
          AND family='DARTCAST' AND status='ACCEPTED' AND day=${absoluteDay(week, dayOfWeek)}`)).rows[0];
        if (!v.freeNights.includes(dayOfWeek) && !planned) throw new CareerError(409, "You're booked that night");
        const partner = format === "COLLAB" ? v.collabs.find(c => c.key === streamerKey) : undefined;
        if (format === "COLLAB" && !partner) throw new CareerError(400, "Pick a streamer to collab with");
        if (partner && !partner.ok) throw new CareerError(409, `${partner.handle}: ${partner.why}`);
        if (format === "INVITATIONAL" && !v.invitational.open) throw new CareerError(409, v.invitational.why ?? "The Invitational isn't open");
        if (format === "CHARITY" && v.tier.key === "NEWCOMER") throw new CareerError(409, "Charity streams start once you're an Affiliate (viewers can cheer)");
        if (format === "CHARITY" && v.charity.doneThisMonth) throw new CareerError(409, "One charity stream a month");
        const n = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_streams WHERE career_save_id=${root.id}`)).rows[0].n) + 1;
        const key = `${season}:${week}:${n}`;
        const last = (await tx.execute(sql`SELECT season, day FROM career_streams WHERE career_save_id=${root.id} ORDER BY season DESC, day DESC LIMIT 1`)).rows[0];
        const day = absoluteDay(week, dayOfWeek);
        const since = last && Number(last.season) === season ? Math.max(0, day - Number(last.day)) : null;
        const fans = Math.max(0, (await fansForEffects(tx, root.id)) ?? 0);
        const viewers = Math.max(1, Math.round(openingViewers(root.world_seed, key, v.followers, fans, dayOfWeek, since) * (format === "COLLAB" ? 1 : format === "INVITATIONAL" ? formatByKey(format).crowd : crowdFor(format, v.lastFormat, v.pollPick))
          + (partner ? partner.followers * COLLAB.tuneIn : 0)));
        const id = stableUuid(root.world_seed, STREAM.version, "stream", root.id, key);
        const tally: Tally = { viewers, peak: viewers, hype: 0.6, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0 };
        let challenger: Challenger, drill: DrillSpec | null = null, hello: ChatEvent[];
        if (format === "INVITATIONAL") {
          challenger = invitationalChallenger(root.world_seed, id, season, week, 0);
          hello = [{ kind: "CHAT", user: "DartCast", text: `Welcome to the DartCast Invitational! ${INVITATIONAL.rounds[0]}: ${challenger.name}. First to ${STREAM.legsToWin}` }];
        } else if (partner) {
          challenger = { name: partner.handle, avg: partner.avg, bot: { config: collabBot(partner.avg), seed: stableUuid(root.world_seed, STREAM.version, "stream-bot", root.id, key) },
            streamer: { key: partner.key, followers: partner.followers } };
          hello = [{ kind: "CHAT", user: partner.handle, text: `Collab night! My lot vs yours, first to ${STREAM.legsToWin}. You throw first` },
            { kind: "CHAT", user: "DartCast", text: `${partner.handle}'s viewers are joining the stream` }];
        } else if (format === "CHALLENGER" || format === "KING" || format === "CHARITY") {
          if (format === "KING") challenger = kingChallenger(root.world_seed, id, v.followers, 0);
          else { const c = challengerFor(root.world_seed, key, v.followers); challenger = { name: c.name, avg: c.avg, bot: { config: c.config, seed: stableUuid(root.world_seed, STREAM.version, "stream-bot", root.id, key) } }; }
          hello = [{ kind: "CHAT", user: challenger.name, text: format === "KING" ? "I'll be first up. One leg, you throw first" : `I'll have a go! First to ${STREAM.legsToWin}, you throw first` },
            ...(format === "CHARITY" ? [{ kind: "CHAT" as const, user: "DartCast", text: "Charity night: every bit and super chat tonight goes to the cause" }] : [])];
        } else {
          if (format === "CHECKOUTS") drill = { kind: "CHECKOUTS", targets: checkoutTargets(root.world_seed, key), visitsEach: 3 };
          else if (format === "BOBS_27") drill = { kind: "BOBS_27" };
          else {
            const prior = (await tx.execute(sql`SELECT drill->>'achieved' AS a FROM career_streams WHERE career_save_id=${root.id} AND format='SCORING' AND status='ENDED'
              AND drill ? 'achieved' ORDER BY season DESC, day DESC LIMIT 1`)).rows[0];
            drill = { kind: "SCORING", visits: 33, targetAverage: scoringTarget(prior ? Number(prior.a) : null) };
          }
          challenger = { name: formatByKey(format).name, avg: 0, bot: null };
          hello = [{ kind: "CHAT", user: "DartCast", text: drill.kind === "CHECKOUTS" ? `Chat picked tonight's finishes: ${drill.targets.join(", ")}`
            : drill.kind === "SCORING" ? `Target tonight: a ${drill.targetAverage} average. Pledges pay if you beat it` : "Bob's 27: D1 first. Good luck!" }];
        }
        if (v.pollPick === format && v.lastFormat !== null) hello.push({ kind: "CHAT", user: "DartCast", text: "Chat voted for this one: they've turned up for it" });
        await tx.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, format, challenger, drill, first_thrower, tally, chat, processed_visits)
          VALUES (${root.id}, ${id}, ${season}, ${week}, ${day}, 'LIVE', ${format}, ${JSON.stringify(challenger)}::jsonb, ${drill ? JSON.stringify(drill) : null}::jsonb, 0,
            ${JSON.stringify(tally)}::jsonb, ${JSON.stringify(hello)}::jsonb, 0)`);
        if (planned) await tx.execute(sql`DELETE FROM career_life_commitments WHERE career_save_id=${root.id} AND id=${String(planned.id)}`);
        return sessionFrom((await live(tx, root, id)), v.handle, v.tier.key);
      });
    },

    /**
     * The darts so far (the whole log for this match, round or drill, as the scorer keeps it). The server replays them with
     * the shared rules and chat reacts to each new visit; when it's over the stream ends and pays. The same log again changes nothing.
     */
    async darts(actor: CareerActor, saveId: string, streamId: string, body: unknown) {
      const { darts } = z.object({ darts: z.array(z.unknown()).max(600) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = await live(tx, root, streamId);
        const ch = await channel(tx, root);
        const tier = tierFor(ch.followers).key;
        if (row.status !== "LIVE") return { session: sessionFrom(row, ch.handle, tier), events: [] as ChatEvent[] };
        const events = isDrill(String(row.format)) ? await drillDarts(tx, root, row, darts, tier) : await matchDarts(tx, root, row, darts, tier, ch.followers);
        // Remember the average reached on a scoring challenge, for next time's target.
        const after = await live(tx, root, streamId);
        if (after.status === "ENDED" && after.format === "SCORING") {
          const avg = replayDrill(after.drill as DrillSpec, after.darts as unknown[]).average;
          await tx.execute(sql`UPDATE career_streams SET drill = drill || ${JSON.stringify({ achieved: avg })}::jsonb WHERE career_save_id=${root.id} AND id=${streamId}`);
        }
        return { session: sessionFrom(await live(tx, root, streamId), ch.handle, tier), events };
      });
    },

    /**
     * Stream your real match from the venue (an event without TV cameras): chat follows the match's own dart log, kept by
     * the live match. `start` false only reports; true starts the stream (once) and catches chat up with the darts so far.
     */
    async matchStream(actor: CareerActor, saveId: string, matchId: string, start: boolean): Promise<MatchStream> {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, start) as unknown as Root;
        const live = (await tx.execute(sql`SELECT s.format, s.first_thrower, s.darts, s.opponent_key, s.bot_config, s.status, m.scheduled_day, i.presentation_tier, i.season
          FROM career_match_sessions s JOIN career_tournament_matches m ON m.career_save_id=s.career_save_id AND m.id=s.match_id
          JOIN career_event_instances i ON i.career_save_id=m.career_save_id AND i.id=m.event_id
          WHERE s.career_save_id=${root.id} AND s.match_id=${matchId}`)).rows[0];
        let row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND match_id=${matchId}`)).rows[0];
        const ch = await channel(tx, root), tier = tierFor(ch.followers).key;
        const why = !live ? "Open the match first" : TELEVISED.has(String(live.presentation_tier)) ? "This match is on TV: no streaming from the venue"
          : !row && live.status === "COMPLETED" ? "This match is over" : null;
        if (!start || why || !live) return { eligible: !why, why, session: row ? sessionFrom(row, ch.handle, tier) : null, events: [] };
        if (!row) {
          const npc = (await loadNpcs(tx, root.id, { ids: [String(live.opponent_key)] }))[0];
          const season = Number(live.season), day = Number(live.scheduled_day), week = Math.ceil(day / 7);
          const id = stableUuid(root.world_seed, STREAM.version, "stream-match", root.id, matchId);
          const fans = Math.max(0, (await fansForEffects(tx, root.id)) ?? 0);
          const viewers = Math.max(1, Math.round(openingViewers(root.world_seed, id, ch.followers, fans, ((day - 1) % 7) + 1, null) * formatByKey("MATCH").crowd));
          const tally: Tally = { viewers, peak: viewers, hype: 0.7, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0 };
          const name = npc ? `${npc.firstName} ${npc.surname}` : "Opponent";
          const hello: ChatEvent[] = [{ kind: "CHAT", user: "DartCast", text: `Live from the venue: ${ch.handle} vs ${name}. This one's for real` }];
          await tx.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, format, challenger, first_thrower, tally, chat, processed_visits, match_id, match_format)
            VALUES (${root.id}, ${id}, ${season}, ${week}, ${day}, 'LIVE', 'MATCH', ${JSON.stringify({ name, avg: Number((live.bot_config as { avg: number }).avg), bot: null })}::jsonb,
              ${Number(live.first_thrower ?? 0)}, ${JSON.stringify(tally)}::jsonb, ${JSON.stringify(hello)}::jsonb, 0, ${matchId}, ${JSON.stringify(live.format)}::jsonb)
            ON CONFLICT DO NOTHING`);
          row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND match_id=${matchId}`)).rows[0];
        }
        let events: ChatEvent[] = [];
        // Chat catches up with the match's own darts (once the bull-up has decided who throws first).
        if (row.status === "LIVE" && live.first_thrower !== null) {
          if (Number(row.first_thrower) !== Number(live.first_thrower)) {
            await tx.execute(sql`UPDATE career_streams SET first_thrower=${Number(live.first_thrower)} WHERE career_save_id=${root.id} AND id=${String(row.id)}`);
            row = { ...row, first_thrower: Number(live.first_thrower) };
          }
          events = await matchDarts(tx, root, row, live.darts as unknown[], tier, ch.followers);
          row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND id=${String(row.id)}`)).rows[0];
        }
        return { eligible: true, why: null, session: sessionFrom(row, ch.handle, tier), events };
      });
    },

    /** Take a brand's offer (it pays for each of your next streams) or turn it down. */
    async answerDeal(actor: CareerActor, saveId: string, dealId: string, body: unknown) {
      const { accept } = z.object({ accept: z.boolean() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = (await tx.execute(sql`SELECT status FROM career_stream_deals WHERE career_save_id=${root.id} AND id=${dealId}`)).rows[0];
        if (!row) throw new CareerError(404, "Brand deal not found");
        if (row.status !== "OFFERED") throw new CareerError(409, "That offer has gone");
        await tx.execute(sql`UPDATE career_stream_deals SET status=${accept ? "ACTIVE" : "DECLINED"} WHERE career_save_id=${root.id} AND id=${dealId}`);
        return view(tx, root);
      });
    },

    /** Set this month's sub goal (Partner up, one a month): hit it and the buzz wins followers. */
    async setSubGoal(actor: CareerActor, saveId: string, body: unknown) {
      const { target, promise } = z.object({ target: z.number().int(), promise: z.string() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), month = monthOf(Number(root.current_week));
        const v = await view(tx, root);
        if (!v.goalOptions) throw new CareerError(409, "Sub goals start once you're a Partner");
        if (!SUB_GOAL.targets.includes(target) || !(SUB_GOAL.promises as readonly string[]).includes(promise)) throw new CareerError(400, "Pick a target and a promise from the list");
        if (v.subGoal && v.subGoal.season === season && v.subGoal.month === month) throw new CareerError(409, "You've set this month's goal");
        await tx.execute(sql`UPDATE career_stream_channels SET sub_goal=${JSON.stringify({ season, month, target, promise, status: "ON" })}::jsonb WHERE career_save_id=${root.id}`);
        return view(tx, root);
      });
    },

    /** End the stream early (no result): followers and money so far are kept. */
    async end(actor: CareerActor, saveId: string, streamId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = await live(tx, root, streamId);
        if (row.status === "LIVE") {
          const wins = ((row.rounds as StreamSession["rounds"]) ?? []).filter(r => r.result === "WON").length;
          await finish(tx, root, row, null, row.tally as Tally, row.chat as ChatEvent[], Number(row.processed_visits) + wins, wins);
        }
        const ch = await channel(tx, root);
        return sessionFrom(await live(tx, root, streamId), ch.handle, tierFor(ch.followers).key);
      });
    },
  };
}

