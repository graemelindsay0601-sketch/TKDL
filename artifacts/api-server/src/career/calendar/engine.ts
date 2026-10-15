import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { loadNpcs } from "../world/repository.ts";
import { scopedRandom, stableUuid, normal } from "../world/random.ts";
import { simulateMatchesInTransaction, type Root, type World } from "../world/service.ts";
import type { Npc } from "../world/types.ts";
import { CALENDAR_GENERATION_VERSION, WEEKS_PER_SEASON, DAYS_PER_WEEK, type EventStatus } from "./config.ts";
import { generateSeason, canonicalJson, type EventInstanceDraft, type InstanceSnapshot } from "./generation.ts";
import { bestOfForRound, a2MatchFormat, assessCapability, CAPABILITY_ENGINE_VERSION } from "./formats.ts";
import { evaluateRule, type ParticipantFacts, type Rule, type RuleOutcome } from "./eligibility.ts";
import { npcFacts, type CalendarProviders } from "./providers.ts";
import { geographyWeight, weightedSample, tierWeight, fillTarget } from "./selection.ts";
import { generateKnockoutDraw, finishingPosition, stageName } from "./draw.ts";
import { careerAge, type CareerIdentity } from "../identity/age.ts";
import { makeGroupRows, progressGroups, tournamentDay, loadBulls, resolvedGroups, playingDays } from "./group-engine.ts";
import { isGroupMatch, isGroupedStructure, layoutFor, groupTable } from "./groups.ts";
import { nationTeams, localTeams, insertPairs, loadPairs, dartsNation, selectionRank, type PairRow, type PairCandidate } from "./pairs.ts";

export const HUMAN = "HUMAN";
/** A6.5: identity columns joined onto the locked root by lockRoot (null when the save has no profile row). */
export function rootIdentity(root: object): CareerIdentity | null {
  const r = root as { identity_dob?: unknown; identity_start?: unknown };
  return typeof r.identity_start === "string" ? { dateOfBirth: typeof r.identity_dob === "string" ? r.identity_dob : null, careerStartDate: r.identity_start } : null;
}
export type RootRow = Root & { status: string; current_week: number; has_tour_card: boolean; settings_snapshot: Record<string, unknown>; event_database_version: number };

export type InstanceRow = {
  career_save_id: string; id: string; season: number; instance_key: string; ordinal: number; event_database_version: number; definition_key: string;
  name: string; family: string; circuit: string; classification: string; ranking_category: string | null; presentation_tier: string; featured: boolean;
  calendar_priority: number; venue_key: string; city: string; country: string; region: string; zone: string; locality_key: string | null;
  start_week: number; end_week: number; start_day: number; end_day: number; registration_opens_week: number; registration_closes_week: number;
  field_size: number; minimum_entrants: number; executable: boolean; series_key: string | null; series_day: number | null;
  status: EventStatus; status_reason: string | null; entrant_count: number; champion_participant_key: string | null; champion_npc_id: string | null;
  snapshot: InstanceSnapshot; field_locked_at: unknown; drawn_at: unknown; completed_at: unknown;
};
export type MatchRow = {
  id: string; event_id: string; stage_key: string; round: number; slot: number; best_of: number; scheduled_day: number;
  a_key: string | null; b_key: string | null; a_npc_id: string | null; b_npc_id: string | null; status: string; winner_key: string | null;
  legs_a: number | null; legs_b: number | null; first_throw: number | null; first_throw_method: string; first_throw_detail: unknown;
  result_source: string | null; simulated_match_key: string | null; summary: unknown;
};

// ------------------------------------------------------------------ capability refresh (A6.5)
/**
 * When the executable-format set grows (CAPABILITY_ENGINE_VERSION), events of an
 * existing save that have not yet closed registration are re-assessed from their
 * own immutable format snapshot. Closed/cancelled/played events keep their history.
 * Cheap: only non-executable, still-open X01 instances are candidates.
 */
export async function refreshCapabilities(tx: CareerExecutor, saveId: string) {
  const rows = (await tx.execute(sql`SELECT id, snapshot,event_database_version FROM career_event_instances WHERE career_save_id = ${saveId} AND NOT executable
    AND status IN ('SCHEDULED','REGISTRATION_OPEN') AND snapshot->'format'->>'gameType' = 'X01'`)).rows as { id: string; snapshot: InstanceSnapshot; event_database_version: number }[];
  const flips = rows.map(r => ({ id: r.id, capability: assessCapability(r.snapshot.format, r.event_database_version >= 4) })).filter(r => r.capability.executable);
  if (flips.length) await tx.execute(sql`UPDATE career_event_instances i SET executable = TRUE,
      snapshot = i.snapshot || jsonb_build_object('capability', f.capability, 'capabilityEngineVersion', ${CAPABILITY_ENGINE_VERSION}::int)
    FROM jsonb_to_recordset(${JSON.stringify(flips)}::jsonb) AS f(id uuid, capability jsonb)
    WHERE i.career_save_id = ${saveId} AND i.id = f.id AND NOT i.executable`);
  // Unplayed unsupported content is informational from now, not a surprise
  // cancellation at its start date. Completed/cancelled historical rows stay put.
  await tx.execute(sql`UPDATE career_event_instances SET status='CANCELLED', status_reason='INTENTIONALLY_BENCHED'
    WHERE career_save_id=${saveId} AND NOT executable AND status IN ('SCHEDULED','REGISTRATION_OPEN')`);
  return flips.length;
}

// ------------------------------------------------------------------ lifecycle
const TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  SCHEDULED: ["REGISTRATION_OPEN", "CANCELLED"],
  REGISTRATION_OPEN: ["REGISTRATION_CLOSED", "CANCELLED"],
  REGISTRATION_CLOSED: ["DRAW_PENDING", "CANCELLED"],
  DRAW_PENDING: ["DRAWN", "CANCELLED"],
  DRAWN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [], CANCELLED: [],
};
export const canTransition = (from: EventStatus, to: EventStatus) => TRANSITIONS[from].includes(to);
export function assertTransition(from: EventStatus, to: EventStatus) {
  if (!canTransition(from, to)) throw new CareerError(409, `Invalid Career event transition ${from} -> ${to}`);
}
async function transition(tx: CareerExecutor, event: InstanceRow, to: EventStatus, extra: { reason?: string | null; set?: ReturnType<typeof sql> } = {}) {
  assertTransition(event.status, to);
  const result = await tx.execute(sql`UPDATE career_event_instances SET status = ${to}, status_reason = ${extra.reason ?? null}
    ${extra.set ? sql`, ${extra.set}` : sql``}
    WHERE career_save_id = ${event.career_save_id} AND id = ${event.id} AND status = ${event.status} RETURNING id`);
  if (result.rows.length !== 1) throw new CareerError(409, "Career event changed concurrently");
  event.status = to;
  event.status_reason = extra.reason ?? null;
}

/** REGISTRATION_OPEN -> REGISTRATION_CLOSED for many events in one statement (the history trigger checks each row). */
async function closeRegistrations(tx: CareerExecutor, events: InstanceRow[]) {
  const open = events.filter(e => e.status === "REGISTRATION_OPEN");
  if (!open.length) return;
  assertTransition("REGISTRATION_OPEN", "REGISTRATION_CLOSED");
  const updated = await tx.execute(sql`UPDATE career_event_instances SET status = 'REGISTRATION_CLOSED', status_reason = NULL
    WHERE career_save_id = ${open[0].career_save_id} AND status = 'REGISTRATION_OPEN' AND id IN (${sql.join(open.map(e => sql`${e.id}::uuid`), sql`, `)}) RETURNING id`);
  if (updated.rows.length !== open.length) throw new CareerError(409, "Career event changed concurrently");
  for (const e of open) { e.status = "REGISTRATION_CLOSED"; e.status_reason = null; }
}

// ------------------------------------------------------------------ seasons
export const calendarHash = (drafts: readonly EventInstanceDraft[]) => createHash("sha256").update(canonicalJson(drafts.map(d => [d.id, d.instanceKey, d.startDay, d.endDay, d.snapshot.resolvedFrom.definitionHash]))).digest("hex");

