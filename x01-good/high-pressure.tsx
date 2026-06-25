import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · COMMON
  // Effect: If opponent is ahead in legs, gain +40 bonus this leg.
  const cardData = {
    id: 108,
    name: "High Pressure",
    category: "X01 GOOD",
    rarity: "COMMON",
    effect: "If opponent is ahead in legs, gain +40 bonus this leg.",
    flavourText: "The underdog always has something to prove.",
    energyCost: 1,
    artworkUrl: "/artwork/high-pressure.png",
  } as const;

  export default function HighPressure({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  