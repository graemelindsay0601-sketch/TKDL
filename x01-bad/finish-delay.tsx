import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · RARE
  // Effect: Target's first 2 darts can't finish — doubles count as singles until dart 3.
  const cardData = {
    id: 215,
    name: "Finish Delay",
    category: "X01 BAD",
    rarity: "RARE",
    effect: "Target's first 2 darts can't finish — doubles count as singles until dart 3.",
    flavourText: "So close. Not yet.",
    energyCost: 2,
    artworkUrl: "/artwork/finish-delay.png",
  } as const;

  export default function FinishDelay({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  