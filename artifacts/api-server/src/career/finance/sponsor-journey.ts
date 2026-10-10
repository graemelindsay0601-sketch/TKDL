import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import type { RootRow } from "../calendar/engine.ts";
import { BRANDS } from "../content/brands.ts";
import { stableUuid } from "../world/random.ts";
import { SPONSOR_DATABASE_VERSION } from "./config.ts";
import type { Requirement, SponsorTerms, SportingFacts } from "./sponsors.catalogue.ts";

export type SponsorApproachSource =
  | { kind: "RESULT"; eventId: string; eventName: string; circuit: string; season: number; week: number; finishingPosition: number; isChampion: boolean; classification?: string }
  | { kind: "RENEWAL"; previousContractId: string; season: number; week: number }
  | { kind: "SPORTING_ELIGIBILITY"; triggerKey: string; season: number; week: number; facts: SportingFacts; offerRequirement: Requirement };

export type SponsorJourneyEventType =
  | "INTEREST" | "APPROACH" | "OFFER_RECEIVED" | "PLAYER_COUNTERED" | "SPONSOR_COUNTERED"
  | "SPONSOR_ACCEPTED_REQUEST" | "SPONSOR_REJECTED" | "SPONSOR_WITHDREW"
   | "PLAYER_DECLINED" | "PLAYER_WALKED_AWAY" | "SIGNED" | "OFFER_EXPIRED" | "FINANCIAL_PAYMENT" | "ACTIVITY_UPDATE";

export async function appendSponsorJourneyEvent(
  tx: CareerExecutor,
  root: RootRow,
  input: {
    journeyId: string;
    eventKey: string;
    eventType: SponsorJourneyEventType;
    offerId?: string | null;
    season?: number | null;
    week?: number | null;
    details?: Record<string, unknown>;
  },
) {
  const ordinal = Number((await tx.execute(sql`SELECT COALESCE(MAX(ordinal), 0) + 1 AS n
    FROM career_sponsor_journey_events WHERE career_save_id = ${root.id} AND journey_id = ${input.journeyId}`)).rows[0].n);
  await tx.execute(sql`INSERT INTO career_sponsor_journey_events
    (career_save_id, id, journey_id, ordinal, event_key, event_type, offer_id, season, week, details)
    VALUES (${root.id}, ${stableUuid(root.world_seed, SPONSOR_DATABASE_VERSION, "sponsor-journey-event", input.eventKey)},
      ${input.journeyId}, ${ordinal}, ${input.eventKey}, ${input.eventType}, ${input.offerId ?? null},
      ${input.season ?? Number(root.current_season)}, ${input.week ?? Number(root.current_week)}, ${JSON.stringify(input.details ?? {})}::jsonb)
    ON CONFLICT (career_save_id, event_key) DO NOTHING`);
}

/**
 * A standalone interest is advisory only: no A4 offer, contract or money is
 * created. Its source is a completed, recorded result and it is unique per
 * sponsor until a formal offer arrives.
 */
export async function createSponsorInterest(
  tx: CareerExecutor,
  root: RootRow,
  input: { terms: SponsorTerms; source: Extract<SponsorApproachSource, { kind: "RESULT" }> },
) {
  const brand = BRANDS.find(candidate => candidate.id === input.terms.sponsorKey);
  const operationKey = `interest:${input.terms.sponsorKey}:${input.source.eventId}`;
  const existing = (await tx.execute(sql`SELECT id FROM career_sponsor_journeys
    WHERE career_save_id = ${root.id} AND sponsor_key = ${input.terms.sponsorKey} AND status = 'INTEREST'
    ORDER BY created_at LIMIT 1 FOR UPDATE`)).rows[0];
  if (existing) return String(existing.id);

  const journeyId = stableUuid(root.world_seed, input.terms.sponsorDatabaseVersion,
    "sponsor-journey-interest", `${input.terms.sponsorKey}:${input.source.eventId}`);
  const source = {
    kind: "INTEREST",
    sponsorKey: input.terms.sponsorKey,
    displayName: input.terms.displayName,
    tier: input.terms.tier,
    category: input.terms.category ?? null,
    event: input.source,
  };
  const inserted = await tx.execute(sql`INSERT INTO career_sponsor_journeys
    (career_save_id, id, operation_key, sponsor_key, sponsor_database_version, opening_offer_id, current_offer_id,
     status, revision, negotiation_rounds, representative, brand_personality, source)
    VALUES (${root.id}, ${journeyId}, ${operationKey}, ${input.terms.sponsorKey}, ${input.terms.sponsorDatabaseVersion},
      NULL, NULL, 'INTEREST', 0, 0, NULL,
      ${brand?.personality ?? "Established commercial partner"}, ${JSON.stringify(source)}::jsonb)
    ON CONFLICT DO NOTHING RETURNING id`);
  if (!inserted.rows.length) {
    const concurrent = (await tx.execute(sql`SELECT id FROM career_sponsor_journeys
      WHERE career_save_id = ${root.id} AND sponsor_key = ${input.terms.sponsorKey} AND status = 'INTEREST'
      ORDER BY created_at LIMIT 1`)).rows[0];
    return concurrent ? String(concurrent.id) : null;
  }
  await appendSponsorJourneyEvent(tx, root, {
    journeyId,
    eventKey: `interest:${journeyId}`,
    eventType: "INTEREST",
    season: input.source.season,
    week: input.source.week,
    details: {
      headline: "A result drew sponsor interest",
      summary: `${input.terms.displayName} is monitoring your ${input.source.isChampion ? "win" : `${ordinal(input.source.finishingPosition)}-place finish`} at ${input.source.eventName}. This is interest, not a formal offer.`,
      source: input.source,
    },
  });
  return journeyId;
}

