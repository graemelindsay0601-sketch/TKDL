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
import { VAULT_LAYOUT, bullRanking, groupStage, groupTable, layoutFor, type GroupLayout } from "./groups.ts";
import { CALENDAR_GENERATION_VERSION } from "./config.ts";

export type BullRow = {
  group_key: string; tie_key: string; ordinal: number; a_key: string; b_key: string;
  throws: BullThrow[]; revision: number; winner_key: string | null;
};
export const tournamentDay = (e: InstanceRow, phase: number, count: number) =>
  e.start_day + Math.floor((phase - 1) * (e.end_day - e.start_day + 1) / count);

/** League nights: round r is played on the r-th weekly night; the play-offs on the last night. */
export const leagueNight = (e: Pick<InstanceRow, "start_day">, night: number) => e.start_day + 7 * (night - 1);
/** Every day a grouped event is actually played: weekly nights for a league, every day otherwise. */
export function playingDays(e: Pick<InstanceRow, "start_day" | "end_day" | "snapshot">): number[] {
  const all = Array.from({ length: e.end_day - e.start_day + 1 }, (_, i) => e.start_day + i);
  return e.snapshot.format.structure === "LEAGUE" ? all.filter(d => (d - e.start_day) % 7 === 0) : all;
}

export function makeGroupRows(root: RootRow, event: InstanceRow, positions: (string | null)[], layout: GroupLayout = VAULT_LAYOUT) {
  const entrants = layout.keys.length * layout.size;
  if (positions.length !== entrants || positions.some(k => !k) || new Set(positions).size !== entrants)
    throw new CareerError(409, layout.kind === "LEAGUE" ? "A league requires eight real confirmed entrants"
      : layout.kind === "WORLD_CUP" ? "World Cup group stage requires thirty-six real confirmed pairs" : "Vault requires sixteen real confirmed entrants");
  const day = (r: number) => layout.kind === "LEAGUE" ? leagueNight(event, r + 1)
    : layout.kind === "WORLD_CUP" ? event.start_day + (r === 0 ? 0 : 1) : tournamentDay(event, r + 1, 6);
  return layout.keys.flatMap((group, g) => layout.schedule.flatMap((pairs, r) => pairs.map(([a, b], s) => ({
    id: stableUuid(root.world_seed, CALENDAR_GENERATION_VERSION, "tournament-match", event.id, groupStage(group), r + 1, s + 1),
    stage_key: groupStage(group), round: r + 1, slot: s + 1, best_of: event.snapshot.format.stages[0].bestOfByRound[0],
    scheduled_day: day(r), a_key: positions[g * layout.size + a], b_key: positions[g * layout.size + b],
    a_npc_id: positions[g * layout.size + a] === "HUMAN" ? null : positions[g * layout.size + a],
    b_npc_id: positions[g * layout.size + b] === "HUMAN" ? null : positions[g * layout.size + b],
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
export function resolvedGroups(matches: MatchRow[], bulls: BullRow[], withdrawn: Set<string>, layout: GroupLayout = VAULT_LAYOUT) {
  const qfs=matches.filter(m=>m.stage_key==="knockout"&&m.round===1).sort((a,b)=>a.slot-b.slot);
  const firstRound = layout.kind === "LEAGUE" ? 2 : layout.kind === "WORLD_CUP" ? 8 : 4;
  const locked=qfs.length===firstRound&&qfs.every(m=>layout.kind === "WORLD_CUP"
    ? (!!m.a_key&&!!m.b_key)||["VOID","BYE","WALKOVER","COMPLETED"].includes(m.status)
    : !!m.a_key||!!m.b_key||m.status==="VOID");
  // League semi-finals: 1st v 4th (slot 1), 2nd v 3rd (slot 2); qualifiers are recorded in table order.
  const lockedPairs=locked?(layout.kind === "LEAGUE" ? [[qfs[0].a_key,qfs[1].a_key,qfs[1].b_key,qfs[0].b_key]] : [
    [qfs[0].a_key,qfs[2].b_key],[qfs[2].a_key,qfs[0].b_key],
    [qfs[1].a_key,qfs[3].b_key],[qfs[3].a_key,qfs[1].b_key],
  ]):null;
  return layout.keys.map((group,index) => {
    const table = groupTable(matches, group, locked?new Set():withdrawn, layout);
    if(locked) {
      for(const p of table.buckets.flat())p.withdrawn=withdrawn.has(p.key);
      if (layout.kind === "WORLD_CUP")
        return {...table,qualifiers:table.buckets.slice(0,1).flatMap(bucket=>bucket.map(p=>p.key)),pending:null};
      return {...table,qualifiers:lockedPairs![index].filter((k):k is string=>!!k),pending:null};
    }
    const qualifiers: string[] = [];
    let pending: { group: string; tieKey: string; ordinal: number; pair: [string, string]; row: BullRow | null } | null = null;
    if (table.finished) for (const bucket of table.buckets) {
      if (qualifiers.length >= layout.qualifiers || bucket[0].withdrawn) break;
      if (bucket.length === 1) { qualifiers.push(bucket[0].key); continue; }
      const keys = bucket.map(p => p.key), tieKey = keys.join(":");
      const results = bulls.filter(b => b.group_key === group && b.tie_key === tieKey);
      const ranking = bullRanking(keys, results, Math.min(layout.qualifiers - qualifiers.length, keys.length));
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
export async function progressGroups(tx: CareerExecutor, root: RootRow, event: InstanceRow, matches: MatchRow[], withdrawn: Set<string>, layout: GroupLayout = VAULT_LAYOUT) {
  let changed = false;
  for (let guard = 0; guard < 32; guard++) {
    const groups = resolvedGroups(matches, await loadBulls(tx, root.id, event.id), withdrawn, layout);
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
  const groups = resolvedGroups(matches, await loadBulls(tx, root.id, event.id), withdrawn, layout);
  if (groups.some(g => !g.finished || g.pending)) return { changed, groups };
  // Vault: cross-group QFs A1-B2, C1-D2, B1-A2, D1-C2 (no reseeding, same-group SFs avoided).
  // League: semi-finals 1st v 4th and 2nd v 3rd.
  const q = groups.map(g => g.qualifiers);
  if (layout.kind === "WORLD_CUP") {
    let drawChanged = false;
    const winners = q.flat();
    const firstRound = matches.filter(m => m.stage_key === "knockout" && m.round === 1).sort((a, b) => a.slot - b.slot);
    const seeds = firstRound.slice(0, 4).map(m => m.a_key);
    if (seeds.length !== 4 || seeds.some(k => !k) || winners.length !== 12 || firstRound.length !== 8)
      throw new CareerError(409, "World Cup knockout draw does not have four seeds and twelve group winners");
    const rng = scopedRandom(root.world_seed, CALENDAR_GENERATION_VERSION, "world-cup-knockout-draw", event.season, event.instance_key);
    const remaining = [...winners];
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }
    const pairings: [string, string][] = [
      ...seeds.map((seed, i) => [seed!, remaining[i]] as [string, string]),
      ...Array.from({length: 4}, (_, i) => [remaining[4 + i * 2], remaining[5 + i * 2]] as [string, string]),
    ];
    for (let i = 0; i < pairings.length; i++) {
      const m = firstRound[i], [a, b] = pairings[i];
      if ((m.a_key && m.a_key !== a) || (m.b_key && m.b_key !== b))
        throw new CareerError(409, "World Cup knockout slot conflicts with the group draw");
      if (m.a_key === a && m.b_key === b) continue;
      await tx.execute(sql`UPDATE career_tournament_matches SET a_key=${a},b_key=${b},a_npc_id=${a==="HUMAN"?null:a},
        b_npc_id=${b==="HUMAN"?null:b},status='PENDING'
        WHERE career_save_id=${root.id} AND id=${m.id} AND status='PENDING'
          AND (a_key IS NULL OR a_key=${a}) AND (b_key IS NULL OR b_key=${b})`);
      drawChanged = true;
    }
    return {changed: changed || drawChanged,groups};
  }
  const pairs = layout.kind === "LEAGUE" ? [[q[0][0], q[0][3]], [q[0][1], q[0][2]]]
    : [[q[0][0], q[1][1]], [q[2][0], q[3][1]], [q[1][0], q[0][1]], [q[3][0], q[2][1]]];
  for (let i = 0; i < pairs.length; i++) {
    const m = matches.find(m => m.stage_key === "knockout" && m.round === 1 && m.slot === i + 1);
    if (!m) throw new CareerError(409, layout.kind === "LEAGUE" ? "Official semi-final slot is missing" : "Official quarter-final slot is missing");
    const [a, b] = pairs[i].map(k => k ?? null);
    if (m.a_key || m.b_key) {
      if (m.a_key !== a || m.b_key !== b) throw new CareerError(409, "Knockout slot conflicts with actual group qualifiers");
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
  const p = resolvedGroups(matches, await loadBulls(tx, root.id, event.id), withdrawn, layoutFor(event.snapshot.format.structure)).find(g => g.key === group)?.pending;
  if (!p || !p.row || p.tieKey !== tieKey || p.ordinal !== ordinal || !p.pair.includes("HUMAN"))
    throw new CareerError(409, "This sporting bull playoff is no longer awaiting you");
  const row = p.row, state = resolveBullUp(0, row.throws);
  if (row.revision !== revision || p.pair[state.nextThrower!] !== "HUMAN") throw new CareerError(409, "Bull playoff changed; refresh before throwing");
  row.throws.push(value); row.revision++;
  return botTurns(tx, root, event, row);
}
