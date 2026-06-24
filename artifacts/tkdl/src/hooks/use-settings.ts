import { useQuery } from "@tanstack/react-query";

export type AppSettings = {
  live_scorer_enabled: boolean;
  auto_scorer_enabled: boolean;
  auto_scorer_test_only: boolean;
  community_enabled: boolean;
  messaging_enabled: boolean;
  notifications_enabled: boolean;
  card_clash_enabled: boolean;
  card_shop_enabled: boolean;
  coins_enabled: boolean;
};

async function fetchSettings(): Promise<AppSettings> {
  const res = await fetch("/api/settings");
  if (!res.ok) return {
    live_scorer_enabled: false,
    auto_scorer_enabled: false,
    auto_scorer_test_only: true,
    community_enabled: false,
    messaging_enabled: false,
    notifications_enabled: false,
    card_clash_enabled: true,
    card_shop_enabled: true,
    coins_enabled: true,
  };
  return res.json() as Promise<AppSettings>;
}

export function useSettings() {
  return useQuery({
    queryKey: ["app-settings"],
    queryFn: fetchSettings,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
}
