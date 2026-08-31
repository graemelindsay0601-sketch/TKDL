import { useEffect, useState } from "react";
import { useListPlayers } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";

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

  const reload = () => {
    setLoading(true);
    fetch("/api/shift-wars/teams")
      .then(r => r.ok ? r.json() : [])
      .then((data: ShiftWarsTeam[]) => setTeams(Array.isArray(data) ? data : []))
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

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
    </div>
  );
}

export const ShiftWarsAdminIcon = Building2;
