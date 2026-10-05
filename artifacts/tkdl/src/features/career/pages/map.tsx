import {useMemo,useState} from "react";
import {Link,useSearch} from "wouter";
import {useWorldMap} from "../api";
import {CareerLoading,CareerError} from "../components";
import {CareerEventIdentity} from "../identity";
import {MAP_VIEWS,projectCoordinate,clusterLocations,filterMap,mapState,planningCosts} from "../presentation";
import {denialLabel,formatPence,titleCase,routeLines} from "../model";
import type {RouteFact} from "../types";
import type {ShellContext} from "../shell";

// Original bundled coarse outlines. Equirectangular, not navigation/road geography.
const LAND=[
  [[-168,70],[-142,70],[-130,55],[-123,49],[-117,33],[-100,18],[-82,9],[-78,25],[-65,45],[-52,52],[-60,63],[-95,75],[-168,70]],
  [[-81,12],[-60,8],[-35,-6],[-43,-23],[-57,-55],[-74,-48],[-79,-18],[-81,12]],
  [[-17,36],[12,37],[35,31],[51,12],[41,-12],[20,-35],[10,-27],[-3,5],[-17,15],[-17,36]],
  [[-10,36],[-9,43],[2,50],[8,55],[5,61],[20,71],[40,70],[65,76],[100,75],[140,70],[180,60],[150,47],[140,35],[120,20],[105,1],[80,8],[67,25],[40,40],[20,40],[12,36],[-10,36]],
  [[113,-22],[130,-11],[151,-20],[154,-38],[132,-35],[115,-35],[113,-22]],
  [[-8,55],[-5,58.6],[-3,58.7],[-2,56],[-.1,52],[1.4,51],[-5,50],[-5,53],[-8,55]],
  [[-10,51.5],[-6,51.5],[-5.5,55],[-8,55.5],[-10,53],[-10,51.5]],
  [[-53,60],[-20,70],[-30,83],[-55,80],[-53,60]],
  [[130,32],[140,36],[145,44],[142,44],[138,38],[130,32]],
  [[167,-45],[174,-41],[178,-37],[175,-36],[170,-42],[167,-45]],
];
export function CareerMapPage({ctx}:{ctx:ShellContext}) {
  const params=new URLSearchParams(useSearch()),initialRegion=params.get("region")??"WORLD",regionKey=MAP_VIEWS[initialRegion]?initialRegion:"WORLD",initialEvent=params.get("event");
  const q=useWorldMap(ctx.save.id),[filter,setFilter]=useState(params.get("filter")??"OPPORTUNITIES"),[completed,setCompleted]=useState(false),[region,setRegion]=useState(regionKey),[view,setView]=useState(MAP_VIEWS[regionKey]);
  const [selected,setSelected]=useState<string[]>(initialEvent?[initialEvent]:[]),[inspected,setInspected]=useState<string|null>(initialEvent),[page,setPage]=useState(0);
  const [drag,setDrag]=useState<{x:number;y:number;view:typeof view}|null>(null);
  const events=useMemo(()=>filterMap(q.data?.events??[],filter,completed).sort((a,b)=>a.id.localeCompare(b.id)),[q.data,filter,completed]);
  const clusters=useMemo(()=>clusterLocations(events,view),[events,view]);
  const selection=events.filter(e=>selected.includes(e.id)),e=events.find(e=>e.id===inspected)??selection[0];
  const costs=planningCosts(e?.financialCommitment);
  const zoom=(factor:number)=>setView(v=>{const w=Math.max(8,Math.min(720,v.width*factor)),h=w*v.height/v.width;return {...v,x:v.x+(v.width-w)/2,y:v.y+(v.height-h)/2,width:w,height:h};});
  if(q.isLoading)return <CareerLoading label="Loading Career geography"/>;
  if(q.error||!q.data)return <CareerError error={q.error} onRetry={()=>q.refetch()}/>;
  return <div className="space-y-3"><h2>Career Map</h2><p>Discover the darts world. City-level approximations; no road distances or travel bookings.</p>
    <div className="career-map-layout">
      <details open className="career-surface career-map-filters"><summary>Map filters</summary>
        <label>View <select value={region} onChange={ev=>{setRegion(ev.target.value);setView(MAP_VIEWS[ev.target.value]);setSelected([]);setInspected(null);}}>{Object.keys(MAP_VIEWS).map(v=><option value={v} key={v}>{v==="UK_IRELAND"?"UK & Ireland":titleCase(v)}</option>)}</select></label>
        <label>Activity <select value={filter} onChange={ev=>{setFilter(ev.target.value);setSelected([]);setPage(0);}}><option value="OPPORTUNITIES">My Opportunities</option><option value="ENTERED">Entered</option><option value="ALL">All events — including inaccessible</option>{[...new Set(q.data.events.map(ev=>ev.content.circuitId))].sort().map(c=><option key={c} value={c}>{titleCase(c)}</option>)}</select></label>
        <label><input type="checkbox" checked={completed} onChange={ev=>setCompleted(ev.target.checked)}/> Include completed</label><p>{events.length} matching events · {clusters.length} visible clusters</p>
      </details>
      <div className="career-surface career-map-canvas"><div className="career-map-toolbar"><button className="career-btn" aria-label="Zoom in" onClick={()=>zoom(.65)}>+</button><button className="career-btn" aria-label="Zoom out" onClick={()=>zoom(1.5)}>−</button><button className="career-btn" onClick={()=>setView(MAP_VIEWS[region])}>Reset view</button></div>
        <svg viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="group" tabIndex={0} aria-label={`${titleCase(region)} Career geography; ${clusters.length} activity clusters. Arrow keys pan. Use the location list for event details.`}
          onKeyDown={ev=>{const delta:Record<string,[number,number]>={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]};const step=delta[ev.key];if(ev.target===ev.currentTarget&&step){ev.preventDefault();setView(v=>({...v,x:v.x+step[0]*v.width,y:v.y+step[1]*v.height}));}}}
          onPointerDown={ev=>{if(ev.target!==ev.currentTarget)return;ev.currentTarget.setPointerCapture(ev.pointerId);setDrag({x:ev.clientX,y:ev.clientY,view});}}
          onPointerMove={ev=>{if(!drag)return;const b=ev.currentTarget.getBoundingClientRect();setView({...drag.view,x:drag.view.x-(ev.clientX-drag.x)/b.width*view.width,y:drag.view.y-(ev.clientY-drag.y)/b.height*view.height});}}
          onPointerUp={()=>setDrag(null)} onPointerCancel={()=>setDrag(null)}>
          <g pointerEvents="none">{LAND.map((poly,i)=><polygon key={i} points={poly.map(([lon,lat])=>{const p=projectCoordinate(lat,lon);return `${p.x},${p.y}`;}).join(" ")} fill="#263c50" stroke="#68859c" strokeWidth={view.width/1100}/>)}
            {view.width>200&&[["North America",160,95],["South America",235,235],["Europe",389,95],["Africa",395,178],["Asia",535,110],["Oceania",620,250]].map(([label,x,y])=><text key={label} x={x} y={y} fill="#9bb0c5" fontSize="9" textAnchor="middle">{label}</text>)}
          </g>
          {clusters.map(c=><g key={c.key} role="button" tabIndex={0} aria-label={`${c.events[0].venue.city}: ${c.events.length} events`} onClick={()=>{setSelected(c.events.map(x=>x.id));setInspected(c.events[0].id);}} onKeyDown={ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();setSelected(c.events.map(x=>x.id));setInspected(c.events[0].id);}}}>
            <circle cx={c.x} cy={c.y} r={view.width/42} fill="transparent"/><circle cx={c.x} cy={c.y} r={view.width/95} fill={c.events.some(x=>x.opportunity.canEnter)?"#83dbad":"#83b6ed"} stroke="#0c1620" strokeWidth={view.width/800}/><text x={c.x} y={c.y+view.width/320} textAnchor="middle" fontSize={view.width/110} fill="#071321">{c.events.length}</text></g>)}
        </svg>
        {!clusters.length&&<p>No matching activity in this view. Zoom out or change filters; these are views, not unlocks.</p>}
        <details className="career-map-location-list"><summary>Accessible location list ({clusters.length})</summary>{clusters.map(c=><button className="career-btn" key={c.key} onClick={()=>{setSelected(c.events.map(x=>x.id));setInspected(c.events[0].id);}}>{c.events[0].venue.city} · {c.events.length} events</button>)}</details>
      </div>
      <aside className="career-surface career-map-inspector" aria-label="Selected event">
        {selection.length>1&&<label>Events at this location <select value={e?.id??""} onChange={ev=>setInspected(ev.target.value)}>{selection.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
        {e?<CareerEventIdentity eventKey={e.definitionId} circuit={e.content.circuitId.includes("vault")?"VAULT":""}><h3>{e.name}</h3><p>{e.venue.displayName}, {e.venue.city}</p><p>Week {e.dates.startWeek} · {mapState(e)}</p><p>{e.fieldDescriptor}</p>
          {costs&&<dl><dt>Commitment (estimated)</dt><dd>{formatPence(costs.commitment)}</dd><dt>Sponsor coverage</dt><dd>{formatPence(costs.coverage)}</dd><dt>Your cost (estimated)</dt><dd>{formatPence(costs.playerCost)}</dd></dl>}
          {!e.opportunity.canEnter&&<><h4>Why can’t I play?</h4><p>{e.opportunity.reasons.length?e.opportunity.reasons.map(denialLabel).join(" · "):"Check registration dates and the event’s sporting routes."}</p></>}
          {e.qualification?.routes&&<div aria-label="Actual sporting routes">{routeLines(e.qualification.routes as RouteFact).map((r,i)=><p key={i}>{r.text} · {r.met?"met":"not currently met"}</p>)}</div>}
          <Link className="career-btn career-btn-primary" href={`/career/${ctx.save.id}/${e.status==="IN_PROGRESS"&&e.opportunity.state==="ENTERED"?`tournaments/${e.id}`:`events/${e.id}`}`}>{e.status==="IN_PROGRESS"&&e.opportunity.state==="ENTERED"?"Return to Tournament":"Inspect event & qualification routes"}</Link>
        </CareerEventIdentity>:<p>Select a location or browse the event list. Inaccessible events remain discoverable through All Events.</p>}
      </aside>
    </div>
    <details className="career-surface"><summary>All matching events ({events.length})</summary>{events.slice(page*20,(page+1)*20).map(x=><button className="career-map-list-row" key={x.id} onClick={()=>{setSelected([x.id]);setInspected(x.id);}}>{x.name} · {x.venue.city} · {mapState(x)}</button>)}<div className="career-pagination"><button disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page+1}</span><button disabled={(page+1)*20>=events.length} onClick={()=>setPage(page+1)}>Next</button></div></details>
  </div>;
}
