import { TKDLCard } from "../TKDLCard";

  // X01 BAD · RARE
  // Effect: Target must complete all 3 darts before attempting to finish.
  const cardData = {
    id: 207,
    name: "Turn Enforcer",
    category: "X01 BAD",
    rarity: "RARE",
    effect: "Target must complete all 3 darts before attempting to finish.",
    flavourText: "No shortcuts tonight.",
    energyCost: 2,
    artworkUrl: "/card-artwork/turn-enforcer.png",
  } as const;

  export default function TurnEnforcer({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  