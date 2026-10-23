import { sql } from "drizzle-orm";
import { z } from "zod";
import { CareerError } from "../service.ts";
import type { CareerExecutor } from "../database.ts";
import type { RootRow } from "../calendar/engine.ts";
import { stableUuid } from "../world/random.ts";
import { SPONSOR_DATABASE_VERSION } from "./config.ts";
import { createSponsorOfferRevision, declineOffer, timeIndex, withdrawOffer } from "./engine.ts";
import { appendSponsorJourneyEvent } from "./sponsor-journey.ts";
import { parseSponsorTerms, type SponsorTerms, type SponsorTier } from "./sponsors.catalogue.ts";

const penceSchema = z.number().int().min(0).max(2_000_000_000);
const positivePenceSchema = z.number().int().min(1).max(2_000_000_000);
const negotiationChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("SIGNING_BONUS"), amountPence: penceSchema }).strict(),
  z.object({ kind: z.literal("EVENT_PAYMENT"), amountPence: penceSchema }).strict(),
  z.object({ kind: z.literal("COVERAGE_PERCENT"), index: z.number().int().min(0).max(31), percent: z.number().int().min(1).max(100) }).strict(),
  z.object({ kind: z.literal("DURATION"), seasons: z.number().int().min(1).max(5) }).strict(),
  z.object({ kind: z.literal("PERFORMANCE_BONUS"), key: z.string().min(1).max(80), amountPence: positivePenceSchema }).strict(),
]);
export const sponsorNegotiationSchema = z.object({
  // Older clients sent the offer ID in the body as well as in the URL. Accept
  // that shape for compatibility, then verify it matches the route parameter.
  offerId: z.string().uuid().optional(),
  requestKey: z.string().min(8).max(80).regex(/^[A-Za-z0-9:_-]+$/),
  expectedRevision: z.number().int().min(0).max(10),
  change: negotiationChangeSchema.optional(),
  changes: z.array(negotiationChangeSchema).min(1).max(3).optional(),
}).strict().superRefine((value, context) => {
  if (!!value.change === !!value.changes) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Send either one legacy change or a package of changes" });
  }
  const changes = value.changes ?? (value.change ? [value.change] : []);
  const keys = changes.map(changeKey);
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A negotiation package cannot change the same term twice" });
  }
});

