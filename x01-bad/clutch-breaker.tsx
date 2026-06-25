import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · RARE
  // Effect: In final 100 points, target's darts score -15 each.
  const cardData = {
    id: 214,
    name: "Clutch Breaker",
    category: "X01 BAD",
    rarity: "RARE",
    effect: "In final 100 points, target's darts score -15 each.",
    flavourText: "The moment that matters — ruined.",
    energyCost: 2,
    artworkUrl: "/artwork/clutch-breaker.png",
  } as const;

  export default function ClutchBreaker({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  