import { TKDLCard } from "../TKDLCard";

  // X01 GOOD · RARE
  // Effect: Next treble hit counts at 1.3x — T20 becomes 78 instead of 60.
  const cardData = {
    id: 103,
    name: "Treble Hunter",
    category: "X01 GOOD",
    rarity: "RARE",
    effect: "Next treble hit counts at 1.3x — T20 becomes 78 instead of 60.",
    flavourText: "Narrow the wire. Broaden the reward.",
    energyCost: 2,
    artworkUrl: "/card-artwork/treble-hunter.png",
  } as const;

  export default function TrebleHunter({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  