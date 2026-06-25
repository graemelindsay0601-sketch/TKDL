import { TKDLCard } from "../../TKDLCard";

  // WILDCARD BAD · RARE
  // Effect: Remove any momentum or streak bonus target had — reset their consecutive wins.
  const cardData = {
    id: 602,
    name: "Momentum Killer",
    category: "WILDCARD BAD",
    rarity: "RARE",
    effect: "Remove any momentum or streak bonus target had — reset their consecutive wins.",
    flavourText: "Streak's over.",
    energyCost: 2,
    artworkUrl: "/artwork/momentum-killer-wildcard.png",
  } as const;

  export default function MomentumKiller({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  