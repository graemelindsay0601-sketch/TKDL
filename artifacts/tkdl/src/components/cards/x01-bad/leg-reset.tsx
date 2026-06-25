import { TKDLCard } from "../TKDLCard";

  // X01 BAD · COMMON
  // Effect: If target won 2+ legs in a row, their streak is reset to zero.
  const cardData = {
    id: 213,
    name: "Leg Reset",
    category: "X01 BAD",
    rarity: "COMMON",
    effect: "If target won 2+ legs in a row, their streak is reset to zero.",
    flavourText: "Winning streaks end here.",
    energyCost: 1,
    artworkUrl: "/card-artwork/leg-reset.png",
  } as const;

  export default function LegReset({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  