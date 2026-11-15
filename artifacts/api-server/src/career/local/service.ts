import { ensureLocalNights } from "../../db/migrations/create_career_local_nights.ts";
export { ensureLocalNights };
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { absoluteDay } from "../calendar/generation.ts";
import { simulateBullUp, type RootRow } from "../calendar/engine.ts";
import { LOCALITIES } from "../calendar/geography.ts";
import { loadNpcs } from "../world/repository.ts";
import { simulateNpcMatch } from "../world/simulation.ts";
import { createPerformance } from "../world/performance.ts";
import { toCareerBotConfig } from "../world/bot-adapter.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { SIMULATION_VERSION } from "../world/config.ts";
import { post } from "../finance/ledger.ts";
import { fansForEffects } from "../fans/service.ts";
import { availableOf, homeLocalityOf, playersOf } from "../money/service.ts";
import { freeNightsInWeek } from "../nights.ts";
import { replay, type X01Format } from "../../shared/darts-rules/x01.ts";
import { replayDrill, type DrillSpec } from "../../shared/darts-rules/drills.ts";
import { checkoutTargets, scoringTarget } from "../streaming/model.ts";
import { roundRobin, tableFrom } from "../camleague/model.ts";
import type { Npc } from "../world/types.ts";
import { CHAMP_ROUNDS, KO_ROUNDS, LOCAL, LOCAL_KINDS, divisionName, nextDivision, playerOfYearPoints, PRACTICE_ROUTINES, canCoach, canExhibit, coachingFee, exhibitionFee, type LocalKind, type PracticeRoutine } from "./model.ts";

type Root = RootRow & { player_id?: number };
type Row = Record<string, unknown>;
type BotConfig = { avg: number; sd: number; checkoutPct: number; hitAcc: number };
type Opp = { key: string; name: string; avg: number; config: BotConfig };
type Match = { opponent: Opp; bestOf: number; round: string; firstThrower: 0 | 1; darts: unknown[]; legs: [number, number] | null };
type Fixture = { round: number; week: number; a: string; b: string; legs: [number, number] | null };
const HUMAN = "HUMAN";
const CONTEXT = { category: "local" as const, roundImportance: 0.4, elimination: false };
const fmt = (bestOf: number): X01Format => ({ startingScore: 501, inRule: "STRAIGHT", outRule: "DOUBLE", unit: "LEGS", bestOfLegs: bestOf });
const dow = (day: number) => ((day - 1) % 7) + 1;

export type LocalSession = { id: string; kind: LocalKind; title: string; status: string; you: string;
  match: { round: string; opponent: { name: string; avg: number; bot: { config: BotConfig; seed: string } }; format: X01Format; firstThrower: 0 | 1; darts: unknown[] } | null;
  drill: { spec: DrillSpec; darts: unknown[]; routine: string } | null;
  played: { round: string; opponent: string; legs: [number, number] | null; won: boolean | null }[]; outcome: string | null };

let ready = false;
async function tables(tx: CareerExecutor) {
  if (ready) return true;
  ready = (await tx.execute(sql`SELECT to_regclass('career_local_nights') IS NOT NULL AS ok`)).rows[0]?.ok === true;
  return ready;
}

