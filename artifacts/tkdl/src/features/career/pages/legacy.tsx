import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useLegacy, useSeasonReview, useEventLegacy, useNpcLegacy, useBeginSeason, useSaveLifecycle, usePresentation, errorMessage } from "../api";
import { CareerSection, QueryState, ConfirmButton, BoundedList } from "../components";
import { circuitLabel, formatPence, publicText, titleCase } from "../model";
import { Award as AwardIcon, Crown, Landmark, Medal, ScrollText, Star, Trophy } from "lucide-react";
import { CareerPageHero } from "../page-hero";
import { CareerShirt } from "../identity";
import { NpcHero } from "../npc-hero";
import { PLATES } from "../atmosphere";
import "./legacy.css";
import { HistoryPage } from "./history";
import type { ShellContext } from "../shell";
import type { Award, LegacyView, SeasonReview, RecordRow } from "../../../../../api-server/src/career/legacy/types";

const tabs=["Career Record","Seasons","Honours","World History","Event Legends","Records","Hall of Fame","Retirement"];
export function LegacyPage({ctx,initialTab="Career Record"}:{ctx:ShellContext;initialTab?:string}) {
  const query=useLegacy(ctx.save.id),[tab,setTab]=useState(initialTab),[season,setSeason]=useState<number|null>(null),[event,setEvent]=useState<string|null>(null);
  const seasonQuery=useSeasonReview(ctx.save.id,season),eventQuery=useEventLegacy(ctx.save.id,event);
  const presentation=usePresentation(ctx.save.id);
  const world=initialTab==="World History";
  return <div className="space-y-3 career-archive"><QueryState query={query} label="Building your Career legacy">{d=><CareerPageHero
      kicker={world?"Darts World · Champions & records":`The record you build · Season ${ctx.save.currentSeason}`} title={world?"World history":"Career archive"}
      stage={{venue:{venueType:world?"exhibition":"historic-theatre"},eventClass:"MAJOR"}} accent="#e8c66a" archival={ctx.retired}
      watermark={world?`S${ctx.save.currentSeason}`:`${d.overview.titles}`}
      subtitle={<p>{d.descriptors.join(" · ")||"Every result, sponsor and big moment from your darts career."}</p>}
      portrait={!world&&presentation.data?<CareerShirt identity={presentation.data.identity} sponsors={presentation.data.placements} name={ctx.save.careerName??"Player"} scale="featured"/>:undefined}
      stats={world?[
        {label:"Completed seasons",value:d.completedSeasons.length,tone:"gold"},
        {label:"Recorded players",value:d.players.filter(p=>p.id!=="HUMAN").length},
        {label:"Retired players",value:d.players.filter(p=>p.id!=="HUMAN"&&p.retiredSeason).length},
        {label:"Hall of Fame",value:d.hallOfFame.length},
      ]:[
        {label:"Main-event titles",value:d.overview.titles,tone:"gold"},
        {label:"Finals",value:d.overview.finals},
        {label:"Major / World titles",value:d.overview.majorTitles},
        {label:"Highest World rank",value:d.bestRanking?`#${d.bestRanking.position}`:"—"},
      ]}
      actions={<nav aria-label="Career commercial and legacy navigation" className="flex flex-wrap gap-2">
        <Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/sponsors`}>Sponsor HQ</Link>
        <Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/finances`}>Finances & ledger</Link>
        <Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/presentation`}>Equipment & signature products</Link>
      </nav>}/>}</QueryState><CareerSection title="History & Legacy" accent="#e8c66a">
    <div className="p-4 pb-3"><div className="tkdl-tab-rail" role="tablist" aria-label="History & Legacy areas">{tabs.map(t=>
      <button type="button" key={t} role="tab" aria-selected={tab===t} className="tkdl-tab-trigger career-btn career-btn-ghost" onClick={()=>setTab(t)}>{t}</button>)}</div></div>
    <QueryState query={query} label="Reading permanent Career history">{d=><div className="p-4 pt-0 space-y-4">
      {d.pendingReview!==null&&<Transition saveId={ctx.save.id} season={d.pendingReview}/>}
      {tab==="Career Record"&&<>
        <h2 className="career-archive__headline">{d.descriptors.join(" · ")||"A darts Career in progress"}</h2>
        <dl className="career-archive__facts">
          <div><dt>Completed seasons</dt><dd>{d.completedSeasons.length}</dd><small>{d.overview.worlds} Worlds · {d.overview.majorTitles} majors/Worlds</small></div>
          <div><dt>Titles by level</dt><dd>{d.overview.titles}</dd><small>{d.overview.amateurTitles} amateur titles · {d.overview.proTitles} pro titles</small></div>
          <div><dt>Prize income</dt><dd>{formatPence(d.prizePence)}</dd><small>Ranking & non-ranking prize money</small></div>
          <div><dt>Sponsor / commercial</dt><dd>{formatPence(d.commercialPence)}</dd><small>Highest World ranking {d.bestRanking?`#${d.bestRanking.position}`:"not recorded"}</small></div>
        </dl>
        {d.eras.length>0&&<><h3>Career eras</h3><ol className="career-archive__eras">{d.eras.map(e=><li key={e.from}><span>Seasons {e.from}–{e.to}</span><strong>{e.label}</strong></li>)}</ol></>}
        <div className="career-archive__cols">
          <section><h3>Championship history</h3>{d.championships.length?<BoundedList rows={d.championships}>{r=><div className="career-archive__row" key={r.id}>
            <span className="career-archive__chip">S{r.season}</span><strong>{r.name}</strong>{r.champion?<em className="is-gold">Champion</em>:<em>Position {r.position}</em>}</div>}</BoundedList>
            :<p className="career-archive__empty">Championship history is written when each season is completed. This season's titles are in the record below.</p>}</section>
          <section><h3>Commercial Career</h3>{d.sponsors.length||d.commercial.length?<>
            <BoundedList rows={d.sponsors}>{s=><div className="career-archive__row" key={s.id}><span className="career-archive__chip">S{s.startSeason}{s.endSeason!==s.startSeason?`–${s.endSeason}`:""}</span>
              <strong>{sponsorName(s.name)}</strong><em>Signed term · {titleCase(s.status)}</em></div>}</BoundedList>
            <BoundedList rows={d.commercial}>{c=><div className="career-archive__row" key={c.id}><span className="career-archive__chip">S{c.season}</span><strong>{c.title}</strong><em>{titleCase(c.status)}</em></div>}</BoundedList>
            {d.merchandise&&<div className="career-archive__row"><span className="career-archive__chip">Merch</span><strong>{d.merchandise.category}</strong><em>{d.merchandise.active?"Active":"Stopped"}</em></div>}
          </>:<p className="career-archive__empty">No sponsors or off-the-oche work yet.</p>}</section>
        </div>
        <div className="career-archive__links"><Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/relationships`}>Sporting H2H & Rivalries</Link>
          <Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/life`}>Public profile, tone & commercial decisions</Link>
          <Link className="career-btn career-btn-ghost" href={d.storiesLink}>Career Story Threads</Link></div>
      </>}
      {tab==="Seasons"&&<><h2>Season history</h2>{!d.reviews.length&&<ArchiveEmpty icon={<ScrollText size={18}/>} title="No completed season yet">Your first Season Review is written when Season {ctx.save.currentSeason} ends. A partial retirement season is not a completed campaign.</ArchiveEmpty>}
        <div className="career-archive__chips"><BoundedList rows={d.reviews}>{r=><button key={r.season} type="button" className={`career-archive__season${season===r.season?" is-active":""}`} onClick={()=>setSeason(r.season)}>
          <b>S{r.season}</b><span>{r.identity}</span><small>{titleCase(r.provenance)}</small></button>}</BoundedList></div>
        {season!==null&&<QueryState query={seasonQuery} label="Reading Season Review">{r=><SeasonReviewPanel review={r} saveId={ctx.save.id}/>}</QueryState>}</>}
      {tab==="Honours"&&<><h2>Season awards</h2><Awards rows={d.honours}/><p className="career-fineprint">Main-event title honours remain in the trophy and result history below.</p></>}
      {tab==="World History"&&<><h2>Career world history</h2>{!d.world.length&&<ArchiveEmpty icon={<Landmark size={18}/>} title="No completed world season yet">Champions, Tour Card changes, retirements and new players appear here at the end of each season.</ArchiveEmpty>}
        <BoundedList rows={d.world} size={5}>{(w,i)=><section key={d.completedSeasons[i]} className="career-archive__world-season">
        <header><span>Season {d.completedSeasons[i]}</span><strong>World #1: {w.numberOne?`${w.numberOne.name}`:"not recorded"}</strong>{w.numberOne&&<small>Week {w.numberOne.week}</small>}</header>
        {w.champions.length>0&&<><h3>Champions</h3><BoundedList rows={w.champions}>{r=><div className="career-archive__row" key={r.id}><span className="career-archive__chip"><Trophy size={11}/> {titleCase(r.tier)}</span><strong>{r.name}</strong><em>{playerName(d,r.participant)}</em></div>}</BoundedList></>}
        {w.cardChanges.length>0&&<><h3>Tour Card changes</h3><BoundedList rows={w.cardChanges}>{c=><div className="career-archive__row" key={c.id}><span className="career-archive__chip">Card</span><strong>{playerName(d,c.participant)}</strong><em>{titleCase(c.source)} · {titleCase(c.status)}</em></div>}</BoundedList></>}
        {w.retirements.length>0&&<><h3>Retirements</h3><BoundedList rows={w.retirements}>{p=><div className="career-archive__row" key={p.id}><span className="career-archive__chip">Retired</span><Link href={`/career/${ctx.save.id}/history/npcs/${p.id}`}><strong>{p.name}</strong></Link><em /></div>}</BoundedList></>}
        <h3>{w.newEntrants.length} new entrants</h3><div className="career-archive__names">{w.newEntrants.slice(0,8).map(p=><span key={p.id}>{p.name}</span>)}</div>
      </section>}</BoundedList>
        <NpcSearch data={d} saveId={ctx.save.id}/></>}
      {tab==="Event Legends"&&<><h2>Event history &amp; Palace legends</h2>
        <label className="career-archive__select"><span>Recurring event</span><select value={event??""} onChange={e=>setEvent(e.target.value||null)} aria-label="Recurring event">
          <option value="">Choose an event</option>{d.eventKeys.map(e=><option key={e.key} value={e.key}>{e.name}</option>)}</select></label>
        {!d.eventKeys.length&&<ArchiveEmpty icon={<Crown size={18}/>} title="No recurring event history yet">Each event's champions, record holders and your own finishes appear once it has been played.</ArchiveEmpty>}
        {event!==null&&<QueryState query={eventQuery} label="Reading event lineage">{e=><div className="career-archive__legend">
          <div className="career-archive__defending"><Crown size={18}/><div><small>Defending champion</small><strong>{e.defendingChampion?playerName(d,e.defendingChampion.participant):"No champion last season"}</strong></div></div>
          <div className="career-archive__cols">
            <section><h3>Previous champions</h3>{e.champions.length?<BoundedList rows={e.champions}>{r=><div className="career-archive__row" key={r.id}><span className="career-archive__chip">S{r.season}</span><strong>{playerName(d,r.participant)}</strong><em className="is-gold">Champion</em></div>}</BoundedList>:<p className="career-archive__empty">No champions yet.</p>}</section>
            <section><h3>Your event history</h3>{e.human.length?<BoundedList rows={e.human}>{r=><div className="career-archive__row" key={r.id}><span className="career-archive__chip">S{r.season}</span><strong>{r.champion?"Champion":`Position ${r.position}`}</strong><em className={r.champion?"is-gold":""}>{r.champion?"Title":"Finish"}</em></div>}</BoundedList>:<p className="career-archive__empty">You have not played this event yet.</p>}</section>
            <section><h3>Most titles</h3>{e.mostTitles.slice(0,10).map(p=><div className="career-archive__row" key={p.id}><span className="career-archive__chip">×{p.count}</span><strong>{p.name}</strong><em /></div>)}</section>
            <section><h3>Most finals</h3>{e.mostFinals.slice(0,10).map(p=><div className="career-archive__row" key={p.id}><span className="career-archive__chip">×{p.count}</span><strong>{p.name}</strong><em /></div>)}</section>
          </div>
          <p className="career-fineprint">{publicText(e.note)}</p>
        </div>}</QueryState>}</>}
      {tab==="Records"&&<><h2>Career-universe records</h2><Records rows={d.records}/>
        {d.comparisons.length>0&&<><h3>Historical comparisons</h3><ul className="career-archive__comparisons">{d.comparisons.map(c=><li key={c}><Star size={13}/>{publicText(c)}</li>)}</ul></>}
        {d.recordEvents.length>0&&<><h3>Recorded breakthroughs</h3><BoundedList rows={d.recordEvents}>{(r,i)=><div className="career-archive__row" key={i}><span className="career-archive__chip">S{r.season}</span><strong>{recordLabel(r.metric)}: {r.previousValue} → {r.value}</strong><em>{r.holders.map(h=>h.name).join(", ")}</em></div>}</BoundedList></>}
        <p className="career-fineprint">No NPC 180s/checkouts or simulated cash are compared with your scored darts or ledger. No World #1 duration is inferred across snapshot gaps.</p></>}
      {tab==="Hall of Fame"&&<><h2>Career-universe Hall of Fame</h2>{!d.hallOfFame.length&&<ArchiveEmpty icon={<Medal size={18}/>} title="No inductees yet">No retired legends yet. A long career alone isn't enough to get in.</ArchiveEmpty>}
        <div className="career-archive__cols"><BoundedList rows={d.hallOfFame}>{h=><section className="career-archive__inductee" key={h.participant}><header><Medal size={18}/><div><strong>{h.name}</strong><small>{h.route}</small></div></header>
          <ul>{h.reasons.map(r=><li key={r}>{publicText(r)}</li>)}</ul>
          {h.inductedSeason&&<p className="career-fineprint">Inducted in season {h.inductedSeason}</p>}
          {h.participant!=="HUMAN"&&<Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/history/npcs/${h.participant}`}>View historical Career</Link>}</section>}</BoundedList></div>
        <p className="career-fineprint">No Legacy Score, currency or gameplay effect. Professional status is not mandatory.</p></>}
      {tab==="Retirement"&&<Retirement data={d} saveId={ctx.save.id}/>}
      {d.notes.length>0&&<details className="career-note"><summary>How this works</summary>{d.notes.map(n=><p key={n}>{publicText(n)}</p>)}</details>}
    </div>}</QueryState></CareerSection>
    {tab==="Career Record"&&<HistoryPage ctx={ctx}/>}
  </div>;
}
/** Archive sponsor rows carry the sponsor key ("lochside-joinery"); show it as a name. */
const sponsorName=(name:string)=>/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)?titleCase(name):name;
const playerName=(d:LegacyView,id:string)=>d.players.find(p=>p.id===id)?.name??"Recorded participant";
function NpcSearch({data,saveId}:{data:LegacyView;saveId:string}) {
  const [search,setSearch]=useState("");
  const rows=data.players.filter(p=>p.id!=="HUMAN"&&p.name.toLowerCase().includes(search.toLowerCase())).slice(0,30);
  return <section className="career-archive__npcs"><h3>Public NPC history, including retired players</h3>
    <input className="career-archive__search" aria-label="Search historical players" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search a public name"/>
    <p className="career-archive__hint">Showing up to 30 matches; use a name to find older retired players.</p>
    <div className="career-archive__npc-grid">{rows.map(p=><Link key={p.id} className="career-archive__npc" href={`/career/${saveId}/history/npcs/${p.id}`}>
      <CareerShirt playerId={p.id} name={p.name} scale="compact"/><span><strong>{p.name}</strong><small>{p.retiredSeason?`Retired season ${p.retiredSeason}`:"Active"}</small></span></Link>)}</div></section>;
}
const RECORD_LABELS:Record<string,string>={titles:"Most titles",majorTitles:"Most major titles",appearances:"Most appearances",finals:"Most finals",
  "season-titles":"Most titles in a season","season-majorTitles":"Most major titles in a season","human-season-prize":"Your best prize-money season"};
const recordLabel=(metric:string)=>RECORD_LABELS[metric]??titleCase(metric.replace(/([a-z])([A-Z])/g,"$1 $2"));
function ArchiveEmpty({icon,title,children}:{icon:ReactNode;title:string;children:ReactNode}) {
  return <div className="career-archive__empty-state"><span aria-hidden="true">{icon}</span><div><strong>{title}</strong><p>{children}</p></div></div>;
}
function Awards({rows}:{rows:Award[]}) {
  if(!rows.length)return <ArchiveEmpty icon={<AwardIcon size={18}/>} title="No season awards yet">Awards are presented at the end of a completed season. Older reconstructed seasons do not invent award winners.</ArchiveEmpty>;
  return <div className="career-archive__cols"><BoundedList rows={rows}>{a=>
    <section key={`${a.season}:${a.kind}`} className="career-archive__award"><header><AwardIcon size={18}/><div><small>Season {a.season} · {publicText(a.kind)}</small><strong>{a.name}</strong></div></header><p>{publicText(a.reason)}</p></section>}</BoundedList></div>;
}
function Records({rows}:{rows:RecordRow[]}) {
  return <div className="career-archive__records">{rows.map(r=><div key={r.metric} className="career-archive__record">
    <small>{recordLabel(r.metric)}</small><strong>{r.metric==="human-season-prize"?formatPence(r.value):r.value}</strong>
    <span>{r.holders.map(h=>h.name).join(", ")}</span><em>{publicText(r.scope)}</em></div>)}</div>;
}
export function SeasonReviewPanel({review:r,saveId}:{review:SeasonReview;saveId:string}) {
  const highlights:[string,string][]=[
    ...(r.bestMajor?[["Best major",`${r.bestMajor.name} · position ${r.bestMajor.position}`] as [string,string]]:[]),
    ...(r.worldResult?[["World Championship",`${r.worldResult.name} · position ${r.worldResult.position}`] as [string,string]]:[]),
    ...(r.biggestMoment?[["Defining result",`${r.biggestMoment.name} · position ${r.biggestMoment.position}`] as [string,string]]:[]),
    ...(r.definingRival?[["Most-met season opponent",`${r.definingRival.name}; ${r.definingRival.meetings} meetings, ${r.definingRival.wins}–${r.definingRival.losses}.`] as [string,string]]:[]),
  ];
  return <section className="career-review space-y-4" aria-label={`Season ${r.season} Review`}>
    <header className="career-review__head"><img src={PLATES["historic-theatre"].src} alt="" aria-hidden="true" loading="lazy"/>
      <p className="career-review__kicker">{titleCase(r.provenance)} · permanent history</p>
      <h2>Season {r.season} Complete — {r.identity}</h2>
      {r.story.map(x=><p key={x}>{publicText(x)}</p>)}</header>
    <dl className="career-archive__facts">
      <div><dt>Prize money</dt><dd>{formatPence(r.prizePence)}</dd></div><div><dt>Sponsor / commercial</dt><dd>{formatPence(r.commercialPence)}</dd></div>
      <div><dt>Tour Card</dt><dd className="career-review__small">{publicText(r.cardStatus)}</dd></div>
      <div><dt>World ranking</dt><dd className="career-review__small">{r.finalRank?`#${r.finalRank.position}`:"—"}</dd>
        <small>Starting World rank: {r.startingRank?`#${r.startingRank.position} (previous season, week ${r.startingRank.week})`:"not recorded"} · Final published: {r.finalRank?`#${r.finalRank.position} (week ${r.finalRank.week})`:"not recorded"}</small></div>
    </dl>
    {highlights.length>0&&<div className="career-review__highlights">{highlights.map(([k,v])=><div key={k}><small>{k}</small><strong>{v}</strong></div>)}</div>}
    <h3>Awards & Champions</h3><Awards rows={r.awards}/>
    <div className="career-archive__cols">
      <section><h3>World champions</h3><div className="career-archive__row"><span className="career-archive__chip">#1</span><strong>Last published World #1: {r.world.numberOne?.name??"not recorded"}</strong><em /></div>
        <BoundedList rows={r.world.champions}>{c=><div className="career-archive__row" key={c.id}><span className="career-archive__chip"><Trophy size={11}/></span><strong>{c.name}</strong><em>{c.participantName??"Recorded participant"}</em></div>}</BoundedList></section>
      <section><h3>Career Changes</h3><ul className="career-archive__summary">{r.changes.map(c=><li key={c}>{publicText(c)}</li>)}
        {r.sponsors.map(x=><li key={x.id}>Sponsor: {sponsorName(x.name)} · {titleCase(x.status)}</li>)}</ul>
        {r.world.cardChanges.map(c=><div className="career-archive__row" key={c.id}><span className="career-archive__chip">Card</span><strong>{c.participantName??"Recorded participant"}</strong><em>{titleCase(c.source)} · {titleCase(c.status)}</em></div>)}
        {r.world.retirements.map(x=><div className="career-archive__row" key={x.id}><span className="career-archive__chip">Retired</span><strong>{x.name}</strong><em /></div>)}</section>
    </div>
    <p className="career-fineprint">{r.publicLife.decisions} remembered Career Life decisions · {r.publicLife.completedWork} completed off-board commitments.
      {r.publicLife.profile&&<> Public profile at transition: {r.publicLife.profile.persona.label} · {r.publicLife.profile.awareness} · {r.publicLife.profile.reception}</>}</p>
    <Link className="career-btn career-btn-ghost" href={`/career/${saveId}/stories`}>Established Career Story Threads</Link>
    {r.notes.length>0&&<details className="career-note"><summary>How this works</summary>{r.notes.map(n=><p key={n}>{publicText(n)}</p>)}</details>}
  </section>;
}
const TRANSITION_STEPS=["Season Review","Awards & Champions","Career Changes","New Season"];
export function Transition({saveId,season}:{saveId:string;season:number}) {
  const query=useSeasonReview(saveId,season),begin=useBeginSeason(saveId),[step,setStep]=useState(0),[message,setMessage]=useState<string|null>(null);
  return <section className="career-transition" aria-label="Season-end transition">
    <img className="career-transition__plate" src={PLATES.palace.src} alt="" aria-hidden="true" loading="lazy"/>
    <header><p className="career-review__kicker">Season {season} · End of season</p><h2>Season Complete</h2>
      <ol className="career-new-career__steps career-transition__steps">{TRANSITION_STEPS.map((label,i)=><li key={label} className={i===step?"is-current":i<step?"is-done":""} aria-current={i===step?"step":undefined}><b>{i+1}</b>{label}</li>)}</ol></header>
    <QueryState query={query} label="Reading completed season">{r=><div className="career-transition__body">
      <p className="career-fineprint">Step {step+1} of 4 · Season {season}</p>
      {step===0&&<><h3>Season Review</h3><p className="career-transition__identity">{r.identity}</p>{r.story.map(x=><p key={x}>{publicText(x)}</p>)}</>}
      {step===1&&<><h3>Awards & Champions</h3><Awards rows={r.awards}/><div className="career-archive__row"><span className="career-archive__chip">#1</span><strong>World #1: {r.world.numberOne?.name??"not recorded"}</strong><em /></div>
        {r.world.champions.map(c=><div className="career-archive__row" key={c.id}><span className="career-archive__chip"><Trophy size={11}/></span><strong>{c.name} champion: {c.participantName??"Recorded participant"}</strong><em /></div>)}</>}
      {step===2&&<><h3>Career Changes</h3><ul className="career-archive__summary"><li>{publicText(r.cardStatus)}</li>{r.changes.map(c=><li key={c}>{publicText(c)}</li>)}{r.sponsors.map(x=><li key={x.id}>{sponsorName(x.name)}: {titleCase(x.status)}</li>)}</ul>
        {r.world.retirements.map(x=><div className="career-archive__row" key={x.id}><span className="career-archive__chip">Retired</span><strong>{x.name}</strong><em /></div>)}
        {r.world.cardChanges.map(c=><div className="career-archive__row" key={c.id}><span className="career-archive__chip">Card</span><strong>Tour Card: {c.participantName??"Recorded participant"}</strong><em>{titleCase(c.source)}</em></div>)}
        <p className="career-fineprint">{r.world.newEntrants.length} recorded next-season entrants.</p></>}
      {step===3&&<><h3>New Season</h3><p>Season {season+1} is ready. Beginning it acknowledges this review; it does not rerun development, rankings or payments.</p></>}
      <div className="career-transition__actions">{step>0&&<button className="career-btn career-btn-ghost" onClick={()=>setStep(step-1)}>Back</button>}
      {step<3?<button className="career-btn career-btn-primary" onClick={()=>setStep(step+1)}>Next section</button>:
        <button className="career-btn career-btn-primary" disabled={begin.isPending} onClick={()=>begin.mutate(season,{onError:e=>setMessage(errorMessage(e))})}>Begin Season {season+1}</button>}</div>
      {message&&<p role="alert">{message}</p>}
    </div>}</QueryState>
  </section>;
}
function Retirement({data:d,saveId}:{data:LegacyView;saveId:string}) {
  const lifecycle=useSaveLifecycle(),[message,setMessage]=useState<string|null>(null);
  return <section className="space-y-3"><h2>{d.retired?"Final Career Summary":"Retire Career"}</h2>
    <ul className="career-archive__summary">{d.finalSummary.map(s=><li key={s}>{publicText(s)}</li>)}</ul>
    {d.retired&&<Link className="career-btn career-btn-gold" href={`/career/${saveId}/my-career/remembered`}>Watch A Career Remembered</Link>}
    {d.retired?<p>Read-only archive. This Career remains browsable.</p>:<ConfirmButton label="Retire Career" confirmLabel="Confirm permanent retirement" danger busy={lifecycle.retire.isPending}
      description="This freezes this Career permanently and preserves its complete history. It does not affect your TKDL account, coins, leagues or other Career saves."
      onConfirm={()=>lifecycle.retire.mutate(saveId,{onError:e=>setMessage(errorMessage(e))})}/>}
    {message&&<p role="alert">{message}</p>}
  </section>;
}
export function NpcLegacyPage({ctx,npcId}:{ctx:ShellContext;npcId:string}) {
  const query=useNpcLegacy(ctx.save.id,npcId);
  return <div className="space-y-3 career-archive"><NpcHero ctx={ctx} npcId={npcId} current="history" kicker="Historical Career"/>
  <CareerSection title="Historical NPC Career" accent="#69b8ec"><QueryState query={query} label="Reading owned public NPC history">{d=><div className="p-4 space-y-3">
    <h2>{d.player.name}{d.player.retiredSeason?` · Retired season ${d.player.retiredSeason}`:""}</h2>
    <dl className="career-archive__facts">
      <div><dt>Titles</dt><dd>{d.totals?.titles??0}</dd></div><div><dt>Majors / Worlds</dt><dd>{d.totals?.majorTitles??0}</dd></div>
      <div><dt>World Championships</dt><dd>{d.totals?.worlds??0}</dd></div>{d.hallOfFame&&<div><dt>Hall of Fame</dt><dd>{d.hallOfFame.route}</dd></div>}
    </dl>
    <div className="career-archive__cols">
      <section><h3>Titles</h3>{d.titles.length?<BoundedList rows={d.titles}>{t=><div className="career-archive__row" key={t.id}><span className="career-archive__chip">S{t.season}</span><strong>{t.name}</strong><em className="is-gold">Champion</em></div>}</BoundedList>:<p className="career-archive__empty">No titles yet.</p>}</section>
      <section><h3>Meetings with you</h3>{(d.meetings??[]).length?<BoundedList rows={d.meetings??[]}>{(m,i)=><div className="career-archive__row" key={i}><span className="career-archive__chip">S{m.season}</span><strong>{m.name}</strong><em className={m.won?"is-gold":""}>{m.won?"You won":"They won"}</em></div>}</BoundedList>:<p className="career-archive__empty">You have not played this player yet.</p>}</section>
      <section><h3>Published World Ranking</h3>{d.rankings.length?<BoundedList rows={d.rankings}>{r=><div className="career-archive__row" key={`${r.id}:${r.participant}`}><span className="career-archive__chip">S{r.season} W{r.week}</span><strong>#{r.position}</strong><em /></div>}</BoundedList>:<p className="career-archive__empty">No published World Ranking position yet.</p>}
        <p className="career-fineprint">Season endpoints and #1 observations, not every weekly position or an inferred reign length.</p></section>
      {d.cards.length>0&&<section><h3>Tour Cards</h3>{d.cards.map(c=><div className="career-archive__row" key={c.id}><span className="career-archive__chip">S{c.startSeason}–{c.endSeason}</span><strong>{titleCase(c.source)}</strong><em>{titleCase(c.status)}</em></div>)}</section>}
    </div>
    <Awards rows={d.awards}/>
  </div>}</QueryState></CareerSection></div>;
}
