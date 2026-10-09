import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { CareerError } from "../service.ts";
import { stableUuid } from "../world/random.ts";
import type { InstanceRow, RootRow } from "../calendar/engine.ts";
import type { CalendarProviders, CalendarFinanceHooks } from "../calendar/providers.ts";
import type { DenialReason } from "../calendar/eligibility.ts";
import {
  FINANCE_VERSION, SPONSOR_DATABASE_VERSION, FEE_PROFILES, FEE_OVERRIDES, PRIZE_PROFILES, PRIZE_OVERRIDES, REFUND_POLICIES,
  OFFER_LIFETIME_WEEKS, MAX_OFFERS_PER_EVALUATION, WEEKS, prizeForPosition, type FeeProfile, type PrizeProfile, type RefundPolicy,
} from "./config.ts";
import { post, InsufficientFundsError } from "./ledger.ts";
import { groupTrips, travelBand, tripCost, type Home } from "./travel.ts";
import {sponsorCatalogue,evaluateRequirement,tierRank,parseSponsorTerms,type CostType,type SponsorTerms,type SportingFacts,type SponsorTier} from "./sponsors.catalogue.ts";
import { conflicts, portfolioLimit, relationship } from "./portfolio.ts";
import { createSponsorJourney, syncExpiredSponsorJourneys, type SponsorApproachSource } from "./sponsor-journey.ts";

const HUMAN = "HUMAN";
export const timeIndex = (season: number, week: number) => (season - 1) * WEEKS + week;
const fromIndex = (index: number) => ({ season: Math.floor((index - 1) / WEEKS) + 1, week: ((index - 1) % WEEKS) + 1 });

/** Factual inputs for sponsorship. A4 never computes rankings or Tour Cards. */
export interface SponsorFactsProvider { readonly id: string; facts(tx: CareerExecutor, root: RootRow): Promise<SportingFacts> }

// ------------------------------------------------------------------ profiles
export type EventFinanceProfile = { fee: FeeProfile; prize: PrizeProfile; refund: RefundPolicy; rankingEligible: boolean; financeVersion: number };
export function profileFor(event: Pick<InstanceRow, "definition_key" | "classification" | "snapshot">): EventFinanceProfile {
  const refs = event.snapshot.profiles;
  const fee = FEE_OVERRIDES[event.definition_key] ?? FEE_PROFILES[refs.entryFee];
  const prize = PRIZE_OVERRIDES[event.definition_key] ?? PRIZE_PROFILES[refs.prize];
  if (!fee || !prize) throw new Error(`No finance profile for ${event.definition_key}`);
  // A4 provides the ranking-eligible money fact only; A5 decides what it means.
  return { fee, prize, refund: REFUND_POLICIES[fee.refundPolicy], rankingEligible: event.classification === "RANKING", financeVersion: FINANCE_VERSION };
}

// ------------------------------------------------------------------ state / contract / coverage
export async function ensureFinanceState(tx: CareerExecutor, saveId: string) {
  await tx.execute(sql`INSERT INTO career_finance_state (career_save_id, finance_version, sponsor_database_version)
    SELECT ${saveId}, ${FINANCE_VERSION}, CASE WHEN event_database_version >= 5 THEN 3 WHEN event_database_version >= 3 THEN 2 ELSE 1 END FROM career_saves WHERE id=${saveId}
    ON CONFLICT (career_save_id) DO NOTHING`);
  const row = (await tx.execute(sql`SELECT * FROM career_finance_state WHERE career_save_id = ${saveId}`)).rows[0];
  if (Number(row.finance_version) !== FINANCE_VERSION || ![1,2,3].includes(Number(row.sponsor_database_version))) throw new CareerError(409, "Career finance requires a version migration");
}
export type ContractRow = { id: string; offer_id: string; sponsor_key: string; tier: SponsorTier; terms: SponsorTerms; start_season: number; start_week: number; end_season: number; end_week: number; status: string };
export async function activeContracts(tx: CareerExecutor, saveId: string): Promise<ContractRow[]> {
  const rows = (await tx.execute(sql`SELECT * FROM career_sponsor_contracts WHERE career_save_id = ${saveId} AND status = 'ACTIVE' ORDER BY id`)).rows as (Omit<ContractRow,"terms">&{terms:unknown})[];
  const validated=rows.map(row=>({...row,terms:parseSponsorTerms(row.terms)}));
  const order = ["PRIMARY_COMMERCIAL", "EQUIPMENT_PARTNER", "APPAREL_PARTNER", "SECONDARY_COMMERCIAL", "LOCAL_REGIONAL_PARTNER"];
  return validated.sort((a,b)=>order.indexOf(relationship(a.terms).slot)-order.indexOf(relationship(b.terms).slot)||a.id.localeCompare(b.id));
}
/** Compatibility/display representative only, never the financial portfolio. */
export const activeContract = async (tx: CareerExecutor, saveId: string) => (await activeContracts(tx,saveId))[0];