async function youName(tx: CareerExecutor, root: Root) {
  return String((await tx.execute(sql`SELECT COALESCE(p.display_name, s.career_name, 'You') AS n FROM career_saves s LEFT JOIN career_profiles p ON p.career_save_id=s.id WHERE s.id=${root.id}`)).rows[0]?.n ?? "You");
}
const botFor = (root: Root, npc: Npc, key: string): BotConfig => {
  const c = toCareerBotConfig(createPerformance(npc, CONTEXT, root.difficulty as never,
    scopedRandom(root.world_seed, root.world_generation_version, "performance", SIMULATION_VERSION, key, npc.id)));
  return { avg: Math.round(c.avg * 10) / 10, sd: c.sd, checkoutPct: c.checkoutPct, hitAcc: c.hitAcc };
};
/** Your club's members as opponents (the NPCs behind them, for bots and simulated matches). */
async function clubOpponents(tx: CareerExecutor, root: Root) {
  const home = await homeLocalityOf(tx, root as never), locality = LOCALITIES.find(l => l.key === home);
  const members = locality ? (await playersOf(tx, root, locality)).filter(m => !m.professional) : [];
  // A small club (or no home club on an older save) is topped up with amateurs who'd travel in: your country's first.
  const need = 12 - members.length;
  if (need > 0) {
    const have = new Set(members.map(m => m.key));
    const extra = (await tx.execute(sql`SELECT id, first_name, surname FROM career_world_players WHERE career_save_id=${root.id} AND status='ACTIVE'
      AND professional_status <> 'PROFESSIONAL' ORDER BY (nationality = ${locality?.country ?? ""}) DESC, id LIMIT ${need + members.length}`)).rows;
    for (const p of extra) if (!have.has(String(p.id)) && members.length < 12) members.push({ key: String(p.id), name: `${p.first_name} ${p.surname}`, professional: false, average: null });
  }
  const npcs = new Map((await loadNpcs(tx, root.id, { ids: members.map(m => m.key) })).map(n => [n.id, n]));
  return members.map(m => ({ m, npc: npcs.get(m.key) })).filter((x): x is { m: typeof x.m; npc: Npc } => !!x.npc);
}
function simulate(root: Root, key: string, a: Npc, b: Npc, bestOf: number): [number, number] {
  const bull = simulateBullUp(a, b, root.world_seed, key);
  const r = simulateNpcMatch({ players: [a, b], seed: root.world_seed, generationVersion: Number(root.world_generation_version), matchKey: key,
    difficulty: root.difficulty as never, context: CONTEXT, format: { bestOf, firstThrow: bull.firstThrow } });
  return [r.stats[0].legsWon, r.stats[1].legsWon];
}
/** Pick n of the candidates, deterministically. */
function pick<T>(seed: string, key: string, list: readonly T[], n: number) {
  const rng = scopedRandom(seed, LOCAL.version, "local-pick", key);
  return list.map(x => ({ x, r: rng() })).sort((a, b) => a.r - b.r).slice(0, n).map(y => y.x);
}
async function worldRank(tx: CareerExecutor, saveId: string) {
  const r = (await tx.execute(sql`SELECT r.position FROM career_ranking_snapshot_rows r WHERE r.career_save_id=${saveId} AND r.participant_key='HUMAN'
    AND r.snapshot_id=(SELECT id FROM career_ranking_snapshots WHERE career_save_id=${saveId} AND list_key='pro-world' ORDER BY sequence DESC LIMIT 1)`)).rows[0];
  return r ? Number(r.position) : null;
}

