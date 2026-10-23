import { useMemo, useState } from "react";
import {
  ArrowDownUp, ArrowLeft, ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleDollarSign, Clock3, MapPin, SlidersHorizontal, Ticket, Trophy,
} from "lucide-react";
import clubImage from "./assets/club.jpg";
import countyImage from "./assets/county.jpg";
import floorImage from "./assets/floor.jpg";
import majorImage from "./assets/major.jpg";
import arenaImage from "./assets/arena.jpg";
import ballroomImage from "./assets/ballroom.jpg";
import "./_group.css";
import "./Redesign.css";

type Fixture = {
  id: string; name: string; circuit: string; tier: string; week: number; country: string;
  city: string; venue: string; image: string; status: string; cost: number; fee: number;
  travel: number; stay: number; sponsor: number; prize: number; field: string; eligible: string;
  summary: string; level: string; entered: boolean; phase: string; format: string;
  closes: number; open: boolean;
};

const fixtures: Fixture[] = [
  { id:"f1",name:"Robin Hood Friday 501",circuit:"Grassroots · Local Series",tier:"LOCAL",week:18,country:"GBR",city:"Nottingham",venue:"The Robin Hood Social Club",image:clubImage,status:"Open for entry",cost:850,fee:500,travel:150,stay:200,sponsor:0,prize:4500,field:"24 / 32",eligible:"Eligible",summary:"A friendly local night with ranking points, a short journey and a field that’s filling steadily.",level:"Local",entered:false,phase:"Club & local",format:"501 · best of 7 legs",closes:17,open:true },
  { id:"f2",name:"East Midlands Open",circuit:"Regional · Open Tour",tier:"FEATURED",week:19,country:"GBR",city:"Derby",venue:"Derby County Hall",image:countyImage,status:"Qualified — enter now",cost:1850,fee:1000,travel:550,stay:300,sponsor:0,prize:24000,field:"61 / 96",eligible:"Eligible",summary:"A serious regional field and a useful step toward the national amateur rankings.",level:"Featured",entered:false,phase:"County & regional",format:"501 · best of 9 legs",closes:18,open:true },
  { id:"f3",name:"County Championship — East",circuit:"County · Team Circuit",tier:"STANDARD",week:20,country:"GBR",city:"Leicester",venue:"Leicester Community Hall",image:countyImage,status:"Entered",cost:1200,fee:0,travel:800,stay:400,sponsor:0,prize:0,field:"16 / 16",eligible:"Eligible",summary:"A county fixture with team points on the line. Your place is confirmed.",level:"Standard",entered:true,phase:"County & regional",format:"501 · best of 11 legs",closes:16,open:false },
  { id:"f4",name:"National Amateur Masters",circuit:"National Amateur · Masters",tier:"TELEVISED",week:23,country:"GBR",city:"Birmingham",venue:"The Grand Assembly Hall",image:ballroomImage,status:"Entries open",cost:4250,fee:2500,travel:850,stay:900,sponsor:0,prize:125000,field:"92 / 128",eligible:"Eligible",summary:"A packed national field. The winner takes a meaningful prize and a ranking boost.",level:"Televised",entered:false,phase:"National amateur",format:"501 · best of 11 legs",closes:21,open:true },
  { id:"f5",name:"Challenger Series — Antwerp",circuit:"Challenger · European Tour",tier:"MAJOR",week:28,country:"BEL",city:"Antwerp",venue:"Sportpaleis Annex",image:arenaImage,status:"Not eligible",cost:12600,fee:6500,travel:3600,stay:2500,sponsor:0,prize:650000,field:"38 / 64",eligible:"Tour Card required",summary:"A high-profile professional stop. Your pathway opens through qualification and results.",level:"Major",entered:false,phase:"Challenger",format:"501 · best of 11 legs",closes:24,open:false },
  { id:"f6",name:"Northern Europe Open",circuit:"European Series · Open",tier:"FEATURED",week:31,country:"NLD",city:"Rotterdam",venue:"Rotterdam Exhibition Centre",image:floorImage,status:"Entries open",cost:9800,fee:4200,travel:2900,stay:2700,sponsor:1800,prize:180000,field:"47 / 80",eligible:"Eligible",summary:"A cross-border ranking event with sponsor travel support already applied.",level:"Featured",entered:false,phase:"European series",format:"501 · best of 11 legs",closes:27,open:true },
  { id:"f7",name:"World Matchplay Qualifier",circuit:"Pro Circuit · Qualifier",tier:"MAJOR",week:36,country:"GBR",city:"Blackpool",venue:"Winter Gardens",image:majorImage,status:"Not eligible",cost:16400,fee:9000,travel:2400,stay:5000,sponsor:0,prize:1200000,field:"32 / 48",eligible:"Qualification required",summary:"A demanding professional qualifier with a route into one of the season’s marquee events.",level:"Major",entered:false,phase:"Major season",format:"501 · best of 15 legs",closes:32,open:false },
  { id:"f8",name:"World Championship",circuit:"World Championship · PDC",tier:"WORLD",week:49,country:"GBR",city:"London",venue:"Alexandra Palace",image:arenaImage,status:"Not eligible",cost:18500,fee:12000,travel:3500,stay:12000,sponsor:9000,prize:5000000,field:"84 / 96",eligible:"Qualification route required",summary:"The season’s defining stage. Qualifiers and the world’s leading players compete for the Sid Waddell Trophy.",level:"World Championship",entered:false,phase:"World Championship",format:"501 · best of 5 sets",closes:45,open:false },
];
const countryName: Record<string,string> = { GBR:"United Kingdom", BEL:"Belgium", NLD:"Netherlands" };
const cash = (pence:number) => `£${(pence / 100).toLocaleString("en-GB",{minimumFractionDigits:Number.isInteger(pence/100)?0:2,maximumFractionDigits:2})}`;
const phases = [
  { name:"Club & local", from:1, to:8, hue:"red" }, { name:"County & regional", from:9, to:16, hue:"blue" },
  { name:"National amateur", from:17, to:27, hue:"gold" }, { name:"Challenger", from:28, to:34, hue:"red" },
  { name:"European / Pro", from:35, to:41, hue:"blue" }, { name:"Major season", from:42, to:48, hue:"gold" },
  { name:"Worlds", from:49, to:52, hue:"red" },
];

