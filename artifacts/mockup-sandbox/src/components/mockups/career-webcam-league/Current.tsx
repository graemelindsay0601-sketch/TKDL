import { useState } from "react";
import { MonitorPlay, Trophy, Video } from "lucide-react";
import "./_group.css";
import "./Current.css";

const standings = [
  { name:"Jan de Vries", country:"NLD", p:3, w:3, l:0, legs:"9–4", pts:6 },
  { name:"Long Chen", country:"CHN", p:3, w:2, l:1, legs:"8–5", pts:4, you:true },
  { name:"Mike Rowe", country:"USA", p:3, w:2, l:1, legs:"7–5", pts:4 },
  { name:"Tom Byrne", country:"IRL", p:3, w:1, l:2, legs:"6–7", pts:2 },
  { name:"Lukas Weber", country:"DEU", p:3, w:1, l:2, legs:"5–7", pts:2 },
  { name:"Aitor Ruiz", country:"ESP", p:3, w:1, l:2, legs:"5–8", pts:2 },
  { name:"Oliver Grant", country:"ENG", p:3, w:1, l:2, legs:"4–8", pts:2 },
  { name:"Mats Lind", country:"SWE", p:3, w:1, l:2, legs:"4–9", pts:2 },
];
const fixtures = [
  { week:10, name:"Lukas Weber", country:"DEU", result:"Won 3–1" },
  { week:11, name:"Aitor Ruiz", country:"ESP", result:"Forfeit 0–3" },
  { week:12, name:"Oliver Grant", country:"ENG", result:"Won 3–2 · quick-sim" },
  { week:13, name:"Mike Rowe", country:"USA", result:"" },
  { week:14, name:"Jan de Vries", country:"NLD", result:"" },
  { week:15, name:"Mats Lind", country:"SWE", result:"" },
  { week:16, name:"Tom Byrne", country:"IRL", result:"" },
];
const nights = [{day:2,label:"Tue"},{day:4,label:"Thu"},{day:6,label:"Sat"}];
const dayName = (n:number) => ({2:"Tuesday",4:"Thursday",6:"Saturday"}[n] ?? "Thursday");

/** Faithful static extraction of CamLeaguePage's active-league rendered branch.
 * API, router and shared career components are replaced with this fixture view. */
export function Current() {
  const [night,setNight] = useState(4);
  const [booked,setBooked] = useState(false);
  const [matchMode,setMatchMode] = useState<"scorer"|"sim"|"">("");
  return <main className="webcam-page webcam-current"><div className="webcam-wrap">
    <div className="webcam-masthead"><span><b>TKDL</b> / Career / Webcam league</span><span>Season 02 <i>·</i> Week 13</span></div>
    <section className="wc-hero">
      <div className="wc-hero-stage"><div className="wc-hero-glow"/><div className="wc-hero-mark">TK<span>•</span>DL</div>
        <div className="wc-hero-copy"><p className="wc-kicker"><i/> Webcam league · played from your own board</p><h1>Division One</h1>
          <p className="wc-subtitle">Eight players from around the world, a match a week for seven weeks, first to three legs. Two points a win; the top two go up, the bottom two go down.</p>
        </div>
      </div>
      <dl className="wc-stats"><div className="is-gold"><dt>Position</dt><dd>2nd</dd></div><div><dt>Round</dt><dd>4 of 7</dd></div><div><dt>Points</dt><dd>4</dd></div><div><dt>Weeks</dt><dd>10–16</dd></div></dl>
    </section>
    <section className="wc-section">
      <div className="wc-section-head"><h2><Video/> This week's match</h2><span className="wc-status"><i/> FIXTURE OPEN</span></div>
      <div className="wc-match">
        <div className="wc-opponent"><span className="wc-opponent-number">04</span><div><small>YOUR WEEK 13 OPPONENT</small><h3>Mike Rowe <em>USA</em></h3><p>Average around <b>54.8</b> · First to three legs</p></div></div>
        <div className="wc-booking"><p>Book a night to play it. A match you don't play by the end of the week is forfeited 3–0.</p>
          <div className="wc-nights" role="radiogroup" aria-label="Night">{nights.map(({day,label})=><button key={day} type="button" role="radio" aria-checked={night===day} onClick={()=>{setNight(day);setBooked(false);setMatchMode("");}}>{label}</button>)}</div>
          <button className="wc-book-btn" type="button" onClick={()=>setBooked(true)}>{booked?`Booked for ${dayName(night)}`:`Book it for ${dayName(night)}`}</button>
          {booked&&<div className="wc-match-actions"><button type="button" onClick={()=>setMatchMode("scorer")}><MonitorPlay/> Play on camera</button><button type="button" onClick={()=>setMatchMode("sim")}>Quick-sim it</button></div>}
          {matchMode&&<p className="wc-local-note" role="status">{matchMode==="scorer"?"Scorer preview selected — your match opens on camera.":"Quick-sim preview selected — match result will be recorded."}</p>}
        </div>
      </div>
    </section>
    <section className="wc-section">
      <div className="wc-section-head"><h2><Trophy/> Table</h2><div className="wc-zone-key"><span><i/> PROMOTION</span><span><i/> RELEGATION</span></div></div>
      <div className="wc-table-scroll"><table className="cam-league__table"><thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>L</th><th>Legs</th><th>Pts</th></tr></thead>
        <tbody>{standings.map((r,i)=><tr key={r.name} className={r.you?"is-you":""} data-zone={i<2?"up":i>=6?"down":undefined}>
          <td>{i+1}</td><td>{r.you?<b>You</b>:r.name}<small> {r.country}</small></td><td>{r.p}</td><td>{r.w}</td><td>{r.l}</td><td>{r.legs}</td><td><b>{r.pts}</b></td>
        </tr>)}</tbody></table></div>
      <p className="wc-prize">Prize money: <b>£120 / £60 / £36</b> for the top three.</p>
    </section>
    <section className="wc-section wc-lower">
      <div><div className="wc-section-head"><h2><Video/> Your fixtures</h2><span className="wc-small-label">SEASON 02 · WEEKS 10—16</span></div>
        <ol className="cam-league__fixtures">{fixtures.map(f=><li key={f.week}><span>Wk {f.week} · {f.name} <small>({f.country})</small></span><em>{f.week===13&&booked?`Booked ${night===4?"Thu":night===2?"Tue":"Sat"}`:f.result}</em></li>)}</ol>
      </div>
      <div><div className="wc-section-head"><h2><Trophy/> Past leagues</h2></div>
        <ol className="cam-league__fixtures"><li><span>S1 · Division Two</span><em>2nd · £40 · promoted</em></li></ol>
      </div>
    </section>
  </div></main>;
}
