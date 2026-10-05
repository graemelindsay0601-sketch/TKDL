import { useState } from "react";
import { Link } from "wouter";
import { useLegacy, useSeasonReview, useEventLegacy, useNpcLegacy, useBeginSeason, useSaveLifecycle, errorMessage } from "../api";
import { CareerSection, QueryState, ConfirmButton, BoundedList } from "../components";
import { formatPence } from "../model";
import { HistoryPage } from "./history";
import type { ShellContext } from "../shell";
import type { Award, LegacyView, SeasonReview, RecordRow } from "../../../../../api-server/src/career/legacy/types";

const tabs=["Career Record","Seasons","Honours","World History","Event Legends","Records","Hall of Fame","Retirement"];
export function LegacyPage({ctx,initialTab="Career Record"}:{ctx:ShellContext;initialTab?:string}) {
  const query=useLegacy(ctx.save.id),[tab,setTab]=useState(initialTab),[season,setSeason]=useState<number|null>(null),[event,setEvent]=useState<string|null>(null);
  const seasonQuery=useSeasonReview(ctx.save.id,season),eventQuery=useEventLegacy(ctx.save.id,event);
  return <div className="space-y-3"><CareerSection title="History & Legacy">
    <div className="p-4 flex flex-wrap gap-2" role="tablist" aria-label="History & Legacy areas">{tabs.map(t=>
      <button key={t} role="tab" aria-selected={tab===t} className="career-btn career-btn-ghost" onClick={()=>setTab(t)}>{t}</button>)}</div>
    <QueryState query={query} label="Reading permanent Career history">{d=><div className="p-4 pt-0 space-y-4">
      {d.pendingReview!==null&&<Transition saveId={ctx.save.id} season={d.pendingReview}/>}
      {tab==="Career Record"&&<>
        <h2 className="font-bold">{d.descriptors.join(" · ")||"A darts Career in progress"}</h2>
        <p>{d.completedSeasons.length} completed seasons · {d.overview.titles} main-event titles · {d.overview.finals} finals · {d.overview.majorTitles} majors/Worlds · {d.overview.worlds} Worlds</p>
        <p>{d.overview.amateurTitles} amateur titles · {d.overview.proTitles} pro titles · highest recorded World ranking {d.bestRanking?`#${d.bestRanking.position}`:"not recorded"}</p>
        <p>Prize income {formatPence(d.prizePence)} · Sponsor/Commercial {formatPence(d.commercialPence)}</p>
        <h3 className="font-bold">Career eras</h3>{d.eras.map(e=><p key={e.from}>Seasons {e.from}–{e.to}: {e.label}</p>)}
        <h3 className="font-bold">Championship history</h3><BoundedList rows={d.championships}>{r=><p key={r.id}>Season {r.season}: {r.name} · {r.champion?"champion":`position ${r.position}`}</p>}</BoundedList>
        <h3 className="font-bold">Commercial Career</h3><BoundedList rows={d.sponsors}>{s=><p key={s.id}>{s.name}: signed term seasons {s.startSeason}–{s.endSeason} · {s.status}</p>}</BoundedList>
        <BoundedList rows={d.commercial}>{c=><p key={c.id}>Season {c.season}: {c.title} · {c.status}</p>}</BoundedList>
        {d.merchandise&&<p>Merchandise: {d.merchandise.category} · {d.merchandise.active?"active":"stopped"}</p>}
        <div className="flex flex-wrap gap-3"><Link className="underline" href={`/career/${ctx.save.id}/relationships`}>Sporting H2H & Rivalries</Link>
          <Link className="underline" href={`/career/${ctx.save.id}/life`}>Public profile, tone & commercial decisions</Link>
          <Link className="underline" href={d.storiesLink}>Career Story Threads</Link></div>
      </>}
      {tab==="Seasons"&&<><h2 className="font-bold">Season History</h2>{!d.reviews.length&&<p>No completed season yet. A partial retirement season is not a completed campaign.</p>}
        <BoundedList rows={d.reviews}>{r=><button key={r.season} className="career-btn career-btn-ghost mr-2 mb-2" onClick={()=>setSeason(r.season)}>Season {r.season} · {r.identity} · {r.provenance.toLowerCase()}</button>}</BoundedList>
        {season!==null&&<QueryState query={seasonQuery} label="Reading Season Review">{r=><SeasonReviewPanel review={r} saveId={ctx.save.id}/>}</QueryState>}</>}
      {tab==="Honours"&&<><h2 className="font-bold">Season Awards</h2><Awards rows={d.honours}/><p>Main-event title honours remain in the original factual trophy/result history below.</p></>}
      {tab==="World History"&&<><h2 className="font-bold">Career World History</h2><BoundedList rows={d.world} size={5}>{(w,i)=><section key={d.completedSeasons[i]} className="border border-white/15 rounded-lg p-3">
        <h3 className="font-bold">Season {d.completedSeasons[i]}</h3><p>Last published World #1: {w.numberOne?`${w.numberOne.name} (week ${w.numberOne.week})`:"not recorded"}</p>
        <BoundedList rows={w.champions}>{r=><p key={r.id}>{r.name}: {playerName(d,r.participant)} · {r.tier}</p>}</BoundedList>
        <BoundedList rows={w.cardChanges}>{c=><p key={c.id}>Tour Card: {playerName(d,c.participant)} · {c.source} · {c.status}</p>}</BoundedList>
        <BoundedList rows={w.retirements}>{p=><Link className="block underline" key={p.id} href={`/career/${ctx.save.id}/history/npcs/${p.id}`}>Retired: {p.name}</Link>}</BoundedList>
        <p>{w.newEntrants.length} recorded next-season entrants</p>{w.newEntrants.slice(0,8).map(p=><p key={p.id}>{p.name}</p>)}
      </section>}</BoundedList>
        <NpcSearch data={d} saveId={ctx.save.id}/></>}
      {tab==="Event Legends"&&<><h2 className="font-bold">Event History / Palace Legends</h2>
        <select className="bg-black border border-white/20 rounded p-2" value={event??""} onChange={e=>setEvent(e.target.value||null)} aria-label="Recurring event">
          <option value="">Choose a recorded event</option>{d.eventKeys.map(e=><option key={e.key} value={e.key}>{e.name}</option>)}</select>
        {event!==null&&<QueryState query={eventQuery} label="Reading event lineage">{e=><div className="space-y-2">
          <p>Defending champion: {e.defendingChampion?playerName(d,e.defendingChampion.participant):"no previous-season champion recorded"}</p>
          <h3 className="font-bold">Previous champions</h3><BoundedList rows={e.champions}>{r=><p key={r.id}>Season {r.season}: {playerName(d,r.participant)}</p>}</BoundedList>
          <h3 className="font-bold">Most titles</h3>{e.mostTitles.slice(0,10).map(p=><p key={p.id}>{p.name}: {p.count}</p>)}
          <h3 className="font-bold">Most finals</h3>{e.mostFinals.slice(0,10).map(p=><p key={p.id}>{p.name}: {p.count}</p>)}
          <h3 className="font-bold">Your event history</h3><BoundedList rows={e.human}>{r=><p key={r.id}>Season {r.season}: {r.champion?"champion":`position ${r.position}`}</p>}</BoundedList><p>{e.note}</p>
        </div>}</QueryState>}</>}
      {tab==="Records"&&<><h2 className="font-bold">Factual Universe Records</h2><Records rows={d.records}/>
        <h3 className="font-bold">Historical comparisons</h3>{d.comparisons.map(c=><p key={c}>{c}</p>)}
        <h3 className="font-bold">Recorded breakthroughs</h3><BoundedList rows={d.recordEvents}>{(r,i)=><p key={i}>Season {r.season}: {r.metric}, {r.previousValue} → {r.value} · {r.holders.map(h=>h.name).join(", ")}</p>}</BoundedList>
        <p>No NPC 180s/checkouts or simulated cash are compared with human GameScorer/ledger facts. No World #1 duration is inferred across snapshot gaps.</p></>}
      {tab==="Hall of Fame"&&<><h2 className="font-bold">Career-universe Hall of Fame</h2>{!d.hallOfFame.length&&<p>No qualifying retired Career recorded yet. Longevity alone is insufficient.</p>}
        <BoundedList rows={d.hallOfFame}>{h=><section className="border border-white/15 rounded-lg p-3" key={h.participant}><h3 className="font-bold">{h.name} — {h.route}</h3>{h.reasons.map(r=><p key={r}>{r}</p>)}
          {h.inductedSeason&&<p>Inducted in season {h.inductedSeason} · policy v{h.version}</p>}
          {h.participant!=="HUMAN"&&<Link className="underline" href={`/career/${ctx.save.id}/history/npcs/${h.participant}`}>View historical Career</Link>}</section>}</BoundedList>
        <p>No Legacy Score, currency or gameplay effect. Professional status is not mandatory.</p></>}
      {tab==="Retirement"&&<Retirement data={d} saveId={ctx.save.id}/>}
      <div className="text-xs text-white/60 space-y-1">{d.notes.map(n=><p key={n}>{n}</p>)}</div>
    </div>}</QueryState></CareerSection>
    {tab==="Career Record"&&<HistoryPage ctx={ctx}/>}
  </div>;
}
const playerName=(d:LegacyView,id:string)=>d.players.find(p=>p.id===id)?.name??"Recorded participant";
function NpcSearch({data,saveId}:{data:LegacyView;saveId:string}) {
  const [search,setSearch]=useState("");
  return <section><h3 className="font-bold">Public NPC history, including retired players</h3>
    <input className="bg-black border border-white/20 rounded p-2" aria-label="Search historical players" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search a public name"/>
    <p className="text-xs">Showing up to 30 matches; use a name to find older retired players.</p>
    {data.players.filter(p=>p.id!=="HUMAN"&&p.name.toLowerCase().includes(search.toLowerCase())).slice(0,30).map(p=>
      <Link className="block underline" key={p.id} href={`/career/${saveId}/history/npcs/${p.id}`}>{p.name}{p.retiredSeason?` · retired season ${p.retiredSeason}`:""}</Link>)}</section>;
}
function Awards({rows}:{rows:Award[]}) {
  return <div className="space-y-3">{!rows.length&&<p>No recorded awards. Older reconstructed seasons do not invent award winners.</p>}<BoundedList rows={rows}>{a=>
    <section key={`${a.season}:${a.kind}`}><h3 className="font-bold">Season {a.season} · {a.kind}: {a.name}</h3><p>{a.reason}</p><p className="text-xs text-white/60">{a.sources.join(" · ")}</p></section>}</BoundedList></div>;
}
function Records({rows}:{rows:RecordRow[]}) {
  return <div className="space-y-2">{rows.map(r=><p key={r.metric}>{r.metric}: {r.metric==="human-season-prize"?formatPence(r.value):r.value} — {r.holders.map(h=>h.name).join(", ")}<span className="block text-xs text-white/60">{r.scope}</span></p>)}</div>;
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
  return <section className="space-y-3"><h2 className="font-bold">{d.retired?"Final Career Summary":"Retire Career"}</h2>
    {d.finalSummary.map(s=><p key={s}>{s}</p>)}
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
