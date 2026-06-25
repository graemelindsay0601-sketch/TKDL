import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · COMMON
  // Effect: If you score exactly 100 this turn, gain +40 bonus.
  const cardData = {
    id: 119,
    name: "Century Maker",
    category: "X01 GOOD",
    rarity: "COMMON",
    effect: "If you score exactly 100 this turn, gain +40 bonus.",
    flavourText: "Three figures — exactly.",
    energyCost: 1,
    artworkUrl: "/artwork/century-maker.png",
  } as const;

  export default function CenturyMaker({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  