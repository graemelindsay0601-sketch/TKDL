import { useState, useEffect, useRef, type ReactNode } from "react";
import { format } from "date-fns";
import { ChevronDown, CheckCircle } from "lucide-react";

// ── useCountUp ─────────────────────────────────────────────────────────────
export function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(e * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

// ── FormStrip ──────────────────────────────────────────────────────────────
export function FormStrip({ matches, playerId }: { matches: any[]; playerId: number }) {
  if (!matches?.length) return null;
  const last10 = [...matches].slice(0, 10).reverse();
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {last10.map((m: any, i: number) => {
        const isWin = m.isWin !== undefined ? m.isWin : m.winnerId === playerId;
        return (
          <div key={i}
            className="w-6 h-6 rounded flex items-center justify-center font-black"
            style={{
              background: isWin ? "rgba(34,197,94,0.18)" : "rgba(255,0,92,0.18)",
              border: `1px solid ${isWin ? "rgba(34,197,94,0.45)" : "rgba(255,0,92,0.45)"}`,
              color: isWin ? "#22c55e" : "#ff005c",
              fontFamily: "Oswald, sans-serif", fontSize: "0.6rem",
            }}>
            {isWin ? "W" : "L"}
          </div>
        );
      })}
      <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
        FORM
      </span>
    </div>
  );
}

