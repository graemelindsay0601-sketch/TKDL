import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useLegacy, useSeasonReview, useEventLegacy, useNpcLegacy, useBeginSeason, useSaveLifecycle, usePresentation, errorMessage } from "../api";
import { CareerSection, QueryState, ConfirmButton, BoundedList } from "../components";
import { circuitLabel, formatPence, publicText, titleCase } from "../model";
import { Award as AwardIcon, Crown, Landmark, Medal, ScrollText, Star, Trophy } from "lucide-react";
import { CareerPageHero } from "../page-hero";
import { CareerShirt } from "../identity";
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
      subtitle={<p>{d.descriptors.join(" · ")||"Every result, partnership and turning point recorded across your darts career."}</p>}
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
          </>:<p className="career-archive__empty">No sponsor agreements or commercial work recorded yet.</p>}</section>
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
      {tab==="World History"&&<><h2>Career world history</h2>{!d.world.length&&<ArchiveEmpty icon={<Landmark size={18}/>} title="No completed world season yet">Champions, Tour Card changes, retirements and new entrants are recorded here at the end of each season.</ArchiveEmpty>}
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
          <option value="">Choose a recorded event</option>{d.eventKeys.map(e=><option key={e.key} value={e.key}>{e.name}</option>)}</select></label>
        {!d.eventKeys.length&&<ArchiveEmpty icon={<Crown size={18}/>} title="No recurring event history yet">Each event's champions, record holders and your own finishes appear once it has been played.</ArchiveEmpty>}
        {event!==null&&<QueryState query={eventQuery} label="Reading event lineage">{e=><div className="career-archive__legend">
          <div className="career-archive__defending"><Crown size={18}/><div><small>Defending champion</small><strong>{e.defendingChampion?playerName(d,e.defendingChampion.participant):"No previous-season champion recorded"}</strong></div></div>
          <div className="career-archive__cols">
            <section><h3>Previous champions</h3>{e.champions.length?<BoundedList rows={e.champions}>{r=><div className="career-archive__row" key={r.id}><span className="career-archive__chip">S{r.season}</span><strong>{playerName(d,r.participant)}</strong><em className="is-gold">Champion</em></div>}</BoundedList>:<p className="career-archive__empty">No champions recorded yet.</p>}</section>
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
      {tab==="Hall of Fame"&&<><h2>Career-universe Hall of Fame</h2>{!d.hallOfFame.length&&<ArchiveEmpty icon={<Medal size={18}/>} title="No inductees yet">No qualifying retired Career recorded yet. Longevity alone is insufficient.</ArchiveEmpty>}
        <div className="career-archive__cols"><BoundedList rows={d.hallOfFame}>{h=><section className="career-archive__inductee" key={h.participant}><header><Medal size={18}/><div><strong>{h.name}</strong><small>{h.route}</small></div></header>
          <ul>{h.reasons.map(r=><li key={r}>{publicText(r)}</li>)}</ul>
          {h.inductedSeason&&<p className="career-fineprint">Inducted in season {h.inductedSeason}</p>}
          {h.participant!=="HUMAN"&&<Link className="career-btn career-btn-ghost" href={`/career/${ctx.save.id}/history/npcs/${h.participant}`}>View historical Career</Link>}</section>}</BoundedList></div>
        <p className="career-fineprint">No Legacy Score, currency or gameplay effect. Professional status is not mandatory.</p></>}
      {tab==="Retirement"&&<Retirement data={d} saveId={ctx.save.id}/>}
      {d.notes.length>0&&<details className="career-note"><summary>How this archive is recorded</summary>{d.notes.map(n=><p key={n}>{publicText(n)}</p>)}</details>}
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
  return <section className="space-y-3" aria-label={`Season ${r.season} Review`}><h2 className="text-xl font-bold">Season {r.season} Complete — {r.identity}</h2>
    <p className="text-xs">{r.provenance.toLowerCase()} · permanent history</p>{r.story.map(s=><p key={s}>{s}</p>)}
    <p>Prize {formatPence(r.prizePence)} · Sponsor/Commercial {formatPence(r.commercialPence)}</p>
    <p>{r.cardStatus}</p><p>Starting World rank: {r.startingRank?`#${r.startingRank.position} (previous season, week ${r.startingRank.week})`:"not recorded"} · Final published: {r.finalRank?`#${r.finalRank.position} (week ${r.finalRank.week})`:"not recorded"}</p>
    {r.bestMajor&&<p>Best major: {r.bestMajor.name} · position {r.bestMajor.position}</p>}
    {r.worldResult&&<p>World Championship: {r.worldResult.name} · position {r.worldResult.position}</p>}
    {r.biggestMoment&&<p>Defining recorded result: {r.biggestMoment.name} · position {r.biggestMoment.position}</p>}
    {r.definingRival&&<p>Most-met season opponent: {r.definingRival.name}; {r.definingRival.meetings} meetings, {r.definingRival.wins}–{r.definingRival.losses}.</p>}
    <h3 className="font-bold">Awards & Champions</h3><Awards rows={r.awards}/>
    <p>Last published World #1: {r.world.numberOne?.name??"not recorded"}</p>
    <BoundedList rows={r.world.champions}>{c=><p key={c.id}>{c.name}: {c.participantName??"Recorded participant"}</p>}</BoundedList>
    <h3 className="font-bold">Career Changes</h3>{r.changes.map(c=><p key={c}>{c}</p>)}
    {r.world.cardChanges.map(c=><p key={c.id}>Card change: {c.participantName??"Recorded participant"} · {c.source} · {c.status}</p>)}
    {r.world.retirements.map(p=><p key={p.id}>Retirement: {p.name}</p>)}
    {r.sponsors.map(s=><p key={s.id}>Sponsor: {s.name} · {s.status}</p>)}
    <p>{r.publicLife.decisions} remembered Career Life decisions · {r.publicLife.completedWork} completed off-board commitments.</p>
    {r.publicLife.profile&&<p>Public profile at transition: {r.publicLife.profile.persona.label} · {r.publicLife.profile.awareness} · {r.publicLife.profile.reception}</p>}
    <Link className="underline" href={`/career/${saveId}/stories`}>Established Career Story Threads</Link>
    {r.notes.map(n=><p className="text-xs text-white/60" key={n}>{n}</p>)}
  </section>;
}
export function Transition({saveId,season}:{saveId:string;season:number}) {
  const query=useSeasonReview(saveId,season),begin=useBeginSeason(saveId),[step,setStep]=useState(0),[message,setMessage]=useState<string|null>(null);
  return <section className="rounded-xl border border-yellow-500/40 p-4 space-y-3" aria-label="Season-end transition">
    <h2 className="font-bold">Season Complete → Review → Awards & Champions → Career Changes → New Season</h2>
    <QueryState query={query} label="Reading completed season">{r=><>
      <p>Step {step+1} of 4 · Season {season}</p>
      {step===0&&<><h3>Season Review</h3><p>{r.identity}</p>{r.story.map(s=><p key={s}>{s}</p>)}</>}
      {step===1&&<><h3>Awards & Champions</h3><Awards rows={r.awards}/><p>World #1: {r.world.numberOne?.name??"not recorded"}</p>{r.world.champions.map(c=><p key={c.id}>{c.name} champion: {c.participantName??"Recorded participant"}</p>)}</>}
      {step===2&&<><h3>Career Changes</h3><p>{r.cardStatus}</p>{r.changes.map(c=><p key={c}>{c}</p>)}{r.sponsors.map(s=><p key={s.id}>{s.name}: {s.status}</p>)}
        {r.world.retirements.map(p=><p key={p.id}>Retired: {p.name}</p>)}{r.world.cardChanges.map(c=><p key={c.id}>Tour Card: {c.participantName??"Recorded participant"} · {c.source}</p>)}
        <p>{r.world.newEntrants.length} recorded next-season entrants.</p></>}
      {step===3&&<><h3>New Season</h3><p>The existing authorities have prepared season {season+1}. Begin acknowledges this review; it does not rerun development, rankings or payments.</p></>}
      {step>0&&<button className="career-btn career-btn-ghost" onClick={()=>setStep(step-1)}>Back</button>}
      {step<3?<button className="career-btn career-btn-primary" onClick={()=>setStep(step+1)}>Next section</button>:
        <button className="career-btn career-btn-primary" disabled={begin.isPending} onClick={()=>begin.mutate(season,{onError:e=>setMessage(errorMessage(e))})}>Begin Season {season+1}</button>}
      {message&&<p role="alert">{message}</p>}
    </>}</QueryState>
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
  return <CareerSection title="Historical NPC Career"><QueryState query={query} label="Reading owned public NPC history">{d=><div className="p-4 space-y-3">
    <h2 className="font-bold">{d.player.name}{d.player.retiredSeason?` · Retired season ${d.player.retiredSeason}`:""}</h2>
    <p>{d.totals?.titles??0} titles · {d.totals?.majorTitles??0} majors/Worlds · {d.totals?.worlds??0} World Championships</p>
    <BoundedList rows={d.titles}>{t=><p key={t.id}>Season {t.season}: {t.name}</p>}</BoundedList><Awards rows={d.awards}/>
    {d.cards.map(c=><p key={c.id}>Card {c.source}: seasons {c.startSeason}–{c.endSeason} · {c.status}</p>)}
    {d.hallOfFame&&<p>Hall of Fame: {d.hallOfFame.route}</p>}
    <h3 className="font-bold">Published World Ranking History</h3><p className="text-xs">Season endpoints and #1 observations, not every weekly position or an inferred reign length.</p><BoundedList rows={d.rankings}>{r=><p key={`${r.id}:${r.participant}`}>Season {r.season}, week {r.week}: #{r.position}</p>}</BoundedList>
    <h3 className="font-bold">Actual human meetings</h3><BoundedList rows={d.meetings??[]}>{(m,i)=><p key={i}>Season {m.season}: {m.name} · {m.won?"human win":"opponent win"}</p>}</BoundedList>
    <Link className="underline" href={`/career/${ctx.save.id}/life/npcs/${npcId}`}>Public personality & draw</Link>
  </div>}</QueryState></CareerSection>;
}
