import { useEffect, useState, type ReactNode } from "react";
import { MoreHorizontal, Delete, X } from "lucide-react";
import type { Dart } from "@/lib/dartboard";
import { isPossibleVisit, scoringVisit, finishVisit, finishOptions } from "@/lib/visit-synth";
import "./modern-x01.css";

/**
 * The new X01 scorer layout (Visit total / Per dart). Pure presentation: every
 * score still goes through the X01 engine as darts (onDarts / onDart), so the
 * rules, the dart log, undo and stats are exactly the classic scorer's.
 * Everything fits one screen: scoreboard on top, input underneath, nothing
 * overlapping; match options live in the ⋯ menu.
 */
export type ModernMode = "total" | "perdart";

export type ModernX01Props = {
  mode: ModernMode;
  canTotal: boolean;
  onMode: (m: ModernMode) => void;
  names: [string, string];
  solo: boolean;
  /** Committed remaining per player. */
  scores: [number, number];
  turn: 0 | 1;
  heading: string;
  legsLine?: string;
  legWins: [number, number];
  legsNeeded: number;
  setWins?: [number, number];
  stats: [{ avg: string; darts: number }, { avg: string; darts: number }];
  /** Checkout route per player (active player's follows the live remaining). */
  routes: [string | undefined, string | undefined];
  visitDarts: Dart[];
  bust: boolean;
  bustMsg: string;
  /** Shown instead of input when it's not the human's turn (CPU / partner throwing). */
  waitingMsg?: string;
  disabled: boolean;
  doubleOut: boolean;
  onDart: (d: Dart) => void;
  onMiss: () => void;
  onUndo: () => void;
  /** Queue a whole visit of darts (Visit total). */
  onDarts: (ds: Dart[]) => void;
  topBanner?: ReactNode;
  /** Segments that score nothing right now (Boss Battle / Board Curse effects): struck through on the pad. */
  deadKeys?: number[];
  menu: { label: string; onClick: () => void; danger?: boolean }[];
  /** Last visit score per player, for the card. */
  lastVisit: [number | null, number | null];
};

const QUICK = [26, 41, 45, 60, 81, 85, 100, 140, 180];

