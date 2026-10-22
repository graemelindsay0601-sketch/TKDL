import "./_group.css";
import "./Redesign.css";
import { ArrowDownRight, ArrowUpRight, Award, ChartNoAxesCombined, ChevronRight, CircleHelp, Crosshair, Gauge, Medal, Target, Trophy } from "lucide-react";

const seasons = [
  { season: 1, rank: 82, events: 11, titles: 1 },
  { season: 2, rank: 18, events: 15, titles: 3 },
];

const careerStats = [
  { label: "Matches played", value: "129" },
  { label: "Won / lost", value: "87 / 42" },
  { label: "Win percentage", value: "67%" },
  { label: "Events entered", value: "26" },
  { label: "Runner-up finishes", value: "5" },
  { label: "Semi / quarter finals", value: "14 / 22" },
  { label: "Current win streak", value: "4" },
  { label: "Longest win streak", value: "9" },
  { label: "Seasons with play", value: "2" },
  { label: "Best event finish", value: "Champion", note: "Players Championship 4", featured: true },
];

const playingStats = [
  { label: "Three-dart average", value: "78.3", icon: Gauge },
  { label: "Recorded darts", value: "3,402", icon: Crosshair },
  { label: "180s", value: "86", icon: Target },
  { label: "140+ visits", value: "412", note: "Includes 180s", icon: ArrowUpRight },
  { label: "100+ visits", value: "791", note: "Includes 140+ visits", icon: ArrowUpRight },
  { label: "Highest visit", value: "180", icon: ChartNoAxesCombined },
  { label: "Checkouts completed", value: "63", icon: Medal },
  { label: "Highest checkout", value: "170", icon: Trophy },
];

function RankingChart() {
  return (
    <div className="cp-rank-plot">
      <div className="cp-rank-axis-labels" aria-hidden="true"><span>18th</span><span>82nd</span></div>
      <svg viewBox="0 0 700 248" role="img" aria-label="Sample World Ranking season highs: Season 1, 82nd; Season 2, 18th. Lower position is better.">
        <defs>
          <linearGradient id="cpLine" x1="0" x2="1"><stop offset="0%" stopColor="#e5223b"/><stop offset="100%" stopColor="#e9bd62"/></linearGradient>
          <radialGradient id="cpHalo"><stop stopColor="#e9bd62" stopOpacity=".32"/><stop offset="1" stopColor="#e9bd62" stopOpacity="0"/></radialGradient>
        </defs>
        <path className="cp-grid-line" d="M44 43H676M44 96H676M44 149H676M44 202H676" />
        <path className="cp-chart-line" d="M88 202 C225 185 350 98 612 54" />
        <circle cx="88" cy="202" r="34" fill="url(#cpHalo)"/><circle cx="612" cy="54" r="42" fill="url(#cpHalo)"/>
        <circle cx="88" cy="202" r="6.5" className="cp-point cp-point--red"/>
        <circle cx="612" cy="54" r="7.5" className="cp-point cp-point--gold"/>
        <text x="88" y="232" textAnchor="middle" className="cp-chart-season">SEASON 01</text>
        <text x="612" y="232" textAnchor="middle" className="cp-chart-season">SEASON 02</text>
        <text x="88" y="180" textAnchor="middle" className="cp-chart-value">82ND</text>
        <text x="612" y="31" textAnchor="middle" className="cp-chart-value">18TH</text>
      </svg>
      <div className="cp-chart-direction"><ArrowDownRight size={14} strokeWidth={1.8} /> Recorded season highs · lower rank is better</div>
    </div>
  );
}

function EventBars() {
  const max = Math.max(...seasons.map(({ events }) => events));
  return (
    <div className="cp-event-bars" aria-label="Completed event results by season">
      {seasons.map((season) => (
        <div className="cp-event-column" key={season.season} aria-label={`Season ${season.season}: ${season.events} completed event results, ${season.titles} titles`}>
          <strong className="cp-event-total">{season.events}</strong>
          <div className="cp-bar-well">
            <div className="cp-bar-stack" style={{ height: `${season.events / max * 100}%` }}>
              <i style={{ height: `${season.titles / season.events * 100}%` }} />
            </div>
          </div>
          <span className="cp-season-tag">S{String(season.season).padStart(2, "0")}</span>
          <span className="cp-title-count"><Trophy size={11} /> {season.titles} title{season.titles === 1 ? "" : "s"}</span>
        </div>
      ))}
      <div className="cp-bar-legend"><i /> Completed results <b /> Titles</div>
    </div>
  );
}

