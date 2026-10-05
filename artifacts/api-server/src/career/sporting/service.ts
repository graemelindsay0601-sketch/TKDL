import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { HUMAN, loadInstances, loadFactsContext, factsFor, humanParticipant, type InstanceRow, type RootRow } from "../calendar/engine.ts";
import type { CalendarProviders } from "../calendar/providers.ts";
import type { Rule } from "../calendar/eligibility.ts";
import { evaluateRule } from "../calendar/eligibility.ts";
import { catalogueFor } from "../calendar/catalogue.ts";
import { createCareerFinanceService } from "../finance/service.ts";
import type { SponsorFactsProvider } from "../finance/engine.ts";
import { RANKING_RULES_VERSION, TOUR_CARD_RULES_VERSION, Q_SCHOOL_RULES_VERSION, TOUR_CARD_RULES_V1, Q_SCHOOL_RULES_V1, rankingListsFor, rankingList, timeIndex } from "./config.ts";
import { createSportingHooks, createSportingFactsProvider, bindSporting, ensureSporting, UNBOUND_STATUS, UNBOUND_SEEDING } from "./engine.ts";
import { orderOfMerit, finalStageDays, PATHWAYS } from "./qschool.ts";
import { captureSeasonReview } from "../legacy/persistence.ts";

const participantSchema = z.union([z.literal(HUMAN), z.string().uuid()]);
const tableQuerySchema = z.object({
  view: z.enum(["TOP", "AROUND", "PAGE"]).default("TOP"), limit: z.number().int().min(1).max(200).default(32), offset: z.number().int().min(0).max(5000).default(0),
  participant: participantSchema.default(HUMAN), radius: z.number().int().min(1).max(25).default(5),
}).strict();
const historyQuerySchema = z.object({ participant: participantSchema.default(HUMAN), limit: z.number().int().min(1).max(200).default(52) }).strict();
const milestoneQuerySchema = z.object({ participant: participantSchema.default(HUMAN), limit: z.number().int().min(1).max(200).default(50), beforeSeason: z.number().int().positive().optional(), beforeWeek: z.number().int().min(1).max(52).optional() }).strict();
const qualificationQuerySchema = z.object({ eventId: z.string().uuid().optional(), fromWeek: z.number().int().min(1).max(52).optional(), weeks: z.number().int().min(1).max(52).default(8) }).strict();

/**
 * A5 Career sporting service: the single authority for rankings, Tour Cards,
 * Q-School and sporting milestones. It composes the locked phases:
 *   A3 calendar (event/result authority) <- A5 status/seeding/sporting hooks
 *   A4 finance (money authority)         <- A5 sponsorship facts
 * `calendar`/`finance` are the composed services every Career route must use.
 * A5's own surface is read-only: sporting state changes only as a consequence of
 * A3 results inside A3's root-locked transactions.
 */
