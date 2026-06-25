import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · RARE
  // Effect: Target can't score on any segment 15–20 this turn — only 1–14 and Bull.
  const cardData = {
    id: 217,
    name: "Dead Zone",
    category: "X01 BAD",
    rarity: "RARE",
    effect: "Target can't score on any segment 15–20 this turn — only 1–14 and Bull.",
    flavourText: "The high numbers are gone.",
    energyCost: 2,
    artworkUrl: "/artwork/dead-zone.png",
  } as const;

  export default function DeadZone({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  