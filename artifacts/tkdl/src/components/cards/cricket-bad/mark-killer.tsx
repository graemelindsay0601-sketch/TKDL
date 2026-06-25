import { TKDLCard } from "../TKDLCard";

  // CRICKET BAD · COMMON
  // Effect: Target's final dart this turn doesn't count as a mark.
  const cardData = {
    id: 416,
    name: "Mark Killer",
    category: "CRICKET BAD",
    rarity: "COMMON",
    effect: "Target's final dart this turn doesn't count as a mark.",
    flavourText: "The last dart lands for nothing.",
    energyCost: 1,
    artworkUrl: "/card-artwork/mark-killer.png",
  } as const;

  export default function MarkKiller({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  