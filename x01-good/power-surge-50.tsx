import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · COMMON
  // Effect: Add +50 to your turn total.
  const cardData = {
    id: 102,
    name: "Power Surge +50",
    category: "X01 GOOD",
    rarity: "COMMON",
    effect: "Add +50 to your turn total.",
    flavourText: "Sometimes the board just opens up.",
    energyCost: 1,
    artworkUrl: "/artwork/power-surge-50.png",
  } as const;

  export default function PowerSurge50({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  