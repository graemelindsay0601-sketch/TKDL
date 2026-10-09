import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import type { RootRow } from "../calendar/engine.ts";
import { BRANDS } from "../content/brands.ts";
import { stableUuid } from "../world/random.ts";
import { SPONSOR_DATABASE_VERSION } from "./config.ts";
import type { SponsorTerms } from "./sponsors.catalogue.ts";

export type SponsorApproachSource =
  | { kind: "RESULT"; eventId: string; eventName: string; circuit: string; season: number; week: number; finishingPosition: number; isChampion: boolean }
  | { kind: "RENEWAL"; previousContractId: string; season: number; week: number };

export type SponsorJourneyEventType =
  | "INTEREST" | "APPROACH" | "OFFER_RECEIVED" | "PLAYER_COUNTERED" | "SPONSOR_COUNTERED"
  | "SPONSOR_ACCEPTED_REQUEST" | "SPONSOR_REJECTED" | "SPONSOR_WITHDREW"
  | "PLAYER_WALKED_AWAY" | "SIGNED" | "OFFER_EXPIRED";

export async function appendSponsorJourneyEvent(
  tx: CareerExecutor,
  root: RootRow,
  input: { journeyId: string; eventKey: string; eventType: SponsorJourneyEventType; offerId?: string | null; details?: Record<string, unknown> },
) {
  const ordinal = Number((await tx.execute(sql`SELECT COALESCE(MAX(ordinal), 0) + 1 AS n
    FROM career_sponsor_journey_events WHERE career_save_id = ${root.id} AND journey_id = ${input.journeyId}`)).rows[0].n);
  await tx.execute(sql`INSERT INTO career_sponsor_journey_events
    (career_save_id, id, journey_id, ordinal, event_key, event_type, offer_id, details)
    VALUES (${root.id}, ${stableUuid(root.world_seed, SPONSOR_DATABASE_VERSION, "sponsor-journey-event", input.eventKey)},
      ${input.journeyId}, ${ordinal}, ${input.eventKey}, ${input.eventType}, ${input.offerId ?? null}, ${JSON.stringify(input.details ?? {})}::jsonb)
    ON CONFLICT (career_save_id, event_key) DO NOTHING`);
}

/**
 * Create a durable SP-B journey only when an authoritative A4 offer exists.
 * Contact identity is copied from the SP-A/A4 term snapshot; no representative
 * is invented when that content has no identity.
 */
export async function createSponsorJourney(
  tx: CareerExecutor,
  root: RootRow,
  input: { offerId: string; operationKey: string; terms: SponsorTerms; source: SponsorApproachSource },
) {
  const journeyId = stableUuid(root.world_seed, input.terms.sponsorDatabaseVersion, "sponsor-journey", input.offerId);
  const brandPersonality = BRANDS.find(brand => brand.id === input.terms.sponsorKey)?.personality ?? "Established commercial partner";
  await tx.execute(sql`INSERT INTO career_sponsor_journeys
    (career_save_id, id, operation_key, sponsor_key, sponsor_database_version, opening_offer_id, current_offer_id,
     status, revision, negotiation_rounds, representative, brand_personality, source)
    VALUES (${root.id}, ${journeyId}, ${input.operationKey}, ${input.terms.sponsorKey}, ${input.terms.sponsorDatabaseVersion},
      ${input.offerId}, ${input.offerId}, 'OFFERED', 0, 0, ${input.terms.representative ? JSON.stringify(input.terms.representative) : null}::jsonb,
      ${brandPersonality}, ${JSON.stringify(input.source)}::jsonb)
    ON CONFLICT (career_save_id, operation_key) DO NOTHING`);

  const result = input.source.kind === "RESULT" ? input.source : null;
  const summary = result
    ? result.isChampion
      ? `Your win at ${result.eventName} put you on ${input.terms.displayName}'s radar.`
      : `Your ${ordinal(result.finishingPosition)}-place finish at ${result.eventName} put you on ${input.terms.displayName}'s radar.`
    : `Your existing partnership has reached its renewal review and the sporting criteria are met.`;
  const introduction = approachIntroduction(input.terms.tier, result);
  const contact = input.terms.representative
    ? { name: input.terms.representative.displayName, role: input.terms.representative.role, representativeId: input.terms.representative.id }
    : { name: `${input.terms.displayName} partnership team`, role: "Partnership contact", representativeId: null };

  await appendSponsorJourneyEvent(tx, root, {
    journeyId, eventKey: `interest:${input.offerId}`, eventType: "INTEREST", offerId: input.offerId,
    details: { headline: "A sporting result drew interest", summary, source: input.source },
  });
  await appendSponsorJourneyEvent(tx, root, {
    journeyId, eventKey: `approach:${input.offerId}`, eventType: "APPROACH", offerId: input.offerId,
    details: { headline: "Sponsor contact", contact, summary, introduction },
  });
  await appendSponsorJourneyEvent(tx, root, {
    journeyId, eventKey: `offer:${input.offerId}`, eventType: "OFFER_RECEIVED", offerId: input.offerId,
    details: { headline: "A formal offer is ready", summary: "Review the actual A4 terms before deciding." },
  });
  return journeyId;
}

export async function syncExpiredSponsorJourneys(tx: CareerExecutor, root: RootRow) {
  const rows = (await tx.execute(sql`SELECT j.id AS journey_id, j.current_offer_id
    FROM career_sponsor_journeys j
    JOIN career_sponsor_offers o ON o.career_save_id = j.career_save_id AND o.id = j.current_offer_id
    WHERE j.career_save_id = ${root.id} AND j.status IN ('OFFERED','NEGOTIATING') AND o.status = 'EXPIRED'`)).rows;
  for (const row of rows) {
    await tx.execute(sql`UPDATE career_sponsor_journeys SET status = 'EXPIRED', updated_at = NOW()
      WHERE career_save_id = ${root.id} AND id = ${row.journey_id} AND status IN ('OFFERED','NEGOTIATING')`);
    await appendSponsorJourneyEvent(tx, root, {
      journeyId: String(row.journey_id), eventKey: `expired:${row.current_offer_id}`, eventType: "OFFER_EXPIRED",
      offerId: String(row.current_offer_id), details: { headline: "Offer expired", summary: "The response window closed before the offer was accepted." },
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

function approachIntroduction(tier: SponsorTerms["tier"], result: Extract<SponsorApproachSource, { kind: "RESULT" }> | null) {
  if (!result) {
    return "Your partnership has reached its review point and the sporting criteria are met. We would like to discuss whether a new term makes sense.";
  }
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
