import { sql } from "drizzle-orm";
import { z } from "zod";
import type { CareerDatabase, CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { careerIdSchema } from "../validation.ts";
import { lockRoot, type CareerActor } from "../world/service.ts";
import { createCareerCalendarService } from "../calendar/service.ts";
import { loadInstances, type RootRow } from "../calendar/engine.ts";
import type { CalendarProviders } from "../calendar/providers.ts";
import { BRANDS } from "../content/brands.ts";
import { representativeForSponsor } from "../content/sponsor-representatives.ts";
import { FINANCE_VERSION } from "./config.ts";
import { summary, recentEntries, presentEntry, post, type LedgerRow } from "./ledger.ts";
import {
  createFinanceHooks, defaultFactsProvider, ensureFinanceState, evaluateOffers, acceptOffer, declineOffer, reservedPence, activeContracts,
  postDueGuaranteedPayments, type SponsorFactsProvider,
} from "./engine.ts";
import { projectGuaranteePaymentStatus, scheduleContractGuarantees } from "./sponsor-guarantees.ts";
import { relationship, conflicts, portfolioLimit } from "./portfolio.ts";
import {
  CURRENT_SPONSOR_DATABASE_VERSION, SPONSOR_GUARANTEE_CONFIGURATION_STATUS, parseSponsorTerms,
} from "./sponsors.catalogue.ts";
import { appendSponsorJourneyEvent, syncExpiredSponsorJourneys } from "./sponsor-journey.ts";
import { negotiateSponsorOffer } from "./sponsor-negotiation.ts";
import { stableUuid } from "../world/random.ts";
import { cancelInactiveSponsorActivities } from "./sponsor-activities.ts";

const offerRefSchema = z.object({ offerId: z.string().uuid() }).strict();
const acceptOfferSchema = offerRefSchema.extend({replaceContractIds:z.array(z.string().uuid()).max(5).refine(ids=>new Set(ids).size===ids.length).optional()});

async function recordSponsorActivityUpdate(tx:CareerExecutor,root:RootRow,row:Record<string,unknown>,status:string,season:number,week:number){
  const contractId=String(row.contract_id??"");
  if(!contractId)return;
  const journey=(await tx.execute(sql`SELECT id FROM career_sponsor_journeys
    WHERE career_save_id=${root.id} AND signed_contract_id=${contractId} ORDER BY created_at DESC LIMIT 1`)).rows[0];
  if(!journey)return;
  const activityId=String(row.id??"");
  const kind=String(row.commitment_type??row.opportunity_type??"sponsor activity").replaceAll("_"," ").toLowerCase();
  await appendSponsorJourneyEvent(tx,root,{
    journeyId:String(journey.id),eventKey:`activity:${activityId}:${status}:${week}`,
    eventType:"ACTIVITY_UPDATE",season,week,
    details:{activityId,status,summary:`${kind} ${status.toLowerCase()} in Career Week ${week}.`},
  });
}
const ledgerQuerySchema = z.object({ limit: z.number().int().min(1).max(200).default(50), beforeCreatedAt: z.string().datetime({ offset: true }).optional(), beforeId: z.string().uuid().optional() }).strict();
const milestoneSchema = z.object({ triggerKey: z.string().min(1).max(120).regex(/^[A-Za-z0-9:_-]+$/) }).strict();
const reversalSchema = z.object({ entryId: z.string().uuid(), operationKey: z.string().min(8).max(120), reason: z.string().min(3).max(200) }).strict();
const sponsorActivityActionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("ACCEPT")}).strict(),
  z.object({action:z.literal("DECLINE")}).strict(),
  z.object({action:z.literal("SCHEDULE"),week:z.number().int().min(1).max(52)}).strict(),
  z.object({action:z.literal("COMPLETE")}).strict(),
]);
const sponsorReleaseRequestSchema=z.object({
  contractId:z.string().uuid(), operationKey:z.string().min(8).max(180),
  releaseType:z.enum(["IMMEDIATE_NO_COST","MUTUAL","PRICED_BUYOUT"]),
}).strict();
const formatPence = (pence: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

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
    versions: { financeVersion: FINANCE_VERSION, sponsorDatabaseVersion: CURRENT_SPONSOR_DATABASE_VERSION },

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
        const current = now(root);
        const commitments = (await tx.execute(sql`SELECT c.*,s.terms->>'displayName' AS sponsor_name,s.terms AS contract_terms
          FROM career_sponsor_commitments c LEFT JOIN career_sponsor_contracts s
            ON s.career_save_id=c.career_save_id AND s.id=c.contract_id
          WHERE c.career_save_id=${root.id}
          ORDER BY c.season,COALESCE(c.scheduled_week,c.due_week),c.created_at,c.id`)).rows;
        const notices=(await tx.execute(sql`SELECT * FROM career_sponsor_compliance_notices
          WHERE career_save_id=${root.id} ORDER BY created_at DESC,id LIMIT 100`)).rows;
        const releaseCases=(await tx.execute(sql`SELECT r.*,s.terms->>'displayName' AS sponsor_name
          FROM career_sponsor_release_cases r JOIN career_sponsor_contracts s
            ON s.career_save_id=r.career_save_id AND s.id=r.contract_id
          WHERE r.career_save_id=${root.id} ORDER BY r.created_at DESC,r.id LIMIT 100`)).rows;
        const opportunities = (await tx.execute(sql`SELECT * FROM career_sponsor_opportunities
          WHERE career_save_id=${root.id} ORDER BY season,available_from_week,created_at,id`)).rows;
        const journeyIds = journeys.map(j => String(j.id));
        const journeyEvents = journeyIds.length ? (await tx.execute(sql`SELECT * FROM career_sponsor_journey_events
          WHERE career_save_id = ${root.id} AND journey_id IN (${sql.join(journeyIds.map(id => sql`${id}`), sql`, `)})
          ORDER BY journey_id, ordinal`)).rows : [];
        const eventsByJourney = new Map<string, typeof journeyEvents>();
        for (const event of journeyEvents) {
          const key = String(event.journey_id), current = eventsByJourney.get(key) ?? [];
          current.push(event); eventsByJourney.set(key, current);
        }
        const journeyView = (j: Record<string, unknown>) => {
          const source = (j.source ?? {}) as Record<string, unknown>;
          const sponsor = (source.sponsor ?? source) as Record<string, unknown>;
          return {
          sponsorKey: String(j.sponsor_key),
          displayName: String(sponsor.displayName ?? j.sponsor_key),
          tier: String(sponsor.tier ?? ""),
          category: sponsor.category == null ? null : String(sponsor.category),
          id: j.id, status: j.status, revision: Number(j.revision), negotiationRounds: Number(j.negotiation_rounds), maxRounds: 2,
          representative: j.representative, brandPersonality: j.brand_personality, source,
          timeline: (eventsByJourney.get(String(j.id)) ?? []).map(event => ({
            type: event.event_type, offerId: event.offer_id, details: event.details,
            season: event.season == null ? null : Number(event.season),
            week: event.week == null ? null : Number(event.week),
            createdAt: new Date(String(event.created_at)).toISOString(),
          })),
        }};
        const journeyByOffer = new Map(journeys.filter(j => j.current_offer_id != null)
          .map(j => [String(j.current_offer_id), journeyView(j as Record<string, unknown>)]));
        const earnings = new Map((await tx.execute(sql`SELECT contract_id, COALESCE(SUM(amount_pence) FILTER (WHERE headline = 'SPONSOR'), 0)::bigint AS paid,
            COALESCE(SUM(sponsor_covered_pence), 0)::bigint AS covered FROM career_finance_entries WHERE career_save_id = ${root.id} AND contract_id IS NOT NULL GROUP BY 1`)).rows
          .map(r => [String(r.contract_id), { paidPence: Number(r.paid), coveredPence: Number(r.covered) }]));
        const paidGuaranteeKeys = new Set((await tx.execute(sql`SELECT operation_key FROM career_finance_entries
          WHERE career_save_id = ${root.id} AND category = 'SPONSOR_GUARANTEED_PAYMENT'`)).rows.map(row => String(row.operation_key)));
        const schedules = new Map(active.map(contract => {
          const { payments, unsupported } = scheduleContractGuarantees(contract);
          return [String(contract.id), {
            payments: payments.map(payment => projectGuaranteePaymentStatus(payment, paidGuaranteeKeys, current.season, current.week)),
            unsupported,
          }] as const;
        }));
        const presentContract = (c: Record<string, unknown>) => {
          const terms=parseSponsorTerms(c.terms);
          const brand=BRANDS.find(candidate=>candidate.id===String(c.sponsor_key));
          const sourceOffer=offers.find(o=>String(o.id)===String(c.offer_id));
          return { id: c.id, sponsorKey: c.sponsor_key, tier: c.tier, terms, ...relationship(terms),status: c.status, endReason: c.end_reason,
            renewal:sourceOffer?.kind==="RENEWAL",
            category:terms.category??terms.contractFoundation?.category??brand?.category??null,
            representative:terms.representative??(brand?.representativeId?representativeForSponsor(brand.id)??null:null),
            start: { season: c.start_season, week: c.start_week }, end: { season: c.end_season, week: c.end_week }, signedAt: c.signed_at, endedAt: c.ended_at,
            totals: earnings.get(String(c.id)) ?? { paidPence: 0, coveredPence: 0 },
            commercial: schedules.get(String(c.id)) ? {
              remainingGuaranteesPence: schedules.get(String(c.id))!.payments
                .filter(payment => payment.status === "DUE" || payment.status === "SCHEDULED")
                .reduce((sum, payment) => sum + payment.amountPence, 0),
              pastDueGuaranteesPence: schedules.get(String(c.id))!.payments
                .filter(payment => payment.status === "PAST_DUE")
                .reduce((sum, payment) => sum + payment.amountPence, 0),
              upcomingGuarantees: schedules.get(String(c.id))!.payments
                .filter(payment => payment.status === "DUE" || payment.status === "SCHEDULED").slice(0, 6),
              pastDueGuarantees: schedules.get(String(c.id))!.payments
                .filter(payment => payment.status === "PAST_DUE").slice(0, 6),
              unsupportedGuarantees: schedules.get(String(c.id))!.unsupported,
            } : undefined };
        };
        const presentOffer = (o: Record<string, unknown>) => {
          const terms=parseSponsorTerms(o.terms);
          return { id: o.id, sponsorKey: o.sponsor_key, tier: o.tier, kind: o.kind, terms, ...relationship(terms),
            journey: journeyByOffer.get(String(o.id)) ?? null,
            conflictingContractIds:conflicts(terms,active),portfolioFull:active.length>=portfolioLimit(sporting),source: o.source, status: o.status,
            statusReason: o.status_reason, offered: { season: o.offered_season, week: o.offered_week }, expires: { season: o.expires_season, week: o.expires_week } };
        };
        const commercialPayments = [...schedules.values()].flatMap(schedule => schedule.payments);
        const upcomingGuarantees = commercialPayments
          .filter(payment => payment.status === "DUE" || payment.status === "SCHEDULED")
          .sort((a, b) => a.season - b.season || a.week - b.week || a.sponsorKey.localeCompare(b.sponsorKey))
          .slice(0, 12);
        const pastDueGuarantees = commercialPayments
          .filter(payment => payment.status === "PAST_DUE")
          .sort((a, b) => a.season - b.season || a.week - b.week)
          .slice(0, 12);
        const unsupportedGuarantees = [...schedules.values()].flatMap(schedule => schedule.unsupported);
        const sponsorCash = (await tx.execute(sql`SELECT
          COALESCE(SUM(amount_pence) FILTER (WHERE headline = 'SPONSOR'), 0)::bigint AS total,
          COALESCE(SUM(amount_pence) FILTER (WHERE category = 'SPONSOR_SIGNING_BONUS'), 0)::bigint AS signing,
          COALESCE(SUM(amount_pence) FILTER (WHERE category = 'SPONSOR_GUARANTEED_PAYMENT'), 0)::bigint AS guarantees,
          COALESCE(SUM(amount_pence) FILTER (WHERE category = 'SPONSOR_EVENT_PAYMENT'), 0)::bigint AS event_payments,
          COALESCE(SUM(amount_pence) FILTER (WHERE category = 'SPONSOR_PERFORMANCE_BONUS'), 0)::bigint AS performance_bonuses,
          COALESCE(SUM(sponsor_covered_pence), 0)::bigint AS costs_covered
          FROM career_finance_entries WHERE career_save_id = ${root.id} AND season = ${current.season}`)).rows[0] ?? {};
        const potentialBonuses = active.flatMap(contract => contract.terms.performanceBonuses
          .filter(bonus => bonus.amountPence > 0)
          .map(bonus => ({
            contractId: contract.id, sponsorKey: contract.sponsor_key,
            displayName: contract.terms.displayName, bonusKey: bonus.key,
            amountPence: bonus.amountPence, maxPosition: bonus.maxPosition,
            classifications: bonus.classifications, circuits: bonus.circuits ?? null,
          })));
        return {
          guaranteeConfiguration: {
            status: SPONSOR_GUARANTEE_CONFIGURATION_STATUS,
            catalogueVersion: CURRENT_SPONSOR_DATABASE_VERSION,
          },
          active: active[0]?presentContract(active[0]):null, activeContracts:active.map(presentContract),
          pendingContracts:contracts.filter(c=>c.status==="SCHEDULED").map(presentContract),portfolioLimit:portfolioLimit(sporting),
          commercial: {
            season: current.season,
            week: current.week,
            cashReceivedPence: {
              total: Number(sponsorCash.total ?? 0),
              signing: Number(sponsorCash.signing ?? 0),
              guarantees: Number(sponsorCash.guarantees ?? 0),
              eventPayments: Number(sponsorCash.event_payments ?? 0),
              performanceBonuses: Number(sponsorCash.performance_bonuses ?? 0),
            },
            costsCoveredPence: Number(sponsorCash.costs_covered ?? 0),
            remainingGuaranteesPence: commercialPayments
              .filter(payment => payment.status === "DUE" || payment.status === "SCHEDULED")
              .reduce((sum, payment) => sum + payment.amountPence, 0),
            upcomingGuarantees,
            pastDueGuarantees,
            pastDueGuaranteesPence: commercialPayments
              .filter(payment => payment.status === "PAST_DUE")
              .reduce((sum, payment) => sum + payment.amountPence, 0),
            unsupportedGuarantees,
            potentialBonuses,
          },
          offers: offers.filter(o => o.status === "AVAILABLE").map(presentOffer),
          journeys: journeys.map(j => journeyView(j as Record<string, unknown>)),
          sponsorHQ: {
            commitments:commitments.map(c=>({id:String(c.id),contractId:String(c.contract_id),sponsorKey:String(c.sponsor_key),
              sponsorName:String(c.sponsor_name??c.sponsor_key),clauseId:String(c.clause_id),occurrence:Number(c.occurrence),
              kind:String(c.commitment_type),required:Boolean(c.required),cadence:String(c.cadence),season:Number(c.season),
              availableFromWeek:Number(c.available_from_week),windowWeeks:Number(c.window_weeks),dueWeek:Number(c.due_week),
              scheduledWeek:c.scheduled_week==null?null:Number(c.scheduled_week),status:String(c.status)})),
            opportunities:opportunities.map(o=>({id:String(o.id),contractId:String(o.contract_id),sponsorKey:String(o.sponsor_key),
              clauseId:String(o.clause_id),occurrence:Number(o.occurrence),kind:String(o.opportunity_type),season:Number(o.season),
              availableFromWeek:Number(o.available_from_week),availableToWeek:Number(o.available_to_week),
               scheduledWeek:o.scheduled_week==null?null:Number(o.scheduled_week),status:String(o.status)})),
             notices:notices.map(n=>({id:String(n.id),contractId:String(n.contract_id),activityId:String(n.activity_id),
               status:String(n.status),type:String(n.notice_type),details:n.details,createdAt:n.created_at})),
             releases:releaseCases.map(r=>({id:String(r.id),contractId:String(r.contract_id),sponsorName:String(r.sponsor_name),
               type:String(r.release_type),status:String(r.status),amountPence:Number(r.amount_pence),
               sponsorDecision:r.sponsor_decision==null?null:String(r.sponsor_decision),terms:r.terms_snapshot,createdAt:r.created_at})),
          },
          history: { contracts: contracts.filter(c => !["ACTIVE","SCHEDULED"].includes(String(c.status))).map(presentContract), offers: offers.filter(o => o.status !== "AVAILABLE").map(presentOffer) } };
      });
    },

    async requestSponsorRelease(actor:CareerActor,saveId:string,body:unknown){
      const input=sponsorReleaseRequestSchema.parse(body);
      return database.transaction(async tx=>{
        const root=await open(tx,actor,saveId);
        const existing=(await tx.execute(sql`SELECT * FROM career_sponsor_release_cases
          WHERE career_save_id=${root.id} AND operation_key=${input.operationKey} FOR UPDATE`)).rows[0];
        if(existing){
          if(String(existing.contract_id)!==input.contractId||String(existing.release_type)!==input.releaseType)
            throw new CareerError(409,"This operation key was already used for a different release request");
          return {id:String(existing.id),status:String(existing.status),releaseType:String(existing.release_type),amountPence:Number(existing.amount_pence),sponsorDecision:existing.sponsor_decision??null};
        }
        const c=(await tx.execute(sql`SELECT * FROM career_sponsor_contracts
          WHERE career_save_id=${root.id} AND id=${input.contractId} FOR UPDATE`)).rows[0];
        if(!c||c.status!=="ACTIVE")throw new CareerError(409,"Only an active sponsor agreement can be released");
        const scheduled=(await tx.execute(sql`SELECT 1 FROM career_sponsor_contracts
          WHERE career_save_id=${root.id} AND sponsor_key=${c.sponsor_key} AND status='SCHEDULED' LIMIT 1`)).rows.length>0;
        if(scheduled)throw new CareerError(409,"This agreement has an accepted scheduled renewal; resolve the renewal before requesting release");
        const terms=parseSponsorTerms(c.terms), clause=terms.contractFoundation?.releaseClause;
        let amount=0,status="OFFERED",decision:string|null=null;
        if(input.releaseType==="IMMEDIATE_NO_COST"&&!(clause?.playerNoticeWeeks===0&&clause.buyoutPence===0))
          throw new CareerError(409,"This signed agreement does not permit immediate no-cost release");
        if(input.releaseType==="PRICED_BUYOUT"){
          if(!clause||clause.buyoutPence===null||clause.buyoutPence<=0)throw new CareerError(409,"This signed agreement has no priced buyout");
          amount=clause.buyoutPence;
        }
        if(input.releaseType==="MUTUAL"){
          if(!(terms.contractFoundation?.terminationConditions??[]).includes("MUTUAL_AGREEMENT"))
            throw new CareerError(409,"Mutual release is not authorised by this signed agreement");
          // A mutual clause permits a request; it does not itself authorize the
          // sponsor's consent. Keep the case pending until a real decision exists.
          status="REQUESTED";
        }
        const id=stableUuid(root.world_seed,2,"SP-E2","release-case",input.operationKey);
        const result=(await tx.execute(sql`INSERT INTO career_sponsor_release_cases
          (career_save_id,id,contract_id,operation_key,release_type,status,amount_pence,sponsor_decision,terms_snapshot)
          VALUES(${root.id},${id},${input.contractId},${input.operationKey},${input.releaseType},${status},${amount},${decision},
            ${JSON.stringify({releaseClause:clause??null,terminationConditions:terms.contractFoundation?.terminationConditions??[]})}::jsonb)
          RETURNING id,status,release_type,amount_pence,sponsor_decision`)).rows[0]!;
        return {id:String(result.id),status:String(result.status),releaseType:String(result.release_type),amountPence:Number(result.amount_pence),sponsorDecision:result.sponsor_decision??null};
      });
    },

    async acknowledgeSponsorNotice(actor:CareerActor,saveId:string,noticeId:string){
      return database.transaction(async tx=>{
        const root=await open(tx,actor,saveId);
        const notice=(await tx.execute(sql`SELECT status FROM career_sponsor_compliance_notices
          WHERE career_save_id=${root.id} AND id=${noticeId} FOR UPDATE`)).rows[0];
        if(!notice)throw new CareerError(404,"Sponsor compliance notice not found");
        if(notice.status==="OPEN")await tx.execute(sql`UPDATE career_sponsor_compliance_notices SET status='ACKNOWLEDGED',updated_at=NOW()
          WHERE career_save_id=${root.id} AND id=${noticeId} AND status='OPEN'`);
        return {id:noticeId,status:notice.status==="OPEN"?"ACKNOWLEDGED":String(notice.status)};
      });
    },

    async acceptSponsorRelease(actor:CareerActor,saveId:string,caseId:string){
      return database.transaction(async tx=>{
        const root=await open(tx,actor,saveId);
        const r=(await tx.execute(sql`SELECT r.*,c.sponsor_key,c.terms,c.status AS contract_status
          FROM career_sponsor_release_cases r JOIN career_sponsor_contracts c
            ON c.career_save_id=r.career_save_id AND c.id=r.contract_id
          WHERE r.career_save_id=${root.id} AND r.id=${caseId} FOR UPDATE OF r,c`)).rows[0];
        if(!r)throw new CareerError(404,"Release decision not found");
        if(r.status==="ACCEPTED")return {id:caseId,status:"ACCEPTED",amountPence:Number(r.amount_pence)};
        if(r.status!=="OFFERED"||r.contract_status!=="ACTIVE")throw new CareerError(409,"This release is not available to accept");
        const scheduled=(await tx.execute(sql`SELECT 1 FROM career_sponsor_contracts
          WHERE career_save_id=${root.id} AND sponsor_key=${r.sponsor_key} AND status='SCHEDULED' LIMIT 1`)).rows.length>0;
        if(scheduled)throw new CareerError(409,"An accepted scheduled renewal must be resolved first");
        const terms=parseSponsorTerms(r.terms),clause=terms.contractFoundation?.releaseClause;
        if(r.release_type==="IMMEDIATE_NO_COST"&&!(clause?.playerNoticeWeeks===0&&clause.buyoutPence===0))throw new CareerError(409,"The signed release clause no longer authorises this action");
        if(r.release_type==="PRICED_BUYOUT"&&(!clause||clause.buyoutPence!==Number(r.amount_pence)||clause.buyoutPence<=0))throw new CareerError(409,"The signed buyout does not match this offer");
        if(r.release_type==="MUTUAL"&&(!(terms.contractFoundation?.terminationConditions??[]).includes("MUTUAL_AGREEMENT")||r.sponsor_decision!=="APPROVED"))throw new CareerError(409,"There is no approved mutual release");
        const season=now(root).season,week=now(root).week,amount=Number(r.amount_pence);
        if(amount>0)await post(tx,root,{operationKey:`sponsor-release:${caseId}`,category:"SPONSOR_RELEASE_SETTLEMENT",
          amountPence:-amount,headline:"EXPENSE",contractId:String(r.contract_id),season,week,
          reason:"Contractual sponsor release settlement",detail:{releaseCaseId:caseId,releaseType:r.release_type}});
        await tx.execute(sql`UPDATE career_sponsor_contracts SET status='TERMINATED',end_reason='PLAYER_RELEASE',ended_at=NOW()
          WHERE career_save_id=${root.id} AND id=${r.contract_id} AND status='ACTIVE'`);
        await cancelInactiveSponsorActivities(tx,{saveId:root.id,season,week,contractIds:[String(r.contract_id)]});
        await tx.execute(sql`UPDATE career_sponsor_release_cases SET status='ACCEPTED',updated_at=NOW()
          WHERE career_save_id=${root.id} AND id=${caseId}`);
        return {id:caseId,status:"ACCEPTED",amountPence:amount};
      });
    },

    async updateSponsorActivity(actor:CareerActor,saveId:string,activityId:string,body:unknown){
      const action=sponsorActivityActionSchema.parse(body);
      return database.transaction(async tx=>{
        const root=await open(tx,actor,saveId);
        const commitment=(await tx.execute(sql`SELECT c.*,s.current_season,s.current_week FROM career_sponsor_commitments c
          JOIN career_saves s ON s.id=c.career_save_id WHERE c.career_save_id=${root.id} AND c.id=${activityId} FOR UPDATE`)).rows[0];
        const opportunity=commitment?null:(await tx.execute(sql`SELECT o.*,s.current_season,s.current_week FROM career_sponsor_opportunities o
          JOIN career_saves s ON s.id=o.career_save_id WHERE o.career_save_id=${root.id} AND o.id=${activityId} FOR UPDATE`)).rows[0];
        const row=commitment??opportunity;
        if(!row)throw new CareerError(404,"Sponsor activity not found");
        const isCommitment=!!commitment,season=Number(row.season),currentSeason=Number(row.current_season),currentWeek=Number(row.current_week),current=String(row.status);
        if(action.action==="DECLINE"){
          if(current==="DECLINED")return {id:activityId,status:"DECLINED"};
          if(isCommitment||!["AVAILABLE","ACCEPTED"].includes(current))throw new CareerError(409,"Only an optional opportunity can be declined");
          await tx.execute(sql`UPDATE career_sponsor_opportunities SET status='DECLINED',updated_at=NOW() WHERE career_save_id=${root.id} AND id=${activityId}`);
          await recordSponsorActivityUpdate(tx,root,row as Record<string,unknown>,"DECLINED",season,currentWeek);
          return {id:activityId,status:"DECLINED"};
        }
        if(action.action==="ACCEPT"){
          const activeNow=(await tx.execute(sql`SELECT 1 FROM career_sponsor_contracts WHERE career_save_id=${root.id} AND id=${row.contract_id} AND status='ACTIVE'
            AND (start_season < ${currentSeason} OR (start_season=${currentSeason} AND start_week<=${currentWeek}))
            AND (end_season > ${currentSeason} OR (end_season=${currentSeason} AND end_week>=${currentWeek}))`)).rows.length>0;
          if(!activeNow)throw new CareerError(409,"The sponsor contract is no longer active");
          if(current==="ACCEPTED")return {id:activityId,status:"ACCEPTED"};
          if(isCommitment||current!=="AVAILABLE")throw new CareerError(409,"This opportunity cannot be accepted");
          await tx.execute(sql`UPDATE career_sponsor_opportunities SET status='ACCEPTED',updated_at=NOW() WHERE career_save_id=${root.id} AND id=${activityId}`);
          await recordSponsorActivityUpdate(tx,root,row as Record<string,unknown>,"ACCEPTED",season,currentWeek);
          return {id:activityId,status:"ACCEPTED"};
        }
        if(action.action==="SCHEDULE"){
          const from=Number(row.available_from_week),to=isCommitment?Number(row.due_week):Number(row.available_to_week);
          if(season!==currentSeason||action.week<currentWeek||action.week<from||action.week>to)throw new CareerError(409,"Choose a current or future week inside this activity's valid window");
          if(isCommitment?!["AVAILABLE","CONFIRMED"].includes(current):!["ACCEPTED","CONFIRMED"].includes(current))
            throw new CareerError(409,"This sponsor activity is not ready to schedule");
          const active=(await tx.execute(sql`SELECT 1 FROM career_sponsor_contracts WHERE career_save_id=${root.id} AND id=${row.contract_id} AND status='ACTIVE'
            AND (start_season < ${season} OR (start_season=${season} AND start_week<=${action.week}))
            AND (end_season > ${season} OR (end_season=${season} AND end_week>=${action.week}))`)).rows.length>0;
          if(!active)throw new CareerError(409,"The sponsor contract is not active in that week");
          if(current==="CONFIRMED"&&Number(row.scheduled_week)===action.week)return {id:activityId,status:"CONFIRMED",scheduledWeek:action.week};
          const conflict=(await tx.execute(sql`SELECT 1 WHERE
            EXISTS(SELECT 1 FROM career_event_instances i JOIN career_event_entries e ON e.career_save_id=i.career_save_id AND e.event_id=i.id
              WHERE i.career_save_id=${root.id} AND i.season=${season} AND i.start_week<=${action.week} AND i.end_week>=${action.week}
                AND e.participant_key='HUMAN' AND e.status<>'WITHDRAWN')
            OR EXISTS(SELECT 1 FROM career_life_commitments l WHERE l.career_save_id=${root.id} AND l.season=${season} AND l.status='ACCEPTED'
              AND ((l.day-1)/7+1)=${action.week})
            OR EXISTS(SELECT 1 FROM career_trips t WHERE t.career_save_id=${root.id} AND t.season=${season}
              AND t.start_day<=${action.week}*7 AND t.end_day>=(${action.week}-1)*7+1)`)).rows.length>0;
          if(conflict)throw new CareerError(409,"That week conflicts with a tournament or travel commitment");
          if(current==="CONFIRMED")await tx.execute(sql`DELETE FROM career_sponsor_week_bookings WHERE career_save_id=${root.id} AND activity_id=${activityId}`);
          const booking=(await tx.execute(sql`INSERT INTO career_sponsor_week_bookings(career_save_id,season,week,activity_id,activity_kind,status)
            VALUES(${root.id},${season},${action.week},${activityId},${isCommitment?"COMMITMENT":"OPPORTUNITY"},'CONFIRMED')
            ON CONFLICT (career_save_id,season,week) DO NOTHING RETURNING activity_id`)).rows[0];
          if(!booking)throw new CareerError(409,"Another sponsor activity is already scheduled that week");
          if(isCommitment)await tx.execute(sql`UPDATE career_sponsor_commitments SET status='CONFIRMED',scheduled_week=${action.week},updated_at=NOW()
            WHERE career_save_id=${root.id} AND id=${activityId}`);
          else await tx.execute(sql`UPDATE career_sponsor_opportunities SET status='CONFIRMED',scheduled_week=${action.week},updated_at=NOW()
            WHERE career_save_id=${root.id} AND id=${activityId}`);
          await recordSponsorActivityUpdate(tx,root,row as Record<string,unknown>,"CONFIRMED",season,action.week);
          return {id:activityId,status:"CONFIRMED",scheduledWeek:action.week};
        }
        if(current==="COMPLETED")return {id:activityId,status:"COMPLETED",season:currentSeason,week:Number(row.scheduled_week)};
        if(season!==currentSeason||Number(row.scheduled_week)!==currentWeek||current!=="CONFIRMED")
          throw new CareerError(409,"Sponsor activity can only be completed during its confirmed Career week");
        const activeAtCompletion=(await tx.execute(sql`SELECT 1 FROM career_sponsor_contracts WHERE career_save_id=${root.id} AND id=${row.contract_id} AND status='ACTIVE'
          AND (start_season < ${season} OR (start_season=${season} AND start_week<=${currentWeek}))
          AND (end_season > ${season} OR (end_season=${season} AND end_week>=${currentWeek}))`)).rows.length>0;
        if(!activeAtCompletion)throw new CareerError(409,"The sponsor contract is no longer active");
        if(isCommitment)await tx.execute(sql`UPDATE career_sponsor_commitments SET status='COMPLETED',
          resolution_evidence=jsonb_build_object('season',${currentSeason}::int,'week',${currentWeek}::int,'action','PLAYER_CONFIRMED'),updated_at=NOW()
          WHERE career_save_id=${root.id} AND id=${activityId} AND status='CONFIRMED'`);
        else await tx.execute(sql`UPDATE career_sponsor_opportunities SET status='COMPLETED',
          terms=terms||jsonb_build_object('completedSeason',${currentSeason}::int,'completedWeek',${currentWeek}::int),updated_at=NOW()
          WHERE career_save_id=${root.id} AND id=${activityId} AND status='CONFIRMED'`);
        await tx.execute(sql`UPDATE career_sponsor_week_bookings SET status='COMPLETED' WHERE career_save_id=${root.id} AND activity_id=${activityId}`);
        await recordSponsorActivityUpdate(tx,root,row as Record<string,unknown>,"COMPLETED",currentSeason,currentWeek);
        return {id:activityId,status:"COMPLETED",season:currentSeason,week:currentWeek};
      });
    },

    async acceptOffer(actor: CareerActor, saveId: string, body: unknown) {
      const { offerId,replaceContractIds } = acceptOfferSchema.parse(body);
      const outcome = await database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const out = await acceptOffer(tx, root, offerId, now(root).season, now(root).week,{replaceContractIds,facts:await facts!.facts(tx,root)});
        if (out.expired) {
          await syncExpiredSponsorJourneys(tx, root, now(root).season, now(root).week);
          return { expired: true as const };
        }
        const contract = out.contract;
        if (!contract) throw new Error("Accepted sponsor offer did not return its A4 contract");
        if (out.created) {
          const journey = (await tx.execute(sql`SELECT id FROM career_sponsor_journeys
            WHERE career_save_id = ${root.id} AND current_offer_id = ${offerId} AND status IN ('OFFERED','NEGOTIATING')`)).rows[0];
          if (journey) {
            await tx.execute(sql`UPDATE career_sponsor_journeys SET status = 'SIGNED', signed_contract_id = ${contract.id}, updated_at = NOW()
              WHERE career_save_id = ${root.id} AND id = ${journey.id}`);
            await appendSponsorJourneyEvent(tx, root, {
              journeyId: String(journey.id), eventKey: `signed:${contract.id}`, eventType: "SIGNED", offerId,
              season: now(root).season, week: now(root).week,
              details: {
                headline: contract.status==="SCHEDULED"?"Renewal accepted":"Partnership signed",
                summary: contract.status==="SCHEDULED"
                  ? `The ${contract.terms.displayName} renewal is accepted and starts Season ${contract.start_season}, Week ${contract.start_week}.`
                  : `${contract.terms.displayName} is now an active A4 contract.${contract.terms.signingBonusPence > 0 ? ` ${formatPence(contract.terms.signingBonusPence)} signing cash was posted.` : ""}`,
                signingPaymentPence: contract.terms.signingBonusPence,
                signingPaymentCategory: "SPONSOR_SIGNING_BONUS",
              },
            });
          }
          await postDueGuaranteedPayments(tx, root, [contract], now(root).season, now(root).week);
        }
        const identity = (await tx.execute(sql`SELECT COALESCE(p.display_name, s.career_name, 'You') AS player_name
          FROM career_saves s LEFT JOIN career_profiles p ON p.career_save_id = s.id WHERE s.id = ${root.id}`)).rows[0];
        const brand = BRANDS.find(candidate => candidate.id === contract.sponsor_key);
        const signingReveal = out.created ? {
          contractId: contract.id, playerName: String(identity?.player_name ?? "You"),
          sponsorKey: contract.sponsor_key, displayName: contract.terms.displayName,
          tier: contract.tier, category: contract.terms.category ?? contract.terms.contractFoundation?.category ?? brand?.category ?? null,
          representative: contract.terms.representative
            ?? (brand?.representativeId
              ? representativeForSponsor(brand.id) ?? null
              : { displayName: `${brand?.name ?? contract.terms.displayName} partnership team`, role: "Partnership contact" }),
          terms: contract.terms,
          start: { season: contract.start_season, week: contract.start_week },
          end: { season: contract.end_season, week: contract.end_week },
        } : null;
        return { expired: false as const, response: { contractId: contract.id, sponsorKey: contract.sponsor_key, created: out.created, status: contract.status, signingReveal } };
      });
      if (outcome.expired) throw new CareerError(409, "Sponsor offer has expired");
      return outcome.response;
    },

    async declineOffer(actor: CareerActor, saveId: string, body: unknown) {
      const { offerId } = offerRefSchema.parse(body);
      return database.transaction(async tx => {
        const root = await open(tx, actor, saveId);
        const journey = (await tx.execute(sql`SELECT id, status, negotiation_rounds FROM career_sponsor_journeys
          WHERE career_save_id = ${root.id} AND current_offer_id = ${offerId}`)).rows[0];
        const walkedAway = journey?.status === "NEGOTIATING" && Number(journey.negotiation_rounds) > 0;
        const result = await declineOffer(tx, root, offerId, walkedAway ? "PLAYER_WALKED_AWAY" : "PLAYER_DECLINED");
        if (journey && result.created) {
          const status = walkedAway ? "WALKED_AWAY" : "DECLINED";
          const type = walkedAway ? "PLAYER_WALKED_AWAY" : "PLAYER_DECLINED";
          await tx.execute(sql`UPDATE career_sponsor_journeys SET status = ${status}, updated_at = NOW()
            WHERE career_save_id = ${root.id} AND id = ${journey.id}`);
          await appendSponsorJourneyEvent(tx, root, {
            journeyId: String(journey.id), eventKey: `${walkedAway ? "walked-away" : "declined"}:${offerId}`,
            eventType: type, offerId, season: now(root).season, week: now(root).week,
            details: { headline: walkedAway ? "You walked away from talks" : "You declined the offer",
              summary: "The decision was recorded without changing your existing contracts." },
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
