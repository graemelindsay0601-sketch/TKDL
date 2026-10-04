import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { loadNpcs } from "../world/repository.ts";
import { createPerformance } from "../world/performance.ts";
import { toCareerBotConfig } from "../world/bot-adapter.ts";
import { scopedRandom } from "../world/random.ts";
import { SIMULATION_VERSION } from "../world/config.ts";
import { HUMAN, loadInstances, matchKeyFor, type InstanceRow, type MatchRow } from "../calendar/engine.ts";
import { assessCapability, liveMatchFormat } from "../calendar/formats.ts";
import type { CareerCalendarService } from "../calendar/service.ts";
import {
  replay, settledDartCount, validateDart, resolveBullUp, botBullThrow, isBullThrow, planBotX01Visit, seededRandom,
  type Dart, type X01Format, type X01MatchState, type BullThrow, type PlayerIdx,
} from "../../shared/darts-rules/index.ts";

/**
 * A6.5 Career live match sessions — the bridge between A3's AWAITING_HUMAN match
 * and the real TKDL scorer.
 *
 * Trust model: the browser never states a winner. It submits the dart log; the
 * server replays it with the shared rules (darts-rules), regenerates every bot
 * visit from the session's seed and the A2-derived bot config, and only when the
 * replay says the match is complete does it derive the score and call A3's
 * recordHumanMatchResult boundary, in the same transaction, exactly once.
 * Human darts are self-reported (they are real darts thrown at a real board).
 *
 * Seats: engine player 0 = the human, 1 = the opponent, regardless of A3 side.
 */
export const LIVE_SESSION_VERSION = 1;
const MAX_DARTS = 6000;

const dartSchema = z.object({ segment: z.number().int(), multiplier: z.number().int(), value: z.number().int(), label: z.string().max(8).optional() }).passthrough();
const bullSchema = z.object({ throw: z.enum(["INNER", "OUTER", "MISS"]), expectedRevision: z.number().int().min(0) }).strict();
const dartsSchema = z.object({ darts: z.array(dartSchema).max(MAX_DARTS), expectedRevision: z.number().int().min(0) }).strict();

type SessionRow = {
  career_save_id: string; id: string; match_id: string; event_id: string; session_version: number; status: "BULL_UP" | "IN_PLAY" | "COMPLETED";
  human_side: 0 | 1; opponent_key: string; best_of: number; format: X01Format; first_throw_method: string;
  bot_config: { avg: number; sd: number; checkoutPct: number; hitAcc: number }; bot_seed: string; bull_first_order: 0 | 1; bull_throws: BullThrow[];
  first_thrower: 0 | 1 | null; darts: Dart[]; revision: number; result: Record<string, unknown> | null;
  created_at: unknown; updated_at: unknown; completed_at: unknown;
};

/** Every bot visit in a replayed log must be exactly what the seeded planner throws. */
export function verifyBotVisits(state: X01MatchState, bot: SessionRow["bot_config"], seed: string): void {
  const doubleOut = state.format.outRule === "DOUBLE";
  const check = (visit: { startScore: number; startOpened: boolean; darts: Dart[] }, index: number) => {
    const plan = planBotX01Visit(visit.startScore, bot, { doubleOut, opened: visit.startOpened, rng: seededRandom(seed, "bot-visit", index) });
    visit.darts.forEach((d, i) => {
      const p = plan[i];
      if (!p || p.segment !== d.segment || p.multiplier !== d.multiplier || p.value !== d.value) throw new CareerError(409, `Opponent visit ${index + 1} does not match the session's bot`);
    });
  };
  let index = 0;
  for (const v of state.visits) if (v.thrower === 1) check(v, index++);
  if (state.visit && state.visit.thrower === 1) check(state.visit, index);
}

const sameDarts = (a: readonly Dart[], b: readonly Dart[]) => a.length === b.length && a.every((d, i) => d.segment === b[i].segment && d.multiplier === b[i].multiplier && d.value === b[i].value);

