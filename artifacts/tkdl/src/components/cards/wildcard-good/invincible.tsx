import { TKDLCard } from "../TKDLCard";

  // WILDCARD GOOD · LEGENDARY
  // Effect: Your next turn is completely unaffected by any opponent penalty cards.
  const cardData = {
    id: 510,
    name: "Invincible",
    category: "WILDCARD GOOD",
    rarity: "LEGENDARY",
    effect: "Your next turn is completely unaffected by any opponent penalty cards.",
    flavourText: "Not tonight.",
    energyCost: 3,
    artworkUrl: "/card-artwork/invincible.png",
  } as const;

  export default function Invincible({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  