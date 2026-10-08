import {useState} from "react";
import {Link,useLocation} from "wouter";
import {Flag,MapPin,Swords,Trophy} from "lucide-react";
import {BullUpBoard} from "@/components/game-scorer";
import {resolveBullUp} from "@/lib/darts-rules";
import {useTournament,useActiveTournament,useTournamentAction,useTournamentPresentation,useAdvance,errorMessage,type TournamentView} from "../api";
import {CareerLoading,CareerError,ConfirmButton,Label,OSWALD,StatusBadge} from "../components";
import {formatPence} from "../model";
import {CareerShirt,CareerEventIdentity,CareerTrophy} from "../identity";
import {ContextHelp} from "../guidance";
import type {ShellContext} from "../shell";
import "./tournament.css";

type Player=TournamentView["field"][number];
const name=(v:TournamentView,key:string|null)=>v.field.find(p=>p.key===key)?.name??(key?"Participant unavailable":"To be decided");
const stage=(m:TournamentView["matches"][number],v:TournamentView)=>m.stage_key.startsWith("groups:")?
  `Group ${m.stage_key.split(":")[1]} · Round ${m.round}`:
  m.round===Math.max(...v.matches.filter(x=>!x.stage_key.startsWith("groups:")).map(x=>x.round))?"Final":
  m.round===Math.max(...v.matches.filter(x=>!x.stage_key.startsWith("groups:")).map(x=>x.round))-1?"Semi-final":
  m.round===Math.max(...v.matches.filter(x=>!x.stage_key.startsWith("groups:")).map(x=>x.round))-2?"Quarter-final":`Round ${m.round}`;

export function TournamentResume({saveId}:{saveId:string}) {
  const q=useActiveTournament(saveId);
  if(q.error)return <CareerError error={q.error} onRetry={()=>q.refetch()}/>;
  if(!q.data?.tournaments.length)return null;
  return <section className="pdc-card p-4 space-y-2" aria-label="Resume tournament">
    <Label color="#ffd24a">Tournament in progress</Label>
    {q.data.tournaments.map(t=><Link key={t.eventId} href={`/career/${saveId}/tournaments/${t.eventId}`} className="career-btn career-btn-gold"><Swords size={16} aria-hidden/> {t.terminal?"Review summary":"Resume"} {t.name}</Link>)}
    <p className="text-xs text-white/60">Your draw, results and verified scorer session are saved. Leaving a screen never withdraws you.</p>
  </section>;
}

