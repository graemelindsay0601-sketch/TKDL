import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { LOCALITIES } from "../calendar/geography.ts";
import { absoluteDay } from "../calendar/generation.ts";
import { simulateBullUp, type RootRow } from "../calendar/engine.ts";
import { loadNpcs } from "../world/repository.ts";
import { simulateNpcMatch } from "../world/simulation.ts";
import { stableUuid } from "../world/random.ts";
import { CAREER_DIFFICULTY_CONFIG } from "../world/config.ts";
import { attributeForAverage, humanSimulationPlayer, loadHumanForm } from "../form/human.ts";
import { post } from "../finance/ledger.ts";
import { freeNightsInWeek } from "../nights.ts";
import { availableOf, homeLocalityOf, playersOf, playersOfMany, type Member } from "../money/service.ts";
import { MONEY, appetiteFor, averageForLevel, lineFor, oddsFor, replyTo, willingFor, type Odds } from "../money/model.ts";
import { ROAD, appetiteBoost, destinationsFrom, greetingFor, reputationFor, REPUTATION, tripCostTo, weeklyVisitor } from "./model.ts";

type Root = RootRow & { player_id?: number };
type Row = Record<string, unknown>;
type Role = "LOCAL" | "CHAMPION" | "VISITOR";
type Locality = typeof LOCALITIES[number];
const fmt = (p: number) => `£${(p / 100).toLocaleString("en-GB")}`;
const pounds = (pence: number) => Math.max(MONEY.minimumPence, Math.floor(pence / 500) * 500);

export type RoadTalk = { status: "OPEN" | "AGREED" | "WALKED"; asksLeft: number; theirOfferPence: number | null; agreedPence: number | null;
  log: { who: "YOU" | "THEM"; text: string; pence: number | null }[] };
export type RoadResult = { won: boolean; legs: [number, number]; stakePence: number; averages: [number, number] };
export type RoadOpponent = { key: string; name: string; role: Role; average: number | null; odds: Odds; askingPence: number; greeting: string;
  locked: string | null; talk: RoadTalk | null; result: RoadResult | null };
export type RoadTripsView = {
  season: number; week: number; home: string | null; availablePence: number; freeNights: number[];
  reputation: { towns: number; title: string; note: string; next: { title: string; towns: number } | null };
  trip: { id: string; town: string; region: string; dayOfWeek: number; costPence: number; played: number; maxMatches: number; opponents: RoadOpponent[] } | null;
  canTravel: boolean; why: string | null;
  towns: { key: string; city: string; region: string; country: string; miles: number | null; costPence: number; overnight: boolean;
    champion: { name: string; average: number | null } | null; conquered: boolean; record: { played: number; won: number; netPence: number } }[];
  visitor: (RoadOpponent & { town: string }) | null;
  record: { trips: number; played: number; won: number; netPence: number; conquered: string[] };
  recent: { season: number; week: number; town: string; name: string; role: Role; won: boolean; legs: [number, number]; stakePence: number }[];
};

const talkFrom = (r: Row): RoadTalk => ({ status: r.status === "WALKED" ? "WALKED" : r.agreed_pence !== null ? "AGREED" : "OPEN",
  asksLeft: Math.max(0, MONEY.asks - Number(r.asks)), theirOfferPence: r.their_offer_pence === null ? null : Number(r.their_offer_pence),
  agreedPence: r.agreed_pence === null ? null : Number(r.agreed_pence), log: (r.log as RoadTalk["log"]) ?? [] });
const resultFrom = (r: Row): RoadResult | null => r.status !== "PLAYED" ? null : { won: r.won === true, legs: [Number(r.legs_you), Number(r.legs_them)],
  stakePence: Number(r.stake_pence), averages: ((r.detail as { averages?: [number, number] })?.averages) ?? [0, 0] };

/** A town's champion and locals (its best four players), or nobody if the town has no players. */
const split = (players: Member[]) => ({ champion: players[0] ?? null, locals: players.slice(1, 1 + ROAD.locals) });

