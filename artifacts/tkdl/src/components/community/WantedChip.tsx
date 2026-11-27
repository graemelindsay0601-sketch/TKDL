import { Crosshair } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import "./league-cards.css";

export type Bounty = { id: number; playerId: number; name: string; reason: string; reasonText: string; level: 1 | 2 | 3; levelName: string; since: string };

export function useBounties(): Bounty[] {
  const { data } = useFetch<Bounty[]>("/api/community/bounties");
  return data ?? [];
}

/** "WANTED" chip next to a player with a live bounty on them (Standings, profile). */
export function WantedChip({ playerId, size = "sm" }: { playerId: number | null | undefined; size?: "sm" | "lg" }) {
  const b = useBounties().find(x => x.playerId === playerId);
  if (!b) return null;
  return (
    <span className={`lc-wanted l${b.level}${size === "lg" ? " lg" : ""}`} title={`${b.levelName} bounty: ${b.reasonText}. Beat them in a league match to claim it.`}>
      <Crosshair className={size === "lg" ? "w-3.5 h-3.5" : "w-2.5 h-2.5"} />Wanted
    </span>
  );
}
