import { useEffect, useMemo, useState } from "react";
import { DartInputBoard, type Dart as UiDart } from "@/lib/dartboard";
import {
  replay, resolveBullUp, corkDart, legGameFor, planBotX01Visit, planBotCricketVisit, botOptionsFor, botCorkDart, botChoiceDart, seededRandom,
  CHOICE_DARTS, CRICKET_TARGETS, CRICKET_ROUND_LIMIT, type BullThrow, type Dart, type X01Format, type X01MatchState, type LegGame,
} from "@/lib/darts-rules";
import { toUiDart } from "./live-model";
import type { LiveSession } from "./types";
import "./soft-tip-scorer.css";

/**
 * Soft-tip tournament scorer (mixed 01 / Cricket legs, round limits, corks and the Choice leg).
 * A thin view over the shared rules: every dart is appended to the match log and the whole match is
 * replayed with the same rules the server uses, so the screen, the server and the opponent always agree.
 * The opponent's darts, corks and game choice come from the session's seeded bot, as the server verifies.
 */
export function SoftTipScorer({ session, firstThrower, initialDarts, onDarts, onAbandon }: {
  session: LiveSession; firstThrower: 0 | 1; initialDarts: Dart[];
  onDarts: (darts: Dart[]) => void; onAbandon: () => void;
}) {
  const format = session.format as X01Format;
  const [darts, setDarts] = useState<Dart[]>(initialDarts);
  const state = useMemo(() => replay(format, firstThrower, darts), [format, firstThrower, darts]);
  const names = [session.player.name, session.opponent.name];
  const bot = session.bot;

  const push = (d: Dart) => { const next = [...darts, d]; setDarts(next); onDarts(next); };

  // ---------------------------------------------------------------- the opponent (seeded, as the server regenerates it)
  const corkNext = state.cork ? resolveBullUp(state.cork.starter, state.cork.throws).nextThrower : null;
  const choiceNext = state.choice && state.choice.picker === null ? resolveBullUp(state.choice.starter, state.choice.throws).nextThrower : null;
  useEffect(() => {
    if (state.complete) return;
    let dart: Dart | null = null;
    if (state.cork) { if (corkNext === 1) dart = botCorkDart(bot.config, bot.seed, state.legNo, state.cork.throws.length); }
    else if (state.choice) {
      if (state.choice.picker === null && choiceNext === 1) dart = botCorkDart(bot.config, bot.seed, state.legNo, state.choice.throws.length, "choice");
      else if (state.choice.picker === 1) dart = botChoiceDart(bot.config, bot.seed, state.legNo);
    } else if (state.turn === 1) {
      const index = state.visits.filter(v => v.thrower === 1).length;
      const rng = seededRandom(bot.seed, "bot-visit", index);
      const visit = state.visit as (X01MatchState["visit"] & { startBoard?: X01MatchState["cricket"] }) | null;
      const plan = state.game === "CRICKET"
        ? planBotCricketVisit(visit?.startBoard ?? state.cricket, 1, bot.config, rng)
        : planBotX01Visit(visit?.startScore ?? state.scores[1], bot.config, { ...botOptionsFor(format), opened: visit?.startOpened ?? state.opened[1], rng });
      dart = plan[visit?.darts.length ?? 0] ?? null;
    }
    if (!dart) return;
    const t = setTimeout(() => push(dart!), state.cork || state.choice ? 900 : 550);
    return () => clearTimeout(t);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- the player's input
  const humanTurn = !state.complete && !state.cork && !state.choice && state.turn === 0;
  const onDart = (d: UiDart) => { if (humanTurn) push({ segment: d.segment, multiplier: d.multiplier, value: d.value, label: d.label }); };
  const onUndo = () => {
    if (!state.visit || state.visit.thrower !== 0 || state.visit.darts.length === 0) return; // only your darts in this visit
    const next = darts.slice(0, -1); setDarts(next); onDarts(next);
  };

  const game: LegGame = state.game;
  const upcoming = legGameFor(format as X01Format & { bestOfLegs: number }, state.legNo);
  const limit = game === "CRICKET" ? CRICKET_ROUND_LIMIT : format.roundLimit ?? null;
  const round = Math.min(limit ?? 99, state.visits.filter(v => v.legNo === state.legNo && v.thrower === state.legStarter).length + (state.turn === state.legStarter || state.visit ? 1 : 0));
  const visitDarts = state.visit?.darts ?? [];
  const bestOf = format.unit === "LEGS" ? format.bestOfLegs : 0;

  return (
    <div className="stt" aria-label="Soft-tip match">
      <header className="stt-top">
        <div className="stt-legs" aria-label="Legs">
          <span>{names[0]} <b>{state.legs[0]}</b></span><em>Leg {state.legNo} of {bestOf}</em><span><b>{state.legs[1]}</b> {names[1]}</span>
        </div>
        <div className="stt-rules">
          <span className={`stt-game stt-game-${game.toLowerCase()}`}>{state.choice ? "Choice leg" : game === "CRICKET" ? "Cricket" : `${format.startingScore}`}</span>
          {!state.choice && limit ? <span>Round {Math.max(1, round)} / {limit}</span> : null}
          {!state.choice && game === "X01" ? <span>Fat bull · Master out</span> : !state.choice ? <span>Standard cricket · bull 25</span> : null}
        </div>
      </header>

      {game === "CRICKET" && !state.choice ? <CricketBoardView state={state} names={names} /> : (
        <div className="stt-x01">
          {[0, 1].map(p => (
            <div key={p} className={`stt-player${state.turn === p && !state.cork && !state.choice ? " is-up" : ""}`}>
              <span className="stt-name">{names[p]}</span>
              <span className="stt-score">{state.choice ? "—" : state.scores[p]}</span>
            </div>
          ))}
        </div>
      )}

      <div className="stt-visit" aria-live="polite">
        <span className="stt-visit-label">{state.complete ? "Match complete" : humanTurn ? "Your throw" : state.turn === 1 && !state.cork && !state.choice ? `${names[1]} throwing…` : ""}</span>
        <span className="stt-visit-darts">{visitDarts.map((d, i) => <i key={i}>{toUiDart(d).label}</i>)}</span>
      </div>

      <DartInputBoard visitDartCount={visitDarts.length} onDart={onDart} onMiss={() => onDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" })} onUndo={onUndo}
        disabled={!humanTurn} fatBull={game === "X01"} />
      <button className="stt-leave" onClick={onAbandon}>Leave match (progress is saved)</button>

      {state.cork && <CorkDialog title="Cork for the leg" kicker="Round limit reached"
        text={game === "CRICKET" ? "Level on points after 20 rounds, so one dart each at the bull decides the leg." : `Nobody checked out in ${limit} rounds, so one dart each at the bull decides the leg.`}
        starter={state.cork.starter} throws={state.cork.throws} names={names} next={corkNext} onThrow={t => push(corkDart(t))} />}
      {state.choice && state.choice.picker === null && <CorkDialog title="Cork for the Choice leg" kicker={`Deciding leg · ${upcoming === "CHOICE" ? "Choice" : ""}`}
        text="The cork winner picks the game for the deciding leg, and the other player throws first."
        starter={state.choice.starter} throws={state.choice.throws} names={names} next={choiceNext} onThrow={t => push(corkDart(t))} />}
      {state.choice && state.choice.picker === 0 && (
        <div className="stt-dialog" role="dialog" aria-label="Choose the game">
          <div className="stt-dialog-card">
            <div className="stt-kicker">You won the cork</div>
            <h2>Pick the deciding leg</h2>
            <p>{names[1]} throws first in the game you choose.</p>
            <div className="stt-choices">
              <button className="career-btn career-btn-primary" onClick={() => push(CHOICE_DARTS.X01)}>{format.startingScore} (fat bull, master out)</button>
              <button className="career-btn career-btn-primary" onClick={() => push(CHOICE_DARTS.CRICKET)}>Cricket</button>
            </div>
          </div>
        </div>
      )}
      {state.choice && state.choice.picker === 1 && <div className="stt-dialog" role="status"><div className="stt-dialog-card"><p>{names[1]} won the cork and is choosing the game…</p></div></div>}
    </div>
  );
}

const MARK = ["", "/", "X", "Ⓧ"];
function CricketBoardView({ state, names }: { state: X01MatchState; names: string[] }) {
  return (
    <div className="stt-cricket" role="table" aria-label="Cricket board">
      <div className="stt-cricket-head" role="row">
        <span role="columnheader" className={state.turn === 0 ? "is-up" : ""}>{names[0]}<b>{state.cricket.points[0]}</b></span>
        <span role="columnheader" />
        <span role="columnheader" className={state.turn === 1 ? "is-up" : ""}>{names[1]}<b>{state.cricket.points[1]}</b></span>
      </div>
      {CRICKET_TARGETS.map((t, i) => (
        <div key={t} role="row" className={`stt-cricket-row${state.cricket.marks[0][i] >= 3 && state.cricket.marks[1][i] >= 3 ? " is-dead" : ""}`}>
          <span role="cell" aria-label={`${names[0]} ${state.cricket.marks[0][i]} marks`}>{MARK[state.cricket.marks[0][i]]}</span>
          <span role="rowheader" className="stt-target">{t === 25 ? "Bull" : t}</span>
          <span role="cell" aria-label={`${names[1]} ${state.cricket.marks[1][i]} marks`}>{MARK[state.cricket.marks[1][i]]}</span>
        </div>
      ))}
    </div>
  );
}

function CorkDialog({ title, kicker, text, starter, throws, names, next, onThrow }: {
  title: string; kicker: string; text: string; starter: 0 | 1; throws: BullThrow[]; names: string[]; next: 0 | 1 | null; onThrow: (t: BullThrow) => void;
}) {
  return (
    <div className="stt-dialog" role="dialog" aria-label={title}>
      <div className="stt-dialog-card">
        <div className="stt-kicker">{kicker}</div>
        <h2>{title}</h2>
        <p>{text} Nearest the centre wins; the same ring throws again in reverse order.</p>
        <ul>{throws.map((t, i) => <li key={i}>{names[resolveBullUp(starter, throws.slice(0, i)).nextThrower!]}: {t === "INNER" ? "Inner bull" : t === "OUTER" ? "Outer bull" : "Missed the bull"}</li>)}</ul>
        {next === 0 ? (
          <div className="stt-choices">
            {(["INNER", "OUTER", "MISS"] as BullThrow[]).map(t => <button key={t} className="career-btn career-btn-primary" onClick={() => onThrow(t)}>{t === "INNER" ? "Inner bull" : t === "OUTER" ? "Outer bull" : "Missed the bull"}</button>)}
          </div>
        ) : <p role="status">{names[1]} is throwing…</p>}
      </div>
    </div>
  );
}
