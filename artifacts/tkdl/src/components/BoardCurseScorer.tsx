import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flame, Shield } from "lucide-react";
import { X01Scorer, CricketScorer } from "@/lib/scorers";
import type { GameResult } from "./game-scorer";
import type { BotConfig } from "@/lib/bot-engine";
import { createCurseRandom, getCursePool, getTierForVisit, rollCurse, type CurseDef, type CurseGameMode, type CurseTier } from "@/lib/board-curse-data";
import type { CCEffect } from "@/lib/card-effect-engine";
import { useNewScoringUI } from "@/lib/useNewScoringUI";

// Vivid, tier-scaled colors so the curse readout reads clearly from across
// the room, not just up close — mild (amber) through severe (hot red).
const TIER_COLOR: Record<CurseTier, string> = { 1: "#ffb400", 2: "#ff6a00", 3: "#ff1744" };

export interface BoardCurseResult extends GameResult {
  visitsTaken: number;
  endedByVisitLimit?: boolean;
  decisiveCurse?: string;
  /** Ids of every curse that hit player 1 (you) — for the Curse Codex. */
  cursesFaced: string[];
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
  /** In Survival, beginning another visit after this many visits ends the run. */
  visitLimit?: number;
  wardAvailable?: boolean;
  onWardUsed?: () => void;
  challengeSeed?: string;
  /** Curse Run: effects that sit under every curse for the whole leg (blessings, Dark Pacts). */
  extraEffects?: CCEffect[];
  /** Curse Run: cap on how severe curses get. */
  maxTier?: CurseTier;
  /** Curse Run: a curse strikes every Nth visit (1 = every visit). */
  strikeEvery?: number;
  /** How many wards you hold (overrides wardAvailable). */
  wards?: number;
  /** Curse Run (Lucky Charm): the first curse of the leg is wiped as it lands. */
  autoWardFirst?: boolean;
  /** Spin the curse wheel when the board escalates to a new severity. */
  wheel?: boolean;
  onMatchComplete: (result: BoardCurseResult) => void;
  onAbandon: () => void;
}

