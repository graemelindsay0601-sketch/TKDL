import { TKDLCard } from "../../TKDLCard";

  // CRICKET BAD · COMMON
  // Effect: Target's first dart this turn doesn't mark — only darts 2 and 3 count.
  const cardData = {
    id: 407,
    name: "Hesitation",
    category: "CRICKET BAD",
    rarity: "COMMON",
    effect: "Target's first dart this turn doesn't mark — only darts 2 and 3 count.",
    flavourText: "A moment's doubt costs a dart.",
    energyCost: 1,
    artworkUrl: "/artwork/hesitation.png",
  } as const;

  export default function Hesitation({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  