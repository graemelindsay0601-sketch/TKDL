import { TKDLCard } from "../../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: If you score 100+ points this turn, gain +20 bonus.
  const cardData = {
    id: 318,
    name: "High Scorer",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "If you score 100+ points this turn, gain +20 bonus.",
    flavourText: "Three figures on the board.",
    energyCost: 2,
    artworkUrl: "/artwork/high-scorer.png",
  } as const;

  export default function HighScorer({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  