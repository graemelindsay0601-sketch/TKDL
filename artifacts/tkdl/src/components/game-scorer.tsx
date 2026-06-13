/**
 * GameScorer — orchestrator that routes any game type to its proper scorer engine.
 * Used by both /play (real matches) and /practice (practice sessions).
 */
import { useState } from "react";
import {
  X01Scorer, CricketScorer, KillerScorer, SequenceScorer,
  HalveItScorer, CountUpScorer, GotchaScorer, BaseballScorer,
  ScramScorer, FootballScorer, GolfScorer, NearestBullScorer, ManualScorer,
  JDCChallenge41Scorer, ExponentialBundleScorer, ShootingGalleryScorer, DeadCentreScorer, SnookerScorer,
  ThreeInABedScorer,
  TeamX01Scorer, TeamCricketScorer, MultiKillerScorer,
  NinetyNineDartsScorer,
} from "@/lib/scorers";
import { type BotConfig } from "@/lib/bot-engine";
import { type PracticeStats } from "@/lib/stats-types";
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

type BullScore = 50 | 25 | 0;

function BullUpPhase({
  p1Name, p2Name, isBot, onComplete,
}: {
  p1Name: string; p2Name: string; isBot: boolean;
  onComplete: (starterIdx: 0 | 1) => void;
}) {
  const [phase, setPhase]  = useState<"p1" | "p2" | "result">("p1");
  const [p1Score, setP1]   = useState<BullScore | null>(null);
  const [p2Score, setP2]   = useState<BullScore | null>(null);
  const [round, setRound]  = useState(1);

  const botThrow = (): BullScore => {
    const r = Math.random();
    return r < 0.15 ? 50 : r < 0.35 ? 25 : 0;
  };

  const scoreLabel = (s: BullScore | null) =>
    s === 50 ? "Inner Bull" : s === 25 ? "Outer Bull" : s === 0 ? "Miss" : "–";
  const scoreEmoji = (s: BullScore | null) =>
    s === 50 ? "🎯" : s === 25 ? "⭕" : "❌";

  const handleThrow = (score: BullScore) => {
    if (phase === "p1") {
      setP1(score);
      if (isBot) {
        setP2(botThrow());
        setPhase("result");
      } else {
        setPhase("p2");
      }
    } else {
      setP2(score);
      setPhase("result");
    }
  };

  const handleContinue = () => {
    if (p1Score === null || p2Score === null) return;
    if (p1Score > p2Score) { onComplete(0); return; }
    if (p2Score > p1Score) { onComplete(1); return; }
    setP1(null); setP2(null); setPhase("p1"); setRound(r => r + 1);
  };

  const isTie = phase === "result" && p1Score !== null && p2Score !== null && p1Score === p2Score;

  const THROW_OPTS: { score: BullScore; label: string; emoji: string; color: string; pts: string }[] = [
    { score: 50, label: "Inner Bull", emoji: "🎯", color: "#22c55e",              pts: "50 pts" },
    { score: 25, label: "Outer Bull", emoji: "⭕", color: "#ffd24a",              pts: "25 pts" },
    { score: 0,  label: "Miss",       emoji: "❌", color: "rgba(255,255,255,0.3)", pts: "0 pts"  },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: `linear-gradient(rgba(4,4,10,0.93), rgba(4,4,10,0.97)), url("https://i.postimg.cc/Bbf9fbrp/pdc1.jpg")`,
      backgroundSize: "cover", backgroundPosition: "center",
    }}>
      <div style={{ width: "100%", maxWidth: 380, padding: "0 20px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 44, marginBottom: 10 }}>🎯</div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.85rem", fontWeight: 900, color: "#fff", letterSpacing: "0.14em", textTransform: "uppercase" }}>
            BULL UP
          </div>
          <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", color: "rgba(255,255,255,0.32)", marginTop: 5, letterSpacing: "0.08em" }}>
            {round > 1 ? `TIE — ROUND ${round}` : "CLOSEST TO BULL GOES FIRST"}
          </div>
        </div>

        {phase !== "result" ? (
          <>
            {/* Current thrower */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "rgba(255,0,92,0.65)", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 5 }}>
                {phase === "p1" ? "PLAYER 1" : "PLAYER 2"}
              </div>
              <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.5rem", fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {phase === "p1" ? p1Name : p2Name}
              </div>
              <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.28)", marginTop: 6 }}>
                Throw one dart at the bull
              </div>
            </div>

            {/* Throw buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {THROW_OPTS.map(opt => (
                <button key={opt.score} onClick={() => handleThrow(opt.score)}
                  style={{
                    width: "100%", padding: "16px 20px", borderRadius: 12,
                    display: "flex", alignItems: "center", gap: 14,
                    background: `${opt.color}12`, border: `1px solid ${opt.color}3a`,
                    cursor: "pointer",
                  }}>
                  <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "1rem", fontWeight: 700, color: opt.color, flex: 1, textAlign: "left", textTransform: "uppercase" }}>
                    {opt.label}
                  </span>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", fontWeight: 900, color: opt.color, opacity: 0.55 }}>
                    {opt.pts}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Results */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {([
                { name: p1Name, score: p1Score, win: p1Score !== null && p2Score !== null && p1Score > p2Score },
                { name: p2Name, score: p2Score, win: p2Score !== null && p1Score !== null && p2Score > p1Score },
              ] as { name: string; score: BullScore | null; win: boolean }[]).map(({ name, score, win }, i) => (
                <div key={i} style={{
                  padding: "12px 16px", borderRadius: 10,
                  display: "flex", alignItems: "center", gap: 10,
                  background: win ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${win ? "rgba(34,197,94,0.28)" : "rgba(255,255,255,0.07)"}`,
                }}>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 800, fontSize: "0.88rem", textTransform: "uppercase", flex: 1, color: win ? "#22c55e" : "rgba(255,255,255,0.55)" }}>
                    {name}
                  </span>
                  <span style={{ fontSize: 15 }}>{scoreEmoji(score)}</span>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.72rem", color: "rgba(255,255,255,0.35)" }}>
                    {scoreLabel(score)}
                  </span>
                  {win && (
                    <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", fontWeight: 900, color: "#22c55e", letterSpacing: "0.1em" }}>
                      FIRST ▶
                    </span>
                  )}
                </div>
              ))}
            </div>

            {isTie ? (
              <>
                <div style={{ textAlign: "center", marginBottom: 16, fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", color: "rgba(255,210,74,0.8)", letterSpacing: "0.05em" }}>
                  It's a tie — throw again!
                </div>
                <button onClick={handleContinue} style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                  fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "0.85rem",
                  background: "#ffd24a", color: "#000", cursor: "pointer",
                  textTransform: "uppercase", letterSpacing: "0.12em",
                }}>
                  Throw Again
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", marginBottom: 16, fontFamily: "Oswald, sans-serif", fontSize: "1rem", fontWeight: 800, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {p1Score! > p2Score! ? p1Name : p2Name} goes first!
                </div>
                <button onClick={handleContinue} style={{
                  width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                  fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "0.88rem",
                  background: "linear-gradient(135deg, #ff005c, #cc0048)", color: "#fff",
                  cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.14em",
                }}>
                  Start Game →
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── GameScorer ────────────────────────────────────────────────────────────────

export function GameScorer({
  p1Name, p2Name, gameType, botConfig, onWin, onAbandon, onPracticeStats,
  legs, setsToWin, legsToWinSet,
  teamNames, playerNames, soloMode, bullUp,
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
}) {
  const isBullUpApplicable = bullUp && !soloMode;
  const [starterIdx, setStarterIdx] = useState<0 | 1 | null>(isBullUpApplicable ? null : 0);

  if (starterIdx === null) {
    return (
      <BullUpPhase
        p1Name={p1Name}
        p2Name={p2Name}
        isBot={!!botConfig}
        onComplete={setStarterIdx}
      />
    );
  }

  // Swap names + invert winner index if P2 won the bull-up
  const ep1 = starterIdx === 1 ? p2Name : p1Name;
  const ep2 = starterIdx === 1 ? p1Name : p2Name;
  const wrappedOnWin: typeof onWin = starterIdx === 1
    ? (result) => onWin({ ...result, winnerIdx: result.winnerIdx === 0 ? 1 : 0 })
    : onWin;

  const cfg = safeParse(gameType.config);
  const win = (idx: number, detail?: string) => wrappedOnWin({ winnerIdx: idx, detail });

  // ── Team engines (variable-length, 2v2 / 3v3) ────────────────────────────────
  if (gameType.engine === "TeamX01" && teamNames) {
    return <TeamX01Scorer teamNames={teamNames} config={cfg as any} onWin={win} onAbandon={onAbandon} />;
  }

  if (gameType.engine === "TeamCricket" && teamNames) {
    return <TeamCricketScorer teamNames={teamNames} cutThroat={!!cfg.cutThroat} onWin={win} onAbandon={onAbandon} />;
  }

  if (gameType.engine === "MultiKiller" && playerNames) {
    return <MultiKillerScorer playerNames={playerNames} lives={(cfg.lives as number) ?? 3} onWin={win} onAbandon={onAbandon} />;
  }

  // ── Standard 1v1 engines ─────────────────────────────────────────────────────
  switch (gameType.engine) {
    case "X01":
      return <X01Scorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} legs={legs} setsToWin={setsToWin} legsToWinSet={legsToWinSet} soloMode={soloMode} />;

    case "Cricket":
      return <CricketScorer p1Name={ep1} p2Name={ep2} cutThroat={!!cfg.cutThroat} includesBull={cfg.includesBull !== false} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Killer":
      return <KillerScorer p1Name={ep1} p2Name={ep2} lives={(cfg.lives as number) ?? 3} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Sequence":
      return <SequenceScorer p1Name={ep1} p2Name={ep2} config={cfg} gameKey={gameType.key} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "HalveIt":
      return <HalveItScorer p1Name={ep1} p2Name={ep2} gameKey={gameType.key} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "CountUp":
      return <CountUpScorer p1Name={ep1} p2Name={ep2} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Gotcha":
      return <GotchaScorer p1Name={ep1} p2Name={ep2} target={(cfg.target as number) ?? 301} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;

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
        default:
          return <ManualScorer p1Name={ep1} p2Name={ep2} gameName={gameType.name} rules={gameType.description} onWin={win} onAbandon={onAbandon} />;
      }

    default:
      return <ManualScorer p1Name={ep1} p2Name={ep2} gameName={gameType.name} rules={gameType.description} onWin={win} onAbandon={onAbandon} />;
  }
}
