import { TKDLCard } from "../TKDLCard";

  // X01 GOOD · RARE
  // Effect: Your next three darts score minimum 6 — no 1–5 segments this turn.
  const cardData = {
    id: 111,
    name: "Precision Strike",
    category: "X01 GOOD",
    rarity: "RARE",
    effect: "Your next three darts score minimum 6 — no 1–5 segments this turn.",
    flavourText: "Sloppy scores don't cut it here.",
    energyCost: 2,
    artworkUrl: "/card-artwork/precision-strike.png",
  } as const;

  export default function PrecisionStrike({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  