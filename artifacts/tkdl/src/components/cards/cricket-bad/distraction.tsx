import { TKDLCard } from "../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: Target loses their next number mark completely — hit doesn't count.
  const cardData = {
    id: 402,
    name: "Distraction",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "Target loses their next number mark completely — hit doesn't count.",
    flavourText: "Just enough to break the rhythm.",
    energyCost: 2,
    artworkUrl: "/card-artwork/distraction.png",
  } as const;

  export default function Distraction({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  