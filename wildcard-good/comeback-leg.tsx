import { TKDLCard } from "../../TKDLCard";

  // WILDCARD GOOD · RARE
  // Effect: If you lost the previous leg, gain +60 bonus this leg.
  const cardData = {
    id: 505,
    name: "Comeback Leg",
    category: "WILDCARD GOOD",
    rarity: "RARE",
    effect: "If you lost the previous leg, gain +60 bonus this leg.",
    flavourText: "Down but never out.",
    energyCost: 2,
    artworkUrl: "/artwork/comeback-leg.png",
  } as const;

  export default function ComebackLeg({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  