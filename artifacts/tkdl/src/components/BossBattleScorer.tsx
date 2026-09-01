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
  const [isEnrageBanner, setIsEnrageBanner] = useState(false);
  const lastLegRef = useRef<number>(0);

  const handleLegStart = (legNumber: number) => {
    if (legNumber === lastLegRef.current) return; // guard against StrictMode double-invoke
    lastLegRef.current = legNumber;
    const { effects, move, isEnrage } = getBossEffectsForLeg(boss, legNumber);
    setCardEffects(effects);
    setAttackBanner(move);
    setIsEnrageBanner(isEnrage);
  };

  useEffect(() => {
    if (!attackBanner) return;
    // Enrage banners get a beat longer on screen — there's more going on
    // (the "final push" label plus a longer description) and it's the
    // moment the fight actually turns, worth lingering on.
    const t = setTimeout(() => setAttackBanner(null), isEnrageBanner ? 4500 : 3500);
    return () => clearTimeout(t);
  }, [attackBanner, isEnrageBanner]);

  const handleMatchComplete = (winnerIdx: 0 | 1, detail?: string) => {
    onMatchComplete({ winnerIdx, detail });
  };

  const botConfig = BOT_LEVELS[boss.botLevel];

  return (
    <div style={{ position: "relative" }}>
      {attackBanner && (
        <div style={{
          position: "fixed", top: 60, left: "50%", transform: "translateX(-50%)", zIndex: 3000,
          padding: isEnrageBanner ? "14px 26px" : "10px 22px", borderRadius: "12px", textAlign: "center",
          background: isEnrageBanner ? "linear-gradient(135deg,#ff005c,#4a0012)" : "linear-gradient(135deg,#8b0000,#2b0000)",
          border: isEnrageBanner ? "1px solid rgba(255,0,92,0.8)" : "1px solid rgba(255,80,80,0.5)",
          boxShadow: isEnrageBanner ? "0 0 40px rgba(255,0,92,0.5), 0 10px 32px rgba(0,0,0,0.6)" : "0 10px 32px rgba(0,0,0,0.6)",
          fontFamily: "Oswald, sans-serif",
          maxWidth: "min(90vw, 380px)",
          animation: isEnrageBanner ? "boss-enrage-pulse 1.1s ease-in-out infinite" : undefined,
        }}>
          {isEnrageBanner && (
            <div style={{ fontSize: "0.6rem", fontWeight: 900, letterSpacing: "0.15em", color: "#ffd24a", textTransform: "uppercase", marginBottom: "3px" }}>
              ⚔ Final Push ⚔
            </div>
          )}
          <div style={{ fontSize: isEnrageBanner ? "0.75rem" : "0.65rem", fontWeight: 900, letterSpacing: "0.08em", color: "#ff6b6b", textTransform: "uppercase" }}>
            {boss.name} uses {attackBanner.name}!
          </div>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.75)", marginTop: "3px" }}>
            {attackBanner.description}
          </div>
          <style>{`
            @keyframes boss-enrage-pulse {
              0%, 100% { transform: translateX(-50%) scale(1); }
              50% { transform: translateX(-50%) scale(1.035); }
            }
          `}</style>
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
