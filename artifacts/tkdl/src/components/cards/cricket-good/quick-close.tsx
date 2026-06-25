import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · COMMON
  // Effect: If you close your number by dart 2, get a free mark on the next number.
  const cardData = {
    id: 316,
    name: "Quick Close",
    category: "CRICKET GOOD",
    rarity: "COMMON",
    effect: "If you close your number by dart 2, get a free mark on the next number.",
    flavourText: "Speed is its own reward.",
    energyCost: 1,
    artworkUrl: "/card-artwork/quick-close.png",
  } as const;

  export default function QuickClose({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  