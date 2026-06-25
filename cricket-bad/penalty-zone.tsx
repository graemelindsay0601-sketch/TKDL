import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: Target's next marks must be on 6–15 only — high numbers and Bull don't mark.
  const cardData = {
    id: 404,
    name: "Penalty Zone",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "Target's next marks must be on 6–15 only — high numbers and Bull don't mark.",
    flavourText: "Forced into the low end.",
    energyCost: 2,
    artworkUrl: "/artwork/penalty-zone.png",
  } as const;

  export default function PenaltyZone({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  