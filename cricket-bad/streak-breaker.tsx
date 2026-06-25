import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: If target had 3+ marks last turn, lose half those marks this turn.
  const cardData = {
    id: 418,
    name: "Streak Breaker",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "If target had 3+ marks last turn, lose half those marks this turn.",
    flavourText: "Good form never lasts.",
    energyCost: 2,
    artworkUrl: "/artwork/streak-breaker.png",
  } as const;

  export default function StreakBreaker({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  