import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, Search, Swords } from "lucide-react";
import arenaImage from "../../../../../../attached_assets/generated_images/career-relationships-arena.jpg";
import "./_group.css";
import "./Redesign.css";

const opponents = [
  { name: "Oliver Reed", flag: "ENG", labels: ["Career Rival", "Generation Rival"], wins: 10, losses: 8, meetings: 18, region: "Yorkshire", age: 31, rank: 14, first: "S1 W12 · UK Open", latest: "S4 W18 · European Masters", evidence: ["Met in three finals", "Shared the Challenger Tour for two seasons"] },
  { name: "Paula King", flag: "SCO", labels: ["Favourite Opponent"], wins: 7, losses: 3, meetings: 10, region: "Fife", age: 27, rank: 22, first: "S2 W04 · County Open", latest: "S4 W11 · Regional Masters", evidence: ["Played in the same Q-School class"] },
  { name: "Jamie Voss", flag: "WAL", labels: ["Nemesis"], wins: 4, losses: 9, meetings: 13, region: "Cardiff", age: 33, rank: 9, first: "S1 W29 · National Open", latest: "S4 W20 · Regional Open", evidence: ["Met in four major events"] },
  { name: "Nina Vale", flag: "NED", labels: ["Familiar Opponent"], wins: 2, losses: 2, meetings: 4, region: "Utrecht", age: 24, rank: 45, first: "S3 W08 · Challenger Tour", latest: "S4 W15 · Challenger Tour", evidence: ["Shared event history"] },
];

const players = [
  { name: "Oliver Reed", flag: "ENG", region: "Yorkshire", age: 31, rank: 14, status: "Active", season: 1 },
  { name: "Paula King", flag: "SCO", region: "Fife", age: 27, rank: 22, status: "Active", season: 2 },
  { name: "Jamie Voss", flag: "WAL", region: "Cardiff", age: 33, rank: 9, status: "Active", season: 1 },
  { name: "Nina Vale", flag: "NED", region: "Utrecht", age: 24, rank: 45, status: "Active", season: 3 },
  { name: "Arthur Pike", flag: "ENG", region: "Kent", age: 36, rank: null, status: "Retired", season: 1 },
  { name: "Mara Cole", flag: "IRL", region: "Dublin", age: 20, rank: 81, status: "Active", season: 4 },
];

const opponentFilters = ["All opponents", "Career Rival", "Nemesis", "Favourite Opponent", "Familiar Opponent", "Generation Rival"];

function Flag({ code }: { code: string }) {
  return <span className="rel3-flag">{code}</span>;
}

function LinkSet({ name, rivalry = false }: { name: string; rivalry?: boolean }) {
  const key = name.toLowerCase().replaceAll(" ", "-");
  return <nav className="rel3-links" aria-label={`${name} links`}>
    <a href={`/career/demo/world/players/${key}/profile`}>Player profile <ArrowUpRight size={14} /></a>
    {rivalry && <a href={`/career/demo/world/rivalries/${key}`}>Rivalry detail <ArrowUpRight size={14} /></a>}
    <a href={`/career/demo/recognition/npcs/${key}`}>Public sporting recognition <ArrowUpRight size={14} /></a>
  </nav>;
}

