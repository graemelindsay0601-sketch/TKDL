import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { HUMAN, insertEntitlements, type RootRow } from "../calendar/engine.ts";
import { CALENDAR_GENERATION_VERSION } from "../calendar/config.ts";
import { zoneOf } from "../calendar/geography.ts";
import { BOOTSTRAP_STATUS } from "../calendar/providers.ts";
import { stableUuid } from "../world/random.ts";
import { TOUR_CARD_RULES_V1, PATHWAY_FOR_ZONE, tourCardRulesFor } from "./config.ts";
import { recordMilestones, type Milestone } from "./state.ts";

export type CardSource = "FOUNDING" | "Q_SCHOOL_DIRECT" | "Q_SCHOOL_ORDER_OF_MERIT" | "RANKING_RETENTION" | "CHALLENGER_RANKING" | "DEVELOPMENT_RANKING";
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
  if (!pros.length) return 0;
  const ends = TOUR_CARD_RULES_V1.founding.endSeasons;
  // Same cards and guards as awardCard, in one read and one insert (one card per founding professional).
  const keys = pros.map(p => `founding:${String(p.id)}`), ids = pros.map(p => String(p.id));
  const existing = new Map((await tx.execute(sql`SELECT operation_key, participant_key, source FROM career_tour_cards WHERE career_save_id = ${root.id}
    AND operation_key IN (${sql.join(keys.map(k => sql`${k}`), sql`, `)})`)).rows.map(r => [String(r.operation_key), r]));
  const holding = new Set((await tx.execute(sql`SELECT participant_key FROM career_tour_cards WHERE career_save_id = ${root.id} AND status = 'ACTIVE'
    AND participant_key IN (${sql.join(ids.map(k => sql`${k}`), sql`, `)})`)).rows.map(r => String(r.participant_key)));
  const detail = JSON.stringify({ reason: "Existing professional when the Career world was generated" });
  const rows = [];
  for (const npcId of ids) {
    const operationKey = `founding:${npcId}`, prior = existing.get(operationKey);
    if (prior) { if (String(prior.participant_key) !== npcId || prior.source !== "FOUNDING") throw new Error("Tour Card operation identity reused with different inputs"); continue; }
    if (holding.has(npcId)) continue;
    const offset = ends[parseInt(stableUuid(root.world_seed, rulesVersion, "founding-card-term", npcId).slice(0, 8), 16) % ends.length];
    const id = stableUuid(root.world_seed, rulesVersion, "tour-card", root.id, operationKey);
    rows.push(sql`(${root.id}, ${id}, ${operationKey}, ${npcId}, 'NPC', ${npcId}, 'FOUNDING', ${detail}::jsonb, NULL, ${season}, ${week}, ${season}, ${season + offset - 1}, 'ACTIVE', NULL, ${rulesVersion})`);
  }
  if (rows.length) await tx.execute(sql`INSERT INTO career_tour_cards (career_save_id, id, operation_key, participant_key, participant_kind, npc_id, source, source_detail, source_event_id,
      awarded_season, awarded_week, start_season, end_season, status, previous_card_id, tour_card_rules_version) VALUES ${sql.join(rows, sql`, `)}`);
  return rows.length;
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
  const rules = tourCardRulesFor(rulesVersion), week = 52;
  const position = async (list: string) => new Map((await tx.execute(sql`SELECT participant_key, current_position FROM career_ranking_participants
    WHERE career_save_id = ${root.id} AND list_key = ${list} AND current_position IS NOT NULL`)).rows.map(r => [String(r.participant_key), Number(r.current_position)]));
  const world = await position(rules.retention.list);
  const summary = { season, retained: 0, lost: 0, challengerCards: 0, developmentCards: 0, exemptions: 0 };
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
  // v3: the Development Tour Order of Merit top two without a card for next season (after the Challenger cards).
  const devRules = rules.developmentCards;
  const development = devRules ? [...(await position(devRules.list)).entries()].sort((a, b) => a[1] - b[1]) : [];
  if (devRules) {
    for (const r of (await tx.execute(sql`SELECT participant_key, participant_kind, npc_id FROM career_ranking_participants WHERE career_save_id = ${root.id} AND list_key = ${devRules.list}`)).rows)
      if (!kinds.has(String(r.participant_key))) kinds.set(String(r.participant_key), { kind: String(r.participant_kind), npc: r.npc_id ? String(r.npc_id) : null });
    let awarded = 0;
    for (const [participant, rank] of development) {
      if (awarded >= devRules.count) break;
      if (holdersNext.has(participant)) continue;
      const who = kinds.get(participant)!;
      const result = await awardCard(tx, root, rulesVersion, { operationKey: `development:${season}:${participant}`, participantKey: participant, participantKind: who.kind, npcId: who.npc,
        source: "DEVELOPMENT_RANKING", detail: { list: devRules.list, position: rank }, season, week, startSeason: season + 1, endSeason: season + rules.termSeasons });
      if (result) { holdersNext.add(participant); awarded++; summary.developmentCards++; }
    }
  }
  // Q-School Final Stage exemptions (A3 entitlement model, provider-issued).
  const [from, to] = rules.qSchoolExemptions.challengerPositions;
  const exempt = new Map<string, { kind: string; npc: string | null; reason: string; detail: Record<string, unknown> }>();
  if (rules.qSchoolExemptions.cardLosers) for (const c of losers) exempt.set(c.participant_key, { kind: c.participant_kind, npc: c.npc_id, reason: "TOUR_CARD_LOST", detail: { cardId: c.id } });
  for (const [participant, rank] of challenger) if (rank >= from && rank <= to && !exempt.has(participant)) {
    const who = kinds.get(participant)!; exempt.set(participant, { kind: who.kind, npc: who.npc, reason: "CHALLENGER_RANKING", detail: { position: rank } });
  }
  const devPlaces = rules.developmentPlaces;
  if (devPlaces) for (const [participant, rank] of development) if (rank >= devPlaces.qSchoolPositions[0] && rank <= devPlaces.qSchoolPositions[1] && !exempt.has(participant)) {
    const who = kinds.get(participant)!; exempt.set(participant, { kind: who.kind, npc: who.npc, reason: "DEVELOPMENT_RANKING", detail: { position: rank } });
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
    // v2: the next eight on the Challenger ranking also earn a place at next season's Open Championship.
    const open = rules.openChampionshipPlaces;
    if (open) for (const [participant, rank] of challenger) if (rank >= open.positions[0] && rank <= open.positions[1] && !holdersNext.has(participant)) {
      const who = kinds.get(participant)!;
      const idempotency = `provider:a5-open-championship-place:${season + 1}:${participant}`;
      grants.push({ id: stableUuid(root.world_seed, CALENDAR_GENERATION_VERSION, "entitlement", idempotency), idempotency_key: idempotency, recipient_key: participant,
        recipient_kind: who.kind, npc_id: who.npc, entitlement_type: "EVENT_ENTRY", source_event_id: null, source_position: null,
        source_detail: { providerId: "A5_SPORTING", reason: "CHALLENGER_RANKING", position: rank }, target_key: open.targetKey, target_season: season + 1, consumption: "SINGLE_USE" });
    }
    // v3: Development Tour 3rd–10th also earn an Open Championship place (one place per player, whichever route).
    if (open && devPlaces) for (const [participant, rank] of development)
      if (rank >= devPlaces.openChampionshipPositions[0] && rank <= devPlaces.openChampionshipPositions[1] && !holdersNext.has(participant)
        && !grants.some(g => g.recipient_key === participant && g.target_key === open.targetKey)) {
        const who = kinds.get(participant)!;
        const idempotency = `provider:a5-open-championship-place:${season + 1}:${participant}`;
        grants.push({ id: stableUuid(root.world_seed, CALENDAR_GENERATION_VERSION, "entitlement", idempotency), idempotency_key: idempotency, recipient_key: participant,
          recipient_kind: who.kind, npc_id: who.npc, entitlement_type: "EVENT_ENTRY", source_event_id: null, source_position: null,
          source_detail: { providerId: "A5_SPORTING", reason: "DEVELOPMENT_RANKING", position: rank }, target_key: open.targetKey, target_season: season + 1, consumption: "SINGLE_USE" });
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
