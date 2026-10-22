import { useCareerFacts, useRankingHistory, useTourCard } from "../api";
import { CareerEmptyState, CareerError, CareerLoading, CareerSection } from "../components";
import { PLATES } from "../atmosphere";
import { ordinal } from "../model";
import type { ShellContext } from "../shell";
import "./career-trends.css";
import "./career-performance-live.css";

/** Match-night performance report, populated only from this save's recorded evidence. */
export function CareerPerformanceTrend({ saveId, season, week, retired = false }: { saveId: string; season: number; week: number; retired?: boolean }) {
  const facts = useCareerFacts(saveId);
  const ranking = useRankingHistory(saveId, "pro-world", "HUMAN", 200);
  const seasonMap = new Map<number, { season: number; events: number; titles: number }>();
  for (const result of facts.data?.results ?? []) {
    const season = seasonMap.get(result.season) ?? { season: result.season, events: 0, titles: 0 };
    season.events++;
    if (result.champion) season.titles++;
    seasonMap.set(result.season, season);
  }
  const results = [...seasonMap.values()].sort((a, b) => a.season - b.season);
  const highs = [...(ranking.data?.seasonHighs ?? [])].sort((a, b) => a.season - b.season);
  const ranks = highs.map(x => x.best);
  const minRank = ranks.length ? Math.min(...ranks) : 1;
  const maxRank = ranks.length ? Math.max(...ranks) : 1;
  const points = highs.map((x, i) => ({
    x: 40 + i * (620 / Math.max(highs.length - 1, 1)),
    y: maxRank === minRank ? 104 : 42 + ((x.best - minRank) / (maxRank - minRank)) * 112,
    season: x.season, rank: x.best,
  }));
  const stats = facts.data?.statistics;
  const performance = facts.data?.performance;
  const maxEvents = Math.max(...results.map(x => x.events), 1);
  const loading = facts.isLoading || ranking.isLoading;
  if (loading) return <div className="pdc-card"><CareerLoading label="Loading your performance record" /></div>;
  if (facts.error) return <CareerError error={facts.error} onRetry={() => facts.refetch()} />;
  if (ranking.error) return <CareerError error={ranking.error} onRetry={() => ranking.refetch()} />;
  if (!facts.data || !stats || !performance) return <CareerEmptyState title="Performance data is not available yet" />;
  const bestFinish = stats.bestFinish;
  const bestLabel = bestFinish ? (bestFinish.position === 1 ? "Champion" : ordinal(bestFinish.position)) : "—";
  const cards = [
    ["MATCHES", stats.matchesPlayed, "recorded matches"],
    ["WIN RATE", stats.winPercentage == null ? "—" : `${stats.winPercentage}%`, `${stats.wins} wins · ${stats.losses} defeats`],
    ["EVENTS", stats.eventsEntered, `${stats.titles} titles won`],
    ["WORLD HIGH", ranking.data?.careerHigh ? ordinal(ranking.data.careerHigh.position) : "—", "published ranking"],
  ] as const;
  const figures = [
    ["3-dart average", performance.threeDartAverage == null ? "—" : performance.threeDartAverage.toFixed(1)],
    ["Highest checkout", performance.highestCheckout ?? "—"],
    ["180s", performance.maximums ?? "—"],
    ["140+ visits", performance.visits140Plus ?? "—"],
    ["100+ visits", performance.visits100Plus ?? "—"],
    ["Highest visit", performance.highestVisit ?? "—"],
    ["Checkouts completed", performance.checkoutsCompleted ?? "—"],
    ["Darts recorded", performance.darts ?? "—"],
  ];
  return <main className="cp-live">
    <header className="cp-live-hero" style={{ backgroundImage: "linear-gradient(90deg,rgba(5,7,11,.96) 3%,rgba(5,7,11,.72) 55%,rgba(5,7,11,.18)),url('/assets/career-performance-stage.jpg')" }}>
      <div className="cp-live-top"><span>TKDL <i /> MY CAREER</span><span className="cp-live-season">{retired ? "CAREER COMPLETE" : "ACTIVE CAREER"} <b>S{season} · W{week}</b></span></div>
      <div className="cp-live-title"><span className="cp-live-kicker">MATCH NIGHT · PERFORMANCE REPORT</span><h1>Your game,<br/><em>in the numbers.</em></h1>
        <p>Every completed match, event and ranking in your Career, recorded from the oche.</p></div>
      <div className="cp-live-stats">{cards.map(([label,value,note]) => <div key={label}><small>{label}</small><strong>{value}</strong><span>{note}</span></div>)}</div>
    </header>
    <nav className="cp-live-nav" aria-label="Performance report sections"><a href="#cp-seasons">01 <span>Season evidence</span></a><a href="#cp-record">02 <span>Career record</span></a><a href="#cp-playing">03 <span>Playing statistics</span></a></nav>
    <section className="cp-live-section" id="cp-seasons">
      <div className="cp-live-section-heading"><div><span>01 / THE CAMPAIGN</span><h2>Season by season</h2></div><p>Only completed results and published ranking records are shown.</p></div>
      <div className="cp-live-charts">
        <article className="cp-live-card cp-live-rank"><div className="cp-live-card-head"><span>WORLD RANKING</span><b>SEASON HIGH · LOWER IS BETTER</b></div>
          {highs.length ? <svg viewBox="0 0 700 210" role="img" aria-label={`Career World Ranking season highs: ${highs.map(x => `season ${x.season}, ${ordinal(x.best)}`).join("; ")}`}>
            <defs><linearGradient id="cpRankLine" x1="0" x2="1"><stop stopColor="#f1c96c"/><stop offset="1" stopColor="#e45b68"/></linearGradient></defs>
            <line x1="30" y1="170" x2="670" y2="170" className="cp-gridline"/>
            {points.length > 1 && <polyline points={points.map(p => `${p.x},${p.y}`).join(" ")} className="cp-rank-line"/>}
            {points.map(p => <g key={p.season}><circle cx={p.x} cy={p.y} r="6" className="cp-rank-dot"/><text x={p.x} y={p.y-14} className="cp-value" textAnchor="middle">{ordinal(p.rank)}</text><text x={p.x} y="194" className="cp-axis" textAnchor="middle">S{p.season}</text></g>)}
          </svg> : <p className="cp-live-empty">No published ranking history recorded yet.</p>}
        </article>
        <article className="cp-live-card"><div className="cp-live-card-head"><span>EVENT RESULTS</span><b>GOLD MARKS TITLES</b></div>
          {results.length ? <div className="cp-bars">{results.map(row => <div className="cp-bar-col" key={row.season} aria-label={`Season ${row.season}: ${row.events} results, ${row.titles} titles`}>
            <strong>{row.events}</strong><div className="cp-bar" style={{height:`${Math.max(10,row.events/maxEvents*100)}%`}}><i style={{height:`${row.events?row.titles/row.events*100:0}%`}}/></div><small>S{row.season}</small><span>{row.titles} titles</span></div>)}</div> : <p className="cp-live-empty">Completed event results will appear here as your Career progresses.</p>}
        </article>
      </div>
    </section>
    <section className="cp-live-section cp-live-record" id="cp-record">
      <div className="cp-live-section-heading"><div><span>02 / CAREER RECORD</span><h2>Built match by match</h2></div><span className="cp-live-seal">OFFICIAL<br/>CAREER RECORD</span></div>
      <div className="cp-live-record-grid">
        <article className="cp-live-card cp-live-best"><span>BEST EVENT FINISH</span><strong>{bestLabel}</strong><b>{bestFinish?.name ?? "No event result recorded"}</b><small>{bestFinish ? `Season ${bestFinish.season} · ${bestFinish.country}` : "Your first result will appear here."}</small></article>
        <article className="cp-live-card cp-live-milestones"><div><small>RUNNERS-UP</small><strong>{stats.runnersUp}</strong></div><div><small>SEMI-FINALS</small><strong>{stats.semiFinals}</strong></div><div><small>QUARTER-FINALS</small><strong>{stats.quarterFinals}</strong></div><div><small>CURRENT WIN STREAK</small><strong>{stats.currentWinningStreak ?? "—"}</strong></div><div><small>LONGEST WIN STREAK</small><strong>{stats.longestWinningStreak ?? "—"}</strong></div><div><small>SEASONS WITH PLAY</small><strong>{stats.seasonsPlayed}</strong></div></article>
      </div>
    </section>
    <section className="cp-live-section cp-live-playing" id="cp-playing">
      <div className="cp-live-section-heading"><div><span>03 / SCORING EVIDENCE</span><h2>The game behind the results</h2></div><p>{performance.recordedMatches} matches with recorded darts · {performance.unavailableMatches} without dart-level data</p></div>
      <div className="cp-live-figures">{figures.map(([label,value],i)=><article className={`cp-live-figure cp-tone-${i%3}`} key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <p className="cp-live-footnote">A missing figure means the scorer did not record that evidence. Checkout attempts are not currently available; no values are estimated.</p>
    </section>
  </main>;
}

/** Milestone eras use the venue plates already used by Career broadcast backdrops. */
export function CareerEras({ ctx }: { ctx: ShellContext }) {
  const cards = useTourCard(ctx.save.id);
  const facts = useCareerFacts(ctx.save.id);
  if (cards.isLoading || facts.isLoading) return <CareerLoading label="Reading Career eras" />;
  if (cards.error) return <CareerError error={cards.error} onRetry={() => cards.refetch()} />;
  if (facts.error) return <CareerError error={facts.error} onRetry={() => facts.refetch()} />;
  const stageSeasons = [...new Set((facts.data?.results ?? [])
    .filter(r => ["MAJOR", "WORLD_CHAMPIONSHIP", "EUROPEAN_SERIES", "WORLD_SERIES", "INVITATIONAL"].includes(r.circuit))
    .map(r => r.season))].sort((a, b) => a - b);
  const cardHistory = cards.data?.history ?? [];
  const firstCard = cardHistory.length ? Math.min(...cardHistory.map(c => c.term.startSeason)) : null;
  const amateurEnd = firstCard === null ? ctx.save.currentSeason : firstCard - 1;
  const eras: { title: string; period: string; venue: "community-hall" | "professional-floor" | "major-arena"; detail: string }[] = [];
  if (amateurEnd >= 1) eras.push({ title: "Amateur circuit", period: `S1–S${amateurEnd}`, venue: "community-hall", detail: "County and national halls · routes to the card" });
  for (const card of cardHistory) eras.push({
    title: card.status === "ACTIVE" ? "Tour Card season" : "Tour Card term",
    period: `S${card.term.startSeason}–S${card.term.endSeason}`, venue: "professional-floor",
    detail: card.status === "ACTIVE" ? "Professional floor · card currently active" : `${card.source.replaceAll("_", " ").toLowerCase()} · ${card.status.toLowerCase()}`,
  });
  if (stageSeasons.length) eras.push({
    title: "Televised stage", period: `S${stageSeasons[0]}${stageSeasons.length > 1 ? `–S${stageSeasons[stageSeasons.length - 1]}` : ""}`,
    venue: "major-arena", detail: `${stageSeasons.length} season${stageSeasons.length === 1 ? "" : "s"} with major, series or World Championship results`,
  });
  if (!eras.length) return null;
  return <CareerSection title="Career eras" accent="#d3ad62"><div className="career-eras">
    {eras.map((era, i) => {
      const plate = PLATES[era.venue];
      return <article className="career-era" key={`${era.title}-${era.period}`} style={{ backgroundImage: `linear-gradient(90deg,rgba(9,13,18,.96),rgba(9,13,18,.5)),url("${plate.src}")` }}>
        <span className="career-era__index">ERA {String(i + 1).padStart(2, "0")}</span><strong>{era.title}</strong><b>{era.period}</b><small>{era.detail}</small>
      </article>;
    })}
  </div></CareerSection>;
}
