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

const THROW_OPTS: { t: BullThrow; label: string; emoji: string; color: string; pts: string }[] = [
  { t: "INNER", label: "Inner Bull", emoji: "🎯", color: "#22c55e",              pts: "50" },
  { t: "OUTER", label: "Outer Bull", emoji: "⭕", color: "#ffd24a",              pts: "25" },
  { t: "MISS",  label: "Miss",       emoji: "❌", color: "rgba(255,255,255,0.45)", pts: "0"  },
];
const throwLabel = (t: BullThrow | undefined) => t === "INNER" ? "Inner Bull" : t === "OUTER" ? "Outer Bull" : t === "MISS" ? "Miss" : "–";
const throwEmoji = (t: BullThrow | undefined) => t === "INNER" ? "🎯" : t === "OUTER" ? "⭕" : t === "MISS" ? "❌" : "";

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
  return (
    <div role="dialog" aria-label="Bull up" style={{
      position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(rgba(4,4,10,0.93), rgba(4,4,10,0.97)), url("https://i.postimg.cc/Bbf9fbrp/pdc1.jpg")`, backgroundSize: "cover", backgroundPosition: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 380, padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden>🎯</div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.85rem", fontWeight: 900, color: "#fff", letterSpacing: "0.14em", textTransform: "uppercase" }}>BULL UP</div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", color: "rgba(255,255,255,0.55)", marginTop: 5, letterSpacing: "0.08em" }}>
            {subtitle ?? (roundNo > 1 ? `RE-THROW ${roundNo - 1} — REVERSE ORDER` : "NEAREST THE BULL THROWS FIRST")}
          </div>
          {prev && <div style={{ fontSize: "0.72rem", color: "rgba(255,210,74,0.85)", marginTop: 6 }}>
            Tie: {throwLabel(prev.throws[0])} v {throwLabel(prev.throws[1])} — {names[round.order[0]]} throws first now.
          </div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {round.order.map(idx => {
            const t = round.throws[idx];
            const win = state.winner === idx;
            return (
              <div key={idx} style={{ padding: "12px 16px", borderRadius: 10, display: "flex", alignItems: "center", gap: 10,
                background: win ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${win ? "rgba(34,197,94,0.28)" : thrower === idx ? "rgba(255,0,92,0.45)" : "rgba(255,255,255,0.07)"}` }}>
                <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 800, fontSize: "0.88rem", textTransform: "uppercase", flex: 1, color: win ? "#22c55e" : "#fff" }}>{names[idx]}</span>
                <span aria-hidden style={{ fontSize: 15 }}>{throwEmoji(t)}</span>
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", color: "rgba(255,255,255,0.6)" }}>{t ? throwLabel(t) : thrower === idx ? "to throw" : "waiting"}</span>
                {win && <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", fontWeight: 900, color: "#22c55e", letterSpacing: "0.1em" }}>FIRST ▶</span>}
              </div>
            );
          })}
        </div>
        {state.winner === null && thrower !== null && isHuman(thrower) && (
          <>
            <div style={{ textAlign: "center", marginBottom: 12, fontFamily: "Oswald, sans-serif", color: "#fff", fontSize: "0.9rem", letterSpacing: "0.06em" }}>
              {names[thrower]} — where did your dart land?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {THROW_OPTS.map(opt => (
                <button key={opt.t} disabled={busy} onClick={() => onThrow(thrower, opt.t)} style={{
                  width: "100%", padding: "16px 20px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14,
                  background: `${opt.color}12`, border: `1px solid ${opt.color}3a`, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1 }}>
                  <span aria-hidden style={{ fontSize: 22 }}>{opt.emoji}</span>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "1rem", fontWeight: 700, color: opt.color, flex: 1, textAlign: "left", textTransform: "uppercase" }}>{opt.label}</span>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", fontWeight: 900, color: opt.color, opacity: 0.7 }}>{opt.pts}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {state.winner === null && thrower !== null && !isHuman(thrower) && (
          <div role="status" style={{ textAlign: "center", color: "rgba(255,255,255,0.7)", fontFamily: "Oswald, sans-serif" }}>{names[thrower]} is throwing…</div>
        )}
        {error && <p role="alert" style={{ marginTop: 12, color: "#ff8fb4", textAlign: "center", fontSize: "0.85rem" }}>{error}</p>}
        {state.winner !== null && (
          <>
            <div style={{ textAlign: "center", marginBottom: 16, fontFamily: "Oswald, sans-serif", fontSize: "1rem", fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {names[state.winner]} throws first
            </div>
            <button onClick={onContinue} disabled={busy} style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "0.88rem",
              background: "linear-gradient(135deg, #ff005c, #cc0048)", color: "#fff", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.14em" }}>
              Start Game →
            </button>
          </>
        )}
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
  onLiveState, initialRecovery, onRecoveryState, firstThrower, botVisitPlanner, onDartLog,
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
        firstThrower={starterIdx} botVisitPlanner={botVisitPlanner} onDartLog={onDartLog} />;

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
