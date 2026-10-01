import { useEffect, useState } from "react";
import { Shuffle, Users, RotateCcw, AlertTriangle, ChevronDown, ChevronUp, Tv } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TeamMatchCorrection } from "./team-match-correction";
import { apiFetchJson } from "@/lib/api-fetch";

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
        apiFetchJson<any>("/api/seasons/current?leagueType=doubles"),
        apiFetchJson<any[]>("/api/admin/seasons/doubles"),
      ]);
      setCurrent(currentRes ?? null);
      setPastSeasons(Array.isArray(pastRes) ? pastRes.filter((s: any) => !s.isActive) : []);
      if (currentRes?.id) {
        const t = await apiFetchJson<any[]>(`/api/seasons/${currentRes.id}/doubles/teams`);
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
          style={teams.length > 0
            ? { background: "rgba(255,0,92,0.15)", color: "#ff005c", border: "1px solid rgba(255,0,92,0.3)" }
            : { background: "rgba(255,210,74,0.12)", color: "#ffd24a", border: "1px solid rgba(255,210,74,0.28)" }}>
          <span className={teams.length > 0 ? "live-dot" : ""} style={{ width: 5, height: 5, borderRadius: "50%", background: teams.length > 0 ? undefined : "#ffd24a" }} />
          {teams.length > 0 ? "LIVE" : "WAITING FOR DRAW"}
        </span>
      </div>

      {/* Teams */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs uppercase tracking-wider font-bold flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
            <Users className="w-3.5 h-3.5" /> Teams
          </div>
          <div className="flex items-center gap-2">
          {teams.length > 0 && <a href="/broadcast?doublesDraw=1" target="_blank" rel="noreferrer"
            className="inline-flex items-center h-8 px-3 rounded-md text-xs font-bold"
            style={{ background: "rgba(255,210,74,0.1)", color: "#ffd24a", border: "1px solid rgba(255,210,74,0.25)", fontFamily: "Oswald, sans-serif" }}>
            <Tv className="w-3.5 h-3.5 mr-1.5" />Open Draw Show
          </a>}
          {teams.length>0?<AlertDialog>
            <AlertDialogTrigger asChild><Button size="sm" disabled={drawing || !current}
              style={{ background: "#0066ff", border: "none", fontFamily: "Oswald, sans-serif" }}>
              <Shuffle className="w-3.5 h-3.5 mr-1.5" />{drawing ? "Drawing…" : "Redraw Teams"}
            </Button></AlertDialogTrigger>
            <AlertDialogContent style={{background:"hsl(240 20% 7%)",borderColor:"rgba(255,0,92,.3)"}}>
              <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2" style={{color:"#ff005c",fontFamily:"Oswald, sans-serif"}}><AlertTriangle className="w-5 h-5"/>Replace the current Doubles draw?</AlertDialogTitle>
                <AlertDialogDescription style={{color:"rgba(255,255,255,.55)"}}>This permanently removes all {teams.length} current teams and the Doubles match history recorded in <strong style={{color:"#fff"}}>{current?.name}</strong>, then creates fresh random pairings. Download a backup first if these results may be needed.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Keep Current Teams</AlertDialogCancel><AlertDialogAction onClick={redraw} style={{background:"#ff005c",color:"#fff",border:"none"}}>Yes, Delete and Redraw</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>:<Button size="sm" disabled={drawing || !current} onClick={redraw}
            style={{ background: "#0066ff", border: "none", fontFamily: "Oswald, sans-serif" }}>
            <Shuffle className="w-3.5 h-3.5 mr-1.5" />{drawing ? "Drawing…" : "Start Doubles Draw"}
          </Button>}
          </div>
        </div>

        {teams.length === 0 ? (
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            Waiting for the automatic draw. This check retries on startup and at league midnight; the button above remains available as a fallback.
          </div>
        ) : (
          <div className="space-y-1 overflow-x-auto pb-1">
            {teams.map((t: any) => (
              <div key={t.id} className="grid items-center gap-2 px-3 py-2 rounded"
                style={{ gridTemplateColumns: "1.5rem minmax(8rem,1fr) 3.5rem 3.5rem 3.5rem", minWidth:"22rem", background: t.isEliminated ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", opacity: t.isEliminated ? 0.5 : 1 }}>
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

      <TeamMatchCorrection league="doubles" onCorrected={load} />

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
