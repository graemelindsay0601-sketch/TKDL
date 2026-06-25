import { TKDLCard } from "../TKDLCard";

// X01 GOOD · COMMON
// Effect: When you check out, gain +20 bonus if your checkout was on a double.
const cardData = {
  id: 102,
  name: "Checkout Specialist",
  category: "X01 GOOD",
  rarity: "COMMON",
  effect: "When you check out, gain +20 bonus if your checkout was on a double.",
  flavourText: "The double at the end is where champions are made.",
  energyCost: 1,
  artworkUrl: "/card-artwork/checkout-specialist.jpg",
} as const;

export default function CheckoutSpecialist({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
  return <TKDLCard card={cardData} size={size} />;
}

export { cardData };
