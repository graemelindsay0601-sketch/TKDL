import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · COMMON
  // Effect: Each mark this turn is worth +5 more points than the last.
  const cardData = {
    id: 308,
    name: "Scoring Momentum",
    category: "CRICKET GOOD",
    rarity: "COMMON",
    effect: "Each mark this turn is worth +5 more points than the last.",
    flavourText: "Build on every hit.",
    energyCost: 1,
    artworkUrl: "/card-artwork/scoring-momentum.png",
  } as const;

  export default function ScoringMomentum({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  