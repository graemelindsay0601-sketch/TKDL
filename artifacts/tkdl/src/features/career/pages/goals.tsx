import { useRef, useState } from "react";
import { Link } from "wouter";
import { useCareerGoals, useCareerFocus, useCreateCareerGoal, useAbandonCareerGoal, useSetMainCareerGoal, useSetCareerRoute, errorMessage } from "../api";
import { CareerSection, CareerEmptyState, QueryState } from "../components";
import { formatPence } from "../model";
import type { ShellContext } from "../shell";
import type { Focus, GoalDefinition, GoalView } from "../../../../../api-server/src/career/goals/types";

export function GoalsPage({ctx}: {ctx:ShellContext}) {
  const query=useCareerGoals(ctx.save.id),focus=useCareerFocus(ctx.save.id),create=useCreateCareerGoal(ctx.save.id),abandon=useAbandonCareerGoal(ctx.save.id),setMain=useSetMainCareerGoal(ctx.save.id),setRoute=useSetCareerRoute(ctx.save.id);
  const [selected,setSelected]=useState(""),[message,setMessage]=useState<string|null>(null);
  const request=useRef<{definition:string;key:string}|null>(null);
  const busy=focus.isPending || create.isPending || abandon.isPending || setMain.isPending || setRoute.isPending;
  return <div className="space-y-3">
    <CareerSection title="Focus & personal goals">
      <p className="p-4 text-sm text-white/70">Optional sporting ambitions, not quests. No points, money, bonuses or unlocks. Every eligible pathway remains available, whatever your focus.</p>
      <QueryState query={query} label="Reading your Career direction">{data=>{
        const detail=data.focusOptions.find(f=>f.value===data.focus)!;
        const active=data.goals.filter(g=>g.status==="ACTIVE");
        const main=data.goals.find(g=>g.id===data.mainGoalId) ?? null;
        const selectedRoute=data.opportunities.find(e=>e.id===data.nearTermEventId);
        const available=data.options.filter(o=>!active.some(g=>JSON.stringify(g.definition)===JSON.stringify(o.definition)));
        const choice=available.some(o=>JSON.stringify(o.definition)===selected) ? selected : available[0] ? JSON.stringify(available[0].definition) : "";
        return <div className="p-4 pt-0 space-y-4">
          {data.retired && <p className="text-sm text-white/70">Retired Career: focus and goal history remain readable. No new goals or sporting progression.</p>}
          <label className="block text-sm">Opportunity preference
            <select value={data.focus} disabled={data.retired || busy} onChange={e=>{
              setMessage(null);focus.mutate(e.target.value as Focus,{onSuccess:()=>setMessage("Focus changed. No sporting rules changed."),onError:e=>setMessage(errorMessage(e))});
            }} className="block mt-1 p-2 rounded bg-black/60 border border-white/20">
              {data.focusOptions.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <p className="text-sm text-white/70">{detail.description}</p>
          <section aria-label="Main ambition" className="rounded-lg border border-amber-200/20 bg-amber-100/[0.03] p-3 space-y-2">
            <h3 className="font-bold">Main ambition</h3>
            {main ? <>
              <p>{main.label} <span className="text-xs text-amber-100/70">· {main.status==="COMPLETED"?"achieved":main.status.toLowerCase()}</span></p>
              {main.evidence && <p className="text-xs text-white/70">Confirmed by: {main.evidence.label} · Season {main.evidence.season}{main.evidence.date?` · ${main.evidence.date}`:""}</p>}
              {main.status==="ACTIVE" && !main.evidence && <p className="text-xs text-white/60">No confirmed milestone yet. Your next practical step is shown below.</p>}
              {main.status==="COMPLETED" && main.completion && <p className="text-xs text-white/70">Completed in Season {main.completion.season}{main.completion.date?` · ${main.completion.date}`:""} · {main.completion.source}</p>}
              <button type="button" className="career-btn career-btn-ghost" disabled={busy} onClick={()=>setMain.mutate(null,{onSuccess:()=>setMessage("Main ambition cleared. Your other goals remain unchanged."),onError:e=>setMessage(errorMessage(e))})}>Clear main ambition</button>
            </> : <p className="text-sm text-white/70">No main ambition selected. Choose one from your recorded goals below.</p>}
          </section>
          <p className="text-xs text-white/60">World ranking: {data.context.currentRank===null?"Unranked":`#${data.context.currentRank}`} · {data.context.holdsCard?"Active Tour Card":"No active Tour Card"} · Career prize earnings {formatPence(data.context.earningsPence)}</p>
          <h3 className="font-bold">Near-term route</h3>
          <p className="text-xs text-white/60">Choose one next step; recommendations refresh with Career events, but your choice stays yours. These are calendar suggestions, not guaranteed progress toward a milestone. <Link className="underline" href={`/career/${ctx.save.id}/calendar`}>Browse every route</Link>.</p>
          {data.nearTermEventId && !selectedRoute && <p className="text-xs text-amber-100/80">Your selected route is no longer among the two current suggestions. It remains saved until you choose a replacement.</p>}
          {!data.opportunities.length && <CareerEmptyState title="No matching upcoming opportunity">Your full calendar remains open; the route will refresh as dates and results change.</CareerEmptyState>}
          <ul className="space-y-3">{data.opportunities.slice(0,2).map((e,i)=><li key={e.id} className="border-b border-white/10 pb-2 text-sm">
            <span className="text-[.65rem] font-bold uppercase tracking-wider text-amber-100/70">{i===0?"Recommended next step":"Alternative route"}</span>
            <Link href={`/career/${ctx.save.id}/events/${e.id}`} className="font-bold underline">{e.name}</Link>
            <p className="text-xs text-white/70">S{e.season} · Day {e.startDay} · {e.reason}</p>
            <p className="text-xs text-white/70">{e.firstPrizePence===null?"First prize unavailable":`${formatPence(e.firstPrizePence)} first prize`} · {e.estimatedCostPence===null?"Cost estimate unavailable":`${formatPence(e.estimatedCostPence)} estimated Career cost`}</p>
            <p className="text-xs">{e.canEnter?"Currently open for your entry":e.denials.length?`Not currently enterable: ${e.denials.join(", ")}`:`${e.status.replaceAll("_"," ")} · ${e.relationship.replaceAll("_"," ")}`} · Registration weeks {e.registration.opensWeek}–{e.registration.closesWeek}</p>
            <button type="button" className="career-btn career-btn-ghost mt-1" disabled={busy||data.retired||data.nearTermEventId===e.id} onClick={()=>setRoute.mutate(e.id,{onSuccess:()=>setMessage("Near-term route saved. You can change it when suggestions update."),onError:error=>setMessage(errorMessage(error))})}>
              {data.nearTermEventId===e.id?"Selected route":"Choose this route"}
            </button>
          </li>)}</ul>
          {data.nearTermEventId && <button type="button" className="career-btn career-btn-ghost" disabled={busy||data.retired} onClick={()=>setRoute.mutate(null,{onSuccess:()=>setMessage("Near-term route cleared."),onError:error=>setMessage(errorMessage(error))})}>Clear near-term route</button>}
          <h3 className="font-bold">Goal history ({active.length} active)</h3>
          <p className="text-xs text-white/60">Set one main ambition. Other recorded goals remain available without becoming your main priority. Milestones are based on confirmed Career evidence; there are no rewards or penalties.</p>
          {!data.retired && available.length>0 && <form className="flex flex-wrap gap-2" onSubmit={e=>{
            e.preventDefault();if(!choice)return;setMessage(null);
            if (request.current?.definition!==choice) request.current={definition:choice,key:crypto.randomUUID()};
            create.mutate({requestKey:request.current!.key,definition:JSON.parse(choice) as GoalDefinition},{
              onSuccess:r=>{request.current=null;setMessage(r.created?"Personal goal selected.":"That goal is already recorded.");},
              onError:e=>setMessage(errorMessage(e)),
            });
          }}>
            <label className="text-sm">Choose an ambition <select value={choice} onChange={e=>setSelected(e.target.value)} disabled={busy} className="block p-2 rounded bg-black/60 border border-white/20 max-w-full">
              {available.map(o=><option key={JSON.stringify(o.definition)} value={JSON.stringify(o.definition)}>{o.label}</option>)}
            </select></label>
            <button type="submit" className="career-btn career-btn-primary self-end" disabled={busy || active.length>=data.activeLimit}>Select goal</button>
          </form>}
          {message && <p role="status" className="text-sm">{message}</p>}
          {(["ACTIVE","COMPLETED","ABANDONED"] as const).map(status=><section key={status} aria-label={`${status.toLowerCase()} goals`} className="space-y-2">
            <h4 className="font-bold">{status==="ACTIVE"?"Active":status==="COMPLETED"?"Completed accomplishments":"Abandoned — no penalty"}</h4>
            {!data.goals.some(g=>g.status===status) && <p className="text-sm text-white/60">{status==="ACTIVE"?"No active goals. You can continue Career normally.":"None recorded."}</p>}
            {data.goals.filter(g=>g.status===status).map(g=><GoalCard key={g.id} goal={g} saveId={ctx.save.id} isMain={g.id===data.mainGoalId}
              onSetMain={!data.retired && g.id!==data.mainGoalId && status!=="ABANDONED" ? ()=>setMain.mutate(g.id,{onSuccess:()=>setMessage("Main ambition updated. Your other goals remain recorded."),onError:e=>setMessage(errorMessage(e))}) : undefined}
              onAbandon={!data.retired && status==="ACTIVE" ? ()=>{
                setMessage(null);abandon.mutate(g.id,{onSuccess:()=>setMessage("Goal updated. No penalty or reward."),onError:e=>setMessage(errorMessage(e))});
              }:undefined} busy={busy}/>)}
          </section>)}
        </div>;
      }}</QueryState>
    </CareerSection>
  </div>;
}
export function GoalCard({goal:g,saveId,onAbandon,onSetMain,isMain=false,busy=false}: {goal:GoalView;saveId:string;onAbandon?:()=>void;onSetMain?:()=>void;isMain?:boolean;busy?:boolean}) {
  const p=g.progress;
  return <article className="rounded-xl border border-white/15 p-3 space-y-1 text-sm">
    <h5 className="font-bold">{g.label} {isMain&&<span className="text-xs text-amber-100">· Main ambition</span>}</h5>
    <p className="text-xs text-white/60">Selected S{g.created.season} W{g.created.week} · {g.status.toLowerCase()}</p>
    {g.status==="ACTIVE" && <p>{g.evidence ? `Confirmed milestone: ${g.evidence.label} · Season ${g.evidence.season}${g.evidence.date?` · ${g.evidence.date}`:""}` : "No confirmed milestone yet."}</p>}
    {p.note && <p className="text-xs text-white/60">{p.note}</p>}
    {g.completion && <p>{g.definition.type==="MAXIMUMS"?"Confirmed":"Completed"} · S{g.completion.season}{g.completion.date?` · ${g.completion.date}`:""}{g.completion.age===null?"":` · Age ${g.completion.age}`} · {g.completion.source}
      {g.completion.eventId && <> · <Link href={`/career/${saveId}/events/${g.completion.eventId}`} className="underline">Supporting event</Link></>}</p>}
    {g.definition.type==="WIN_EVENT" && <Link href={`/career/${saveId}/events/${g.definition.eventId}`} className="underline">Selected event</Link>}
    {onSetMain && <button className="career-btn career-btn-ghost" disabled={busy} onClick={onSetMain}>Set as main ambition</button>}
    {onAbandon && <button className="career-btn career-btn-ghost" disabled={busy} onClick={onAbandon}>Abandon without penalty</button>}
  </article>;
}
export function GoalsSummary({saveId}: {saveId:string}) {
  const query=useCareerGoals(saveId);
  return <CareerSection title="Your focus & goals" action={<Link href={`/career/${saveId}/goals`} className="career-btn career-btn-ghost">Manage</Link>}>
    <QueryState query={query} label="Reading focus">{data=><div className="p-4 space-y-2 text-sm">
      <p className="font-bold">{data.focusOptions.find(f=>f.value===data.focus)?.label}</p>
      <p className="text-xs text-white/60">Near-term opportunity preference · optional, no rewards</p>
      {data.mainGoalId && data.goals.find(g=>g.id===data.mainGoalId) ?
        <p><strong>Main ambition:</strong> {data.goals.find(g=>g.id===data.mainGoalId)!.label}</p> :
        <p>No main ambition selected.</p>}
      {data.nearTermEventId && <p>Chosen next step: {data.opportunities.find(e=>e.id===data.nearTermEventId)?.name ?? "no longer among current suggestions"}</p>}
      {data.opportunities[0] && <Link className="underline" href={`/career/${saveId}/events/${data.opportunities[0].id}`}>{data.opportunities[0].name} · {data.opportunities[0].reason}</Link>}
    </div>}</QueryState>
  </CareerSection>;
}