export function createCareerLocalNightsService(database: CareerDatabase) {
  async function view(tx: CareerExecutor, root: Root) {
    const season = Number(root.current_season), week = Number(root.current_week);
    const free = await freeNightsInWeek(tx, root.id, season, week);
    const rows = (await tx.execute(sql`SELECT * FROM career_local_nights WHERE career_save_id=${root.id} AND season=${season} ORDER BY day`)).rows;
    const thisWeek = rows.filter(r => Number(r.week) === week);
    const done = (k: LocalKind) => thisWeek.some(r => r.kind === k);
    const fans = Math.max(0, (await fansForEffects(tx, root.id)) ?? 0), rank = await worldRank(tx, root.id);
    const league = (await tx.execute(sql`SELECT * FROM career_local_leagues WHERE career_save_id=${root.id} AND season=${season} ORDER BY week_start DESC LIMIT 1`)).rows[0];
    const activeLeague = league?.status === "ACTIVE" ? league : null;
    const fixtures = (activeLeague?.fixtures as Fixture[] | undefined) ?? [];
    const mine = fixtures.find(f => f.week === week && (f.a === HUMAN || f.b === HUMAN)) ?? null;
    const members = (await clubOpponents(tx, root)).length;
    const why = (k: LocalKind): string | null => {
      if (root.status !== "ACTIVE") return "Career is retired";
      if (k === "CHAMPIONSHIP" && rows.some(r => r.kind === "CHAMPIONSHIP")) return "Played this season";
      if (k !== "PRACTICE" && done(k)) return "Done this week";
      if (k === "PUB_LEAGUE") return !activeLeague ? (members < LOCAL.pub.size - 1 ? "Not enough players for a league" : week >= LOCAL.pub.firstWeek && week + LOCAL.pub.rounds - 1 <= LOCAL.pub.lastWeek ? null : `Leagues run weeks ${LOCAL.pub.firstWeek}–${LOCAL.pub.lastWeek}`)
        : !mine ? "No league match this week" : !free.includes(LOCAL.pub.day) ? "You're booked on Tuesday" : null;
      if (k === "KNOCKOUT") return week < LOCAL.knockout.firstWeek || week > LOCAL.knockout.lastWeek ? "Not on this week" : !free.includes(LOCAL.knockout.day) ? "You're booked on Thursday"
        : members < LOCAL.knockout.size - 1 ? "Not enough club members" : null;
      if (k === "CHAMPIONSHIP") return !LOCAL.championship.weeks.includes(week) ? `Weeks ${LOCAL.championship.weeks.join("–")} each season`
        : rows.some(r => r.kind === "CHAMPIONSHIP") ? "Played this season" : members < LOCAL.championship.size - 1 ? "Not enough club members" : null;
      if (k === "FRIENDLY") return LOCAL.friendly.weeks.includes(week) ? (members ? null : "No club members to play") : "Pre-season (weeks 1–3) and after the season (47–52)";
      if (k === "EXHIBITION" && lastExhibition !== null && week - lastExhibition < LOCAL.exhibition.everyWeeks) return `Next one from week ${lastExhibition + LOCAL.exhibition.everyWeeks}`;
      if (k === "EXHIBITION") return canExhibit(fans, rank) ? null : `Once you're known: ${LOCAL.exhibition.minFans.toLocaleString("en-GB")} fans or a top ${LOCAL.exhibition.maxRank} ranking`;
      if (k === "COACHING") return canCoach(fans, rank) ? null : `Once you're known a little: ${LOCAL.coaching.minFans.toLocaleString("en-GB")} fans or a top ${LOCAL.coaching.maxRank} ranking`;
      return null;
    };
    const lastExhibition = rows.filter(r => r.kind === "EXHIBITION").reduce<number | null>((m, r) => Math.max(m ?? 0, Number(r.week)), null);
    const lastFinished = (await tx.execute(sql`SELECT division, position FROM career_local_leagues WHERE career_save_id=${root.id} AND status='FINISHED' ORDER BY season DESC, week_start DESC LIMIT 1`)).rows[0];
    const nextLevel = activeLeague ? Number(activeLeague.division ?? 4) : lastFinished ? nextDivision(Number(lastFinished.division ?? 4), Number(lastFinished.position)) : LOCAL.divisions.count;
    const fixedDay: Partial<Record<LocalKind, number>> = { PUB_LEAGUE: LOCAL.pub.day, KNOCKOUT: LOCAL.knockout.day };
    const pbs = new Map<string, number>();
    for (const r of (await tx.execute(sql`SELECT result FROM career_local_nights WHERE career_save_id=${root.id} AND kind='PRACTICE' AND status='DONE'`)).rows) {
      const res = r.result as { routine: string; score: number } | null;
      if (res && (!pbs.has(res.routine) || pbs.get(res.routine)! < res.score)) pbs.set(res.routine, res.score);
    }
    const players = (activeLeague?.players as { key: string; name: string; avg: number }[] | undefined) ?? [];
    const table = activeLeague ? tableFrom(players.map(p => p.key), fixtures.map(f => ({ a: f.a, b: f.b, legsA: f.legs?.[0] ?? null, legsB: f.legs?.[1] ?? null })))
      .map(r => ({ ...r, name: players.find(p => p.key === r.key)?.name ?? "?", you: r.key === HUMAN })) : [];
    return {
      season, week, freeNights: free, fans, rank,
      activities: (Object.keys(LOCAL_KINDS) as LocalKind[]).map(k => ({ kind: k, name: LOCAL_KINDS[k].name, blurb: LOCAL_KINDS[k].blurb, dayOfWeek: fixedDay[k] ?? null,
        feePence: k === "EXHIBITION" ? exhibitionFee(fans) : k === "COACHING" ? coachingFee(fans) : k === "KNOCKOUT" ? -LOCAL.knockout.entryPence : 0, why: why(k) })),
      nights: thisWeek.map(r => ({ id: String(r.id), kind: r.kind as LocalKind, title: String(r.title), dayOfWeek: dow(Number(r.day)), status: String(r.status),
        outcome: (r.result as { outcome?: string } | null)?.outcome ?? null })),
      routines: (Object.keys(PRACTICE_ROUTINES) as PracticeRoutine[]).map(k => ({ key: k, name: PRACTICE_ROUTINES[k], best: pbs.get(k) ?? null })),
      honours: (await tx.execute(sql`SELECT season, award, detail FROM career_local_honours WHERE career_save_id=${root.id} ORDER BY season DESC, award`)).rows
        .map(h => ({ season: Number(h.season), award: String(h.award), detail: h.detail as Record<string, unknown> })),
      division: { level: nextLevel, name: divisionName(nextLevel) },
      pubLeague: activeLeague ? { division: divisionName(Number(activeLeague.division ?? 4)), weekStart: Number(activeLeague.week_start), weekEnd: Number(activeLeague.week_end), table,
        thisWeek: mine ? { opponent: players.find(p => p.key === (mine.a === HUMAN ? mine.b : mine.a))?.name ?? "?", legs: mine.legs } : null }
        : league ? { finished: { position: Number(league.position), prizePence: Number(league.prize_pence) } } : null,
    };
  }

  async function sessionOf(tx: CareerExecutor, root: Root, id: string): Promise<LocalSession> {
    const r = (await tx.execute(sql`SELECT * FROM career_local_nights WHERE career_save_id=${root.id} AND id=${id}`)).rows[0];
    if (!r) throw new CareerError(404, "Night not found");
    const matches = r.matches as Match[], cur = matches.find(m => !m.legs) ?? null, drill = r.drill as { spec: DrillSpec; darts: unknown[]; routine: string } | null;
    return { id, kind: r.kind as LocalKind, title: String(r.title), status: String(r.status), you: await youName(tx, root),
      match: r.status === "BOOKED" && cur ? { round: cur.round, opponent: { name: cur.opponent.name, avg: cur.opponent.avg,
        bot: { config: cur.opponent.config, seed: stableUuid(root.world_seed, LOCAL.version, "local-bot", id, cur.round) } }, format: fmt(cur.bestOf), firstThrower: cur.firstThrower, darts: cur.darts } : null,
      drill: r.status === "BOOKED" && drill ? drill : null,
      played: matches.filter(m => m.legs).map(m => ({ round: m.round, opponent: m.opponent.name, legs: m.legs, won: m.legs ? m.legs[0] > m.legs[1] : null })),
      outcome: (r.result as { outcome?: string } | null)?.outcome ?? null };
  }

  const opp = (root: Root, npc: Npc, name: string, key: string): Opp => { const config = botFor(root, npc, key); return { key: npc.id, name, avg: config.avg, config }; };
  const first = (root: Root, key: string): 0 | 1 => scopedRandom(root.world_seed, LOCAL.version, "local-first", key)() < 0.5 ? 0 : 1;

  return {
    async read(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        if (!await tables(tx)) await ensureLocalNights(tx);
        return view(tx, root);
      });
    },

    /** Join a pub league starting this week: seven of your club's members, a match every Tuesday for seven weeks. */
    async joinPubLeague(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const v = await view(tx, root);
        if (v.pubLeague && "table" in v.pubLeague) throw new CareerError(409, "You're already in a league");
        const season = v.season, week = v.week;
        if (week < LOCAL.pub.firstWeek || week + LOCAL.pub.rounds - 1 > LOCAL.pub.lastWeek) throw new CareerError(409, `Leagues run weeks ${LOCAL.pub.firstWeek}–${LOCAL.pub.lastWeek}`);
        const members = await clubOpponents(tx, root);
        if (members.length < LOCAL.pub.size - 1) throw new CareerError(409, "Not enough club members for a league");
        const id = stableUuid(root.world_seed, LOCAL.version, "pub-league", root.id, season, week);
        // The division sets the standard: the club's members by form, a window higher up for a higher division.
        const division = v.division.level, sorted = [...members].sort((a, b) => (b.m.average ?? 40) - (a.m.average ?? 40));
        const span = Math.max(LOCAL.pub.size - 1, Math.ceil(sorted.length / 2)), from = Math.round((division - 1) / (LOCAL.divisions.count - 1) * (sorted.length - span));
        const picked = pick(root.world_seed, id, sorted.slice(from, from + span), LOCAL.pub.size - 1);
        const players = [{ key: HUMAN, name: await youName(tx, root), avg: 0 }, ...picked.map(p => ({ key: p.npc.id, name: p.m.name, avg: p.m.average ?? 0 }))];
        const fixtures: Fixture[] = roundRobin().flatMap((pairs, r) => pairs.map(([a, b]) => ({ round: r + 1, week: week + r, a: players[a].key, b: players[b].key, legs: null })));
        await tx.execute(sql`INSERT INTO career_local_leagues (career_save_id, id, season, week_start, week_end, players, fixtures, status, division)
          VALUES (${root.id}, ${id}, ${season}, ${week}, ${week + LOCAL.pub.rounds - 1}, ${JSON.stringify(players)}::jsonb, ${JSON.stringify(fixtures)}::jsonb, 'ACTIVE', ${division}) ON CONFLICT DO NOTHING`);
        return view(tx, root);
      });
    },

    /** Book a night this week: the kind of night, which night, and for practice the routine. */
    async book(actor: CareerActor, saveId: string, body: unknown) {
      const q = z.object({ kind: z.enum(Object.keys(LOCAL_KINDS) as [LocalKind, ...LocalKind[]]), dayOfWeek: z.number().int().min(1).max(7),
        routine: z.enum(Object.keys(PRACTICE_ROUTINES) as [PracticeRoutine, ...PracticeRoutine[]]).optional() }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const v = await view(tx, root), a = v.activities.find(x => x.kind === q.kind)!;
        if (a.why) throw new CareerError(409, a.why);
        if (a.dayOfWeek && a.dayOfWeek !== q.dayOfWeek) throw new CareerError(409, `${a.name} is on ${a.dayOfWeek === 2 ? "Tuesdays" : "Thursdays"}`);
        if (!v.freeNights.includes(q.dayOfWeek)) throw new CareerError(409, "You're booked that night");
        const season = v.season, week = v.week, day = absoluteDay(week, q.dayOfWeek);
        const id = stableUuid(root.world_seed, LOCAL.version, "local-night", root.id, season, day, q.kind);
        let title: string = a.name, matches: Match[] = [], drill: { spec: DrillSpec; darts: unknown[]; routine: string } | null = null, fee = 0, leagueId: string | null = null, round: number | null = null;
        const members = await clubOpponents(tx, root);
        if (q.kind === "PUB_LEAGUE") {
          const lg = (await tx.execute(sql`SELECT * FROM career_local_leagues WHERE career_save_id=${root.id} AND status='ACTIVE' AND season=${season}`)).rows[0]!;
          const f = (lg.fixtures as Fixture[]).find(x => x.week === week && (x.a === HUMAN || x.b === HUMAN))!;
          const oppKey = f.a === HUMAN ? f.b : f.a, m = members.find(x => x.npc.id === oppKey);
          const npc = m?.npc ?? (await loadNpcs(tx, root.id, { ids: [oppKey] }))[0];
          const name = (lg.players as { key: string; name: string }[]).find(p => p.key === oppKey)?.name ?? "A club member";
          if (!npc) throw new CareerError(409, "Your opponent can't make it");
          title = `Pub league, round ${f.round}: v ${name}`; leagueId = String(lg.id); round = f.round;
          matches = [{ opponent: opp(root, npc, name, id), bestOf: LOCAL.pub.bestOf, round: `Round ${f.round}`, firstThrower: first(root, id), darts: [], legs: null }];
        } else if (q.kind === "KNOCKOUT") {
          const field = pick(root.world_seed, id, members, LOCAL.knockout.size - 1);
          const qf = field[0];
          matches = [{ opponent: opp(root, qf.npc, qf.m.name, `${id}:qf`), bestOf: LOCAL.knockout.bestOf, round: KO_ROUNDS[0], firstThrower: first(root, `${id}:qf`), darts: [], legs: null }];
          fee = LOCAL.knockout.entryPence; title = "Club knockout";
          if (await availableOf(tx, root.id) < fee) throw new CareerError(409, "You don't have the £5 entry free");
          await post(tx, root, { operationKey: `adjustment:local-knockout:${id}`, category: "ADJUSTMENT", headline: "EXPENSE", amountPence: -fee,
            reason: "Club knockout entry", season, week, detail: { type: "LOCAL_KNOCKOUT_ENTRY", nightId: id } });
          // The draw: you v field[0]; field[1] v field[2], field[3] v field[4], field[5] v field[6].
          return insert(tx, root, { id, season, week, day, kind: q.kind, title, matches, drill, fee, leagueId, round, result: { field: field.map(f => ({ key: f.npc.id, name: f.m.name })) } });
        } else if (q.kind === "CHAMPIONSHIP") {
          const field = pick(root.world_seed, id, members, LOCAL.championship.size - 1);
          matches = [{ opponent: opp(root, field[0].npc, field[0].m.name, `${id}:0`), bestOf: LOCAL.championship.bestOf, round: CHAMP_ROUNDS[0], firstThrower: first(root, `${id}:0`), darts: [], legs: null }];
          title = `Club Championship, season ${season}`;
          return insert(tx, root, { id, season, week, day, kind: q.kind, title, matches, drill, fee, leagueId, round, result: { field: field.map(f => ({ key: f.npc.id, name: f.m.name })) } });
        } else if (q.kind === "FRIENDLY") {
          const o = pick(root.world_seed, id, members, 1)[0];
          if (!o) throw new CareerError(409, "No club members to play");
          title = `Friendly v ${o.m.name}`;
          matches = [{ opponent: opp(root, o.npc, o.m.name, id), bestOf: LOCAL.friendly.bestOf, round: "Friendly", firstThrower: first(root, id), darts: [], legs: null }];
        } else if (q.kind === "EXHIBITION") {
          const rng = scopedRandom(root.world_seed, LOCAL.version, "exhibition", id), [lo, hi] = LOCAL.exhibition.challengerAvg;
          const locals = pick(root.world_seed, `${id}:locals`, members, LOCAL.exhibition.legs);
          matches = locals.map((l, i) => { const avg = Math.round((lo + rng() * (hi - lo)) * 10) / 10;
            return { opponent: { key: l.npc.id, name: l.m.name, avg, config: { avg, sd: 18, checkoutPct: 0.2 + avg / 400, hitAcc: 0.4 + avg / 300 } }, bestOf: 1, round: `Leg ${i + 1}`,
              firstThrower: 0 as const, darts: [], legs: null }; });
          if (!matches.length) throw new CareerError(409, "No locals to take you on");
          fee = exhibitionFee(v.fans); title = "Exhibition night";
        } else if (q.kind === "COACHING") {
          fee = coachingFee(v.fans); title = "Coaching night";
        } else {
          const routine = q.routine ?? "CHECKOUTS";
          const prior = (await tx.execute(sql`SELECT (result->>'average')::float AS a FROM career_local_nights WHERE career_save_id=${root.id} AND kind='PRACTICE' AND status='DONE'
            AND result->>'routine'='SCORING' ORDER BY season DESC, day DESC LIMIT 1`)).rows[0];
          const spec: DrillSpec = routine === "BOBS_27" ? { kind: "BOBS_27" } : routine === "SCORING" ? { kind: "SCORING", visits: 33, targetAverage: scoringTarget(prior?.a == null ? null : Number(prior.a)) }
            : { kind: "CHECKOUTS", targets: checkoutTargets(root.world_seed, id), visitsEach: 3 };
          drill = { spec, darts: [], routine }; title = `Practice: ${PRACTICE_ROUTINES[routine]}`;
        }
        return insert(tx, root, { id, season, week, day, kind: q.kind, title, matches, drill, fee, leagueId, round, result: null });
      });

      async function insert(tx: CareerExecutor, root: Root, n: { id: string; season: number; week: number; day: number; kind: LocalKind; title: string; matches: Match[];
        drill: unknown; fee: number; leagueId: string | null; round: number | null; result: unknown }) {
        await tx.execute(sql`INSERT INTO career_local_nights (career_save_id, id, season, week, day, kind, status, title, matches, drill, result, fee_pence, league_id, round)
          VALUES (${root.id}, ${n.id}, ${n.season}, ${n.week}, ${n.day}, ${n.kind}, 'BOOKED', ${n.title}, ${JSON.stringify(n.matches)}::jsonb, ${n.drill ? JSON.stringify(n.drill) : null}::jsonb,
            ${n.result ? JSON.stringify(n.result) : null}::jsonb, ${n.fee}, ${n.leagueId}, ${n.round})`);
        return { view: await view(tx, root), nightId: n.id };
      }
    },

    async session(actor: CareerActor, saveId: string, nightId: string) {
      return database.transaction(async tx => sessionOf(tx, await lockRoot(tx, actor, saveId, false) as unknown as Root, nightId));
    },

    /** The darts so far for the current match or drill: replayed on the server; finished matches move the night on. */
    async darts(actor: CareerActor, saveId: string, nightId: string, body: unknown) {
      const { darts } = z.object({ darts: z.array(z.unknown()).max(800) }).strict().parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const r = (await tx.execute(sql`SELECT * FROM career_local_nights WHERE career_save_id=${root.id} AND id=${nightId} FOR UPDATE`)).rows[0];
        if (!r) throw new CareerError(404, "Night not found");
        if (r.status !== "BOOKED") return sessionOf(tx, root, nightId);
        if (Number(r.week) > Number(root.current_week)) throw new CareerError(409, "That night is in a future week");
        const season = Number(r.season), week = Number(r.week), kind = r.kind as LocalKind;
        if (kind === "COACHING") throw new CareerError(409, "No darts on a coaching night");
        // A practice drill.
        const drill = r.drill as { spec: DrillSpec; darts: unknown[]; routine: string } | null;
        if (drill) {
          let st; try { st = replayDrill(drill.spec, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
          if (!st.complete) { await tx.execute(sql`UPDATE career_local_nights SET drill=${JSON.stringify({ ...drill, darts })}::jsonb WHERE career_save_id=${root.id} AND id=${nightId}`); return sessionOf(tx, root, nightId); }
          const total = st.visits.reduce((n, x) => n + x.points, 0);
          const average = drill.spec.kind === "SCORING" ? Math.round(total / Math.max(1, st.visits.length) * 10) / 10 : null;
          const score = drill.spec.kind === "SCORING" ? average! : st.score;
          await tx.execute(sql`UPDATE career_local_nights SET status='DONE', drill=${JSON.stringify({ ...drill, darts })}::jsonb,
            result=${JSON.stringify({ routine: drill.routine, score, average, outcome: `${PRACTICE_ROUTINES[drill.routine as PracticeRoutine]}: ${drill.spec.kind === "SCORING" ? `${average} average` : drill.spec.kind === "CHECKOUTS" ? `${score} of ${drill.spec.targets.length} finishes` : `${score} points`}` })}::jsonb
            WHERE career_save_id=${root.id} AND id=${nightId}`);
          return sessionOf(tx, root, nightId);
        }
        // A match.
        const matches = r.matches as Match[], i = matches.findIndex(m => !m.legs);
        if (i < 0) throw new CareerError(409, "Nothing left to play tonight");
        const m = matches[i];
        let st; try { st = replay(fmt(m.bestOf), m.firstThrower, darts); } catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
        m.darts = darts;
        if (!st.complete) { await tx.execute(sql`UPDATE career_local_nights SET matches=${JSON.stringify(matches)}::jsonb WHERE career_save_id=${root.id} AND id=${nightId}`); return sessionOf(tx, root, nightId); }
        m.legs = [st.totalLegs[0], st.totalLegs[1]];
        const won = m.legs[0] > m.legs[1];
        let outcome: string | null = null, prize = 0, finished = true;
        const result = (r.result as Record<string, unknown> | null) ?? {};
        if (kind === "KNOCKOUT" || kind === "CHAMPIONSHIP") {
          // You sit at seat 0 of the draw; the field fills seats 1..n-1. Round r's opponent is the winner of seats 2^r to 2^(r+1)-1.
          const champ = kind === "CHAMPIONSHIP", rounds: readonly string[] = champ ? CHAMP_ROUNDS : KO_ROUNDS, prizes = champ ? LOCAL.championship.prizes : LOCAL.knockout.prizes;
          const bestOf = (r: number) => champ ? (r === rounds.length - 1 ? LOCAL.championship.finalBestOf : LOCAL.championship.bestOf) : LOCAL.knockout.bestOf;
          const name = champ ? "the Club Championship" : "the club knockout";
          const field = (result.field as { key: string; name: string }[]) ?? [];
          if (won && i < rounds.length - 1) {
            const npcs = new Map((await loadNpcs(tx, root.id, { ids: field.map(f => f.key) })).map(n => [n.id, n]));
            const seat = (k: number) => field[k - 1];
            const block = (lo: number, hi: number): number => { if (lo === hi) return lo; const mid = (lo + hi + 1) / 2, a = block(lo, mid - 1), b = block(mid, hi);
              const A = npcs.get(seat(a).key), B = npcs.get(seat(b).key); if (!A || !B) return A ? a : b;
              const [la, lb] = simulate(root, `${nightId}:${a}:${b}`, A, B, bestOf(Math.log2(hi - lo + 1))); return la > lb ? a : b; };
            const next = block(2 ** (i + 1), 2 ** (i + 2) - 1), npc = npcs.get(seat(next).key);
            if (npc) { matches.push({ opponent: opp(root, npc, seat(next).name, `${nightId}:${i + 1}`), bestOf: bestOf(i + 1), round: rounds[i + 1], firstThrower: first(root, `${nightId}:${i + 1}`), darts: [], legs: null }); finished = false; }
            else { prize = prizes[0]; outcome = `Won ${name}`; }
          } else if (won) { prize = prizes[0]; outcome = `Won ${name}!`; }
          else { prize = i === rounds.length - 1 ? prizes[1] : 0; outcome = `Out in the ${rounds[i].toLowerCase()} to ${m.opponent.name}`; }
          if (champ && finished) await tx.execute(sql`INSERT INTO career_local_honours (career_save_id, season, award, detail) VALUES (${root.id}, ${season}, ${won && i === rounds.length - 1 ? "CLUB_CHAMPION" : "CHAMPIONSHIP_RUN"},
            ${JSON.stringify({ reached: rounds[i], won: won && i === rounds.length - 1 })}::jsonb) ON CONFLICT DO NOTHING`);
        } else if (kind === "EXHIBITION") {
          finished = i === matches.length - 1;
          if (finished) { const legs = matches.filter(x => x.legs && x.legs[0] > x.legs[1]).length; prize = Number(r.fee_pence) + legs * LOCAL.exhibition.legWinPence;
            outcome = `Exhibition done: you won ${legs} of ${matches.length} legs`; }
        } else if (kind === "PUB_LEAGUE") {
          outcome = `${won ? "Won" : "Lost"} ${m.legs[0]}-${m.legs[1]} v ${m.opponent.name}`;
          const lg = (await tx.execute(sql`SELECT fixtures FROM career_local_leagues WHERE career_save_id=${root.id} AND id=${String(r.league_id)} FOR UPDATE`)).rows[0];
          if (lg) { const fx = lg.fixtures as Fixture[], f = fx.find(x => x.round === Number(r.round) && (x.a === HUMAN || x.b === HUMAN));
            if (f && !f.legs) f.legs = f.a === HUMAN ? [m.legs[0], m.legs[1]] : [m.legs[1], m.legs[0]];
            await tx.execute(sql`UPDATE career_local_leagues SET fixtures=${JSON.stringify(fx)}::jsonb WHERE career_save_id=${root.id} AND id=${String(r.league_id)}`); }
        } else outcome = `${won ? "Won" : "Lost"} ${m.legs[0]}-${m.legs[1]} v ${m.opponent.name}`;
        await tx.execute(sql`UPDATE career_local_nights SET matches=${JSON.stringify(matches)}::jsonb, status=${finished ? "DONE" : "BOOKED"},
          result=${JSON.stringify({ ...result, outcome })}::jsonb, paid_pence=${prize} WHERE career_save_id=${root.id} AND id=${nightId}`);
        if (finished && prize > 0) await post(tx, root, { operationKey: `adjustment:local-pay:${nightId}`, category: "ADJUSTMENT", headline: "EARNINGS", amountPence: prize,
          reason: kind === "EXHIBITION" ? "Exhibition appearance" : kind === "CHAMPIONSHIP" ? "Club Championship prize" : "Club knockout prize", season, week, detail: { type: "LOCAL_NIGHT_PAY", kind, nightId } });
        return sessionOf(tx, root, nightId);
      });
    },
  };
}

