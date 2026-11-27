import { useState } from "react";
import { useDartStats, type DartStats } from "../api";
import { CareerError, CareerLoading } from "../components";
import "./dart-stats.css";

const fmt = (n: number | null | undefined, digits = 1) => n === null || n === undefined ? "—" : n.toFixed(digits);
const pctText = (n: number | null) => n === null ? "—" : `${n.toFixed(1)}%`;

/** "At the double": checkout rate per double, first-9, deciders: from every dart you've thrown in this Career. */
export function DartStatsSection({ saveId }: { saveId: string }) {
  const stats = useDartStats(saveId);
  const [range, setRange] = useState<"thisSeason" | "career">("career");
  if (stats.isLoading) return <section className="cp-live-section" id="cp-doubles"><CareerLoading label="Reading your darts" /></section>;
  if (stats.error) return <section className="cp-live-section" id="cp-doubles"><CareerError error={stats.error} onRetry={() => stats.refetch()} /></section>;
  if (!stats.data) return null;
  const s: DartStats = stats.data[range];
  const maxAttempts = Math.max(1, ...s.doubles.map(d => d.attempts));
  const shown = s.doubles.slice(0, 12);
  return <section className="cp-live-section ds" id="cp-doubles">
    <div className="cp-live-section-heading"><div><span>04 / AT THE DOUBLE</span><h2>Every dart, counted</h2></div>
      <div className="ds-range" role="group" aria-label="Which matches">
        <button type="button" aria-pressed={range === "career"} onClick={() => setRange("career")}>Whole Career</button>
        <button type="button" aria-pressed={range === "thisSeason"} onClick={() => setRange("thisSeason")}>Season {stats.data.season}</button>
      </div></div>
    {!s.matches ? <p className="cp-live-empty">Play a match on the scorer (a tournament match or a money match) and your doubles, first-9 and deciders show up here.</p> : <>
      <div className="cp-live-figures">
        {([["Checkout rate", pctText(s.checkout.percent), `${s.checkout.hits} of ${s.checkout.attempts} darts at a double`],
          ["First-9 average", fmt(s.first9Average), `match average ${fmt(s.average)}`],
          ["Deciding legs", s.deciders.played ? `${s.deciders.won}/${s.deciders.played}` : "—", s.deciders.average === null ? "none played yet" : `average ${fmt(s.deciders.average)} in deciders`],
          ["Best leg", s.bestLeg === null ? "—" : `${s.bestLeg} darts`, "fewest darts to win a 501 leg"],
          ["Favourite double", s.favouriteDouble?.double ?? "—", s.favouriteDouble ? `${pctText(s.favouriteDouble.percent)} from ${s.favouriteDouble.attempts} darts` : `needs ${s.minimumAttempts}+ darts at one double`],
          ["Weakest double", s.weakestDouble?.double ?? "—", s.weakestDouble ? `${pctText(s.weakestDouble.percent)} from ${s.weakestDouble.attempts} darts` : `needs ${s.minimumAttempts}+ darts at two doubles`],
        ] as const).map(([label, value, note], i) => <article className={`cp-live-figure cp-tone-${i % 3}`} key={label}><span>{label}</span><strong>{value}</strong><small className="ds-note">{note}</small></article>)}
      </div>
      <div className="ds-grid">
        <article className="cp-live-card"><div className="cp-live-card-head"><span>DOUBLES YOU GO FOR</span><b>MOST DARTS FIRST</b></div>
          {shown.length ? <ul className="ds-doubles">{shown.map(d => <li key={d.double} aria-label={`${d.double}: ${d.hits} of ${d.attempts}`}>
            <span className="ds-double">{d.double}</span>
            <span className="ds-bar"><i style={{ width: `${d.attempts / maxAttempts * 100}%` }} /><b style={{ width: `${d.hits / maxAttempts * 100}%` }} /></span>
            <span className="ds-figure">{d.hits}/{d.attempts} <small>{pctText(d.percent)}</small></span></li>)}</ul>
            : <p className="cp-live-empty">No darts at a double yet.</p>}
          <p className="ds-legend"><b /> hit <i /> attempts</p>
        </article>
        <article className="cp-live-card"><div className="cp-live-card-head"><span>CHECKOUTS</span><b>BY SIZE</b></div>
          <dl className="ds-list">
            <div><dt>Up to 40</dt><dd>{s.checkout.bySize.upTo40}</dd></div>
            <div><dt>41 to 100</dt><dd>{s.checkout.bySize.from41To100}</dd></div>
            <div><dt>Over 100</dt><dd>{s.checkout.bySize.over100}</dd></div>
            <div><dt>Highest</dt><dd>{s.checkout.highest ?? "—"}</dd></div>
          </dl>
          <div className="cp-live-card-head"><span>HEAVY SCORING</span><b>VISITS</b></div>
          <dl className="ds-list">
            <div><dt>180s</dt><dd>{s.tons["180"]}</dd></div>
            <div><dt>140 to 179</dt><dd>{s.tons["140+"]}</dd></div>
            <div><dt>100 to 139</dt><dd>{s.tons["100+"]}</dd></div>
            <div><dt>Legs won</dt><dd>{s.legsWon}/{s.legsPlayed}</dd></div>
          </dl>
        </article>
      </div>
      <p className="cp-live-footnote">From {s.matches} match{s.matches === 1 ? "" : "es"} you threw yourself ({s.darts.toLocaleString("en-GB")} darts): tournament matches on the scorer and money matches.
        Steel-tip, straight-in double-out only; quick-sims, soft-tip and double-in matches aren't counted. A dart at a double is any dart thrown while you're on a finish of 40 or less (or 50).</p>
    </>}
  </section>;
}
