import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · COMMON
  // Effect: If you're behind in points, all your marks count at 1.5x toward opening.
  const cardData = {
    id: 313,
    name: "Comeback Marks",
    category: "CRICKET GOOD",
    rarity: "COMMON",
    effect: "If you're behind in points, all your marks count at 1.5x toward opening.",
    flavourText: "The deficit breeds the hunger.",
    energyCost: 1,
    artworkUrl: "/card-artwork/comeback-marks.png",
  } as const;

  export default function ComebackMarks({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  