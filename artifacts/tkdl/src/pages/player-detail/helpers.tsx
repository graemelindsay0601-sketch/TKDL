import { useState, useEffect, useRef, type ReactNode } from "react";
import { Chapter, PmCard, Tile, TileGrid } from "@/components/premium/Premium";
import { format } from "date-fns";
import { Link } from "wouter";
import { ChevronDown, CheckCircle, Pin } from "lucide-react";

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
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{
              background: isWin ? "linear-gradient(180deg, rgba(74,222,128,.35), rgba(74,222,128,.08))" : "linear-gradient(180deg, rgba(255,107,107,.35), rgba(255,107,107,.08))",
              border: `1px solid ${isWin ? "rgba(74,222,128,.6)" : "rgba(255,107,107,.6)"}`,
              color: isWin ? "#b9ffd0" : "#ffc2c2", boxShadow: `0 0 8px ${isWin ? "rgba(74,222,128,.25)" : "rgba(255,107,107,.25)"}`,
              fontFamily: "Oswald, sans-serif", fontSize: "0.68rem",
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

  const W = 320; const H = 140;
  const lo = Math.min(...pts) - 15;
  const hi = Math.max(...pts) + 15;
  const rng = hi - lo || 100;
  const coords = pts.map((v, i) => ({ x: (i / (pts.length - 1)) * W, y: 18 + (H - 24) - ((v - lo) / rng) * (H - 24) }));
  const path = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;
  const last = coords[coords.length - 1];
  const change = pts[pts.length - 1] - pts[0];
  const minElo = Math.min(...pts);
  const maxElo = Math.max(...pts);
  const peakIdx = pts.lastIndexOf(maxElo);
  const peak = coords[peakIdx];
  const uid = `sg-${playerId}`;
  const line = "#9cc6ff";

  return (
    <div className="relative">
      <div className="flex items-end justify-between">
        <div>
          <span className="pm-lab">Now · {matchCount} matches</span>
          <span className="pm-num" style={{ fontSize: 40, color: line, textShadow: "0 0 18px rgba(127,180,255,.5)" }}>{currentElo}</span>
        </div>
        <span className="pm-chip" style={{ color: change >= 0 ? "#9dffbf" : "#ffb3b3", borderColor: change >= 0 ? "rgba(74,222,128,.45)" : "rgba(255,107,107,.45)", background: change >= 0 ? "rgba(74,222,128,.12)" : "rgba(255,107,107,.12)" }}>
          {change >= 0 ? "↑" : "↓"} {Math.abs(change)} since start
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 150, display: "block", marginTop: 10, overflow: "visible" }}>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7fb4ff" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#7fb4ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.33, 0.66, 1].map(f => <path key={f} d={`M0 ${(H * f).toFixed(0)} H${W}`} stroke="rgba(255,255,255,.07)" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
        <path d={area} fill={`url(#${uid})`} />
        <path d={path} stroke={line} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 6px #7fb4ff)" }} />
        <circle cx={peak.x} cy={peak.y} r="4.5" fill="#ffd24a" style={{ filter: "drop-shadow(0 0 6px #ffd24a)" }} />
        <circle cx={last.x} cy={last.y} r="3.5" fill={line} />
      </svg>
      <div className="flex justify-between mt-2" style={{ fontSize: 11, color: "#8b86a0" }}>
        <span>Low {minElo}</span><span style={{ color: "#ffd24a" }}>Peak {maxElo}</span><span>Now {currentElo}</span>
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

export function AchievementCard({
  a, pinned, onTogglePin, pinDisabled,
}: {
  a: any;
  /** Owner-only trophy-case controls — omit entirely to render the plain read-only card used everywhere else. */
  pinned?: boolean;
  onTogglePin?: () => void;
  pinDisabled?: boolean;
}) {
  const rc = RARITY_COLORS[a.rarity] ?? RARITY_COLORS.Common;
  const isHidden = a.hidden && !a.isUnlocked;
  const pct = Math.min(100, a.progressPct ?? 0);
  const isClose = pct >= 60 && !a.isUnlocked;
  const showPin = onTogglePin && a.isUnlocked && !isHidden;
  return (
    <div className="relative rounded-lg overflow-hidden transition-all duration-200 cursor-default hover:-translate-y-0.5"
      style={{
        background: a.isUnlocked ? rc.bg : "rgba(255,255,255,0.025)",
        border: `1px solid ${pinned ? "#ffd24a" : a.isUnlocked ? rc.color + "55" : isClose ? rc.color + "33" : "rgba(255,255,255,0.07)"}`,
        padding: "0.625rem",
      }}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: a.isUnlocked ? rc.color : "transparent" }} />
      {showPin && (
        <button
          onClick={onTogglePin}
          disabled={!pinned && pinDisabled}
          title={pinned ? "Remove from trophy case" : pinDisabled ? "Trophy case full (5 max) — unpin one first" : "Pin to trophy case"}
          className="absolute top-1.5 right-1.5 z-10 p-1 rounded-md transition-all"
          style={{
            background: pinned ? "rgba(255,210,74,0.18)" : "rgba(255,255,255,0.06)",
            color: pinned ? "#ffd24a" : "rgba(255,255,255,0.25)",
            opacity: !pinned && pinDisabled ? 0.35 : 1,
            cursor: !pinned && pinDisabled ? "not-allowed" : "pointer",
          }}>
          <Pin className="w-3 h-3" fill={pinned ? "#ffd24a" : "none"} />
        </button>
      )}
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
  if (!label) return <div className="pm-num tabular-nums" style={{ fontSize: 44, color, textShadow: `0 0 18px ${color}80`, marginTop: 2 }}>{animated}{suffix}</div>;
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

