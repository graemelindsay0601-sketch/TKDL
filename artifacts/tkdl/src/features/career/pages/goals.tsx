import { useRef, useState } from "react";
import { Link } from "wouter";
import { useCareerGoals, useCareerFocus, useCreateCareerGoal, useAbandonCareerGoal, errorMessage } from "../api";
import { CareerSection, CareerEmptyState, QueryState } from "../components";
import { formatPence } from "../model";
import type { ShellContext } from "../shell";
import type { Focus, GoalDefinition, GoalView } from "../../../../../api-server/src/career/goals/types";

export function GoalsPage({ctx}: {ctx:ShellContext}) {
  const query=useCareerGoals(ctx.save.id),focus=useCareerFocus(ctx.save.id),create=useCreateCareerGoal(ctx.save.id),abandon=useAbandonCareerGoal(ctx.save.id);
  const [selected,setSelected]=useState(""),[message,setMessage]=useState<string|null>(null);
  const request=useRef<{definition:string;key:string}|null>(null);
  const busy=focus.isPending || create.isPending || abandon.isPending;
  return <div className="space-y-3">
    <CareerSection title="Focus & personal goals">
      <p className="p-4 text-sm text-white/70">Optional sporting ambitions, not quests. No points, money, bonuses or unlocks. Every eligible pathway remains available, whatever your focus.</p>
      <QueryState query={query} label="Reading your Career direction">{data=>{
        const detail=data.focusOptions.find(f=>f.value===data.focus)!;
        const active=data.goals.filter(g=>g.status==="ACTIVE");
        const available=data.options.filter(o=>!active.some(g=>JSON.stringify(g.definition)===JSON.stringify(o.definition)));
        const choice=available.some(o=>JSON.stringify(o.definition)===selected) ? selected : available[0] ? JSON.stringify(available[0].definition) : "";
        return <div className="p-4 pt-0 space-y-4">
          {data.retired && <p className="text-sm text-white/70">Retired Career: focus and goal history remain readable. No new goals or sporting progression.</p>}
          <label className="block text-sm">Career Focus
            <select value={data.focus} disabled={data.retired || busy} onChange={e=>{
              setMessage(null);focus.mutate(e.target.value as Focus,{onSuccess:()=>setMessage("Focus changed. No sporting rules changed."),onError:e=>setMessage(errorMessage(e))});
            }} className="block mt-1 p-2 rounded bg-black/60 border border-white/20">
              {data.focusOptions.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <p className="text-sm text-white/70">{detail.description}</p>
          <p className="text-xs text-white/60">World ranking: {data.context.currentRank===null?"Unranked":`#${data.context.currentRank}`} · {data.context.holdsCard?"Active Tour Card":"No active Tour Card"} · Career prize earnings {formatPence(data.context.earningsPence)}</p>
          <h3 className="font-bold">Relevant opportunities</h3>
          <p className="text-xs text-white/60">Current season, next eight weeks. Recommendations do not enter events or bypass age, deadlines, qualification, conflicts or costs. <Link className="underline" href={`/career/${ctx.save.id}/calendar`}>Browse the full calendar</Link>.</p>
          {!data.opportunities.length && <CareerEmptyState title="No matching upcoming opportunity">Open Schedule and the full calendar remain valid choices.</CareerEmptyState>}
          <ul className="space-y-3">{data.opportunities.map(e=><li key={e.id} className="border-b border-white/10 pb-2 text-sm">
            <Link href={`/career/${ctx.save.id}/events/${e.id}`} className="font-bold underline">{e.name}</Link>
            <p className="text-xs text-white/70">S{e.season} · Day {e.startDay} · {e.reason}</p>
            <p className="text-xs text-white/70">{e.firstPrizePence===null?"First prize unavailable":`${formatPence(e.firstPrizePence)} first prize`} · {e.estimatedCostPence===null?"Cost estimate unavailable":`${formatPence(e.estimatedCostPence)} estimated Career cost`}</p>
            <p className="text-xs">{e.canEnter?"Currently open for your entry":e.denials.length?`Not currently enterable: ${e.denials.join(", ")}`:`${e.status.replaceAll("_"," ")} · ${e.relationship.replaceAll("_"," ")}`} · Registration weeks {e.registration.opensWeek}–{e.registration.closesWeek}</p>
          </li>)}</ul>
          <h3 className="font-bold">Personal goals ({active.length}/{data.activeLimit} active)</h3>
          <p className="text-xs text-white/60">Choose none, one or several. Event and opponent ambitions count played achievements after selection. Ranking, earnings and maximums are lifetime milestones. Abandoning has no penalty.</p>
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
            {data.goals.filter(g=>g.status===status).map(g=><GoalCard key={g.id} goal={g} saveId={ctx.save.id}
              onAbandon={!data.retired && status==="ACTIVE" ? ()=>{
                setMessage(null);abandon.mutate(g.id,{onSuccess:()=>setMessage("Goal updated. No penalty or reward."),onError:e=>setMessage(errorMessage(e))});
              }:undefined} busy={busy}/>)}
          </section>)}
        </div>;
      }}</QueryState>
    </CareerSection>
  </div>;
}
export function GoalCard({goal:g,saveId,onAbandon,busy=false}: {goal:GoalView;saveId:string;onAbandon?:()=>void;busy?:boolean}) {
  const p=g.progress,earnings=g.definition.type==="EARNINGS";
  return <article className="rounded-xl border border-white/15 p-3 space-y-1 text-sm">
    <h5 className="font-bold">{g.label}</h5>
    <p className="text-xs text-white/60">Selected S{g.created.season} W{g.created.week} · {g.status.toLowerCase()}</p>
    {g.status==="ACTIVE" && <p>{p.current===null?"No verified value yet":earnings?formatPence(p.current):p.current} / {earnings?formatPence(p.target):p.target} {earnings?"Career prize earnings":p.unit}</p>}
    {p.note && <p className="text-xs text-white/60">{p.note}</p>}
    {g.completion && <p>{g.definition.type==="MAXIMUMS"?"Confirmed":"Completed"} · S{g.completion.season}{g.completion.date?` · ${g.completion.date}`:""}{g.completion.age===null?"":` · Age ${g.completion.age}`} · {g.completion.source}
      {g.completion.eventId && <> · <Link href={`/career/${saveId}/events/${g.completion.eventId}`} className="underline">Supporting event</Link></>}</p>}
    {g.definition.type==="WIN_EVENT" && <Link href={`/career/${saveId}/events/${g.definition.eventId}`} className="underline">Selected event</Link>}
    {onAbandon && <button className="career-btn career-btn-ghost" disabled={busy} onClick={onAbandon}>Abandon without penalty</button>}
  </article>;
}
export function GoalsSummary({saveId}: {saveId:string}) {
  const query=useCareerGoals(saveId);
  return <CareerSection title="Your focus & goals" action={<Link href={`/career/${saveId}/goals`} className="career-btn career-btn-ghost">Manage</Link>}>
    <QueryState query={query} label="Reading focus">{data=><div className="p-4 space-y-2 text-sm">
      <p className="font-bold">{data.focusOptions.find(f=>f.value===data.focus)?.label}</p>
      <p>{data.goals.filter(g=>g.status==="ACTIVE").length} active goals · optional, no rewards</p>
      <ul>{data.goals.filter(g=>g.status==="ACTIVE").slice(0,2).map(g=><li key={g.id}>{g.label}</li>)}</ul>
      {data.opportunities[0] && <Link className="underline" href={`/career/${saveId}/events/${data.opportunities[0].id}`}>{data.opportunities[0].name} · {data.opportunities[0].reason}</Link>}
    </div>}</QueryState>
  </CareerSection>;
}
