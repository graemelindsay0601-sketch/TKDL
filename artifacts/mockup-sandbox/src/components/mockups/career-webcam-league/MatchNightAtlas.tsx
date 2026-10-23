import { useState } from "react";
import { ArrowUpRight, Check, ChevronRight, Crown, Globe2, MonitorPlay, Trophy } from "lucide-react";
import "./_group.css";
import "./MatchNightAtlas.css";

const players = [
  { name: "Jan de Vries", country: "NLD", played: 3, won: 3, lost: 0, legs: "9–4", points: 6 },
  { name: "Long Chen", country: "CHN", played: 3, won: 2, lost: 1, legs: "8–5", points: 4, you: true },
  { name: "Mike Rowe", country: "USA", played: 3, won: 2, lost: 1, legs: "7–5", points: 4 },
  { name: "Tom Byrne", country: "IRL", played: 3, won: 1, lost: 2, legs: "6–7", points: 2 },
  { name: "Lukas Weber", country: "DEU", played: 3, won: 1, lost: 2, legs: "5–7", points: 2 },
  { name: "Aitor Ruiz", country: "ESP", played: 3, won: 1, lost: 2, legs: "5–8", points: 2 },
  { name: "Oliver Grant", country: "ENG", played: 3, won: 1, lost: 2, legs: "4–8", points: 2 },
  { name: "Mats Lind", country: "SWE", played: 3, won: 1, lost: 2, legs: "4–9", points: 2 },
];
const fixtures = [
  { week: 10, name: "Lukas Weber", nation: "DEU", score: "3—1", state: "WIN" },
  { week: 11, name: "Aitor Ruiz", nation: "ESP", score: "0—3", state: "FORFEIT" },
  { week: 12, name: "Oliver Grant", nation: "ENG", score: "3—2", state: "SIM" },
  { week: 13, name: "Mike Rowe", nation: "USA", score: "", state: "THIS WEEK" },
  { week: 14, name: "Jan de Vries", nation: "NLD", score: "", state: "UP NEXT" },
  { week: 15, name: "Mats Lind", nation: "SWE", score: "", state: "" },
  { week: 16, name: "Tom Byrne", nation: "IRL", score: "", state: "" },
];
const nights = [{ day: 2, short: "TUE", name: "Tuesday" }, { day: 4, short: "THU", name: "Thursday" }, { day: 6, short: "SAT", name: "Saturday" }];

