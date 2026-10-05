import type { CareerFacts } from "../../../../api-server/src/career/facts/types";
import type { CareerRelationships } from "../../../../api-server/src/career/relationships/types";
import type { RecognitionView } from "../../../../api-server/src/career/recognition/types";
import type { Focus, GoalDefinition, GoalsView } from "../../../../api-server/src/career/goals/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetchJson, ApiRequestError } from "@/lib/api-fetch";
import type {
  AdvanceResult, CalendarResponse, CareerSave, CareerSaveList, EventDetail, FinanceSummary, HistoryRow, LedgerEntry, Milestone, QSchoolView,
  QualificationResponse, CareerProfile, LiveSession, LiveDart, RankingExplain, RankingHistory, RankingListMeta, RankingTable, SponsorsResponse, SportingSummary, TourCardView,
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

export const useCareerFacts = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "facts"), queryFn: () => get<CareerFacts>(`/saves/${saveId}/facts`), staleTime: STALE });
export const useCareerRelationships = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "relationships"), queryFn: () => get<CareerRelationships>(`/saves/${saveId}/relationships`), staleTime: STALE });
export const useCareerRecognition = (saveId: string, enabled = true) => useQuery({ queryKey: careerKey(saveId, "recognition"), queryFn: () => get<RecognitionView>(`/saves/${saveId}/recognition`), enabled, staleTime: STALE });
export const useNpcRecognition = (saveId: string, npcId?: string) => useQuery({ queryKey: careerKey(saveId, "recognition", "npc", npcId ?? ""), queryFn: () => get<RecognitionView>(`/saves/${saveId}/recognition/npcs/${npcId}`), enabled:!!npcId, staleTime: STALE });
export const useCareerGoals = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "goals"), queryFn: () => get<GoalsView>(`/saves/${saveId}/goals`), staleTime: STALE });
export const useCareerFocus = (saveId: string) => useSaveMutation(saveId, (focus: Focus) => send<{focus:Focus}>("POST",`/saves/${saveId}/focus`,{focus}));
export const useCreateCareerGoal = (saveId: string) => useSaveMutation(saveId, (body: {requestKey:string;definition:GoalDefinition}) => send<{id:string;created:boolean}>("POST",`/saves/${saveId}/goals`,body));
export const useAbandonCareerGoal = (saveId: string) => useSaveMutation(saveId, (goalId:string) => send<{id:string;status:string}>("POST",`/saves/${saveId}/goals/${goalId}/abandon`,{}));

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
/**
 * Every Career write the UI can perform, as plain request functions (unit-tested
 * against a mocked fetch). There is intentionally NO function for reporting a human
 * match result: A3 keeps that boundary server-side (see pages/match-boundary.tsx).
 */
export type EntryResult = { entered: boolean; created: boolean; denials: string[] };
export type WithdrawResult = { withdrawn: boolean; postLock?: boolean; denials: string[] };
export type AdvanceTarget = { kind: "NEXT_MEANINGFUL" } | { kind: "WEEKS"; weeks: number };
export const careerRequests = {
  enter: (saveId: string, eventId: string) => send<EntryResult>("POST", `/saves/${saveId}/events/${eventId}/entry`),
  withdraw: (saveId: string, eventId: string) => send<WithdrawResult>("DELETE", `/saves/${saveId}/events/${eventId}/entry`),
  acceptOffer: (saveId: string, offerId: string) => send<{ contractId: string }>("POST", `/saves/${saveId}/sponsors/offers/${offerId}/accept`),
  declineOffer: (saveId: string, offerId: string) => send<unknown>("POST", `/saves/${saveId}/sponsors/offers/${offerId}/decline`),
  /** A3 advance: retry-safe via a client-generated operation key; expected position guards against stale screens. */
  advance: (saveId: string, args: { season: number; week: number; target: AdvanceTarget }, operationKey = newOperationKey()) =>
    send<AdvanceResult>("POST", `/saves/${saveId}/calendar/advance`, { operationKey, expectedSeason: args.season, expectedWeek: args.week, target: args.target }),
  /** Idempotent composed initialize: A2 world, A3 calendar, A4 finance, A5 sporting state. */
  initialize: (saveId: string) => send<unknown>("POST", `/saves/${saveId}/initialize`, {}),
  create: async (body: { slot: number; careerName?: string; difficulty?: string; dateOfBirth?: string; homeLocality?: string }) => {
    const save = await send<CareerSave>("POST", "/saves", body);
    await careerRequests.initialize(save.id);
    return save;
  },
  /** A1 restart returns a NEW save id in the same slot; the client must adopt it. */
  restart: async (saveId: string) => {
    const save = await send<CareerSave>("POST", `/saves/${saveId}/restart`, {});
    await careerRequests.initialize(save.id);
    return save;
  },
  retire: (saveId: string) => send<CareerSave>("POST", `/saves/${saveId}/retire`, {}),
  /** A1 delete answers 204 No Content; any other outcome (HTTP error or network failure) rejects. */
  remove: async (saveId: string) => {
    const response = await fetch(`${BASE}/saves/${saveId}`, { method: "DELETE", credentials: "same-origin" });
    if (response.status === 204 || response.ok) return null;
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiRequestError(body?.error ?? `Request failed (${response.status})`, response.status, `${BASE}/saves/${saveId}`);
  },
};

