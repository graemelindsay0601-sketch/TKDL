import { TKDLCard } from "../TKDLCard";

  // X01 GOOD · LEGENDARY
  // Effect: Your darts can't miss the board — any complete miss is redirected to segment 5.
  const cardData = {
    id: 116,
    name: "Steady Hand",
    category: "X01 GOOD",
    rarity: "LEGENDARY",
    effect: "Your darts can't miss the board — any complete miss is redirected to segment 5.",
    flavourText: "The hand that never falters.",
    energyCost: 3,
    artworkUrl: "/card-artwork/steady-hand.png",
  } as const;

  export default function SteadyHand({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  