// ── StatPanel ──────────────────────────────────────────────────────────────
// Same numbers, same per-stat accent colours as SmallStat, but grouped into
// ONE pdc-card with hairline dividers between cells instead of each number
// getting its own full bordered/shadowed card. Cuts a page's worth of
// repeated card chrome without touching a single colour or value.
export type StatDef = { label: string; value: number | null; accent?: string; suffix?: string; placeholder?: string; viz?: ReactNode; note?: ReactNode };

function StatCell({ value, label, accent, suffix = "", placeholder = "0", viz, note }: StatDef) {
  const animated = useCountUp(value ?? 0);
  return <Tile label={label} color={value == null ? "#6f6a82" : (accent ?? "#e4e0f0")} value={value == null ? placeholder : `${animated}${suffix}`} viz={viz} note={note} />;
}

/** A chapter of stat tiles. `cols` = [phone, wide]; gridClass is still accepted for older call sites. */
export function StatPanel({ title, stats, cols = [3, 6], accent, id, aside }: { title: string; stats: StatDef[]; gridClass?: string; cols?: [number, number]; accent?: string; id?: string; aside?: ReactNode }) {
  return (
    <div>
      <Chapter title={title} accent={accent} id={id} aside={aside} />
      <TileGrid cols={cols} accent={accent}>{stats.map(s => <StatCell key={s.label} {...s} />)}</TileGrid>
    </div>
  );
}

// ── ModeTile ───────────────────────────────────────────────────────────────
// One compact tile per game mode, grouped into a single grid instead of each
// mode getting its own full-width pdc-card — same "one panel, not one card
// per thing" idea as StatPanel, applied to the mode-summary blocks (Doubles,
// Shift Wars, Master-501, Boss Battle, Board Curse, Card Clash). Colors match
// the Hub's GAME_MODES accents (dashboard.tsx) so the same mode reads the
// same color everywhere in the app.
export function ModeTile({ href, icon, label, accent, children }: {
  href: string; icon: ReactNode; label: string; accent: string; children: ReactNode;
}) {
  return (
    <Link href={href}>
      <div className="relative overflow-hidden cursor-pointer transition-all hover:-translate-y-0.5 h-full"
        style={{ padding: "13px 14px", borderRadius: 16, border: `1px solid ${accent}55`,
          background: `radial-gradient(120% 90% at 100% 0%, ${accent}33, transparent 60%), linear-gradient(180deg, #17141f, #0d0b13)`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.08), 0 10px 24px rgba(0,0,0,.35)" }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${accent}26`, color: accent, boxShadow: `0 0 12px ${accent}44` }}>
            {icon}
          </div>
          <div className="uppercase text-xs leading-tight" style={{ fontFamily: "Oswald, sans-serif", color: accent, letterSpacing: "0.14em" }}>
            {label}
          </div>
        </div>
        <div style={{ color: "#e4e0f0", fontFamily: "Oswald, sans-serif", fontSize: "0.95rem", letterSpacing: "0.02em", lineHeight: 1.25 }}>
          {children}
        </div>
      </div>
    </Link>
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
export function CollapsibleSection({ title, icon, open, onToggle, badge, children, accentColor = "#ffd24a", extraHeader, id }: {
  title: string; icon: ReactNode; open: boolean; onToggle: () => void;
  badge?: string; children: ReactNode; accentColor?: string; extraHeader?: ReactNode; id?: string;
}) {
  // accent for the chapter/card glow: only real colours (hex), else gold
  const accent = /^#/.test(accentColor) ? accentColor : "#ffd24a";
  return (
    <div>
      <Chapter title={title} accent={accent} id={id} onClick={onToggle}
        aside={<span className="flex items-center gap-2">
          {badge && <span className="pm-chip">{badge}</span>}
          {extraHeader}
          <ChevronDown className="w-4 h-4 shrink-0 transition-transform" style={{ color: "rgba(255,255,255,0.45)", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
        </span>} />
      {open ? <PmCard accent={accent}>{children}</PmCard> : null}
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
