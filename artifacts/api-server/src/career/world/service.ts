import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CAREER_FEATURE, type CareerDifficulty } from "../config.ts";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { CAREER_WORLD_CONFIG, CAREER_DEVELOPMENT_CONFIG, CAREER_DIFFICULTY_CONFIG, CAREER_SIMULATION_CONFIG, SIMULATION_VERSION } from "./config.ts";
import { assertGenerationVersion, generateInitialWorld } from "./generation.ts";
import { loadNpcs, persistNpcs, presentNpc } from "./repository.ts";
import { matchContextSchema, matchFormatSchema, type SimulatedMatch } from "./types.ts";
import { simulateNpcMatch } from "./simulation.ts";
import { stableUuid } from "./random.ts";
import { formAfterMatch } from "./form.ts";
import { developNpc, evolveOffSeason } from "./development.ts";

export type CareerActor = { playerId: number; isAdmin?: boolean };
export type Root = { id: string; world_seed: string; world_generation_version: number; difficulty: CareerDifficulty; current_season: number };
export type World = { season: number; period: number; elapsed_year: number; generation_version: number; simulation_version: number };
const periodSchema = z.object({ season: z.number().int().positive(), period: z.number().int().positive(), elapsedYears: z.number().finite().positive().max(1), opportunity: z.number().finite().min(0).max(1) }).strict();
const offSeasonSchema = z.object({ season: z.number().int().positive(), opportunity: z.number().finite().min(0).max(1) }).strict();
export const simulationSchema = z.object({ matchKey: z.string().min(1).max(120), playerAId: z.string().uuid(), playerBId: z.string().uuid(), context: matchContextSchema, format: matchFormatSchema }).strict();

export async function lockRoot(tx: CareerExecutor, actor: CareerActor, saveId: string, active = true): Promise<Root> {
  careerIdSchema.parse(saveId);
  if (!Number.isSafeInteger(actor.playerId) || actor.playerId <= 0) throw new Error("Authenticated Career actor required");
  const flags = (await tx.execute(sql`SELECT enabled, admin_test_mode FROM feature_flags WHERE feature_name = ${CAREER_FEATURE}`)).rows;
  if (!(flags[0]?.enabled === true || (actor.isAdmin === true && flags[0]?.admin_test_mode === true))) throw new CareerError(404, "Career not available");
  const row = (await tx.execute(sql`SELECT * FROM career_saves WHERE id = ${saveId} AND player_id = ${actor.playerId} FOR UPDATE`)).rows[0];
  if (!row) throw new CareerError(404, "Career not found");
  if (active && row.status !== "ACTIVE") throw new CareerError(409, "Career is retired");
  assertGenerationVersion(Number(row.world_generation_version));
  return row as Root;
}
export async function worldState(tx: CareerExecutor, root: Root): Promise<World> {
  const row = (await tx.execute(sql`SELECT * FROM career_world_state WHERE career_save_id = ${root.id}`)).rows[0];
  if (!row) throw new CareerError(409, "Initialize Career world first");
  if (row.generation_version !== root.world_generation_version || row.simulation_version !== SIMULATION_VERSION) throw new CareerError(409, "Career world requires a version migration");
  return row as World;
}
const configSnapshot = () => ({ world: CAREER_WORLD_CONFIG, development: CAREER_DEVELOPMENT_CONFIG, difficulty: CAREER_DIFFICULTY_CONFIG, simulation: CAREER_SIMULATION_CONFIG });
// Compare nested JSON without dependence on PostgreSQL jsonb key ordering.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function checkRetry(saved: unknown, requested: unknown): void {
  if (canonical(saved) !== canonical(requested)) throw new CareerError(409, "Operation identity was already used with different inputs");
}

/**
 * Transaction-level A2 simulation boundary (added for A3 batching).
 * Caller must already hold the locked root. Requests run sequentially in the
 * supplied order so form carries between matches exactly as single calls would.
 * Behaviour per request is identical to the original simulateMatch body:
 * stored retries return the stored result; reused keys with different inputs fail.
 */
