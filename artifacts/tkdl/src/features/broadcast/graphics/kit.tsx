// TKDL LIVE — shared primitives for the bespoke per-kind graphics (real user
// feedback: the old GraphicFrame chip-grid rendered every graphic kind
// through the exact same shape — a tag pill plus a row of label/value pills
// — which reads as a data table screenshotted out of the app, not a
// broadcast graphics package. Each graphics/*.tsx file now composes its OWN
// purpose-built layout (a versus split for head-to-head, a probability bar
// for the title race, a standings ladder for the league table, a streak
// gauge for form watch...) out of these shared pieces, so the "house style"
// still holds the whole graphics package together as one consistent look,
// without every graphic being the same SHAPE.
//
// Two skins now live here, chosen per graphic by its own `compact` prop —
// the v2 "broadcast panel" skin for compact=true (quiet/featured visual
// tier) and the v3 "BigBoard" skin below it for compact=false (major tier).
// An original v1 "glass-chip" skin (GraphicTag/HeroStat/MeasureBar/
// VersusCard/MoveIndicator/Flag/EmptyNote/surfaceStyle) used to live here
// too — real user feedback on it ("far too much like you've took an actual
// screenshot of the stats and just pasting it in") is what led to v2, and
// once v2 (then v3) actually shipped across every graphics/*.tsx file, v1
// had no remaining callers — removed rather than kept as dead code.
//
// GraphicFrame.tsx (the old generic chip renderer, predating even v1) still
// exists and is used as ResultGraphic's own fallback for a facts shape none
// of its known hero-stat cases recognise — chiefly the FILLER story types
// (practice activity, Shadow Bot promo, feature spotlight), whose own
// bespoke facts shape hasn't been designed yet. Nothing else should reach
// for it.
import { useEffect, useState, type ReactNode } from "react";
import type { GraphicData, LeagueType } from "../types";
import { LEAGUE_ACCENT, LEAGUE_LABEL } from "../theme";
import { DartboardBackdrop, Glow } from "@/components/premium/Premium";

