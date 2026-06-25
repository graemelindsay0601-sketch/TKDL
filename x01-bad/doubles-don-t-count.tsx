import { TKDLCard } from "../../TKDLCard";

  // X01 BAD · RARE
  // Effect: Doubles count as singles this turn — D20 = 20, not 40.
  const cardData = {
    id: 205,
    name: "Doubles Don't Count",
    category: "X01 BAD",
    rarity: "RARE",
    effect: "Doubles count as singles this turn — D20 = 20, not 40.",
    flavourText: "Half the reward. All the effort.",
    energyCost: 2,
    artworkUrl: "/artwork/doubles-dont-count.png",
  } as const;

  export default function DoublesDonTCount({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  