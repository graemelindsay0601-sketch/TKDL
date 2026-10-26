import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { LOCALITIES } from "../calendar/geography.ts";
import { absoluteDay } from "../calendar/generation.ts";
import { WEEKS_PER_SEASON } from "../calendar/config.ts";
import type { RootRow } from "../calendar/engine.ts";
import { loadNpcs } from "../world/repository.ts";
import { createPerformance } from "../world/performance.ts";
import { toCareerBotConfig } from "../world/bot-adapter.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { SIMULATION_VERSION } from "../world/config.ts";
import { post } from "../finance/ledger.ts";
import { availableOf, homeLocalityOf, playersOf } from "../money/service.ts";
import { destinationsFrom, tripCostTo } from "../roadtrip/model.ts";
import { freeNightsInWeek } from "../nights.ts";
import { replay, type X01Format } from "../../shared/darts-rules/x01.ts";
import type { Npc } from "../world/types.ts";
import { PROAM, appearanceFor, feeFor, prizeFor, weekNights } from "./model.ts";

type Root = RootRow & { player_id?: number; has_tour_card?: boolean };
type Row = Record<string, unknown>;
type BotConfig = { avg: number; sd: number; checkoutPct: number; hitAcc: number };
export const PROAM_FORMAT: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: PROAM.bestOfLegs };

export type ProAmNight = { key: string; town: string; dayOfWeek: number; travelPence: number; free: boolean;
  /** Amateur side: the pro, your slot fee and the prize for beating them. */
  pro: { name: string; rank: number | null; avg: number } | null; feePence: number; prizePence: number;
  /** Pro side: what you're paid to be the pro. */
  appearancePence: number };
export type ProAmBooking = { id: string; role: "AMATEUR" | "PRO"; town: string; dayOfWeek: number; status: "BOOKED" | "PLAYED" | "MISSED";
  pro: { name: string; rank: number | null; avg: number } | null; feePence: number; prizePence: number; appearancePence: number;
  result: { won?: boolean; legs?: { name: string; youWon: boolean }[]; beatenBy?: number; source?: "LIVE" | "SIM" } | null };
export type ProAmView = {
  season: number; week: number; side: "AMATEUR" | "PRO"; availablePence: number; nights: ProAmNight[]; booking: ProAmBooking | null;
  record: { slots: number; prosBeaten: number; prizePence: number; nightsAsPro: number; appearancePence: number; amateursBeatYou: number };
  history: (ProAmBooking & { season: number; week: number })[];
};
export type ProAmSession = { id: string; status: "LIVE" | "PLAYED"; you: string; pro: { name: string; avg: number; bot: { config: BotConfig; seed: string } };
  format: X01Format; firstThrower: 0; darts: unknown[]; won: boolean | null; matchNumber: number; matchTotal: number; beatenBy: number | null };

const PERF_CONTEXT = { category: "floor" as const, roundImportance: 0.3, elimination: false };

