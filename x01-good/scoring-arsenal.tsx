import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · COMMON
  // Effect: Your turn can't end until all 3 darts are thrown — forces a full visit.
  const cardData = {
    id: 117,
    name: "Scoring Arsenal",
    category: "X01 GOOD",
    rarity: "COMMON",
    effect: "Your turn can't end until all 3 darts are thrown — forces a full visit.",
    flavourText: "Use every weapon at your disposal.",
    energyCost: 1,
    artworkUrl: "/artwork/scoring-arsenal.png",
  } as const;

  export default function ScoringArsenal({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  