export function createCareerSportingService(database: CareerDatabase, options: { facts?: SponsorFactsProvider } = {}) {
  let composed: CalendarProviders | null = null;
  const facts = options.facts ?? createSportingFactsProvider(() => composed!);
  const finance = createCareerFinanceService(database, { facts, calendarProviders: { sportingStatus: UNBOUND_STATUS, seeding: UNBOUND_SEEDING, sporting: createSportingHooks(),
    history:{afterSeason:captureSeasonReview,pending:async(tx,root)=>{
      const r=(await tx.execute(sql`SELECT season FROM career_legacy_reviews WHERE career_save_id=${root.id} AND acknowledged=false ORDER BY season LIMIT 1`)).rows[0];
      return r?Number(r.season):null;
    }} } });
  composed = finance.calendar.providers;
  const calendar = finance.calendar;

  async function open(tx: CareerExecutor, actor: CareerActor, saveId: string, active = false) {
    careerIdSchema.parse(saveId);
    const root = await lockRoot(tx, actor, saveId, active) as RootRow;
    const world = (await tx.execute(sql`SELECT 1 FROM career_world_state WHERE career_save_id = ${saveId}`)).rows.length;
    if (!world) throw new CareerError(409, "Initialize Career first");
    await ensureSporting(tx, root);
    return root;
  }
  const names = async (tx: CareerExecutor, saveId: string, keys: readonly string[]) => {
    const ids = keys.filter(k => k !== HUMAN);
    const map = new Map<string, { name: string; nationality: string | null; status: string | null }>([[HUMAN, { name: "You", nationality: null, status: "ACTIVE" }]]);
    if (ids.length) for (const r of (await tx.execute(sql`SELECT id, first_name, surname, nationality, status FROM career_world_players WHERE career_save_id = ${saveId}
      AND id IN (${sql.join(ids.map(id => sql`${id}::uuid`), sql`, `)})`)).rows) map.set(String(r.id), { name: `${r.first_name} ${r.surname}`, nationality: String(r.nationality), status: String(r.status) });
    return map;
  };
  const latestSnapshot = async (tx: CareerExecutor, saveId: string, list: string) =>
    (await tx.execute(sql`SELECT * FROM career_ranking_snapshots WHERE career_save_id = ${saveId} AND list_key = ${list} ORDER BY sequence DESC LIMIT 1`)).rows[0] ?? null;
  const rulesVersion=(root:RootRow)=>Number(root.event_database_version)>=3?2:1;
  const requireList = (key: string,root:RootRow) => { const list = rankingList(key,rulesVersion(root)); if (!list) throw new CareerError(404, "Ranking list not found"); return list; };
  const presentRow = (r: Record<string, unknown>, who?: { name: string; nationality: string | null }) => ({ position: Number(r.position), participantKey: String(r.participant_key),
    kind: String(r.participant_kind), name: who?.name ?? null, nationality: who?.nationality ?? null, valuePence: Number(r.value_pence),
    previousPosition: r.previous_position === null ? null : Number(r.previous_position), movement: r.movement === null ? null : Number(r.movement), isNew: Boolean(r.is_new),
    gapAbovePence: r.gap_above_pence === null ? null : Number(r.gap_above_pence), gapBelowPence: r.gap_below_pence === null ? null : Number(r.gap_below_pence),
    careerHighPosition: Number(r.career_high_position), countedContributions: Number(r.counted_contributions) });
  const cutGaps = (cuts: Record<string, number | null>, mine: { position: number; valuePence: number } | null) => Object.entries(cuts).map(([line, value]) => ({
    cutPosition: Number(line), valueAtCutPence: value, inside: mine ? mine.position <= Number(line) : false,
    placesOutside: mine ? Math.max(0, mine.position - Number(line)) : null, gapPence: mine && value !== null ? Math.max(0, value - mine.valuePence) : value }));

  async function participantStanding(tx: CareerExecutor, saveId: string, list: string, participant: string) {
    const snap = await latestSnapshot(tx, saveId, list);
    const row = snap ? (await tx.execute(sql`SELECT * FROM career_ranking_snapshot_rows WHERE career_save_id = ${saveId} AND snapshot_id = ${snap.id} AND participant_key = ${participant}`)).rows[0] : undefined;
    const cache = (await tx.execute(sql`SELECT career_high_position, career_high_index, first_ranked_index FROM career_ranking_participants WHERE career_save_id = ${saveId} AND list_key = ${list} AND participant_key = ${participant}`)).rows[0];
    const season = snap ? Number(snap.season) : null;
    const seasonHigh = season ? (await tx.execute(sql`SELECT MIN(position)::int AS best FROM career_ranking_snapshot_rows WHERE career_save_id = ${saveId} AND list_key = ${list}
      AND participant_key = ${participant} AND season = ${season}`)).rows[0]?.best : null;
    const mine = row ? presentRow(row) : null;
    return { list, published: snap ? { season: Number(snap.season), week: Number(snap.week), sequence: Number(snap.sequence), participantCount: Number(snap.participant_count), rulesVersion: Number(snap.ranking_rules_version) } : null,
      ranked: !!row, standing: mine, careerHighPosition: cache ? Number(cache.career_high_position) : null, seasonHighPosition: seasonHigh ?? null,
      cutLines: snap ? cutGaps(snap.cut_values as Record<string, number | null>, mine) : [] };
  }

  async function cardView(tx: CareerExecutor, root: RootRow, participant: string) {
    const cards = (await tx.execute(sql`SELECT * FROM career_tour_cards WHERE career_save_id = ${root.id} AND participant_key = ${participant} ORDER BY start_season, created_at`)).rows;
    const season = Number(root.current_season);
    const current = cards.find(c => c.status === "ACTIVE") ?? null;
    const present = (c: Record<string, unknown>) => ({ id: c.id, source: c.source, sourceDetail: c.source_detail, sourceEventId: c.source_event_id, awarded: { season: c.awarded_season, week: c.awarded_week },
      term: { startSeason: c.start_season, endSeason: c.end_season }, status: c.status, endReason: c.end_reason, ended: c.ended_season ? { season: c.ended_season, week: c.ended_week } : null,
      previousCardId: c.previous_card_id, rulesVersion: c.tour_card_rules_version });
    return { participantKey: participant, holdsCard: !!current && Number(current.start_season) <= season && Number(current.end_season) >= season,
      current: current ? { ...present(current), reviewSeason: Number(current.end_season), retention: TOUR_CARD_RULES_V1.retention } : null, history: cards.map(present) };
  }

  async function qSchoolView(tx: CareerExecutor, root: RootRow, season: number, participant: string) {
    const state = await ensureSporting(tx, root);
    const pathways = [];
    for (const pathway of PATHWAYS) {
      const days = await finalStageDays(tx, root.id, season, pathway);
      const first = (await tx.execute(sql`SELECT series_day, finishing_position FROM career_qschool_results WHERE career_save_id = ${root.id} AND season = ${season} AND pathway = ${pathway}
        AND stage = 'FIRST' AND participant_key = ${participant} ORDER BY series_day`)).rows;
      const entitlement = (await tx.execute(sql`SELECT source_kind, source_detail FROM career_qualification_entitlements WHERE career_save_id = ${root.id} AND recipient_key = ${participant}
        AND target_key = ${`q-school-final:${pathway}`} AND target_season = ${season} LIMIT 1`)).rows[0];
      const { entries } = await orderOfMerit(tx, root, Number(state.q_school_rules_version), season, pathway);
      const allocation = (await tx.execute(sql`SELECT * FROM career_qschool_allocations WHERE career_save_id = ${root.id} AND season = ${season} AND pathway = ${pathway}`)).rows[0];
      const awards = (await tx.execute(sql`SELECT * FROM career_qschool_card_awards WHERE career_save_id = ${root.id} AND season = ${season} AND pathway = ${pathway} ORDER BY route, series_day, order_of_merit_position`)).rows;
      const winners = new Set(days.filter(d => d.status === "COMPLETED").map(d => String(d.champion_participant_key)));
      const contenders = entries.filter(e => !winners.has(e.participantKey));
      const unusedSoFar = days.filter(d => d.status === "CANCELLED").length;
      const cardLine = Q_SCHOOL_RULES_V1.pathways[pathway].orderOfMeritCards + (allocation ? Number(allocation.unused_direct_cards) : unusedSoFar);
      const mine = entries.find(e => e.participantKey === participant) ?? null;
      const contenderPosition = mine ? contenders.findIndex(e => e.participantKey === participant) + 1 : null;
      const nm = await names(tx, root.id, [...entries.slice(0, 16).map(e => e.participantKey), ...awards.map(a => String(a.participant_key))]);
      pathways.push({ pathway, finalStage: { days: days.length, completed: days.filter(d => d.status === "COMPLETED").length,
          dayWinners: days.map(d => ({ day: Number(d.series_day), status: d.status, winner: d.champion_participant_key ?? null })) },
        participant: { firstStage: first.map(f => ({ day: Number(f.series_day), position: Number(f.finishing_position) })), finalStageEntry: entitlement ? { route: entitlement.source_kind, detail: entitlement.source_detail } : null,
          wonDay: days.filter(d => d.champion_participant_key === participant).map(d => Number(d.series_day)),
          orderOfMerit: mine ? { position: mine.position, contenderPosition, points: mine.points, insideCardLine: contenderPosition !== null && contenderPosition <= cardLine } : null },
        cardLine: { orderOfMeritCards: cardLine, valueAtLinePoints: contenders[cardLine - 1]?.points ?? null },
        standings: entries.slice(0, 16).map(e => ({ ...e, name: nm.get(e.participantKey)?.name ?? null, dayWinner: winners.has(e.participantKey) })),
        allocation: allocation ? { allocatedWeek: allocation.allocated_week, directCards: allocation.direct_cards, unusedDirectCards: allocation.unused_direct_cards, orderOfMeritCards: allocation.order_of_merit_cards,
          rulesVersion: allocation.q_school_rules_version,
          awards: awards.map(a => ({ participantKey: a.participant_key, name: nm.get(String(a.participant_key))?.name ?? null, route: a.route, day: a.series_day, orderOfMeritPosition: a.order_of_merit_position, points: a.points, cardId: a.card_id })) } : null });
    }
    return { season, rulesVersion: Number(state.q_school_rules_version), participantKey: participant, tieBreaks: Q_SCHOOL_RULES_V1.tieBreaks, pathways };
  }

  /** Structured eligibility explanation: every route of the event's rule with the participant's facts (A6 decides wording). */
  function explain(rule: Rule, facts: ReturnType<typeof factsFor>, positions: Record<string, number>, cutValue: (list: string, pos: number) => number | null, myValue: (list: string) => number | null, qualifiers: Map<string, string[]>): Record<string, unknown> {
    if ("all" in rule) { const parts = rule.all.map(r => explain(r, facts, positions, cutValue, myValue, qualifiers)); return { type: "ALL", met: parts.every(p => p.met), parts }; }
    if ("any" in rule) { const parts = rule.any.map(r => explain(r, facts, positions, cutValue, myValue, qualifiers)); return { type: "ANY", met: parts.some(p => p.met), parts }; }
    if ("not" in rule) { const inner = explain(rule.not, facts, positions, cutValue, myValue, qualifiers); return { type: "NOT", met: !inner.met, inner }; }
    const outcome = evaluateRule(rule, facts);
    const base = { type: rule.type, met: outcome.eligible, reasons: outcome.reasons };
    switch (rule.type) {
      case "RANKING": {
        const position = positions[rule.list] ?? null;
        const cut = cutValue(rule.list, rule.maxPosition), mine = myValue(rule.list);
        return { ...base, list: rule.list, maxPosition: rule.maxPosition, position, placesOutside: position === null ? null : Math.max(0, position - rule.maxPosition),
          gapToCutPence: cut === null ? null : Math.max(0, cut - (mine ?? 0)) };
      }
      case "TOUR_CARD": case "NON_TOUR_CARD": return { ...base, tourCard: facts.tourCard };
      case "QUALIFICATION": return { ...base, targetKey: rule.targetKey, held: facts.entitlementTargets.has(rule.targetKey), qualifierRoutes: qualifiers.get(rule.targetKey) ?? [] };
      case "PRO_STATUS": return { ...base, required: rule.status, professionalStatus: facts.professionalStatus };
      case "WOMEN":return {...base,declaredEligibility:facts.womenEligible===true};
      case "AGE":return {...base,age:facts.age??null,minAge:rule.minAge??null,maxAgeExclusive:rule.maxAgeExclusive??null};
      case "EVENT_RESULT":return {...base,definitionKey:rule.definitionKey,maxPosition:rule.maxPosition,season:rule.season,
        finishingPosition:facts.results[rule.season].get(rule.definitionKey)??null};
      default: return base;
    }
  }

  return {
    calendar, finance, factsProvider:facts,providers: () => composed!,
    versions: { rankingRulesVersion: RANKING_RULES_VERSION, tourCardRulesVersion: TOUR_CARD_RULES_VERSION, qSchoolRulesVersion: Q_SCHOOL_RULES_VERSION },

    /** A1 save -> A2 world -> A3 calendar -> A4 finance -> A5 state + founding cards (idempotent). */
    async initialize(actor: CareerActor, saveId: string) {
      const result = await finance.initialize(actor, saveId);
      await database.transaction(async tx => { const root = await lockRoot(tx, actor, saveId) as RootRow; await ensureSporting(tx, root); });
      return result;
    },

    /** Career Home sporting summary: one call, bounded queries (no world/history scans). */
    async summary(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const lists = [];
        for (const list of rankingListsFor(rulesVersion(root))) {
          const s = await participantStanding(tx, root.id, list.key, HUMAN);
          lists.push({ key: list.key, name: list.name, scope: list.scope, published: s.published, position: s.standing?.position ?? null, valuePence: s.standing?.valuePence ?? 0,
            movement: s.standing?.movement ?? null, isNew: s.standing?.isNew ?? false, careerHighPosition: s.careerHighPosition });
        }
        const recent = (await tx.execute(sql`SELECT kind, list_key, season, week, detail FROM career_sporting_milestones WHERE career_save_id = ${root.id} AND participant_key = ${HUMAN}
          ORDER BY season DESC, week DESC, created_at DESC LIMIT 5`)).rows;
        const card = await cardView(tx, root, HUMAN);
        return { season: Number(root.current_season), week: Number(root.current_week), professionalStatus: card.holdsCard ? "PROFESSIONAL" : "AMATEUR",
          tourCard: { holdsCard: card.holdsCard, current: card.current }, worldRanking: await participantStanding(tx, root.id, "pro-world", HUMAN), rankings: lists,
          recentMilestones: recent, versions: { ranking: rulesVersion(root), tourCard: TOUR_CARD_RULES_VERSION, qSchool: Q_SCHOOL_RULES_VERSION } };
      });
    },

    async rankingLists(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const out = [];
        for (const list of rankingListsFor(rulesVersion(root))) {
          const snap = await latestSnapshot(tx, root.id, list.key);
          out.push({ key: list.key, name: list.name, scope: list.scope, categories: list.categories, window: list.window, cutLines: list.cutLines,
            published: snap ? { season: snap.season, week: snap.week, sequence: snap.sequence, participantCount: snap.participant_count, reason: snap.reason } : null,
            human: await participantStanding(tx, root.id, list.key, HUMAN) });
        }
        return out;
      });
    },

    /** Current table slice: TOP N, AROUND a participant, or a PAGE (offset/limit). */
    async rankingTable(actor: CareerActor, saveId: string, listKey: string, query: unknown = {}) {
      const q = tableQuerySchema.parse(query);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const list = requireList(listKey,root);
        const snap = await latestSnapshot(tx, root.id, list.key);
        if (!snap) return { list: list.key, name: list.name, published: null, rows: [], participant: null };
        const target = (await tx.execute(sql`SELECT position FROM career_ranking_snapshot_rows WHERE career_save_id = ${root.id} AND snapshot_id = ${snap.id} AND participant_key = ${q.participant}`)).rows[0];
        let from = 1, to = q.limit;
        if (q.view === "PAGE") { from = q.offset + 1; to = q.offset + q.limit; }
        if (q.view === "AROUND" && target) { from = Math.max(1, Number(target.position) - q.radius); to = Number(target.position) + q.radius; }
        const rows = (await tx.execute(sql`SELECT * FROM career_ranking_snapshot_rows WHERE career_save_id = ${root.id} AND snapshot_id = ${snap.id} AND position BETWEEN ${from} AND ${to} ORDER BY position`)).rows;
        const nm = await names(tx, root.id, rows.map(r => String(r.participant_key)));
        return { list: list.key, name: list.name, view: q.view, published: { season: snap.season, week: snap.week, sequence: snap.sequence, participantCount: snap.participant_count, rulesVersion: snap.ranking_rules_version },
          cutLines: snap.cut_values, participant: { key: q.participant, position: target ? Number(target.position) : null },
          rows: rows.map(r => presentRow(r, nm.get(String(r.participant_key)))) };
      });
    },

    async rankingHistory(actor: CareerActor, saveId: string, listKey: string, query: unknown = {}) {
      const q = historyQuerySchema.parse(query);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const list = requireList(listKey,root);
        const rows = (await tx.execute(sql`SELECT r.*, s.season AS s_season, s.week AS s_week, s.sequence FROM career_ranking_snapshot_rows r
          JOIN career_ranking_snapshots s ON s.career_save_id = r.career_save_id AND s.id = r.snapshot_id
          WHERE r.career_save_id = ${root.id} AND r.list_key = ${list.key} AND r.participant_key = ${q.participant} ORDER BY r.publication_index DESC LIMIT ${q.limit}`)).rows;
        const seasons = (await tx.execute(sql`SELECT season, MIN(position)::int AS best, MAX(position)::int AS worst, COUNT(*)::int AS snapshots FROM career_ranking_snapshot_rows
          WHERE career_save_id = ${root.id} AND list_key = ${list.key} AND participant_key = ${q.participant} GROUP BY season ORDER BY season`)).rows;
        const cache = (await tx.execute(sql`SELECT * FROM career_ranking_participants WHERE career_save_id = ${root.id} AND list_key = ${list.key} AND participant_key = ${q.participant}`)).rows[0];
        return { list: list.key, participantKey: q.participant, careerHigh: cache ? { position: cache.career_high_position, publicationIndex: cache.career_high_index } : null,
          seasonHighs: seasons, snapshots: rows.map(r => ({ season: r.s_season, week: r.s_week, sequence: r.sequence, ...presentRow(r) })) };
      });
    },

    /** Why does this participant have this value? Counting contributions at the latest publication, plus expired ones. */
    async rankingExplain(actor: CareerActor, saveId: string, listKey: string, participant: string = HUMAN) {
      participantSchema.parse(participant);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const list = requireList(listKey,root);
        const snap = await latestSnapshot(tx, root.id, list.key);
        const P = snap ? Number(snap.publication_index) : timeIndex(Number(root.current_season), Number(root.current_week));
        const rows = (await tx.execute(sql`SELECT c.*, i.name, i.definition_key, i.circuit FROM career_ranking_contributions c JOIN career_event_instances i ON i.career_save_id = c.career_save_id AND i.id = c.event_id
          WHERE c.career_save_id = ${root.id} AND c.list_key = ${list.key} AND c.participant_key = ${participant} ORDER BY c.completion_index DESC, c.event_id`)).rows;
        const present = (c: Record<string, unknown>) => ({ eventId: c.event_id, eventName: c.name, definitionKey: c.definition_key, circuit: c.circuit, season: c.season, week: c.week,
          finishingPosition: c.finishing_position, amountPence: Number(c.amount_pence), source: c.source, completionIndex: c.completion_index, expiresIndex: c.expires_index, rulesVersion: c.ranking_rules_version });
        const counting = rows.filter(c => Number(c.completion_index) <= P && Number(c.expires_index) > P);
        const standing = snap ? (await tx.execute(sql`SELECT value_pence, position FROM career_ranking_snapshot_rows WHERE career_save_id = ${root.id} AND snapshot_id = ${snap.id} AND participant_key = ${participant}`)).rows[0] : undefined;
        const total = counting.reduce((t, c) => t + Number(c.amount_pence), 0);
        return { list: list.key, window: list.window, participantKey: participant, publicationIndex: P, position: standing ? Number(standing.position) : null,
          valuePence: standing ? Number(standing.value_pence) : 0, contributionTotalPence: total, explained: !standing || Number(standing.value_pence) === total,
          counting: counting.map(present), expired: rows.filter(c => Number(c.expires_index) <= P).slice(0, 50).map(present), pending: rows.filter(c => Number(c.completion_index) > P).map(present) };
      });
    },

    async tourCard(actor: CareerActor, saveId: string, participant: string = HUMAN) {
      participantSchema.parse(participant);
      return database.transaction(async tx => { const root = await open(tx, actor, saveId); return cardView(tx, root, participant); });
    },

    async qSchool(actor: CareerActor, saveId: string, query: { season?: number; participant?: string } = {}) {
      const participant = participantSchema.parse(query.participant ?? HUMAN);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        return qSchoolView(tx, root, query.season ?? Number(root.current_season), participant);
      });
    },

    /** Qualification facts for one event or the human's upcoming window (structured routes; A6 renders them). */
    async qualification(actor: CareerActor, saveId: string, query: unknown = {}) {
      const q = qualificationQuerySchema.parse(query);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const season = Number(root.current_season), week = q.fromWeek ?? Number(root.current_week);
        const events: InstanceRow[] = q.eventId ? await loadInstances(tx, root.id, sql`id = ${q.eventId}`)
          : await loadInstances(tx, root.id, sql`season = ${season} AND start_week BETWEEN ${week} AND ${week + q.weeks - 1} AND status NOT IN ('COMPLETED','CANCELLED')`);
        if (q.eventId && !events.length) throw new CareerError(404, "Career event not found");
        const bound = await bindSporting(tx, root);
        const providers = { ...composed!, sportingStatus: bound.sportingStatus, seeding: bound.seeding };
        const human = humanParticipant(root, providers);
        const ctx = await loadFactsContext(tx, root.id, events[0]?.season ?? season, events.map(e => e.snapshot.eligibility), [HUMAN]);
        const snaps = new Map<string, Record<string, unknown>>();
        for (const list of rankingListsFor(rulesVersion(root))) { const s = await latestSnapshot(tx, root.id, list.key); if (s) snaps.set(list.key, s); }
        const values = new Map((await tx.execute(sql`SELECT list_key, current_value_pence FROM career_ranking_participants WHERE career_save_id = ${root.id} AND participant_key = ${HUMAN}
          AND current_position IS NOT NULL`)).rows.map(r => [String(r.list_key), Number(r.current_value_pence)]));
        const cutCache = new Map<string, number | null>();
        const cutValue = (list: string, pos: number) => {
          const key = `${list}:${pos}`;
          if (!cutCache.has(key)) cutCache.set(key, ((snaps.get(list)?.cut_values as Record<string, number | null> | undefined)?.[String(pos)]) ?? null);
          return cutCache.get(key)!;
        };
        // Exact cut values for lines not pre-published come from the snapshot rows.
        for (const e of events) for (const r of rankingRules(e.snapshot.eligibility)) if (cutValue(r.list, r.maxPosition) === null && snaps.get(r.list)) {
          const row = (await tx.execute(sql`SELECT value_pence FROM career_ranking_snapshot_rows WHERE career_save_id = ${root.id} AND snapshot_id = ${snaps.get(r.list)!.id} AND position = ${r.maxPosition}`)).rows[0];
          cutCache.set(`${r.list}:${r.maxPosition}`, row ? Number(row.value_pence) : null);
        }
        const qualifiers = new Map<string, string[]>();
        for (const def of catalogueFor(Number(root.event_database_version))) for (const out of def.qualificationOutputs) qualifiers.set(out.targetKey, [...(qualifiers.get(out.targetKey) ?? []), def.key]);
        return { season, participantKey: HUMAN, tourCard: human.tourCard, professionalStatus: human.professionalStatus, rankings: human.rankings,
          events: events.map(e => {
            const facts = factsFor(human, ctx, e);
            const outcome = evaluateRule(e.snapshot.eligibility, facts);
            return { eventId: e.id, name: e.name, definitionKey: e.definition_key, circuit: e.circuit, classification: e.classification, startWeek: e.start_week, status: e.status,
              eligible: outcome.eligible, reasons: outcome.reasons, routes: explain(e.snapshot.eligibility, facts, human.rankings, cutValue, list => values.get(list) ?? null, qualifiers),
              seedingList: e.snapshot.seedingPolicy.list, seeds: e.snapshot.seedingPolicy.seeds };
          }) };
      });
    },

    async milestones(actor: CareerActor, saveId: string, query: unknown = {}) {
      const q = milestoneQuerySchema.parse(query);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const before = q.beforeSeason ? sql`AND (season, week) < (${q.beforeSeason}, ${q.beforeWeek ?? 53})` : sql``;
        const rows = (await tx.execute(sql`SELECT id, kind, list_key, season, week, detail, created_at FROM career_sporting_milestones WHERE career_save_id = ${root.id}
          AND participant_key = ${q.participant} ${before} ORDER BY season DESC, week DESC, created_at DESC, id LIMIT ${q.limit}`)).rows;
        return { participantKey: q.participant, milestones: rows };
      });
    },
  };
}
function rankingRules(rule: Rule): { list: string; maxPosition: number }[] {
  if ("all" in rule) return rule.all.flatMap(rankingRules);
  if ("any" in rule) return rule.any.flatMap(rankingRules);
  if ("not" in rule) return rankingRules(rule.not);
  return rule.type === "RANKING" ? [{ list: rule.list, maxPosition: rule.maxPosition }] : [];
}
export type CareerSportingService = ReturnType<typeof createCareerSportingService>;
