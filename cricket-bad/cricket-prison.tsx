import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · COMMON
  // Effect: Target can only hit 15, 19, 20 — only 3 of the 7 cricket numbers mark.
  const cardData = {
    id: 414,
    name: "Cricket Prison",
    category: "CRICKET BAD",
    rarity: "COMMON",
    effect: "Target can only hit 15, 19, 20 — only 3 of the 7 cricket numbers mark.",
    flavourText: "Three numbers. Four locked away.",
    energyCost: 1,
    artworkUrl: "/artwork/cricket-prison.png",
  } as const;

  export default function CricketPrison({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  