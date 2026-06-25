import { TKDLCard } from "../../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: When you hit the called number, marks count as 2 — closing twice as fast.
  const cardData = {
    id: 314,
    name: "Mark Accelerator",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "When you hit the called number, marks count as 2 — closing twice as fast.",
    flavourText: "Double speed. Same dart.",
    energyCost: 2,
    artworkUrl: "/artwork/mark-accelerator.png",
  } as const;

  export default function MarkAccelerator({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  