export function TournamentPage({ctx,eventId,matchId}:{ctx:ShellContext;eventId:string;matchId?:string}) {
  const id=ctx.save.id,q=useTournament(id,eventId),action=useTournamentAction(id,eventId);
  const preferences=useTournamentPresentation(id),advance=useAdvance(id);
  const [,navigate]=useLocation();
  const [ceremony,setCeremony]=useState<"arrival"|"draw"|"walkon"|null>(null),[message,setMessage]=useState<string|null>(null);
  const [tab,setTab]=useState<"progress"|"draw"|"field"|"results">("progress");
  const [groupFilter,setGroupFilter]=useState("all"),[roundFilter,setRoundFilter]=useState("all");
  if(q.isLoading)return <CareerLoading label="Restoring your tournament"/>;
  if(q.error||!q.data)return <CareerError error={q.error??new Error("Tournament unavailable")} onRetry={()=>q.refetch()}/>;
  const v=q.data,terminal=["CHAMPION","COMPLETE","ELIMINATED","WITHDRAWN","CANCELLED"].includes(v.phase);
  const next=v.matches.find(m=>m.id===(matchId??v.nextMatchId));
  const human=v.field.find(p=>p.key==="HUMAN");
  const opponent=next?v.field.find(p=>p.key===(next.a_key==="HUMAN"?next.b_key:next.a_key)):null;
  const currentOpponent=opponent?v.opponents.find(o=>o.key===opponent.key):null;
  const busy=action.isPending||preferences.isPending||advance.isPending;
  const mutate=(which:"group-bull"|"concede"|"withdraw"|"dismiss",body?:unknown,exit=false)=>{
    setMessage(null);action.mutate({action:which,body},{onSuccess:()=>{setCeremony(null);if(exit)navigate(`/career/${id}`);else q.refetch();},
      onError:e=>{setMessage(errorMessage(e));q.refetch();}});
  };
  const begin=()=>{
    if(!next||next.id!==v.nextMatchId||!v.event.executable)return;
    if(v.session?.status==="IN_PLAY"||v.presentation.mode==="QUICK"||!v.depth.walkOn)navigate(`/career/${id}/matches/${next.id}/play`);
    else setCeremony("walkon");
  };
  const continueCalendar=()=>advance.mutate({season:ctx.save.currentSeason,week:ctx.save.currentWeek,target:{kind:"NEXT_MEANINGFUL"}},
    {onSuccess:()=>{setMessage("Calendar progressed to its next real action. No tournament result was invented.");q.refetch();},onError:e=>setMessage(errorMessage(e))});
  const reduced=v.presentation.reducedMotion;
  return <CareerEventIdentity eventKey={v.event.definitionKey} circuit={v.event.circuit} level={v.event.level}><div className={`tournament-mode tournament-level-${v.event.level} ${reduced?"tournament-reduced":""}`} data-mode={v.presentation.mode}>
    <ContextHelp saveId={id} topic="tournament"/>
    <section className="tournament-arrival pdc-card p-5 space-y-3">
      <div className="flex justify-between gap-3 items-center"><Label color="#ffd24a">{v.event.level===5?"The Palace · World Championship":v.event.level===4?"Major championship":v.event.level===3?"Stage tournament":v.event.level===2?"Featured tournament":"Floor tournament"}</Label>
        <StatusBadge label={v.phase.replace(/_/g," ")} tone={v.phase==="CHAMPION"?"gold":"neutral"}/></div>
      <h1 style={{...OSWALD,fontSize:"clamp(1.6rem,5vw,2.8rem)"}}>{v.event.name}</h1>
      <p className="flex items-center gap-2 text-sm"><MapPin size={15} aria-hidden/>{v.event.venue?.displayName??v.event.venueFallback.city} · {v.event.venueFallback.city}, {v.event.venueFallback.country}</p>
      <div className="flex flex-wrap gap-2 text-xs"><span>Season {v.event.season} · days {v.event.startDay}–{v.event.endDay}</span><span> · {v.field.length} real entrants</span>
        <span> · {v.event.format.inRule==="DOUBLE"?"Double-in / double-out":v.event.format.scoringUnit==="SETS"?`Set play · best of ${v.event.format.legsPerSet} legs per set`:"501 · double-out"}</span></div>
      <p className="text-sm text-white/70">{v.event.drawLocked?"Official draw locked. No reshuffle on reload.":v.event.fieldLocked?"Field locked; official draw pending.":"A3 will lock eligible entries and generate the official draw on the scheduled date."}</p>
      <div className="flex flex-wrap gap-2">
        {v.depth.arrival&&<button className="career-btn career-btn-ghost" onClick={()=>setCeremony("arrival")}>Event arrival</button>}
        {v.depth.drawReveal&&v.event.drawLocked&&<button className="career-btn career-btn-ghost" onClick={()=>setCeremony("draw")}>Reveal official draw</button>}
        <Link href={`/career/${id}`} className="career-btn career-btn-ghost">Pause / Career Home</Link>
        <Link href={`/career/${id}/events/${eventId}`} className="career-btn career-btn-ghost">Entry &amp; event details</Link>
      </div>
      <details><summary className="text-xs cursor-pointer">Presentation preferences — no sporting effects</summary>
        <div className="flex flex-wrap items-center gap-3 pt-3">
          <label>Depth <select aria-label="Tournament presentation depth" value={v.presentation.mode} disabled={busy}
            onChange={e=>preferences.mutate({...v.presentation,mode:e.target.value as "FULL"|"BALANCED"|"QUICK"})}>
            <option value="FULL">Full</option><option value="BALANCED">Balanced</option><option value="QUICK">Quick</option></select></label>
          <label><input type="checkbox" checked={reduced} disabled={busy} onChange={e=>preferences.mutate({...v.presentation,reducedMotion:e.target.checked})}/> Reduce motion</label>
        </div>
        <p className="text-xs text-white/60 mt-2">Skip any ceremony. The field, seeding, bot, bull-up, score, prize and qualification remain identical.</p>
        {preferences.error&&<p role="alert">{errorMessage(preferences.error)}</p>}
      </details>
    </section>
    {ceremony&&<section className="pdc-card p-5 tournament-ceremony space-y-3" role="region" aria-label={ceremony==="walkon"?"Walk-on":ceremony==="draw"?"Official draw reveal":"Event arrival"}>
      <Label color="#ffd24a">{ceremony==="arrival"?"Event arrival":ceremony==="draw"?"The official draw":"Walk-on · next stop: real bull-up"}</Label>
      {ceremony==="arrival"?<><h2 style={OSWALD}>{v.event.venue?.displayName??v.event.name}</h2><p>{v.event.level===5?"The Palace. Alexandra Grand Hall, London. The Sovereign Trophy is decided by the real set-play bracket.":v.event.level===4?"A major stage, longer matches and a locked championship field.":v.event.level===3?"A stage event with its own field, fixtures and presentation.":"A focused arrival before the sporting action."}</p></>:
        ceremony==="draw"?<><p>No scripted matchup. These are the stored A3 positions.</p><MatchList v={v} list={v.matches.filter(m=>m.round===1)}/></>:
        <><div className="tournament-player-pair">{human&&<PlayerCard p={human}/>} {opponent&&<PlayerCard p={opponent}/>}</div>
          <p>{next&&stage(next,v)} · {v.event.format.scoringUnit==="SETS"?"Best of sets":"Best of legs"} {next?.best_of}. Presentation awards no first throw.</p></>}
      <div className="flex gap-2 flex-wrap">
        {ceremony==="walkon"&&next&&<Link href={`/career/${id}/matches/${next.id}/play`} className="career-btn career-btn-gold">Bull-up &amp; shared scorer</Link>}
        <button className="career-btn career-btn-ghost" onClick={()=>{setCeremony(null);if(ceremony==="draw")setTab("draw");}}>Skip / return to hub</button>
      </div>
    </section>}
    {message&&<p className="pdc-card p-3" role="status">{message}</p>}
    <nav className="tournament-tabs tkdl-tab-rail" aria-label="Tournament views">{(["progress","draw","field","results"] as const).map(t=>
      <button key={t} type="button" className="tkdl-tab-trigger" onClick={()=>setTab(t)} aria-pressed={tab===t}>{t==="progress"?"Tournament Hub":t==="draw"?"Draw & fixtures":t==="field"?"Field & routes":"Results"}</button>)}</nav>
    {tab==="progress"&&<>
      {terminal?<section className="pdc-card p-5 space-y-3" aria-label="Tournament summary">
        {v.phase==="CHAMPION"?<>{!v.event.qSchool&&<div className="tournament-trophy" aria-hidden>{v.event.level===5?<SovereignTrophy/>:<Trophy size={56}/>}</div>}
          <Label color="#ffd24a">{v.event.qSchool?"Q-School session winner":v.event.level===5?"World Champion · Sovereign Trophy":"Tournament Champion"}</Label>
          <h2 style={OSWALD}>{human?.name} — {v.event.name}</h2><p>{v.event.qSchool?"Actual session finish; a tour card is an A5 decision":`${v.event.trophy?.name??"Tournament trophy"} · actual A3 champion result`}</p></>:
          <><Label>{v.event.level===5&&v.position===2?"World Championship Runner-up":"Tournament summary"}</Label><h2 style={OSWALD}>{v.phase==="ELIMINATED"?"Your tournament is over":v.phase.replace(/_/g," ")}</h2></>}
        {v.position&&<p>Finishing position: {v.position}{v.humanResult?" · recorded A3 result":" · sporting position; event settlement pending"}.</p>}
        {v.latestMatch&&<MatchList v={v} list={[v.latestMatch]}/>}
        {v.humanResult&&<p>{String(v.humanResult.wins)} wins · {String(v.humanResult.losses)} losses · {String(v.humanResult.matches_played)} played matches. Byes and walkovers excluded.</p>}
        {v.championKey&&<p>Champion: {name(v,v.championKey)}</p>}
        <details><summary>Your tournament run · recorded fixtures</summary><MatchList v={v} list={v.matches.filter(m=>[m.a_key,m.b_key].includes("HUMAN"))}/></details>
        <Money v={v}/>
        <div className="flex flex-wrap gap-2"><button className="career-btn career-btn-gold" disabled={busy||v.readOnly} onClick={()=>mutate("dismiss",undefined,true)}>Return to Career</button>
          <Link className="career-btn career-btn-ghost" href={`/career/${id}/history`}>History &amp; trophy cabinet</Link>
          <Link className="career-btn career-btn-ghost" href={`/career/${id}/rankings`}>A5 rankings &amp; qualification</Link></div>
      </section>:<section className="pdc-card p-5 space-y-3" aria-label="Next tournament action">
        <Label color="#ffd24a">Next action</Label>
        {v.phase==="GROUP_BULL"&&v.groupBull?.row?<BullUpBoard names={v.groupBull.pair.map(k=>name(v,k)) as [string,string]}
          state={resolveBullUp(0,v.groupBull.row.throws)} isHuman={idx=>v.groupBull!.pair[idx]==="HUMAN"} busy={busy}
          subtitle={`Group ${v.groupBull.group}: real qualification bull playoff`} error={message}
          onThrow={(_,t)=>mutate("group-bull",{group:v.groupBull!.group,tieKey:v.groupBull!.tieKey,ordinal:v.groupBull!.ordinal,expectedRevision:v.groupBull!.row!.revision,throw:t})}
          onContinue={()=>q.refetch()}/>:
          next&&v.nextMatchId?<><h2 style={OSWALD}>{stage(next,v)} · {name(v,next.a_key)} vs {name(v,next.b_key)}</h2>
            <p>Best of {next.best_of} {v.event.format.scoringUnit==="SETS"?"sets":"legs"} · day {next.scheduled_day}</p>
            <div className="tournament-player-pair">{human&&<PlayerCard p={human}/>} {opponent&&<PlayerCard p={opponent}/>}</div>
            <p className="text-sm">{currentOpponent?`${currentOpponent.meetings} played meetings · You ${currentOpponent.humanWins}–${currentOpponent.npcWins} ${opponent?.name}`:"No recorded played head-to-head. Byes and walkovers do not create a meeting."}</p>
            {currentOpponent&&<p className="text-xs text-white/70">{currentOpponent.labels.join(" · ")} {currentOpponent.latestMeeting?`Last meeting: ${currentOpponent.latestMeeting.name}, season ${currentOpponent.latestMeeting.season}.`:""}</p>}
            <button className="career-btn career-btn-gold" disabled={busy||v.readOnly} onClick={begin}>{v.session?.status==="IN_PLAY"?"Resume verified match":v.session?.status==="BULL_UP"?"Resume bull-up":"Prepare match"}</button>
            <ConfirmButton label="Concede this match" confirmLabel="Confirm match concession" danger busy={busy}
              description="This records a walkover, not played darts. In a group you remain in the event; in a knockout you are eliminated."
              onConfirm={()=>mutate("concede",{matchId:next.id,confirmation:"CONCEDE_MATCH"})}/></>:
            <><p>{v.event.executable?"The next fixture/session is not yet ready. Continue through A3's real calendar; it stops for pending play and meaningful dates.":"This format is unsupported. No winner, score or simulated history will be fabricated."}</p>
              {next&&<p>{stage(next,v)} · scheduled day {next.scheduled_day}</p>}
              <button className="career-btn career-btn-gold" disabled={busy||v.readOnly} onClick={continueCalendar}>Continue to next calendar action</button></>}
        <Money v={v}/>
        {!v.readOnly&&<ConfirmButton label="Withdraw from tournament" confirmLabel="Confirm tournament withdrawal" danger busy={busy}
          description="This ends your participation and resolves remaining fixtures as walkovers. Late withdrawals are not refunded. Closing the browser or pausing does not withdraw you."
          onConfirm={()=>mutate("withdraw",{confirmation:"WITHDRAW_TOURNAMENT"})}/>}
      </section>}
      {v.latestMatch&&!terminal&&<section className="pdc-card p-4 space-y-2"><Label>Latest match · saved result</Label><MatchList v={v} list={[v.latestMatch]}/>
        <p className="text-sm">{v.latestMatch.stage_key.startsWith("groups:")?"A group result does not by itself eliminate you. See actual standings below.":v.latestMatch.winner_key==="HUMAN"?"Through to the next stage; your next fixture follows the stored draw.":"The knockout result ends participation."}</p></section>}
      {v.groups.length>0&&<GroupTables v={v}/>}
      {v.achievements.groupWinner&&!v.achievements.tournamentChampion&&<p className="pdc-card p-3"><Flag size={15} className="inline" aria-hidden/> Group winner — a stage achievement, not a tournament title.</p>}
      {v.event.qSchool&&<p className="pdc-card p-3">Q-School session: direct cards and the Order of Merit are A5 decisions. <Link className="underline" href={`/career/${id}/q-school`}>View Q-School standings and sessions</Link>.</p>}
      {v.history&&<details className="pdc-card p-4" open={v.event.level===5}><summary>Event history · recorded in this save</summary>
        {v.history.palace?.firstAppearance&&<p className="mt-2">World Championship debut · first Palace field appearance.</p>}
        {v.history.palace?.appearanceNumber&&!v.history.palace.firstAppearance&&<p className="mt-2">Palace appearance {v.history.palace.appearanceNumber}.</p>}
        {v.history.palace?.formerWorldChampion&&<p>Former World Champion — actual prior Palace champion result.</p>}
        <p>{v.history.previousAppearances.length} previous confirmed field appearances{v.history.bestFinish?` · previous best finish ${v.history.bestFinish}`:" · no previous finish recorded"}.</p>
        {v.history.recentChampions.length?<ul>{v.history.recentChampions.map(c=><li key={String(c.id)}>Season {String(c.season)} · {String(c.champion_name||"Champion identity unavailable")}</li>)}</ul>:<p>No previous champions recorded in this save.</p>}
        <Link className="underline text-sm" href={`/career/${id}/history`}>Full A7.1 / A7.6 event and match history</Link>
      </details>}
      <details className="pdc-card p-4"><summary>Qualification outputs — awarded only by actual results</summary><pre className="tournament-factual-json">{JSON.stringify(v.event.qualificationOutputs,null,2)}</pre></details>
    </>}
    {tab==="draw"&&<section className="pdc-card p-4 space-y-3"><Label>Official draw &amp; remaining fixtures</Label>
      <div className="flex gap-3 flex-wrap"><label>Stage <select value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}>
        <option value="all">All stages</option>{[...new Set(v.matches.map(m=>m.stage_key))].map(s=><option key={s}>{s}</option>)}</select></label>
        <label>Round <select value={roundFilter} onChange={e=>setRoundFilter(e.target.value)}><option value="all">All rounds</option>
          {[...new Set(v.matches.map(m=>m.round))].sort((a,b)=>a-b).map(r=><option key={r} value={r}>{r}</option>)}</select></label></div>
      <MatchList v={v} list={v.matches.filter(m=>(groupFilter==="all"||m.stage_key===groupFilter)&&(roundFilter==="all"||m.round===Number(roundFilter)))}/>
      {!v.matches.length&&<p>No official draw yet. A3 owns field lock and draw generation.</p>}</section>}
    {tab==="field"&&<section className="pdc-card p-4 space-y-3"><Label>One participant · one berth</Label>
      <div className="tournament-field">{v.field.map(p=><div key={p.key}><PlayerCard p={p}/><p className="text-xs mt-2">Entry route: {p.source.replace(/_/g," ")} · {p.status}{p.seed?` · Seed ${p.seed}`:""}</p>
        {v.routes.filter(r=>r.recipient_key===p.key).map((r,i)=><p key={i} className="text-xs">Confirmed entitlement: {String(r.entitlement_type).replace(/_/g," ")} · {String(r.source_kind)}{r.source_position?` · finish ${r.source_position}`:""}</p>)}</div>)}</div>
      <p className="text-xs text-white/70">Badges are actual results or published rankings. Multiple qualifying routes never create a second berth. No reputation or ability is used for the draw.</p></section>}
    {tab==="results"&&<section className="pdc-card p-4 space-y-3"><Label>Actual tournament results</Label>
      {v.results.length?<ul>{v.results.map(r=><li key={String(r.participant_key)} className="p-2 border-b border-white/10">{Number(r.finishing_position)} · {name(v,String(r.participant_key))} · {String(r.stage_reached).replace(/_/g," ")} · {String(r.wins)}W/{String(r.losses)}L</li>)}</ul>:<p>Final A3 placement and A4 settlement are pending. The completed fixtures below are saved facts, not fabricated final history.</p>}
      <MatchList v={v} list={v.matches.filter(m=>["COMPLETED","WALKOVER","BYE","VOID"].includes(m.status))}/><Money v={v}/></section>}
  </div></CareerEventIdentity>;
}

