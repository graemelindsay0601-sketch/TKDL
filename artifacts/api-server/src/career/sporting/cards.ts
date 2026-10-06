import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { HUMAN, insertEntitlements, type RootRow } from "../calendar/engine.ts";
import { CALENDAR_GENERATION_VERSION } from "../calendar/config.ts";
import { zoneOf } from "../calendar/geography.ts";
import { BOOTSTRAP_STATUS } from "../calendar/providers.ts";
import { stableUuid } from "../world/random.ts";
import { TOUR_CARD_RULES_V1, PATHWAY_FOR_ZONE } from "./config.ts";
import { recordMilestones, type Milestone } from "./state.ts";

export type CardSource = "FOUNDING" | "Q_SCHOOL_DIRECT" | "Q_SCHOOL_ORDER_OF_MERIT" | "RANKING_RETENTION" | "CHALLENGER_RANKING";
export type CardRow = { id: string; participant_key: string; participant_kind: string; npc_id: string | null; source: CardSource; source_detail: Record<string, unknown>;
  awarded_season: number; awarded_week: number; start_season: number; end_season: number; status: string; end_reason: string | null; previous_card_id: string | null };

/** Participants holding a card valid in `season` (ACTIVE and inside its term). */
export async function cardHoldersIn(tx: CareerExecutor, saveId: string, season: number): Promise<Set<string>> {
  return new Set((await tx.execute(sql`SELECT participant_key FROM career_tour_cards WHERE career_save_id = ${saveId} AND status = 'ACTIVE'
    AND start_season <= ${season} AND end_season >= ${season}`)).rows.map(r => String(r.participant_key)));
}
export async function activeCard(tx: CareerExecutor, saveId: string, participant: string): Promise<CardRow | null> {
  return ((await tx.execute(sql`SELECT * FROM career_tour_cards WHERE career_save_id = ${saveId} AND participant_key = ${participant} AND status = 'ACTIVE'`)).rows[0] as CardRow | undefined) ?? null;
}

export type CardAward = { operationKey: string; participantKey: string; participantKind: string; npcId: string | null; source: CardSource; detail: Record<string, unknown>;
  sourceEventId?: string | null; season: number; week: number; startSeason: number; endSeason: number; previousCardId?: string | null };

/**
 * Award a Tour Card. Idempotent per operation key; refuses to create a second
 * live card for a participant (also enforced by a partial unique index). Returns
 * the persisted card (existing on retry) or null when the participant already
 * holds a different live card.
 */
export async function awardCard(tx: CareerExecutor, root: RootRow, rulesVersion: number, award: CardAward): Promise<{ card: CardRow; created: boolean } | null> {
  const existing = (await tx.execute(sql`SELECT * FROM career_tour_cards WHERE career_save_id = ${root.id} AND operation_key = ${award.operationKey}`)).rows[0] as CardRow | undefined;
  if (existing) {
    if (existing.participant_key !== award.participantKey || existing.source !== award.source) throw new Error("Tour Card operation identity reused with different inputs");
    return { card: existing, created: false };
  }
  if (await activeCard(tx, root.id, award.participantKey)) return null;
  const id = stableUuid(root.world_seed, rulesVersion, "tour-card", root.id, award.operationKey);
  const card = (await tx.execute(sql`INSERT INTO career_tour_cards (career_save_id, id, operation_key, participant_key, participant_kind, npc_id, source, source_detail, source_event_id,
      awarded_season, awarded_week, start_season, end_season, status, previous_card_id, tour_card_rules_version)
    VALUES (${root.id}, ${id}, ${award.operationKey}, ${award.participantKey}, ${award.participantKind}, ${award.npcId}, ${award.source}, ${JSON.stringify(award.detail)}::jsonb,
      ${award.sourceEventId ?? null}, ${award.season}, ${award.week}, ${award.startSeason}, ${award.endSeason}, 'ACTIVE', ${award.previousCardId ?? null}, ${rulesVersion})
    RETURNING *`)).rows[0] as CardRow;
  if (award.source !== "FOUNDING") {
    const prior = (await tx.execute(sql`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status IN ('LOST','SURRENDERED') OR end_reason = 'TERM_COMPLETED')::int AS gone
      FROM career_tour_cards WHERE career_save_id = ${root.id} AND participant_key = ${award.participantKey} AND id <> ${id}`)).rows[0];
    const kind = award.source === "RANKING_RETENTION" ? "TOUR_CARD_RETAINED" : Number(prior.n) === 0 ? "TOUR_CARD_WON" : Number(prior.gone) > 0 ? "TOUR_CARD_REGAINED" : "TOUR_CARD_WON";
    await recordMilestones(tx, root, [{ operationKey: `card:${id}:${kind}`, participantKey: award.participantKey, participantKind: award.participantKind, npcId: award.npcId,
      kind, season: award.season, week: award.week, detail: { cardId: id, source: award.source, startSeason: award.startSeason, endSeason: award.endSeason, ...award.detail } }]);
  }
  return { card, created: true };
}

