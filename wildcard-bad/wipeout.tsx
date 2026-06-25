import { TKDLCard } from "../../TKDLCard";

  // WILDCARD BAD · RARE
  // Effect: Target's last 2 darts this leg score 0.
  const cardData = {
    id: 605,
    name: "Wipeout",
    category: "WILDCARD BAD",
    rarity: "RARE",
    effect: "Target's last 2 darts this leg score 0.",
    flavourText: "The finish disappears before your eyes.",
    energyCost: 2,
    artworkUrl: "/artwork/wipeout.png",
  } as const;

  export default function Wipeout({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  