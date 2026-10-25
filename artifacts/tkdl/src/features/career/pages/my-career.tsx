import {useState} from "react";
import {Link} from "wouter";
import {useSporting} from "../api";
import {CareerError} from "../components";
import {HistoryPage} from "./history";
import {LegacyPage} from "./legacy";
import {GoalsSummary} from "./goals";
import {RecognitionSummary} from "./recognition";
import {LifeSummary} from "./life";
import type {ShellContext} from "../shell";
import {CareerRemembered,CareerTimeline,PlayerLegacyProfile,TrophyCabinet} from "../legacy/components";
import {PLATES} from "../atmosphere";
import {CareerPageHero} from "../page-hero";
import {CareerShirt} from "../identity";
import {usePresentation, useUpdateCareerDifficulty, errorMessage} from "../api";
import {CareerPerformanceTrend} from "./career-trends";

/** Discovery links render as venue-plate tiles (decorative art; same destinations as before). */
const TILE_PLATES=["professional-floor","studio","conference","small-arena","historic-theatre","exhibition","hotel-ballroom"] as const;
export function MyCareerPage({ctx,section="overview"}:{ctx:ShellContext;section?:"overview"|"performance"|"achievements"|"life"|"history"|"remembered"}) {
  const id=ctx.save.id,s=useSporting(id,!ctx.retired),base=`/career/${id}`;
  const presentation=usePresentation(id);
  const links=(items:[string,string][])=> <nav className="career-world-tiles career-discovery-tiles" aria-label="Related Career screens">{items.map(([label,path],i)=>{
    const plate=PLATES[TILE_PLATES[i%TILE_PLATES.length]]??PLATES.neutral;
    return <Link className="career-world-tile" href={`${base}${path}`} key={path}><img src={plate.src} alt="" aria-hidden="true" loading="lazy"/><span><strong>{label}</strong></span></Link>;})}</nav>;
  const shirt=presentation.data?<CareerShirt identity={presentation.data.identity} sponsors={presentation.data.placements} name={ctx.save.careerName??"Player"} scale="featured"/>:undefined;
  return <div className="space-y-3"><h2 className="sr-only">My Career · {section==="life"?"Career Life":section==="remembered"?"A Career Remembered":section[0].toUpperCase()+section.slice(1)}</h2>
      {section==="overview"&&<><PlayerLegacyProfile ctx={ctx}/><DifficultySettings saveId={id} difficulty={ctx.save.difficulty} retired={ctx.retired}/><div className="pl-overview-briefings"><div className="pl-overview-briefing pl-overview-briefing--focus"><GoalsSummary saveId={id}/></div><div className="pl-overview-briefing pl-overview-briefing--standing"><RecognitionSummary saveId={id}/></div></div>
</>}
     {section==="performance"&&<><CareerPerformanceTrend saveId={id} season={ctx.save.currentSeason} week={ctx.save.currentWeek} retired={ctx.retired}/>{links([["Results & statistics","/history/facts"],["Ranking history & races","/journey"],["Played opponents & H2H","/relationships"]])}<HistoryPage ctx={ctx} initialTab="TIMELINE"/></>}
    {section==="achievements"&&<><TrophyCabinet ctx={ctx}/>{links([["Finals and milestones","/history/facts"],["Season awards and records","/history"]])}</>}
    {section==="life"&&<><CareerPageHero kicker="My Career" title="Career Life" accent="#c99bff" stage={{venue:{venueType:"studio"},eventClass:"PROFESSIONAL_TOUR"}}
      subtitle={<p>Your rivals, partners, public profile, stories and goals: the life around the oche.</p>} portrait={shirt}/>{links([["Nights out: club, streaming & leagues","/nights"],["Sporting rivals & relationships","/relationships"],["Finances & sponsor contracts","/finances"],["Public profile & commercial decisions","/life"],["Reputation & recognition","/recognition"],["Career stories","/stories"],["Current focus & goals","/goals"],["Profile & shirt customisation","/presentation"]])}<LifeSummary saveId={id}/></>}
    {section==="history"&&<><CareerTimeline ctx={ctx}/><LegacyPage ctx={ctx}/></>}
    {section==="remembered"&&<CareerRemembered ctx={ctx}/>}
    {s.error&&<CareerError error={s.error} onRetry={()=>s.refetch()}/>}
  </div>;
}

export function DifficultySettings({saveId,difficulty,retired}:{saveId:string;difficulty:string;retired:boolean}) {
  const update=useUpdateCareerDifficulty(saveId),[message,setMessage]=useState("");
  return <section className="pdc-card p-4 space-y-3" aria-labelledby="career-opposition-heading">
    <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-amber-200">Career settings</p>
      <h3 id="career-opposition-heading" className="mt-1 text-lg font-bold text-white">Opposition difficulty</h3>
      <p className="mt-1 max-w-3xl text-sm text-white/65">Change how tough Career opponents are at any time. This applies to future matches only; past results, event eligibility, rankings and sporting rules are unchanged.</p></div>
    <label className="flex max-w-sm flex-col gap-1 text-sm text-white/75">
      <span className="sr-only">Opposition difficulty</span>
      <select aria-label="Opposition difficulty" value={difficulty} disabled={retired||update.isPending}
        onChange={event=>{setMessage("");update.mutate(event.target.value as "ACCESSIBLE"|"STANDARD"|"CHALLENGING",{onSuccess:()=>setMessage("Difficulty updated for future matches."),onError:error=>setMessage(errorMessage(error))});}}
        className="rounded-lg px-3 py-2.5 bg-black/40 border border-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff005c]">
        <option value="ACCESSIBLE">Accessible</option><option value="STANDARD">Standard</option><option value="CHALLENGING">Challenging</option>
      </select>
    </label>
    {retired&&<p className="text-xs text-white/45">Retired Careers are read-only.</p>}
    {update.isPending&&<p role="status" className="text-xs text-white/55">Updating future opposition…</p>}
    {message&&<p role={message.includes("updated")?"status":"alert"} className="text-xs text-white/65">{message}</p>}
  </section>;
}
