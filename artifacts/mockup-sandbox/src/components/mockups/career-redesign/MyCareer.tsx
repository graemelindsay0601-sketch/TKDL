import { useState } from "react";
import { ArrowUpRight, BadgeCheck, CalendarDays, ChevronRight, CircleUserRound, Flag, Pencil, Shield, Star, Target, Trophy, TrendingUp } from "lucide-react";
import { CareerShell, Eyebrow } from "./_shared/CareerShell";
import "./_shared/career.css";
import "./_shared/pages.css";
import "./_shared/tkdl-theme.css";
import "./_group.css";

const honours = [
  { name: "Midlands Classic", label: "SEASON 2 · CLASSIC TROPHY", seal: "MC", tone: "gold" },
  { name: "East Midlands Open", label: "SEASON 1 · REGIONAL TROPHY", seal: "EM", tone: "red" },
  { name: "Northshire Open", label: "SEASON 1 · COUNTY TROPHY", seal: "NO", tone: "blue" },
  { name: "Players Championship 4", label: "SEASON 2 · TOUR TITLE", seal: "PC", tone: "green" },
];
const landmarks = [
  { season: "S1", title: "First event played", note: "Northshire Open · joined the organised circuit", icon: Flag },
  { season: "S1", title: "First ranking recorded", note: "A quarter-final finish put your name on the board", icon: TrendingUp },
  { season: "S1", title: "First title", note: "Midlands Classic · first career tournament win", icon: Trophy },
  { season: "S2", title: "County selection", note: "Named in Nottinghamshire Men’s A squad", icon: Shield },
];

