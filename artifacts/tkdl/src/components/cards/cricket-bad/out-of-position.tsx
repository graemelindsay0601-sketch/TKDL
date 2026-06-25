import { TKDLCard } from "../TKDLCard";

  // CRICKET BAD · COMMON
  // Effect: Target can't hit high-value numbers — 20, 19, 18 all score 0 this turn.
  const cardData = {
    id: 403,
    name: "Out of Position",
    category: "CRICKET BAD",
    rarity: "COMMON",
    effect: "Target can't hit high-value numbers — 20, 19, 18 all score 0 this turn.",
    flavourText: "Wrong side of the board.",
    energyCost: 1,
    artworkUrl: "/card-artwork/out-of-position.png",
  } as const;

  export default function OutOfPosition({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  