import "./_group.css";
import "./CurrentPerformance.css";

const seasons = [
  { season: 1, rank: 82, events: 11, titles: 1 },
  { season: 2, rank: 18, events: 15, titles: 3 },
];

const statistics = [
  ["Matches played", "129"], ["Won / lost", "87 / 42"], ["Win percentage", "67%"],
  ["Events entered", "26"], ["Runner-up finishes", "5"], ["Semi / quarter finals", "14 / 22"],
  ["Current win streak", "4"], ["Longest win streak", "9"], ["Seasons with play", "2"],
  ["Best event finish", "Champion", "Players Championship 4"],
];

const recorded = [
  ["Three-dart average", "78.3"], ["Recorded darts", "3,402"], ["180s", "86"],
  ["140+ visits", "412", "Includes 180s"], ["100+ visits", "791", "Includes 140+ visits"],
  ["Highest visit", "180"], ["Checkouts completed", "63"], ["Highest checkout", "170"],
];

export function CurrentPerformance() {
  const maxEvents = Math.max(...seasons.map(item => item.events));
  return <main className="career-root performance-current">
    <div className="performance-current__mast"><span>TKDL <i>·</i> MY CAREER</span><span>EXAMPLE SAVE <b>SEASON 2 · WEEK 18</b></span></div>
    <section className="career-page-hero performance-current__hero">
      <div className="career-page-hero__stage">
        <div className="performance-current__hero-art" aria-hidden="true"><span>02</span><i>TOUR<br />SEASON</i></div>
        <div className="career-page-hero__content"><div className="career-page-hero__text">
          <p className="career-page-hero__kicker"><i /> MY CAREER · PLAYER RECORD</p>
          <h1 className="career-page-hero__title">Performance</h1>
          <div className="career-page-hero__subtitle"><p>Every completed match, event and ranking in your Career, from the scorer and the results record.</p></div>
        </div></div>
      </div>
      <dl className="career-page-hero__stats">
        <div><dt>Career record</dt><dd>87–42</dd><small>129 completed matches</small></div>
        <div className="is-gold"><dt>World ranking high</dt><dd>#18</dd><small>Recorded season best</small></div>
        <div><dt>Event titles</dt><dd>04</dd><small>Across 2 seasons</small></div>
        <div><dt>Win percentage</dt><dd>67%</dd><small>Completed matches</small></div>
      </dl>
    </section>

    <section className="career-section performance-current__trend" style={{ "--section-accent": "#69b8ec" } as React.CSSProperties}>
      <div className="career-section-head"><h2><span aria-hidden>↗</span>Performance over time</h2></div>
      <p className="career-trend-intro">Published World Ranking highs and completed event results, season by season. Only recorded values are plotted.</p>
      <div className="career-trend-grid">
        <section className="career-trend-chart" aria-label="World Ranking season highs">
          <div className="career-trend-chart__heading"><strong>WORLD RANKING HIGH</strong><span>Lower position is better</span></div>
          <div className="career-trend-svg-wrap"><svg viewBox="0 0 800 220" role="img" aria-label="Example ranking highs: season 1, 82nd; season 2, 18th">
            <line x1="48" y1="164" x2="770" y2="164" className="career-chart-axis" /><line x1="48" y1="42" x2="48" y2="164" className="career-chart-axis" />
            <text x="4" y="50" className="career-chart-label">18th</text><text x="4" y="163" className="career-chart-label">82nd</text>
            <polyline points="54,164 746,42" className="career-chart-line" />
            <g><circle cx="54" cy="164" r="5" className="career-chart-point" /><text x="54" y="191" textAnchor="middle" className="career-chart-label">S1</text><text x="54" y="151" textAnchor="middle" className="career-chart-value">82nd</text></g>
            <g><circle cx="746" cy="42" r="5" className="career-chart-point" /><text x="746" y="191" textAnchor="middle" className="career-chart-label">S2</text><text x="746" y="29" textAnchor="middle" className="career-chart-value">18th</text></g>
          </svg></div>
        </section>
        <section className="career-trend-chart" aria-label="Completed event results by season">
          <div className="career-trend-chart__heading"><strong>COMPLETED EVENT RESULTS</strong><span>Gold marks titles</span></div>
          <div className="career-result-bars">{seasons.map(row => <div className="career-result-season" key={row.season}>
            <div className="career-result-count">{row.events}</div><div className="career-result-bar" style={{ height: `${row.events / maxEvents * 100}%` }}><i style={{ height: `${row.titles / row.events * 100}%` }} /></div>
            <small>S{row.season}</small><span>{row.titles} title{row.titles === 1 ? "" : "s"}</span>
          </div>)}</div>
        </section>
      </div>
      <p className="career-trend-note">Ranking marks show recorded season highs. Results count completed event records only; no gaps are filled and no values are estimated.</p>
    </section>

    <nav className="performance-current__links" aria-label="Related Career screens">
      <a href="#preview-history">Results &amp; statistics <span>↗</span></a>
      <a href="#preview-history">Ranking history &amp; races <span>↗</span></a>
      <a href="#preview-history">Played opponents &amp; H2H <span>↗</span></a>
    </nav>

    <section className="career-section performance-current__record" id="preview-history" style={{ "--section-accent": "#d3ad62" } as React.CSSProperties}>
      <div className="career-section-head"><h2><span aria-hidden>▤</span>Career history · Overview</h2><a href="#preview-history">Playing stats ↓</a></div>
      <p className="performance-current__helper">Your totals from every match and event you’ve finished. Byes and walkovers don’t count as matches played.</p>
      <div className="performance-current__stats">{statistics.map(([label, value, note]) => <div className="performance-current__stat" key={label}>
        <span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}
      </div>)}</div>
    </section>
    <section className="career-section performance-current__record" style={{ "--section-accent": "#69b8ec" } as React.CSSProperties}>
      <div className="career-section-head"><h2><span aria-hidden>⌁</span>Recorded playing statistics</h2></div>
      <p className="performance-current__helper">73 completed matches with usable human dart evidence; 56 without it. Scoring visits use points actually deducted, with busts scoring zero.</p>
      <div className="performance-current__stats performance-current__stats--playing">{recorded.map(([label, value, note]) => <div className="performance-current__stat" key={label}>
        <span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}
      </div>)}</div>
      <p className="performance-current__disclaimer">Checkout attempts and checkout percentage are unavailable: the dart log records hits, not the intended target. No aiming intent is inferred.</p>
    </section>
    <footer className="performance-current__footer">CAREER PERFORMANCE <i>·</i> EXAMPLE VALUES FOR DESIGN REVIEW</footer>
  </main>;
}
