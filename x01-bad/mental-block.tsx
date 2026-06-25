import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · COMMON
  // Effect: Each dart thrown costs 10 points — visit length × 10 is subtracted.
  const cardData = {
    id: 218,
    name: "Mental Block",
    category: "X01 BAD",
    rarity: "COMMON",
    effect: "Each dart thrown costs 10 points — visit length × 10 is subtracted.",
    flavourText: "The mind is the first thing to go.",
    energyCost: 1,
    artworkUrl: "/artwork/mental-block.png",
  } as const;

  export default function MentalBlock({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  