import { sql } from "drizzle-orm";
import { z } from "zod";
import { CareerError } from "../service.ts";
import type { CareerExecutor } from "../database.ts";
import type { RootRow } from "../calendar/engine.ts";
import { stableUuid } from "../world/random.ts";
import { SPONSOR_DATABASE_VERSION } from "./config.ts";
import { createSponsorOfferRevision, declineOffer, withdrawOffer } from "./engine.ts";
import { appendSponsorJourneyEvent } from "./sponsor-journey.ts";
import { parseSponsorTerms, type SponsorTerms, type SponsorTier } from "./sponsors.catalogue.ts";

const penceSchema = z.number().int().min(0).max(2_000_000_000);
const negotiationChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SIGNING_BONUS"), amountPence: penceSchema }).strict(),
  z.object({ kind: z.literal("EVENT_PAYMENT"), amountPence: penceSchema }).strict(),
  z.object({ kind: z.literal("COVERAGE_PERCENT"), index: z.number().int().min(0).max(31), percent: z.number().int().min(0).max(100) }).strict(),
  z.object({ kind: z.literal("DURATION"), seasons: z.number().int().min(1).max(5) }).strict(),
  z.object({ kind: z.literal("PERFORMANCE_BONUS"), key: z.string().min(1).max(80), amountPence: penceSchema }).strict(),
]);
export const sponsorNegotiationSchema = z.object({
  requestKey: z.string().min(8).max(80).regex(/^[A-Za-z0-9:_-]+$/),
  expectedRevision: z.number().int().min(0).max(10),
  change: negotiationChangeSchema,
}).strict();

const MAX_ROUNDS = 2;
type NegotiationChange = z.infer<typeof negotiationChangeSchema>;
type SponsorNegotiationInput = z.infer<typeof sponsorNegotiationSchema>;
type SponsorNegotiationResult = {
  outcome: "ACCEPTED" | "COUNTERED" | "REJECTED" | "WITHDRAWN";
  round: number;
  maxRounds: number;
  revision: number;
  offerId: string | null;
  message: string;
  replayed?: boolean;
};

/**
 * One request can change one term only. The server builds a validated A4 snapshot,
 * applies tier/personality response limits, and records the result transactionally.
 */
