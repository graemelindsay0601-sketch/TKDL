import { useState, useEffect } from "react";
import { Swords, Dumbbell, Crosshair, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { CollapsibleAdminSection } from "./collapsible-section";

export function FeatureFlags() {
  const [liveScorer,        setLiveScorer]        = useState<boolean | null>(null);
  const [autoScorerOn,      setAutoScorerOn]       = useState<boolean | null>(null);
  const [autoScorerTest,    setAutoScorerTest]     = useState<boolean | null>(null);
  const [communityOn,       setCommunityOn]        = useState<boolean | null>(null);
  const [messagingOn,       setMessagingOn]        = useState<boolean | null>(null);
  const [notificationsOn,   setNotificationsOn]    = useState<boolean | null>(null);
  const [shadowLeagueOn,    setShadowLeagueOn]     = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, unknown>) => {
        setLiveScorer(s.live_scorer_enabled === true);
        setAutoScorerOn(s.auto_scorer_enabled === true);
        setAutoScorerTest(s.auto_scorer_test_only !== false);
        setCommunityOn(s.community_enabled === true);
        setMessagingOn(s.messaging_enabled === true);
        setNotificationsOn(s.notifications_enabled === true);
        setShadowLeagueOn(s.shadow_league_enabled === true);
      })
      .catch(() => {
        setLiveScorer(false); setAutoScorerOn(false); setAutoScorerTest(true);
        setCommunityOn(false); setMessagingOn(false); setNotificationsOn(false); setShadowLeagueOn(false);
      });
  }, []);

  const patchSetting = async (key: string, val: boolean, label: string) => {
    try {
      await fetch(`/api/admin/settings/${key}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: String(val) }),
      });
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
        {row("AI Camera Scorer", "Show camera 🎥 button in all game scorers (requires Auto-Scorer Test Only = off)", autoScorerOn, setAutoScorerOn, "auto_scorer_enabled", "AI Camera Scorer enabled", "AI Camera Scorer disabled")}
        {row("Auto-Scorer Test Only", "When on, camera button only shows if AI Camera Scorer is also on — hidden from nav until you're ready", autoScorerTest, setAutoScorerTest, "auto_scorer_test_only", "Test-only mode on", "Test-only mode off")}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        {row("Community Feed", "Show the Community section in the nav and allow players to post", communityOn, setCommunityOn, "community_enabled", "Community enabled", "Community hidden")}
        {row("Direct Messaging", "Allow players to send each other private messages via the Account page", messagingOn, setMessagingOn, "messaging_enabled", "Messaging enabled", "Messaging disabled")}
        {row("Notifications", "Fire in-app notifications for reactions, comments, messages, and match events", notificationsOn, setNotificationsOn, "notifications_enabled", "Notifications enabled", "Notifications disabled")}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }} />
        {row("Shadow League", "Enable the /shadow-league page — shows all bots ranked by average. Enable once 4+ bots are active", shadowLeagueOn, setShadowLeagueOn, "shadow_league_enabled", "Shadow League live", "Shadow League hidden")}
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