export async function endCard(tx: CareerExecutor, root: RootRow, card: CardRow, status: "EXPIRED" | "LOST" | "SURRENDERED", reason: string, season: number, week: number, detail: Record<string, unknown> = {}) {
  const updated = await tx.execute(sql`UPDATE career_tour_cards SET status = ${status}, end_reason = ${reason}, ended_season = ${season}, ended_week = ${week}
    WHERE career_save_id = ${root.id} AND id = ${card.id} AND status = 'ACTIVE' RETURNING id`);
  if (!updated.rows.length) return false;
  const kind = status === "LOST" ? "TOUR_CARD_LOST" : status === "SURRENDERED" ? "TOUR_CARD_SURRENDERED" : null;
  if (kind) await recordMilestones(tx, root, [{ operationKey: `card:${card.id}:${kind}`, participantKey: card.participant_key, participantKind: card.participant_kind, npcId: card.npc_id,
    kind, season, week, detail: { cardId: card.id, reason, ...detail } }]);
  return true;
}

/** A1 display caches follow A5 truth (has_tour_card is no longer an authority). */
export async function syncHumanCardCache(tx: CareerExecutor, root: RootRow, season: number) {
  const holds = (await cardHoldersIn(tx, root.id, season)).has(HUMAN);
  await tx.execute(sql`UPDATE career_saves SET has_tour_card = ${holds} WHERE id = ${root.id} AND has_tour_card IS DISTINCT FROM ${holds}`);
  root.has_tour_card = holds;
}

/**
 * Founding members: NPC professionals already on tour when the world is created.
 * Their terms are mid-way (end this season or next, by a neutral hash) so the
 * first card review happens naturally. The human never receives a founding card.
 */
export async function issueFoundingCards(tx: CareerExecutor, root: RootRow, rulesVersion: number) {
  const season = Number(root.current_season), week = Number(root.current_week);
  const pros = (await tx.execute(sql`SELECT id FROM career_world_players WHERE career_save_id = ${root.id} AND status = 'ACTIVE' AND professional_status = 'PROFESSIONAL' ORDER BY world_key`)).rows;
  const ends = TOUR_CARD_RULES_V1.founding.endSeasons;
  let issued = 0;
  for (const p of pros) {
    const npcId = String(p.id);
    const offset = ends[parseInt(stableUuid(root.world_seed, rulesVersion, "founding-card-term", npcId).slice(0, 8), 16) % ends.length];
    const result = await awardCard(tx, root, rulesVersion, { operationKey: `founding:${npcId}`, participantKey: npcId, participantKind: "NPC", npcId, source: "FOUNDING",
      detail: { reason: "Existing professional when the Career world was generated" }, season, week, startSeason: season, endSeason: season + offset - 1 });
    if (result?.created) issued++;
  }
  return issued;
}

/**
 * Season review at the end of season S (after the final ranking publication):
 *  1. cards ending in S: holders inside the retention cut of the season-end World
 *     Ranking renew (new RANKING_RETENTION card for S+1..S+2); everyone else LOSES the card;
 *  2. Challenger ranking cards for the top finishers without a card for S+1 (next eligible);
 *  3. Q-School Final Stage exemptions for S+1 (card losers + Challenger places) as A3 provider entitlements.
 * Idempotent via career_sporting_state.reviewed_season plus per-card operation keys.
 */
