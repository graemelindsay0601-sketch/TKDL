import { TKDLCard } from "../TKDLCard";

  // CRICKET BAD · COMMON
  // Effect: All target's marks count as 1 this turn — regardless of single, double, or treble.
  const cardData = {
    id: 410,
    name: "Sluggish Marks",
    category: "CRICKET BAD",
    rarity: "COMMON",
    effect: "All target's marks count as 1 this turn — regardless of single, double, or treble.",
    flavourText: "Everything slows to a crawl.",
    energyCost: 1,
    artworkUrl: "/card-artwork/sluggish-marks.png",
  } as const;

  export default function SluggishMarks({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  