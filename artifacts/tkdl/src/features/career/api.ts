import type { CareerFacts } from "../../../../api-server/src/career/facts/types";
import type { LegacyView, SeasonReview, EventHistory, NpcHistory } from "../../../../api-server/src/career/legacy/types";
import type { CareerRelationships } from "../../../../api-server/src/career/relationships/types";
import type { RecognitionView } from "../../../../api-server/src/career/recognition/types";
import type { Focus, GoalDefinition, GoalsView } from "../../../../api-server/src/career/goals/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetchJson, ApiRequestError } from "@/lib/api-fetch";
import type {
  AdvanceResult, CalendarResponse, CareerSave, CareerSaveList, EventDetail, FinanceSummary, HistoryRow, LedgerEntry, Milestone, QSchoolView,
  QualificationResponse, CareerProfile, LiveSession, LiveDart, RankingExplain, RankingHistory, RankingListMeta, RankingTable, SponsorsResponse, SportingSummary, TourCardView,
  SponsorNegotiationChange, SponsorNegotiationResult, SponsorSigningReveal,
} from "./types";

/**
 * Thin client over the real A1–A5 Career API (mounted at /api/career). Every
 * Career response is Cache-Control: no-store server-side; React Query only
 * de-duplicates concurrent reads and caches ordinary reads for 30 seconds in
 * this browser. Live match/tournament queries keep their shorter freshness.
 * Mutations invalidate the whole save so every screen re-reads authoritative state.
 */
const BASE = "/api/career";
const get = <T,>(path: string) => apiFetchJson<T>(`${BASE}${path}`, { credentials: "same-origin", cache: "no-store" });
const send = <T,>(method: "POST" | "DELETE" | "PUT", path: string, body?: unknown) => apiFetchJson<T>(`${BASE}${path}`, {
  method, credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body),
});
const qs = (params: Record<string, string | number | undefined | null>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "") as [string, string | number][];
  return entries.length ? `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")}` : "";
};
const STALE = 30_000;
export const careerKey = (saveId: string, ...rest: unknown[]) => ["career", saveId, ...rest] as const;
export type TournamentView = import("../../../../api-server/src/career/tournament/service").TournamentView;
export const useTournament = (saveId:string,eventId:string) => useQuery({queryKey:careerKey(saveId,"tournament",eventId),queryFn:()=>get<TournamentView>(`/saves/${saveId}/tournaments/${eventId}`),staleTime:0});
export const useActiveTournament = (saveId:string,enabled=true) => useQuery({queryKey:careerKey(saveId,"tournaments"),queryFn:()=>get<{tournaments:{eventId:string;name:string;level:number;terminal:boolean}[]}>(`/saves/${saveId}/tournaments`),enabled,staleTime:0});
export const useTournamentAction = (saveId:string,eventId:string) => useSaveMutation(saveId,(input:{action:"group-bull"|"concede"|"withdraw"|"dismiss";body?:unknown})=>send("POST",`/saves/${saveId}/tournaments/${eventId}/${input.action}`,input.body));
export const useTournamentPresentation = (saveId:string) => useSaveMutation(saveId,(body:{mode:"FULL"|"BALANCED"|"QUICK";reducedMotion:boolean})=>send("POST",`/saves/${saveId}/tournaments/presentation`,body));

export const useCareerFacts = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "facts"), queryFn: () => get<CareerFacts>(`/saves/${saveId}/facts`), staleTime: STALE });
export const useCareerRelationships = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "relationships"), queryFn: () => get<CareerRelationships>(`/saves/${saveId}/relationships`), staleTime: STALE });
export const useCareerRecognition = (saveId: string, enabled = true) => useQuery({ queryKey: careerKey(saveId, "recognition"), queryFn: () => get<RecognitionView>(`/saves/${saveId}/recognition`), enabled, staleTime: STALE });
export const useCareerLife = (saveId:string,enabled=true) => useQuery({queryKey:careerKey(saveId,"life"),queryFn:()=>get<import("../../../../api-server/src/career/life/types").LifeView>(`/saves/${saveId}/life`),enabled,staleTime:STALE});
export const useNpcLife = (saveId:string,npcId:string) => useQuery({queryKey:careerKey(saveId,"life","npc",npcId),queryFn:()=>get<import("../../../../api-server/src/career/life/types").NpcLifeView>(`/saves/${saveId}/life/npcs/${npcId}`),staleTime:STALE});
export const useLifeChoice = (saveId:string) => useSaveMutation(saveId,(input:{kind:"moments"|"opportunities";id:string;choice:string})=>send("POST",`/saves/${saveId}/life/${input.kind}/${input.id}`,{choice:input.choice}));
export const useMerchandiseChoice = (saveId:string) => useSaveMutation(saveId,(choice:string)=>send("POST",`/saves/${saveId}/life/merchandise`,{choice}));
export const useNpcRecognition = (saveId: string, npcId?: string) => useQuery({ queryKey: careerKey(saveId, "recognition", "npc", npcId ?? ""), queryFn: () => get<RecognitionView>(`/saves/${saveId}/recognition/npcs/${npcId}`), enabled:!!npcId, staleTime: STALE });
export const useCareerGoals = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "goals"), queryFn: () => get<GoalsView>(`/saves/${saveId}/goals`), staleTime: STALE });
export const useCareerFocus = (saveId: string) => useSaveMutation(saveId, (focus: Focus) => send<{focus:Focus}>("POST",`/saves/${saveId}/focus`,{focus}));
export const useCreateCareerGoal = (saveId: string) => useSaveMutation(saveId, (body: {requestKey:string;definition:GoalDefinition}) => send<{id:string;created:boolean}>("POST",`/saves/${saveId}/goals`,body));
export const useAbandonCareerGoal = (saveId: string) => useSaveMutation(saveId, (goalId:string) => send<{id:string;status:string}>("POST",`/saves/${saveId}/goals/${goalId}/abandon`,{}));

