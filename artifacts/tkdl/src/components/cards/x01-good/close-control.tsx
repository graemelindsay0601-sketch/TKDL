import { TKDLCard } from "../TKDLCard";

  // X01 GOOD · RARE
  // Effect: In final 50 points, any dart that would bust is automatically reduced to 1 point.
  const cardData = {
    id: 115,
    name: "Close Control",
    category: "X01 GOOD",
    rarity: "RARE",
    effect: "In final 50 points, any dart that would bust is automatically reduced to 1 point.",
    flavourText: "Stay in the game. Always.",
    energyCost: 2,
    artworkUrl: "/card-artwork/close-control.png",
  } as const;

  export default function CloseControl({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  