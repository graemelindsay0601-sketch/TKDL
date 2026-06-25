import { TKDLCard } from "../TKDLCard";

  // WILDCARD GOOD · COMMON
  // Effect: If this is a shutout leg (opponent scored 0), gain +30 bonus.
  const cardData = {
    id: 508,
    name: "Perfect Game",
    category: "WILDCARD GOOD",
    rarity: "COMMON",
    effect: "If this is a shutout leg (opponent scored 0), gain +30 bonus.",
    flavourText: "Perfection deserves recognition.",
    energyCost: 1,
    artworkUrl: "/card-artwork/perfect-game.png",
  } as const;

  export default function PerfectGame({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  