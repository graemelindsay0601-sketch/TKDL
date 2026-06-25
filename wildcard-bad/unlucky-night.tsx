import { TKDLCard } from "../../TKDLCard";

  // WILDCARD BAD · COMMON
  // Effect: All target's darts count at 75% value this leg.
  const cardData = {
    id: 603,
    name: "Unlucky Night",
    category: "WILDCARD BAD",
    rarity: "COMMON",
    effect: "All target's darts count at 75% value this leg.",
    flavourText: "Not every night goes your way.",
    energyCost: 1,
    artworkUrl: "/artwork/unlucky-night.png",
  } as const;

  export default function UnluckyNight({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  