/** A 0-1 fraction as a whole-number percent string. Every bespoke component below knows which of its OWN fields are fraction-shaped (unlike GraphicFrame's old generic key-name-suffix heuristic), so this is just the arithmetic. */
export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ── Defensive field access ──────────────────────────────────────────────
// GraphicData is a loosely-typed bag (the story's own already-verified
// facts, post commentary-engine.ts's buildGraphicFacts() id->name
// resolution) — every bespoke component below reaches for SPECIFIC known
// field names for its own story-type family rather than iterating every key
// generically the way the old GraphicFrame did, so a value showing up under
// a key this component doesn't recognise (a future story type, a renamed
// fact) is silently skipped rather than crashing the graphic. These two
// getters are that defensive read, once, instead of an `as` cast at every
// call site.
export function str(data: GraphicData, key: string): string | null {
  const v = data[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}
export function num(data: GraphicData, key: string): number | null {
  const v = data[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
export function bool(data: GraphicData, key: string): boolean {
  return data[key] === true;
}
export function numArray(data: GraphicData, key: string): number[] | null {
  const v = data[key];
  return Array.isArray(v) && v.every((x): x is number => typeof x === "number") ? v : null;
}
/** Same idea for a string-tagged sequence — story-detectors-form.ts's own
 * recentForm ("W"/"L") and story-detectors-h2h.ts's own recentMeetingsResult
 * ("dominant"/"dominated" or "a"/"b") are the two current shapes this reads;
 * ResultStrip below takes whichever boolean projection each caller derives
 * from it, since "which token means 'this side'" differs per fact shape. */
export function strArray(data: GraphicData, key: string): string[] | null {
  const v = data[key];
  return Array.isArray(v) && v.every((x): x is string => typeof x === "string") ? v : null;
}

export function staggerDelay(i: number): string {
  return `${i * 80}ms`;
}

/** Appends a hex alpha suffix to a colour ONLY when it's actually hex-shaped ("#rrggbb") — several components below build a glow/tint by string-concatenating an alpha suffix onto an accent, which silently produces an invalid CSS colour (and so no colour at all — a blank bar, no glow) for any non-hex accent, e.g. "rgba(255,255,255,0.4)cc" is not a real colour. A handful of the bespoke graphics deliberately pass a de-emphasised `rgba(...)` accent for a "second place" bar/name (kit.tsx's own callers), so every place that builds a colour string this way goes through this guard instead of concatenating directly. Non-hex input is returned unchanged — safe degradation (no glow) rather than a broken swatch. */
export function withAlpha(color: string, alphaHex: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alphaHex}` : color;
}

// ═══════════════════════════════════════════════════════════════════════
// ── Premium skin (v4) ────────────────────────────────────────────────────
// The owner asked for TKDL LIVE to carry the same premium look as the rest
// of the app (the Hub's "Your standing" card, Standings, profiles), and
// signed off a mockup built from those exact pieces. Every primitive below
// keeps its v2/v3 name and props, so each graphics/*.tsx file picks up the
// new look without changing its own layout logic:
//  - panels are the app's hero card (purple-to-black gradient, soft glows,
//    dartboard outline, faint diagonal lines, tinted border);
//  - headers are a gold kicker and a gold-metal title;
//  - hero numbers are the Hub's colour-bordered stat tiles;
//  - names are chrome; ranks are gold/silver/bronze coins;
//  - badges are pill chips; recent results are W/L form chips.
// compact=true (quiet/featured tier) is the same card at a smaller scale.

const OSWALD = "Oswald, sans-serif";

function HeroCard({ accent, compact, fill = true, dense = false, maxWidth, children }: { accent: string; compact: boolean; fill?: boolean; dense?: boolean; maxWidth?: number | string; children: ReactNode }) {
  return (
    <div
      className={`panel-slide-in relative overflow-hidden min-w-0 ${fill ? "flex w-full" : "inline-flex"} flex-col`}
      style={{
        borderRadius: compact ? 18 : 24,
        border: `1px solid ${withAlpha(accent, "55")}`,
        background: `linear-gradient(160deg, ${withAlpha(accent, "2e")} 0%, #14102a 42%, #06060b 100%)`,
        boxShadow: `0 20px 50px rgba(0,0,0,.55), 0 0 50px ${withAlpha(accent, "18")}`,
        padding: compact ? "12px 16px 14px" : dense ? "16px 24px 18px" : "24px 30px 26px",
        gap: compact ? 8 : dense ? 10 : 16,
        maxWidth: maxWidth ?? "100%",
        minWidth: fill ? undefined : (compact ? undefined : "min(380px, 100%)"),
      }}
    >
      <Glow x="88%" y="10%" color={accent} size={compact ? 260 : 460} opacity={0.3} />
      <Glow x="5%" y="85%" color="#a855f7" size={compact ? 240 : 420} opacity={0.26} />
      <DartboardBackdrop size={compact ? 300 : 520} opacity={0.07} style={{ right: compact ? -130 : -200, top: compact ? -90 : -110, transform: "rotate(8deg)" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, background: "repeating-linear-gradient(115deg,#fff 0 1px,transparent 1px 12px)" }} />
      <div className="relative flex flex-col min-w-0" style={{ zIndex: 1, gap: "inherit" }}>{children}</div>
    </div>
  );
}

export function Panel({ accent, compact = true, children }: { accent: string; compact?: boolean; children: ReactNode }) {
  return <HeroCard accent={accent} compact fill={false} maxWidth={compact ? 340 : 460}>{children}</HeroCard>;
}

function Kicker({ icon, kind, leagueType, accent, size }: { icon: string; kind: string; leagueType: LeagueType | null; accent: string; size: number }) {
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : accent;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="live-dot" style={{ width: 6, height: 6, background: leagueAccent }} />
      <span className="pm-lab" style={{ color: "#ffd24a", fontSize: size }}><span aria-hidden="true">{icon}</span>{kind}</span>
      {leagueType && <span className="pm-lab" style={{ fontSize: size }}>· {LEAGUE_LABEL[leagueType]}</span>}
    </div>
  );
}

