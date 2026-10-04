import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import type { InstanceRow, RootRow } from "../calendar/engine.ts";
import type { SportingResult } from "../calendar/providers.ts";
import { HUMAN } from "../calendar/engine.ts";
import { stableUuid } from "../world/random.ts";
import { prizeForPosition, type PrizeProfile } from "../finance/config.ts";
import { rankingListsFor, expiresIndex, timeIndex, type RankingListDefinition } from "./config.ts";
import { recordMilestones, type Milestone } from "./state.ts";

/**
 * Ranking contributions: one immutable row per (list, event, participant) for
 * every positive ranking-eligible amount. The amount is A4's, never A5's:
 *  - human: career_prize_awards.ranking_eligible_pence (A4 award row);
 *  - NPCs: the A4 immutable prize table band at the finishing position, only when
 *    the table is ranking-eligible (classification RANKING; Specials/exhibitions/qualifiers are not).
 * Both resolve through the same persisted bands; the human figure is cross-checked
 * against the table so the two paths can never diverge (no human favour).
 */
export async function recordRankingContributions(tx: CareerExecutor, root: RootRow, rulesVersion: number, event: InstanceRow, results: readonly SportingResult[]) {
  if (event.classification !== "RANKING" || !event.ranking_category) return 0;
  const lists = rankingListsFor(rulesVersion).filter(l => l.categories.includes(event.ranking_category!));
  if (!lists.length) return 0;
  const table = (await tx.execute(sql`SELECT ranking_eligible, bands, prize_profile_key FROM career_event_prize_tables WHERE career_save_id = ${root.id} AND event_id = ${event.id}`)).rows[0];
  if (!table) throw new Error(`A4 prize table missing for ${event.id}: A5 ranking money must come from A4 prize facts`);
  if (table.ranking_eligible !== true) return 0;
  const bands = { key: String(table.prize_profile_key), bands: table.bands } as PrizeProfile;
  const award = (await tx.execute(sql`SELECT ranking_eligible_pence FROM career_prize_awards WHERE career_save_id = ${root.id} AND event_id = ${event.id} AND participant_key = ${HUMAN}`)).rows[0];
  const completion = timeIndex(Number(root.current_season), Number(root.current_week));
  const rows: Record<string, unknown>[] = [];
  for (const r of results) {
    const fromTable = prizeForPosition(bands, r.finishing_position);
    let amount = fromTable, source = "A4_PRIZE_TABLE";
    if (r.participant_key === HUMAN && award) {
      amount = Number(award.ranking_eligible_pence); source = "A4_PRIZE_AWARD";
      if (amount !== fromTable) throw new Error("A4 human ranking-eligible award disagrees with the immutable prize table");
    }
    if (amount <= 0) continue;
    for (const list of lists) rows.push({ id: stableUuid(root.world_seed, rulesVersion, "ranking-contribution", root.id, list.key, event.id, r.participant_key), list_key: list.key,
      participant_key: r.participant_key, participant_kind: r.participant_kind, npc_id: r.npc_id, finishing_position: r.finishing_position, amount_pence: amount, source,
      expires_index: expiresIndex(list.window, completion) });
  }
  if (!rows.length) return 0;
  await tx.execute(sql`INSERT INTO career_ranking_contributions (career_save_id, id, list_key, participant_key, participant_kind, npc_id, event_id, season, week, completion_index,
      expires_index, finishing_position, amount_pence, source, ranking_category, ranking_rules_version)
    SELECT ${root.id}::uuid, c.id, c.list_key, c.participant_key, c.participant_kind, c.npc_id, ${event.id}::uuid, ${event.season}, ${Number(root.current_week)}, ${completion},
      c.expires_index, c.finishing_position, c.amount_pence, c.source, ${event.ranking_category}, ${rulesVersion}
    FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS c(id uuid, list_key text, participant_key text, participant_kind text, npc_id uuid, finishing_position integer,
      amount_pence bigint, source text, expires_index integer)
    ON CONFLICT (career_save_id, list_key, event_id, participant_key) DO NOTHING`);
  return rows.length;
}

