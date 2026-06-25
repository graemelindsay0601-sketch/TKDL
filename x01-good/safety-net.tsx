import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · LEGENDARY
  // Effect: If you would bust, score half your current visit total instead.
  const cardData = {
    id: 114,
    name: "Safety Net",
    category: "X01 GOOD",
    rarity: "LEGENDARY",
    effect: "If you would bust, score half your current visit total instead.",
    flavourText: "There's always a way back.",
    energyCost: 3,
    artworkUrl: "/artwork/safety-net.png",
  } as const;

  export default function SafetyNet({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  