import { TKDLCard } from "../TKDLCard";

  // X01 GOOD · RARE
  // Effect: In final 50 points, if you hit your double, opponent can't play penalty cards next turn.
  const cardData = {
    id: 107,
    name: "Exact Finish",
    category: "X01 GOOD",
    rarity: "RARE",
    effect: "In final 50 points, if you hit your double, opponent can't play penalty cards next turn.",
    flavourText: "Precision silences the opposition.",
    energyCost: 2,
    artworkUrl: "/card-artwork/exact-finish.png",
  } as const;

  export default function ExactFinish({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  