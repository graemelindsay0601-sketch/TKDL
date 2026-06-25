import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · LEGENDARY
  // Effect: Trebles count as singles this turn — T20 = 20, not 60.
  const cardData = {
    id: 216,
    name: "Treble Curse",
    category: "X01 BAD",
    rarity: "LEGENDARY",
    effect: "Trebles count as singles this turn — T20 = 20, not 60.",
    flavourText: "The wire bites back.",
    energyCost: 3,
    artworkUrl: "/artwork/treble-curse.png",
  } as const;

  export default function TrebleCurse({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  