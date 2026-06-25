import { TKDLCard } from "../../TKDLCard";

  // X01 GOOD · RARE
  // Effect: If on double, gain 1 free re-throw if you miss the first attempt.
  const cardData = {
    id: 106,
    name: "Checkout Confidence",
    category: "X01 GOOD",
    rarity: "RARE",
    effect: "If on double, gain 1 free re-throw if you miss the first attempt.",
    flavourText: "One chance wasn't enough — take another.",
    energyCost: 2,
    artworkUrl: "/artwork/checkout-confidence.png",
  } as const;

  export default function CheckoutConfidence({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  