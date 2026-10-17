import { useEffect, useRef, useState } from "react";
import { useFinanceWeeks, type FinanceWeek } from "./api";
import { formatPence } from "./model";

/** Gain / loss (validated diverging pair for the dark career surface). */
const GAIN = "#3987e5", LOSS = "#e66767";
const signed = (pence: number) => `${pence > 0 ? "+" : pence < 0 ? "−" : ""}${formatPence(Math.abs(pence))}`;
const nights = (n: number) => `${n} event${n === 1 ? "" : "s"}`;

/** "Last week: 3 events · spent £13 · won £28 (+£15)": the darts money from the week just played. */
export function LastWeekMoney({ saveId, currentWeek }: { saveId: string; currentWeek: number }) {
  const weeks = useFinanceWeeks(saveId);
  const last = weeks.data?.weeks.find(w => w.week === currentWeek - 1);
  if (!last || (!last.events && !last.spentPence && !last.wonPence)) return null;
  return <p className="week-money-line" data-tone={last.dartsNetPence > 0 ? "up" : last.dartsNetPence < 0 ? "down" : "flat"}>
    <b>Last week:</b> {nights(last.events)} · spent {formatPence(last.spentPence)} · won {formatPence(last.wonPence)} <strong>({signed(last.dartsNetPence)})</strong>
  </p>;
}

/**
 * Season so far, week by week: darts money won minus darts money spent (entries, travel, stays). One axis, bars up for a
 * week that paid and down for one that cost; sponsor money is shown separately, never mixed in. Hover or focus a bar for the week.
 */
export function SeasonMoneyChart({ saveId }: { saveId: string }) {
  const q = useFinanceWeeks(saveId);
  const [hover, setHover] = useState<FinanceWeek | null>(null);
  // Drawn at its real width so axis text stays 10px on a phone and on a desktop alike.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [q.data]);
  if (!q.data) return null;
  const weeks = q.data.weeks;
  const total = weeks.reduce((t, w) => ({ spent: t.spent + w.spentPence, won: t.won + w.wonPence, events: t.events + w.events }), { spent: 0, won: 0, events: 0 });
  if (!weeks.some(w => w.spentPence || w.wonPence)) return <p className="season-money__empty">No darts money in or out yet this season.</p>;
  const W = width, H = 180, pad = { l: 44, r: 8, t: 10, b: 22 };
  const max = Math.max(1, ...weeks.map(w => Math.abs(w.dartsNetPence)));
  const plotH = H - pad.t - pad.b, zero = pad.t + plotH / 2, scale = (plotH / 2) / max;
  const slot = (W - pad.l - pad.r) / 52, bar = Math.max(2, slot - 2);
  const tick = (v: number) => zero - v * scale;
  const shown = hover ?? null;
  return (
    <div className="season-money">
      <div className="season-money__tiles">
        <div><small>Spent on darts</small><strong>{formatPence(total.spent)}</strong></div>
        <div><small>Won</small><strong>{formatPence(total.won)}</strong></div>
        <div><small>Darts money, net</small><strong>{signed(total.won - total.spent)}</strong></div>
        <div><small>Events played</small><strong>{total.events}</strong></div>
      </div>
      <ul className="season-money__legend" aria-hidden="true">
        <li><i style={{ background: GAIN }} /> Week won more than it cost</li>
        <li><i style={{ background: LOSS }} /> Week cost more than it won</li>
      </ul>
      <div className="season-money__plot" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Darts money by week, season so far: net ${signed(total.won - total.spent)}`} onMouseLeave={() => setHover(null)}>
          {[max, 0, -max].map(v => <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={tick(v)} y2={tick(v)} stroke={v === 0 ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.08)"} strokeWidth={1} />
            <text x={pad.l - 6} y={tick(v) + 3} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.55)">{v === 0 ? "£0" : signed(v)}</text>
          </g>)}
          {(W < 420 ? [1, 26, 52] : [1, 13, 26, 39, 52]).map(w => <text key={w} x={w === 1 ? pad.l : w === 52 ? W - pad.r : pad.l + (w - 0.5) * slot} y={H - 6} textAnchor={w === 1 ? "start" : w === 52 ? "end" : "middle"} fontSize="10" fill="rgba(255,255,255,0.55)">Wk {w}</text>)}
          {weeks.map(w => {
            const x = pad.l + (w.week - 1) * slot + (slot - bar) / 2, h = Math.abs(w.dartsNetPence) * scale, up = w.dartsNetPence >= 0;
            const r = Math.min(4, h / 2, bar / 2);
            // Rounded at the data end only, anchored square on the zero line.
            const d = h <= 0 ? "" : up
              ? `M${x},${zero} V${zero - h + r} Q${x},${zero - h} ${x + r},${zero - h} H${x + bar - r} Q${x + bar},${zero - h} ${x + bar},${zero - h + r} V${zero} Z`
              : `M${x},${zero} V${zero + h - r} Q${x},${zero + h} ${x + r},${zero + h} H${x + bar - r} Q${x + bar},${zero + h} ${x + bar},${zero + h - r} V${zero} Z`;
            return <g key={w.week}>
              {d && <path d={d} fill={up ? GAIN : LOSS} opacity={shown && shown.week !== w.week ? 0.45 : 1} />}
              <rect x={pad.l + (w.week - 1) * slot} y={pad.t} width={slot} height={plotH} fill="transparent" tabIndex={0}
                aria-label={`Week ${w.week}: ${nights(w.events)}, spent ${formatPence(w.spentPence)}, won ${formatPence(w.wonPence)}, net ${signed(w.dartsNetPence)}`}
                onMouseEnter={() => setHover(w)} onFocus={() => setHover(w)} onBlur={() => setHover(null)} />
            </g>;
          })}
        </svg>
        <p className="season-money__tip" aria-live="polite">{shown
          ? <><b>Week {shown.week}</b> · {nights(shown.events)} · spent {formatPence(shown.spentPence)} · won {formatPence(shown.wonPence)} · <strong>{signed(shown.dartsNetPence)}</strong>{shown.sponsorPence ? <> · sponsor {formatPence(shown.sponsorPence)}</> : null}</>
          : "Hover or tap a week for its figures."}</p>
      </div>
      <details className="season-money__table">
        <summary>Show as a table</summary>
        <table>
          <thead><tr><th scope="col">Week</th><th scope="col">Events</th><th scope="col">Spent</th><th scope="col">Won</th><th scope="col">Net</th></tr></thead>
          <tbody>{weeks.filter(w => w.events || w.spentPence || w.wonPence).map(w => <tr key={w.week}>
            <td>{w.week}</td><td>{w.events}</td><td>{formatPence(w.spentPence)}</td><td>{formatPence(w.wonPence)}</td><td>{signed(w.dartsNetPence)}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
