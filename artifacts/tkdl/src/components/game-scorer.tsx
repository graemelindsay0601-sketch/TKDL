/**
 * GameScorer — orchestrator that routes any game type to its proper scorer engine.
 * Used by both /play (real matches) and /practice (practice sessions).
 */
import { useCallback, useEffect, useState } from "react";
import { resolveBullUp, botBullThrow, type BullThrow, type BullUpState } from "@/lib/darts-rules";
import type { Dart } from "@/lib/dartboard";
import {
  X01Scorer, CricketScorer, KillerScorer, SequenceScorer,
  HalveItScorer, CountUpScorer, GotchaScorer, BaseballScorer,
  ScramScorer, FootballScorer, GolfScorer, NearestBullScorer, ManualScorer,
  JDCChallenge41Scorer, ExponentialBundleScorer, ShootingGalleryScorer, DeadCentreScorer, SnookerScorer,
  ThreeInABedScorer, HighLowScorer,
  TeamX01Scorer, TeamCricketScorer, MultiKillerScorer,
  NinetyNineDartsScorer,
  PickADoubleScorer, LegsScorer, NoughtsCrossesScorer, CheckoutChallengeScorer, FivesScorer, OcheRouletteScorer, OneEightyScorer,
  HareHoundsScorer, PrisonerScorer, KnockoutScorer, TennisScorer, FollowTheLeaderScorer, BattleshipScorer, BlindKillersScorer,
  DonkeyDerbyScorer, LimboScorer, SnakesLaddersScorer, QuackshotScorer, FightGameScorer,
  type LiveScoreState,
} from "@/lib/scorers";
import type { ScorerRecoveryState, X01RecoveryState, CricketRecoveryState, TeamX01RecoveryState, TeamCricketRecoveryState } from "@/lib/scorer-recovery";
import { type BotConfig } from "@/lib/bot-engine";
import { type PracticeStats } from "@/lib/stats-types";
import { useNewScoringUI } from "@/lib/useNewScoringUI";
import { ArrowRight, Check, Crosshair, Radio, RotateCcw } from "lucide-react";
import "./bull-up.css";
export type { PracticeStats };

export type GameTypeOption = {
  id: number; key: string; name: string; engine: string;
  category: string; description: string; config: string | null;
  enabled?: boolean; rulesText?: string | null;
};

export type GameResult = {
  winnerIdx: number; // 0|1 for 2-player/team games; 0..N-1 for multi-player FFA
  detail?: string;
};

function safeParse(s: string | null | undefined): Record<string, unknown> {
  try { return JSON.parse(s ?? "{}") as Record<string, unknown>; }
  catch { return {}; }
}

// ── Bull Up ──────────────────────────────────────────────────────────────────
// A6.5: one canonical bull-up for the whole app. Rules live in the shared
// darts-rules module (resolveBullUp): one dart each at the bull, inner beats
// outer beats miss, a tie in the same ring (or two misses) is re-thrown IN
// REVERSE ORDER, never a coin flip. The bot throws from its own accuracy.

const THROW_OPTS: { t: BullThrow; label: string; color: string; pts: string }[] = [
  { t: "INNER", label: "Inner Bull", color: "#29d49a", pts: "50" },
  { t: "OUTER", label: "Outer Bull", color: "#edc66c", pts: "25" },
  { t: "MISS",  label: "Miss",       color: "#a3aab9", pts: "0"  },
];
const throwLabel = (t: BullThrow | undefined) => t === "INNER" ? "Inner Bull" : t === "OUTER" ? "Outer Bull" : t === "MISS" ? "Miss" : "–";

/**
 * Presentational bull-up. `state` is a resolveBullUp() result; `isHuman(idx)`
 * says whose dart the user enters. Used by GameScorer (local) and Career
 * (server-authoritative: the server records each throw and the bot's throws).
 */
