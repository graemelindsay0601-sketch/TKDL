import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · COMMON
  // Effect: Bull = auto-marks 2 numbers of your choice.
  const cardData = {
    id: 312,
    name: "Bullseye Rush",
    category: "CRICKET GOOD",
    rarity: "COMMON",
    effect: "Bull = auto-marks 2 numbers of your choice.",
    flavourText: "Centre board, double reward.",
    energyCost: 1,
    artworkUrl: "/card-artwork/bullseye-rush.png",
  } as const;

  export default function BullseyeRush({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  