/** The panel's caption: a gold kicker with the league, as on the app's hero cards. */
export function PanelTag({ icon, kind, leagueType, accent, compact = true }: { icon: string; kind: string; leagueType: LeagueType | null; accent: string; compact?: boolean }) {
  return <Kicker icon={icon} kind={kind} leagueType={leagueType} accent={accent} size={compact ? 9.5 : 10.5} />;
}

/**
 * Counts a displayed number up from zero when it first appears ("2.93",
 * "+18", "64%", "12"), keeping its prefix, suffix and decimal places.
 * Anything that isn't a plain number is shown as-is.
 */
function useCountUp(value: string, ms = 900): string {
  const m = /^([^0-9.-]*)(-?\d+(?:\.\d+)?)(.*)$/.exec(value);
  const [shown, setShown] = useState(m ? `${m[1]}0${m[3]}` : value);
  useEffect(() => {
    if (!m) { setShown(value); return; }
    const target = Number(m[2]);
    const places = (m[2].split(".")[1] ?? "").length;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(value); return; }
    let raf = 0; const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(`${m[1]}${(target * eased).toFixed(places)}${m[3]}`);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return shown;
}

/** A Hub-style stat tile: colour gradient border, dark tinted fill, glowing number. */
function StatTile({ value, label, accent, big }: { value: string; label: string; accent: string; big: boolean }) {
  const shown = useCountUp(value);
  return (
    <div className="badge-pop-in self-start min-w-0" style={{ padding: 1, borderRadius: big ? 18 : 14, background: `linear-gradient(140deg, ${accent}, ${withAlpha(accent, "26")} 50%, ${accent})` }}>
      <div style={{ borderRadius: big ? 17 : 13, padding: big ? "14px 22px 16px" : "8px 14px 10px", background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 16%, #0c0a12), #0b0910)` }}>
        <span className="pm-lab" style={{ fontSize: big ? 11 : 9 }}>{label}</span>
        <div className="pm-num tabular-nums" style={{ fontSize: big ? "4.4rem" : "1.9rem", color: accent, textShadow: `0 0 18px ${withAlpha(accent, "80")}`, marginTop: big ? 6 : 3 }}>{shown}</div>
      </div>
    </div>
  );
}

export function HeroBadge({ value, label, accent, compact = true }: { value: string; label: string; accent: string; compact?: boolean }) {
  return <StatTile value={value} label={label} accent={accent} big={!compact} />;
}

/** A plain supporting line. */
export function PanelLine({ children }: { children: ReactNode }) {
  return <div style={{ color: "#b9b3cc", fontSize: "0.76rem", fontWeight: 500 }}>{children}</div>;
}

function nameSize(name: string, regular: string, long: string): string {
  const longSingleWord = name.length > 6 && !name.includes(" ");
  return longSingleWord ? long : regular;
}

/** A player's initial in the app's glowing conic ring. */
function InitialRing({ name, accent, size }: { name: string; accent: string; size: number }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div className="absolute pointer-events-none" style={{ inset: -5, borderRadius: "50%", background: `conic-gradient(from 0deg, transparent, ${withAlpha(accent, "99")}, transparent 30%, #c4b5fd99, transparent 65%)`, filter: "blur(5px)" }} />
      <div className="relative w-full h-full rounded-full" style={{ padding: 3, background: `conic-gradient(from 200deg, ${accent}, #c4b5fd, ${accent}, #ffffff, ${accent})` }}>
        <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 35% 30%, #2f2850, #0f0d18)" }}>
          <span className="pm-chrome" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: size * 0.44 }}>{(name.trim()[0] ?? "?").toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

function VersusRow({ leftName, rightName, leftAccent, rightAccent, splitFraction, splitLabel, big }: { leftName: string; rightName: string; leftAccent: string; rightAccent: string; splitFraction?: number; splitLabel?: string; big: boolean }) {
  const ring = big ? 58 : 34;
  const reg = big ? "clamp(1rem, 4.6vw, 1.9rem)" : "clamp(0.74rem, 3.4vw, 1rem)";
  const lng = big ? "clamp(0.8rem, 3.6vw, 1.4rem)" : "clamp(0.62rem, 2.6vw, 0.8rem)";
  return (
    <div className="flex flex-col min-w-0" style={{ gap: big ? 12 : 8 }}>
      <div className="flex items-center min-w-0" style={{ gap: big ? 14 : 8 }}>
        <div className="flex items-center min-w-0" style={{ gap: big ? 12 : 8, flex: "1 1 0%" }}>
          <InitialRing name={leftName} accent={leftAccent} size={ring} />
          <span className="pm-chrome uppercase" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: nameSize(leftName, reg, lng), lineHeight: 1.05, whiteSpace: "nowrap" }}>{leftName}</span>
        </div>
        <span className="pm-lab shrink-0" style={{ fontSize: big ? 12 : 9, padding: big ? "0 10px" : "0 6px" }}>vs</span>
        <div className="flex items-center justify-end min-w-0" style={{ gap: big ? 12 : 8, flex: "1 1 0%" }}>
          <span className="pm-chrome uppercase" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: nameSize(rightName, reg, lng), lineHeight: 1.05, whiteSpace: "nowrap", textAlign: "right" }}>{rightName}</span>
          <InitialRing name={rightName} accent={rightAccent} size={ring} />
        </div>
      </div>
      {splitFraction !== undefined && (
        <div className="flex flex-col gap-1">
          <div className="flex overflow-hidden" style={{ height: big ? 8 : 5, borderRadius: 999, background: "rgba(255,255,255,.08)" }}>
            <div className="bar-wipe h-full" style={{ width: `${Math.max(0, Math.min(1, splitFraction)) * 100}%`, background: leftAccent, boxShadow: `0 0 12px ${withAlpha(leftAccent, "88")}` }} />
            <div className="h-full flex-1" style={{ background: rightAccent, opacity: 0.85 }} />
          </div>
          {splitLabel && <div className="pm-lab" style={{ justifyContent: "center", fontSize: big ? 11 : 9 }}>{splitLabel}</div>}
        </div>
      )}
    </div>
  );
}

