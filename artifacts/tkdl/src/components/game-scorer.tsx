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
  ThreeInABedScorer,
  TeamX01Scorer, TeamCricketScorer, MultiKillerScorer,
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

export function GameScorer({
  p1Name, p2Name, gameType, botConfig, onWin, onAbandon, onPracticeStats,
  legs, setsToWin, legsToWinSet,
  teamNames, playerNames, soloMode,
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
  soloMode?: boolean;
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
      return <X01Scorer p1Name={p1Name} p2Name={p2Name} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} legs={legs} setsToWin={setsToWin} legsToWinSet={legsToWinSet} soloMode={soloMode} />;

    case "Cricket":
      return <CricketScorer p1Name={p1Name} p2Name={p2Name} cutThroat={!!cfg.cutThroat} includesBull={cfg.includesBull !== false} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Killer":
      return <KillerScorer p1Name={p1Name} p2Name={p2Name} lives={(cfg.lives as number) ?? 3} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Sequence":
      return <SequenceScorer p1Name={p1Name} p2Name={p2Name} config={cfg} gameKey={gameType.key} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "HalveIt":
      return <HalveItScorer p1Name={p1Name} p2Name={p2Name} gameKey={gameType.key} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "CountUp":
      return <CountUpScorer p1Name={p1Name} p2Name={p2Name} config={cfg as any} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;

    case "Gotcha":
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
          return <BaseballScorer p1Name={p1Name} p2Name={p2Name} innings={(cfg.innings as number) ?? 9} onWin={win} onAbandon={onAbandon} />;
        case "scram":
          return <ScramScorer p1Name={p1Name} p2Name={p2Name} onWin={win} onAbandon={onAbandon} />;
        case "football_darts":
          return <FootballScorer p1Name={p1Name} p2Name={p2Name} goalsToWin={(cfg.goalsToWin as number) ?? 5} botConfig={botConfig} onWin={win} onAbandon={onAbandon} onPracticeStats={onPracticeStats} />;
        case "golf_darts":
        case "golf_darts_18":
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
