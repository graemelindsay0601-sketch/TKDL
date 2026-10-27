import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { CareerError } from "../service.ts";
import { ensureLocalCompetitions } from "../../db/migrations/create_career_local_competitions.ts";
import { loadNpcs } from "../world/repository.ts";
import { LOCALITIES } from "../calendar/geography.ts";
import { dartsNation } from "../calendar/pairs.ts";
import { createPerformance } from "../world/performance.ts";
import { toCareerBotConfig } from "../world/bot-adapter.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { SIMULATION_VERSION } from "../world/config.ts";
import { replay, type X01Format } from "../../shared/darts-rules/x01.ts";

type Root = { id: string; current_season: number | string; current_week: number | string; world_seed: string; world_generation_version: number | string; difficulty: string };
const createInput = z.object({
  name: z.string().trim().min(3).max(48),
  kind: z.enum(["LEAGUE", "SINGLES_CUP", "TEAM_CUP"]),
  startingScore: z.union([z.literal(301), z.literal(501), z.literal(701)]),
  bestOfLegs: z.union([z.literal(3), z.literal(5), z.literal(7)]),
  inRule: z.enum(["STRAIGHT", "DOUBLE"]),
  outRule: z.enum(["STRAIGHT", "DOUBLE"]),
}).strict();
type Rules = Omit<z.infer<typeof createInput>, "name" | "kind">;
export type LocalCompetitionPlayer = { key: string; name: string; you: boolean; bot?: { avg: number; sd: number; checkoutPct: number; hitAcc: number; seed: string } };
export type LocalCompetitionFixture = { id: string; round: number; week: number; a: string; b: string; status: "READY" | "LIVE" | "PLAYED" | "MISSED"; score?: [number, number]; winnerKey?: string; teamScore?: [number, number]; match?: { id: string; status: "LIVE" | "PLAYED"; darts: unknown[]; firstThrower: 0; bot: LocalCompetitionPlayer["bot"]; won?: boolean } };
export type Competition = { id: string; season: number; home_club: string; name: string; kind: "LEAGUE" | "SINGLES_CUP" | "TEAM_CUP"; rules: Rules; participants: LocalCompetitionPlayer[]; fixtures: LocalCompetitionFixture[]; status: string };
type Player = LocalCompetitionPlayer;
type Fixture = LocalCompetitionFixture;

const format = (r: Rules): X01Format => ({ startingScore: r.startingScore, inRule: r.inRule, outRule: r.outRule, unit: "LEGS", bestOfLegs: r.bestOfLegs });
const playWeeks = (seasonWeek: number) => Math.min(52, Math.max(1, seasonWeek));
const buildFixtures = (kind: Competition["kind"], entrants: Player[], seasonWeek: number): Fixture[] => {
  const weeks = playWeeks(seasonWeek), fixtures: Fixture[] = [];
  if (kind === "LEAGUE") {
    const rotation: (Player | null)[] = [...entrants].sort((a,b)=>a.key.localeCompare(b.key));
    if (rotation.length % 2) rotation.push(null);
    for (let round = 0; round < rotation.length - 1; round++) {
      for (let i = 0; i < rotation.length / 2; i++) {
        const first = rotation[i], second = rotation[rotation.length - 1 - i];
        if (!first || !second) continue;
        const [a,b] = round % 2 ? [second,first] : [first,second];
        fixtures.push({ id: stableUuid("local-comp", 1, kind, weeks, round, a.key, b.key), round: round + 1, week: weeks + round, a: a.key, b: b.key, status: "READY" });
      }
      rotation.splice(1,0,rotation.pop()!);
    }
    return fixtures;
  }
  // Eight-player single-elimination draw; the last place in the draw is always the player.
  const draw = [...entrants].sort((a,b)=>a.key.localeCompare(b.key));
  const you = draw.findIndex(p => p.you);
  if (you !== draw.length - 1) [draw[you], draw[draw.length - 1]] = [draw[draw.length - 1], draw[you]];
  for (let i = 0; i < draw.length; i += 2) fixtures.push({
    id: stableUuid("local-comp", 1, kind, weeks, 1, draw[i].key, draw[i + 1].key),
    round: 1, week: weeks, a: draw[i].key, b: draw[i + 1].key, status: "READY",
  });
  return fixtures;
};

