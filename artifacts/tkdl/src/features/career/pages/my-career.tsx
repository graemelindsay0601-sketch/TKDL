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
export function MyCareerPage({ctx,section="overview"}:{ctx:ShellContext;section?:"overview"|"performance"|"achievements"|"life"|"history"|"remembered"}) {
  const id=ctx.save.id,s=useSporting(id,!ctx.retired),base=`/career/${id}`;
  const links=(items:[string,string][])=> <div className="career-discovery-links">{items.map(([label,path])=><Link className="career-surface" href={`${base}${path}`} key={path}>{label}</Link>)}</div>;
  return <div className="space-y-3"><h2>My Career · {section==="life"?"Career Life":section==="remembered"?"A Career Remembered":section[0].toUpperCase()+section.slice(1)}</h2>
    {section==="overview"&&<><PlayerLegacyProfile ctx={ctx}/><GoalsSummary saveId={id}/><RecognitionSummary saveId={id}/>
      {links([["Ranking trajectory & sporting journey","/journey"],["Current finances & partners","/finances"],["Profile & shirt identity","/presentation"]])}</>}
    {section==="performance"&&<>{links([["Results & A7.1 statistics","/history/facts"],["Ranking history & races","/journey"],["Played opponents & H2H","/relationships"]])}<HistoryPage ctx={ctx}/></>}
    {section==="achievements"&&<><TrophyCabinet ctx={ctx}/>{links([["Finals, milestones & recorded honours","/history/facts"],["Season awards & supported records","/history"]])}</>}
    {section==="life"&&<>{links([["Sporting rivals & relationships","/relationships"],["Finances & sponsor contracts","/finances"],["Public profile & commercial decisions","/life"],["Reputation & recognition","/recognition"],["Career stories","/stories"],["Current focus & goals","/goals"],["Profile & shirt customisation","/presentation"]])}<LifeSummary saveId={id}/></>}
    {section==="history"&&<><CareerTimeline ctx={ctx}/><LegacyPage ctx={ctx}/></>}
    {section==="remembered"&&<CareerRemembered ctx={ctx}/>}
    {s.error&&<CareerError error={s.error} onRetry={()=>s.refetch()}/>}
  </div>;
}
