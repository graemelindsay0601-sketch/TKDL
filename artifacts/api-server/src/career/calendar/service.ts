import { MIDWEEK_SUMMARIES } from "../content/season-v15.ts";
import { viabilityOf } from "./viability.ts";
import { sql } from "drizzle-orm";
import { opportunity } from "../content/opportunities.ts";
import { venueContent } from "../content/world.ts";
import { z } from "zod";
import { simulatedNineDarters } from "../records/model.ts";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { createCareerWorldService, lockRoot, worldState, type CareerActor } from "../world/service.ts";
import { stableUuid } from "../world/random.ts";
import { CALENDAR_GENERATION_VERSION, DEVELOPMENT_CADENCE, SEASON_GROUPINGS, SUPPORTED_EVENT_DATABASE_VERSIONS, WEEKS_PER_SEASON, groupingForWeek, CIRCUITS, CLASSIFICATIONS, type EventStatus } from "./config.ts";
import { DEFAULT_PROVIDERS, type CalendarProviders } from "./providers.ts";
import { venueByKey } from "./geography.ts";
import { canonicalJson } from "./generation.ts";
import { evaluateRule, type DenialReason, type Rule } from "./eligibility.ts";
import { AGE_POLICY, eligibleFrom } from "../identity/age.ts";
import { settleLifeCommitments } from "../life/commitments.ts";
import { playTeamNights } from "../club/team-service.ts";
import { humanGroupBull,loadBulls,resolvedGroups,playingDays } from "./group-engine.ts";
import { loadPairs } from "./pairs.ts";
import { teamComposite } from "../world/team.ts";
import { isGroupedStructure, isGroupMatch, layoutFor } from "./groups.ts";
import { a2MatchFormat } from "./formats.ts";
import { activeManager, recordManagerInvites } from "../manager/state.ts";
import { settleStreamingWeek, streamTier } from "../streaming/state.ts";
import { nightLabel, offBoardNights } from "../nights.ts";
import { settleCamWeek } from "../camleague/service.ts";
import { settleProAmWeek } from "../proam/service.ts";
import { streamerCanBeInvited } from "../streaming/model.ts";
import { canInvite } from "../manager/model.ts";
import { loadHumanForm, humanSimulationPlayer } from "../form/human.ts";
import { simulateNpcMatch } from "../world/simulation.ts";
import { loadNpcs } from "../world/repository.ts";
import { CAREER_DIFFICULTY_CONFIG } from "../world/config.ts";
import type { Npc } from "../world/types.ts";
import {
  HUMAN, ensureSeason, openRegistrations, loadInstances, loadFactsContext, factsFor, humanParticipant, playWeek, progressEvent, loadMatches,
  insertBookings, exclusiveConflicts, ensureMidweekCircuit, ensurePathwayEvents, insertEntitlements, lastDayOfWeek, refreshCapabilities, matchKeyFor, simulateBullUp, type InstanceRow, type RootRow, type MatchRow,
} from "./engine.ts";

const eventRefSchema = z.object({ eventId: z.string().uuid() }).strict();
const advanceSchema = z.object({
  operationKey: z.string().min(8).max(100).regex(/^[A-Za-z0-9:_-]+$/),
  expectedSeason: z.number().int().positive(),
  expectedWeek: z.number().int().min(1).max(WEEKS_PER_SEASON),
  target: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("NEXT_MEANINGFUL") }).strict(),
    /** Play on to the human's next match: skips ordinary weeks and open-entry deadlines, stops for
     *  qualified-event deadlines, the season boundary, or once no confirmed entry is left. */
    z.object({ kind: z.literal("NEXT_MATCH") }).strict(),
    z.object({ kind: z.literal("WEEKS"), weeks: z.number().int().min(1).max(WEEKS_PER_SEASON) }).strict(),
    z.object({ kind: z.literal("WEEK"), week: z.number().int().min(1).max(WEEKS_PER_SEASON) }).strict(),
  ]),
}).strict();
/**
 * Human result boundary. Legs are total legs won in the match. Set-play matches
 * (A6.5) also carry the set score, which decides the match. `live` is the
 * server-verified summary attached by the Career match-session boundary.
 */
const humanResultSchema = z.object({
  matchId: z.string().uuid(), humanLegs: z.number().int().min(0).max(301), opponentLegs: z.number().int().min(0).max(301), humanThrewFirst: z.boolean(),
  humanSets: z.number().int().min(0).max(51).optional(), opponentSets: z.number().int().min(0).max(51).optional(),
  live: z.record(z.string(), z.unknown()).optional(),
}).strict();
type HumanResultInput = z.infer<typeof humanResultSchema>;
const calendarQuerySchema = z.object({
  season: z.number().int().positive().optional(),
  fromWeek: z.number().int().min(1).max(52).optional(), toWeek: z.number().int().min(1).max(52).optional(),
  // RELEVANT: events you can enter, are eligible for, or are booked into or played (Home: a few hundred, not the whole world).
  scope: z.enum(["WORLD", "MY_SCHEDULE", "AVAILABLE", "FEATURED", "RELEVANT"]).default("WORLD"),
  circuit: z.enum(CIRCUITS).optional(), classification: z.enum(CLASSIFICATIONS).optional(), family: z.string().max(80).optional(),
}).strict();
const providerEntitlementSchema = z.object({
  idempotencyKey: z.string().min(1).max(160), providerId: z.string().min(1).max(80),
  recipientKey: z.string().min(1).max(40), entitlementType: z.enum(["EVENT_ENTRY", "STAGE_ENTRY", "SERIES_ACCESS"]),
  targetKey: z.string().min(1).max(120), targetSeason: z.number().int().positive(), consumption: z.enum(["SINGLE_USE", "SEASON_PASS"]),
  detail: z.record(z.string(), z.unknown()).default({}),
}).strict();
const MAX_WEEKS_PER_ADVANCE = WEEKS_PER_SEASON + 1;

function checkRetry(saved: unknown, requested: unknown) {
  if (canonicalJson(saved) !== canonicalJson(requested)) throw new CareerError(409, "Operation identity was already used with different inputs");
}
const finished = (status: EventStatus) => status === "COMPLETED" || status === "CANCELLED";
const locked = (status: EventStatus) => ["DRAW_PENDING", "DRAWN", "IN_PROGRESS"].includes(status);

type HumanContext = Awaited<ReturnType<typeof loadHumanContext>>;
async function loadHumanContext(tx: CareerExecutor, root: RootRow, season: number, events: readonly InstanceRow[], providers: CalendarProviders) {
  const entries = new Map((await tx.execute(sql`SELECT e.event_id, e.status, e.source FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
    WHERE e.career_save_id = ${root.id} AND e.participant_key = ${HUMAN} AND i.season = ${season}`)).rows.map(r => [String(r.event_id), { status: String(r.status), source: String(r.source) }]));
  const bookings = new Map<number, string>();
  for (const row of (await tx.execute(sql`SELECT day, event_id FROM career_participant_bookings WHERE career_save_id = ${root.id} AND season = ${season} AND participant_key = ${HUMAN}`)).rows) bookings.set(Number(row.day), String(row.event_id));
  for (const row of (await tx.execute(sql`SELECT day,id FROM career_life_commitments WHERE career_save_id=${root.id} AND season=${season} AND status='ACCEPTED'`)).rows)
    bookings.set(Number(row.day),`life:${row.id}`);
  // Your own nights (a stream, a road trip, …) are booked like an off-board commitment.
  for (const [day, key] of await offBoardNights(tx, root.id, season)) if (!bookings.has(day)) bookings.set(day, key);
  const results = new Map((await tx.execute(sql`SELECT r.event_id, r.finishing_position, r.stage_reached, r.is_champion FROM career_event_results r WHERE r.career_save_id = ${root.id} AND r.participant_key = ${HUMAN} AND r.season = ${season}`)).rows.map(r => [String(r.event_id), r]));
  const ctx = await loadFactsContext(tx, root.id, season, events.map(e => e.snapshot.eligibility), [HUMAN]);
  const groups = new Map<string, string>();
  for (const row of (await tx.execute(sql`SELECT i.snapshot->'exclusiveGroup'->>'key' AS k, i.snapshot->'exclusiveGroup'->>'variant' AS v FROM career_event_entries e JOIN career_event_instances i
      ON i.career_save_id = e.career_save_id AND i.id = e.event_id WHERE e.career_save_id = ${root.id} AND e.participant_key = ${HUMAN} AND e.status <> 'WITHDRAWN' AND i.season = ${season}
      AND i.snapshot ? 'exclusiveGroup' AND jsonb_typeof(i.snapshot->'exclusiveGroup') = 'object'`)).rows) groups.set(String(row.k), String(row.v));
  return { participant: humanParticipant(root, providers), entries, bookings, results, ctx, groups, active: root.status === "ACTIVE", week: Number(root.current_week), season: Number(root.current_season),
    manager: await activeManager(tx, root.id), streamTier: await streamTier(tx, root.id) };
}

/** Structured, actionable view of one event for the human. Pure over loaded context. */
/** A6.5: age bounds for an event = authored AGE rules + the config circuit policy (all database versions). */
export function ageRequirement(event: InstanceRow) {
  const leaves: { minAge?: number; maxAgeExclusive?: number }[] = [];
  const walk = (r: Rule) => { if ("all" in r) r.all.forEach(walk); else if ("any" in r) r.any.forEach(walk); else if ("not" in r) return; else if (r.type === "AGE") leaves.push(r); };
  walk(event.snapshot.eligibility);
  const policyMin = AGE_POLICY.circuitMinimumAge[event.circuit];
  const mins = [...leaves.map(l => l.minAge), policyMin].filter((n): n is number => n !== undefined);
  const maxes = leaves.map(l => l.maxAgeExclusive).filter((n): n is number => n !== undefined);
  return { minAge: mins.length ? Math.max(...mins) : null, maxAgeExclusive: maxes.length ? Math.min(...maxes) : null, policyMin: policyMin ?? null,
    junior: maxes.some(n => n <= AGE_POLICY.juniorMaxAgeExclusive) };
}

