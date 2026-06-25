import { TKDLCard } from "../TKDLCard";

  // WILDCARD GOOD · RARE
  // Effect: In the final deciding leg, if you miss a finish or close attempt, you get 1 free retry.
  const cardData = {
    id: 504,
    name: "Finishing Edge",
    category: "WILDCARD GOOD",
    rarity: "RARE",
    effect: "In the final deciding leg, if you miss a finish or close attempt, you get 1 free retry.",
    flavourText: "One more chance at glory.",
    energyCost: 2,
    artworkUrl: "/card-artwork/finishing-edge.png",
  } as const;

  export default function FinishingEdge({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  