import { TKDLCard } from "../TKDLCard";

  // X01 BAD · RARE
  // Effect: Target can't score on 20, 19, or 18 (any ring) this turn.
  const cardData = {
    id: 203,
    name: "Brick Wall",
    category: "X01 BAD",
    rarity: "RARE",
    effect: "Target can't score on 20, 19, or 18 (any ring) this turn.",
    flavourText: "The top of the board is closed.",
    energyCost: 2,
    artworkUrl: "/card-artwork/brick-wall.png",
  } as const;

  export default function BrickWall({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  