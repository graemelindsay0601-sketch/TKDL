import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { stableUuid } from "../world/random.ts";
import { replay, type X01Format } from "../../shared/darts-rules/x01.ts";
import { absoluteDay } from "../calendar/generation.ts";
import { post } from "../finance/ledger.ts";
import { fansForEffects } from "../fans/service.ts";
import { STREAM, STREAM_MONEY, challengerFor, chatForVisit, followersFromFans, nextTier, openingViewers, streamIncome, tierFor, type ChatEvent, type Tally, type TierKey, BRANDS } from "./model.ts";

type Root = { id: string; world_seed: string; current_season: number | string; current_week: number | string; status: string; career_name?: string | null };
const HUMAN = "HUMAN";
const FORMAT: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: STREAM.legsToWin * 2 - 1 };

export type StreamSession = { id: string; status: "LIVE" | "ENDED"; season: number; week: number; dayOfWeek: number; handle: string; tier: TierKey;
  challenger: { name: string; avg: number; bot: { config: { avg: number; sd: number; checkoutPct: number; hitAcc: number }; seed: string } };
  format: X01Format; firstThrower: 0 | 1; tally: Tally; processedVisits: number; result: "WON" | "LOST" | null; incomePence: number | null; followersGained: number | null;
  chat: ChatEvent[]; darts: unknown[] };
export type Deal = { id: string; brand: string; what: string; perStreamPence: number; streamsTotal: number; streamsDone: number; expiresWeek: number };
export type StreamingView = {
  season: number; week: number; handle: string; followers: number; tier: { key: TierKey; name: string; perks: string };
  next: { name: string; followers: number; perks: string } | null; tiers: { key: string; name: string; followers: number; perks: string; reached: boolean }[];
  streamsThisWeek: number; perWeek: number; freeNights: number[]; live: string | null;
  totals: { streams: number; earnedPence: number; won: number };
  /** Subscribers who renew every four weeks (half of each £2.50 to you), and the week the next renewals are paid. */
  subscribers: number; renewsWeek: number;
  /** A brand's offer to answer, and the deal you're doing now. */
  dealOffer: Deal | null; deal: Deal | null;
  /** Stars get invitations to the televised invitationals. */
  invitations: boolean;
  videos: { id: string; season: number; week: number; dayOfWeek: number; challenger: string; result: "WON" | "LOST" | null; peak: number; followersGained: number; incomePence: number }[];
};

/** Your channel (made on first visit, its first followers drawn from your fan base). */
async function channel(tx: CareerExecutor, root: Root) {
  const row = (await tx.execute(sql`SELECT * FROM career_stream_channels WHERE career_save_id=${root.id}`)).rows[0];
  if (row) return { handle: String(row.handle), followers: Number(row.followers), subscribers: Number(row.subscribers ?? 0) };
  const fans = Math.max(0, (await fansForEffects(tx, root.id)) ?? 0);
  const name = String((await tx.execute(sql`SELECT career_name FROM career_saves WHERE id=${root.id}`)).rows[0]?.career_name ?? "Darts").replace(/[^A-Za-z0-9]/g, "").slice(0, 16) || "Darts";
  const handle = `${name}Darts`, followers = followersFromFans(fans);
  await tx.execute(sql`INSERT INTO career_stream_channels (career_save_id, handle, followers) VALUES (${root.id}, ${handle}, ${followers}) ON CONFLICT DO NOTHING`);
  return { handle, followers, subscribers: 0 };
}

const dealFrom = (r: Record<string, unknown>): Deal => ({ id: String(r.id), brand: String(r.brand_name), what: BRANDS.find(b => b.key === r.brand_key)?.what ?? "a brand",
  perStreamPence: Number(r.per_stream_pence), streamsTotal: Number(r.streams_total), streamsDone: Number(r.streams_done), expiresWeek: Number(r.expires_week) });

