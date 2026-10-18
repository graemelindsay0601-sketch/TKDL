import {useState,useEffect} from "react";
import {Link,useSearch} from "wouter";
import {useWorldContent,useWorldLocalities,useWorldMap,useWorldPlayers,useRankingTable,useLegacy,useEventLegacy,useCareerLife} from "../api";
import {CareerLoading,CareerError,CareerSection} from "../components";
import {CalendarDays,ChevronRight,Crown,Newspaper,Search,Trophy} from "lucide-react";
import {CareerPageHero} from "../page-hero";
import {PLATES,resolveAtmosphere} from "../atmosphere";
import {CareerEventIdentity,CareerPlayerCard,CareerShirt} from "../identity";
import {AwardPresentation,awardLabel,resolveAward,trophyArt} from "../trophies";
import {mapState} from "../presentation";
import {circuitLabel,eventCircuitLabel,familyName,titleCase} from "../model";
import {NpcLegacyPage,LegacyPage} from "./legacy";
import type {ShellContext} from "../shell";
import {CareerVenueAtlas} from "./venue-atlas";

export function WorldHub({ctx,section="landing",detail}:{ctx:ShellContext;section?:"landing"|"events"|"venues"|"history"|"search";detail?:string}) {
  const querySearch=new URLSearchParams(useSearch()).get("q")??"";
  const world=useWorldContent(ctx.save.id),localities=useWorldLocalities(ctx.save.id,section==="venues"),map=useWorldMap(ctx.save.id,["landing","events","venues"].includes(section)),[search,setSearch]=useState(querySearch),[page,setPage]=useState(0);
  useEffect(()=>{setSearch(querySearch);setPage(0);},[querySearch]);
  const rankings=useRankingTable(ctx.save.id,"pro-world",{view:"TOP",limit:5},section==="landing"),legacy=useLegacy(ctx.save.id,section==="landing"||section==="events"&&!!detail),life=useCareerLife(ctx.save.id);
  const history=useEventLegacy(ctx.save.id,section==="events"&&detail?detail:null);
  if(world.isLoading)return <CareerLoading label="Opening Darts World"/>;
  if(world.error||!world.data)return <CareerError error={world.error} onRetry={()=>world.refetch()}/>;
  const d=world.data,base=`/career/${ctx.save.id}`,match=(s:string)=>s.toLowerCase().includes(search.toLowerCase());
  const families=d.eventFamilies.filter(f=>match(`${familyName(f.name)} ${f.circuit} ${circuitLabel(f.circuit)}`)),venues=d.venues.filter(v=>match(`${v.displayName} ${v.city} ${v.countryId}`));
  const selected=d.eventFamilies.find(f=>f.id===detail);
  const winnerName=(id:string)=>id==="HUMAN"?ctx.save.careerName??"You":legacy.data?.players.find(p=>p.id===id)?.name??"Recorded champion";
  const latestWorld=legacy.data?.world.at(-1)?.champions.find(c=>c.tier==="WORLD");
  if(section==="venues") {
    if(localities.isLoading)return <CareerLoading label="Opening venue atlas"/>;
    if(localities.error||!localities.data)return <CareerError error={localities.error} onRetry={()=>localities.refetch()}/>;
    return <CareerVenueAtlas ctx={ctx} data={{venues:d.venues,countries:d.countries}} localities={localities.data}
      events={map.data?.events??[]} detailId={detail} eventsLoading={map.isLoading} eventsError={map.error} onRetry={()=>map.refetch()}/>;
  }
  const searchBox=<label className="career-world-search"><Search size={16} aria-hidden="true"/><span className="sr-only">Search</span><input type="search" maxLength={80} value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Names, cities, circuits"/></label>;
  const seasonEditions=map.data?.events??[];
  return <div className="space-y-3">{section==="history"&&<h2 className="sr-only">World History</h2>}
    {section==="search"&&<CareerPageHero kicker="Darts World" title="Search the darts world" stage={{venue:{venueType:"conference"},eventClass:"PROFESSIONAL_TOUR"}} accent="#7ebbd3"
      subtitle={<p>Players, championships and venues across your saved Career world.</p>}>{searchBox}</CareerPageHero>}
    {section==="events"&&!selected&&<CareerPageHero kicker="Darts World" title="Events & Circuits" stage={{venue:{venueType:"small-arena"},eventClass:"MAJOR"}} accent="#e4bb67"
      watermark={`${d.eventFamilies.length}`}
      subtitle={<p>Every championship family in your Career world, from local club nights to the Palace. Each family runs as local editions across the season.</p>}
      stats={[{label:"Championship families",value:d.eventFamilies.length,tone:"gold"},{label:"Organisations",value:d.organisations.length},
        {label:"Circuits",value:d.circuits.length},{label:"Editions this season",value:map.isLoading?"…":seasonEditions.length}]}>{searchBox}</CareerPageHero>}
    {section==="landing"&&(()=>{
      const champs=map.data?.events.filter(e=>["MAJOR","WORLD_CHAMPIONSHIP"].includes(e.content.eventClass)&&!["COMPLETED","CANCELLED"].includes(e.status)).slice(0,4)??[];
      const leader=rankings.isLoading?"…":rankings.error?"Unavailable":rankings.data?.rows[0]?.name??"Not yet published";
      const champion=legacy.isLoading?"…":legacy.error?"Unavailable":latestWorld?winnerName(latestWorld.participant):"Not yet recorded";
      return <>
        <CareerPageHero kicker={`The darts world · season ${ctx.save.currentSeason}, week ${ctx.save.currentWeek}`} title="Darts World" accent="#38bdf8"
          stage={{ venue: { venueType: "major-arena" }, eventClass: "MAJOR" }}
          subtitle="Rankings, the big championships, players and news from your darts world."
          stats={[
            { label: "Published World #1", value: leader, tone: "gold" },
            { label: "Last World Champion", value: champion },
            { label: "Championships ahead", value: champs.length },
            { label: "World news", value: life.data?.news.length ?? "…" },
          ]}
          actions={<><Link className="career-btn career-btn-primary" href={`${base}/rankings`}>Rankings & races</Link>
            <Link className="career-btn career-btn-ghost" href={`${base}/world/events/world-darts-championship`}>The Palace World Championship</Link></>} />
        <CareerSection title="Upcoming Championships" icon={<Trophy aria-hidden />} accent="#ffd24a" action={<Link href={`${base}/world/events`}>All events</Link>}>
          {map.isLoading?<CareerLoading label="Reading the championship calendar"/>:!champs.length?<p className="p-4 text-sm text-white/70">No major or World Championship edition is scheduled ahead this season.</p>:
          <div className="career-world-champs">{champs.map(e=>{
            const plate=PLATES[resolveAtmosphere({ eventClass: e.content.eventClass, venue: e.venue }).plate]??PLATES.neutral;
            return <Link key={e.id} href={`${base}/events/${e.id}`} className="career-world-champ">
              <img src={plate.src} alt="" aria-hidden="true" loading="lazy" style={{ objectPosition: `${plate.focal.x*100}% ${plate.focal.y*100}%` }}/>
              <span className="career-world-champ__body"><small>{e.content.eventClass==="WORLD_CHAMPIONSHIP"?"World Championship":"Major"} · Week {e.dates.startWeek}</small>
                <strong>{e.name}</strong><em>{e.venue.displayName}{e.venue.city?`, ${e.venue.city}`:""} · {mapState(e)}</em></span>
            </Link>;})}</div>}
        </CareerSection>
        <CareerSection title="Around the world" icon={<Newspaper aria-hidden />} accent="#7ebbd3" action={<Link href={`${base}/world/news`}>Newsroom</Link>}>
          {life.data?.news.length?<ul className="career-headlines">{life.data.news.slice(0,4).map(n=><li key={n.id}><Link href={`${base}/stories`}>{n.title}</Link></li>)}</ul>
            :<p className="p-4 text-sm text-white/70">No world news has been recorded yet.</p>}
        </CareerSection>
        <nav className="career-world-tiles" aria-label="Explore the darts world">{([["Newsroom","/world/news","Stories from your Career","conference"],["Players","/world/players","Every saved player","professional-floor"],["Rivalries & H2H","/relationships","Your played meetings","studio"],["Events & Circuits","/world/events","Every championship","small-arena"],["Venues","/world/venues","The venue atlas","historic-theatre"],["History","/world/history","Champions & records","exhibition"],["Records Book","/world/records","Nine-darters & best performances","historic-theatre"]] as const).map(([label,path,sub,venue])=>{
          const plate=PLATES[venue]??PLATES.neutral;
          return <Link key={path} href={`${base}${path}`} className="career-world-tile"><img src={plate.src} alt="" aria-hidden="true" loading="lazy"/><span><strong>{label}</strong><small>{sub}</small></span></Link>;})}</nav>
      </>;})()}
    {section==="search"&&<><WorldPlayerDirectory ctx={ctx} search={search}/><CareerSection title="Events / Championships">{families.slice(0,10).map(f=><Link className="career-directory-row" key={f.id} href={`${base}/world/events/${f.id}`}>{familyName(f.name)}</Link>)}</CareerSection><CareerSection title="Venues">{venues.slice(0,10).map(v=><Link className="career-directory-row" key={v.id} href={`${base}/world/venues/${v.id}`}>{v.displayName}, {v.city}</Link>)}</CareerSection><p>Event and venue search shows up to ten matches; their directories provide full filtered pagination.</p></>}
    {section==="events"&&(selected?(()=>{
      const editions=seasonEditions.filter(e=>e.definitionId===selected.id);
      const done=editions.filter(e=>e.status==="COMPLETED").length;
      const org=d.organisations.find(o=>o.id===selected.organisationId);
      const award=resolveAward({definitionKey:selected.id,circuit:selected.circuit},{persistedTrophyId:selected.trophyId??null});
      const champions=history.data?.champions.slice(-5).reverse()??[];
      return <CareerEventIdentity eventKey={selected.id} circuit={selected.circuit} level={selected.eventClass} className="career-world-detail space-y-3">
        <CareerPageHero kicker={selected.circuitName??org?.name??circuitLabel(selected.circuit)} title={familyName(selected.name)} accent="#e4bb67"
          stage={{definitionKey:selected.id,circuit:selected.circuit,eventClass:selected.eventClass}}
          subtitle={<><p>{[...new Set([titleCase(selected.eventClass),eventCircuitLabel(selected),titleCase(selected.formatKind)])].join(" · ")}</p><p>{selected.summary??selected.fieldDescription}</p></>}
          portrait={<div className="career-world-award"><AwardPresentation event={{definitionKey:selected.id,circuit:selected.circuit}} persistedTrophyId={selected.trophyId??null} size="md" eventName={familyName(selected.name)}/></div>}
          stats={[{label:"Winner receives",value:award.designId?trophyArt(award.designId)?.name??awardLabel(award):awardLabel(award),tone:"gold"},
            {label:"Editions this season",value:map.isLoading?"…":editions.length,sub:`${done} completed`},
            {label:"Format",value:selected.supported?"Playable":"Informational",sub:selected.supported?"Executable sporting format":"This sporting format is not currently executable"},
            {label:"Latest champion",value:champions[0]?winnerName(champions[0].participant):"—",sub:champions[0]?`Season ${champions[0].season}`:"None recorded yet"}]}/>
        <div className="career-world-detail__grid">
          <CareerSection title="This season’s editions & routes" icon={<CalendarDays size={15}/>} accent="#69b8ec">
            {editions.length===0?<p className="p-4 text-sm text-white/65">No editions of this championship are scheduled in the current season.</p>:
            <ul className="career-edition-list">{editions.slice(0,20).map(e=><li key={e.id}><Link href={`${base}/events/${e.id}`}>
              <span className="career-edition-list__week"><small>Week</small><strong>{String(e.dates.startWeek).padStart(2,"0")}</strong></span>
              <span className="career-edition-list__copy"><strong>{e.venue.displayName}</strong><small>{e.venue.city} · inspect eligibility & qualification</small></span>
              <span className="career-edition-list__state">{mapState(e)}</span><ChevronRight size={15} aria-hidden="true"/></Link></li>)}</ul>}
          </CareerSection>
          <CareerSection title="Recent champions" icon={<Crown size={15}/>} accent="#e4bb67" action={<Link href={`${base}/my-career/history`}>All editions</Link>}>
            {champions.length?<ol className="career-champion-list">{champions.map(c=><li key={c.id}><span>S{c.season}</span><strong>{winnerName(c.participant)}</strong></li>)}</ol>
              :<p className="p-4 text-sm text-white/65">No previous Career champion recorded. No pre-save history is invented.</p>}
          </CareerSection>
        </div>
      </CareerEventIdentity>;})():<>
      <div className="career-org-grid">{d.organisations.map(o=><article key={o.id} className="career-org-card">
        <header><span aria-hidden="true">{o.shortName}</span><div><h3>{o.name}</h3><p>{o.role}</p></div></header>
        <div className="career-org-card__circuits">{d.circuits.filter(c=>c.organisationId===o.id).map(c=><button type="button" key={c.id} onClick={()=>{setSearch(c.authorityCircuit);setPage(0);}}>{c.name}</button>)}</div>
      </article>)}</div>
      <div className="career-family-grid">{families.slice(page*20,(page+1)*20).map(f=>{const plate=PLATES[resolveAtmosphere({definitionKey:f.id,circuit:f.circuit,eventClass:f.eventClass}).plate]??PLATES.neutral;
        return <CareerEventIdentity key={f.id} eventKey={f.id} circuit={f.circuit}><Link className="career-family-card" href={`${base}/world/events/${f.id}`}>
          <img src={plate.src} alt="" aria-hidden="true" loading="lazy" decoding="async" style={{objectPosition:`${plate.focal.x*100}% ${plate.focal.y*100}%`}}/>
          <span><small>{eventCircuitLabel(f)}</small><strong>{familyName(f.name)}</strong><em>{titleCase(f.eventClass)}</em></span></Link></CareerEventIdentity>;})}</div>
      {families.length===0&&<p className="career-surface p-4 text-sm text-white/65">No championships match “{search}”.</p>}
      <Pagination page={page} total={families.length} setPage={setPage}/>
    </>)}
    {section==="history"&&<LegacyPage ctx={ctx} initialTab="World History"/>}
  </div>;
}
function Pagination({page,total,setPage}:{page:number;total:number;setPage:(p:number)=>void}) {
  return <div className="career-pagination"><button className="career-btn" disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page+1} · {total} results</span><button className="career-btn" disabled={(page+1)*20>=total} onClick={()=>setPage(page+1)}>Next</button></div>;
}
export function WorldPlayerDirectory({ctx,search:external,id}:{ctx:ShellContext;search?:string;id?:string}) {
  const [search,setSearch]=useState(""),[status,setStatus]=useState("ALL"),[offset,setOffset]=useState(0),q=useWorldPlayers(ctx.save.id,offset,external??search,status,id);
  return <div className="space-y-3">{!id&&external===undefined&&<div className="career-surface career-player-filters"><label>Search players <input type="search" maxLength={80} value={search} onChange={e=>{setSearch(e.target.value);setOffset(0);}}/></label><label>Career status <select value={status} onChange={e=>{setStatus(e.target.value);setOffset(0);}}>{["ALL","ACTIVE","RETIRED"].map(s=><option key={s} value={s}>{titleCase(s)}</option>)}</select></label></div>}
    {q.isLoading?<CareerLoading label="Searching public player facts"/>:q.error?<CareerError error={q.error} onRetry={()=>q.refetch()}/>:q.data&&<CareerSection title={id?"Player profile":"Players"}>
      {id?q.data.players.map(p=><div className="career-directory-row" key={p.id}><Link href={`/career/${ctx.save.id}/world/players/${p.id}`}><CareerPlayerCard playerId={p.id} name={p.name} nickname={p.nickname} nationality={String(p.country)} identity={p.shirt} rank={p.ranking} sponsors={p.commercial.portfolio} badges={[String(p.status)]} scale="profile"/></Link><Link className="career-link ml-3" href={`/career/${ctx.save.id}/world/players/${p.id}/profile`}>Full player profile</Link></div>)
        :<div className="career-player-grid">{q.data.players.map(p=><Link key={p.id} className={`career-player-tile${p.status==="RETIRED"?" is-retired":""}`} href={`/career/${ctx.save.id}/world/players/${p.id}/profile`} aria-label={`${p.name} player profile`}>
          <span className="career-player-tile__shirt"><CareerShirt playerId={p.id} name={p.name} identity={p.shirt} sponsors={p.commercial.portfolio} scale="standard"/></span>
          <span className="career-player-tile__rank">{p.ranking?<><small>World</small>#{p.ranking}</>:<small>Unranked</small>}</span>
          <span className="career-player-tile__body"><strong>{p.name}</strong>{typeof p.nickname==="string"&&p.nickname&&<em>“{p.nickname}”</em>}
            <span className="career-player-tile__meta"><span>{String(p.country)}</span><span className={`career-player-tile__status is-${String(p.status).toLowerCase()}`}>{titleCase(String(p.status))}</span></span></span>
        </Link>)}</div>}
      {!q.data.players.length&&<p className="p-4">No matching players. Retired careers remain discoverable with the All / Retired filter.</p>}
      {!id&&<div className="career-pagination"><button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><span>{q.data.total} players</span><button disabled={q.data.nextOffset===null} onClick={()=>setOffset(q.data!.nextOffset!)}>Next</button></div>}
    </CareerSection>}
    {id&&<><NpcLegacyPage ctx={ctx} npcId={id}/><Link href={`/career/${ctx.save.id}/relationships`}>Your played H2H & relationships</Link></>}
  </div>;
}
