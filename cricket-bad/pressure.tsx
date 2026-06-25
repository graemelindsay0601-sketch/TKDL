import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: Target must close their current number or lose 30 points at turn end.
  const cardData = {
    id: 408,
    name: "Pressure",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "Target must close their current number or lose 30 points at turn end.",
    flavourText: "Close it — or pay.",
    energyCost: 2,
    artworkUrl: "/artwork/pressure.png",
  } as const;

  export default function Pressure({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  