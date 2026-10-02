import { Link } from "wouter";
import { BookOpen, ExternalLink } from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";

type RecordItem={key:string;label:string;value:number;valueSuffix:string;holder:string;holderId?:number;detail:string;matchKey?:string;date?:string};

export function LeagueRecordsBook(){
  const {data,loading}=useFetch<{records:RecordItem[]}>("/api/insights/records");
  if(loading)return <div className="pdc-card h-32 animate-pulse"/>;
  if(!data?.records.length)return null;
  return <section data-testid="league-records-book">
    <div className="flex items-center gap-3 mt-8 mb-4"><div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{color:"#00d9ff",background:"rgba(0,217,255,.1)",border:"1px solid rgba(0,217,255,.25)"}}><BookOpen className="w-4 h-4"/></div><div><div className="text-[0.55rem] font-black tracking-[0.2em]" style={{color:"rgba(0,217,255,.6)"}}>THE VERIFIED ARCHIVE</div><h2 className="text-xl font-black uppercase" style={{fontFamily:"Oswald, sans-serif",color:"#00d9ff"}}>League Records Book</h2><p className="text-xs text-white/35">Match-backed records from every TKDL competition.</p></div></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{data.records.map(record=><div key={record.key} className="pdc-card overflow-hidden"><div className="h-1" style={{background:"linear-gradient(90deg,#00d9ff,#0066ff,transparent)"}}/><div className="p-4"><div className="text-[0.58rem] font-black tracking-[.16em]" style={{color:"rgba(0,217,255,.7)"}}>{record.label.toUpperCase()}</div><div className="font-black leading-none mt-2" style={{fontFamily:"Oswald, sans-serif",fontSize:"2rem",color:"#fff"}}>{record.value.toLocaleString()}<span className="text-base text-white/40">{record.valueSuffix}</span></div>{record.holderId?<Link href={`/players/${record.holderId}`}><div className="font-black uppercase mt-2 hover:opacity-70" style={{fontFamily:"Oswald, sans-serif",color:"#ffd24a"}}>{record.holder}</div></Link>:<div className="font-black uppercase mt-2" style={{fontFamily:"Oswald, sans-serif",color:"#ffd24a"}}>{record.holder}</div>}<div className="text-xs mt-1 text-white/35">{record.detail}</div>{record.matchKey&&<Link href={`/match-centre/${record.matchKey}`} className="inline-flex items-center gap-1 mt-3 text-[0.62rem] font-black tracking-widest" style={{color:"#00d9ff"}}>VIEW MATCH <ExternalLink className="w-3 h-3"/></Link>}</div></div>)}</div>
  </section>;
}