/** Nights this week you're free to stream (no event, commitment or other stream booked). */
async function freeNights(tx: CareerExecutor, root: Root) {
  const season = Number(root.current_season), week = Number(root.current_week);
  const taken = new Set((await tx.execute(sql`SELECT day FROM career_participant_bookings WHERE career_save_id=${root.id} AND season=${season} AND participant_key=${HUMAN}
      AND day BETWEEN ${absoluteDay(week, 1)} AND ${absoluteDay(week, 7)}
    UNION SELECT day FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season} AND status='ACCEPTED' AND day BETWEEN ${absoluteDay(week, 1)} AND ${absoluteDay(week, 7)}
    UNION SELECT day FROM career_streams WHERE career_save_id=${root.id} AND season=${season} AND week=${week}`)).rows.map(r => Number(r.day)));
  return [1, 2, 3, 4, 5, 6, 7].filter(d => !taken.has(absoluteDay(week, d)));
}

const sessionFrom = (r: Record<string, unknown>, handle: string, tier: TierKey): StreamSession => ({
  id: String(r.id), status: r.status as StreamSession["status"], season: Number(r.season), week: Number(r.week), dayOfWeek: ((Number(r.day) - 1) % 7) + 1, handle, tier,
  challenger: r.challenger as StreamSession["challenger"], format: FORMAT, firstThrower: Number(r.first_thrower) as 0 | 1, tally: r.tally as Tally,
  processedVisits: Number(r.processed_visits), result: (r.result as StreamSession["result"]) ?? null,
  incomePence: r.income_pence === null ? null : Number(r.income_pence), followersGained: r.followers_gained === null ? null : Number(r.followers_gained),
  chat: ((r.chat as ChatEvent[]) ?? []).slice(-60), darts: (r.darts as unknown[]) ?? [] });