function useSaveMutation<TArgs, TOut>(saveId: string, fn: (args: TArgs) => Promise<TOut>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: async () => { await client.invalidateQueries({ queryKey: ["career", saveId] }); await client.invalidateQueries({ queryKey: ["career", "saves"] }); } });
}
export const useEnterEvent = (saveId: string) => useSaveMutation(saveId, (eventId: string) => careerRequests.enter(saveId, eventId));
export const useWithdrawEvent = (saveId: string) => useSaveMutation(saveId, (eventId: string) => careerRequests.withdraw(saveId, eventId));
export const useAcceptOffer = (saveId: string) => useSaveMutation(saveId, (offerId: string) => careerRequests.acceptOffer(saveId, offerId));
export const useDeclineOffer = (saveId: string) => useSaveMutation(saveId, (offerId: string) => careerRequests.declineOffer(saveId, offerId));
export const useAdvance = (saveId: string) => useSaveMutation(saveId, (args: { season: number; week: number; target: AdvanceTarget }) => careerRequests.advance(saveId, args));

export function useSaveLifecycle() {
  const client = useQueryClient();
  const settle = { onSettled: () => client.invalidateQueries({ queryKey: ["career"] }) };
  return {
    create: useMutation({ ...settle, mutationFn: careerRequests.create }),
    initialize: useMutation({ ...settle, mutationFn: careerRequests.initialize }),
    restart: useMutation({ ...settle, mutationFn: careerRequests.restart }),
    retire: useMutation({ ...settle, mutationFn: careerRequests.retire }),
    remove: useMutation({ ...settle, mutationFn: careerRequests.remove }),
  };
}

export function newOperationKey() {
  const c: Crypto | undefined = typeof globalThis.crypto !== "undefined" ? globalThis.crypto : undefined;
  const random = c && typeof c.randomUUID === "function" ? c.randomUUID()
    : `${Date.now()}-${Array.from(c ? c.getRandomValues(new Uint32Array(2)) : [Date.now() >>> 0, performance.now() >>> 0], (n: number) => n.toString(36)).join("")}`;
  return `ui-${random}`.replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 100);
}
export const errorMessage = (e: unknown) => e instanceof ApiRequestError ? e.message : e instanceof Error ? e.message : "Something went wrong";
export const errorStatus = (e: unknown) => e instanceof ApiRequestError ? e.status : null;

// ---------------------------------------------------------------- A6.5 identity + live matches
export const useCareerProfile = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "profile"), queryFn: () => get<CareerProfile>(`/saves/${saveId}/profile`), staleTime: STALE });
export const useSetCareerProfile = (saveId: string) => {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body: { dateOfBirth: string; homeLocality?: string }) => apiFetchJson<CareerProfile>(`${BASE}/saves/${saveId}/profile`, {
    method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    onSettled: async () => { await client.invalidateQueries({ queryKey: ["career", saveId] }); } });
};
/** Existing session for a match, or null (404 = none yet). Never creates one. */
export const useLiveSession = (saveId: string, matchId: string | null | undefined) => useQuery({
  queryKey: careerKey(saveId, "live", matchId ?? "none"), enabled: !!matchId, staleTime: 2_000, retry: false,
  queryFn: async () => { try { return await get<LiveSession>(`/saves/${saveId}/matches/${matchId}/session`); } catch (e) { if (errorStatus(e) === 404) return null; throw e; } },
});
export const liveApi = {
  open: (saveId: string, matchId: string) => send<LiveSession>("POST", `/saves/${saveId}/matches/${matchId}/session`, {}),
  read: (saveId: string, matchId: string) => get<LiveSession>(`/saves/${saveId}/matches/${matchId}/session`),
  bull: (saveId: string, matchId: string, body: { throw: "INNER" | "OUTER" | "MISS"; expectedRevision: number }) => send<LiveSession>("POST", `/saves/${saveId}/matches/${matchId}/session/bull`, body),
  darts: (saveId: string, matchId: string, body: { darts: LiveDart[]; expectedRevision: number }) => apiFetchJson<LiveSession>(`${BASE}/saves/${saveId}/matches/${matchId}/session/darts`, {
    method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
};
