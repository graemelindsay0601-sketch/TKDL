import { TKDLCard } from "../../TKDLCard";

  // WILDCARD GOOD · RARE
  // Effect: 50/50 chance — either gain +40 bonus OR opponent loses 30 points.
  const cardData = {
    id: 501,
    name: "Coin Flip",
    category: "WILDCARD GOOD",
    rarity: "RARE",
    effect: "50/50 chance — either gain +40 bonus OR opponent loses 30 points.",
    flavourText: "Fortune favours the brave.",
    energyCost: 2,
    artworkUrl: "/artwork/coin-flip.png",
  } as const;

  export default function CoinFlip({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  