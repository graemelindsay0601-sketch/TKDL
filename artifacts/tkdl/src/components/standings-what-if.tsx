import { useMemo, useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import { simulateStanding, type WhatIfRow } from "@/lib/standings-what-if";

export function StandingsWhatIf({ rows, competition, accent }: { rows:WhatIfRow[]; competition:string; accent:string }) {
  const [open,setOpen]=useState(false);
  const [first,setFirst]=useState<number>(rows[0]?.id ?? 0);
  const [second,setSecond]=useState<number>(rows[1]?.id ?? 0);
  const [stake,setStake]=useState(10);
  const maxStake=Math.min(rows.find(r=>r.id===first)?.points ?? 0, rows.find(r=>r.id===second)?.points ?? 0);
  const outcomes=useMemo(()=>[simulateStanding(rows,first,second,stake),simulateStanding(rows,second,first,stake)],[rows,first,second,stake]);
  if(rows.length<2) return null;
  const name=(id:number)=>rows.find(r=>r.id===id)?.name ?? "Team";
  return <div className="pdc-card overflow-hidden mb-4" style={{borderColor:`${accent}35`}}>
    <button type="button" className="w-full flex items-center gap-3 px-4 py-3 text-left" onClick={()=>setOpen(v=>!v)}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:`${accent}15`,color:accent}}><FlaskConical className="w-4 h-4"/></div>
      <div className="flex-1"><div className="font-black uppercase text-sm" style={{fontFamily:"Oswald, sans-serif",color:accent}}>Standings What-If</div><div className="text-xs" style={{color:"rgba(255,255,255,.35)"}}>Test a {competition} result before anyone plays.</div></div>
      <span className="text-[0.6rem] font-black tracking-widest" style={{color:"rgba(255,255,255,.28)"}}>PREVIEW ONLY</span><ChevronDown className={`w-4 h-4 transition-transform ${open?"rotate-180":""}`}/>
    </button>
    {open&&<div className="px-4 pb-4 border-t" style={{borderColor:"rgba(255,255,255,.06)"}}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
        <select value={first} onChange={e=>setFirst(Number(e.target.value))} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm">{rows.filter(r=>r.id!==second).map(r=><option key={r.id} value={r.id}>{r.name} · {r.points} pts</option>)}</select>
        <select value={second} onChange={e=>setSecond(Number(e.target.value))} className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm">{rows.filter(r=>r.id!==first).map(r=><option key={r.id} value={r.id}>{r.name} · {r.points} pts</option>)}</select>
        <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3"><span className="text-xs text-white/40">Wager</span><input type="number" min={1} max={maxStake} value={stake} onChange={e=>setStake(Math.max(1,Number(e.target.value)||1))} className="w-full bg-transparent py-2 text-right font-bold outline-none"/></label>
      </div>
      {stake>maxStake&&<div className="text-xs mt-2" style={{color:"#ff6b8a"}}>The maximum safe preview is {maxStake} points because either side could lose.</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">{outcomes.map((outcome,index)=>{
        const winnerId=index===0?first:second, loserId=index===0?second:first;
        const win=outcome?.rows.find(r=>r.id===winnerId), lose=outcome?.rows.find(r=>r.id===loserId);
        return <div key={index} className="rounded-xl p-3" style={{background:`${accent}08`,border:`1px solid ${accent}20`}}><div className="text-[0.6rem] font-black tracking-widest" style={{color:accent}}>IF {name(winnerId).toUpperCase()} WINS</div>{outcome?<div className="mt-2 text-sm"><strong>{name(winnerId)}</strong> → {win?.points} pts · #{outcome.winnerRank}<br/><span style={{color:"rgba(255,255,255,.5)"}}>{name(loserId)} → {lose?.points} pts · #{outcome.loserRank}{lose?.eliminated?" · eliminated":""}</span></div>:<div className="mt-2 text-xs text-white/35">Choose an affordable wager to see this result.</div>}</div>})}</div>
      <div className="text-[0.62rem] mt-3" style={{color:"rgba(255,255,255,.28)"}}>Nothing here is saved and no scores, points or matches are changed.</div>
    </div>}
  </div>;
}