export function ModernX01(p: ModernX01Props) {
  const [typed, setTyped] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [finishing, setFinishing] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mult, setMult] = useState<1 | 2 | 3>(1);
  const remaining = p.scores[p.turn];
  const visitSum = p.visitDarts.reduce((s, d) => s + d.value, 0);
  const live = remaining - (p.bust ? 0 : visitSum);
  const midVisit = p.visitDarts.length > 0;

  // A new thrower clears the pad.
  useEffect(() => { setTyped(""); setErr(null); setMult(1); }, [p.turn]);
  useEffect(() => { if (!err) return; const t = setTimeout(() => setErr(null), 2600); return () => clearTimeout(t); }, [err]);

  const submit = (total: number) => {
    if (p.disabled) return;
    if (midVisit) { setErr("Finish this visit dart by dart"); return; }
    if (!isPossibleVisit(total)) { setErr(`${total} isn't possible with three darts`); setTyped(""); return; }
    if (total === remaining) {
      if (!finishOptions(remaining, p.doubleOut).length) { setErr(`${remaining} can't be checked out`); setTyped(""); return; }
      setFinishing(remaining); return;
    }
    const ds = scoringVisit(total);
    if (!ds) return;
    setTyped(""); setErr(null);
    p.onDarts(ds as Dart[]);
  };
  const press = (d: string) => {
    if (p.disabled) return;
    const next = (typed + d).replace(/^0+(?=\d)/, "");
    if (Number(next) > 180) { setErr("A visit is 180 at most"); return; }
    setTyped(next);
  };
  const backOrUndo = () => {
    if (typed) setTyped(typed.slice(0, -1));
    else p.onUndo();
  };
  const fire = (seg: number) => {
    if (p.disabled) return;
    const m = seg === 25 ? 1 : mult;
    const val = seg * m;
    const label = m === 1 ? String(seg) : m === 2 ? `D${seg}` : `T${seg}`;
    p.onDart({ segment: seg, multiplier: m, value: val, label: seg === 25 ? "Bull" : label });
    setMult(1);
  };
  const bull = () => { if (!p.disabled) { p.onDart({ segment: 25, multiplier: 2, value: 50, label: "DB" }); setMult(1); } };

  const typedNum = typed ? Number(typed) : null;
  const leaves = typedNum !== null ? remaining - typedNum : null;
  const finishChoices = finishing !== null ? finishOptions(finishing, p.doubleOut) : [];

  const card = (i: 0 | 1) => {
    const active = p.turn === i && !p.bust;
    const score = i === p.turn ? live : p.scores[i];
    return (
      <div key={i} className={`mx-card${active ? " is-on" : ""}`}>
        <div className="mx-card-top">
          <span className="mx-name">{p.names[i]}</span>
          {p.legsNeeded > 1 && (
            <span className="mx-dots" aria-label={`${p.legWins[i]} legs won`}>
              {Array.from({ length: p.legsNeeded }, (_, k) => <i key={k} className={k < p.legWins[i] ? "on" : ""} />)}
            </span>
          )}
        </div>
        <div className="mx-score">{score}</div>
        {p.routes[i]
          ? <span className={`mx-route${active ? " is-on" : ""}`}>{p.routes[i]}</span>
          : <span className="mx-last">Last <b>{p.lastVisit[i] ?? "–"}</b></span>}
        <div className="mx-stats">
          {p.setWins && <span>Sets <b>{p.setWins[i]}</b></span>}
          <span>Avg <b>{p.stats[i].avg}</b></span>
          <span>Darts <b>{p.stats[i].darts}</b></span>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-root" role="application" aria-label="Scorer">
      <div className="mx-col">
        <header className="mx-head">
          <button className="mx-icon" aria-label="Match menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(o => !o)}><MoreHorizontal size={20} /></button>
          <div className="mx-title">
            <span>{p.heading}</span>
            {p.legsLine && <small>{p.legsLine}</small>}
          </div>
          {p.canTotal ? (
            <div className="mx-seg" role="group" aria-label="Input style">
              <button className={p.mode === "total" ? "on" : ""} aria-pressed={p.mode === "total"} onClick={() => p.onMode("total")}>Total</button>
              <button className={p.mode === "perdart" ? "on" : ""} aria-pressed={p.mode === "perdart"} onClick={() => p.onMode("perdart")}>Per dart</button>
            </div>
          ) : <span className="mx-head-spacer" />}
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

        <div className={`mx-board${p.solo ? " solo" : ""}`}>
          {card(0)}
          {!p.solo && card(1)}
        </div>

        {p.mode === "total" ? (
          <>
            <div className={`mx-strip${p.bust ? " bust" : ""}`} aria-live="polite">
              {p.bust ? <span className="mx-strip-msg">{p.bustMsg || "Bust"}</span>
                : p.waitingMsg ? <><span className="mx-strip-lab">{p.waitingMsg}</span><span className="mx-strip-darts">{p.visitDarts.map(d => d.label).join(" · ")}</span></>
                : err ? <span className="mx-strip-msg">{err}</span>
                : midVisit ? <><span className="mx-strip-lab">This visit</span><span className="mx-strip-num">{visitSum}</span><span className="mx-strip-side">{p.visitDarts.map(d => d.label).join(" · ")}</span></>
                : <><span className="mx-strip-lab">This visit</span><span className={`mx-strip-num${typed ? "" : " empty"}`}>{typed || "0"}</span><span className="mx-strip-side">{leaves !== null ? <>leaves <b>{leaves >= 0 ? leaves : "bust"}</b></> : <>{p.names[p.turn]} to throw</>}</span></>}
            </div>
            <div className="mx-quick">
              {QUICK.map(q => <button key={q} disabled={p.disabled} className={q >= 140 ? "gold" : ""} onClick={() => submit(q)}><span>{q}</span></button>)}
              <button disabled={p.disabled} className="pink" onClick={() => { if (!p.disabled && !midVisit) { setTyped(""); p.onDarts(scoringVisit(0) as Dart[]); } }}>Bust</button>
            </div>
            <div className="mx-pad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} disabled={p.disabled} onClick={() => press(String(n))}><span>{n}</span></button>)}
              <button className="ghost" disabled={p.disabled && !typed} onClick={backOrUndo} aria-label={typed ? "Delete digit" : "Undo last visit"}>
                {typed ? <Delete size={24} /> : "Undo"}
              </button>
              <button disabled={p.disabled} onClick={() => press("0")}><span>0</span></button>
              <button className="enter" disabled={p.disabled || !typed} onClick={() => typedNum !== null && submit(typedNum)}>Enter</button>
            </div>
          </>
        ) : (
          <>
            <div className="mx-slots" aria-live="polite">
              {[0, 1, 2].map(k => {
                const d = p.visitDarts[k];
                const next = !p.bust && k === p.visitDarts.length;
                return (
                  <div key={k} className={`mx-slot${d ? " done" : ""}${next ? " next" : ""}`}>
                    <small>Dart {k + 1}</small><b>{d ? d.label : "–"}</b>
                  </div>
                );
              })}
              <div className={`mx-slot visit${p.bust ? " bust" : ""}`}><small>{p.bust ? "Bust" : "Visit"}</small><b>{p.bust ? "0" : visitSum}</b></div>
            </div>
            {(p.waitingMsg || p.bust) && <div className={`mx-note${p.bust ? " bust" : ""}`}>{p.bust ? (p.bustMsg || "Bust") : p.waitingMsg}</div>}
            <div className="mx-mult" role="group" aria-label="Ring">
              {([1, 2, 3] as const).map(m => (
                <button key={m} className={`m${m}${mult === m ? " on" : ""}`} aria-pressed={mult === m} disabled={p.disabled} onClick={() => setMult(mult === m && m !== 1 ? 1 : m)}>
                  {m === 1 ? "Single" : m === 2 ? "Double" : "Treble"}
                </button>
              ))}
            </div>
            <div className="mx-grid">
              {Array.from({ length: 20 }, (_, k) => 20 - k).map(n => <button key={n} disabled={p.disabled} className={p.deadKeys?.includes(n) ? "dead" : ""} title={p.deadKeys?.includes(n) ? "Scores 0 right now" : undefined} onClick={() => fire(n)}><span>{n}</span></button>)}
            </div>
            <div className="mx-row4">
              <button className={`bull25${p.deadKeys?.includes(25) ? " dead" : ""}`} disabled={p.disabled} onClick={() => fire(25)}>25</button>
              <button className={`bull50${p.deadKeys?.includes(25) ? " dead" : ""}`} disabled={p.disabled} onClick={bull}>Bull</button>
              <button className="ghost" disabled={p.disabled} onClick={p.onMiss}>Miss</button>
              <button className="ghost" disabled={p.bust} onClick={p.onUndo}>Undo</button>
            </div>
          </>
        )}

        {finishing !== null && (
          <div className="mx-finish" role="dialog" aria-label="Checkout">
            <button className="mx-finish-x" aria-label="Cancel" onClick={() => { setFinishing(null); setTyped(""); }}><X size={18} /></button>
            <div className="mx-finish-k">Game shot</div>
            <div className="mx-finish-t">{p.names[p.turn]} checks out {finishing}</div>
            <FinishPicker choices={finishChoices} doubleOut={p.doubleOut} onConfirm={(u, a) => {
              const ds = finishVisit(finishing, u, a, p.doubleOut);
              setFinishing(null); setTyped("");
              if (ds) p.onDarts(ds as Dart[]);
            }} />
          </div>
        )}
      </div>
    </div>
  );
}