/** Create the season calendar once. Re-entry returns the stored season untouched. */
export async function ensureSeason(tx: CareerExecutor, root: RootRow, season: number) {
  const existing = (await tx.execute(sql`SELECT * FROM career_seasons WHERE career_save_id = ${root.id} AND season = ${season}`)).rows[0];
  if (existing) return { season: existing, created: false };
  const version = Number(root.event_database_version);
  const drafts = generateSeason(root.world_seed, version, season);
  await tx.execute(sql`INSERT INTO career_seasons (career_save_id, season, event_database_version, calendar_generation_version, status, instance_count, calendar_hash)
    VALUES (${root.id}, ${season}, ${version}, ${CALENDAR_GENERATION_VERSION}, 'ACTIVE', ${drafts.length}, ${calendarHash(drafts)})`);
  const rows = drafts.map(d => ({ id: d.id, season, instance_key: d.instanceKey, ordinal: d.ordinal, event_database_version: d.eventDatabaseVersion, definition_key: d.definitionKey,
    name: d.name, family: d.family, circuit: d.circuit, classification: d.classification, ranking_category: d.rankingCategory, presentation_tier: d.presentationTier,
    featured: d.featured, calendar_priority: d.calendarPriority, venue_key: d.venueKey, city: d.city, country: d.country, region: d.region, zone: d.zone,
    locality_key: d.localityKey, start_week: d.startWeek, end_week: d.endWeek, start_day: d.startDay, end_day: d.endDay,
    registration_opens_week: d.registrationOpensWeek, registration_closes_week: d.registrationClosesWeek, field_size: d.fieldSize,
    minimum_entrants: d.minimumEntrants, executable: d.executable, series_key: d.seriesKey, series_day: d.seriesDay, snapshot: d.snapshot }));
  for (let i = 0; i < rows.length; i += 150) {
    await tx.execute(sql`INSERT INTO career_event_instances (career_save_id, id, season, instance_key, ordinal, event_database_version, definition_key, name, family,
        circuit, classification, ranking_category, presentation_tier, featured, calendar_priority, venue_key, city, country, region, zone, locality_key,
        start_week, end_week, start_day, end_day, registration_opens_week, registration_closes_week, field_size, minimum_entrants, executable,
        series_key, series_day, status, status_reason, snapshot)
      SELECT ${root.id}::uuid, r.id, r.season, r.instance_key, r.ordinal, r.event_database_version, r.definition_key, r.name, r.family,
        r.circuit, r.classification, r.ranking_category, r.presentation_tier, r.featured, r.calendar_priority, r.venue_key, r.city, r.country, r.region, r.zone, r.locality_key,
        r.start_week, r.end_week, r.start_day, r.end_day, r.registration_opens_week, r.registration_closes_week, r.field_size, r.minimum_entrants, r.executable,
        r.series_key, r.series_day, CASE WHEN r.executable THEN 'SCHEDULED' ELSE 'CANCELLED' END,
        CASE WHEN r.executable THEN NULL ELSE 'INTENTIONALLY_BENCHED' END, r.snapshot
      FROM jsonb_to_recordset(${JSON.stringify(rows.slice(i, i + 150))}::jsonb) AS r(id uuid, season integer, instance_key text, ordinal integer,
        event_database_version integer, definition_key text, name text, family text, circuit text, classification text, ranking_category text,
        presentation_tier text, featured boolean, calendar_priority integer, venue_key text, city text, country text, region text, zone text, locality_key text,
        start_week integer, end_week integer, start_day integer, end_day integer, registration_opens_week integer, registration_closes_week integer,
        field_size integer, minimum_entrants integer, executable boolean, series_key text, series_day integer, snapshot jsonb)`);
  }
  const created = (await tx.execute(sql`SELECT * FROM career_seasons WHERE career_save_id = ${root.id} AND season = ${season}`)).rows[0];
  return { season: created, created: true };
}

/** Open registration for every SCHEDULED instance whose window has begun. */
export async function openRegistrations(tx: CareerExecutor, saveId: string, season: number, week: number) {
  await tx.execute(sql`UPDATE career_event_instances SET status = 'REGISTRATION_OPEN'
    WHERE career_save_id = ${saveId} AND season = ${season} AND status = 'SCHEDULED' AND registration_opens_week <= ${week}`);
}

export async function loadInstances(tx: CareerExecutor, saveId: string, where: ReturnType<typeof sql>): Promise<InstanceRow[]> {
  return (await tx.execute(sql`SELECT * FROM career_event_instances WHERE career_save_id = ${saveId} AND ${where}`)).rows as InstanceRow[];
}

// ------------------------------------------------------------------ eligibility facts
type FactsContext = {
  season: number;
  entitlements: Map<string, Set<string>>;   // participant -> target keys (ACTIVE, this season)
  results: { SAME: Map<string, Map<string, number>>; PREVIOUS: Map<string, Map<string, number>> }; // participant -> definition -> best position
  champions: Map<string, Set<string>>;      // previous-season "definition:ordinal" -> champion participant keys
};
function collectResultKeys(rule: Rule, out: Set<string>) {
  if ("all" in rule) rule.all.forEach(r => collectResultKeys(r, out));
  else if ("any" in rule) rule.any.forEach(r => collectResultKeys(r, out));
  else if ("not" in rule) collectResultKeys(rule.not, out);
  else if (rule.type === "EVENT_RESULT") out.add(rule.definitionKey);
}
export async function loadFactsContext(tx: CareerExecutor, saveId: string, season: number, rules: readonly Rule[], participants?: readonly string[]): Promise<FactsContext> {
  const filter = participants ? sql`AND recipient_key IN (${sql.join(participants.map(p => sql`${p}`), sql`, `)})` : sql``;
  const entitlements = new Map<string, Set<string>>();
  if (!participants || participants.length) {
    for (const row of (await tx.execute(sql`SELECT recipient_key, target_key FROM career_qualification_entitlements
      WHERE career_save_id = ${saveId} AND target_season = ${season} AND status = 'ACTIVE' ${filter}`)).rows) {
      const key = String(row.recipient_key);
      if (!entitlements.has(key)) entitlements.set(key, new Set());
      entitlements.get(key)!.add(String(row.target_key));
    }
  }
  const definitions = new Set<string>();
  rules.forEach(rule => collectResultKeys(rule, definitions));
  const results = await loadResultFacts(tx, saveId, season, definitions);
  return { season, entitlements, results, champions: await previousChampions(tx, saveId, season) };
}
/** Best finishing position per participant/definition this season and last (only for EVENT_RESULT rules in play). */
async function loadResultFacts(tx: CareerExecutor, saveId: string, season: number, definitions: ReadonlySet<string>): Promise<FactsContext["results"]> {
  const results = { SAME: new Map<string, Map<string, number>>(), PREVIOUS: new Map<string, Map<string, number>>() };
  if (definitions.size) {
    for (const row of (await tx.execute(sql`SELECT participant_key, definition_key, season, MIN(finishing_position) AS best FROM career_event_results
      WHERE career_save_id = ${saveId} AND season IN (${season}, ${season - 1}) AND definition_key IN (${sql.join([...definitions].map(d => sql`${d}`), sql`, `)})
      GROUP BY participant_key, definition_key, season`)).rows) {
      const bucket = Number(row.season) === season ? results.SAME : results.PREVIOUS;
      const key = String(row.participant_key);
      if (!bucket.has(key)) bucket.set(key, new Map());
      bucket.get(key)!.set(String(row.definition_key), Number(row.best));
    }
  }
  return results;
}
/** Last season's champions: closed history, so loaded once per transaction (every field lock reads it). */
const championsByTx = new WeakMap<CareerExecutor, Map<string, Map<string, Set<string>>>>();
async function previousChampions(tx: CareerExecutor, saveId: string, season: number) {
  const memo = championsByTx.get(tx) ?? new Map<string, Map<string, Set<string>>>();
  championsByTx.set(tx, memo);
  const cached = memo.get(`${saveId}:${season}`);
  if (cached) return cached;
  const champions = new Map<string, Set<string>>();
  for (const row of (await tx.execute(sql`SELECT definition_key, ordinal, champion_participant_key FROM career_event_instances
    WHERE career_save_id = ${saveId} AND season = ${season - 1} AND status = 'COMPLETED'`)).rows) {
    const key = `${row.definition_key}:${row.ordinal}`;
    if (!champions.has(key)) champions.set(key, new Set());
    champions.get(key)!.add(String(row.champion_participant_key));
  }
  memo.set(`${saveId}:${season}`, champions);
  return champions;
}

export function factsFor(participant: { key: string; kind: "HUMAN" | "NPC"; country: string; zone: string; locality: string | null; professionalStatus: "AMATEUR" | "PROFESSIONAL"; tourCard: boolean | null; rankings: Record<string, number>;
  age?: number | null; identity?: CareerIdentity | null; womenEligible?: boolean },
  ctx: FactsContext, event: InstanceRow, invited = false): ParticipantFacts {
  // A6.5: the human's age is taken on THIS event's start date (Career-world time).
  const age = participant.identity !== undefined ? careerAge(participant.identity, event.season, event.start_day) : participant.age;
  return { ...participant, age, zone: participant.zone as ParticipantFacts["zone"],
    entitlementTargets: ctx.entitlements.get(participant.key) ?? new Set(), invited: invited || humanInvited(participant, event),
    results: { SAME: ctx.results.SAME.get(participant.key) ?? new Map(), PREVIOUS: ctx.results.PREVIOUS.get(participant.key) ?? new Map() },
    defendingChampion: ctx.champions.get(`${event.definition_key}:${event.ordinal}`)?.has(participant.key) ?? false };
}
/**
 * v6: NPC invitations are sampled during field assembly, which the human never passes through.
 * The human is invited on the published World Ranking instead: inside the event's invitation
 * count. Deterministic and explainable; v1–v5 saves keep "never invited".
 */
export function humanInvited(participant: { kind: "HUMAN" | "NPC"; rankings: Record<string, number> }, event: InstanceRow): boolean {
  const policy = event.snapshot.invitationPolicy;
  const rank = participant.rankings["pro-world"];
  return participant.kind === "HUMAN" && Number(event.event_database_version) >= 6 && !!policy && rank !== undefined && rank <= policy.count;
}
export const npcParticipant = (npc: Npc, providers: CalendarProviders) => ({ key: npc.id, kind: "NPC" as const, ...npcFacts(npc), age: npc.age, womenEligible: npc.worldKey.startsWith("women:"),
  professionalStatus: providers.sportingStatus.npcProfessionalStatus?.(npc) ?? npc.professionalStatus, tourCard: providers.sportingStatus.npcTourCard(npc), rankings: providers.sportingStatus.rankings(npc.id) });
export const humanParticipant = (root: RootRow, providers: CalendarProviders) => {
  const profile = providers.sportingStatus.human(root);
  return { key: HUMAN, kind: "HUMAN" as const, country: profile.country, zone: profile.zone, locality: profile.locality,
    professionalStatus: profile.professionalStatus, tourCard: profile.tourCard, rankings: providers.sportingStatus.rankings(HUMAN), identity: rootIdentity(root),
    womenEligible: root.settings_snapshot?.competitionCategory === "WOMEN" };
};
export const evaluate = (event: InstanceRow, facts: ParticipantFacts): RuleOutcome => evaluateRule(event.snapshot.eligibility, facts);

