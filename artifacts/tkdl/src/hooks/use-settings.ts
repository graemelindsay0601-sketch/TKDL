import { useQuery } from "@tanstack/react-query";

export type AppSettings = {
  live_scorer_enabled: boolean;
  community_enabled: boolean;
  messaging_enabled: boolean;
  notifications_enabled: boolean;
  card_clash_enabled: boolean;
  card_shop_enabled: boolean;
  coins_enabled: boolean;
  doubles_event_enabled: boolean;
  dartboard_heatmap_enabled: boolean;
  voice_callouts_enabled: boolean;
  boss_battle_enabled: boolean;
  board_curse_enabled: boolean;
  shift_wars_enabled: boolean;
  tkdl_live_enabled: boolean;
};

// A hard refresh throws away React Query's in-memory cache along with
// everything else, so every optional-feature flag (Community, Card Clash,
// Boss Battle, Board Curse, TKDL Live) starts out `undefined` and every nav
// section gated on one of these defaults to hidden — see layout.tsx — until
// /api/settings resolves a beat later, at which point those nav links pop
// in and the sidebar visibly grows. Feature flags change rarely (an admin
// flips one, not a normal player action), so caching the last-fetched copy
// in localStorage and seeding the query with it removes that pop-in for
// every visit after the first: the nav renders its real shape immediately,
// then quietly reconciles in the background if a flag actually changed.
const SETTINGS_CACHE_KEY = "tkdl_cached_settings";

function readCachedSettings(): AppSettings | undefined {
  try {
    const raw = localStorage.getItem(SETTINGS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as AppSettings) : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
  } catch {
    // best-effort — private browsing / storage disabled just means no cache
  }
}

async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch("/api/settings");
  if (!res.ok) return {
    live_scorer_enabled: false,
    community_enabled: false,
    messaging_enabled: false,
    notifications_enabled: false,
    card_clash_enabled: true,
    card_shop_enabled: true,
    coins_enabled: true,
    doubles_event_enabled: true,
    dartboard_heatmap_enabled: false,
    voice_callouts_enabled: false,
    boss_battle_enabled: false,
    board_curse_enabled: false,
    shift_wars_enabled: false,
    tkdl_live_enabled: false,
  };
  const data = await res.json() as AppSettings;
  writeCachedSettings(data);
  return data;
}

export function useSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: fetchSettings,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    // Seed from the cached copy so `data` is populated on first render
    // instead of undefined, but mark it as already stale (updatedAt 0) so
    // React Query still fires the real fetch in the background right away
    // rather than trusting the cache for the full 5-minute staleTime — this
    // is "show the last known shape instantly, confirm it immediately",
    // not "skip checking for a while."
    initialData: readCachedSettings,
    initialDataUpdatedAt: 0,
  });
}
