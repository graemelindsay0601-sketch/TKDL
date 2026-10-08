import {useEffect,useMemo,useRef,useState} from "react";
import {MapPin,Plus,Minus,LocateFixed,Compass,MousePointer2} from "lucide-react";
import landMap from "./world-land.svg";
import {Link,useSearch} from "wouter";
import {useWorldMap} from "../api";
import {CareerLoading,CareerError} from "../components";
import {CareerEventIdentity} from "../identity";
import {MAP_VIEWS,clusterLocations,filterMap,mapState,planningCosts} from "../presentation";
import {denialLabel,formatPence,titleCase,routeLines} from "../model";
import type {RouteFact} from "../types";
import type {ShellContext} from "../shell";

export function CareerMapPage({ctx}:{ctx:ShellContext}) {
  const params=new URLSearchParams(useSearch()),initialRegion=params.get("region")??"WORLD",regionKey=MAP_VIEWS[initialRegion]?initialRegion:"WORLD",initialEvent=params.get("event");
  const q=useWorldMap(ctx.save.id),[filter,setFilter]=useState(params.get("filter")??"OPPORTUNITIES"),[completed,setCompleted]=useState(false),[region,setRegion]=useState(regionKey),[view,setView]=useState(MAP_VIEWS[regionKey]);
  const [selected,setSelected]=useState<string[]>(initialEvent?[initialEvent]:[]),[inspected,setInspected]=useState<string|null>(initialEvent),[page,setPage]=useState(0);
  const [filtersOpen,setFiltersOpen]=useState(()=>typeof window!=="undefined"&&typeof window.matchMedia==="function"?window.matchMedia("(min-width:601px)").matches:true);
  const [drag,setDrag]=useState<{x:number;y:number;view:typeof view;inverse:DOMMatrix}|null>(null);
  const canvas=useRef<SVGSVGElement>(null);
  const [size,setSize]=useState({width:720,height:360});
  useEffect(()=>{
    const element=canvas.current;if(!element)return;
    const measure=()=>{const box=element.getBoundingClientRect();setSize({width:box.width||720,height:box.height||360});};
    measure();const observer=new ResizeObserver(measure);observer.observe(element);return()=>observer.disconnect();
  },[!!q.data]);
  const scale=Math.min(size.width/view.width,size.height/view.height);
  const events=useMemo(()=>filterMap(q.data?.events??[],filter,completed).sort((a,b)=>a.id.localeCompare(b.id)),[q.data,filter,completed]);
  const clusters=useMemo(()=>clusterLocations(events,view),[events,view]);
  const selection=events.filter(e=>selected.includes(e.id)),e=events.find(e=>e.id===inspected)??selection[0];
  const costs=planningCosts(e?.financialCommitment);
  const zoom=(factor:number)=>setView(v=>{const w=Math.max(8,Math.min(720,v.width*factor)),h=w*v.height/v.width;return {...v,x:v.x+(v.width-w)/2,y:v.y+(v.height-h)/2,width:w,height:h};});
  if(q.isLoading)return <CareerLoading label="Loading Career geography"/>;
  if(q.error||!q.data)return <CareerError error={q.error} onRetry={()=>q.refetch()}/>;
  return <div className="career-atlas space-y-3"><div className="career-atlas-heading"><div><span className="career-eyebrow">Darts world · discovery</span><h2><Compass size={24} aria-hidden/>Career Map</h2><p>Find your next stage. Explore events, venues and sporting routes.</p></div><span className="career-atlas-total">{events.length}<small>matching events</small></span></div>
    <div className="career-map-layout">
      <details open={filtersOpen} onToggle={event=>setFiltersOpen(event.currentTarget.open)} className="career-surface career-map-filters"><summary>Map filters</summary>
        <label>View <select value={region} onChange={ev=>{setRegion(ev.target.value);setView(MAP_VIEWS[ev.target.value]);setSelected([]);setInspected(null);}}>{Object.keys(MAP_VIEWS).map(v=><option value={v} key={v}>{v==="UK_IRELAND"?"UK & Ireland":titleCase(v)}</option>)}</select></label>
        <label>Activity <select value={filter} onChange={ev=>{setFilter(ev.target.value);setSelected([]);setPage(0);}}><option value="OPPORTUNITIES">My Opportunities</option><option value="ENTERED">Entered</option><option value="ALL">All events — including inaccessible</option>{[...new Set(q.data.events.map(ev=>ev.content.circuitId))].sort().map(c=><option key={c} value={c}>{titleCase(c)}</option>)}</select></label>
        <label className="career-map-check"><input type="checkbox" checked={completed} onChange={ev=>setCompleted(ev.target.checked)}/> Include completed</label><div className="career-map-legend"><span><i className="legend-available"/>Eligible opportunities</span><span><i className="legend-discovery"/>Other events</span></div><p className="career-map-note">City-level approximations, not road distances or travel bookings.</p>
      </details>
      <div className="career-surface career-map-canvas"><div className="career-map-toolbar"><span><MapPin size={14} aria-hidden/>{region==="UK_IRELAND"?"UK & Ireland":titleCase(region)}</span><div><button className="career-btn" aria-label="Zoom in" onClick={()=>zoom(.65)}><Plus size={17}/></button><button className="career-btn" aria-label="Zoom out" onClick={()=>zoom(1.5)}><Minus size={17}/></button><button className="career-btn" aria-label="Reset view" onClick={()=>setView(MAP_VIEWS[region])}><LocateFixed size={17}/></button></div></div>
        <svg ref={canvas} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} role="group" tabIndex={0} aria-label={`${titleCase(region)} Career geography; ${clusters.length} activity clusters. Arrow keys pan. Use the location list for event details.`}
          onKeyDown={ev=>{const delta:Record<string,[number,number]>={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,-.1],ArrowDown:[0,.1]};const step=delta[ev.key];if(ev.target===ev.currentTarget&&step){ev.preventDefault();setView(v=>({...v,x:v.x+step[0]*v.width,y:v.y+step[1]*v.height}));}}}
          onPointerDown={ev=>{if((ev.target as Element).closest("[data-map-marker]"))return;const matrix=ev.currentTarget.getScreenCTM();if(!matrix)return;ev.currentTarget.setPointerCapture(ev.pointerId);const inverse=matrix.inverse(),point=new DOMPoint(ev.clientX,ev.clientY).matrixTransform(inverse);setDrag({x:point.x,y:point.y,view,inverse});}}
          onPointerMove={ev=>{if(!drag)return;const point=new DOMPoint(ev.clientX,ev.clientY).matrixTransform(drag.inverse);setView({...drag.view,x:drag.view.x-(point.x-drag.x),y:drag.view.y-(point.y-drag.y)});}}
          onPointerUp={()=>setDrag(null)} onPointerCancel={()=>setDrag(null)}>
          <g pointerEvents="none">
            {Array.from({length:13},(_,i)=><line key={`lon-${i}`} x1={i*60} x2={i*60} y1={0} y2={360} stroke="#506b80" strokeOpacity=".14" strokeWidth={.6/scale}/>)}
            {Array.from({length:7},(_,i)=><line key={`lat-${i}`} x1={0} x2={720} y1={i*60} y2={i*60} stroke="#506b80" strokeOpacity=".14" strokeWidth={.6/scale}/>)}
            <image href={landMap} x={0} y={0} width={720} height={360}/>
            {view.width>200&&[["NORTH AMERICA",150,95],["SOUTH AMERICA",240,245],["EUROPE",386,73],["AFRICA",395,190],["ASIA",530,110],["OCEANIA",635,250]].map(([label,x,y])=><text key={label} x={x} y={y} fill="#9bb0c5" opacity=".7" fontSize={9/scale} textAnchor="middle" letterSpacing={1.2/scale}>{label}</text>)}
          </g>
          {clusters.map(c=><g key={c.key} data-map-marker data-selected={c.events.some(x=>selected.includes(x.id))} role="button" tabIndex={0} aria-label={`${c.events[0].venue.city}: ${c.events.length} events`} onClick={()=>{setSelected(c.events.map(x=>x.id));setInspected(c.events[0].id);}} onKeyDown={ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();setSelected(c.events.map(x=>x.id));setInspected(c.events[0].id);}}}>
            <title>{c.events[0].venue.city} · {c.events.length} events</title><circle cx={c.x} cy={c.y} r={28/scale} fill="transparent" vectorEffect="non-scaling-stroke"/><circle className="career-map-pin-halo" cx={c.x} cy={c.y} r={23/scale} fill={c.events.some(x=>x.opportunity.canEnter)?"#83dbad":"#83b6ed"} fillOpacity=".18" vectorEffect="non-scaling-stroke"/><circle cx={c.x} cy={c.y} r={13/scale} fill={c.events.some(x=>x.opportunity.canEnter)?"#83dbad":"#83b6ed"} stroke="#0c1620" strokeWidth={2} vectorEffect="non-scaling-stroke"/><text x={c.x} y={c.y+4/scale} textAnchor="middle" fontSize={11/scale} fontWeight="800" fill="#071321">{c.events.length}</text></g>)}
        </svg>
        {!clusters.length&&<p>No matching activity in this view. Zoom out or change filters; these are views, not unlocks.</p>}
        <div className="career-map-footer"><span><MousePointer2 size={13} aria-hidden/>Drag to explore · arrow keys to pan</span><span>{clusters.length} locations in view</span></div>
        <details className="career-map-location-list"><summary>Accessible location list ({clusters.length})</summary>{clusters.map(c=><button className="career-btn" key={c.key} onClick={()=>{setSelected(c.events.map(x=>x.id));setInspected(c.events[0].id);}}>{c.events[0].venue.city} · {c.events.length} events</button>)}</details>
      </div>
      <aside className="career-surface career-map-inspector" aria-label="Selected event" data-selected={!!e}><span className="career-eyebrow">Event intelligence</span>
        {selection.length>1&&<label>Events at this location <select value={e?.id??""} onChange={ev=>setInspected(ev.target.value)}>{selection.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>}
        {e?<CareerEventIdentity eventKey={e.definitionId} circuit={e.content.circuitId.includes("vault")?"VAULT":""}><h3>{e.name}</h3><p>{e.venue.displayName}, {e.venue.city}</p><p>Week {e.dates.startWeek} · {mapState(e)}</p><p>{e.fieldDescriptor}</p>
          {costs&&<dl><dt>Commitment (estimated)</dt><dd>{formatPence(costs.commitment)}</dd><dt>Sponsor coverage</dt><dd>{formatPence(costs.coverage)}</dd><dt>Your cost (estimated)</dt><dd>{formatPence(costs.playerCost)}</dd></dl>}
          {!e.opportunity.canEnter&&<><h4>Why can’t I play?</h4><p>{e.opportunity.reasons.length?e.opportunity.reasons.map(denialLabel).join(" · "):"Check registration dates and the event’s sporting routes."}</p></>}
          {e.qualification?.routes&&<div aria-label="Actual sporting routes">{routeLines(e.qualification.routes as RouteFact).map((r,i)=><p key={i}>{r.text} · {r.met?"met":"not currently met"}</p>)}</div>}
          <Link className="career-btn career-btn-primary" href={`/career/${ctx.save.id}/${e.status==="IN_PROGRESS"&&e.opportunity.state==="ENTERED"?`tournaments/${e.id}`:`events/${e.id}`}`}>{e.status==="IN_PROGRESS"&&e.opportunity.state==="ENTERED"?"Return to Tournament":"Inspect event & qualification routes"}</Link>
        </CareerEventIdentity>:<div className="career-map-empty"><MapPin size={34} aria-hidden/><h3>Your next destination</h3><p>Select a marker to see the venue, estimated commitment and qualification routes.</p><small>Explore inaccessible events using All Events.</small></div>}
      </aside>
    </div>
    <details className="career-surface"><summary>All matching events ({events.length})</summary>{events.slice(page*20,(page+1)*20).map(x=><button className="career-map-list-row" key={x.id} onClick={()=>{setSelected([x.id]);setInspected(x.id);}}>{x.name} · {x.venue.city} · {mapState(x)}</button>)}<div className="career-pagination"><button disabled={!page} onClick={()=>setPage(page-1)}>Previous</button><span>Page {page+1}</span><button disabled={(page+1)*20>=events.length} onClick={()=>setPage(page+1)}>Next</button></div></details>
  </div>;
}