const MAX_ROUNDS = 4;
type NegotiationChange = z.infer<typeof negotiationChangeSchema>;
type SponsorNegotiationInput = z.infer<typeof sponsorNegotiationSchema>;
type SponsorNegotiationResult = {
  outcome: "ACCEPTED" | "COUNTERED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
  round: number;
  maxRounds: number;
  revision: number;
  offerId: string | null;
  message: string;
  counterRationale?: string | null;
  counterChanges?: NegotiationChange[];
  remainingRounds?: number;
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
  if (input.offerId && input.offerId !== offerId) throw new CareerError(409, "Sponsor offer ID does not match the request URL");
  const changes = input.changes ?? (input.change ? [input.change] : []);
  const request = { offerId, expectedRevision: input.expectedRevision, changes };
  const previous = (await tx.execute(sql`SELECT request, response FROM career_sponsor_negotiations
    WHERE career_save_id = ${root.id} AND request_key = ${input.requestKey}`)).rows[0];
  if (previous) {
    if (canonical(previous.request) !== canonical(request)) throw new CareerError(409, "This request key was already used for a different negotiation");
    return { ...(previous.response as SponsorNegotiationResult), replayed: true };
  }

  const journey = (await tx.execute(sql`SELECT * FROM career_sponsor_journeys
    WHERE career_save_id = ${root.id} AND current_offer_id = ${offerId} FOR UPDATE`)).rows[0];
  if (!journey) throw new CareerError(409, "This offer does not have an active negotiation journey");
  const rawOffer = (await tx.execute(sql`SELECT * FROM career_sponsor_offers
    WHERE career_save_id = ${root.id} AND id = ${offerId} FOR UPDATE`)).rows[0] as Record<string, unknown> | undefined;
  if (!rawOffer) throw new CareerError(404, "Sponsor offer not found");
  const expired = rawOffer.status === "EXPIRED"
    || String(journey.status) === "EXPIRED"
    || timeIndex(Number(rawOffer.expires_season), Number(rawOffer.expires_week))
      < timeIndex(Number(root.current_season), Number(root.current_week));
  if (expired) {
    if (rawOffer.status === "AVAILABLE") {
      await tx.execute(sql`UPDATE career_sponsor_offers SET status = 'EXPIRED', status_reason = 'EXPIRED_BEFORE_NEGOTIATION', resolved_at = NOW()
        WHERE career_save_id = ${root.id} AND id = ${offerId} AND status = 'AVAILABLE'`);
    }
    if (["OFFERED", "NEGOTIATING"].includes(String(journey.status))) {
      await tx.execute(sql`UPDATE career_sponsor_journeys SET status = 'EXPIRED', updated_at = NOW()
        WHERE career_save_id = ${root.id} AND id = ${journey.id}`);
    }
    await appendSponsorJourneyEvent(tx, root, {
      journeyId: String(journey.id), eventKey: `expired:${offerId}`, eventType: "OFFER_EXPIRED", offerId,
      season: Number(root.current_season), week: Number(root.current_week),
      details: { headline: "Offer expired", summary: "The response window closed before a new negotiation could be made." },
    });
    const recordedRound = Math.min(MAX_ROUNDS, Math.max(1, Number(journey.negotiation_rounds) + 1));
    const result: SponsorNegotiationResult = {
      outcome: "EXPIRED", round: recordedRound, maxRounds: MAX_ROUNDS,
      revision: Number(journey.revision), offerId: null,
      message: "This sponsor offer has expired. No counter or contract was created.",
    };
    await tx.execute(sql`INSERT INTO career_sponsor_negotiations
      (career_save_id, id, journey_id, request_key, round, source_offer_id, response_offer_id, request, outcome, response)
      VALUES (${root.id}, ${stableUuid(root.world_seed, SPONSOR_DATABASE_VERSION, "sponsor-negotiation", input.requestKey)},
        ${journey.id}, ${input.requestKey}, ${recordedRound}, ${offerId}, NULL,
        ${JSON.stringify(request)}::jsonb, 'EXPIRED', ${JSON.stringify(result)}::jsonb)`);
    return result;
  }
  if (!["OFFERED", "NEGOTIATING"].includes(String(journey.status))) throw new CareerError(409, "This sponsor journey is no longer open");
  if (Number(journey.revision) !== input.expectedRevision) throw new CareerError(409, "This offer changed; reload it before negotiating");
  const round = Number(journey.negotiation_rounds) + 1;
  if (round > MAX_ROUNDS) throw new CareerError(409, "The sponsor has reached its negotiation limit");
  if (!rawOffer || rawOffer.status !== "AVAILABLE") throw new CareerError(409, "This sponsor offer is no longer available");
  const originalTerms = parseSponsorTerms(rawOffer.terms);
  const proposedTerms = changes.reduce((terms, change) => applyChange(terms, change), originalTerms);
  const pressure = packagePressure(originalTerms, proposedTerms, changes);
  const brandProfile = originalTerms.commercialProfile?.negotiation;
  const profile = brandProfile
    ? { accept: brandProfile.accept, ceiling: brandProfile.ceiling }
    : responseProfile(originalTerms.tier, String(journey.brand_personality));
  let outcome: SponsorNegotiationResult["outcome"];
  let resultingTerms: SponsorTerms | null = null;
  let message: string;
  let counterRationale: string | null = null;
  let counterChanges: NegotiationChange[] | undefined;

  if (pressure <= profile.accept || pressure <= 0) {
    outcome = "ACCEPTED";
    resultingTerms = proposedTerms;
    message = changes.length === 1
      ? "The sponsor accepts the requested change. Review the revised terms before signing."
      : "The sponsor accepts the package. Review the revised terms before signing.";
  } else if (pressure <= profile.ceiling && round < MAX_ROUNDS) {
    const counter = changes.reduce((terms, change) =>
      applyChange(terms, change, counterValue(originalTerms, change, proposedTerms, brandProfile?.counterShare ?? 0.5), true), originalTerms);
    if (sameTerms(counter, originalTerms) || sameTerms(counter, proposedTerms)) {
      outcome = "REJECTED";
      message = "The sponsor cannot make a useful counter on this term and has closed the negotiation.";
    } else {
      outcome = "COUNTERED";
      resultingTerms = counter;
      counterChanges = changes.map(change => changeAtTerms(counter, change));
      counterRationale = brandProfile?.rationale ?? counterReason(originalTerms, changes);
      message = changes.length === 1
        ? "The sponsor has made a counter-offer. Review its revised term."
        : "The sponsor has countered on your package. Review each revised term.";
    }
  } else if (pressure > profile.ceiling * 1.75) {
    outcome = "WITHDRAWN";
    message = "The proposal is outside the sponsor's negotiating range, so it has withdrawn the offer.";
  } else {
    outcome = "REJECTED";
    message = round >= MAX_ROUNDS
      ? "The sponsor has reached its final position and has closed the negotiation."
      : "The proposal is outside the sponsor's negotiation range; the offer has been closed.";
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
    eventType: "PLAYER_COUNTERED", offerId, details: { round, changes },
  });
  const responseType = outcome === "ACCEPTED" ? "SPONSOR_ACCEPTED_REQUEST"
    : outcome === "COUNTERED" ? "SPONSOR_COUNTERED"
    : outcome === "REJECTED" ? "SPONSOR_REJECTED" : "SPONSOR_WITHDREW";
  await appendSponsorJourneyEvent(tx, root, {
    journeyId: String(journey.id), eventKey: `sponsor-response:${journey.id}:${input.requestKey}`,
    eventType: responseType, offerId: responseOfferId ?? offerId,
    details: { round, message, outcome, changes, counterChanges: counterChanges ?? [], counterRationale },
  });

  const result: SponsorNegotiationResult = {
    outcome, round, maxRounds: MAX_ROUNDS, revision: nextRevision, offerId: responseOfferId, message,
    ...(counterChanges ? { counterChanges, counterRationale } : {}),
    remainingRounds: Math.max(0, MAX_ROUNDS - round),
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
      if (copy.eventPayment.amountPence === 0) copy.eventPayment = null;
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
      const amountPence = override ?? change.amountPence;
      if (amountPence === 0) copy.performanceBonuses = copy.performanceBonuses.filter(item => item.key !== change.key);
      else bonus.amountPence = amountPence;
      break;
    }
  }
  if (!allowSame && sameTerms(copy, terms)) throw new CareerError(400, "Choose a different value for the term you want to negotiate");
  return parseSponsorTerms(copy);
}

