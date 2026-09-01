import { useEffect, useState } from "react";
import { useListPlayers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Building2, RotateCcw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ShiftWarsTeam = {
  id: number;
  name: string;
  points: number;
  peakPoints: number;
  startingPoints: number;
  wins: number;
  losses: number;
  players: { id: number; name: string }[];
};

/** Admin management for Shift Wars — the 3 fixed department teams. Unlike the
 *  Doubles Event, there's no random draw here: an admin sets each team's
 *  starting points once everyone's happy with the setup, and assigns every
 *  player to their department permanently (no reroll). */
export function ShiftWarsAdmin() {
  const { toast } = useToast();
  const { data: players } = useListPlayers();
  const [teams, setTeams] = useState<ShiftWarsTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<any>(null);
  const [pastSeasons, setPastSeasons] = useState<any[]>([]);
  const [resetting, setResetting] = useState(false);
  const [seasonName, setSeasonName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  const reload = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/shift-wars/teams").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("/api/seasons/current?leagueType=shift_wars").then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/admin/seasons/shift-wars").then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([teamsRes, currentRes, pastRes]) => {
      setTeams(Array.isArray(teamsRes) ? teamsRes : []);
      setCurrent(currentRes ?? null);
      setPastSeasons(Array.isArray(pastRes) ? pastRes.filter((s: any) => !s.isActive) : []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const resetSeason = async () => {
    setResetting(true);
    try {
      const res = await fetch("/api/seasons/shift-wars/reset", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: seasonName || undefined }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast({ title: "Shift Wars season reset", description: `"${data.name}" has started — team points reset to their configured values.` });
      setSeasonName("");
      reload();
    } catch {
      toast({ title: "Error resetting Shift Wars season", variant: "destructive" });
    }
    setResetting(false);
  };

  const teamOf = (playerId: number) => teams.find(t => t.players.some(p => p.id === playerId));

  async function savePoints(teamId: number, points: number) {
    try {
      const res = await fetch(`/api/admin/shift-wars/teams/${teamId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Team points updated" });
      reload();
    } catch {
      toast({ title: "Error", description: "Failed to update team points", variant: "destructive" });
    }
  }

  async function saveStartingPoints(teamId: number, startingPoints: number) {
    try {
      const res = await fetch(`/api/admin/shift-wars/teams/${teamId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startingPoints }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Starting points updated", description: "Takes effect at the next monthly reset" });
      reload();
    } catch {
      toast({ title: "Error", description: "Failed to update starting points", variant: "destructive" });
    }
  }

  async function assignTeam(playerId: number, teamId: number | null) {
    try {
      const res = await fetch(`/api/admin/shift-wars/players/${playerId}/team`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      reload();
    } catch {
      toast({ title: "Error", description: "Failed to assign player to team", variant: "destructive" });
    }
  }

  if (loading) {
    return <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Loading Shift Wars teams…</div>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
        Fixed department teams — no random draw. Same points/wager rules as the Doubles Event, points only (no Elo).
        Runs as its own monthly league alongside singles: every reset (automatic at month-end, or the admin
        "Reset Season" button) puts each team's points back to its <em>Reset To</em> value below and clears
        their record — the roster and teams themselves never change.
      </p>

      {/* Current season status */}
      <div className="rounded-lg px-4 py-3 flex items-center justify-between gap-3"
        style={{ background: "rgba(0,102,255,0.05)", border: "1px solid rgba(0,102,255,0.2)" }}>
        <div>
          <div className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#0066ff" }}>
            {current?.name ?? "No active Shift Wars season"}
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

      {/* ── Team points ── */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider font-bold" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
          Teams
        </div>
        {teams.map(t => (
          <div key={t.id} className="rounded px-3 py-2.5 space-y-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold truncate" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)" }}>{t.name}</span>
              <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
                <span style={{ color: "#22c55e" }}>{t.wins}W</span>
                <span style={{ color: "#ff005c" }}>{t.losses}L</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Current Points</span>
                <input type="number" defaultValue={t.points} className="w-full px-2 py-1 rounded text-sm text-center font-mono"
                  style={{ background: "rgba(255,210,74,0.08)", border: "1px solid rgba(255,210,74,0.25)", color: "#ffd24a" }}
                  onBlur={e => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== t.points) savePoints(t.id, Math.max(0, v)); }} />
              </label>
              <label className="block">
                <span className="text-xs block mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>Reset To (monthly)</span>
                <input type="number" defaultValue={t.startingPoints} className="w-full px-2 py-1 rounded text-sm text-center font-mono"
                  style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e" }}
                  onBlur={e => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== t.startingPoints) saveStartingPoints(t.id, Math.max(0, v)); }} />
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* ── Roster assignment ── */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider font-bold" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
          Roster — assign each player's department
        </div>
        <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
          {(players ?? []).map(p => {
            const current = teamOf(p.id);
            return (
              <div key={p.id} className="grid items-center gap-2 px-3 py-1.5 rounded"
                style={{ gridTemplateColumns: "1fr 10rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-sm truncate" style={{ color: "rgba(255,255,255,0.7)" }}>{p.name}</span>
                <select
                  defaultValue={current?.id ?? ""}
                  onChange={e => assignTeam(p.id, e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-2 py-1 rounded text-xs"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.8)" }}
                >
                  <option value="">Unassigned</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset season */}
      <div className="pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
        <p className="text-sm mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
          End the current Shift Wars season and reset every team's points back to their configured "Reset To" value — independent of the Singles season.
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
                <RotateCcw className="w-4 h-4" /> Reset Shift Wars Season
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(0,102,255,0.3)" }}>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2" style={{ color: "#0066ff", fontFamily: "Oswald, sans-serif" }}>
                  <AlertTriangle className="w-5 h-5" /> End the Shift Wars season?
                </AlertDialogTitle>
                <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                  This crowns the highest-points team champion, closes the season, and resets every team's points to their configured starting value. Singles is not affected.
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

export const ShiftWarsAdminIcon = Building2;
