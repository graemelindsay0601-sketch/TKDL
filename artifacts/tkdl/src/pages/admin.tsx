import {
  useListPlayers,
  useUpdatePlayer,
  useResetSeason,
  useListMatches,
  useDeleteMatch,
  getListPlayersQueryKey,
  getGetStatsSummaryQueryKey,
  getGetCurrentSeasonQueryKey,
  getListSeasonsQueryKey,
  getGetLeaderboardQueryKey,
  getListMatchesQueryKey,
  getGetRecentActivityQueryKey,
  getGetPlayerStatsQueryKey,
  getGetPlayerQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, RotateCcw, AlertTriangle, Swords, Trash2, Users, Lock, ChevronDown, ChevronUp, Trophy, Zap, Download, Dumbbell, BarChart3, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";

const ADMIN_PIN_KEY = "tkdl_admin_unlocked";

function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [digits, setDigits] = useState<string[]>([]);
  const [error, setError]   = useState(false);
  const [shake, setShake]   = useState(false);
  const { toast } = useToast();

  const handleDigit = async (d: string) => {
    if (digits.length >= 4) return;
    const next = [...digits, d];
    setDigits(next);
    if (next.length === 4) {
      const pin = next.join("");
      try {
        const res = await fetch("/api/admin/verify-pin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json();
        if (data.ok) {
          sessionStorage.setItem(ADMIN_PIN_KEY, "1");
          sessionStorage.setItem("tkdl_admin_pin", pin);
          onUnlock();
        } else {
          setShake(true);
          setError(true);
          setTimeout(() => { setDigits([]); setError(false); setShake(false); }, 900);
        }
      } catch {
        toast({ title: "Error", description: "Could not verify PIN", variant: "destructive" });
        setDigits([]);
      }
    }
  };

  const handleBack = () => setDigits(prev => prev.slice(0, -1));

  const keys = ["1","2","3","4","5","6","7","8","9","","0","←"];

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className={`pdc-card p-8 w-80 flex flex-col items-center gap-6 ${shake ? "animate-[shake_0.4s_ease-in-out]" : ""}`}
        style={{ borderColor: error ? "rgba(255,0,92,0.5)" : "rgba(255,255,255,0.08)", transition: "border-color 0.3s" }}>

        {/* Icon */}
        <div className="relative">
          <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,0,92,0.12)", border: "1px solid rgba(255,0,92,0.3)" }}>
            <Lock className="w-6 h-6" style={{ color: "#ff005c", filter: "drop-shadow(0 0 6px rgba(255,0,92,0.6))" }} />
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>Admin Access</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Enter PIN to continue</p>
        </div>

        {/* PIN dots */}
        <div className="flex items-center gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className={`pin-dot ${i < digits.length ? "filled" : ""} ${error ? "!border-red-500 !bg-red-500" : ""}`} />
          ))}
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {keys.map((key, i) => (
            <button
              key={i}
              onClick={() => key === "←" ? handleBack() : key ? handleDigit(key) : undefined}
              disabled={!key}
              className={`h-12 rounded font-bold text-lg transition-all ${key ? "hover:bg-white/10 active:scale-95" : "opacity-0 cursor-default"}`}
              style={{
                fontFamily: "Oswald, sans-serif",
                color: key === "←" ? "rgba(255,255,255,0.4)" : "#fff",
                background: key ? "rgba(255,255,255,0.06)" : "transparent",
                border: key ? "1px solid rgba(255,255,255,0.08)" : "none",
              }}
            >
              {key}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-xs font-bold" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>INCORRECT PIN</p>
        )}
      </div>
    </div>
  );
}

