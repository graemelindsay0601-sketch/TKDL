import {useState} from "react";
import {Link} from "wouter";
import {useCalendar,useSporting,useFinance,useHistory,useActiveTournament,usePresentation,useCareerProfile,useCareerLife,useLegacy,useEnterEvent,errorMessage} from "../api";
import {CareerSection,CareerEventCard,CareerEmptyState,CareerError,CareerLoading,StatTile,OSWALD} from "../components";
import {pickNextEvent,formatPence,ordinal,circuitLabel,denialLabel} from "../model";
import {CareerPlayerCard,CareerEventIdentity} from "../identity";
import {ContextHelp} from "../guidance";
import {TournamentResume} from "./tournament";
import type {ShellContext} from "../shell";

/** A decision screen. All outcomes/costs/opportunities remain provider facts. */
export function HomePage({ctx}:{ctx:ShellContext}) {
  const {save,retired}=ctx,id=save.id;
  const s=useSporting(id),f=useFinance(id),p=usePresentation(id),profile=useCareerProfile(id),life=useCareerLife(id),legacy=useLegacy(id);
  const q=useCalendar(id,{scope:"WORLD",fromWeek:Math.max(1,save.currentWeek-2),toWeek:Math.min(52,save.currentWeek+8)},!retired);
  const history=useHistory(id,{participant:"HUMAN"}),t=useActiveTournament(id,!retired),enter=useEnterEvent(id),[message,setMessage]=useState("");
  const active=t.data?.tournaments.find(x=>!x.terminal),next=q.data?pickNextEvent(q.data.events,q.data.overview):null;
  const opportunities=(q.data?.events??[]).filter(e=>e.human?.canEnter&&e.id!==next?.event.id).slice(0,4);
  const entered=(q.data?.events??[]).filter(e=>e.human&&["ENTERED","CONFIRMED","PLAYING"].includes(e.human.relationship)).slice(0,5);
  const pending=q.data?.overview.pendingHumanMatches.find(m=>m.eventId===next?.event.id);
  const onEnter=(eventId:string)=>enter.mutate(eventId,{onSuccess:r=>setMessage(r.entered?"Entry confirmed.":r.denials.map(denialLabel).join(" · ")),onError:e=>setMessage(errorMessage(e))});
  return <div className="career-home space-y-3">
    <section className="career-status-strip career-surface surface-context" aria-label="Player status">
      <CareerPlayerCard name={profile.data?.displayName??save.careerName??"My Career"} nickname={p.data?.identity.nickname} identity={p.data?.identity} sponsors={p.data?.placements} scale="compact" rank={s.data?.worldRanking.standing?.position}/>
      <p>{profile.data?.status==="COMPLETE"?`Age ${profile.data.age} · `:""}Career: Season {save.currentSeason} · {retired?"Retired record":s.data?.tourCard.holdsCard?"Tour Card active":"Open / amateur career"} · {formatPence(f.data?.balancePence??save.balancePence)} · {f.data?.sponsor?.displayName??"Self-funded"}</p>
    </section>
    <ContextHelp saveId={id} topic="home"/>
    {(save.eventDatabaseVersion??0)>=5&&save.currentSeason===1&&!retired&&<p className="career-help">Establishment season: choose your own amateur path. Your first normal Q-School opportunity opens at the Season 1 → 2 boundary. Turning professional is optional.</p>}
    <section className="career-surface surface-focus" aria-label="Next Up">
      <h2>Next Up</h2>
      {retired?<><h3>Your permanent Career record</h3><p>Retired. Results, relationships, sponsors, reviews and honours remain readable.</p><Link className="career-btn career-btn-primary" href={`/career/${id}/my-career/history`}>Explore your history</Link></>:
        legacy.data?.pendingReview?<><ContextHelp saveId={id} topic="review"/><Link className="career-btn career-btn-primary" href={`/career/${id}/my-career/history`}>Continue Season Review</Link></>:
        active?<><h3>Tournament in progress</h3><p>{active.name}</p><Link className="career-btn career-btn-primary" href={`/career/${id}/tournaments/${active.eventId}`}>Return to Tournament</Link><p>Leaving a screen never withdraws you. Your verified match stays resumable.</p></>:
        t.isLoading||legacy.isLoading?<CareerLoading label="Reading Career status"/>:
        t.error||legacy.error?<CareerError error={t.error||legacy.error} onRetry={()=>{void t.refetch();void legacy.refetch();}}/>:
        q.isLoading?<CareerLoading label="Finding your next event"/>:q.error?<CareerError error={q.error} onRetry={()=>q.refetch()}/>:
        next?<CareerEventIdentity eventKey={next.event.definitionKey} circuit={next.event.circuit} level={next.event.presentation.tier}>
          <h3>{next.event.name}</h3><p>{next.reason} · {next.event.venue.city} · Week {next.event.dates.startWeek}</p>
          {pending?<Link className="career-btn career-btn-primary" href={`/career/${id}/tournaments/${next.event.id}/matches/${pending.matchId}`}>Prepare / Play match</Link>:<CareerEventCard event={next.event} saveId={id} onEnter={onEnter} entering={enter.isPending}/>}
          {next.event.finance&&<div className="career-planning-costs"><p>Commitment (estimated): {formatPence(next.event.finance.entryFeePence+next.event.finance.estimatedTravelPence+next.event.finance.estimatedAccommodationPence)}</p><p>Sponsor coverage: {formatPence(next.event.finance.sponsorCoverage.entryFeePence+next.event.finance.sponsorCoverage.travelPence+next.event.finance.sponsorCoverage.accommodationPence)}</p><p>Your cost (estimated): {formatPence(next.event.finance.estimatedPlayerCostPence)}</p></div>}
        </CareerEventIdentity>:<CareerEmptyState title="No current entry decision">Continue Career in the header to reach your next meaningful date, or explore Map and Calendar.</CareerEmptyState>}
      {message&&<p role="status">{message}</p>}
    </section>
    {!retired&&t.data?.tournaments.some(x=>x.terminal)&&<TournamentResume saveId={id}/>}
    <section aria-label="Your Position"><h2>Your Position</h2><div className="career-position-grid">
      <StatTile label="World Rank" value={s.isLoading?"Reading…":s.error?"Unavailable":s.data?.worldRanking.standing?.position?ordinal(s.data.worldRanking.standing.position):"Unranked"} to={`/career/${id}/rankings`} sub="Published sporting position, not a level"/>
      <StatTile label="Tour Card" value={s.isLoading?"Reading…":s.error?"Unavailable":s.data?.tourCard.holdsCard?"Active":"No Tour Card"} to={`/career/${id}/q-school`} sub="Professional darts is optional"/>
      <StatTile label="Balance" value={formatPence(f.data?.balancePence??save.balancePence)} to={`/career/${id}/finances`} sub={f.data?`${formatPence(f.data.availablePence)} available`:"Career cash, separate from TKDL coins"}/>
    </div></section>
    {!retired&&<CareerSection title="Relevant Opportunities" action={<Link href={`/career/${id}/map`}>View All</Link>}>
      {opportunities.length?opportunities.map(e=><CareerEventCard key={e.id} event={e} saveId={id} compact onEnter={onEnter} entering={enter.isPending}/>):<CareerEmptyState title="No open opportunities in this window">Other open circuits and future dates remain discoverable in the Calendar.</CareerEmptyState>}
    </CareerSection>}
    {!retired&&<CareerSection title="Short Season Timeline" action={<Link href={`/career/${id}/calendar`}>Plan your season</Link>}>
      {entered.length?entered.map(e=><CareerEventCard key={e.id} event={e} saveId={id} compact/>):<p className="p-4">No entered commitments nearby. Qualified does not mean entered.</p>}
    </CareerSection>}
    <CareerSection title="Around the World" action={<Link href={`/career/${id}/world`}>Darts World</Link>}>
      {life.data?.news.length?life.data.news.slice(0,3).map(n=><p className="p-4" key={n.id}><Link href={`/career/${id}/stories`}>{n.title}</Link></p>):<p className="p-4">No recent developments recorded. Explore the current rankings, players and championships.</p>}
    </CareerSection>
    <CareerSection title="Recent Result" action={<Link href={`/career/${id}/my-career/performance`}>View All</Link>}>
      {history.data?.length?history.data.slice(0,3).map(r=><CareerEventIdentity key={r.eventId} eventKey={r.definitionKey} circuit={r.circuit}><p className="p-4"><Link href={`/career/${id}/events/${r.eventId}`}>{r.name}</Link> · S{r.season} · {r.champion?"Champion":r.stageReached} · {circuitLabel(r.circuit)}</p></CareerEventIdentity>):<p className="p-4">No results yet. Your first finished event will appear here.</p>}
    </CareerSection>
    {!retired&&!!f.data?.availableOffers&&<aside className="career-surface surface-context"><Link href={`/career/${id}/finances`}>Sponsor decision available — review terms and coverage</Link></aside>}
    {s.error&&<CareerError error={s.error} onRetry={()=>s.refetch()}/>}
    {f.error&&<CareerError error={f.error} onRetry={()=>f.refetch()}/>}
  </div>;
}
export function AgeLine({saveId}:{saveId:string}) {
  const p=useCareerProfile(saveId).data;if(p?.status!=="COMPLETE")return null;
  const parts=[`Age ${p.age}`,`Career started at ${p.ageAtCareerStart}`];
  if(p.junior)parts.push(`Junior events until you turn ${p.juniorMaxAgeExclusive}`);
  if(!p.qSchool.eligibleNow&&p.qSchool.eligibleFrom)parts.push(`Q-School from ${p.qSchool.eligibleFrom.date}`);
  return <p className="text-xs px-1" style={OSWALD}>{parts.join(" · ")}</p>;
}