// ------------------------------------------------------------------ bookings / conflicts
export async function bookedParticipants(tx: CareerExecutor, saveId: string, season: number, fromDay: number, toDay: number): Promise<Set<string>> {
  return new Set((await tx.execute(sql`SELECT DISTINCT participant_key FROM career_participant_bookings
    WHERE career_save_id = ${saveId} AND season = ${season} AND day BETWEEN ${fromDay} AND ${toDay}`)).rows.map(row => String(row.participant_key)));
}
/** Participants booked on any of the given days (a league's nights). */
export async function bookedOnDays(tx: CareerExecutor, saveId: string, season: number, days: readonly number[]): Promise<Set<string>> {
  if (!days.length) return new Set();
  return new Set((await tx.execute(sql`SELECT DISTINCT participant_key FROM career_participant_bookings
    WHERE career_save_id = ${saveId} AND season = ${season} AND day IN (${sql.join(days.map(d => sql`${d}`), sql`, `)})`)).rows.map(row => String(row.participant_key)));
}
export async function insertBookings(tx: CareerExecutor, saveId: string, season: number, event: InstanceRow, participants: readonly string[]) {
  if (!participants.length) return;
  await tx.execute(bookingsInsert(saveId, season, event, participants));
}
/** The bookings INSERT, also composed into lockField's entries write (one round trip). */
function bookingsInsert(saveId: string, season: number, event: InstanceRow, participants: readonly string[]) {
  // A league books only its weekly nights, so its players keep their other events in between.
  const rows = participants.flatMap(key => playingDays(event).map(day => ({ participant_key: key, day })));
  // Primary key (save, season, participant, day) makes a double booking impossible even if code regresses.
  return sql`INSERT INTO career_participant_bookings (career_save_id, season, participant_key, day, event_id)
    SELECT ${saveId}::uuid, ${season}, b.participant_key, b.day, ${event.id}::uuid FROM jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) AS b(participant_key text, day integer)`;
}
async function exclusiveConflicts(tx: CareerExecutor, saveId: string, event: InstanceRow): Promise<Set<string>> {
  const group = event.snapshot.exclusiveGroup;
  if (!group) return new Set();
  return new Set((await tx.execute(sql`SELECT DISTINCT e.participant_key FROM career_event_entries e JOIN career_event_instances i
      ON i.career_save_id = e.career_save_id AND i.id = e.event_id
    WHERE e.career_save_id = ${saveId} AND i.season = ${event.season} AND e.status <> 'WITHDRAWN'
      AND i.snapshot->'exclusiveGroup'->>'key' = ${group.key} AND i.snapshot->'exclusiveGroup'->>'variant' <> ${group.variant}`)).rows.map(row => String(row.participant_key)));
}
export { exclusiveConflicts };

// ------------------------------------------------------------------ week preload (batched field locks)
/**
 * What every field lock of one week reads, loaded once and kept current in memory as each event locks
 * (bookings added/removed, entitlements consumed). lockField reads it instead of querying per event;
 * results are identical to the per-event queries because nothing else writes these rows mid-week.
 */
export type LockPreload = {
  season: number;
  bookings: Map<number, Map<string, string>>;        // day -> participant -> event
  entries: Map<string, Record<string, unknown>[]>;   // event -> non-withdrawn entries
  entitlements: { id: string; recipient_key: string; recipient_kind: string; target_key: string; consumption: string; active: boolean }[]; // ACTIVE at load, query order
  results: FactsContext["results"];
};
export async function preloadLocks(tx: CareerExecutor, saveId: string, season: number, events: readonly InstanceRow[]): Promise<LockPreload> {
  const days = new Set<number>();
  for (const e of events) {
    if (e.snapshot.format.structure === "LEAGUE") playingDays(e).forEach(d => days.add(d));
    else for (let d = e.start_day; d <= e.end_day; d++) days.add(d);
  }
  const bookings = new Map<number, Map<string, string>>();
  if (days.size) for (const r of (await tx.execute(sql`SELECT day, participant_key, event_id FROM career_participant_bookings
      WHERE career_save_id = ${saveId} AND season = ${season} AND day IN (${sql.join([...days].map(d => sql`${d}`), sql`, `)})`)).rows) {
    const day = Number(r.day);
    if (!bookings.has(day)) bookings.set(day, new Map());
    bookings.get(day)!.set(String(r.participant_key), String(r.event_id));
  }
  const entries = new Map<string, Record<string, unknown>[]>(events.map(e => [e.id, []]));
  if (events.length) for (const r of (await tx.execute(sql`SELECT * FROM career_event_entries WHERE career_save_id = ${saveId} AND status <> 'WITHDRAWN'
      AND event_id IN (${sql.join(events.map(e => sql`${e.id}::uuid`), sql`, `)})`)).rows) entries.get(String(r.event_id))?.push(r);
  const entitlements = (await tx.execute(sql`SELECT id, recipient_key, recipient_kind, target_key, consumption FROM career_qualification_entitlements
      WHERE career_save_id = ${saveId} AND target_season = ${season} AND status = 'ACTIVE' ORDER BY created_at, source_position NULLS LAST, id`)).rows
    .map(r => ({ id: String(r.id), recipient_key: String(r.recipient_key), recipient_kind: String(r.recipient_kind), target_key: String(r.target_key), consumption: String(r.consumption), active: true }));
  const definitions = new Set<string>();
  events.forEach(e => collectResultKeys(e.snapshot.eligibility, definitions));
  return { season, bookings, entries, entitlements, results: await loadResultFacts(tx, saveId, season, definitions) };
}
function bookedFrom(pre: LockPreload, days: readonly number[]) {
  const out = new Set<string>();
  for (const d of days) for (const key of pre.bookings.get(d)?.keys() ?? []) out.add(key);
  return out;
}
function rememberBookings(pre: LockPreload, event: InstanceRow, participants: readonly string[]) {
  for (const key of participants) for (const d of playingDays(event)) {
    if (!pre.bookings.has(d)) pre.bookings.set(d, new Map());
    pre.bookings.get(d)!.set(key, event.id);
  }
}
/** The same facts loadFactsContext returns, from the preload (ACTIVE entitlements as they stand now). */
async function factsFromPreload(tx: CareerExecutor, saveId: string, pre: LockPreload): Promise<FactsContext> {
  const entitlements = new Map<string, Set<string>>();
  for (const e of pre.entitlements) if (e.active) {
    if (!entitlements.has(e.recipient_key)) entitlements.set(e.recipient_key, new Set());
    entitlements.get(e.recipient_key)!.add(e.target_key);
  }
  return { season: pre.season, entitlements, results: pre.results, champions: await previousChampions(tx, saveId, pre.season) };
}
export function forgetBookings(pre: LockPreload | undefined, eventId: string) {
  if (pre) for (const day of pre.bookings.values()) for (const [key, id] of day) if (id === eventId) day.delete(key);
}

// ------------------------------------------------------------------ field assembly
type NewEntry = { participant_key: string; participant_kind: "HUMAN" | "NPC"; npc_id: string | null; source: string; entitlement_id: string | null };

/**
 * Lock the field: human entries, series carry-over, entitlement intake,
 * reserved qualifying places where general filler is disabled, invitations,
 * then deterministic weighted open selection. Writes entries,
 * bookings and consumed entitlements once; the instance then leaves
 * REGISTRATION_CLOSED so this can never run twice for the same event.
 */
