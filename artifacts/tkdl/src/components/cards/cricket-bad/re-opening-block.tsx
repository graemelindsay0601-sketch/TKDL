import { TKDLCard } from "../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: When you close one of target's numbers, that number is permanently locked.
  const cardData = {
    id: 405,
    name: "Re-Opening Block",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "When you close one of target's numbers, that number is permanently locked.",
    flavourText: "Closed for good.",
    energyCost: 2,
    artworkUrl: "/card-artwork/re-opening-block.png",
  } as const;

  export default function ReOpeningBlock({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  