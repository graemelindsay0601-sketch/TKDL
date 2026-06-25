import { TKDLCard } from "../../TKDLCard";

  // WILDCARD BAD · COMMON
  // Effect: If target is ahead, all their darts score at 0.8x value.
  const cardData = {
    id: 608,
    name: "Underdog Curse",
    category: "WILDCARD BAD",
    rarity: "COMMON",
    effect: "If target is ahead, all their darts score at 0.8x value.",
    flavourText: "The lead is a burden.",
    energyCost: 1,
    artworkUrl: "/artwork/underdog-curse.png",
  } as const;

  export default function UnderdogCurse({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  