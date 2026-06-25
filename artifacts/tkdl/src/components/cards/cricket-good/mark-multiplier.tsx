import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: If you mark the called number 3+ times this turn, score +50 bonus points.
  const cardData = {
    id: 315,
    name: "Mark Multiplier",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "If you mark the called number 3+ times this turn, score +50 bonus points.",
    flavourText: "Hat-trick on one number. Bonus earned.",
    energyCost: 2,
    artworkUrl: "/card-artwork/mark-multiplier.png",
  } as const;

  export default function MarkMultiplier({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  