export async function negotiateSponsorOffer(
  tx: CareerExecutor,
  root: RootRow,
  offerId: string,
  body: unknown,
): Promise<SponsorNegotiationResult> {
  const input = sponsorNegotiationSchema.parse(body);
  const request = { offerId, expectedRevision: input.expectedRevision, change: input.change };
  const previous = (await tx.execute(sql`SELECT request, response FROM career_sponsor_negotiations
    WHERE career_save_id = ${root.id} AND request_key = ${input.requestKey}`)).rows[0];
  if (previous) {
    if (canonical(previous.request) !== canonical(request)) throw new CareerError(409, "This request key was already used for a different negotiation");
    return { ...(previous.response as SponsorNegotiationResult), replayed: true };
  }

  const journey = (await tx.execute(sql`SELECT * FROM career_sponsor_journeys
    WHERE career_save_id = ${root.id} AND current_offer_id = ${offerId} FOR UPDATE`)).rows[0];
  if (!journey) throw new CareerError(409, "This offer does not have an active negotiation journey");
  if (!["OFFERED", "NEGOTIATING"].includes(String(journey.status))) throw new CareerError(409, "This sponsor journey is no longer open");
  if (Number(journey.revision) !== input.expectedRevision) throw new CareerError(409, "This offer changed; reload it before negotiating");
  const round = Number(journey.negotiation_rounds) + 1;
  if (round > MAX_ROUNDS) throw new CareerError(409, "The sponsor has reached its negotiation limit");

  const rawOffer = (await tx.execute(sql`SELECT * FROM career_sponsor_offers
    WHERE career_save_id = ${root.id} AND id = ${offerId} FOR UPDATE`)).rows[0] as Record<string, unknown> | undefined;
  if (!rawOffer || rawOffer.status !== "AVAILABLE") throw new CareerError(409, "This sponsor offer is no longer available");
  const originalTerms = parseSponsorTerms(rawOffer.terms);
  const proposedTerms = applyChange(originalTerms, input.change);
  const pressure = askPressure(originalTerms, proposedTerms, input.change);
  const profile = responseProfile(originalTerms.tier, String(journey.brand_personality));
  let outcome: SponsorNegotiationResult["outcome"];
  let resultingTerms: SponsorTerms | null = null;
  let message: string;

  if (pressure <= profile.accept || pressure <= 0) {
    outcome = "ACCEPTED";
    resultingTerms = proposedTerms;
    message = "The sponsor accepts the requested change. Review the revised terms before signing.";
  } else if (pressure <= profile.ceiling && round < MAX_ROUNDS) {
    const counter = applyChange(originalTerms, input.change, counterValue(originalTerms, input.change, proposedTerms), true);
    if (sameTerms(counter, originalTerms) || sameTerms(counter, proposedTerms)) {
      outcome = "REJECTED";
      message = "The sponsor cannot make a useful counter on this term and has closed the negotiation.";
    } else {
      outcome = "COUNTERED";
      resultingTerms = counter;
      message = "The sponsor has made a counter-offer. Review its updated terms.";
    }
  } else if (pressure > profile.ceiling * 1.75) {
    outcome = "WITHDRAWN";
    message = "The requested change is outside the sponsor's terms, so it has withdrawn the offer.";
  } else {
    outcome = "REJECTED";
    message = "The requested change is outside the sponsor's negotiation range; the offer has been closed.";
  }

  let responseOfferId: string | null = null;
  let nextRevision = Number(journey.revision);
  if (resultingTerms) {
    const operationKey = `negotiation:${journey.id}:${round}:${input.requestKey}`;
    responseOfferId = await createSponsorOfferRevision(tx, root, {
      currentOfferId: offerId, operationKey, terms: resultingTerms,
      source: { trigger: "SPB_NEGOTIATION", journeyId: journey.id, previousOfferId: offerId, round, outcome },
      season: Number(root.current_season), week: Number(root.current_week),
    });
    nextRevision += 1;
  } else if (outcome === "WITHDRAWN") {
    await withdrawOffer(tx, root, offerId, "SPONSOR_WITHDREW_AFTER_NEGOTIATION");
  } else {
    await declineOffer(tx, root, offerId, "SPONSOR_REJECTED_NEGOTIATION");
  }

  const nextStatus = outcome === "COUNTERED" ? "NEGOTIATING" : outcome === "ACCEPTED" ? "OFFERED" : outcome;
  if (responseOfferId) {
    await tx.execute(sql`UPDATE career_sponsor_journeys SET current_offer_id = ${responseOfferId}, revision = ${nextRevision},
      negotiation_rounds = ${round}, status = ${nextStatus}, updated_at = NOW()
      WHERE career_save_id = ${root.id} AND id = ${journey.id}`);
  } else {
    await tx.execute(sql`UPDATE career_sponsor_journeys SET negotiation_rounds = ${round}, status = ${nextStatus}, updated_at = NOW()
      WHERE career_save_id = ${root.id} AND id = ${journey.id}`);
  }

  await appendSponsorJourneyEvent(tx, root, {
    journeyId: String(journey.id), eventKey: `player-counter:${journey.id}:${input.requestKey}`,
    eventType: "PLAYER_COUNTERED", offerId, details: { round, change: input.change },
  });
  const responseType = outcome === "ACCEPTED" ? "SPONSOR_ACCEPTED_REQUEST"
    : outcome === "COUNTERED" ? "SPONSOR_COUNTERED"
    : outcome === "REJECTED" ? "SPONSOR_REJECTED" : "SPONSOR_WITHDREW";
  await appendSponsorJourneyEvent(tx, root, {
    journeyId: String(journey.id), eventKey: `sponsor-response:${journey.id}:${input.requestKey}`,
    eventType: responseType, offerId: responseOfferId ?? offerId, details: { round, message, outcome, change: input.change },
  });

  const result: SponsorNegotiationResult = {
    outcome, round, maxRounds: MAX_ROUNDS, revision: nextRevision, offerId: responseOfferId, message,
  };
  await tx.execute(sql`INSERT INTO career_sponsor_negotiations
    (career_save_id, id, journey_id, request_key, round, source_offer_id, response_offer_id, request, outcome, response)
    VALUES (${root.id}, ${stableUuid(root.world_seed, SPONSOR_DATABASE_VERSION, "sponsor-negotiation", input.requestKey)},
      ${journey.id}, ${input.requestKey}, ${round}, ${offerId}, ${responseOfferId},
      ${JSON.stringify(request)}::jsonb, ${outcome}, ${JSON.stringify(result)}::jsonb)`);
  return result;
}

