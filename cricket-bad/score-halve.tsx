import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · LEGENDARY
  // Effect: Target's open numbers score at 0.5x value this leg — T20 = 30 instead of 60.
  const cardData = {
    id: 420,
    name: "Score Halve",
    category: "CRICKET BAD",
    rarity: "LEGENDARY",
    effect: "Target's open numbers score at 0.5x value this leg — T20 = 30 instead of 60.",
    flavourText: "Half the points. Same effort.",
    energyCost: 3,
    artworkUrl: "/artwork/score-halve.png",
  } as const;

  export default function ScoreHalve({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  