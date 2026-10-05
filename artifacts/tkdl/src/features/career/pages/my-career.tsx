import {Link} from "wouter";
import {useSporting,useFinance,useCareerProfile,usePresentation} from "../api";
import {CareerPlayerCard} from "../identity";
import {CareerSection,CareerError} from "../components";
import {formatPence,ordinal} from "../model";
import {HistoryPage} from "./history";
import {TrophyPage} from "./world";
import {LegacyPage} from "./legacy";
import {GoalsSummary} from "./goals";
import {RecognitionSummary} from "./recognition";
import {LifeSummary} from "./life";
import type {ShellContext} from "../shell";
export function MyCareerPage({ctx,section="overview"}:{ctx:ShellContext;section?:"overview"|"performance"|"achievements"|"life"|"history"}) {
  const id=ctx.save.id,s=useSporting(id),f=useFinance(id),profile=useCareerProfile(id),p=usePresentation(id),base=`/career/${id}`;
  const links=(items:[string,string][])=> <div className="career-discovery-links">{items.map(([label,path])=><Link className="career-surface" href={`${base}${path}`} key={path}>{label}</Link>)}</div>;
  return <div className="space-y-3"><h2>My Career · {section==="life"?"Career Life":section[0].toUpperCase()+section.slice(1)}</h2>
    {section==="overview"&&<><CareerSection title={ctx.retired?"Your Retired Record":"Your Career"}>
      <CareerPlayerCard name={profile.data?.displayName??ctx.save.careerName??"My Career"} nickname={p.data?.identity.nickname} identity={p.data?.identity} sponsors={p.data?.placements} scale="profile"/>
      <p className="p-4">{profile.data?.status==="COMPLETE"?`Age ${profile.data.age} · `:""}Career: Season {ctx.save.currentSeason} · {ctx.retired?"Retired":s.data?.tourCard.holdsCard?"Tour Card professional":"Open / amateur career"}</p><p className="p-4">World rank {s.data?.worldRanking.standing?.position?ordinal(s.data.worldRanking.standing.position):"unranked"} · Balance {formatPence(f.data?.balancePence??ctx.save.balancePence)}</p>
    </CareerSection><GoalsSummary saveId={id}/><RecognitionSummary saveId={id}/>
      {links([["Ranking trajectory & sporting journey","/journey"],["Current finances & partners","/finances"],["Profile & shirt identity","/presentation"]])}</>}
    {section==="performance"&&<>{links([["Results & A7.1 statistics","/history/facts"],["Ranking history & races","/journey"],["Played opponents & H2H","/relationships"]])}<HistoryPage ctx={ctx}/></>}
    {section==="achievements"&&<><TrophyPage ctx={ctx}/>{links([["Finals, milestones & recorded honours","/history/facts"],["Season awards & supported records","/history"]])}</>}
    {section==="life"&&<>{links([["Sporting rivals & relationships","/relationships"],["Finances & sponsor contracts","/finances"],["Public profile & commercial decisions","/life"],["Reputation & recognition","/recognition"],["Career stories","/stories"],["Current focus & goals","/goals"],["Profile & shirt customisation","/presentation"]])}<LifeSummary saveId={id}/></>}
    {section==="history"&&<LegacyPage ctx={ctx}/>}
    {s.error&&<CareerError error={s.error} onRetry={()=>s.refetch()}/>}
  </div>;
}