export function Redesign() {
  const [view,setView] = useState<"Timeline"|"Season"|"My Entries">("Timeline");
  const [selectedId,setSelectedId] = useState("f2");
  const [circuit,setCircuit] = useState("All circuits");
  const [tier,setTier] = useState("All levels");
  const [status,setStatus] = useState("All statuses");
  const [host,setHost] = useState("All countries");
  const [groupDate,setGroupDate] = useState(false);
  const [open,setOpen] = useState<Record<string,boolean>>({ GBR:true, BEL:true, NLD:true });
  const [entered,setEntered] = useState<string[]>(["f3"]);
  const [message,setMessage] = useState("");
  const [week,setWeek] = useState(18);
  const [season,setSeason] = useState("Season 2");
  const [seasonRail,setSeasonRail] = useState(false);
  const visible = useMemo(() => fixtures.filter(e =>
    season==="Season 2"
    && (circuit==="All circuits"||e.circuit.toLowerCase().includes(circuit.toLowerCase()))
    && (tier==="All levels"||e.level===tier)
    && (host==="All countries"||countryName[e.country]===host)
    && (view!=="My Entries"||entered.includes(e.id))
    && (status==="All statuses"||(status==="Open now"&&(e.open&&!entered.includes(e.id)))||(status==="Entered"&&entered.includes(e.id)))
    && (view!=="Timeline"||e.week>=week-2&&e.week<=Math.min(52,week+8))
  ),[circuit,tier,host,view,entered,status,week,season]);
  const selected = visible.find(e=>e.id===selectedId) ?? visible[0];
  const grouped = groupDate
    ? [...new Set(visible.map(e=>e.week))].sort((a,b)=>a-b).map(n=>({key:`W${n}`,label:`Week ${String(n).padStart(2,"0")}`,events:visible.filter(e=>e.week===n)}))
    : [...new Set(visible.map(e=>e.country))].map(code=>({key:code,label:countryName[code]??code,events:visible.filter(e=>e.country===code)}));
  const clear = () => { setCircuit("All circuits");setTier("All levels");setStatus("All statuses");setHost("All countries");setMessage(""); };
  const enter = (fixture:Fixture) => {
    if (!entered.includes(fixture.id)) setEntered(current=>[...current,fixture.id]);
    setMessage(`Preview only · ${fixture.name} marked as entered locally. Nothing is saved or submitted.`);
  };
  const eventAction = (e:Fixture) => entered.includes(e.id)?"Entry confirmed":e.eligible!=="Eligible"?"View pathway":`Enter · ${cash(e.cost)}`;

  return <main className="ccx" data-page="calendar-redesign">
    <div className="ccx-shell">
      <div className="ccx-topline"><div className="ccx-brand"><span className="ccx-mark"><i/><i/><i/></span><span>TKDL <b>CAREER</b></span></div><span className="ccx-context">PLAYER CAREER <i>/</i> SEASON PLANNER</span><span className="ccx-preview">DESIGN PREVIEW · SAMPLE SAVE</span></div>
      <header className="ccx-hero">
        <div className="ccx-hero-shade"/>
        <div className="ccx-hero-copy">
          <span className="ccx-eyebrow"><span className="ccx-live-dot"/> SEASON 02 / THE AMATEUR CAMPAIGN</span>
          <h1>Calendar <em>&amp;</em><br/>Planning</h1>
          <p>From Friday-night 501 to the Alexandra Palace stage. Build a route through club, county, amateur and pro darts—one result at a time.</p>
          <div className="ccx-hero-meta"><span><CalendarDays size={14}/> SEASON 2</span><span><Clock3 size={14}/> WEEK 18 OF 52</span><span className="ccx-season-chip">AMATEUR PATHWAY</span></div>
        </div>
        <div className="ccx-hero-side">
          <div className="ccx-balance"><div className="ccx-balance-icon"><CircleDollarSign size={18}/></div><small>CAREER BALANCE</small><strong>£308<sup>.40</sup></strong><span>Available to plan with</span></div>
          <div className="ccx-stage"><div className="ccx-stage-top"><span>SEASON PROGRESSION</span><b>18<small> / 52</small></b></div><div className="ccx-season-meter"><i/></div><div className="ccx-stage-foot"><span>CLUB → COUNTY</span><span>35%</span></div></div>
        </div>
        <div className="ccx-hero-ornament" aria-hidden="true"><span className="ccx-ring ccx-ring-a"/><span className="ccx-ring ccx-ring-b"/><span className="ccx-ring ccx-ring-c"/><span className="ccx-board-center"/><span className="ccx-board-wire ccx-board-wire-a"/><span className="ccx-board-wire ccx-board-wire-b"/></div>
        <div className="ccx-hero-ribbon"><span>ON THE ROAD</span><i/><b>NOTTINGHAM · EAST MIDLANDS</b></div>
      </header>

      <section className="ccx-planner">
        <div className="ccx-planner-head">
          <div className="ccx-planner-title"><span className="ccx-planner-icon"><SlidersHorizontal size={17}/></span><span><b>Tour planner</b><small>Scan the campaign your way</small></span></div>
          <nav className="ccx-tabs" aria-label="Calendar view">{(["Timeline","Season","My Entries"] as const).map(item=><button key={item} aria-pressed={view===item} onClick={()=>setView(item)}>{item==="Timeline"&&<Clock3 size={14}/>} {item==="Season"&&<CalendarDays size={14}/>} {item==="My Entries"&&<Ticket size={14}/>}<span>{item}</span></button>)}</nav>
          <label className="ccx-season-select"><small>SEASON</small><select value={season} onChange={e=>setSeason(e.target.value)}><option>Season 2</option><option>Season 1</option></select><ChevronDown size={13}/></label>
        </div>
        <div className="ccx-filter-area">
          <div className="ccx-filter-caption"><span>REFINE YOUR ROUTE</span><button onClick={clear}>Reset filters <ArrowRight size={12}/></button></div>
          <div className="ccx-filter-grid">
            <label><small>CIRCUIT</small><select value={circuit} onChange={e=>setCircuit(e.target.value)}>{["All circuits","Grassroots","County","Regional","National Amateur","Vault · optional","Q-School","Challenger","European Series","Pro Circuit","WDF","Major","World Championship"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={13}/></label>
            <label><small>EVENT LEVEL</small><select value={tier} onChange={e=>setTier(e.target.value)}>{["All levels","Local","Standard","Featured","Televised","Major","World Championship"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={13}/></label>
            <label><small>ENTRY STATUS</small><select value={status} onChange={e=>setStatus(e.target.value)}>{["All statuses","Open now","Entered"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={13}/></label>
            <label><small>HOST COUNTRY</small><select value={host} onChange={e=>setHost(e.target.value)}>{["All countries","United Kingdom","Belgium","Netherlands"].map(x=><option key={x}>{x}</option>)}</select><ChevronDown size={13}/></label>
          </div>
        </div>
        {message&&<div className="ccx-feedback" role="status"><Check size={14}/>{message}</div>}
      </section>

      {(view==="Season"||seasonRail)&&<section className="ccx-season-rail">
        <div className="ccx-rail-heading"><div><span className="ccx-kicker">52-WEEK CAMPAIGN</span><h2>Season rhythm</h2></div><button onClick={()=>{setSeasonRail(false);if(view==="Season")setView("Timeline");}}>Hide season map <ChevronDown size={14}/></button></div>
        <div className="ccx-phases">{phases.map(p=><div key={p.name} className={`ccx-phase ccx-phase--${p.hue}`} style={{flexGrow:p.to-p.from+1}}><b>{p.name}</b><small>W{p.from}—{p.to}</small></div>)}</div>
        <div className="ccx-week-dots" aria-label="52 week season timeline">{Array.from({length:52},(_,i)=><i key={i} className={`${[18,19,20,23,28,31,36,49].includes(i+1)?"event":""} ${i+1===18?"current":""}`} title={`Week ${i+1}`}/>)}</div>
        <div className="ccx-path-notes"><span><i className="now"/> CURRENT · W18</span><span><i className="fixture"/> SCHEDULED EVENT</span><span className="ccx-vault-note"><i/> VAULT SERIES · OPTIONAL INVITATIONAL WINDOW</span></div>
      </section>}
      {view!=="Season"&&!seasonRail&&<button className="ccx-map-toggle" onClick={()=>setSeasonRail(true)}><CalendarDays size={13}/> Open the 52-week season map <ArrowRight size={13}/></button>}

      <div className="ccx-content">
        <section className="ccx-agenda">
          <header className="ccx-agenda-head"><div className="ccx-agenda-title"><span className="ccx-kicker">{view==="My Entries"?"YOUR COMMITMENTS":view==="Season"?"THE FULL CAMPAIGN":"NEXT ON THE TOUR"}</span><h2>{view==="My Entries"?"My Entries":view==="Season"?"Season events":"Upcoming events"}<span>{String(visible.length).padStart(2,"0")}</span></h2></div>
            <div className="ccx-agenda-tools"><div className="ccx-group-toggle"><button className={!groupDate?"active":""} onClick={()=>setGroupDate(false)}>By country</button><button className={groupDate?"active":""} onClick={()=>setGroupDate(true)}>By date</button></div>
              {view==="Timeline"&&<div className="ccx-week-nav"><button aria-label="Previous weeks" disabled={week<=1} onClick={()=>setWeek(Math.max(1,week-2))}><ChevronLeft size={15}/></button><button onClick={()=>setWeek(18)}>Today</button><button aria-label="Next weeks" onClick={()=>setWeek(Math.min(52,week+2))}><ChevronRight size={15}/></button></div>}
            </div>
          </header>
          <div className="ccx-window"><span><Clock3 size={13}/>{view==="Timeline"?`WEEKS ${Math.max(1,week-2)}—${Math.min(52,week+8)}`:"SEASON 2 · FULL FIXTURE LIST"}</span><i/> <span>{visible.length} EVENTS IN VIEW</span><span className="ccx-window-right"><ArrowDownUp size={12}/> WEEK ORDER</span></div>
          <div className="ccx-agenda-scroll">
            {visible.length===0?<div className="ccx-empty"><span><Trophy size={24}/></span><b>No fixtures match this view</b><p>Try another circuit, entry state or destination.</p><button onClick={clear}>Reset filters</button></div>:grouped.map(group=>{
              const isExpanded=Object.prototype.hasOwnProperty.call(open,group.key)?!!open[group.key]:groupDate||!!open[group.key];
              return <section className="ccx-country" key={group.key}>
                <button className="ccx-country-head" aria-expanded={isExpanded} onClick={()=>setOpen(old=>({...old,[group.key]:!old[group.key]}))}>
                  <span className="ccx-country-mark">{groupDate?"WK":group.key}</span><b>{group.label}</b>{!groupDate&&group.key==="GBR"&&<small className="ccx-home">HOME SWING</small>}<i/>
                  <span className="ccx-group-meta">{group.events.length} event{group.events.length===1?"":"s"}<span> · next W{group.events[0]?.week}</span></span><ChevronDown size={15} className="ccx-group-chevron"/>
                </button>
                {isExpanded&&group.events.map((e,index)=>{
                  const didEnter=entered.includes(e.id);
                  const openEntry=e.open&&!didEnter&&e.eligible==="Eligible";
                  return <article className={`ccx-event ${selected?.id===e.id?"is-selected":""}`} key={e.id}>
                    <button className="ccx-event-select" onClick={()=>setSelectedId(e.id)} aria-pressed={selected?.id===e.id}>
                      <span className="ccx-date"><small>WEEK</small><b>{String(e.week).padStart(2,"0")}</b><i>{index===0?"SAT":"SAT"}</i></span>
                      <span className="ccx-venue-photo"><img src={e.image} alt=""/><i/></span>
                      <span className="ccx-event-name"><b>{e.name}</b><small>{e.circuit} <i/> {e.city}, {e.country}</small></span>
                      <span className={`ccx-status ${didEnter?"is-entered":openEntry?"is-open":e.eligible!=="Eligible"?"is-gated":"is-neutral"}`}><i/>{didEnter?"Entered":openEntry?e.status:e.eligible!=="Eligible"?e.eligible:e.status}</span>
                      <span className="ccx-event-window">Wk {e.week} <small>· Sat</small></span><ChevronRight size={16} className="ccx-event-arrow"/>
                    </button>
                    <button className={`ccx-row-action ${didEnter?"is-done":""}`} disabled={didEnter||e.eligible!=="Eligible"} onClick={()=>enter(e)}>{didEnter?<><Check size={13}/> Entered</>:e.eligible!=="Eligible"?"Can't enter":<>Enter · {cash(e.cost)}</>}</button>
                  </article>;
                })}
              </section>;
            })}
          </div>
          <footer className="ccx-agenda-foot"><span>Showing {visible.length} fixture{visible.length===1?"":"s"} · source-style preview data</span><div><button disabled={week<=3} onClick={()=>{setView("Timeline");setWeek(Math.max(1,week-8));}}><ArrowLeft size={13}/> Earlier window</button><span>W{Math.max(1,week-2)}—W{Math.min(52,week+8)}</span><button disabled={week>=52} onClick={()=>{setView("Timeline");setWeek(Math.min(52,week+8));}}>Later window <ArrowRight size={13}/></button></div></footer>
        </section>

        {selected?<aside className="ccx-dossier">
          <div className="ccx-dossier-top"><span className="ccx-kicker">EVENT DOSSIER</span><span className="ccx-dossier-tier">{selected.tier==="WORLD"?"WORLD CHAMPIONSHIP":selected.level.toUpperCase()}</span></div>
          <div className="ccx-dossier-image"><img src={selected.image} alt={`${selected.venue} venue atmosphere`}/><div className="ccx-image-wash"/><div className="ccx-dossier-stamp"><Trophy size={13}/><span>SEASON 02<small>WEEK {String(selected.week).padStart(2,"0")}</small></span></div><span className="ccx-photo-caption">{selected.city.toUpperCase()} · {selected.country}</span></div>
          <div className="ccx-dossier-title"><span className="ccx-dossier-index">0{fixtures.findIndex(f=>f.id===selected.id)+1}</span><div><span className="ccx-kicker">{selected.circuit}</span><h3>{selected.name}</h3></div></div>
          <p className="ccx-summary">{selected.summary}</p>
          <div className="ccx-dossier-status"><span className={`ccx-status ${entered.includes(selected.id)?"is-entered":selected.open?"is-open":"is-gated"}`}><i/>{entered.includes(selected.id)?"Entry confirmed":selected.status}</span><small>{selected.eligible==="Eligible"?"Eligibility checked":selected.eligible}</small></div>
          <div className="ccx-detail-facts">
            <div><small><CalendarDays size={12}/> EVENT WINDOW</small><b>Season 2 · Week {selected.week}</b></div>
            <div><small><MapPin size={12}/> VENUE · {selected.city}</small><b>{selected.venue}</b></div>
            <div><small><Trophy size={12}/> FIELD POSITION</small><b>{selected.field}<em> entrants</em></b></div>
            <div><small><Ticket size={12}/> ENTRY WINDOW</small><b>Weeks {Math.max(1,selected.closes-4)}–{selected.closes}</b></div>
          </div>
          {selected.tier==="WORLD"&&<div className="ccx-world-callout"><Trophy size={16}/><span><b>World Championship pathway</b><small>Qualification route required · no direct entry at this career stage</small></span></div>}
          <div className="ccx-format"><div className="ccx-format-number">501</div><div><small>TOURNAMENT FORMAT</small><b>{selected.format}</b><span>Steel-tip · {selected.tier==="WORLD"?"Set play":"Leg play"}</span></div></div>
          <section className="ccx-cost">
            <div className="ccx-cost-head"><span><CircleDollarSign size={15}/> COST &amp; TRAVEL OUTLOOK</span><small>ESTIMATE</small></div>
            <div className="ccx-cost-total"><span>Estimated player cost</span><b>{cash(selected.cost)}</b></div>
            <div className="ccx-cost-lines"><span>Entry fee</span><b>{cash(selected.fee)}</b><span>Travel estimate</span><b>{cash(selected.travel)}</b><span>Accommodation</span><b>{cash(selected.stay)}</b><span>Sponsor support</span><b className="ccx-sponsored">−{cash(selected.sponsor)}</b></div>
            <div className="ccx-prize"><span>WINNER’S PRIZE</span><b>{cash(selected.prize)}</b></div>
          </section>
          <div className="ccx-detail-actions"><button className="ccx-primary-action" disabled={selected.eligible!=="Eligible"||entered.includes(selected.id)} onClick={()=>enter(selected)}><Ticket size={15}/>{eventAction(selected)}</button><button className="ccx-secondary-action" onClick={()=>setMessage(`Preview only · ${selected.venue} event information selected. No navigation or data was saved.`)}><MapPin size={14}/> Full event details</button></div>
          <div className="ccx-dossier-foot"><span>ENTRY STATUS &amp; COSTS ARE SAVE-SPECIFIC</span><i/></div>
        </aside>:<aside className="ccx-dossier ccx-dossier-empty"><Trophy size={27}/><b>Choose a stop on the tour</b><p>Event entry, eligibility and estimated travel costs appear here.</p></aside>}
      </div>
      <footer className="ccx-page-note"><span>CAREER PLANNER</span><i/><span>Routes widen with results—from club and county to amateur, Q-School, WDF/PDC qualification, Challenger and majors.</span><span className="ccx-note-right">VAULT SERIES IS OPTIONAL · HEADLINE EVENTS HAVE ROOM TO BREATHE</span></footer>
    </div>
  </main>;
}
