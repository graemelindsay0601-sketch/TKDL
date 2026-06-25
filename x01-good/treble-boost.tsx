import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · RARE
  // Effect: Your trebles count at 1.4x this turn — T20 becomes 84 instead of 60.
  const cardData = {
    id: 113,
    name: "Treble Boost",
    category: "X01 GOOD",
    rarity: "RARE",
    effect: "Your trebles count at 1.4x this turn — T20 becomes 84 instead of 60.",
    flavourText: "Push that wire just a fraction further.",
    energyCost: 2,
    artworkUrl: "/artwork/treble-boost.png",
  } as const;

  export default function TrebleBoost({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  