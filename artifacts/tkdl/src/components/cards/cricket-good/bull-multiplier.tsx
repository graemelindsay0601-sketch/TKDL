import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: When you hit Bull, it counts as marking any 3 numbers you choose.
  const cardData = {
    id: 311,
    name: "Bull Multiplier",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "When you hit Bull, it counts as marking any 3 numbers you choose.",
    flavourText: "One bull. Three gains.",
    energyCost: 2,
    artworkUrl: "/card-artwork/bull-multiplier.png",
  } as const;

  export default function BullMultiplier({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  