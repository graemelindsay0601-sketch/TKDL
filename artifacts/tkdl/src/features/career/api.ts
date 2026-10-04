import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetchJson, ApiRequestError } from "@/lib/api-fetch";
import type {
  AdvanceResult, CalendarResponse, CareerSave, CareerSaveList, EventDetail, FinanceSummary, HistoryRow, LedgerEntry, Milestone, QSchoolView,
  QualificationResponse, RankingExplain, RankingHistory, RankingListMeta, RankingTable, SponsorsResponse, SportingSummary, TourCardView,
} from "./types";

/**
 * Thin client over the real A1–A5 Career API (mounted at /api/career). Every
 * Career response is Cache-Control: no-store server-side; React Query only
 * de-duplicates concurrent reads and shares one copy per key across components.
 * Mutations invalidate the whole save so every screen re-reads authoritative state.
 */
const BASE = "/api/career";
const get = <T,>(path: string) => apiFetchJson<T>(`${BASE}${path}`, { credentials: "same-origin", cache: "no-store" });
const send = <T,>(method: "POST" | "DELETE", path: string, body?: unknown) => apiFetchJson<T>(`${BASE}${path}`, {
  method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
});
const qs = (params: Record<string, string | number | undefined | null>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string | number][];
  return entries.length ? `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")}` : "";
};
const STALE = 10_000;
export const careerKey = (saveId: string, ...rest: unknown[]) => ["career", saveId, ...rest] as const;

// ---------------------------------------------------------------- reads
export const useCareerSaves = (enabled = true) => useQuery({ queryKey: ["career", "saves"], queryFn: () => get<CareerSaveList>("/saves"), enabled, staleTime: STALE, retry: false });
export const useCareerSave = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "save"), queryFn: () => get<CareerSave>(`/saves/${saveId}`), staleTime: STALE });
export const useSporting = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "sporting"), queryFn: () => get<SportingSummary>(`/saves/${saveId}/sporting`), staleTime: STALE });
export type CalendarQuery = { scope?: "WORLD" | "MY_SCHEDULE" | "AVAILABLE" | "FEATURED"; season?: number; fromWeek?: number; toWeek?: number; circuit?: string; classification?: string };
export const useCalendar = (saveId: string, q: CalendarQuery, enabled = true) => useQuery({ queryKey: careerKey(saveId, "calendar", q), enabled, staleTime: STALE,
  queryFn: () => get<CalendarResponse>(`/saves/${saveId}/calendar${qs(q)}`) });
export const useEvent = (saveId: string, eventId: string) => useQuery({ queryKey: careerKey(saveId, "event", eventId), queryFn: () => get<EventDetail>(`/saves/${saveId}/events/${eventId}`), staleTime: STALE });
export const useEventFinance = (saveId: string, eventId: string) => useQuery({ queryKey: careerKey(saveId, "event-finance", eventId), staleTime: STALE,
  queryFn: () => get<{ eventId: string; status: string; preview: unknown; actuals: Record<string, unknown> | null }>(`/saves/${saveId}/events/${eventId}/finance`) });
export const useHistory = (saveId: string, q: { participant?: string; season?: number; definition?: string } = { participant: "HUMAN" }) => useQuery({ queryKey: careerKey(saveId, "history", q), staleTime: STALE,
  queryFn: () => get<HistoryRow[]>(`/saves/${saveId}/history${qs(q)}`) });
export const useFinance = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "finance"), queryFn: () => get<FinanceSummary>(`/saves/${saveId}/finance`), staleTime: STALE });
export const useLedger = (saveId: string, limit = 25, before?: { beforeCreatedAt: string; beforeId: string } | null) => useQuery({ queryKey: careerKey(saveId, "ledger", limit, before ?? null), staleTime: STALE,
  queryFn: () => get<{ entries: LedgerEntry[]; next: { beforeCreatedAt: string; beforeId: string } | null }>(`/saves/${saveId}/finance/ledger${qs({ limit, ...(before ?? {}) })}`) });
export const useSponsors = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "sponsors"), queryFn: () => get<SponsorsResponse>(`/saves/${saveId}/sponsors`), staleTime: STALE });
export const useRankingLists = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "ranking-lists"), queryFn: () => get<RankingListMeta[]>(`/saves/${saveId}/rankings`), staleTime: STALE });
export type TableQuery = { view: "TOP" | "AROUND" | "PAGE"; limit?: number; offset?: number; participant?: string; radius?: number };
export const useRankingTable = (saveId: string, list: string, q: TableQuery, enabled = true) => useQuery({ queryKey: careerKey(saveId, "ranking", list, q), enabled, staleTime: STALE,
  queryFn: () => get<RankingTable>(`/saves/${saveId}/rankings/${encodeURIComponent(list)}${qs(q)}`) });
export const useRankingHistory = (saveId: string, list: string, participant = "HUMAN", limit = 52) => useQuery({ queryKey: careerKey(saveId, "ranking-history", list, participant, limit), staleTime: STALE,
  queryFn: () => get<RankingHistory>(`/saves/${saveId}/rankings/${encodeURIComponent(list)}/history${qs({ participant, limit })}`) });