// ── EloSparkline ───────────────────────────────────────────────────────────
export function EloSparkline({ currentElo, matches, playerId }: { currentElo: number; matches: any[]; playerId: number }) {
  const [fullHistory, setFullHistory] = useState<{ elo: number; isWin: boolean; opponent: string }[] | null>(null);

  useEffect(() => {
    fetch(`/api/players/${playerId}/elo-history`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.history) && d.history.length > 0) setFullHistory(d.history); })
      .catch(() => {});
  }, [playerId]);

  let pts: number[];
  let matchCount: number;

  if (fullHistory && fullHistory.length >= 2) {
    pts = fullHistory.map(h => h.elo);
    pts.push(currentElo);
    matchCount = fullHistory.length;
  } else {
    if (!matches || matches.length < 2) return null;
    pts = [currentElo];
    let elo = currentElo;
    for (const m of [...matches].slice(0, 15)) {
      const isWin = m.isWin !== undefined ? m.isWin : m.winnerId === playerId;
      elo = isWin ? elo - (m.eloChange ?? 16) : Math.min(elo + (m.eloChange ?? 16), 1600);
      elo = Math.max(800, elo);
      pts.unshift(elo);
    }
    matchCount = matches.length;
  }

  if (pts.length < 2) return null;

  const W = 300; const H = 80;
  const lo = Math.min(...pts) - 15;
  const hi = Math.max(...pts) + 15;
  const rng = hi - lo || 100;

  const coords = pts.map((v, i) => ({
    x: (i / (pts.length - 1)) * W,
    y: H - ((v - lo) / rng) * H,
  }));

  const path = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;
  const last = coords[coords.length - 1];
  const trending = pts[pts.length - 1] >= pts[0];
  const color = trending ? "#22c55e" : "#ff005c";
  const uid = `sg-${playerId}`;
  const minElo = Math.min(...pts);
  const maxElo = Math.max(...pts);

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>
          ELO Journey · {matchCount} matches
        </span>
        <span className="font-mono text-xs font-bold" style={{ color }}>
          {trending ? "↑" : "↓"} {currentElo}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 80, display: "block" }}>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${uid})`} />
        <path d={path} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {coords.length <= 30 && coords.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2" fill={color} opacity="0.35" />
        ))}
        <circle cx={last.x} cy={last.y} r="3.5" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <div className="flex justify-between mt-0.5">
        <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>▼ {minElo}</span>
        <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>▲ {maxElo}</span>
      </div>
    </div>
  );
}

// ── AchievementCard ────────────────────────────────────────────────────────
export const RARITY_COLORS: Record<string, { color: string; glow: string; bg: string }> = {
  Common:    { color: "#9ca3af", glow: "rgba(156,163,175,0.3)", bg: "rgba(156,163,175,0.07)" },
  Rare:      { color: "#0066ff", glow: "rgba(0,102,255,0.3)",   bg: "rgba(0,102,255,0.07)"  },
  Epic:      { color: "#a855f7", glow: "rgba(168,85,247,0.35)", bg: "rgba(168,85,247,0.08)" },
  Legendary: { color: "#ffd24a", glow: "rgba(255,210,74,0.4)",  bg: "rgba(255,210,74,0.08)" },
  Mythic:    { color: "#ff005c", glow: "rgba(255,0,92,0.4)",    bg: "rgba(255,0,92,0.08)"   },
};

export function AchievementCard({ a }: { a: any }) {
  const rc = RARITY_COLORS[a.rarity] ?? RARITY_COLORS.Common;
  const isHidden = a.hidden && !a.isUnlocked;
  const pct = Math.min(100, a.progressPct ?? 0);
  const isClose = pct >= 60 && !a.isUnlocked;
  return (
    <div className="relative rounded-lg overflow-hidden transition-all duration-200 cursor-default hover:-translate-y-0.5"
      style={{
        background: a.isUnlocked ? rc.bg : "rgba(255,255,255,0.025)",
        border: `1px solid ${a.isUnlocked ? rc.color + "55" : isClose ? rc.color + "33" : "rgba(255,255,255,0.07)"}`,
        padding: "0.625rem",
      }}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: a.isUnlocked ? rc.color : "transparent" }} />
      <div className="flex items-start gap-2.5">
        <div className={`text-2xl leading-none shrink-0 ${isHidden ? "grayscale opacity-30" : ""}`}>{isHidden ? "🔒" : a.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <div className="font-bold leading-tight" style={{ fontFamily: "Oswald, sans-serif", color: a.isUnlocked ? rc.color : isHidden ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)", fontSize: "0.7rem" }}>
              {isHidden ? "???" : a.name.replace(/^[^\s]+\s/, "")}
            </div>
            {a.isUnlocked && <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: rc.color }} />}
          </div>
          {!isHidden && (
            <div className="text-xs leading-tight mb-1" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.62rem" }}>{a.description}</div>
          )}
          {!a.isUnlocked && !isHidden && (
            <div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: isClose ? rc.color : "rgba(255,255,255,0.25)" }} />
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>
                {a.currentProgress ?? 0} / {a.criteriaValue}
              </div>
            </div>
          )}
          {a.isUnlocked && a.unlockedAt && (
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>
              {format(new Date(a.unlockedAt), "MMM d, yyyy")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── BigStat / SmallStat ────────────────────────────────────────────────────
export function BigStat({ value, label, color, suffix = "" }: { value: number; label: string; color: string; suffix?: string }) {
  const animated = useCountUp(value);
  return (
    <div className="flex flex-col items-center">
      <div className="font-black leading-none tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color, textShadow: `0 0 24px ${color}50` }}>
        {animated}{suffix}
      </div>
      <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.58rem", letterSpacing: "0.15em" }}>
        {label}
      </div>
    </div>
  );
}

export function SmallStat({ value, label, accent, suffix = "", placeholder = "0" }: { value: number | null; label: string; accent?: string; suffix?: string; placeholder?: string }) {
  const animated = useCountUp(value ?? 0);
  return (
    <div className="pdc-card p-3.5 text-center">
      <div className="text-xs uppercase tracking-widest mb-1.5 font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.22)", fontSize: "0.58rem", letterSpacing: "0.15em" }}>
        {label}
      </div>
      <div className="text-xl font-bold leading-none" style={{ fontFamily: "Oswald, sans-serif", color: value == null ? "rgba(255,255,255,0.2)" : (accent ?? "rgba(255,255,255,0.85)") }}>
        {value == null ? placeholder : `${animated}${suffix}`}
      </div>
    </div>
  );
}

// ── Tier glow lookup ──────────────────────────────────────────────────────
export const TIER_GLOW: Record<string, string> = {
  Diamond:  "#00d4ff",
  Platinum: "#e879f9",
  Gold:     "#ffd24a",
  Silver:   "#c0c8d8",
  Bronze:   "#cd7f32",
};

// ── CollapsibleSection ─────────────────────────────────────────────────────
export function CollapsibleSection({ title, icon, open, onToggle, badge, children, accentColor = "rgba(255,255,255,0.5)", extraHeader }: {
  title: string; icon: ReactNode; open: boolean; onToggle: () => void;
  badge?: string; children: ReactNode; accentColor?: string; extraHeader?: ReactNode;
}) {
  return (
    <div className="pdc-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-2 transition-colors hover:bg-white/[0.02]"
        style={{ borderBottom: open ? "1px solid rgba(255,255,255,0.07)" : "none", cursor: "pointer" }}>
        <span style={{ color: accentColor }}>{icon}</span>
        <h2 className="font-bold uppercase text-sm tracking-wider flex-1 text-left"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
          {title}
        </h2>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full font-bold"
            style={{ background: `${accentColor}22`, color: accentColor, fontFamily: "Oswald, sans-serif" }}>
            {badge}
          </span>
        )}
        {extraHeader}
        <ChevronDown className="w-4 h-4 shrink-0 transition-transform"
          style={{ color: "rgba(255,255,255,0.25)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ── X01 Scorecard types + parser ───────────────────────────────────────────
export type ScorecardDart  = { label: string; val: number; isDouble: boolean; isTreble: boolean; isMiss: boolean };
export type ScorecardVisit = { darts: ScorecardDart[]; total: number; remaining: number; isBust: boolean; isCheckout: boolean };
export type ScorecardLeg   = { legNum: number; visits: ScorecardVisit[]; dartCount: number };

function makeDartLabel(d: { seg: number; mult: number; val: number }): ScorecardDart {
  if (d.seg === 0) return { label: "MISS", val: 0, isDouble: false, isTreble: false, isMiss: true };
  if (d.seg === 25 && d.mult === 2) return { label: "BULL", val: 50, isDouble: true, isTreble: false, isMiss: false };
  if (d.seg === 25) return { label: "25", val: 25, isDouble: false, isTreble: false, isMiss: false };
  if (d.mult === 3) return { label: `T${d.seg}`, val: d.val, isDouble: false, isTreble: true, isMiss: false };
  if (d.mult === 2) return { label: `D${d.seg}`, val: d.val, isDouble: true, isTreble: false, isMiss: false };
  return { label: String(d.seg), val: d.val, isDouble: false, isTreble: false, isMiss: false };
}

export function parseX01Scorecard(darts: { seg: number; mult: number; val: number }[], startScore: number): ScorecardLeg[] {
  const legs: ScorecardLeg[] = [];
  let remaining = startScore;
  let visitStart = startScore;
  let currentLeg: ScorecardVisit[] = [];
  let visitDarts: { d: ScorecardDart; val: number }[] = [];

  function endVisit(isBust: boolean, isCheckout: boolean, finalRemaining: number) {
    currentLeg.push({
      darts: visitDarts.map(v => v.d),
      total: visitDarts.reduce((s, v) => s + v.val, 0),
      remaining: finalRemaining,
      isBust,
      isCheckout,
    });
    visitDarts = [];
  }

  for (const dart of darts) {
    const d = makeDartLabel(dart);
    const tentative = remaining - dart.val;
    visitDarts.push({ d, val: dart.val });

    if (tentative < 0 || tentative === 1) {
      endVisit(true, false, visitStart);
      remaining = visitStart;
      visitStart = remaining;
    } else if (tentative === 0) {
      endVisit(false, true, 0);
      legs.push({ legNum: legs.length + 1, visits: currentLeg, dartCount: currentLeg.reduce((s, v) => s + v.darts.length, 0) });
      currentLeg = [];
      remaining = startScore;
      visitStart = startScore;
    } else {
      remaining = tentative;
      if (visitDarts.length === 3) {
        endVisit(false, false, remaining);
        visitStart = remaining;
      }
    }
  }

  if (visitDarts.length > 0) {
    currentLeg.push({ darts: visitDarts.map(v => v.d), total: visitDarts.reduce((s, v) => s + v.val, 0), remaining, isBust: false, isCheckout: false });
  }
  if (currentLeg.length > 0) {
    legs.push({ legNum: legs.length + 1, visits: currentLeg, dartCount: currentLeg.reduce((s, v) => s + v.darts.length, 0) });
  }
  return legs;
}

export function x01StartScore(key: string): number | null {
  const m = key.match(/^(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return [101, 201, 301, 401, 501, 601, 701, 1001, 1501, 2001].includes(n) ? n : null;
}

// ── ScorecardLegView ───────────────────────────────────────────────────────
export function ScorecardLegView({ leg }: { leg: ScorecardLeg }) {
  const [open, setOpen] = useState(false);
  const checkout = leg.visits.find(v => v.isCheckout);
  const highVisit = leg.visits.reduce((best, v) => v.total > best ? v.total : best, 0);
  return (
    <div className="rounded overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.05)", marginBottom: "4px" }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-white/[0.03]"
        style={{ background: "rgba(255,255,255,0.02)" }}>
        <span className="font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#ffd24a", minWidth: "2.5rem", textAlign: "left" }}>
          Leg {leg.legNum}
        </span>
        <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "rgba(255,255,255,0.22)" }}>
          {leg.dartCount}d
        </span>
        {highVisit === 180 && (
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.48rem", color: "#ffd24a", background: "rgba(255,210,74,0.1)", padding: "1px 4px", borderRadius: "3px" }}>180</span>
        )}
        {checkout && (
          <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.48rem", color: "#4ade80", background: "rgba(34,197,94,0.08)", padding: "1px 4px", borderRadius: "3px" }}>
            CO {checkout.total}
          </span>
        )}
        <span className="flex-1" />
        <ChevronDown className="w-3 h-3 shrink-0 transition-transform" style={{ color: "rgba(255,255,255,0.2)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <div className="px-2 pb-2 pt-1 space-y-0.5">
          {leg.visits.map((visit, vi) => (
            <div key={vi} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{
              background: visit.isBust ? "rgba(255,0,92,0.06)" : visit.isCheckout ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
            }}>
              <div className="flex gap-1 flex-1">
                {visit.darts.map((d, di) => (
                  <span key={di} className="px-1 py-0.5 rounded font-bold" style={{
                    fontFamily: "Oswald, sans-serif", fontSize: "0.62rem",
                    background: d.val === 60 ? "rgba(255,210,74,0.12)" : d.val === 50 ? "rgba(255,120,180,0.1)" : d.isDouble ? "rgba(34,197,94,0.08)" : d.isTreble ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.04)",
                    color: d.val === 60 ? "#ffd24a" : d.val === 50 ? "#ff7eb3" : d.isDouble ? "#4ade80" : d.isTreble ? "#a5b4fc" : d.isMiss ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.65)",
                    border: `1px solid ${d.val === 60 ? "rgba(255,210,74,0.14)" : d.isDouble ? "rgba(74,222,128,0.1)" : d.isTreble ? "rgba(165,180,252,0.1)" : "transparent"}`,
                  }}>
                    {d.label}
                  </span>
                ))}
                {Array.from({ length: 3 - visit.darts.length }).map((_, i) => (
                  <span key={`p${i}`} style={{ fontSize: "0.62rem", color: "transparent", userSelect: "none" }}>___</span>
                ))}
              </div>
              <span className="font-black shrink-0 text-right" style={{
                fontFamily: "Oswald, sans-serif", fontSize: "0.7rem", minWidth: "2.8rem",
                color: visit.total === 180 ? "#ffd24a" : visit.isBust ? "#ff005c" : visit.isCheckout ? "#4ade80" : "rgba(255,255,255,0.45)",
              }}>
                {visit.isBust ? "BUST" : visit.total === 180 ? "180!" : visit.total}
              </span>
              <span className="shrink-0 text-right" style={{
                fontFamily: "Oswald, sans-serif", fontSize: "0.65rem", minWidth: "1.8rem",
                color: visit.isCheckout ? "#4ade80" : "rgba(255,255,255,0.18)",
              }}>
                {visit.isCheckout ? "✓" : visit.remaining}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ScorecardView ──────────────────────────────────────────────────────────
export function ScorecardView({ session_data, game_type_key, p1_name, p2_name }: {
  session_data: any; game_type_key: string | null; p1_name?: string | null; p2_name?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const startScore = game_type_key ? x01StartScore(game_type_key) : null;
  const p1Log: { seg: number; mult: number; val: number }[] = session_data?.dartLog ?? [];
  const p2Log: { seg: number; mult: number; val: number }[] = session_data?.p2DartLog ?? [];
  if (!startScore || (!p1Log.length && !p2Log.length)) return null;
  const p1Legs = p1Log.length ? parseX01Scorecard(p1Log, startScore) : [];
  const p2Legs = p2Log.length ? parseX01Scorecard(p2Log, startScore) : [];
  const hasP2 = p2Legs.length > 0;

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 mb-2">
        <span className="font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.15em" }}>
          Scorecard
        </span>
        <span className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.04)" }} />
        <ChevronDown className="w-3 h-3 transition-transform shrink-0" style={{ color: "rgba(255,255,255,0.2)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>
      {open && (
        <div className="space-y-1 pt-1">
          {p1Legs.length > 0 && (
            <div>
              {hasP2 && <div className="font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.52rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em" }}>{p1_name ?? "P1"}</div>}
              {p1Legs.map(leg => <ScorecardLegView key={leg.legNum} leg={leg} />)}
            </div>
          )}
          {hasP2 && (
            <div className="pt-2 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
              <div className="font-bold uppercase mb-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.52rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em" }}>{p2_name ?? "P2"}</div>
              {p2Legs.map(leg => <ScorecardLegView key={leg.legNum} leg={leg} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
