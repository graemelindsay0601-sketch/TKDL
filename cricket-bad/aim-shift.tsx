import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: Target's shots hit adjacent segments — 20→1/5, 19→3/7.
  const cardData = {
    id: 406,
    name: "Aim Shift",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "Target's shots hit adjacent segments — 20→1/5, 19→3/7.",
    flavourText: "The board shifted when they weren't looking.",
    energyCost: 2,
    artworkUrl: "/artwork/aim-shift.png",
  } as const;

  export default function AimShift({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  