export function Redesign() {
  return (
    <main className="cp-redesign">
      <header className="cp-masthead">
        <a className="cp-brand" href="#top" aria-label="TKDL Career Performance home"><span className="cp-brand-mark">T</span><span>TKDL<small>CAREER MODE</small></span></a>
        <div className="cp-save-context"><span className="cp-live-dot" aria-hidden="true" /> SAMPLE VALUES <b>SEASON 02</b><i>·</i> WEEK 18</div>
      </header>

      <section className="cp-hero" id="top" aria-labelledby="cp-title">
        <img className="cp-hero-photo" src="/__mockup/images/career-performance-stage.jpg" alt="A dart in a regulation dartboard under arena lights, with a player and crowd in the distance." />
        <div className="cp-hero-stamp">CAREER REPORT · SAMPLE / NOT LIVE</div>
        <div className="cp-hero-copy">
          <p className="cp-eyebrow"><span /> MY CAREER <i>/</i> PLAYER RECORD</p>
          <h1 id="cp-title">Career<br />Performance<span>.</span></h1>
          <p className="cp-hero-subtitle">A record written in matches played, events finished, and rankings published.</p>
          <div className="cp-season-pill"><span className="cp-pill-glyph">02</span><span><b>SEASON TWO</b><small>Sample values · through week 18</small></span><ChevronRight size={15} /></div>
        </div>
        <div className="cp-summary-ribbon" aria-label="Sample career highlights">
          <div className="cp-summary-item"><span>CAREER RECORD</span><strong>87<span>–</span>42</strong><small>129 completed matches</small></div>
          <div className="cp-summary-item cp-summary-item--gold"><span>WORLD RANKING HIGH</span><strong><i>#</i>18</strong><small>Recorded season best</small></div>
          <div className="cp-summary-item"><span>EVENT TITLES</span><strong>04</strong><small>Across 2 seasons</small></div>
          <div className="cp-summary-item"><span>WIN PERCENTAGE</span><strong>67<span>%</span></strong><small>Completed matches</small></div>
        </div>
      </section>

      <nav className="cp-section-nav" aria-label="On this page">
        <a href="#season-record"><span>01</span> Season record <ArrowUpRight size={13} /></a>
        <a href="#career-history"><span>02</span> Career history <ArrowUpRight size={13} /></a>
        <a href="#dart-evidence"><span>03</span> Playing evidence <ArrowUpRight size={13} /></a>
      </nav>

      <section className="cp-panel cp-season-panel" id="season-record" aria-labelledby="cp-season-heading">
        <div className="cp-section-heading">
          <div><p className="cp-eyebrow"><span /> MATCH-NIGHT REPORT</p><h2 id="cp-season-heading">Season evidence, <em>on record.</em></h2></div>
          <p className="cp-section-intro">Published World Ranking highs and completed event results, season by season. Only recorded values are plotted.</p>
        </div>
        <div className="cp-trend-grid">
          <article className="cp-chart-card cp-ranking-card">
            <div className="cp-card-head"><div><span className="cp-card-index">A</span><h3>World Ranking high</h3></div><span className="cp-chip"><ArrowDownRight size={12} /> LOWER IS BETTER</span></div>
            <RankingChart />
          </article>
          <article className="cp-chart-card cp-events-card">
            <div className="cp-card-head"><div><span className="cp-card-index cp-card-index--gold">B</span><h3>Completed event results</h3></div><span className="cp-chip cp-chip--gold"><Trophy size={11} /> TITLES IN GOLD</span></div>
            <EventBars />
          </article>
        </div>
        <div className="cp-evidence-note"><CircleHelp size={15} /><p>Ranking marks show recorded season highs. Event bars count completed results and titles. No gaps are filled and no values are estimated.</p></div>
      </section>

      <section className="cp-history-section cp-panel" id="career-history" aria-labelledby="cp-history-heading">
        <div className="cp-section-heading cp-section-heading--compact">
          <div><p className="cp-eyebrow"><span /> FINISHED MEANS COUNTED</p><h2 id="cp-history-heading">Career <em>history.</em></h2></div>
          <div className="cp-total-badge"><Award size={17} /><span><b>129</b><small>matches on record</small></span></div>
        </div>
        <p className="cp-section-intro cp-history-intro">Totals from every match and event you’ve finished. Byes and walkovers don’t count as matches played.</p>
        <div className="cp-history-grid">
          {careerStats.map((item, index) => (
            <div className={`cp-stat-tile${item.featured ? " cp-stat-tile--featured" : ""}`} key={item.label}>
              <span className="cp-stat-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="cp-stat-label">{item.label}</span>
              <strong>{item.value}</strong>
              {item.note && <small>{item.note}</small>}
            </div>
          ))}
        </div>
      </section>

      <section className="cp-playing-section cp-panel" id="dart-evidence" aria-labelledby="cp-playing-heading">
        <div className="cp-section-heading cp-section-heading--compact">
          <div><p className="cp-eyebrow cp-eyebrow--blue"><span /> HUMAN DART EVIDENCE</p><h2 id="cp-playing-heading">Playing <em>statistics.</em></h2></div>
          <div className="cp-evidence-count"><b>73</b><span>usable match logs</span><i aria-hidden="true" /> <b>56</b><span>without usable evidence</span></div>
        </div>
        <p className="cp-section-intro cp-playing-intro">Based only on matches with usable human dart evidence. Scoring visits use points actually deducted; busts score zero.</p>
        <div className="cp-playing-grid">
          {playingStats.map(({ label, value, note, icon: Icon }) => (
            <div className="cp-playing-tile" key={label}>
              <span className="cp-playing-icon" aria-hidden="true"><Icon size={16} strokeWidth={1.7} /></span>
              <span className="cp-stat-label">{label}</span>
              <strong>{value}</strong>
              {note && <small>{note}</small>}
            </div>
          ))}
        </div>
        <div className="cp-unavailable"><span className="cp-unavailable-mark" aria-hidden="true">—</span><div><strong>Checkout attempts &amp; percentage unavailable</strong><p>The dart log records hits, not the intended target. No aiming intent is inferred.</p></div></div>
      </section>

      <footer className="cp-footer">
        <span className="cp-footer-mark">TKDL <i>·</i> CAREER PERFORMANCE</span>
        <span><b>ILLUSTRATIVE SAMPLE-SAVE VALUES</b> <i>·</i> NOT A LIVE CAREER</span>
      </footer>
    </main>
  );
}
