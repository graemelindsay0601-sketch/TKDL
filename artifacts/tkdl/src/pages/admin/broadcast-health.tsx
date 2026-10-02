import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Radio, RefreshCw, RotateCcw } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetchJson } from "@/lib/api-fetch";
import { CollapsibleAdminSection } from "./collapsible-section";

type Edition={id:number;slotKey:string;slotType:string;status:string;createdAt:string;publishedAt:string|null;dataCutoff:string;diagnostic:string|null};
type BroadcastHealth={
  generatedAt:string;
  latestEdition:Edition|null;
  lastPublishedEdition:Edition|null;
  stories:{new:number;active:number;stale:number;invalidated:number;invalid:number;latestUpdatedAt:string|null};
  recentDiagnostics:{id:number;slotKey:string;status:string;createdAt:string;diagnostic:string|null}[];
};

const when=(value:string|null|undefined)=>value?new Date(value).toLocaleString():"Never";

export function BroadcastHealth(){
  const [data,setData]=useState<BroadcastHealth|null>(null);
  const [loading,setLoading]=useState(false);
  const [rebuilding,setRebuilding]=useState(false);
  const [error,setError]=useState("");
  const {toast}=useToast();
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{setData(await apiFetchJson<BroadcastHealth>("/api/admin/operations/broadcast-health"));}
    catch(e){setError(e instanceof Error?e.message:"Could not load broadcast health");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const regenerate=async()=>{
    setRebuilding(true);
    try{
      const result=await apiFetchJson<{edition?:{id:number;status:string};retainedEditionId?:number}>("/api/admin/broadcast/regenerate",{method:"POST"});
      toast({title:"Broadcast rebuilt",description:result.edition?`Edition #${result.edition.id} is now live.`:"Build finished; review the latest diagnostic."});
    }catch(e){toast({title:"Rebuild did not publish",description:e instanceof Error?e.message:"The current published edition remains live.",variant:"destructive"});}
    finally{setRebuilding(false);await load();}
  };
  const needsAttention=Boolean(error||data?.stories.invalid||data?.stories.stale||data?.latestEdition?.status==="FAILED");
  return <CollapsibleAdminSection sectionId="broadcast-health" title="Broadcast Health" icon={Radio} accent="#38bdf8" borderColor="rgba(56,189,248,.22)" background="rgba(56,189,248,.025)" badge={data&&<span className="text-[10px] font-bold uppercase" style={{color:needsAttention?"#ffd24a":"#22c55e"}}>{needsAttention?"Review":"Healthy"}</span>}>
    <div className="p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3"><div><h3 className="font-bold uppercase" style={{fontFamily:"Oswald, sans-serif"}}>TKDL Live pipeline</h3><p className="text-xs text-white/40">Read-only edition and story checks. Rebuild keeps the previous published edition live unless the replacement passes.</p></div><div className="flex gap-2"><button onClick={()=>void load()} disabled={loading||rebuilding} className="inline-flex items-center gap-2 px-3 py-2 rounded text-xs font-bold uppercase disabled:opacity-40" style={{border:"1px solid rgba(255,255,255,.12)",color:"rgba(255,255,255,.65)"}}><RefreshCw className={`w-3.5 h-3.5 ${loading?"animate-spin":""}`}/>Refresh</button><AlertDialog><AlertDialogTrigger asChild><button disabled={rebuilding||loading} className="inline-flex items-center gap-2 px-3 py-2 rounded text-xs font-bold uppercase disabled:opacity-40" style={{background:"rgba(56,189,248,.09)",border:"1px solid rgba(56,189,248,.25)",color:"#38bdf8"}}><RotateCcw className={`w-3.5 h-3.5 ${rebuilding?"animate-spin":""}`}/>{rebuilding?"Rebuilding…":"Safe rebuild"}</button></AlertDialogTrigger><AlertDialogContent style={{background:"hsl(240 20% 7%)",borderColor:"rgba(56,189,248,.3)"}}><AlertDialogHeader><AlertDialogTitle>Rebuild the current broadcast slot?</AlertDialogTitle><AlertDialogDescription>The protected builder will assemble and validate a replacement. If it fails the quality gate, the current published edition stays live.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>void regenerate()} style={{background:"#0284c7",color:"white"}}>Rebuild safely</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></div>
      {error&&<div className="rounded-lg p-3 text-sm" style={{border:"1px solid rgba(255,0,92,.3)",color:"#ff7aa8"}}>{error}</div>}
      {!data&&loading&&<div className="text-sm text-white/40">Checking the broadcast pipeline…</div>}
      {data&&<>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-2"><EditionCard title="Last published" edition={data.lastPublishedEdition}/><EditionCard title="Latest build" edition={data.latestEdition}/><Metric label="New stories" value={data.stories.new} note="Waiting in the story pool"/><Metric label="Active stories" value={data.stories.active} note="Hot, active or cooling"/></div>
        <div className="grid sm:grid-cols-3 gap-2"><Metric label="Stale open stories" value={data.stories.stale} note="No update for 14 days" warn={data.stories.stale>0}/><Metric label="Invalid story states" value={data.stories.invalid} note="Lifecycle and resolution disagree" warn={data.stories.invalid>0}/><Metric label="Invalidated results" value={data.stories.invalidated} note="Retired after result corrections"/></div>
        <div className="rounded-lg p-3" style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)"}}><div className="flex items-center gap-2 mb-2"><Clock3 className="w-4 h-4 text-white/35"/><h4 className="text-[11px] font-bold uppercase tracking-widest text-white/45">Recent diagnostics</h4></div>{data.recentDiagnostics.length===0?<p className="text-xs text-white/40">No failed, skipped or diagnostic builds recorded.</p>:<div className="space-y-2">{data.recentDiagnostics.map(item=><div key={item.id} className="flex gap-3 text-xs"><span className="font-bold shrink-0" style={{color:item.status==="FAILED"?"#ff7aa8":"#ffd24a"}}>#{item.id} {item.status}</span><span className="text-white/55 flex-1">{item.diagnostic??"No diagnostic detail"}</span><span className="text-white/25 hidden md:block">{when(item.createdAt)}</span></div>)}</div>}</div>
        <p className="text-[10px] text-white/25">Health checked {when(data.generatedAt)} · Latest story update {when(data.stories.latestUpdatedAt)}</p>
      </>}
    </div>
  </CollapsibleAdminSection>;
}