function simulatedScore(a: Player, b: Player, rules: Rules, seed: string, scope: string): [number, number] {
  const random = scopedRandom(seed, SIMULATION_VERSION, "local-competition-result", scope, a.key, b.key);
  const roundsToWin = Math.ceil(rules.bestOfLegs / 2);
  let aLegs = 0, bLegs = 0;
  const aAvg = a.bot?.avg ?? 45, bAvg = b.bot?.avg ?? 45;
  while (aLegs < roundsToWin && bLegs < roundsToWin) {
    const pA = Math.min(.82, Math.max(.18, .5 + (aAvg - bAvg) / 220));
    if (random() < pA) aLegs++; else bLegs++;
  }
  return [aLegs, bLegs];
}

function simulateReadyMatches(comp: Competition, currentWeek: number, seed: string): boolean {
  let changed = false;
  const wasComplete = comp.status === "COMPLETE";
  const byKey = new Map(comp.participants.map(p => [p.key, p]));
  for (const f of comp.fixtures) {
    if (f.status === "READY" && f.week < currentWeek && (f.a === "HUMAN" || f.b === "HUMAN")) {
      f.status = "MISSED";
      f.winnerKey = f.a === "HUMAN" ? f.b : f.a;
      changed = true;
      continue;
    }
    if (f.status !== "READY" || f.week > currentWeek || f.a === "HUMAN" || f.b === "HUMAN") continue;
    const a = byKey.get(f.a), b = byKey.get(f.b);
    if (!a || !b) continue;
    if (comp.kind === "TEAM_CUP") {
      const tally: [number, number] = [0, 0];
      for (let rubber = 0; rubber < 3; rubber++) {
        const [aLegs, bLegs] = simulatedScore(a, b, comp.rules, seed, `${f.id}:${rubber}`);
        tally[aLegs > bLegs ? 0 : 1]++;
      }
      f.score = tally;
      f.winnerKey = tally[0] >= 2 ? f.a : f.b;
    } else {
      const [aLegs, bLegs] = simulatedScore(a, b, comp.rules, seed, f.id);
      f.score = [aLegs, bLegs];
      f.winnerKey = aLegs > bLegs ? f.a : f.b;
    }
    f.status = "PLAYED";
    changed = true;
  }
  if (comp.kind !== "LEAGUE") {
    const lastRound = Math.max(...comp.fixtures.map(f => f.round), 0);
    const current = comp.fixtures.filter(f => f.round === lastRound);
    if (current.length && current.every(f => f.status === "PLAYED" || f.status === "MISSED") && current.length > 1) {
      const winners = current.map(f => f.winnerKey).filter((x): x is string => !!x);
      if (winners.length === current.length) {
        const startWeek = Math.min(...comp.fixtures.map(f => f.week));
        const nextRound = lastRound + 1;
        const roster = new Map(comp.participants.map(p => [p.key, p]));
        for (let i = 0; i + 1 < winners.length; i += 2) {
          const a = roster.get(winners[i]), b = roster.get(winners[i + 1]);
          if (!a || !b) continue;
          comp.fixtures.push({ id: stableUuid(seed, SIMULATION_VERSION, comp.id, "cup", nextRound, a.key, b.key),
            round: nextRound, week: Math.min(52, startWeek + nextRound - 1), a: a.key, b: b.key, status: "READY" });
        }
        changed = true;
      }
    }
  }
  comp.status = comp.fixtures.length > 0 && comp.fixtures.every(f => f.status === "PLAYED" || f.status === "MISSED") ? "COMPLETE" : "ACTIVE";
  return changed || wasComplete !== (comp.status === "COMPLETE");
}

function rowToCompetition(r: Record<string, unknown>): Competition {
  return { id: String(r.id), season: Number(r.season), home_club: String(r.home_club), name: String(r.name),
    kind: r.kind as Competition["kind"], rules: r.rules as Rules, participants: r.participants as Player[],
    fixtures: r.fixtures as Fixture[], status: String(r.status) };
}

async function save(tx: CareerExecutor, id: string, fixtures: Fixture[], status?: string) {
  await tx.execute(sql`UPDATE career_local_competitions SET fixtures=${JSON.stringify(fixtures)}::jsonb,
    status=${status ?? (fixtures.every(f => f.status === "PLAYED" || f.status === "MISSED") ? "COMPLETE" : "ACTIVE")}
    WHERE id=${id}::uuid`);
}