type CoverageUsage = Map<number, number>;
async function coverageUsage(tx: CareerExecutor, saveId: string, contract: ContractRow | undefined, season: number): Promise<CoverageUsage> {
  if (!contract) return new Map();
  return new Map((await tx.execute(sql`SELECT (detail->>'coverageRule')::int AS rule, COALESCE(SUM(sponsor_covered_pence), 0)::bigint AS used
    FROM career_finance_entries WHERE career_save_id = ${saveId} AND contract_id = ${contract.id} AND season = ${season} AND detail ? 'coverageRule'
    GROUP BY 1`)).rows.map(r => [Number(r.rule), Number(r.used)]));
}
/** Generic coverage: first matching rule by order; percent, per-event cap and season cap. Mutates usage. */
export function applyCoverage(contract: ContractRow | undefined, usage: CoverageUsage, costType: CostType, circuit: string, grossPence: number) {
  if (!contract || grossPence <= 0) return { covered: 0, rule: null as number | null };
  const rules = contract.terms.coverage;
  const index = rules.findIndex(r => r.costTypes.includes(costType) && (r.circuits === null || r.circuits.includes(circuit)));
  if (index < 0) return { covered: 0, rule: null };
  const rule = rules[index];
  let covered = Math.floor(grossPence * rule.percent / 100);
  if (rule.perEventCapPence !== null) covered = Math.min(covered, rule.perEventCapPence);
  if (rule.seasonCapPence !== null) covered = Math.min(covered, Math.max(0, rule.seasonCapPence - (usage.get(index) ?? 0)));
  usage.set(index, (usage.get(index) ?? 0) + covered);
  return { covered, rule: index };
}
export type CoveragePortfolio = { contracts: ContractRow[]; usage: Map<string,CoverageUsage> };
async function loadCoveragePortfolio(tx:CareerExecutor,saveId:string,season:number):Promise<CoveragePortfolio> {
  const contracts=await activeContracts(tx,saveId);
  return {contracts,usage:new Map(await Promise.all(contracts.map(async c=>[c.id,await coverageUsage(tx,saveId,c,season)] as const)))};
}
function clonePortfolio(p:ContractRow|CoveragePortfolio|undefined) {
  return p && "contracts" in p ? {...p,usage:new Map([...p.usage].map(([id,u])=>[id,new Map(u)]))} : p;
}
/** Non-stacking best legitimate coverage, deterministic ties; one A4 attribution per cost. */
export function portfolioCoverage(p:ContractRow|CoveragePortfolio|undefined,usage:CoverageUsage,type:CostType,circuit:string,gross:number) {
  if (!p || !("contracts" in p)) return {...applyCoverage(p,usage,type,circuit,gross),contractId:p?.id??null};
  const choices=p.contracts.map(c=>({c,result:applyCoverage(c,new Map(p.usage.get(c.id)),type,circuit,gross)}))
    .sort((a,b)=>b.result.covered-a.result.covered||a.c.id.localeCompare(b.c.id));
  const best=choices[0]; if(!best||best.result.covered===0)return {covered:0,rule:null,contractId:null};
  const actual=applyCoverage(best.c,p.usage.get(best.c.id)!,type,circuit,gross);
  return {...actual,contractId:best.c.id};
}

// ------------------------------------------------------------------ estimates
const primaryOf = (siblings: readonly InstanceRow[]) => [...siblings].sort((a, b) => (a.series_day ?? 0) - (b.series_day ?? 0) || a.start_day - b.start_day)[0];
export function estimateUnit(home: Home, siblings: readonly InstanceRow[], contract: ContractRow | CoveragePortfolio | undefined, usage: CoverageUsage) {
  const primary = primaryOf(siblings);
  const profile = profileFor(primary);
  const feeGross = profile.fee.basis === "PER_SERIES" ? profile.fee.entryFeePence : profile.fee.entryFeePence * siblings.length;
  const start = Math.min(...siblings.map(e => e.start_day)), end = Math.max(...siblings.map(e => e.end_day));
  const band = travelBand(home, primary);
  const trip = tripCost(band, end - start + 1);
  const scratch = new Map(usage);
  const copy=clonePortfolio(contract);
  const fee = portfolioCoverage(copy, scratch, "ENTRY_FEE", primary.circuit, feeGross);
  const travel = portfolioCoverage(copy, scratch, "TRAVEL", primary.circuit, trip.travelPence);
  const accommodation = portfolioCoverage(copy, scratch, "ACCOMMODATION", primary.circuit, trip.accommodationPence);
  const tripPlayer = trip.travelPence - travel.covered + trip.accommodationPence - accommodation.covered;
  return { primary, profile, band, nights: trip.nights, entryFeeGrossPence: feeGross, entryFeeCoveredPence: fee.covered, entryFeePlayerPence: feeGross - fee.covered,
    travelGrossPence: trip.travelPence, travelCoveredPence: travel.covered, accommodationGrossPence: trip.accommodationPence, accommodationCoveredPence: accommodation.covered,
    estimatedTripPlayerPence: tripPlayer, estimatedPlayerCostPence: feeGross - fee.covered + tripPlayer };
}
/** Money promised to entered-but-not-yet-travelled events (conservative standalone estimates). */
export async function reservedPence(tx: CareerExecutor, saveId: string) {
  return Number((await tx.execute(sql`SELECT COALESCE(SUM(estimated_trip_pence), 0)::bigint AS r FROM career_event_finance WHERE career_save_id = ${saveId} AND status = 'ENTERED'`)).rows[0].r);
}

// ------------------------------------------------------------------ sporting facts (A3 facts + A3/A5 status provider)
/**
 * Best human finishing position per circuit, for sponsor `circuitFinish` requirements.
 * A6.5 fix (found by the grind validation): a QUALIFIER is an entry route into a circuit's
 * event, not a finish in that circuit. Reaching the final of the amateur Open Championship
 * Qualifier (circuit MAJOR) must not count as "top 2 at a Major", which unlocked the ELITE
 * sponsor (£50,000 signing bonus) for amateurs. Q-School is the exception: its qualifier
 * events ARE the circuit.
 */
