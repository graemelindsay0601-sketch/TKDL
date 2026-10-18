import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { absoluteDay } from "../calendar/generation.ts";
import { simulateBullUp, type RootRow } from "../calendar/engine.ts";
import { loadNpcs } from "../world/repository.ts";
import { simulateNpcMatch } from "../world/simulation.ts";
import { createPerformance } from "../world/performance.ts";
import { toCareerBotConfig } from "../world/bot-adapter.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { SIMULATION_VERSION } from "../world/config.ts";
import { WEEKS as WEEKS_PER_SEASON } from "../finance/config.ts";
import { humanSimulationPlayer, loadHumanForm } from "../form/human.ts";
import { post } from "../finance/ledger.ts";
import { availableOf } from "../money/service.ts";
import { freeNightsInWeek } from "../nights.ts";
import { replay, type X01Format } from "../../shared/darts-rules/x01.ts";
import type { Npc } from "../world/types.ts";
import { CAM, bandOf, divisionByLevel, divisionFor, movement, pickOpponents, prizeFor, roundRobin, tableFrom } from "./model.ts";

type Root = RootRow & { player_id?: number };
type Row = Record<string, unknown>;
const HUMAN = "HUMAN";
export const CAM_FORMAT: X01Format = { startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: CAM.bestOfLegs };
type BotConfig = { avg: number; sd: number; checkoutPct: number; hitAcc: number };
type Player = { key: string; name: string; country: string; avg: number; config: BotConfig | null };

export type CamFixture = { id: string; round: number; week: number; opponent: { key: string; name: string; country: string; avg: number };
  status: "SCHEDULED" | "BOOKED" | "PLAYED" | "FORFEIT"; dayOfWeek: number | null; legs: [number, number] | null; source: "LIVE" | "SIM" | "FORFEIT" | null };
export type CamLeagueView = {
  season: number; week: number; division: { level: number; name: string; feePence: number };
  join: { ok: boolean; why: string | null; startsWeek: number; endsWeek: number; feePence: number; prizes: number[] };
  availablePence: number; freeNights: number[];
  league: { id: string; level: number; name: string; weekStart: number; weekEnd: number; round: number;
    table: { key: string; name: string; country: string; you: boolean; played: number; won: number; lost: number; legsFor: number; legsAgainst: number; points: number }[];
    fixtures: CamFixture[]; thisWeek: CamFixture | null; prizes: number[] } | null;
  history: { season: number; level: number; name: string; position: number; prizePence: number; nextLevel: number }[];
};
export type CamMatchSession = { fixtureId: string; status: "LIVE" | "PLAYED"; opponent: { name: string; country: string; avg: number; bot: { config: BotConfig; seed: string } };
  you: string; format: X01Format; firstThrower: 0 | 1; darts: unknown[]; legs: [number, number] | null; won: boolean | null };

const weekOfRound = (weekStart: number, round: number) => weekStart + round - 1;

