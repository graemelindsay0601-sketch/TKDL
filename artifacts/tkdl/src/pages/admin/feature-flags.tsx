import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Swords, Dumbbell, Crosshair, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { CollapsibleAdminSection } from "./collapsible-section";

// Friendly display names for the two-stage (admin-preview → live-for-everyone)
// flags stored in featureFlagsTable, as opposed to the simple on/off flags
// above that live in the plain settingsTable. Only flags actually still in
// beta get a row here — card_shop/coins/card_clash are long since fully live
// and Card Clash's own settings live elsewhere, so they're deliberately left
// out of this list rather than given a toggle that's never meant to move.
const STAGED_FLAG_LABELS: Record<string, string> = {
  tkdl_live: "TKDL Live",
  new_scoring_ui: "New Scoring UI",
};
const STAGED_FLAG_ORDER = ["tkdl_live", "new_scoring_ui"];

interface StagedFlag {
  featureName: string;
  enabled: boolean;
  adminTestMode: boolean;
  description: string | null;
}
type StagedState = "off" | "preview" | "live";

function stagedStateOf(f: StagedFlag): StagedState {
  if (f.enabled) return "live";
  if (f.adminTestMode) return "preview";
  return "off";
}

export function FeatureFlags() {
  const [liveScorer,        setLiveScorer]        = useState<boolean | null>(null);
  const [communityOn,       setCommunityOn]        = useState<boolean | null>(null);
  const [messagingOn,       setMessagingOn]        = useState<boolean | null>(null);
  const [notificationsOn,   setNotificationsOn]    = useState<boolean | null>(null);
  const [shadowLeagueOn,    setShadowLeagueOn]     = useState<boolean | null>(null);
  const [cardClashOn,       setCardClashOn]        = useState<boolean | null>(null);
  const [doublesEventOn,    setDoublesEventOn]     = useState<boolean | null>(null);
  const [heatmapOn,         setHeatmapOn]          = useState<boolean | null>(null);
  const [voiceCalloutsOn,   setVoiceCalloutsOn]    = useState<boolean | null>(null);
  const [bossBattleOn,      setBossBattleOn]       = useState<boolean | null>(null);
  const [boardCurseOn,      setBoardCurseOn]       = useState<boolean | null>(null);
  const [shiftWarsOn,       setShiftWarsOn]        = useState<boolean | null>(null);
  const [stagedFlags,       setStagedFlags]        = useState<StagedFlag[] | null>(null);
  const [stagedBusy,        setStagedBusy]         = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const loadStagedFlags = () => {
    fetch("/api/admin/feature-flags", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((rows: StagedFlag[]) => setStagedFlags(rows.filter(r => STAGED_FLAG_LABELS[r.featureName])))
      .catch(() => setStagedFlags([]));
  };

  useEffect(() => { loadStagedFlags(); }, []);

  // Each target state maps to a deterministic sequence of the three existing
  // endpoints (admin-test / enable-all / disable) so the result is always
  // exactly the state clicked, regardless of whatever combination the flag
  // was previously in — e.g. "Off" always calls both admin-test(false) and
  // disable(), since disable() alone leaves a flag that was mid-preview
  // still visible to the admin (it only clears `enabled`, not
  // `adminTestMode` — see setAdminTestMode/disableFeature in
  // feature-flags-service.ts).
  const setStagedState = async (featureName: string, target: StagedState, label: string) => {
    setStagedBusy(featureName);
    try {
      if (target === "live") {
        await fetch(`/api/admin/feature-flags/${featureName}/enable-all`, { method: "POST", credentials: "include" });
      } else if (target === "preview") {
        await fetch(`/api/admin/feature-flags/${featureName}/admin-test`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: true }),
        });
      } else {
        await fetch(`/api/admin/feature-flags/${featureName}/disable`, { method: "POST", credentials: "include" });
        await fetch(`/api/admin/feature-flags/${featureName}/admin-test`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: false }),
        });
      }
      loadStagedFlags();
      toast({ title: `${label} — ${target === "live" ? "live for everyone" : target === "preview" ? "admin preview only" : "hidden"}` });
    } catch {
      toast({ title: "Error", description: "Failed to update feature flag", variant: "destructive" });
    } finally {
      setStagedBusy(null);
    }
  };

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, unknown>) => {
        setLiveScorer(s.live_scorer_enabled === true);
        setCommunityOn(s.community_enabled === true);
        setMessagingOn(s.messaging_enabled === true);
        setNotificationsOn(s.notifications_enabled === true);
        setShadowLeagueOn(s.shadow_league_enabled === true);
        setCardClashOn(s.card_clash_enabled === true);
        setDoublesEventOn(s.doubles_event_enabled !== false);
        setHeatmapOn(s.dartboard_heatmap_enabled === true);
        setVoiceCalloutsOn(s.voice_callouts_enabled === true);
        setBossBattleOn(s.boss_battle_enabled === true);
        setBoardCurseOn(s.board_curse_enabled === true);
        setShiftWarsOn(s.shift_wars_enabled === true);
      })
      .catch(() => {
        setLiveScorer(false);
        setCommunityOn(false); setMessagingOn(false); setNotificationsOn(false); setShadowLeagueOn(false); setCardClashOn(false);
        setDoublesEventOn(true);
        setHeatmapOn(false); setVoiceCalloutsOn(false); setBossBattleOn(false); setBoardCurseOn(false); setShiftWarsOn(false);
      });
  }, []);

  const patchSetting = async (key: string, val: boolean, label: string) => {
    try {
      await fetch(`/api/admin/settings/${key}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: String(val) }),
      });
      // Every page reading useSettings() has its own cached copy of
      // /api/settings — without this, a toggle here doesn't reach an
      // already-open tab (e.g. Practice) until its 5-minute staleTime
      // expires or the user hard-refreshes.
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast({ title: label });
    } catch {
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
    }
  };

  const row = (label: string, desc: string, val: boolean | null, setter: (v: boolean) => void, key: string, onLabel: string, offLabel: string) => (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{desc}</div>
      </div>
      <Switch
        checked={val === true}
        disabled={val === null}
        onCheckedChange={v => { setter(v); void patchSetting(key, v, v ? onLabel : offLabel); }}
      />
    </div>
  );

  return (
    <CollapsibleAdminSection title="Feature Flags" icon={Zap} accent="#a78bfa" borderColor="rgba(167,139,250,0.15)" background="rgba(167,139,250,0.02)"
      badge={<span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full ml-1" style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", fontFamily: "Oswald, sans-serif" }}>Dev</span>}>
      <div className="px-5 py-4 space-y-5">
        {row("Live Scorer", "Show the in-game scorer in the nav for all players", liveScorer, setLiveScorer, "live_scorer_enabled", "Live Scorer enabled", "Live Scorer hidden")}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        {row("Community Feed", "Show the Community section in the nav, allow players to post, and enable automatic match posts (180s, checkouts, eliminations, etc.)", communityOn, setCommunityOn, "community_enabled", "Community enabled", "Community hidden")}
        {row("Direct Messaging", "Allow players to send each other private messages via the Account page", messagingOn, setMessagingOn, "messaging_enabled", "Messaging enabled", "Messaging disabled")}
        {row("Notifications", "Fire in-app notifications for reactions, comments, messages, and match events", notificationsOn, setNotificationsOn, "notifications_enabled", "Notifications enabled", "Notifications disabled")}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        {row("Shadow League", "Enable the /shadow-league page — shows all bots ranked by average. Enable once 4+ bots are active", shadowLeagueOn, setShadowLeagueOn, "shadow_league_enabled", "Shadow League live", "Shadow League hidden")}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        {row("Card Clash", "Enable the Card Clash game mode with card collecting, packs, and seasons", cardClashOn, setCardClashOn, "card_clash_enabled", "Card Clash live", "Card Clash hidden")}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        <div>
          <div className="text-xs font-bold uppercase mb-1" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>Season Events</div>
          <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>Turn a season event on or off — handy for events you only run some seasons.</div>
          {row("Doubles Event", "Random-draw team event alongside the main season — Play, Submit Match, and Live Scorer all hide it when off", doublesEventOn, setDoublesEventOn, "doubles_event_enabled", "Doubles Event live", "Doubles Event hidden")}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        <div>
          <div className="text-xs font-bold uppercase mb-1" style={{ color: "rgba(255,210,74,0.5)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>⚠ Beta Features</div>
          <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>New and untested — try them out yourself first before turning them on for everyone.</div>
          <div className="space-y-5">
            {row("Dartboard Heatmap", "Visual board showing where a player's darts actually land, on their stats page — needs 60+ logged darts to show anything", heatmapOn, setHeatmapOn, "dartboard_heatmap_enabled", "Dartboard Heatmap live", "Dartboard Heatmap hidden")}
            {row("Voice Call-Outs", "Live scorer announces scores, checkouts, and 180s out loud using the browser's built-in voice — players can still mute it themselves at the table", voiceCalloutsOn, setVoiceCalloutsOn, "voice_callouts_enabled", "Voice Call-Outs live", "Voice Call-Outs hidden")}
            {row("Boss Battle", "A ladder of CPU bosses with fixed debuffs built from Card Clash's effects system — arcade only, no Elo impact. Test the ladder yourself before turning it on for everyone", bossBattleOn, setBossBattleOn, "boss_battle_enabled", "Boss Battle live", "Boss Battle hidden")}
            {row("Board Curse", "A standalone mode where random curses strike as a leg goes on, getting worse the longer it runs — solo, vs a bot, or vs a friend. Arcade only, no Elo impact. Test it yourself before turning it on for everyone", boardCurseOn, setBoardCurseOn, "board_curse_enabled", "Board Curse live", "Board Curse hidden")}
            {row("Shift Wars", "A standing 3-team department competition (Fresh, Twilight, Shift Leader) using the same points/wager rules as the Doubles Event — fixed rosters, no random draw. Manage teams and rosters below once live", shiftWarsOn, setShiftWarsOn, "shift_wars_enabled", "Shift Wars live", "Shift Wars hidden")}
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        <div>
          <div className="text-xs font-bold uppercase mb-1" style={{ color: "rgba(255,210,74,0.5)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>⚠ Staged Rollout</div>
          <div className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.2)" }}>These roll out in two steps — preview it yourself first, then flip it live for everyone once you're happy with it.</div>
          <div className="space-y-4">
            {STAGED_FLAG_ORDER.map(name => {
              const flag = stagedFlags?.find(f => f.featureName === name);
              const label = STAGED_FLAG_LABELS[name];
              const state = flag ? stagedStateOf(flag) : null;
              const busy = stagedBusy === name;
              const opt = (target: StagedState, text: string) => (
                <button
                  key={target}
                  disabled={!flag || busy}
                  onClick={() => setStagedState(name, target, label)}
                  className="flex-1 py-1.5 text-[0.65rem] font-bold uppercase rounded-md tracking-wider transition-colors"
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    background: state === target ? (target === "live" ? "rgba(0,229,160,0.18)" : target === "preview" ? "rgba(255,210,74,0.18)" : "rgba(255,255,255,0.06)") : "transparent",
                    color: state === target ? (target === "live" ? "#00e5a0" : target === "preview" ? "#ffd24a" : "rgba(255,255,255,0.5)") : "rgba(255,255,255,0.3)",
                    border: `1px solid ${state === target ? (target === "live" ? "rgba(0,229,160,0.4)" : target === "preview" ? "rgba(255,210,74,0.4)" : "rgba(255,255,255,0.15)") : "transparent"}`,
                    cursor: !flag || busy ? "default" : "pointer",
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  {text}
                </button>
              );
              return (
                <div key={name}>
                  <div className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>{label}</div>
                  {flag?.description && <div className="text-xs mt-0.5 mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>{flag.description}</div>}
                  <div className="flex gap-1.5 p-1 rounded-lg" style={{ background: "rgba(0,0,0,0.25)" }}>
                    {opt("off", "Hidden")}
                    {opt("preview", "Admin Preview")}
                    {opt("live", "Live For Everyone")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        <div className="flex gap-2">
          <a href="/community" className="flex-1 py-2.5 text-center text-xs font-bold uppercase rounded-lg tracking-wider"
            style={{ background: "rgba(0,229,160,0.08)", border: "1px solid rgba(0,229,160,0.25)", color: "#00e5a0", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
            Community →
          </a>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        <div className="flex gap-2">
          <a href="/play" className="flex-1 py-2.5 text-center text-xs font-bold uppercase rounded-lg tracking-wider"
            style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.3)", color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
            <Swords className="inline w-3.5 h-3.5 mr-1.5" />Live Scorer →
          </a>
          <a href="/practice" className="flex-1 py-2.5 text-center text-xs font-bold uppercase rounded-lg tracking-wider"
            style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
            <Dumbbell className="inline w-3.5 h-3.5 mr-1.5" />Practice →
          </a>
          <a href="/shadow-bot" className="flex-1 py-2.5 text-center text-xs font-bold uppercase rounded-lg tracking-wider"
            style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.25)", color: "#00d4ff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
            <Crosshair className="inline w-3.5 h-3.5 mr-1.5" />Shadow Bot →
          </a>
          <a href="/shadow-league" className="flex-1 py-2.5 text-center text-xs font-bold uppercase rounded-lg tracking-wider"
            style={{ background: "rgba(255,210,74,0.08)", border: "1px solid rgba(255,210,74,0.25)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
            Shadow League →
          </a>
        </div>
      </div>
    </CollapsibleAdminSection>
  );
}
