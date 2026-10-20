import { useCareerFacts, useRankingHistory, useTourCard } from "../api";
import { CareerEmptyState, CareerError, CareerLoading, CareerSection } from "../components";
import { PLATES } from "../atmosphere";
import { ordinal } from "../model";
import type { ShellContext } from "../shell";
import "./career-trends.css";

/** Season-level chart from recorded ranking publications and completed event results. */
export function CareerPerformanceTrend({ saveId }: { saveId: string }) {
  const facts = useCareerFacts(saveId);
  // The Career API caps one request at 200 snapshots. Season highs are returned
  // independently of this cap, so 200 keeps this chart complete without a 400.
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
  const chartWidth = Math.max(800, 108 + Math.max(highs.length - 1, 0) * 90);
  const plotWidth = chartWidth - 108;
  const points = highs.map((x, i) => ({
    x: 54 + i * (plotWidth / Math.max(highs.length - 1, 1)),
    y: maxRank === minRank ? 103 : 164 - ((x.best - minRank) / (maxRank - minRank)) * 108,
    season: x.season, rank: x.best,
  }));
  const line = points.map(p => `${p.x},${p.y}`).join(" ");
  const maxEvents = Math.max(...results.map(x => x.events), 1);
  const loading = facts.isLoading || ranking.isLoading;
  return <CareerSection title="Performance over time" accent="#69b8ec">
    <p className="career-trend-intro">Published World Ranking highs and completed event results, season by season. Only recorded values are plotted.</p>
    {loading && <CareerLoading label="Loading season evidence" />}
    {facts.error && <CareerError error={facts.error} onRetry={() => facts.refetch()} />}
    {ranking.error && <CareerError error={ranking.error} onRetry={() => ranking.refetch()} />}
    {!loading && !facts.error && !ranking.error && <div className="career-trend-grid">
      <section className="career-trend-chart" aria-label="World Ranking season highs">
        <div className="career-trend-chart__heading"><strong>WORLD RANKING HIGH</strong><span>Lower position is better</span></div>
        {highs.length ? <div className="career-trend-svg-wrap"><svg viewBox={`0 0 ${chartWidth} 220`} style={{ minWidth: highs.length > 8 ? `${chartWidth}px` : undefined }} role="img" aria-label={`World Ranking season highs: ${highs.map(s => `season ${s.season}, ${ordinal(s.best)}`).join("; ")}`}>
          <line x1="48" y1="164" x2={chartWidth - 30} y2="164" className="career-chart-axis" /><line x1="48" y1="42" x2="48" y2="164" className="career-chart-axis" />
          <text x="4" y="50" className="career-chart-label">{ordinal(minRank)}</text><text x="4" y="163" className="career-chart-label">{ordinal(maxRank)}</text>
          {points.length > 1 && <polyline points={line} className="career-chart-line" />}
          {points.map(p => <g key={p.season}><circle cx={p.x} cy={p.y} r="5" className="career-chart-point" />
            <text x={p.x} y="191" textAnchor="middle" className="career-chart-label">S{p.season}</text>
            <text x={p.x} y={p.y - 12} textAnchor="middle" className="career-chart-value">{ordinal(p.rank)}</text></g>)}
        </svg></div> : <CareerEmptyState title="No World Ranking history yet">Published ranking snapshots appear here once recorded for this Career.</CareerEmptyState>}
      </section>
      <section className="career-trend-chart" aria-label="Completed event results by season">
        <div className="career-trend-chart__heading"><strong>COMPLETED EVENT RESULTS</strong><span>Gold marks titles</span></div>
        {results.length ? <div className="career-result-bars">{results.map(row => <div className="career-result-season" key={row.season}
          aria-label={`Season ${row.season}: ${row.events} completed events, ${row.titles} titles`}>
          <div className="career-result-count">{row.events}</div>
          <div className="career-result-bar" style={{ height: `${Math.max(8, row.events / maxEvents * 100)}%` }}>
            <i style={{ height: `${row.events ? row.titles / row.events * 100 : 0}%` }} />
          </div><small>S{row.season}</small><span>{row.titles} title{row.titles === 1 ? "" : "s"}</span>
        </div>)}</div> : <CareerEmptyState title="No completed event results yet">Completed event results will appear here as your campaign advances.</CareerEmptyState>}
      </section>
    </div>}
    <p className="career-trend-note">Ranking marks show recorded season highs. Results count completed event records only; no gaps are filled and no values are estimated.</p>
  </CareerSection>;
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
