import { useState, useEffect } from "react";
import { Star, AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CollapsibleAdminSection } from "./collapsible-section";

export function TourDataManager({ players }: { players: { id: number; name: string; isActive: boolean }[] }) {
  const [selectedId, setSelectedId] = useState<string>("");
  const [runs, setRuns]             = useState<any[]>([]);
  const [trophies, setTrophies]     = useState<any[]>([]);
  const [loading, setLoading]       = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
    } finally { setDeletingId(null); }
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
    } finally { setDeletingId(null); }
  };

  const statusColor: Record<string, string> = {
    active: "#ffd24a", completed: "#22c55e", eliminated: "#ff005c", abandoned: "rgba(255,255,255,0.3)",
  };

  return (
    <CollapsibleAdminSection title="Tour Data" icon={Star} accent="#c084fc" borderColor="rgba(192,132,252,0.2)" background="rgba(192,132,252,0.02)">
      <div className="p-5">
        <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
          className="w-full h-9 rounded px-3 text-sm mb-4"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(192,132,252,0.2)", color: selectedId ? "#fff" : "rgba(255,255,255,0.35)", fontFamily: "inherit" }}>
          <option value="">Select a player…</option>
          {players.map(p => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
        </select>

        {loading && <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</p>}

        {!loading && selectedId && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(192,132,252,0.6)", fontFamily: "Oswald, sans-serif" }}>
                Tour Runs ({runs.length})
              </p>
              {runs.length === 0
                ? <p className="text-xs py-2" style={{ color: "rgba(255,255,255,0.25)" }}>No runs found</p>
                : <div className="space-y-1">
                    {runs.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
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
                              <button disabled={deletingId === `run-${r.id}`} className="p-1 rounded hover:bg-red-900/30 transition-colors" style={{ color: "rgba(255,0,92,0.6)" }}>
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
                                <AlertDialogAction onClick={() => deleteRun(r.id)} style={{ background: "#ff005c", color: "#fff", border: "none", fontWeight: "bold" }}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "rgba(192,132,252,0.6)", fontFamily: "Oswald, sans-serif" }}>
                Trophies ({trophies.length})
              </p>
              {trophies.length === 0
                ? <p className="text-xs py-2" style={{ color: "rgba(255,255,255,0.25)" }}>No trophies found</p>
                : <div className="space-y-1">
                    {trophies.map(t => (
                      <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base leading-none">{t.emoji ?? "🏆"}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: "#fff" }}>{t.tour_name}</p>
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{t.difficulty} · {t.gamerscore}G</p>
                          </div>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button disabled={deletingId === `trophy-${t.id}`} className="p-1 rounded hover:bg-red-900/30 transition-colors" style={{ color: "rgba(255,0,92,0.6)" }}>
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
                              <AlertDialogAction onClick={() => deleteTrophy(t.id)} style={{ background: "#ff005c", color: "#fff", border: "none", fontWeight: "bold" }}>Remove</AlertDialogAction>
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
    </CollapsibleAdminSection>
  );
}
