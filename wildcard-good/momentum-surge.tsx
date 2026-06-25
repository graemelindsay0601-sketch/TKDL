import { TKDLCard } from "../../TKDLCard";

  // WILDCARD GOOD · COMMON
  // Effect: If you're ahead in the match, gain +25 bonus this leg.
  const cardData = {
    id: 503,
    name: "Momentum Surge",
    category: "WILDCARD GOOD",
    rarity: "COMMON",
    effect: "If you're ahead in the match, gain +25 bonus this leg.",
    flavourText: "Lead from the front. Keep leading.",
    energyCost: 1,
    artworkUrl: "/artwork/momentum-surge.png",
  } as const;

  export default function MomentumSurge({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  