export function BoardCurseScorer({ gameMode, format, p1Name, p2Name, botConfig, legs = 1, topBanner, visitLimit, wardAvailable = false, onWardUsed, challengeSeed, extraEffects, maxTier = 3, strikeEvery = 1, wards, autoWardFirst = false, wheel = true, onMatchComplete, onAbandon }: BoardCurseScorerProps) {
  const newScoringUI = useNewScoringUI();
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
  const [strikeBanner, setStrikeBanner] = useState<{ def: CurseDef; description: string; target: 0 | 1; spin?: boolean; warded?: boolean } | null>(null);
  const [wardsLeft, setWardsLeft] = useState(wards ?? (wardAvailable ? 1 : 0));
  useEffect(() => { if (wards === undefined) setWardsLeft(wardAvailable ? 1 : 0); }, [wardAvailable, wards]);
  // The scorer only takes new effects when the list isn't empty, so "no curse" is sent as the
  // leg-long extras, or a harmless marker if there are none — an empty list would leave the old
  // curse live (that was why a ward used to only clear the readout).
  const base = (): CCEffect[] => extraEffects?.length ? extraEffects : [{ cardName: "No curse", appliedBy: 1, affectsPlayer: 0, status: "active", legDuration: true, hudHidden: true } as CCEffect];
  const facedRef = useRef<Set<string>>(new Set());
  const lastTierRef = useRef<CurseTier | 0>(0);
  const autoWardRef = useRef(autoWardFirst);
  const visitCountRef = useRef(0);      // resets every leg — drives curse escalation tier within the current leg
  const totalVisitsRef = useRef(0);     // accumulates across the whole match — what's actually reported at the end
  const lastLegRef = useRef(0);
  // Last few curse IDs drawn (not just the one immediately before), so a
  // long leg doesn't keep cycling the same one or two curses back-to-back.
  const recentCurseIdsRef = useRef<string[]>([]);
  const activeCurseRef = useRef<{ def: CurseDef; description: string; target: 0 | 1 } | null>(null);
  const finishedRef = useRef(false);
  const duelTargetRef = useRef<{ target: 0 | 1; repeats: number } | null>(null);
  const randomRef = useRef<() => number>(challengeSeed ? createCurseRandom(challengeSeed) : Math.random);

  const names: [string, string] = [p1Name, p2Name];

  const handleLegStart = (legNumber: number) => {
    if (legNumber === lastLegRef.current) return;
    lastLegRef.current = legNumber;
    visitCountRef.current = 0;
    recentCurseIdsRef.current = [];
    lastTierRef.current = 0;
    setCardEffects(base());
    setActiveCurse(null);
    activeCurseRef.current = null;
    setStrikeBanner(null);
  };

  const handleVisitStart = () => {
    if (finishedRef.current) return;
    if (visitLimit && totalVisitsRef.current >= visitLimit) {
      finishedRef.current = true;
      onMatchComplete({
        winnerIdx: 1,
        detail: `The curse held after ${visitLimit} visits`,
        visitsTaken: visitLimit,
        endedByVisitLimit: true,
        decisiveCurse: activeCurseRef.current?.def.name,
        cursesFaced: [...facedRef.current],
      });
      return;
    }
    visitCountRef.current += 1;
    totalVisitsRef.current += 1;
    const count = visitCountRef.current;
    const tier = Math.min(getTierForVisit(count), maxTier) as CurseTier;
    if (strikeEvery > 1 && count > 1 && (count - 1) % strikeEvery !== 0) {
      activeCurseRef.current = null; setActiveCurse(null); setCardEffects(base());
      return;
    }

    // A fresh curse strikes on every visit now (previously this was a
    // 15/35/55% roll by tier) — the tier still escalates how nasty the
    // curse can be as the leg drags on, just no longer whether one lands.
    let target: 0 | 1 = format === "solo" ? 0 : randomRef.current() < 0.5 ? 0 : 1;
    if (format !== "solo") {
      const previous = duelTargetRef.current;
      // Random targeting stays unpredictable, but nobody can be hit more
      // than twice in succession. This removes the unfair 4–5 visit runs
      // that could decide a duel before the other player was pressured.
      if (previous?.target === target && previous.repeats >= 2) target = target === 0 ? 1 : 0;
      duelTargetRef.current = previous?.target === target
        ? { target, repeats: previous.repeats + 1 }
        : { target, repeats: 1 };
    }
    const { def, effect, description } = rollCurse(gameMode, tier, recentCurseIdsRef.current, randomRef.current);
    recentCurseIdsRef.current = [def.id, ...recentCurseIdsRef.current].slice(0, 3);
    const spin = wheel && tier !== lastTierRef.current;
    lastTierRef.current = tier;
    if (autoWardRef.current && target === 0) {
      autoWardRef.current = false;
      activeCurseRef.current = null; setActiveCurse(null); setCardEffects(base());
      setStrikeBanner({ def, description: "Lucky Charm wiped it before it landed.", target, spin, warded: true });
      return;
    }
    if (target === 0) facedRef.current.add(def.id);

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
    setCardEffects([...(extraEffects ?? []), fullEffect]);
    const nextCurse = { def, description, target };
    activeCurseRef.current = nextCurse;
    setActiveCurse(nextCurse);
    setStrikeBanner({ ...nextCurse, spin });
  };

  useEffect(() => {
    if (!strikeBanner) return;
    const t = setTimeout(() => setStrikeBanner(null), strikeBanner.spin ? 4600 : 3500);
    return () => clearTimeout(t);
  }, [strikeBanner]);

  const handleMatchComplete = (winnerIdx: 0 | 1, detail?: string) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onMatchComplete({ winnerIdx, detail, visitsTaken: totalVisitsRef.current, decisiveCurse: activeCurseRef.current?.def.name, cursesFaced: [...facedRef.current] });
  };

  const targetLabel = (target: 0 | 1) => format === "solo" ? "you" : names[target];

  const useWard = () => {
    if (wardsLeft <= 0 || !activeCurseRef.current) return;
    activeCurseRef.current = null;
    setWardsLeft(w => w - 1);
    setCardEffects(base());
    setActiveCurse(null);
    setStrikeBanner(null);
    onWardUsed?.();
  };

  // Everything here is rendered INSIDE the scorer's own scrollable top region (via
  // topBanner below), never as a page-level sibling above it — ScorerLayout claims the
  // full 100dvh for the scorer itself, so extra content placed outside/above it adds
  // real page height on top of that and pushes the whole scorer (including the pinned
  // keypad) off the bottom of the screen on mobile, forcing a scroll just to see it.
  // That's exactly what was happening to the "Active Curse" readout before this fix.
  const combinedTopBanner = (
    <>
      {topBanner}
      {activeCurse && (() => {
        const color = TIER_COLOR[activeCurse.def.tier];
        return (
          <div
            style={{
              padding: "10px 16px", borderRadius: "10px", marginBottom: "8px",
              background: `linear-gradient(135deg, ${color}26, ${color}12)`,
              border: `2px solid ${color}`, boxShadow: `0 0 14px ${color}80, 0 0 30px ${color}40`,
              fontFamily: "Oswald, sans-serif", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Flame className="w-5 h-5 shrink-0" style={{ color }} />
              <div>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.1em", color, textTransform: "uppercase" }}>Active Curse ({targetLabel(activeCurse.target)})</span>
                <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#fff", textShadow: `0 0 10px ${color}a0`, lineHeight: 1.15 }}>{activeCurse.def.name}</div>
              </div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right", maxWidth: "60%" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "rgba(255,255,255,0.85)" }}>{activeCurse.description}</div>
              {wardsLeft > 0 && <button type="button" onClick={useWard} style={{ marginTop: 7, padding: "5px 9px", borderRadius: 7, border: `1px solid ${color}80`, background: "rgba(0,0,0,.28)", color: "#fff", font: "700 .58rem Oswald,sans-serif", textTransform: "uppercase", cursor: "pointer" }}><Shield className="inline w-3 h-3 mr-1" />Use ward{wardsLeft > 1 ? ` (${wardsLeft})` : ""}</button>}
            </div>
          </div>
        );
      })()}
    </>
  );

  return (
    <div style={{ position: "relative" }}>
      {/* Transient "new curse" flash — position:fixed, so (unlike the persistent
          banner above) it never adds page height and is safe to keep as a sibling. */}
      {/* Portalled to <body>: inside the app's <main> (its own stacking context) the flash sat
          under the sticky header and was never actually seen. */}
      {strikeBanner && typeof document !== "undefined" && createPortal((() => {
        const color = TIER_COLOR[strikeBanner.def.tier];
        return (
          <div
            style={{
              position: "fixed", top: "calc(env(safe-area-inset-top, 0px) + 10px)", left: "50%", transform: "translateX(-50%)", zIndex: 2600, width: "max-content",
              maxWidth: "92vw", padding: "14px 24px", borderRadius: "14px",
              background: `linear-gradient(135deg, ${color}38, transparent 70%), #140a0a`, boxShadow: `0 10px 40px rgba(0,0,0,.6), 0 0 24px ${color}55`,
              border: `2px solid ${color}`, color,
              animation: "curse-pulse 0.9s ease-in-out infinite",
              textAlign: "center", fontFamily: "Oswald, sans-serif",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.15em", color, textTransform: "uppercase" }}>
              <Flame className="w-4 h-4" />
              {strikeBanner.warded ? "Curse warded" : strikeBanner.spin && strikeBanner.def.tier > 1 ? `The board escalates — hits ${targetLabel(strikeBanner.target)}` : `New Curse — hits ${targetLabel(strikeBanner.target)}`}
              <Flame className="w-4 h-4" />
            </div>
            {strikeBanner.spin
              ? <CurseWheel key={`${strikeBanner.def.id}:${visitCountRef.current}`} names={getCursePool(gameMode).filter(c => c.tier === strikeBanner.def.tier).map(c => c.name)} final={strikeBanner.def.name} color={color} description={strikeBanner.description} struck={!!strikeBanner.warded} />
              : <>
                <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "#fff", marginTop: "4px", textShadow: `0 0 16px ${color}`, textDecoration: strikeBanner.warded ? "line-through" : undefined }}>{strikeBanner.def.name}</div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "rgba(255,255,255,0.85)", marginTop: "4px" }}>{strikeBanner.description}</div>
              </>}
          </div>
        );
      })(), document.body)}
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
          newScoringUI={newScoringUI}
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
          newScoringUI={newScoringUI}
        />
      )}
    </div>
  );
}

