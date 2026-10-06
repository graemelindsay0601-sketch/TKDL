import { sql } from "drizzle-orm";
import type { CareerDatabase } from "../database.ts";
import { EVENT_DATABASE_VERSION, WEEKS_PER_SEASON, DAYS_PER_SEASON } from "./config.ts";
import { generateSeason, calendarHashOf, type EventInstanceDraft } from "./generation.ts";
import { evaluateRule, type ParticipantFacts } from "./eligibility.ts";
import { COUNTY_CATCHMENTS } from "./geography.ts";
import { HARNESS_SEED } from "../world/harness.ts";

export { HARNESS_SEED };
const countBy = <T>(items: readonly T[], key: (item: T) => string | number) => Object.fromEntries(
  Object.entries(items.reduce<Record<string, number>>((acc, item) => { const k = String(key(item)); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})).sort(([a], [b]) => a < b ? -1 : 1));

/** Representative human sporting states (A5 will make these real; here they are fixtures). */
export const HUMAN_STATES: Record<string, Omit<ParticipantFacts, "results" | "defendingChampion" | "invited"> & { note: string }> = {
  grassrootsAmateur: { key: "HUMAN", kind: "HUMAN", country: "GBR", zone: "UK_IRELAND", locality: "ayrshire", professionalStatus: "AMATEUR", tourCard: false, rankings: {}, entitlementTargets: new Set(), note: "Ayrshire amateur, no entitlements" },
  seriousAmateur: { key: "HUMAN", kind: "HUMAN", country: "GBR", zone: "UK_IRELAND", locality: "ayrshire", professionalStatus: "AMATEUR", tourCard: false, rankings: {}, entitlementTargets: new Set(["challenger-tour", "vault-series"]), note: "Q-School entrant (Challenger access) + Vault series access" },
  newProfessional: { key: "HUMAN", kind: "HUMAN", country: "GBR", zone: "UK_IRELAND", locality: "ayrshire", professionalStatus: "PROFESSIONAL", tourCard: true, rankings: {}, entitlementTargets: new Set(), note: "Tour Card, no ranking yet" },
  establishedProfessional: { key: "HUMAN", kind: "HUMAN", country: "GBR", zone: "UK_IRELAND", locality: "ayrshire", professionalStatus: "PROFESSIONAL", tourCard: true,
    rankings: { "pro-world": 20, "pro-circuit": 20, "european-series": 20 }, entitlementTargets: new Set(), note: "Tour Card, ranked ~20 (A5 fixture)" },
};

/**
 * Opportunity = executable event the state is eligible for. "Meaningful" excludes
 * club/county nights outside the human's county catchment (another country's pub
 * night is technically enterable but is not part of a realistic schedule).
 * Max schedule = greedy earliest-finish interval schedule (series count as one unit).
 */
export function humanOpportunities(drafts: readonly EventInstanceDraft[], state: typeof HUMAN_STATES[string]) {
  const facts: ParticipantFacts = { ...state, invited: false, results: { SAME: new Map(), PREVIOUS: new Map() }, defendingChampion: false };
  const catchment = new Set(COUNTY_CATCHMENTS[state.locality ?? ""] ?? []);
  const eligible = drafts.filter(d => evaluateRule(d.snapshot.eligibility, facts).eligible);
  const executable = eligible.filter(d => d.executable);
  const meaningful = executable.filter(d => !(d.localityKey && !catchment.has(d.localityKey)));
  const units = new Map<string, { start: number; end: number }>();
  for (const d of meaningful) {
    const key = d.seriesKey ?? d.id;
    const u = units.get(key) ?? { start: d.startDay, end: d.endDay };
    u.start = Math.min(u.start, d.startDay); u.end = Math.max(u.end, d.endDay); units.set(key, u);
  }
  let lastEnd = 0, schedule = 0;
  for (const u of [...units.values()].sort((a, b) => a.end - b.end)) if (u.start > lastEnd) { schedule++; lastEnd = u.end; }
  return { note: state.note, eligibleAll: eligible.length, eligibleExecutable: executable.length, meaningful: meaningful.length,
    maxNonConflictingSchedule: schedule, byCircuit: countBy(meaningful, d => d.circuit) };
}

