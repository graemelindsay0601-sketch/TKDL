import { TKDLCard } from "../TKDLCard";

  // WILDCARD BAD · LEGENDARY
  // Effect: Target's next leg score reduced by 100 OR loses 1 opened number — whichever game mode.
  const cardData = {
    id: 606,
    name: "Total Annihilation",
    category: "WILDCARD BAD",
    rarity: "LEGENDARY",
    effect: "Target's next leg score reduced by 100 OR loses 1 opened number — whichever game mode.",
    flavourText: "No mercy. No survivors.",
    energyCost: 3,
    artworkUrl: "/card-artwork/total-annihilation.png",
  } as const;

  export default function TotalAnnihilation({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  