function EditionCard({title,edition}:{title:string;edition:Edition|null}){const ok=edition?.status==="PUBLISHED";const Icon=ok?CheckCircle2:AlertTriangle;return <div className="rounded-lg p-3" style={{background:"rgba(255,255,255,.025)",border:`1px solid ${ok?"rgba(34,197,94,.18)":"rgba(255,210,74,.22)"}`}}><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-widest text-white/35">{title}</span><Icon className="w-4 h-4" style={{color:ok?"#22c55e":"#ffd24a"}}/></div><strong className="block text-sm mt-2">{edition?`Edition #${edition.id} · ${edition.status}`:"No edition"}</strong><p className="text-[10px] text-white/30 mt-1">{edition?`${edition.slotKey} · ${when(edition.publishedAt??edition.createdAt)}`:"Nothing has been generated yet"}</p></div>}
function Metric({label,value,note,warn=false}:{label:string;value:number;note:string;warn?:boolean}){return <div className="rounded-lg p-3" style={{background:"rgba(255,255,255,.025)",border:`1px solid ${warn?"rgba(255,210,74,.24)":"rgba(255,255,255,.07)"}`}}><strong className="text-2xl" style={{fontFamily:"Oswald, sans-serif",color:warn?"#ffd24a":"#e0f2fe"}}>{value}</strong><div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div><p className="text-[10px] text-white/25 mt-1">{note}</p></div>}
