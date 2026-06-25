import { TKDLCard } from "../../TKDLCard";

  // CRICKET GOOD · LEGENDARY
  // Effect: All your open numbers score at 1.5x value this leg — T20 = 90 instead of 60.
  const cardData = {
    id: 305,
    name: "Scoring Surge",
    category: "CRICKET GOOD",
    rarity: "LEGENDARY",
    effect: "All your open numbers score at 1.5x value this leg — T20 = 90 instead of 60.",
    flavourText: "The board bends to the will of the dominant.",
    energyCost: 3,
    artworkUrl: "/artwork/scoring-surge.png",
  } as const;

  export default function ScoringSurge({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  