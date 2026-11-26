import { useMemo, useState } from "react";
import { useFetch } from "@/hooks/use-fetch";
import { Chapter, PmCard } from "@/components/premium/Premium";

type Cell = { seg: number; mult: number; n: number };
const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const MIN_DARTS = 100;
// Board proportions (outer double wire = 1)
const R = { bull: 6.35 / 170, outer: 15.9 / 170, tIn: 99 / 170, tOut: 107 / 170, dIn: 162 / 170, dOut: 1 };

/** Cold to hot: deep violet, magenta, pink, gold. */
function heat(t: number) {
  if (t <= 0) return "rgba(255,255,255,0.035)";
  const stops = [[60, 30, 110], [168, 40, 200], [255, 40, 120], [255, 120, 70], [255, 214, 80]];
  const x = Math.min(0.999, t) * (stops.length - 1), i = Math.floor(x), f = x - i, a = stops[i], b = stops[i + 1];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const arc = (cx: number, cy: number, r0: number, r1: number, a0: number, a1: number) => {
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  return `M${p(r0, a0)} L${p(r1, a0)} A${r1},${r1} 0 0 1 ${p(r1, a1)} L${p(r0, a1)} A${r0},${r0} 0 0 0 ${p(r0, a0)} Z`;
};

/** Where a player's darts land, ring by ring, with a doubles report under it. */
export function DartMap({ playerId, own }: { playerId: number; own: boolean }) {
  const { data } = useFetch<{ total: number; misses: number; cells: Cell[] }>(`/api/players/${playerId}/dart-map`);
  const [mode, setMode] = useState<"all" | "doubles">("all");
  const get = useMemo(() => { const m = new Map((data?.cells ?? []).map(c => [`${c.seg}|${c.mult}`, c.n])); return (s: number, x: number) => m.get(`${s}|${x}`) ?? 0; }, [data]);
  if (!data || data.total < MIN_DARTS) return null;
  const doubles = ORDER.map(s => ({ seg: s, n: get(s, 2) })).concat([{ seg: 25, n: get(25, 2) }]);
  const dTotal = doubles.reduce((n, d) => n + d.n, 0);
  const shown = (s: number, x: number) => mode === "doubles" && !(x === 2) ? 0 : get(s, x);
  const max = Math.max(1, ...ORDER.flatMap(s => [1, 2, 3].map(x => shown(s, x))), shown(25, 1), shown(25, 2));
  const S = 300, c = S / 2, rr = c - 22, step = (Math.PI * 2) / 20;
  const byHits = [...doubles].filter(d => d.seg !== 25).sort((a, b) => b.n - a.n);
  const label = (s: number) => s === 25 ? "Bull" : `D${s}`;
  const name = own ? "your" : "their";
  const t20 = get(20, 3), trebles = ORDER.reduce((n, s) => n + get(s, 3), 0);
  return (
    <section id="pm-dartmap" style={{ scrollMarginTop: 64 }}>
      <Chapter title="Dart map" accent="#ff5c93" aside={<span className="pm-chip">{data.total.toLocaleString("en-GB")} darts</span>} />
      <PmCard accent="#ff5c93" className="p-4">
        <div className="pm-seg" style={{ position: "relative", zIndex: 1 }}>
          {(["all", "doubles"] as const).map(m => <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{m === "all" ? "Every dart" : "Doubles"}</button>)}
        </div>
        <svg viewBox={`0 0 ${S} ${S}`} className="pm-dartmap" style={{ position: "relative", zIndex: 1 }}>
          <defs><radialGradient id="dmGlow"><stop offset="0%" stopColor="rgba(255,92,147,.25)" /><stop offset="100%" stopColor="rgba(255,92,147,0)" /></radialGradient></defs>
          <circle cx={c} cy={c} r={c - 2} fill="url(#dmGlow)" />
          <circle cx={c} cy={c} r={rr + 16} fill="#0b0912" stroke="rgba(255,255,255,.12)" />
          {ORDER.map((s, i) => {
            const a0 = -Math.PI / 2 + (i - 0.5) * step, a1 = a0 + step;
            const ring = (r0: number, r1: number, x: number) => <path key={x + "-" + r0} d={arc(c, c, r0 * rr, r1 * rr, a0, a1)} fill={heat(shown(s, x) / max)} stroke="rgba(10,8,16,.9)" strokeWidth={0.8} />;
            const la = -Math.PI / 2 + i * step;
            return <g key={s}>
              {ring(R.outer, R.tIn, 1)}{ring(R.tIn, R.tOut, 3)}{ring(R.tOut, R.dIn, 1)}{ring(R.dIn, R.dOut, 2)}
              <text x={c + (rr + 9) * Math.cos(la)} y={c + (rr + 9) * Math.sin(la)} textAnchor="middle" dominantBaseline="central" className="num">{s}</text>
            </g>;
          })}
          <circle cx={c} cy={c} r={R.outer * rr} fill={heat(shown(25, 1) / max)} stroke="rgba(10,8,16,.9)" />
          <circle cx={c} cy={c} r={R.bull * rr} fill={heat(shown(25, 2) / max)} stroke="rgba(10,8,16,.9)" />
        </svg>
        <div className="pm-heatkey" style={{ position: "relative", zIndex: 1 }}><span>Rarely</span><i /><span>Most</span></div>
        {mode === "all" ? (
          <div className="grid grid-cols-3 gap-2 mt-3" style={{ position: "relative", zIndex: 1 }}>
            <div className="pm-dm-stat"><b>{Math.round(trebles / data.total * 100)}%</b><span>in a treble</span></div>
            <div className="pm-dm-stat"><b>{Math.round(t20 / data.total * 100)}%</b><span>in T20</span></div>
            <div className="pm-dm-stat"><b>{Math.round(data.misses / data.total * 100)}%</b><span>off the board</span></div>
          </div>
        ) : (
          <div className="mt-3 space-y-2" style={{ position: "relative", zIndex: 1 }}>
            <p className="text-xs" style={{ color: "#a9a4bd" }}>{dTotal} darts landed in a double. Where {name} doubles go:</p>
            <div className="pm-dm-row"><span className="k">Most hit</span>{byHits.slice(0, 3).filter(d => d.n > 0).map(d => <span key={d.seg} className="chip hot">{label(d.seg)} · {d.n}</span>)}</div>
            <div className="pm-dm-row"><span className="k">Least hit</span>{byHits.slice(-3).reverse().map(d => <span key={d.seg} className="chip cold">{label(d.seg)} · {d.n}</span>)}</div>
            {own && byHits.at(-1) && <p className="text-xs" style={{ color: "#ffc2d6" }}>Worth a session on {label(byHits.at(-1)!.seg)}: Round the Clock (Doubles) and Pick a Double are good for it.</p>}
          </div>
        )}
        <p className="text-[11px] mt-3" style={{ color: "rgba(255,255,255,.35)", position: "relative", zIndex: 1 }}>From practice games and league matches played dart by dart on the scorer (league darts count from this update on).</p>
      </PmCard>
    </section>
  );
}
