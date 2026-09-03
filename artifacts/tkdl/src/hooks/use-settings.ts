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