export async function simulateMatchesInTransaction(tx: CareerExecutor, root: Root, world: World, requests: readonly z.infer<typeof simulationSchema>[]): Promise<SimulatedMatch[]> {
  if (!requests.length) return [];
  const parsed = requests.map(request => simulationSchema.parse(request));
  const keys = parsed.map(request => request.matchKey);
  if (new Set(keys).size !== keys.length) throw new CareerError(409, "Duplicate match identity in one batch");
  const saveId = root.id;
  const stored = new Map((await tx.execute(sql`SELECT match_key, request, result FROM career_simulated_matches WHERE career_save_id = ${saveId}
    AND match_key IN (${sql.join(keys.map(key => sql`${key}`), sql`, `)})`)).rows.map(row => [String(row.match_key), row]));
  const ids = [...new Set(parsed.flatMap(request => [request.playerAId, request.playerBId]))];
  const players = new Map((await loadNpcs(tx, saveId, { ids })).map(player => [player.id, player]));
  const results: SimulatedMatch[] = [];
  const inserts: unknown[] = [];
  const touched = new Set<string>();
  for (const request of parsed) {
    const existing = stored.get(request.matchKey);
    if (existing) { checkRetry(existing.request, request); results.push(existing.result as SimulatedMatch); continue; }
    const a = players.get(request.playerAId), b = players.get(request.playerBId);
    if (!a || !b) throw new CareerError(404, "Career opponent not found");
    if (a.status !== "ACTIVE" || b.status !== "ACTIVE" || a.id === b.id) throw new CareerError(409, "Match requires two active distinct NPCs");
    const input = { players: [structuredClone(a), structuredClone(b)] as [typeof a, typeof b], seed: root.world_seed, generationVersion: root.world_generation_version,
      matchKey: request.matchKey, difficulty: root.difficulty, context: request.context, format: request.format };
    const result = simulateNpcMatch(input);
    inserts.push({ id: stableUuid(root.world_seed, root.world_generation_version, "match", request.matchKey), match_key: request.matchKey,
      season: world.season, period: world.period, simulation_version: SIMULATION_VERSION, player_a_id: a.id, player_b_id: b.id, winner_id: result.winnerId,
      request, input_snapshot: input, result });
    a.form = formAfterMatch(a.form, result.performance[0], result.stats[0], result.performance[1]);
    b.form = formAfterMatch(b.form, result.performance[1], result.stats[1], result.performance[0]);
    touched.add(a.id); touched.add(b.id);
    results.push(result);
  }
  if (inserts.length) {
    await tx.execute(sql`INSERT INTO career_simulated_matches (career_save_id, id, match_key, season, period, simulation_version, player_a_id, player_b_id, winner_id, request, input_snapshot, result)
      SELECT ${saveId}::uuid, m.id, m.match_key, m.season, m.period, m.simulation_version, m.player_a_id, m.player_b_id, m.winner_id, m.request, m.input_snapshot, m.result
      FROM jsonb_to_recordset(${JSON.stringify(inserts)}::jsonb) AS m(id uuid, match_key text, season integer, period integer, simulation_version integer,
        player_a_id uuid, player_b_id uuid, winner_id uuid, request jsonb, input_snapshot jsonb, result jsonb)`);
    await persistNpcs(tx, saveId, [...touched].map(id => players.get(id)!));
    await tx.execute(sql`UPDATE career_saves SET updated_at = NOW() WHERE id = ${saveId}`);
  }
  return results;
}

