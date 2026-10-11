import { useState } from "react";
import { Link } from "wouter";
import { useCareerLife, useLifeChoice, useMerchandiseChoice, useNpcLife, usePresentation, errorMessage } from "../api";
import { CareerEmptyState, CareerSection, QueryState, StatusBadge } from "../components";
import { formatPence } from "../model";
import type { ShellContext } from "../shell";
import { CareerPageHero } from "../page-hero";
import { CareerShirt } from "../identity";
import { Newspaper, Sparkles } from "lucide-react";
import "./life.css";
import type { LifeView, Story } from "../../../../../api-server/src/career/life/types";

export function LifeSummary({saveId}:{saveId:string}) {
  const query=useCareerLife(saveId);
  return <CareerSection title="Living Career" action={<Link className="career-btn career-btn-ghost" href={`/career/${saveId}/life`}>Career Life</Link>}>
    <QueryState query={query} label="Reading Career Life">{d=><div className="p-4 space-y-2">
      <p className="text-sm">{d.profile.awareness} · {d.profile.reception} · {d.profile.draw}</p>
      <p className="text-xs text-white/60">{d.profile.persona.label} presentation · {d.profile.commercial.demand}</p>
      {!d.retired&&(d.moments.length>0||d.opportunities.length>0)&&<Link className="career-btn career-btn-ghost" href={`/career/${saveId}/life`}>{d.moments.length?"A meaningful Career Moment is waiting":"Optional off-board opportunities"}</Link>}
      <ul className="career-headlines">{d.news.slice(0,3).map(s=><li key={s.id}><Link href={`/career/${saveId}/stories`}>{s.title}</Link></li>)}</ul>
      {!d.news.length&&<p className="text-xs text-white/60">Important sporting and world headlines will appear here.</p>}
    </div>}</QueryState>
  </CareerSection>;
}
export function LifePage({ctx,initialTab="Profile"}:{ctx:ShellContext;initialTab?:string}) {
  const query=useCareerLife(ctx.save.id),choice=useLifeChoice(ctx.save.id),merch=useMerchandiseChoice(ctx.save.id);
  const [tab,setTab]=useState(initialTab),[message,setMessage]=useState<string|null>(null);
  const choose=async(kind:"moments"|"opportunities",id:string,value:string)=>{
    setMessage(null);try{await choice.mutateAsync({kind,id,choice:value});setMessage("Decision recorded.");}catch(e){setMessage(errorMessage(e));}
  };
  const merchandise=async(value:string)=>{setMessage(null);try{await merch.mutateAsync(value);setMessage("Merchandise decision recorded.");}catch(e){setMessage(errorMessage(e));}};
  const presentation=usePresentation(ctx.save.id);
  const d0=query.data;
  return <div className="space-y-3 career-life">
    {d0&&<CareerPageHero kicker="Career Life · Public profile" title={d0.profile.persona.label} accent="#c99bff" archival={d0.retired}
      stage={{venue:{venueType:"studio"},eventClass:"PROFESSIONAL_TOUR"}}
      subtitle={<p>{d0.profile.persona.description}</p>}
      portrait={presentation.data?<CareerShirt identity={presentation.data.identity} sponsors={presentation.data.placements} name={ctx.save.careerName??"Player"} scale="featured"/>:undefined}
      stats={[{label:"Awareness",value:d0.profile.awareness,tone:"gold"},{label:"Public reception",value:d0.profile.reception},{label:"Crowd draw",value:d0.profile.draw},
        {label:"Commercial income",value:formatPence(d0.commercialIncomePence),sub:d0.profile.commercial.demand,tone:"good"}]}/>}
    <CareerSection title="Career Life & Public Profile" icon={<Sparkles size={15}/>} accent="#c99bff">
    <div className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="tkdl-tab-rail" role="tablist" aria-label="Career Life areas">
        {["Profile","Opportunities","History"].map(t=><button type="button" className="tkdl-tab-trigger career-btn career-btn-ghost" role="tab" aria-selected={tab===t} key={t} onClick={()=>setTab(t)}>{t}</button>)}
      </div>
      <Link className="career-btn career-btn-ghost shrink-0" href={`/career/${ctx.save.id}/stories`}>News & Story Threads</Link>
    </div>
    {message&&<p role="status" className="px-4 text-sm">{message}</p>}
    <QueryState query={query} label="Reading Career Life">{d=><div className="p-4 pt-0 space-y-4">
      {d.retired&&<p>Retired Career — history remains readable; no new progression or opportunities.</p>}
      {!d.retired&&d.moments.map(m=><section key={m.id} className="career-life-moment space-y-2" aria-label="Career Moment">
        <h2 className="text-lg font-bold">{m.title}</h2>{m.steps.map((s,i)=><p className="text-sm text-white/75" key={i}>{s}</p>)}<p className="font-bold">{m.prompt}</p>
        <div className="flex flex-col gap-2">{m.kind==="ATMOSPHERE"?<button className="career-btn career-btn-ghost" disabled={choice.isPending} onClick={()=>choose("moments",m.id,"ACKNOWLEDGE")}>Continue</button>:
          m.choices.map(c=><button className="career-btn career-btn-ghost whitespace-normal text-left" disabled={choice.isPending} key={c.id} onClick={()=>choose("moments",m.id,c.id)}>{c.text}</button>)}</div>
      </section>)}
      {tab==="Profile"&&<Profile data={d}/>}
      {tab==="Opportunities"&&<section className="space-y-3"><h2 className="font-bold">Optional off-board opportunities</h2><details className="career-note"><summary>How opportunities work</summary><p>Accepting reserves the displayed date; fees settle through the Career ledger after that sporting week. Declining is not a sporting penalty.</p></details>
        {d.opportunities.map(o=><article key={o.id} className="career-life-card space-y-2">
          <h3 className="font-bold">{o.title}</h3><p className="text-sm">{o.description}</p>
          <p className="text-sm">S{o.season} · day {o.day} · agreed fee {formatPence(o.feePence)}</p><p className="text-xs text-white/60">{o.compatibility}</p>
          {o.conflicts.length>0&&<p className="text-sm text-amber-300">Calendar conflict: {o.conflicts.join(", ")}</p>}
          {!d.retired&&<div className="flex flex-wrap gap-2"><button className="career-btn career-btn-primary" disabled={choice.isPending||!o.canAccept} onClick={()=>choose("opportunities",o.id,"ACCEPT")}>Accept commitment</button>
            <button className="career-btn career-btn-ghost" disabled={choice.isPending} onClick={()=>choose("opportunities",o.id,"DECLINE")}>Decline</button></div>}
        </article>)}
        {!d.opportunities.length&&<CareerEmptyState title="No current opportunities">Availability follows real sporting stature and Career time.</CareerEmptyState>}
        <h2 className="font-bold">Lightweight merchandise agreement</h2><p className="text-sm">{d.merchandise.agreement??"No agreement"} · {d.merchandise.demand}</p>
        <p className="text-sm">Actual royalties: {formatPence(d.merchandise.incomePence)}. No inventory, pricing or ability boosts. An agreement pays a fixed royalty per eligible four-week accounting period; no past royalties are invented.</p>
        <p className="text-sm">Royalty terms: {formatPence(d.merchandise.royaltyPence??d.merchandise.offerRoyaltyPence)} per eligible four-week accounting period.</p>
        <p className="text-xs text-white/60">Sponsor-linked merchandise requires an active sponsor. It is a separate opt-in royalty agreement, not a change to sponsor obligations.</p>
        {d.merchandise.canOptIn&&<div className="flex flex-wrap gap-2">{[["REPLICA_SHIRT","Replica shirt"],["SIGNED_ITEMS","Signed items"],["SPONSOR_LINKED","Sponsor-linked merchandise"]].map(([v,label])=><button className="career-btn career-btn-ghost" disabled={merch.isPending} key={v} onClick={()=>merchandise(v)}>{label}</button>)}</div>}
        {d.merchandise.canStop&&<button className="career-btn career-btn-ghost" disabled={merch.isPending} onClick={()=>merchandise("STOP")}>Stop future merchandise royalties</button>}
      </section>}
      {tab==="History"&&<section className="space-y-3"><h2 className="font-bold">Remembered choices & commercial history</h2>
        {!d.history.length&&<CareerEmptyState title="No choices invented">Only your actual decisions are remembered.</CareerEmptyState>}
        <ul>{d.history.map(h=><li className="border-b border-white/10 py-2 text-sm" key={h.id}>S{h.season} W{h.week} · {h.kind.toLowerCase()} · {h.choice.toLowerCase().replaceAll("_"," ")}</li>)}</ul>
        <h3 className="font-bold">Accepted commitments</h3><ul>{d.commitments.map(c=><li className="py-2 text-sm" key={c.id}>{c.title} · S{c.season} day {c.day} · {c.status.toLowerCase()} · agreed {formatPence(c.feePence)}</li>)}</ul>
      </section>}
      {d.notes.length>0&&<details className="career-note"><summary>How Career Life is recorded</summary><p>{d.notes.join(" ")}</p></details>}
    </div>}</QueryState></CareerSection></div>;
}
function Profile({data:d}:{data:LifeView}) {
  return <section className="space-y-3"><h2 className="text-lg font-bold">Your public presentation</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[
      ["Persona",d.profile.persona.label],["Awareness / interest",d.profile.awareness],["Public reception",d.profile.reception],["Crowd draw",d.profile.draw],
      ["Commercial demand",d.profile.commercial.demand],["Commercial activity",d.profile.commercial.activity],
    ].map(([label,value])=><div className="career-life-stat" key={label}><h3>{label}</h3><p>{value}</p></div>)}</div>
    <p className="text-sm text-white/75">{d.profile.commercial.description}</p>
    <details className="career-note"><summary>Commercial income</summary><p>Actual commercial income: {formatPence(d.commercialIncomePence)} — part of A4 Sponsor/Commercial earnings, never prize earnings or a separate wallet.</p></details>
    {!!d.signatureProducts?.length&&<section><h3 className="font-bold">Factual signature products</h3>{d.signatureProducts.map(p=><p key={p.id}>{p.name} · S{p.launchSeason} · {p.state.toLowerCase()}</p>)}</section>}
    <h3 className="font-bold">Narrative relationship tone</h3>{d.relationshipTones.length?<ul className="career-life-tones">{d.relationshipTones.map(r=><li key={r.opponentId}>{r.name}: {r.tone.toLowerCase()} · sporting labels remain {r.sportingLabels.join(", ")||"unchanged"}</li>)}</ul>:
      <p className="text-sm text-white/60">No interaction-based tone yet. Sporting rivalry does not imply hatred.</p>}
  </section>;
}
export function StoriesPage({ctx,initialTab="News"}:{ctx:ShellContext;initialTab?:string}) {
  const query=useCareerLife(ctx.save.id),[tab,setTab]=useState(initialTab);
  const d0=query.data;
  return <div className="space-y-3 career-life">
    {d0&&<CareerPageHero kicker="Living darts world" title="News & Stories" accent="#d1a65c" stage={{venue:{venueType:"conference"},eventClass:"PROFESSIONAL_TOUR"}}
      subtitle={<p>Stories written from what actually happened in your Career and the world around it.</p>}
      actions={<Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/world/news`}><Newspaper size={15} aria-hidden/> Open the newsroom</Link>}
      stats={[{label:"Stories",value:d0.news.length,tone:"gold"},{label:"Story threads",value:d0.threads.length},
        {label:"Major scenes",value:d0.news.filter(s=>s.significance==="MAJOR").length},{label:"Latest",value:d0.news[0]?`S${d0.news[0].season}${d0.news[0].week?` W${d0.news[0].week}`:""}`:"—"}]}/>}
  <CareerSection title="Living darts world — News & Stories" icon={<Newspaper size={15}/>} accent="#d1a65c">
    <div className="p-4"><div className="tkdl-tab-rail" role="group" aria-label="Story views">{["News","Story Threads"].map(t=><button type="button" className="tkdl-tab-trigger career-btn career-btn-ghost" aria-pressed={tab===t} aria-selected={tab===t} key={t} onClick={()=>setTab(t)}>{t}</button>)}</div></div>
    <QueryState query={query} label="Reading living-world stories">{d=><div className="px-4 pb-4 space-y-3">
      {tab==="News"?(d.news.length?d.news.map(s=><StoryCard key={s.id} story={s} saveId={ctx.save.id}/>):<CareerEmptyState title="No significant stories yet">The feed waits for real sporting and world evidence.</CareerEmptyState>):
        d.threads.map(t=><details className="career-life-thread" key={t.id}><summary className="cursor-pointer font-bold">{t.title} · {t.stories.length} factual chapters</summary>
          <div className="mt-3 space-y-3">{t.stories.map(s=><StoryCard key={s.id} story={s} saveId={ctx.save.id}/>)}</div></details>)}
      <p className="career-fineprint">No scripted champion, invented emotion or hidden sporting modifier. Threads follow facts and actual choices.</p>
    </div>}</QueryState>
  </CareerSection></div>;
}
function StoryCard({story:s,saveId}:{story:Story;saveId:string}) {
  return <article className="career-story-card space-y-2" data-significance={s.significance}>
    <div className="flex flex-wrap gap-2"><StatusBadge label={s.scope.toLowerCase()} tone="neutral"/><StatusBadge label={s.significance==="MAJOR"?"Major Career Scene":s.significance==="MOMENT"?"Career Moment":"News"} tone={s.significance==="MAJOR"?"gold":"info"}/></div>
    <h3>{s.title}</h3><p className="text-sm">{s.body}</p><p className="text-xs text-white/60">S{s.season}{s.week?` W${s.week}`:" · week unknown"}{s.date?` · ${s.date}`:""}</p>
    {s.callbacks.map((c,i)=><p className="text-sm text-white/75" key={i}>{c.text}</p>)}
    {s.eventId&&<Link className="underline text-sm" href={`/career/${saveId}/events/${s.eventId}`}>Source event</Link>}
    <details className="text-xs text-white/60"><summary className="cursor-pointer">Factual sources</summary><p className="break-all">{[...s.sourceIds,...s.callbacks.flatMap(c=>c.sourceIds)].join(" · ")}</p></details>
  </article>;
}
export function NpcLifePage({ctx,npcId}:{ctx:ShellContext;npcId:string}) {
  const query=useNpcLife(ctx.save.id,npcId);
  return <CareerSection title="Public opponent identity"><QueryState query={query} label="Reading public opponent">{d=><div className="p-4 space-y-2">
    <h2 className="text-xl font-bold">{d.name}</h2><p>{d.standing} · {d.publicDraw}</p><p className="text-sm">Public presentation: {d.personality.primary.toLowerCase()}{d.personality.secondary?` / ${d.personality.secondary.toLowerCase()}`:""}</p>
    {d.retired&&<p>Retired player — sporting history remains available.</p>}<p className="text-xs text-white/60">{d.notes}</p>
    <Link className="underline" href={`/career/${ctx.save.id}/recognition/npcs/${npcId}`}>Sporting recognition</Link>
  </div>}</QueryState></CareerSection>;
}