/**
 * Formal offers remain authoritative in A4. This creates only the truthful
 * approach/offer events; it promotes an earlier standalone interest when one
 * exists, but never invents an earlier interest event.
 */
export async function createSponsorJourney(
  tx: CareerExecutor,
  root: RootRow,
  input: { offerId: string; operationKey: string; terms: SponsorTerms; source: SponsorApproachSource },
) {
  const sameOffer = (await tx.execute(sql`SELECT id, status FROM career_sponsor_journeys
    WHERE career_save_id = ${root.id} AND (opening_offer_id = ${input.offerId} OR current_offer_id = ${input.offerId})
    LIMIT 1 FOR UPDATE`)).rows[0];
  if (sameOffer && sameOffer.status !== "INTEREST") return String(sameOffer.id);

  const priorInterest = sameOffer?.status === "INTEREST" ? sameOffer
    : (await tx.execute(sql`SELECT id FROM career_sponsor_journeys
        WHERE career_save_id = ${root.id} AND sponsor_key = ${input.terms.sponsorKey} AND status = 'INTEREST'
        ORDER BY created_at LIMIT 1 FOR UPDATE`)).rows[0];
  const journeyId = priorInterest
    ? String(priorInterest.id)
    : stableUuid(root.world_seed, input.terms.sponsorDatabaseVersion, "sponsor-journey", input.offerId);
  const brandPersonality = BRANDS.find(brand => brand.id === input.terms.sponsorKey)?.personality ?? "Established commercial partner";
  const persistedSource = {
    ...input.source,
    sponsor: {
      sponsorKey: input.terms.sponsorKey,
      displayName: input.terms.displayName,
      tier: input.terms.tier,
      category: input.terms.category ?? null,
    },
  };
  if (priorInterest) {
    await tx.execute(sql`UPDATE career_sponsor_journeys SET
        sponsor_database_version = ${input.terms.sponsorDatabaseVersion},
        opening_offer_id = ${input.offerId}, current_offer_id = ${input.offerId},
        status = 'OFFERED', representative = ${input.terms.representative ? JSON.stringify(input.terms.representative) : null}::jsonb,
        source = source || ${JSON.stringify({ formalOffer: persistedSource })}::jsonb, updated_at = NOW()
      WHERE career_save_id = ${root.id} AND id = ${journeyId} AND status = 'INTEREST'`);
  } else {
    await tx.execute(sql`INSERT INTO career_sponsor_journeys
      (career_save_id, id, operation_key, sponsor_key, sponsor_database_version, opening_offer_id, current_offer_id,
       status, revision, negotiation_rounds, representative, brand_personality, source)
      VALUES (${root.id}, ${journeyId}, ${input.operationKey}, ${input.terms.sponsorKey}, ${input.terms.sponsorDatabaseVersion},
        ${input.offerId}, ${input.offerId}, 'OFFERED', 0, 0, ${input.terms.representative ? JSON.stringify(input.terms.representative) : null}::jsonb,
        ${brandPersonality}, ${JSON.stringify(persistedSource)}::jsonb)
      ON CONFLICT (career_save_id, operation_key) DO NOTHING`);
  }

  const result = input.source.kind === "RESULT" ? input.source : null;
  const summary = result
    ? result.isChampion
      ? `Your win at ${result.eventName} meets ${input.terms.displayName}'s recorded criteria for a formal offer.`
      : `Your ${ordinal(result.finishingPosition)}-place finish at ${result.eventName} meets ${input.terms.displayName}'s recorded criteria for a formal offer.`
    : input.source.kind === "RENEWAL"
      ? `Your existing partnership has reached its renewal review and the sporting criteria are met.`
      : `Your recorded sporting eligibility meets ${input.terms.displayName}'s criteria for a formal offer.`;
  const introduction = approachIntroduction(input.terms.tier, input.source);
  const contact = input.terms.representative
    ? { name: input.terms.representative.displayName, role: input.terms.representative.role, representativeId: input.terms.representative.id }
    : { name: `${input.terms.displayName} partnership team`, role: "Partnership contact", representativeId: null };

  if (priorInterest) {
    await appendSponsorJourneyEvent(tx, root, {
      journeyId, eventKey: `approach:${input.offerId}`, eventType: "APPROACH", offerId: input.offerId,
      season: input.source.season, week: input.source.week,
      details: { headline: "Sponsor contact", contact, summary, introduction, source: persistedSource },
    });
  }
  await appendSponsorJourneyEvent(tx, root, {
    journeyId, eventKey: `offer:${input.offerId}`, eventType: "OFFER_RECEIVED", offerId: input.offerId,
    season: input.source.season, week: input.source.week,
    details: {
      headline: "A formal offer is ready",
      summary: "Review the actual A4 terms before deciding.",
      introduction, contact, source: persistedSource,
    },
  });
  return journeyId;
}

