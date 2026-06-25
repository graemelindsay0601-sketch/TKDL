import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · RARE
  // Effect: If you finish this turn, gain +50 bonus points.
  const cardData = {
    id: 118,
    name: "Finishing Bonus",
    category: "X01 GOOD",
    rarity: "RARE",
    effect: "If you finish this turn, gain +50 bonus points.",
    flavourText: "The sweetest points are the last ones.",
    energyCost: 2,
    artworkUrl: "/artwork/finishing-bonus.png",
  } as const;

  export default function FinishingBonus({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  