type Standing = { participant_key: string; participant_kind: string; npc_id: string | null; value: number; best: number; latest: number; n: number; tie: string };
/** Documented tie-break hierarchy (config RANKING_TIE_BREAKS). Pure; identical for every participant. */
export function compareStandings(a: Standing, b: Standing) {
  return b.value - a.value || b.best - a.best || b.latest - a.latest || a.n - b.n || (a.tie < b.tie ? -1 : a.tie > b.tie ? 1 : 0);
}
export const tieKey = (seed: string, rulesVersion: number, list: string, participant: string) => stableUuid(seed, rulesVersion, "ranking-tiebreak", list, participant);

/** Counting standings for a list at publication index P (retired NPCs are not active ranking participants). */
export async function standingsAt(tx: CareerExecutor, root: RootRow, rulesVersion: number, list: string, publication: number): Promise<Standing[]> {
  const rows = (await tx.execute(sql`SELECT c.participant_key, c.participant_kind, c.npc_id, SUM(c.amount_pence)::bigint AS value, MAX(c.amount_pence)::bigint AS best,
      MAX(c.completion_index)::int AS latest, COUNT(*)::int AS n
    FROM career_ranking_contributions c LEFT JOIN career_world_players p ON p.career_save_id = c.career_save_id AND p.id = c.npc_id
    WHERE c.career_save_id = ${root.id} AND c.list_key = ${list} AND c.completion_index <= ${publication} AND c.expires_index > ${publication}
      AND (c.npc_id IS NULL OR p.status = 'ACTIVE')
    GROUP BY c.participant_key, c.participant_kind, c.npc_id`)).rows;
  return rows.map(r => ({ participant_key: String(r.participant_key), participant_kind: String(r.participant_kind), npc_id: r.npc_id ? String(r.npc_id) : null,
    value: Number(r.value), best: Number(r.best), latest: Number(r.latest), n: Number(r.n), tie: tieKey(root.world_seed, rulesVersion, list, String(r.participant_key)) }))
    .sort(compareStandings);
}

/**
 * Publish rankings for the week just played (publication index P). Per list, a
 * snapshot is written only when something changed since the last publication
 * (new contributions, expiries) or when forced (season start / retirements).
 * Idempotent: one snapshot per (list, P). Historical snapshots are never touched.
 */
export async function publishRankings(tx: CareerExecutor, root: RootRow, rulesVersion: number, season: number, week: number, force: boolean) {
  const P = timeIndex(season, week);
  const published: string[] = [];
  for (const list of rankingListsFor(rulesVersion)) {
    if ((await tx.execute(sql`SELECT 1 FROM career_ranking_snapshots WHERE career_save_id = ${root.id} AND list_key = ${list.key} AND publication_index = ${P}`)).rows.length) continue;
    const last = (await tx.execute(sql`SELECT sequence, publication_index FROM career_ranking_snapshots WHERE career_save_id = ${root.id} AND list_key = ${list.key}
      ORDER BY sequence DESC LIMIT 1`)).rows[0];
    const lastP = last ? Number(last.publication_index) : 0;
    const changes = (await tx.execute(sql`SELECT COUNT(*) FILTER (WHERE completion_index > ${lastP} AND completion_index <= ${P})::int AS added,
        COUNT(*) FILTER (WHERE expires_index > ${lastP} AND expires_index <= ${P} AND completion_index <= ${lastP})::int AS expired
      FROM career_ranking_contributions WHERE career_save_id = ${root.id} AND list_key = ${list.key} AND (completion_index > ${lastP} OR expires_index > ${lastP})`)).rows[0];
    const added = Number(changes.added), expired = Number(changes.expired);
    if (!added && !expired && !(force && last)) continue;
    await publishList(tx, root, rulesVersion, list, season, week, P, (last ? Number(last.sequence) : 0) + 1, added, expired, added || expired ? "RESULTS" : "SEASON_REVIEW");
    published.push(list.key);
  }
  return published;
}

