import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · RARE
  // Effect: Target's darts get progressively worse — Dart 1 normal, Dart 2 ×0.9, Dart 3 ×0.8.
  const cardData = {
    id: 212,
    name: "Fatigue",
    category: "X01 BAD",
    rarity: "RARE",
    effect: "Target's darts get progressively worse — Dart 1 normal, Dart 2 ×0.9, Dart 3 ×0.8.",
    flavourText: "Three visits too many.",
    energyCost: 2,
    artworkUrl: "/artwork/fatigue.png",
  } as const;

  export default function Fatigue({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  