function FinishPicker({ choices, doubleOut, onConfirm }: { choices: { dartsUsed: number; atDouble: number }[]; doubleOut: boolean; onConfirm: (u: number, a: number) => void }) {
  const usedOpts = [1, 2, 3].filter(u => choices.some(c => c.dartsUsed === u));
  const [used, setUsed] = useState(usedOpts[usedOpts.length - 1] ?? 3);
  const atOpts = [1, 2, 3].filter(a => choices.some(c => c.dartsUsed === used && c.atDouble === a));
  const [at, setAt] = useState(1);
  const atOk = !doubleOut || atOpts.includes(at);
  return (
    <>
      <div className="mx-finish-q">Darts used this visit</div>
      <div className="mx-finish-row">
        {[1, 2, 3].map(u => <button key={u} disabled={!usedOpts.includes(u)} className={used === u ? "on" : ""} onClick={() => { setUsed(u); setAt(1); }}>{u}</button>)}
      </div>
      {doubleOut && (<>
        <div className="mx-finish-q">Darts at a double</div>
        <div className="mx-finish-row">
          {[1, 2, 3].map(a => <button key={a} disabled={!atOpts.includes(a)} className={at === a ? "on" : ""} onClick={() => setAt(a)}>{a}</button>)}
        </div>
      </>)}
      <button className="mx-finish-go" disabled={!atOk} onClick={() => onConfirm(used, doubleOut ? at : 1)}>Confirm</button>
    </>
  );
}