export async function humanBestFinishByCircuit(tx: CareerExecutor, saveId: string): Promise<Record<string, number>> {
  return Object.fromEntries((await tx.execute(sql`SELECT i.circuit, MIN(r.finishing_position)::int AS best FROM career_event_results r
    JOIN career_event_instances i ON i.career_save_id = r.career_save_id AND i.id = r.event_id WHERE r.career_save_id = ${saveId} AND r.participant_key = ${HUMAN}
      AND (i.classification <> 'QUALIFIER' OR i.circuit = 'Q_SCHOOL') GROUP BY 1`)).rows.map(r => [String(r.circuit), Number(r.best)]));
}
export function defaultFactsProvider(calendarProviders: CalendarProviders): SponsorFactsProvider {
  return {
    id: "A4_DEFAULT_A3_RESULTS",
    async facts(tx, root) {
      const titles = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_event_results WHERE career_save_id = ${root.id} AND participant_key = ${HUMAN} AND is_champion`)).rows[0].n);
      const best = await humanBestFinishByCircuit(tx, root.id);
      const qualifications = (await tx.execute(sql`SELECT DISTINCT target_key FROM career_qualification_entitlements WHERE career_save_id = ${root.id} AND recipient_key = ${HUMAN}`)).rows.map(r => String(r.target_key));
      const status = calendarProviders.sportingStatus.human(root);
      const ranking = calendarProviders.sportingStatus.rankings(HUMAN)["pro-world"];
      return { careerStarted: true, titles, bestFinishByCircuit: best, qualifications,
        professionalStatus: status.professionalStatus, tourCard: status.tourCard, worldRanking: ranking ?? null };
    },
  };
}

// ------------------------------------------------------------------ sponsor offers / contracts
type OfferRow = { id: string; sponsor_key: string; tier: SponsorTier; kind: string; terms: SponsorTerms; status: string; expires_season: number; expires_week: number; offered_season: number; offered_week: number };
function contractEnd(terms: SponsorTerms, season: number) {
  return terms.duration.kind === "REMAINDER_OF_SEASON" ? { season, week: WEEKS } : { season: season + terms.duration.seasons - 1, week: WEEKS };
}
async function syncSponsorCache(tx: CareerExecutor, saveId: string) {
  const active = await activeContract(tx, saveId);
  await tx.execute(sql`UPDATE career_saves SET sponsor = ${active ? active.terms.displayName : null} WHERE id = ${saveId}`);
}
async function insertOffer(tx: CareerExecutor, root: RootRow, operationKey: string, kind: "NEW" | "RENEWAL", terms: SponsorTerms, source: Record<string, unknown>, season: number, week: number) {
  const expires = fromIndex(timeIndex(season, week) + OFFER_LIFETIME_WEEKS);
  const result = await tx.execute(sql`INSERT INTO career_sponsor_offers (career_save_id, id, operation_key, sponsor_key, sponsor_database_version, tier, kind, terms, source,
      offered_season, offered_week, expires_season, expires_week, status)
    VALUES (${root.id}, ${stableUuid(root.world_seed, SPONSOR_DATABASE_VERSION, "sponsor-offer", operationKey)}, ${operationKey}, ${terms.sponsorKey}, ${terms.sponsorDatabaseVersion},
      ${terms.tier}, ${kind}, ${JSON.stringify(terms)}::jsonb, ${JSON.stringify(source)}::jsonb, ${season}, ${week}, ${expires.season}, ${expires.week}, 'AVAILABLE')
    ON CONFLICT DO NOTHING RETURNING id`);
  return result.rows.length > 0;
}
/**
 * Deterministic, idempotent offer generation from factual inputs. No randomness:
 * every sponsor whose offer requirement is KNOWN-true, ranked above the current
 * contract, without an open offer and not declined/expired this season; highest
 * tier first, key order, at most MAX_OFFERS_PER_EVALUATION. Operation keys make
 * re-evaluation of the same trigger a no-op.
 */
export async function evaluateOffers(
  tx: CareerExecutor,
  root: RootRow,
  facts: SportingFacts,
  triggerKey: string,
  season: number,
  week: number,
  approachSource?: SponsorApproachSource,
) {
  const active = await activeContracts(tx, root.id);
  const version=(await tx.execute(sql`SELECT sponsor_database_version FROM career_finance_state WHERE career_save_id=${root.id}`)).rows[0];
  const offers = (await tx.execute(sql`SELECT sponsor_key, status, offered_season FROM career_sponsor_offers WHERE career_save_id = ${root.id}`)).rows;
  const blocked = new Set(offers.filter(o => o.status === "AVAILABLE" || (["DECLINED","EXPIRED","ACCEPTED","COUNTERED","WITHDRAWN"].includes(String(o.status)) && Number(o.offered_season) === season)).map(o => String(o.sponsor_key)));
  const candidates = sponsorCatalogue(Number(version?.sponsor_database_version??1))
    .filter(d => evaluateRequirement(d.offerRequirement, facts) === true)
    .filter(d => !active.some(c=>c.sponsor_key===d.key))
    .filter(d => !d.terms.geographicPreference || d.terms.geographicPreference===root.settings_snapshot?.homeLocality)
    .filter(d => {const replacing=conflicts(d.terms,active);return replacing.length>0 || active.length<portfolioLimit(facts);})
    .filter(d => !blocked.has(d.key))
    .sort((a, b) => tierRank(b.terms.tier) - tierRank(a.terms.tier) || (a.key < b.key ? -1 : 1))
    .slice(0, MAX_OFFERS_PER_EVALUATION);
  const created: string[] = [];
  for (const d of candidates) {
    const operationKey = `offer:${triggerKey}:${d.key}`;
    if (await insertOffer(tx, root, operationKey, "NEW", structuredClone(d.terms),
      { trigger: triggerKey, facts, requiresReplacement: conflicts(d.terms,active), ...(approachSource ? { approachSource } : {}) }, season, week)) {
      created.push(d.key);
      if (approachSource) {
        const offerId = (await tx.execute(sql`SELECT id FROM career_sponsor_offers WHERE career_save_id = ${root.id} AND operation_key = ${operationKey}`)).rows[0]?.id;
        if (offerId) await createSponsorJourney(tx, root, { offerId: String(offerId), operationKey: `journey:${offerId}`, terms: structuredClone(d.terms), source: approachSource });
      }
    }
  }
  return created;
}

/** Insert a negotiated revision through A4's authoritative offer table. */
export async function createSponsorOfferRevision(
  tx: CareerExecutor,
  root: RootRow,
  input: { currentOfferId: string; operationKey: string; terms: SponsorTerms; source: Record<string, unknown>; season: number; week: number },
) {
  const existing = (await tx.execute(sql`SELECT id, status FROM career_sponsor_offers
    WHERE career_save_id = ${root.id} AND operation_key = ${input.operationKey}`)).rows[0];
  if (existing) {
    if (existing.status !== "AVAILABLE") throw new CareerError(409, "This negotiated offer revision is no longer available");
    return String(existing.id);
  }
  const current = (await tx.execute(sql`SELECT * FROM career_sponsor_offers
    WHERE career_save_id = ${root.id} AND id = ${input.currentOfferId} FOR UPDATE`)).rows[0];
  if (!current) throw new CareerError(404, "Sponsor offer not found");
  if (current.status !== "AVAILABLE") throw new CareerError(409, "This sponsor offer is no longer available");
  if (current.sponsor_key !== input.terms.sponsorKey || Number(current.sponsor_database_version) !== input.terms.sponsorDatabaseVersion) {
    throw new CareerError(409, "Negotiated terms do not match the sponsor offer");
  }
  if (timeIndex(Number(current.expires_season), Number(current.expires_week)) < timeIndex(input.season, input.week)) {
    throw new CareerError(409, "Sponsor offer has expired");
  }
  const offerId = stableUuid(root.world_seed, Number(current.sponsor_database_version), "sponsor-offer", input.operationKey);
  await tx.execute(sql`UPDATE career_sponsor_offers SET status = 'COUNTERED', status_reason = 'NEGOTIATED_REVISION', resolved_at = NOW()
    WHERE career_save_id = ${root.id} AND id = ${input.currentOfferId} AND status = 'AVAILABLE'`);
  const inserted = await tx.execute(sql`INSERT INTO career_sponsor_offers
    (career_save_id, id, operation_key, sponsor_key, sponsor_database_version, tier, kind, terms, source,
     offered_season, offered_week, expires_season, expires_week, status)
    VALUES (${root.id}, ${offerId}, ${input.operationKey}, ${input.terms.sponsorKey}, ${input.terms.sponsorDatabaseVersion},
      ${input.terms.tier}, ${current.kind}, ${JSON.stringify(input.terms)}::jsonb, ${JSON.stringify(input.source)}::jsonb,
      ${input.season}, ${input.week}, ${current.expires_season}, ${current.expires_week}, 'AVAILABLE')
    ON CONFLICT DO NOTHING RETURNING id`);
  if (inserted.rows.length) return String(inserted.rows[0].id);
  const duplicate = (await tx.execute(sql`SELECT id, status FROM career_sponsor_offers
    WHERE career_save_id = ${root.id} AND operation_key = ${input.operationKey}`)).rows[0];
  if (duplicate?.status === "AVAILABLE") return String(duplicate.id);
  throw new CareerError(409, "Could not create the negotiated sponsor offer");
}

export async function acceptOffer(tx: CareerExecutor, root: RootRow, offerId: string, season: number, week: number,
  options:{replaceContractIds?:string[];facts?:SportingFacts}={}) {
  const rawOffer = (await tx.execute(sql`SELECT * FROM career_sponsor_offers WHERE career_save_id = ${root.id} AND id = ${offerId}`)).rows[0] as (Omit<OfferRow,"terms">&{terms:unknown}) | undefined;
  const offer:OfferRow|undefined=rawOffer?{...rawOffer,terms:parseSponsorTerms(rawOffer.terms)}:undefined;
  if (!offer) throw new CareerError(404, "Sponsor offer not found");
  if (offer.status === "ACCEPTED") {
    const existing = (await tx.execute(sql`SELECT * FROM career_sponsor_contracts WHERE career_save_id = ${root.id} AND offer_id = ${offerId}`)).rows[0] as ContractRow;
    return { contract: existing, created: false };
  }
  if (offer.status !== "AVAILABLE") throw new CareerError(409, `Sponsor offer is ${offer.status.toLowerCase()}`);
  if (timeIndex(offer.expires_season, offer.expires_week) < timeIndex(season, week)) {
    await tx.execute(sql`UPDATE career_sponsor_offers SET status = 'EXPIRED', status_reason = 'EXPIRED_BEFORE_ACCEPT', resolved_at = NOW() WHERE career_save_id = ${root.id} AND id = ${offerId}`);
    throw new CareerError(409, "Sponsor offer has expired");
  }
  const previous = await activeContracts(tx, root.id), replacements=new Set(options.replaceContractIds??[]);
  if ([...replacements].some(id=>!previous.some(c=>c.id===id)))throw new CareerError(409,"Replacement must name an active owned contract");
  const remaining=previous.filter(c=>!replacements.has(c.id)), incompatible=conflicts(offer.terms,remaining);
  if(incompatible.length)throw new CareerError(409,`Sponsor exclusivity/slot conflict; explicitly replace: ${incompatible.join(", ")}`);
  const facts=options.facts??{careerStarted:true,
    titles:Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_event_results WHERE career_save_id=${root.id} AND participant_key=${HUMAN} AND is_champion`)).rows[0].n),
    professionalStatus:root.has_tour_card?"PROFESSIONAL" as const:"AMATEUR" as const,
    tourCard:root.has_tour_card??null,worldRanking:null,bestFinishByCircuit:{},qualifications:[]};
  const definition=sponsorCatalogue(offer.terms.sponsorDatabaseVersion).find(d=>d.key===offer.sponsor_key);
  if(!definition||evaluateRequirement(offer.kind==="RENEWAL"?offer.terms.renewalRequirement:definition.offerRequirement,facts)!==true)
    throw new CareerError(409,"Current sporting facts no longer meet this sponsor offer");
  if(offer.terms.geographicPreference&&offer.terms.geographicPreference!==root.settings_snapshot?.homeLocality)
    throw new CareerError(409,"This local sponsor requires the matching home locality");
  if(remaining.length>=portfolioLimit(facts))throw new CareerError(409,"Sponsor portfolio is full for current sporting stature; explicitly replace an owned contract");
  for(const id of replacements)await tx.execute(sql`UPDATE career_sponsor_contracts SET status = 'TERMINATED', end_reason = 'EXPLICITLY_REPLACED', ended_at = NOW() WHERE career_save_id = ${root.id} AND id = ${id}`);
  const end = contractEnd(offer.terms, season);
  const contractId = stableUuid(root.world_seed, SPONSOR_DATABASE_VERSION, "sponsor-contract", offer.id);
  await tx.execute(sql`INSERT INTO career_sponsor_contracts (career_save_id, id, offer_id, sponsor_key, sponsor_database_version, tier, terms, start_season, start_week, end_season, end_week, status)
    VALUES (${root.id}, ${contractId}, ${offer.id}, ${offer.sponsor_key}, ${offer.terms.sponsorDatabaseVersion}, ${offer.tier}, ${JSON.stringify(offer.terms)}::jsonb, ${season}, ${week}, ${end.season}, ${end.week}, 'ACTIVE')`);
  await tx.execute(sql`UPDATE career_sponsor_offers SET status = 'ACCEPTED', resolved_at = NOW() WHERE career_save_id = ${root.id} AND id = ${offerId} AND status = 'AVAILABLE'`);
  // Other open offers stay open; a lower/equal-tier one can still be accepted to switch.
  if (offer.terms.signingBonusPence > 0) {
    await post(tx, root, { operationKey: `sponsor-signing:${contractId}`, category: "SPONSOR_SIGNING_BONUS", amountPence: offer.terms.signingBonusPence,
      reason: `${offer.terms.displayName} signing bonus`, season, week, contractId, detail: { sponsorKey: offer.sponsor_key, offerId } });
  }
  await syncSponsorCache(tx, root.id);
  return { contract: (await tx.execute(sql`SELECT * FROM career_sponsor_contracts WHERE career_save_id = ${root.id} AND id = ${contractId}`)).rows[0] as ContractRow, created: true };
}