/** Internal A3 integration boundary. No public debug/simulation HTTP endpoints. */
export function createCareerWorldService(database: CareerDatabase) {
  return {
    async initialize(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId);
        const existing = (await tx.execute(sql`SELECT * FROM career_world_state WHERE career_save_id = ${saveId}`)).rows[0];
        if (existing) { await worldState(tx, root); return { initialized: true, created: false }; }
        // A1 saves start in season 1. Refuse to fabricate historical populations.
        if (root.current_season !== 1) throw new CareerError(409, "Uninitialized advanced save requires migration");
        const players = generateInitialWorld(root.world_seed, root.world_generation_version);
        await persistNpcs(tx, saveId, players);
        await tx.execute(sql`INSERT INTO career_world_state (career_save_id, generation_version, simulation_version, season, period, elapsed_year, config_snapshot)
          VALUES (${saveId}, ${root.world_generation_version}, ${SIMULATION_VERSION}, ${root.current_season}, 0, 0, ${JSON.stringify(configSnapshot())}::jsonb)`);
        return { initialized: true, created: true };
      });
    },
    async listPlayers(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        await lockRoot(tx, actor, saveId, false);
        return (await loadNpcs(tx, saveId)).map(presentNpc);
      });
    },
    async simulateMatch(actor: CareerActor, saveId: string, body: unknown): Promise<SimulatedMatch> {
      const request = simulationSchema.parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId);
        const world = await worldState(tx, root);
        return (await simulateMatchesInTransaction(tx, root, world, [request]))[0];
      });
    },
    async advancePeriod(actor: CareerActor, saveId: string, body: unknown) {
      const request = periodSchema.parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId);
        const world = await worldState(tx, root);
        const old = (await tx.execute(sql`SELECT request, summary FROM career_world_periods WHERE career_save_id = ${saveId} AND season = ${request.season} AND kind = 'PERIOD' AND sequence = ${request.period}`)).rows[0];
        if (old) { checkRetry(old.request, request); return old.summary; }
        if (world.season !== request.season || request.period !== world.period + 1 || world.elapsed_year + request.elapsedYears > 1 + 1e-9) throw new CareerError(409, "Career period must be the next period within this season");
        const players = await loadNpcs(tx, saveId, { activeOnly: true });
        const developed = players.map(npc => developNpc(npc, root.world_seed, root.world_generation_version, `${request.season}:${request.period}`, request.elapsedYears, request.opportunity));
        await persistNpcs(tx, saveId, developed);
        const summary = { season: request.season, period: request.period, elapsedYears: request.elapsedYears,
          changes: developed.filter(npc => npc.status === "ACTIVE").map(npc => ({ npcId: npc.id, abilityDelta: npc.development.recentDelta })) };
        await tx.execute(sql`INSERT INTO career_world_periods (career_save_id, season, kind, sequence, request, summary)
          VALUES (${saveId}, ${request.season}, 'PERIOD', ${request.period}, ${JSON.stringify(request)}::jsonb, ${JSON.stringify(summary)}::jsonb)`);
        await tx.execute(sql`UPDATE career_world_state SET period = ${request.period}, elapsed_year = ${Math.min(1, world.elapsed_year + request.elapsedYears)} WHERE career_save_id = ${saveId}`);
        await tx.execute(sql`UPDATE career_saves SET updated_at = NOW() WHERE id = ${saveId}`);
        return summary;
      });
    },
    async processOffSeason(actor: CareerActor, saveId: string, body: unknown) {
      const request = offSeasonSchema.parse(body);
      return database.transaction(async tx => {
        const root = await lockRoot(tx, actor, saveId);
        const world = await worldState(tx, root);
        const old = (await tx.execute(sql`SELECT request, summary FROM career_world_periods WHERE career_save_id = ${saveId} AND season = ${request.season} AND kind = 'OFF_SEASON' AND sequence = 0`)).rows[0];
        if (old) { checkRetry(old.request, request); return old.summary; }
        if (request.season !== world.season || root.current_season !== world.season) throw new CareerError(409, "Off-season must close the current season");
        const evolved = evolveOffSeason(await loadNpcs(tx, saveId), root.world_seed, root.world_generation_version, world.season, 1 - world.elapsed_year, request.opportunity);
        await persistNpcs(tx, saveId, evolved.players);
        const summary = { completedSeason: world.season, nextSeason: world.season + 1, retired: evolved.retired, entrants: evolved.entrants };
        await tx.execute(sql`INSERT INTO career_world_periods (career_save_id, season, kind, sequence, request, summary)
          VALUES (${saveId}, ${world.season}, 'OFF_SEASON', 0, ${JSON.stringify(request)}::jsonb, ${JSON.stringify(summary)}::jsonb)`);
        await tx.execute(sql`UPDATE career_world_state SET season = season + 1, period = 0, elapsed_year = 0 WHERE career_save_id = ${saveId}`);
        await tx.execute(sql`UPDATE career_saves SET current_season = current_season + 1, current_week = 1, updated_at = NOW() WHERE id = ${saveId}`);
        return summary;
      });
    },
  };
}