export function createCareerStreamingService(database: CareerDatabase) {
  async function view(tx: CareerExecutor, root: Root): Promise<StreamingView> {
    const season = Number(root.current_season), week = Number(root.current_week);
    const ch = await channel(tx, root);
    const tier = tierFor(ch.followers), next = nextTier(ch.followers);
    const rows = (await tx.execute(sql`SELECT id, season, week, day, status, challenger, result, tally, income_pence, followers_gained FROM career_streams
      WHERE career_save_id=${root.id} ORDER BY season DESC, week DESC, created_at DESC`)).rows;
    const ended = rows.filter(r => r.status === "ENDED");
    const deals = (await tx.execute(sql`SELECT * FROM career_stream_deals WHERE career_save_id=${root.id} AND status IN ('OFFERED','ACTIVE')`)).rows;
    const offer = deals.find(d => d.status === "OFFERED"), deal = deals.find(d => d.status === "ACTIVE");
    return { season, week, handle: ch.handle, followers: ch.followers, tier: { key: tier.key, name: tier.name, perks: tier.perks },
      next: next ? { name: next.name, followers: next.followers, perks: next.perks } : null,
      tiers: STREAM.tiers.map(t => ({ key: t.key, name: t.name, followers: t.followers, perks: t.perks, reached: ch.followers >= t.followers })),
      streamsThisWeek: rows.filter(r => Number(r.season) === season && Number(r.week) === week).length, perWeek: STREAM.perWeek,
      freeNights: root.status === "ACTIVE" ? await freeNights(tx, root) : [], live: rows.find(r => r.status === "LIVE")?.id as string ?? null,
      totals: { streams: ended.length, earnedPence: ended.reduce((n, r) => n + Number(r.income_pence ?? 0), 0), won: ended.filter(r => r.result === "WON").length },
      videos: ended.slice(0, 24).map(r => ({ id: String(r.id), season: Number(r.season), week: Number(r.week), dayOfWeek: ((Number(r.day) - 1) % 7) + 1,
        challenger: String((r.challenger as { name: string }).name), result: (r.result as "WON" | "LOST" | null) ?? null, peak: Number((r.tally as Tally).peak),
        followersGained: Number(r.followers_gained ?? 0), incomePence: Number(r.income_pence ?? 0) })),
      subscribers: ch.subscribers, renewsWeek: Math.ceil(week / STREAM_MONEY.monthWeeks) * STREAM_MONEY.monthWeeks,
      dealOffer: offer ? dealFrom(offer) : null, deal: deal ? dealFrom(deal) : null, invitations: tier.key === "STAR" };
  }

  /** Finish a stream: followers banked (a bonus for beating the challenger), the night's money paid. */
  async function finish(tx: CareerExecutor, root: Root, row: Record<string, unknown>, result: "WON" | "LOST" | null, tally: Tally, chat: ChatEvent[], processed: number) {
    // Beating the challenger on stream: a couple of follows even in a small room, more in a big one.
    const bonus = result === "WON" ? 2 + Math.round(tally.peak * 0.05) : 0;
    const gained = tally.followersGained + bonus, income = streamIncome(tally);
    await tx.execute(sql`UPDATE career_streams SET status='ENDED', result=${result}, tally=${JSON.stringify(tally)}::jsonb, chat=${JSON.stringify(chat)}::jsonb,
      processed_visits=${processed}, income_pence=${income}, followers_gained=${gained}, ended_at=NOW() WHERE career_save_id=${root.id} AND id=${String(row.id)} AND status='LIVE'`);
    await tx.execute(sql`UPDATE career_stream_channels SET followers = followers + ${gained}, subscribers = subscribers + ${tally.subs} WHERE career_save_id=${root.id}`);
    // A brand deal pays for every stream that got going (at least one visit thrown).
    const deal = processed > 0 ? (await tx.execute(sql`SELECT * FROM career_stream_deals WHERE career_save_id=${root.id} AND status='ACTIVE'`)).rows[0] : undefined;
    if (deal) {
      const n = Number(deal.streams_done) + 1, total = Number(deal.streams_total);
      await post(tx, root, { operationKey: `stream-deal:${row.id}`, category: "STREAM_INCOME", amountPence: Number(deal.per_stream_pence),
        reason: `${deal.brand_name} brand deal: stream ${n} of ${total}`, season: Number(row.season), week: Number(row.week), detail: { streamId: String(row.id), dealId: String(deal.id) } });
      await tx.execute(sql`UPDATE career_stream_deals SET streams_done=${n}, status=${n >= total ? "COMPLETED" : "ACTIVE"} WHERE career_save_id=${root.id} AND id=${String(deal.id)}`);
    }
    if (income > 0) await post(tx, root, { operationKey: `stream-income:${row.id}`, category: "STREAM_INCOME", amountPence: income,
      reason: `DartCast stream: ${tally.subs ? `${tally.subs} new sub${tally.subs === 1 ? "" : "s"}, ` : ""}bits and super chats`, season: Number(row.season), week: Number(row.week),
      detail: { streamId: String(row.id), bitsPence: tally.bitsPence, superchatsPence: tally.superchatsPence, subs: tally.subs, peak: tally.peak } });
  }

  async function live(tx: CareerExecutor, root: Root, streamId: string) {
    const row = (await tx.execute(sql`SELECT * FROM career_streams WHERE career_save_id=${root.id} AND id=${streamId}`)).rows[0];
    if (!row) throw new CareerError(404, "Stream not found");
    return row;
  }

  return {
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

    /** Go live on a free night this week (up to three a week, one at a time): a challenger from chat steps up. */
    async goLive(actor: CareerActor, saveId: string, body: unknown) {
      const { dayOfWeek } = z.object({ dayOfWeek: z.number().int().min(1).max(7) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const v = await view(tx, root);
        if (v.live) throw new CareerError(409, "You're already live: finish that stream first");
        if (v.streamsThisWeek >= STREAM.perWeek) throw new CareerError(409, `You've streamed ${STREAM.perWeek} times this week`);
        if (!v.freeNights.includes(dayOfWeek)) throw new CareerError(409, "You're booked that night");
        const n = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_streams WHERE career_save_id=${root.id}`)).rows[0].n) + 1;
        const key = `${season}:${week}:${n}`;
        const last = (await tx.execute(sql`SELECT season, day FROM career_streams WHERE career_save_id=${root.id} ORDER BY season DESC, day DESC LIMIT 1`)).rows[0];
        const day = absoluteDay(week, dayOfWeek);
        const since = last && Number(last.season) === season ? Math.max(0, day - Number(last.day)) : null;
        const fans = Math.max(0, (await fansForEffects(tx, root.id)) ?? 0);
        const viewers = openingViewers(root.world_seed, key, v.followers, fans, dayOfWeek, since);
        const c = challengerFor(root.world_seed, key, v.followers);
        const challenger = { name: c.name, avg: c.avg, bot: { config: c.config, seed: stableUuid(root.world_seed, STREAM.version, "stream-bot", root.id, key) } };
        const tally: Tally = { viewers, peak: viewers, hype: 0.6, followersGained: 0, followerCarry: 0, bitsPence: 0, superchatsPence: 0, subs: 0 };
        const id = stableUuid(root.world_seed, STREAM.version, "stream", root.id, key);
        const hello: ChatEvent[] = [{ kind: "CHAT", user: c.name, text: `I'll have a go! First to ${STREAM.legsToWin}, you throw first` }];
        await tx.execute(sql`INSERT INTO career_streams (career_save_id, id, season, week, day, status, challenger, first_thrower, tally, chat, processed_visits)
          VALUES (${root.id}, ${id}, ${season}, ${week}, ${day}, 'LIVE', ${JSON.stringify(challenger)}::jsonb, 0, ${JSON.stringify(tally)}::jsonb, ${JSON.stringify(hello)}::jsonb, 0)`);
        return sessionFrom((await live(tx, root, id)), v.handle, v.tier.key);
      });
    },

    /**
     * The darts so far (the whole log, as the scorer keeps it). The server replays them with the shared rules and chat reacts
     * to each new visit; when the match is over the stream ends and pays. Sending the same log again changes nothing.
     */
    async darts(actor: CareerActor, saveId: string, streamId: string, body: unknown) {
      const { darts } = z.object({ darts: z.array(z.unknown()).max(600) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = await live(tx, root, streamId);
        const ch = await channel(tx, root);
        const tier = tierFor(ch.followers).key;
        if (row.status !== "LIVE") return { session: sessionFrom(row, ch.handle, tier), events: [] as ChatEvent[] };
        let state;
        try { state = replay(FORMAT, Number(row.first_thrower) as 0 | 1, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
        const processed = Number(row.processed_visits);
        let tally = row.tally as Tally;
        const fresh: ChatEvent[] = [];
        const visits = state.visits;
        for (let i = processed; i < visits.length; i++) {
          const v = visits[i];
          const over = state.complete && i === visits.length - 1 ? (state.winner === 0 ? "WON" : "LOST") : null;
          const out = chatForVisit(root.world_seed, String(row.id), i, { thrower: v.thrower, points: v.points, bust: v.bust, checkout: v.checkout, startScore: v.startScore, legNo: v.legNo },
            tally, tier, over);
          tally = out.tally; fresh.push(...out.events);
        }
        const chat = [...(row.chat as ChatEvent[]), ...fresh].slice(-200);
        if (state.complete) await finish(tx, root, row, state.winner === 0 ? "WON" : "LOST", tally, chat, visits.length);
        await tx.execute(sql`UPDATE career_streams SET darts=${JSON.stringify(darts)}::jsonb WHERE career_save_id=${root.id} AND id=${streamId}`);
        if (!state.complete) await tx.execute(sql`UPDATE career_streams SET tally=${JSON.stringify(tally)}::jsonb, chat=${JSON.stringify(chat)}::jsonb, processed_visits=${Math.max(processed, visits.length)}
          WHERE career_save_id=${root.id} AND id=${streamId}`);
        return { session: sessionFrom(await live(tx, root, streamId), ch.handle, tier), events: fresh };
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

    /** End the stream early (no result): followers and money so far are kept. */
    async end(actor: CareerActor, saveId: string, streamId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const row = await live(tx, root, streamId);
        if (row.status === "LIVE") await finish(tx, root, row, null, row.tally as Tally, row.chat as ChatEvent[], Number(row.processed_visits));
        const ch = await channel(tx, root);
        return sessionFrom(await live(tx, root, streamId), ch.handle, tierFor(ch.followers).key);
      });
    },
  };
}
