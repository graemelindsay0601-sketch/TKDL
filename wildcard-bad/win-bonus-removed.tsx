import { TKDLCard } from "../../TKDLCard";

  // WILDCARD BAD · COMMON
  // Effect: If target won last leg, they lose that momentum bonus.
  const cardData = {
    id: 609,
    name: "Win Bonus Removed",
    category: "WILDCARD BAD",
    rarity: "COMMON",
    effect: "If target won last leg, they lose that momentum bonus.",
    flavourText: "What you earned doesn't last.",
    energyCost: 1,
    artworkUrl: "/artwork/win-bonus-removed.png",
  } as const;

  export default function WinBonusRemoved({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  