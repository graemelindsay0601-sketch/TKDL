import { useMemo, useState } from "react";
import { Search, Swords } from "lucide-react";
import "./_group.css";
import "./Current.css";

const rivals = [
  { name:"Oliver Reed", flag:"ENG", labels:["Career Rival","Generation Rival"], wins:10, losses:8, meetings:18, region:"Yorkshire", age:31, rank:14, first:"S1 W12 · UK Open", latest:"S4 W18 · European Masters", evidence:["Met in three finals","Shared the Challenger Tour for two seasons"] },
  { name:"Paula King", flag:"SCO", labels:["Favourite Opponent"], wins:7, losses:3, meetings:10, region:"Fife", age:27, rank:22, first:"S2 W04 · County Open", latest:"S4 W11 · Regional Masters", evidence:["Played in the same Q-School class"] },
  { name:"Jamie Voss", flag:"WAL", labels:["Nemesis"], wins:4, losses:9, meetings:13, region:"Cardiff", age:33, rank:9, first:"S1 W29 · National Open", latest:"S4 W20 · Regional Open", evidence:["Met in four major events"] },
  { name:"Nina Vale", flag:"NED", labels:["Familiar Opponent"], wins:2, losses:2, meetings:4, region:"Utrecht", age:24, rank:45, first:"S3 W08 · Challenger Tour", latest:"S4 W15 · Challenger Tour", evidence:["Shared event history"] },
];
const worldPlayers = [
  { name:"Oliver Reed", flag:"ENG", region:"Yorkshire", age:31, rank:14, status:"Active", season:1 },
  { name:"Paula King", flag:"SCO", region:"Fife", age:27, rank:22, status:"Active", season:2 },
  { name:"Jamie Voss", flag:"WAL", region:"Cardiff", age:33, rank:9, status:"Active", season:1 },
  { name:"Nina Vale", flag:"NED", region:"Utrecht", age:24, rank:45, status:"Active", season:3 },
  { name:"Arthur Pike", flag:"ENG", region:"Kent", age:36, rank:null, status:"Retired", season:1 },
  { name:"Mara Cole", flag:"IRL", region:"Dublin", age:20, rank:81, status:"Active", season:4 },
];
const filters = ["All opponents","Career Rival","Nemesis","Favourite Opponent","Familiar Opponent","Generation Rival"];

function Shirt({ label, accent="#d5b66b" }: { label:string; accent?:string }) {
  return <svg className="cr-shirt" viewBox="0 0 120 140" role="img" aria-label={`${label}'s shirt`}>
    <path d="M33 20 52 12h16l19 8 25 19-14 23-14-9v73H36V53l-14 9L8 39z" fill="#192b3e" stroke="#d7e3ee66"/>
    <path d="M17 39 34 52v75M103 39 86 52v75" fill="none" stroke={accent} strokeWidth="8"/>
    <path d="M52 12q8 18 16 0" fill="none" stroke="#f1e8d5" strokeWidth="4"/>
    <text x="60" y="80" textAnchor="middle" fill="#fff" fontSize="8" fontFamily="Oswald">{label.split(" ")[0].toUpperCase()}</text>
  </svg>;
}