export function createCareerRoadTripService(database: CareerDatabase) {
  const townPlayers = async (tx: CareerExecutor, root: Root, town: Locality) => split(await playersOf(tx, root, town));

  async function view(tx: CareerExecutor, root: Root): Promise<RoadTripsView> {
    const season = Number(root.current_season), week = Number(root.current_week);
    const homeKey = await homeLocalityOf(tx, root), home = LOCALITIES.find(l => l.key === homeKey) ?? null;
    const available = await availableOf(tx, root.id);
    const matches = (await tx.execute(sql`SELECT * FROM career_road_matches WHERE career_save_id=${root.id} ORDER BY season DESC, week DESC, created_at DESC`)).rows;
    const trips = (await tx.execute(sql`SELECT * FROM career_road_trips WHERE career_save_id=${root.id} ORDER BY season DESC, week DESC`)).rows;
    const played = matches.filter(m => m.status === "PLAYED");
    const conquered = [...new Set(played.filter(m => m.role === "CHAMPION" && m.won === true).map(m => String(m.locality_key)))];
    const rep = reputationFor(conquered.length), next = REPUTATION.find(r => r.towns > conquered.length) ?? null;
    const boost = appetiteBoost(conquered.length);
    const form = await loadHumanForm(tx, root);
    const offset = CAREER_DIFFICULTY_CONFIG[root.difficulty as keyof typeof CAREER_DIFFICULTY_CONFIG]?.abilityOffset ?? 0;
    const yourPlaying = averageForLevel(attributeForAverage(form.skillAverage) - offset);
    // What a player will put up against you: their appetite (more as your name grows), cut to how they rate their chances.
    const asking = (m: Member, extra = 1) => { const odds = oddsFor(yourPlaying, m.average);
      return { odds, willing: Math.min(pounds(willingFor(appetiteFor(root.world_seed, season, m), odds) * boost * extra), 1_000_000) }; };
    const thisWeek = matches.filter(m => Number(m.season) === season && Number(m.week) === week);
    const opponentOf = (m: Member, role: Role, locked: string | null, extra = 1): RoadOpponent => {
      const row = thisWeek.find(r => r.opponent_key === m.key), a = asking(m, extra);
      return { key: m.key, name: m.name, role, average: m.average, odds: a.odds, askingPence: a.willing,
        greeting: greetingFor(root.world_seed, `${season}:${week}:${m.key}`, role), locked, talk: row && row.status !== "PLAYED" ? talkFrom(row) : row && row.log ? talkFrom(row) : null,
        result: row ? resultFrom(row) : null };
    };

    const tripRow = trips.find(t => Number(t.season) === season && Number(t.week) === week);
    // Everyone the page needs (each town on your road, tonight's town, the towns you've conquered) in one look-up.
    const destinations = home ? destinationsFrom(home.key) : [];
    const needed = new Map<string, Locality>(destinations.map(t => [t.key, t]));
    for (const key of [...conquered, ...(tripRow ? [String(tripRow.locality_key)] : [])]) { const l = LOCALITIES.find(x => x.key === key); if (l) needed.set(key, l); }
    const playersByTown = await playersOfMany(tx, root, [...needed.values()]);
    const playersIn = (town: Locality) => split(playersByTown.get(town.key) ?? []);
    let trip: RoadTripsView["trip"] = null;
    if (tripRow) {
      const town = LOCALITIES.find(l => l.key === tripRow.locality_key)!;
      const { champion, locals } = playersIn(town);
      const tonight = thisWeek.filter(m => m.trip_id === tripRow.id);
      const beatenLocal = tonight.some(m => m.role === "LOCAL" && m.status === "PLAYED" && m.won === true);
      const known = conquered.includes(town.key) || played.some(m => m.locality_key === town.key && m.role === "LOCAL" && m.won === true);
      const opponents = locals.map(m => opponentOf(m, "LOCAL", null));
      if (champion) opponents.unshift(opponentOf(champion, "CHAMPION", beatenLocal || known ? null : `Beat one of ${town.city}'s locals first`));
      trip = { id: String(tripRow.id), town: town.city, region: town.region, dayOfWeek: ((Number(tripRow.day) - 1) % 7) + 1, costPence: Number(tripRow.cost_pence),
        played: tonight.filter(m => m.status === "PLAYED").length, maxMatches: ROAD.matchesPerTrip, opponents };
    }
    const freeNights = root.status === "ACTIVE" ? await freeNightsInWeek(tx, root.id, season, week) : [];
    const why = !home ? "You need a home town to set off from" : root.status !== "ACTIVE" ? "Your career is over"
      : tripRow ? "One road trip a week" : !freeNights.length ? "No free nights this week" : null;

    const towns: RoadTripsView["towns"] = [];
    for (const t of destinations) {
      const cost = tripCostTo(home!.key, t), { champion } = playersIn(t);
      const here = played.filter(m => m.locality_key === t.key);
      towns.push({ key: t.key, city: t.city, region: t.region, country: t.country, miles: cost.miles, costPence: cost.pence, overnight: cost.overnight,
        champion: champion ? { name: champion.name, average: champion.average } : null, conquered: conquered.includes(t.key),
        record: { played: here.length, won: here.filter(m => m.won === true).length, netPence: here.reduce((n, m) => n + (m.won ? 1 : -1) * Number(m.stake_pence), 0) } });
    }
    towns.sort((a, b) => (a.miles ?? 1e9) - (b.miles ?? 1e9));

    // A player from a town you've conquered turns up at your club (not on a week you're away; never someone you've played this week).
    let visitor: RoadTripsView["visitor"] = null;
    if (conquered.length && !tripRow) {
      const candidates: (Member & { town: Locality })[] = [];
      for (const key of conquered) { const town = LOCALITIES.find(l => l.key === key)!; const p = playersIn(town);
        for (const m of [p.champion, ...p.locals]) if (m) candidates.push({ ...m, town }); }
      const v = weeklyVisitor(root.world_seed, season, week, candidates);
      if (v) visitor = { ...opponentOf(v, "VISITOR", null, ROAD.visitorStake), town: v.town.city };
      if (visitor && visitor.askingPence > available) visitor = available >= MONEY.minimumPence ? { ...visitor, askingPence: Math.floor(available / 500) * 500 } : null;
    }
    const names = new Map<string, string>();
    for (const t of trips) names.set(String(t.locality_key), LOCALITIES.find(l => l.key === t.locality_key)?.city ?? "");
    const npcNames = played.length ? new Map((await tx.execute(sql`SELECT id, first_name, surname FROM career_world_players WHERE career_save_id=${root.id}
      AND id IN (${sql.join([...new Set(played.map(m => String(m.opponent_key)))].map(k => sql`${k}::uuid`), sql`,`)})`)).rows.map(p => [String(p.id), `${p.first_name} ${p.surname}`])) : new Map<string, string>();
    return {
      season, week, home: home?.city ?? null, availablePence: available, freeNights,
      reputation: { towns: conquered.length, title: rep.title, note: rep.note, next: next ? { title: next.title, towns: next.towns } : null },
      trip, canTravel: why === null, why, towns, visitor,
      record: { trips: trips.length, played: played.length, won: played.filter(m => m.won === true).length,
        netPence: played.reduce((n, m) => n + (m.won ? 1 : -1) * Number(m.stake_pence), 0), conquered: conquered.map(k => LOCALITIES.find(l => l.key === k)?.city ?? k) },
      recent: played.slice(0, 10).map(m => ({ season: Number(m.season), week: Number(m.week), town: LOCALITIES.find(l => l.key === m.locality_key)?.city ?? "",
        name: npcNames.get(String(m.opponent_key)) ?? "A local", role: m.role as Role, won: m.won === true, legs: [Number(m.legs_you), Number(m.legs_them)], stakePence: Number(m.stake_pence) })),
    };
  }

  /** The opponent you're dealing with this week (on tonight's trip, or the visitor at your club). */
  function find(v: RoadTripsView, key: string) {
    const o = v.trip?.opponents.find(x => x.key === key) ?? (v.visitor?.key === key ? v.visitor : undefined);
    if (!o) throw new CareerError(404, "That player isn't here to play you this week");
    if (o.locked) throw new CareerError(409, o.locked);
    if (o.result) throw new CareerError(409, "You've already played them this week");
    if (o.role !== "VISITOR" && v.trip && v.trip.played >= v.trip.maxMatches) throw new CareerError(409, `That's ${v.trip.maxMatches} games tonight: time to head home`);
    return o;
  }

  return {
    async read(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => view(tx, await lockRoot(tx, actor, saveId, false) as unknown as Root));
    },

    /** Set off: a town and a free night this week (the night is booked; getting there and back is paid now). */
    async go(actor: CareerActor, saveId: string, body: unknown) {
      const input = z.object({ localityKey: z.string().max(60), dayOfWeek: z.number().int().min(1).max(7) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const v = await view(tx, root);
        if (!v.canTravel) throw new CareerError(409, v.why ?? "You can't travel this week");
        const town = v.towns.find(t => t.key === input.localityKey);
        if (!town) throw new CareerError(404, "That town isn't on your road");
        if (!town.champion) throw new CareerError(409, `Nobody plays darts in ${town.city}`);
        if (!v.freeNights.includes(input.dayOfWeek)) throw new CareerError(409, "You're booked that night");
        if (town.costPence > v.availablePence) throw new CareerError(409, `You can't afford the trip (${fmt(town.costPence)})`);
        const id = stableUuid(root.world_seed, ROAD.version, "road-trip", root.id, season, week);
        await tx.execute(sql`INSERT INTO career_road_trips (career_save_id, id, season, week, day, locality_key, cost_pence)
          VALUES (${root.id}, ${id}, ${season}, ${week}, ${absoluteDay(week, input.dayOfWeek)}, ${town.key}, ${town.costPence})`);
        if (town.costPence > 0) await post(tx, root, { operationKey: `road-trip:${id}`, category: "TRAVEL", amountPence: -town.costPence,
          reason: `Road trip to ${town.city}${town.overnight ? " (overnight)" : ""}`, season, week, detail: { roadTripId: id, localityKey: town.key, miles: town.miles } });
        return view(tx, root);
      });
    },

    /** Put a stake to a player: the same haggling as at your club (they'll take it, name their figure, or walk after three asks). */
    async offer(actor: CareerActor, saveId: string, body: unknown) {
      const input = z.object({ opponentKey: z.string().uuid(), stakePence: z.number().int().positive() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const v = await view(tx, root), o = find(v, input.opponentKey);
        if (o.talk && o.talk.status !== "OPEN") throw new CareerError(409, o.talk.status === "WALKED" ? `${o.name} has walked away` : "You've already shaken on a stake");
        if (input.stakePence < MONEY.minimumPence || input.stakePence % MONEY.stepPence) throw new CareerError(400, "Offer a whole number of pounds, at least £5");
        if (input.stakePence > v.availablePence) throw new CareerError(409, "You do not have that much money free");
        const ask = (o.talk ? MONEY.asks - o.talk.asksLeft : 0) + 1;
        const reply = replyTo(input.stakePence, Math.min(o.askingPence, Math.max(MONEY.minimumPence, v.availablePence)), o.odds, ask,
          (kind, pence) => lineFor(root.world_seed, season, week, `road:${o.key}`, ask, kind, pence, input.stakePence));
        const log = [...(o.talk?.log ?? []), { who: "YOU" as const, text: `${fmt(input.stakePence)}, first to four?`, pence: input.stakePence },
          { who: "THEM" as const, text: reply.line, pence: reply.pence }];
        await tx.execute(sql`INSERT INTO career_road_matches (career_save_id, id, season, week, trip_id, locality_key, opponent_key, role, status, asks, their_offer_pence, agreed_pence, log)
          VALUES (${root.id}, ${stableUuid(root.world_seed, ROAD.version, "road-match", root.id, season, week, o.key)}, ${season}, ${week}, ${o.role === "VISITOR" ? null : v.trip!.id},
            ${o.role === "VISITOR" ? (LOCALITIES.find(l => l.city === v.visitor!.town)?.key ?? null) : LOCALITIES.find(l => l.city === v.trip!.town)!.key}, ${o.key}, ${o.role},
            ${reply.kind === "WALK" ? "WALKED" : "TALKING"}, ${ask}, ${reply.kind === "COUNTER" || reply.kind === "RAISE" ? reply.pence : null}, ${reply.kind === "ACCEPT" ? reply.pence : null},
            ${JSON.stringify(log)}::jsonb)
          ON CONFLICT (career_save_id, season, week, opponent_key) DO UPDATE SET status=EXCLUDED.status, asks=EXCLUDED.asks, their_offer_pence=EXCLUDED.their_offer_pence,
            agreed_pence=EXCLUDED.agreed_pence, log=EXCLUDED.log`);
        return view(tx, root);
      });
    },

    /**
     * Play for a stake you've both agreed (or their figure, or their asking price as it stands). The match is played by the
     * same simulator as a money match, with your form; the money goes through the ledger.
     */
    async play(actor: CareerActor, saveId: string, body: unknown) {
      const input = z.object({ opponentKey: z.string().uuid(), stakePence: z.number().int().positive() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const v = await view(tx, root), o = find(v, input.opponentKey);
        const t = o.talk;
        const agreed = t?.status === "AGREED" && t.agreedPence === input.stakePence;
        const theirs = t?.status === "OPEN" && t.theirOfferPence === input.stakePence;
        const asking = !t && input.stakePence === o.askingPence;
        if (!agreed && !theirs && !asking) throw new CareerError(409, t?.status === "WALKED" ? `${o.name} has walked away` : "You haven't agreed that stake");
        if (input.stakePence > v.availablePence) throw new CareerError(409, "You do not have that much money free");
        const opponent = (await loadNpcs(tx, root.id, { ids: [o.key] }))[0];
        const form = await loadHumanForm(tx, root);
        const you = humanSimulationPlayer(root, opponent, form);
        const key = `road-match:${season}:${week}:${o.key}`;
        const bull = simulateBullUp(you, opponent, root.world_seed, key);
        const result = simulateNpcMatch({ players: [you, opponent], seed: root.world_seed, generationVersion: Number(root.world_generation_version), matchKey: key,
          difficulty: root.difficulty as never, context: { category: "local", roundImportance: o.role === "CHAMPION" ? 0.8 : 0.5, elimination: true },
          format: { bestOf: MONEY.bestOf, firstThrow: bull.firstThrow } });
        const [mine, other] = result.stats, won = mine.legsWon > other.legsWon;
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const detail = { version: ROAD.version, averages: [round2(mine.average), round2(other.average)], highestCheckout: mine.highestCheckout, maximums: mine.maximums,
          youThrewFirst: bull.firstThrow === 0, simulationVersion: result.simulationVersion };
        const town = o.role === "VISITOR" ? LOCALITIES.find(l => l.city === v.visitor!.town)! : LOCALITIES.find(l => l.city === v.trip!.town)!;
        const id = stableUuid(root.world_seed, ROAD.version, "road-match", root.id, season, week, o.key);
        await tx.execute(sql`INSERT INTO career_road_matches (career_save_id, id, season, week, trip_id, locality_key, opponent_key, role, status, asks, stake_pence, won, legs_you, legs_them, detail)
          VALUES (${root.id}, ${id}, ${season}, ${week}, ${o.role === "VISITOR" ? null : v.trip!.id}, ${town.key}, ${o.key}, ${o.role}, 'PLAYED', 0, ${input.stakePence}, ${won},
            ${mine.legsWon}, ${other.legsWon}, ${JSON.stringify(detail)}::jsonb)
          ON CONFLICT (career_save_id, season, week, opponent_key) DO UPDATE SET status='PLAYED', stake_pence=EXCLUDED.stake_pence, won=EXCLUDED.won,
            legs_you=EXCLUDED.legs_you, legs_them=EXCLUDED.legs_them, detail=EXCLUDED.detail`);
        const what = o.role === "CHAMPION" ? `${town.city}'s champion` : o.role === "VISITOR" ? `a visitor from ${town.city}` : `a ${town.city} local`;
        await post(tx, root, { operationKey: `road-match:${id}`, category: won ? "MONEY_MATCH_WIN" : "MONEY_MATCH_STAKE", amountPence: won ? input.stakePence : -input.stakePence,
          reason: `Road money match ${won ? "won" : "lost"} against ${o.name}, ${what} (${mine.legsWon}-${other.legsWon})`, season, week,
          detail: { roadMatchId: id, opponentKey: o.key, role: o.role, localityKey: town.key } });
        return view(tx, root);
      });
    },
  };
}