// ---------------------------------------------------------------- reads
export const useCareerSaves = (enabled = true) => useQuery({ queryKey: ["career", "saves"], queryFn: () => get<CareerSaveList>("/saves"), enabled, staleTime: STALE, retry: false });
export const useCareerSave = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "save"), queryFn: () => get<CareerSave>(`/saves/${saveId}`), staleTime: STALE });
export const useSporting = (saveId: string, enabled=true) => useQuery({ queryKey: careerKey(saveId, "sporting"), queryFn: () => get<SportingSummary>(`/saves/${saveId}/sporting`), enabled, staleTime: STALE });
export type CalendarQuery = { scope?: "WORLD" | "MY_SCHEDULE" | "AVAILABLE" | "FEATURED"; season?: number; fromWeek?: number; toWeek?: number; circuit?: string; classification?: string };
export const useCalendar = (saveId: string, q: CalendarQuery, enabled = true) => useQuery({ queryKey: careerKey(saveId, "calendar", q), enabled, staleTime: STALE,
  queryFn: () => get<CalendarResponse>(`/saves/${saveId}/calendar${qs(q)}`) });
export const useEvent = (saveId: string, eventId: string) => useQuery({ queryKey: careerKey(saveId, "event", eventId), queryFn: () => get<EventDetail>(`/saves/${saveId}/events/${eventId}`), staleTime: STALE });
export const useEventFinance = (saveId: string, eventId: string) => useQuery({ queryKey: careerKey(saveId, "event-finance", eventId), staleTime: STALE,
  queryFn: () => get<{ eventId: string; status: string; preview: unknown; actuals: Record<string, unknown> | null }>(`/saves/${saveId}/events/${eventId}/finance`) });
export const useHistory = (saveId: string, q: { participant?: string; season?: number; definition?: string } = { participant: "HUMAN" }) => useQuery({ queryKey: careerKey(saveId, "history", q), staleTime: STALE,
  queryFn: () => get<HistoryRow[]>(`/saves/${saveId}/history${qs(q)}`) });
export const useFinance = (saveId: string, enabled=true) => useQuery({ queryKey: careerKey(saveId, "finance"), queryFn: () => get<FinanceSummary>(`/saves/${saveId}/finance`), enabled, staleTime: STALE });
export const useLedger = (saveId: string, limit = 25, before?: { beforeCreatedAt: string; beforeId: string } | null) => useQuery({ queryKey: careerKey(saveId, "ledger", limit, before ?? null), staleTime: STALE,
  queryFn: () => get<{ entries: LedgerEntry[]; next: { beforeCreatedAt: string; beforeId: string } | null }>(`/saves/${saveId}/finance/ledger${qs({ limit, ...(before ?? {}) })}`) });
export const useSponsors = (saveId: string) => useQuery({ queryKey: careerKey(saveId, "sponsors"), queryFn: () => get<SponsorsResponse>(`/saves/${saveId}/sponsors`), staleTime: STALE });
export type SponsorMarketRelationship = {id:string;npcId:string;npcName:string;sponsorKey:string;sponsorName:string;category:string;tier:string;
  status:string;startSeason:number;startWeek:number;endSeason:number|null;endWeek:number|null};
export type SponsorMarketEvent = {id:string;eventType:string;npcId:string;npcName:string;sponsorKey:string;sponsorName:string;season:number;week:number;
  title:string;summary:string;relationshipId:string;sourceEventId:string|null};