/** Does this event take invitations at all (an INVITATION rule anywhere in its eligibility)? */
const takesInvitations = (r: Rule): boolean => "all" in r ? r.all.some(takesInvitations) : "any" in r ? r.any.some(takesInvitations) : "not" in r ? false : r.type === "INVITATION";

function humanView(event: InstanceRow, human: HumanContext, seriesWindows: SeriesWindows) {
  const facts = factsFor(human.participant, human.ctx, event);
  let authored = evaluateRule(event.snapshot.eligibility, facts);
  // A DartCast Star gets invitations to the televised invitationals on the strength of their audience (no one takes a cut, so this comes before a manager's).
  let streamInvite = false;
  if (!authored.eligible && streamerCanBeInvited(human.streamTier, { circuit: event.circuit, definitionKey: event.definition_key, takesInvitations: takesInvitations(event.snapshot.eligibility) })) {
    const invited = evaluateRule(event.snapshot.eligibility, { ...facts, invited: true });
    if (invited.eligible) { authored = invited; streamInvite = true; }
  }
  // Not in on your own? Your manager may get you an invitation (and takes their cut of this event's prize money for it).
  let managerInvite = false;
  if (!authored.eligible && human.manager && canInvite(human.manager, { circuit: event.circuit, definitionKey: event.definition_key,
    invitationCount: event.snapshot.invitationPolicy?.count ?? null, takesInvitations: takesInvitations(event.snapshot.eligibility) }, facts.rankings["pro-world"])) {
    const invited = evaluateRule(event.snapshot.eligibility, { ...facts, invited: true });
    if (invited.eligible) { authored = invited; managerInvite = true; }
  }
  const ages = ageRequirement(event);
  // The circuit age policy applies whenever the age is known (a save without a DOB is gated at the API).
  const underPolicy = ages.policyMin !== null && facts.age !== null && facts.age !== undefined && facts.age < ages.policyMin;
  const rule = underPolicy ? { eligible: false, reasons: [...new Set([...authored.reasons, "BELOW_MINIMUM_AGE" as const])] } : authored;
  const identity = human.participant.identity;
  const ageInfo = (ages.minAge !== null || ages.maxAgeExclusive !== null) ? {
    ...ages, ageOnEventDate: facts.age ?? null,
    eligibleFrom: identity && ages.minAge !== null && facts.age !== null && facts.age !== undefined && facts.age < ages.minAge ? eligibleFrom(identity, ages.minAge, event.season, event.start_week) : null,
  } : null;
  const entry = human.entries.get(event.id) ?? null;
  const denials: DenialReason[] = [];
  const currentSeason = event.season === human.season;
  if (!human.active) denials.push("CAREER_NOT_ACTIVE");
  if (finished(event.status) || !currentSeason && event.season < human.season) denials.push("EVENT_FINISHED");
  else if (locked(event.status)) denials.push("FIELD_LOCKED");
  else if (event.status === "REGISTRATION_CLOSED" || (currentSeason && human.week > event.registration_closes_week)) denials.push("REGISTRATION_CLOSED");
  else if (event.status === "SCHEDULED" || !currentSeason || human.week < event.registration_opens_week) denials.push("REGISTRATION_NOT_OPEN");
  if (!event.executable) denials.push("UNSUPPORTED_FORMAT");
  if (entry && entry.status !== "WITHDRAWN") denials.push("ALREADY_ENTERED");
  denials.push(...rule.reasons);
  const group = event.snapshot.exclusiveGroup;
  if (group && human.groups.has(group.key) && human.groups.get(group.key) !== group.variant) denials.push("NOT_ELIGIBLE");
  const series = event.series_key ? seriesWindows.get(event.series_key) : undefined;
  const spans = series ? [...series.spans.entries()] : [[event.id, { start: event.start_day, end: event.end_day }] as const];
  const own = new Set(spans.map(([id]) => id));
  const conflicts = new Set<string>();
  // A league only clashes on its weekly nights.
  const days = (span: { start: number; end: number }) => event.snapshot.format.structure === "LEAGUE" && !series ? playingDays(event)
    : Array.from({ length: span.end - span.start + 1 }, (_, i) => span.start + i);
  for (const [, span] of spans) for (const d of days(span)) { const other = human.bookings.get(d); if (other && !own.has(other)) conflicts.add(other); }
  if (conflicts.size) denials.push("SCHEDULE_CONFLICT");
  const result = human.results.get(event.id);
  const held = human.ctx.entitlements.get(HUMAN) ?? new Set<string>();
  const entitlement = qualificationKeys(event.snapshot.eligibility).some(key => held.has(key));
  let relationship: string;
  if (entry?.status === "WITHDRAWN") relationship = "WITHDRAWN";
  else if (result) relationship = "COMPLETED";
  else if (entry && event.status === "IN_PROGRESS") relationship = "PLAYING";
  else if (entry?.status === "CONFIRMED") relationship = "CONFIRMED";
  else if (entry) relationship = "ENTERED";
  else if (finished(event.status) || locked(event.status)) relationship = rule.eligible ? "MISSED" : "NOT_ELIGIBLE";
  else if (!rule.eligible) relationship = "NOT_ELIGIBLE";
  else relationship = entitlement ? "QUALIFIED" : "AVAILABLE";
  return {
    relationship, eligible: rule.eligible, eligibilityReasons: rule.reasons, age: ageInfo,
    managerInvite: managerInvite ? { name: human.manager!.name, commission: human.manager!.commission } : null, streamInvite,
    canEnter: denials.length === 0, denials: [...new Set(denials)], conflictsWith: [...conflicts].filter(id=>!id.startsWith("life:")&&!nightLabel(id)),
    commercialConflicts: [...conflicts].filter(id=>id.startsWith("life:")||nightLabel(id)).map(id=>nightLabel(id)??"Accepted off-board commitment"),
    entryStatus: entry?.status ?? null, result: result ? { finishingPosition: Number(result.finishing_position), stageReached: String(result.stage_reached), champion: Boolean(result.is_champion) } : null,
  };
}
type SeriesWindows = Map<string, { spans: Map<string, { start: number; end: number }> }>;
function seriesWindowsOf(events: readonly InstanceRow[]): SeriesWindows {
  const map: SeriesWindows = new Map();
  for (const e of events) {
    if (!e.series_key) continue;
    const w = map.get(e.series_key) ?? { spans: new Map() };
    w.spans.set(e.id, { start: e.start_day, end: e.end_day });
    map.set(e.series_key, w);
  }
  return map;
}
function qualificationKeys(rule: Rule): string[] {
  if ("all" in rule) return rule.all.flatMap(qualificationKeys);
  if ("any" in rule) return rule.any.flatMap(qualificationKeys);
  if ("not" in rule) return [];
  return rule.type === "QUALIFICATION" ? [rule.targetKey] : [];
}

/** The content fields calendar lists display (the full venue/history content stays on the event, map and tournament views). */
const LIST_CONTENT = ["circuitId", "circuitName", "summary", "eventClass", "fieldDescription", "trophyId"] as const;
/**
 * The calendar list's event: everything the list screens read, without the per-event venue history and map
 * content, prize/travel profile keys and qualification outputs (about a third of each event; a full season's
 * list was 6.4 MB). The event page, map and tournament views still return the full event.
 */
export function listEvent<E extends { content?: unknown; profiles?: unknown; qualificationOutputs?: unknown; opportunity?: unknown }>(event: E) {
  const { profiles: _profiles, qualificationOutputs: _outputs, ...rest } = event;
  const content = event.content && typeof event.content === "object"
    ? Object.fromEntries(LIST_CONTENT.flatMap(key => key in (event.content as object) ? [[key, (event.content as Record<string, unknown>)[key]]] : []))
    : event.content ?? null;
  const opportunity = event.opportunity && typeof event.opportunity === "object"
    ? (({ authority: _authority, ...o }) => o)(event.opportunity as Record<string, unknown>) : event.opportunity;
  return { ...rest, content, opportunity };
}

function presentEvent(event: InstanceRow, human?: ReturnType<typeof humanView>) {
  const s = event.snapshot, venue = venueByKey(event.venue_key), venueIdentity = venueContent(event.venue_key);
  return {
    id: event.id, instanceKey: event.instance_key, season: event.season, name: event.name, definitionKey: event.definition_key, family: event.family,
    eventDatabaseVersion: event.event_database_version, circuit: event.circuit, classification: event.classification, rankingCategory: event.ranking_category,
    presentation: { ...s.presentation, tier: event.presentation_tier },
    dates: { startWeek: event.start_week, endWeek: event.end_week, startDay: event.start_day, endDay: event.end_day,
      startDayOfWeek: ((event.start_day - 1) % 7) + 1, grouping: groupingForWeek(event.start_week).key },
    registration: { opensWeek: event.registration_opens_week, closesWeek: event.registration_closes_week },
    venue: { key: venue.key, name: s.content?.venue?.displayName??venue.name, city: event.city, country: event.country, region: event.region, zone: event.zone, localityKey: event.locality_key,
      venueType: venueIdentity.venueType, capacityBand: venueIdentity.capacityBand },
    content:s.content?(MIDWEEK_SUMMARIES[event.definition_key]?{...s.content,summary:MIDWEEK_SUMMARIES[event.definition_key]}:s.content):null,opportunity:opportunity({status:event.status,classification:event.classification,human:human??null}),
    format: s.format, capability: s.capability,
    field: { size: event.field_size, minimum: event.minimum_entrants, entrants: event.entrant_count, policy: s.fieldPolicy },
    viability: viabilityOf(event),
    series: event.series_key ? { key: event.series_key, day: event.series_day } : null, qSchool: s.qSchool,
    profiles: s.profiles, seedingPolicy: s.seedingPolicy, qualificationOutputs: s.qualificationOutputs,
    status: event.status, statusReason: event.status_reason,
    champion: event.champion_participant_key ? { participantKey: event.champion_participant_key, npcId: event.champion_npc_id } : null,
    human: human ?? null,
  };
}