/** The curse wheel: names flick past, slowing down, then the curse lands. */
function CurseWheel({ names, final, color, description, struck }: { names: string[]; final: string; color: string; description: string; struck: boolean }) {
  const [shown, setShown] = useState(names[0] ?? final);
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    let i = 0, delay = 45, t: ReturnType<typeof setTimeout>;
    const step = () => {
      i += 1;
      if (delay > 230) { setShown(final); setLanded(true); return; }
      setShown(names[i % names.length]);
      delay *= 1.18;
      t = setTimeout(step, delay);
    };
    t = setTimeout(step, delay);
    return () => clearTimeout(t);
  }, [names, final]);
  return (
    <>
      <div style={{ margin: "6px auto 0", padding: "4px 14px", borderRadius: 9, border: `1px dashed ${color}90`, background: "rgba(0,0,0,.35)", minWidth: 200 }}>
        <div style={{ fontSize: "1.5rem", fontWeight: 900, color: landed ? "#fff" : "rgba(255,255,255,.55)", textShadow: landed ? `0 0 16px ${color}` : "none", textDecoration: landed && struck ? "line-through" : undefined, transition: "color .2s" }}>{shown}</div>
      </div>
      <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "rgba(255,255,255,0.85)", marginTop: "6px", visibility: landed ? "visible" : "hidden" }}>{description}</div>
    </>
  );
}