export function Redesign() {
  const [filter, setFilter] = useState("All opponents");
  const [search, setSearch] = useState("");
  const [generation, setGeneration] = useState("Active");
  const [playerSearch, setPlayerSearch] = useState("");
  const [limit, setLimit] = useState(4);
  const visibleOpponents = useMemo(() => opponents.filter(opponent =>
    (filter === "All opponents" || opponent.labels.includes(filter)) &&
    opponent.name.toLowerCase().includes(search.toLowerCase())
  ), [filter, search]);
  const visiblePlayers = players.filter(player =>
    (generation === "All generations" || player.status === generation) &&
    player.name.toLowerCase().includes(playerSearch.toLowerCase())
  );
  const featured = visibleOpponents[0] ?? opponents[0];
  const isAhead = featured.wins > featured.losses;

  return <main className="rel3-page">
    <div className="rel3-shell">
      <div className="rel3-topline">
        <div className="rel3-brand"><span className="rel3-brand__block">TK<span>DL</span></span><span className="rel3-brand__sub">CAREER / COMPETITION RECORD</span></div>
        <p>Illustrative preview data <i>·</i> Fictional players</p>
      </div>

      <header className="rel3-hero" style={{ backgroundImage: `linear-gradient(90deg,rgba(8,8,12,.96) 0%,rgba(15,9,14,.84) 42%,rgba(20,8,13,.36) 100%),linear-gradient(0deg,rgba(11,8,12,.8),transparent 42%),url("${arenaImage}")` }}>
        <div className="rel3-hero__content">
          <p className="rel3-kicker"><span /> THE RIVALRY ARCHIVE <b>—</b> SEASON RECORD</p>
          <h1>Head to<br /><em>head.</em></h1>
          <p className="rel3-hero__intro">Sporting history, not personality. Every label is earned on the oche, through played results and shared cohorts — never through scoring or rewards.</p>
          <div className="rel3-hero__foot">
            <div className="rel3-hero__mark"><Swords size={17} /><span>Records that<br />remember.</span></div>
            <div className="rel3-hero__stats">
              <div><strong>04</strong><span>Opponents faced</span></div>
              <div><strong>23</strong><span>Your H2H wins</span></div>
              <div><strong>22</strong><span>Their wins</span></div>
              <div><strong>04</strong><span>Labelled rivals</span></div>
            </div>
          </div>
        </div>
        <div className="rel3-hero__edition"><span>TKDL</span><b>OFFICIAL</b><i>PLAYER RECORD</i></div>
        <div className="rel3-hero__caption"><span>TOUR FLOOR</span><i>·</i><span>LIGHTS ON</span></div>
      </header>

      <section className="rel3-feature" aria-label="Featured head-to-head record">
        <div className="rel3-feature__masthead"><span><i /> THE CURRENT MATCHUP</span><b>Based on played results</b></div>
        <div className="rel3-scoreboard">
          <div className="rel3-contender rel3-contender--home">
            <span className="rel3-contender__index">PLAYER 01</span>
            <strong>Alex Morgan</strong>
            <span className="rel3-contender__role">YOUR RECORD</span>
          </div>
          <div className="rel3-score">
            <div className="rel3-score__digits"><strong>{featured.wins}</strong><i>:</i><strong>{featured.losses}</strong></div>
            <span>HEAD TO HEAD</span>
            <small>{featured.meetings} meetings <b>·</b> {Math.round(featured.wins / featured.meetings * 100)}% wins</small>
          </div>
          <div className="rel3-contender rel3-contender--away">
            <span className="rel3-contender__index"><Flag code={featured.flag} /> OPPONENT</span>
            <strong>{featured.name}</strong>
            <span className="rel3-labels">{featured.labels.map(label => <em key={label}>{label}</em>)}</span>
          </div>
          <div className={`rel3-scoreboard__verdict ${isAhead ? "is-positive" : "is-negative"}`}><span>{isAhead ? "ADVANTAGE" : featured.wins === featured.losses ? "LEVEL" : "TRAILING"}</span><i /></div>
        </div>
        <p className="rel3-feature__evidence"><span>FORM LINE</span>{featured.evidence[0]}</p>
      </section>

      <section className="rel3-opponents">
        <div className="rel3-section-title">
          <div><span className="rel3-section-title__number">01</span><div><small>PLAYED HISTORY</small><h2>Opponents</h2></div></div>
          <span className="rel3-section-title__count">{visibleOpponents.length}<i> / </i>{opponents.length}<small>records</small></span>
        </div>
        <div className="rel3-controls">
          <label><span>Relationship</span><select value={filter} onChange={event => setFilter(event.target.value)}>{opponentFilters.map(item => <option key={item}>{item}</option>)}</select><ChevronDown size={15} /></label>
          <label className="rel3-controls__search"><span>Find opponent</span><div><Search size={16} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search a name" /></div></label>
          <p>Unlabelled opponents still have factual H2H records.</p>
        </div>

        <div className="rel3-ledger">
          {visibleOpponents.map((opponent, index) => {
            const status = opponent.wins > opponent.losses ? "ahead" : opponent.wins < opponent.losses ? "behind" : "level";
            return <details key={opponent.name} className={`rel3-rival rel3-rival--${status}`}>
              <summary>
                <span className="rel3-rival__order">{String(index + 1).padStart(2, "0")}</span>
                <span className="rel3-rival__name"><span className="rel3-rival__nation"><Flag code={opponent.flag} /></span><strong>{opponent.name}</strong><small>{opponent.meetings} meetings <i>·</i> {opponent.labels.length ? opponent.labels[0] : "No special relationship yet"}</small></span>
                <span className="rel3-rival__labels">{opponent.labels.length ? opponent.labels.map(label => <em key={label}>{label}</em>) : <i>No special relationship yet</i>}</span>
                <span className="rel3-rival__record"><b>{opponent.wins}</b><i>–</i><b>{opponent.losses}</b><small>W—L</small></span>
                <span className="rel3-rival__expand"><ChevronDown size={18} /></span>
              </summary>
              <div className="rel3-rival__details">
                <div className="rel3-rival__bio"><p>{opponent.region}<i>·</i>Age {opponent.age}<i>·</i>Active<i>·</i>World #{opponent.rank}</p><LinkSet name={opponent.name} rivalry /></div>
                <div className="rel3-meetings">
                  <div><span>FIRST MEETING</span><strong>{opponent.first}</strong></div>
                  <div><span>LATEST MEETING</span><strong>{opponent.latest}</strong></div>
                </div>
                <ul className="rel3-evidence">{opponent.evidence.map(item => <li key={item}>{item}</li>)}</ul>
                <div className="rel3-last-match"><span>PLAYED MEETING</span><b>{opponent.latest}</b><i>Won · Semi-final</i></div>
              </div>
            </details>;
          })}
          {!visibleOpponents.length && <div className="rel3-empty"><strong>No records found.</strong><span>Try another relationship or search.</span></div>}
        </div>
      </section>

      <section className="rel3-generations">
        <div className="rel3-generation-title"><span>02</span><div><small>THE WIDER FIELD</small><h2>Career generations</h2></div></div>
        <div className="rel3-generation-metrics">
          <div className="rel3-metric rel3-metric--red"><strong>05</strong><span>Active</span></div>
          <div className="rel3-metric rel3-metric--soft"><strong>01</strong><span>Retired</span></div>
          <div className="rel3-metric rel3-metric--gold"><strong>02</strong><span>New this season</span></div>
          <div className="rel3-metric rel3-metric--cream"><strong>07</strong><span>Aged 23 or under</span></div>
        </div>
        <details className="rel3-generation-note"><summary>About generations <ChevronDown size={15} /></summary><p>Young age is context, not a promise of future success. New entrants use existing junior and grassroots pathways. Retired identities and sporting records remain in this save.</p></details>
      </section>

      <div className="rel3-world-toolbar">
        <div className="rel3-section-title rel3-section-title--world"><div><span className="rel3-section-title__number">03</span><div><small>ALL ERAS · ALL IDENTITIES</small><h2>The generation</h2></div></div></div>
        <div className="rel3-controls rel3-controls--world">
          <label><span>World players</span><select value={generation} onChange={event => { setGeneration(event.target.value); setLimit(4); }}><option>Active</option><option>Retired</option><option>All generations</option></select><ChevronDown size={15} /></label>
          <label className="rel3-controls__search"><span>Find world player</span><div><Search size={16} /><input type="search" value={playerSearch} onChange={event => { setPlayerSearch(event.target.value); setLimit(4); }} placeholder="Search a name" /></div></label>
        </div>
      </div>
      <ul className="rel3-world">
        {visiblePlayers.slice(0, limit).map((player, index) => <li key={player.name}>
          <span className="rel3-world__number">{String(index + 1).padStart(2, "0")}</span>
          <span className="rel3-world__monogram" aria-hidden="true">{player.name.split(" ").map(part => part[0]).join("")}</span>
          <div className="rel3-world__identity"><strong><Flag code={player.flag} />{player.name}</strong><small>{player.region} · Age {player.age} · {player.status} · {player.rank ? `World #${player.rank}` : "No current World Ranking"} · Entered in season {player.season}</small><LinkSet name={player.name} /></div>
          <span className={`rel3-status rel3-status--${player.status.toLowerCase()}`}>{player.status}</span>
        </li>)}
      </ul>
      {!visiblePlayers.length && <div className="rel3-empty"><strong>No players in this view.</strong><span>Change the generation filter or search.</span></div>}
      {visiblePlayers.length > limit && <button className="rel3-more" onClick={() => setLimit(limit + 2)}>Show more <span>({visiblePlayers.length - limit} remaining)</span><ChevronDown size={16} /></button>}
      <footer className="rel3-footer"><span>TKDL <i>/</i> Career archive</span><span>Illustrative data <b>·</b> Fictional players</span></footer>
    </div>
  </main>;
}

export default Redesign;
