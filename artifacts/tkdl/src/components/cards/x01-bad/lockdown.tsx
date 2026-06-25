import { TKDLCard } from "../TKDLCard";

  // X01 BAD · LEGENDARY
  // Effect: Choose one segment — target can only score on that number all turn.
  const cardData = {
    id: 220,
    name: "Lockdown",
    category: "X01 BAD",
    rarity: "LEGENDARY",
    effect: "Choose one segment — target can only score on that number all turn.",
    flavourText: "One number. One chance.",
    energyCost: 3,
    artworkUrl: "/card-artwork/lockdown.png",
  } as const;

  export default function Lockdown({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  