import { useEffect, useState } from "react";
import { Shuffle, Users, RotateCcw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Doubles Event now runs its own independent monthly season (see
 * db/migrations/add_season_league_type.ts) instead of piggybacking on
 * whichever Singles season happened to be active — this is its dedicated
 * admin control, mirroring the Singles "Season Manager" / "Start New
 * Season" pair but scoped to Doubles' own season row.
 */
export function DoublesSeasonManager() {
  const { toast } = useToast();
  const [current, setCurrent] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [pastSeasons, setPastSeasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [currentRes, pastRes] = await Promise.all([
        fetch("/api/seasons/current?leagueType=doubles").then(r => r.json()),
        fetch("/api/admin/seasons/doubles").then(r => r.json()),
      ]);
      setCurrent(currentRes ?? null);
      setPastSeasons(Array.isArray(pastRes) ? pastRes.filter((s: any) => !s.isActive) : []);
      if (currentRes?.id) {
        const t = await fetch(`/api/seasons/${currentRes.id}/doubles/teams`).then(r => r.json());
        setTeams(Array.isArray(t) ? t : []);
      } else {
        setTeams([]);
      }
    } catch {
      toast({ title: "Error loading Doubles Event season", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const redraw = async () => {
    if (!current?.id) return;
    const hasTeams = teams.length > 0;
    if (hasTeams && !confirm("This will wipe the current doubles teams and match history for this season and draw fresh random pairs. Continue?")) return;
    setDrawing(true);
    try {
      const res = await fetch(`/api/admin/seasons/${current.id}/doubles/draw`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: hasTeams }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({ title: body.error ?? "Could not draw doubles teams", variant: "destructive" });
      } else {
        toast({ title: hasTeams ? "Doubles teams redrawn" : "Doubles teams drawn" });
        await load();
      }
    } catch {
      toast({ title: "Error drawing doubles teams", variant: "destructive" });
    }
    setDrawing(false);
  };

  const resetSeason = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/seasons/doubles/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: seasonName || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast({ title: "Doubles Event season reset", description: `"${data.name}" has started with fresh teams!` });
      setSeasonName("");
      await load();
    } catch {
      toast({ title: "Error resetting Doubles Event season", variant: "destructive" });
    }
    setResetting(false);
  };

  if (loading) {
    return <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Loading Doubles Event season…</div>;
  }

  return (
    <div className="space-y-5">
      {/* Current season status */}
      <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-3"
        style={{ background: "rgba(0,102,255,0.05)", border: "1px solid rgba(0,102,255,0.2)" }}>
        <div>
          <div className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#0066ff" }}>
            {current?.name ?? "No active Doubles season"}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {current ? `Started ${current.startDate} · ${teams.length} team${teams.length === 1 ? "" : "s"}` : "Run a reset below to start one"}
          </div>
        </div>
        <span className="flex items-center gap-1 text-xs px-2 py-1 rounded shrink-0"
          style={{ background: "rgba(255,0,92,0.15)", color: "#ff005c", border: "1px solid rgba(255,0,92,0.3)" }}>
          <span className="live-dot" style={{ width: 5, height: 5 }} />LIVE
        </span>
      </div>

      {/* Teams */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider font-bold flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
            <Users className="w-3.5 h-3.5" /> Teams
          </div>
          <Button size="sm" disabled={drawing || !current} onClick={redraw}
            style={{ background: "#0066ff", border: "none", fontFamily: "Oswald, sans-serif" }}>
            <Shuffle className="w-3.5 h-3.5 mr-1.5" />
            {drawing ? "Drawing…" : teams.length > 0 ? "Redraw Teams" : "Start Doubles Draw"}
          </Button>
        </div>

        {teams.length === 0 ? (
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>No doubles teams yet for this season.</div>
        ) : (
          <div className="space-y-1">
            {teams.map((t: any) => (
              <div key={t.id} className="grid items-center gap-2 px-3 py-2 rounded"
                style={{ gridTemplateColumns: "1.5rem 1fr 3.5rem 3.5rem 3.5rem", background: t.isEliminated ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", opacity: t.isEliminated ? 0.5 : 1 }}>
                <span className="text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>{t.position}</span>
                <span className="text-xs font-bold truncate" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.8)" }}>{t.teamName}</span>
                <span className="text-xs text-center font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>{t.wins}-{t.losses}</span>
                <span className="text-xs text-center font-mono" style={{ color: "#0066ff" }}>{t.elo}</span>
                <span className="text-xs text-center font-mono" style={{ color: "#ffd24a" }}>{t.points}pts</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reset season */}
      <div className="pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
          End the current Doubles Event season and draw fresh teams for a new one — independent of the Singles season.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1">
            <Input placeholder="Custom season name (optional)" value={seasonName} onChange={e => setSeasonName(e.target.value)}
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(0,102,255,0.2)" }} />
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.22)" }}>Leave blank for auto-generated name</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={resetting} className="gap-2 font-bold uppercase tracking-wider whitespace-nowrap"
                style={{ background: "#0066ff", border: "none", fontFamily: "Oswald, sans-serif" }}>
                <RotateCcw className="w-4 h-4" /> Reset Doubles Season
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(0,102,255,0.3)" }}>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2" style={{ color: "#0066ff", fontFamily: "Oswald, sans-serif" }}>
                  <AlertTriangle className="w-5 h-5" /> End the Doubles Event season?
                </AlertDialogTitle>
                <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                  This crowns the highest-points team champion, closes the season, and draws a fresh random pairing for the new one. Singles is not affected.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetSeason} style={{ background: "#0066ff", color: "#fff", border: "none" }}>Yes, End Season</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Past seasons */}
      {pastSeasons.length > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <button onClick={() => setHistoryOpen(v => !v)} className="w-full flex items-center justify-between text-xs uppercase tracking-wider font-bold py-1"
            style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
            Past Seasons ({pastSeasons.length})
            {historyOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          {historyOpen && (
            <div className="space-y-1 mt-2">
              {pastSeasons.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded text-xs"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>{s.name}</span>
                  <span style={{ color: "#0066ff" }}>{s.championName ? `🏆 ${s.championName}` : "No champion recorded"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
