import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { scopedRandom, stableUuid } from "../world/random.ts";
import { loadNpcs } from "../world/repository.ts";
import { createPerformance } from "../world/performance.ts";
import { toCareerBotConfig } from "../world/bot-adapter.ts";
import { SIMULATION_VERSION } from "../world/config.ts";
import { botBullThrow, resolveBullUp, seededRandom, type BullThrow } from "../../shared/darts-rules/index.ts";
import type { InstanceRow, MatchRow, RootRow } from "./engine.ts";
import { GROUP_KEYS, GROUP_SCHEDULE, bullRanking, groupStage, groupTable } from "./groups.ts";
import { CALENDAR_GENERATION_VERSION } from "./config.ts";

export type BullRow = {
  group_key: string; tie_key: string; ordinal: number; a_key: string; b_key: string;
  throws: BullThrow[]; revision: number; winner_key: string | null;
};
export const tournamentDay = (e: InstanceRow, phase: number, count: number) =>
  e.start_day + Math.floor((phase - 1) * (e.end_day - e.start_day + 1) / count);

export function makeGroupRows(root: RootRow, event: InstanceRow, positions: (string | null)[]) {
  if (positions.length !== 16 || positions.some(k => !k) || new Set(positions).size !== 16)
    throw new CareerError(409, "Vault requires sixteen real confirmed entrants");
  return GROUP_KEYS.flatMap((group, g) => GROUP_SCHEDULE.flatMap((pairs, r) => pairs.map(([a, b], s) => ({
    id: stableUuid(root.world_seed, CALENDAR_GENERATION_VERSION, "tournament-match", event.id, groupStage(group), r + 1, s + 1),
    stage_key: groupStage(group), round: r + 1, slot: s + 1, best_of: event.snapshot.format.stages[0].bestOfByRound[0],
    scheduled_day: tournamentDay(event, r + 1, 6), a_key: positions[g * 4 + a], b_key: positions[g * 4 + b],
    a_npc_id: positions[g * 4 + a] === "HUMAN" ? null : positions[g * 4 + a],
    b_npc_id: positions[g * 4 + b] === "HUMAN" ? null : positions[g * 4 + b],
    status: "PENDING", winner_key: null, result_source: null, first_throw_method: event.snapshot.format.firstThrowMethod,
  }))));
}

export async function loadBulls(tx: CareerExecutor, saveId: string, eventId: string) {
  return (await tx.execute(sql`SELECT * FROM career_group_bull_playoffs WHERE career_save_id=${saveId} AND event_id=${eventId}
    ORDER BY group_key,tie_key,ordinal`)).rows as BullRow[];
}

/** Same bot adapter and same real bull resolver as live play. Never an ability sort or coin toss. */
async function botTurns(tx: CareerExecutor, root: RootRow, event: InstanceRow, row: BullRow) {
  const keys = [row.a_key, row.b_key];
  const npcs = await loadNpcs(tx, root.id, { ids: keys.filter(k => k !== "HUMAN") });
  const seed = stableUuid(root.world_seed, 1, "group-bull", event.id, row.group_key, row.tie_key, row.ordinal);
  const bots = new Map(npcs.map(n => [n.id, toCareerBotConfig(createPerformance(n,
    { category: event.snapshot.format.matchContext, roundImportance: 1, elimination: true }, root.difficulty,
    scopedRandom(root.world_seed, root.world_generation_version, "performance", SIMULATION_VERSION, seed, n.id)))]));
  for (let guard = 0; guard < 512; guard++) {
    const state = resolveBullUp(0, row.throws);
    if (state.winner !== null) { row.winner_key = keys[state.winner]; break; }
    if (keys[state.nextThrower!] === "HUMAN") break;
    const bot = bots.get(keys[state.nextThrower!]);
    if (!bot) throw new CareerError(409, "Bull playoff participant is missing");
    row.throws.push(botBullThrow(bot.hitAcc, seededRandom(seed, "bull", row.throws.length)));
    row.revision++;
  }
  if (!row.winner_key && keys[resolveBullUp(0, row.throws).nextThrower!] !== "HUMAN")
    throw new CareerError(409, "Bull playoff has not resolved; no fallback winner was awarded");
  await tx.execute(sql`UPDATE career_group_bull_playoffs SET throws=${JSON.stringify(row.throws)}::jsonb,revision=${row.revision},
    winner_key=${row.winner_key},completed_at=CASE WHEN ${row.winner_key}::text IS NOT NULL THEN NOW() END
    WHERE career_save_id=${root.id} AND event_id=${event.id} AND group_key=${row.group_key}
      AND tie_key=${row.tie_key} AND ordinal=${row.ordinal} AND winner_key IS NULL`);
  return row;
}

