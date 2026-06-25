import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: Target is locked to one number all turn — any other segment scores 0.
  const cardData = {
    id: 411,
    name: "Number Hex",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "Target is locked to one number all turn — any other segment scores 0.",
    flavourText: "Cursed to chase just one.",
    energyCost: 2,
    artworkUrl: "/artwork/number-hex.png",
  } as const;

  export default function NumberHex({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  