export async function declineOffer(tx: CareerExecutor, root: RootRow, offerId: string, reason = "PLAYER_DECLINED") {
  const offer = (await tx.execute(sql`SELECT status FROM career_sponsor_offers WHERE career_save_id = ${root.id} AND id = ${offerId}`)).rows[0];
  if (!offer) throw new CareerError(404, "Sponsor offer not found");
  if (offer.status === "DECLINED") return { declined: true, created: false };
  if (offer.status !== "AVAILABLE") throw new CareerError(409, `Sponsor offer is ${String(offer.status).toLowerCase()}`);
  await tx.execute(sql`UPDATE career_sponsor_offers SET status = 'DECLINED', status_reason = ${reason}, resolved_at = NOW() WHERE career_save_id = ${root.id} AND id = ${offerId}`);
  return { declined: true, created: true };
}

export async function withdrawOffer(tx: CareerExecutor, root: RootRow, offerId: string, reason: string) {
  const offer = (await tx.execute(sql`SELECT status FROM career_sponsor_offers WHERE career_save_id = ${root.id} AND id = ${offerId}`)).rows[0];
  if (!offer) throw new CareerError(404, "Sponsor offer not found");
  if (offer.status === "WITHDRAWN") return { withdrawn: true, created: false };
  if (offer.status !== "AVAILABLE") throw new CareerError(409, `Sponsor offer is ${String(offer.status).toLowerCase()}`);
  await tx.execute(sql`UPDATE career_sponsor_offers SET status = 'WITHDRAWN', status_reason = ${reason}, resolved_at = NOW()
    WHERE career_save_id = ${root.id} AND id = ${offerId} AND status = 'AVAILABLE'`);
  return { withdrawn: true, created: true };
}

