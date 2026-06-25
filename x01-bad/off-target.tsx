import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · RARE
  // Effect: Target's darts shift to the adjacent dartboard segment — 20 becomes 1 or 5.
  const cardData = {
    id: 209,
    name: "Off Target",
    category: "X01 BAD",
    rarity: "RARE",
    effect: "Target's darts shift to the adjacent dartboard segment — 20 becomes 1 or 5.",
    flavourText: "Just a fraction off. Just enough.",
    energyCost: 2,
    artworkUrl: "/artwork/off-target.png",
  } as const;

  export default function OffTarget({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  