async function publishList(tx: CareerExecutor, root: RootRow, rulesVersion: number, list: RankingListDefinition, season: number, week: number, P: number, sequence: number, added: number, expired: number, reason: string) {
  const standings = await standingsAt(tx, root, rulesVersion, list.key, P);
  const cache = new Map((await tx.execute(sql`SELECT participant_key, participant_kind, npc_id, current_position, career_high_position, first_ranked_index
    FROM career_ranking_participants WHERE career_save_id = ${root.id} AND list_key = ${list.key}`)).rows.map(r => [String(r.participant_key), r]));
  const snapshotId = stableUuid(root.world_seed, rulesVersion, "ranking-snapshot", root.id, list.key, P);
  const ranked = new Set(standings.map(s => s.participant_key));
  const removedRetired = [...cache.values()].filter(r => r.current_position !== null && !ranked.has(String(r.participant_key)) && r.npc_id).length;
  const rows = standings.map((s, i) => {
    const prior = cache.get(s.participant_key);
    const previous = prior?.current_position === null || prior?.current_position === undefined ? null : Number(prior.current_position);
    const position = i + 1;
    const careerHigh = Math.min(prior ? Number(prior.career_high_position) : Number.MAX_SAFE_INTEGER, position);
    return { participant_key: s.participant_key, participant_kind: s.participant_kind, npc_id: s.npc_id, position, value_pence: s.value,
      previous_position: previous, movement: previous === null ? null : previous - position, is_new: previous === null,
      gap_above_pence: i > 0 ? standings[i - 1].value - s.value : null, gap_below_pence: i < standings.length - 1 ? s.value - standings[i + 1].value : null,
      career_high_position: careerHigh, counted_contributions: s.n,
      prior_high: prior ? Number(prior.career_high_position) : null, first_ranked_index: prior ? Number(prior.first_ranked_index) : P };
  });
  const cutValues = Object.fromEntries(list.cutLines.map(line => [String(line), standings[line - 1]?.value ?? null]));
  await tx.execute(sql`INSERT INTO career_ranking_snapshots (career_save_id, id, list_key, sequence, season, week, publication_index, ranking_rules_version, participant_count,
      counted_contributions, new_contributions, expired_contributions, removed_retired, cut_values, reason)
    VALUES (${root.id}, ${snapshotId}, ${list.key}, ${sequence}, ${season}, ${week}, ${P}, ${rulesVersion}, ${standings.length},
      ${standings.reduce((t, s) => t + s.n, 0)}, ${added}, ${expired}, ${removedRetired}, ${JSON.stringify(cutValues)}::jsonb, ${reason})`);
  for (let i = 0; i < rows.length; i += 500) {
    await tx.execute(sql`INSERT INTO career_ranking_snapshot_rows (career_save_id, snapshot_id, list_key, publication_index, season, participant_key, participant_kind, npc_id,
        position, value_pence, previous_position, movement, is_new, gap_above_pence, gap_below_pence, career_high_position, counted_contributions)
      SELECT ${root.id}::uuid, ${snapshotId}::uuid, ${list.key}, ${P}, ${season}, r.participant_key, r.participant_kind, r.npc_id, r.position, r.value_pence, r.previous_position,
        r.movement, r.is_new, r.gap_above_pence, r.gap_below_pence, r.career_high_position, r.counted_contributions
      FROM jsonb_to_recordset(${JSON.stringify(rows.slice(i, i + 500))}::jsonb) AS r(participant_key text, participant_kind text, npc_id uuid, position integer, value_pence bigint,
        previous_position integer, movement integer, is_new boolean, gap_above_pence bigint, gap_below_pence bigint, career_high_position integer, counted_contributions integer)`);
  }
  // Derivable cache = this snapshot. Dropped participants keep their history (career high, first ranked).
  await tx.execute(sql`UPDATE career_ranking_participants SET previous_position = current_position, current_position = NULL, current_value_pence = 0, updated_index = ${P}
    WHERE career_save_id = ${root.id} AND list_key = ${list.key} AND current_position IS NOT NULL`);
  if (rows.length) {
    await tx.execute(sql`INSERT INTO career_ranking_participants (career_save_id, list_key, participant_key, participant_kind, npc_id, current_position, current_value_pence,
        previous_position, career_high_position, career_high_index, first_ranked_index, updated_index)
      SELECT ${root.id}::uuid, ${list.key}, r.participant_key, r.participant_kind, r.npc_id, r.position, r.value_pence, r.previous_position, r.career_high_position,
        ${P}, r.first_ranked_index, ${P}
      FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS r(participant_key text, participant_kind text, npc_id uuid, position integer, value_pence bigint, previous_position integer,
        career_high_position integer, first_ranked_index integer)
      ON CONFLICT (career_save_id, list_key, participant_key) DO UPDATE SET current_position = EXCLUDED.current_position, current_value_pence = EXCLUDED.current_value_pence,
        previous_position = EXCLUDED.previous_position,
        career_high_index = CASE WHEN EXCLUDED.career_high_position < career_ranking_participants.career_high_position THEN ${P} ELSE career_ranking_participants.career_high_index END,
        career_high_position = LEAST(career_ranking_participants.career_high_position, EXCLUDED.career_high_position), updated_index = ${P}`);
  }
  // Factual milestones from authoritative movement (same rules for everyone; career-high trail kept for the human).
  const milestones: Milestone[] = [];
  for (const r of rows) {
    const base = { participantKey: r.participant_key, participantKind: r.participant_kind, npcId: r.npc_id, listKey: list.key, season, week };
    if (r.prior_high === null) milestones.push({ ...base, operationKey: `rank:${list.key}:first:${r.participant_key}`, kind: "FIRST_RANKING_ENTRY", detail: { position: r.position, valuePence: r.value_pence } });
    for (const t of list.milestoneThresholds) {
      if (r.position <= t && (r.prior_high === null || r.prior_high > t)) milestones.push({ ...base, operationKey: `rank:${list.key}:top${t}:${r.participant_key}`,
        kind: t === 1 ? (list.key === "pro-world" ? "WORLD_NUMBER_ONE" : "RANKING_NUMBER_ONE") : `ENTERED_TOP_${t}`, detail: { position: r.position, valuePence: r.value_pence } });
    }
    if (r.participant_key === HUMAN && (r.prior_high === null || r.position < r.prior_high))
      milestones.push({ ...base, operationKey: `rank:${list.key}:high:${r.position}:${r.participant_key}`, kind: "CAREER_HIGH_RANK", detail: { position: r.position, previousHigh: r.prior_high } });
  }
  await recordMilestones(tx, root, milestones);
  if (list.key === "pro-world") {
    const mine = rows.find(r => r.participant_key === HUMAN);
    // A1 display caches: the human's current World Ranking money and position (A6 save slots read these).
    await tx.execute(sql`UPDATE career_saves SET professional_ranking_money_pence = ${mine?.value_pence ?? 0}, professional_ranking = ${mine?.position ?? null} WHERE id = ${root.id}`);
  }
}

/** Current published positions for every participant (bound into A3 eligibility/seeding). */
export async function currentPositions(tx: CareerExecutor, saveId: string): Promise<Map<string, Record<string, number>>> {
  const map = new Map<string, Record<string, number>>();
  for (const r of (await tx.execute(sql`SELECT list_key, participant_key, current_position FROM career_ranking_participants
    WHERE career_save_id = ${saveId} AND current_position IS NOT NULL`)).rows) {
    const key = String(r.participant_key);
    if (!map.has(key)) map.set(key, {});
    map.get(key)![String(r.list_key)] = Number(r.current_position);
  }
  return map;
}
