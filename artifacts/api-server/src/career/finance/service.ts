import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { createCareerCalendarService } from "../calendar/service.ts";
import { loadInstances, type RootRow } from "../calendar/engine.ts";
import type { CalendarProviders } from "../calendar/providers.ts";
import { FINANCE_VERSION, SPONSOR_DATABASE_VERSION } from "./config.ts";
import { summary, recentEntries, presentEntry, post, type LedgerRow } from "./ledger.ts";
import {
  createFinanceHooks, defaultFactsProvider, ensureFinanceState, evaluateOffers, acceptOffer, declineOffer, reservedPence, activeContracts,
  type SponsorFactsProvider,
} from "./engine.ts";
import { relationship, conflicts, portfolioLimit } from "./portfolio.ts";
import {parseSponsorTerms} from "./sponsors.catalogue.ts";
import { appendSponsorJourneyEvent } from "./sponsor-journey.ts";
import { negotiateSponsorOffer } from "./sponsor-negotiation.ts";

const offerRefSchema = z.object({ offerId: z.string().uuid() }).strict();
const acceptOfferSchema = offerRefSchema.extend({replaceContractIds:z.array(z.string().uuid()).max(5).refine(ids=>new Set(ids).size===ids.length).optional()});
const ledgerQuerySchema = z.object({ limit: z.number().int().min(1).max(200).default(50), beforeCreatedAt: z.string().datetime({ offset: true }).optional(), beforeId: z.string().uuid().optional() }).strict();
const milestoneSchema = z.object({ triggerKey: z.string().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/) }).strict();
const reversalSchema = z.object({ entryId: z.string().uuid(), operationKey: z.string().min(8).max(120), reason: z.string().min(3).max(200) }).strict();

/**
 * A4 Career finance & sponsorship service.
 * - `calendar` is the locked A3 calendar service constructed WITH the A4 finance
 *   hooks: A3 stays sporting authority; entering/withdrawing/advancing through it
 *   performs the financial effects in the same transaction.
 * - Everything else is A4's own read/sponsor surface. Every mutation locks the
 *   owning save root (A2 lockRoot: auth, ownership, feature flag, ACTIVE).
 */
