import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: If target had 2+ marks last turn, they lose those marks this turn.
  const cardData = {
    id: 409,
    name: "Momentum Killer",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "If target had 2+ marks last turn, they lose those marks this turn.",
    flavourText: "Yesterday's momentum means nothing.",
    energyCost: 2,
    artworkUrl: "/artwork/momentum-killer-cricket.png",
  } as const;

  export default function MomentumKiller({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  