import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · RARE
  // Effect: If you score over 100 this turn, gain +25 bonus.
  const cardData = {
    id: 110,
    name: "High Roller",
    category: "X01 GOOD",
    rarity: "RARE",
    effect: "If you score over 100 this turn, gain +25 bonus.",
    flavourText: "High stakes. Higher rewards.",
    energyCost: 2,
    artworkUrl: "/artwork/high-roller.png",
  } as const;

  export default function HighRoller({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  