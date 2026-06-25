import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · COMMON
  // Effect: Target can only score on 15, 20, or Bull — all other segments score 0.
  const cardData = {
    id: 208,
    name: "Pressure Zone",
    category: "X01 BAD",
    rarity: "COMMON",
    effect: "Target can only score on 15, 20, or Bull — all other segments score 0.",
    flavourText: "Three numbers. Pick wisely.",
    energyCost: 1,
    artworkUrl: "/artwork/pressure-zone.png",
  } as const;

  export default function PressureZone({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  