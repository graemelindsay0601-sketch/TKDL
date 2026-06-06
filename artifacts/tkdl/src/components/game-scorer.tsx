/**
 * GameScorer — orchestrator that routes any game type to its proper scorer engine.
 * Used by both /play (real matches) and /practice (practice sessions).
 */
import {
  X01Scorer, CricketScorer, KillerScorer, SequenceScorer,
  HalveItScorer, CountUpScorer, GotchaScorer, BaseballScorer,
  ScramScorer, FootballScorer, GolfScorer, NearestBullScorer, ManualScorer,
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
  winnerIdx: 0 | 1;
  detail?: string;
};

function safeParse(s: string | null | undefined): Record<string, unknown> {
  try { return JSON.parse(s ?? "{}") as Record<string, unknown>; }
  catch { return {}; }
}

export function GameScorer({
  p1Name, p2Name, gameType, botConfig, onWin, onAbandon, onPracticeStats,
  legs, setsToWin, legsToWinSet,
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
}) {
  const cfg = safeParse(gameType.config);
  const win = (idx: 0 | 1, detail?: string) => onWin({ winnerIdx: idx, detail });

  switch (gameType.engine) {
    case "X01":
      return <X01Scorer p1Name={p1Name} p2Name={p2Name} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} legs={legs} setsToWin={setsToWin} legsToWinSet={legsToWinSet} />;

    case "Cricket":
      return <CricketScorer p1Name={p1Name} p2Name={p2Name} cutThroat={!!cfg.cutThroat} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;

    case "Killer":
      return <KillerScorer p1Name={p1Name} p2Name={p2Name} lives={(cfg.lives as number) ?? 3} onWin={win} onAbandon={onAbandon} />;

    case "Sequence":
      return <SequenceScorer p1Name={p1Name} p2Name={p2Name} config={cfg} gameKey={gameType.key} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;

    case "HalveIt":
      return <HalveItScorer p1Name={p1Name} p2Name={p2Name} gameKey={gameType.key} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;

    case "CountUp":
      return <CountUpScorer p1Name={p1Name} p2Name={p2Name} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} />;

    case "Gotcha":
      return <GotchaScorer p1Name={p1Name} p2Name={p2Name} target={(cfg.target as number) ?? 301} onWin={win} onAbandon={onAbandon} />;

    case "NearestBull":
      return <NearestBullScorer p1Name={p1Name} p2Name={p2Name} onWin={win} onAbandon={onAbandon} />;

    case "Custom":
      switch (gameType.key) {
        case "baseball":
          return <BaseballScorer p1Name={p1Name} p2Name={p2Name} innings={(cfg.innings as number) ?? 9} onWin={win} onAbandon={onAbandon} />;
        case "scram":
          return <ScramScorer p1Name={p1Name} p2Name={p2Name} onWin={win} onAbandon={onAbandon} />;
        case "football_darts":
          return <FootballScorer p1Name={p1Name} p2Name={p2Name} goalsToWin={(cfg.goalsToWin as number) ?? 5} onWin={win} onAbandon={onAbandon} />;
        case "golf_darts":
          return <GolfScorer p1Name={p1Name} p2Name={p2Name} holes={(cfg.holes as number) ?? 9} onWin={win} onAbandon={onAbandon} />;
        case "nearest_bull":
          return <NearestBullScorer p1Name={p1Name} p2Name={p2Name} onWin={win} onAbandon={onAbandon} />;
        default:
          return <ManualScorer p1Name={p1Name} p2Name={p2Name} gameName={gameType.name} rules={gameType.description} onWin={win} onAbandon={onAbandon} />;
      }

    default:
      return <ManualScorer p1Name={p1Name} p2Name={p2Name} gameName={gameType.name} rules={gameType.description} onWin={win} onAbandon={onAbandon} />;
  }
}