function changeKey(change: NegotiationChange) {
  switch (change.kind) {
    case "COVERAGE_PERCENT": return `${change.kind}:${change.index}`;
    case "PERFORMANCE_BONUS": return `${change.kind}:${change.key}`;
    default: return change.kind;
  }
}

function packagePressure(before: SponsorTerms, after: SponsorTerms, changes: NegotiationChange[]) {
  const pressures = changes.map(change => askPressure(before, after, change));
  const asks = pressures.reduce((total, pressure) => total + Math.max(0, pressure), 0);
  const concessions = pressures.reduce((total, pressure) => total + Math.max(0, -pressure), 0);
  // Player concessions can make a package more attractive, but cannot erase
  // the full cost of an otherwise extreme ask.
  return Math.max(0, asks - Math.min(concessions * 0.5, asks * 0.4));
}

function changeAtTerms(terms: SponsorTerms, requested: NegotiationChange): NegotiationChange {
  switch (requested.kind) {
    case "SIGNING_BONUS":
      return { kind: "SIGNING_BONUS", amountPence: terms.signingBonusPence };
    case "EVENT_PAYMENT":
      return { kind: "EVENT_PAYMENT", amountPence: terms.eventPayment?.amountPence ?? 0 };
    case "COVERAGE_PERCENT":
      return { kind: "COVERAGE_PERCENT", index: requested.index, percent: terms.coverage[requested.index]?.percent ?? 0 };
    case "DURATION":
      return { kind: "DURATION", seasons: terms.duration.kind === "SEASONS" ? terms.duration.seasons : 1 };
    case "PERFORMANCE_BONUS":
      return { kind: "PERFORMANCE_BONUS", key: requested.key,
        amountPence: terms.performanceBonuses.find(bonus => bonus.key === requested.key)?.amountPence ?? requested.amountPence };
  }
}

function counterReason(terms: SponsorTerms, changes: NegotiationChange[]) {
  if (changes.length > 1) {
    return "We have considered the package as a whole and revised the terms to keep the overall partnership within our budget.";
  }
  switch (terms.category) {
    case "LOCAL_PARTNER":
      return "We want to keep this a practical local partnership, so we can move part way but cannot meet the full request.";
    case "TRAVEL_PARTNER":
      return "Our support is focused on getting you to events, so we have kept the package within our travel budget.";
    case "EQUIPMENT_PARTNER":
      return "We need to protect the value of our equipment partnership, so we have revised the term to a level we can support.";
    case "APPAREL_PARTNER":
      return "We balance player support with the promotional work attached to this partnership, so this is our revised position.";
    case "MAIN_PARTNER":
      return "We can improve the offer, but need to keep the overall commitment aligned with the results and visibility in the agreement.";
    default:
      return "We can move on this term, but need to keep the agreement within our commercial limits.";
  }
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

export function responseProfile(tier: SponsorTier, personality: string) {
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

function counterValue(before: SponsorTerms, change: NegotiationChange, after: SponsorTerms, counterShare = 0.5) {
  const point = (current: number, requested: number, increment = 1) =>
    Math.round((current + (requested - current) * counterShare) / increment) * increment;
  switch (change.kind) {
    case "SIGNING_BONUS": return point(before.signingBonusPence, after.signingBonusPence, 100);
    case "EVENT_PAYMENT": return point(Number(before.eventPayment?.amountPence ?? 0), Number(after.eventPayment?.amountPence ?? 0), 100);
    case "COVERAGE_PERCENT": return point(before.coverage[change.index].percent, after.coverage[change.index].percent);
    case "DURATION": {
      const current = before.duration.kind === "SEASONS" ? before.duration.seasons : 1;
      const next = after.duration.kind === "SEASONS" ? after.duration.seasons : current;
      return Math.max(1, Math.min(next, Math.round(current + (next - current) * counterShare)));
    }
    case "PERFORMANCE_BONUS": {
      const current = before.performanceBonuses.find(item => item.key === change.key)?.amountPence ?? 0;
      const next = after.performanceBonuses.find(item => item.key === change.key)?.amountPence ?? current;
      return point(current, next, 100);
    }
  }
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
