import { TKDLCard } from "../../TKDLCard";

  // WILDCARD GOOD · LEGENDARY
  // Effect: If you're 1 leg away from winning the match, gain +70 bonus.
  const cardData = {
    id: 509,
    name: "Match Point",
    category: "WILDCARD GOOD",
    rarity: "LEGENDARY",
    effect: "If you're 1 leg away from winning the match, gain +70 bonus.",
    flavourText: "One leg from glory — take it.",
    energyCost: 3,
    artworkUrl: "/artwork/match-point.png",
  } as const;

  export default function MatchPoint({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  