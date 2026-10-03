import { useEffect, useState } from "react";
import { Activity, Ghost, RefreshCw, Skull } from "lucide-react";
import { CollapsibleAdminSection } from "./collapsible-section";

type Balance = {
  bosses: { bossId:string; attempts:number; wins:number; winRate:number; avgSeconds:number|null }[];
  curseModes: { gameType:string|null; format:string|null; runs:number; wins:number; winRate:number; avgVisits:number|null; bestStreak:number|null }[];
  curseRecords: { format:string; runs:number; wins:number; winRate:number }[];
  curseBests: { gameType:string; players:number; bestVisits:number|null; bestStreak:number|null }[];
  activity: { weekRuns:number; monthPlayers:number };
};

const label = (value:string|null) => value ? value.replaceAll("_", " ").replaceAll("-", " ") : "Unknown";

export function ArcadeBalance() {
  const [data,setData]=useState<Balance|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const load=async()=>{setLoading(true);setError("");try{const response=await fetch("/api/admin/arcade/balance",{cache:"no-store"});const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error??"Could not load arcade data");setData(body);}catch(err){setError(err instanceof Error?err.message:"Could not load arcade data");}finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  return <CollapsibleAdminSection sectionId="arcade-balance" title="Arcade Balancing" icon={Activity} accent="#a78bfa">
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><div className="text-sm font-black uppercase" style={{fontFamily:"Oswald, sans-serif"}}>Real play evidence</div><p className="text-xs text-white/35">Boss difficulty and Board Curse records from saved runs.</p></div>
        <button onClick={()=>void load()} disabled={loading} className="p-2 rounded-lg border border-white/10 text-white/50"><RefreshCw className={`w-4 h-4 ${loading?"animate-spin":""}`}/></button>
      </div>
      {error&&<div className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-300">{error}</div>}
      {data&&<>
        <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><strong className="block text-2xl text-yellow-300">{data.activity.weekRuns}</strong><span className="text-[10px] uppercase tracking-widest text-white/35">Runs this week</span></div><div className="rounded-xl border border-white/10 bg-white/[.025] p-4"><strong className="block text-2xl text-purple-300">{data.activity.monthPlayers}</strong><span className="text-[10px] uppercase tracking-widest text-white/35">Players this month</span></div></div>
        <div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-red-300"><Skull className="w-4 h-4"/>Boss Battle</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{data.bosses.map(row=><div key={row.bossId} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><strong className="block capitalize text-sm">{label(row.bossId)}</strong><div className="mt-2 flex justify-between text-xs text-white/40"><span>{row.attempts} attempts</span><b className={row.winRate<25?"text-red-300":row.winRate>75?"text-green-300":"text-yellow-300"}>{row.winRate}% wins</b></div><div className="mt-2 h-1 overflow-hidden rounded bg-white/5"><i className="block h-full bg-red-400" style={{width:`${row.winRate}%`}}/></div>{row.avgSeconds!==null&&<small className="mt-2 block text-white/30">Average clear {Math.floor(row.avgSeconds/60)}:{String(row.avgSeconds%60).padStart(2,"0")}</small>}</div>)}</div>{data.bosses.length===0&&<p className="text-xs text-white/30">No Boss Battle runs recorded yet.</p>}</div>
        <div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-purple-300"><Ghost className="w-4 h-4"/>Board Curse</div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{(data.curseModes.length?data.curseModes:data.curseRecords.map(row=>({gameType:null,format:row.format,runs:row.runs,wins:row.wins,winRate:row.winRate,avgVisits:null,bestStreak:null}))).map((row,index)=><div key={`${row.gameType}-${row.format}-${index}`} className="rounded-xl border border-white/10 bg-white/[.025] p-3"><strong className="block text-sm">{row.gameType?(row.gameType==="X01"?"501":label(row.gameType)):"All games"} · <span className="capitalize text-purple-300">{label(row.format)}</span></strong><div className="mt-2 flex justify-between text-xs text-white/40"><span>{row.runs} runs</span><b>{row.winRate}% wins</b></div><small className="mt-2 block text-white/30">{row.avgVisits!==null?`Average ${row.avgVisits} visits`:row.bestStreak!==null?`Best streak ${row.bestStreak}`:"Historic total · detailed tracking starts now"}</small></div>)}</div>{data.curseBests.length>0&&<div className="mt-3 grid gap-2 sm:grid-cols-2">{data.curseBests.map(row=><div key={row.gameType} className="rounded-lg border border-purple-400/15 bg-purple-400/5 p-3 text-xs text-white/40"><b className="text-purple-200">{row.gameType==="X01"?"501":"Cricket"} records</b> · {row.players} players · best {row.bestVisits??"—"} visits · streak {row.bestStreak??"—"}</div>)}</div>}</div>
      </>}
    </div>
  </CollapsibleAdminSection>;
}
