import { sql } from "drizzle-orm";
import type { CareerExecutor } from "../database.ts";
import { HUMAN, type RootRow } from "../calendar/engine.ts";
import { CareerError } from "../service.ts";
import { awardCard, endCard, syncHumanCardCache, type CardRow } from "./cards.ts";

/**
 * A Tour Card the human wins is an offer. Until they decide (or its decide-by week passes, when it is accepted) the card
 * is live, so nothing waits on them; declining hands it to the next player in line without a card and they stay
 * amateur. Once accepted the card runs its full term (it cannot be handed back).
 */
export type OfferDecision = "ACCEPT" | "DECLINE";
/** Circuits a player can only enter with a card (or an associate place); a decline is refused while entered in one. */
const CARD_CIRCUITS = ["PRO_CIRCUIT", "EUROPEAN_SERIES", "MAJOR", "WORLD_CHAMPIONSHIP", "INVITATIONAL", "WORLD_SERIES"];

export async function pendingOffer(tx: CareerExecutor, saveId: string): Promise<CardRow | null> {
  return ((await tx.execute(sql`SELECT * FROM career_tour_cards WHERE career_save_id = ${saveId} AND participant_key = ${HUMAN} AND status = 'ACTIVE'
    AND human_offer->>'status' = 'PENDING' LIMIT 1`)).rows[0] as CardRow | undefined) ?? null;
}

export async function decideOffer(tx: CareerExecutor, root: RootRow, decision: OfferDecision) {
  const card = await pendingOffer(tx, root.id);
  if (!card || !card.human_offer) throw new CareerError(409, "There is no Tour Card offer waiting for a decision");
  const season = Number(root.current_season), week = Number(root.current_week);
  const by = card.human_offer.decideBy;
  if (decision === "DECLINE" && (season > by.season || (season === by.season && week > by.week)))
    throw new CareerError(409, "It's too late to turn this Tour Card down: it's yours");
  if (decision === "ACCEPT") {
    await tx.execute(sql`UPDATE career_tour_cards SET human_offer = jsonb_set(human_offer, '{status}', '"ACCEPTED"') WHERE career_save_id = ${root.id} AND id = ${card.id}`);
    return { decision, card: card.id, passedTo: null };
  }
  const entered = (await tx.execute(sql`SELECT i.name FROM career_event_entries e JOIN career_event_instances i ON i.career_save_id = e.career_save_id AND i.id = e.event_id
    WHERE e.career_save_id = ${root.id} AND e.participant_key = ${HUMAN} AND e.status <> 'WITHDRAWN' AND i.status NOT IN ('COMPLETED','CANCELLED')
      AND i.circuit IN (${sql.join(CARD_CIRCUITS.map(c => sql`${c}`), sql`, `)}) LIMIT 1`)).rows[0];
  if (entered) throw new CareerError(409, `Withdraw from ${String(entered.name)} first: you entered it as a Tour Card holder`);
  await tx.execute(sql`UPDATE career_tour_cards SET human_offer = jsonb_set(human_offer, '{status}', '"DECLINED"') WHERE career_save_id = ${root.id} AND id = ${card.id}`);
  await endCard(tx, root, card, "SURRENDERED", "DECLINED", season, week, { source: card.source });
  // The card goes to the first player next in line who still has no card.
  const live = new Set((await tx.execute(sql`SELECT participant_key FROM career_tour_cards WHERE career_save_id = ${root.id} AND status = 'ACTIVE'`)).rows.map(r => String(r.participant_key)));
  const next = card.human_offer.reserve.find(r => !live.has(r.participantKey) && r.participantKey !== HUMAN) ?? null;
  if (next) {
    await awardCard(tx, root, Number(card.tour_card_rules_version ?? 1), { operationKey: `declined:${card.id}`, participantKey: next.participantKey, participantKind: next.participantKind,
      npcId: next.npcId, source: card.source, detail: { ...card.source_detail, passedDownFrom: HUMAN, position: next.position }, season, week,
      startSeason: Math.max(season, Number(card.start_season)), endSeason: Number(card.end_season) });
  }
  await syncHumanCardCache(tx, root, season);
  return { decision, card: card.id, passedTo: next?.participantKey ?? null };
}

/** An offer not declined by its decide-by week is accepted. */
export async function acceptLapsedOffers(tx: CareerExecutor, saveId: string, season: number, week: number) {
  await tx.execute(sql`UPDATE career_tour_cards SET human_offer = jsonb_set(human_offer, '{status}', '"ACCEPTED"')
    WHERE career_save_id = ${saveId} AND participant_key = ${HUMAN} AND status = 'ACTIVE' AND human_offer->>'status' = 'PENDING'
      AND (${season} > (human_offer->'decideBy'->>'season')::int OR (${season} = (human_offer->'decideBy'->>'season')::int AND ${week} > (human_offer->'decideBy'->>'week')::int))`);
}
