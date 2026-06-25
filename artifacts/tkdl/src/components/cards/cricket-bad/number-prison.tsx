import { TKDLCard } from "../TKDLCard";

  // CRICKET BAD · LEGENDARY
  // Effect: One random closed number is locked forever — target can never reopen it.
  const cardData = {
    id: 419,
    name: "Number Prison",
    category: "CRICKET BAD",
    rarity: "LEGENDARY",
    effect: "One random closed number is locked forever — target can never reopen it.",
    flavourText: "Some numbers stay closed.",
    energyCost: 3,
    artworkUrl: "/card-artwork/number-prison.png",
  } as const;

  export default function NumberPrison({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  