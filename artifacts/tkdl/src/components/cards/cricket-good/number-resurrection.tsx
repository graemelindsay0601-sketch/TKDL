import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · LEGENDARY
  // Effect: One closed number becomes fresh and reopenable again — opponent's marks reset.
  const cardData = {
    id: 304,
    name: "Number Resurrection",
    category: "CRICKET GOOD",
    rarity: "LEGENDARY",
    effect: "One closed number becomes fresh and reopenable again — opponent's marks reset.",
    flavourText: "What was closed can be reopened.",
    energyCost: 3,
    artworkUrl: "/card-artwork/number-resurrection.png",
  } as const;

  export default function NumberResurrection({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  