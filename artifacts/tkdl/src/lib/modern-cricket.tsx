import { useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import type { Dart } from "@/lib/dartboard";
import "./modern-x01.css";
import "./modern-cricket.css";

/**
 * The new Cricket scorer (signed-off mockup, Nov 2026). Presentation only:
 * every dart still goes through CricketScorer's own handleDart, so the rules,
 * undo, bots, stats and match result are exactly the classic scorer's.
 * One screen: scores, a marks board, this visit, and big 20–Bull buttons.
 */
export type ModernCricketProps = {
  heading: string;
  legsLine?: string;
  names: [string, string];
  solo: boolean;
  cutThroat: boolean;
  scores: [number, number];
  marks: [number[], number[]];
  nums: number[];
  labels: string[];
  turn: 0 | 1;
  legWins: [number, number];
  legsNeeded: number;
  setWins?: [number, number];
  visitDarts: Dart[];
  disabled: boolean;
  waitingMsg?: string;
  onDart: (d: Dart) => void;
  onMiss: () => void;
  onUndo: () => void;
  onEndVisit: () => void;
  menu: { label: string; onClick: () => void; danger?: boolean }[];
  topBanner?: ReactNode;
};

function Mark({ n }: { n: number }) {
  if (n <= 0) return null;
  if (n === 1) return <svg viewBox="0 0 20 20" className="mc-mark" aria-label="one mark"><line x1="5" y1="16" x2="15" y2="4" /></svg>;
  if (n === 2) return <svg viewBox="0 0 20 20" className="mc-mark" aria-label="two marks"><line x1="5" y1="16" x2="15" y2="4" /><line x1="5" y1="4" x2="15" y2="16" /></svg>;
  return (
    <svg viewBox="0 0 20 20" className="mc-mark closed" aria-label="closed">
      <circle cx="10" cy="10" r="8.2" /><line x1="6" y1="14" x2="14" y2="6" /><line x1="6" y1="6" x2="14" y2="14" />
    </svg>
  );
}

export function ModernCricket(p: ModernCricketProps) {
  const [mult, setMult] = useState<1 | 2 | 3>(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const closedCount = (i: 0 | 1) => p.marks[i].filter(m => m >= 3).length;
  const dead = (k: number) => p.marks[0][k] >= 3 && (p.solo || p.marks[1][k] >= 3);
  const segMarks = p.visitDarts.reduce((n, d) => {
    const k = p.nums.indexOf(d.segment);
    return k >= 0 ? n + d.multiplier : n;
  }, 0);

  const fire = (seg: number) => {
    if (p.disabled) return;
    if (seg === 25) {
      const m = mult === 1 ? 1 : 2;
      p.onDart({ segment: 25, multiplier: m as 1 | 2, value: 25 * m, label: m === 2 ? "DB" : "Bull" });
    } else {
      p.onDart({ segment: seg, multiplier: mult, value: seg * mult, label: mult === 1 ? String(seg) : mult === 2 ? `D${seg}` : `T${seg}` });
    }
    setMult(1);
  };

  const card = (i: 0 | 1) => {
    const on = p.turn === i;
    return (
      <div key={i} className={`mc-card${on ? " is-on" : ""}`}>
        <div className="mc-card-top">
          <span className="mc-name">{p.names[i]}</span>
          {p.legsNeeded > 1 && (
            <span className="mx-dots" aria-label={`${p.legWins[i]} legs won`}>
              {Array.from({ length: p.legsNeeded }, (_, k) => <i key={k} className={k < p.legWins[i] ? "on" : ""} />)}
            </span>
          )}
        </div>
        <div className="mc-score">{p.scores[i]}</div>
        <div className="mc-stats">
          <span>Closed <b>{closedCount(i)}/{p.nums.length}</b></span>
          {p.setWins && <span>Sets <b>{p.setWins[i]}</b></span>}
        </div>
      </div>
    );
  };

  return (
    <div className={`mx-root mc-root${p.nums.length > 7 ? " wide" : ""}`} role="application" aria-label="Cricket scorer">
      <div className="mx-col">
        <header className="mx-head">
          <button className="mx-icon" aria-label="Match menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}><MoreHorizontal size={20} /></button>
          <div className="mx-title">
            <span>{p.heading}</span>
            {p.legsLine && <small>{p.legsLine}</small>}
          </div>
          <span className="mx-head-spacer" />
        </header>

        {menuOpen && (
          <div className="mx-menu" role="menu">
            {p.menu.map(m => (
              <button key={m.label} role="menuitem" className={m.danger ? "danger" : ""} onClick={() => { setMenuOpen(false); m.onClick(); }}>{m.label}</button>
            ))}
            <button role="menuitem" className="close" onClick={() => setMenuOpen(false)}>Close</button>
          </div>
        )}

        {p.topBanner && <div className="mx-banner">{p.topBanner}</div>}

        <div className={`mc-board-cards${p.solo ? " solo" : ""}`}>
          {card(0)}
          {!p.solo && card(1)}
        </div>

        <div className="mc-marks" role="table" aria-label="Marks">
          {p.nums.map((num, k) => (
            <div key={num} role="row" className={`mc-row${dead(k) ? " dead" : ""}`}>
              <div className="mc-cell"><Mark n={Math.min(3, p.marks[0][k])} /></div>
              <div className="mc-num">{p.labels[k]}</div>
              <div className="mc-cell">{!p.solo && <Mark n={Math.min(3, p.marks[1][k])} />}</div>
            </div>
          ))}
        </div>
        {p.cutThroat && <div className="mc-rule">Cut-throat: lowest score wins</div>}

        <div className="mx-slots" aria-live="polite">
          {[0, 1, 2].map(k => {
            const d = p.visitDarts[k];
            const next = k === p.visitDarts.length;
            return (
              <div key={k} className={`mx-slot${d ? " done" : ""}${next ? " next" : ""}`}>
                <small>Dart {k + 1}</small><b>{d ? d.label : "–"}</b>
              </div>
            );
          })}
          <div className="mx-slot visit"><small>Marks</small><b>{segMarks}</b></div>
        </div>
        {p.waitingMsg && <div className="mx-note">{p.waitingMsg}</div>}

        <div className="mc-mult" role="group" aria-label="Multiplier">
          <button className={mult === 1 ? "on" : ""} aria-pressed={mult === 1} disabled={p.disabled} onClick={() => setMult(1)}>Single</button>
          <button className={`db${mult === 2 ? " on" : ""}`} aria-pressed={mult === 2} disabled={p.disabled} onClick={() => setMult(m => m === 2 ? 1 : 2)}>Double</button>
          <button className={`tr${mult === 3 ? " on" : ""}`} aria-pressed={mult === 3} disabled={p.disabled} onClick={() => setMult(m => m === 3 ? 1 : 3)}>Treble</button>
        </div>

        <div className="mc-pad">
          {p.nums.map((num, k) => {
            const isBull = num === 25;
            return (
              <button key={num} className={`${isBull ? "bull" : ""}${dead(k) ? " closed" : ""}`} disabled={p.disabled || (isBull && mult === 3)} onClick={() => fire(num)}>
                <span>{isBull ? (mult === 2 ? "D-Bull" : "Bull") : num}</span>
                {dead(k) && <small>Closed</small>}
              </button>
            );
          })}
          <button className="miss" disabled={p.disabled} onClick={p.onMiss}>Miss</button>
          {p.nums.length < 7 && <button className="miss" disabled={p.disabled} onClick={p.onMiss} aria-hidden="true" style={{ visibility: "hidden" }}>·</button>}
          <button className="ghost" onClick={p.onUndo}>Undo</button>
          <button className="next" disabled={p.disabled} onClick={p.onEndVisit}>{p.visitDarts.length === 0 ? "No score" : "Next player"}</button>
        </div>
      </div>
    </div>
  );
}
