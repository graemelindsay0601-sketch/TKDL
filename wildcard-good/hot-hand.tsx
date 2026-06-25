import { TKDLCard } from "../../TKDLCard";

  // WILDCARD GOOD · RARE
  // Effect: If you've won 2+ legs in a row, gain +45 bonus.
  const cardData = {
    id: 506,
    name: "Hot Hand",
    category: "WILDCARD GOOD",
    rarity: "RARE",
    effect: "If you've won 2+ legs in a row, gain +45 bonus.",
    flavourText: "The streak is real.",
    energyCost: 2,
    artworkUrl: "/artwork/hot-hand.png",
  } as const;

  export default function HotHand({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  