/**
 * A3 Career calendar/tournament service. Every mutation: authenticate actor ->
 * locate owned save -> require ACTIVE -> lock root FOR UPDATE (A2 lockRoot) ->
 * mutate -> persist deterministic result. Reads lock the root too (A2 convention).
 */

/** Advances running in this process, by save (see advance). */
const ADVANCES_IN_FLIGHT = new Map<string, { operationKey: string; playerId: number; result: Promise<unknown> }>();

export function createCareerCalendarService(database: CareerDatabase, options: { providers?: Partial<CalendarProviders> } = {}) {
  const providers: CalendarProviders = { ...DEFAULT_PROVIDERS, ...options.providers };
  const world = createCareerWorldService(database);
  /** One advance from start to result (callers go through advance, which joins a retry to a running one). */
  async function runAdvance(actor: CareerActor, saveId: string, request: z.infer<typeof advanceSchema>) {
    const started = await database.transaction(async tx => {
      const { root } = await open(tx, actor, saveId);
      await ensureMidweekCircuit(tx, root);
      await ensurePathwayEvents(tx, root);
      // A2 commits its off-season separately. Recover only an unfinished,
      // demonstrably processed boundary, never backfill awards for old closed seasons.
      if(providers.history&&Number(root.current_season)>1) {
        const previous=Number(root.current_season)-1;
        const unfinished=(await tx.execute(sql`SELECT 1 FROM career_seasons WHERE career_save_id=${saveId}
          AND season=${previous} AND status='ACTIVE' AND played_week=52 AND developed_week=52`)).rows[0];
        if(unfinished) {
          await finalizeSeason(tx,root,previous);
          await ensureSeason(tx,root,Number(root.current_season));
          await openRegistrations(tx,saveId,Number(root.current_season),Number(root.current_week));
          await providers.finance?.onCalendarMoved(tx,root,Number(root.current_season),Number(root.current_week));
          await providers.sporting?.onCalendarMoved(tx,root,Number(root.current_season),Number(root.current_week));
          await providers.history.afterSeason(tx,root,previous);
        }
      }
      await requireSeason(tx,actor,saveId);
      const op = (await tx.execute(sql`SELECT request, result FROM career_calendar_operations WHERE career_save_id = ${saveId} AND operation_key = ${request.operationKey}`)).rows[0];
      if (op) {
        checkRetry(op.request, request);
        const stored = op.result as { stop?: { reason?: string }; to?: { season: number; week: number } } | null;
        const pending=await providers.history?.pending(tx,root);
        if(!stored&&pending===request.expectedSeason&&Number(root.current_season)===pending+1) {
          const recovered={operationKey:request.operationKey,from:{season:request.expectedSeason,week:request.expectedWeek},
            to:{season:Number(root.current_season),week:Number(root.current_week)},stop:{reason:"SEASON_REVIEW",detail:{season:pending,recovered:true}},
            weeksPlayed:0,steps:[],recovered:true};
          await tx.execute(sql`UPDATE career_calendar_operations SET result=${JSON.stringify(recovered)}::jsonb,completed_at=NOW()
            WHERE career_save_id=${saveId} AND operation_key=${request.operationKey} AND completed_at IS NULL`);
          return {stored:recovered};
        }
        // A blocked (human-match) advance may resume only from the exact position it stopped at;
        // once the Career has moved on, retrying it returns the stored result and never moves time.
        if (stored?.stop?.reason === "HUMAN_MATCH_PENDING" && stored.to && Number(root.current_season) === stored.to.season && Number(root.current_week) === stored.to.week) return { stored: null };
        return { stored: (stored ?? null) as unknown };
      }
      if (Number(root.current_season) !== request.expectedSeason || Number(root.current_week) !== request.expectedWeek) throw new CareerError(409, "Career calendar has moved; refresh before advancing");
      await tx.execute(sql`INSERT INTO career_calendar_operations (career_save_id, operation_key, request) VALUES (${saveId}, ${request.operationKey}, ${JSON.stringify(request)}::jsonb)`);
      return { stored: null };
    });
    if (started.stored) return started.stored;
    // Events finished from here on are this advance's headlines (a second of slack for clock skew).
    const startedAt = new Date(Date.now() - 1000).toISOString();
    const targetIndex = request.target.kind === "WEEKS" ? (request.expectedSeason - 1) * WEEKS_PER_SEASON + request.expectedWeek - 1 + request.target.weeks
      : request.target.kind === "WEEK" ? (request.expectedSeason - 1) * WEEKS_PER_SEASON + request.target.week - 1 + (request.target.week <= request.expectedWeek ? WEEKS_PER_SEASON : 0) : null;
    const steps: unknown[] = [];
    let stop: { reason: string; detail?: unknown } = { reason: "LIMIT" };
    for (let i = 0; i < MAX_WEEKS_PER_ADVANCE; i++) {
      const step = await stepWeek(actor, saveId);
      if (step.blocked) {
        stop = { reason: "HUMAN_MATCH_PENDING", detail: { season: step.season, week: step.week, matchIds: (step.summary as { awaitingHuman: string[] }).awaitingHuman } };
        break;
      }
      steps.push({ season: step.season, week: step.week, summary: step.summary, offSeason: "offSeason" in step ? step.offSeason : undefined });
      const at = step.advancedTo!;
      if(providers.history&&at.season!==step.season){stop={reason:"SEASON_REVIEW",detail:{season:step.season}};break;}
      const index = (at.season - 1) * WEEKS_PER_SEASON + at.week - 1;
      if (targetIndex !== null) { if (index >= targetIndex) { stop = { reason: "TARGET_REACHED" }; break; } continue; }
      if (at.season !== step.season) { stop = { reason: "SEASON_BOUNDARY" }; break; }
      if (request.target.kind === "NEXT_MATCH") {
        const ahead = await database.transaction(async tx => { const { root } = await requireSeason(tx, actor, saveId);
          return { qualified: (await meaningfulReasons(tx, root, at.season, at.week)).filter(r => r.type === "QUALIFIED_EVENT_DEADLINE"), entry: await nextHumanEntry(tx, root.id) }; });
        if (ahead.qualified.length) { stop = { reason: "MEANINGFUL_DATE", detail: ahead.qualified }; break; }
        if (!ahead.entry) { stop = { reason: "TARGET_REACHED" }; break; }
        continue;
      }
      const reasons = await database.transaction(async tx => { const { root } = await requireSeason(tx, actor, saveId); return meaningfulReasons(tx, root, at.season, at.week); });
      if (reasons.length) { stop = { reason: "MEANINGFUL_DATE", detail: reasons }; break; }
    }
    return database.transaction(async tx => {
      const { root } = await requireSeason(tx, actor, saveId);
      // Who won what while time moved on: the biggest events first, for the Continue result card.
      const headlines = (await tx.execute(sql`SELECT i.name, i.circuit, i.presentation_tier AS tier, i.champion_participant_key = ${HUMAN} AS you,
          COALESCE(p.first_name || ' ' || p.surname, CASE WHEN i.champion_participant_key = ${HUMAN} THEN 'You' END) AS champion
        FROM career_event_instances i LEFT JOIN career_world_players p ON p.career_save_id = i.career_save_id AND p.id = i.champion_npc_id
        WHERE i.career_save_id = ${saveId} AND i.status = 'COMPLETED' AND i.completed_at >= ${startedAt}::timestamptz AND i.champion_participant_key IS NOT NULL
        ORDER BY (i.champion_participant_key = ${HUMAN}) DESC, i.calendar_priority DESC, i.completed_at DESC LIMIT 6`)).rows
        .map(r => ({ name: String(r.name), circuit: String(r.circuit), tier: String(r.tier), champion: r.champion ? String(r.champion) : null, you: r.you === true }));
      const result = { operationKey: request.operationKey, from: { season: request.expectedSeason, week: request.expectedWeek },
        to: { season: Number(root.current_season), week: Number(root.current_week) }, stop, weeksPlayed: steps.length, steps, headlines };
      // Blocked advances are recorded (resumable from the same position); completed ones are final.
      await tx.execute(sql`UPDATE career_calendar_operations SET result = ${JSON.stringify(result)}::jsonb,
          completed_at = ${stop.reason === "HUMAN_MATCH_PENDING" ? null : sql`NOW()`}
        WHERE career_save_id = ${saveId} AND operation_key = ${request.operationKey} AND completed_at IS NULL`);
      return result;
    });
  }
  /** A5: sporting status/seeding bound to this save's persisted state, after the root lock. Without A5 the A3 placeholders apply. */
  async function bind(tx: CareerExecutor, root: RootRow): Promise<CalendarProviders> {
    return providers.sporting ? { ...providers, ...(await providers.sporting.bind(tx, root)) } : providers;
  }

  async function open(tx: CareerExecutor, actor: CareerActor, saveId: string, active = true) {
    const root = await lockRoot(tx, actor, saveId, active) as RootRow;
    if (!SUPPORTED_EVENT_DATABASE_VERSIONS.some(v => v === Number(root.event_database_version))) throw new CareerError(409, "Career event database requires a version migration");
    const state = await worldState(tx, root);
    const season = (await tx.execute(sql`SELECT * FROM career_seasons WHERE career_save_id = ${saveId} AND season = ${root.current_season}`)).rows[0];
    if (season && root.status === "ACTIVE") await refreshCapabilities(tx, saveId);
    return { root, world: state, season };
  }
  async function requireSeason(tx: CareerExecutor, actor: CareerActor, saveId: string, active = true) {
    const ctx = await open(tx, actor, saveId, active);
    if (!ctx.season) throw new CareerError(409, "Initialize Career calendar first");
    return ctx as typeof ctx & { season: Record<string, unknown> };
  }
  async function recordHumanResultTx(tx: CareerExecutor, actor: CareerActor, saveId: string, input: HumanResultInput,
    simulated?: { summary: Record<string, unknown>; firstThrowDetail: Record<string, unknown> }) {
    const { root, world: state } = await requireSeason(tx, actor, saveId);
    const match = (await tx.execute(sql`SELECT * FROM career_tournament_matches WHERE career_save_id = ${root.id} AND id = ${input.matchId} FOR UPDATE`)).rows[0] as MatchRow | undefined;
    if (!match) throw new CareerError(404, "Career match not found");
    if (match.status !== "AWAITING_HUMAN") throw new CareerError(409, "Match is not awaiting a human result");
    const humanSide = match.a_key === HUMAN ? 0 : match.b_key === HUMAN ? 1 : -1;
    if (humanSide < 0) throw new CareerError(409, "Match does not involve the human player");
    const event = await eventOwned(tx, root.id, match.event_id);
    const sets = event.snapshot.format.scoringUnit === "SETS";
    const target = (match.best_of + 1) / 2;
    let humanWon: boolean;
    if (sets) {
      if (input.humanSets === undefined || input.opponentSets === undefined) throw new CareerError(409, "Set-play result needs the set score");
      const valid = (input.humanSets === target) !== (input.opponentSets === target) && input.humanSets <= target && input.opponentSets <= target;
      const perSet = (event.snapshot.format.legsPerSet! + 1) / 2;
      if (!valid || input.humanLegs < input.humanSets * perSet || input.opponentLegs < input.opponentSets * perSet) throw new CareerError(409, "Sets do not form a completed best-of result");
      humanWon = input.humanSets === target;
    } else {
      if (input.humanSets !== undefined || input.opponentSets !== undefined) throw new CareerError(409, "Legs-play result cannot carry sets");
      const valid = (input.humanLegs === target) !== (input.opponentLegs === target) && input.humanLegs <= target && input.opponentLegs <= target;
      if (!valid) throw new CareerError(409, "Legs do not form a completed best-of result");
      humanWon = input.humanLegs === target;
    }
    const legs = humanSide === 0 ? [input.humanLegs, input.opponentLegs] : [input.opponentLegs, input.humanLegs];
    const winner = humanWon ? HUMAN : (humanSide === 0 ? match.b_key : match.a_key);
    const firstThrow = input.humanThrewFirst ? humanSide : 1 - humanSide;
    const summary = { ...(sets ? { sets: humanSide === 0 ? [input.humanSets, input.opponentSets] : [input.opponentSets, input.humanSets] } : {}), ...(input.live ? { live: input.live } : {}),
      ...(simulated?.summary ?? {}) };
    const firstThrowDetail = simulated?.firstThrowDetail ?? (input.live?.bullUp ? { method: "LIVE_BULL_UP", bullUp: input.live.bullUp } : { method: "LIVE_BULL_UP" });
    // A quick-simmed match is honestly recorded as a simulation, never as live darts.
    const source = simulated ? "QUICK_SIM" : "HUMAN_LIVE";
    const updated = await tx.execute(sql`UPDATE career_tournament_matches SET status = 'COMPLETED', winner_key = ${winner}, legs_a = ${legs[0]}, legs_b = ${legs[1]}, first_throw = ${firstThrow},
      first_throw_detail = ${JSON.stringify(firstThrowDetail)}::jsonb, result_source = ${source}, completed_at = NOW(),
      summary = ${Object.keys(summary).length ? JSON.stringify(summary) : null}::jsonb
      WHERE career_save_id = ${root.id} AND id = ${match.id} AND status = 'AWAITING_HUMAN' RETURNING id`);
    if (updated.rows.length !== 1) throw new CareerError(409, "Match result was already recorded");
    const progress = await progressEvent(tx, root, state, event, lastDayOfWeek(Number(root.current_week)), await bind(tx, root));
    return { matchId: match.id, winnerKey: winner, eventStatus: event.status, eventCompleted: progress.completed, nextHumanMatchIds: progress.awaitingHuman.map(m => m.id) };
  }
  async function eventOwned(tx: CareerExecutor, saveId: string, eventId: string) {
    const event = (await loadInstances(tx, saveId, sql`id = ${eventId}`))[0];
    if (!event) throw new CareerError(404, "Career event not found");
    return event;
  }

  /** The human's next confirmed entry that has not finished (null when nothing is booked). */
  async function nextHumanEntry(tx: CareerExecutor, saveId: string) {
    const row = (await tx.execute(sql`SELECT i.id, i.name, i.season, i.start_week FROM career_event_entries e JOIN career_event_instances i
      ON i.career_save_id = e.career_save_id AND i.id = e.event_id WHERE e.career_save_id = ${saveId} AND e.participant_key = ${HUMAN} AND e.status <> 'WITHDRAWN'
      AND i.status NOT IN ('COMPLETED','CANCELLED') ORDER BY i.season, i.start_day, i.id LIMIT 1`)).rows[0];
    return row ? { eventId: String(row.id), name: String(row.name), season: Number(row.season), week: Number(row.start_week) } : null;
  }
  /** Meaningful-date evaluation for a (season, week). */
  async function meaningfulReasons(tx: CareerExecutor, root: RootRow, season: number, week: number) {
    const events = await loadInstances(tx, root.id, sql`season = ${season} AND start_week = ${week}`);
    const human = await loadHumanContext(tx, root, season, events, await bind(tx, root));
    const windows = seriesWindowsOf(await loadInstances(tx, root.id, sql`season = ${season} AND series_key IS NOT NULL`));
    return reasonsFor(events, human, windows, season, week);
  }

  /** Calendar overview with next meaningful date, computed from one season load. */
  async function overview(tx: CareerExecutor, root: RootRow, seasonRow: Record<string, unknown>,
    loaded?: { events: InstanceRow[]; human: HumanContext; windows: SeriesWindows }) {
    const season = Number(root.current_season), week = Number(root.current_week);
    const pending = (await tx.execute(sql`SELECT m.id, m.event_id FROM career_tournament_matches m JOIN career_event_instances i ON i.career_save_id = m.career_save_id AND i.id = m.event_id
      WHERE m.career_save_id = ${root.id} AND m.status = 'AWAITING_HUMAN' AND i.season = ${season}`)).rows;
    const pendingTournamentActions:{eventId:string;kind:"GROUP_BULL_UP";group:string}[]=[];
    const groupEvents=await loadInstances(tx,root.id,sql`season=${season} AND status='IN_PROGRESS' AND snapshot->'format'->>'structure' IN ('GROUP_KNOCKOUT','LEAGUE')`);
    for(const e of groupEvents) {
      const withdrawn=new Set((await tx.execute(sql`SELECT participant_key FROM career_event_entries WHERE career_save_id=${root.id}
        AND event_id=${e.id} AND status='WITHDRAWN'`)).rows.map(r=>String(r.participant_key)));
      for(const g of resolvedGroups(await loadMatches(tx,root.id,e.id),await loadBulls(tx,root.id,e.id),withdrawn,layoutFor(e.snapshot.format.structure)))
        if(g.pending?.pair.includes(HUMAN))pendingTournamentActions.push({eventId:e.id,kind:"GROUP_BULL_UP",group:g.key});
    }
    // The calendar read passes the current season's context it already loaded (one load, not two).
    const events = loaded ? loaded.events.filter(e => e.start_week >= week) : await loadInstances(tx, root.id, sql`season = ${season} AND start_week >= ${week}`);
    const human = loaded?.human ?? await loadHumanContext(tx, root, season, events, await bind(tx, root));
    const windows = loaded?.windows ?? seriesWindowsOf(await loadInstances(tx, root.id, sql`season = ${season} AND series_key IS NOT NULL`));
    let next: { season: number; week: number; reasons: unknown[] } | null = null;
    for (let w = week + 1; w <= WEEKS_PER_SEASON && !next; w++) {
      const reasons = reasonsFor(events.filter(e => e.start_week === w), human, windows, season, w);
      if (reasons.length) next = { season, week: w, reasons };
    }
    next ??= { season: season + 1, week: 1, reasons: [{ type: "SEASON_BOUNDARY" }] };
    return {
      season, week, grouping: groupingForWeek(week), groupings: SEASON_GROUPINGS, status: String(seasonRow.status),
      playedWeek: Number(seasonRow.played_week), developedWeek: Number(seasonRow.developed_week), eventDatabaseVersion: Number(seasonRow.event_database_version),
      instanceCount: Number(seasonRow.instance_count), developmentCadence: DEVELOPMENT_CADENCE,
      pendingHumanMatches: pending.map(r => ({ matchId: String(r.id), eventId: String(r.event_id) })),
      pendingTournamentActions,
      nextHumanEntry: await nextHumanEntry(tx, root.id),
      currentWeekActions: reasonsFor(events.filter(e => e.start_week === week), human, windows, season, week),
      nextMeaningful: pending.length||pendingTournamentActions.length ? { season, week, reasons: [{ type: pending.length?"HUMAN_MATCH_PENDING":"GROUP_BULL_UP" }] } : next,
    };
  }

  // -------------------------------------------------------------- one week step (several short transactions)
  async function stepWeek(actor: CareerActor, saveId: string) {
    const played = await database.transaction(async tx => {
      const { root, world: state, season } = await requireSeason(tx, actor, saveId);
      if(await providers.history?.pending(tx,root))throw new CareerError(409,"Read the completed Season Review and begin the new season before advancing");
      const s = Number(root.current_season), w = Number(root.current_week);
      if (Number(season.played_week) >= w) return { season: s, week: w, summary: null as unknown, blocked: false };
      const summary = await playWeek(tx, root, state, s, w, await bind(tx, root));
      if (summary.awaitingHuman.length) return { season: s, week: w, summary, blocked: true };
      await tx.execute(sql`UPDATE career_seasons SET played_week = ${w} WHERE career_save_id = ${saveId} AND season = ${s} AND played_week = ${w - 1}`);
      // A5: ranking publication / Q-School allocation / season review for the completed week (same transaction).
      await providers.sporting?.afterWeek(tx, root, s, w);
      await settleLifeCommitments(tx,root,s,w);
      // Club team nights (Wednesday): played after the week's events, so anyone booked into one sits the team night out.
      await playTeamNights(tx, root, s, w);
      // DartCast: monthly sub renewals and brand offers.
      await settleStreamingWeek(tx, root, s, w);
      // Webcam leagues: the round plays out (an unplayed match of yours is forfeited); prizes at the end.
      await settleCamWeek(tx, root, s, w);
      // Pro-Am nights: a missed slot, or the night you were booked to be the pro.
      await settleProAmWeek(tx, root, s, w);
      return { season: s, week: w, summary, blocked: false };
    });
    if (played.blocked) return { ...played, advancedTo: null };
    // Canonical cadence: exactly one A2 PERIOD per played week. A2 rejects/returns retries itself.
    await world.advancePeriod(actor, saveId, { season: played.season, period: played.week, elapsedYears: DEVELOPMENT_CADENCE.elapsedYearsPerPeriod, opportunity: DEVELOPMENT_CADENCE.opportunity });
    const committed = await database.transaction(async tx => {
      const { root, season } = await requireSeason(tx, actor, saveId);
      if (Number(root.current_season) !== played.season) return { seasonEnd: false, next: { season: Number(root.current_season), week: Number(root.current_week) } };
      const period = (await tx.execute(sql`SELECT 1 FROM career_world_periods WHERE career_save_id = ${saveId} AND season = ${played.season} AND kind = 'PERIOD' AND sequence = ${played.week}`)).rows[0];
      if (!period) throw new CareerError(409, "A2 development period missing for played week");
      if (Number(season.developed_week) < played.week) await tx.execute(sql`UPDATE career_seasons SET developed_week = ${played.week} WHERE career_save_id = ${saveId} AND season = ${played.season} AND developed_week = ${played.week - 1}`);
      if (played.week < WEEKS_PER_SEASON) {
        await tx.execute(sql`UPDATE career_saves SET current_week = ${played.week + 1}, updated_at = NOW() WHERE id = ${saveId} AND current_week = ${played.week}`);
        await openRegistrations(tx, saveId, played.season, played.week + 1);
        await providers.finance?.onCalendarMoved(tx, root, played.season, played.week + 1);
        await providers.sporting?.onCalendarMoved(tx, root, played.season, played.week + 1);
        return { seasonEnd: false, next: { season: played.season, week: played.week + 1 } };
      }
      const open = (await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_event_instances WHERE career_save_id = ${saveId} AND season = ${played.season} AND status NOT IN ('COMPLETED','CANCELLED')`)).rows[0];
      if (Number(open.n) > 0) throw new CareerError(409, "Season cannot close with unfinished events");
      return { seasonEnd: true, next: null };
    });
    if (!committed.seasonEnd) return { ...played, advancedTo: committed.next };
    // A2 is the sole authority for off-season development/aging/retirement/replacement and the root season counter.
    const offSeason = await world.processOffSeason(actor, saveId, { season: played.season, opportunity: DEVELOPMENT_CADENCE.offSeasonOpportunity });
    const next = await database.transaction(async tx => {
      const { root } = await open(tx, actor, saveId);
      await finalizeSeason(tx, root, played.season);
      await ensureSeason(tx, root, Number(root.current_season));
      await openRegistrations(tx, saveId, Number(root.current_season), Number(root.current_week));
      await providers.finance?.onCalendarMoved(tx, root, Number(root.current_season), Number(root.current_week));
      await providers.sporting?.onCalendarMoved(tx, root, Number(root.current_season), Number(root.current_week));
      await providers.history?.afterSeason(tx,root,played.season);
      return { season: Number(root.current_season), week: Number(root.current_week) };
    });
    return { ...played, advancedTo: next, offSeason };
  }
  async function finalizeSeason(tx: CareerExecutor, root: RootRow, season: number) {
    const row = (await tx.execute(sql`SELECT * FROM career_seasons WHERE career_save_id = ${root.id} AND season = ${season}`)).rows[0];
    if (!row || row.status === "COMPLETED") return;
    const off = (await tx.execute(sql`SELECT 1 FROM career_world_periods WHERE career_save_id = ${root.id} AND season = ${season} AND kind = 'OFF_SEASON'`)).rows[0];
    if (!off || Number(root.current_season) !== season + 1) throw new CareerError(409, "Season can only close after A2 off-season processing");
    await tx.execute(sql`UPDATE career_qualification_entitlements SET status = 'EXPIRED', resolved_at = NOW() WHERE career_save_id = ${root.id} AND status = 'ACTIVE' AND target_season <= ${season}`);
    // Bookings are derived scheduling locks; history lives in entries/matches/results.
    await tx.execute(sql`DELETE FROM career_participant_bookings WHERE career_save_id = ${root.id} AND season = ${season}`);
    await tx.execute(sql`UPDATE career_seasons SET status = 'COMPLETED', off_season_processed = TRUE, completed_at = NOW() WHERE career_save_id = ${root.id} AND season = ${season}`);
  }

  async function enterInTx(tx: CareerExecutor, root: RootRow, event: InstanceRow) {
    const season = Number(root.current_season);
    const siblings = event.series_key ? await loadInstances(tx, root.id, sql`season = ${event.season} AND series_key = ${event.series_key}`) : [event];
    const all = await loadInstances(tx, root.id, sql`season = ${season} AND series_key IS NOT NULL`);
    const human = await loadHumanContext(tx, root, season, siblings, await bind(tx, root));
    const view = humanView(event, human, seriesWindowsOf(all));
    if (view.denials.includes("ALREADY_ENTERED") && view.denials.length === 1) return { created: false, view };
    if (!view.canEnter) return { created: false, denied: view.denials, view };
    const excluded = await exclusiveConflicts(tx, root.id, event);
    if (excluded.has(HUMAN)) return { created: false, denied: ["NOT_ELIGIBLE"] as DenialReason[], view };
    const financeDenials = providers.finance ? await providers.finance.entryCheck(tx, root, event, siblings) : [];
    if (financeDenials.length) return { created: false, denied: financeDenials, view };
    for (const target of siblings) {
      if (target.status !== "REGISTRATION_OPEN") return { created: false, denied: ["REGISTRATION_CLOSED"] as DenialReason[], view };
      await tx.execute(sql`INSERT INTO career_event_entries (career_save_id, event_id, participant_key, participant_kind, npc_id, source, status, entered_season, entered_week)
        VALUES (${root.id}, ${target.id}, ${HUMAN}, 'HUMAN', NULL, 'HUMAN_ENTRY', 'ENTERED', ${season}, ${root.current_week})
        ON CONFLICT (career_save_id, event_id, participant_key) DO UPDATE SET status = 'ENTERED', withdrawn_at = NULL, created_at = NOW()
        WHERE career_event_entries.status = 'WITHDRAWN'`);
      await insertBookings(tx, root.id, season, target, [HUMAN]);
    }
    // In through your manager's invitation: record it (their cut of the prize money comes from these events alone).
    const manager = view.managerInvite ? await activeManager(tx, root.id) : null;
    if (manager) await recordManagerInvites(tx, root.id, manager, siblings.map(t => t.id));
    // A4: the entry fee is charged in this same transaction; a failure rolls the entry back.
    await providers.finance?.onHumanEntry(tx, root, event, siblings);
    await tx.execute(sql`UPDATE career_saves SET updated_at = NOW() WHERE id = ${root.id}`);
    return { created: true, view };
  }

  return {
    providers,
    bind,
    async groupBull(actor: CareerActor, saveId: string, eventId: string, body: unknown) {
      careerIdSchema.parse(eventId);
      const input = z.object({group:z.enum(["A","B","C","D"]),tieKey:z.string().min(1).max(512),
        ordinal:z.number().int().positive(),expectedRevision:z.number().int().nonnegative(),
        throw:z.enum(["INNER","OUTER","MISS"])}).strict().parse(body);
      return database.transaction(async tx => {
        const {root,world:state}=await requireSeason(tx,actor,saveId);
        const event=await eventOwned(tx,root.id,eventId);
        if(event.status!=="IN_PROGRESS" || !isGroupedStructure(event.snapshot.format.structure))
          throw new CareerError(409,"Event is not awaiting a group bull playoff");
        const withdrawn=new Set((await tx.execute(sql`SELECT participant_key FROM career_event_entries WHERE career_save_id=${root.id}
          AND event_id=${eventId} AND status='WITHDRAWN'`)).rows.map(r=>String(r.participant_key)));
        await humanGroupBull(tx,root,event,await loadMatches(tx,root.id,eventId),withdrawn,input.group,input.tieKey,input.ordinal,input.expectedRevision,input.throw);
        await progressEvent(tx,root,state,event,lastDayOfWeek(Number(root.current_week)),await bind(tx,root));
        return {recorded:true};
      });
    },
    async concedeMatch(actor: CareerActor, saveId: string, eventId: string, body: unknown) {
      careerIdSchema.parse(eventId);
      const input=z.object({matchId:careerIdSchema,confirmation:z.literal("CONCEDE_MATCH")}).strict().parse(body);
      return database.transaction(async tx=>{
        const {root,world:state}=await requireSeason(tx,actor,saveId);
        const event=await eventOwned(tx,root.id,eventId);
        const m=(await loadMatches(tx,root.id,eventId)).find(m=>m.id===input.matchId);
        if(!m || ![m.a_key,m.b_key].includes(HUMAN))throw new CareerError(404,"Your tournament match was not found");
        if(m.status==="WALKOVER" && (m.summary as {action?:string}|null)?.action==="CONCEDE_MATCH")return {conceded:false};
        if(event.status!=="IN_PROGRESS" || m.status!=="AWAITING_HUMAN")throw new CareerError(409,"Match is no longer awaiting you");
        const winner=m.a_key===HUMAN?m.b_key:m.a_key;
        if(!winner)throw new CareerError(409,"Opponent is not known");
        await tx.execute(sql`UPDATE career_tournament_matches SET status='WALKOVER',winner_key=${winner},result_source='WALKOVER',
          summary='{"action":"CONCEDE_MATCH"}'::jsonb,completed_at=NOW() WHERE career_save_id=${root.id} AND id=${m.id} AND status='AWAITING_HUMAN'`);
        await progressEvent(tx,root,state,event,lastDayOfWeek(Number(root.current_week)),await bind(tx,root));
        return {conceded:true};
      });
    },
    /**
     * Quick-sim: the human's waiting match is played by the A2 simulator at the human's own level (their live
     * three-dart average, adjusted for form and confidence), then recorded through the same human-result boundary
     * as live darts, marked as a simulation. Refused once live darts have been thrown in the match, and for pairs.
     */
    async quickSimMatch(actor: CareerActor, saveId: string, eventId: string, body: unknown) {
      careerIdSchema.parse(eventId);
      const input = z.object({ matchId: careerIdSchema, confirmation: z.literal("QUICK_SIM") }).strict().parse(body);
      return database.transaction(async tx => {
        const { root } = await requireSeason(tx, actor, saveId);
        const event = await eventOwned(tx, root.id, eventId);
        const matches = await loadMatches(tx, root.id, eventId);
        const m = matches.find(x => x.id === input.matchId);
        if (!m || ![m.a_key, m.b_key].includes(HUMAN)) throw new CareerError(404, "Your tournament match was not found");
        if (event.status !== "IN_PROGRESS" || m.status !== "AWAITING_HUMAN") throw new CareerError(409, "Match is no longer awaiting you");
        const live = (await tx.execute(sql`SELECT status, jsonb_array_length(darts)::int AS darts FROM career_match_sessions WHERE career_save_id = ${root.id} AND match_id = ${m.id}`)).rows[0];
        if (live && (live.status === "COMPLETED" || Number(live.darts) > 0)) throw new CareerError(409, "You have started this match live; finish it at the oche");
        const humanSide = m.a_key === HUMAN ? 0 : 1, opponentKey = humanSide === 0 ? m.b_key : m.a_key;
        const opponent = opponentKey ? (await loadNpcs(tx, root.id, { ids: [opponentKey] }))[0] : undefined;
        if (!opponent || opponent.status !== "ACTIVE") throw new CareerError(409, "Opponent is not known");
        const form = await loadHumanForm(tx, root as RootRow & { player_id?: number });
        let you = humanSimulationPlayer(root, opponent, form), them = opponent, opponentName = `${opponent.firstName} ${opponent.surname}`;
        // Pairs: each side plays as its team (you and your partner, the other captain and theirs), as NPC pairs matches do.
        if (event.snapshot.format.sideSize === 2) {
          const teams = await loadPairs(tx, root.id, [eventId]), mine = teams.get(`${eventId}|${HUMAN}`), theirs = teams.get(`${eventId}|${opponentKey}`);
          if (!mine || !theirs) throw new CareerError(409, "Pairs match has no recorded team");
          const partners = new Map((await loadNpcs(tx, root.id, { ids: [mine.partner_npc_id, theirs.partner_npc_id] })).map(n => [n.id, n]));
          const myPartner = partners.get(mine.partner_npc_id), theirPartner = partners.get(theirs.partner_npc_id);
          if (!myPartner || !theirPartner) throw new CareerError(409, "Pairs partner is not known");
          you = teamComposite(you, myPartner); them = teamComposite(opponent, theirPartner);
          opponentName = `${opponentName} & ${theirPartner.firstName} ${theirPartner.surname}`;
        }
        const sides = (humanSide === 0 ? [you, them] : [them, you]) as [Npc, Npc];
        const key = `${matchKeyFor(event, m.stage_key, m.round, m.slot)}:quick-sim`;
        const bull = simulateBullUp(sides[0], sides[1], root.world_seed, key);
        const knockout = matches.filter(x => !isGroupMatch(x)), rounds = Math.max(1, ...knockout.map(x => x.round));
        const roundImportance = Math.round(m.round / (isGroupMatch(m) ? layoutFor(event.snapshot.format.structure).schedule.length : rounds) * 1000) / 1000;
        const result = simulateNpcMatch({ players: sides, seed: root.world_seed, generationVersion: root.world_generation_version, matchKey: key,
          difficulty: root.difficulty, context: { category: event.snapshot.format.matchContext, roundImportance: Math.min(1, roundImportance), elimination: !isGroupMatch(m) },
          format: a2MatchFormat(event.snapshot.format, m.best_of, bull.firstThrow) });
        const mine = result.stats[humanSide], theirs = result.stats[1 - humanSide];
        const averages = [Math.round(result.stats[0].average * 100) / 100, Math.round(result.stats[1].average * 100) / 100];
        const recorded = await recordHumanResultTx(tx, actor, saveId, { matchId: m.id, humanLegs: mine.legsWon, opponentLegs: theirs.legsWon,
          humanThrewFirst: bull.firstThrow === humanSide, ...(mine.setsWon !== undefined ? { humanSets: mine.setsWon, opponentSets: theirs.setsWon } : {}) }, {
          summary: { quickSim: { skillAverage: form.skillAverage, form: form.form, confidence: form.confidence }, averages,
            checkoutPercentages: [result.stats[0].checkoutPercentage, result.stats[1].checkoutPercentage].map(n => Math.round(n * 100) / 100),
            maximums: [result.stats[0].maximums, result.stats[1].maximums], highestCheckouts: [result.stats[0].highestCheckout, result.stats[1].highestCheckout],
            simulationVersion: result.simulationVersion,
            ...((nines => nines[0] || nines[1] ? { nineDarters: nines } : {})(simulatedNineDarters(result.legs, event.snapshot.format))) },
          firstThrowDetail: { method: "SIMULATED_BULL_UP", throws: bull.throws } });
        return { ...recorded, quickSim: { won: recorded.winnerKey === HUMAN, legs: [mine.legsWon, theirs.legsWon], sets: mine.setsWon !== undefined ? [mine.setsWon, theirs.setsWon] : null,
          yourAverage: Math.round(mine.average * 100) / 100, opponentAverage: Math.round(theirs.average * 100) / 100, opponent: opponentName,
          maximums: mine.maximums, highestCheckout: mine.highestCheckout, form } };
      });
    },
    /** The human's form and confidence (from live darts, recent results and the week's practice). */
    async form(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const { root } = await open(tx, actor, saveId);
        return loadHumanForm(tx, root as RootRow & { player_id?: number });
      });
    },
    /** Idempotent: ensures the A2 world, then the current season calendar. */
    async initialize(actor: CareerActor, saveId: string) {
      careerIdSchema.parse(saveId);
      await world.initialize(actor, saveId);
      return database.transaction(async tx => {
        const { root } = await open(tx, actor, saveId);
        const created = await ensureSeason(tx, root, Number(root.current_season));
        await openRegistrations(tx, saveId, Number(root.current_season), Number(root.current_week));
        return { season: Number(root.current_season), week: Number(root.current_week), created: created.created, instanceCount: Number(created.season.instance_count) };
      });
    },

    /** options.overview=false: callers that only want the events (Goals) skip the season overview and its read of every week ahead. */
    async calendar(actor: CareerActor, saveId: string, query: unknown = {}, options: { overview?: boolean } = {}) {
      const q = calendarQuerySchema.parse(query);
      return database.transaction(async tx => {
        const { root, season: seasonRow } = await requireSeason(tx, actor, saveId, false);
        await ensureMidweekCircuit(tx, root);
        await ensurePathwayEvents(tx, root);
        // Sponsor activity upkeep in one round trip (the three updates touch disjoint rows).
        await tx.execute(sql`WITH available AS (UPDATE career_sponsor_commitments SET status='AVAILABLE',updated_at=NOW()
            WHERE career_save_id=${root.id} AND status='PLANNED' AND scheduling_requirements->>'activitySpecVersion'='1'
              AND season=${root.current_season} AND available_from_week<=${root.current_week} AND due_week>=${root.current_week} RETURNING 1),
          missed AS (UPDATE career_sponsor_commitments SET status='MISSED',
            resolution_evidence=COALESCE(resolution_evidence,'{}'::jsonb)||jsonb_build_object('reason','DEADLINE_PASSED','season',season,'week',due_week),
            updated_at=NOW() WHERE career_save_id=${root.id} AND required=true AND status IN ('PLANNED','AVAILABLE','CONFIRMED')
            AND scheduling_requirements->>'activitySpecVersion'='1'
            AND (season < ${root.current_season} OR (season=${root.current_season} AND due_week < ${root.current_week})) RETURNING 1)
          UPDATE career_sponsor_opportunities SET status='EXPIRED',updated_at=NOW()
          WHERE career_save_id=${root.id} AND status IN ('AVAILABLE','ACCEPTED','CONFIRMED')
          AND terms->>'activitySpecVersion'='1'
          AND (season < ${root.current_season} OR (season=${root.current_season} AND available_to_week < ${root.current_week}))`);
        const season = q.season ?? Number(root.current_season);
        const filters = [sql`season = ${season}`];
        if (q.fromWeek) filters.push(sql`end_week >= ${q.fromWeek}`);
        if (q.toWeek) filters.push(sql`start_week <= ${q.toWeek}`);
        if (q.circuit) filters.push(sql`circuit = ${q.circuit}`);
        if (q.classification) filters.push(sql`classification = ${q.classification}`);
        if (q.family) filters.push(sql`family = ${q.family}`);
        if (q.scope === "FEATURED") filters.push(sql`featured`);
        const events = (await loadInstances(tx, root.id, sql.join(filters, sql` AND `))).sort((a, b) => a.start_day - b.start_day || b.calendar_priority - a.calendar_priority || (a.instance_key < b.instance_key ? -1 : 1));
        // For the current season, one human context covers both the requested events and the overview's weeks ahead.
        const current = season === Number(root.current_season) && options.overview !== false;
        // Reuse the requested events when they already cover every week from now on (the whole-season and map reads).
        const coversAhead = (!q.fromWeek || q.fromWeek <= Number(root.current_week)) && (!q.toWeek || q.toWeek >= 52) && !q.circuit && !q.classification && !q.family && q.scope !== "FEATURED";
        const ahead = !current ? [] : coversAhead ? events.filter(e => e.start_week >= Number(root.current_week))
          : await loadInstances(tx, root.id, sql`season = ${season} AND start_week >= ${Number(root.current_week)}`);
        const seen = new Set(events.map(e => e.id));
        const human = await loadHumanContext(tx, root, season, [...events, ...ahead.filter(e => !seen.has(e.id))], await bind(tx, root));
        const windows = seriesWindowsOf(await loadInstances(tx, root.id, sql`season = ${season} AND series_key IS NOT NULL`));
        // Scope filters run before the money previews (the costly part), so a filtered view only prices what it shows.
        const views = events.map(event => ({ event, human: humanView(event, human, windows) }));
        const shown = views.filter(({ human: h }) => q.scope === "MY_SCHEDULE" ? !!h && ["ENTERED", "CONFIRMED", "PLAYING", "COMPLETED", "WITHDRAWN"].includes(h.relationship)
          : q.scope === "AVAILABLE" ? !!h?.canEnter
          : q.scope === "RELEVANT" ? !!h && (h.canEnter || h.eligible || !["AVAILABLE", "NOT_ELIGIBLE"].includes(h.relationship))
          : true);
        const previews = providers.finance ? await providers.finance.previews(tx, root, season, shown.map(v => v.event)) : null;
        const priced = shown.map(({ event, human: h }) => withFinance(presentEvent(event, h), previews?.get(event.id)));
        // Pricing can still close an entry (INSUFFICIENT_FUNDS), so AVAILABLE is checked again once the money is known.
        const rows = q.scope === "AVAILABLE" ? priced.filter(e => e.human?.canEnter) : priced;
        const sponsorCommitments=(await tx.execute(sql`SELECT id,contract_id,sponsor_key,commitment_type AS kind,season,available_from_week,
          due_week AS to_week,scheduled_week,status,true AS required FROM career_sponsor_commitments
          WHERE career_save_id=${root.id} AND season=${season} AND status NOT IN ('COMPLETED','MISSED','CANCELLED')
          AND COALESCE(scheduled_week,due_week,available_from_week) BETWEEN ${q.fromWeek??1} AND ${q.toWeek??52}
          ORDER BY COALESCE(scheduled_week,due_week,available_from_week),id`)).rows;
        const sponsorOpportunities=(await tx.execute(sql`SELECT id,contract_id,sponsor_key,opportunity_type AS kind,season,
          available_from_week,available_to_week AS to_week,scheduled_week,status,false AS required FROM career_sponsor_opportunities
          WHERE career_save_id=${root.id} AND season=${season} AND status NOT IN ('COMPLETED','DECLINED','EXPIRED','CANCELLED')
          AND COALESCE(scheduled_week,available_from_week) BETWEEN ${q.fromWeek??1} AND ${q.toWeek??52}
          ORDER BY COALESCE(scheduled_week,available_from_week),id`)).rows;
        return { overview: options.overview === false ? null : await overview(tx, root, seasonRow, current ? { events: ahead, human, windows } : undefined), season, scope: q.scope, events: rows,
          sponsorActivities:[...sponsorCommitments,...sponsorOpportunities] };
      });
    },

    async event(actor: CareerActor, saveId: string, eventId: string) {
      careerIdSchema.parse(eventId);
      return database.transaction(async tx => {
        const { root } = await requireSeason(tx, actor, saveId, false);
        const event = await eventOwned(tx, root.id, eventId);
        const human = await loadHumanContext(tx, root, event.season, [event], await bind(tx, root));
        const windows = seriesWindowsOf(await loadInstances(tx, root.id, sql`season = ${event.season} AND series_key IS NOT NULL`));
        const entries = (await tx.execute(sql`SELECT e.participant_key, e.participant_kind, e.npc_id, e.source, e.status, e.draw_seed, p.first_name, p.surname, p.nickname, p.nationality, p.tier
          FROM career_event_entries e LEFT JOIN career_world_players p ON p.career_save_id = e.career_save_id AND p.id = e.npc_id
          WHERE e.career_save_id = ${root.id} AND e.event_id = ${eventId} ORDER BY e.draw_seed NULLS LAST, e.participant_key`)).rows;
        const name = new Map(entries.map(e => [String(e.participant_key), e.participant_kind === "HUMAN" ? "You" : `${e.first_name} ${e.surname}`]));
        const matches = await loadMatches(tx, root.id, eventId);
        const results = (await tx.execute(sql`SELECT participant_key, finishing_position, stage_reached, is_champion, wins, losses, legs_for, legs_against, matches_played
          FROM career_event_results WHERE career_save_id = ${root.id} AND event_id = ${eventId} ORDER BY finishing_position, participant_key`)).rows;
        const rounds = matches.length ? Math.max(...matches.map(m => m.round)) : 0;
        const humanNext = matches.find(m => (m.a_key === HUMAN || m.b_key === HUMAN) && ["PENDING", "AWAITING_HUMAN"].includes(m.status)) ?? null;
        const present = (m: MatchRow) => ({ id: m.id, stage: m.stage_key, round: m.round, roundName: m.stage_key.startsWith("groups:") ? `GROUP_ROUND_${m.round}` : rounds ? stageNameFor(m.round, rounds) : null, slot: m.slot, bestOf: m.best_of, scheduledDay: m.scheduled_day,
          a: m.a_key ? { key: m.a_key, name: name.get(m.a_key) ?? null } : null, b: m.b_key ? { key: m.b_key, name: name.get(m.b_key) ?? null } : null,
          status: m.status, winnerKey: m.winner_key, legs: m.legs_a === null ? null : [m.legs_a, m.legs_b], firstThrow: m.first_throw, firstThrowMethod: m.first_throw_method,
          resultSource: m.result_source, summary: m.summary });
        return {
          event: withFinance(presentEvent(event, humanView(event, human, windows)), providers.finance ? (await providers.finance.previews(tx, root, event.season, [event])).get(event.id) : undefined),
          field: entries.map(e => ({ participantKey: String(e.participant_key), kind: e.participant_kind, name: name.get(String(e.participant_key)), nationality: e.nationality ?? null,
            tier: e.tier ?? null, source: e.source, status: e.status, seed: e.draw_seed })),
          draw: { rounds, matches: matches.map(present) },
          progress: { totalMatches: matches.filter(m => m.status !== "BYE").length, completedMatches: matches.filter(m => ["COMPLETED", "WALKOVER"].includes(m.status)).length,
            currentRound: matches.filter(m => !["COMPLETED", "BYE", "WALKOVER"].includes(m.status)).reduce((min, m) => Math.min(min, m.round), rounds + 1) },
          human: { nextMatch: humanNext ? present(humanNext) : null, result: human.results.get(eventId) ?? null },
          results: results.map(r => ({ participantKey: String(r.participant_key), name: name.get(String(r.participant_key)) ?? null, position: Number(r.finishing_position), stageReached: r.stage_reached,
            champion: r.is_champion, wins: r.wins, losses: r.losses, legsFor: r.legs_for, legsAgainst: r.legs_against, matchesPlayed: r.matches_played })),
        };
      });
    },

    async enter(actor: CareerActor, saveId: string, body: unknown) {
      const { eventId } = eventRefSchema.parse(body);
      return database.transaction(async tx => {
        const { root } = await requireSeason(tx, actor, saveId);
        const event = await eventOwned(tx, root.id, eventId);
        const outcome = await enterInTx(tx, root, event);
        if ("denied" in outcome && outcome.denied) return { entered: false, created: false, denials: outcome.denied, event: presentEvent(event, outcome.view) };
        return { entered: true, created: outcome.created, denials: [] as DenialReason[], event: presentEvent(event) };
      });
    },

    async withdraw(actor: CareerActor, saveId: string, body: unknown) {
      const { eventId } = eventRefSchema.parse(body);
      return database.transaction(async tx => {
        const { root, world: state } = await requireSeason(tx, actor, saveId);
        const event = await eventOwned(tx, root.id, eventId);
        const entry = (await tx.execute(sql`SELECT status FROM career_event_entries WHERE career_save_id = ${root.id} AND event_id = ${eventId} AND participant_key = ${HUMAN}`)).rows[0];
        if (!entry || entry.status === "WITHDRAWN") return { withdrawn: false, denials: ["NOT_ENTERED"] as DenialReason[] };
        if (finished(event.status)) return { withdrawn: false, denials: ["EVENT_FINISHED"] as DenialReason[] };
        const postLock = locked(event.status);
        const targets = event.series_key ? (await loadInstances(tx, root.id, sql`season = ${event.season} AND series_key = ${event.series_key}`)).filter(e => !finished(e.status)) : [event];
        for (const target of targets) {
          await tx.execute(sql`UPDATE career_event_entries SET status = 'WITHDRAWN', withdrawn_at = NOW() WHERE career_save_id = ${root.id} AND event_id = ${target.id} AND participant_key = ${HUMAN} AND status <> 'WITHDRAWN'`);
          await tx.execute(sql`DELETE FROM career_participant_bookings WHERE career_save_id = ${root.id} AND event_id = ${target.id} AND participant_key = ${HUMAN}`);
          // Post-lock withdrawal is auditable: the entry stays, matches resolve as walkovers.
          if (target.status === "IN_PROGRESS") await progressEvent(tx, root, state, target, lastDayOfWeek(Number(root.current_week)), await bind(tx, root));
        }
        await providers.finance?.onHumanWithdraw(tx, root, targets, postLock);
        return { withdrawn: true, postLock, denials: [] as DenialReason[] };
      });
    },

    /**
     * Human live-match boundary. The real result will come from TKDL's GameScorer
     * (later phase); A3 validates and records it, then continues the tournament.
     * Not exposed over HTTP so clients cannot self-report results.
     */
    async recordHumanMatchResult(actor: CareerActor, saveId: string, body: unknown) {
      const input = humanResultSchema.parse(body);
      return database.transaction(async tx => recordHumanResultTx(tx, actor, saveId, input));
    },
    /** Same boundary inside a caller's transaction (Career live match session completion). */
    async recordHumanMatchResultInTx(tx: CareerExecutor, actor: CareerActor, saveId: string, body: unknown) {
      return recordHumanResultTx(tx, actor, saveId, humanResultSchema.parse(body));
    },
    /**
     * A phone that loses signal mid-advance retries with the same operationKey while this process may still be
     * running the first request: the retry joins it and gets the same result instead of advancing twice. A
     * different advance for the same save meanwhile is refused (only one advance per save at a time).
     */
    advance(actor: CareerActor, saveId: string, body: unknown) {
      const request = advanceSchema.parse(body);
      const running = ADVANCES_IN_FLIGHT.get(saveId);
      if (running) {
        if (running.operationKey === request.operationKey && running.playerId === actor.playerId) return running.result as ReturnType<typeof runAdvance>;
        return Promise.reject(new CareerError(409, "This Career is already advancing; wait for it to finish")) as ReturnType<typeof runAdvance>;
      }
      const result = runAdvance(actor, saveId, request).finally(() => ADVANCES_IN_FLIGHT.delete(saveId));
      ADVANCES_IN_FLIGHT.set(saveId, { operationKey: request.operationKey, playerId: actor.playerId, result });
      return result;
    },

    async history(actor: CareerActor, saveId: string, query: { participantKey?: string; definitionKey?: string; season?: number; limit?: number } = {}) {
      return database.transaction(async tx => {
        const { root } = await open(tx, actor, saveId, false);
        const filters = [sql`r.career_save_id = ${root.id}`];
        if (query.participantKey) filters.push(sql`r.participant_key = ${query.participantKey}`);
        if (query.definitionKey) filters.push(sql`r.definition_key = ${query.definitionKey}`);
        if (query.season) filters.push(sql`r.season = ${query.season}`);
        if (!query.participantKey) filters.push(sql`r.is_champion`);
        const rows = (await tx.execute(sql`SELECT r.*, i.name, i.circuit, i.classification, i.presentation_tier, i.start_week, i.venue_key, i.country
          FROM career_event_results r JOIN career_event_instances i ON i.career_save_id = r.career_save_id AND i.id = r.event_id
          WHERE ${sql.join(filters, sql` AND `)} ORDER BY r.season DESC, i.start_day DESC, r.finishing_position LIMIT ${Math.min(query.limit ?? 200, 1000)}`)).rows;
        return rows.map(r => ({ eventId: r.event_id, season: r.season, name: r.name, definitionKey: r.definition_key, circuit: r.circuit, classification: r.classification,
          presentationTier: r.presentation_tier, week: r.start_week, venueKey: r.venue_key, country: r.country, participantKey: r.participant_key,
          position: r.finishing_position, stageReached: r.stage_reached, champion: r.is_champion, wins: r.wins, losses: r.losses, legsFor: r.legs_for, legsAgainst: r.legs_against }));
      });
    },

    /** A5 boundary: ranking-derived entitlements reuse the same persisted model. */
    async issueProviderEntitlement(actor: CareerActor, saveId: string, body: unknown) {
      const input = providerEntitlementSchema.parse(body);
      return database.transaction(async tx => {
        const { root } = await open(tx, actor, saveId);
        const npc = input.recipientKey === HUMAN ? null : (await tx.execute(sql`SELECT id FROM career_world_players WHERE career_save_id = ${root.id} AND id::text = ${input.recipientKey}`)).rows[0];
        if (input.recipientKey !== HUMAN && !npc) throw new CareerError(404, "Career participant not found");
        const idempotency = `provider:${input.providerId}:${input.idempotencyKey}`;
        await insertEntitlements(tx, root.id, Number(root.current_season), [{ id: stableUuid(root.world_seed, CALENDAR_GENERATION_VERSION, "entitlement", idempotency), idempotency_key: idempotency,
          recipient_key: input.recipientKey, recipient_kind: npc ? "NPC" : "HUMAN", npc_id: npc ? input.recipientKey : null, entitlement_type: input.entitlementType,
          source_event_id: null, source_position: null, source_detail: { providerId: input.providerId, ...input.detail }, target_key: input.targetKey,
          target_season: input.targetSeason, consumption: input.consumption }], "PROVIDER");
        const row = (await tx.execute(sql`SELECT * FROM career_qualification_entitlements WHERE career_save_id = ${root.id} AND idempotency_key = ${idempotency}`)).rows[0];
        if (row.recipient_key !== input.recipientKey || row.target_key !== input.targetKey || Number(row.target_season) !== input.targetSeason) throw new CareerError(409, "Operation identity was already used with different inputs");
        return { id: row.id, status: row.status, targetKey: row.target_key, targetSeason: row.target_season };
      });
    },

    async entitlements(actor: CareerActor, saveId: string, participantKey = HUMAN) {
      return database.transaction(async tx => {
        const { root } = await open(tx, actor, saveId, false);
        return (await tx.execute(sql`SELECT id, recipient_key, entitlement_type, source_kind, source_event_id, source_position, source_detail, awarded_season, target_key, target_season,
          consumption, status, consumed_by_event_id FROM career_qualification_entitlements WHERE career_save_id = ${root.id} AND recipient_key = ${participantKey} ORDER BY created_at, id`)).rows;
      });
    },
  };
}
/** Weeks that matter to the human: their events, notable deadlines, qualified targets, season start. */
function reasonsFor(events: readonly InstanceRow[], human: HumanContext, windows: SeriesWindows, season: number, week: number) {
  const reasons: { type: string; eventId: string; name: string }[] = [];
  for (const event of events) {
    const view = humanView(event, human, windows);
    if (view.entryStatus && view.entryStatus !== "WITHDRAWN") reasons.push({ type: "HUMAN_EVENT", eventId: event.id, name: event.name });
    else if (view.canEnter && (view.relationship === "QUALIFIED" || ["FEATURED", "TELEVISED", "MAJOR", "WORLD"].includes(event.presentation_tier) || event.classification === "QUALIFIER"))
      reasons.push({ type: view.relationship === "QUALIFIED" ? "QUALIFIED_EVENT_DEADLINE" : "REGISTRATION_DEADLINE", eventId: event.id, name: event.name });
  }
  if (week === 1) reasons.push({ type: "SEASON_START", eventId: "", name: `Season ${season}` });
  return reasons;
}
/** A4 preview attached to A3 DTOs; an unaffordable entry adds an explicit INSUFFICIENT_FUNDS denial. */
function withFinance<T extends ReturnType<typeof presentEvent>>(dto: T, preview: ({ affordable: boolean } & Record<string, unknown>) | undefined): T & { finance: unknown } {
  if (!preview) return { ...dto, finance: null };
  const human = dto.human && dto.human.canEnter && !preview.affordable
    ? { ...dto.human, canEnter: false, denials: [...dto.human.denials, "INSUFFICIENT_FUNDS" as DenialReason] } : dto.human;
  return { ...dto, human, opportunity:opportunity({...dto,human}),finance: preview };
}
const stageNameFor = (round: number, rounds: number) => { const remaining = 2 ** (rounds - round + 1); return remaining === 2 ? "FINAL" : remaining === 4 ? "SEMI_FINAL" : remaining === 8 ? "QUARTER_FINAL" : `LAST_${remaining}`; };
export type CareerCalendarService = ReturnType<typeof createCareerCalendarService>;
