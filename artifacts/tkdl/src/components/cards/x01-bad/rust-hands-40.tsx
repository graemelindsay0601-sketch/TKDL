import { TKDLCard } from "../TKDLCard";

  // X01 BAD · COMMON
  // Effect: Target's next turn score is reduced by 40 points.
  const cardData = {
    id: 201,
    name: "Rust Hands -40",
    category: "X01 BAD",
    rarity: "COMMON",
    effect: "Target's next turn score is reduced by 40 points.",
    flavourText: "Some nights the grip just isn't there.",
    energyCost: 1,
    artworkUrl: "/card-artwork/rust-hands.png",
  } as const;

  export default function RustHands40({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  