export async function lockField(tx: CareerExecutor, root: RootRow, event: InstanceRow, npcs: readonly Npc[], providers: CalendarProviders, week: number, pre?: LockPreload): Promise<{ locked: boolean; entrants: number }> {
  const saveId = root.id, snapshot = event.snapshot;
  if (pre && pre.season !== event.season) throw new Error("Lock preload is for another season");
  const eventDays = event.snapshot.format.structure === "LEAGUE" ? playingDays(event) : Array.from({ length: event.end_day - event.start_day + 1 }, (_, i) => event.start_day + i);
  const booked = pre ? bookedFrom(pre, eventDays) : event.snapshot.format.structure === "LEAGUE" ? await bookedOnDays(tx, saveId, event.season, eventDays)
    : await bookedParticipants(tx, saveId, event.season, event.start_day, event.end_day);
  const excluded = await exclusiveConflicts(tx, saveId, event);
  const existing = pre ? pre.entries.get(event.id) ?? [] : (await tx.execute(sql`SELECT * FROM career_event_entries WHERE career_save_id = ${saveId} AND event_id = ${event.id} AND status <> 'WITHDRAWN'`)).rows;
  const taken = new Set(existing.map(row => String(row.participant_key)));
  const capacity = event.field_size;
  const additions: NewEntry[] = [];
  const consumed: string[] = [];
  const ctx = pre ? await factsFromPreload(tx, saveId, pre) : await loadFactsContext(tx, saveId, event.season, [snapshot.eligibility]);
  const free = (npc: Npc) => !taken.has(npc.id) && !booked.has(npc.id) && !excluded.has(npc.id);
  const add = (npc: Npc, source: string, entitlementId: string | null = null) => {
    taken.add(npc.id); additions.push({ participant_key: npc.id, participant_kind: "NPC", npc_id: npc.id, source, entitlement_id: entitlementId });
  };
  const eligible = (npc: Npc, invited = false) => evaluate(event, factsFor(npcParticipant(npc, providers), ctx, event, invited)).eligible;
  const byId = new Map(npcs.map(npc => [npc.id, npc]));
  const tierOf = (npc: Npc) => providers.sportingStatus.selectionTier?.(npc) ?? npc.tier;

  if (snapshot.fieldPolicy === "SERIES_FIRST_DAY" && event.series_key) {
    const first = (await tx.execute(sql`SELECT e.participant_key, e.participant_kind FROM career_event_entries e JOIN career_event_instances i
        ON i.career_save_id = e.career_save_id AND i.id = e.event_id
      WHERE e.career_save_id = ${saveId} AND i.season = ${event.season} AND i.series_key = ${event.series_key} AND i.series_day = 1 AND e.status = 'CONFIRMED'
      ORDER BY e.participant_key`)).rows;
    for (const row of first) {
      const npc = byId.get(String(row.participant_key));
      if (npc && free(npc) && taken.size < capacity) add(npc, "SERIES");
    }
  }
  if (snapshot.entitlementIntake.length) {
    const intake = new Set(snapshot.entitlementIntake);
    const rows = pre ? pre.entitlements.filter(e => e.active && e.recipient_kind === "NPC" && intake.has(e.target_key))
      : (await tx.execute(sql`SELECT id, recipient_key, consumption FROM career_qualification_entitlements
      WHERE career_save_id = ${saveId} AND target_season = ${event.season} AND status = 'ACTIVE' AND recipient_kind = 'NPC'
        AND target_key IN (${sql.join(snapshot.entitlementIntake.map(k => sql`${k}`), sql`, `)})
      ORDER BY created_at, source_position NULLS LAST, id`)).rows;
    for (const row of rows) {
      const npc = byId.get(String(row.recipient_key));
      if (!npc || !free(npc) || taken.size >= capacity || !eligible(npc)) continue;
      add(npc, "ENTITLEMENT", String(row.id));
      if (row.consumption === "SINGLE_USE") consumed.push(String(row.id));
    }
  }
  const rng = scopedRandom(root.world_seed, CALENDAR_GENERATION_VERSION, "field", event.season, event.instance_key);
  if (snapshot.invitationPolicy && snapshot.fieldPolicy === "SELECTION") {
    const policy = snapshot.invitationPolicy;
    // No-general-filler selection events still have genuine qualifying places
    // outside their invitation quota (e.g. Palace's 32 + 96). A zero filler
    // target must not discard them, nor may invitations consume the qualifying
    // pool first. Preserve eligibility, quotas and weights; intake qualifiers
    // before sampling invitations. Scarce-field attendance policies are unchanged.
    if (snapshot.npcFill[0] === 0 && snapshot.npcFill[1] === 0) {
      const need = Math.max(0, capacity - policy.count - taken.size);
      const pool = npcs.filter(npc => free(npc) && eligible(npc));
      const geo = { country: event.country, zone: event.zone, localityKey: event.locality_key };
      for (const npc of weightedSample(pool, npc => tierWeight(snapshot.npcTierWeights, npc, tierOf) * geographyWeight(snapshot.geography, geo, npc), need, rng))
        add(npc, "SELECTION");
    }
    const need = Math.min(capacity - taken.size, policy.count - additions.filter(a => a.source === "INVITATION").length);
    const pool = npcs.filter(npc => free(npc) && eligible(npc, true));
    for (const npc of weightedSample(pool, npc => tierWeight(policy.tierWeights, npc, tierOf), need, rng)) add(npc, "INVITATION");
  }
  // v13 pairs: World Cup national selection replaces open selection (each country's top two on the World Ranking).
  const pairs = snapshot.format.sideSize === 2;
  let teams: PairRow[] = [];
  if (pairs && snapshot.format.pairing === "NATION") {
    const rank = (key: string) => selectionRank(providers.sportingStatus.rankings(key));
    const candidates: PairCandidate[] = npcs.filter(npc => npc.status === "ACTIVE" && free(npc) && rank(npc.id) !== undefined)
      .map(npc => ({ key: npc.id, npcId: npc.id, country: dartsNation(npc.nationality, npcFacts(npc).locality), rank: rank(npc.id)! }));
    const human = humanParticipant(root, providers);
    if (root.status === "ACTIVE" && rank(HUMAN) !== undefined && !booked.has(HUMAN) && !excluded.has(HUMAN) && !taken.has(HUMAN))
      candidates.push({ key: HUMAN, npcId: null, country: dartsNation(human.country, human.locality), rank: rank(HUMAN)! });
    const selected = nationTeams(candidates, Math.floor((capacity - taken.size) / 2));
    for (const p of selected.players) {
      if (p.key === HUMAN) { taken.add(HUMAN); additions.push({ participant_key: HUMAN, participant_kind: "HUMAN", npc_id: null, source: "INVITATION", entitlement_id: null }); }
      else add(byId.get(p.key)!, "INVITATION");
    }
    teams = selected.teams;
  } else if (snapshot.fieldPolicy === "SELECTION") {
    const target = Math.max(taken.size, fillTarget(capacity, snapshot.npcFill, rng));
    const pool = npcs.filter(npc => free(npc) && eligible(npc));
    const geo = { country: event.country, zone: event.zone, localityKey: event.locality_key };
    for (const npc of weightedSample(pool, npc => tierWeight(snapshot.npcTierWeights, npc, tierOf) * geographyWeight(snapshot.geography, geo, npc), target - taken.size, rng)) add(npc, "SELECTION");
  }
  // v14+: a local, county or regional selection event short of its minimum is topped up with guests from further
  // afield (nearest first, same level and status rules, only their home location relaxed) instead of being cancelled.
  // National titles and tours keep their own field, and are cancelled honestly when it is too thin.
  if (!pairs && guestTopUpApplies(event) && taken.size < event.minimum_entrants) {
    const guest = (npc: Npc) => guestEligible(event, factsFor(npcParticipant(npc, providers), ctx, event));
    const geo = { country: event.country, zone: event.zone, localityKey: event.locality_key };
    const pool = npcs.filter(npc => free(npc) && guest(npc));
    const topUp = scopedRandom(root.world_seed, CALENDAR_GENERATION_VERSION, "field-top-up", event.season, event.instance_key);
    for (const npc of weightedSample(pool, npc => tierWeight(snapshot.npcTierWeights, npc, tierOf) * Math.max(0.01, geographyWeight(snapshot.geography, geo, npc)),
      Math.min(capacity, event.minimum_entrants) - taken.size, topUp)) add(npc, "SELECTION");
  }
  if (pairs && snapshot.format.pairing === "LOCAL") {
    const order = [...existing.map(row => String(row.participant_key)), ...additions.map(a => a.participant_key)];
    const human = humanParticipant(root, providers);
    const local = localTeams(order.map(key => ({ key, npc: key === HUMAN ? null : byId.get(key) ?? null })), { country: human.country, locality: human.locality });
    teams = local.teams;
    // The odd player out is not entered (an existing human entry is always paired when any NPC was selected).
    for (const key of local.unpaired) {
      const at = additions.findIndex(a => a.participant_key === key);
      if (at >= 0) { taken.delete(key); additions.splice(at, 1); }
    }
  }
  const entrants = taken.size;
  if (entrants < runsWith(event) || entrants < 2 || (pairs && (teams.length < 2 || teams.length * 2 !== entrants))) {
    // Unfillable: cancel honestly; the human keeps no booking for a cancelled event.
    await tx.execute(sql`DELETE FROM career_participant_bookings WHERE career_save_id = ${saveId} AND event_id = ${event.id}`);
    forgetBookings(pre, event.id);
    await tx.execute(sql`UPDATE career_event_entries SET status = 'WITHDRAWN', withdrawn_at = NOW() WHERE career_save_id = ${saveId} AND event_id = ${event.id} AND status <> 'WITHDRAWN'`);
    await transition(tx, event, "CANCELLED", { reason: "INSUFFICIENT_ENTRANTS" });
    await providers.finance?.onEventCancelled(tx, root, event, "INSUFFICIENT_ENTRANTS");
    return { locked: false, entrants };
  }
  if (additions.length) {
    // Entries and their bookings in one statement (independent rows; both inserts always run).
    await tx.execute(sql`WITH entries AS (INSERT INTO career_event_entries (career_save_id, event_id, participant_key, participant_kind, npc_id, source, entitlement_id, status, entered_season, entered_week)
      SELECT ${saveId}::uuid, ${event.id}::uuid, a.participant_key, a.participant_kind, a.npc_id, a.source, a.entitlement_id, 'CONFIRMED', ${event.season}, ${week}
      FROM jsonb_to_recordset(${JSON.stringify(additions)}::jsonb) AS a(participant_key text, participant_kind text, npc_id uuid, source text, entitlement_id uuid) RETURNING 1)
      ${bookingsInsert(saveId, event.season, event, additions.map(a => a.participant_key))}`);
    if (pre) rememberBookings(pre, event, additions.map(a => a.participant_key));
  }
  if (existing.some(row => row.status === "ENTERED"))
    await tx.execute(sql`UPDATE career_event_entries SET status = 'CONFIRMED' WHERE career_save_id = ${saveId} AND event_id = ${event.id} AND status = 'ENTERED'`);
  if (consumed.length) {
    await tx.execute(sql`UPDATE career_qualification_entitlements SET status = 'CONSUMED', consumed_by_event_id = ${event.id}, resolved_at = NOW()
      WHERE career_save_id = ${saveId} AND status = 'ACTIVE' AND id IN (${sql.join(consumed.map(id => sql`${id}::uuid`), sql`, `)})`);
    if (pre) for (const e of pre.entitlements) if (consumed.includes(e.id)) e.active = false;
  }
  await insertPairs(tx, saveId, event.id, teams);
  await transition(tx, event, "DRAW_PENDING", { set: sql`entrant_count = ${entrants}, field_locked_at = NOW()` });
  event.entrant_count = entrants;
  return { locked: true, entrants };
}

/**
 * Fewest entrants an event runs with. From event database v14 a knockout plays whoever turns up, as real events
 * do: the draw shrinks to fit and the gaps are byes (two players make a final; pairs need two teams). Group and
 * league formats keep their authored minimum (their tables need a full field).
 */
export const runsWith = (event: Pick<InstanceRow, "event_database_version" | "minimum_entrants" | "snapshot">) =>
  event.event_database_version >= GUEST_TOP_UP_FROM && !isGroupedStructure(event.snapshot.format.structure)
    ? Math.min(event.minimum_entrants, event.snapshot.format.sideSize === 2 ? 4 : 2) : event.minimum_entrants;

