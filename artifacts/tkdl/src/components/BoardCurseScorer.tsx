import { useEffect, useRef, useState } from "react";
import { X01Scorer, CricketScorer } from "@/lib/scorers";
import type { GameResult } from "./game-scorer";
import type { BotConfig } from "@/lib/bot-engine";
import { getTierForVisit, getTriggerChance, rollCurse, type CurseDef, type CurseGameMode } from "@/lib/board-curse-data";
import type { CCEffect } from "@/lib/card-effect-engine";

export interface BoardCurseResult extends GameResult {
  visitsTaken: number;
}

interface BoardCurseScorerProps {
  gameMode: CurseGameMode;
  format: "solo" | "bot" | "local";
  p1Name: string;
  p2Name: string;
  botConfig?: BotConfig;
  /** Best-of-N legs for vs Bot / vs Local. Solo (and each Endless run) always plays exactly one leg at a time. */
  legs?: number;
  /** Extra content (e.g. the Endless-mode leg counter/Stop button) to show above the
   *  match — rendered inside the scorer's own scrollable region alongside the curse
   *  banner, never as a page-level sibling. See X01Scorer's topBanner for why that
   *  distinction matters on mobile. */
  topBanner?: React.ReactNode;
  onMatchComplete: (result: BoardCurseResult) => void;
  onAbandon: () => void;
}

export function BoardCurseScorer({ gameMode, format, p1Name, p2Name, botConfig, legs = 1, topBanner, onMatchComplete, onAbandon }: BoardCurseScorerProps) {
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
  const [activeCurse, setActiveCurse] = useState<{ def: CurseDef; description: string; target: 0 | 1 } | null>(null);
  const [strikeBanner, setStrikeBanner] = useState<{ def: CurseDef; description: string; target: 0 | 1 } | null>(null);
  const visitCountRef = useRef(0);      // resets every leg — drives curse escalation tier within the current leg
  const totalVisitsRef = useRef(0);     // accumulates across the whole match — what's actually reported at the end
  const lastLegRef = useRef(0);
  // Last few curse IDs drawn (not just the one immediately before), so a
  // long leg doesn't keep cycling the same one or two curses back-to-back.
  const recentCurseIdsRef = useRef<string[]>([]);

  const names: [string, string] = [p1Name, p2Name];

  const handleLegStart = (legNumber: number) => {
    if (legNumber === lastLegRef.current) return;
    lastLegRef.current = legNumber;
    visitCountRef.current = 0;
    recentCurseIdsRef.current = [];
    setCardEffects([]);
    setActiveCurse(null);
    setStrikeBanner(null);
  };

  const handleVisitStart = () => {
    visitCountRef.current += 1;
    totalVisitsRef.current += 1;
    const count = visitCountRef.current;
    const tier = getTierForVisit(count);
    const forced = recentCurseIdsRef.current.length === 0 && count >= 4;
    const chance = getTriggerChance(count);
    if (!forced && Math.random() >= chance) return;

    const target: 0 | 1 = format === "solo" ? 0 : Math.random() < 0.5 ? 0 : 1;
    const { def, effect, description } = rollCurse(gameMode, tier, recentCurseIdsRef.current);
    recentCurseIdsRef.current = [def.id, ...recentCurseIdsRef.current].slice(0, 3);

    const fullEffect: CCEffect = {
      cardName: def.name,
      appliedBy: target === 0 ? 1 : 0,
      affectsPlayer: target,
      status: "active",
      // Without this, the shared effects engine expires any active effect
      // the instant the affected player finishes a visit (ccExpireOnTurnEnd)
      // — that's correct for a normal one-visit Card Clash card, but it was
      // silently killing every curse after exactly one visit regardless of
      // whether a new one was due to replace it. legDuration keeps it alive
      // until either a new curse overwrites it (setCardEffects above) or the
      // leg ends (handleLegStart clears it) — matching what the persistent
      // "Active Curse" readout has claimed all along.
      legDuration: true,
      ...effect,
    };
    setCardEffects([fullEffect]);
    setActiveCurse({ def, description, target });
    setStrikeBanner({ def, description, target });
  };

  useEffect(() => {
    if (!strikeBanner) return;
    const t = setTimeout(() => setStrikeBanner(null), 3500);
    return () => clearTimeout(t);
  }, [strikeBanner]);

  const handleMatchComplete = (winnerIdx: 0 | 1, detail?: string) => {
    onMatchComplete({ winnerIdx, detail, visitsTaken: totalVisitsRef.current });
  };

  const targetLabel = (target: 0 | 1) => format === "solo" ? "you" : names[target];

  // Everything here is rendered INSIDE the scorer's own scrollable top region (via
  // topBanner below), never as a page-level sibling above it — ScorerLayout claims the
  // full 100dvh for the scorer itself, so extra content placed outside/above it adds
  // real page height on top of that and pushes the whole scorer (including the pinned
  // keypad) off the bottom of the screen on mobile, forcing a scroll just to see it.
  // That's exactly what was happening to the "Active Curse" readout before this fix.
  const combinedTopBanner = (
    <>
      {topBanner}
      {activeCurse && (
        <div
          style={{
            padding: "8px 14px", borderRadius: "8px", marginBottom: "8px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
            fontFamily: "Oswald, sans-serif", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap",
          }}
        >
          <div>
            <span style={{ fontSize: "0.6rem", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>Active Curse ({targetLabel(activeCurse.target)})</span>
            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#fff" }}>{activeCurse.def.name}</div>
          </div>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.45)", textAlign: "right", maxWidth: "60%" }}>{activeCurse.description}</div>
        </div>
      )}
    </>
  );

  return (
    <div style={{ position: "relative" }}>
      {/* Transient "new curse" flash — position:fixed, so (unlike the persistent
          banner above) it never adds page height and is safe to keep as a sibling. */}
      {strikeBanner && (
        <div
          style={{
            position: "fixed", top: "12px", left: "50%", transform: "translateX(-50%)", zIndex: 60,
            maxWidth: "92vw", padding: "10px 18px", borderRadius: "10px",
            background: "rgba(30,32,40,0.96)", border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)", textAlign: "center", fontFamily: "Oswald, sans-serif",
          }}
        >
          <div style={{ fontSize: "0.65rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
            New Curse — hits {targetLabel(strikeBanner.target)}
          </div>
          <div style={{ fontSize: "1rem", fontWeight: 800, color: "#fff", marginTop: "2px" }}>{strikeBanner.def.name}</div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.55)", marginTop: "2px" }}>{strikeBanner.description}</div>
        </div>
      )}
      {gameMode === "X01" ? (
        <X01Scorer
          p1Name={p1Name} p2Name={p2Name}
          config={{ startingScore: 501, doubleOut: true }}
          botConfig={botConfig}
          soloMode={format === "solo"}
          onWin={handleMatchComplete} onAbandon={onAbandon}
          cardEffects={cardEffects} legs={legs}
          onLegStart={handleLegStart} onVisitStart={handleVisitStart}
          topBanner={combinedTopBanner}
        />
      ) : (
        <CricketScorer
          p1Name={p1Name} p2Name={p2Name}
          botConfig={botConfig}
          soloMode={format === "solo"}
          onWin={handleMatchComplete} onAbandon={onAbandon}
          cardEffects={cardEffects} legs={legs}
          onLegStart={handleLegStart} onVisitStart={handleVisitStart}
          topBanner={combinedTopBanner}
        />
      )}
    </div>
  );
}
