import { useMemo, useState } from "react";
import { errorMessage, useSponsors, useUpdateSponsorActivity } from "../api";
import { CareerError, CareerLoading, CareerSection, OSWALD } from "../components";
import type { ShellContext } from "../shell";

export function SponsorHQPage({ctx}:{ctx:ShellContext}){
  const {save}=ctx, query=useSponsors(save.id), update=useUpdateSponsorActivity(save.id);
  const [weeks,setWeeks]=useState<Record<string,number>>({});
  const [notice,setNotice]=useState("");
  const activities=useMemo(()=>[
    ...(query.data?.sponsorHQ?.commitments??[]).map(item=>({...item,required:true as const,from:item.availableFromWeek,to:item.dueWeek})),
    ...(query.data?.sponsorHQ?.opportunities??[]).map(item=>({...item,sponsorName:item.sponsorKey,required:false as const,from:item.availableFromWeek,to:item.availableToWeek})),
  ],[query.data]);
  if(query.isLoading)return <CareerLoading label="Loading Sponsor HQ"/>;
  if(query.error||!query.data)return <CareerError error={query.error} onRetry={()=>query.refetch()}/>;
  async function act(id:string,action:"ACCEPT"|"DECLINE"|"SCHEDULE"|"COMPLETE",week?:number){
    try{await update.mutateAsync({activityId:id,action,week});setNotice("Sponsor activity updated.");}
    catch(error){setNotice(errorMessage(error));}
  }
  return <div className="space-y-4">
    <CareerSection title="Sponsor HQ">
      <p className="mb-3 text-sm text-white/60">Contract duties and optional opportunities, from signed clauses only.</p>
      <p className="text-xs text-white/45">Existing contracts with no explicit activity clauses remain obligation-free.</p>
    </CareerSection>
    {notice&&<p role="status" className="pdc-card p-3 text-sm text-white">{notice}</p>}
    {activities.length===0?<div className="pdc-card p-5 text-sm text-white/65">No sponsor activities are currently configured. Existing contracts are unchanged.</div>:
      <div className="grid gap-3 lg:grid-cols-2">{activities.map(item=>{
        const week=weeks[item.id]??Math.max(item.from,save.currentWeek);
        const canSchedule=item.required?["PLANNED","AVAILABLE","CONFIRMED"].includes(item.status):["ACCEPTED","CONFIRMED"].includes(item.status);
        return <article key={item.id} className="pdc-card space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><div><p className="cc-eyebrow">{item.required?"CONTRACTUAL COMMITMENT":"OPTIONAL OPPORTUNITY"}</p>
            <h3 className="text-lg text-white" style={OSWALD}>{item.kind.replaceAll("_"," ")}</h3>
            <p className="text-xs text-white/60">{item.sponsorName??item.sponsorKey} · Season {item.season} · Weeks {item.from}–{item.to}</p></div>
            <span className="rounded border border-white/15 px-2 py-1 text-[10px] uppercase text-amber-200">{item.status}</span></div>
          {canSchedule&&<div className="flex flex-wrap items-center gap-2">
            {!item.required&&item.status==="AVAILABLE"&&<button className="career-button-secondary" disabled={update.isPending} onClick={()=>void act(item.id,"ACCEPT")}>Accept</button>}
            {!item.required&&["AVAILABLE","ACCEPTED"].includes(item.status)&&<button className="career-button-secondary" disabled={update.isPending} onClick={()=>void act(item.id,"DECLINE")}>Decline</button>}
            <label className="text-xs text-white/60">Career week
              <select className="ml-2 rounded bg-slate-900 px-2 py-1 text-white" value={week} onChange={e=>setWeeks(prev=>({...prev,[item.id]:Number(e.target.value)}))}>
                {Array.from({length:Math.max(0,item.to-item.from+1)},(_,i)=>item.from+i).map(value=><option key={value} value={value}>Week {value}</option>)}
              </select>
            </label><button className="career-button-primary" disabled={update.isPending} onClick={()=>void act(item.id,"SCHEDULE",week)}>Schedule</button>
            {item.status==="CONFIRMED"&&item.scheduledWeek===save.currentWeek&&<button className="career-button-primary" disabled={update.isPending} onClick={()=>void act(item.id,"COMPLETE")}>Mark complete</button>}
          </div>}
        </article>;
      })}</div>}
  </div>;
}
