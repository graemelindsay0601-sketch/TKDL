import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · COMMON
  // Effect: Single hits count as 0 — only doubles and trebles score.
  const cardData = {
    id: 204,
    name: "Low Blow",
    category: "X01 BAD",
    rarity: "COMMON",
    effect: "Single hits count as 0 — only doubles and trebles score.",
    flavourText: "Mediocrity is punished.",
    energyCost: 1,
    artworkUrl: "/artwork/low-blow.png",
  } as const;

  export default function LowBlow({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  