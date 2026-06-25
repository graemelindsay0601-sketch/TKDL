import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: Your marks count as 2x toward opening or closing this turn.
  const cardData = {
    id: 302,
    name: "Double Strike",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "Your marks count as 2x toward opening or closing this turn.",
    flavourText: "One dart. Double the progress.",
    energyCost: 2,
    artworkUrl: "/card-artwork/double-strike.png",
  } as const;

  export default function DoubleStrike({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  