/** Projection never writes. Completed standings + persisted bull facts determine the qualifiers. */
export function resolvedGroups(matches: MatchRow[], bulls: BullRow[], withdrawn: Set<string>) {
  const qfs=matches.filter(m=>m.stage_key==="knockout"&&m.round===1).sort((a,b)=>a.slot-b.slot);
  const locked=qfs.length===4&&qfs.every(m=>!!m.a_key||!!m.b_key||m.status==="VOID");
  const lockedPairs=locked?[
    [qfs[0].a_key,qfs[2].b_key],[qfs[2].a_key,qfs[0].b_key],
    [qfs[1].a_key,qfs[3].b_key],[qfs[3].a_key,qfs[1].b_key],
  ]:null;
  return GROUP_KEYS.map((group,index) => {
    const table = groupTable(matches, group, locked?new Set():withdrawn);
    if(locked) {
      for(const p of table.buckets.flat())p.withdrawn=withdrawn.has(p.key);
      return {...table,qualifiers:lockedPairs![index].filter((k):k is string=>!!k),pending:null};
    }
    const qualifiers: string[] = [];
    let pending: { group: string; tieKey: string; ordinal: number; pair: [string, string]; row: BullRow | null } | null = null;
    if (table.finished) for (const bucket of table.buckets) {
      if (qualifiers.length >= 2 || bucket[0].withdrawn) break;
      if (bucket.length === 1) { qualifiers.push(bucket[0].key); continue; }
      const keys = bucket.map(p => p.key), tieKey = keys.join(":");
      const results = bulls.filter(b => b.group_key === group && b.tie_key === tieKey);
      const ranking = bullRanking(keys, results, Math.min(2 - qualifiers.length, keys.length));
      qualifiers.push(...ranking.ranked);
      if (ranking.pair) {
        pending = { group, tieKey, ordinal: ranking.ordinal, pair: ranking.pair,
          row: results.find(b => b.ordinal === ranking.ordinal) ?? null }; break;
      }
    }
    return { ...table, qualifiers, pending };
  });
}

/** Called only by A3 writers under its root lock. Qualifiers feed the original stored QF slots once. */
export async function progressGroups(tx: CareerExecutor, root: RootRow, event: InstanceRow, matches: MatchRow[], withdrawn: Set<string>) {
  let changed = false;
  for (let guard = 0; guard < 32; guard++) {
    const groups = resolvedGroups(matches, await loadBulls(tx, root.id, event.id), withdrawn);
    const pending = groups.find(g => g.pending && (!g.pending.row || !g.pending.pair.includes("HUMAN")));
    if (!pending?.pending) break;
    const p = pending.pending;
    await tx.execute(sql`INSERT INTO career_group_bull_playoffs (career_save_id,event_id,group_key,tie_key,ordinal,a_key,b_key)
      VALUES (${root.id},${event.id},${p.group},${p.tieKey},${p.ordinal},${p.pair[0]},${p.pair[1]}) ON CONFLICT DO NOTHING`);
    const row = p.row ?? (await loadBulls(tx, root.id, event.id)).find(b => b.group_key === p.group && b.tie_key === p.tieKey && b.ordinal === p.ordinal)!;
    await botTurns(tx, root, event, row);
    changed = true;
    if (!row.winner_key) break;
  }
  const groups = resolvedGroups(matches, await loadBulls(tx, root.id, event.id), withdrawn);
  if (groups.some(g => !g.finished || g.pending)) return { changed, groups };
  // Cross-group QFs: A1-B2, C1-D2, B1-A2, D1-C2. No reseeding, same-group SFs avoided.
  const q = groups.map(g => g.qualifiers);
  const pairs = [[q[0][0], q[1][1]], [q[2][0], q[3][1]], [q[1][0], q[0][1]], [q[3][0], q[2][1]]];
  for (let i = 0; i < pairs.length; i++) {
    const m = matches.find(m => m.stage_key === "knockout" && m.round === 1 && m.slot === i + 1);
    if (!m) throw new CareerError(409, "Official quarter-final slot is missing");
    const [a, b] = pairs[i].map(k => k ?? null);
    if (m.a_key || m.b_key) {
      if (m.a_key !== a || m.b_key !== b) throw new CareerError(409, "Quarter-final conflicts with actual group qualifiers");
      continue;
    }
    const status = a && b ? "PENDING" : a || b ? "BYE" : "VOID";
    await tx.execute(sql`UPDATE career_tournament_matches SET a_key=${a},b_key=${b},a_npc_id=${a === "HUMAN" ? null : a},
      b_npc_id=${b === "HUMAN" ? null : b},status=${status},winner_key=${status === "BYE" ? a ?? b : null},
      result_source=${status === "BYE" ? "BYE" : null},completed_at=CASE WHEN ${status} IN ('BYE','VOID') THEN NOW() END
      WHERE career_save_id=${root.id} AND id=${m.id} AND status='PENDING' AND a_key IS NULL AND b_key IS NULL`);
    changed = true;
  }
  return { changed, groups };
}

export async function humanGroupBull(tx: CareerExecutor, root: RootRow, event: InstanceRow, matches: MatchRow[],
  withdrawn: Set<string>, group: string, tieKey: string, ordinal: number, revision: number, value: BullThrow) {
  const p = resolvedGroups(matches, await loadBulls(tx, root.id, event.id), withdrawn).find(g => g.key === group)?.pending;
  if (!p || !p.row || p.tieKey !== tieKey || p.ordinal !== ordinal || !p.pair.includes("HUMAN"))
    throw new CareerError(409, "This sporting bull playoff is no longer awaiting you");
  const row = p.row, state = resolveBullUp(0, row.throws);
  if (row.revision !== revision || p.pair[state.nextThrower!] !== "HUMAN") throw new CareerError(409, "Bull playoff changed; refresh before throwing");
  row.throws.push(value); row.revision++;
  return botTurns(tx, root, event, row);
}