export function createCareerCamLeagueService(database: CareerDatabase) {
  async function currentLevel(tx: CareerExecutor, root: Root) {
    const last = (await tx.execute(sql`SELECT level, next_level, status FROM career_cam_leagues WHERE career_save_id=${root.id} ORDER BY season DESC, week_start DESC LIMIT 1`)).rows[0];
    if (last) return Number(last.status === "FINISHED" ? last.next_level : last.level);
    return divisionFor((await loadHumanForm(tx, root)).skillAverage);
  }

  async function view(tx: CareerExecutor, root: Root): Promise<CamLeagueView> {
    const season = Number(root.current_season), week = Number(root.current_week);
    const level = await currentLevel(tx, root), d = divisionByLevel(level);
    const active = (await tx.execute(sql`SELECT * FROM career_cam_leagues WHERE career_save_id=${root.id} AND status='ACTIVE' ORDER BY season DESC LIMIT 1`)).rows[0];
    const available = await availableOf(tx, root.id);
    const endsWeek = week + CAM.rounds - 1;
    const why = active ? "You're in a league already" : root.status !== "ACTIVE" ? "Your career is over"
      : endsWeek > WEEKS_PER_SEASON ? "Not enough weeks left this season: the next leagues start in week 1" : d.fee > available ? "You can't afford the entry fee" : null;
    let league: CamLeagueView["league"] = null;
    if (active) {
      const players = active.players as Player[], names = new Map(players.map(p => [p.key, p]));
      const fixtures = (await tx.execute(sql`SELECT * FROM career_cam_fixtures WHERE career_save_id=${root.id} AND league_id=${String(active.id)} ORDER BY round, id`)).rows;
      const table = tableFrom(players.map(p => p.key), fixtures.map(f => ({ a: String(f.a_key), b: String(f.b_key), legsA: f.legs_a === null ? null : Number(f.legs_a), legsB: f.legs_b === null ? null : Number(f.legs_b) })));
      const mine = fixtures.filter(f => f.a_key === HUMAN || f.b_key === HUMAN).map(f => fixtureFrom(f, names));
      league = { id: String(active.id), level: Number(active.level), name: divisionByLevel(Number(active.level)).name, weekStart: Number(active.week_start), weekEnd: Number(active.week_end),
        round: Math.min(CAM.rounds, week - Number(active.week_start) + 1),
        table: table.map(r => ({ ...r, name: names.get(r.key)!.name, country: names.get(r.key)!.country, you: r.key === HUMAN })),
        fixtures: mine, thisWeek: mine.find(f => f.week === week) ?? null, prizes: CAM.prizeMultiple.map((_, i) => prizeFor(Number(active.level), i + 1)) };
    }
    const history = (await tx.execute(sql`SELECT * FROM career_cam_leagues WHERE career_save_id=${root.id} AND status='FINISHED' ORDER BY season DESC, week_start DESC LIMIT 12`)).rows
      .map(r => ({ season: Number(r.season), level: Number(r.level), name: divisionByLevel(Number(r.level)).name, position: Number(r.position), prizePence: Number(r.prize_pence ?? 0), nextLevel: Number(r.next_level) }));
    return { season, week, division: { level, name: d.name, feePence: d.fee },
      join: { ok: why === null, why, startsWeek: week, endsWeek, feePence: d.fee, prizes: CAM.prizeMultiple.map((_, i) => prizeFor(level, i + 1)) },
      availablePence: available, freeNights: root.status === "ACTIVE" ? await freeNightsInWeek(tx, root.id, season, week) : [], league, history };
  }

  function fixtureFrom(f: Row, names: Map<string, Player>): CamFixture {
    const youA = f.a_key === HUMAN, opp = names.get(String(youA ? f.b_key : f.a_key))!;
    const legs: [number, number] | null = f.legs_a === null ? null : youA ? [Number(f.legs_a), Number(f.legs_b)] : [Number(f.legs_b), Number(f.legs_a)];
    return { id: String(f.id), round: Number(f.round), week: Number(f.week), opponent: { key: opp.key, name: opp.name, country: opp.country, avg: opp.avg },
      status: f.status as CamFixture["status"], dayOfWeek: f.day === null ? null : ((Number(f.day) - 1) % 7) + 1, legs, source: (f.source as CamFixture["source"]) ?? null };
  }

  /** The player you're a match for this week (or an error), with everything needed to play it. */
  async function myFixture(tx: CareerExecutor, root: Root, fixtureId: string) {
    const f = (await tx.execute(sql`SELECT f.*, l.players FROM career_cam_fixtures f JOIN career_cam_leagues l ON l.career_save_id=f.career_save_id AND l.id=f.league_id
      WHERE f.career_save_id=${root.id} AND f.id=${fixtureId} AND (f.a_key=${HUMAN} OR f.b_key=${HUMAN})`)).rows[0];
    if (!f) throw new CareerError(404, "League match not found");
    const players = f.players as Player[], youA = f.a_key === HUMAN, opp = players.find(p => p.key === (youA ? f.b_key : f.a_key))!;
    return { f, opp, youA };
  }

  function sessionFrom(root: Root, f: Row, opp: Player, youA: boolean, you: string): CamMatchSession {
    const legs: [number, number] | null = f.legs_a === null ? null : youA ? [Number(f.legs_a), Number(f.legs_b)] : [Number(f.legs_b), Number(f.legs_a)];
    return { fixtureId: String(f.id), status: f.status === "PLAYED" ? "PLAYED" : "LIVE", you,
      opponent: { name: opp.name, country: opp.country, avg: opp.avg, bot: { config: opp.config!, seed: stableUuid(root.world_seed, CAM.version, "cam-bot", String(f.id)) } },
      format: CAM_FORMAT, firstThrower: (scopedRandom(root.world_seed, CAM.version, "cam-first", String(f.id))() < 0.5 ? 0 : 1),
      darts: (f.darts as unknown[]) ?? [], legs, won: legs ? legs[0] > legs[1] : null };
  }

  async function record(tx: CareerExecutor, root: Root, f: Row, youA: boolean, mine: number, theirs: number, source: "LIVE" | "SIM", darts: unknown[] | null) {
    await tx.execute(sql`UPDATE career_cam_fixtures SET status='PLAYED', source=${source}, legs_a=${youA ? mine : theirs}, legs_b=${youA ? theirs : mine},
      darts=${darts ? JSON.stringify(darts) : null}::jsonb WHERE career_save_id=${root.id} AND id=${String(f.id)} AND status <> 'PLAYED'`);
  }

  return {
    async read(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => view(tx, await lockRoot(tx, actor, saveId, false) as unknown as Root));
    },

    /** Join this week's league in your division: seven others from around the world at your level; the entry fee is paid now. */
    async join(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const v = await view(tx, root);
        if (!v.join.ok) throw new CareerError(409, v.join.why ?? "You can't join a league now");
        const level = v.division.level, band = bandOf(level), leagueId = stableUuid(root.world_seed, CAM.version, "cam-league", root.id, season, week);
        // Everyone's level on camera: the same performance model as a live match against them.
        const ctx = { category: "local" as const, roundImportance: 0.4, elimination: false };
        const all = (await loadNpcs(tx, root.id, { activeOnly: true })).map(n => ({ npc: n, avg: toCareerBotConfig(createPerformance(n, ctx, root.difficulty as never,
          scopedRandom(root.world_seed, root.world_generation_version, "performance", SIMULATION_VERSION, `cam:${leagueId}`, n.id))).avg }));
        let pool = all.filter(c => c.avg >= band.from && c.avg < band.to);
        if (pool.length < CAM.size - 1) pool = [...all].sort((a, b) => Math.abs(a.avg - (band.from + 4)) - Math.abs(b.avg - (band.from + 4))).slice(0, 40);
        const picked = pickOpponents(root.world_seed, leagueId, pool.map(c => ({ key: c.npc.id, country: c.npc.nationality, c })));
        const you = String((await tx.execute(sql`SELECT COALESCE(p.display_name, s.career_name) AS n FROM career_saves s LEFT JOIN career_profiles p ON p.career_save_id=s.id WHERE s.id=${root.id}`)).rows[0]?.n ?? "You");
        const players: Player[] = [{ key: HUMAN, name: you, country: "", avg: Math.round((await loadHumanForm(tx, root)).skillAverage * 10) / 10, config: null },
          ...picked.map(p => { const cfg = toCareerBotConfig(createPerformance(p.c.npc, ctx, root.difficulty as never,
            scopedRandom(root.world_seed, root.world_generation_version, "performance", SIMULATION_VERSION, `cam:${leagueId}`, p.c.npc.id)));
            return { key: p.key, name: `${p.c.npc.firstName} ${p.c.npc.surname}`, country: p.country, avg: Math.round(cfg.avg * 10) / 10,
              config: { avg: cfg.avg, sd: cfg.sd, checkoutPct: cfg.checkoutPct, hitAcc: cfg.hitAcc } }; })];
        await tx.execute(sql`INSERT INTO career_cam_leagues (career_save_id, id, season, week_start, week_end, level, status, players)
          VALUES (${root.id}, ${leagueId}, ${season}, ${week}, ${week + CAM.rounds - 1}, ${level}, 'ACTIVE', ${JSON.stringify(players)}::jsonb)`);
        const rounds = roundRobin();
        for (let r = 0; r < rounds.length; r++) for (const [a, b] of rounds[r]) {
          await tx.execute(sql`INSERT INTO career_cam_fixtures (career_save_id, id, league_id, season, round, week, a_key, b_key, status)
            VALUES (${root.id}, ${stableUuid(root.world_seed, CAM.version, "cam-fixture", leagueId, r, a, b)}, ${leagueId}, ${season}, ${r + 1}, ${weekOfRound(week, r + 1)},
              ${players[a].key}, ${players[b].key}, 'SCHEDULED')`);
        }
        await post(tx, root, { operationKey: `cam-fee:${leagueId}`, category: "CAM_LEAGUE_FEE", amountPence: -v.division.feePence,
          reason: `Webcam league entry: ${v.division.name}`, season, week, detail: { leagueId, level } });
        return view(tx, root);
      });
    },

    /** Book this week's league match on a free night (it's booked like any other night of your own). */
    async book(actor: CareerActor, saveId: string, body: unknown) {
      const { fixtureId, dayOfWeek } = z.object({ fixtureId: z.string().uuid(), dayOfWeek: z.number().int().min(1).max(7) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const season = Number(root.current_season), week = Number(root.current_week);
        const { f } = await myFixture(tx, root, fixtureId);
        if (Number(f.week) !== week) throw new CareerError(409, "That match isn't this week");
        if (f.status !== "SCHEDULED") throw new CareerError(409, "That match is already booked");
        if (!(await freeNightsInWeek(tx, root.id, season, week)).includes(dayOfWeek)) throw new CareerError(409, "You're booked that night");
        await tx.execute(sql`UPDATE career_cam_fixtures SET status='BOOKED', day=${absoluteDay(week, dayOfWeek)} WHERE career_save_id=${root.id} AND id=${fixtureId}`);
        return view(tx, root);
      });
    },

    /** The booked match on the scorer: your opponent's bot, who throws first, and the darts so far. */
    async session(actor: CareerActor, saveId: string, fixtureId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const { f, opp, youA } = await myFixture(tx, root, fixtureId);
        if (f.status === "SCHEDULED") throw new CareerError(409, "Book a night for it first");
        if (f.status === "FORFEIT") throw new CareerError(409, "That match was forfeited");
        const you = (f.players as Player[]).find(p => p.key === HUMAN)!.name;
        return sessionFrom(root, f, opp, youA, you);
      });
    },

    /** The darts so far: replayed on the server; when the match is complete the result goes in the table. */
    async darts(actor: CareerActor, saveId: string, fixtureId: string, body: unknown) {
      const { darts } = z.object({ darts: z.array(z.unknown()).max(800) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const { f, opp, youA } = await myFixture(tx, root, fixtureId);
        const you = (f.players as Player[]).find(p => p.key === HUMAN)!.name;
        if (f.status === "PLAYED") return sessionFrom(root, f, opp, youA, you);
        if (f.status !== "BOOKED") throw new CareerError(409, "Book a night for it first");
        const first = sessionFrom(root, f, opp, youA, you).firstThrower;
        let state;
        try { state = replay(CAM_FORMAT, first, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
        if (state.complete) await record(tx, root, f, youA, state.totalLegs[0], state.totalLegs[1], "LIVE", darts);
        else await tx.execute(sql`UPDATE career_cam_fixtures SET darts=${JSON.stringify(darts)}::jsonb WHERE career_save_id=${root.id} AND id=${fixtureId}`);
        return sessionFrom(root, (await myFixture(tx, root, fixtureId)).f, opp, youA, you);
      });
    },

    /** Let the booked match play out at your level (a quick-sim with your form), instead of throwing it. */
    async simulate(actor: CareerActor, saveId: string, fixtureId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const { f, opp, youA } = await myFixture(tx, root, fixtureId);
        if (f.status !== "BOOKED") throw new CareerError(409, f.status === "PLAYED" ? "That match is played" : "Book a night for it first");
        if ((f.darts as unknown[] | null)?.length) throw new CareerError(409, "You've started throwing this one: finish it on the scorer");
        const npc = (await loadNpcs(tx, root.id, { ids: [opp.key] }))[0];
        const youPlayer = humanSimulationPlayer(root, npc, await loadHumanForm(tx, root));
        const r = simulateMatch(root, `cam:${String(f.id)}`, youPlayer, npc);
        await record(tx, root, f, youA, r[0], r[1], "SIM", null);
        return view(tx, root);
      });
    },
  };
}