function applyChange(terms: SponsorTerms, change: NegotiationChange, override?: number, allowSame = false): SponsorTerms {
  const copy = structuredClone(terms);
  switch (change.kind) {
    case "SIGNING_BONUS":
      copy.signingBonusPence = override ?? change.amountPence;
      break;
    case "EVENT_PAYMENT":
      if (!copy.eventPayment) throw new CareerError(400, "This offer has no event payment to negotiate");
      copy.eventPayment.amountPence = override ?? change.amountPence;
      break;
    case "COVERAGE_PERCENT":
      if (!copy.coverage[change.index]) throw new CareerError(400, "That cost-coverage term is not part of this offer");
      copy.coverage[change.index].percent = override ?? change.percent;
      break;
    case "DURATION":
      copy.duration = { kind: "SEASONS", seasons: override ?? change.seasons };
      break;
    case "PERFORMANCE_BONUS": {
      const bonus = copy.performanceBonuses.find(item => item.key === change.key);
      if (!bonus) throw new CareerError(400, "That performance bonus is not part of this offer");
      bonus.amountPence = override ?? change.amountPence;
      break;
    }
  }
  if (!allowSame && sameTerms(copy, terms)) throw new CareerError(400, "Choose a different value for the term you want to negotiate");
  return parseSponsorTerms(copy);
}

function askPressure(before: SponsorTerms, after: SponsorTerms, change: NegotiationChange) {
  switch (change.kind) {
    case "SIGNING_BONUS":
      return (after.signingBonusPence - before.signingBonusPence) / Math.max(before.signingBonusPence, 50_000);
    case "EVENT_PAYMENT":
      return (Number(after.eventPayment?.amountPence ?? 0) - Number(before.eventPayment?.amountPence ?? 0))
        / Math.max(Number(before.eventPayment?.amountPence ?? 0), 10_000);
    case "COVERAGE_PERCENT":
      return (after.coverage[change.index].percent - before.coverage[change.index].percent) / 100;
    case "DURATION":
      return ((after.duration.kind === "SEASONS" ? after.duration.seasons : 1)
        - (before.duration.kind === "SEASONS" ? before.duration.seasons : 1)) * 0.18;
    case "PERFORMANCE_BONUS": {
      const old = before.performanceBonuses.find(item => item.key === change.key)?.amountPence ?? 0;
      const next = after.performanceBonuses.find(item => item.key === change.key)?.amountPence ?? old;
      return (next - old) / Math.max(old, 10_000);
    }
  }
}

function responseProfile(tier: SponsorTier, personality: string) {
  const base = {
    LOCAL: { accept: 0.12, ceiling: 0.38 },
    REGIONAL: { accept: 0.16, ceiling: 0.48 },
    PROFESSIONAL: { accept: 0.20, ceiling: 0.58 },
    ELITE: { accept: 0.24, ceiling: 0.68 },
  }[tier];
  const tone = personality.toLowerCase();
  const collaborative = /community|loyal|practical|independent|support|relationship|local/.test(tone) ? 0.04 : 0;
  const prestigeFocused = /premium|prestige|elite|global|performance/.test(tone) ? 0.03 : 0;
  return {
    accept: Math.min(0.3, base.accept + collaborative - prestigeFocused),
    ceiling: Math.min(0.8, base.ceiling + collaborative - prestigeFocused),
  };
}

function counterValue(before: SponsorTerms, change: NegotiationChange, after: SponsorTerms) {
  switch (change.kind) {
    case "SIGNING_BONUS": return midpoint(before.signingBonusPence, after.signingBonusPence, 100);
    case "EVENT_PAYMENT": return midpoint(Number(before.eventPayment?.amountPence ?? 0), Number(after.eventPayment?.amountPence ?? 0), 100);
    case "COVERAGE_PERCENT": return Math.round((before.coverage[change.index].percent + after.coverage[change.index].percent) / 2);
    case "DURATION": {
      const current = before.duration.kind === "SEASONS" ? before.duration.seasons : 1;
      const next = after.duration.kind === "SEASONS" ? after.duration.seasons : current;
      return current + Math.floor((next - current) / 2);
    }
    case "PERFORMANCE_BONUS": {
      const current = before.performanceBonuses.find(item => item.key === change.key)?.amountPence ?? 0;
      const next = after.performanceBonuses.find(item => item.key === change.key)?.amountPence ?? current;
      return midpoint(current, next, 100);
    }
  }
}

function midpoint(before: number, after: number, increment: number) {
  const raw = (before + after) / 2;
  return Math.round(raw / increment) * increment;
}

function sameTerms(left: SponsorTerms, right: SponsorTerms) {
  return canonical(left) === canonical(right);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
