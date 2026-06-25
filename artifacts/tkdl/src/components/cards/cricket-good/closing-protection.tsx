import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: Once you open a number, opponent can't close it this leg.
  const cardData = {
    id: 306,
    name: "Closing Protection",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "Once you open a number, opponent can't close it this leg.",
    flavourText: "Open territory stays open.",
    energyCost: 2,
    artworkUrl: "/card-artwork/closing-protection.png",
  } as const;

  export default function ClosingProtection({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  