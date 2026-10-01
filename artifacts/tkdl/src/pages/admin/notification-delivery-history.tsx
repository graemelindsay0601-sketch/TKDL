import { useMemo, useState } from "react";
import { BellRing, RefreshCw } from "lucide-react";
import { CollapsibleAdminSection } from "./collapsible-section";

type Delivery = {
  id:number; playerId:number; playerName:string; type:string; title:string; createdAt:string;
  sentAt:string|null; openedAt:string|null; clickedAt:string|null; status:string;
  attemptCount:number; lastError:string|null;
};

const statusStyle:Record<string,{label:string;color:string}>={
  clicked:{label:"Clicked",color:"#00e5a0"}, opened:{label:"Opened",color:"#38bdf8"},
  delivered:{label:"Delivered",color:"#8b7cff"}, retrying:{label:"Retrying",color:"#ff7f00"},
  queued:{label:"Queued",color:"#ffd24a"}, in_app:{label:"In-app only",color:"#94a3b8"},
};

export function NotificationDeliveryHistory(){
  const [rows,setRows]=useState<Delivery[]>([]);
  const [loading,setLoading]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState("");
  const [player,setPlayer]=useState("all");
  const [status,setStatus]=useState("all");

  const load=async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch("/api/admin/notifications/delivery-history?limit=150",{credentials:"include",cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error??"Could not load delivery history");
      setRows(data);setLoaded(true);
    }catch(e:any){setError(e.message);}finally{setLoading(false);}
  };
  const players=useMemo(()=>Array.from(new Map(rows.map(r=>[r.playerId,r.playerName])).entries()).sort((a,b)=>a[1].localeCompare(b[1])),[rows]);
  const shown=rows.filter(r=>(player==="all"||String(r.playerId)===player)&&(status==="all"||r.status===status));
  const badge=<span className="text-xs text-white/30">{loaded?`${shown.length} shown`:"Load when needed"}</span>;

  return <CollapsibleAdminSection sectionId="notification-delivery" title="Notification Delivery History" icon={BellRing} accent="#38bdf8" badge={badge}>
    <div className="p-4 sm:p-5 space-y-3">
      {!loaded&&!loading&&<button onClick={()=>void load()} className="w-full rounded-lg py-2.5 text-sm font-bold" style={{border:"1px solid rgba(56,189,248,.25)",background:"rgba(56,189,248,.07)",color:"#38bdf8",fontFamily:"Oswald, sans-serif"}}>Load delivery history</button>}
      {loaded&&<div className="flex flex-col sm:flex-row gap-2">
        <select value={player} onChange={e=>setPlayer(e.target.value)} className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white">
          <option value="all">All players</option>{players.map(([id,name])=><option key={id} value={id}>{name}</option>)}
        </select>
        <select value={status} onChange={e=>setStatus(e.target.value)} className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm bg-white/5 border border-white/10 text-white">
          <option value="all">All delivery states</option>{Object.entries(statusStyle).map(([key,v])=><option key={key} value={key}>{v.label}</option>)}
        </select>
        <button onClick={()=>void load()} disabled={loading} className="rounded-lg px-3 py-2 border border-white/10 text-white/50 disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${loading?"animate-spin":""}`}/></button>
      </div>}
      {error&&<div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-300">{error}</div>}
      {loaded&&<div className="rounded-xl border border-white/[.07] overflow-hidden">
        {shown.length===0?<div className="p-6 text-center text-sm text-white/30">No notifications match these filters.</div>:shown.map((row,index)=>{
          const style=statusStyle[row.status]??statusStyle.in_app;
          return <div key={row.id} className="p-3 sm:p-4" style={{borderBottom:index<shown.length-1?"1px solid rgba(255,255,255,.055)":undefined}}>
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white truncate">{row.title}</div><div className="text-xs text-white/35">{row.playerName} · {row.type} · {new Date(row.createdAt).toLocaleString()}</div></div>
              <span className="shrink-0 rounded-full px-2 py-1 text-[.62rem] font-black uppercase tracking-wider" style={{color:style.color,background:`${style.color}18`,border:`1px solid ${style.color}35`}}>{style.label}</span>
            </div>
            {(row.attemptCount>0||row.lastError)&&<div className="mt-2 text-xs" style={{color:row.lastError?"#ff9a72":"rgba(255,255,255,.35)"}}>Attempts: {row.attemptCount}{row.lastError?` · ${row.lastError}`:""}</div>}
          </div>;
        })}
      </div>}
    </div>
  </CollapsibleAdminSection>;
}
