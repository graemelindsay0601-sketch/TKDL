import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: Bull doesn't count as marking anything this turn.
  const cardData = {
    id: 415,
    name: "Bull Void",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "Bull doesn't count as marking anything this turn.",
    flavourText: "Dead centre. Dead points.",
    energyCost: 2,
    artworkUrl: "/artwork/bull-void.png",
  } as const;

  export default function BullVoid({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  