/** Event database version from which short fields are topped up with guests rather than cancelled. */
export const GUEST_TOP_UP_FROM = 14;
const GUEST_TOP_UP_CIRCUITS = new Set(["GRASSROOTS", "SPECIAL", "COUNTY", "REGIONAL"]);
export const guestTopUpApplies = (event: InstanceRow) => event.snapshot.fieldPolicy === "SELECTION" && !event.snapshot.invitationPolicy
  && event.event_database_version >= GUEST_TOP_UP_FROM && GUEST_TOP_UP_CIRCUITS.has(event.circuit);
/** A guest meets every rule of the event except where they live (level, status, age and category still apply). */
export const guestEligible = (event: InstanceRow, facts: ParticipantFacts) =>
  evaluate(event, { ...facts, country: event.country, zone: event.zone as ParticipantFacts["zone"], locality: event.locality_key }).eligible;

// ------------------------------------------------------------------ draw
export const matchKeyFor = (event: InstanceRow, stage: string, round: number, slot: number) => `a3:${event.id}:${stage}:r${round}:m${slot}`;
const roundDay = (event: InstanceRow, round: number, rounds: number) => event.start_day + Math.floor((round - 1) * (event.end_day - event.start_day + 1) / rounds);

/**
 * Official draws for a week's locked events: generated once from each locked field, persisted with every
 * bracket slot. One read for every field, then one write each for matches, seeds and the two status steps
 * (DRAWN, IN_PROGRESS) across all events, instead of five round trips per event. Draws are independent.
 */
/** One event's official draw (the batched path with a single event). */
export async function makeDraw(tx: CareerExecutor, root: RootRow, event: InstanceRow, providers: CalendarProviders) {
  await makeDraws(tx, root, [event], providers);
}
export async function makeDraws(tx: CareerExecutor, root: RootRow, events: readonly InstanceRow[], providers: CalendarProviders) {
  if (!events.length) return;
  for (const event of events) if (event.status !== "DRAW_PENDING") throw new CareerError(409, "Draw requires a locked field");
  const ids = sql.join(events.map(e => sql`${e.id}::uuid`), sql`, `);
  // Existing-draw guard and the confirmed field of every event in one round trip.
  const fields = new Map((await tx.execute(sql`SELECT i.id, EXISTS (SELECT 1 FROM career_tournament_matches m WHERE m.career_save_id = i.career_save_id AND m.event_id = i.id) AS already,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('participant_key', e.participant_key, 'npc_id', e.npc_id) ORDER BY e.participant_key)
        FROM career_event_entries e WHERE e.career_save_id = i.career_save_id AND e.event_id = i.id AND e.status = 'CONFIRMED'), '[]'::jsonb) AS entries
    FROM career_event_instances i WHERE i.career_save_id = ${root.id} AND i.id IN (${ids})`)).rows.map(r => [String(r.id), r]));
  const pairEvents = events.filter(e => e.snapshot.format.sideSize === 2).map(e => e.id);
  const pairs = await loadPairs(tx, root.id, pairEvents);
  const matchRows: Record<string, unknown>[] = [], seedRows: Record<string, unknown>[] = [], drawn: { id: string; draw: unknown }[] = [];
  for (const event of events) {
    const field = fields.get(event.id);
    if (!field || field.already === true) throw new CareerError(409, "Official draw already exists");
    const allEntries = field.entries as { participant_key: string; npc_id: string | null }[];
    // Pairs: the bracket holds each team's captain.
    const captains = event.snapshot.format.sideSize === 2 ? new Set([...pairs.values()].filter(p => p.event_id === event.id).map(p => p.captain_key)) : null;
    const entries = captains ? allEntries.filter(row => captains.has(String(row.participant_key))) : allEntries;
    const keys = entries.map(row => String(row.participant_key));
    const npcOf = new Map(entries.map(row => [String(row.participant_key), row.npc_id ? String(row.npc_id) : null]));
    const policy = event.snapshot.seedingPolicy;
    const seeded = policy.list ? providers.seeding.order(policy.list, keys) : [];
    const draw = generateKnockoutDraw(keys, seeded, policy.seeds, scopedRandom(root.world_seed, CALENDAR_GENERATION_VERSION, "draw", event.season, event.instance_key));
    const groups = isGroupedStructure(event.snapshot.format.structure), layout = layoutFor(event.snapshot.format.structure);
    const stage = groups ? "knockout" : event.snapshot.format.stages[0].key;
    const rows: Record<string, unknown>[] = groups ? makeGroupRows(root, event, draw.positions.map(p => p.participantKey), layout) : [];
    const rounds = groups ? layout.knockoutRounds : draw.rounds;
    for (let round = 1; round <= rounds; round++) {
      const slots = (groups ? 2 ** layout.knockoutRounds : draw.size) / 2 ** round;
      for (let slot = 1; slot <= slots; slot++) {
        const a = !groups && round === 1 ? draw.positions[(slot - 1) * 2].participantKey : null;
        const b = !groups && round === 1 ? draw.positions[(slot - 1) * 2 + 1].participantKey : null;
        const bye = !groups && round === 1 && (!a || !b);
        rows.push({ id: stableUuid(root.world_seed, CALENDAR_GENERATION_VERSION, "tournament-match", event.id, stage, round, slot), stage_key: stage, round, slot,
          best_of: groups ? event.snapshot.format.stages[1].bestOfByRound[round - 1] : bestOfForRound(event.snapshot.format, round, draw.rounds),
          // League play-offs (semi-finals and final) are on the last night.
          scheduled_day: groups ? (layout.kind === "LEAGUE" ? event.end_day : tournamentDay(event, round + 3, 6)) : roundDay(event, round, draw.rounds),
          a_key: a, b_key: b, a_npc_id: a ? npcOf.get(a) : null, b_npc_id: b ? npcOf.get(b) : null,
          status: bye ? "BYE" : "PENDING", winner_key: bye ? (a ?? b) : null, result_source: bye ? "BYE" : null,
          first_throw_method: event.snapshot.format.firstThrowMethod });
      }
    }
    for (const row of rows) matchRows.push({ ...row, event_id: event.id });
    for (const p of draw.positions) if (p.participantKey && p.seed) seedRows.push({ event_id: event.id, participant_key: p.participantKey, seed: p.seed });
    drawn.push({ id: event.id, draw: { draw: { size: draw.size, rounds: draw.rounds, byes: draw.byes, seedingProvider: providers.seeding.id, seeded: draw.seededKeys.length } } });
  }
  await tx.execute(sql`INSERT INTO career_tournament_matches (career_save_id, id, event_id, stage_key, round, slot, best_of, scheduled_day, a_key, b_key, a_npc_id, b_npc_id,
      status, winner_key, result_source, first_throw_method, completed_at)
    SELECT ${root.id}::uuid, m.id, m.event_id, m.stage_key, m.round, m.slot, m.best_of, m.scheduled_day, m.a_key, m.b_key, m.a_npc_id, m.b_npc_id,
      m.status, m.winner_key, m.result_source, m.first_throw_method, CASE WHEN m.status = 'BYE' THEN NOW() END
    FROM jsonb_to_recordset(${JSON.stringify(matchRows)}::jsonb) AS m(id uuid, event_id uuid, stage_key text, round integer, slot integer, best_of integer, scheduled_day integer,
      a_key text, b_key text, a_npc_id uuid, b_npc_id uuid, status text, winner_key text, result_source text, first_throw_method text)`);
  if (seedRows.length) {
    await tx.execute(sql`UPDATE career_event_entries e SET draw_seed = s.seed FROM jsonb_to_recordset(${JSON.stringify(seedRows)}::jsonb) AS s(event_id uuid, participant_key text, seed integer)
      WHERE e.career_save_id = ${root.id} AND e.event_id = s.event_id AND e.participant_key = s.participant_key`);
  }
  // DRAW_PENDING -> DRAWN -> IN_PROGRESS for every event: two writes, each row checked by the history trigger.
  assertTransition("DRAW_PENDING", "DRAWN"); assertTransition("DRAWN", "IN_PROGRESS");
  const toDrawn = await tx.execute(sql`UPDATE career_event_instances i SET status = 'DRAWN', status_reason = NULL, drawn_at = NOW(), snapshot = i.snapshot || d.draw
    FROM jsonb_to_recordset(${JSON.stringify(drawn)}::jsonb) AS d(id uuid, draw jsonb)
    WHERE i.career_save_id = ${root.id} AND i.id = d.id AND i.status = 'DRAW_PENDING' RETURNING i.id`);
  if (toDrawn.rows.length !== events.length) throw new CareerError(409, "Career event changed concurrently");
  const toLive = await tx.execute(sql`UPDATE career_event_instances SET status = 'IN_PROGRESS', status_reason = NULL
    WHERE career_save_id = ${root.id} AND status = 'DRAWN' AND id IN (${ids}) RETURNING id`);
  if (toLive.rows.length !== events.length) throw new CareerError(409, "Career event changed concurrently");
  for (const event of events) { event.status = "IN_PROGRESS"; event.status_reason = null; }
}

// ------------------------------------------------------------------ bull-up (first throw)
/**
 * Deterministic simulated bull-up for NPC-vs-NPC: each player throws at the bull,
 * nearest begins. Distance spread narrows with finishing/consistency. Not a coin flip;
 * the throws are persisted. Human matches leave first throw to live play.
 */
