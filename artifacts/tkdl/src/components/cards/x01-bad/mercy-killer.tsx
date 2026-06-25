import { TKDLCard } from "../TKDLCard";

  // X01 BAD · COMMON
  // Effect: Target's turn is capped at 60 total.
  const cardData = {
    id: 210,
    name: "Mercy Killer",
    category: "X01 BAD",
    rarity: "COMMON",
    effect: "Target's turn is capped at 60 total.",
    flavourText: "Sixty and done.",
    energyCost: 1,
    artworkUrl: "/card-artwork/mercy-killer.png",
  } as const;

  export default function MercyKiller({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  