export function MatchNightAtlas() {
  const [night, setNight] = useState(4);
  const [booked, setBooked] = useState(false);
  const [result, setResult] = useState<"camera" | "sim" | "">("");
  const chosen = nights.find((item) => item.day === night)!;

  return (
    <main className="webcam-page atlas-page">
      <div className="atlas-wrap">
        <div className="atlas-masthead">
          <span><b>TKDL</b><i>/</i> CAREER <i>/</i> INTERNATIONAL WEBCAM DIVISION</span>
          <span className="atlas-season">SEASON 02 <i>•</i> WEEK 13</span>
        </div>

        <header className="atlas-opening">
          <div className="atlas-opening-top">
            <div className="atlas-kicker"><span className="atlas-live-dot" /> MATCH NIGHT DESK <b>GRASSROOTS CIRCUIT</b><i>DIVISION 03</i></div>
            <div className="atlas-transmission"><Globe2 size={14} /> 8 BOARDS <span>·</span> 7 NATIONS <span>·</span> ONE TABLE</div>
          </div>
          <div className="atlas-opening-grid">
            <div className="atlas-title-block">
              <p className="atlas-overline">THE INTERNATIONAL WEBCAM LEAGUE · SEASON 02</p>
              <h1>Every board<br /><em>has a place.</em></h1>
              <p className="atlas-deck">Seven weeks. Eight home boards. Your next fixture is one throw away from changing the table.</p>
              <div className="atlas-movement" aria-label="Promotion and relegation places">
                <span><i className="rise" /> TWO PROMOTED</span><b>—</b><span><i className="fall" /> TWO RELEGATED</span>
              </div>
            </div>
            <div className="atlas-map" aria-label="Illustrated global league route">
              <div className="atlas-map-grid" />
              <div className="atlas-map-label atlas-map-label--north">NORTH ATLANTIC<br /><small>DIVISION ROUTE 03</small></div>
              <div className="atlas-map-label atlas-map-label--east">UTC +08</div>
              <div className="atlas-compass" aria-hidden="true"><span>N</span><i /><small>104°</small></div>
              <svg viewBox="0 0 580 300" role="img" aria-label="League route connecting home boards across the world">
                <g className="atlas-contours">
                  <path d="M26 95C72 42 129 43 168 73s59 49 108 29 77-44 129-33 90 24 129 4" />
                  <path d="M15 112c57-50 113-51 151-22s63 44 110 26 79-42 129-32 93 22 138 2" />
                  <path d="M27 227c40-33 87-42 127-20s72 39 115 16 78-39 121-21 77 26 133 11" />
                  <path d="M41 246c44-32 83-39 122-18s71 35 113 13 80-37 123-20 78 23 123 10" />
                </g>
                <g className="atlas-map-bearings">
                  <path d="M76 42v214M176 42v214M276 42v214M376 42v214M476 42v214" />
                  <path d="M36 80h500M36 130h500M36 180h500M36 230h500" />
                </g>
                <path className="atlas-route-shadow" d="M75 204 C150 55 235 248 302 151 S414 50 510 94" />
                <path className="atlas-route atlas-route-under" d="M75 204 C150 55 235 248 302 151 S414 50 510 94" />
                <path className="atlas-route-highlight" d="M75 204 C150 55 235 248 302 151 S414 50 510 94" />
                <path className="atlas-route atlas-route-dash" d="M75 204 C150 55 235 248 302 151 S414 50 510 94" />
                <circle className="atlas-range" cx="510" cy="94" r="25" />
                <circle className="atlas-range atlas-range--inner" cx="510" cy="94" r="15" />
                <circle className="atlas-node" cx="75" cy="204" r="7" /><circle className="atlas-node" cx="175" cy="111" r="4" />
                <circle className="atlas-node" cx="302" cy="151" r="6" /><circle className="atlas-node" cx="410" cy="80" r="4" />
                <circle className="atlas-node atlas-node--hot" cx="510" cy="94" r="8" />
                <path className="atlas-point-tick" d="M510 53v12M510 123v12M469 94h12M539 94h12" />
                <text x="56" y="230">USA</text><text x="284" y="177">NLD</text><text x="493" y="124">CHN</text>
              </svg>
              <div className="atlas-board-seal">
                <span>YOUR BOARD</span><b>02<sup>ND</sup></b><small>4 POINTS / 3 PLAYED</small>
              </div>
              <div className="atlas-map-caption"><i /> LIVE SEASON PATH <span>WEEK 13 OF 16</span></div>
            </div>
          </div>
          <div className="atlas-statline">
            <div><small>YOUR PLACE</small><b>02<sup>ND</sup></b></div>
            <div><small>ROUND</small><b>04 <span>/ 07</span></b></div>
            <div><small>POINTS</small><b>04</b></div>
            <div><small>SEASON WINDOW</small><b>10—16</b></div>
            <p>First to three legs <i>·</i> 2 points for a win <i>·</i> played from home</p>
          </div>
        </header>

        <section className="atlas-fixture" aria-label="This week's fixture">
          <div className="atlas-fixture-index"><div className="atlas-week-seal"><span>W</span><b>13</b><i>•</i></div></div>
          <div className="atlas-contestant">
            <small>YOUR BOARD <i>·</i> 2ND PLACE</small><div className="atlas-player-lockup"><span className="atlas-player-crest">LC</span><b>Long Chen</b></div><span>CHN <i>·</i> 4 PTS</span>
          </div>
          <div className="atlas-versus"><span>VS</span></div>
          <div className="atlas-contestant atlas-opponent">
            <small>OPPONENT <i>·</i> 3RD PLACE</small><div className="atlas-player-lockup"><span className="atlas-player-crest atlas-player-crest--opponent">MR</span><b>Mike Rowe</b></div><span>USA <i>·</i> AVG 54.8</span>
          </div>
          <div className="atlas-format"><small>THE FORMAT</small><b>FIRST TO <em>3</em></b><span>2 POINTS FOR A WIN</span></div>
          <div className="atlas-round"><b>04</b><span>ROUND<br />OF 07</span></div>
        </section>

        <section className="atlas-booking" aria-labelledby="atlas-book-title">
          <div className="atlas-book-copy">
            <div className="atlas-section-tag"><span>01</span> CLAIM YOUR FIXTURE <i /></div>
            <h2 id="atlas-book-title">Pick a night.<br /><em>Make it count.</em></h2>
            <p>Book a free night to play this week. Any fixture not played by Sunday is recorded as a 3–0 forfeit.</p>
            <div className="atlas-night-options" role="radiogroup" aria-label="Choose a free match night">
              {nights.map((item) => <button type="button" key={item.day} role="radio" aria-checked={night === item.day} onClick={() => { setNight(item.day); setBooked(false); setResult(""); }}>
                <small>{item.short}</small><b>{item.name}</b>{night === item.day && <Check size={14} aria-hidden="true" />}
              </button>)}
            </div>
            <button className="atlas-book-button" type="button" onClick={() => { setBooked(true); setResult(""); }}>
              {booked ? <><Check size={16} /> BOOKED FOR {chosen.short}</> : <>BOOK IT FOR {chosen.short}<ArrowUpRight size={16} /></>}
            </button>
            {booked && <div className="atlas-next-actions" aria-label="Choose how to play">
              <span>YOUR FIXTURE IS ON THE CARD</span>
              <div><button type="button" onClick={() => setResult("camera")}><MonitorPlay size={15} /> PLAY ON CAMERA</button><button type="button" onClick={() => setResult("sim")}>QUICK-SIM IT</button></div>
            </div>}
            {result && <p className="atlas-action-feedback" role="status">{result === "camera" ? "Scorer selected · play this fixture on camera." : "Quick-sim selected · result added to the season table."}</p>}
          </div>
          <div className="atlas-book-art" aria-hidden="true">
            <div className="atlas-art-meta"><span>FIXTURE 04 / WEEK 13</span><span>BOARD LINK OPEN</span></div>
            <div className="atlas-big-date">THU<span>13</span></div>
            <div className="atlas-art-route">
              <svg viewBox="0 0 420 126"><path d="M5 98 C77 97 76 20 155 38 S257 111 313 44 S377 16 415 25" /><circle cx="5" cy="98" r="4" /><circle cx="155" cy="38" r="4" /><circle cx="313" cy="44" r="4" /><circle cx="415" cy="25" r="6" /></svg>
              <span>HOME BOARD <i /> GLOBAL FIXTURE</span>
            </div>
            <div className="atlas-art-footer"><b>THURSDAY IS YOURS.</b><span>FREE NIGHT · WEEK CLOSES SUNDAY</span></div>
          </div>
        </section>

        <section className="atlas-competition">
          <div className="atlas-standings">
            <div className="atlas-panel-heading">
              <div><div className="atlas-section-tag"><span>02</span> THE DIVISION <i /></div><h2>Table of play</h2></div>
              <div className="atlas-zone-key"><span><i className="rise" /> UP</span><span><i className="fall" /> DOWN</span></div>
            </div>
            <div className="atlas-table-wrap"><table className="atlas-table">
              <thead><tr><th scope="col">POS</th><th scope="col">PLAYER / BOARD</th><th scope="col">P</th><th scope="col">W</th><th scope="col">L</th><th scope="col">LEGS</th><th scope="col">PTS</th></tr></thead>
              <tbody>{players.map((player, index) => <tr key={player.name} data-zone={index < 2 ? "up" : index > 5 ? "down" : "safe"} className={player.you ? "is-you" : ""}>
                <td><span className="atlas-rank">{String(index + 1).padStart(2, "0")}</span></td>
                <td><b>{player.you ? "You" : player.name}</b><small>{player.country}</small>{index === 0 && <Crown size={12} aria-label="Table leader" />}</td>
                <td>{player.played}</td><td>{player.won}</td><td>{player.lost}</td><td>{player.legs}</td><td><strong>{player.points}</strong></td>
              </tr>)}</tbody>
            </table></div>
            <div className="atlas-prize"><Trophy size={15} /><span>SEASON PRIZE PURSE</span><b>£120 <i>/</i> £60 <i>/</i> £36</b><small>TOP THREE</small></div>
            <div className="atlas-promotion-track"><span>UP</span><i /><b>1–2</b><small>PROMOTION PLACES</small><em>THE LINE</em><b>7–8</b><small>RELEGATION PLACES</small><i /><span>DOWN</span></div>
          </div>

          <aside className="atlas-ledger">
            <div className="atlas-panel-heading">
              <div><div className="atlas-section-tag"><span>03</span> YOUR SEASON <i /></div><h2>Road to the final week</h2></div>
              <span className="atlas-ledger-range">S02 <ChevronRight size={12} /> W10—16</span>
            </div>
            <ol className="atlas-fixture-list">{fixtures.map((fixture) => <li key={fixture.week} className={fixture.week === 13 ? "is-current" : fixture.week < 13 ? "is-played" : ""}>
              <span className="atlas-stop"><i /></span><span className="atlas-week">W{fixture.week}</span>
              <span className="atlas-player-name"><b>{fixture.name}</b><small>{fixture.nation}</small></span>
              <span className={`atlas-status ${fixture.state === "FORFEIT" ? "is-forfeit" : ""}`}>{fixture.state || "FIXTURE"}</span>
              <strong className="atlas-score">{fixture.week === 13 && booked ? chosen.short : fixture.score}</strong>
            </li>)}</ol>
            <div className="atlas-last-season"><span className="atlas-trophy-mark"><Trophy size={15} /></span><div><small>LAST SEASON · SEASON 01</small><b>Division Two</b><em>£40 PRIZE · PROMOTED</em></div><strong>2<sup>ND</sup></strong></div>
          </aside>
        </section>
        <footer className="atlas-footer"><span><i /> TKDL WEBCAM LEAGUE</span><b>REAL SEASON STRUCTURE <i>·</i> YOUR BOARD AT HOME</b><span>DIVISION 03 / S02</span></footer>
      </div>
    </main>
  );
}
