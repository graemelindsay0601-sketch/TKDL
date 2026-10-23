import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowLeft, ArrowRight, CalendarDays, MapPin, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import type { MouseEvent } from "react";
import "./Redesign.css";
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
const PAGE_SIZE=8;
const ARTWORK:Record<VenueFamily,string>={"pub-club":club,"social-club":socialClub,"community-hall":countyHall,"sports-centre":sportsCentre,"hotel-ballroom":hotelBallroom,conference,"professional-floor":floor,studio,"historic-theatre":heritage,"modern-theatre":modern,exhibition,"small-arena":arena,"major-arena":majorArena,"international-arena":internationalArena,palace};
const LABEL:Record<VenueFamily,string>={"pub-club":"Pub club","social-club":"Social club","community-hall":"Community hall","sports-centre":"Sports centre","hotel-ballroom":"Hotel ballroom",conference:"Conference venue","professional-floor":"Professional floor",studio:"Darts studio","historic-theatre":"Heritage theatre","modern-theatre":"Modern theatre",exhibition:"Exhibition venue","small-arena":"Arena","major-arena":"Major arena","international-arena":"International arena",palace:"World Championship venue"};
const stopNav=(e:MouseEvent<HTMLAnchorElement>)=>e.preventDefault();
function Scene({family,className=""}:{family:string;className?:string}) {
  return <div className={`venue-scene ${className}`} data-family={family} aria-hidden="true"><img src={ARTWORK[family as VenueFamily]??exhibition} alt="" loading="lazy"/></div>;
}

