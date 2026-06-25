import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · RARE
  // Effect: Target must finish on double or their turn ends immediately after 1 dart.
  const cardData = {
    id: 219,
    name: "Trapped",
    category: "X01 BAD",
    rarity: "RARE",
    effect: "Target must finish on double or their turn ends immediately after 1 dart.",
    flavourText: "Hit it first time or not at all.",
    energyCost: 2,
    artworkUrl: "/artwork/trapped.png",
  } as const;

  export default function Trapped({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  