export const useRankingExplain = (saveId: string, list: string, participant = "HUMAN", enabled = true) => useQuery({ queryKey: careerKey(saveId, "ranking-explain", list, participant), enabled, staleTime: STALE,
  queryFn: () => get<RankingExplain>(`/saves/${saveId}/rankings/${encodeURIComponent(list)}/explain${qs({ participant })}`) });
export const useTourCard = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "tour-card"), queryFn: () => get<TourCardView>(`/saves/${saveId}/tour-card`), staleTime: STALE });
export const useQSchool = (saveId: string, season?: number) => useQuery({ queryKey: careerKey(saveId, "q-school", season ?? null), staleTime: STALE,
  queryFn: () => get<QSchoolView>(`/saves/${saveId}/q-school${qs({ season })}`) });
export const useQualification = (saveId: string, q: { eventId?: string; fromWeek?: number; weeks?: number }, enabled = true) => useQuery({ queryKey: careerKey(saveId, "qualification", q), enabled, staleTime: STALE,
  queryFn: () => get<QualificationResponse>(`/saves/${saveId}/qualification${qs(q)}`) });
export const useMilestones = (saveId: string, limit = 50) => useQuery({ queryKey: careerKey(saveId, "milestones", limit), staleTime: STALE,
  queryFn: () => get<{ participantKey: string; milestones: Milestone[] }>(`/saves/${saveId}/milestones${qs({ limit })}`) });

// ---------------------------------------------------------------- mutations (each maps 1:1 to a real backend action)
function useSaveMutation<TArgs, TOut>(saveId: string, fn: (args: TArgs) => Promise<TOut>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: async () => { await client.invalidateQueries({ queryKey: ["career", saveId] }); await client.invalidateQueries({ queryKey: ["career", "saves"] }); } });
}
export const useEnterEvent = (saveId: string) => useSaveMutation(saveId, (eventId: string) =>
  send<{ entered: boolean; created: boolean; denials: string[] }>("POST", `/saves/${saveId}/events/${eventId}/entry`));
export const useWithdrawEvent = (saveId: string) => useSaveMutation(saveId, (eventId: string) =>
  send<{ withdrawn: boolean; postLock?: boolean; denials: string[] }>("DELETE", `/saves/${saveId}/events/${eventId}/entry`));
export const useAcceptOffer = (saveId: string) => useSaveMutation(saveId, (offerId: string) => send<{ contractId: string }>("POST", `/saves/${saveId}/sponsors/offers/${offerId}/accept`));
export const useDeclineOffer = (saveId: string) => useSaveMutation(saveId, (offerId: string) => send<unknown>("POST", `/saves/${saveId}/sponsors/offers/${offerId}/decline`));
/** A3 advance: retry-safe via a client-generated operation key; expected position guards against stale screens. */
export const useAdvance = (saveId: string) => useSaveMutation(saveId, (args: { season: number; week: number; target: { kind: "NEXT_MEANINGFUL" } | { kind: "WEEKS"; weeks: number } }) =>
  send<AdvanceResult>("POST", `/saves/${saveId}/calendar/advance`, { operationKey: newOperationKey(), expectedSeason: args.season, expectedWeek: args.week, target: args.target }));

export function useSaveLifecycle() {
  const client = useQueryClient();
  const settle = { onSettled: () => client.invalidateQueries({ queryKey: ["career"] }) };
  return {
    create: useMutation({ ...settle, mutationFn: async (body: { slot: number; careerName?: string; difficulty?: string }) => {
      const save = await send<CareerSave>("POST", "/saves", body);
      await send("POST", `/saves/${save.id}/initialize`, {}); // A2 world, A3 calendar, A4 finance, A5 sporting state
      return save;
    } }),
    initialize: useMutation({ ...settle, mutationFn: (saveId: string) => send<unknown>("POST", `/saves/${saveId}/initialize`, {}) }),
    restart: useMutation({ ...settle, mutationFn: async (saveId: string) => {
      const save = await send<CareerSave>("POST", `/saves/${saveId}/restart`, {});
      await send("POST", `/saves/${save.id}/initialize`, {});
      return save;
    } }),
    retire: useMutation({ ...settle, mutationFn: (saveId: string) => send<CareerSave>("POST", `/saves/${saveId}/retire`, {}) }),
    remove: useMutation({ ...settle, mutationFn: (saveId: string) => apiFetchJson<unknown>(`${BASE}/saves/${saveId}`, { method: "DELETE", credentials: "same-origin" }).catch(e => {
      // 204 No Content has no JSON body; apiFetchJson rejects on parse — treat any non-HTTP error as success only for 204.
      if (e instanceof ApiRequestError) throw e; return null;
    }) }),
  };
}

export function newOperationKey() {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `ui-${random}`.replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 100);
}
export const errorMessage = (e: unknown) => e instanceof ApiRequestError ? e.message : e instanceof Error ? e.message : "Something went wrong";
export const errorStatus = (e: unknown) => e instanceof ApiRequestError ? e.status : null;
