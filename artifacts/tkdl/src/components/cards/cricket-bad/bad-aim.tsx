import { TKDLCard } from "../TKDLCard";

  // CRICKET BAD · COMMON
  // Effect: Target's marks count at 50% value toward opening or closing.
  const cardData = {
    id: 401,
    name: "Bad Aim",
    category: "CRICKET BAD",
    rarity: "COMMON",
    effect: "Target's marks count at 50% value toward opening or closing.",
    flavourText: "Half the marks for double the throws.",
    energyCost: 1,
    artworkUrl: "/card-artwork/bad-aim.png",
  } as const;

  export default function BadAim({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
    return <TKDLCard card={cardData} size={size} />;
  }

  export { cardData };
  