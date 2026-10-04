import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { HUMAN, loadInstances, loadFactsContext, factsFor, npcParticipant, humanParticipant, type RootRow } from "../calendar/engine.ts";
import { evaluateRule } from "../calendar/eligibility.ts";
import { loadNpcs } from "../world/repository.ts";
import { A3_PLACEHOLDER_STATUS, type CalendarProviders, type CalendarSportingHooks, type SeedingProvider, type SportingStatusProvider } from "../calendar/providers.ts";
import { defaultFactsProvider, type SponsorFactsProvider } from "../finance/engine.ts";
import type { Npc, Tier } from "../world/types.ts";
import { QUALIFICATION_MILESTONES, timeIndex } from "./config.ts";
import { loadSportingState, createSportingState, recordMilestones, type SportingState, type Milestone } from "./state.ts";
import { recordRankingContributions, publishRankings, currentPositions } from "./rankings.ts";
import { cardHoldersIn, issueFoundingCards, seasonReview, processRetirements, syncHumanCardCache } from "./cards.ts";
import { recordQSchoolResults, allocateQSchool, PATHWAYS } from "./qschool.ts";

/** State + founding cards, once per save (idempotent; inside the caller's locked transaction). */
export async function ensureSporting(tx: CareerExecutor, root: RootRow): Promise<SportingState> {
  let state = await loadSportingState(tx, root.id);
  if (state) return state;
  const world = (await tx.execute(sql`SELECT 1 FROM career_world_state WHERE career_save_id = ${root.id}`)).rows.length;
  if (!world) throw new Error("A5 requires the A2 Career world");
  if (await createSportingState(tx, root.id)) {
    state = (await loadSportingState(tx, root.id))!;
    await issueFoundingCards(tx, root, Number(state.tour_card_rules_version));
    await syncHumanCardCache(tx, root, Number(root.current_season));
  }
  return (await loadSportingState(tx, root.id))!;
}

/**
 * Participation weighting only (A3 authored weights assume pro tier == card holder):
 * card holders weigh as at least PROFESSIONAL for tour events; professional-ability
 * players without a card weigh as AMATEUR (so they enter Q-School/Challenger/opens).
 */
export function selectionTierFor(npc: Npc, holdsCard: boolean): Tier {
  const pro = npc.tier === "PROFESSIONAL" || npc.tier === "ELITE";
  if (holdsCard) return pro ? npc.tier : "PROFESSIONAL";
  return pro ? "AMATEUR" : npc.tier;
}

export function boundStatus(cardHolders: ReadonlySet<string>, positions: ReadonlyMap<string, Record<string, number>>): SportingStatusProvider {
  return {
    id: "A5_SPORTING_STATUS",
    human(root) {
      const base = A3_PLACEHOLDER_STATUS.human(root);
      const card = cardHolders.has(HUMAN);
      return { ...base, professionalStatus: card ? "PROFESSIONAL" : "AMATEUR", tourCard: card };
    },
    npcTourCard: npc => cardHolders.has(npc.id),
    rankings: key => positions.get(key) ?? {},
    npcProfessionalStatus: npc => cardHolders.has(npc.id) ? "PROFESSIONAL" : "AMATEUR",
    selectionTier: npc => selectionTierFor(npc, cardHolders.has(npc.id)),
  };
}
export function boundSeeding(positions: ReadonlyMap<string, Record<string, number>>): SeedingProvider {
  return {
    id: "A5_RANKING_SEEDING",
    /** Ordered participant list from the latest published ranking; A3 makes and locks the draw. */
    order(list, entrants) {
      return entrants.filter(k => positions.get(k)?.[list] !== undefined).sort((a, b) => positions.get(a)![list] - positions.get(b)![list] || (a < b ? -1 : 1));
    },
  };
}
/** Unbound fallback (no transaction): reads only the A1 cache for the human; NPC facts unknown. A3 paths always bind. */
export const UNBOUND_STATUS: SportingStatusProvider = {
  id: "A5_SPORTING_STATUS_UNBOUND",
  human(root) { const base = A3_PLACEHOLDER_STATUS.human(root); return { ...base, professionalStatus: root.has_tour_card ? "PROFESSIONAL" : "AMATEUR", tourCard: root.has_tour_card }; },
  npcTourCard: () => null,
  rankings: () => ({}),
};
export const UNBOUND_SEEDING: SeedingProvider = { id: "A5_RANKING_SEEDING_UNBOUND", order: () => [] };

