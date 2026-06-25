import { TKDLCard } from "../TKDLCard";

  // X01 GOOD · RARE
  // Effect: All your darts score at 1.2x value this turn.
  const cardData = {
    id: 120,
    name: "Iron Will",
    category: "X01 GOOD",
    rarity: "RARE",
    effect: "All your darts score at 1.2x value this turn.",
    flavourText: "Bend the board to your will.",
    energyCost: 2,
    artworkUrl: "/card-artwork/iron-will.png",
  } as const;

  export default function IronWill({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  