export function createCareerLocalCompetitionService(database: CareerDatabase) {
  return {
    async read(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        await ensureLocalCompetitions(tx);
        const root = await lockRoot(tx, actor, saveId, false) as unknown as Root;
        const rows = (await tx.execute(sql`SELECT * FROM career_local_competitions WHERE career_save_id=${root.id}
          ORDER BY created_at DESC FOR UPDATE`)).rows;
        for (const row of rows) {
          const comp = rowToCompetition(row as Record<string, unknown>);
          if (simulateReadyMatches(comp, Number(root.current_week), root.world_seed)) await save(tx, comp.id, comp.fixtures);
          row.fixtures = comp.fixtures;
          row.status = comp.status;
        }
        return { season: Number(root.current_season), week: Number(root.current_week), competitions: rows.map(r => rowToCompetition(r as Record<string,unknown>)) };
      });
    },
    async create(actor: CareerActor, saveId: string, body: unknown) {
      const input = createInput.parse(body);
      return database.transaction(async tx => {
        await ensureLocalCompetitions(tx);
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const profile = (await tx.execute(sql`SELECT home_locality FROM career_profiles WHERE career_save_id=${root.id}`)).rows[0];
        const home = String(profile?.home_locality ?? "");
        if (!LOCALITIES.some(l => l.key === home)) throw new CareerError(409, "Set a home club before starting a local competition");
        const latestStart = input.kind === "LEAGUE" ? 47 : input.kind === "SINGLES_CUP" ? 50 : 51;
        if (Number(root.current_week) > latestStart) throw new CareerError(409, "There is not enough season time left for this competition");
        const npcs = await loadNpcs(tx, root.id, { activeOnly: true });
        const homeLocality = LOCALITIES.find(l=>l.key===home)!;
        const nation = dartsNation(homeLocality.country, home);
        const localNpcs = npcs.filter(n => {
          const town = LOCALITIES.find(l => l.key === n.homeRegion || l.region === n.homeRegion);
          return town && town.country === homeLocality.country && dartsNation(town.country, town.key) === nation;
        });
        const makeEntrant = (n: typeof npcs[number], key: string, name: string, you = false): Player => {
          const performance = createPerformance(n, { category: "floor", roundImportance: .5, elimination: input.kind !== "LEAGUE" }, root.difficulty as never,
            scopedRandom(root.world_seed, Number(root.world_generation_version), "local-competition", SIMULATION_VERSION, n.id, input.name));
          const bot = toCareerBotConfig(performance);
          return { key, name, you, bot: { avg: bot.avg, sd: bot.sd, checkoutPct: bot.checkoutPct,
            hitAcc: bot.hitAcc, seed: stableUuid(root.world_seed, SIMULATION_VERSION, "local-comp-bot", root.id, n.id, input.name) } };
        };
        const saveName = String((await tx.execute(sql`SELECT career_name FROM career_saves WHERE id=${root.id}`)).rows[0]?.career_name ?? "You");
        let entrants: Player[];
        if (input.kind === "TEAM_CUP") {
          const towns = [homeLocality, ...LOCALITIES.filter(l => l.key !== home && l.country === homeLocality.country && dartsNation(l.country, l.key) === nation)].slice(0, 4);
          const teamNpcs = localNpcs.length ? localNpcs : npcs;
          if (towns.length < 4 || !teamNpcs.length) throw new CareerError(409, "There are not enough local clubs to enter a team cup");
          entrants = towns.map((town, i) => {
            const npc = teamNpcs.find(n => n.homeRegion === town.region) ?? teamNpcs[i % teamNpcs.length];
            const key = town.key === home ? "HUMAN" : `TEAM:${town.key}`;
            return makeEntrant(npc, key, town.key === home ? `${saveName} · ${town.region} Club` : `${town.region} Club`, town.key === home);
          });
        } else {
          const pool = localNpcs.length ? localNpcs : npcs;
          if (pool.length < 7) throw new CareerError(409, "There are not enough local players to enter this competition");
          entrants = pool.slice(0, 7).map(n => makeEntrant(n, n.id, `${n.firstName} ${n.surname}`));
          entrants.push({ key: "HUMAN", name: saveName, you: true });
        }
        const rules: Rules = { startingScore: input.startingScore, bestOfLegs: input.bestOfLegs, inRule: input.inRule, outRule: input.outRule };
        const fixtures = buildFixtures(input.kind, entrants, Number(root.current_week));
        const result = await tx.execute(sql`INSERT INTO career_local_competitions
          (career_save_id,season,home_club,name,kind,rules,participants,fixtures)
          VALUES (${root.id},${Number(root.current_season)},${home},${input.name},${input.kind},
            ${JSON.stringify(rules)}::jsonb,${JSON.stringify(entrants)}::jsonb,${JSON.stringify(fixtures)}::jsonb)
          RETURNING *`);
        return rowToCompetition(result.rows[0] as Record<string,unknown>);
      });
    },
    async startMatch(actor: CareerActor, saveId: string, competitionId: string, fixtureId: string) {
      return database.transaction(async tx => {
        await ensureLocalCompetitions(tx);
        const root = await lockRoot(tx, actor, saveId) as unknown as Root;
        const result = await tx.execute(sql`SELECT * FROM career_local_competitions WHERE id=${competitionId}::uuid AND career_save_id=${root.id} FOR UPDATE`);
        if (!result.rows[0]) throw new CareerError(404, "Local competition not found");
        const comp = rowToCompetition(result.rows[0] as Record<string,unknown>);
        const fixture = comp.fixtures.find(f => f.id === fixtureId);
        if (!fixture) throw new CareerError(404, "Fixture not found");
        if (fixture.status === "PLAYED" || fixture.status === "MISSED") return { competition: comp, fixture };
        if (fixture.week < Number(root.current_week)) throw new CareerError(409, "This fixture was missed when the Career week advanced");
        if (fixture.a !== "HUMAN" && fixture.b !== "HUMAN") throw new CareerError(409, "You are not entered in this fixture");
        if (fixture.week > Number(root.current_week)) throw new CareerError(409, "This fixture is not available until its scheduled week");
        const human = comp.participants.find(p => p.you)!;
        const opponentKey = fixture.a === human.key ? fixture.b : fixture.a;
        const opponent = comp.participants.find(p => p.key === opponentKey)!;
        if (!opponent.bot) throw new CareerError(409, "Opponent data is unavailable");
        if (!fixture.match) {
          fixture.match = { id: stableUuid("local-comp-match", 1, comp.id, fixture.id), status: "LIVE", darts: [], firstThrower: 0,
            bot: opponent.bot };
          if (comp.kind === "TEAM_CUP") {
            const home = comp.participants.find(p => p.key === fixture.a)!;
            const away = comp.participants.find(p => p.key === fixture.b)!;
            fixture.teamScore = [0, 0];
            for (let rubber = 0; rubber < 2; rubber++) {
              const [aLegs, bLegs] = simulatedScore(home, away, comp.rules, root.world_seed, `${comp.id}:${fixture.id}:team:${rubber}`);
              fixture.teamScore[aLegs > bLegs ? 0 : 1]++;
            }
          }
          fixture.status = "LIVE";
          await save(tx, comp.id, comp.fixtures);
        }
        return { competition: comp, fixture };
      });
    },
    async darts(actor: CareerActor, saveId: string, competitionId: string, fixtureId: string, body: unknown) {
      const { darts } = z.object({ darts: z.array(z.unknown()).max(500) }).strict().parse(body);
      return database.transaction(async tx => {
        await ensureLocalCompetitions(tx);
        const root = await lockRoot(tx, actor, saveId);
        const result = await tx.execute(sql`SELECT * FROM career_local_competitions WHERE id=${competitionId}::uuid AND career_save_id=${root.id} FOR UPDATE`);
        if (!result.rows[0]) throw new CareerError(404, "Local competition not found");
        const comp = rowToCompetition(result.rows[0] as Record<string,unknown>);
        const fixture = comp.fixtures.find(f=>f.id===fixtureId);
        if (!fixture?.match) throw new CareerError(404, "Live fixture not found");
        if (fixture.match.status === "LIVE") {
          let state;
          try { state = replay(format(comp.rules), fixture.match.firstThrower, darts); }
          catch (e) { throw new CareerError(400, `Invalid darts: ${(e as Error).message}`); }
          fixture.match.darts = darts;
          if (state.complete) {
            fixture.match.status = "PLAYED";
            fixture.match.won = state.winner === 0;
            if (comp.kind === "TEAM_CUP") {
              fixture.teamScore ??= [0, 0];
              fixture.teamScore[fixture.match.won ? (fixture.a === "HUMAN" ? 0 : 1) : (fixture.a === "HUMAN" ? 1 : 0)]++;
              fixture.score = fixture.teamScore;
              fixture.winnerKey = fixture.teamScore[0] >= 2 ? fixture.a : fixture.b;
            } else {
              const youIsA = fixture.a === "HUMAN";
              fixture.score = youIsA ? [state.totalLegs[0],state.totalLegs[1]] : [state.totalLegs[1],state.totalLegs[0]];
              fixture.winnerKey = fixture.match.won ? "HUMAN" : (fixture.a === "HUMAN" ? fixture.b : fixture.a);
            }
            fixture.status = "PLAYED";
          }
          await save(tx, comp.id, comp.fixtures);
        }
        return { competition: comp, fixture };
      });
    },
  };
}
