import { useState } from "react";
import { ArrowUpRight, Car, Check, ChevronRight, Clock3, Compass, Crown, MapPin, Route, Trophy } from "lucide-react";
import "./_group.css";
import "./Redesign.css";

const towns = [
  { name:"Kilmarnock", region:"Ayrshire", miles:20, cost:"£18.50", champion:"Alasdair Boyd", avg:"61.4", route:"A77" },
  { name:"Paisley", region:"Renfrewshire", miles:26, cost:"£22.00", champion:"Darren Cole", avg:"58.8", route:"M77" },
  { name:"Dumfries", region:"Dumfries & Galloway", miles:74, cost:"£34.00", champion:"Neil Murray", avg:"64.1", route:"A76" },
];
const players = [
  { name:"Jamie McLeod", role:"Local", avg:"48.2", stake:"£10", status:"Waiting for a game" },
  { name:"Alasdair Boyd", role:"Town champion", avg:"61.4", stake:"£25", status:"Unlock after a local win" },
];

export function Redesign() {
  const [townIndex,setTownIndex]=useState(0),[night,setNight]=useState("Thursday"),[started,setStarted]=useState(false);
  const town=towns[townIndex];
  return <main className="road-page road-redesign"><div className="road-wrap">
    <div className="road-topline"><span><b>TKDL</b> / Career / Nights Out</span><span>Road notes <i>·</i> week 20</span></div>
    <header className="road-redesign-hero">
      <div className="road-redesign-copy"><div className="road-kicker"><i/> A night out, somewhere new</div><h1>Take it<br/><em>on the road.</em></h1>
        <p>Find a rival town, pick a night and earn your name one local at a time. The champion can wait until you’ve beaten their best.</p>
        <div className="road-redesign-stats"><span><small>ROAD REPUTATION</small><b>Club regular</b></span><span><small>TOWNS CLAIMED</small><b>01 <i>/ 08</i></b></span><span><small>ROAD RECORD</small><b>3–1</b></span></div>
        <div className="road-hero-foot"><span><Compass size={14}/> WEST COAST CLUB CIRCUIT</span><span>AYRSHIRE · SCOTLAND</span></div>
      </div>
      <div className="road-map" aria-label="Route map from Ayr to Kilmarnock">
        <img className="road-map-photo" src="/__mockup/images/road-trip-club.jpg" alt="" />
        <div className="road-map-veil"/>
        <div className="road-map-grid"/>
        <svg viewBox="0 0 540 300" aria-hidden="true">
          <path className="road-route-shadow" d="M58 230 C104 195 119 191 151 158 C187 120 228 131 246 172 C267 219 301 234 340 176 C377 121 389 104 429 83 S472 71 490 55" />
          <path className="road-route-glow" d="M58 230 C104 195 119 191 151 158 C187 120 228 131 246 172 C267 219 301 234 340 176 C377 121 389 104 429 83 S472 71 490 55" />
          <circle cx="246" cy="172" r="5"/><circle cx="340" cy="176" r="4"/>
        </svg>
        <span className="road-map-town home"><i/><b>AYR</b><small>HOME CLUB</small></span>
        <span className="road-map-town destination"><i/><b>{town.name.toUpperCase()}</b><small>{town.miles} MI · {town.route}</small></span>
        <div className="road-map-compass"><Compass size={23}/><span>NORTH</span></div>
        <span className="road-map-caption"><Route size={13}/> YOUR NEXT DRIVE <i>·</i> {town.route}</span>
        <div className="road-map-stamp"><b>AWAY<br/>NIGHT</b><small>NO. 01</small></div>
        <div className="road-map-meta"><span>ON THE A77</span><span>20 MILES FROM HOME</span></div>
      </div>
    </header>
    <div className="road-route-strip">
      <span className="road-route-shield"><b>{town.route}</b><small>ROUTE</small></span>
      <span className="road-route-copy"><b>Ayr <i>to</i> {town.name}</b><small>West coast club circuit · local doors open after work</small></span>
      <span className="road-route-mileage"><Clock3 size={15}/><b>~35 min</b><small>{town.miles} miles</small></span>
      <span className="road-route-tag">YOUR NEXT AWAY NIGHT</span>
    </div>
    <section className="road-planner">
      <div className="road-planner-main">
        <div className="road-section-head"><span className="road-label">01 / Pick your next stop</span><h2 className="road-title">Where to tonight?</h2><p className="road-section-note">Three towns within reach. Each one has a local champion and a different story.</p></div>
        <div className="road-town-list">{towns.map((item,index)=><button key={item.name} type="button" aria-pressed={index===townIndex} onClick={()=>{setTownIndex(index);setStarted(false);}}>
          <span className="road-town-check">{index===townIndex?<Check size={13}/>:<MapPin size={13}/>}</span><span><b>{item.name}</b><small>{item.region} · {item.miles} miles</small></span><strong>{item.cost}</strong><ChevronRight size={14}/>
        </button>)}</div>
        <div className="road-night-picker"><div><span className="road-label">02 / Pick a free night</span><small>Choose a night that fits around your fixtures.</small></div>
          <div>{["Tuesday","Thursday","Saturday"].map(day=><button key={day} type="button" aria-pressed={night===day} onClick={()=>{setNight(day);setStarted(false);}}>{day.slice(0,3)}</button>)}</div>
        </div>
        <div className="road-trip-summary"><span><Car size={17}/><b>{town.name}</b><small>{night} · {town.miles} miles · {town.cost} travel</small></span>
          <button className="road-btn" onClick={()=>setStarted(true)}>{started?<><Check size={14}/> Trip planned</>:<>Plan this trip <ArrowUpRight size={14}/></>}</button>
        </div>
      </div>
      <aside className="road-town-card">
        <div className="road-town-card-top"><span className="road-label">THE ONE TO BEAT</span><span className="road-chip"><Crown size={12}/> Town champion</span></div>
        <div className="road-champion-person"><div className="road-champion-crest"><Crown size={23}/><small>{town.name.slice(0,2).toUpperCase()}</small></div><div><h3>{town.champion}</h3><p>{town.name}'s defending champion. First, earn your shot by beating a local.</p></div></div>
        <div className="road-champion-stat"><span>SEASON AVERAGE</span><b>{town.avg}</b><small>LOCAL CIRCUIT</small></div>
        <div className="road-progress"><span><i/></span><small><b>STEP 1 OF 2</b> · WIN A LOCAL GAME TO OPEN THE CHALLENGE</small></div>
      </aside>
    </section>
    <section className="road-players"><div className="road-section-head"><span className="road-label">03 / The locals</span><h2 className="road-title">Earn your shot.</h2></div>
      <div className="road-player-list">{players.map((player,index)=><article key={player.name} data-locked={index===1}>
        <div className="road-player-number">0{index+1}</div><div className="road-player-avatar">{player.name.split(" ").map(n=>n[0]).join("")}</div><div className="road-player-info"><b>{player.name}{index===1&&<Crown size={13}/>}</b><small>{player.role} · averaging {player.avg}</small></div>
        <span className="road-player-status">{town.name} · {player.status}</span><span className="road-player-stake">From <b>{player.stake}</b></span><button disabled={index===1}>View match <ArrowUpRight size={13}/></button>
      </article>)}</div>
    </section>
    <footer className="road-redesign-foot"><Trophy size={13}/> On the road: 3 wins · 1 loss · +£42.50 · Ayr conquered</footer>
  </div></main>;
}
