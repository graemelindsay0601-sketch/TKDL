import { TKDLCard } from "../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: If target leads in points, they lose 1 mark from a random opened number each turn.
  const cardData = {
    id: 417,
    name: "Mark Drain",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "If target leads in points, they lose 1 mark from a random opened number each turn.",
    flavourText: "The lead drains slowly away.",
    energyCost: 2,
    artworkUrl: "/card-artwork/mark-drain.png",
  } as const;

  export default function MarkDrain({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  