/**
 * The week's local nights, after it's played: a coaching night is paid; anything booked and not finished is missed
 * (no refund of a knockout entry); the pub league's round plays out (your unplayed match is forfeited 3-0), and the
 * league finishes with prizes for the top three.
 */
export async function settleLocalWeek(tx: CareerExecutor, root: Root, season: number, week: number) {
  if (!await tables(tx)) return;
  for (const r of (await tx.execute(sql`SELECT * FROM career_local_nights WHERE career_save_id=${root.id} AND season=${season} AND week=${week} AND status='BOOKED'`)).rows) {
    const paid = r.kind === "COACHING";
    await tx.execute(sql`UPDATE career_local_nights SET status=${paid ? "DONE" : "MISSED"}, paid_pence=${paid ? Number(r.fee_pence) : 0},
      result=${JSON.stringify({ ...((r.result as object | null) ?? {}), outcome: paid ? "Coached a session" : "Didn't make it" })}::jsonb WHERE career_save_id=${root.id} AND id=${String(r.id)}`);
    if (paid && Number(r.fee_pence) > 0) await post(tx, root, { operationKey: `adjustment:local-pay:${String(r.id)}`, category: "ADJUSTMENT", headline: "EARNINGS", amountPence: Number(r.fee_pence),
      reason: "Coaching night", season, week, detail: { type: "LOCAL_NIGHT_PAY", kind: "COACHING", nightId: String(r.id) } });
  }
  await settleLeague(tx, root, season, week);
  // The season's last week: Club Player of the Year, from your local record (league finishes, knockouts, the championship).
  if (week === 52) {
    const leagues = (await tx.execute(sql`SELECT division, position FROM career_local_leagues WHERE career_save_id=${root.id} AND season=${season} AND status='FINISHED'`)).rows;
    const nights = (await tx.execute(sql`SELECT kind, result FROM career_local_nights WHERE career_save_id=${root.id} AND season=${season} AND status='DONE' AND kind IN ('KNOCKOUT','CHAMPIONSHIP')`)).rows;
    const outcome = (r: Record<string, unknown>) => String((r.result as { outcome?: string } | null)?.outcome ?? "");
    const champ = nights.find(r => r.kind === "CHAMPIONSHIP");
    const record = { leagueFinishes: leagues.map(l => ({ division: Number(l.division ?? 4), position: Number(l.position) })),
      knockoutWins: nights.filter(r => r.kind === "KNOCKOUT" && outcome(r).startsWith("Won")).length,
      championship: champ ? (outcome(champ).startsWith("Won") ? "WON" as const : outcome(champ).startsWith("Out in the final ") ? "FINAL" as const : null) : null };
    const points = playerOfYearPoints(record);
    if (points >= LOCAL.playerOfYear.points) await tx.execute(sql`INSERT INTO career_local_honours (career_save_id, season, award, detail)
      VALUES (${root.id}, ${season}, 'PLAYER_OF_THE_YEAR', ${JSON.stringify({ points, ...record })}::jsonb) ON CONFLICT DO NOTHING`);
  }
}