export function staticCalendarReport(seed = HARNESS_SEED, season = 1) {
  const started = performance.now();
  const drafts = generateSeason(seed, EVENT_DATABASE_VERSION, season);
  const perWeek = Array.from({ length: WEEKS_PER_SEASON }, (_, i) => drafts.filter(d => d.startWeek === i + 1).length);
  const perDay = Array.from({ length: DAYS_PER_SEASON }, (_, i) => drafts.filter(d => d.startDay <= i + 1 && d.endDay >= i + 1).length);
  const keys = drafts.map(d => d.instanceKey);
  const s = drafts.map(d => d.snapshot);
  const other = generateSeason("cd".repeat(32), EVENT_DATABASE_VERSION, season);
  const repeat = generateSeason(seed, EVENT_DATABASE_VERSION, season);
  return {
    seed: `${seed.slice(0, 8)}…`, season, eventDatabaseVersion: EVENT_DATABASE_VERSION,
    totalEventInstances: drafts.length,
    byCircuit: countBy(drafts, d => d.circuit), byClassification: countBy(drafts, d => d.classification),
    byPresentationTier: countBy(drafts, d => d.presentationTier), byCountry: countBy(drafts, d => d.country), byZone: countBy(drafts, d => d.zone),
    byFieldSize: countBy(drafts, d => d.fieldSize),
    byFormat: { structure: countBy(s, x => x.format.structure), scoringUnit: countBy(s, x => x.format.scoringUnit), gameType: countBy(s, x => x.format.gameType) },
    simulationCapability: { executable: drafts.filter(d => d.executable).length, unsupported: drafts.filter(d => !d.executable).length,
      unsupportedReasons: countBy(s.flatMap(x => x.capability.executable ? [] : x.capability.reasons), r => r) },
    eventsPerWeek: { min: Math.min(...perWeek), max: Math.max(...perWeek), mean: +(drafts.length / WEEKS_PER_SEASON).toFixed(2), emptyWeeks: perWeek.filter(n => n === 0).length },
    peakConcurrentEventsOnOneDay: Math.max(...perDay),
    duplicateStableIds: keys.length - new Set(keys).size + (drafts.length - new Set(drafts.map(d => d.id)).size),
    invalidEventWindows: drafts.filter(d => d.startDay > d.endDay || d.startWeek < 1 || d.endWeek > WEEKS_PER_SEASON || d.registrationOpensWeek > d.startWeek).length,
    specialWithRanking: drafts.filter(d => d.classification === "SPECIAL" && d.rankingCategory !== null).length,
    qSchoolPathways: countBy(s.filter(x => x.qSchool), x => `${x.qSchool!.pathway}:${x.qSchool!.stage}`),
    humanOpportunities: Object.fromEntries(Object.entries(HUMAN_STATES).map(([k, v]) => [k, humanOpportunities(drafts, v)])),
    determinism: { sameSeedIdentical: calendarHashOf(drafts) === calendarHashOf(repeat), differentSeedInstanceCount: other.length,
      differentSeedDiffers: calendarHashOf(drafts) !== calendarHashOf(other),
      authoredBackboneStable: JSON.stringify(drafts.filter(d => !d.localityKey).map(d => [d.instanceKey, d.startDay])) === JSON.stringify(other.filter(d => !d.localityKey).map(d => [d.instanceKey, d.startDay])) },
    runtimeMs: Math.round(performance.now() - started),
  };
}

const PRO_CIRCUITS = ["PRO_CIRCUIT", "EUROPEAN_SERIES", "WORLD_SERIES", "MAJOR", "INVITATIONAL", "WORLD_CHAMPIONSHIP"];

