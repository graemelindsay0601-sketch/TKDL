import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · RARE
  // Effect: If you score 80+ (not on double), gain +35 bonus next leg.
  const cardData = {
    id: 101,
    name: "Big Game Player",
    category: "X01 GOOD",
    rarity: "RARE",
    effect: "If you score 80+ (not on double), gain +35 bonus next leg.",
    flavourText: "When the pressure is on, legends step up.",
    energyCost: 1,
    artworkUrl: "/artwork/big-game-player.png",
  } as const;

  export default function BigGamePlayer({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  