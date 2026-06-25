import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · RARE
  // Effect: All target's darts score at 0.75x value this turn.
  const cardData = {
    id: 211,
    name: "Jinx",
    category: "X01 BAD",
    rarity: "RARE",
    effect: "All target's darts score at 0.75x value this turn.",
    flavourText: "The curse lands before the dart.",
    energyCost: 2,
    artworkUrl: "/artwork/jinx.png",
  } as const;

  export default function Jinx({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  