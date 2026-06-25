import { TKDLCard } from "../../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: Next 3 darts must hit the called number — any miss scores 0.
  const cardData = {
    id: 303,
    name: "Sniper Lock",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "Next 3 darts must hit the called number — any miss scores 0.",
    flavourText: "Lock on. Don't deviate.",
    energyCost: 2,
    artworkUrl: "/artwork/sniper-lock.png",
  } as const;

  export default function SniperLock({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  