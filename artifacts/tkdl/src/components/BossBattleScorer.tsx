/**
 * BossBattleScorer — wraps X01Scorer/CricketScorer the same way
 * CardClashMatchScorer does, but instead of player-equipped cards, the boss's
 * fixed move (from lib/boss-battles-data.ts) is force-applied against the
 * human player every leg, rotating to the boss's next move each new leg via
 * onLegStart. The human always plays as player 0; the boss is a CPU bot
 * (player 1) styled with the boss's name.
 *
 * Reuses the exact same "card_clash_mode" sessionStorage flag CardClashMatchScorer
 * uses — that's what turns on the whole effects engine (activeEffects
 * processing, the CCEffectsHUD badges, everything) inside the scorers. No
 * cards/equipping/shop involved, just the effects engine running with a
 * boss's kit instead of a player's equipped cards.
 */

import { useEffect, useRef, useState } from "react";
import { X01Scorer, CricketScorer } from "@/lib/scorers";
import type { GameResult } from "./game-scorer";
import { BOT_LEVELS } from "@/lib/bot-engine";
import { getBossEffectsForLeg, type Boss, type BossMove } from "@/lib/boss-battles-data";
import type { CCEffect } from "@/lib/card-effect-engine";

interface BossBattleScorerProps {
  boss: Boss;
  playerName: string;
  onMatchComplete: (result: GameResult) => void;
  onAbandon: () => void;
}

export function BossBattleScorer({ boss, playerName, onMatchComplete, onAbandon }: BossBattleScorerProps) {
  if (typeof window !== "undefined") {
    sessionStorage.setItem("card_clash_mode", "true");
    sessionStorage.removeItem("card_clash_chaos_mode");
    sessionStorage.removeItem("card_clash_chaos_lab_mode");
    sessionStorage.setItem("card_clash_p1_cards", "[]");
    sessionStorage.setItem("card_clash_p2_cards", "[]");
  }

  useEffect(() => {
    return () => {
      sessionStorage.removeItem("card_clash_mode");
      sessionStorage.removeItem("card_clash_p1_cards");
      sessionStorage.removeItem("card_clash_p2_cards");
    };
  }, []);

  const [cardEffects, setCardEffects] = useState<CCEffect[]>([]);
  const [attackBanner, setAttackBanner] = useState<BossMove | null>(null);
  const lastLegRef = useRef<number>(0);

  const handleLegStart = (legNumber: number) => {
    if (legNumber === lastLegRef.current) return; // guard against StrictMode double-invoke
    lastLegRef.current = legNumber;
    const { effects, move } = getBossEffectsForLeg(boss, legNumber);
    setCardEffects(effects);
    setAttackBanner(move);
  };

  useEffect(() => {
    if (!attackBanner) return;
    const t = setTimeout(() => setAttackBanner(null), 3500);
    return () => clearTimeout(t);
  }, [attackBanner]);

  const handleMatchComplete = (winnerIdx: 0 | 1, detail?: string) => {
    onMatchComplete({ winnerIdx, detail });
  };

  const botConfig = BOT_LEVELS[boss.botLevel];

  return (
    <div style={{ position: "relative" }}>
      {attackBanner && (
        <div style={{
          position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 3000,
          padding: "10px 22px", borderRadius: "12px", textAlign: "center",
          background: "linear-gradient(135deg,#8b0000,#2b0000)", border: "1px solid rgba(255,80,80,0.5)",
          boxShadow: "0 10px 32px rgba(0,0,0,0.6)", fontFamily: "Oswald, sans-serif",
          maxWidth: "min(90vw, 380px)",
        }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 900, letterSpacing: "0.08em", color: "#ff6b6b", textTransform: "uppercase" }}>
            {boss.name} uses {attackBanner.name}!
          </div>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.75)", marginTop: "3px" }}>
            {attackBanner.description}
          </div>
        </div>
      )}
      {boss.gameMode === "X01" ? (
        <X01Scorer
          p1Name={playerName}
          p2Name={boss.name}
          config={{ startingScore: 501, doubleOut: true }}
          botConfig={botConfig}
          onWin={handleMatchComplete}
          onAbandon={onAbandon}
          cardEffects={cardEffects}
          legs={3}
          onLegStart={handleLegStart}
        />
      ) : (
        <CricketScorer
          p1Name={playerName}
          p2Name={boss.name}
          botConfig={botConfig}
          onWin={handleMatchComplete}
          onAbandon={onAbandon}
          cardEffects={cardEffects}
          legs={3}
          onLegStart={handleLegStart}
        />
      )}
    </div>
  );
}
