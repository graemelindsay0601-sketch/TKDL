import { TKDLCard } from "../TKDLCard";

  // CRICKET GOOD · RARE
  // Effect: All your marks count this turn AND you score at 1.5x.
  const cardData = {
    id: 319,
    name: "Perfect Form",
    category: "CRICKET GOOD",
    rarity: "RARE",
    effect: "All your marks count this turn AND you score at 1.5x.",
    flavourText: "Total control. Maximum return.",
    energyCost: 2,
    artworkUrl: "/card-artwork/perfect-form.png",
  } as const;

  export default function PerfectForm({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  