export function simulateBullUp(a: Npc, b: Npc, seed: string, matchKey: string) {
  const rng = scopedRandom(seed, CALENDAR_GENERATION_VERSION, "bull-up", matchKey);
  const spread = (npc: Npc) => 4 + (100 - (npc.ability.finishing + npc.ability.consistency) / 2) * 0.35;
  const throws: [number, number][] = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    const da = Math.round(Math.abs(normal(rng)) * spread(a) * 10) / 10, db = Math.round(Math.abs(normal(rng)) * spread(b) * 10) / 10;
    throws.push([da, db]);
    if (da !== db) return { firstThrow: (da < db ? 0 : 1) as 0 | 1, throws, method: "SIMULATED_BULL_UP" };
  }
  return { firstThrow: 0 as const, throws, method: "SIMULATED_BULL_UP_DRAW_ORDER" };
}

// ------------------------------------------------------------------ progression
export async function loadMatches(tx: CareerExecutor, saveId: string, eventId: string): Promise<MatchRow[]> {
  return (await tx.execute(sql`SELECT * FROM career_tournament_matches WHERE career_save_id = ${saveId} AND event_id = ${eventId} ORDER BY stage_key, round, slot`)).rows as MatchRow[];
}
const FINAL = new Set(["COMPLETED", "BYE", "WALKOVER", "VOID"]);

/** Fill next-round slots from finished matches. Pure over rows; returns the updates. */
function propagate(matches: MatchRow[]) {
  const byPos = new Map(matches.filter(m => !isGroupMatch(m)).map(m => [`${m.stage_key}:${m.round}:${m.slot}`, m]));
  const updates: MatchRow[] = [];
  for (const m of matches) {
    if (isGroupMatch(m) || !FINAL.has(m.status) || !m.winner_key) continue;
    const next = byPos.get(`${m.stage_key}:${m.round + 1}:${Math.ceil(m.slot / 2)}`);
    if (!next || FINAL.has(next.status)) continue;
    const side = m.slot % 2 === 1 ? "a" : "b";
    if (next[`${side}_key`] === m.winner_key) continue;
    if (next[`${side}_key`]) throw new CareerError(409, "Bracket slot already holds a different player");
    next[`${side}_key`] = m.winner_key;
    next[`${side}_npc_id`] = m.winner_key === HUMAN ? null : m.winner_key;
    updates.push(next);
  }
  return updates;
}
async function resolveEmptyPaths(tx: CareerExecutor, saveId: string, matches: MatchRow[]) {
  let changed = false;
  for (const m of matches.filter(m => !isGroupMatch(m) && m.round > 1 && !FINAL.has(m.status))) {
    const feeders = matches.filter(f => f.stage_key === m.stage_key && f.round === m.round - 1
      && [m.slot * 2 - 1,m.slot * 2].includes(f.slot));
    if (feeders.length !== 2 || !feeders.every(f => FINAL.has(f.status)) || feeders.every(f => f.winner_key)) continue;
    const winner = feeders.find(f => f.winner_key)?.winner_key ?? null;
    await tx.execute(sql`UPDATE career_tournament_matches SET a_key=${feeders[0].winner_key},b_key=${feeders[1].winner_key},
      a_npc_id=${feeders[0].winner_key === HUMAN ? null : feeders[0].winner_key},
      b_npc_id=${feeders[1].winner_key === HUMAN ? null : feeders[1].winner_key},
      status=${winner ? "WALKOVER" : "VOID"},winner_key=${winner},result_source='WALKOVER',
      summary='{"reason":"WITHDRAWN_OPPONENT_PATH"}'::jsonb,completed_at=NOW()
      WHERE career_save_id=${saveId} AND id=${m.id} AND status IN ('PENDING','AWAITING_HUMAN')`);
    changed = true;
  }
  return changed;
}
async function saveSlotUpdates(tx: CareerExecutor, saveId: string, rows: MatchRow[]) {
  if (!rows.length) return;
  await tx.execute(sql`UPDATE career_tournament_matches t SET a_key = u.a_key, b_key = u.b_key, a_npc_id = u.a_npc_id, b_npc_id = u.b_npc_id, status = u.status
    FROM jsonb_to_recordset(${JSON.stringify(rows.map(r => ({ id: r.id, a_key: r.a_key, b_key: r.b_key, a_npc_id: r.a_npc_id, b_npc_id: r.b_npc_id, status: r.status })))}::jsonb)
      AS u(id uuid, a_key text, b_key text, a_npc_id uuid, b_npc_id uuid, status text)
    WHERE t.career_save_id = ${saveId} AND t.id = u.id`);
}

/** Single-event convenience wrapper (human result / withdrawal paths). */
export async function progressEvent(tx: CareerExecutor, root: RootRow, world: World, event: InstanceRow, uptoDay: number, providers?: CalendarProviders) {
  const out = await progressEvents(tx, root, world, [event], uptoDay, providers);
  return { completed: event.status === "COMPLETED", awaitingHuman: out.awaitingHuman, simulated: out.simulated };
}

/**
 * Advance live tournaments as far as the calendar allows (rounds scheduled on or
 * before `uptoDay`). Works in waves across all supplied events: one bracket load,
 * one A2 simulation batch and one bulk update per wave. NPC-vs-NPC matches run
 * through A2 in a stable order (event start, key, round, slot). Human matches stop
 * at AWAITING_HUMAN; everything not depending on them continues.
 */
