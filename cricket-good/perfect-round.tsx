import { TKDLCard } from "../../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: If all 3 darts mark this turn, gain +25 bonus.
  const cardData = {
    id: 310,
    name: "Perfect Round",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "If all 3 darts mark this turn, gain +25 bonus.",
    flavourText: "A clean sweep of three.",
    energyCost: 2,
    artworkUrl: "/artwork/perfect-round.png",
  } as const;

  export default function PerfectRound({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  