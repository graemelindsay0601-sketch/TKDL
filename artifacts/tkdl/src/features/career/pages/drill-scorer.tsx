import { useMemo, useState } from "react";
import { DartInputBoard, VisitDarts, CHECKOUTS, type Dart } from "@/lib/dartboard";
import { replayDrill, type DrillSpec, type Dart as RuleDart } from "@/lib/darts-rules";

/**
 * The scorer for a solo stream drill (Bob's 27, the checkout challenge, the average challenge). It keeps the dart log and
 * works everything out with the shared drill rules, the same ones the server replays; after every visit it hands the log on.
 */
export function DrillScorer({ spec, initialDarts, onVisit, disabled }: { spec: DrillSpec; initialDarts: RuleDart[]; onVisit: (darts: RuleDart[]) => void; disabled?: boolean }) {
  const [darts, setDarts] = useState<RuleDart[]>(initialDarts);
  const state = useMemo(() => replayDrill(spec, darts), [spec, darts]);
  const visitStart = darts.length - state.dartsInVisit;
  const current: Dart[] = darts.slice(visitStart).map(d => ({ ...d, label: d.label ?? String(d.value) }));
  const add = (d: RuleDart) => {
    if (state.complete || disabled) return;
    const next = [...darts, d];
    let after;
    try { after = replayDrill(spec, next); } catch { return; }
    setDarts(next);
    if (after.dartsInVisit === 0 || after.complete) onVisit(next);
  };
  // Undo within the visit only: a finished visit has already gone to chat.
  const undo = () => { if (state.dartsInVisit > 0) setDarts(darts.slice(0, -1)); };
  const bobsTarget = spec.kind === "BOBS_27" ? (state.attempt <= 20 ? [state.attempt] : [25]) : undefined;
  return (
    <div className="dc-drill">
      <div className="dc-drill__head">
        {spec.kind === "BOBS_27" && <><span className="dc-drill__target">{state.target || "Done"}</span><span>Score <b>{state.score}</b> · round {Math.min(21, state.attempt)} of 21</span></>}
        {spec.kind === "CHECKOUTS" && <><span className="dc-drill__target">{state.complete ? "Done" : state.remaining}</span>
          <span>Finish {Math.min(spec.targets.length, state.attempt)} of {spec.targets.length}: <b>{state.target || "-"}</b> · visit {state.visitInAttempt} of {spec.visitsEach} · {state.score} hit
            {!state.complete && state.remaining !== null && CHECKOUTS[state.remaining] ? <> · {CHECKOUTS[state.remaining]}</> : null}</span></>}
        {spec.kind === "SCORING" && <><span className="dc-drill__target">{state.average.toFixed(2)}</span>
          <span>Average so far, target <b>{spec.targetAverage}</b> · {state.target || "Done"}</span></>}
      </div>
      <VisitDarts darts={current} />
      <ol className="dc-drill__visits" aria-label="Recent visits">
        {state.visits.slice(-5).reverse().map(v => <li key={v.index} data-note={v.note}><b>{v.target}</b> {v.darts.map(d => d.label ?? d.value).join(" ")}
          <span>{v.note === "SCORE" ? v.points : v.note === "HIT" ? `+${v.points}` : v.note === "MISS" ? v.points : v.note === "CHECKOUT" ? "checked out" : v.note.toLowerCase()}</span></li>)}
      </ol>
      {!state.complete && <DartInputBoard onDart={add} onMiss={() => add({ segment: 0, multiplier: 1, value: 0, label: "Miss" })} onUndo={undo}
        visitDartCount={state.dartsInVisit} highlightSegments={bobsTarget} disabled={disabled} />}
    </div>
  );
}
