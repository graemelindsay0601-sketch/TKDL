import { useQuery } from "@tanstack/react-query";

/**
 * Shared GET-fetch hook, backed by React Query's cache.
 *
 * This replaces five near-identical hand-rolled `useFetch()` copies that
 * used to live separately in dashboard.tsx, hall-of-fame.tsx,
 * head-to-head.tsx, achievements.tsx, and submit-match.tsx. Each of those
 * held its data in plain `useState(null)` reset on every mount, so
 * navigating away from any of those pages and back — or even just
 * revisiting the Hub, which most sessions do constantly — blanked out
 * every section reading from one of them and refetched from scratch,
 * every single time, even when the data hadn't changed in the last few
 * seconds. That's the biggest source of the app's "flickers a lot" feel:
 * not a one-off refresh hiccup, but something happening on nearly every
 * navigation.
 *
 * Routing the same requests through React Query instead means a URL
 * fetched once this session renders its last-known result immediately on
 * every later mount, and only quietly revalidates in the background —
 * exactly the cached-then-confirmed pattern already used for the nav's
 * account widget and feature flags (see context/auth.tsx, hooks/
 * use-settings.ts).
 *
 * `url: null` disables the fetch without throwing — the same
 * "nothing to fetch yet" pattern the original hooks used for things like
 * "no player selected" or "not signed in".
 */
export function useFetch<T>(url: string | null) {
  const { data, isLoading } = useQuery<T>({
    queryKey: ["raw-fetch", url],
    queryFn: async () => {
      const res = await fetch(url!);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<T>;
    },
    enabled: url !== null,
    staleTime: 30_000,
  });
  return { data: data ?? null, loading: url !== null && isLoading };
}
