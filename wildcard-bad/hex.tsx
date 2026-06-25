import { TKDLCard } from "../../TKDLCard";

  // WILDCARD BAD · RARE
  // Effect: All target's darts count at 50% value (X01) or marks at 50% (Cricket) this leg.
  const cardData = {
    id: 604,
    name: "Hex",
    category: "WILDCARD BAD",
    rarity: "RARE",
    effect: "All target's darts count at 50% value (X01) or marks at 50% (Cricket) this leg.",
    flavourText: "Cursed from the first dart.",
    energyCost: 2,
    artworkUrl: "/artwork/hex.png",
  } as const;

  export default function Hex({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  