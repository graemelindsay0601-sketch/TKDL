import { useState } from "react";
import { ArrowUpRight, Camera, Check, ChevronRight, CircleDot, Crown, MonitorPlay, Trophy, Video } from "lucide-react";
import "./_group.css";
import "./Redesign.css";

const players = [
  { name:"Jan de Vries", country:"NLD", played:3, won:3, lost:0, legs:"9–4", points:6 },
  { name:"Long Chen", country:"CHN", played:3, won:2, lost:1, legs:"8–5", points:4, you:true },
  { name:"Mike Rowe", country:"USA", played:3, won:2, lost:1, legs:"7–5", points:4 },
  { name:"Tom Byrne", country:"IRL", played:3, won:1, lost:2, legs:"6–7", points:2 },
  { name:"Lukas Weber", country:"DEU", played:3, won:1, lost:2, legs:"5–7", points:2 },
  { name:"Aitor Ruiz", country:"ESP", played:3, won:1, lost:2, legs:"5–8", points:2 },
  { name:"Oliver Grant", country:"ENG", played:3, won:1, lost:2, legs:"4–8", points:2 },
  { name:"Mats Lind", country:"SWE", played:3, won:1, lost:2, legs:"4–9", points:2 },
];
const fixtures = [
  { week:10, name:"Lukas Weber", nation:"DEU", score:"3—1", state:"WIN" },
  { week:11, name:"Aitor Ruiz", nation:"ESP", score:"0—3", state:"FORFEIT" },
  { week:12, name:"Oliver Grant", nation:"ENG", score:"3—2", state:"SIM" },
  { week:13, name:"Mike Rowe", nation:"USA", score:"", state:"THIS WEEK" },
  { week:14, name:"Jan de Vries", nation:"NLD", score:"", state:"UP NEXT" },
  { week:15, name:"Mats Lind", nation:"SWE", score:"", state:"" },
  { week:16, name:"Tom Byrne", nation:"IRL", score:"", state:"" },
];
const nightOptions = [{ day:2, label:"TUE", full:"Tuesday" },{ day:4, label:"THU", full:"Thursday" },{ day:6, label:"SAT", full:"Saturday" }];

