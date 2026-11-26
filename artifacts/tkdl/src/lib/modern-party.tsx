import { useEffect, useState, type ReactNode } from "react";
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
  /** One short line under the score (next target, lives, status). */
  line?: ReactNode;
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
};

const fmtLabel = (seg: number, m: 1 | 2 | 3, ring?: "inner" | "outer") =>
  seg === 25 ? (m === 2 ? "DB" : "Bull") : m === 1 ? (ring === "inner" ? `${seg}i` : String(seg)) : m === 2 ? `D${seg}` : `T${seg}`;

export function ModernParty(p: ModernPartyProps) {
  const [mult, setMult] = useState<1 | 2 | 3>(1);
  const [ring, setRing] = useState<"outer" | "inner">("outer");
  const [menuOpen, setMenuOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  // A new visit starts on Single (the next thrower never inherits a Treble).
  useEffect(() => { if (p.visitDarts.length === 0) { setMult(1); setRing("outer"); } }, [p.visitDarts.length, p.turn]);

  const visitSum = p.visitDarts.reduce((s, d) => s + d.value, 0);
  const canPress = (n: number) => !p.allowed || p.allowed.includes(n);

  const fire = (seg: number, forced?: 1 | 2) => {
    if (p.disabled) return;
    const m = (forced ?? (seg === 25 && mult === 3 ? 2 : mult)) as 1 | 2 | 3;
    const r = p.ringMode && m === 1 && seg !== 25 ? ring : undefined;
    const val = seg === 25 ? (m === 2 || p.fatBull ? 50 : 25) : seg * m;
    p.onDart({ segment: seg, multiplier: m, value: val, label: fmtLabel(seg, m, r), ring: r });
    setMult(1);
  };

  const card = (i: 0 | 1) => {
    const on = p.turn === i;
    const c = p.cards[i];
    return (
      <div key={i} className={`mx-card mp-card${on ? " is-on" : ""}${c.out ? " is-out" : ""}`}>
        <div className="mx-card-top"><span className="mx-name">{p.names[i]}</span></div>
        <div className="mx-score mp-score">{c.score}{c.unit && <small>{c.unit}</small>}</div>
        {c.line && <span className={`mx-route${on ? " is-on" : ""}`}>{c.line}</span>}
        {c.stats && c.stats.length > 0 && (
          <div className="mx-stats">{c.stats.map(s => <span key={s.label}>{s.label} <b>{s.value}</b></span>)}</div>
        )}
      </div>
    );
  };

  const multOpts = p.ringMode
    ? [
      { k: "d", label: "Double", cls: "m2", on: mult === 2, pick: () => setMult(mult === 2 ? 1 : 2) },
      { k: "b", label: "Big", cls: "m1", on: mult === 1 && ring === "outer", pick: () => { setMult(1); setRing("outer"); } },
      { k: "t", label: "Treble", cls: "m3", on: mult === 3, pick: () => setMult(mult === 3 ? 1 : 3) },
      { k: "s", label: "Small", cls: "m4", on: mult === 1 && ring === "inner", pick: () => { setMult(1); setRing("inner"); } },
    ]
    : ([1, 2, 3] as const).map(m => ({ k: String(m), label: m === 1 ? "Single" : m === 2 ? "Double" : "Treble", cls: `m${m}`, on: mult === m, pick: () => setMult(mult === m && m !== 1 ? 1 : m) }));

  return (
    <div className="mx-root mp-root" role="application" aria-label={`${p.heading} scorer`}>
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
            {p.onClassic && <button role="menuitem" onClick={() => { setMenuOpen(false); p.onClassic!(); }}>Use classic scorer for this match</button>}
            <button role="menuitem" className="danger" onClick={() => { setMenuOpen(false); if (window.confirm("Abandon this match?")) p.onAbandon(); }}>Abandon match</button>
            <button role="menuitem" className="close" onClick={() => setMenuOpen(false)}>Close</button>
          </div>
        )}

        {p.topBanner && <div className="mx-banner">{p.topBanner}</div>}

        <div className={`mx-board${p.solo ? " solo" : ""}`}>
          {card(0)}
          {!p.solo && card(1)}
        </div>

        {p.panel && <div className="mp-panel">{p.panel}</div>}

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

            <div className={`mx-mult${p.ringMode ? " mp-four" : ""}`} role="group" aria-label="Ring">
              {multOpts.map(o => <button key={o.k} className={`${o.cls}${o.on ? " on" : ""}`} aria-pressed={o.on} disabled={p.disabled} onClick={o.pick}>{o.label}</button>)}
            </div>
            <div className="mx-grid">
              {Array.from({ length: 20 }, (_, k) => 20 - k).map(n => (
                <button key={n} className={p.highlight?.includes(n) ? "hi" : ""} disabled={p.disabled || !canPress(n)} onClick={() => fire(n)}><span>{n}</span></button>
              ))}
            </div>
            <div className="mx-row4">
              <button className={`bull25${p.highlight?.includes(25) ? " hi" : ""}`} disabled={p.disabled || !canPress(25)} onClick={() => fire(25, 1)}>{p.fatBull ? "Bull 50" : "25"}</button>
              <button className="bull50" disabled={p.disabled || !canPress(25)} onClick={() => fire(25, 2)}>Bull</button>
              <button className="ghost" disabled={p.disabled} onClick={p.onMiss}>Miss</button>
              <button className="ghost" onClick={p.onUndo}>Undo</button>
            </div>
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