export async function seasonReview(tx: CareerExecutor, root: RootRow, rulesVersion: number, season: number) {
  const state = (await tx.execute(sql`SELECT reviewed_season FROM career_sporting_state WHERE career_save_id = ${root.id} FOR UPDATE`)).rows[0];
  if (!state || Number(state.reviewed_season) >= season) return null;
  const rules = TOUR_CARD_RULES_V1, week = 52;
  const position = async (list: string) => new Map((await tx.execute(sql`SELECT participant_key, current_position FROM career_ranking_participants
    WHERE career_save_id = ${root.id} AND list_key = ${list} AND current_position IS NOT NULL`)).rows.map(r => [String(r.participant_key), Number(r.current_position)]));
  const world = await position(rules.retention.list);
  const summary = { season, retained: 0, lost: 0, challengerCards: 0, exemptions: 0 };
  const losers: CardRow[] = [];
  const expiring = (await tx.execute(sql`SELECT * FROM career_tour_cards WHERE career_save_id = ${root.id} AND status = 'ACTIVE' AND end_season <= ${season}
    ORDER BY participant_key`)).rows as CardRow[];
  for (const card of expiring) {
    const rank = world.get(card.participant_key) ?? null;
    if (rank !== null && rank <= rules.retention.maxPosition) {
      await endCard(tx, root, card, "EXPIRED", "TERM_COMPLETED_RETAINED", season, week, { worldRanking: rank });
      await awardCard(tx, root, rulesVersion, { operationKey: `retention:${season}:${card.participant_key}`, participantKey: card.participant_key, participantKind: card.participant_kind,
        npcId: card.npc_id, source: "RANKING_RETENTION", detail: { list: rules.retention.list, position: rank, cut: rules.retention.maxPosition }, season, week,
        startSeason: season + 1, endSeason: season + rules.termSeasons, previousCardId: card.id });
      summary.retained++;
    } else {
      await endCard(tx, root, card, "LOST", "OUTSIDE_RETENTION_CUT", season, week, { worldRanking: rank, cut: rules.retention.maxPosition });
      losers.push(card); summary.lost++;
    }
  }
  const holdersNext = await cardHoldersIn(tx, root.id, season + 1);
  const challenger = [...(await position(rules.challengerCards.list)).entries()].sort((a, b) => a[1] - b[1]);
  const kinds = new Map((await tx.execute(sql`SELECT participant_key, participant_kind, npc_id FROM career_ranking_participants WHERE career_save_id = ${root.id} AND list_key = ${rules.challengerCards.list}`)).rows
    .map(r => [String(r.participant_key), { kind: String(r.participant_kind), npc: r.npc_id ? String(r.npc_id) : null }]));
  for (const [participant, rank] of challenger) {
    if (summary.challengerCards >= rules.challengerCards.count) break;
    if (holdersNext.has(participant)) continue;
    const who = kinds.get(participant)!;
    const result = await awardCard(tx, root, rulesVersion, { operationKey: `challenger:${season}:${participant}`, participantKey: participant, participantKind: who.kind, npcId: who.npc,
      source: "CHALLENGER_RANKING", detail: { list: rules.challengerCards.list, position: rank }, season, week, startSeason: season + 1, endSeason: season + rules.termSeasons });
    if (result) { holdersNext.add(participant); summary.challengerCards++; }
  }
  // Q-School Final Stage exemptions (A3 entitlement model, provider-issued).
  const [from, to] = rules.qSchoolExemptions.challengerPositions;
  const exempt = new Map<string, { kind: string; npc: string | null; reason: string; detail: Record<string, unknown> }>();
  if (rules.qSchoolExemptions.cardLosers) for (const c of losers) exempt.set(c.participant_key, { kind: c.participant_kind, npc: c.npc_id, reason: "TOUR_CARD_LOST", detail: { cardId: c.id } });
  for (const [participant, rank] of challenger) if (rank >= from && rank <= to && !exempt.has(participant)) {
    const who = kinds.get(participant)!; exempt.set(participant, { kind: who.kind, npc: who.npc, reason: "CHALLENGER_RANKING", detail: { position: rank } });
  }
  const grants: Record<string, unknown>[] = [];
  if (exempt.size) {
    const npcIds = [...exempt.values()].filter(e => e.npc).map(e => e.npc!);
    const nationality = new Map(npcIds.length ? (await tx.execute(sql`SELECT id, nationality, status FROM career_world_players WHERE career_save_id = ${root.id}
      AND id IN (${sql.join(npcIds.map(id => sql`${id}::uuid`), sql`, `)})`)).rows.map(r => [String(r.id), String(r.nationality)]) : []);
    for (const [participant, e] of exempt) {
      if (holdersNext.has(participant)) continue;
      const country = e.npc ? nationality.get(e.npc)! : BOOTSTRAP_STATUS.human(root).country;
      const pathway = PATHWAY_FOR_ZONE[zoneOf(country)];
      const idempotency = `provider:a5-q-school-exemption:${season + 1}:${participant}`;
      grants.push({ id: stableUuid(root.world_seed, CALENDAR_GENERATION_VERSION, "entitlement", idempotency), idempotency_key: idempotency, recipient_key: participant,
        recipient_kind: e.kind, npc_id: e.npc, entitlement_type: "STAGE_ENTRY", source_event_id: null, source_position: null,
        source_detail: { providerId: "A5_SPORTING", reason: e.reason, pathway, ...e.detail }, target_key: `q-school-final:${pathway}`, target_season: season + 1, consumption: "SEASON_PASS" });
    }
    if (grants.length) await insertEntitlements(tx, root.id, season, grants, "PROVIDER");
    summary.exemptions = grants.length;
  }
  await tx.execute(sql`UPDATE career_sporting_state SET reviewed_season = ${season} WHERE career_save_id = ${root.id}`);
  await syncHumanCardCache(tx, root, season);
  return summary;
}

/**
 * Retirement (A2 off-season retires NPCs): a retired NPC surrenders any live card.
 * Historical contributions, snapshots and cards are preserved; the next ranking
 * publication (forced at season start) no longer lists them as active participants.
 */
export async function processRetirements(tx: CareerExecutor, root: RootRow, season: number, week: number) {
  const cards = (await tx.execute(sql`SELECT c.* FROM career_tour_cards c JOIN career_world_players p ON p.career_save_id = c.career_save_id AND p.id = c.npc_id
    WHERE c.career_save_id = ${root.id} AND c.status = 'ACTIVE' AND p.status = 'RETIRED' ORDER BY c.participant_key`)).rows as CardRow[];
  for (const card of cards) await endCard(tx, root, card, "SURRENDERED", "RETIRED", season, week);
  return cards.length;
}
export type { Milestone };
