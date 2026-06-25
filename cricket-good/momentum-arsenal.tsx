import { TKDLCard } from "../../TKDLCard";

  // CRICKET GOOD · COMMON
  // Effect: Each successful mark builds +10 point bonus — stacks through the turn.
  const cardData = {
    id: 317,
    name: "Momentum Arsenal",
    category: "CRICKET GOOD",
    rarity: "COMMON",
    effect: "Each successful mark builds +10 point bonus — stacks through the turn.",
    flavourText: "Stack the marks. Stack the points.",
    energyCost: 1,
    artworkUrl: "/artwork/momentum-arsenal.png",
  } as const;

  export default function MomentumArsenal({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  