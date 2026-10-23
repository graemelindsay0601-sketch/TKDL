import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import { ArrowUpRight, Building2, CalendarDays, ChevronLeft, ChevronRight, MapPin, Search, SlidersHorizontal } from "lucide-react";
import "./Current.css";
import { countries, localities, seasonEvents, worldVenues, type VenueFamily, type VenueRecord } from "./fixtures";
import club from "./assets/career-venue-club.jpg";
import socialClub from "./assets/career-venue-social-club.jpg";
import countyHall from "./assets/career-venue-county-hall.jpg";
import sportsCentre from "./assets/career-venue-sports-centre.jpg";
import hotelBallroom from "./assets/career-venue-hotel-ballroom.jpg";
import conference from "./assets/career-venue-conference.jpg";
import floor from "./assets/career-venue-floor.jpg";
import studio from "./assets/career-venue-studio.jpg";
import heritage from "./assets/career-venue-heritage-theatre.jpg";
import modern from "./assets/career-venue-modern-theatre.jpg";
import exhibition from "./assets/career-venue-exhibition.jpg";
import arena from "./assets/career-venue-arena.jpg";
import majorArena from "./assets/career-venue-major-arena.jpg";
import internationalArena from "./assets/career-venue-international-arena.jpg";
import palace from "./assets/career-palace-arena.webp";

type Scope = "ALL" | "WORLD" | "LOCAL";
type Entry = VenueRecord & {source:"WORLD"|"LOCAL"; localityKey?:string};
const PAGE_SIZE = 8;
const ARTWORK:Record<VenueFamily,string> = {
  "pub-club":club,"social-club":socialClub,"community-hall":countyHall,"sports-centre":sportsCentre,
  "hotel-ballroom":hotelBallroom,conference, "professional-floor":floor,studio,
  "historic-theatre":heritage,"modern-theatre":modern,exhibition,"small-arena":arena,
  "major-arena":majorArena,"international-arena":internationalArena,palace,
};
const FAMILY_LABEL:Record<VenueFamily,string> = {
  "pub-club":"Pub club","social-club":"Social club","community-hall":"Community hall","sports-centre":"Sports centre",
  "hotel-ballroom":"Hotel ballroom",conference:"Conference venue","professional-floor":"Professional floor",
  studio:"Darts studio","historic-theatre":"Heritage theatre","modern-theatre":"Modern theatre",
  exhibition:"Exhibition venue","small-arena":"Arena","major-arena":"Major arena",
  "international-arena":"International arena",palace:"World Championship venue",
};
function Artwork({family,className=""}:{family:string;className?:string}) {
  return <div className={`cva-art ${className}`} data-family={family} aria-hidden="true"><img src={ARTWORK[family as VenueFamily] ?? exhibition} alt="" loading="lazy"/></div>;
}
const openLocal = (event:MouseEvent<HTMLAnchorElement>) => event.preventDefault();