function DataManagement() {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `tkdl-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: "Full JSON snapshot saved to your device" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
    setExporting(false);
  };

  return (
    <div className="pdc-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}>
        <Download className="w-4 h-4" style={{ color: "#6ab0ff" }} />
        <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
          Data Backup
        </h2>
      </div>
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Export a full JSON snapshot of all players, matches, seasons, standings, and achievements. Keep regular backups — store externally as insurance against data loss.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
          style={{ background: exporting ? "rgba(106,176,255,0.06)" : "rgba(106,176,255,0.12)", border: "1px solid rgba(106,176,255,0.3)", color: "#6ab0ff", fontFamily: "Oswald, sans-serif" }}
        >
          {exporting ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#6ab0ff" }} />
              Preparing…
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              Download Full Backup
            </>
          )}
        </button>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>
          Includes all tables: players, matches, seasons, standings, achievements, unlocks
        </p>
      </div>
    </div>
  );
}

function SweepTool() {
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<{ granted: number; playersChecked: number } | null>(null);
  const { toast } = useToast();

  const runSweep = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res  = await fetch("/api/admin/achievement-sweep", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setResult(data);
        toast({ title: `Sweep complete — ${data.granted} achievements unlocked` });
      } else {
        toast({ title: "Sweep failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setRunning(false);
  };

  return (
    <div className="pdc-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}>
        <Zap className="w-4 h-4" style={{ color: "#ffd24a" }} />
        <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
          Achievement Engine
        </h2>
      </div>
      <div className="px-4 py-4">
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          Retroactively evaluate all achievements across full match history. Run after importing matches or adding new achievements.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={runSweep} disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            style={{ background: running ? "rgba(255,210,74,0.08)" : "rgba(255,210,74,0.15)", border: "1px solid rgba(255,210,74,0.35)", color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
            {running ? (
              <><div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ffd24a" }} />Scanning all players...</>
            ) : (
              <><Zap className="w-3.5 h-3.5" />Run Achievement Sweep</>
            )}
          </button>
          {result && (
            <div className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: result.granted > 0 ? "#22c55e" : "rgba(255,255,255,0.35)" }}>
              {result.granted > 0
                ? `✓ ${result.granted} unlocked across ${result.playersChecked} players`
                : `✓ All up to date — ${result.playersChecked} players checked`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SeasonEditor() {
  const [seasons, setSeasons]   = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing]   = useState<Record<string, any>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/seasons");
      setSeasons(await res.json());
    } catch { toast({ title: "Error loading seasons", variant: "destructive" }); }
    setLoading(false);
  };

  const patchSeason = async (id: number, data: any) => {
    await fetch(`/api/admin/seasons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    queryClient.invalidateQueries({ queryKey: getListSeasonsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
    load();
    toast({ title: "Season updated" });
  };

  const patchStanding = async (seasonId: number, playerId: number, data: any) => {
    await fetch(`/api/admin/seasons/${seasonId}/standings/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    load();
    toast({ title: "Standing updated" });
  };

  const setChampion = async (seasonId: number, playerId: number, playerName: string) => {
    await patchSeason(seasonId, { championId: playerId, championName: playerName, playoffPending: false });
    await patchStanding(seasonId, playerId, { isChampion: true });
  };

  useState(() => { load(); });

  if (loading && seasons.length === 0) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} /></div>;
  }

  return (
    <div className="space-y-2">
      {seasons.map(season => (
        <div key={season.id} className="pdc-card overflow-hidden">
          {/* Season header */}
          <button
            onClick={() => setExpanded(expanded === season.id ? null : season.id)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div>
                <div className="font-bold text-sm text-left flex items-center gap-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.9)" }}>
                  {season.name}
                  {season.isActive && (
                    <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,0,92,0.15)", color: "#ff005c", border: "1px solid rgba(255,0,92,0.3)" }}>
                      <span className="live-dot" style={{ width: 5, height: 5 }} />LIVE
                    </span>
                  )}
                  {season.playoffPending && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,210,74,0.12)", color: "#ffd24a", border: "1px solid rgba(255,210,74,0.3)" }}>
                      PLAYOFF PENDING
                    </span>
                  )}
                </div>
                <div className="text-xs text-left mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {season.format === "301" ? "301 Format" : "Wager Format"} · {season.totalMatches} matches
                  {season.championName && ` · Champion: ${season.championName}`}
                </div>
              </div>
            </div>
            {expanded === season.id ? <ChevronUp className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "rgba(255,255,255,0.3)" }} />}
          </button>

          {expanded === season.id && (
            <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              {/* Season meta */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>Format</label>
                  <select
                    value={editing[`${season.id}-format`] ?? season.format ?? "wager"}
                    onChange={e => setEditing(p => ({ ...p, [`${season.id}-format`]: e.target.value }))}
                    className="w-full px-3 py-2 rounded text-sm"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
                  >
                    <option value="wager">Wager Format</option>
                    <option value="301">301 Format</option>
                    <option value="501">501 Format</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>Playoff Pending</label>
                    <Switch
                      checked={editing[`${season.id}-playoff`] ?? season.playoffPending ?? false}
                      onCheckedChange={v => setEditing(p => ({ ...p, [`${season.id}-playoff`]: v }))}
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>Notes</label>
                <Input
                  placeholder="Season notes..."
                  value={editing[`${season.id}-notes`] ?? season.notes ?? ""}
                  onChange={e => setEditing(p => ({ ...p, [`${season.id}-notes`]: e.target.value }))}
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}
                />
              </div>
              <Button
                size="sm"
                onClick={() => patchSeason(season.id, {
                  format: editing[`${season.id}-format`] ?? season.format,
                  playoffPending: editing[`${season.id}-playoff`] ?? season.playoffPending,
                  notes: editing[`${season.id}-notes`] ?? season.notes,
                })}
                style={{ background: "#0066ff", border: "none", fontFamily: "Oswald, sans-serif" }}
              >
                Save Season Info
              </Button>

              {/* Standings table */}
              {season.standings && season.standings.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider mb-2 font-bold" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
                    Standings — click champion trophy to crown a player
                  </div>
                  <div className="space-y-1">
                    {season.standings.map((s: any) => (
                      <div key={s.playerId} className="grid items-center gap-2 px-3 py-2 rounded" style={{ gridTemplateColumns: "1.5rem 7rem 3.5rem 3.5rem 3.5rem 3.5rem auto", background: s.isChampion ? "rgba(255,210,74,0.06)" : "rgba(255,255,255,0.03)", border: s.isChampion ? "1px solid rgba(255,210,74,0.2)" : "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>{s.position}</span>
                        <span className="text-xs font-bold truncate" style={{ fontFamily: "Oswald, sans-serif", color: s.isChampion ? "#ffd24a" : "rgba(255,255,255,0.8)" }}>
                          {s.playerName}
                          {s.isChampion && " 🏆"}
                        </span>
                        <input type="number" defaultValue={s.wins}   className="w-full px-1 py-0.5 rounded text-xs text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#22c55e" }} onBlur={e => patchStanding(season.id, s.playerId, { ...s, wins: Number(e.target.value) })} />
                        <input type="number" defaultValue={s.losses} className="w-full px-1 py-0.5 rounded text-xs text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#ff005c" }} onBlur={e => patchStanding(season.id, s.playerId, { ...s, losses: Number(e.target.value) })} />
                        <input type="number" defaultValue={s.points} className="w-full px-1 py-0.5 rounded text-xs text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#ffd24a" }} onBlur={e => patchStanding(season.id, s.playerId, { ...s, points: Number(e.target.value) })} />
                        <input type="number" defaultValue={s.elo}    className="w-full px-1 py-0.5 rounded text-xs text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#0066ff" }} onBlur={e => patchStanding(season.id, s.playerId, { ...s, elo: Number(e.target.value) })} />
                        <button
                          onClick={() => setChampion(season.id, s.playerId, s.playerName)}
                          className="p-1 rounded hover:bg-yellow-400/10 transition-colors"
                          title="Crown as champion"
                        >
                          <Trophy className="w-3.5 h-3.5" style={{ color: s.isChampion ? "#ffd24a" : "rgba(255,255,255,0.2)" }} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const ENGINES = ["X01", "Cricket", "Sequence", "HalveIt", "CountUp", "Killer", "Gotcha", "NearestBull", "Baseball", "HighScore", "NoBlack", "Custom"];
const CATEGORIES = ["competitive", "practice", "party"];
type GameTypeRow = { id: number; key: string; name: string; engine: string; category: string; description: string; config: string; enabled: boolean; sortOrder: number };

function FeatureFlags() {
  const [liveScorer, setLiveScorer] = useState<boolean | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.ok ? r.json() : {})
      .then((s: Record<string, unknown>) => setLiveScorer(s.live_scorer_enabled === true))
      .catch(() => setLiveScorer(false));
  }, []);

  const toggle = async (val: boolean) => {
    setLiveScorer(val);
    try {
      await fetch("/api/admin/settings/live_scorer_enabled", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: String(val) }),
      });
      toast({ title: val ? "Live Scorer enabled" : "Live Scorer hidden", description: val ? "Players can now see the Live Scorer in the nav." : "Live Scorer hidden from all players." });
    } catch {
      toast({ title: "Error", description: "Failed to update setting", variant: "destructive" });
    }
  };

  return (
    <div className="pdc-card overflow-hidden" style={{ borderColor: "rgba(167,139,250,0.15)", background: "rgba(167,139,250,0.02)" }}>
      <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "rgba(167,139,250,0.1)", background: "rgba(167,139,250,0.03)" }}>
        <Zap className="w-4 h-4" style={{ color: "#a78bfa" }} />
        <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#a78bfa" }}>Feature Flags</h2>
        <span className="ml-auto text-xs font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", fontFamily: "Oswald, sans-serif" }}>Dev</span>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.8)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>Live Scorer</div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Show the in-game scorer in the nav for all players</div>
          </div>
          <Switch checked={liveScorer === true} onCheckedChange={toggle} disabled={liveScorer === null} />
        </div>
        <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.15)" }}>
          Turn on when ready to test. While off, the Live Scorer link is invisible to all players.
        </p>
        <div className="flex gap-2 mt-4">
          <a href="/play"
            className="flex-1 py-2.5 text-center text-xs font-bold uppercase rounded-lg tracking-wider"
            style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.3)", color: "#ff005c", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
            <Swords className="inline w-3.5 h-3.5 mr-1.5" />Test Live Scorer →
          </a>
          <a href="/practice"
            className="flex-1 py-2.5 text-center text-xs font-bold uppercase rounded-lg tracking-wider"
            style={{ background: "rgba(167,139,250,0.1)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
            <Dumbbell className="inline w-3.5 h-3.5 mr-1.5" />Test Practice →
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Practice Analytics ────────────────────────────────────────────────────────
function PracticeAnalytics() {
  const [stats, setStats] = useState<{ byGame: any[]; byPlayer: any[]; recent: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/practice/stats")
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="pdc-card overflow-hidden" style={{ borderColor: "rgba(167,139,250,0.15)", background: "rgba(167,139,250,0.02)" }}>
      <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "rgba(167,139,250,0.1)", background: "rgba(167,139,250,0.03)" }}>
        <BarChart3 className="w-4 h-4" style={{ color: "#a78bfa" }} />
        <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#a78bfa" }}>Practice Analytics</h2>
      </div>
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#a78bfa" }} />
        </div>
      ) : !stats || (stats.byGame.length === 0 && stats.byPlayer.length === 0) ? (
        <div className="px-5 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
          No practice sessions recorded yet.
          <div className="mt-1 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>Sessions save automatically when players finish a game in Practice mode.</div>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* By Game */}
          {stats.byGame.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Most Played Games</div>
              <div className="space-y-1.5">
                {stats.byGame.slice(0, 6).map((g: any) => (
                  <div key={g.game_type_key} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Oswald, sans-serif" }}>{g.game_type_name}</div>
                    <div className="flex gap-3 text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                      <span style={{ color: "#a78bfa" }}>{g.total_sessions} sessions</span>
                      {g.avg_duration_secs && <span>{Math.round(g.avg_duration_secs / 60)}m avg</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* By Player */}
          {stats.byPlayer.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Most Active Players</div>
              <div className="space-y-1.5">
                {stats.byPlayer.slice(0, 5).map((p: any) => (
                  <div key={p.player_name} className="flex items-center justify-between py-1.5 px-2 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "Oswald, sans-serif" }}>{p.player_name}</div>
                    <div className="flex gap-3 text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                      <span style={{ color: "#a78bfa" }}>{p.total_sessions} sessions</span>
                      <span>{p.wins}W</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Recent sessions */}
          {stats.recent.length > 0 && (
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>Recent Sessions</div>
              <div className="space-y-1">
                {stats.recent.slice(0, 5).map((s: any, i: number) => (
                  <div key={i} className="text-xs py-1 px-2 rounded" style={{ background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
                    <span style={{ color: "rgba(255,255,255,0.6)" }}>{s.game_type_name}</span>
                    {s.player1_name && <span className="ml-2">· {s.player1_name}{s.player2_name ? ` vs ${s.player2_name}` : ""}</span>}
                    {s.detail && <span className="ml-2" style={{ color: "#a78bfa" }}>· {s.detail}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GameTypesManager() {
  const [gameTypes, setGameTypes] = useState<GameTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<GameTypeRow>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ key: "", name: "", engine: "X01", category: "competitive", description: "", config: "{}" });
  const { toast } = useToast();

  const load = async () => {
    try {
      const r = await fetch("/api/admin/game-types");
      setGameTypes(await r.json());
    } catch {
      toast({ title: "Error loading game types", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const toggle = async (id: number, enabled: boolean) => {
    setGameTypes(prev => prev.map(g => g.id === id ? { ...g, enabled } : g));
    await fetch(`/api/admin/game-types/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
  };

  const startEdit = (g: GameTypeRow) => {
    setEditingId(g.id);
    setEditForm({ name: g.name, description: g.description, config: g.config, category: g.category, engine: g.engine });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try { JSON.parse(editForm.config ?? "{}"); } catch {
      toast({ title: "Invalid JSON config", variant: "destructive" }); return;
    }
    const r = await fetch(`/api/admin/game-types/${editingId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (r.ok) {
      const updated = await r.json();
      setGameTypes(prev => prev.map(g => g.id === editingId ? updated : g));
      setEditingId(null);
      toast({ title: "Game type updated" });
    }
  };

  const deleteType = async (id: number, name: string) => {
    await fetch(`/api/admin/game-types/${id}`, { method: "DELETE" });
    setGameTypes(prev => prev.filter(g => g.id !== id));
    toast({ title: `Deleted "${name}"` });
  };

  const addType = async () => {
    if (!addForm.key || !addForm.name || !addForm.engine) {
      toast({ title: "Key, name, and engine are required", variant: "destructive" }); return;
    }
    try { JSON.parse(addForm.config); } catch {
      toast({ title: "Invalid JSON config", variant: "destructive" }); return;
    }
    const r = await fetch("/api/admin/game-types", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addForm),
    });
    if (r.ok) {
      const created = await r.json();
      setGameTypes(prev => [...prev, created]);
      setAddForm({ key: "", name: "", engine: "X01", category: "competitive", description: "", config: "{}" });
      setShowAdd(false);
      toast({ title: `"${created.name}" added` });
    } else {
      const err = await r.json();
      toast({ title: "Error", description: err.error, variant: "destructive" });
    }
  };

  const catColors: Record<string, string> = { competitive: "#ff005c", practice: "#00cc88", party: "#ffd24a" };
  const groups: Record<string, GameTypeRow[]> = { competitive: [], practice: [], party: [] };
  for (const g of gameTypes) { (groups[g.category] ??= []).push(g); }

  return (
    <div className="pdc-card overflow-hidden" style={{ borderColor: "rgba(0,204,136,0.15)", background: "rgba(0,204,136,0.01)" }}>
      <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: "rgba(0,204,136,0.1)", background: "rgba(0,204,136,0.02)" }}>
        <Swords className="w-4 h-4" style={{ color: "#00cc88" }} />
        <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#00cc88" }}>Game Types</h2>
        <span className="ml-auto text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
          {gameTypes.filter(g => g.enabled).length} / {gameTypes.length} enabled
        </span>
      </div>

      <div className="px-5 py-4 space-y-5">
        {loading ? (
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</p>
        ) : (
          (["competitive", "practice", "party"] as const).map(cat => {
            const items = groups[cat] ?? [];
            if (!items.length) return null;
            return (
              <div key={cat}>
                <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: catColors[cat], fontFamily: "Oswald, sans-serif" }}>{cat}</div>
                <div className="space-y-1">
                  {items.map(g => (
                    <div key={g.id}>
                      {editingId === g.id ? (
                        <div className="rounded-lg p-3 space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Name</label>
                              <Input value={editForm.name ?? ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="h-7 text-xs" />
                            </div>
                            <div>
                              <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Engine</label>
                              <select value={editForm.engine ?? ""} onChange={e => setEditForm(f => ({ ...f, engine: e.target.value }))}
                                className="w-full h-7 rounded text-xs px-2" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                                {ENGINES.map(e => <option key={e} value={e}>{e}</option>)}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Description</label>
                            <Input value={editForm.description ?? ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="h-7 text-xs" />
                          </div>
                          <div>
                            <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Config (JSON)</label>
                            <textarea value={editForm.config ?? "{}"} onChange={e => setEditForm(f => ({ ...f, config: e.target.value }))}
                              rows={3} className="w-full rounded text-xs px-2 py-1.5 font-mono resize-none"
                              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={saveEdit} className="h-6 text-xs" style={{ background: "#00cc88", color: "#000" }}>Save</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="h-6 text-xs">Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 rounded-lg px-3 py-2 group hover:bg-white/[0.025] transition-colors">
                          <Switch checked={g.enabled} onCheckedChange={val => void toggle(g.id, val)} className="shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate" style={{ color: g.enabled ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>{g.name}</div>
                            {g.description && <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.25)" }}>{g.description}</div>}
                          </div>
                          <div className="text-xs shrink-0 px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{g.engine}</div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEdit(g)} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: "rgba(255,255,255,0.4)" }} title="Edit">
                              <ChevronDown className="w-3 h-3" />
                            </button>
                            <button onClick={() => deleteType(g.id, g.name)} className="p-1 rounded hover:bg-red-500/20 transition-colors" style={{ color: "rgba(255,100,100,0.5)" }} title="Delete">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}

        {showAdd ? (
          <div className="rounded-lg p-4 space-y-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(0,204,136,0.3)" }}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "#00cc88", fontFamily: "Oswald, sans-serif" }}>New Game Type</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Key (unique slug)</label>
                <Input value={addForm.key} onChange={e => setAddForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} placeholder="e.g. my_custom_game" className="h-7 text-xs" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Display Name</label>
                <Input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. My Custom Game" className="h-7 text-xs" />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Engine</label>
                <select value={addForm.engine} onChange={e => setAddForm(f => ({ ...f, engine: e.target.value }))}
                  className="w-full h-7 rounded text-xs px-2" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                  {ENGINES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Category</label>
                <select value={addForm.category} onChange={e => setAddForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full h-7 rounded text-xs px-2" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Description</label>
              <Input value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description of the game" className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-xs mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Config (JSON — rule toggles)</label>
              <textarea value={addForm.config} onChange={e => setAddForm(f => ({ ...f, config: e.target.value }))}
                rows={3} placeholder='{"startingScore": 501, "doubleOut": true}'
                className="w-full rounded text-xs px-2 py-1.5 font-mono resize-none"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addType} style={{ background: "#00cc88", color: "#000", fontSize: "0.7rem" }}>Add Game Type</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)} style={{ fontSize: "0.7rem" }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)}
            className="w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/5"
            style={{ border: "1px dashed rgba(0,204,136,0.3)", color: "rgba(0,204,136,0.6)", fontFamily: "Oswald, sans-serif" }}>
            + Add Game Type
          </button>
        )}
      </div>
    </div>
  );
}

function TourDataManager({ players }: { players: { id: number; name: string; isActive: boolean }[] }) {
  const [selectedId, setSelectedId]   = useState<string>("");
  const [runs, setRuns]               = useState<any[]>([]);
  const [trophies, setTrophies]       = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!selectedId) { setRuns([]); setTrophies([]); return; }
    setLoading(true);
    Promise.all([
      fetch(`/api/tour/runs/${selectedId}`).then(r => r.json()),
      fetch(`/api/tour/trophies/${selectedId}`).then(r => r.json()),
    ]).then(([runsData, trophiesData]) => {
      setRuns(Array.isArray(runsData) ? runsData : []);
      setTrophies(Array.isArray(trophiesData) ? trophiesData : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedId]);

  const deleteRun = async (runId: number) => {
    const key = `run-${runId}`;
    setDeletingId(key);
    try {
      const res = await fetch(`/api/tour/runs/${runId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setRuns(prev => prev.filter(r => r.id !== runId));
      toast({ title: "Run deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const deleteTrophy = async (trophyId: number) => {
    const key = `trophy-${trophyId}`;
    setDeletingId(key);
    try {
      const res = await fetch(`/api/tour/trophies/${trophyId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setTrophies(prev => prev.filter(t => t.id !== trophyId));
      toast({ title: "Trophy removed" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const statusColor: Record<string, string> = {
    active:     "#ffd24a",
    completed:  "#22c55e",
    eliminated: "#ff005c",
    abandoned:  "rgba(255,255,255,0.3)",
  };

  return (
    <div className="pdc-card p-5" style={{ borderColor: "rgba(192,132,252,0.2)", background: "rgba(192,132,252,0.02)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4" style={{ color: "#c084fc" }} />
        <div>
          <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#c084fc" }}>Tour Data</h2>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Delete individual tour runs or trophies for a player</p>
        </div>
      </div>

      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="w-full h-9 rounded px-3 text-sm mb-4"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(192,132,252,0.2)", color: selectedId ? "#fff" : "rgba(255,255,255,0.35)", fontFamily: "inherit" }}
      >
        <option value="">Select a player…</option>
        {players.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
      </select>

      {loading && <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</p>}

      {!loading && selectedId && (
        <div className="space-y-4">
          {/* Runs */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(192,132,252,0.6)", fontFamily: "Oswald, sans-serif" }}>
              Tour Runs ({runs.length})
            </p>
            {runs.length === 0
              ? <p className="text-xs py-2" style={{ color: "rgba(255,255,255,0.25)" }}>No runs found</p>
              : <div className="space-y-1">
                  {runs.map(r => (
                    <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none">{r.emoji ?? "🎯"}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "#fff" }}>{r.tour_name}</p>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{r.difficulty} · {r.format}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold uppercase" style={{ color: statusColor[r.status] ?? "rgba(255,255,255,0.4)" }}>{r.status}</span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              disabled={deletingId === `run-${r.id}`}
                              className="p-1 rounded hover:bg-red-900/30 transition-colors"
                              style={{ color: "rgba(255,0,92,0.6)" }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(255,0,92,0.3)" }}>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                                <AlertTriangle className="w-5 h-5" /> Delete Run?
                              </AlertDialogTitle>
                              <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                                Delete the <strong style={{ color: "#fff" }}>{r.difficulty}</strong> run for <strong style={{ color: "#fff" }}>{r.tour_name}</strong>? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteRun(r.id)} style={{ background: "#ff005c", color: "#fff", border: "none", fontWeight: "bold" }}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>

          {/* Trophies */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(192,132,252,0.6)", fontFamily: "Oswald, sans-serif" }}>
              Trophies ({trophies.length})
            </p>
            {trophies.length === 0
              ? <p className="text-xs py-2" style={{ color: "rgba(255,255,255,0.25)" }}>No trophies found</p>
              : <div className="space-y-1">
                  {trophies.map(t => (
                    <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base leading-none">{t.emoji ?? "🏆"}</span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: "#fff" }}>{t.tour_name}</p>
                          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{t.difficulty} · {t.gamerscore}G</p>
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            disabled={deletingId === `trophy-${t.id}`}
                            className="p-1 rounded hover:bg-red-900/30 transition-colors"
                            style={{ color: "rgba(255,0,92,0.6)" }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(255,0,92,0.3)" }}>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                              <AlertTriangle className="w-5 h-5" /> Remove Trophy?
                            </AlertDialogTitle>
                            <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                              Remove the <strong style={{ color: "#fff" }}>{t.difficulty}</strong> trophy for <strong style={{ color: "#fff" }}>{t.tour_name}</strong>? This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTrophy(t.id)} style={{ background: "#ff005c", color: "#fff", border: "none", fontWeight: "bold" }}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { data: players, isLoading: isLoadingPlayers } = useListPlayers();
  const { data: matches, isLoading: isLoadingMatches } = useListMatches({ limit: 30 });
  const updatePlayerMutation = useUpdatePlayer();
  const resetSeasonMutation  = useResetSeason();
  const deleteMatchMutation  = useDeleteMatch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [seasonName, setSeasonName] = useState("");
  const [isSweeping, setIsSweeping] = useState(false);

  // PIN lock
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem(ADMIN_PIN_KEY) === "1");

  if (!unlocked) return <PinScreen onUnlock={() => setUnlocked(true)} />;

  const handleToggleActive = (id: number, current: boolean) => {
    updatePlayerMutation.mutate(
      { id, data: { isActive: !current } },
      {
        onSuccess: () => {
          toast({ title: "Player Updated" });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleResetSeason = () => {
    resetSeasonMutation.mutate(
      { data: { name: seasonName || undefined } },
      {
        onSuccess: (data: any) => {
          toast({ title: "Season Reset", description: `"${data.name}" has started!` });
          setSeasonName("");
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCurrentSeasonQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSeasonsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        },
        onError: (e: any) => toast({ title: "Error resetting season", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleDeleteMatch = (matchId: number, winnerId: number, loserId: number) => {
    deleteMatchMutation.mutate(
      { id: matchId },
      {
        onSuccess: () => {
          toast({ title: "Match Deleted", description: "Stats reverted." });
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(loserId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(loserId) });
        },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleSweepAchievements = async () => {
    setIsSweeping(true);
    try {
      const res = await fetch("/api/admin/achievement-sweep", { method: "POST" });
      const data = await res.json();
      toast({ title: "Achievement Sweep Complete", description: `${data.totalGranted} achievements granted across ${data.playersChecked} players.` });
    } catch (e: any) {
      toast({ title: "Sweep failed", description: e.message, variant: "destructive" });
    }
    setIsSweeping(false);
  };

  return (
    <div className="space-y-8">
      <div className="pdc-divider" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-6 h-6" style={{ color: "#ff005c", filter: "drop-shadow(0 0 6px rgba(255,0,92,0.6))" }} />
          <div>
            <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", textShadow: "0 0 20px rgba(255,0,92,0.4)" }}>
              Admin Panel
            </h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              League management · Dangerous operations
            </p>
          </div>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem(ADMIN_PIN_KEY); setUnlocked(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold hover:bg-white/5 transition-colors"
          style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Lock className="w-3 h-3" /> Lock
        </button>
      </div>

      <FeatureFlags />
      <GameTypesManager />

      {/* Season Management — full editor */}
      <div className="pdc-card p-5" style={{ borderColor: "rgba(255,210,74,0.15)", background: "rgba(255,210,74,0.02)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4" style={{ color: "#ffd24a" }} />
          <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>
            Season Manager
          </h2>
        </div>
        <SeasonEditor />
      </div>

      {/* Season Reset */}
      <div className="pdc-card p-5" style={{ borderColor: "rgba(255,0,92,0.2)", background: "rgba(255,0,92,0.03)" }}>
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw className="w-4 h-4" style={{ color: "#ff005c" }} />
          <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>
            Start New Season
          </h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          End the current season and start a new one. All players reset to 25 pts. Elo and career stats preserved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1">
            <Input placeholder="Custom season name (optional)" value={seasonName} onChange={e => setSeasonName(e.target.value)}
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,0,92,0.2)" }} />
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.22)" }}>Leave blank for auto-generated name</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="gap-2 font-bold uppercase tracking-wider whitespace-nowrap" style={{ background: "#ff005c", border: "none", fontFamily: "Oswald, sans-serif" }}>
                <AlertTriangle className="w-4 h-4" /> Reset Season
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(255,0,92,0.3)" }}>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                  <AlertTriangle className="w-5 h-5" /> Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                  This will end the current active season, crown the champion, and reset all players to 25 pts. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleResetSeason} style={{ background: "#ff005c", color: "#fff", border: "none" }}>
                  Yes, End Season
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tour data manager */}
      <TourDataManager players={players ?? []} />

      {/* Achievement sweep */}
      <div className="pdc-card p-5" style={{ borderColor: "rgba(0,102,255,0.2)", background: "rgba(0,102,255,0.02)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: "#0066ff" }} />
            <div>
              <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#0066ff" }}>Achievement Sweep</h2>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Retroactively check and grant all earned achievements based on current career stats</p>
            </div>
          </div>
          <Button
            onClick={handleSweepAchievements}
            disabled={isSweeping}
            className="gap-2 font-bold uppercase tracking-wider"
            style={{ background: "#0066ff", border: "none", fontFamily: "Oswald, sans-serif", minWidth: 120 }}
          >
            {isSweeping ? (
              <><div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#fff" }} /> Sweeping...</>
            ) : (
              <><Zap className="w-4 h-4" /> Run Sweep</>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Player roster */}
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}>
            <Users className="w-4 h-4" style={{ color: "#0066ff" }} />
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Roster
            </h2>
          </div>
          {isLoadingPlayers ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              {players?.map(player => (
                <div key={player.id} className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-white/[0.02]" style={{ opacity: !player.isActive ? 0.4 : 1 }}>
                  <div>
                    <div className="font-semibold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)" }}>
                      {player.name}
                    </div>
                    <div className="text-xs font-mono" style={{ color: "#0066ff" }}>{player.elo} Elo · {player.points}pts</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase" style={{ color: player.isActive ? "#22c55e" : "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
                      {player.isActive ? "Active" : "Off"}
                    </span>
                    <Switch checked={player.isActive} onCheckedChange={() => handleToggleActive(player.id, player.isActive)} disabled={updatePlayerMutation.isPending} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Achievement sweep tool */}
        <DataManagement />
        <SweepTool />
        <PracticeAnalytics />

        {/* Match management */}
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.015)" }}>
            <Swords className="w-4 h-4" style={{ color: "#ff005c" }} />
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Recent Matches
            </h2>
          </div>
          {isLoadingMatches ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              {matches?.map((match: any) => (
                <div key={match.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                  <div>
                    <div className="text-sm font-semibold flex items-center flex-wrap gap-1.5">
                      <span style={{ color: "#22c55e" }}>{match.winnerName}</span>
                      <span style={{ color: "rgba(255,255,255,0.25)" }}>def.</span>
                      <span style={{ color: "#ff005c" }}>{match.loserName}</span>
                      {match.stake > 0 && <span className="text-xs font-mono" style={{ color: "#ffd24a" }}>±{match.stake}pts</span>}
                      {match.isTeamMatch && (
                        <span className="text-xs font-black px-1.5 py-0.5 rounded" style={{ background: "rgba(0,200,150,0.12)", color: "#00c896", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>TEAM</span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.22)" }}>
                      {format(new Date(match.playedAt), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/10">
                        <Trash2 className="h-3.5 w-3.5" style={{ color: "#ff005c" }} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(255,0,92,0.3)" }}>
                      <AlertDialogHeader>
                        <AlertDialogTitle style={{ fontFamily: "Oswald, sans-serif" }}>Delete Match?</AlertDialogTitle>
                        <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                          Delete {match.winnerName} vs {match.loserName} from {format(new Date(match.playedAt), "MMM d, yyyy")}? Points and Elo will be reverted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteMatch(match.id, match.winnerId, match.loserId)} style={{ background: "#ff005c", color: "#fff", border: "none" }}>
                          Delete Match
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
              {(!matches || matches.length === 0) && (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No matches found.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