export async function progressEvents(tx: CareerExecutor, root: RootRow, world: World, events: InstanceRow[], uptoDay: number, providers?: CalendarProviders): Promise<{ completed: number; awaitingHuman: MatchRow[]; simulated: number }> {
  let live = events.filter(e => e.status === "IN_PROGRESS").sort((a, b) => a.start_day - b.start_day || (a.instance_key < b.instance_key ? -1 : 1));
  let simulated = 0, completed = 0;
  let awaiting: MatchRow[] = [];
  for (let guard = 0; guard < 60 && live.length; guard++) {
    let structureChanged = false;
    const ids = live.map(e => sql`${e.id}::uuid`);
    const all = (await tx.execute(sql`SELECT * FROM career_tournament_matches WHERE career_save_id = ${root.id} AND event_id IN (${sql.join(ids, sql`, `)}) ORDER BY stage_key, round, slot`)).rows as MatchRow[];
    const withdrawnRows = (await tx.execute(sql`SELECT event_id, participant_key FROM career_event_entries WHERE career_save_id = ${root.id} AND event_id IN (${sql.join(ids, sql`, `)}) AND status = 'WITHDRAWN'`)).rows;
    const withdrawn = new Set(withdrawnRows.map(r => `${r.event_id}|${r.participant_key}`));
    const slotUpdates: MatchRow[] = [], walkovers: { id: string; winner_key: string | null; a_key: string; b_key: string; a_npc_id: string | null; b_npc_id: string | null }[] = [];
    const npcReady: { event: InstanceRow; match: MatchRow; rounds: number }[] = [];
    const finishedEvents: { event: InstanceRow; matches: MatchRow[]; rounds: number }[] = [];
    awaiting = [];
    for (const event of live) {
      const matches = all.filter(m => m.event_id === event.id);
      if (!matches.length) throw new CareerError(409, "Active tournament has no official draw");
      const officialSize = (event.snapshot as unknown as {draw?:{size:number}}).draw?.size;
      const expected = isGroupedStructure(event.snapshot.format.structure) ? layoutFor(event.snapshot.format.structure).fixtures : officialSize ? officialSize-1 : null;
      if (expected !== null && matches.length !== expected) throw new CareerError(409,"Official draw has missing or extra fixtures; it has not been regenerated");
      const knockout = matches.filter(m => !isGroupMatch(m));
      const rounds = Math.max(...knockout.map(m => m.round));
      const finals = knockout.filter(m => m.round === rounds);
      if (finals.length !== 1) throw new CareerError(409, "Official tournament final is missing or ambiguous");
      const final = finals[0];
      if (final.status === "VOID") {
        await transition(tx,event,"CANCELLED",{reason:"NO_REMAINING_PARTICIPANTS"});
        await tx.execute(sql`DELETE FROM career_participant_bookings WHERE career_save_id=${root.id} AND event_id=${event.id}`);
        structureChanged = true; continue;
      }
      if (FINAL.has(final.status) && final.winner_key) {
        if (matches.some(m=>!FINAL.has(m.status))) throw new CareerError(409,"Final result conflicts with unfinished tournament fixtures");
        finishedEvents.push({ event, matches, rounds }); continue;
      }
      if (isGroupedStructure(event.snapshot.format.structure)) {
        const out = await progressGroups(tx, root, event, matches, new Set(withdrawnRows.filter(r => r.event_id === event.id).map(r => String(r.participant_key))), layoutFor(event.snapshot.format.structure));
        if (out.changed) { structureChanged = true; continue; } // Reload persisted slots before simulating.
      }
      if (await resolveEmptyPaths(tx,root.id,matches)) { structureChanged = true; continue; }
      const updates = propagate(matches);
      const isOut = (key: string | null) => !!key && withdrawn.has(`${event.id}|${key}`);
      const humanPending = matches.filter(m => [m.a_key,m.b_key].includes(HUMAN) && !FINAL.has(m.status)
        && !withdrawn.has(`${event.id}|${HUMAN}`)).sort((a,b) => Number(!isGroupMatch(a))-Number(!isGroupMatch(b)) || a.round-b.round)[0];
      const ready = matches.filter(m => (m.status === "PENDING" || m.status === "AWAITING_HUMAN") && m.a_key && m.b_key && m.scheduled_day <= uptoDay
        && (!humanPending || (isGroupMatch(m) === isGroupMatch(humanPending) && m.round <= humanPending.round)));
      let changed = updates.length > 0;
      for (const m of ready) {
        if (isOut(m.a_key) || isOut(m.b_key)) {
          // Auditable post-lock withdrawal: concede once the opponent is known.
          walkovers.push({ id: m.id, winner_key: isOut(m.a_key) && isOut(m.b_key) ? null : isOut(m.a_key) ? m.b_key! : m.a_key!, a_key: m.a_key!, b_key: m.b_key!, a_npc_id: m.a_npc_id, b_npc_id: m.b_npc_id });
          changed = true;
        } else if (m.a_key === HUMAN || m.b_key === HUMAN) {
          if (m.status === "PENDING") { m.status = "AWAITING_HUMAN"; if (!updates.includes(m)) updates.push(m); changed = true; }
          awaiting.push(m);
        } else if (m.status === "PENDING") npcReady.push({ event, match: m, rounds });
      }
      const walkoverIds = new Set(walkovers.map(w => w.id));
      slotUpdates.push(...updates.filter(u => !walkoverIds.has(u.id)));
      if (!changed && !npcReady.some(r => r.event === event)) continue;
    }
    await completeEvents(tx, root, finishedEvents, providers); completed += finishedEvents.length;
    await saveSlotUpdates(tx, root.id, slotUpdates);
    if (walkovers.length) {
      await tx.execute(sql`UPDATE career_tournament_matches t SET status = CASE WHEN w.winner_key IS NULL THEN 'VOID' ELSE 'WALKOVER' END, winner_key = w.winner_key, result_source = 'WALKOVER', completed_at = NOW(),
          a_key = w.a_key, b_key = w.b_key, a_npc_id = w.a_npc_id, b_npc_id = w.b_npc_id
        FROM jsonb_to_recordset(${JSON.stringify(walkovers)}::jsonb) AS w(id uuid, winner_key text, a_key text, b_key text, a_npc_id uuid, b_npc_id uuid)
        WHERE t.career_save_id = ${root.id} AND t.id = w.id AND t.status IN ('PENDING','AWAITING_HUMAN')`);
    }
    const doneIds = new Set(finishedEvents.map(f => f.event.id));
    live = live.filter(e => !doneIds.has(e.id) && e.status === "IN_PROGRESS");
    if (!npcReady.length) {
      if (!slotUpdates.length && !walkovers.length && !finishedEvents.length && !structureChanged) break;
      continue;
    }
    const npcs = new Map((await loadNpcs(tx, root.id, { ids: [...new Set(npcReady.flatMap(r => [r.match.a_key!, r.match.b_key!]))] })).map(n => [n.id, n]));
    const pairEvents = [...new Set(npcReady.filter(r => r.event.snapshot.format.sideSize === 2).map(r => r.event.id))];
    const teams = await loadPairs(tx, root.id, pairEvents);
    const partnerOf = (eventId: string, captain: string) => {
      const team = teams.get(`${eventId}|${captain}`);
      if (!team) throw new CareerError(409, "Pairs match has no recorded team");
      return team.partner_npc_id;
    };
    const requests = npcReady.map(({ event, match: m, rounds }) => {
      const key = matchKeyFor(event, m.stage_key, m.round, m.slot);
      const bull = simulateBullUp(npcs.get(m.a_key!)!, npcs.get(m.b_key!)!, root.world_seed, key);
      m.first_throw = bull.firstThrow; m.first_throw_detail = { method: bull.method, throws: bull.throws };
      return { matchKey: key, playerAId: m.a_key!, playerBId: m.b_key!,
        context: { category: event.snapshot.format.matchContext, roundImportance: Math.round(m.round / (isGroupMatch(m) ? layoutFor(event.snapshot.format.structure).schedule.length : rounds) * 1000) / 1000, elimination: !isGroupMatch(m) },
        format: a2MatchFormat(event.snapshot.format, m.best_of, bull.firstThrow),
        ...(event.snapshot.format.sideSize === 2 ? { partners: [partnerOf(event.id, m.a_key!), partnerOf(event.id, m.b_key!)] as [string, string] } : {}) };
    });
    const results = await simulateMatchesInTransaction(tx, root, world, requests);
    simulated += results.length;
    const done = npcReady.map(({ match: m }, i) => {
      const r = results[i];
      // legs_a/legs_b are always total legs; set play also records the set score in the summary.
      return { id: m.id, winner_key: r.winnerId, legs_a: r.stats[0].legsWon, legs_b: r.stats[1].legsWon, first_throw: m.first_throw,
        first_throw_detail: m.first_throw_detail, simulated_match_key: requests[i].matchKey,
        summary: { averages: [round2(r.stats[0].average), round2(r.stats[1].average)], checkoutPercentages: [round2(r.stats[0].checkoutPercentage), round2(r.stats[1].checkoutPercentage)],
          maximums: [r.stats[0].maximums, r.stats[1].maximums], highestCheckouts: [r.stats[0].highestCheckout, r.stats[1].highestCheckout], simulationVersion: r.simulationVersion,
          ...(r.stats[0].setsWon !== undefined ? { sets: [r.stats[0].setsWon, r.stats[1].setsWon] } : {}) } };
    });
    await tx.execute(sql`UPDATE career_tournament_matches t SET status = 'COMPLETED', winner_key = d.winner_key, legs_a = d.legs_a, legs_b = d.legs_b,
        first_throw = d.first_throw, first_throw_detail = d.first_throw_detail, result_source = 'A2_SIMULATION', simulated_match_key = d.simulated_match_key,
        summary = d.summary, completed_at = NOW()
      FROM jsonb_to_recordset(${JSON.stringify(done)}::jsonb) AS d(id uuid, winner_key text, legs_a integer, legs_b integer, first_throw integer,
        first_throw_detail jsonb, simulated_match_key text, summary jsonb)
      WHERE t.career_save_id = ${root.id} AND t.id = d.id AND t.status = 'PENDING'`);
  }
  return { completed, awaitingHuman: awaiting, simulated };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Permanent facts for every event that finished in this pass: results for every confirmed entrant, champion,
 * entitlement outputs. Written together (one read of entries, one insert of results and of entitlements, one
 * status write), then A4 and A5 process the same immutable results in event order.
 */
async function completeEvents(tx: CareerExecutor, root: RootRow, finished: readonly { event: InstanceRow; matches: MatchRow[]; rounds: number }[], providers?: CalendarProviders) {
  if (!finished.length) return;
  const ids = finished.map(f => sql`${f.event.id}::uuid`);
  const entryRows = (await tx.execute(sql`SELECT event_id, participant_key, participant_kind, npc_id FROM career_event_entries WHERE career_save_id = ${root.id}
    AND event_id IN (${sql.join(ids, sql`, `)}) ORDER BY participant_key`)).rows;
  // Pairs: the captain's result names the partner (partners have no result row of their own; the pair is one entrant).
  const teams = await loadPairs(tx, root.id, finished.filter(f => f.event.snapshot.format.sideSize === 2).map(f => f.event.id));
  const done = finished.map(({ event, matches, rounds }) => {
    // Everyone placed in the official draw gets a permanent result, including post-lock withdrawals.
    const drawn = new Set(matches.flatMap(m => [m.a_key, m.b_key]).filter((k): k is string => !!k));
    const entries = entryRows.filter(e => String(e.event_id) === event.id && drawn.has(String(e.participant_key)));
    const { results, champion } = eventResults(root, event, matches, rounds, entries, teams);
    return { event, results, champion };
  });
  await tx.execute(sql`INSERT INTO career_event_results (career_save_id, event_id, participant_key, participant_kind, npc_id, season, definition_key, finishing_position,
      stage_reached, is_champion, matches_played, wins, losses, legs_for, legs_against, metadata)
    SELECT ${root.id}::uuid, r.event_id, r.participant_key, r.participant_kind, r.npc_id, r.season, r.definition_key, r.finishing_position,
      r.stage_reached, r.is_champion, r.matches_played, r.wins, r.losses, r.legs_for, r.legs_against, r.metadata
    FROM jsonb_to_recordset(${JSON.stringify(done.flatMap(d => d.results.map(r => ({ ...r, event_id: d.event.id, season: d.event.season, definition_key: d.event.definition_key }))))}::jsonb)
      AS r(event_id uuid, season integer, definition_key text, participant_key text, participant_kind text, npc_id uuid, finishing_position integer, stage_reached text,
      is_champion boolean, matches_played integer, wins integer, losses integer, legs_for integer, legs_against integer, metadata jsonb)
    ON CONFLICT (career_save_id, event_id, participant_key) DO NOTHING`);
  for (const season of new Set(done.map(d => d.event.season))) {
    const grants = done.filter(d => d.event.season === season).flatMap(({ event, results }) => eventGrants(root, event, results));
    if (grants.length) await insertEntitlements(tx, root.id, season, grants, "EVENT_RESULT");
  }
  for (const { event } of done) assertTransition(event.status, "COMPLETED");
  const champions = done.map(d => ({ id: d.event.id, from: d.event.status, champion: d.champion, npc: d.champion === HUMAN ? null : d.champion }));
  const moved = await tx.execute(sql`UPDATE career_event_instances e SET status = 'COMPLETED', status_reason = NULL, champion_participant_key = c.champion,
      champion_npc_id = c.npc, completed_at = NOW()
    FROM jsonb_to_recordset(${JSON.stringify(champions)}::jsonb) AS c(id uuid, "from" text, champion text, npc uuid)
    WHERE e.career_save_id = ${root.id} AND e.id = c.id AND e.status = c."from" RETURNING e.id`);
  if (moved.rows.length !== done.length) throw new CareerError(409, "Career event changed concurrently");
  for (const d of done) { d.event.status = "COMPLETED"; d.event.status_reason = null; }
  // A4: financial consequences of the immutable results (exactly-once via ledger operation keys), then A5 rankings / Q-School from the same facts.
  const batch = done.map(d => ({ event: d.event, results: d.results }));
  if (providers?.finance?.onEventsCompleted) await providers.finance.onEventsCompleted(tx, root, batch);
  else for (const d of batch) await providers?.finance?.onEventCompleted(tx, root, d.event, d.results);
  if (providers?.sporting?.onEventsCompleted) await providers.sporting.onEventsCompleted(tx, root, batch);
  else for (const d of batch) await providers?.sporting?.onEventCompleted(tx, root, d.event, d.results);
}

function eventResults(root: RootRow, event: InstanceRow, matches: MatchRow[], rounds: number, entries: readonly Record<string, unknown>[], teams: Awaited<ReturnType<typeof loadPairs>>) {
  const final = matches.find(m => !isGroupMatch(m) && m.round === rounds)!;
  const champion = final.winner_key!;
  // League: players who miss the play-offs finish in their table position (5th-8th; tied rows share a place).
  const leagueRank = new Map<string, number>();
  if (event.snapshot.format.structure === "LEAGUE") {
    let place = 1;
    for (const bucket of groupTable(matches, "L", new Set(), layoutFor("LEAGUE")).buckets) { for (const p of bucket) leagueRank.set(p.key, place); place += bucket.length; }
  }
  const results = entries.map(entry => {
    const key = String(entry.participant_key);
    const team = teams.get(`${event.id}|${key}`);
    const played = matches.filter(m => m.a_key === key || m.b_key === key);
    const lost = played.find(m => !isGroupMatch(m) && FINAL.has(m.status) && m.winner_key !== key && m.status !== "BYE");
    const groupOut = isGroupedStructure(event.snapshot.format.structure) && !played.some(m => !isGroupMatch(m));
    const completed = played.filter(m => m.status === "COMPLETED");
    const legs = completed.reduce((acc, m) => { const mine = m.a_key === key; acc[0] += (mine ? m.legs_a : m.legs_b) ?? 0; acc[1] += (mine ? m.legs_b : m.legs_a) ?? 0; return acc; }, [0, 0]);
    const isChampion = key === champion;
    const position = isChampion ? 1 : groupOut ? (leagueRank.get(key) ?? 9) : lost ? finishingPosition(lost.round, rounds) : finishingPosition(1, rounds);
    return { participant_key: key, participant_kind: String(entry.participant_kind), npc_id: entry.npc_id ? String(entry.npc_id) : null,
      finishing_position: position, stage_reached: isChampion ? "CHAMPION" : groupOut ? "GROUP_STAGE" : lost ? stageName(lost.round, rounds) : stageName(1, rounds), is_champion: isChampion,
      matches_played: completed.length, wins: completed.filter(m => m.winner_key === key).length, losses: completed.filter(m => m.winner_key !== key).length,
      legs_for: legs[0], legs_against: legs[1],
      metadata: { byes: played.filter(m => m.status === "BYE").length, walkovers: played.filter(m => m.status === "WALKOVER").map(m => ({ round: m.round, won: m.winner_key === key })),
        ...(isGroupedStructure(event.snapshot.format.structure)?{structure:event.snapshot.format.structure,groupLosses:completed.filter(m=>isGroupMatch(m)&&m.winner_key!==key).length}:{}),
        ...(team ? { pairs: { partnerKey: team.partner_key, partnerNpcId: team.partner_npc_id, nation: team.nation } } : {}),
        qSchool: event.snapshot.qSchool ?? null, rankingCategory: event.ranking_category, classification: event.classification, roundLost: lost?.round ?? null, rounds,
        // A6.5: the human's age on the event's start date (a persisted fact for later storytelling).
        ...(key === HUMAN ? { humanAge: careerAge(rootIdentity(root as RootRow & { identity_dob?: unknown; identity_start?: unknown }), event.season, event.start_day) } : {}) } };
  });
  return { results, champion };
}

function eventGrants(root: RootRow, event: InstanceRow, results: ReturnType<typeof eventResults>["results"]) {
  const grants = event.snapshot.qualificationOutputs.flatMap((output, index) => results.filter(r => r.finishing_position <= output.maxPosition).map(r => {
    const targetSeason = event.season + (output.targetSeason === "NEXT" ? 1 : 0);
    const idempotency = output.consumption === "SEASON_PASS" ? `pass:${output.targetKey}:${targetSeason}:${r.participant_key}` : `result:${event.id}:${index}:${r.participant_key}`;
    return { id: stableUuid(root.world_seed, CALENDAR_GENERATION_VERSION, "entitlement", idempotency), idempotency_key: idempotency, recipient_key: r.participant_key,
      recipient_kind: r.participant_kind, npc_id: r.npc_id, entitlement_type: output.entitlementType, source_event_id: event.id, source_position: r.finishing_position,
      source_detail: { definitionKey: event.definition_key, instanceKey: event.instance_key, outputIndex: index, stageReached: r.stage_reached },
      target_key: output.targetKey, target_season: targetSeason, consumption: output.consumption };
  }));
  return grants;
}

export async function insertEntitlements(tx: CareerExecutor, saveId: string, awardedSeason: number, grants: Record<string, unknown>[], sourceKind: "EVENT_RESULT" | "PROVIDER") {
  await tx.execute(sql`INSERT INTO career_qualification_entitlements (career_save_id, id, idempotency_key, recipient_key, recipient_kind, npc_id, entitlement_type, source_kind,
      source_event_id, source_position, source_detail, awarded_season, target_key, target_season, consumption, status)
    SELECT ${saveId}::uuid, g.id, g.idempotency_key, g.recipient_key, g.recipient_kind, g.npc_id, g.entitlement_type, ${sourceKind}, g.source_event_id, g.source_position,
      g.source_detail, ${awardedSeason}, g.target_key, g.target_season, g.consumption, 'ACTIVE'
    FROM jsonb_to_recordset(${JSON.stringify(grants)}::jsonb) AS g(id uuid, idempotency_key text, recipient_key text, recipient_kind text, npc_id uuid, entitlement_type text,
      source_event_id uuid, source_position integer, source_detail jsonb, target_key text, target_season integer, consumption text)
    ON CONFLICT (career_save_id, idempotency_key) DO NOTHING`);
}

// ------------------------------------------------------------------ week play-out
export const lastDayOfWeek = (week: number) => week * DAYS_PER_WEEK;

/**
 * Play out one Career week: close registration and lock fields for events starting
 * this week (highest priority first, so conflicts resolve toward bigger events),
 * cancel unsupported/unfillable events explicitly, draw, then progress every live
 * tournament through rounds scheduled up to the end of the week.
 */
export async function playWeek(tx: CareerExecutor, root: RootRow, world: World, season: number, week: number, providers: CalendarProviders) {
  if (week < 1 || week > WEEKS_PER_SEASON) throw new CareerError(409, "Week outside season");
  await openRegistrations(tx, root.id, season, week);
  await providers.finance?.beforeWeek(tx, root, season, week);
  const starting = (await loadInstances(tx, root.id, sql`season = ${season} AND start_week = ${week} AND status IN ('REGISTRATION_OPEN','REGISTRATION_CLOSED','DRAW_PENDING')`))
    // Priority first; within a priority, earlier days first (so series day 1 locks before later days copy it).
    .sort((a, b) => b.calendar_priority - a.calendar_priority || a.start_day - b.start_day || (a.instance_key < b.instance_key ? -1 : 1));
  const summary = { week, locked: 0, cancelledUnsupported: 0, cancelledUnfilled: 0, drawn: 0, completed: 0, simulatedMatches: 0, awaitingHuman: [] as string[] };
  const npcs = starting.length ? await loadNpcs(tx, root.id, { activeOnly: true }) : [];
  // Close every starting event's registration in one write (each row's transition is still checked).
  await closeRegistrations(tx, starting);
  const pre = starting.some(e => e.status === "REGISTRATION_CLOSED" && e.executable) ? await preloadLocks(tx, root.id, season, starting) : undefined;
  for (const event of starting) {
    if (event.status === "REGISTRATION_CLOSED") {
      if (!event.executable) {
        await tx.execute(sql`DELETE FROM career_participant_bookings WHERE career_save_id = ${root.id} AND event_id = ${event.id}`);
        forgetBookings(pre, event.id);
        await transition(tx, event, "CANCELLED", { reason: "UNSUPPORTED_FORMAT" });
        await providers.finance?.onEventCancelled(tx, root, event, "UNSUPPORTED_FORMAT");
        summary.cancelledUnsupported++;
        continue;
      }
      const lock = await lockField(tx, root, event, npcs, providers, week, pre);
      if (!lock.locked) { summary.cancelledUnfilled++; continue; }
      summary.locked++;
    }
  }
  // Every locked field's draw, written together (draws read nothing the locks above change).
  const toDraw = starting.filter(e => e.status === "DRAW_PENDING");
  await makeDraws(tx, root, toDraw, providers);
  summary.drawn += toDraw.length;
  const live = await loadInstances(tx, root.id, sql`season = ${season} AND status = 'IN_PROGRESS' AND start_week <= ${week}`);
  const progress = await progressEvents(tx, root, world, live, lastDayOfWeek(week), providers);
  summary.simulatedMatches += progress.simulated;
  summary.completed += progress.completed;
  summary.awaitingHuman.push(...progress.awaitingHuman.map(m => m.id));
  // A real human group bull playoff also blocks the calendar; its ID is not a scoring match.
  for (const event of live.filter(e => isGroupedStructure(e.snapshot.format.structure) && e.status === "IN_PROGRESS")) {
    const withdrawn = new Set((await tx.execute(sql`SELECT participant_key FROM career_event_entries WHERE career_save_id=${root.id}
      AND event_id=${event.id} AND status='WITHDRAWN'`)).rows.map(r => String(r.participant_key)));
    const groups = resolvedGroups(await loadMatches(tx,root.id,event.id),await loadBulls(tx,root.id,event.id),withdrawn,layoutFor(event.snapshot.format.structure));
    if (groups.some(g => g.pending?.pair.includes(HUMAN))) summary.awaitingHuman.push(`group-bull:${event.id}`);
  }
  return summary;
}
