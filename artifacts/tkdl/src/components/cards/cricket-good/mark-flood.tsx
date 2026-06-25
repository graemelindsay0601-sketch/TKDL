import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: All your darts this turn automatically mark — even if you miss the number.
  const cardData = {
    id: 307,
    name: "Mark Flood",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "All your darts this turn automatically mark — even if you miss the number.",
    flavourText: "Every throw counts tonight.",
    energyCost: 2,
    artworkUrl: "/card-artwork/mark-flood.png",
  } as const;

  export default function MarkFlood({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  