import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · COMMON
  // Effect: Target's highest possible dart this turn is capped at 50.
  const cardData = {
    id: 206,
    name: "Shackled",
    category: "X01 BAD",
    rarity: "COMMON",
    effect: "Target's highest possible dart this turn is capped at 50.",
    flavourText: "Chains on the wrist, chains on the score.",
    energyCost: 1,
    artworkUrl: "/artwork/shackled.png",
  } as const;

  export default function Shackled({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  