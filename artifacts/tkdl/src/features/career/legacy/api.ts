import { useQuery } from "@tanstack/react-query";
import { apiFetchJson } from "@/lib/api-fetch";
import { careerKey } from "../api";
export type PlayerLegacy = import("../../../../../api-server/src/career/legacy/player").PlayerLegacy;
export type Chapter = import("../../../../../api-server/src/career/legacy/player").Chapter;
export type Moment = import("../../../../../api-server/src/career/legacy/player").Moment;
export type SeasonRow = import("../../../../../api-server/src/career/legacy/player").SeasonRow;

/** Workstream D: one owned, bounded read of the player's legacy (no-store on the server). */
export const usePlayerLegacy = (saveId: string, enabled = true) => useQuery({
  queryKey: careerKey(saveId, "legacy-player"), enabled, staleTime: 30_000,
  queryFn: () => apiFetchJson<PlayerLegacy>(`/api/career/saves/${saveId}/legacy/player`, { credentials: "same-origin", cache: "no-store" }),
});
