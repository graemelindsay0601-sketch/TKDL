import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · COMMON
  // Effect: Each mark costs target 10 points — marks still count, but -10 each.
  const cardData = {
    id: 413,
    name: "Mark Erasure",
    category: "CRICKET BAD",
    rarity: "COMMON",
    effect: "Each mark costs target 10 points — marks still count, but -10 each.",
    flavourText: "Progress has a price tonight.",
    energyCost: 1,
    artworkUrl: "/artwork/mark-erasure.png",
  } as const;

  export default function MarkErasure({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  