export async function bindSporting(tx: CareerExecutor, root: RootRow) {
  await ensureSporting(tx, root);
  const [holders, positions] = await Promise.all([cardHoldersIn(tx, root.id, Number(root.current_season)), currentPositions(tx, root.id)]);
  return { sportingStatus: boundStatus(holders, positions), seeding: boundSeeding(positions), holders, positions };
}

/**
 * Qualification / Q-School progress facts (everyone, same rules):
 *  - confirmed entries in professional events locked this week;
 *  - for Majors / the World Championship starting this week, everyone who meets the
 *    event's sporting qualification rule (ranking cut, Tour Card, entitlement — never
 *    invitation) at registration close. This is a qualification fact even when A3
 *    cannot execute the event's format (A3 cancels sets/group formats as UNSUPPORTED).
 */
async function weeklyMilestones(tx: CareerExecutor, root: RootRow, season: number, week: number, providers: CalendarProviders) {
  const confirmed = (await tx.execute(sql`SELECT e.participant_key, e.participant_kind, e.npc_id, i.id AS event_id, i.circuit, i.classification, i.definition_key, i.name
    FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
    WHERE e.career_save_id = ${root.id} AND i.season = ${season} AND i.start_week = ${week} AND e.status = 'CONFIRMED' AND i.classification = 'RANKING'
      AND i.circuit IN ('PRO_CIRCUIT','EUROPEAN_SERIES','MAJOR','WORLD_CHAMPIONSHIP') ORDER BY i.start_day, i.instance_key, e.participant_key`)).rows;
  const milestones: Milestone[] = [];
  for (const m of QUALIFICATION_MILESTONES) for (const e of confirmed) {
    if (!(m.circuits as readonly string[]).includes(String(e.circuit)) || e.classification !== m.classification || (m.definitionKey && e.definition_key !== m.definitionKey)) continue;
    milestones.push({ operationKey: `qualified:${m.kind}:${e.participant_key}`, participantKey: String(e.participant_key), participantKind: String(e.participant_kind),
      npcId: e.npc_id ? String(e.npc_id) : null, kind: m.kind, season, week, detail: { eventId: String(e.event_id), eventName: String(e.name) } });
  }
  const majors = (await loadInstances(tx, root.id, sql`season = ${season} AND start_week = ${week} AND classification = 'RANKING' AND circuit IN ('MAJOR','WORLD_CHAMPIONSHIP')`));
  if (majors.length) {
    const npcs = await loadNpcs(tx, root.id, { activeOnly: true });
    const ctx = await loadFactsContext(tx, root.id, season, majors.map(e => e.snapshot.eligibility));
    const participants = [humanParticipant(root, providers), ...npcs.map(n => npcParticipant(n, providers))];
    for (const event of majors) for (const m of QUALIFICATION_MILESTONES) {
      if (m.kind === "FIRST_PROFESSIONAL_EVENT" || !(m.circuits as readonly string[]).includes(event.circuit) || (m.definitionKey && event.definition_key !== m.definitionKey)) continue;
      for (const p of participants) {
        if (!evaluateRule(event.snapshot.eligibility, factsFor(p, ctx, event, false)).eligible) continue;
        milestones.push({ operationKey: `qualified:${m.kind}:${p.key}`, participantKey: p.key, participantKind: p.kind, npcId: p.kind === "NPC" ? p.key : null, kind: m.kind, season, week,
          detail: { eventId: event.id, eventName: event.name, route: "SPORTING_QUALIFICATION", executable: event.executable } });
      }
    }
  }
  const finals = (await tx.execute(sql`SELECT recipient_key, recipient_kind, npc_id, target_key, source_kind, source_detail FROM career_qualification_entitlements
    WHERE career_save_id = ${root.id} AND target_season = ${season} AND target_key LIKE 'q-school-final:%'`)).rows;
  for (const f of finals) milestones.push({ operationKey: `q-school-final:${season}:${f.recipient_key}`, participantKey: String(f.recipient_key), participantKind: String(f.recipient_kind),
    npcId: f.npc_id ? String(f.npc_id) : null, kind: "Q_SCHOOL_FINAL_STAGE_REACHED", season, week, detail: { pathway: String(f.target_key).split(":")[1], route: String(f.source_kind) } });
  await recordMilestones(tx, root, milestones);
}