export function Current() {
  const [filter,setFilter]=useState("All opponents"),[search,setSearch]=useState("");
  const [worldFilter,setWorldFilter]=useState("Active"),[worldSearch,setWorldSearch]=useState(""),[limit,setLimit]=useState(4);
  const shown=useMemo(()=>rivals.filter(r=>(filter==="All opponents"||r.labels.includes(filter))&&r.name.toLowerCase().includes(search.toLowerCase())),[filter,search]);
  const players=worldPlayers.filter(p=>(worldFilter==="All generations"||p.status===worldFilter)&&p.name.toLowerCase().includes(worldSearch.toLowerCase()));
  const featured=shown[0]??rivals[0];
  return <main className="cr-current">
    <p className="cr-current__sample">Illustrative preview data · Fictional players</p>
    <header className="cr-current__hero">
      <div className="cr-current__hero-copy"><small>Relationships · rivalries</small><h1>Head-to-head</h1><p>Sporting history, not personality. Labels describe played results and shared cohorts; they never change scoring, draws, rankings or rewards.</p></div>
      <div className="cr-current__stats"><span><b>{rivals.length}</b>Opponents faced</span><span><b>23</b>Your H2H wins</span><span><b>22</b>Their wins</span><span><b>4</b>Labelled rivals</span></div>
    </header>
    {featured&&<section className="cr-current__spotlight">
      <div className="cr-current__eyebrow"><span>Head-to-head spotlight</span><span>Based on played results</span></div>
      <div className="cr-current__matchup">
        <div className="cr-current__side"><Shirt label="You"/><div><small>Your record</small><strong>Alex Morgan</strong></div></div>
        <div className="cr-current__score"><small>Head-to-head</small><b>{featured.wins}<i>–</i>{featured.losses}</b><span>{featured.meetings} meetings · {Math.round(featured.wins/featured.meetings*100)}% wins</span></div>
        <div className="cr-current__side cr-current__side--opponent"><Shirt label={featured.name} accent="#fa4058"/><div><small>{featured.flag} · Featured opponent</small><strong>{featured.name}</strong><span>{featured.labels.map(x=><em key={x}>{x}</em>)}</span></div></div>
      </div>
      <p className="cr-current__evidence">{featured.evidence[0]}</p>
    </section>}
    <section className="cr-current__panel">
      <header><span className="cr-current__icon"><Swords size={16}/></span><h2>Opponents</h2><small>Played history</small></header>
      <div className="cr-current__filters">
        <label>Relationship<select value={filter} onChange={e=>setFilter(e.target.value)}>{filters.map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="cr-current__search">Find opponent<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search a name"/><Search size={15}/></label>
      </div>
      <p className="cr-current__count">{shown.length} of {rivals.length} opponents and historical cohort members. Unlabelled opponents still have factual H2H records.</p>
      <div className="cr-current__rivals">{shown.map(o=><details key={o.name} className={`cr-current__rival ${o.wins>o.losses?"ahead":o.wins<o.losses?"behind":"level"}`}>
        <summary><Shirt label={o.name}/><span className="cr-current__who"><strong>{o.flag} · {o.name}</strong><small>{o.meetings} meetings · H2H {o.wins}–{o.losses}</small><span>{o.labels.map(x=><em key={x}>{x}</em>)}</span></span><b>{o.wins}<i>–</i>{o.losses}</b></summary>
        <div className="cr-current__detail"><p>{o.region} · Age {o.age} · Active · World #{o.rank}</p><p>First: {o.first}<br/>Latest: {o.latest}</p><ul>{o.evidence.map(x=><li key={x}>{x}</li>)}</ul><strong>Played meetings</strong><p>{o.latest} · Won · Semi-final</p></div>
      </details>)}</div>
      <h3 className="cr-current__subhead">Career generations</h3>
      <div className="cr-current__generation-stats"><span><b>5</b>Active</span><span><b>1</b>Retired</span><span><b>2</b>New this season</span><span><b>7</b>Aged 23 or under</span></div>
      <details className="cr-current__note"><summary>About generations</summary><p>Young age is context, not a promise of future success. New entrants use existing junior and grassroots pathways. Retired identities and sporting records remain in this save.</p></details>
      <div className="cr-current__world-filters"><label>World players<select value={worldFilter} onChange={e=>{setWorldFilter(e.target.value);setLimit(4)}}><option>Active</option><option>Retired</option><option>All generations</option></select></label><label>Find world player<input value={worldSearch} onChange={e=>{setWorldSearch(e.target.value);setLimit(4)}} placeholder="Search a name"/></label></div>
      <ul className="cr-current__world">{players.slice(0,limit).map(p=><li key={p.name}><Shirt label={p.name}/><div><strong>{p.flag} · {p.name}</strong><small>{p.region} · Age {p.age} · {p.status} · {p.rank?`World #${p.rank}`:"No current World Ranking"} · Entered in season {p.season}</small><a href="#profile">Player profile</a> · <a href="#recognition">Public sporting recognition</a></div></li>)}</ul>
      {players.length>limit&&<button className="cr-current__more" onClick={()=>setLimit(limit+2)}>Show more ({players.length-limit} remaining)</button>}
    </section>
  </main>;
}
export default Current;