export function Current() {
  const [scope,setScope] = useState<Scope>("ALL");
  const [search,setSearch] = useState("");
  const [country,setCountry] = useState("ALL");
  const [family,setFamily] = useState("ALL");
  const [capacity,setCapacity] = useState("ALL");
  const [page,setPage] = useState(0);
  const [activeId,setActiveId] = useState("the-palace-london");
  const entries = useMemo<Entry[]>(() => [
    ...worldVenues.map(v=>({...v,source:"WORLD" as const})),
    ...localities.flatMap(locality=>locality.venues.map(v=>({...v,source:"LOCAL" as const,localityKey:locality.key}))),
  ],[]);
  const countryNames = useMemo(()=>new Map(countries.map(c=>[c.id,c.name])),[]);
  const filtered = useMemo(()=>entries.filter(v=>{
    if(scope==="WORLD"&&v.source!=="WORLD")return false;
    if(scope==="LOCAL"&&v.source!=="LOCAL")return false;
    if(country!=="ALL"&&v.countryId!==country)return false;
    if(family!=="ALL"&&v.venueType!==family)return false;
    if(capacity!=="ALL"&&v.capacityBand!==capacity)return false;
    const query=search.trim().toLowerCase();
    return !query||`${v.displayName} ${v.nickname??""} ${v.city} ${v.region} ${countryNames.get(v.countryId)??v.countryId} ${FAMILY_LABEL[v.venueType]}`.toLowerCase().includes(query);
  }).sort((a,b)=>a.displayName.localeCompare(b.displayName)||a.id.localeCompare(b.id)),[entries,scope,country,family,capacity,search,countryNames]);
  const selected=entries.find(v=>v.id===activeId)??entries[0];
  const selectedEvents=selected?seasonEvents.filter(e=>e.venue.id===selected.id):[];
  const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
  const pageItems=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const reset=()=>{setScope("ALL");setSearch("");setCountry("ALL");setFamily("ALL");setCapacity("ALL");setPage(0);};
  const choose=(id:string)=>{setActiveId(id);setPage(Math.max(0,filtered.findIndex(v=>v.id===id)/PAGE_SIZE|0));};

  return <main className="career-venue-atlas">
    <header className="cva-mast">
      <div className="cva-mast-copy"><div className="cva-kicker"><i/>Career world <i/> venue atlas</div>
        <h1>Find your stage</h1>
        <p>From local club nights to the sport’s biggest arenas. Explore every authored venue and the locality-based club and county identities used by the season calendar.</p>
      </div>
      <div className="cva-count-stamp"><span>Career venue index</span><strong>{entries.length}</strong><small>{worldVenues.length} world venues · {entries.length-worldVenues.length} locality identities</small></div>
    </header>
    <section className="cva-feature">
      {selected&&<>
        <Artwork family={selected.venueType} className="cva-feature-art"/><div className="cva-feature-shade" aria-hidden="true"/>
        <div className="cva-feature-copy">
          <span className="cva-feature-overline"><i/>{FAMILY_LABEL[selected.venueType]} · {selected.source==="WORLD"?"Authored world venue":"Locality-based identity"}</span>
          <h2>{selected.nickname??selected.displayName}</h2>{selected.nickname&&<strong className="cva-feature-name">{selected.displayName}</strong>}
          <p className="cva-feature-place"><MapPin size={14} aria-hidden/>{selected.city}, {selected.region} · {countryNames.get(selected.countryId)??selected.countryId}</p>
          <div className="cva-feature-tags">{selected.atmosphereTags.slice(0,3).map(tag=><span key={tag}>{tag.replaceAll("-"," ")}</span>)}</div>
          <small className="cva-art-note">Illustrative venue artwork · visual identity, not a venue photograph</small>
        </div><span className="cva-feature-number">{selected.capacityBand}</span>
      </>}
    </section>
    <div className="cva-toolbar" role="group" aria-label="Venue collection">
      {([["ALL","All destinations",entries.length],["WORLD","World venues",worldVenues.length],["LOCAL","Local & county",entries.length-worldVenues.length]] as const).map(([value,label,count])=>
        <button key={value} className={scope===value?"is-active":""} aria-pressed={scope===value} onClick={()=>{setScope(value);setPage(0);}}>{label}<b>{count}</b></button>)}
    </div>
    <div className="cva-layout">
      <section className="cva-browse" aria-label="Browse venues">
        <div className="cva-filter-panel">
          <label className="cva-search"><Search size={16} aria-hidden/><span className="sr-only">Search venues</span><input type="search" maxLength={80} value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}} placeholder="Search venue, city or region"/></label>
          <label><span>Country</span><select value={country} onChange={e=>{setCountry(e.target.value);setPage(0);}}><option value="ALL">Every country</option>{countries.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label><span>Venue style</span><select value={family} onChange={e=>{setFamily(e.target.value);setPage(0);}}><option value="ALL">All venue styles</option>{Object.entries(FAMILY_LABEL).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
          <label><span>Scale</span><select value={capacity} onChange={e=>{setCapacity(e.target.value);setPage(0);}}><option value="ALL">All capacities</option><option value="CLUB">Club</option><option value="HALL">Hall</option><option value="ARENA">Arena</option></select></label>
          <button className="cva-reset" onClick={reset}><SlidersHorizontal size={14} aria-hidden/>Reset filters</button>
        </div>
        <div className="cva-list-heading"><div><span className="cva-eyebrow">Explore the directory</span><h3>Venues & local identities</h3></div><span>{filtered.length} results</span></div>
        {pageItems.length?<div className="cva-card-grid">{pageItems.map(v=><a key={v.id} href={`#venue-${v.id}`} onClick={e=>{e.preventDefault();choose(v.id);}} className={`cva-card${selected?.id===v.id?" is-selected":""}`} aria-current={selected?.id===v.id?"page":undefined}>
          <Artwork family={v.venueType} className="cva-card-art"/><div className="cva-card-copy"><span>{v.source==="WORLD"?"WORLD VENUE":v.capacityBand==="CLUB"?"LOCAL CLUB":"COUNTY HALL"}</span><strong>{v.nickname??v.displayName}</strong><small>{v.city}, {countryNames.get(v.countryId)??v.countryId}</small><i><ArrowUpRight size={15} aria-hidden/></i></div>
        </a>)}</div>:<div className="cva-empty"><Building2 size={24} aria-hidden/><strong>No venues match those filters</strong><span>Try a different search or reset the filters.</span></div>}
        <nav className="cva-pagination" aria-label="Venue pages"><button disabled={page===0} onClick={()=>setPage(Math.max(0,page-1))} aria-label="Previous venues"><ChevronLeft size={17}/></button><span>Page {page+1} of {pageCount}</span><button disabled={page+1>=pageCount} onClick={()=>setPage(Math.min(pageCount-1,page+1))} aria-label="Next venues"><ChevronRight size={17}/></button></nav>
      </section>
      {selected&&<aside className="cva-detail" aria-label={`${selected.displayName} venue details`}>
        <div className="cva-detail-head"><span className="cva-eyebrow">Destination profile</span><span className="cva-capacity">{selected.capacityBand}</span></div>
        <h3>{selected.nickname??selected.displayName}</h3>{selected.nickname&&<p className="cva-detail-subtitle">{selected.displayName}</p>}
        <p className="cva-detail-location"><MapPin size={15} aria-hidden/>{selected.city}, {selected.region}<span>{countryNames.get(selected.countryId)??selected.countryId}</span></p>
        <dl className="cva-facts"><div><dt>Venue style</dt><dd>{FAMILY_LABEL[selected.venueType]}</dd></div><div><dt>Stage setup</dt><dd>{selected.stageConfiguration.replaceAll("_"," ").toLowerCase()}</dd></div><div><dt>Directory source</dt><dd>{selected.source==="WORLD"?"Authored world venue":"Generated from a Career locality"}</dd></div></dl>
        <div className="cva-events"><div className="cva-events-title"><CalendarDays size={15} aria-hidden/><h4>Events this season</h4></div>
          {selectedEvents.length?selectedEvents.slice(0,6).map(e=><a className="cva-event-row" key={e.id} href={`#event-${e.id}`} onClick={openLocal}><span><strong>{e.name}</strong><small>Week {e.dates.startWeek} · {e.status.replaceAll("_"," ").toLowerCase()}</small></span><ArrowUpRight size={14} aria-hidden/></a>):<p className="cva-event-note">No event at this destination is scheduled in the current season.</p>}
        </div>
        {selected.source==="WORLD"&&<a className="cva-history-link" href="#history" onClick={openLocal}>Explore recorded championship history <ArrowUpRight size={14} aria-hidden/></a>}
      </aside>}
    </div>
    {scope!=="WORLD"&&<p className="cva-source-note">Local club and county identities are generated from authored Career localities. They are possibilities until an event in your season is scheduled there; no venue history or event is invented here.</p>}
  </main>;
}
