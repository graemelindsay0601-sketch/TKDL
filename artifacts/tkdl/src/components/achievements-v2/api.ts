import { useFetch } from "@/hooks/use-fetch";

/** Shapes from GET /api/achievements-v2/players/:id (server: lib/achievements-v2/view.ts). */
export type Metal = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
export type Area = "LEAGUE" | "TEAMS" | "PRACTICE" | "MASTER501" | "MODES" | "CAREER";
export type TrackView = { key: string; title: string; value: number; level: number; levels: number[]; metal: Metal | null; next: string | null;
  nextTarget: number | null; progress: number; unit: "%" | "rank" | null; scorer: boolean };
export type FeatView = { key: string; title: string; goal: string; earnedAt: string | null; secret: boolean; liveOnly: boolean; points: number; scorer: boolean; showpiece: boolean; reward?: string | null };
export type SeasonView = { key: string; title: string; goal: string; targets: number[]; value: number; completed: number; seasonsCompleted: number };
export type AreaView = { area: Area; name: string; score: number; tracks: TrackView[]; feats: FeatView[]; seasonGoals: SeasonView[]; earned: number; total: number; reward?: string | null };
export type PlayerView = { score: number; areas: AreaView[]; nearly: (TrackView & { area: Area })[]; metals: Record<Metal, number>; featsEarned: number };
export type RecentUnlock = { key: string; title: string; area: Area; kind: string; level: number; metal: Metal | null; coins: number; at: string };
export type PlayerResponse = { enabled: false } | { enabled: boolean; preview: boolean; view: PlayerView; recent: RecentUnlock[] };

export const METALS: Metal[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];
export const METAL_NAME: Record<Metal, string> = { BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum", DIAMOND: "Diamond" };

export function useAchievementsV2Status() {
  const { data } = useFetch<{ enabled: boolean; admin?: boolean }>("/api/achievements-v2/status");
  return data?.enabled ?? false;
}
/** Live, plus whether this session can preview it before launch (admin PIN entered). */
export function useAchievementsV2Access() {
  const { data } = useFetch<{ enabled: boolean; admin?: boolean }>("/api/achievements-v2/status");
  return { enabled: data?.enabled ?? false, admin: !!data?.admin, loaded: !!data };
}

/** A player's achievements. `preview` asks for the admin preview before launch (the server only allows it for a verified admin). */
export function useAchievementsV2(playerId: number | null, preview = false) {
  return useFetch<PlayerResponse>(playerId ? `/api/achievements-v2/players/${playerId}${preview ? "?preview=1" : ""}` : null);
}

export const fmt = (n: number, unit: "%" | "rank" | null = null) => unit === "rank" ? (n > 0 ? `#${n}` : "unranked") : n.toLocaleString("en-GB") + (unit ?? "");
/** A season goal's text for its next target (or the last one once all are done). */
export const seasonGoalText = (g: SeasonView) => g.goal.replace("{n}", fmt(g.targets[Math.min(g.completed, g.targets.length - 1)]));
