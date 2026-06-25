import { TKDLCard } from "../../TKDLCard";

  // WILDCARD BAD · RARE
  // Effect: Target's leg capped at 50 points (X01) or 2 numbers max (Cricket).
  const cardData = {
    id: 610,
    name: "Shutdown",
    category: "WILDCARD BAD",
    rarity: "RARE",
    effect: "Target's leg capped at 50 points (X01) or 2 numbers max (Cricket).",
    flavourText: "Hard stop.",
    energyCost: 2,
    artworkUrl: "/artwork/shutdown.png",
  } as const;

  export default function Shutdown({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  