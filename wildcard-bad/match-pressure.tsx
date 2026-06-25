import { TKDLCard } from "../../TKDLCard";

  // WILDCARD BAD · RARE
  // Effect: In the final leg of the match, target's darts score -20 each (X01) or marks halved (Cricket).
  const cardData = {
    id: 607,
    name: "Match Pressure",
    category: "WILDCARD BAD",
    rarity: "RARE",
    effect: "In the final leg of the match, target's darts score -20 each (X01) or marks halved (Cricket).",
    flavourText: "The big moment becomes the worst moment.",
    energyCost: 2,
    artworkUrl: "/artwork/match-pressure.png",
  } as const;

  export default function MatchPressure({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  