/** Compact, verified match facts handed to A3 with the result (and to the UI). */
export function matchFacts(state: X01MatchState) {
  const per = (p: PlayerIdx) => {
    const visits = state.visits.filter(v => v.thrower === p);
    const darts = visits.reduce((n, v) => n + v.darts.length, 0);
    const points = visits.reduce((n, v) => n + v.points, 0);
    return { darts, points, average: darts ? Math.round(points / darts * 300) / 100 : 0, maximums: visits.filter(v => v.points === 180).length,
      highestCheckout: Math.max(0, ...visits.filter(v => v.checkout).map(v => v.startScore)) };
  };
  return { legs: state.totalLegs, sets: state.format.unit === "SETS" ? state.sets : null, winner: state.winner,
    legLog: state.legsLog.map(l => ({ set: l.setNo, leg: l.legNo, starter: l.starter, winner: l.winner })), human: per(0), opponent: per(1) };
}

export function createCareerLiveMatchService(database: CareerDatabase, calendar: CareerCalendarService) {
  async function load(tx: CareerExecutor, actor: CareerActor, saveId: string, matchId: string, active = true) {
    careerIdSchema.parse(saveId); careerIdSchema.parse(matchId);
    const root = await lockRoot(tx, actor, saveId, active);
    const match = (await tx.execute(sql`SELECT * FROM career_tournament_matches WHERE career_save_id = ${root.id} AND id = ${matchId} FOR UPDATE`)).rows[0] as MatchRow | undefined;
    if (!match) throw new CareerError(404, "Career match not found");
    const session = (await tx.execute(sql`SELECT * FROM career_match_sessions WHERE career_save_id = ${root.id} AND match_id = ${matchId} FOR UPDATE`)).rows[0] as SessionRow | undefined;
    return { root, match, session };
  }

  function present(session: SessionRow, match: MatchRow, opponentName: string, humanName: string) {
    const bull = resolveBullUp(session.bull_first_order, session.bull_throws);
    const state = session.first_thrower !== null ? replay(session.format, session.first_thrower, session.darts) : null;
    const superseded = session.status !== "COMPLETED" && match.status !== "AWAITING_HUMAN";
    return {
      sessionId: session.id, sessionVersion: session.session_version, matchId: session.match_id, eventId: session.event_id,
      status: superseded ? "SUPERSEDED" as const : session.status, revision: session.revision,
      player: { name: humanName }, opponent: { key: session.opponent_key, name: opponentName },
      format: session.format, bestOf: session.best_of, firstThrowMethod: session.first_throw_method,
      // Only what GameScorer needs: the bot's live config and its visit seed. No hidden potential/ability.
      bot: { config: session.bot_config, seed: session.bot_seed },
      bullUp: { required: session.first_throw_method === "BULL_UP", firstOrder: session.bull_first_order, throws: session.bull_throws, winner: bull.winner, nextThrower: bull.nextThrower },
      firstThrower: session.first_thrower,
      darts: session.darts, settledDarts: state ? settledDartCount(state) : 0,
      progress: state ? { legs: state.legs, sets: state.sets, totalLegs: state.totalLegs, setNo: state.setNo, legNo: state.legNo, complete: state.complete } : null,
      result: session.result,
    };
  }

  async function names(tx: CareerExecutor, saveId: string, session: SessionRow) {
    const npc = (await loadNpcs(tx, saveId, { ids: [session.opponent_key] }))[0];
    const human = (await tx.execute(sql`SELECT COALESCE(p.display_name, s.career_name) AS name FROM career_saves s LEFT JOIN career_profiles p ON p.career_save_id = s.id WHERE s.id = ${saveId}`)).rows[0];
    return { opponent: npc ? `${npc.firstName} ${npc.surname}` : "Opponent", human: (human?.name as string | null) ?? "You" };
  }

  async function presentLoaded(tx: CareerExecutor, saveId: string, session: SessionRow, match: MatchRow) {
    const n = await names(tx, saveId, session);
    return present(session, match, n.opponent, n.human);
  }

  return {
    /** Create (once) or return the session for the human's AWAITING_HUMAN match. */
    async open(actor: CareerActor, saveId: string, matchId: string) {
      return database.transaction(async tx => {
        const { root, match, session } = await load(tx, actor, saveId, matchId);
        if (session) return presentLoaded(tx, root.id, match.status === "AWAITING_HUMAN" ? await botBullTurns(tx, root.id, session) : session, match);
        if (match.status !== "AWAITING_HUMAN") throw new CareerError(409, "Match is not awaiting the human player");
        const humanSide = match.a_key === HUMAN ? 0 : match.b_key === HUMAN ? 1 : -1;
        if (humanSide < 0) throw new CareerError(409, "Match does not involve the human player");
        const opponentKey = humanSide === 0 ? match.b_key : match.a_key;
        if (!opponentKey || opponentKey === HUMAN) throw new CareerError(409, "Opponent is not decided yet");
        await assertProfileComplete(tx, root.id);
        const event = (await loadInstances(tx, root.id, sql`id = ${match.event_id}`))[0] as InstanceRow | undefined;
        if (!event) throw new CareerError(404, "Career event not found");
        if (event.status !== "IN_PROGRESS") throw new CareerError(409, "Event is not in progress");
        const capability = assessCapability(event.snapshot.format);
        if (!capability.executable) throw new CareerError(409, "This event format cannot be played live yet");
        const npc = (await loadNpcs(tx, root.id, { ids: [opponentKey] }))[0];
        if (!npc || npc.status !== "ACTIVE") throw new CareerError(409, "Opponent is unavailable");
        const rounds = Number((await tx.execute(sql`SELECT MAX(round)::int AS r FROM career_tournament_matches WHERE career_save_id = ${root.id} AND event_id = ${event.id}`)).rows[0].r);
        // A2 authority: the opponent's form for THIS match, same derivation as an NPC match.
        const matchKey = matchKeyFor(event, match.stage_key, match.round, match.slot);
        const context = { category: event.snapshot.format.matchContext, roundImportance: Math.round(match.round / rounds * 1000) / 1000, elimination: true };
        const performance = createPerformance(npc, context, root.difficulty, scopedRandom(root.world_seed, root.world_generation_version, "performance", SIMULATION_VERSION, matchKey, npc.id));
        const botConfig = toCareerBotConfig(performance);
        const format = liveMatchFormat(event.snapshot.format, match.best_of) as X01Format;
        const method = event.snapshot.format.firstThrowMethod;
        // Non-bull methods are decided from authored facts; BULL_UP waits for the live bull-up.
        const firstThrower: 0 | 1 | null = method === "BULL_UP" ? null : method === "ALTERNATE_FROM_DRAW" ? (humanSide === 0 ? 0 : 1) : await higherSeedFirst(tx, root.id, event.id, opponentKey);
        const row = (await tx.execute(sql`INSERT INTO career_match_sessions (career_save_id, id, match_id, event_id, session_version, status, human_side, opponent_key, best_of, format,
            first_throw_method, bot_config, bot_seed, bull_first_order, first_thrower)
          VALUES (${root.id}, ${randomUUID()}, ${match.id}, ${event.id}, ${LIVE_SESSION_VERSION}, ${firstThrower === null ? "BULL_UP" : "IN_PLAY"}, ${humanSide}, ${opponentKey}, ${match.best_of},
            ${JSON.stringify(format)}::jsonb, ${method}, ${JSON.stringify(botConfig)}::jsonb, ${randomBytes(16).toString("hex")}, ${humanSide === 0 ? 0 : 1}, ${firstThrower})
          ON CONFLICT (career_save_id, match_id) DO NOTHING RETURNING *`)).rows[0] as SessionRow | undefined;
        const created = row ?? (await tx.execute(sql`SELECT * FROM career_match_sessions WHERE career_save_id = ${root.id} AND match_id = ${match.id}`)).rows[0] as SessionRow;
        return presentLoaded(tx, root.id, await botBullTurns(tx, root.id, created), match);
      });
    },

    async read(actor: CareerActor, saveId: string, matchId: string) {
      return database.transaction(async tx => {
        const { root, match, session } = await load(tx, actor, saveId, matchId, false);
        if (!session) throw new CareerError(404, "No live session for this match");
        return presentLoaded(tx, root.id, session, match);
      });
    },

    /**
     * Bull-up: the human reports where their one dart landed; the opponent's throw is
     * generated server-side from its own accuracy and the session seed. Persisted, so a
     * reload continues the same bull-up and can never re-roll it.
     */
    async bull(actor: CareerActor, saveId: string, matchId: string, body: unknown) {
      const input = bullSchema.parse(body);
      return database.transaction(async tx => {
        const { root, match, session } = await load(tx, actor, saveId, matchId);
        if (!session) throw new CareerError(404, "No live session for this match");
        if (match.status !== "AWAITING_HUMAN") throw new CareerError(409, "Match is no longer awaiting the human player");
        if (session.status !== "BULL_UP") throw new CareerError(409, "Bull-up is already decided");
        if (session.revision !== input.expectedRevision) throw new CareerError(409, "Session changed; reload it");
        const throws = [...session.bull_throws];
        const botThrow = () => botBullThrow(session.bot_config.hitAcc, seededRandom(session.bot_seed, "bull", throws.length));
        let state = resolveBullUp(session.bull_first_order, throws);
        while (state.winner === null && state.nextThrower === 1) { throws.push(botThrow()); state = resolveBullUp(session.bull_first_order, throws); }
        if (state.winner === null) { throws.push(input.throw); state = resolveBullUp(session.bull_first_order, throws); }
        while (state.winner === null && state.nextThrower === 1) { throws.push(botThrow()); state = resolveBullUp(session.bull_first_order, throws); }
        const updated = (await tx.execute(sql`UPDATE career_match_sessions SET bull_throws = ${JSON.stringify(throws)}::jsonb, revision = revision + 1, updated_at = NOW(),
            status = ${state.winner === null ? "BULL_UP" : "IN_PLAY"}, first_thrower = ${state.winner}
          WHERE career_save_id = ${root.id} AND id = ${session.id} AND revision = ${session.revision} RETURNING *`)).rows[0] as SessionRow;
        return presentLoaded(tx, root.id, updated, match);
      });
    },

    /**
     * Checkpoint the dart log (every visit; also the final submission). The log must
     * replay legally, every opponent visit must match the seeded bot, and darts in
     * finished legs can never be rewritten. When the replay completes the match the
     * result is derived here and recorded through A3 in the same transaction.
     */
    async darts(actor: CareerActor, saveId: string, matchId: string, body: unknown) {
      const input = dartsSchema.parse(body);
      return database.transaction(async tx => {
        const { root, match, session } = await load(tx, actor, saveId, matchId);
        if (!session) throw new CareerError(404, "No live session for this match");
        const darts = input.darts.map((d, i) => { const v = validateDart(d); if (!v) throw new CareerError(409, `Dart ${i + 1} is not a real dart`); return v; });
        if (session.status === "COMPLETED") {
          // Idempotent final submission: the same completed log returns the original result.
          if (sameDarts(darts, session.darts)) return { ...(await presentLoaded(tx, root.id, session, match)), duplicate: true };
          throw new CareerError(409, "Match result is already recorded");
        }
        if (session.status === "BULL_UP" || session.first_thrower === null) throw new CareerError(409, "Finish the bull-up first");
        if (match.status !== "AWAITING_HUMAN") throw new CareerError(409, "Match is no longer awaiting the human player");
        if (session.revision !== input.expectedRevision) throw new CareerError(409, "Session changed; reload it");
        let state: X01MatchState;
        try { state = replay(session.format, session.first_thrower, darts); }
        catch (error) { throw new CareerError(409, `Dart log rejected: ${(error as Error).message}`); }
        verifyBotVisits(state, session.bot_config, session.bot_seed);
        const previous = replay(session.format, session.first_thrower, session.darts);
        const settled = settledDartCount(previous);
        for (let i = 0; i < settled; i++) {
          const a = darts[i], b = session.darts[i];
          if (!a || a.segment !== b.segment || a.multiplier !== b.multiplier) throw new CareerError(409, "Darts in finished legs cannot be changed");
        }
        let result: Record<string, unknown> | null = null;
        if (state.complete) {
          const facts = matchFacts(state);
          const bull = resolveBullUp(session.bull_first_order, session.bull_throws);
          const recorded = await calendar.recordHumanMatchResultInTx(tx, actor, saveId, {
            matchId: match.id, humanLegs: state.totalLegs[0], opponentLegs: state.totalLegs[1], humanThrewFirst: session.first_thrower === 0,
            ...(session.format.unit === "SETS" ? { humanSets: state.sets[0], opponentSets: state.sets[1] } : {}),
            live: { sessionId: session.id, dartCount: darts.length, facts,
              ...(session.first_throw_method === "BULL_UP" ? { bullUp: { rounds: bull.rounds, winner: bull.winner === 0 ? "HUMAN" : "OPPONENT" } } : { firstThrowMethod: session.first_throw_method }) },
          });
          result = { humanWon: state.winner === 0, legs: state.totalLegs, sets: session.format.unit === "SETS" ? state.sets : null, facts, ...recorded };
        }
        const updated = (await tx.execute(sql`UPDATE career_match_sessions SET darts = ${JSON.stringify(darts)}::jsonb, revision = revision + 1, updated_at = NOW(),
            status = ${result ? "COMPLETED" : "IN_PLAY"}, result = ${result ? JSON.stringify(result) : null}::jsonb, completed_at = ${result ? sql`NOW()` : sql`NULL`}
          WHERE career_save_id = ${root.id} AND id = ${session.id} AND revision = ${session.revision} RETURNING *`)).rows[0] as SessionRow | undefined;
        if (!updated) throw new CareerError(409, "Session changed; reload it");
        const fresh = result ? (await tx.execute(sql`SELECT * FROM career_tournament_matches WHERE career_save_id = ${root.id} AND id = ${match.id}`)).rows[0] as MatchRow : match;
        return presentLoaded(tx, root.id, updated, fresh);
      });
    },
  };

  /** When the opponent is due to throw at the bull (it throws first in some rounds), it throws now, server-side. */
  async function botBullTurns(tx: CareerExecutor, saveId: string, session: SessionRow): Promise<SessionRow> {
    if (session.status !== "BULL_UP") return session;
    const throws = [...session.bull_throws];
    let state = resolveBullUp(session.bull_first_order, throws);
    while (state.winner === null && state.nextThrower === 1) {
      throws.push(botBullThrow(session.bot_config.hitAcc, seededRandom(session.bot_seed, "bull", throws.length)));
      state = resolveBullUp(session.bull_first_order, throws);
    }
    if (throws.length === session.bull_throws.length) return session;
    return (await tx.execute(sql`UPDATE career_match_sessions SET bull_throws = ${JSON.stringify(throws)}::jsonb, revision = revision + 1, updated_at = NOW(),
        status = ${state.winner === null ? "BULL_UP" : "IN_PLAY"}, first_thrower = ${state.winner}
      WHERE career_save_id = ${saveId} AND id = ${session.id} AND revision = ${session.revision} RETURNING *`)).rows[0] as SessionRow;
  }

  async function higherSeedFirst(tx: CareerExecutor, saveId: string, eventId: string, opponentKey: string): Promise<0 | 1> {
    const seeds = new Map((await tx.execute(sql`SELECT participant_key, draw_seed FROM career_event_entries WHERE career_save_id = ${saveId} AND event_id = ${eventId}
      AND participant_key IN (${HUMAN}, ${opponentKey})`)).rows.map(r => [String(r.participant_key), r.draw_seed === null ? null : Number(r.draw_seed)]));
    const h = seeds.get(HUMAN) ?? null, o = seeds.get(opponentKey) ?? null;
    return o !== null && (h === null || o < h) ? 1 : 0;
  }
}

/** PROFILE_INCOMPLETE saves (legacy, no DOB) cannot progress sporting play until the DOB is set. */
export async function assertProfileComplete(tx: CareerExecutor, saveId: string) {
  const row = (await tx.execute(sql`SELECT date_of_birth FROM career_profiles WHERE career_save_id = ${saveId}`)).rows[0];
  if (!row || row.date_of_birth === null) throw new CareerError(409, "PROFILE_INCOMPLETE: set your Career date of birth first");
}

export type CareerLiveMatchService = ReturnType<typeof createCareerLiveMatchService>;
export const isBull = isBullThrow;