export function Redesign() {
  const [scope,setScope]=useState<Scope>("ALL"),[search,setSearch]=useState(""),[country,setCountry]=useState("ALL"),[family,setFamily]=useState("ALL"),[capacity,setCapacity]=useState("ALL"),[page,setPage]=useState(0),[activeId,setActiveId]=useState("the-palace-london");
  const entries=useMemo<Entry[]>(()=>[...worldVenues.map(v=>({...v,source:"WORLD" as const})),...localities.flatMap(l=>l.venues.map(v=>({...v,source:"LOCAL" as const,localityKey:l.key})))],[]);
  const countryNames=useMemo(()=>new Map(countries.map(c=>[c.id,c.name])),[]);
  const filtered=useMemo(()=>entries.filter(v=>{
    if(scope==="WORLD"&&v.source!=="WORLD")return false;if(scope==="LOCAL"&&v.source!=="LOCAL")return false;
    if(country!=="ALL"&&v.countryId!==country)return false;if(family!=="ALL"&&v.venueType!==family)return false;if(capacity!=="ALL"&&v.capacityBand!==capacity)return false;
    const q=search.trim().toLowerCase();return !q||`${v.displayName} ${v.nickname??""} ${v.city} ${v.region} ${countryNames.get(v.countryId)??v.countryId} ${LABEL[v.venueType]}`.toLowerCase().includes(q);
  }).sort((a,b)=>a.displayName.localeCompare(b.displayName)||a.id.localeCompare(b.id)),[entries,scope,country,family,capacity,search,countryNames]);
  const selected=entries.find(v=>v.id===activeId)??entries[0], events=seasonEvents.filter(e=>e.venue.id===selected?.id);
  const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE)), pageItems=filtered.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
  const setFilterPage=(fn:()=>void)=>{fn();setPage(0);};
  const reset=()=>{setScope("ALL");setSearch("");setCountry("ALL");setFamily("ALL");setCapacity("ALL");setPage(0);};
  const select=(id:string)=>{setActiveId(id);setPage(Math.max(0,filtered.findIndex(v=>v.id===id)/PAGE_SIZE|0));};
  const counts=[entries.length,worldVenues.length,entries.length-worldVenues.length];
  return <main className="venues-redesign">
    <header className="vr-header">
      <div className="vr-topline"><span>TKDL CAREER <b> / </b> DARTS WORLD</span><span className="vr-status"><i/> WORLD DIRECTORY</span></div>
      <div className="vr-heading-row"><div><p className="vr-index">FIELD GUIDE <span>01—03</span></p><h1>VENUES <em>&</em><br/>ARENAS</h1></div>
        <div className="vr-intro"><span className="vr-rule"/><p>Every stage has a character. Trace the authored world circuit, then find the local clubs and county halls that could host your season.</p><small><Sparkles size={13}/> {entries.length} DESTINATIONS IN THE INDEX</small></div>
      </div>
      <div className="vr-countline"><span>THE SEASON’S GEOGRAPHY</span><span>{worldVenues.length} WORLD STAGES <i/> {counts[2]} LOCAL IDENTITIES</span></div>
    </header>
    <section className="vr-feature" aria-label="Selected venue">
      <Scene family={selected.venueType} className="vr-feature-art"/><div className="vr-feature-wash"/>
      <div className="vr-feature-meta"><span>FEATURED DESTINATION</span><span>{selected.capacityBand} / {selected.source==="WORLD"?"WORLD VENUE":"LOCAL IDENTITY"}</span></div>
      <div className="vr-feature-copy">
        <span className="vr-category">{LABEL[selected.venueType]} <i/> {selected.city}, {selected.region}</span>
        <h2>{selected.nickname??selected.displayName}</h2>{selected.nickname&&<p className="vr-official-name">{selected.displayName}</p>}
        <p className="vr-place"><MapPin size={15}/>{countryNames.get(selected.countryId)??selected.countryId}</p>
        <div className="vr-tags">{selected.atmosphereTags.slice(0,3).map(t=><span key={t}>{t.replaceAll("-"," ")}</span>)}</div>
      </div>
      <div className="vr-feature-footer"><span>ART DIRECTION / VENUE IDENTITY</span><strong>Illustrative artwork · not a venue photograph</strong></div>
    </section>
    <nav className="vr-scopes" aria-label="Destination scope">{(["ALL","WORLD","LOCAL"] as const).map((v,i)=><button key={v} className={scope===v?"active":""} aria-pressed={scope===v} onClick={()=>{setScope(v);setPage(0);}}><span>0{i+1}</span>{v==="ALL"?"All destinations":v==="WORLD"?"World venues":"Local & county"}<b>{counts[i]}</b></button>)}</nav>
    <div className="vr-workbench">
      <section className="vr-directory">
        <div className="vr-filterbar">
          <label className="vr-search"><Search size={16}/><span className="sr-only">Search venues</span><input value={search} maxLength={80} type="search" placeholder="Venue, city, region…" onChange={e=>setFilterPage(()=>setSearch(e.target.value))}/></label>
          <label><span>COUNTRY</span><select value={country} onChange={e=>setFilterPage(()=>setCountry(e.target.value))}><option value="ALL">Every country</option>{countries.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label><span>STYLE</span><select value={family} onChange={e=>setFilterPage(()=>setFamily(e.target.value))}><option value="ALL">All venue styles</option>{Object.entries(LABEL).map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
          <label><span>SCALE</span><select value={capacity} onChange={e=>setFilterPage(()=>setCapacity(e.target.value))}><option value="ALL">Every scale</option><option value="CLUB">Club</option><option value="HALL">Hall</option><option value="ARENA">Arena</option></select></label>
          <button className="vr-reset" onClick={reset}><SlidersHorizontal size={14}/> Reset</button>
        </div>
        <div className="vr-directory-title"><div><span>THE ATLAS / DIRECTORY</span><h3>Choose a destination</h3></div><span>{filtered.length} PLACES</span></div>
        {pageItems.length?<div className="vr-list">{pageItems.map((v,index)=><button key={v.id} onClick={()=>select(v.id)} className={`vr-row ${selected.id===v.id?"selected":""}`}>
          <span className="vr-row-number">{String(page*PAGE_SIZE+index+1).padStart(2,"0")}</span><Scene family={v.venueType} className="vr-thumb"/>
          <span className="vr-row-copy"><small>{v.source==="WORLD"?"WORLD VENUE":v.capacityBand==="CLUB"?"LOCAL CLUB":"COUNTY HALL"}</small><strong>{v.nickname??v.displayName}</strong><span>{v.city} <i>·</i> {countryNames.get(v.countryId)??v.countryId}</span></span>
          <ArrowDownRight className="vr-row-arrow" size={17}/>
        </button>)}</div>:<div className="vr-empty"><strong>Nothing in this part of the map.</strong><span>Adjust your filters, or reset to see all destinations.</span></div>}
        <div className="vr-pages"><button disabled={page===0} onClick={()=>setPage(Math.max(0,page-1))} aria-label="Previous venues"><ArrowLeft size={16}/></button><span>PAGE <b>{String(page+1).padStart(2,"0")}</b> / {String(pageCount).padStart(2,"0")}</span><button disabled={page+1>=pageCount} onClick={()=>setPage(Math.min(pageCount-1,page+1))} aria-label="Next venues"><ArrowRight size={16}/></button></div>
      </section>
      <aside className="vr-profile">
        <div className="vr-profile-top"><span>DESTINATION FILE</span><b>{selected.capacityBand}</b></div>
        <h3>{selected.nickname??selected.displayName}</h3>{selected.nickname&&<p className="vr-official-name">{selected.displayName}</p>}
        <p className="vr-location"><MapPin size={14}/>{selected.city}, {selected.region}<span>{countryNames.get(selected.countryId)??selected.countryId}</span></p>
        <div className="vr-facts"><div><span>VENUE STYLE</span><strong>{LABEL[selected.venueType]}</strong></div><div><span>STAGE SETUP</span><strong>{selected.stageConfiguration.replaceAll("_"," ").toLowerCase()}</strong></div><div><span>DIRECTORY SOURCE</span><strong>{selected.source==="WORLD"?"Authored world venue":"Generated from a Career locality"}</strong></div></div>
        <div className="vr-season"><div className="vr-season-title"><CalendarDays size={15}/><span>THIS SEASON</span></div>
          {events.length?events.slice(0,6).map(e=><a key={e.id} href={`#event-${e.id}`} onClick={stopNav} className="vr-event"><span><strong>{e.name}</strong><small>WEEK {e.dates.startWeek} <i/> {e.status.replaceAll("_"," ")}</small></span><ArrowRight size={15}/></a>):<p>No event at this destination is scheduled in the current season.</p>}
        </div>
        {selected.source==="WORLD"&&<a href="#history" onClick={stopNav} className="vr-history">Recorded championship history <ArrowRight size={14}/></a>}
      </aside>
    </div>
    {scope!=="WORLD"&&<p className="vr-disclosure">LOCAL & COUNTY IDENTITIES <i/> Generated from authored Career localities. They are possibilities until an event in your season is scheduled there; no venue history or event is invented here.</p>}
  </main>;
}
