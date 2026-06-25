import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · COMMON
  // Effect: Automatically mark the called number without throwing — counts as 1 hit.
  const cardData = {
    id: 301,
    name: "Instant Mark",
    category: "CRICKET GOOD",
    rarity: "COMMON",
    effect: "Automatically mark the called number without throwing — counts as 1 hit.",
    flavourText: "Sometimes the board does the work.",
    energyCost: 1,
    artworkUrl: "/card-artwork/instant-mark.png",
  } as const;

  export default function InstantMark({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  