/** One match between two simulation players (first to three): legs each. */
function simulateMatch(root: Root, key: string, a: Npc, b: Npc): [number, number] {
  const bull = simulateBullUp(a, b, root.world_seed, key);
  const r = simulateNpcMatch({ players: [a, b], seed: root.world_seed, generationVersion: Number(root.world_generation_version), matchKey: key,
    difficulty: root.difficulty as never, context: { category: "local", roundImportance: 0.4, elimination: false }, format: { bestOf: CAM.bestOfLegs, firstThrow: bull.firstThrow } });
  return [r.stats[0].legsWon, r.stats[1].legsWon];
}

/**
 * The league's week, after the week is played: the other matches this round play out; your match, if you never got
 * round to it, is forfeited 3-0. After the last round the league finishes: prize money for the top three, and next
 * time you start a division up or down.
 */
export async function settleCamWeek(tx: CareerExecutor, root: Root, season: number, week: number) {
  if ((await tx.execute(sql`SELECT to_regclass('career_cam_leagues') IS NOT NULL AS ok`)).rows[0]?.ok !== true) return;
  const league = (await tx.execute(sql`SELECT * FROM career_cam_leagues WHERE career_save_id=${root.id} AND status='ACTIVE' AND season=${season} AND week_start <= ${week}`)).rows[0];
  if (!league) return;
  const fixtures = (await tx.execute(sql`SELECT * FROM career_cam_fixtures WHERE career_save_id=${root.id} AND league_id=${String(league.id)} AND week <= ${week}
    AND status IN ('SCHEDULED','BOOKED')`)).rows;
  const others = fixtures.filter(f => f.a_key !== HUMAN && f.b_key !== HUMAN);
  const npcs = new Map((await loadNpcs(tx, root.id, { ids: [...new Set(others.flatMap(f => [String(f.a_key), String(f.b_key)]))] })).map(n => [n.id, n]));
  for (const f of fixtures) {
    if (f.a_key === HUMAN || f.b_key === HUMAN) {
      // Never played: forfeited (the other player takes it 3-0).
      const youA = f.a_key === HUMAN;
      await tx.execute(sql`UPDATE career_cam_fixtures SET status='FORFEIT', source='FORFEIT', legs_a=${youA ? 0 : 3}, legs_b=${youA ? 3 : 0}
        WHERE career_save_id=${root.id} AND id=${String(f.id)}`);
      continue;
    }
    const a = npcs.get(String(f.a_key)), b = npcs.get(String(f.b_key));
    const [la, lb] = a && b ? simulateMatch(root, `cam:${String(f.id)}`, a, b) : a ? [3, 0] : [0, 3];
    await tx.execute(sql`UPDATE career_cam_fixtures SET status='PLAYED', source='SIM', legs_a=${la}, legs_b=${lb} WHERE career_save_id=${root.id} AND id=${String(f.id)}`);
  }
  if (week < Number(league.week_end)) return;
  const all = (await tx.execute(sql`SELECT a_key, b_key, legs_a, legs_b FROM career_cam_fixtures WHERE career_save_id=${root.id} AND league_id=${String(league.id)}`)).rows;
  const players = league.players as Player[];
  const table = tableFrom(players.map(p => p.key), all.map(f => ({ a: String(f.a_key), b: String(f.b_key), legsA: f.legs_a === null ? null : Number(f.legs_a), legsB: f.legs_b === null ? null : Number(f.legs_b) })));
  const position = table.findIndex(r => r.key === HUMAN) + 1, level = Number(league.level), prize = prizeFor(level, position);
  await tx.execute(sql`UPDATE career_cam_leagues SET status='FINISHED', position=${position}, prize_pence=${prize}, next_level=${movement(level, position)}
    WHERE career_save_id=${root.id} AND id=${String(league.id)}`);
  if (prize > 0) await post(tx, root, { operationKey: `cam-prize:${String(league.id)}`, category: "CAM_LEAGUE_PRIZE", amountPence: prize,
    reason: `Webcam league: ${["1st", "2nd", "3rd"][position - 1]} in the ${divisionByLevel(level).name}`, season, week, detail: { leagueId: String(league.id), position } });
}
