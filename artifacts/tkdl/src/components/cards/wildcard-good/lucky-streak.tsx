import { TKDLCard } from "../TKDLCard";

  // WILDCARD GOOD · COMMON
  // Effect: If you won the previous leg, gain +50 bonus this leg.
  const cardData = {
    id: 502,
    name: "Lucky Streak",
    category: "WILDCARD GOOD",
    rarity: "COMMON",
    effect: "If you won the previous leg, gain +50 bonus this leg.",
    flavourText: "Winners keep winning.",
    energyCost: 1,
    artworkUrl: "/card-artwork/lucky-streak.png",
  } as const;

  export default function LuckyStreak({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  