/** Offer expiry, contract end (renewal / loss) and season-start review. Idempotent per (season, week). */
export async function advanceSponsorLifecycle(tx: CareerExecutor, root: RootRow, facts: () => Promise<SportingFacts>, season: number, week: number) {
  const now = timeIndex(season, week);
  await tx.execute(sql`UPDATE career_sponsor_offers SET status = 'EXPIRED', status_reason = 'LAPSED', resolved_at = NOW()
    WHERE career_save_id = ${root.id} AND status = 'AVAILABLE' AND ((expires_season - 1) * 52 + expires_week) < ${now}`);
  await syncExpiredSponsorJourneys(tx, root);
  const portfolio = await activeContracts(tx, root.id);
  let known: SportingFacts | null = null;
  const getFacts = async () => known ??= await facts();
  for (const active of portfolio) {
  if (timeIndex(active.end_season, active.end_week) < now) {
    const renew = evaluateRequirement(active.terms.renewalRequirement, await getFacts());
    if (renew === true) {
      await tx.execute(sql`UPDATE career_sponsor_contracts SET status = 'COMPLETED', end_reason = 'TERM_COMPLETED', ended_at = NOW() WHERE career_save_id = ${root.id} AND id = ${active.id}`);
      const operationKey = `renewal:${active.id}`;
      if (await insertOffer(tx, root, operationKey, "RENEWAL", structuredClone(active.terms), { trigger: operationKey, previousContractId: active.id }, season, week)) {
        const offerId = (await tx.execute(sql`SELECT id FROM career_sponsor_offers WHERE career_save_id = ${root.id} AND operation_key = ${operationKey}`)).rows[0]?.id;
        if (offerId) await createSponsorJourney(tx, root, {
          offerId: String(offerId), operationKey: `journey:${offerId}`, terms: structuredClone(active.terms),
          source: { kind: "RENEWAL", previousContractId: active.id, season, week },
        });
      }
    } else {
      await tx.execute(sql`UPDATE career_sponsor_contracts SET status = 'EXPIRED', end_reason = ${renew === false ? "RENEWAL_REQUIREMENT_NOT_MET" : "RENEWAL_AUTHORITY_UNKNOWN"}, ended_at = NOW()
        WHERE career_save_id = ${root.id} AND id = ${active.id}`);
    }
  } else if (active && week === 1 && active.terms.retentionRequirement && evaluateRequirement(active.terms.retentionRequirement, await getFacts()) === false) {
    await tx.execute(sql`UPDATE career_sponsor_contracts SET status = 'TERMINATED', end_reason = 'RETENTION_REQUIREMENT_NOT_MET', ended_at = NOW() WHERE career_save_id = ${root.id} AND id = ${active.id}`);
  }
  }
  await syncSponsorCache(tx, root.id);
}

