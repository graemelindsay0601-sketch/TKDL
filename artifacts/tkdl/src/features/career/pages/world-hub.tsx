import {useState,useEffect} from "react";
import {Link,useSearch} from "wouter";
import {useWorldContent,useWorldLocalities,useWorldMap,useWorldPlayers,useRankingTable,useLegacy,useEventLegacy,useCareerLife} from "../api";
import {CareerLoading,CareerError,CareerSection} from "../components";
import {CareerEventIdentity,CareerPlayerCard,CareerTrophy} from "../identity";
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
  return <div className="space-y-3"><h2>{section==="landing"?"Darts World":section==="search"?"Search the darts world":section==="events"?"Events & Circuits":"World History"}</h2>
    {["search","events"].includes(section)&&<label className="career-surface career-search">Search <input type="search" maxLength={80} value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Names, cities, circuits"/></label>}
    {section==="landing"&&<>
      <div className="career-position-grid"><CareerSection title="Published World #1"><p className="p-4">{rankings.isLoading?"Reading published standings…":rankings.error?"Published leader unavailable":rankings.data?.rows[0]?.name??"No published leader yet"}</p><Link href={`${base}/rankings`}>Explore rankings & races</Link></CareerSection>
        <CareerSection title="World Championship"><p className="p-4">{legacy.isLoading?"Reading recorded champions…":legacy.error?"Recorded champions unavailable":latestWorld?`Last recorded season champion: ${winnerName(latestWorld.participant)}`:"No completed World Championship season recorded."}</p><Link href={`${base}/world/events/world-darts-championship`}>The Palace World Championship</Link></CareerSection></div>
      <CareerSection title="Upcoming Championships">{map.data?.events.filter(e=>["MAJOR","WORLD_CHAMPIONSHIP"].includes(e.content.eventClass)&&!["COMPLETED","CANCELLED"].includes(e.status)).slice(0,4).map(e=><CareerEventIdentity key={e.id} eventKey={e.definitionId}><p className="p-4"><Link href={`${base}/events/${e.id}`}>{e.name}</Link> · W{e.dates.startWeek} · {mapState(e)}</p></CareerEventIdentity>)}</CareerSection>
      <CareerSection title="Around the World">{life.data?.news.slice(0,4).map(n=><p className="p-4" key={n.id}><Link href={`${base}/stories`}>{n.title}</Link></p>)}<Link href={`${base}/world/history`}>Champions, records & Hall of Fame</Link></CareerSection>
      <div className="career-discovery-links">{[["Players","/world/players"],["Events & Circuits","/world/events"],["Venues","/world/venues"],["History","/world/history"]].map(([label,path])=><Link className="career-surface" key={path} href={`${base}${path}`}>{label}</Link>)}</div>
    </>}
    {section==="search"&&<><WorldPlayerDirectory ctx={ctx} search={search}/><CareerSection title="Events / Championships">{families.slice(0,10).map(f=><Link className="career-directory-row" key={f.id} href={`${base}/world/events/${f.id}`}>{f.name}</Link>)}</CareerSection><CareerSection title="Venues">{venues.slice(0,10).map(v=><Link className="career-directory-row" key={v.id} href={`${base}/world/venues/${v.id}`}>{v.displayName}, {v.city}</Link>)}</CareerSection><p>Event and venue search shows up to ten matches; their directories provide full filtered pagination.</p></>}
    {section==="events"&&(selected?<CareerEventIdentity eventKey={selected.id} circuit={selected.circuit} level={selected.eventClass} className="career-surface career-world-detail">
      <h3>{selected.name}</h3><p>{d.organisations.find(o=>o.id===selected.organisationId)?.name} · {titleCase(selected.eventClass)} · {titleCase(selected.formatKind)}</p>
      <p>{selected.fieldDescription}</p><p>{selected.supported?"Executable sporting format":"This sporting format is not currently executable"}</p>
      {(()=>{const trophy=d.trophies.find(t=>t.id===selected.trophyId);return trophy?<><CareerTrophy name={trophy.name} design={trophy.designKey}/><p>{trophy.name}</p></>:null;})()}
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
      {q.data.players.map(p=><div className="career-directory-row" key={p.id}><Link href={`/career/${ctx.save.id}/world/players/${p.id}`}><CareerPlayerCard name={p.name} nickname={p.nickname} nationality={String(p.country)} identity={p.shirt} rank={p.ranking} sponsors={p.commercial.portfolio} badges={[String(p.status)]} scale={id?"profile":"compact"}/></Link></div>)}
      {!q.data.players.length&&<p className="p-4">No matching players. Retired careers remain discoverable with the All / Retired filter.</p>}
      {!id&&<div className="career-pagination"><button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-50))}>Previous</button><span>{q.data.total} players</span><button disabled={q.data.nextOffset===null} onClick={()=>setOffset(q.data!.nextOffset!)}>Next</button></div>}
    </CareerSection>}
    {id&&<><NpcLegacyPage ctx={ctx} npcId={id}/><Link href={`/career/${ctx.save.id}/relationships`}>Your played H2H & relationships</Link></>}
  </div>;
}