export function VersusPanel(props: { leftName: string; rightName: string; leftAccent: string; rightAccent: string; splitFraction?: number; splitLabel?: string; compact?: boolean }) {
  return <VersusRow {...props} big={props.compact === false} />;
}

/** A measured bar: label, coloured value, thin rounded glowing track. */
export function PanelBar({ label, valueLabel, fraction, accent, compact = true }: { label: string; valueLabel: string; fraction: number; accent: string; compact?: boolean }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="uppercase truncate" style={{ fontFamily: OSWALD, color: "#e4e0f0", fontSize: compact ? "0.72rem" : "0.82rem", letterSpacing: ".06em" }}>{label}</span>
        <span className="pm-num tabular-nums shrink-0" style={{ color: accent, fontSize: compact ? "0.82rem" : "0.95rem" }}>{valueLabel}</span>
      </div>
      <div style={{ height: compact ? 5 : 7, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div className="bar-wipe h-full" style={{ width: `${clamped * 100}%`, background: accent, borderRadius: 999, boxShadow: `0 0 10px ${withAlpha(accent, "88")}` }} />
      </div>
    </div>
  );
}

/** A small call-out flag as a pill chip. */
export function PanelFlag({ children, accent }: { children: ReactNode; accent: string }) {
  return <span className="pm-chip self-start" style={{ color: accent, borderColor: withAlpha(accent, "77"), background: withAlpha(accent, "1a") }}>{children}</span>;
}

// ── Major tier (big, one story filling the screen) ───────────────────────
export function BigPanel({ accent, fill = true, dense = false, children }: { accent: string; fill?: boolean; dense?: boolean; children: ReactNode }) {
  return <HeroCard accent={accent} compact={false} fill={fill} dense={dense}>{children}</HeroCard>;
}

/** Gold kicker over a gold-metal title — the app's chapter/hero heading. */
export function BigPanelHeader({ icon, kind, leagueType, accent }: { icon: string; kind: string; leagueType: LeagueType | null; accent: string }) {
  const leagueAccent = leagueType ? LEAGUE_ACCENT[leagueType] : accent;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="live-dot" style={{ width: 6, height: 6, background: leagueAccent }} />
        <span className="pm-lab" style={{ color: "#ffd24a", fontSize: 11 }}>{leagueType ? LEAGUE_LABEL[leagueType] : "TKDL LIVE"}</span>
      </div>
      <div className="pm-metal uppercase" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: "clamp(1.6rem, 3.4vw, 2.5rem)", letterSpacing: ".03em", lineHeight: 1 }}>
        <span aria-hidden="true" style={{ WebkitTextFillColor: "initial", marginRight: 10, fontSize: "0.8em" }}>{icon}</span>{kind}
      </div>
    </div>
  );
}

