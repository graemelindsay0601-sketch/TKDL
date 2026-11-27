import { Crown } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import "./gaffer.css";

/** The current Gaffer's player id (null when there isn't one or the feature isn't visible). */
export function useCurrentGafferId(): number | null {
  const { data } = useFetch<{ id: number | null }>("/api/gaffer/current");
  return data?.id ?? null;
}

/** Gold armband shown next to the current Gaffer's name for their month. */
export function GafferArmband({ playerId, size = "sm" }: { playerId: number | null | undefined; size?: "sm" | "lg" }) {
  const id = useCurrentGafferId();
  if (!id || id !== playerId) return null;
  return <span className={`gf-armband${size === "lg" ? " lg" : ""}`} title="This month's Gaffer"><Crown className={size === "lg" ? "w-3.5 h-3.5" : "w-2.5 h-2.5"} />Gaffer</span>;
}