/** Post-season checks against the persisted database for one save. */
export async function seasonReport(db: CareerDatabase, saveId: string, season: number) {
  const q = async (query: ReturnType<typeof sql>) => (await db.execute(query)).rows;
  const statuses = await q(sql`SELECT status, COALESCE(status_reason, '') AS reason, COUNT(*)::int AS n FROM career_event_instances WHERE career_save_id = ${saveId} AND season = ${season} GROUP BY 1, 2 ORDER BY 1, 2`);
  const unfilled = await q(sql`SELECT circuit, country, COUNT(*)::int AS n FROM career_event_instances WHERE career_save_id = ${saveId} AND season = ${season} AND status_reason = 'INSUFFICIENT_ENTRANTS' GROUP BY 1, 2 ORDER BY 3 DESC`);
  const fields = await q(sql`SELECT circuit, COUNT(*)::int AS events, ROUND(AVG(entrant_count))::int AS avg_entrants, MIN(entrant_count)::int AS min_entrants, MAX(entrant_count)::int AS max_entrants
    FROM career_event_instances WHERE career_save_id = ${saveId} AND season = ${season} AND status = 'COMPLETED' GROUP BY 1 ORDER BY 1`);
  const entrySources = await q(sql`SELECT e.source, COUNT(*)::int AS n FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
    WHERE e.career_save_id = ${saveId} AND i.season = ${season} GROUP BY 1 ORDER BY 1`);
  const npcParticipation = (await q(sql`SELECT p.tier, COUNT(DISTINCT p.id)::int AS npcs, COUNT(e.*)::int AS entries
    FROM career_world_players p LEFT JOIN career_event_entries e ON e.career_save_id = p.career_save_id AND e.npc_id = p.id AND e.status = 'CONFIRMED'
      AND e.event_id IN (SELECT id FROM career_event_instances WHERE career_save_id = ${saveId} AND season = ${season})
    WHERE p.career_save_id = ${saveId} AND p.created_season <= ${season} GROUP BY 1 ORDER BY 1`));
  // Double booking: any participant confirmed in two events whose day windows overlap.
  const doubleBooked = (await q(sql`SELECT COUNT(*)::int AS n FROM career_event_entries a
    JOIN career_event_instances ia ON ia.career_save_id = a.career_save_id AND ia.id = a.event_id
    JOIN career_event_entries b ON b.career_save_id = a.career_save_id AND b.participant_key = a.participant_key AND b.event_id > a.event_id
    JOIN career_event_instances ib ON ib.career_save_id = b.career_save_id AND ib.id = b.event_id
    WHERE a.career_save_id = ${saveId} AND ia.season = ${season} AND ib.season = ${season} AND a.status = 'CONFIRMED' AND b.status = 'CONFIRMED'
      AND ia.status NOT IN ('CANCELLED') AND ib.status NOT IN ('CANCELLED') AND ia.start_day <= ib.end_day AND ib.start_day <= ia.end_day`))[0].n;
  const invalidEntries = (await q(sql`SELECT COUNT(*)::int AS n FROM career_event_instances i WHERE i.career_save_id = ${saveId} AND i.season = ${season}
    AND (i.entrant_count > i.field_size OR i.entrant_count <> (SELECT COUNT(*) FROM career_event_entries e WHERE e.career_save_id = i.career_save_id AND e.event_id = i.id AND e.status <> 'WITHDRAWN')
      AND i.status NOT IN ('CANCELLED','SCHEDULED','REGISTRATION_OPEN','REGISTRATION_CLOSED'))`))[0].n;
  const retiredEntrants = (await q(sql`SELECT COUNT(*)::int AS n FROM career_event_entries e JOIN career_world_players p ON p.career_save_id = e.career_save_id AND p.id = e.npc_id
    JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
    WHERE e.career_save_id = ${saveId} AND i.season = ${season} AND p.retired_season IS NOT NULL AND p.retired_season < ${season}`))[0].n;
  const championChecks = (await q(sql`SELECT COUNT(*)::int AS completed,
      SUM(CASE WHEN (SELECT COUNT(*) FROM career_event_results r WHERE r.career_save_id = i.career_save_id AND r.event_id = i.id AND r.is_champion AND r.participant_key = i.champion_participant_key) = 1
        AND (SELECT COUNT(*) FROM career_tournament_matches m WHERE m.career_save_id = i.career_save_id AND m.event_id = i.id AND m.winner_key = i.champion_participant_key
          AND m.stage_key = i.snapshot->'format'->'stages'->-1->>'key'
          AND m.round = (SELECT MAX(round) FROM career_tournament_matches x WHERE x.career_save_id = i.career_save_id AND x.event_id = i.id AND x.stage_key=m.stage_key)) = 1
        AND (SELECT COUNT(*) FROM career_tournament_matches m WHERE m.career_save_id = i.career_save_id AND m.event_id = i.id AND m.status NOT IN ('COMPLETED','BYE','WALKOVER')) = 0
        THEN 1 ELSE 0 END)::int AS valid
    FROM career_event_instances i WHERE i.career_save_id = ${saveId} AND i.season = ${season} AND i.status = 'COMPLETED'`))[0];
  const simulatedViaA2 = (await q(sql`SELECT COUNT(*)::int AS matches, COUNT(s.match_key)::int AS linked FROM career_tournament_matches m
    LEFT JOIN career_simulated_matches s ON s.career_save_id = m.career_save_id AND s.match_key = m.simulated_match_key
    JOIN career_event_instances i ON i.career_save_id = m.career_save_id AND i.id = m.event_id
    WHERE m.career_save_id = ${saveId} AND i.season = ${season} AND m.status = 'COMPLETED' AND m.result_source = 'A2_SIMULATION'`))[0];
  const nationality = async (circuits: string[], champions: boolean) => Object.fromEntries((await q(sql`SELECT p.nationality, COUNT(*)::int AS n
    FROM ${champions ? sql`career_event_instances i JOIN career_world_players p ON p.career_save_id = i.career_save_id AND p.id = i.champion_npc_id`
      : sql`career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id JOIN career_world_players p ON p.career_save_id = e.career_save_id AND p.id = e.npc_id`}
    WHERE i.career_save_id = ${saveId} AND i.season = ${season} AND i.status = 'COMPLETED' AND i.circuit IN (${sql.join(circuits.map(c => sql`${c}`), sql`, `)})
    GROUP BY 1 ORDER BY 2 DESC`)).map(r => [String(r.nationality), Number(r.n)]));
  const proEntrants = await nationality(PRO_CIRCUITS, false);
  const proTotal = Object.values(proEntrants).reduce((a, b) => a + b, 0);
  const ukShare = ((proEntrants.GBR ?? 0) + (proEntrants.IRL ?? 0)) / Math.max(1, proTotal);
  const venues = await q(sql`SELECT zone, COUNT(*)::int AS n FROM career_event_instances WHERE career_save_id = ${saveId} AND season = ${season} AND circuit IN (${sql.join(PRO_CIRCUITS.map(c => sql`${c}`), sql`, `)}) GROUP BY 1 ORDER BY 1`);
  const entitlements = await q(sql`SELECT entitlement_type, target_key, status, COUNT(*)::int AS n FROM career_qualification_entitlements WHERE career_save_id = ${saveId} AND awarded_season = ${season} GROUP BY 1, 2, 3 ORDER BY 2, 3`);
  const duplicateEntitlements = (await q(sql`SELECT COUNT(*)::int AS n FROM (SELECT idempotency_key FROM career_qualification_entitlements WHERE career_save_id = ${saveId} GROUP BY 1 HAVING COUNT(*) > 1) d`))[0].n;
  const periods = await q(sql`SELECT kind, COUNT(*)::int AS n, MIN(sequence)::int AS first, MAX(sequence)::int AS last FROM career_world_periods WHERE career_save_id = ${saveId} AND season = ${season} GROUP BY 1 ORDER BY 1`);
  const seasonRow = (await q(sql`SELECT status, played_week, developed_week, off_season_processed, instance_count FROM career_seasons WHERE career_save_id = ${saveId} AND season = ${season}`))[0];
  const next = (await q(sql`SELECT season, status, instance_count FROM career_seasons WHERE career_save_id = ${saveId} AND season = ${season + 1}`))[0] ?? null;
  const champions = await q(sql`SELECT instance_key, champion_participant_key FROM career_event_instances WHERE career_save_id = ${saveId} AND season = ${season} AND status = 'COMPLETED' ORDER BY instance_key`);
  const qSchool = await q(sql`SELECT i.snapshot->'qSchool'->>'pathway' AS pathway, i.snapshot->'qSchool'->>'stage' AS stage, COUNT(DISTINCT i.id)::int AS days, ROUND(AVG(i.entrant_count))::int AS avg_field,
      COUNT(DISTINCT r.participant_key)::int AS distinct_players FROM career_event_instances i
    LEFT JOIN career_event_results r ON r.career_save_id = i.career_save_id AND r.event_id = i.id
    WHERE i.career_save_id = ${saveId} AND i.season = ${season} AND i.circuit = 'Q_SCHOOL' AND i.status = 'COMPLETED' GROUP BY 1, 2 ORDER BY 1, 2`);
  return {
    eventStatuses: statuses, unfillableEvents: unfilled, fieldStatsByCircuit: fields, entrySources, npcParticipationByTier: npcParticipation,
    npcDoubleBookings: doubleBooked, invalidEntries, retiredEntrants, champions: { completed: Number(championChecks.completed), valid: Number(championChecks.valid) }, a2LinkedMatches: { matches: Number(simulatedViaA2.matches), linked: Number(simulatedViaA2.linked) },
    international: { proLevelEntrantNationality: proEntrants, proLevelUkIrelandShare: +ukShare.toFixed(3), proLevelChampionNationality: await nationality(PRO_CIRCUITS, true),
      amateurLevelEntrantNationality: await nationality(["GRASSROOTS", "COUNTY", "REGIONAL", "NATIONAL_AMATEUR"], false), proLevelVenueZones: venues },
    qSchool, entitlements, duplicateEntitlements, a2Periods: periods, season: seasonRow, nextSeason: next,
    championHash: calendarHashOf(champions as never),
  };
}
