// TKDL LIVE — data-fetching hooks (handover doc 14.4/15.4). Plain fetch()
// against the real endpoints, matching this codebase's own established
// pattern for every other beta feature (useFeatureFlags.tsx, card-clash's
// own hooks) rather than the openapi/orval-generated client — that
// generated pipeline only ever covered this app's original ~11 "core" API
// areas (players/matches/seasons/stats/etc., see lib/api-spec/openapi.yaml's
// own `tags` list) and every feature added since (card-clash, challenges,
// admin/settings) has consistently bypassed it in favour of hand-rolled
// fetch calls, so TKDL LIVE follows that same real convention rather than
// the doc's own literal "update openapi.yaml" instruction (see this
// session's own notes on that decision).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CurrentEditionResponse, LivePayload, PredictorResponse, LeagueType, BroadcastFeatureStatus } from "./types";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body as { error?: string } | null)?.error ?? `${url} responded ${response.status}`);
  }
  return response.json() as Promise<T>;
}

/** GET /api/broadcast/status — same shape/consumption pattern as useFeatureFlags.tsx's own card-clash equivalent. */
export function useBroadcastFeatureStatus() {
  const [status, setStatus] = useState<BroadcastFeatureStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJson<BroadcastFeatureStatus>("/api/broadcast/status")
      .then(s => { if (!cancelled) setStatus(s); })
      .catch(() => { if (!cancelled) setStatus({ available: false, liveForAll: false, adminTestMode: false }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { status, isAvailable: status?.available ?? false, loading };
}

export type UseCurrentEditionResult = {
  data: CurrentEditionResponse | null;
  loading: boolean;
  error: string | null;
  /** Re-fetches immediately — 15.4 needs this once the player exhausts its programme and loops back to LOAD_EDITION, since nothing schedules a rebuild on a timer (16.3's whole design is lazy). */
  refetch: () => void;
};

/** GET /api/broadcast/current. No polling interval of its own — 16.3's lazy-build model means a fresh Edition only appears in response to an actual request, so BroadcastPlayer.tsx should call `refetch()` when it naturally reaches the end of the current programme (TRANSITION -> LOAD_EDITION in scene-timing.ts), not on a fixed timer racing the live poll below. */
export function useCurrentEdition(): UseCurrentEditionResult {
  const [data, setData] = useState<CurrentEditionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJson<CurrentEditionResponse>("/api/broadcast/current")
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the current Edition"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [generation]);

  const refetch = useCallback(() => setGeneration(g => g + 1), []);
  return { data, loading, error, refetch };
}

export type UseLivePayloadResult = { data: LivePayload | null; loading: boolean; error: string | null };

/** GET /api/broadcast/live, polled every `pollSeconds` (14.4's own `live.pollSeconds`, itself sourced from the `broadcast_live_poll_seconds` admin setting) — 15.4: "Every ~30s: poll LIVE endpoint." Pauses while the tab is hidden so a backgrounded broadcast screen doesn't keep hammering the endpoint. */
export function useLivePayload(pollSeconds: number): UseLivePayloadResult {
  const [data, setData] = useState<LivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollSecondsRef = useRef(pollSeconds);
  pollSecondsRef.current = pollSeconds;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const payload = await fetchJson<LivePayload>("/api/broadcast/live");
          if (!cancelled) { setData(payload); setError(null); }
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load live updates");
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      if (!cancelled) timer = setTimeout(poll, Math.max(5, pollSecondsRef.current) * 1000);
    }

    poll();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // Intentionally NOT depending on pollSeconds directly — a mid-session
    // admin settings change shouldn't restart the poll loop and lose its
    // current in-flight timer; pollSecondsRef.current picks up the new
    // value on the NEXT scheduled tick instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, loading, error };
}

/** GET /api/broadcast/predictor/:league, fetched once per league (predictor snapshots only change once per Edition build, not worth polling on the live cadence). */
export function usePredictorSnapshot(league: LeagueType): { data: PredictorResponse | null; loading: boolean; error: string | null } {
  const [data, setData] = useState<PredictorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchJson<PredictorResponse>(`/api/broadcast/predictor/${league}`)
      .then(d => { if (!cancelled) { setData(d); setError(null); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the title predictor"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [league]);

  return { data, loading, error };
}

// ═══════════════════════════════════════════════════════════════════════
// Entity name resolution — LiveTicker's namesByKey / LiveInsertOverlay's
// namesBySubjectKey share ONE `${leagueType}:${entityId}` -> name map (the
// same composite key story-engine-math.ts's own subjectKey() already uses),
// built from the three real id spaces a match/story can reference: singles
// player ids, doubles team ids and shift-wars team ids (live-events.ts's own
// RecentMatch mapping — a doubles/shift-wars winnerId is a TEAM id, not a
// player id). Fetched once (rosters/teams change far less often than the
// live poll) via the same three endpoints the rest of this app's leaderboard
// already reads (leaderboard.tsx), not a new backend route.
// ═══════════════════════════════════════════════════════════════════════

/** Best-effort per source: a failed fetch for one entity source (e.g. no active doubles season yet) just leaves that source's names out of the map rather than failing the whole lookup — a name missing from the map already renders as "#<id>" downstream, which is an acceptable degraded state for a name lookup, unlike the programme/live data itself. */
export function useEntityNames(): ReadonlyMap<string, string> {
  const [namesByKey, setNamesByKey] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const map = new Map<string, string>();

      await Promise.all([
        fetchJson<{ id: number; name: string }[]>("/api/players")
          .then(players => { for (const p of players) map.set(`singles:${p.id}`, p.name); })
          .catch(() => {}),
        fetchJson<{ id: number } | null>("/api/seasons/current?leagueType=doubles")
          .then(season => season?.id
            ? fetchJson<{ id: number; name: string }[]>(`/api/seasons/${season.id}/doubles/teams`)
                .then(teams => { for (const t of teams) map.set(`doubles:${t.id}`, t.name); })
            : undefined)
          .catch(() => {}),
        fetchJson<{ id: number; name: string }[]>("/api/shift-wars/teams")
          .then(teams => { for (const t of teams) map.set(`shift_wars:${t.id}`, t.name); })
          .catch(() => {}),
      ]);

      if (!cancelled) setNamesByKey(map);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return namesByKey;
}

// ═══════════════════════════════════════════════════════════════════════
// Seen-overlay tracking (11.5: "The browser stores seen live event IDs for
// the current session") — sessionStorage, not localStorage, since the doc
// is explicit this resets per session, not permanently.
// ═══════════════════════════════════════════════════════════════════════

const SEEN_OVERLAYS_KEY = "tkdl-live:seen-overlay-story-ids";

function readSeenOverlayIds(): Set<number> {
  try {
    const raw = sessionStorage.getItem(SEEN_OVERLAYS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((v): v is number => typeof v === "number")) : new Set();
  } catch {
    return new Set(); // sessionStorage unavailable (private browsing, embedded webview) — treat every overlay as unseen rather than throwing
  }
}

function writeSeenOverlayIds(ids: ReadonlySet<number>): void {
  try {
    sessionStorage.setItem(SEEN_OVERLAYS_KEY, JSON.stringify([...ids]));
  } catch {
    // Best-effort only — a viewer might see a repeat overlay this session, which is a much smaller problem than crashing the player.
  }
}

/** Tracks which live-overlay storyIds this browser session has already shown, so the player never queues the same JUST_IN/BREAKING event twice. */
export function useSeenOverlays() {
  const [seenIds, setSeenIds] = useState<Set<number>>(() => readSeenOverlayIds());

  const markSeen = useCallback((storyId: number) => {
    setSeenIds(prev => {
      if (prev.has(storyId)) return prev;
      const next = new Set(prev);
      next.add(storyId);
      writeSeenOverlayIds(next);
      return next;
    });
  }, []);

  return { seenIds, markSeen };
}

/** Convenience combination of the three fetch hooks above for a single "give me everything the player needs" call — segments already de-duplicated against `invalidSegmentIds` is intentionally NOT done here (that's scene-timing.ts's `nextPlayableSegmentIndex`, applied against playback position, not the raw list) so this hook stays a plain data source, not playback logic. */
export function useBroadcast() {
  const edition = useCurrentEdition();
  const pollSeconds = edition.data?.live.pollSeconds ?? 30;
  const live = useLivePayload(pollSeconds);
  const invalidSegmentIds = useMemo(() => new Set(live.data?.invalidSegmentIds ?? []), [live.data]);
  const namesByKey = useEntityNames();

  useEffect(() => {
    const liveEditionId = live.data?.currentEditionId;
    const loadedEditionId = edition.data?.edition?.id ?? null;
    if (liveEditionId !== undefined && liveEditionId !== loadedEditionId) {
      edition.refetch();
    }
  }, [edition.data?.edition?.id, edition.refetch, live.data?.currentEditionId]);

  return { edition, live, invalidSegmentIds, namesByKey };
}
