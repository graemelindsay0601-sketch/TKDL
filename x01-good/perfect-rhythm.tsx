import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · COMMON
  // Effect: All your darts this turn score +10 each.
  const cardData = {
    id: 109,
    name: "Perfect Rhythm",
    category: "X01 GOOD",
    rarity: "COMMON",
    effect: "All your darts this turn score +10 each.",
    flavourText: "Three darts. One heartbeat.",
    energyCost: 1,
    artworkUrl: "/artwork/perfect-rhythm.png",
  } as const;

  export default function PerfectRhythm({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  