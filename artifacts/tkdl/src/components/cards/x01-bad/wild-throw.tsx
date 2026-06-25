import { TKDLCard } from "../TKDLCard";

  // X01 BAD · COMMON
  // Effect: One random dart this turn becomes a complete miss — 0 points.
  const cardData = {
    id: 202,
    name: "Wild Throw",
    category: "X01 BAD",
    rarity: "COMMON",
    effect: "One random dart this turn becomes a complete miss — 0 points.",
    flavourText: "Nobody knows which one goes wild.",
    energyCost: 1,
    artworkUrl: "/card-artwork/wild-throw.png",
  } as const;

  export default function WildThrow({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  