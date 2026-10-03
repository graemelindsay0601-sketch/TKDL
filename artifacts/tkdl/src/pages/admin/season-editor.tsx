import { useState, useEffect } from "react";
import { Trophy, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getListSeasonsQueryKey,
  getGetStatsSummaryQueryKey,
} from "@workspace/api-client-react";

// Singles only — Doubles Event and Shift Wars each run their own
// independent season lifecycle now (see DoublesSeasonManager and the
// season-status card in ShiftWarsAdmin) instead of nesting under whichever
// singles season happens to be active.
export function SeasonEditor() {
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

  // Previously these fired the request and unconditionally toasted "updated"
  // with no res.ok check — a 4xx/5xx looked identical to success in the UI.
  // Now each returns whether it actually succeeded, which setChampion below
  // uses to avoid a split-brain state.
  const patchSeason = async (id: number, data: any): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/seasons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      queryClient.invalidateQueries({ queryKey: getListSeasonsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
      load();
      toast({ title: "Season updated" });
      return true;
    } catch {
      toast({ title: "Couldn't update season", variant: "destructive" });
      return false;
    }
  };

  const patchStanding = async (seasonId: number, playerId: number, data: any): Promise<boolean> => {
    try {
      const res = await fetch(`/api/admin/seasons/${seasonId}/standings/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      load();
      toast({ title: "Standing updated" });
      return true;
    } catch {
      toast({ title: "Couldn't update standing", variant: "destructive" });
      return false;
    }
  };

  // Crowning a champion is two sequential PATCHes (season record, then the
  // standing row). Previously both fired unconditionally, so if the first
  // PATCH failed silently, the second still ran — leaving a standing marked
  // champion on a season with no championId, or vice versa. Now the second
  // PATCH only fires once the first has actually succeeded.
  //
  // patchStanding's body has to satisfy the backend's UpdateStandingBody
  // schema, which requires position/wins/losses/points/elo on every PATCH
  // (it's an upsert — those fields are needed for the insert-not-exists
  // branch, not just the update). The wins/losses/points/elo inline editors
  // below correctly spread the full standing row (`{ ...s, wins: ... }`)
  // for exactly this reason; this used to send only `{ isChampion: true }`,
  // which always failed validation (400) and left season.championId set
  // with season_standings.isChampion never actually flipped — a toast did
  // fire, but nothing checked it, so the admin had no way to tell the
  // champion was only half-crowned. Taking the full standing row here keeps
  // it consistent with every other editor on this row.
  const setChampion = async (seasonId: number, standing: { playerId: number; playerName: string; position: number; wins: number; losses: number; points: number; elo: number }) => {
    const seasonOk = await patchSeason(seasonId, { championId: standing.playerId, championName: standing.playerName, playoffPending: false });
    if (!seasonOk) return;
    await patchStanding(seasonId, standing.playerId, { ...standing, isChampion: true });
  };

  useEffect(() => { load(); }, []);

  if (loading && seasons.length === 0) {
    return <div className="flex justify-center py-8"><div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} /></div>;
  }

  return (
    <div className="space-y-2">
      {seasons.map(season => (
        <div key={season.id} className="pdc-card overflow-hidden">
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
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,210,74,0.12)", color: "#ffd24a", border: "1px solid rgba(255,210,74,0.3)" }}>PLAYOFF PENDING</span>
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

              {season.standings && season.standings.length > 0 && (
                <div>
                  <div className="text-xs uppercase tracking-wider mb-2 font-bold" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
                    Standings — click champion trophy to crown a player
                  </div>
                  <div className="space-y-1 overflow-x-auto pb-1">
                    {season.standings.map((s: any) => (
                      <div key={s.playerId} className="grid items-center gap-2 px-3 py-2 rounded"
                        style={{ gridTemplateColumns: "1.5rem 7rem 3.5rem 3.5rem 3.5rem 3.5rem auto", minWidth:"25rem", background: s.isChampion ? "rgba(255,210,74,0.06)" : "rgba(255,255,255,0.03)", border: s.isChampion ? "1px solid rgba(255,210,74,0.2)" : "1px solid rgba(255,255,255,0.06)" }}>
                        <span className="text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>{s.position}</span>
                        <span className="text-xs font-bold truncate" style={{ fontFamily: "Oswald, sans-serif", color: s.isChampion ? "#ffd24a" : "rgba(255,255,255,0.8)" }}>
                          {s.playerName}{s.isChampion && " 🏆"}
                        </span>
                        <input type="number" defaultValue={s.wins}   className="w-full px-1 py-0.5 rounded text-xs text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#22c55e" }} onBlur={e => patchStanding(season.id, s.playerId, { ...s, wins: Number(e.target.value) })} />
                        <input type="number" defaultValue={s.losses} className="w-full px-1 py-0.5 rounded text-xs text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#ff005c" }} onBlur={e => patchStanding(season.id, s.playerId, { ...s, losses: Number(e.target.value) })} />
                        <input type="number" defaultValue={s.points} className="w-full px-1 py-0.5 rounded text-xs text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#ffd24a" }} onBlur={e => patchStanding(season.id, s.playerId, { ...s, points: Number(e.target.value) })} />
                        <input type="number" defaultValue={s.elo}    className="w-full px-1 py-0.5 rounded text-xs text-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#0066ff" }} onBlur={e => patchStanding(season.id, s.playerId, { ...s, elo: Number(e.target.value) })} />
                        <button onClick={() => setChampion(season.id, s)} className="p-1 rounded hover:bg-yellow-400/10 transition-colors" title="Crown as champion">
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