export function Redesign() {
  const [night,setNight] = useState(4);
  const [booked,setBooked] = useState(false);
  const [result,setResult] = useState<"scorer"|"sim"|"">("");
  const chosen = nightOptions.find(n=>n.day===night)!;
  return <main className="webcam-page webcam-redesign"><div className="webcam-wrap">
    <div className="webcam-masthead"><span><b>TKDL</b> / CAREER / INTERNATIONAL WEBCAM DIVISION</span><span>SEASON 02 <i>·</i> WEEK 13</span></div>
    <header className="wl-broadcast">
      <div className="wl-hero-copy">
        <div className="wl-live-line"><span><i/> MATCH NIGHT DESK</span><b>GRASSROOTS CIRCUIT <em>·</em> DIVISION 03</b></div>
        <p className="wl-eyebrow">Seven weeks. Eight boards. One place to climb.</p>
        <h1>Division<br/><em>One.</em></h1>
        <p className="wl-intro">A real season, played from your own board. One fixture each week, first to three legs. Win two points. Finish in the top two and move up.</p>
        <div className="wl-hero-rule"><span><CircleDot/> TWO UP</span><i/><span className="down"><CircleDot/> TWO DOWN</span><b>·</b><small>LEAGUE NIGHT, WHEREVER YOU PLAY</small></div>
        <div className="wl-record">
          <div><small>YOUR PLACE</small><b>02<sup>ND</sup></b></div><div><small>ROUND</small><b>04<span> / 07</span></b></div>
          <div><small>POINTS</small><b>04</b></div><div><small>SEASON WINDOW</small><b>10—16</b></div>
        </div>
      </div>
      <div className="wl-board-scene" aria-label="Illustrated dartboard and match-night broadcast graphic">
        <div className="wl-scene-stamp"><span>TKDL</span><b>CAM<br/>LEAGUE</b><small>SEASON 02</small></div>
        <svg className="wl-dartboard" viewBox="0 0 400 400" role="img" aria-label="Decorative dartboard illustration">
          <defs><radialGradient id="boardWood"><stop stopColor="#28231b"/><stop offset=".82" stopColor="#151515"/><stop offset="1" stopColor="#08090a"/></radialGradient><linearGradient id="rim"><stop stopColor="#d0ad5d"/><stop offset=".5" stopColor="#6d542c"/><stop offset="1" stopColor="#e3c67a"/></linearGradient></defs>
          <circle cx="200" cy="200" r="186" fill="#050607" stroke="url(#rim)" strokeWidth="3"/>
          <circle cx="200" cy="200" r="171" fill="url(#boardWood)" stroke="#9c2634" strokeWidth="2"/>
          <circle cx="200" cy="200" r="153" fill="none" stroke="#b7a377" strokeWidth="1"/>
          <circle cx="200" cy="200" r="103" fill="none" stroke="#a78b52" strokeWidth="1"/>
          <circle cx="200" cy="200" r="91" fill="none" stroke="#b12b3a" strokeWidth="9"/>
          <circle cx="200" cy="200" r="59" fill="none" stroke="#9e844d" strokeWidth="1"/>
          <circle cx="200" cy="200" r="48" fill="none" stroke="#b12b3a" strokeWidth="8"/>
          <circle cx="200" cy="200" r="15" fill="#187453" stroke="#d1b25f" strokeWidth="2"/>
          <circle cx="200" cy="200" r="5" fill="#9c2634"/>
          {Array.from({length:20},(_,i)=><line key={i} x1="200" y1="16" x2="200" y2="185" transform={`rotate(${i*18} 200 200)`} stroke="#8f815e" strokeWidth=".8" opacity=".8"/>)}
          <path d="M271 72L211 192" stroke="#e6d9b6" strokeWidth="5"/><path d="M276 62l10 4-10 18-10-4z" fill="#b82e3d"/><circle cx="211" cy="192" r="7" fill="#d8b75f"/>
        </svg>
        <div className="wl-board-shade"/>
        <div className="wl-graphic-corner"><span>WEEK</span><b>13</b><i>OF 16</i></div>
        <div className="wl-scene-lower"><span><i/> LIVE SEASON</span><b>YOUR BOARD.<br/>YOUR FIXTURE.</b><small>FIRST TO THREE · TWO POINTS A WIN</small></div>
        <div className="wl-scene-signal"><Camera size={13}/> CAMERA MATCH · HOME SETUP</div>
      </div>
    </header>

    <section className="wl-fixture-ribbon">
      <div className="wl-ribbon-mark"><Video size={17}/><span>THIS<br/>WEEK</span></div>
      <div className="wl-vs"><div><small>YOU · 2ND PLACE</small><b>Long Chen</b><span>CHN <i>·</i> 4 PTS</span></div><strong>VS</strong><div><small>OPPONENT · 3RD PLACE</small><b>Mike Rowe</b><span>USA <i>·</i> AVG 54.8</span></div></div>
      <div className="wl-first-to"><small>FORMAT</small><b>FIRST TO <i>3</i></b><span>2 POINTS FOR A WIN</span></div>
      <div className="wl-round-tag"><b>04</b><small>ROUND<br/>OF 07</small></div>
    </section>

    <section className="wl-match-planner">
      <div className="wl-planner-copy"><div className="wl-section-index"><span>01</span> FIXTURE BOOKING <i/></div>
        <h2>Choose your<br/><em>match night.</em></h2>
        <p>Book a free night this week. A fixture not played by the end of the week is forfeited 3–0.</p>
        <div className="wl-night-options" role="radiogroup" aria-label="Choose a free match night">{nightOptions.map(item=><button type="button" key={item.day} aria-checked={night===item.day} role="radio" onClick={()=>{setNight(item.day);setBooked(false);setResult("");}}>
          <small>{item.label}</small><b>{item.full}</b>{night===item.day&&<Check size={13}/>}</button>)}</div>
        <button className="wl-book-cta" type="button" onClick={()=>setBooked(true)}>{booked?<><Check size={16}/> BOOKED FOR {chosen.label}</>:<>BOOK IT FOR {chosen.label}<ArrowUpRight size={16}/></>}</button>
        {booked&&<div className="wl-play-actions"><button type="button" onClick={()=>setResult("scorer")}><MonitorPlay size={15}/> PLAY ON CAMERA</button><button type="button" onClick={()=>setResult("sim")}>QUICK-SIM IT</button></div>}
        {result&&<div className="wl-action-message" role="status">{result==="scorer"?"Scorer selected · play this fixture on camera.":"Quick-sim selected · result added to the season table."}</div>}
      </div>
      <div className="wl-planner-art">
        <div className="wl-night-card"><span>FIXTURE 04 <i>·</i> WEEK 13</span><b>THURSDAY<br/><em>IS YOURS.</em></b><div><span>FREE NIGHT</span><span>WEEK CLOSES SUNDAY</span></div></div>
        <svg viewBox="0 0 360 190" aria-hidden="true"><path d="M25 140 C90 40 160 168 228 84 S298 39 340 55" fill="none" stroke="#a72838" strokeWidth="2"/><path d="M25 140 C90 40 160 168 228 84 S298 39 340 55" fill="none" stroke="#d9bd6b" strokeWidth="1" strokeDasharray="2 7"/><circle cx="25" cy="140" r="5" fill="#d9bd6b"/><circle cx="340" cy="55" r="6" fill="#e34b54"/></svg>
        <div className="wl-art-coordinates"><span>BOARD LINK ESTABLISHED</span><span>00:47:18 UTC</span></div>
      </div>
    </section>

    <section className="wl-season-grid">
      <div className="wl-table-panel">
        <div className="wl-panel-head"><div><span className="wl-section-index"><span>02</span> THE DIVISION <i/></span><h2>Standings</h2></div><div className="wl-zone-legend"><span><i/> PROMOTION</span><span><i/> RELEGATION</span></div></div>
        <div className="wl-table-wrap"><table className="wl-table"><thead><tr><th>#</th><th>PLAYER</th><th>P</th><th>W</th><th>L</th><th>LEGS</th><th>PTS</th></tr></thead><tbody>
          {players.map((p,i)=><tr key={p.name} data-zone={i<2?"up":i>5?"down":"safe"} className={p.you?"is-you":""}><td><span className="wl-rank">{String(i+1).padStart(2,"0")}</span></td><td><b>{p.you?"You":p.name}</b><small>{p.country}</small>{i===0&&<Crown className="wl-crown" size={12}/>}</td><td>{p.played}</td><td>{p.won}</td><td>{p.lost}</td><td>{p.legs}</td><td><strong>{p.points}</strong></td></tr>)}
        </tbody></table></div>
        <div className="wl-table-foot"><span><Trophy size={13}/> TOP THREE PRIZES</span><b>£120 <i>/</i> £60 <i>/</i> £36</b><small>PER LEAGUE SEASON</small></div>
      </div>
      <aside className="wl-fixture-panel">
        <div className="wl-panel-head"><div><span className="wl-section-index"><span>03</span> YOUR SEASON <i/></span><h2>Fixture ledger</h2></div><span className="wl-ledger-season">S02 <ChevronRight size={13}/> W10—16</span></div>
        <ol className="wl-fixture-list">{fixtures.map((f,i)=><li key={f.week} className={f.week===13?"is-current":""}>
          <span className="wl-fixture-line"><i/></span><span className="wl-week">W{String(f.week).padStart(2,"0")}</span>
          <span className="wl-fixture-player"><b>{f.name}</b><small>{f.nation}</small></span>
          <span className={`wl-fixture-status ${f.state==="FORFEIT"?"is-forfeit":""}`}>{f.state==="WIN"||f.state==="FORFEIT"||f.state==="SIM"?f.state:f.state||"FIXTURE"}</span>
          <strong className="wl-fixture-score">{f.week===13&&booked?chosen.label.slice(0,3):f.score}</strong>
        </li>)}</ol>
        <div className="wl-past-league"><span><Trophy size={14}/></span><div><small>PREVIOUS LEAGUE · SEASON 01</small><b>Division Two</b></div><strong>2ND</strong><em>£40 · PROMOTED</em></div>
      </aside>
    </section>
    <footer className="wl-page-foot"><span><i/> TKDL WEBCAM LEAGUE</span><b>REAL SEASON STRUCTURE <i>·</i> YOUR BOARD AT HOME</b><span>DIVISION 03 / S02</span></footer>
  </div></main>;
}