export function BigHeroNumber({ value, label, accent }: { value: string; label: string; accent: string }) {
  return <StatTile value={value} label={label} accent={accent} big />;
}

const COIN: Record<number, string> = {
  1: "linear-gradient(180deg,#ffe58a,#d99a00)",
  2: "linear-gradient(180deg,#ffffff,#9aa3b8)",
  3: "linear-gradient(180deg,#f2b989,#9c5a2c)",
};

/** A ranked row like the Standings page: coin, chrome name, coloured value, glowing bar. */
export function BigRow({ rank, label, valueLabel, fraction, accent, delay = 0, dense = false }: { rank?: number; label: string; valueLabel: string; fraction: number; accent: string; delay?: number; dense?: boolean }) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const coin = rank !== undefined ? COIN[rank] : undefined;
  return (
    <div className={`bug-chip-in flex items-center ${dense ? "gap-3" : "gap-4"}`} style={{ animationDelay: staggerDelay(delay), padding: dense ? "6px 12px" : "9px 14px", borderRadius: 14, background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.012))", border: `1px solid ${rank === 1 ? "rgba(255,210,74,.45)" : "rgba(255,255,255,.08)"}` }}>
      {rank !== undefined && (
        <div className="flex items-center justify-center shrink-0 rounded-full" style={{ width: dense ? 28 : 34, height: dense ? 28 : 34, fontFamily: OSWALD, fontWeight: 700, fontSize: dense ? 13 : 15, color: coin ? "#1a1200" : "#cfcade", background: coin ?? "linear-gradient(180deg,#3a3550,#1c1a28)", boxShadow: coin ? "0 0 10px rgba(255,210,74,.35)" : undefined }}>
          {rank}
        </div>
      )}
      <div className={`flex-1 min-w-0 flex flex-col ${dense ? "gap-1" : "gap-1.5"}`}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="pm-chrome uppercase truncate" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: dense ? "1.02rem" : "1.18rem", letterSpacing: ".03em" }}>{label}</span>
          <span className="pm-num tabular-nums shrink-0" style={{ color: accent, fontSize: dense ? "1.15rem" : "1.35rem", textShadow: `0 0 12px ${withAlpha(accent, "66")}` }}>{valueLabel}</span>
        </div>
        <div style={{ height: dense ? 5 : 7, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div className="bar-wipe h-full" style={{ width: `${clamped * 100}%`, borderRadius: 999, background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, "aa")})`, boxShadow: `0 0 14px ${withAlpha(accent, "80")}` }} />
        </div>
      </div>
    </div>
  );
}

/** "Before -> after": old value dimmed and struck, new value in gold metal. */
export function BigMove({ before, after, accent, improved }: { before: string; after: string; accent: string; improved: boolean }) {
  return (
    <div className="bug-chip-in flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
      <span className="tabular-nums min-w-0 uppercase" style={{ fontFamily: OSWALD, fontWeight: 600, color: "rgba(255,255,255,0.35)", fontSize: "clamp(1.1rem, 4.5vw, 2.2rem)", lineHeight: 1.15, textDecoration: "line-through", textDecorationColor: "rgba(255,255,255,0.3)", overflowWrap: "anywhere" }}>{before}</span>
      <span aria-hidden="true" className="shrink-0 flex items-center justify-center" style={{ color: accent, width: 34, height: 34 }}>
        <svg viewBox="0 0 24 24" width="34" height="34" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" style={{ transform: improved ? "rotate(-45deg)" : "rotate(45deg)", filter: `drop-shadow(0 0 6px ${accent})` }}>
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </span>
      <span className="pm-metal tabular-nums min-w-0 uppercase" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: "clamp(1.3rem, 6vw, 3.2rem)", lineHeight: 1.1, overflowWrap: "anywhere" }}>{after}</span>
    </div>
  );
}

/** A call-out as a glowing pill chip ("Dead Heat", "Verified", "W5"…). */
export function BigBadge({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <span className="badge-pop-in pm-chip self-start" style={{ minHeight: 32, padding: "0 16px", fontSize: 13, color: accent, borderColor: withAlpha(accent, "88"), background: `linear-gradient(90deg, ${withAlpha(accent, "33")}, ${withAlpha(accent, "0d")})`, boxShadow: `0 0 18px ${withAlpha(accent, "33")}` }}>
      {children}
    </span>
  );
}

export function BigLine({ children }: { children: ReactNode }) {
  return <div style={{ color: "#b9b3cc", fontSize: "1.02rem", fontWeight: 500 }}>{children}</div>;
}

export function BigVersus(props: { leftName: string; rightName: string; leftAccent: string; rightAccent: string; splitFraction?: number; splitLabel?: string }) {
  return <VersusRow {...props} big />;
}

/**
 * Recent results as the app's W/L form chips, oldest to newest left to
 * right. `values` is newest-first (every story detector's own convention);
 * reversed once here. True results use `trueAccent`, false `falseAccent`.
 */
export function ResultStrip({ values, trueAccent, falseAccent, compact = false }: { values: boolean[]; trueAccent: string; falseAccent: string; compact?: boolean }) {
  if (values.length === 0) return null;
  const display = [...values].reverse();
  const size = compact ? 16 : 24;
  return (
    <div className="flex items-center" style={{ gap: compact ? 3 : 4 }} role="img" aria-label="Recent results, oldest to newest">
      {display.map((isTrue, i) => {
        const color = isTrue ? trueAccent : falseAccent;
        return (
          <span key={i} className="bug-chip-in shrink-0 flex items-center justify-center" style={{ width: size, height: size, borderRadius: compact ? 5 : 7, animationDelay: staggerDelay(i), fontFamily: OSWALD, fontSize: compact ? 9 : 11, color: "#fff", background: `linear-gradient(180deg, ${withAlpha(color, "59")}, ${withAlpha(color, "14")})`, border: `1px solid ${withAlpha(color, "99")}` }}>
            {isTrue ? "W" : "L"}
          </span>
        );
      })}
    </div>
  );
}

/** "Winner def. loser" in the mockup style: chrome winner with a green "Winner" label, dimmer chrome loser with a red "Lost" label. */
export function WinnerBeat({ winner, loser, big = false }: { winner: ReactNode; loser: ReactNode; big?: boolean }) {
  const ring = big ? 50 : 30;
  const w = typeof winner === "string" ? winner : "";
  const l = typeof loser === "string" ? loser : "";
  return (
    <div className="bug-chip-in flex items-center min-w-0 flex-wrap" style={{ gap: big ? 12 : 8, animationDelay: "80ms" }}>
      <div className="flex items-center min-w-0" style={{ gap: big ? 10 : 7 }}>
        {w && <InitialRing name={w} accent="#4ade80" size={ring} />}
        <div className="min-w-0">
          <div className="pm-chrome uppercase" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: big ? "clamp(1.2rem, 3vw, 1.9rem)" : "1.05rem", lineHeight: 1.02, overflowWrap: "anywhere" }}>{winner}</div>
          <span className="pm-lab" style={{ color: "#4ade80", fontSize: big ? 10 : 8.5 }}>Winner</span>
        </div>
      </div>
      <span className="pm-lab" style={{ fontSize: big ? 11 : 9 }}>def.</span>
      <div className="flex items-center min-w-0" style={{ gap: big ? 10 : 7, opacity: 0.85 }}>
        {l && <InitialRing name={l} accent="#ff6b6b" size={ring * 0.85} />}
        <div className="min-w-0">
          <div className="pm-chrome uppercase" style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: big ? "clamp(1rem, 2.4vw, 1.5rem)" : "0.92rem", lineHeight: 1.02, overflowWrap: "anywhere" }}>{loser}</div>
          <span className="pm-lab" style={{ color: "#ff6b6b", fontSize: big ? 10 : 8.5 }}>Lost</span>
        </div>
      </div>
    </div>
  );
}
