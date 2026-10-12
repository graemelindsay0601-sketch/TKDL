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
import {usePresentation} from "../api";

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
    {section==="overview"&&<><PlayerLegacyProfile ctx={ctx}/><GoalsSummary saveId={id}/><RecognitionSummary saveId={id}/>
      {links([["Ranking trajectory & sporting journey","/journey"],["Current finances & partners","/finances"],["Profile & shirt identity","/presentation"]])}</>}
    {section==="performance"&&<><CareerPageHero kicker="My Career" title="Performance" accent="#69b8ec" stage={{venue:{venueType:"professional-floor"},eventClass:"PROFESSIONAL_TOUR"}}
      subtitle={<p>Every completed match, event and ranking in your Career, from the scorer and the results record.</p>} portrait={shirt}/>{links([["Results & statistics","/history/facts"],["Ranking history & races","/journey"],["Played opponents & H2H","/relationships"]])}<HistoryPage ctx={ctx}/></>}
    {section==="achievements"&&<><TrophyCabinet ctx={ctx}/>{links([["Finals, milestones & recorded honours","/history/facts"],["Season awards & supported records","/history"]])}</>}
    {section==="life"&&<><CareerPageHero kicker="My Career" title="Career Life" accent="#c99bff" stage={{venue:{venueType:"studio"},eventClass:"PROFESSIONAL_TOUR"}}
      subtitle={<p>Your rivals, partners, public profile, stories and goals: the life around the oche.</p>} portrait={shirt}/>{links([["Sporting rivals & relationships","/relationships"],["Finances & sponsor contracts","/finances"],["Public profile & commercial decisions","/life"],["Reputation & recognition","/recognition"],["Career stories","/stories"],["Current focus & goals","/goals"],["Profile & shirt customisation","/presentation"]])}<LifeSummary saveId={id}/></>}
    {section==="history"&&<><CareerTimeline ctx={ctx}/><LegacyPage ctx={ctx}/></>}
    {section==="remembered"&&<CareerRemembered ctx={ctx}/>}
    {s.error&&<CareerError error={s.error} onRetry={()=>s.refetch()}/>}
  </div>;
}
