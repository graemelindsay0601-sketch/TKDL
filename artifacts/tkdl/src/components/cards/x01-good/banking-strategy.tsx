import { TKDLCard } from "../TKDLCard";

  // X01 GOOD · COMMON
  // Effect: If you score 50+ (not on double), next turn gets +20 bonus.
  const cardData = {
    id: 105,
    name: "Banking Strategy",
    category: "X01 GOOD",
    rarity: "COMMON",
    effect: "If you score 50+ (not on double), next turn gets +20 bonus.",
    flavourText: "Build momentum. Bank the points.",
    energyCost: 1,
    artworkUrl: "/card-artwork/banking-strategy.png",
  } as const;

  export default function BankingStrategy({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  