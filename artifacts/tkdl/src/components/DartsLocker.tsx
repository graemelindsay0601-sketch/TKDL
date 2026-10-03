import { useEffect, useState } from "react";
import { Crosshair, Pencil, Save, X } from "lucide-react";

export type DartsSetup = { weightGrams?: number; barrels?: string; shafts?: string; flights?: string; points?: string } | null;

const FIELDS = [
  ["barrels", "Barrels"], ["shafts", "Shafts"], ["flights", "Flights"], ["points", "Points"],
] as const;

export function DartsLocker({ playerId, setup, editable = false, onSaved }: { playerId: number; setup: DartsSetup; editable?: boolean; onSaved?: (next: DartsSetup) => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<DartsSetup>(setup);
  const [performance,setPerformance]=useState<any>(null);
  const [draft, setDraft] = useState({ weightGrams: "", barrels: "", shafts: "", flights: "", points: "" });
  useEffect(() => { setCurrent(setup); setDraft({
    weightGrams: setup?.weightGrams ? String(setup.weightGrams) : "",
    barrels: setup?.barrels ?? "", shafts: setup?.shafts ?? "", flights: setup?.flights ?? "", points: setup?.points ?? "",
  }); }, [setup]);
  const hasSetup = Boolean(current && Object.values(current).some(Boolean));
  const loadPerformance=()=>fetch(`/api/players/${playerId}/darts-setup-performance`).then(r=>r.ok?r.json():null).then(setPerformance).catch(()=>{});
  useEffect(()=>{void loadPerformance()},[playerId,current]);

  async function save() {
    setSaving(true);
    const body = {
      ...(draft.weightGrams ? { weightGrams: Number(draft.weightGrams) } : {}),
      ...Object.fromEntries(FIELDS.map(([key]) => [key, draft[key].trim()]).filter(([, value]) => value)),
    };
    try {
      const response = await fetch(`/api/players/${playerId}/darts-setup`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setCurrent(result.dartsSetup ?? null);
      onSaved?.(result.dartsSetup ?? null);
      setEditing(false);
    } finally { setSaving(false); }
  }

  return <section className="pdc-card p-4" style={{ border: "1px solid rgba(255,210,74,.18)", background: "linear-gradient(135deg,rgba(255,210,74,.055),rgba(255,255,255,.018))" }}>
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2"><Crosshair className="w-4 h-4" style={{ color: "#ffd24a" }}/><div><div className="font-black uppercase" style={{ fontFamily: "Oswald,sans-serif", letterSpacing: ".1em" }}>Darts Locker</div><div className="text-xs" style={{ color: "rgba(255,255,255,.32)" }}>The setup behind the throw</div></div></div>
      {editable && <button onClick={() => setEditing(value => !value)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black uppercase" style={{ color: "#ffd24a", border: "1px solid rgba(255,210,74,.3)", background: "rgba(255,210,74,.08)", fontFamily: "Oswald,sans-serif" }}>{editing ? <X className="w-3.5 h-3.5"/> : <Pencil className="w-3.5 h-3.5"/>}{editing ? "Cancel" : hasSetup ? "Edit" : "Add setup"}</button>}
    </div>
    {editing ? <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <label className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>Weight (grams)<input type="number" min={12} max={40} value={draft.weightGrams} onChange={e => setDraft(d => ({...d,weightGrams:e.target.value}))} className="w-full mt-1 rounded-lg px-3 py-2 bg-black/20 border border-white/10 text-white"/></label>
      {FIELDS.map(([key,label]) => <label key={key} className="text-xs" style={{ color: "rgba(255,255,255,.4)" }}>{label}<input maxLength={60} value={draft[key]} onChange={e => setDraft(d => ({...d,[key]:e.target.value}))} className="w-full mt-1 rounded-lg px-3 py-2 bg-black/20 border border-white/10 text-white" placeholder={`e.g. ${label.toLowerCase()} setup`}/></label>)}
      <button disabled={saving} onClick={() => void save()} className="sm:col-span-2 flex items-center justify-center gap-2 rounded-lg py-2.5 font-black uppercase" style={{ background: "#ffd24a", color: "#130d00", fontFamily: "Oswald,sans-serif" }}><Save className="w-4 h-4"/>{saving ? "Saving…" : "Save locker"}</button>
    </div> : hasSetup ? <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
      {[ ["Weight", current?.weightGrams ? `${current.weightGrams}g` : null], ...FIELDS.map(([key,label]) => [label, current?.[key] ?? null]) ].map(([label,value]) => value ? <div key={label} className="rounded-lg p-2.5" style={{ background: "rgba(255,255,255,.035)", border: "1px solid rgba(255,255,255,.07)" }}><small className="block uppercase" style={{ color: "rgba(255,255,255,.25)", fontFamily: "Oswald,sans-serif", fontSize: ".48rem", letterSpacing: ".12em" }}>{label}</small><strong className="block mt-1 text-sm" style={{ color: "rgba(255,255,255,.86)" }}>{value}</strong></div> : null)}
    </div> : <p className="m-0 text-sm" style={{ color: "rgba(255,255,255,.3)" }}>{editable ? "Add your dart weight, barrels, shafts, flights and points. It will appear on your profile and in match coverage." : "This player has not opened their Darts Locker yet."}</p>}
    {hasSetup&&performance?.available&&<div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3 pt-3" style={{borderTop:"1px solid rgba(255,255,255,.07)"}}>{[["Record",`${performance.wins}-${performance.losses}`],["Win rate",`${performance.winRate}%`],["Checkout",`${performance.checkoutRate}%`],["180s",performance.scores180],["100+ / 100 darts",performance.highScoresPer100Darts]].map(([label,value])=><div key={String(label)} className="text-center"><strong className="block" style={{fontFamily:"Oswald,sans-serif",color:"#ffd24a"}}>{value}</strong><small className="uppercase" style={{fontSize:".46rem",letterSpacing:".08em",color:"rgba(255,255,255,.25)"}}>{label}</small></div>)}</div>}
    {hasSetup&&performance?.available&&performance.matches===0&&<p className="mt-3 mb-0 text-xs" style={{color:"rgba(255,255,255,.28)"}}>Performance tracking is ready. Stats will appear after the next recorded Singles match.</p>}
  </section>;
}
