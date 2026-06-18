import { useState } from "react";
import { Swords, ChevronDown, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CollapsibleAdminSection } from "./collapsible-section";

const ENGINES    = ["X01", "Cricket", "Sequence", "HalveIt", "CountUp", "Killer", "Gotcha", "NearestBull", "Baseball", "HighScore", "NoBlack", "Custom"];
const CATEGORIES = ["competitive", "practice", "party"];
type GameTypeRow = { id: number; key: string; name: string; engine: string; category: string; description: string; config: string; enabled: boolean; sortOrder: number };

export function GameTypesManager() {
  const [gameTypes, setGameTypes] = useState<GameTypeRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm]   = useState<Partial<GameTypeRow>>({});
  const [showAdd, setShowAdd]     = useState(false);
  const [addForm, setAddForm]     = useState({ key: "", name: "", engine: "X01", category: "competitive", description: "", config: "{}" });
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

  useState(() => { void load(); });

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
    <CollapsibleAdminSection title="Game Types" icon={Swords} accent="#00cc88" borderColor="rgba(0,204,136,0.15)" background="rgba(0,204,136,0.01)"
      badge={<span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>{gameTypes.filter(g => g.enabled).length}/{gameTypes.length}</span>}>
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
    </CollapsibleAdminSection>
  );
}