export function BullUpBoard({ names, state, isHuman, onThrow, onContinue, busy, error, subtitle }: {
  names: [string, string]; state: BullUpState; isHuman: (idx: 0 | 1) => boolean;
  onThrow: (idx: 0 | 1, t: BullThrow) => void; onContinue: () => void; busy?: boolean; error?: string | null; subtitle?: string;
}) {
  const round = state.rounds[state.rounds.length - 1];
  const roundNo = state.rounds.length;
  const thrower = state.nextThrower;
  const prev = state.rounds.length > 1 ? state.rounds[state.rounds.length - 2] : null;
  const statusCopy = state.winner !== null
    ? `${names[state.winner]} wins the bull-up`
    : thrower !== null && isHuman(thrower)
      ? `${names[thrower]} · make your throw`
      : thrower !== null
        ? `${names[thrower]} is throwing`
        : "Waiting for throw";
  return (
    <div className="bullup-overlay" role="dialog" aria-modal="true" aria-labelledby="bullup-title">
      <div className="bullup-scene" />
      <div className="bullup-frame">
        <header className="bullup-topbar">
          <div className="bullup-brand"><span className="bullup-mark"><Crosshair size={14} /></span><span>TKDL</span><i /> <span className="bullup-brand-sub">MATCH NIGHT</span></div>
          <div className="bullup-live"><span /> LIVE MATCH <b>MATCH 04&nbsp; / &nbsp;LEG {roundNo}</b></div>
        </header>

        <main className="bullup-content">
          <section className="bullup-hero">
            <div className="bullup-hero-copy">
              <div className="bullup-kicker"><span /> BULL-UP&nbsp; / &nbsp;ROUND {roundNo}</div>
              <h1 id="bullup-title">{state.winner !== null ? "The first edge." : roundNo > 1 ? "The decider." : "The first edge."}</h1>
              <p>{subtitle ?? (roundNo > 1 ? `Re-throw ${roundNo - 1} · reverse order` : "One dart decides who owns the oche.")}</p>
              {prev && <div className="bullup-tie-note" role="status">
                <Radio size={13} aria-hidden /> Tied round: {throwLabel(prev.throws[0])} vs {throwLabel(prev.throws[1])}. {names[round.order[0]]} throws first now.
              </div>}
            </div>

            <div className="bullup-target-stage" aria-hidden="true">
              <div className="bullup-target-halo" />
              <div className="bullup-target">
                <span className="bullup-target-ring" />
                <span className="bullup-target-ring bullup-target-ring--inner" />
                <span className="bullup-target-ring bullup-target-ring--outer" />
                <span className="bullup-target-bull" />
                <span className="bullup-target-center" />
              </div>
              <span className="bullup-target-caption">ONE DART&nbsp; / &nbsp;FIRST THROW</span>
            </div>
          </section>

          <section className="bullup-faceoff" aria-label="Bull-up results">
            {([0, 1] as const).map((idx) => {
              const t = round.throws[idx];
              const win = state.winner === idx;
              const active = thrower === idx && state.winner === null;
              return (
                <article key={idx} className={`bullup-player${win ? " is-winner" : ""}${active ? " is-active" : ""}`}>
                  <div className="bullup-player-top">
                    <span>PLAYER 0{idx + 1}</span>
                    {win && <span className="bullup-first"><Check size={12} aria-hidden /> FIRST THROW</span>}
                    {active && <span className="bullup-turn">AT THE OCHE</span>}
                  </div>
                  <h2>{names[idx]}</h2>
                  <div className="bullup-result">
                    <strong>{t ? (t === "INNER" ? "50" : t === "OUTER" ? "25" : "—") : "—"}</strong>
                    <span><b>{t ? throwLabel(t).toUpperCase() : active ? "YOUR THROW" : "WAITING"}</b><small>{t === "INNER" ? "Closest to centre" : t === "OUTER" ? "Outer ring" : t === "MISS" ? "Outside the scoring area" : active ? "Choose where your dart landed" : "Awaiting throw"}</small></span>
                  </div>
                </article>
              );
            })}
            <div className="bullup-verdict" aria-live="polite">
              <div className="bullup-verdict-label"><Radio size={13} aria-hidden /> OFFICIAL THROW ORDER</div>
              <div className="bullup-verdict-score">
                <span>{round.throws[0] ? (round.throws[0] === "INNER" ? "50" : round.throws[0] === "OUTER" ? "25" : "0") : "—"}</span>
                <i>TO</i>
                <strong>{round.throws[1] ? (round.throws[1] === "INNER" ? "50" : round.throws[1] === "OUTER" ? "25" : "0") : "—"}</strong>
              </div>
              <div className="bullup-verdict-copy">
                <b>{statusCopy}</b>
                <small>{state.winner !== null ? "Nearest to the centre earns the opening throw." : thrower !== null && isHuman(thrower) ? "Record your dart to resolve the opener." : "The opening throw is decided by the bull."}</small>
              </div>
            </div>
          </section>

          {state.winner === null && thrower !== null && isHuman(thrower) && (
            <section className="bullup-throw" aria-label={`${names[thrower]} bull-up throw`}>
              <div className="bullup-throw-heading">
                <div><span>YOUR MOMENT</span><h2>Where did it land?</h2></div>
                <small>SELECT THE RESULT</small>
              </div>
              <div className="bullup-throw-options">
                {THROW_OPTS.map((opt) => (
                  <button key={opt.t} className={`bullup-throw-option bullup-throw-option--${opt.t.toLowerCase()}`} disabled={busy} onClick={() => onThrow(thrower, opt.t)}>
                    <span className="bullup-option-marker" aria-hidden="true" />
                    <span className="bullup-option-copy"><b>{opt.label}</b><small>{opt.t === "INNER" ? "Inside the outer ring" : opt.t === "OUTER" ? "In the outer bull" : "Missed the board"}</small></span>
                    <strong>{opt.pts}</strong>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          )}
          {state.winner === null && thrower !== null && !isHuman(thrower) && (
            <div className="bullup-waiting" role="status"><span className="bullup-pulse" /> {names[thrower]} is at the oche</div>
          )}
          {error && <p className="bullup-error" role="alert">{error}</p>}
          {state.winner !== null && (
            <div className="bullup-continue">
              <div><span>THE OPENING THROW</span><strong>{names[state.winner]}</strong><small>has the first visit</small></div>
              <button onClick={onContinue} disabled={busy}>Start game <ArrowRight size={17} aria-hidden="true" /></button>
            </div>
          )}
          <footer className="bullup-footer"><span>TKDL CAREER TOUR</span><i /> NEAREST TO THE BULL THROWS FIRST</footer>
        </main>
      </div>
    </div>
  );
}

/** Local bull-up (Play / Practice / Classic Tour). Player 1 throws first in round 1. */
function BullUpPhase({ p1Name, p2Name, botHitAcc, onComplete }: {
  p1Name: string; p2Name: string; botHitAcc: number | null; onComplete: (starterIdx: 0 | 1) => void;
}) {
  const [throws, setThrows] = useState<BullThrow[]>([]);
  const state = resolveBullUp(0, throws);
  const isBot = (idx: 0 | 1) => botHitAcc !== null && idx === 1;
  useEffect(() => {
    if (state.winner !== null || state.nextThrower === null || !isBot(state.nextThrower)) return;
    const t = setTimeout(() => setThrows(prev => [...prev, botBullThrow(botHitAcc!, Math.random)]), 700);
    return () => clearTimeout(t);
  }, [throws.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return <BullUpBoard names={[p1Name, p2Name]} state={state} isHuman={idx => !isBot(idx)}
    onThrow={(_, t) => setThrows(prev => [...prev, t])} onContinue={() => state.winner !== null && onComplete(state.winner)} />;
}

// ── GameScorer ────────────────────────────────────────────────────────────────

export function GameScorer({
  p1Name, p2Name, gameType, botConfig, onWin, onAbandon, onPracticeStats,
  legs, setsToWin, legsToWinSet,
  teamNames, playerNames, soloMode, bullUp, scorerThemeColor, teamTurnOrder,
  onLiveState, initialRecovery, onRecoveryState, firstThrower, botVisitPlanner, botCorkPlanner, onDartLog,
}: {
  p1Name: string; p2Name: string;
  gameType: GameTypeOption;
  botConfig?: BotConfig;
  onWin: (result: GameResult) => void;
  onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
  legs?: number;
  setsToWin?: number;
  legsToWinSet?: number;
  teamNames?: [string[], string[]];
  playerNames?: string[];
  soloMode?: boolean;
  bullUp?: boolean;
  /** SCORER_THEME cosmetic: accent colour for the live scoring surface — only
   *  wired into X01 and Cricket (the two primary 1v1 engines) for now. See
   *  practice.tsx for the only caller that ever supplies this. */
  scorerThemeColor?: string | null;
  /**
   * Passed straight through to TeamX01Scorer/TeamCricketScorer — see those
   * components' own doc comments. Left undefined (-> "alternate") for
   * every existing caller (2v2/3v3/Doubles Event/Shift Wars all keep their
   * current turn-for-turn behaviour unchanged); only play.tsx's new
   * "Uneven Teams" format passes "full-pass".
   */
  teamTurnOrder?: "alternate" | "full-pass";
  onLiveState?: (state: LiveScoreState) => void;
  initialRecovery?: ScorerRecoveryState | null;
  onRecoveryState?: (state: ScorerRecoveryState) => void;
  /** First thrower already decided (e.g. Career's server-side bull-up). Skips the local bull-up. */
  firstThrower?: 0 | 1;
  /** X01 only: deterministic bot visits (Career). */
  botVisitPlanner?: (ctx: { remaining: number; opened: boolean }) => Dart[];
  /** Soft-tip: the bot's seeded cork dart for a round-limit leg (Career). */
  botCorkPlanner?: (ctx: { legNo: number; throwIndex: number }) => Dart;
  /** X01 only: canonical dart log of the match after every dart/undo. */
  onDartLog?: (darts: Dart[]) => void;
}) {
  // X01 and Cricket take the starter directly (bot stays player 2); other engines
  // still swap names, which is only correct between two humans, so with a bot
  // they skip the bull-up rather than hand the bot's start to the human.
  const swapless = gameType.engine === "X01" || gameType.engine === "Cricket";
  const isBullUpApplicable = !!bullUp && !soloMode && firstThrower === undefined && (swapless || !botConfig);
  const [starterIdx, setStarterIdx] = useState<0 | 1 | null>(() => initialRecovery?.starterIdx ?? firstThrower ?? (isBullUpApplicable ? null : 0));
  // Admin-preview-only redesign of the 8 party game scoring screens — see
  // useNewScoringUI() and /admin's Feature Flags panel ("New Scoring UI").
  // Everything else (X01, Cricket, Killer, every non-party engine) ignores
  // this entirely and renders exactly as before.
  const newScoringUI = useNewScoringUI();
  const reportLiveState = useCallback((state: LiveScoreState) => {
    if (!onLiveState) return;
    onLiveState(starterIdx === 1 && !swapless
      ? { ...state, scores: [state.scores[1], state.scores[0]], turn: state.turn === 0 ? 1 : 0, detail: state.detail ? [state.detail[1], state.detail[0]] : undefined }
      : state);
  }, [onLiveState, starterIdx, swapless]);
  const reportX01Recovery = useCallback((state: X01RecoveryState) => {
    if (starterIdx !== null) onRecoveryState?.({ version: 2, starterIdx, engine: "X01", state });
  }, [onRecoveryState, starterIdx]);
  const reportCricketRecovery = useCallback((state: CricketRecoveryState) => {
    if (starterIdx !== null) onRecoveryState?.({ version: 2, starterIdx, engine: "Cricket", state });
  }, [onRecoveryState, starterIdx]);
  const reportTeamX01Recovery = useCallback((state: TeamX01RecoveryState) => {
    if (starterIdx !== null) onRecoveryState?.({ version: 2, starterIdx, engine: "TeamX01", state });
  }, [onRecoveryState, starterIdx]);
  const reportTeamCricketRecovery = useCallback((state: TeamCricketRecoveryState) => {
    if (starterIdx !== null) onRecoveryState?.({ version: 2, starterIdx, engine: "TeamCricket", state });
  }, [onRecoveryState, starterIdx]);

  function renderInner() {
    if (starterIdx === null) {
      return (
        <BullUpPhase
          p1Name={p1Name}
          p2Name={p2Name}
          botHitAcc={botConfig ? botConfig.hitAcc : null}
          onComplete={setStarterIdx}
        />
      );
    }

    // X01/Cricket: players keep their seats and the engine starts with the
    // bull-up winner (A6.5 fix: swapping put the human in the bot's seat).
    // Other engines: swap names + invert winner index if P2 won the bull-up.
    const swap = starterIdx === 1 && !swapless;
    const ep1 = swap ? p2Name : p1Name;
    const ep2 = swap ? p1Name : p2Name;
    const wrappedOnWin: typeof onWin = swap
      ? (result) => onWin({ ...result, winnerIdx: result.winnerIdx === 0 ? 1 : 0 })
      : onWin;

    const orderedTeams: [string[], string[]] | undefined = teamNames
      ? starterIdx === 1 ? [teamNames[1], teamNames[0]] : teamNames
      : undefined;
    const cfg = safeParse(gameType.config);
    const win = (idx: number, detail?: string) => wrappedOnWin({ winnerIdx: idx, detail });
    const live = onLiveState ? reportLiveState : undefined;

  // ── Team engines (variable-length, 2v2 / 3v3 / Uneven Teams) ─────────────────
  if (gameType.engine === "TeamX01" && teamNames) {
    return <TeamX01Scorer teamNames={orderedTeams!} config={cfg as any} onWin={win} onAbandon={onAbandon} onLiveState={live} turnOrder={teamTurnOrder}
      initialRecovery={initialRecovery?.engine === "TeamX01" ? initialRecovery.state : undefined} onRecoveryState={onRecoveryState ? reportTeamX01Recovery : undefined} />;
  }

  if (gameType.engine === "TeamCricket" && teamNames) {
    return <TeamCricketScorer teamNames={orderedTeams!} cutThroat={!!cfg.cutThroat} onWin={win} onAbandon={onAbandon} onLiveState={live} turnOrder={teamTurnOrder}
      initialRecovery={initialRecovery?.engine === "TeamCricket" ? initialRecovery.state : undefined} onRecoveryState={onRecoveryState ? reportTeamCricketRecovery : undefined} />;
  }

  if (gameType.engine === "MultiKiller" && playerNames) {
    return <MultiKillerScorer playerNames={playerNames} lives={(cfg.lives as number) ?? 3} onWin={win} onAbandon={onAbandon} />;
  }

  // ── Standard 1v1 engines ─────────────────────────────────────────────────────
  switch (gameType.engine) {
    case "X01":
      return <X01Scorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} onLiveState={live} legs={legs} setsToWin={setsToWin} legsToWinSet={legsToWinSet} soloMode={soloMode} newScoringUI={newScoringUI} scorerThemeColor={scorerThemeColor}
        initialRecovery={initialRecovery?.engine === "X01" ? initialRecovery.state : undefined} onRecoveryState={onRecoveryState ? reportX01Recovery : undefined}
        firstThrower={starterIdx} botVisitPlanner={botVisitPlanner} botCorkPlanner={botCorkPlanner} onDartLog={onDartLog} />;

    case "Cricket":
      return <CricketScorer p1Name={ep1} p2Name={ep2} cutThroat={!!cfg.cutThroat} includesBull={cfg.includesBull !== false} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} onLiveState={live} newScoringUI={newScoringUI} scorerThemeColor={scorerThemeColor}
        initialRecovery={initialRecovery?.engine === "Cricket" ? initialRecovery.state : undefined} onRecoveryState={onRecoveryState ? reportCricketRecovery : undefined}
        firstThrower={starterIdx} />;

    case "Killer":
      return <KillerScorer p1Name={ep1} p2Name={ep2} lives={(cfg.lives as number) ?? 3} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;

    case "Sequence":
      return <SequenceScorer p1Name={ep1} p2Name={ep2} config={cfg} gameKey={gameType.key} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;

    case "HighLow":
      return <HighLowScorer p1Name={ep1} p2Name={ep2} config={cfg} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;

    case "HalveIt":
      return <HalveItScorer p1Name={ep1} p2Name={ep2} gameKey={gameType.key} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;

    case "CountUp":
      return <CountUpScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;

    case "Gotcha":
      return <GotchaScorer p1Name={ep1} p2Name={ep2} target={(cfg.target as number) ?? 301} botConfig={botConfig} onWin={win} onAbandon={onAbandon} newScoringUI={newScoringUI} />;

    case "NearestBull":
      return <NearestBullScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;

    case "JDCChallenge41":
      return <JDCChallenge41Scorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "ExponentialBundle":
      return <ExponentialBundleScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "ShootingGallery":
      return <ShootingGalleryScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "DeadCentre":
      return <DeadCentreScorer p1Name={ep1} p2Name={ep2} target={(cfg.target as number) ?? 300} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "NinetyNine":
      return <NinetyNineDartsScorer p1Name={p1Name} config={cfg as any} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Custom":
      switch (gameType.key) {
        case "baseball":
          return <BaseballScorer p1Name={ep1} p2Name={ep2} innings={(cfg.innings as number) ?? 9} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;
        case "scram":
          return <ScramScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;
        case "football_darts":
          return <FootballScorer p1Name={ep1} p2Name={ep2} goalsToWin={(cfg.goalsToWin as number) ?? 5} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "golf_darts":
        case "golf_darts_18":
          return <GolfScorer p1Name={ep1} p2Name={ep2} holes={(cfg.holes as number) ?? 9} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "nearest_bull":
          return <NearestBullScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;
        case "three_in_a_bed":
          return <ThreeInABedScorer p1Name={ep1} p2Name={ep2} winsNeeded={(cfg.winsNeeded as number) ?? 5} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;
        case "snooker_darts":
          return <SnookerScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "pick_a_double":
          return <PickADoubleScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "legs":
          return <LegsScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "noughts_crosses":
          return <NoughtsCrossesScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;
        case "checkout_challenge":
          return <CheckoutChallengeScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "fives":
          return <FivesScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "oche_roulette":
          return <OcheRouletteScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "one_eighty_challenge":
          return <OneEightyScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "hare_and_hounds":
          return <HareHoundsScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "prisoner":
          return <PrisonerScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "knockout":
          return <KnockoutScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "tennis":
          return <TennisScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "follow_the_leader":
          return <FollowTheLeaderScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "battleship_darts":
          return <BattleshipScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "blind_killers":
          return <BlindKillersScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "donkey_derby":
          return <DonkeyDerbyScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "limbo":
          return <LimboScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "snakes_ladders":
          return <SnakesLaddersScorer p1Name={ep1} p2Name={ep2} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "quackshot":
          return <QuackshotScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        case "fight_game":
          return <FightGameScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} newScoringUI={newScoringUI} />;
        default:
          return <ManualScorer p1Name={ep1} p2Name={ep2} gameName={gameType.name} rules={gameType.description} onWin={win} onAbandon={onAbandon} />;
      }

    default:
      return <ManualScorer p1Name={ep1} p2Name={ep2} gameName={gameType.name} rules={gameType.description} onWin={win} onAbandon={onAbandon} />;
  }
  } // end renderInner

  return renderInner();
}