/** The A5 CalendarSportingHooks implementation (A3 calls these inside its own transactions). */
export function createSportingHooks(): CalendarSportingHooks {
  return {
    async bind(tx, root) { const b = await bindSporting(tx, root); return { sportingStatus: b.sportingStatus, seeding: b.seeding }; },
    async onEventCompleted(tx, root, event, results) {
      const state = await ensureSporting(tx, root);
      await recordRankingContributions(tx, root, Number(state.ranking_rules_version), event, results);
      await recordQSchoolResults(tx, root, Number(state.q_school_rules_version), event, results);
    },
    async afterWeek(tx, root, season, week) {
      const state = await ensureSporting(tx, root);
      for (const pathway of PATHWAYS) await allocateQSchool(tx, root, Number(state.q_school_rules_version), Number(state.tour_card_rules_version), season, week, pathway);
      const bound = await bindSporting(tx, root);
      await weeklyMilestones(tx, root, season, week, { sportingStatus: bound.sportingStatus, seeding: bound.seeding });
      await publishRankings(tx, root, Number(state.ranking_rules_version), season, week, state.force_publish);
      if (state.force_publish) await tx.execute(sql`UPDATE career_sporting_state SET force_publish = FALSE WHERE career_save_id = ${root.id}`);
      if (week === 52) await seasonReview(tx, root, Number(state.tour_card_rules_version), season);
      await syncHumanCardCache(tx, root, season);
    },
    async onCalendarMoved(tx, root, season, week) {
      await ensureSporting(tx, root);
      if (week !== 1) return;
      // New season: retired NPCs surrender cards; force a publication so they leave the active tables.
      await processRetirements(tx, root, season, week);
      await tx.execute(sql`UPDATE career_sporting_state SET force_publish = TRUE WHERE career_save_id = ${root.id}`);
      await syncHumanCardCache(tx, root, season);
    },
  };
}

/**
 * A4 sponsorship facts from A5 authority: A4's own A3-derived facts (titles,
 * finishes, qualifications) with Tour Card, professional status and World Ranking
 * from A5. Unknown stays unknown: worldRanking is null only before any World
 * Ranking has been published; once published, an unranked player is reported as
 * outside every position (a known fact, never a grant).
 */
export function createSportingFactsProvider(providers: () => CalendarProviders): SponsorFactsProvider {
  return {
    id: "A5_SPORTING_FACTS",
    async facts(tx, root) {
      const bound = await bindSporting(tx, root);
      const base = await defaultFactsProvider({ ...providers(), sportingStatus: bound.sportingStatus, seeding: bound.seeding }).facts(tx, root);
      if (base.worldRanking === null) {
        const published = (await tx.execute(sql`SELECT 1 FROM career_ranking_snapshots WHERE career_save_id = ${root.id} AND list_key = 'pro-world' LIMIT 1`)).rows.length;
        if (published) base.worldRanking = Number.MAX_SAFE_INTEGER;
      }
      return base;
    },
  };
}
export { timeIndex };