export type SponsorMarketResponse = {
  period: { season: number; week: number };
  relationships: SponsorMarketRelationship[];
  events: SponsorMarketEvent[];
  brandRosters:Array<{sponsorKey:string;sponsorName:string;category:string;tier:string;
    players:Array<{npcId:string;npcName:string;category:string;tier:string}>}>;
  npcCommercialProfiles:Array<{npcId:string;npcName:string;sponsors:SponsorMarketRelationship[];history:SponsorMarketEvent[]}>;
};
export const useSponsorMarket = (saveId: string) => useQuery({ queryKey: careerKey(saveId,"sponsor-market"),
  queryFn: () => get<SponsorMarketResponse>(`/saves/${saveId}/sponsors/market`), staleTime: STALE });
export const updateSponsorActivity = (saveId:string,activityId:string,action:"ACCEPT"|"DECLINE"|"SCHEDULE"|"COMPLETE",week?:number) =>
  send("PUT",`/saves/${saveId}/sponsors/activities/${activityId}`,{action,...(week===undefined?{}:{week})});
export const useWorldContent=(saveId:string)=>useQuery({queryKey:careerKey(saveId,"world-content"),queryFn:()=>get<import("../../../../api-server/src/career/content/service").WorldContent>(`/saves/${saveId}/world-content`),staleTime:STALE});
export const useWorldLocalities=(saveId:string,enabled=true)=>useQuery({queryKey:careerKey(saveId,"world-localities"),queryFn:()=>get<import("../../../../api-server/src/career/content/service").WorldLocalitiesContent>(`/saves/${saveId}/world-localities`),enabled,staleTime:STALE});
export const useWorldMap=(saveId:string,enabled=true)=>useQuery({queryKey:careerKey(saveId,"world-map"),queryFn:()=>get<import("../../../../api-server/src/career/content/service").MapContent>(`/saves/${saveId}/world-map`),enabled,staleTime:STALE});
export const useWorldPlayers=(saveId:string,offset=0,search="",status="ALL",id?:string)=>useQuery({queryKey:careerKey(saveId,"world-players",offset,search,status,id??null),queryFn:()=>get<import("../../../../api-server/src/career/content/service").WorldPlayersContent>(`/saves/${saveId}/world-players?offset=${offset}&limit=50&search=${encodeURIComponent(search)}&status=${status}${id?`&id=${id}`:""}`),staleTime:STALE});
export const useGuidance=(saveId:string)=>useQuery({queryKey:careerKey(saveId,"guidance"),queryFn:()=>get<{mode:string;dismissed:string[];canEdit:boolean}>(`/saves/${saveId}/guidance`),staleTime:STALE});
export const useEditGuidance=(saveId:string)=>useSaveMutation(saveId,(body:{mode?:string;dismiss?:string})=>send("PUT",`/saves/${saveId}/guidance`,body));
export const saveInitialShirt=(saveId:string,identity:Record<string,unknown>)=>send("POST",`/saves/${saveId}/presentation`,identity);
export const useTrophyCabinet=(saveId:string,offset=0)=>useQuery({queryKey:careerKey(saveId,"trophy-cabinet",offset),queryFn:()=>get<import("../../../../api-server/src/career/content/service").TrophyContent>(`/saves/${saveId}/trophy-cabinet?offset=${offset}&limit=50`),staleTime:STALE});
export const usePresentation=(saveId:string,enabled=true)=>useQuery({queryKey:careerKey(saveId,"presentation"),queryFn:()=>get<import("../../../../api-server/src/career/content/service").PresentationContent>(`/saves/${saveId}/presentation`),enabled,staleTime:STALE});
export const useEditPresentation=(saveId:string)=>useSaveMutation(saveId,(body:Record<string,unknown>)=>send("POST",`/saves/${saveId}/presentation`,body));
export const useLaunchSignature=(saveId:string)=>useSaveMutation(saveId,(body:{contractId:string;productType:"SIGNATURE_DARTS"|"SIGNATURE_RANGE"})=>send("POST",`/saves/${saveId}/signature-products`,body));
export const useEquipmentStudio=(saveId:string)=>useQuery({queryKey:careerKey(saveId,"equipment-studio"),queryFn:()=>get<any>(`/saves/${saveId}/equipment-studio`),staleTime:STALE});
export const useSaveEquipmentLoadout=(saveId:string)=>useSaveMutation(saveId,(body:unknown)=>send("PUT",`/saves/${saveId}/equipment-loadout`,body));
export const useCreateProductDraft=(saveId:string)=>useSaveMutation(saveId,(body:unknown)=>send("POST",`/saves/${saveId}/signature-product-drafts`,body));
export const useApproveProductDraft=(saveId:string)=>useSaveMutation(saveId,(draftId:string)=>send("POST",`/saves/${saveId}/signature-product-drafts/${draftId}/approve`));
export const useLaunchProductDraft=(saveId:string)=>useSaveMutation(saveId,(draftId:string)=>send("POST",`/saves/${saveId}/signature-product-drafts/${draftId}/launch`));
export const useRetireProductDraft=(saveId:string)=>useSaveMutation(saveId,(draftId:string)=>send("POST",`/saves/${saveId}/signature-product-drafts/${draftId}/retire`));
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
  acceptOffer: (saveId: string, offerId: string,replaceContractIds?:string[]) => send<{ contractId: string; sponsorKey: string; created: boolean; status: string; signingReveal: SponsorSigningReveal|null }>("POST", `/saves/${saveId}/sponsors/offers/${offerId}/accept`,replaceContractIds?.length?{replaceContractIds}:undefined),
  declineOffer: (saveId: string, offerId: string) => send<unknown>("POST", `/saves/${saveId}/sponsors/offers/${offerId}/decline`),
  negotiateOffer: (saveId: string, offerId: string, input: { requestKey: string; expectedRevision: number; change: SponsorNegotiationChange }) =>
    send<SponsorNegotiationResult>("POST", `/saves/${saveId}/sponsors/offers/${offerId}/negotiate`, input),
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
  retire: (saveId: string) => send<CareerSave>("POST", `/saves/${saveId}/retire`, {confirmation:"RETIRE CAREER"}),
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
export const useAcceptOffer = (saveId: string) => useSaveMutation(saveId, (input: string|{offerId:string;replaceContractIds:string[]}) => typeof input==="string"?careerRequests.acceptOffer(saveId,input):careerRequests.acceptOffer(saveId,input.offerId,input.replaceContractIds));
export const useDeclineOffer = (saveId: string) => useSaveMutation(saveId, (offerId: string) => careerRequests.declineOffer(saveId, offerId));
export const useNegotiateOffer = (saveId: string) => useSaveMutation(saveId, (input: { offerId: string; requestKey: string; expectedRevision: number; change: SponsorNegotiationChange }) =>
  careerRequests.negotiateOffer(saveId, input.offerId, input));
