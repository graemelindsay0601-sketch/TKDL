import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · RARE
  // Effect: Target cannot close any numbers this turn — marks cap at 2.
  const cardData = {
    id: 412,
    name: "Closing Blocker",
    category: "CRICKET BAD",
    rarity: "RARE",
    effect: "Target cannot close any numbers this turn — marks cap at 2.",
    flavourText: "Close enough. Not close enough.",
    energyCost: 2,
    artworkUrl: "/artwork/closing-blocker.png",
  } as const;

  export default function ClosingBlocker({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  