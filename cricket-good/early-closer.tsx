import { TKDLCard } from "../../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: If you close a number before turn 5, get +30 bonus points.
  const cardData = {
    id: 309,
    name: "Early Closer",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "If you close a number before turn 5, get +30 bonus points.",
    flavourText: "First to close wins the initiative.",
    energyCost: 2,
    artworkUrl: "/artwork/early-closer.png",
  } as const;

  export default function EarlyCloser({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  