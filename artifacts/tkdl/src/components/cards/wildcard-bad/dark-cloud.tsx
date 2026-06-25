import { TKDLCard } from "../TKDLCard";

  // WILDCARD BAD · COMMON
  // Effect: Target's next leg score reduced by 35 points (X01) or 1 number locked (Cricket).
  const cardData = {
    id: 601,
    name: "Dark Cloud",
    category: "WILDCARD BAD",
    rarity: "COMMON",
    effect: "Target's next leg score reduced by 35 points (X01) or 1 number locked (Cricket).",
    flavourText: "The storm follows the leader.",
    energyCost: 1,
    artworkUrl: "/card-artwork/dark-cloud.png",
  } as const;

  export default function DarkCloud({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  