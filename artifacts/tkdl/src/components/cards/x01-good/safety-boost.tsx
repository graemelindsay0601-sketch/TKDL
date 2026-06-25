import { TKDLCard } from "../TKDLCard";

  // X01 GOOD · COMMON
  // Effect: Your lowest-value dart this turn scores minimum +15.
  const cardData = {
    id: 112,
    name: "Safety Boost",
    category: "X01 GOOD",
    rarity: "COMMON",
    effect: "Your lowest-value dart this turn scores minimum +15.",
    flavourText: "Even your worst dart counts tonight.",
    energyCost: 1,
    artworkUrl: "/card-artwork/safety-boost.png",
  } as const;

  export default function SafetyBoost({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  