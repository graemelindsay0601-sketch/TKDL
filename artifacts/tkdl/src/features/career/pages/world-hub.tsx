import {useState,useEffect} from "react";
import {Link,useSearch} from "wouter";
import {useWorldContent,useWorldLocalities,useWorldMap,useWorldPlayers,useRankingTable,useLegacy,useEventLegacy,useCareerLife} from "../api";
import {CareerLoading,CareerError,CareerSection} from "../components";
import {Newspaper,Trophy} from "lucide-react";
import {CareerPageHero} from "../page-hero";
import {PLATES,resolveAtmosphere} from "../atmosphere";
import {CareerEventIdentity,CareerPlayerCard,CareerShirt} from "../identity";
import {AwardPresentation,awardLabel,resolveAward,trophyArt} from "../trophies";
import {mapState} from "../presentation";
import {titleCase} from "../model";
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
  const families=d.eventFamilies.filter(f=>match(`${f.name} ${f.circuit}`)),venues=d.venues.filter(v=>match(`${v.displayName} ${v.city} ${v.countryId}`));
  const selected=d.eventFamilies.find(f=>f.id===detail);
  const winnerName=(id:string)=>id==="HUMAN"?ctx.save.careerName??"You":legacy.data?.players.find(p=>p.id===id)?.name??"Recorded champion";
  const latestWorld=legacy.data?.world.at(-1)?.champions.find(c=>c.tier==="WORLD");
  if(section==="venues") {
    if(localities.isLoading)return <CareerLoading label="Opening venue atlas"/>;
    if(localities.error||!localities.data)return <CareerError error={localities.error} onRetry={()=>localities.refetch()}/>;
    return <CareerVenueAtlas ctx={ctx} data={{venues:d.venues,countries:d.countries}} localities={localities.data}
      events={map.data?.events??[]} detailId={detail} eventsLoading={map.isLoading} eventsError={map.error} onRetry={()=>map.refetch()}/>;
  }
  return <div className="space-y-3">{section!=="landing"&&<h2>{section==="search"?"Search the darts world":section==="events"?"Events & Circuits":"World History"}</h2>}
    {["search","events"].includes(section)&&<label className="career-surface career-search">Search <input type="search" maxLength={80} value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Names, cities, circuits"/></label>}
    {section==="landing"&&(()=>{
      const champs=map.data?.events.filter(e=>["MAJOR","WORLD_CHAMPIONSHIP"].includes(e.content.eventClass)&&!["COMPLETED","CANCELLED"].includes(e.status)).slice(0,4)??[];
      const leader=rankings.isLoading?"…":rankings.error?"Unavailable":rankings.data?.rows[0]?.name??"Not yet published";
      const champion=legacy.isLoading?"…":legacy.error?"Unavailable":latestWorld?winnerName(latestWorld.participant):"Not yet recorded";
      return <>
        <CareerPageHero kicker={`The darts world · season ${ctx.save.currentSeason}, week ${ctx.save.currentWeek}`} title="Darts World" accent="#38bdf8"
          stage={{ venue: { venueType: "major-arena" }, eventClass: "MAJOR" }}
          subtitle="Standings, championships, players and stories from your saved world. Every name and result here was recorded in your Career."
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
        <nav className="career-world-tiles" aria-label="Explore the darts world">{([["Newsroom","/world/news","Stories from your Career","conference"],["Players","/world/players","Every saved player","professional-floor"],["Rivalries & H2H","/relationships","Your played meetings","studio"],["Events & Circuits","/world/events","Every championship","small-arena"],["Venues","/world/venues","The venue atlas","historic-theatre"],["History","/world/history","Champions & records","exhibition"]] as const).map(([label,path,sub,venue])=>{
          const plate=PLATES[venue]??PLATES.neutral;
          return <Link key={path} href={`${base}${path}`} className="career-world-tile"><img src={plate.src} alt="" aria-hidden="true" loading="lazy"/><span><strong>{label}</strong><small>{sub}</small></span></Link>;})}</nav>
      </>;})()}
    {section==="search"&&<><WorldPlayerDirectory ctx={ctx} search={search}/><CareerSection title="Events / Championships">{families.slice(0,10).map(f=><Link className="career-directory-row" key={f.id} href={`${base}/world/events/${f.id}`}>{f.name}</Link>)}</CareerSection><CareerSection title="Venues">{venues.slice(0,10).map(v=><Link className="career-directory-row" key={v.id} href={`${base}/world/venues/${v.id}`}>{v.displayName}, {v.city}</Link>)}</CareerSection><p>Event and venue search shows up to ten matches; their directories provide full filtered pagination.</p></>}
    {section==="events"&&(selected?<CareerEventIdentity eventKey={selected.id} circuit={selected.circuit} level={selected.eventClass} className="career-surface career-world-detail">
      <h3>{selected.name}</h3><p>{d.organisations.find(o=>o.id===selected.organisationId)?.name} · {titleCase(selected.eventClass)} · {titleCase(selected.formatKind)}</p>
      <p>{selected.fieldDescription}</p><p>{selected.supported?"Executable sporting format":"This sporting format is not currently executable"}</p>
      {/* G1/E2: what this event's winner receives, by its actual key (result-only events say so). */}<div className="career-world-award"><AwardPresentation event={{definitionKey:selected.id,circuit:selected.circuit}} persistedTrophyId={selected.trophyId??null} size="md" eventName={selected.name}/>
        {(()=>{const a=resolveAward({definitionKey:selected.id,circuit:selected.circuit},{persistedTrophyId:selected.trophyId??null});return <p>{a.designId?trophyArt(a.designId)?.name??awardLabel(a):awardLabel(a)}</p>;})()}</div>
      <h4>This season’s editions & routes</h4>{map.data?.events.filter(e=>e.definitionId===selected.id).slice(0,20).map(e=><p key={e.id}><Link href={`${base}/events/${e.id}`}>Week {e.dates.startWeek} · {e.venue.displayName}, {e.venue.city} · {mapState(e)} — inspect eligibility & qualification</Link></p>)}
      <h4>Recent champions</h4>{history.data?.champions.slice(-5).reverse().map(c=><p key={c.id}>Season {c.season}: {winnerName(c.participant)}</p>)}
      {!history.data?.champions.length&&<p>No previous Career champion recorded. No pre-save history is invented.</p>}<Link href={`${base}/my-career/history`}>All Career-era editions & your history</Link>
    </CareerEventIdentity>:<>
      <CareerSection title="Organisations & Circuits">{d.organisations.map(o=><details className="p-4" key={o.id}><summary>{o.name} ({o.shortName})</summary><p>{o.role}</p>{d.circuits.filter(c=>c.organisationId===o.id).map(c=><button className="career-btn" key={c.id} onClick={()=>{setSearch(c.authorityCircuit);setPage(0);}}>{c.name}</button>)}</details>)}</CareerSection>
      {families.slice(page*20,(page+1)*20).map(f=><CareerEventIdentity key={f.id} eventKey={f.id} circuit={f.circuit}><Link className="career-directory-row" href={`${base}/world/events/${f.id}`}><strong>{f.name}</strong> · {titleCase(f.eventClass)}</Link></CareerEventIdentity>)}
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
