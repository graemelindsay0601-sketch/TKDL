/**
 * Managers: a management firm that takes a cut of your prize money and, in return, gets you more out of sponsors
 * (a bigger signing bonus on every sponsor offer, and the bigger firms one more offer each time sponsors look at you)
 * and better-paid appearances. Each firm only signs players who have earned it, on facts: prize money won, a Tour Card.
 */
export type ManagerDefinition = {
  key: string; name: string; kind: string; blurb: string;
  /** Share of prize money taken (cash prizes only; sponsor money and money matches are yours). */
  commission: number;
  /** Added to a sponsor offer's signing bonus, and to appearance fees. */
  signingBonusBoost: number; appearanceBoost: number;
  /** Extra sponsor offers each time sponsors evaluate you. */
  extraOffers: number;
  requirement: { careerPrizePence?: number; tourCard?: boolean };
};

export const MANAGERS: readonly ManagerDefinition[] = Object.freeze([
  { key: "backroom", name: "Back Room Darts Management", kind: "Local agent",
    blurb: "A one-man outfit who knows every club secretary in the area. Small cut, small favours.",
    commission: 0.10, signingBonusBoost: 0.15, appearanceBoost: 0.20, extraOffers: 0, requirement: { careerPrizePence: 30000 } },
  { key: "northgate", name: "Northgate Sports Management", kind: "Regional management",
    blurb: "Looks after a stable of county players and up-and-comers; sponsors take their calls.",
    commission: 0.15, signingBonusBoost: 0.30, appearanceBoost: 0.40, extraOffers: 1, requirement: { careerPrizePence: 300000 } },
  { key: "oche-elite", name: "Oche Elite Management", kind: "Top management firm",
    blurb: "Represents Tour Card holders. Expensive, but they open doors nobody else can.",
    commission: 0.20, signingBonusBoost: 0.50, appearanceBoost: 0.75, extraOffers: 1, requirement: { tourCard: true } },
]);
export const managerByKey = (key: string) => MANAGERS.find(m => m.key === key) ?? null;

export type ManagerFacts = { careerPrizePence: number; tourCard: boolean };
/** Why a firm will not sign you yet (empty when it will). */
export function unmet(m: ManagerDefinition, f: ManagerFacts): string[] {
  const out: string[] = [];
  if (m.requirement.careerPrizePence && f.careerPrizePence < m.requirement.careerPrizePence) out.push(`Win £${(m.requirement.careerPrizePence / 100).toLocaleString("en-GB")} in prize money`);
  if (m.requirement.tourCard && !f.tourCard) out.push("Hold a Tour Card");
  return out;
}

/** Commission on a cash prize, to the 10p. */
export const commissionOn = (prizePence: number, m: ManagerDefinition) => Math.floor(prizePence * m.commission / 10) * 10;
/** A fee or bonus with the manager's boost, to the pound. */
export const boosted = (pence: number, boost: number) => Math.round(pence * (1 + boost) / 100) * 100;
