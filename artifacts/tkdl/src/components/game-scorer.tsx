/**
 * GameScorer — orchestrator that routes any game type to its proper scorer engine.
 * Used by both /play (real matches) and /practice (practice sessions).
 */
import { useState } from "react";
import {
  X01Scorer, CricketScorer, KillerScorer, SequenceScorer,
  HalveItScorer, CountUpScorer, GotchaScorer, BaseballScorer,
  ScramScorer, FootballScorer, GolfScorer, NearestBullScorer, ManualScorer,
  JDCChallenge41Scorer, ExponentialBundleScorer, ShootingGalleryScorer, DeadCentreScorer,
  ThreeInABedScorer, DoublesX01Scorer,
  TeamX01Scorer, TeamCricketScorer, MultiKillerScorer,
  DoublesTeamCricketScorer, TeamHalveItScorer, TeamCountUpScorer,
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

const TC = (i: 0|1) => i === 0 ? "#22c55e" : "#ee0a78";

/**
 * Generic team overlay for games that aren't X01/Cricket/HalveIt/CountUp.
 * Shows which player within each team is currently throwing, tracked via
 * the scorer's onTurnChanged callback. Players rotate each visit automatically.
 */
function GenericTeamWrapper({ team1, team2, onWin, children }: {
  team1: [string, string]; team2: [string, string];
  onWin: (w: number, d?: string) => void;
  children: (
    p1Name: string, p2Name: string,
    onTurnChanged: (t: 0|1) => void,
    onW: (w: number, d?: string) => void,
  ) => React.ReactNode;
}) {
  const [teamTurn, setTeamTurn] = useState<0|1>(0);
  const [active, setActive]     = useState<[0|1, 0|1]>([0, 0]);
  const teams = [team1, team2] as [[string, string], [string, string]];

  const handleTurnChanged = (newTurn: 0|1) => {
    const prev: 0|1 = newTurn === 0 ? 1 : 0;
    setActive(a => { const n = [...a] as [0|1, 0|1]; n[prev] = n[prev] === 0 ? 1 : 0; return n; });
    setTeamTurn(newTurn);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 mb-3 px-1">
        {([0, 1] as const).map(i => (
          <div key={i} className="pdc-card p-2 text-center transition-all" style={{
            borderColor: teamTurn === i ? TC(i) : "rgba(255,255,255,0.05)",
            background: teamTurn === i ? `${TC(i)}0a` : "transparent",
          }}>
            <div className="text-xs font-bold uppercase" style={{ color: TC(i), opacity: teamTurn === i ? 1 : 0.4, fontFamily: "Oswald,sans-serif", letterSpacing: "0.08em" }}>Team {i + 1}</div>
            <div className="text-sm font-black" style={{ color: teamTurn === i ? "#fff" : "rgba(255,255,255,0.2)", fontFamily: "Oswald,sans-serif" }}>{teams[i][active[i]]}</div>
            {teamTurn === i && <div className="text-xs" style={{ color: TC(i), fontFamily: "Oswald,sans-serif" }}>throwing ▶</div>}
          </div>
        ))}
      </div>
      {children(
        `${team1[0]} / ${team1[1]}`,
        `${team2[0]} / ${team2[1]}`,
        handleTurnChanged,
        onWin,
      )}
    </div>
  );
}

export function GameScorer({
  p1Name, p2Name, gameType, botConfig, onWin, onAbandon, onPracticeStats,
  legs, setsToWin, legsToWinSet,
  teamNames, playerNames,
  team1, team2,
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
  /** Variable-length team arrays for TeamX01/TeamCricket engines */
  teamNames?: [string[], string[]];
  /** Player list for MultiKiller FFA engine */
  playerNames?: string[];
  /** Legacy 2-player doubles via DoublesX01Scorer */
  team1?: [string, string];
  team2?: [string, string];
}) {
  const cfg = safeParse(gameType.config);
  const win = (idx: number, detail?: string) => onWin({ winnerIdx: idx, detail });

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
      if (team1 && team2) {
        return <DoublesX01Scorer team1={team1} team2={team2} config={cfg as any} onWin={win} onAbandon={onAbandon} />;
      }
      return <X01Scorer p1Name={p1Name} p2Name={p2Name} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} legs={legs} setsToWin={setsToWin} legsToWinSet={legsToWinSet} />;

    case "Cricket":
      if (team1 && team2) {
        return <DoublesTeamCricketScorer team1={team1} team2={team2} cutThroat={!!cfg.cutThroat} includesBull={cfg.includesBull !== false} onWin={win} onAbandon={onAbandon} />;
      }
      return <CricketScorer p1Name={p1Name} p2Name={p2Name} cutThroat={!!cfg.cutThroat} includesBull={cfg.includesBull !== false} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Killer":
      return <KillerScorer p1Name={p1Name} p2Name={p2Name} lives={(cfg.lives as number) ?? 3} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Sequence":
      if (team1 && team2) {
        return (
          <GenericTeamWrapper team1={team1} team2={team2} onWin={win}>
            {(p1, p2, tc, ow) => <SequenceScorer p1Name={p1} p2Name={p2} config={cfg} gameKey={gameType.key} onWin={ow} onAbandon={onAbandon} onPracticeStats={onPracticeStats} onTurnChanged={tc} />}
          </GenericTeamWrapper>
        );
      }
      return <SequenceScorer p1Name={p1Name} p2Name={p2Name} config={cfg} gameKey={gameType.key} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "HalveIt":
      if (team1 && team2) {
        return <TeamHalveItScorer team1={team1} team2={team2} gameKey={gameType.key} onWin={win} onAbandon={onAbandon} />;
      }
      return <HalveItScorer p1Name={p1Name} p2Name={p2Name} gameKey={gameType.key} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "CountUp":
      if (team1 && team2) {
        return <TeamCountUpScorer team1={team1} team2={team2} config={cfg as any} onWin={win} onAbandon={onAbandon} />;
      }
      return <CountUpScorer p1Name={p1Name} p2Name={p2Name} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Gotcha":
      if (team1 && team2) {
        return (
          <GenericTeamWrapper team1={team1} team2={team2} onWin={win}>
            {(p1, p2, tc, ow) => <GotchaScorer p1Name={p1} p2Name={p2} target={(cfg.target as number) ?? 301} onWin={ow} onAbandon={onAbandon} onTurnChanged={tc} />}
          </GenericTeamWrapper>
        );
      }
      return <GotchaScorer p1Name={p1Name} p2Name={p2Name} target={(cfg.target as number) ?? 301} onWin={win} onAbandon={onAbandon} />;

    case "NearestBull":
      return <NearestBullScorer p1Name={p1Name} p2Name={p2Name} onWin={win} onAbandon={onAbandon} />;

    case "JDCChallenge41":
      return <JDCChallenge41Scorer p1Name={p1Name} p2Name={p2Name} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "ExponentialBundle":
      return <ExponentialBundleScorer p1Name={p1Name} p2Name={p2Name} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "ShootingGallery":
      return <ShootingGalleryScorer p1Name={p1Name} p2Name={p2Name} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "DeadCentre":
      return <DeadCentreScorer p1Name={p1Name} p2Name={p2Name} target={(cfg.target as number) ?? 300} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Custom":
      switch (gameType.key) {
        case "baseball":
          if (team1 && team2) {
            return (
              <GenericTeamWrapper team1={team1} team2={team2} onWin={win}>
                {(p1, p2, tc, ow) => <BaseballScorer p1Name={p1} p2Name={p2} innings={(cfg.innings as number) ?? 9} onWin={ow} onAbandon={onAbandon} onTurnChanged={tc} />}
              </GenericTeamWrapper>
            );
          }
          return <BaseballScorer p1Name={p1Name} p2Name={p2Name} innings={(cfg.innings as number) ?? 9} onWin={win} onAbandon={onAbandon} />;
        case "scram":
          return <ScramScorer p1Name={p1Name} p2Name={p2Name} onWin={win} onAbandon={onAbandon} />;
        case "football_darts":
          return <FootballScorer p1Name={p1Name} p2Name={p2Name} goalsToWin={(cfg.goalsToWin as number) ?? 5} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "golf_darts":
        case "golf_darts_18":
          if (team1 && team2) {
            return (
              <GenericTeamWrapper team1={team1} team2={team2} onWin={win}>
                {(p1, p2, tc, ow) => <GolfScorer p1Name={p1} p2Name={p2} holes={(cfg.holes as number) ?? 9} onWin={ow} onAbandon={onAbandon} onPracticeStats={onPracticeStats} onTurnChanged={tc} />}
              </GenericTeamWrapper>
            );
          }
          return <GolfScorer p1Name={p1Name} p2Name={p2Name} holes={(cfg.holes as number) ?? 9} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "nearest_bull":
          return <NearestBullScorer p1Name={p1Name} p2Name={p2Name} onWin={win} onAbandon={onAbandon} />;
        case "three_in_a_bed":
          return <ThreeInABedScorer p1Name={p1Name} p2Name={p2Name} winsNeeded={(cfg.winsNeeded as number) ?? 5} onWin={win} onAbandon={onAbandon} />;
        default:
          return <ManualScorer p1Name={p1Name} p2Name={p2Name} gameName={gameType.name} rules={gameType.description} onWin={win} onAbandon={onAbandon} />;
      }

    default:
      return <ManualScorer p1Name={p1Name} p2Name={p2Name} gameName={gameType.name} rules={gameType.description} onWin={win} onAbandon={onAbandon} />;
  }
}
