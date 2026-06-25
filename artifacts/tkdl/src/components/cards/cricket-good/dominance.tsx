import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · COMMON
  // Effect: If you lead in closed numbers, all your marks are worth 1.3x.
  const cardData = {
    id: 320,
    name: "Dominance",
    category: "CRICKET GOOD",
    rarity: "COMMON",
    effect: "If you lead in closed numbers, all your marks are worth 1.3x.",
    flavourText: "Control the board. Control the game.",
    energyCost: 1,
    artworkUrl: "/card-artwork/dominance.png",
  } as const;

  export default function Dominance({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  