export const useUpdateSponsorActivity=(saveId:string)=>useSaveMutation(saveId,(input:{activityId:string;action:"ACCEPT"|"DECLINE"|"SCHEDULE"|"COMPLETE";week?:number})=>
  updateSponsorActivity(saveId,input.activityId,input.action,input.week));
export const useRequestSponsorRelease=(saveId:string)=>useSaveMutation(saveId,(input:{contractId:string;operationKey:string;releaseType:"IMMEDIATE_NO_COST"|"MUTUAL"|"PRICED_BUYOUT"})=>
  send<{id:string;status:string;releaseType:string;amountPence:number;sponsorDecision:string|null}>("POST",`/saves/${saveId}/sponsors/releases`,input));
export const useAcceptSponsorRelease=(saveId:string)=>useSaveMutation(saveId,(caseId:string)=>
  send<{id:string;status:string;amountPence:number}>("POST",`/saves/${saveId}/sponsors/releases/${caseId}/accept`));
export const useAcknowledgeSponsorNotice=(saveId:string)=>useSaveMutation(saveId,(noticeId:string)=>
  send<{id:string;status:string}>("POST",`/saves/${saveId}/sponsors/compliance/${noticeId}/acknowledge`));
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
export const useLegacy=(id:string,enabled=true)=>useQuery({queryKey:careerKey(id,"legacy"),staleTime:STALE,enabled,queryFn:()=>get<LegacyView>(`/saves/${id}/legacy`)});
export const useSeasonReview=(id:string,season:number|null)=>useQuery({queryKey:careerKey(id,"legacy-season",season),enabled:season!==null,staleTime:STALE,
  queryFn:()=>get<SeasonReview>(`/saves/${id}/legacy/seasons/${season}`)});
export const useEventLegacy=(id:string,key:string|null)=>useQuery({queryKey:careerKey(id,"legacy-event",key),enabled:key!==null,staleTime:STALE,
  queryFn:()=>get<EventHistory>(`/saves/${id}/legacy/events/${encodeURIComponent(key!)}`)});
export const useNpcLegacy=(id:string,npc:string)=>useQuery({queryKey:careerKey(id,"legacy-npc",npc),staleTime:STALE,
  queryFn:()=>get<NpcHistory>(`/saves/${id}/legacy/npcs/${npc}`)});
export const useBeginSeason=(id:string)=>useSaveMutation(id,(season:number)=>send<{acknowledged:boolean}>("POST",`/saves/${id}/legacy/seasons/${season}/begin`,{confirmation:"BEGIN SEASON"}));

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