// ------------------------------------------------------------------ hooks (A3 → A4)
export function createFinanceHooks(calendarProviders: () => CalendarProviders, factsProvider: () => SponsorFactsProvider): CalendarFinanceHooks {
  const home = (root: RootRow): Home => { const h = calendarProviders().sportingStatus.human(root); return { locality: h.locality, country: h.country, zone: h.zone,
    travelVersion:root.event_database_version>=5&&root.settings_snapshot.travelVersion===2?2:1 }; };
  const siblingsOf = async (tx: CareerExecutor, root: RootRow, event: InstanceRow) =>
    event.series_key ? (await tx.execute(sql`SELECT * FROM career_event_instances WHERE career_save_id = ${root.id} AND season = ${event.season} AND series_key = ${event.series_key}`)).rows as InstanceRow[] : [event];

  async function preview(tx: CareerExecutor, root: RootRow, units: InstanceRow[][]) {
    const contract = await loadCoveragePortfolio(tx, root.id, Number(root.current_season));
    const usage:CoverageUsage = new Map();
    const balance = Number((await tx.execute(sql`SELECT balance_pence FROM career_saves WHERE id = ${root.id}`)).rows[0].balance_pence);
    const available = balance - await reservedPence(tx, root.id);
    return { available, balance, contract, estimates: units.map(u => estimateUnit(home(root), u, contract, usage)) };
  }

  return {
    async entryCheck(tx, root, event, siblings) {
      await ensureFinanceState(tx, root.id);
      const { available, estimates } = await preview(tx, root, [[...siblings]]);
      return estimates[0].estimatedPlayerCostPence > available ? ["INSUFFICIENT_FUNDS" as DenialReason] : [];
    },

    async onHumanEntry(tx, root, event, siblings) {
      await ensureFinanceState(tx, root.id);
      const { available, estimates } = await preview(tx, root, [[...siblings]]);
      const e = estimates[0];
      if (e.estimatedPlayerCostPence > available) throw new InsufficientFundsError(e.estimatedPlayerCostPence, available);
      const season = Number(root.current_season), week = Number(root.current_week);
      const attempts = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_finance_entries WHERE career_save_id = ${root.id} AND event_id = ${e.primary.id} AND category = 'ENTRY_FEE'`)).rows[0].n);
      const existing = (await tx.execute(sql`SELECT status FROM career_event_finance WHERE career_save_id = ${root.id} AND event_id = ${e.primary.id}`)).rows[0];
      if (existing && existing.status !== "WITHDRAWN") return; // idempotent: already entered and charged
      const contract = await loadCoveragePortfolio(tx, root.id, season);
      const cover = portfolioCoverage(contract, new Map(), "ENTRY_FEE", e.primary.circuit, e.entryFeeGrossPence);
      if (e.entryFeeGrossPence > 0) {
        await post(tx, root, { operationKey: `entry:${e.primary.id}:a${attempts + 1}`, category: "ENTRY_FEE", amountPence: -(e.entryFeeGrossPence - cover.covered),
          reason: `Entry fee — ${e.primary.name}`, season, week, eventId: e.primary.id, grossAmountPence: e.entryFeeGrossPence, sponsorCoveredPence: cover.covered,
          contractId: cover.covered > 0 ? cover.contractId : null, detail: { feeProfile: e.profile.fee.key, basis: e.profile.fee.basis, ...(cover.rule !== null ? { coverageRule: cover.rule } : {}) } });
      }
      const snapshot = { profile: e.profile, travelVersion:home(root).travelVersion, band: e.band, nights: e.nights, estimate: { travelGrossPence: e.travelGrossPence, accommodationGrossPence: e.accommodationGrossPence },
        seriesEventIds: siblings.map(s => s.id) };
      for (const target of siblings) {
        const isPrimary = target.id === e.primary.id;
        const gross = isPrimary ? e.entryFeeGrossPence : 0, covered = isPrimary ? cover.covered : 0;
        await tx.execute(sql`INSERT INTO career_event_finance (career_save_id, event_id, season, finance_version, status, snapshot, entry_fee_gross_pence, entry_fee_covered_pence,
            entry_fee_paid_pence, estimated_trip_pence, entered_season, entered_week)
          VALUES (${root.id}, ${target.id}, ${target.season}, ${FINANCE_VERSION}, 'ENTERED', ${JSON.stringify({ ...snapshot, primaryEventId: e.primary.id })}::jsonb, ${gross}, ${covered},
            ${gross - covered}, ${isPrimary ? e.estimatedTripPlayerPence : 0}, ${season}, ${week})
          ON CONFLICT (career_save_id, event_id) DO UPDATE SET status = 'ENTERED', snapshot = EXCLUDED.snapshot, entry_fee_gross_pence = EXCLUDED.entry_fee_gross_pence,
            entry_fee_covered_pence = EXCLUDED.entry_fee_covered_pence, entry_fee_paid_pence = EXCLUDED.entry_fee_paid_pence, estimated_trip_pence = EXCLUDED.estimated_trip_pence,
            trip_id = NULL, entered_season = EXCLUDED.entered_season, entered_week = EXCLUDED.entered_week, updated_at = NOW()`);
      }
    },

    async onHumanWithdraw(tx, root, targets, postLock) {
      for (const target of targets) {
        const row = (await tx.execute(sql`SELECT * FROM career_event_finance WHERE career_save_id = ${root.id} AND event_id = ${target.id}`)).rows[0];
        if (!row || row.status === "WITHDRAWN" || row.status === "CANCELLED" || row.status === "COMPLETED") continue;
        const policy = (row.snapshot as { profile: EventFinanceProfile }).profile.refund;
        const percent = postLock ? policy.lateWithdrawEntryPercent : policy.withdrawBeforeCloseEntryPercent;
        await refundEntry(tx, root, target.id, percent, postLock ? "LATE_WITHDRAWAL" : "WITHDRAWAL_BEFORE_CLOSE");
        // Travel already committed is not refunded (policy); uncommitted travel was never charged.
        await tx.execute(sql`UPDATE career_event_finance SET status = 'WITHDRAWN', estimated_trip_pence = 0, updated_at = NOW() WHERE career_save_id = ${root.id} AND event_id = ${target.id}`);
      }
    },

    async beforeWeek(tx, root, season, week) {
      await ensureFinanceState(tx, root.id);
      // Entered human events (still entered in A3) not yet travel-committed.
      const pending = (await tx.execute(sql`SELECT i.* FROM career_event_finance f JOIN career_event_instances i ON i.career_save_id = f.career_save_id AND i.id = f.event_id
        JOIN career_event_entries e ON e.career_save_id = f.career_save_id AND e.event_id = f.event_id AND e.participant_key = ${HUMAN} AND e.status <> 'WITHDRAWN'
        WHERE f.career_save_id = ${root.id} AND f.season = ${season} AND f.status = 'ENTERED' ORDER BY i.start_day, i.id`)).rows as InstanceRow[];
      if (!pending.length) return;
      const h = home(root);
      const firstDay = (week - 1) * 7 + 1, lastDay = week * 7;
      // Local events starting this week need no trip.
      for (const e of pending) if (e.start_day >= firstDay && e.start_day <= lastDay && travelBand(h, e) === "LOCAL") {
        await tx.execute(sql`UPDATE career_event_finance SET status = 'TRAVEL_COMMITTED', estimated_trip_pence = 0, updated_at = NOW() WHERE career_save_id = ${root.id} AND event_id = ${e.id}`);
      }
      for (const trip of groupTrips(h, pending)) {
        if (trip.start < firstDay || trip.start > lastDay) continue; // commits in the week its first event starts
        const first = trip.events[0];
        const tripKey = `s${season}:${first.id}`;
        const tripId = stableUuid(root.world_seed, FINANCE_VERSION, "trip", tripKey);
        const contract=await loadCoveragePortfolio(tx,root.id,season);
        const travel = portfolioCoverage(contract, new Map(), "TRAVEL", first.circuit, trip.travelPence);
        const stay = portfolioCoverage(contract, new Map(), "ACCOMMODATION", first.circuit, trip.accommodationPence);
        const playerCost = trip.travelPence - travel.covered + trip.accommodationPence - stay.covered;
        const balance = Number((await tx.execute(sql`SELECT balance_pence FROM career_saves WHERE id = ${root.id}`)).rows[0].balance_pence);
        if (playerCost > balance) {
          // Cannot travel (e.g. sponsor coverage lapsed): pre-lock withdrawal, no debt, no refund of a fee for a trip the player cannot make.
          for (const e of trip.events) {
            await tx.execute(sql`UPDATE career_event_entries SET status = 'WITHDRAWN', withdrawn_at = NOW() WHERE career_save_id = ${root.id} AND event_id = ${e.id} AND participant_key = ${HUMAN} AND status <> 'WITHDRAWN'`);
            await tx.execute(sql`DELETE FROM career_participant_bookings WHERE career_save_id = ${root.id} AND event_id = ${e.id} AND participant_key = ${HUMAN}`);
            await tx.execute(sql`UPDATE career_event_finance SET status = 'WITHDRAWN', estimated_trip_pence = 0, snapshot = snapshot || '{"withdrawnReason":"INSUFFICIENT_FUNDS_FOR_TRAVEL"}'::jsonb, updated_at = NOW()
              WHERE career_save_id = ${root.id} AND event_id = ${e.id}`);
          }
          continue;
        }
        await tx.execute(sql`INSERT INTO career_trips (career_save_id, id, season, trip_key, band, destination, start_day, end_day, nights, event_ids, travel_gross_pence, travel_covered_pence,
            accommodation_gross_pence, accommodation_covered_pence, committed_season, committed_week)
          VALUES (${root.id}, ${tripId}, ${season}, ${tripKey}, ${trip.band}, ${trip.destination}, ${trip.start}, ${trip.end}, ${trip.nights}, ${JSON.stringify(trip.events.map(e => e.id))}::jsonb,
            ${trip.travelPence}, ${travel.covered}, ${trip.accommodationPence}, ${stay.covered}, ${season}, ${week}) ON CONFLICT DO NOTHING`);
        if (trip.travelPence > 0) await post(tx, root, { operationKey: `travel:${tripKey}`, category: "TRAVEL", amountPence: -(trip.travelPence - travel.covered),
          reason: `Travel (${trip.band}) — ${trip.destination}`, season, week, eventId: first.id, tripId, grossAmountPence: trip.travelPence, sponsorCoveredPence: travel.covered,
          contractId: travel.covered > 0 ? travel.contractId : null, detail: { band: trip.band, events: trip.events.map(e => e.id), ...(travel.rule !== null ? { coverageRule: travel.rule } : {}) } });
        if (trip.accommodationPence > 0) await post(tx, root, { operationKey: `accommodation:${tripKey}`, category: "ACCOMMODATION", amountPence: -(trip.accommodationPence - stay.covered),
          reason: `Accommodation (${trip.nights} nights) — ${trip.destination}`, season, week, eventId: first.id, tripId, grossAmountPence: trip.accommodationPence, sponsorCoveredPence: stay.covered,
          contractId: stay.covered > 0 ? stay.contractId : null, detail: { band: trip.band, nights: trip.nights, ...(stay.rule !== null ? { coverageRule: stay.rule } : {}) } });
        for (const e of trip.events) await tx.execute(sql`UPDATE career_event_finance SET status = 'TRAVEL_COMMITTED', trip_id = ${tripId}, estimated_trip_pence = 0, updated_at = NOW()
          WHERE career_save_id = ${root.id} AND event_id = ${e.id}`);
      }
    },

    async onEventCancelled(tx, root, event, reason) {
      const row = (await tx.execute(sql`SELECT * FROM career_event_finance WHERE career_save_id = ${root.id} AND event_id = ${event.id}`)).rows[0];
      if (!row || !["ENTERED", "TRAVEL_COMMITTED"].includes(String(row.status))) return;
      const policy = (row.snapshot as { profile: EventFinanceProfile }).profile.refund;
      await refundEntry(tx, root, event.id, policy.cancelledEntryPercent, `EVENT_CANCELLED:${reason}`);
      if (row.trip_id && (policy.cancelledTravelPercent > 0 || policy.cancelledAccommodationPercent > 0)) await refundTrip(tx, root, String(row.trip_id), event.id, policy);
      await tx.execute(sql`UPDATE career_event_finance SET status = 'CANCELLED', estimated_trip_pence = 0, updated_at = NOW() WHERE career_save_id = ${root.id} AND event_id = ${event.id}`);
    },

    async onEventCompleted(tx, root, event, results) {
      await ensureFinanceState(tx, root.id);
      const profile = profileFor(event);
      await tx.execute(sql`INSERT INTO career_event_prize_tables (career_save_id, event_id, season, finance_version, prize_profile_key, classification, ranking_eligible, bands)
        VALUES (${root.id}, ${event.id}, ${event.season}, ${FINANCE_VERSION}, ${profile.prize.key}, ${event.classification}, ${profile.rankingEligible}, ${JSON.stringify(profile.prize.bands)}::jsonb)
        ON CONFLICT DO NOTHING`);
      const mine = results.find(r => r.participant_key === HUMAN);
      if (!mine) return;
      const season = Number(root.current_season), week = Number(root.current_week);
      const cash = prizeForPosition(profile.prize, mine.finishing_position);
      const ranking = profile.rankingEligible ? cash : 0;
      let ledgerId: string | null = null;
      if (cash > 0) ledgerId = (await post(tx, root, { operationKey: `prize:${event.id}`, category: "PRIZE", amountPence: cash, reason: `Prize money — ${event.name}`,
        season, week, eventId: event.id, detail: { finishingPosition: mine.finishing_position, prizeProfile: profile.prize.key, rankingEligiblePence: ranking } })).row.id;
      await tx.execute(sql`INSERT INTO career_prize_awards (career_save_id, event_id, participant_key, season, finishing_position, cash_award_pence, ranking_eligible_pence, classification, ledger_entry_id)
        VALUES (${root.id}, ${event.id}, ${HUMAN}, ${event.season}, ${mine.finishing_position}, ${cash}, ${ranking}, ${event.classification}, ${ledgerId}) ON CONFLICT DO NOTHING`);
      await tx.execute(sql`UPDATE career_event_finance SET status = 'COMPLETED', estimated_trip_pence = 0, updated_at = NOW() WHERE career_save_id = ${root.id} AND event_id = ${event.id} AND status IN ('ENTERED','TRAVEL_COMMITTED')`);
      const played = (await tx.execute(sql`SELECT status FROM career_event_entries WHERE career_save_id = ${root.id} AND event_id = ${event.id} AND participant_key = ${HUMAN}`)).rows[0];
      const portfolio = await activeContracts(tx, root.id);
      if (played && played.status !== "WITHDRAWN") for (const contract of portfolio) {
        const pay = contract.terms.eventPayment;
        if (pay && pay.circuits.includes(event.circuit)) {
          const paid = Number((await tx.execute(sql`SELECT COUNT(*)::int AS n FROM career_finance_entries WHERE career_save_id = ${root.id} AND contract_id = ${contract.id}
            AND category = 'SPONSOR_EVENT_PAYMENT' AND season = ${season}`)).rows[0].n);
          if (paid < pay.maxEventsPerSeason) await post(tx, root, { operationKey: `sponsor-event:${contract.id}:${event.id}`, category: "SPONSOR_EVENT_PAYMENT", amountPence: pay.amountPence,
            reason: `${contract.terms.displayName} event payment — ${event.name}`, season, week, eventId: event.id, contractId: contract.id });
        }
        for (const bonus of contract.terms.performanceBonuses) {
          if (mine.finishing_position > bonus.maxPosition || !bonus.classifications.includes(event.classification) || (bonus.circuits && !bonus.circuits.includes(event.circuit))) continue;
          await post(tx, root, { operationKey: `sponsor-bonus:${contract.id}:${event.id}:${bonus.key}`, category: "SPONSOR_PERFORMANCE_BONUS", amountPence: bonus.amountPence,
            reason: `${contract.terms.displayName} ${bonus.key} bonus — ${event.name}`, season, week, eventId: event.id, contractId: contract.id, detail: { bonusKey: bonus.key, finishingPosition: mine.finishing_position } });
        }
      }
      await evaluateOffers(tx, root, await factsProvider().facts(tx, root), `event:${event.id}`, season, week, {
        kind: "RESULT", eventId: event.id, eventName: event.name, circuit: event.circuit, season, week,
        finishingPosition: mine.finishing_position, isChampion: mine.is_champion,
      });
    },

    async onCalendarMoved(tx, root, season, week) {
      await ensureFinanceState(tx, root.id);
      await advanceSponsorLifecycle(tx, root, () => factsProvider().facts(tx, root), season, week);
    },

    async previews(tx, root, season, events) {
      await ensureFinanceState(tx, root.id);
      const out = new Map<string, { affordable: boolean } & Record<string, unknown>>();
      if (!events.length) return out;
      const seriesKeys = [...new Set(events.map(e => e.series_key).filter((k): k is string => !!k))];
      const series = seriesKeys.length ? (await tx.execute(sql`SELECT * FROM career_event_instances WHERE career_save_id = ${root.id} AND season = ${season}
        AND series_key IN (${sql.join(seriesKeys.map(k => sql`${k}`), sql`, `)})`)).rows as InstanceRow[] : [];
      const units = events.map(e => e.series_key ? series.filter(s => s.series_key === e.series_key) : [e]);
      const { available, balance, estimates } = await preview(tx, root, units);
      const committed = new Map((await tx.execute(sql`SELECT event_id, status, entry_fee_paid_pence, entry_fee_covered_pence, trip_id FROM career_event_finance WHERE career_save_id = ${root.id} AND season = ${season}`)).rows
        .map(r => [String(r.event_id), r]));
      events.forEach((event, i) => {
        const e = estimates[i];
        const c = committed.get(event.id);
        out.set(event.id, {
          affordable: e.estimatedPlayerCostPence <= available, currency: "GBP", travelBand: e.band, nights: e.nights,
          entryFeePence: e.entryFeeGrossPence, entryFeeBasis: e.profile.fee.basis, estimatedTravelPence: e.travelGrossPence, estimatedAccommodationPence: e.accommodationGrossPence,
          sponsorCoverage: { entryFeePence: e.entryFeeCoveredPence, travelPence: e.travelCoveredPence, accommodationPence: e.accommodationCoveredPence },
          estimatedPlayerCostPence: e.estimatedPlayerCostPence, balancePence: balance, availablePence: available,
          prizeProfile: e.profile.prize.key, topPrizePence: e.profile.prize.bands[0]?.amountPence ?? 0, rankingEligible: e.profile.rankingEligible,
          commitment: c ? { status: c.status, entryFeePaidPence: Number(c.entry_fee_paid_pence), entryFeeCoveredPence: Number(c.entry_fee_covered_pence), tripId: c.trip_id } : null,
        });
      });
      return out;
    },
  };
}

async function refundEntry(tx: CareerExecutor, root: RootRow, eventId: string, percent: number, reason: string) {
  // Only the current entry attempt (highest `entry:<event>:aN`) can be refunded; older attempts were settled when withdrawn.
  const charges = (await tx.execute(sql`SELECT * FROM career_finance_entries WHERE career_save_id = ${root.id} AND event_id = ${eventId} AND category = 'ENTRY_FEE'
    ORDER BY length(operation_key) DESC, operation_key DESC LIMIT 1`)).rows;
  for (const charge of charges) {
    const refunded = (await tx.execute(sql`SELECT 1 FROM career_finance_entries WHERE career_save_id = ${root.id} AND reverses_entry_id = ${charge.id}`)).rows.length;
    if (refunded) continue;
    const amount = Math.floor(-Number(charge.amount_pence) * percent / 100);
    if (amount <= 0) continue;
    await post(tx, root, { operationKey: `refund:entry:${charge.id}`, category: "REFUND", amountPence: amount, reason: `Entry refund (${percent}%) — ${reason}`,
      season: Number(root.current_season), week: Number(root.current_week), eventId, reversesEntryId: String(charge.id), detail: { percent, reason } });
  }
}
async function refundTrip(tx: CareerExecutor, root: RootRow, tripId: string, eventId: string, policy: RefundPolicy) {
  const trip = (await tx.execute(sql`SELECT * FROM career_trips WHERE career_save_id = ${root.id} AND id = ${tripId}`)).rows[0];
  const share = Math.max(1, (trip.event_ids as string[]).length);
  for (const [category, percent] of [["TRAVEL", policy.cancelledTravelPercent], ["ACCOMMODATION", policy.cancelledAccommodationPercent]] as const) {
    if (percent <= 0) continue;
    const charge = (await tx.execute(sql`SELECT * FROM career_finance_entries WHERE career_save_id = ${root.id} AND trip_id = ${tripId} AND category = ${category}`)).rows[0];
    if (!charge) continue;
    const amount = Math.floor(-Number(charge.amount_pence) / share * percent / 100);
    if (amount > 0) await post(tx, root, { operationKey: `refund:${category.toLowerCase()}:${tripId}:${eventId}`, category: "REFUND", amountPence: amount,
      reason: `${category} refund — event cancelled`, season: Number(root.current_season), week: Number(root.current_week), eventId, tripId, reversesEntryId: String(charge.id) });
  }
}