export async function syncExpiredSponsorJourneys(tx: CareerExecutor, root: RootRow, season?: number, week?: number) {
  const rows = (await tx.execute(sql`SELECT j.id AS journey_id, j.current_offer_id
    FROM career_sponsor_journeys j
    JOIN career_sponsor_offers o ON o.career_save_id = j.career_save_id AND o.id = j.current_offer_id
    WHERE j.career_save_id = ${root.id} AND j.status IN ('OFFERED','NEGOTIATING') AND o.status = 'EXPIRED'`)).rows;
  for (const row of rows) {
    await tx.execute(sql`UPDATE career_sponsor_journeys SET status = 'EXPIRED', updated_at = NOW()
      WHERE career_save_id = ${root.id} AND id = ${row.journey_id} AND status IN ('OFFERED','NEGOTIATING')`);
    await appendSponsorJourneyEvent(tx, root, {
      journeyId: String(row.journey_id), eventKey: `expired:${row.current_offer_id}`, eventType: "OFFER_EXPIRED",
      offerId: String(row.current_offer_id), season, week,
      details: { headline: "Offer expired", summary: "The response window closed before the offer was accepted." },
    });
  }
}

function ordinal(position: number) {
  const mod100 = position % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${position}th`;
  switch (position % 10) {
    case 1: return `${position}st`;
    case 2: return `${position}nd`;
    case 3: return `${position}rd`;
    default: return `${position}th`;
  }
}

function approachIntroduction(tier: SponsorTerms["tier"], source: SponsorApproachSource) {
  if (source.kind === "RENEWAL") {
    return "Your current partnership has reached its renewal review. We would like to discuss whether a new term makes sense.";
  }
  if (source.kind === "SPORTING_ELIGIBILITY") {
    return "Your recorded sporting profile meets our published partnership criteria. We would like to discuss the offer shown in your Career finances.";
  }
  const result = source;
  const finish = result.isChampion ? "your win" : `your ${ordinal(result.finishingPosition)}-place finish`;
  switch (tier) {
    case "LOCAL":
      return `We like backing players who are building their name one result at a time. ${finish} at ${result.eventName} caught our attention, and we would like to talk about practical support.`;
    case "REGIONAL":
      return `${finish} at ${result.eventName} shows the kind of progress our regional programme is built to support. We would like to discuss a partnership for your next stage.`;
    case "PROFESSIONAL":
      return `${finish} at ${result.eventName} is a strong result. Our team would like to explore a partnership with clear support and room to grow.`;
    case "ELITE":
      return `${finish} at ${result.eventName} merits serious attention. We would like to discuss whether our top-level partnership is the right fit.`;
  }
}
