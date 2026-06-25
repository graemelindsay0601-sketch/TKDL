import { TKDLCard } from "../TKDLCard";

  // WILDCARD GOOD · COMMON
  // Effect: If you're behind overall, gain +50 bonus this leg.
  const cardData = {
    id: 507,
    name: "Underdog",
    category: "WILDCARD GOOD",
    rarity: "COMMON",
    effect: "If you're behind overall, gain +50 bonus this leg.",
    flavourText: "Nobody's backing you. Do it anyway.",
    energyCost: 1,
    artworkUrl: "/card-artwork/underdog.png",
  } as const;

  export default function Underdog({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  