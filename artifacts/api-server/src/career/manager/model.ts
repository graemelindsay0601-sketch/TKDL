/**
 * Managers: a management firm earns only from what it brings you.
 *  - Sponsor deals it sets up: a sponsor offer made while it manages you carries its name; it negotiates a bigger signing
 *    bonus, and takes its cut of every payment from that deal for as long as the deal runs.
 *  - Doors it opens: invitation events you would not get into on your own (World Dart Series nights abroad and, with the
 *    top firm, the televised invitationals). Only when your World Ranking is within reach of the invitation list: a manager
 *    can lean on a promoter, not invent a reputation. Ranking events (majors, the World Championship) are never for sale.
 *    It takes its cut of the prize money from an event it got you into, and nothing from events you enter on your own.
 * Each firm only signs players who have earned it, on facts: prize money won, a Tour Card.
 */
export type ManagerReach = {
  /** Circuits whose invitation events this firm can get you into. */
  circuits: readonly string[];
  /** The invitation still needs a World Ranking within this many times the event's invitation count. */
  rankMultiplier: number;
};
export type ManagerDefinition = {
  key: string; name: string; kind: string; blurb: string;
  /** Their cut of money they brought in (payments from deals they set up; prize money from events they got you into). */
  commission: number;
  /** Added to the signing bonus of a sponsor offer they bring. */
  signingBonusBoost: number;
  /** Extra sponsor offers each time sponsors evaluate you. */
  extraOffers: number;
  reach: ManagerReach;
  requirement: { careerPrizePence?: number; tourCard?: boolean };
};

export const MANAGERS: readonly ManagerDefinition[] = Object.freeze([
  { key: "backroom", name: "Back Room Darts Management", kind: "Local agent",
    blurb: "A one-man outfit who knows every local business that might put its name on your shirt. Sponsor deals only.",
    commission: 0.10, signingBonusBoost: 0.15, extraOffers: 0, reach: { circuits: [], rankMultiplier: 0 }, requirement: { careerPrizePence: 30000 } },
  { key: "northgate", name: "Northgate Sports Management", kind: "Regional management",
    blurb: "Looks after a stable of county players and up-and-comers; sponsors and overseas promoters take their calls.",
    commission: 0.15, signingBonusBoost: 0.30, extraOffers: 1, reach: { circuits: ["WORLD_SERIES"], rankMultiplier: 4 }, requirement: { careerPrizePence: 300000 } },
  { key: "oche-elite", name: "Oche Elite Management", kind: "Top management firm",
    blurb: "Represents Tour Card holders. Expensive, but they get players onto television and into the invitationals.",
    commission: 0.20, signingBonusBoost: 0.50, extraOffers: 1,
    reach: { circuits: ["WORLD_SERIES", "INVITATIONAL"], rankMultiplier: 4 }, requirement: { tourCard: true } },
]);
/** Invitation events no manager can buy you into (national teams are picked by the rankings). */
export const NOT_FOR_SALE = new Set(["world-cup-of-darts"]);
export const REACH_LABEL: Record<string, string> = { WORLD_SERIES: "World Dart Series invitations",
  INVITATIONAL: "televised invitationals (Champions Masters, Thursday Night Darts)" };

/**
 * Can this firm get you an invitation to this event? Only events that take invitations, on its circuits, and only when your
 * World Ranking is within its reach of the invitation list (e.g. the top firm can get a top-32 player into an eight-player
 * World Dart Series night).
 */
export function canInvite(m: Pick<ManagerDefinition, "reach">, event: { circuit: string; definitionKey: string; invitationCount: number | null; takesInvitations: boolean },
  proWorldRank: number | undefined) {
  if (!event.takesInvitations || NOT_FOR_SALE.has(event.definitionKey) || !m.reach.circuits.includes(event.circuit)) return false;
  return proWorldRank !== undefined && proWorldRank <= (event.invitationCount ?? 16) * m.reach.rankMultiplier;
}

export const managerByKey = (key: string) => MANAGERS.find(m => m.key === key) ?? null;

export type ManagerFacts = { careerPrizePence: number; tourCard: boolean };
/** Why a firm will not sign you yet (empty when it will). */
export function unmet(m: ManagerDefinition, f: ManagerFacts): string[] {
  const out: string[] = [];
  if (m.requirement.careerPrizePence && f.careerPrizePence < m.requirement.careerPrizePence) out.push(`Win £${(m.requirement.careerPrizePence / 100).toLocaleString("en-GB")} in prize money`);
  if (m.requirement.tourCard && !f.tourCard) out.push("Hold a Tour Card");
  return out;
}

/** Their cut of a payment or prize, to the 10p. */
export const commissionOn = (prizePence: number, m: ManagerDefinition) => Math.floor(prizePence * m.commission / 10) * 10;
/** A bonus with the manager's boost, to the pound. */
export const boosted = (pence: number, boost: number) => Math.round(pence * (1 + boost) / 100) * 100;