function PlayerCard({p}:{p:Player}) {
  return <article className="tournament-player" aria-label={`${p.name} opponent identity`}>
    <CareerShirt name={p.name} identity={p.shirt} sponsors={p.sponsors} scale="featured"/><div><h3 style={OSWALD}>{p.name}</h3>{p.nickname&&<p>“{String(p.nickname)}”</p>}
      <p className="text-xs">{p.nationality||"Country not recorded"}{p.ranking?` · World #${p.ranking}`:""} · {p.titles} recorded titles</p>
      <div className="flex gap-1 flex-wrap mt-2">{p.badges.map(b=><StatusBadge key={b.label} label={b.label} tone="gold"/>)}</div></div>
  </article>;
}
function Money({v}:{v:TournamentView}) {
  return <div className="text-sm space-y-1"><p>Prize {v.money.paid?"settled":v.position?"secured at current sporting position":"settlement pending"}: {formatPence(v.money.paid?Number(v.money.prize?.cash_award_pence??0):v.money.securedPence)}
    {!v.money.paid?" · not yet credited; A4 pays once at event completion":""}</p>
    {v.money.prize&&<p>Ranking-eligible money: {formatPence(Number(v.money.prize.ranking_eligible_pence))} · A5 publication follows its existing schedule.</p>}
    {v.money.ledger.length>0&&<details><summary>Recorded A4 event ledger</summary>{v.money.ledger.map((r,i)=><p key={i}>{r.category.replace(/_/g," ")}: {formatPence(r.amountPence)}</p>)}</details>}</div>;
}
function MatchList({v,list}:{v:TournamentView;list:TournamentView["matches"]}) {
  return <ul className="tournament-fixtures">{list.map(m=><li key={m.id} className={[m.a_key,m.b_key].includes("HUMAN")?"tournament-human-fixture":""}>
    <div className="text-xs text-white/60">{stage(m,v)} · day {m.scheduled_day} · best of {m.best_of}</div>
    <div>{name(v,m.a_key)} <strong>{m.legs_a!==null?`${m.legs_a}–${m.legs_b}`:"vs"}</strong> {name(v,m.b_key)}</div>
    <p className="text-xs">{m.status==="BYE"?"Bye — no played match":m.status==="WALKOVER"?"Walkover — no played darts":m.status==="VOID"?"Both paths withdrawn — no winner":m.status==="COMPLETED"?`Winner: ${name(v,m.winner_key)} · ${m.result_source==="HUMAN_LIVE"?"verified shared scorer":"A2 simulation"}`:m.status.replace(/_/g," ")}</p>
    {!!m.summary&&typeof m.summary==="object"&&"sets" in m.summary&&<p className="text-xs">Sets: {String((m.summary as {sets:unknown[]}).sets.join("–"))} · score above is total legs</p>}
  </li>)}</ul>;
}
function GroupTables({v}:{v:TournamentView}) {
  return <section className="pdc-card p-4 space-y-4"><Label>Groups · top two qualify</Label>
    <p className="text-xs text-white/70">Match wins → leg difference → legs won → clean H2H → real bull playoff. Equal unfinished standings have no arbitrary qualification order. P/W/L count played darts; W/O wins count toward sporting wins separately.</p>
    {v.groups.map(g=><div key={g.key}><h3 style={OSWALD}>Group {g.key}{g.pending?" · Awaiting real bull playoff":g.finished?" · Group complete":" · In progress"}</h3>
      <div className="tournament-table-scroll"><table><thead><tr>{["Position","Player","P","W","L","LD","LF","LA","W/O"].map(t=><th key={t}>{t}</th>)}</tr></thead>
        <tbody>{g.buckets.flatMap((bucket,i)=>bucket.map(p=><tr key={p.key} className={p.key==="HUMAN"?"tournament-human-fixture":""}>
          <td>{g.finished&&g.qualifiers.includes(p.key)?g.qualifiers.indexOf(p.key)+1:bucket.length>1?"Tied":g.buckets.slice(0,i).reduce((n,b)=>n+b.length,1)}</td>
          <th scope="row">{name(v,p.key)} {p.withdrawn?"· Withdrawn":g.finished&&g.qualifiers.includes(p.key)?"· Qualified":""}</th>
          {[p.played,p.wins,p.losses,p.legDifference,p.legsFor,p.legsAgainst,p.walkoverWins].map((x,j)=><td key={j}>{x}</td>)}</tr>))}</tbody></table></div>
      <MatchList v={v} list={v.matches.filter(m=>m.stage_key===`groups:${g.key}`)}/>
    </div>)}</section>;
}
function SovereignTrophy() {
  return <CareerTrophy name="The Sovereign Trophy" design="distinctive-tall-silver-not-a-crown"/>;
}
