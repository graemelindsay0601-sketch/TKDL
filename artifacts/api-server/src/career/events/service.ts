import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import type { CareerActor } from "../world/service.ts";
import { HUMAN, CIRCUITS, CLASSIFICATIONS, emptyProvider, weekOf, seasonGroup, type SportingProvider, type StoredEvent } from "./types.ts";
import { lockRoot, initializeSeason, seasonState, loadEvent, eventFrom, putEntry, saveEvent, worldIn, type Root } from "./repository.ts";
import { participants, humanEntrant, eligibilityInputs, lockDraw } from "./participation.ts";
import { evaluate } from "./eligibility.ts";
import { capability } from "./capability.ts";
import { progressTournament, type LiveReceipt } from "./tournament.ts";

const advanceSchema = z.object({ operationKey: z.string().min(1).max(120), season: z.number().int().positive(), expectedDay: z.number().int().min(0).max(364), targetDay: z.number().int().min(0).max(364).optional() }).strict();
export const calendarQuerySchema = z.object({ season: z.coerce.number().int().positive().optional(), fromDay: z.coerce.number().int().min(0).max(364).optional(),
  toDay: z.coerce.number().int().min(0).max(364).optional(), limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().nonnegative().default(0),
  circuit: z.enum(CIRCUITS).optional(), classification: z.enum(CLASSIFICATIONS).optional(), status: z.enum(["SCHEDULED", "REGISTRATION_OPEN", "DRAWN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  view: z.enum(["ALL", "RELEVANT", "MY_SCHEDULE"]).default("RELEVANT"),
}).strict().refine(q => q.fromDay === undefined || q.toDay === undefined || q.fromDay <= q.toDay, "Invalid calendar window");
async function nextDecision(tx: CareerExecutor, root: Root, day: number, provider: SportingProvider) {
  const human = await humanEntrant(root, provider);
  const rows = (await tx.execute(sql`SELECT e.*,n.status AS entry_status FROM career_events e LEFT JOIN career_event_entries n
    ON n.career_save_id=e.career_save_id AND n.event_id=e.id AND n.participant_key='human'
    WHERE e.career_save_id=${root.id} AND e.season=${root.current_season} AND e.end_day>=${day} AND e.status NOT IN ('COMPLETED','CANCELLED')
    AND (n.status IN ('ENTERED','CONFIRMED') OR (e.snapshot->'venue'->>'region'=${human.region} AND e.circuit IN ('GRASSROOTS','COUNTY') AND e.closes_day>${day}))`)).rows;
  const candidates = rows.flatMap(r => {
    const e = eventFrom(r);
    if (capability(e.definition.format).status !== "SUPPORTED") return [];
    if (r.entry_status === "ENTERED" || r.entry_status === "CONFIRMED") return [{ day: Math.max(day, e.startDay), kind: "ENTERED_EVENT", eventId: e.id }];
    return [{ day: Math.max(e.opensDay, e.closesDay - 1), kind: "ENTRY_DEADLINE", eventId: e.id }];
  }).filter(c => c.day > day || c.kind === "ENTERED_EVENT").sort((a, b) => a.day - b.day || a.eventId.localeCompare(b.eventId));
  return candidates[0] ?? { day: 364, kind: "SEASON_BOUNDARY", eventId: null };
}
async function calendarDto(tx: CareerExecutor, root: Root, event: StoredEvent, provider: SportingProvider, people: Awaited<ReturnType<typeof participants>>, day: number) {
  const inputs = await eligibilityInputs(tx, root, event, people.filter(p => p.key === HUMAN), provider);
  const eligibility = evaluate(event.definition.eligibility, people[0], inputs.facts[HUMAN] ?? {}, inputs.entitled.has(HUMAN));
  if (day < event.opensDay) { eligibility.eligible = false; eligibility.blockingReasons.push("REGISTRATION_NOT_OPEN"); }
  if (root.status !== "ACTIVE") { eligibility.eligible = false; eligibility.blockingReasons.push("CAREER_RETIRED"); }
  if (capability(event.definition.format).status !== "SUPPORTED") { eligibility.eligible = false; eligibility.blockingReasons.push("UNSUPPORTED_FORMAT"); }
  if (day > event.closesDay || event.season !== root.current_season || !["SCHEDULED", "REGISTRATION_OPEN"].includes(event.status)) { eligibility.eligible = false; eligibility.blockingReasons.push("REGISTRATION_CLOSED"); }
  const conflicts = inputs.booked.filter(r => r.participant_key === HUMAN).map(r => ({ eventId: r.id, startDay: r.start_day, endDay: r.end_day }));
  if (conflicts.length) { eligibility.eligible = false; eligibility.blockingReasons.push("SCHEDULE_CONFLICT"); }
  const entry = (await tx.execute(sql`SELECT status FROM career_event_entries WHERE career_save_id=${root.id} AND event_id=${event.id} AND participant_key='human'`)).rows[0];
  return { id: event.id, key: event.key, season: event.season, week: weekOf(event.startDay), grouping: seasonGroup(weekOf(event.startDay)),
    name: event.definition.name, shortName: event.definition.shortName, circuit: event.definition.circuit, classification: event.definition.classification,
    startDay: event.startDay, endDay: event.endDay, opensDay: event.opensDay, closesDay: event.closesDay, venue: event.venue, format: event.definition.format,
    fieldSize: event.definition.fieldSize, status: event.status, presentationTier: event.definition.presentationTier, capability: capability(event.definition.format),
    eligibility, entryStatus: entry?.status ?? null, qualified: inputs.entitled.has(HUMAN), invited: inputs.facts[HUMAN]?.invited === true, conflicts,
    prizeProfile: event.definition.prizeProfile, entryFeeProfile: event.definition.entryFeeProfile, travelProfile: event.definition.travelProfile, accommodationProfile: event.definition.accommodationProfile,
    qualification: event.definition.qualification, cancellationReason: event.cancellationReason };
}
export function createCareerEventService(database: CareerDatabase, provider: SportingProvider = emptyProvider) {
  const owned = <T>(actor: CareerActor, saveId: string, work: (tx: CareerExecutor, root: Root) => Promise<T>, active = true) => database.transaction(async tx => work(tx, await lockRoot(tx, actor, saveId, active)));
  return {
    initialize: (actor: CareerActor, saveId: string) => owned(actor, saveId, async (tx, root) => { await initializeSeason(tx, actor, root); return seasonState(tx, root); }),
    calendar: (actor: CareerActor, saveId: string, body: unknown = {}) => owned(actor, saveId, async (tx, root) => {
      const q = calendarQuerySchema.parse(body), state = await seasonState(tx, root), people = [await humanEntrant(root, provider)];
      const season = q.season ?? root.current_season;
      const rows = (await tx.execute(sql`SELECT e.* FROM career_events e WHERE e.career_save_id=${saveId} AND e.season=${season}
        AND e.end_day>=${q.fromDay ?? (season === root.current_season ? state.day : 0)} AND e.start_day<=${q.toDay ?? 364}
        ${q.circuit ? sql`AND e.circuit=${q.circuit}` : sql``} ${q.classification ? sql`AND e.classification=${q.classification}` : sql``} ${q.status ? sql`AND e.status=${q.status}` : sql``}
        ${q.view === "MY_SCHEDULE" ? sql`AND EXISTS(SELECT 1 FROM career_event_entries n WHERE n.career_save_id=e.career_save_id AND n.event_id=e.id AND n.participant_key='human' AND n.status NOT IN ('WITHDRAWN','MISSED'))` : sql``}
        ${q.view === "RELEVANT" ? sql`AND (e.snapshot->'venue'->>'region'=${people[0].region} OR e.circuit NOT IN ('GRASSROOTS','COUNTY'))` : sql``}
        ORDER BY e.start_day,e.id LIMIT ${q.limit} OFFSET ${q.offset}`)).rows;
      const events = [];
      for (const row of rows) events.push(await calendarDto(tx, root, eventFrom(row), provider, people, state.day));
      return { season, currentSeason: root.current_season, day: state.day, week: weekOf(state.day), grouping: seasonGroup(weekOf(state.day)), events,
        nextOffset: rows.length === q.limit ? q.offset + q.limit : null, nextDecision: await nextDecision(tx, root, state.day, provider) };
    }, false),
    detail: (actor: CareerActor, saveId: string, eventId: string) => owned(actor, saveId, async (tx, root) => {
      const event = await loadEvent(tx, saveId, eventId), state = await seasonState(tx, root), people = [await humanEntrant(root, provider)];
      const dto = await calendarDto(tx, root, event, provider, people, state.day);
      const nextMatch = event.draw?.rounds.flat().find(m => !m.winner && m.a && m.b && (m.a === HUMAN || m.b === HUMAN)) ?? null;
      return { ...dto, field: event.draw?.field ?? [], draw: event.draw, nextMatch, opponent: nextMatch ? event.draw!.field.find(p => p.key === (nextMatch.a === HUMAN ? nextMatch.b : nextMatch.a)) : null,
        result: event.result, playerFinish: event.result?.finishes.find(f => f.participant === HUMAN) ?? null,
        entitlements: (await tx.execute(sql`SELECT participant_key,target_key,target_kind,target_event_id,status FROM career_event_entitlements WHERE career_save_id=${saveId} AND source_event_id=${eventId}`)).rows };
    }, false),
    enter: (actor: CareerActor, saveId: string, eventId: string, participantKey = HUMAN) => owned(actor, saveId, async (tx, root) => {
      const event = await loadEvent(tx, saveId, eventId), state = await seasonState(tx, root);
      const support = capability(event.definition.format); if (support.status !== "SUPPORTED") return support;
      if (event.season !== root.current_season || state.day < event.opensDay || state.day > event.closesDay || !["SCHEDULED", "REGISTRATION_OPEN"].includes(event.status)) throw new CareerError(409, "Registration closed");
      const all = await participants(tx, root, provider), who = all.find(p => p.key === participantKey);
      if (!who) throw new CareerError(404, "Career participant not found");
      const inputs = await eligibilityInputs(tx, root, event, [who], provider);
      const reasons = evaluate(event.definition.eligibility, who, inputs.facts[who.key] ?? {}, inputs.entitled.has(who.key));
      if (!reasons.eligible) return { status: "INELIGIBLE" as const, ...reasons };
      const conflict = inputs.booked.filter(r => r.participant_key === participantKey);
      if (conflict.length) return { status: "SCHEDULE_CONFLICT" as const, conflicts: conflict };
      const existing = (await tx.execute(sql`SELECT status FROM career_event_entries WHERE career_save_id=${saveId} AND event_id=${eventId} AND participant_key=${participantKey}`)).rows[0];
      if (existing?.status === "ENTERED") return { status: "ENTERED" as const };
      await putEntry(tx, saveId, eventId, who);
      return { status: "ENTERED" as const };
    }),
    withdraw: (actor: CareerActor, saveId: string, eventId: string) => owned(actor, saveId, async (tx, root) => {
      const event = await loadEvent(tx, saveId, eventId), state = await seasonState(tx, root);
      if (event.draw || event.season !== root.current_season || state.day > event.closesDay) throw new CareerError(409, "Withdrawal deadline passed");
      await tx.execute(sql`UPDATE career_event_entries SET status='WITHDRAWN' WHERE career_save_id=${saveId} AND event_id=${eventId} AND participant_key='human' AND status='ENTERED'`);
      return { status: "WITHDRAWN" };
    }),
    lockDraw: (actor: CareerActor, saveId: string, eventId: string) => owned(actor, saveId, async (tx, root) => lockDraw(tx, root, await loadEvent(tx, saveId, eventId), (await seasonState(tx, root)).day, provider)),
    progress: (actor: CareerActor, saveId: string, eventId: string, receipt?: LiveReceipt) => owned(actor, saveId, async (tx, root) => progressTournament(tx, actor, root, await loadEvent(tx, saveId, eventId), (await seasonState(tx, root)).day, receipt)),
    advance: (actor: CareerActor, saveId: string, body: unknown) => owned(actor, saveId, async (tx, root) => {
      const request = advanceSchema.parse(body);
      const prior = (await tx.execute(sql`SELECT request,result FROM career_calendar_operations WHERE career_save_id=${saveId} AND operation_key=${request.operationKey}`)).rows[0];
      if (prior) { if (JSON.stringify(prior.request, Object.keys(request).sort()) !== JSON.stringify(request, Object.keys(request).sort())) throw new CareerError(409, "Conflicting calendar operation retry"); return prior.result; }
      const state = await seasonState(tx, root);
      if (request.season !== root.current_season || request.expectedDay !== state.day) throw new CareerError(409, "Stale Career calendar position");
      const target = request.targetDay ?? (await nextDecision(tx, root, state.day, provider)).day;
      if (target < state.day) throw new CareerError(409, "Career time cannot move backwards");
      const rows = (await tx.execute(sql`SELECT * FROM career_events WHERE career_save_id=${saveId} AND season=${root.current_season}
        AND status NOT IN ('COMPLETED','CANCELLED') AND closes_day<=${target} ORDER BY start_day, (snapshot->'definition'->>'priority')::int DESC,id`)).rows;
      const events = rows.map(eventFrom);
      const days = [...new Set([state.day, target, ...events.flatMap(e => [e.closesDay, e.startDay]).filter(d => d >= state.day && d <= target)])].sort((a, b) => a - b);
      let reached = state.day, waitingEvent: string | null = null;
      let period = Number((await tx.execute(sql`SELECT period FROM career_world_state WHERE career_save_id=${saveId}`)).rows[0]?.period);
      if (period !== Math.floor(state.day / 7)) throw new CareerError(409, "A2 time differs from canonical calendar cadence");
      for (const day of days) {
        for (; period < Math.floor(day / 7); period++) await worldIn(tx).advancePeriod(actor, saveId, { season: root.current_season, period: period + 1, elapsedYears: 1 / 52, opportunity: 0.5 });
        reached = day;
        for (const event of events) {
          if (event.status === "COMPLETED" || event.status === "CANCELLED" || event.closesDay > day) continue;
          const support = capability(event.definition.format);
          if (support.status !== "SUPPORTED") { if (event.startDay <= day) { event.status = "CANCELLED"; event.cancellationReason = "UNSUPPORTED_FORMAT"; await saveEvent(tx, saveId, event); } continue; }
          await lockDraw(tx, root, event, day, provider);
          if ((event as StoredEvent).status !== "CANCELLED" && event.startDay <= day) {
            await progressTournament(tx, actor, root, event, day);
            if ((event as StoredEvent).status !== "COMPLETED") waitingEvent = event.id;
          }
        }
        if (waitingEvent) break;
      }
      await tx.execute(sql`UPDATE career_seasons SET day=${reached} WHERE career_save_id=${saveId} AND season=${root.current_season}`);
      await tx.execute(sql`UPDATE career_saves SET current_week=${weekOf(reached)},updated_at=NOW() WHERE id=${saveId}`);
      await tx.execute(sql`UPDATE career_events SET status='REGISTRATION_OPEN' WHERE career_save_id=${saveId} AND season=${root.current_season} AND status='SCHEDULED' AND opens_day<=${reached}`);
      const result = { season: root.current_season, day: reached, week: weekOf(reached), periods: period, waitingEvent, nextDecision: await nextDecision(tx, root, reached, provider) };
      await tx.execute(sql`INSERT INTO career_calendar_operations(career_save_id,operation_key,request,result) VALUES(${saveId},${request.operationKey},${JSON.stringify(request)}::jsonb,${JSON.stringify(result)}::jsonb)`);
      return result;
    }),
    closeSeason: (actor: CareerActor, saveId: string, season: number) => owned(actor, saveId, async (tx, root) => {
      z.number().int().positive().parse(season);
      const old = (await tx.execute(sql`SELECT status,day FROM career_seasons WHERE career_save_id=${saveId} AND season=${season}`)).rows[0];
      if (old?.status === "COMPLETED") return { completedSeason: season, nextSeason: season + 1 };
      if (root.current_season !== season || old?.day !== 364) throw new CareerError(409, "Reach the season boundary first");
      const pending = (await tx.execute(sql`SELECT id FROM career_events WHERE career_save_id=${saveId} AND season=${season} AND status NOT IN ('COMPLETED','CANCELLED') LIMIT 1`)).rows;
      if (pending.length) throw new CareerError(409, "Resolve outstanding events first");
      await worldIn(tx).processOffSeason(actor, saveId, { season, opportunity: 0.5 });
      await tx.execute(sql`UPDATE career_seasons SET status='COMPLETED' WHERE career_save_id=${saveId} AND season=${season}`);
      const nextRoot = { ...root, current_season: season + 1, current_week: 1 };
      await initializeSeason(tx, actor, nextRoot);
      return { completedSeason: season, nextSeason: season + 1 };
    }),
  };
}
export type CareerEventService = ReturnType<typeof createCareerEventService>;