export function MyCareer() {
  const [activeTab, setActiveTab] = useState("Record");
  const [identity, setIdentity] = useState(false);
  return <CareerShell page="MyCareer">
    <div className="tk-profile">
      <div className="tk-page-heading profile-heading"><div><Eyebrow>PLAYER FILE · UPDATED WEEK 18</Eyebrow><h1>My Career</h1><p>A record made one fixture, one result, one decision at a time.</p></div><button className="tk-button quiet" onClick={() => setIdentity(!identity)}><Pencil size={15} /> {identity ? "Close identity" : "Edit identity"}</button></div>
      {identity && <div className="identity-editor" role="status"><CircleUserRound size={18} /><span><strong>Identity workshop</strong><small>Shirt, nickname and player profile customisation are available in this prototype.</small></span><button onClick={() => setIdentity(false)}>Done</button></div>}
      <section className="player-banner">
        <div className="player-art">
          <div className="art-number">24</div>
          <img className="shirt-premium-art" src="/__mockup/images/tkdl-premium-kit-redline.webp" alt="Premium TKDL Redline player shirt" />
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
        </div>
        <div className="player-info"><Eyebrow>AMATEUR · SEASON 2</Eyebrow><h2>Alex North</h2><p className="player-nickname">“The North Star”</p><div className="identity-chips"><span><BadgeCheck size={13} /> Amateur circuit</span><span>Age 24</span><span>Nottinghamshire</span></div>
          <div className="four-stat-grid">
            <div className="profile-stat"><span>CAREER BALANCE</span><strong>£308</strong><small>Available for your next move</small></div>
            <div className="profile-stat"><span>CAREER LEVEL</span><strong>Amateur</strong><small>Local &amp; county circuit</small></div>
            <div className="profile-stat"><span>CURRENT FORM</span><strong className="form-positive">On fire</strong><small>4 wins in your last 5</small></div>
            <div className="profile-stat"><span>PLAYER RATING</span><strong>95</strong><small>Season best · 3-dart average</small></div>
          </div>
        </div>
        <div className="banner-seal"><span>PLAYER</span><strong>AN</strong><small>FILE · 02</small></div>
      </section>
      <nav className="profile-tabs" aria-label="My Career sections">{["Record", "Honours", "Journey", "Rivals"].map(tab => <button key={tab} className={tab === activeTab ? "active" : ""} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
      {activeTab === "Record" && <>
        <div className="record-metrics">
          <div><span>TOURNAMENT TITLES</span><strong>4</strong><small>Across 2 seasons</small></div><div><span>FINALS</span><strong>9</strong><small>Six runner-up finishes</small></div><div><span>MATCH RECORD</span><strong>87<span>–</span>42</strong><small>67.4% win rate</small></div><div><span>PRIZE MONEY</span><strong>£3,850</strong><small>Career total</small></div>
        </div>
        <div className="record-grid">
          <section className="tk-card landmarks-card"><div className="tk-section-head"><h2><Target size={18} /> Career landmarks</h2><button className="record-link" onClick={() => setActiveTab("Journey")}>Full journey <ArrowUpRight size={14} /></button></div><ol className="landmark-list">{landmarks.map((entry, i) => { const Icon = entry.icon; return <li key={entry.title}><span className="landmark-season">{entry.season}</span><span className={`landmark-icon ${i === landmarks.length - 1 ? "highlight" : ""}`}><Icon size={16} /></span><span><strong>{entry.title}</strong><small>{entry.note}</small></span><ChevronRight size={15} /></li>; })}</ol></section>
          <section className="tk-card focus-card"><div className="tk-section-head"><h2><Target size={18} /> The ambition</h2><span>PERSONAL GOAL</span></div><div className="focus-body"><span className="goal-stamp"><Star size={20} /></span><Eyebrow>YOUR MAIN AMBITION</Eyebrow><h3>Win a Players<br />Championship</h3><p>Keep climbing the circuit. The next step is to earn a place in a stronger field.</p><div className="goal-progress"><div><span>PATH TO PROFESSIONAL TOUR</span><b>Stage 2 of 4</b></div><i><span /></i><small>Local club <b>✓</b> &nbsp; Amateur circuit <b>●</b> &nbsp; Regional <b>○</b> &nbsp; Professional <b>○</b></small></div><button className="tk-button quiet" onClick={() => setActiveTab("Journey")}>View your journey <ArrowUpRight size={14} /></button></div></section>
        </div>
        <section className="tk-card honours-card"><div className="tk-section-head"><h2><Trophy size={18} /> Trophy cabinet</h2><button className="record-link" onClick={() => setActiveTab("Honours")}>All honours <ArrowUpRight size={14} /></button></div><div className="trophy-shelf">{honours.map((honour, i) => <button key={honour.name} className={`trophy-item tone-${honour.tone}`} onClick={() => setActiveTab("Honours")}><span className="trophy-mark"><i>{honour.seal}</i><small>{String(i + 1).padStart(2, "0")}</small></span><strong>{honour.name}</strong><small>{honour.label}</small></button>)}</div></section>
      </>}
      {activeTab === "Honours" && <section className="tk-card tab-detail"><Eyebrow>FOUR CAREER TITLES</Eyebrow><h2>Every cup has a story.</h2><div className="honours-detail-grid">{honours.map((item, i) => <article key={item.name}><div className={`large-trophy tone-${item.tone}`}><Trophy size={34} /><span>{String(i + 1).padStart(2, "0")}</span></div><div><Eyebrow>{item.label}</Eyebrow><h3>{item.name}</h3><p>Won through a composed run of form, finishing and nerve. A result that opened the next door.</p></div></article>)}</div></section>}
      {activeTab === "Journey" && <section className="tk-card tab-detail"><Eyebrow>THE ROAD SO FAR</Eyebrow><h2>From the back room to the big stage.</h2><div className="journey-route">{landmarks.map((item,i)=><div className="journey-stop" key={item.title}><i>{String(i+1).padStart(2,"0")}</i><span><b>{item.title}</b><small>{item.note}</small></span></div>)}</div><p className="journey-caption">The professional game is a destination, not an entitlement. Keep earning the next step.</p></section>}
      {activeTab === "Rivals" && <section className="tk-card tab-detail"><Eyebrow>ON THE BOARD WITH YOU</Eyebrow><h2>Know the names beside yours.</h2><div className="rival-list">{[["Jack Turner","The Captain","Nottinghamshire · 91"],["Callum Reed","Quick Hands","Nottinghamshire · 88"],["Maya Patel","The Metronome","Leicestershire · 86"]].map((r,i)=><div key={r[0]}><span className="rival-rank">0{i+1}</span><span className="initial-avatar">{r[0].split(" ").map(n=>n[0]).join("")}</span><span><strong>{r[0]}</strong><small>{r[1]} · {r[2]}</small></span><button className="record-link" onClick={() => setIdentity(true)}>Player profile <ArrowUpRight size={13} /></button></div>)}</div></section>}
      <section className="profile-quicknav"><Eyebrow>YOUR CAREER, AT A GLANCE</Eyebrow><a href="/__mockup/preview/career-redesign/Overview"><CalendarDays size={17} />Week planner<span>Fixture and activity decisions</span><ArrowUpRight size={15} /></a><a href="/__mockup/preview/career-redesign/Club"><Shield size={17} />The Robin Hood<span>Club nights, league, county</span><ArrowUpRight size={15} /></a></section>
    </div>
  </CareerShell>;
}
