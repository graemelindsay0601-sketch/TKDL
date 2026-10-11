import { useRef, useState } from "react";
import { Link } from "wouter";
import { useCareerGoals, useCareerFocus, useCreateCareerGoal, useAbandonCareerGoal, errorMessage } from "../api";
import { CalendarDays, Compass, Target, Trophy } from "lucide-react";
import { CareerSection, CareerEmptyState, EventPlateTile, QueryState, StatusBadge } from "../components";
import { CareerPageHero } from "../page-hero";
import { denialLabel, formatPence, titleCase } from "../model";
import type { ShellContext } from "../shell";
import "./goals.css";
import type { Focus, GoalDefinition, GoalView } from "../../../../../api-server/src/career/goals/types";

export function GoalsPage({ctx}: {ctx:ShellContext}) {
  const query=useCareerGoals(ctx.save.id),focus=useCareerFocus(ctx.save.id),create=useCreateCareerGoal(ctx.save.id),abandon=useAbandonCareerGoal(ctx.save.id);
  const [selected,setSelected]=useState(""),[message,setMessage]=useState<string|null>(null);
  const request=useRef<{definition:string;key:string}|null>(null);
  const busy=focus.isPending || create.isPending || abandon.isPending;
  return <div className="space-y-3 career-goals">
    <QueryState query={query} label="Reading your Career direction">{data=>{
      const detail=data.focusOptions.find(f=>f.value===data.focus)!;
      const active=data.goals.filter(g=>g.status==="ACTIVE");
      const available=data.options.filter(o=>!active.some(g=>JSON.stringify(g.definition)===JSON.stringify(o.definition)));
      const choice=available.some(o=>JSON.stringify(o.definition)===selected) ? selected : available[0] ? JSON.stringify(available[0].definition) : "";
      return <>
        <CareerPageHero kicker="Career direction · optional ambitions" title="Focus & goals" accent="#dbb866" archival={data.retired}
          stage={{ venue: { venueType: "historic-theatre" }, eventClass: "NATIONAL" }}
          subtitle="Optional sporting ambitions, not quests: no points, money, bonuses or unlocks. Every eligible pathway remains available, whatever your focus."
          stats={[
            { label: "Career focus", value: detail.label, tone: "gold" },
            { label: "Active goals", value: `${active.length} / ${data.activeLimit}` },
            { label: "World ranking", value: data.context.currentRank===null?"Unranked":`#${data.context.currentRank}`, sub: data.context.holdsCard?"Active Tour Card":"No active Tour Card" },
            { label: "Career prize earnings", value: formatPence(data.context.earningsPence) },
          ]} />
        {message && <p role="status" className="career-goals__message">{message}</p>}
        {data.retired && <p className="career-goals__message">Retired Career: focus and goal history remain readable. No new goals or sporting progression.</p>}
        <div className="career-goals__grid">
          <CareerSection title="Career focus" icon={<Compass aria-hidden />} accent="#dbb866">
            <div className="career-goals__focus">
              <label><span>Your focus</span>
                <select value={data.focus} disabled={data.retired || busy} onChange={e=>{
                  setMessage(null);focus.mutate(e.target.value as Focus,{onSuccess:()=>setMessage("Focus changed. No sporting rules changed."),onError:e=>setMessage(errorMessage(e))});
                }}>
                  {data.focusOptions.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </label>
              <p>{detail.description}</p>
            </div>
          </CareerSection>
          <CareerSection title={`Personal goals · ${active.length}/${data.activeLimit} active`} icon={<Target aria-hidden />} accent="#4ade80">
            <div className="career-goals__pick">
              <p>Choose none, one or several. Event and opponent ambitions count played achievements after selection; ranking, earnings and maximums are lifetime milestones. Abandoning has no penalty.</p>
              {!data.retired && available.length>0 && <form onSubmit={e=>{
                e.preventDefault();if(!choice)return;setMessage(null);
                if (request.current?.definition!==choice) request.current={definition:choice,key:crypto.randomUUID()};
                create.mutate({requestKey:request.current!.key,definition:JSON.parse(choice) as GoalDefinition},{
                  onSuccess:r=>{request.current=null;setMessage(r.created?"Personal goal selected.":"That goal is already recorded.");},
                  onError:e=>setMessage(errorMessage(e)),
                });
              }}>
                <label><span>Choose an ambition</span><select value={choice} onChange={e=>setSelected(e.target.value)} disabled={busy}>
                  {available.map(o=><option key={JSON.stringify(o.definition)} value={JSON.stringify(o.definition)}>{o.label}</option>)}
                </select></label>
                <button type="submit" className="career-btn career-btn-primary" disabled={busy || active.length>=data.activeLimit}>Select goal</button>
              </form>}
            </div>
          </CareerSection>
        </div>
        <CareerSection title="Relevant opportunities · next eight weeks" icon={<CalendarDays aria-hidden />} accent="#86b8ec"
          action={<Link href={`/career/${ctx.save.id}/calendar`}>Full calendar</Link>}>
          {!data.opportunities.length ? <CareerEmptyState title="No matching upcoming opportunity">Open Schedule and the full calendar remain valid choices.</CareerEmptyState> :
          <ul className="career-goals__opps">{data.opportunities.map(e=><li key={e.id}>
            <EventPlateTile atmosphere={{ circuit: e.circuit, classification: e.classification, presentationTier: e.tier }} label={<>S{e.season}<br />Day {e.startDay}</>} />
            <div className="career-goals__opp-body">
              <Link href={`/career/${ctx.save.id}/events/${e.id}`}>{e.name}</Link>
              <span className="career-goals__reason">{e.reason}</span>
              <span className="career-goals__money">{e.firstPrizePence===null?"First prize unavailable":`${formatPence(e.firstPrizePence)} first prize`} · {e.estimatedCostPence===null?"Cost estimate unavailable":`${formatPence(e.estimatedCostPence)} estimated Career cost`} · Registration weeks {e.registration.opensWeek}–{e.registration.closesWeek}</span>
            </div>
            <div className="career-goals__opp-status">
              {e.canEnter ? <StatusBadge label="Open for entry" tone="success" />
                : e.denials.length ? e.denials.slice(0, 2).map(d=><StatusBadge key={d} label={denialLabel(d)} tone="muted" />)
                : <StatusBadge label={titleCase(e.relationship.replaceAll("_"," "))} tone="neutral" />}
            </div>
          </li>)}</ul>}
          <p className="career-goals__fine">Recommendations never enter events or bypass age, deadlines, qualification, conflicts or costs.</p>
        </CareerSection>
        {(["ACTIVE","COMPLETED","ABANDONED"] as const).map(status=><CareerSection key={status}
          title={status==="ACTIVE"?"Active goals":status==="COMPLETED"?"Completed accomplishments":"Abandoned · no penalty"}
          icon={status==="COMPLETED"?<Trophy aria-hidden />:<Target aria-hidden />} accent={status==="ACTIVE"?"#4ade80":status==="COMPLETED"?"#ffd24a":"#64748b"}>
          {!data.goals.some(g=>g.status===status) ? <CareerEmptyState title={status==="ACTIVE"?"No active goals":"None recorded"}>{status==="ACTIVE"?"You can continue your Career normally.":undefined}</CareerEmptyState> :
          <div className="career-goals__cards">{data.goals.filter(g=>g.status===status).map(g=><GoalCard key={g.id} goal={g} saveId={ctx.save.id}
            onAbandon={!data.retired && status==="ACTIVE" ? ()=>{
              setMessage(null);abandon.mutate(g.id,{onSuccess:()=>setMessage("Goal updated. No penalty or reward."),onError:e=>setMessage(errorMessage(e))});
            }:undefined} busy={busy}/>)}</div>}
        </CareerSection>)}
      </>;
    }}</QueryState>
  </div>;
}
export function GoalCard({goal:g,saveId,onAbandon,busy=false}: {goal:GoalView;saveId:string;onAbandon?:()=>void;busy?:boolean}) {
  const p=g.progress,earnings=g.definition.type==="EARNINGS";
  const pct=p.current===null||!p.target?0:Math.max(0,Math.min(100,Math.round(p.current/p.target*100)));
  return <article className={`career-goal-card is-${g.status.toLowerCase()}`}>
    <header><h5>{g.label}</h5><span>{titleCase(g.status)}</span></header>
    <p className="career-goal-card__meta">Selected S{g.created.season} W{g.created.week}</p>
    {g.status==="ACTIVE" && <div className="career-goal-card__progress">
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${g.label} progress`}><i style={{ width: `${pct}%` }} /></div>
      <p>{p.current===null?"No verified value yet":earnings?formatPence(p.current):p.current} / {earnings?formatPence(p.target):p.target} {earnings?"Career prize earnings":p.unit}</p>
    </div>}
    {p.note && <p className="career-goal-card__meta">{p.note}</p>}
    {g.completion && <p className="career-goal-card__done">{g.definition.type==="MAXIMUMS"?"Confirmed":"Completed"} · S{g.completion.season}{g.completion.date?` · ${g.completion.date}`:""}{g.completion.age===null?"":` · Age ${g.completion.age}`} · {g.completion.source}
      {g.completion.eventId && <> · <Link href={`/career/${saveId}/events/${g.completion.eventId}`}>Supporting event</Link></>}</p>}
    <footer>
      {g.definition.type==="WIN_EVENT" && <Link href={`/career/${saveId}/events/${g.definition.eventId}`}>Selected event</Link>}
      {onAbandon && <button className="career-btn career-btn-ghost" disabled={busy} onClick={onAbandon}>Abandon without penalty</button>}
    </footer>
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
