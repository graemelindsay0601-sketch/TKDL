/**
 * Premium kit: the shared "match night" look (see styles/premium.css).
 * Chapters number themselves; cards take an accent colour for their glowing edge.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

type Acc = { accent?: string };
const accVar = (accent?: string) => (accent ? ({ ["--pm-acc" as string]: accent } as CSSProperties) : {});

export function PmCard({ accent, className = "", style, children, id }: Acc & { className?: string; style?: CSSProperties; children: ReactNode; id?: string }) {
  return <div id={id} className={`pm-card ${className}`} style={{ ...accVar(accent), ...style }}>{children}</div>;
}

/** A numbered chapter heading. Put it straight before its card(s); `id` makes it a jump-bar target. */
export function Chapter({ title, aside, accent, id, onClick, children }: Acc & { title: ReactNode; aside?: ReactNode; id?: string; onClick?: () => void; children?: ReactNode }) {
  const body = (
    <>
      <div style={{ position: "relative", zIndex: 1, minWidth: 0 }}>
        <div className="pm-kicker" />
        <h2 className="pm-metal">{title}</h2>
      </div>
      {(aside || children) && <div className="pm-aside">{aside}{children}</div>}
    </>
  );
  return onClick
    ? <button type="button" id={id} onClick={onClick} className="pm-chapter w-full text-left" style={{ ...accVar(accent), background: "none", border: 0, scrollMarginTop: 64 }}>{body}</button>
    : <div id={id} className="pm-chapter" style={{ ...accVar(accent), scrollMarginTop: 64 }}>{body}</div>;
}

export function Ring({ value, color, size = 40, width = 4, children }: { value: number; color: string; size?: number; width?: number; children?: ReactNode }) {
  const r = (size - width) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, value));
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={width} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      {children && <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>}
    </div>
  );
}

export function Bar({ value, color }: { value: number; color: string }) {
  const p = Math.max(0, Math.min(1, value));
  return (
    <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,.07)", overflow: "hidden" }}>
      <i style={{ display: "block", height: "100%", width: `${p * 100}%`, borderRadius: 3, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: p > 0 ? `0 0 8px ${color}` : undefined }} />
    </div>
  );
}

export function Dots({ count, total = 10, color }: { count: number; total?: number; color: string }) {
  const n = Math.max(0, Math.min(total, count));
  return (
    <div style={{ display: "flex", gap: 3 }} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => <i key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i < n ? color : "rgba(255,255,255,.1)", boxShadow: i < n ? `0 0 5px ${color}` : undefined }} />)}
    </div>
  );
}

export function Spark({ values, color, width = 70, height = 22 }: { values: number[]; color: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values), n = values.length - 1;
  const pts = values.map((v, i) => `${(i * width / n).toFixed(1)},${(height - 2 - ((v - lo) / (hi - lo || 1)) * (height - 4)).toFixed(1)}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={{ flex: "none" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
    </svg>
  );
}

/** One stat: label with a coloured dot, a big gradient number, then an optional visual and note. */
export function Tile({ label, value, color = "#e4e0f0", viz, note }: { label: ReactNode; value: ReactNode; color?: string; viz?: ReactNode; note?: ReactNode }) {
  return (
    <div className="pm-tile">
      <span className="pm-lab"><i style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, flex: "none" }} />{label}</span>
      <span className="pm-num pm-val" style={{ background: `linear-gradient(180deg, #fff 20%, ${color})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{value}</span>
      {viz}
      {note && <span style={{ fontSize: 11, color: "#8b86a0" }}>{note}</span>}
    </div>
  );
}

/** Tiles in a glowing card with hairlines between them. `cols` per breakpoint: [phone, wide]. */
export function TileGrid({ children, cols = [3, 6], accent }: Acc & { children: ReactNode[]; cols?: [number, number] }) {
  const [wide, setWide] = useState(typeof window !== "undefined" && window.innerWidth >= 640);
  useEffect(() => { const on = () => setWide(window.innerWidth >= 640); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, []);
  const n = wide ? cols[1] : cols[0];
  const items = children.filter(Boolean);
  return (
    <PmCard accent={accent}>
      <div className={`pm-tiles${n >= 4 && !wide ? " dense" : ""}`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {items.map((c, i) => (
          <div key={i} style={{ minWidth: 0, borderRight: i % n !== n - 1 ? "1px solid rgba(255,255,255,.07)" : undefined, borderTop: i >= n ? "1px solid rgba(255,255,255,.07)" : undefined }}>{c}</div>
        ))}
      </div>
    </PmCard>
  );
}

/** Sticky row of chips that scroll to chapters by id; highlights the one in view. */
export function JumpBar({ items }: { items: { id: string; label: string }[] }) {
  const [on, setOn] = useState(items[0]?.id);
  useEffect(() => {
    const els = items.map(i => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(entries => {
      const top = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setOn(top.target.id);
    }, { rootMargin: "-80px 0px -60% 0px" });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  return (
    <nav className="pm-jump" aria-label="Jump to section">
      {items.map(i => (
        <button key={i.id} type="button" className={on === i.id ? "on" : ""} onClick={() => { setOn(i.id); document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{i.label}</button>
      ))}
    </nav>
  );
}

/** Faint dartboard (wedges and rings) for hero backdrops. */
export function DartboardBackdrop({ size = 520, opacity = 0.07, style }: { size?: number; opacity?: number; style?: CSSProperties }) {
  const r = size / 2;
  const wedges = Array.from({ length: 10 }, (_, k) => {
    const i = k * 2, a0 = ((i * 18 - 9) * Math.PI) / 180, a1 = ((i * 18 + 9) * Math.PI) / 180;
    return `M${r},${r} L${r + r * Math.cos(a0)},${r + r * Math.sin(a0)} A${r},${r} 0 0 1 ${r + r * Math.cos(a1)},${r + r * Math.sin(a1)} Z`;
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ position: "absolute", pointerEvents: "none", ...style }}>
      {wedges.map((d, i) => <path key={i} d={d} fill="#fff" fillOpacity={opacity * 0.6} />)}
      {[[1, 2], [0.94, 6], [0.62, 5], [0.56, 1.5], [0.12, 3], [0.05, 6]].map(([k, w], i) => <circle key={i} cx={r} cy={r} r={r * k} fill="none" stroke="#fff" strokeOpacity={opacity * 1.6} strokeWidth={w} />)}
    </svg>
  );
}

export function Glow({ x, y, color, size = 420, opacity = 0.28 }: { x: number | string; y: number | string; color: string; size?: number; opacity?: number }) {
  return <div className="pm-glow" style={{ left: x, top: y, width: size, height: size, transform: "translate(-50%,-50%)", background: `radial-gradient(circle, ${color} 0%, transparent 65%)`, opacity }} />;
}