export function createCareerFinanceService(database: CareerDatabase, options: { facts?: SponsorFactsProvider; calendarProviders?: Partial<CalendarProviders> } = {}) {
  let calendarProviders: CalendarProviders | null = null;
  let facts: SponsorFactsProvider | null = options.facts ?? null;
  const hooks = createFinanceHooks(() => calendarProviders!, () => facts!);
  const calendar = createCareerCalendarService(database, { providers: { ...options.calendarProviders, finance: hooks } });
  calendarProviders = calendar.providers;
  facts ??= defaultFactsProvider(calendarProviders);

  async function open(tx: CareerExecutor, actor: CareerActor, saveId: string, active = true) {
    careerIdSchema.parse(saveId);
    const root = await lockRoot(tx, actor, saveId, active) as RootRow;
    if (active) await ensureFinanceState(tx, root.id);
    return root;
  }
  const now = (root: RootRow) => ({ season: Number(root.current_season), week: Number(root.current_week) });

  return {
    calendar,
    hooks,
    versions: { financeVersion: FINANCE_VERSION, sponsorDatabaseVersion: SPONSOR_DATABASE_VERSION },

    /** Initialize A3 and the A4 ledger baseline without generating sponsor approaches. */
    async initialize(actor: CareerActor, saveId: string) {
      const result = await calendar.initialize(actor, saveId);
      await database.transaction(async tx => { await open(tx, actor, saveId); });
      return result;
    },

    async summary(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId, false);
        const s = await summary(tx, root.id);
        const reserved = await reservedPence(tx, root.id);
        const portfolio = await activeContracts(tx, root.id),contract=portfolio[0];
        const offers = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_sponsor_offers WHERE career_save_id = ${root.id} AND status = 'AVAILABLE'`)).rows[0].n);
        return { ...s, reservedForTravelPence: reserved, availablePence: s.balancePence - reserved, financeVersion: FINANCE_VERSION,
          sponsor: contract ? { contractId: contract.id, sponsorKey: contract.sponsor_key, displayName: contract.terms.displayName, tier: contract.tier, endSeason: contract.end_season, endWeek: contract.end_week } : null,
          activeContracts:portfolio.map(c=>({contractId:c.id,sponsorKey:c.sponsor_key,displayName:c.terms.displayName,tier:c.tier,
            ...relationship(c.terms),endSeason:c.end_season,endWeek:c.end_week})), availableOffers: offers };
      });
    },

    async ledger(actor: CareerActor, saveId: string, query: unknown = {}) {
      const q = ledgerQuerySchema.parse(query);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId, false);
        const rows = await recentEntries(tx, root.id, q.limit, q.beforeCreatedAt && q.beforeId ? { createdAt: q.beforeCreatedAt, id: q.beforeId } : undefined);
        const last = rows[rows.length - 1];
        return { entries: rows.map(presentEntry), next: rows.length === q.limit && last ? { beforeCreatedAt: new Date(String(last.created_at)).toISOString(), beforeId: last.id } : null };
      });
    },

    /** Preview (before entry) and actuals (after commitment) for one event. */
    async eventFinance(actor: CareerActor, saveId: string, eventId: string) {
      careerIdSchema.parse(eventId);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId, false);
        const event = (await loadInstances(tx, root.id, sql`id = ${eventId}`))[0];
        if (!event) throw new CareerError(404, "Career event not found");
        const preview = (await hooks.previews(tx, root, event.season, [event])).get(eventId);
        const finance = (await tx.execute(sql`SELECT * FROM career_event_finance WHERE career_save_id = ${root.id} AND event_id = ${eventId}`)).rows[0] ?? null;
        const tripId = finance?.trip_id ?? null;
        const entries = (await tx.execute(sql`SELECT * FROM career_finance_entries WHERE career_save_id = ${root.id}
          AND (event_id = ${eventId} ${tripId ? sql`OR trip_id = ${tripId}` : sql``}) ORDER BY created_at, id`)).rows as LedgerRow[];
        const trip = tripId ? (await tx.execute(sql`SELECT * FROM career_trips WHERE career_save_id = ${root.id} AND id = ${tripId}`)).rows[0] : null;
        const prize = (await tx.execute(sql`SELECT * FROM career_prize_awards WHERE career_save_id = ${root.id} AND event_id = ${eventId}`)).rows[0] ?? null;
        const sum = (cats: string[]) => entries.filter(e => cats.includes(e.category)).reduce((t, e) => t + Number(e.amount_pence), 0);
        return {
          eventId, preview, status: finance?.status ?? "NOT_ENTERED",
          actuals: finance ? {
            entryFeePaidPence: -sum(["ENTRY_FEE"]), travelPaidPence: -sum(["TRAVEL"]), accommodationPaidPence: -sum(["ACCOMMODATION"]),
            sponsorCoveredPence: entries.reduce((t, e) => t + Number(e.sponsor_covered_pence), 0), refundsPence: sum(["REFUND"]),
            prizePence: sum(["PRIZE"]), sponsorPaymentsPence: sum(["SPONSOR_EVENT_PAYMENT", "SPONSOR_PERFORMANCE_BONUS"]),
            trip: trip ? { id: trip.id, band: trip.band, destination: trip.destination, nights: trip.nights, startDay: trip.start_day, endDay: trip.end_day, events: trip.event_ids,
              travelGrossPence: trip.travel_gross_pence, travelCoveredPence: trip.travel_covered_pence, accommodationGrossPence: trip.accommodation_gross_pence, accommodationCoveredPence: trip.accommodation_covered_pence } : null,
            prizeAward: prize ? { finishingPosition: prize.finishing_position, cashAwardPence: Number(prize.cash_award_pence), rankingEligiblePence: Number(prize.ranking_eligible_pence), classification: prize.classification } : null,
            entries: entries.map(presentEntry), snapshot: finance.snapshot,
          } : null,
        };
      });
    },

    async sponsors(actor: CareerActor, saveId: string) {
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId, false);
        const active=await activeContracts(tx,root.id), sporting=await facts!.facts(tx,root);
        const contracts = (await tx.execute(sql`SELECT * FROM career_sponsor_contracts WHERE career_save_id = ${root.id} ORDER BY signed_at DESC, id LIMIT 50`)).rows;
        const offers = (await tx.execute(sql`SELECT * FROM career_sponsor_offers WHERE career_save_id = ${root.id} ORDER BY created_at DESC, id LIMIT 50`)).rows;
        const journeys = (await tx.execute(sql`SELECT * FROM career_sponsor_journeys WHERE career_save_id = ${root.id} ORDER BY created_at DESC, id LIMIT 100`)).rows;
        const journeyIds = journeys.map(j => String(j.id));
        const journeyEvents = journeyIds.length ? (await tx.execute(sql`SELECT * FROM career_sponsor_journey_events
          WHERE career_save_id = ${root.id} AND journey_id IN (${sql.join(journeyIds.map(id => sql`${id}`), sql`, `)})
          ORDER BY journey_id, ordinal`)).rows : [];
        const eventsByJourney = new Map<string, typeof journeyEvents>();
        for (const event of journeyEvents) {
          const key = String(event.journey_id), current = eventsByJourney.get(key) ?? [];
          current.push(event); eventsByJourney.set(key, current);
        }
        const journeyView = (j: Record<string, unknown>) => ({
          id: j.id, status: j.status, revision: Number(j.revision), negotiationRounds: Number(j.negotiation_rounds), maxRounds: 2,
          representative: j.representative, brandPersonality: j.brand_personality, source: j.source,
          timeline: (eventsByJourney.get(String(j.id)) ?? []).map(event => ({
            type: event.event_type, offerId: event.offer_id, details: event.details,
            createdAt: new Date(String(event.created_at)).toISOString(),
          })),
        });
        const journeyByOffer = new Map(journeys.map(j => [String(j.current_offer_id), journeyView(j as Record<string, unknown>)]));
        const earnings = new Map((await tx.execute(sql`SELECT contract_id, COALESCE(SUM(amount_pence) FILTER (WHERE headline = 'SPONSOR'), 0)::bigint AS paid,
            COALESCE(SUM(sponsor_covered_pence), 0)::bigint AS covered FROM career_finance_entries WHERE career_save_id = ${root.id} AND contract_id IS NOT NULL GROUP BY 1`)).rows
          .map(r => [String(r.contract_id), { paidPence: Number(r.paid), coveredPence: Number(r.covered) }]));
        const presentContract = (c: Record<string, unknown>) => {
          const terms=parseSponsorTerms(c.terms);
          return { id: c.id, sponsorKey: c.sponsor_key, tier: c.tier, terms, ...relationship(terms),status: c.status, endReason: c.end_reason,
            start: { season: c.start_season, week: c.start_week }, end: { season: c.end_season, week: c.end_week }, signedAt: c.signed_at, endedAt: c.ended_at,
            totals: earnings.get(String(c.id)) ?? { paidPence: 0, coveredPence: 0 } };
        };
        const presentOffer = (o: Record<string, unknown>) => {
          const terms=parseSponsorTerms(o.terms);
          return { id: o.id, sponsorKey: o.sponsor_key, tier: o.tier, kind: o.kind, terms, ...relationship(terms),
            journey: journeyByOffer.get(String(o.id)) ?? null,
            conflictingContractIds:conflicts(terms,active),portfolioFull:active.length>=portfolioLimit(sporting),source: o.source, status: o.status,
            statusReason: o.status_reason, offered: { season: o.offered_season, week: o.offered_week }, expires: { season: o.expires_season, week: o.expires_week } };
        };
        return { active: active[0]?presentContract(active[0]):null, activeContracts:active.map(presentContract),portfolioLimit:portfolioLimit(sporting),
          offers: offers.filter(o => o.status === "AVAILABLE").map(presentOffer),
          journeys: journeys.map(j => journeyView(j as Record<string, unknown>)),
          history: { contracts: contracts.filter(c => c.status !== "ACTIVE").map(presentContract), offers: offers.filter(o => o.status !== "AVAILABLE").map(presentOffer) } };
      });
    },

    async acceptOffer(actor: CareerActor, saveId: string, body: unknown) {
      const { offerId,replaceContractIds } = acceptOfferSchema.parse(body);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const out = await acceptOffer(tx, root, offerId, now(root).season, now(root).week,{replaceContractIds,facts:await facts!.facts(tx,root)});
        if (out.created) {
          const journey = (await tx.execute(sql`SELECT id FROM career_sponsor_journeys
            WHERE career_save_id = ${root.id} AND current_offer_id = ${offerId} AND status IN ('OFFERED','NEGOTIATING')`)).rows[0];
          if (journey) {
            await tx.execute(sql`UPDATE career_sponsor_journeys SET status = 'SIGNED', signed_contract_id = ${out.contract.id}, updated_at = NOW()
              WHERE career_save_id = ${root.id} AND id = ${journey.id}`);
            await appendSponsorJourneyEvent(tx, root, {
              journeyId: String(journey.id), eventKey: `signed:${out.contract.id}`, eventType: "SIGNED", offerId,
              details: { headline: "Partnership signed", summary: `${out.contract.terms.displayName} is now an active A4 contract.` },
            });
          }
        }
        const signingReveal = out.created ? {
          contractId: out.contract.id, sponsorKey: out.contract.sponsor_key, displayName: out.contract.terms.displayName,
          tier: out.contract.tier, terms: out.contract.terms, start: { season: out.contract.start_season, week: out.contract.start_week },
          end: { season: out.contract.end_season, week: out.contract.end_week },
        } : null;
        return { contractId: out.contract.id, sponsorKey: out.contract.sponsor_key, created: out.created, status: out.contract.status, signingReveal };
      });
    },

    async declineOffer(actor: CareerActor, saveId: string, body: unknown) {
      const { offerId } = offerRefSchema.parse(body);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const result = await declineOffer(tx, root, offerId, "PLAYER_WALKED_AWAY");
        const journey = (await tx.execute(sql`SELECT id, status FROM career_sponsor_journeys
          WHERE career_save_id = ${root.id} AND current_offer_id = ${offerId}`)).rows[0];
        if (journey && journey.status !== "WALKED_AWAY") {
          await tx.execute(sql`UPDATE career_sponsor_journeys SET status = 'WALKED_AWAY', updated_at = NOW()
            WHERE career_save_id = ${root.id} AND id = ${journey.id}`);
          await appendSponsorJourneyEvent(tx, root, {
            journeyId: String(journey.id), eventKey: `walked-away:${offerId}`, eventType: "PLAYER_WALKED_AWAY", offerId,
            details: { headline: "You walked away", summary: "The offer was declined without changing your existing contracts." },
          });
        }
        return result;
      });
    },

    async negotiateOffer(actor: CareerActor, saveId: string, offerId: string, body: unknown) {
      return database.transaction(async tx => negotiateSponsorOffer(tx, await open(tx, actor, saveId), offerId, body));
    },

    /** Internal milestone boundary (A5/A7 or server flows supply factual triggers). Idempotent per triggerKey. */
    async evaluateOffers(actor: CareerActor, saveId: string, body: unknown) {
      const { triggerKey } = milestoneSchema.parse(body);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        return { created: await evaluateOffers(tx, root, await facts!.facts(tx, root), `milestone:${triggerKey}`, now(root).season, now(root).week) };
      });
    },

    /** Internal correction: an exact reversal of one ledger entry (never an edit). Not exposed over HTTP. */
    async reverseEntry(actor: CareerActor, saveId: string, body: unknown) {
      const input = reversalSchema.parse(body);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const original = (await tx.execute(sql`SELECT * FROM career_finance_entries WHERE career_save_id = ${root.id} AND id = ${input.entryId}`)).rows[0] as LedgerRow | undefined;
        if (!original) throw new CareerError(404, "Ledger entry not found");
        const out = await post(tx, root, { operationKey: `adjustment:${input.operationKey}`, category: "ADJUSTMENT", amountPence: -Number(original.amount_pence), headline: original.headline,
          reason: input.reason, season: now(root).season, week: now(root).week, eventId: original.event_id, tripId: original.trip_id, contractId: original.contract_id, reversesEntryId: original.id });
        return presentEntry(out.row);
      });
    },

    /** A5 boundary: factual prize facts (cash vs ranking-eligible) and per-event prize tables. */
    async prizeFacts(actor: CareerActor, saveId: string, season?: number) {
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId, false);
        const s = season ?? now(root).season;
        return {
          humanAwards: (await tx.execute(sql`SELECT event_id, season, finishing_position, cash_award_pence, ranking_eligible_pence, classification FROM career_prize_awards
            WHERE career_save_id = ${root.id} AND season = ${s} ORDER BY created_at, event_id`)).rows,
          prizeTables: (await tx.execute(sql`SELECT event_id, season, prize_profile_key, classification, ranking_eligible, bands FROM career_event_prize_tables
            WHERE career_save_id = ${root.id} AND season = ${s} ORDER BY event_id`)).rows,
        };
      });
    },
  };
}
export type CareerFinanceService = ReturnType<typeof createCareerFinanceService>;
