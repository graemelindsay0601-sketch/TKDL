import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal, X } from "lucide-react";
import type { Dart } from "@/lib/dartboard";
import "./modern-x01.css";
import "./modern-party.css";

/**
 * The premium scorer shell for every party game: the same frame as the new X01 / Cricket scorers
 * (slim header with menu, two chrome score cards, one game panel, Dart 1-3 slots, Single/Double/Treble
 * and the 20-1 pad). Presentation only: each game keeps its own rules, bot, undo and result, and hands
 * this component what to show on the cards and in the middle panel.
 */
export type PartyCard = {
  /** The big number (or short text) on the card. */
  score: ReactNode;
  /** Small text after the score, e.g. "/20" or "runs". */
  unit?: string;
  /** The 501-style line under the score: "Last 60" → { label: "Last", value: 60 }. A plain string is shown as is. */
  line?: ReactNode | { label: string; value: ReactNode };
  /** Small text top-right of the card, where 501 shows the leg dots. */
  badge?: ReactNode;
  /** Small label/value pairs along the bottom of the card. */
  stats?: { label: string; value: ReactNode }[];
  /** Greyed out (knocked out, in jail...). */
  out?: boolean;
};

export type ModernPartyProps = {
  heading: string;
  sub?: string;
  rules?: string;
  names: [string, string];
  turn: 0 | 1;
  solo?: boolean;
  cards: [PartyCard, PartyCard];
  /** The game's own visual (target row, track, board...). */
  panel?: ReactNode;
  /** Status line above the pad, e.g. "Aim at 16". */
  note?: ReactNode;
  noteTone?: "gold" | "bust" | "plain";
  visitDarts: Dart[];
  visitLabel?: string;
  visitValue?: ReactNode;
  disabled?: boolean;
  waitingMsg?: string;
  onDart: (d: Dart) => void;
  onMiss: () => void;
  onUndo: () => void;
  /** Gold-lit numbers (the target). */
  highlight?: number[];
  /** When set, only these numbers can be pressed. */
  allowed?: number[];
  /** Big/Small single rings (Prisoner, Straight Line...). */
  ringMode?: boolean;
  fatBull?: boolean;
  onAbandon: () => void;
  onClassic?: () => void;
  topBanner?: ReactNode;
  /** Replaces the pad entirely (number pickers, choose-a-target screens). */
  customPad?: ReactNode;
  /** Cricket-style pad: just these numbers as big buttons (25 = Bull), plus Miss, Undo and Next player. */
  targets?: number[];
  /** Labels for targets (default: the number, "Bull" for 25). */
  targetLabels?: string[];
};

const fmtLabel = (seg: number, m: 1 | 2 | 3, ring?: "inner" | "outer") =>
  seg === 25 ? (m === 2 ? "DB" : "Bull") : m === 1 ? (ring === "inner" ? `${seg}i` : String(seg)) : m === 2 ? `D${seg}` : `T${seg}`;

/** GameScorer provides "switch this match to the classic scorer". */
export const PartyClassicContext = createContext<(() => void) | null>(null);