export function createCareerProAmService(database: CareerDatabase) {
  /** The touring pros: the top 64 of the world rankings (or, before there are rankings, every professional). */
  async function pros(tx: CareerExecutor, root: Root) {
    const ranked = (await tx.execute(sql`SELECT npc_id, current_position FROM career_ranking_participants WHERE career_save_id=${root.id} AND list_key='pro-world'
      AND npc_id IS NOT NULL AND current_position IS NOT NULL AND current_position <= 64 ORDER BY current_position`)).rows;
    if (ranked.length) return ranked.map(r => ({ key: String(r.npc_id), rank: Number(r.current_position) }));
    return (await tx.execute(sql`SELECT id FROM career_world_players WHERE career_save_id=${root.id} AND status='ACTIVE' AND professional_status='PROFESSIONAL' ORDER BY id LIMIT 64`)).rows
      .map(r => ({ key: String(r.id), rank: null as number | null }));
  }
  async function yourRank(tx: CareerExecutor, root: Root) {
    const r = (await tx.execute(sql`SELECT current_position FROM career_ranking_participants WHERE career_save_id=${root.id} AND list_key='pro-world' AND participant_key='HUMAN'`)).rows[0];
    return r?.current_position == null ? null : Number(r.current_position);
  }
  const proConfig = (root: Root, npc: Npc, key: string) => {
    const c = toCareerBotConfig(createPerformance(npc, PERF_CONTEXT, root.difficulty as never, scopedRandom(root.world_seed, root.world_generation_version, "performance", SIMULATION_VERSION, key, npc.id)));
    return { avg: c.avg, sd: c.sd, checkoutPct: c.checkoutPct, hitAcc: c.hitAcc };
  };

  async function nearbyAmateurs(tx: CareerExecutor, root: Root, localityKey: string) {
    const town = LOCALITIES.find(l => l.key === localityKey);
    if (!town) return [];
    const nearby = destinationsFrom(town.key).sort((a, b) => tripCostTo(town.key, a).pence - tripCostTo(town.key, b).pence).slice(0, 5);
    const members = [await playersOf(tx, root, town), ...(await Promise.all(nearby.map(l => playersOf(tx, root, l))))].flat();
    return [...new Map(members.filter(m => !m.professional).map(m => [m.key, m])).values()].slice(0, PROAM.amateurs);
  }

  async function offers(tx: CareerExecutor, root: Root, side: "AMATEUR" | "PRO", season = Number(root.current_season), week = Number(root.current_week)) {
    const homeKey = await homeLocalityOf(tx, root), home = LOCALITIES.find(l => l.key === homeKey);
    if (!home) return [];
    // Pro-Am nights near home: your own town and the five nearest.
    const near = destinationsFrom(home.key).map(t => ({ t, cost: tripCostTo(home.key, t) })).sort((a, b) => (a.cost.miles ?? 1e9) - (b.cost.miles ?? 1e9)).slice(0, 5);
    const towns = [{ key: home.key, t: home, cost: { pence: 0 } }, ...near.map(n => ({ key: n.t.key, t: n.t, cost: n.cost }))];
    const proList = side === "AMATEUR" ? await pros(tx, root) : [];
    const picked = weekNights(root.world_seed, season, week, towns, proList);
    const proEligible = side === "PRO" ? new Set((await Promise.all(picked.map(async p =>
      (await nearbyAmateurs(tx, root, p.town.key)).length === PROAM.amateurs ? p.town.key : undefined))).filter(Boolean)) : null;
    const npcs = new Map((await loadNpcs(tx, root.id, { ids: picked.flatMap(p => p.pro ? [p.pro.key] : []) })).map(n => [n.id, n]));
    const free = await freeNightsInWeek(tx, root.id, season, week), rank = side === "PRO" ? await yourRank(tx, root) : null;
    return picked.map((p, i) => {
      const npc = p.pro ? npcs.get(p.pro.key) : undefined;
      return { key: `${season}:${week}:${i}`, town: p.town.t.city, localityKey: p.town.key, dayOfWeek: p.dayOfWeek, travelPence: p.town.cost.pence, free: free.includes(p.dayOfWeek),
        pro: npc ? { name: `${npc.firstName} ${npc.surname}`, rank: p.pro!.rank, avg: Math.round(proConfig(root, npc, `proam:${season}:${week}:${i}`).avg * 10) / 10 } : null,
        proKey: npc?.id ?? null, feePence: side === "AMATEUR" ? feeFor(p.pro?.rank ?? null) : 0, prizePence: side === "AMATEUR" ? prizeFor(p.pro?.rank ?? null) : 0,
        appearancePence: side === "PRO" ? appearanceFor(rank) : 0 };
    }).filter(n => side === "PRO" ? proEligible!.has(n.localityKey) : !!n.pro);
  }

  const bookingFrom = (r: Row): ProAmBooking & { season: number; week: number } => ({ id: String(r.id), role: r.role as "AMATEUR" | "PRO", season: Number(r.season), week: Number(r.week),
    town: LOCALITIES.find(l => l.key === r.locality_key)?.city ?? "", dayOfWeek: ((Number(r.day) - 1) % 7) + 1, status: r.status as ProAmBooking["status"],
    pro: (r.pro as ProAmBooking["pro"]) ?? null, feePence: Number(r.fee_pence ?? 0), prizePence: Number(r.prize_pence ?? 0), appearancePence: Number(r.appearance_pence ?? 0),
    result: (r.result as ProAmBooking["result"]) ?? null });

  async function view(tx: CareerExecutor, root: Root, week = Number(root.current_week)): Promise<ProAmView> {
    const season = Number(root.current_season);
    const side = root.has_tour_card ? "PRO" : "AMATEUR";
    const rows = (await tx.execute(sql`SELECT * FROM career_proam_nights WHERE career_save_id=${root.id} ORDER BY season DESC, week DESC, created_at DESC`)).rows;
    const mine = rows.find(r => Number(r.season) === season && Number(r.week) === week);
    const list = root.status === "ACTIVE" ? (await offers(tx, root, side, season, week)).map(({ localityKey: _l, proKey: _p, ...n }) => n) : [];
    const played = rows.filter(r => r.status === "PLAYED").map(bookingFrom);
    const asAmateur = played.filter(b => b.role === "AMATEUR"), asPro = played.filter(b => b.role === "PRO");
    return { season, week, side, availablePence: await availableOf(tx, root.id), nights: list, booking: mine ? bookingFrom(mine) : null,
      record: { slots: asAmateur.length, prosBeaten: asAmateur.filter(b => b.result?.won).length, prizePence: asAmateur.filter(b => b.result?.won).reduce((n, b) => n + b.prizePence, 0),
        nightsAsPro: asPro.length, appearancePence: asPro.reduce((n, b) => n + b.appearancePence, 0), amateursBeatYou: asPro.reduce((n, b) => n + (b.result?.beatenBy ?? 0), 0) },
      history: rows.filter(r => r.status !== "BOOKED").slice(0, 12).map(bookingFrom) };
  }

  async function own(tx: CareerExecutor, root: Root, id: string) {
    const r = (await tx.execute(sql`SELECT * FROM career_proam_nights WHERE career_save_id=${root.id} AND id=${id}`)).rows[0];
    if (!r) throw new CareerError(404, "Pro-Am night not found");
    return r;
  }
  async function yourName(tx: CareerExecutor, root: Root) {
    return String((await tx.execute(sql`SELECT COALESCE(p.display_name, s.career_name) AS n FROM career_saves s LEFT JOIN career_profiles p ON p.career_save_id=s.id WHERE s.id=${root.id}`)).rows[0]?.n ?? "You");
  }
  const sessionFrom = (root: Root, r: Row, you: string): ProAmSession => {
    const result = (r.result as { legs?: { name: string; youWon: boolean }[]; won?: boolean; beatenBy?: number } | null) ?? {};
    const legs = result.legs ?? [];
    const opponents = (r.role === "PRO" ? (r.pro as { opponents: { key: string; name: string; avg: number; config: BotConfig }[] }).opponents : [r.pro as { key: string; name: string; avg: number; config: BotConfig }]);
    const index = r.role === "PRO" ? Math.min(legs.length, opponents.length - 1) : 0;
    const p = opponents[index];
    return { id: String(r.id), status: r.status === "PLAYED" ? "PLAYED" : "LIVE", you,
      pro: { name: p.name, avg: p.avg, bot: { config: p.config, seed: stableUuid(root.world_seed, PROAM.version, "proam-bot", String(r.id), p.key) } },
      format: PROAM_FORMAT, firstThrower: 0, darts: (r.darts as unknown[]) ?? [], won: r.status === "PLAYED" && r.role === "AMATEUR" ? result.won ?? null : null,
      matchNumber: index + 1, matchTotal: opponents.length, beatenBy: result.beatenBy ?? null };
  };
  /** Settle your leg against the pro: the prize if you beat them. */
  async function finishAmateur(tx: CareerExecutor, root: Root, r: Row, won: boolean, darts: unknown[] | null) {
    const source = "LIVE";
    await tx.execute(sql`UPDATE career_proam_nights SET status='PLAYED', result=${JSON.stringify({ won, source })}::jsonb, darts=${darts ? JSON.stringify(darts) : null}::jsonb
      WHERE career_save_id=${root.id} AND id=${String(r.id)} AND status='BOOKED'`);
    if (won) await post(tx, root, { operationKey: `proam-win:${String(r.id)}`, category: "PROAM_WIN", amountPence: Number(r.prize_pence),
      reason: `Beat ${(r.pro as { name: string }).name} at a Pro-Am night`, season: Number(r.season), week: Number(r.week), detail: { proAmId: String(r.id) } });
  }

  const api = {
    async read(actor: CareerActor, saveId: string, requestedWeek?: number) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const current = Number(root.current_week), week = requestedWeek ?? current;
        if (!Number.isInteger(week) || week < current || week > Math.min(current + 1, WEEKS_PER_SEASON))
          throw new CareerError(400, "You can only plan Pro-Am nights for this week or next week");
        return view(tx, root, week);
      });
    },

    /**
     * Take a Pro-Am night this week: as an amateur, a slot against the pro (the fee and any travel paid now); as a pro, the
     * invitation to be the pro (paid on the night). One a week, on a night you're free.
     */
    async book(actor: CareerActor, saveId: string, body: unknown) {
      const input = z.object({ nightKey: z.string().max(40), week: z.number().int().min(1).max(WEEKS_PER_SEASON).optional() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), current = Number(root.current_week), week = input.week ?? current;
        if (week < current || week > Math.min(current + 1, WEEKS_PER_SEASON))
          throw new CareerError(409, "You can only book a Pro-Am night for this week or next week");
        const v = await view(tx, root, week);
        if (v.booking) throw new CareerError(409, "One Pro-Am night a week");
        const night = (await offers(tx, root, v.side, season, week)).find(n => n.key === input.nightKey);
        if (!night) throw new CareerError(404, "That Pro-Am night isn't available for this week");
        if (!night.free) throw new CareerError(409, "You're booked that night");
        const cost = night.feePence + night.travelPence;
        if (cost > v.availablePence) throw new CareerError(409, "You can't afford it");
        const id = stableUuid(root.world_seed, PROAM.version, "proam-night", root.id, season, week);
        let pro: Record<string, unknown> | null = null;
        if (v.side === "AMATEUR") {
          const npc = (await loadNpcs(tx, root.id, { ids: [night.proKey!] }))[0];
          pro = { key: npc.id, name: night.pro!.name, rank: night.pro!.rank, avg: night.pro!.avg, config: proConfig(root, npc, `proam:${input.nightKey}`) };
        } else {
          const amateurs = await nearbyAmateurs(tx, root, night.localityKey);
          if (amateurs.length !== PROAM.amateurs) throw new CareerError(409, "This venue does not have a full amateur field for a live Pro-Am night");
          const npcs = new Map((await loadNpcs(tx, root.id, { ids: amateurs.map(m => m.key) })).map(n => [n.id, n]));
          pro = { opponents: amateurs.map((m, i) => {
            const npc = npcs.get(m.key);
            if (!npc) throw new CareerError(409, "A Pro-Am opponent is no longer available");
            return { key: m.key, name: m.name, avg: m.average ?? 0, config: proConfig(root, npc, `proam:${input.nightKey}:${i}`) };
          }) };
        }
        await tx.execute(sql`INSERT INTO career_proam_nights (career_save_id, id, season, week, day, locality_key, role, status, pro, fee_pence, prize_pence, appearance_pence, travel_pence)
          VALUES (${root.id}, ${id}, ${season}, ${week}, ${absoluteDay(week, night.dayOfWeek)}, ${night.localityKey}, ${v.side}, 'BOOKED', ${pro ? JSON.stringify(pro) : null}::jsonb,
            ${night.feePence}, ${night.prizePence}, ${night.appearancePence}, ${night.travelPence})`);
        if (night.feePence > 0) await post(tx, root, { operationKey: `proam-fee:${id}`, category: "PROAM_FEE", amountPence: -night.feePence,
          reason: `Pro-Am slot against ${night.pro!.name} in ${night.town}`, season, week, detail: { proAmId: id } });
        if (night.travelPence > 0) await post(tx, root, { operationKey: `proam-travel:${id}`, category: "TRAVEL", amountPence: -night.travelPence,
          reason: `Travel to a Pro-Am night in ${night.town}`, season, week, detail: { proAmId: id } });
        return view(tx, root, week);
      });
    },

    /** Your leg against the pro on the scorer (amateur side). */
    async session(actor: CareerActor, saveId: string, id: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const r = await own(tx, root, id);
        if (r.status === "MISSED") throw new CareerError(409, "You missed your slot");
        if (r.role === "PRO" && !Array.isArray((r.pro as { opponents?: unknown[] } | null)?.opponents))
          throw new CareerError(409, "This older Pro-Am booking has no saved live opponent list and cannot be resumed");
        return sessionFrom(root, r, await yourName(tx, root));
      });
    },
    async darts(actor: CareerActor, saveId: string, id: string, body: unknown) {
      const { darts, matchNumber } = z.object({ darts: z.array(z.unknown()).max(300), matchNumber: z.number().int().min(1).max(PROAM.amateurs) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const r = await own(tx, root, id);
        const priorLegs = (r.result as { legs?: unknown[] } | null)?.legs ?? [];
        const currentNumber = r.role === "PRO" ? priorLegs.length + 1 : 1;
        if (matchNumber < currentNumber) return sessionFrom(root, r, await yourName(tx, root));
        if (matchNumber > currentNumber) throw new CareerError(409, "The live Pro-Am field has moved; refresh the match");
        if (r.status === "BOOKED") {
          let state;
          try { state = replay(PROAM_FORMAT, 0, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
          if (state.complete && r.role === "AMATEUR") await finishAmateur(tx, root, r, state.winner === 0, darts);
          else if (state.complete) {
            const previous = (r.result as { legs?: { name: string; youWon: boolean }[] } | null)?.legs ?? [];
            const opponents = (r.pro as { opponents: { name: string }[] }).opponents;
            const current = opponents[previous.length];
            const legs = [...previous, { name: current.name, youWon: state.winner === 0 }];
            if (legs.length === opponents.length) {
              const beatenBy = legs.filter(l => !l.youWon).length;
              await tx.execute(sql`UPDATE career_proam_nights SET status='PLAYED', result=${JSON.stringify({ legs, beatenBy, source: "LIVE" })}::jsonb, darts=${JSON.stringify(darts)}::jsonb
                WHERE career_save_id=${root.id} AND id=${id} AND status='BOOKED'`);
              await post(tx, root, { operationKey: `proam-appearance:${String(r.id)}`, category: "PROAM_APPEARANCE", amountPence: Number(r.appearance_pence),
                reason: `Pro-Am night in ${LOCALITIES.find(l => l.key === r.locality_key)?.city ?? "the local area"}: the pro's appearance fee`,
                season: Number(r.season), week: Number(r.week), detail: { proAmId: String(r.id), beatenBy } });
            } else {
              await tx.execute(sql`UPDATE career_proam_nights SET result=${JSON.stringify({ legs, beatenBy: legs.filter(l => !l.youWon).length, source: "LIVE" })}::jsonb, darts=NULL
                WHERE career_save_id=${root.id} AND id=${id} AND status='BOOKED'`);
            }
          } else await tx.execute(sql`UPDATE career_proam_nights SET darts=${JSON.stringify(darts)}::jsonb WHERE career_save_id=${root.id} AND id=${id}`);
        }
        return sessionFrom(root, await own(tx, root, id), await yourName(tx, root));
      });
    },
  };
  return api;
}

/** At week end, every unplayed Pro-Am booking is missed; never invent a player result. */
export async function settleProAmWeek(tx: CareerExecutor, root: Root, season: number, week: number) {
  if ((await tx.execute(sql`SELECT to_regclass('career_proam_nights') IS NOT NULL AS ok`)).rows[0]?.ok !== true) return;
  for (const r of (await tx.execute(sql`SELECT * FROM career_proam_nights WHERE career_save_id=${root.id} AND season=${season} AND week <= ${week} AND status='BOOKED'`)).rows) {
    await tx.execute(sql`UPDATE career_proam_nights SET status='MISSED' WHERE career_save_id=${root.id} AND id=${String(r.id)} AND status='BOOKED'`);
  }
}