async function settleLeague(tx: CareerExecutor, root: Root, season: number, week: number) {
  const lg = (await tx.execute(sql`SELECT * FROM career_local_leagues WHERE career_save_id=${root.id} AND season=${season} AND status='ACTIVE' AND week_start <= ${week}`)).rows[0];
  if (!lg) return;
  const fixtures = lg.fixtures as Fixture[], open = fixtures.filter(f => f.week <= week && !f.legs);
  const npcs = new Map((await loadNpcs(tx, root.id, { ids: [...new Set(open.flatMap(f => [f.a, f.b]).filter(k => k !== HUMAN))] })).map(n => [n.id, n]));
  for (const f of open) {
    if (f.a === HUMAN || f.b === HUMAN) { f.legs = f.a === HUMAN ? [0, 3] : [3, 0]; continue; }
    const A = npcs.get(f.a), B = npcs.get(f.b);
    f.legs = A && B ? simulate(root, `pub:${String(lg.id)}:${f.round}:${f.a}`, A, B, LOCAL.pub.bestOf) : A ? [3, 0] : [0, 3];
  }
  await tx.execute(sql`UPDATE career_local_leagues SET fixtures=${JSON.stringify(fixtures)}::jsonb WHERE career_save_id=${root.id} AND id=${String(lg.id)}`);
  if (week < Number(lg.week_end)) return;
  const players = lg.players as { key: string }[];
  const table = tableFrom(players.map(p => p.key), fixtures.map(f => ({ a: f.a, b: f.b, legsA: f.legs?.[0] ?? null, legsB: f.legs?.[1] ?? null })));
  const position = table.findIndex(t => t.key === HUMAN) + 1, division = Number(lg.division ?? 4);
  const prize = Math.round((LOCAL.pub.prizes[position - 1] ?? 0) * (LOCAL.divisions.prizeMultiple[division] ?? 1));
  await tx.execute(sql`UPDATE career_local_leagues SET status='FINISHED', position=${position}, prize_pence=${prize} WHERE career_save_id=${root.id} AND id=${String(lg.id)}`);
  if (prize > 0) await post(tx, root, { operationKey: `adjustment:pub-league:${String(lg.id)}`, category: "ADJUSTMENT", headline: "EARNINGS", amountPence: prize,
    reason: `Pub league (${divisionName(division)}): ${["1st", "2nd", "3rd"][position - 1]}`, season, week, detail: { type: "PUB_LEAGUE_PRIZE", leagueId: String(lg.id), position } });
}