export function ModernParty(p: ModernPartyProps) {
  const ctxClassic = useContext(PartyClassicContext);
  const onClassic = p.onClassic ?? ctxClassic ?? undefined;
  const [mult, setMult] = useState<1 | 2 | 3>(1);
  const [ring, setRing] = useState<"outer" | "inner">("outer");
  const [menuOpen, setMenuOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  // A new visit starts on Single (the next thrower never inherits a Treble).
  useEffect(() => { if (p.visitDarts.length === 0) { setMult(1); setRing("outer"); } }, [p.visitDarts.length, p.turn]);

  const visitSum = p.visitDarts.reduce((s, d) => s + d.value, 0);
  const canPress = (n: number) => !p.allowed || p.allowed.includes(n);

  const fire = (seg: number, forced?: 1 | 2) => {
    if (p.disabled || missQueue > 0) return;
    const m = (forced ?? (seg === 25 && mult === 3 ? 2 : mult)) as 1 | 2 | 3;
    const r = p.ringMode && m === 1 && seg !== 25 ? ring : undefined;
    const val = seg === 25 ? (m === 2 || p.fatBull ? 50 : 25) : seg * m;
    p.onDart({ segment: seg, multiplier: m, value: val, label: fmtLabel(seg, m, r), ring: r });
    setMult(1);
  };

  const card = (i: 0 | 1) => {
    const on = p.turn === i;
    const c = p.cards[i];
    const line = c.line && typeof c.line === "object" && "label" in (c.line as object) ? c.line as { label: string; value: ReactNode } : null;
    return (
      <div key={i} className={`mx-card mp-card${on ? " is-on" : ""}${c.out ? " is-out" : ""}`}>
        <div className="mx-card-top">
          <span className="mx-name">{p.names[i]}</span>
          {c.badge && <span className="mp-badge">{c.badge}</span>}
        </div>
        <div className="mx-score mp-score">{c.score}{c.unit && <small>{c.unit}</small>}</div>
        {line ? <span className="mx-last">{line.label} <b>{line.value}</b></span>
          : c.line ? <span className="mx-last">{c.line as ReactNode}</span>
          : <span className="mx-last">&nbsp;</span>}
        <div className="mx-stats">
          {(c.stats && c.stats.length ? c.stats : [{ label: on ? "Throwing" : "Waiting", value: "" }]).map(s => <span key={s.label}>{s.label} <b>{s.value}</b></span>)}
        </div>
      </div>
    );
  };

  // "Next player": the rest of the visit goes in as misses, one at a time through the game's own handler.
  const [missQueue, setMissQueue] = useState(0);
  const missRef = useRef(p.onMiss); missRef.current = p.onMiss;
  useEffect(() => { setMissQueue(0); }, [p.turn]);
  useEffect(() => {
    if (missQueue <= 0) return;
    setMissQueue(q => q - 1);
    missRef.current();
  }, [missQueue]);
  const endVisit = () => { if (!p.disabled && missQueue === 0) setMissQueue(Math.max(1, 3 - p.visitDarts.length)); };
  const busy = !!p.disabled || missQueue > 0;

  const multOpts = p.ringMode
    ? [
      { k: "d", label: "Double", cls: "m2", on: mult === 2, pick: () => setMult(mult === 2 ? 1 : 2) },
      { k: "b", label: "Big", cls: "m1", on: mult === 1 && ring === "outer", pick: () => { setMult(1); setRing("outer"); } },
      { k: "t", label: "Treble", cls: "m3", on: mult === 3, pick: () => setMult(mult === 3 ? 1 : 3) },
      { k: "s", label: "Small", cls: "m4", on: mult === 1 && ring === "inner", pick: () => { setMult(1); setRing("inner"); } },
    ]
    : ([1, 2, 3] as const).map(m => ({ k: String(m), label: m === 1 ? "Single" : m === 2 ? "Double" : "Treble", cls: `m${m}`, on: mult === m, pick: () => setMult(mult === m && m !== 1 ? 1 : m) }));

  return (
    <div className={`mx-root mp-root${p.targets && !p.customPad ? " has-tpad" : ""}`} role="application" aria-label={`${p.heading} scorer`}>
      <div className="mx-col">
        <header className="mx-head">
          <button className="mx-icon" aria-label="Match menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}><MoreHorizontal size={20} /></button>
          <div className="mx-title">
            <span>{p.heading}</span>
            {p.sub && <small>{p.sub}</small>}
          </div>
          <span className="mx-head-spacer" />
        </header>

        {menuOpen && (
          <div className="mx-menu" role="menu">
            {p.rules && <button role="menuitem" onClick={() => { setMenuOpen(false); setRulesOpen(true); }}>How to play</button>}
            {onClassic && <button role="menuitem" onClick={() => { setMenuOpen(false); onClassic(); }}>Use classic scorer for this match</button>}
            <button role="menuitem" className="danger" onClick={() => { setMenuOpen(false); if (window.confirm("Abandon this match?")) p.onAbandon(); }}>Abandon match</button>
            <button role="menuitem" className="close" onClick={() => setMenuOpen(false)}>Close</button>
          </div>
        )}

        {p.topBanner && <div className="mx-banner">{p.topBanner}</div>}

        <div className={`mx-board${p.solo ? " solo" : ""}`}>
          {card(0)}
          {!p.solo && card(1)}
        </div>

        {p.panel ? <div className="mp-panel">{p.panel}</div> : p.targets && !p.customPad ? <div className="mp-spacer" /> : null}

        {p.customPad ? <div className="mp-custom">{p.customPad}</div> : (
          <>
            <div className="mx-slots" aria-live="polite">
              {[0, 1, 2].map(k => {
                const d = p.visitDarts[k];
                const next = !p.disabled && k === p.visitDarts.length;
                return (
                  <div key={k} className={`mx-slot${d ? " done" : ""}${next ? " next" : ""}`}>
                    <small>Dart {k + 1}</small><b>{d ? d.label : "–"}</b>
                  </div>
                );
              })}
              <div className="mx-slot visit"><small>{p.visitLabel ?? "Visit"}</small><b>{p.visitValue ?? visitSum}</b></div>
            </div>

            <div className={`mx-note mp-note${p.waitingMsg ? "" : p.noteTone === "bust" ? " bust" : p.noteTone === "plain" ? "" : " gold"}`}>
              {p.waitingMsg ?? p.note ?? `${p.names[p.turn]} to throw`}
            </div>

            {p.targets ? (
              <>
                <div className="mc-mult" role="group" aria-label="Multiplier">
                  {p.ringMode ? multOpts.map(o => <button key={o.k} className={`${o.cls === "m2" ? "db" : o.cls === "m3" ? "tr" : ""}${o.on ? " on" : ""}`} aria-pressed={o.on} disabled={busy} onClick={o.pick}>{o.label}</button>)
                    : <>
                      <button className={mult === 1 ? "on" : ""} aria-pressed={mult === 1} disabled={busy} onClick={() => setMult(1)}>Single</button>
                      <button className={`db${mult === 2 ? " on" : ""}`} aria-pressed={mult === 2} disabled={busy} onClick={() => setMult(m => m === 2 ? 1 : 2)}>Double</button>
                      <button className={`tr${mult === 3 ? " on" : ""}`} aria-pressed={mult === 3} disabled={busy} onClick={() => setMult(m => m === 3 ? 1 : 3)}>Treble</button>
                    </>}
                </div>
                <div className={`mc-pad mp-tpad n${Math.min(p.targets.length, 8)}`}>
                  {p.targets.map((n, k) => {
                    const isBull = n === 25;
                    return (
                      <button key={`${n}-${k}`} className={`${isBull ? "bull" : ""}${p.highlight?.includes(n) ? " hi" : ""}`} disabled={busy || (isBull && mult === 3)} onClick={() => fire(n)}>
                        <span>{p.targetLabels?.[k] ?? (isBull ? (mult === 2 ? "D-Bull" : "Bull") : n)}</span>
                      </button>
                    );
                  })}
                  <button className="miss" disabled={busy} onClick={p.onMiss}>Miss</button>
                  <button className="ghost" onClick={p.onUndo}>Undo</button>
                  <button className="next" disabled={busy} onClick={endVisit}>{p.visitDarts.length === 0 ? "No score" : "Next player"}</button>
                </div>
              </>
            ) : (
              <>
                <div className={`mx-mult${p.ringMode ? " mp-four" : ""}`} role="group" aria-label="Ring">
                  {multOpts.map(o => <button key={o.k} className={`${o.cls}${o.on ? " on" : ""}`} aria-pressed={o.on} disabled={busy} onClick={o.pick}>{o.label}</button>)}
                </div>
                <div className="mx-grid">
                  {Array.from({ length: 20 }, (_, k) => 20 - k).map(n => (
                    <button key={n} className={p.highlight?.includes(n) ? "hi" : ""} disabled={busy || !canPress(n)} onClick={() => fire(n)}><span>{n}</span></button>
                  ))}
                </div>
                <div className="mx-row4">
                  <button className={`bull25${p.highlight?.includes(25) ? " hi" : ""}`} disabled={busy || !canPress(25)} onClick={() => fire(25, 1)}>{p.fatBull ? "Bull 50" : "25"}</button>
                  <button className="bull50" disabled={busy || !canPress(25)} onClick={() => fire(25, 2)}>Bull</button>
                  <button className="ghost" disabled={busy} onClick={p.onMiss}>Miss</button>
                  <button className="ghost" onClick={p.onUndo}>Undo</button>
                </div>
                <button className="mp-next" disabled={busy} onClick={endVisit}>{p.visitDarts.length === 0 ? "No score" : "Next player"}</button>
              </>
            )}
          </>
        )}

        {rulesOpen && (
          <div className="mx-finish mp-rules" role="dialog" aria-label="How to play">
            <button className="mx-finish-x" aria-label="Close" onClick={() => setRulesOpen(false)}><X size={18} /></button>
            <div className="mx-finish-k">How to play</div>
            <div className="mx-finish-t">{p.heading}</div>
            <p>{p.rules}</p>
            <button className="mx-finish-go" onClick={() => setRulesOpen(false)}>Got it</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** A row of round/target chips for the middle panel (Halve-It, Round the Clock, Shanghai...). */
export function TargetChips({ items, current, done }: { items: string[]; current: number; done?: (i: number) => boolean }) {
  return (
    <div className="mp-chips">
      {items.map((t, i) => (
        <span key={i} className={`${i === current ? "on" : ""}${(done ? done(i) : i < current) ? " done" : ""}`}>{t}</span>
      ))}
    </div>
  );
}
