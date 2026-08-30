/**
 * Game engine scorer components — each handles its own state + dart input.
 * All scorers receive: p1Name, p2Name, config (parsed from game_type), onWin(0|1, detail?), onAbandon
 */
import React, { useState, useCallback, useRef, useEffect } from "react";
import { DartInputBoard, VisitDarts, CHECKOUTS, type Dart } from "./dartboard";
import { AlertTriangle, Trophy, Zap, RotateCcw, Target, Crosshair, Maximize, Minimize } from "lucide-react";
import { type BotConfig, botX01Visit, botCricketVisit, botSequenceVisit, botHalveItVisit, botCountUpVisit, botFootballVisit, botGolfVisit, botKillerVisit, botGotchaVisit, botBaseballVisit, botScramVisit, botJDCVisit, botExponentialVisit, botShootingGalleryDart } from "./bot-engine";
import { type PracticeStats, type DartThrow } from "./stats-types";
import { CardActivationOverlay } from "@/components/CardActivationOverlay";
import { ChaosCardReveal } from "@/components/ChaosCardReveal";
import { TKDLCard } from "@/components/TKDLCard";
import { EquipCardDisplay } from "@/components/EquipCardDisplay";
import { drawChaosOptions, drawChaosLabOptions, ALL_CARDS, type CardData } from "./cards-data";
import {
  type BoardMark,
  resolveBoardMarksForDart,
  expireBoardMarksForVisitEnd,
  expireBoardMarksForLegEnd,
  placeBoardMark,
  createBoardMarkFromPrototypeCard,
  BOARD_MARK_CARD_ID_MAP,
  BOARD_MARK_PROTOTYPE_CARDS,
  BOARD_MARK_SABOTAGE_CARD_IDS,
  BOARD_MARK_MATCH_SWING_CARD_IDS,
  applyBoardMarkSabotage,
  computeMatchSwingOutcome,
  toBoardMarkDartResult,
  getBoardMarkMagnitude,
  clampX01RemainingAfterReduction,
} from "./card-clash/boardMarks";
import { cardDebugLog } from "./card-debug";
import { createMatchLogger, downloadMatchLog } from "./card-clash/matchLogger";
import type { MatchLogger } from "./card-clash/matchLogger";

/**
 * Sends a match's accumulated log to the backend for later download from
 * the admin panel. Fire-and-forget — a logging failure should never
 * disrupt the match flow, so this never throws and the caller doesn't
 * need to await it.
 */
/** A single Board Mark event that happened during a visit, attached to that visit's history entry so "recent visits" clearly shows it was a bonus/penalty from a named card, not just an unexplained number. */
interface BoardMarkVisitNote {
  icon: string;
  color: string;
  /** e.g. "Hot Bull: +90 bonus", "Score Swap!", "Weakened: your next visit ×0.5" */
  text: string;
}

/** A single entry in the match-wide Chaos Lab Activity Log — persists for the whole match (capped), shown on both X01 and Cricket regardless of whether the engine has a per-visit history panel. */
interface ChaosLabActivityEntry extends BoardMarkVisitNote {
  player: 0 | 1;
  id: string;
}

const CHAOS_LAB_ACTIVITY_LOG_CAP = 20;

/** Pushes an event into both the per-visit notes (used by X01's Recent Visits) and the match-wide activity log (used by both engines) in one call, so every Chaos Lab trigger point only needs one line instead of two. */
function logChaosLabActivity(
  notesRef: React.MutableRefObject<[BoardMarkVisitNote[], BoardMarkVisitNote[]]>,
  activityLogRef: React.MutableRefObject<ChaosLabActivityEntry[]>,
  setActivityTick: (fn: (n: number) => number) => void,
  player: 0 | 1,
  note: BoardMarkVisitNote
) {
  notesRef.current[player].push(note);
  activityLogRef.current = [...activityLogRef.current, { ...note, player, id: `${Date.now()}-${Math.random()}` }].slice(-CHAOS_LAB_ACTIVITY_LOG_CAP);
  setActivityTick(n => n + 1); // activityLogRef is a ref (doesn't trigger re-render on its own) — this forces the Activity Log component to re-render
}

/**
 * Computes what a Hot or Trap trigger actually does, given the mark's
 * payload and (for score_shift) its escalation stage. Shared between X01
 * and Cricket so the magnitude/escalation math lives in exactly one place.
 */
function computeBoardMarkTriggerMagnitude(mark: BoardMark, engine: "X01" | "CRICKET", kind: "hot" | "trap"): number {
  let magnitude = getBoardMarkMagnitude(mark.target.type, engine, kind);
  const stage = Number(mark.metadata?.escalationStage ?? 0);
  if (stage > 0) {
    // Escalation: grows the longer it survives unhit, capped at +150% (stage 5).
    magnitude = Math.round(magnitude * (1 + Math.min(stage, 5) * 0.3));
  }
  return magnitude;
}

function uploadMatchLog(logger: MatchLogger, meta: { gameMode: "X01" | "CRICKET"; isChaosMode: boolean; isChaosLabMode: boolean }) {
  try {
    fetch("/api/card-clash/debug-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameMode: meta.gameMode,
        isChaosMode: meta.isChaosMode,
        isChaosLabMode: meta.isChaosLabMode,
        logText: logger.toText(),
      }),
    }).catch(() => {}); // non-critical, ignore failures
  } catch {
    // ignore — logging must never disrupt the match
  }
}

import { useSafeTimeout } from "./use-safe-timeout";
import { useSettings } from "@/hooks/use-settings";
import { announceScore, announceBust, announceGameShot, isVoiceMuted, setVoiceMuted, getAvailableVoices, getSelectedVoiceURI, setSelectedVoiceURI, onVoicesChanged, speak } from "./voice-announcer";
import {
  type CCEffect,
  ccActivateCard, ccPreprocessDart, ccApplyVisitCap, ccInterceptBust,
  ccShouldBlockFinish, ccApplyVisitEnd, ccExpireOnTurnEnd,
  ccActivateDeferredNextTurnEffects, ccActivateDeferredNextLegEffects,
  ccEvaluateConditionalWildcards, ccEvaluateOpponentWildcards, ccApplyPenaltyBlockingIfNeeded,
  ccValidateCheckoutOnlyCards, ccValidateExactFinishCards,
  ccApplyCricketMarkEffects, ccApplyCricketScoreEffects, ccBlockClosing,
  ccPenaltyPerMark, ccBonusPerMark,
  ccPreprocessCricketDart, CARD_CLASH_CRICKET_NUMS,
} from "./card-effect-engine";

// Cricket helpers
const firstOpenCricketSegment = (marks?: number[]): number => {
  if (!marks) return 20;
  const NUMS = [20, 19, 18, 17, 16, 15, 25];
  for (let i = 0; i < NUMS.length; i += 1) {
    if ((marks[i] ?? 0) < 3) return NUMS[i];
  }
  return 20;
};

function useFullscreen() {
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const onChange = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => { document.removeEventListener("fullscreenchange", onChange); document.removeEventListener("webkitfullscreenchange", onChange); };
  }, []);
  const enter = () => {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch(() => {});
  };
  const exit = () => {
    const doc = document as Document & { webkitExitFullscreen?: () => void };
    (document.exitFullscreen?.() ?? doc.webkitExitFullscreen?.() as unknown as Promise<void>)?.catch?.(() => {});
  };
  const toggle = () => (fs ? exit() : enter());
  return { fs, toggle, enter };
}

function useOrientation() {
  const [landscape, setLandscape] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(orientation: landscape)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(orientation: landscape)");
    const handler = (e: MediaQueryListEvent) => setLandscape(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return landscape;
}

// ── Shared chrome ─────────────────────────────────────────────────────────────
const P_COLOR = (i: number) => i === 0 ? "#22c55e" : "#ee0a78";

function PlayerCard({ name, score, scoreSuffix = "", turn, active, sub }: {
  name: string; score: string | number; scoreSuffix?: string;
  turn: boolean; active: boolean; sub?: string;
}) {
  return (
    <div className="pdc-card p-4 text-center relative overflow-hidden transition-all duration-200"
      style={{
        borderColor: active ? P_COLOR(turn ? 1 : 0) : "rgba(255,255,255,0.06)",
        boxShadow: active ? `0 0 20px ${P_COLOR(turn ? 1 : 0)}22` : undefined,
      }}>
      {active && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: P_COLOR(turn ? 1 : 0) }} />}
      <div className="text-xs font-bold uppercase tracking-widest mb-1"
        style={{ fontFamily: "Oswald, sans-serif", color: P_COLOR(turn ? 1 : 0), opacity: active ? 1 : 0.4 }}>
        {name}
      </div>
      <div className="font-black leading-none"
        style={{ fontFamily: "Oswald, sans-serif", fontSize: "3rem", color: active ? "#fff" : "rgba(255,255,255,0.3)" }}>
        {score}{scoreSuffix}
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>{sub}</div>}
    </div>
  );
}

function dartChipStyle(dart: string): React.CSSProperties {
  if (dart === "DB")                       return { background: "rgba(255,0,92,0.18)",  color: "#ff005c", border: "1px solid rgba(255,0,92,0.4)" };
  if (dart === "Bull")                     return { background: "rgba(255,0,92,0.12)",  color: "#ff6b9d", border: "1px solid rgba(255,0,92,0.3)" };
  if (dart.startsWith("T"))               return { background: "rgba(0,210,150,0.14)", color: "#00d296", border: "1px solid rgba(0,210,150,0.35)" };
  if (dart.startsWith("D"))               return { background: "rgba(255,210,74,0.14)",color: "#ffd24a", border: "1px solid rgba(255,210,74,0.35)" };
  return                                       { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.12)" };
}

function CheckoutBar({ checkout, playerName, playerIdx }: { checkout: string; playerName: string; playerIdx: 0|1 }) {
  const darts = checkout.split(" ");
  const accent = P_COLOR(playerIdx);
  return (
    <div className="rounded-xl px-4 py-3 flex items-center gap-3"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${accent}33` }}>
      <div className="shrink-0">
        <div className="text-xs font-black uppercase tracking-widest" style={{ color: accent, fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>
          {playerName} CHECKOUT
        </div>
      </div>
      <div className="flex items-center gap-2 flex-1 justify-center flex-wrap">
        {darts.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="px-3 py-1 rounded-lg text-sm font-black"
              style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", ...dartChipStyle(d) }}>
              {d}
            </span>
            {i < darts.length - 1 && (
              <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.7rem" }}>→</span>
            )}
          </div>
        ))}
      </div>
      <div className="shrink-0 text-xs font-black" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "Oswald, sans-serif" }}>
        {darts.length}🎯
      </div>
    </div>
  );
}

function TurnBanner({ name, turn, msg }: { name: string; turn: 0 | 1; msg?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm"
      style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
      <Zap className="w-3.5 h-3.5" style={{ color: P_COLOR(turn) }} />
      <span style={{ color: P_COLOR(turn), fontWeight: 700 }}>{name}</span>
      <span className="uppercase tracking-wider text-xs">{msg ?? "— enter your score"}</span>
    </div>
  );
}

function BustBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase"
      style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
      <AlertTriangle className="w-4 h-4" /> {msg}
    </div>
  );
}

function AbandonBtn({ onAbandon }: { onAbandon: () => void }) {
  return (
    <button onClick={onAbandon} className="w-full text-xs py-2 rounded-lg uppercase tracking-widest"
      style={{ color: "rgba(255,255,255,0.2)", background: "transparent", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
      Abandon Match
    </button>
  );
}

/** Card Clash: lets a tester grab the match's structured log immediately, without needing admin panel access — works for Solo vs CPU too, which has no server-side match record at all. */
function DownloadMatchLogBtn({ logger }: { logger: MatchLogger }) {
  return (
    <button onClick={() => downloadMatchLog(logger)} className="w-full text-xs py-2 rounded-lg uppercase tracking-widest"
      style={{ color: "rgba(255,255,255,0.25)", background: "transparent", border: "1px solid rgba(255,255,255,0.06)", fontFamily: "Oswald, sans-serif", cursor: "pointer" }}>
      Download Match Log
    </button>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="pdc-card p-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>{children}</div>
  );
}

/** Card Clash: shows a brief toast when a card effect activates + a persistent bar of currently-live effects.
 *  Each live effect pill is clickable — reopens a popover with the full card art/effect text so players
 *  can re-check what an active effect actually does mid-match. */
function CCEffectsHUD({ effects, names, lastActivation }: {
  effects: CCEffect[];
  names: [string, string];
  lastActivation?: { cardName: string; player: 0 | 1; key: string } | null;
}) {
  const [toast, setToast] = useState<{ key: string; text: string; buff: boolean } | null>(null);
  const [viewing, setViewing] = useState<CCEffect | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastActivation || lastActivation.key === lastKeyRef.current) return;
    lastKeyRef.current = lastActivation.key;
    // Try to determine buff/debuff from the card's own data (GOOD vs BAD category)
    const cardDef = ALL_CARDS.find(c => c.name === lastActivation.cardName);
    const buff = cardDef ? cardDef.category.endsWith("GOOD") : true;
    setToast({
      key: lastActivation.key,
      text: `${lastActivation.cardName} → ${names[lastActivation.player]}`,
      buff,
    });
  }, [lastActivation]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const live = effects.filter(e => e.status === "active" || e.status === "pending" || e.status === "deferred_next_turn" || e.status === "deferred_next_leg");
  const viewingCard = viewing ? ALL_CARDS.find(c => c.name === viewing.cardName) : null;

  return (
    <>
      {toast && (
        <div style={{
          position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)", zIndex: 2500,
          padding: "8px 18px", borderRadius: "999px",
          background: toast.buff ? "linear-gradient(135deg,#00cc66,#008844)" : "linear-gradient(135deg,#ff3b3b,#a30000)",
          color: "#fff", fontWeight: 900, fontSize: "0.75rem", letterSpacing: "0.04em",
          boxShadow: "0 6px 24px rgba(0,0,0,0.5)", fontFamily: "Oswald, sans-serif",
          display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
        }}>
          <Zap size={13} /> {toast.text}
        </div>
      )}
      {live.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {live.map((e, i) => {
            const buff = e.status === "active";
            return (
              <button
                key={`${e.cardName}-${e.affectsPlayer}-${i}`}
                onClick={() => setViewing(e)}
                style={{
                  fontSize: "0.62rem", fontWeight: 800, letterSpacing: "0.03em",
                  padding: "2px 8px", borderRadius: "999px", fontFamily: "Oswald, sans-serif",
                  color: buff ? "#4dffa0" : "#ff6b6b",
                  background: buff ? "rgba(0,200,100,0.12)" : "rgba(255,60,60,0.12)",
                  border: `1px solid ${buff ? "rgba(0,200,100,0.35)" : "rgba(255,60,60,0.35)"}`,
                  cursor: "pointer",
                }}
              >
                ⚡ {e.cardName} · {names[e.affectsPlayer].split(" ")[0]}
              </button>
            );
          })}
        </div>
      )}
      {viewing && (
        <div
          onClick={() => setViewing(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 2600, background: "rgba(0,0,0,0.6)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="pdc-card"
            style={{ padding: "20px", maxWidth: "320px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}
          >
            {viewingCard ? (
              <TKDLCard card={viewingCard} size="sm" locked={false} />
            ) : (
              <div style={{ fontSize: "26px" }}>⚡</div>
            )}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 900, fontSize: "15px", color: "#fff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
                {viewing.cardName}
              </div>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "2px", fontFamily: "Oswald, sans-serif" }}>
                Affecting {names[viewing.affectsPlayer]}
              </div>
              {viewingCard && (
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", marginTop: "10px", lineHeight: 1.4 }}>
                  {viewingCard.effect}
                </div>
              )}
            </div>
            <button
              onClick={() => setViewing(null)}
              style={{
                marginTop: "4px", padding: "8px 20px", borderRadius: "10px", border: "none",
                background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
                fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "12px",
                letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// Chaos Lab: shared Board Mark visual identity — used by both the HUD panel
// and the dartboard's marked-segment highlighting, so they always match.
const BOARD_MARK_ICON: Record<BoardMark["type"], string> = { hot: "\u{1F525}", cold: "\u2744\uFE0F", trap: "\u26A0\uFE0F", shield: "\u{1F6E1}\uFE0F" };
const BOARD_MARK_COLOR: Record<BoardMark["type"], string> = { hot: "#ff8a3d", cold: "#5ec8ff", trap: "#ff4d4d", shield: "#7cf29c" };
/** Unstable marks (metadata.isUnstable) show this instead of their real type/color, everywhere they're displayed — until they actually trigger, nobody (including the drawer) is told whether it's Hot or Trap. */
const UNSTABLE_ICON = "\u{1F3B2}"; // dice
const UNSTABLE_COLOR = "#c084fc"; // purple, distinct from all 4 real type colors

/** Converts active Board Marks into the DartInputBoard's markedSegments prop shape. Bull → segment 25; numbers/trebles/doubles use their own value. */
/** Compact magnitude/effect label for a mark — shared between the dartboard button badge and BoardMarksHUD so they can never say different things about the same mark. verbose=true (HUD, more room) adds context like "next visit"/"to them"; the compact dartboard badge omits it. */
function boardMarkShortLabel(mark: BoardMark, engine: "X01" | "CRICKET", verbose = false): string {
  if (mark.metadata?.isUnstable) return "???";
  const payload = (mark.metadata?.payload as string) ?? "score_shift";
  if (payload === "swap_scores") return "SWAP";
  if (payload === "double_next_visit") return verbose ? "×2 next visit" : "×2";
  if (payload === "weaken_next_visit") return verbose ? "×0.5 next visit" : "×0.5";
  if (payload === "leech_score") {
    const pct = mark.createdByCardId === "prototype_parasite" ? "35%" : "50%";
    return verbose ? `${pct} to them` : pct;
  }
  if (mark.type === "hot") {
    const mag = computeBoardMarkTriggerMagnitude(mark, engine, "hot");
    return engine === "X01" ? `−${mag}` : `+${mag}`;
  }
  if (mark.type === "trap") {
    const mag = computeBoardMarkTriggerMagnitude(mark, engine, "trap");
    return engine === "X01" ? `+${mag}` : `−${mag}`;
  }
  return ""; // Cold/Shield never carry a score effect — no label needed
}

function boardMarksToSegments(marks: BoardMark[], engine: "X01" | "CRICKET"): { segment: number; color: string; icon: string; requiredMult?: 2 | 3; magnitudeLabel: string }[] {
  const out: { segment: number; color: string; icon: string; requiredMult?: 2 | 3; magnitudeLabel: string }[] = [];
  for (const m of marks) {
    const color = m.metadata?.isUnstable ? UNSTABLE_COLOR : BOARD_MARK_COLOR[m.type];
    const icon = m.metadata?.isUnstable ? UNSTABLE_ICON : BOARD_MARK_ICON[m.type];
    const magnitudeLabel = boardMarkShortLabel(m, engine);
    const requiredMult: 2 | 3 | undefined = m.target.type === "treble" ? 3 : m.target.type === "double" ? 2 : undefined;
    if (m.target.type === "bull") {
      out.push({ segment: 25, color, icon, magnitudeLabel });
    } else if (m.target.value === "any") {
      // Leg-wide category marks (every treble/double 15-20) — highlight all matching numbers, since there's no single button to point at.
      for (let n = 15; n <= 20; n++) out.push({ segment: n, color, icon, requiredMult, magnitudeLabel });
    } else if (typeof m.target.value === "number") {
      out.push({ segment: m.target.value, color, icon, requiredMult, magnitudeLabel });
    }
  }
  return out;
}

/** Chaos Lab: shows currently active Board Marks as small badges — target, type, and who placed it. Tap any one for the full card detail. */
/**
 * Chaos Lab: a persistent, match-wide record of what happened — works on
 * both X01 and Cricket, regardless of whether the engine has a per-visit
 * "Recent Visits" history panel (Cricket doesn't). Shows the most recent
 * events first, capped at CHAOS_LAB_ACTIVITY_LOG_CAP. This is the primary
 * "what happened so far" surface for Cricket; on X01 it complements
 * Recent Visits rather than replacing it.
 */
function ChaosLabActivityLog({ entries, names }: { entries: ChaosLabActivityEntry[]; names: [string, string] }) {
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-col gap-1" style={{ maxWidth: "340px", margin: "0 auto" }}>
      <div style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", textAlign: "center" }}>
        CHAOS LAB ACTIVITY
      </div>
      <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column-reverse", gap: "2px" }}>
        {[...entries].reverse().map((e) => (
          <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: "6px", fontSize: "0.65rem", fontFamily: "Oswald, sans-serif", padding: "1px 4px" }}>
            <span>{e.icon}</span>
            <span style={{ color: P_COLOR(e.player), fontWeight: 700, flexShrink: 0 }}>{names[e.player]}</span>
            <span style={{ color: e.color }}>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


/** Chaos Lab: shows currently active Board Marks as small badges — target, type, and who placed it. Tap any one for the full card detail. */
function BoardMarksHUD({ marks, names, engine, viewerIdx }: { marks: BoardMark[]; names: [string, string]; engine: "X01" | "CRICKET"; viewerIdx: 0 | 1 }) {
  const [viewing, setViewing] = useState<BoardMark | null>(null);
  if (marks.length === 0) return null;
  const ICON = BOARD_MARK_ICON;
  const COLOR = BOARD_MARK_COLOR;
  const TYPE_LABEL: Record<BoardMark["type"], string> = { hot: "HOT", cold: "COLD", trap: "TRAP", shield: "SHIELD" };

  const cardNameFor = (m: BoardMark) => BOARD_MARK_PROTOTYPE_CARDS.find(c => c.id === m.createdByCardId)?.name;
  const viewingCardName = viewing ? cardNameFor(viewing) : undefined;
  const viewingCardDef = viewingCardName ? ALL_CARDS.find(c => c.name === viewingCardName) : undefined;

  return (
    <>
    <div className="flex flex-col gap-1.5" style={{ maxWidth: "340px", margin: "0 auto" }}>
      <div style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: "0.12em", color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", textAlign: "center" }}>
        ACTIVE BOARD MARKS — TAP FOR DETAILS
      </div>
      {marks.map((m) => {
        const isUnstable = !!m.metadata?.isUnstable;
        const displayType: BoardMark["type"] | "unstable" = isUnstable ? "unstable" : m.type;
        const displayColor = isUnstable ? UNSTABLE_COLOR : COLOR[m.type];
        const displayIcon = isUnstable ? UNSTABLE_ICON : ICON[m.type];
        const displayLabel = isUnstable ? "???" : TYPE_LABEL[m.type];

        const label = m.target.type === "bull" ? "Bull"
          : m.target.value === "any" ? (m.target.type === "treble" ? "Every Treble" : m.target.type === "double" ? "Every Double" : "Every Number")
          : m.target.type === "number" ? `${m.target.value} bed`
          : m.target.type === "treble" ? `T${m.target.value}`
          : `D${m.target.value}`;
        const ownerIdx = (Number(m.ownerPlayerId) === 0 ? 0 : 1) as 0 | 1;
        const isSteal = !!m.metadata?.steal;
        const payload = (m.metadata?.payload as string) ?? "score_shift";
        const escalationStage = Number(m.metadata?.escalationStage ?? 0);

        // Plain-language "who does this affect" line, from the current viewer's perspective
        let affects: string;
        if (m.type === "shield") {
          affects = ownerIdx === viewerIdx ? "Protects you" : `Protects ${names[ownerIdx]}`;
        } else if (m.appliesTo === "neutral" || m.appliesTo === "both") {
          affects = isSteal ? "Race — hit it before they do (steals from them)" : "Race — either player can trigger it";
        } else {
          const affectedIdx = (Number(m.affectedPlayerId ?? "0") === 0 ? 0 : 1) as 0 | 1;
          const isYou = affectedIdx === viewerIdx;
          if (isUnstable) affects = "Nobody knows if this helps or hurts yet";
          else if (m.type === "cold") affects = isYou ? "Blocks YOUR trigger there" : `Blocks ${names[affectedIdx]}'s trigger there`;
          else affects = isYou ? "Punishes YOU if you hit it" : `Punishes ${names[affectedIdx]} if hit`;
        }

        // Magnitude/effect label — every payload gets an unambiguous label,
        // never just a bare "bonus". Uses the same shared computation as
        // the dartboard button badge (boardMarkShortLabel) so the two can
        // never say different things about the same mark. Escalation adds
        // a "(stage N)" note here since the HUD has room for it, unlike
        // the compact dartboard badge.
        let magnitudeLabel = boardMarkShortLabel(m, engine, true);
        if ((m.type === "hot" || m.type === "trap") && !isUnstable && payload === "score_shift" && escalationStage > 0) {
          magnitudeLabel += ` (stage ${escalationStage})`;
        }

        return (
          <button
            key={m.id}
            onClick={() => setViewing(m)}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "5px 10px", borderRadius: "8px", fontFamily: "Oswald, sans-serif",
              background: `${displayColor}14`,
              border: `1px solid ${displayColor}44`,
              cursor: "pointer", textAlign: "left", width: "100%",
            }}
          >
            <span style={{ fontSize: "1rem", flexShrink: 0 }}>{displayIcon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 900, letterSpacing: "0.04em", color: displayColor }}>{displayLabel}</span>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#fff" }}>{label}</span>
                {isSteal && <span style={{ fontSize: "0.55rem", fontWeight: 800, color: "#ffd24a", background: "rgba(255,210,74,0.15)", padding: "1px 5px", borderRadius: "999px" }}>STEAL</span>}
                {magnitudeLabel && <span style={{ fontSize: "0.68rem", fontWeight: 800, color: displayColor, marginLeft: "auto" }}>{magnitudeLabel}</span>}
              </div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", lineHeight: 1.3 }}>{affects}</div>
            </div>
          </button>
        );
      })}
    </div>
    {viewing && (
      <div
        onClick={() => setViewing(null)}
        style={{
          position: "fixed", inset: 0, zIndex: 2600, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "20px",
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          className="pdc-card"
          style={{ padding: "20px", maxWidth: "320px", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}
        >
          {viewingCardDef && !viewing.metadata?.isUnstable ? (
            <TKDLCard card={viewingCardDef} size="sm" locked={false} />
          ) : (
            <div style={{ fontSize: "26px" }}>{viewing.metadata?.isUnstable ? UNSTABLE_ICON : ICON[viewing.type]}</div>
          )}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: "15px", color: "#fff", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" }}>
              {viewing.metadata?.isUnstable ? "Unstable (type hidden)" : (viewingCardName ?? TYPE_LABEL[viewing.type])}
            </div>
            {viewingCardDef && (
              <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.75)", marginTop: "10px", lineHeight: 1.4 }}>
                {viewing.metadata?.isUnstable
                  ? "This mark is either Hot (reward) or Trap (penalty) — nobody, including whoever drew it, knows which until someone actually hits it."
                  : viewingCardDef.effect}
              </div>
            )}
          </div>
          <button
            onClick={() => setViewing(null)}
            style={{
              marginTop: "4px", padding: "8px 20px", borderRadius: "10px", border: "none",
              background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)",
              fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "12px",
              letterSpacing: "0.05em", textTransform: "uppercase", cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    )}
    </>
  );
}

/** Full-height layout: portrait = top/bottom stack; landscape = left/right split */
function ScorerLayout({ top, bot }: { top: React.ReactNode; bot: React.ReactNode }) {
  const landscape = useOrientation();

  const siteBg: React.CSSProperties = {
    backgroundImage: "linear-gradient(rgba(4,4,10,0.84), rgba(4,4,10,0.92)), url('https://i.postimg.cc/Bbf9fbrp/pdc1.jpg')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  if (landscape) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "row", overflow: "hidden", ...siteBg }}>
        <div style={{
          flex: "0 0 44%", overflowY: "auto", padding: "0.5rem 0.75rem",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}>
          {top}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem 0.75rem" }}>
          {bot}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: "100dvh", width: "100%", display: "flex", flexDirection: "column",
      overflow: "hidden", padding: "0 0.5rem", ...siteBg,
    }}>
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingTop: "0.5rem" }}>{top}</div>
      <div style={{ flexShrink: 0, paddingBottom: "0.5rem" }}>{bot}</div>
    </div>
  );
}

// ── X01 Scorer ─────────────────────────────────────────────────────────────────
export function X01Scorer({ p1Name, p2Name, config, botConfig, onWin, onAbandon, onPracticeStats, legs: legsProp, setsToWin = 0, legsToWinSet = 3, soloMode = false, cardEffects = [], onCardsUsedChange, onLegStart, onVisitStart }: {
  p1Name: string; p2Name: string;
  config: { startingScore: number; doubleIn?: boolean; doubleOut?: boolean; trebleOut?: boolean; masterOut?: boolean; bullFinish?: boolean; noTrebles?: boolean; legs?: number; bustResetTo?: number };
  botConfig?: BotConfig;
  onWin: (w: 0 | 1, detail?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
  legs?: number;
  setsToWin?: number;
  legsToWinSet?: number; soloMode?: boolean;
  cardEffects?: any[];
  /** Card Clash: fires with every card activation (equip mode AND chaos mode, both players) for reward reporting. */
  onCardsUsedChange?: (log: { cardId: string; usedBy: 0 | 1 }[]) => void;
  /** Boss Battle: fires once when leg N begins (1-indexed, including leg 1 on mount) so a
   *  wrapper outside the scorer can rotate in a different fixed set of cardEffects per leg
   *  without the scorer needing to know anything about bosses itself. */
  onLegStart?: (legNumber: number) => void;
  /** Board Curse: fires every time a fresh visit begins, for whoever's turn it now is,
   *  so a wrapper outside the scorer can roll a new random curse before darts land —
   *  independent of Chaos Mode, which has its own separate visit-start effect below. */
  onVisitStart?: (turn: 0 | 1) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const { startingScore = 501, doubleIn = false, doubleOut = true, trebleOut = false, masterOut = false, bullFinish = false, noTrebles = false, legs: configLegs, bustResetTo } = config;
  const legs = legsProp ?? configLegs;
  const setsNeeded  = setsToWin > 0 ? Math.ceil(setsToWin / 2) : 0;
  const legsNeeded  = setsToWin > 0 ? Math.ceil(legsToWinSet / 2) : (legs ? Math.ceil(legs / 2) : 0);

  const [scores, setScores]         = useState<[number, number]>([startingScore, startingScore]);
  const [legWins, setLegWins]       = useState<[number, number]>([0, 0]);
  const [setWins, setSetWins]       = useState<[number, number]>([0, 0]);
  const [legHistory, setLegHistory] = useState<(0|1)[]>([]); // Track who won each leg (for conditional cards)
  const [started, setStarted]       = useState<[boolean, boolean]>([!doubleIn, !doubleIn]);
  const [turn, setTurn]             = useState<0 | 1>(0);
  const [legStarter, setLegStarter] = useState<0 | 1>(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [bust, setBust]             = useState(false);
  const [bustMsg, setBustMsg]       = useState("");
  const [freeRetriesUsed, setFreeRetriesUsed] = useState<[number, number]>([0, 0]); // Track free retries per player this turn
  const [history, setHistory]       = useState<{ turn: 0|1; score: number; left: number; darts: Dart[]; boardMarkNotes?: BoardMarkVisitNote[] }[]>([]);

  // ── Voice call-outs (beta, admin-gated) ──────────────────────────────────
  // Announces each visit's score, busts, and game shots via the browser's
  // built-in text-to-speech. Purely observational — reacts to state that's
  // already changing for other reasons, so it never touches the dart-by-dart
  // scoring logic above (including all the Card Clash chaos-mode branches).
  const { data: appSettings } = useSettings();
  const voiceEnabled = appSettings?.voice_callouts_enabled === true;
  const [voiceMuted, setVoiceMutedState] = useState(() => isVoiceMuted());
  const toggleVoiceMuted = () => setVoiceMutedState(prev => { setVoiceMuted(!prev); return !prev; });
  const [callerVoices, setCallerVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [callerVoiceURI, setCallerVoiceURI] = useState<string | null>(() => getSelectedVoiceURI());
  useEffect(() => {
    if (!voiceEnabled) return;
    return onVoicesChanged(() => setCallerVoices(getAvailableVoices()));
  }, [voiceEnabled]);
  const changeCallerVoice = (uri: string) => {
    const next = uri || null;
    setSelectedVoiceURI(next);
    setCallerVoiceURI(next);
    speak("G'day, this is your caller", { muted: false });
  };
  const prevHistoryLen = useRef(0);
  const prevLegWins = useRef<[number, number]>([0, 0]);
  useEffect(() => {
    if (!voiceEnabled) return;
    if (history.length > prevHistoryLen.current) {
      const last = history[history.length - 1];
      announceScore(last.score, last.left, { muted: voiceMuted });
    }
    prevHistoryLen.current = history.length;
  }, [voiceEnabled, voiceMuted, history]);
  useEffect(() => {
    if (!voiceEnabled || !bust) return;
    announceBust({ muted: voiceMuted });
  }, [voiceEnabled, voiceMuted, bust]);
  useEffect(() => {
    if (!voiceEnabled) return;
    const winnerIdx = legWins[0] > prevLegWins.current[0] ? 0 : legWins[1] > prevLegWins.current[1] ? 1 : null;
    if (winnerIdx !== null) announceGameShot(winnerIdx === 0 ? p1Name : p2Name, { muted: voiceMuted });
    prevLegWins.current = legWins;
  }, [voiceEnabled, voiceMuted, legWins, p1Name, p2Name]);

  // Card Clash state (populated from sessionStorage by CardClashMatchScorer)
  const [p1Cards, setP1Cards]         = useState<any[]>([]);
  const [p2Cards, setP2Cards]         = useState<any[]>([]);
  const [cardsUsed, setCardsUsed]     = useState<any[]>([]);
  // Purpose-built log for reward reporting (separate from cardsUsed, which drives UI "already used" checks). Tracks every activation, equip-mode AND chaos.
  const [cardActivationLog, setCardActivationLog] = useState<{ cardId: string; usedBy: 0 | 1 }[]>([]);
  const [isCardClash, setIsCardClash] = useState(false);
  const [activeEffects, setActiveEffects] = useState<CCEffect[]>([]);
  const [lastActivation, setLastActivation] = useState<{ cardName: string; player: 0 | 1; key: string } | null>(null);
  const [showCards, setShowCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);

  useEffect(() => {
    onCardsUsedChange?.(cardActivationLog);
  }, [cardActivationLog]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chaos Mode state (no equip — random mystery card dealt each visit)
  const [isChaosMode, setIsChaosMode] = useState(false);
  const [chaosOptions, setChaosOptions] = useState<CardData[] | null>(null);
  const chaosResolvedKeyRef = useRef<string>("");

  // Chaos Lab state (Board Marks v1) — a separate mode from regular Chaos Mode,
  // never required by Standard Card Clash or existing Chaos Mode.
  const [isChaosLabMode, setIsChaosLabMode] = useState(false);
  const [activeBoardMarks, setActiveBoardMarks] = useState<BoardMark[]>([]);
  const boardMarkVisitEndKeyRef = useRef<string>("");
  // BUGFIX: a Hot/Trap reward applied via setScores on a dart that ALSO wins
  // the leg was getting silently wiped by resetForLeg's setScores([starting,
  // starting]) a moment later, before the player ever saw it. D16 in
  // particular is one of the most common checkout doubles, so this was very
  // reachable. This ref tracks any reward/penalty that hasn't yet "settled"
  // (survived to a fresh visit without the leg ending) -- resetForLeg
  // consumes it into the new leg's starting scores instead of losing it.
  const pendingBoardMarkAdjustmentRef = useRef<[number, number]>([0, 0]);
  // Collects Board Mark events (Hot/Trap/Swap/etc.) that happen during the
  // current visit, per player, so the "Recent Visits" history entry can
  // clearly label them as a named bonus/penalty instead of an unexplained
  // number. Cleared at the start of each fresh visit for that player.
  const boardMarkVisitNotesRef = useRef<[BoardMarkVisitNote[], BoardMarkVisitNote[]]>([[], []]);
  // Match-wide Chaos Lab Activity Log -- a persistent, engine-agnostic record
  // of every Chaos Lab event (Hot/Trap/Cold/Swap/Surge/Weaken/Leech/
  // Sabotage/Match Swing), shown on both X01 and Cricket regardless of
  // whether the engine has a per-visit "Recent Visits" panel. Capped at
  // CHAOS_LAB_ACTIVITY_LOG_CAP most recent entries.
  const chaosLabActivityLogRef = useRef<ChaosLabActivityEntry[]>([]);
  const [, setChaosLabActivityTick] = useState(0); // forces a re-render when the ref-based activity log changes
  // Structured match log — accumulates every dart, card, and Board Mark
  // event so a match can be downloaded and inspected afterward instead of
  // relying on a secondhand description of what happened. One instance per
  // match (created fresh on mount).
  const matchLoggerRef = useRef(createMatchLogger({ engine: "X01", p1Name, p2Name }));

  const names = [p1Name, p2Name];

  // Sync with cardEffects from parent (CardClashMatchScorer)
  useEffect(() => {
    if (cardEffects && cardEffects.length > 0) {
      setActiveEffects(cardEffects);
    }
  }, [cardEffects]);

  // Practice stat accumulators (refs = no re-render, always fresh in callbacks)
  const p1StatsRef = useRef({ darts: 0, score: 0, s100s: 0, s140s: 0, s170s: 0, s180s: 0, coAttempts: 0, coHits: 0, dartLog: [] as DartThrow[] });
  // P2 stats — only meaningful in human-vs-human (no bot) sessions
  const p2StatsRef = useRef({ darts: 0, score: 0, s100s: 0, s140s: 0, s170s: 0, s180s: 0, coAttempts: 0, coHits: 0, dartLog: [] as DartThrow[] });
  const isHumanVsHuman = !botConfig;

  // Visit-score milestone buckets are cumulative, not exclusive — a 180 visit
  // is also a 170+, 140+, and 100+ visit, same convention real darts stats use.
  const bumpVisitMilestones = (stats: { s100s: number; s140s: number; s170s: number; s180s: number }, cum: number) => {
    if (cum >= 100) stats.s100s++;
    if (cum >= 140) stats.s140s++;
    if (cum >= 170) stats.s170s++;
    if (cum === 180) stats.s180s++;
  };

  const isValidOut = (dart: Dart): boolean => {
    if (bullFinish) return dart.segment === 25 && dart.value === 50;
    if (doubleOut)  return dart.multiplier === 2 || (dart.segment === 25 && dart.value === 50);
    if (trebleOut)  return dart.multiplier === 3;
    if (masterOut)  return dart.multiplier >= 2 || (dart.segment === 25 && dart.value === 50);
    return true;
  };

  const triggerBust = useCallback((darts: Dart[], msg: string) => {
    matchLoggerRef.current.log("bust", { player: turn, msg, darts: darts.map(d => d.label) });
    setBust(true); setBustMsg(msg); setVisitDarts(darts);
    if (bustResetTo !== undefined) {
      setScores(prev => { const n = [...prev] as [number, number]; n[turn] = bustResetTo; return n; });
    }
    safeTimeout(() => { setBust(false); setBustMsg(""); setVisitDarts([]); setTurn(t => soloMode ? 0 : (t === 0 ? 1 : 0)); }, 1500);
  }, [turn, bustResetTo]);

  const handleWin = useCallback((winnerIdx: 0|1, darts: Dart[]) => {
    matchLoggerRef.current.log("leg_won", { winner: winnerIdx, finishingDarts: darts.map(d => d.label) });
    setVisitDarts(darts);
    const getStats = () => ({
      p1Darts: p1StatsRef.current.darts, p1Score: p1StatsRef.current.score,
      p1_100s: p1StatsRef.current.s100s, p1_140s: p1StatsRef.current.s140s, p1_170s: p1StatsRef.current.s170s,
      p1_180s: p1StatsRef.current.s180s, p1CheckoutAttempts: p1StatsRef.current.coAttempts,
      p1CheckoutHits: p1StatsRef.current.coHits, dartLog: [...p1StatsRef.current.dartLog],
      ...(isHumanVsHuman ? {
        p2Darts: p2StatsRef.current.darts, p2Score: p2StatsRef.current.score,
        p2_100s: p2StatsRef.current.s100s, p2_140s: p2StatsRef.current.s140s, p2_170s: p2StatsRef.current.s170s,
        p2_180s: p2StatsRef.current.s180s, p2CheckoutAttempts: p2StatsRef.current.coAttempts,
        p2CheckoutHits: p2StatsRef.current.coHits, p2DartLog: [...p2StatsRef.current.dartLog],
      } : {}),
    });
    const resetForLeg = (delay: number, newLegState: [number,number]) => {
      safeTimeout(() => {
        const ns: 0|1 = legStarter === 0 ? 1 : 0;
        setLegStarter(ns);
        // Fold in any Board Mark reward/penalty that hasn't settled yet (see
        // pendingBoardMarkAdjustmentRef's BUGFIX note) so it isn't silently
        // lost if this leg ended on the exact same dart that triggered it.
        const pending = pendingBoardMarkAdjustmentRef.current;
        if (pending[0] !== 0 || pending[1] !== 0) {
          cardDebugLog("X01Scorer", "[CHAOS_LAB] Applying pending adjustment to new leg start", { pending, startingScore });
          matchLoggerRef.current.log("chaos_lab_pending_applied_to_new_leg", { pending, startingScore });
        }
        setScores([
          clampX01RemainingAfterReduction(Math.max(0, startingScore - pending[0])),
          clampX01RemainingAfterReduction(Math.max(0, startingScore - pending[1])),
        ]);
        pendingBoardMarkAdjustmentRef.current = [0, 0];
        if (isChaosLabMode) setActiveBoardMarks(prev => expireBoardMarksForLegEnd(prev)); // clears leg-wide rule-benders (Treble Curse, Double Trouble) at the actual leg boundary
        setStarted([!doubleIn, !doubleIn]); setVisitDarts([]);
        onLegStart?.(newLegState[0] + newLegState[1] + 1);
        setTurn(soloMode ? 0 : ns); setLegWins(newLegState);
        
        // Track which player won this leg (for conditional Wildcard cards)
        // Determine winner by comparing new legState to current legWins
        const legWinner = newLegState[0] > legWins[0] ? 0 : newLegState[1] > legWins[1] ? 1 : null;
        if (legWinner !== null) {
          setLegHistory(prev => [...prev, legWinner]);
          
          // Check for shutout (opponent scored 0 - Perfect Game bonus)
          // BUGFIX: this previously fired for EVERY shutout regardless of
          // whether the winner actually had "Perfect Game" equipped, making
          // the purchasable card itself meaningless to own. Now gated the
          // same way "Finishing Bonus" right below it already correctly is.
          // Also checks activeEffects (not just the equipped-cards list) so
          // a Chaos-mode draw of this card is detected too — Chaos Mode has
          // no persistent "equipped" state, only activeEffects.
          const opp: 0|1 = legWinner === 0 ? 1 : 0;
          if (isCardClash && scores[opp] === startingScore) {
            const winnerCardsForShutout = legWinner === 0 ? p1Cards : p2Cards;
            const hasPerfectGame = winnerCardsForShutout.some((c: any) => c.name?.trim() === "Perfect Game")
              || activeEffects.some(e => e.status === "active" && e.affectsPlayer === legWinner && e.cardName === "Perfect Game");
            if (hasPerfectGame) {
              setActiveEffects(prev => [...prev, {
                cardName: "Perfect Game",
                appliedBy: legWinner,
                affectsPlayer: legWinner,
                status: "active",
                visitBonus: 30,
                legDuration: true,
              }]);
            }
          }
          
          // THEME 2 (removed) — this used to grant a DUPLICATE, much larger
          // "Finishing Bonus" of +50 EVERY visit for the winner's entire next
          // leg, on top of the correct, card-text-matching +50-once-on-checkout
          // implementation a bit further down (search "CARD CLASH FIX 118").
          // "Finishing Bonus" text is "if you finish this visit, gain +50" —
          // a single visit's bonus, not a recurring one for a whole leg. This
          // block fired on every single leg win for anyone with the card
          // equipped, making it far more powerful than the card was ever
          // meant to be, and had no effect at all in Chaos Mode besides
          // (since it read the equipped-cards list, which Chaos never
          // populates). The correct implementation already handles both
          // modes via activeEffects.
        }
      }, delay);
    };

    if (setsToWin > 0) {
      setLegWins(prev => {
        const n: [number,number] = [...prev] as [number,number];
        const opp: 0|1 = winnerIdx === 0 ? 1 : 0;
        n[winnerIdx]++;

        // Card Clash: Leg Reset — if target won 2+ legs in a row (including this
        // one) and has Leg Reset against them, their leg wins reset to 0.
        // BUGFIX: previously only wired into the Best-of-Legs branch below —
        // never fired at all when a match used Sets format instead.
        if (isCardClash && legHistory.length >= 1) {
          const prevLeg = legHistory[legHistory.length - 1];
          if (prevLeg === winnerIdx) {
            const hasLegReset = activeEffects.some(e =>
              e.cardName === "Leg Reset" && e.status === "active" && e.affectsPlayer === winnerIdx
            );
            if (hasLegReset) {
              n[winnerIdx] = 0;
            }
          }
        }

        // Card Clash: Streak Crusher — if target is now 2+ legs ahead (within this
        // set) and has Streak Crusher against them, remove 2 of their leg wins.
        // BUGFIX: same Sets-format gap as Leg Reset above.
        if (isCardClash) {
          const leadsBy = n[winnerIdx] - n[opp];
          if (leadsBy >= 2) {
            const hasStreakCrusher = activeEffects.some(e =>
              e.cardName === "Streak Crusher" && e.status === "active" && e.affectsPlayer === winnerIdx
            );
            if (hasStreakCrusher) {
              n[winnerIdx] = Math.max(0, n[winnerIdx] - 2);
            }
          }
        }

        if (n[winnerIdx] >= legsNeeded) {
          const ns: [number,number] = [setWins[0], setWins[1]];
          ns[winnerIdx]++;
          if (ns[winnerIdx] >= setsNeeded) {
            safeTimeout(() => {
              setSetWins(ns);
              if (isCardClash) uploadMatchLog(matchLoggerRef.current, { gameMode: "X01", isChaosMode, isChaosLabMode });
              onWin(winnerIdx, `${ns[winnerIdx]}–${ns[winnerIdx===0?1:0]} sets`);
              onPracticeStats?.(getStats());
            }, 800);
          } else {
            safeTimeout(() => {
              setSetWins(ns);
              resetForLeg(0, [0, 0]);
            }, 1500);
          }
          return [0, 0];
        } else {
          resetForLeg(1200, n);
          return prev;
        }
      });
    } else if (legs && legs > 1) {
      setLegWins(prev => {
        const n: [number,number] = [...prev] as [number,number];
        const opp: 0|1 = winnerIdx === 0 ? 1 : 0;
        n[winnerIdx]++;
        
        // Card Clash: Leg Reset — if target won 2+ legs in a row (including this
        // one) and has Leg Reset against them, their leg wins reset to 0.
        // BUGFIX: was checking legHistory.slice(-2) for two PRIOR wins, which
        // combined with this win required 3 straight wins to trigger instead of
        // the "2+ in a row" the card text promises.
        if (isCardClash && legHistory.length >= 1) {
          const prevLeg = legHistory[legHistory.length - 1];
          if (prevLeg === winnerIdx) {
            const hasLegReset = activeEffects.some(e => 
              e.cardName === "Leg Reset" && e.status === "active" && e.affectsPlayer === winnerIdx
            );
            if (hasLegReset) {
              // BUGFIX 213: card text is "reset target's leg wins to 0", not "reduce by 1".
              n[winnerIdx] = 0;
            }
          }
        }
        
        // Card Clash: Streak Crusher — if opponent is now 2+ ahead and has Streak Crusher against them, remove 2 of their wins
        if (isCardClash) {
          const leadsBy = n[winnerIdx] - n[opp];
          if (leadsBy >= 2) {
            const hasStreakCrusher = activeEffects.some(e => 
              e.cardName === "Streak Crusher" && e.status === "active" && e.affectsPlayer === winnerIdx
            );
            if (hasStreakCrusher) {
              n[winnerIdx] = Math.max(0, n[winnerIdx] - 2);
            }
          }
        }
        
        if (n[winnerIdx] >= legsNeeded) {
          safeTimeout(() => {
            if (isCardClash) uploadMatchLog(matchLoggerRef.current, { gameMode: "X01", isChaosMode, isChaosLabMode });
            onWin(winnerIdx, `${n[winnerIdx]}–${n[winnerIdx===0?1:0]} legs`);
            onPracticeStats?.(getStats());
          }, 200);
        } else {
          resetForLeg(1500, n);
        }
        return n;
      });
    } else {
      safeTimeout(() => {
        if (isCardClash) uploadMatchLog(matchLoggerRef.current, { gameMode: "X01", isChaosMode, isChaosLabMode });
        onWin(winnerIdx);
        onPracticeStats?.(getStats());
      }, 200);
    }
  }, [legs, legsNeeded, setsNeeded, setsToWin, legStarter, startingScore, doubleIn, onWin, onPracticeStats, setWins]);

  const handleDart = useCallback((dart: Dart) => {
    if (bust || visitDarts.length >= 3) return;

    matchLoggerRef.current.log("dart_thrown", { player: turn, segment: dart.segment, multiplier: dart.multiplier, value: dart.value, label: dart.label, remainingBefore: scores[turn] });

    if (isChaosLabMode && visitDarts.length === 0) {
      boardMarkVisitNotesRef.current[turn] = [];
      if (pendingBoardMarkAdjustmentRef.current[turn] !== 0) {
        cardDebugLog("X01Scorer", "[CHAOS_LAB] Clearing settled pending adjustment at fresh visit", { player: turn, cleared: pendingBoardMarkAdjustmentRef.current[turn] });
        matchLoggerRef.current.log("chaos_lab_pending_adjustment_settled", { player: turn, cleared: pendingBoardMarkAdjustmentRef.current[turn] });
        pendingBoardMarkAdjustmentRef.current[turn] = 0;
      }
    }

    // No-trebles variant: treble ring counts as a single
    if (noTrebles && dart.multiplier === 3) {
      dart = { ...dart, multiplier: 1 as const, value: dart.segment, label: String(dart.segment) };
    }

    // Double-in: before started, only doubles open the scoring
    if (doubleIn && !started[turn]) {
      const isDouble = dart.multiplier === 2 || (dart.segment === 25 && dart.value === 50);
      const nv: Dart[] = [...visitDarts, { ...dart, value: 0 }];
      if (isDouble) { setStarted(prev => { const n=[...prev] as [boolean,boolean]; n[turn]=true; return n; }); }
      setVisitDarts(nv);
      if (nv.length === 3) { setVisitDarts([]); setTurn(t => soloMode ? 0 : (t===0?1:0)); }
      return;
    }

    // Track checkout opportunities (≤170 remaining at start of visit)
    if (visitDarts.length === 0) {
      if (turn === 0 && scores[0] <= 170) p1StatsRef.current.coAttempts++;
      if (turn === 1 && isHumanVsHuman && scores[1] <= 170) p2StatsRef.current.coAttempts++;
    }

    // Record every dart for player profile building
    if (turn === 0) {
      const phase: "scoring" | "checkout" = scores[0] > 170 ? "scoring" : "checkout";
      p1StatsRef.current.dartLog.push({ seg: dart.segment, mult: dart.multiplier, val: dart.value, phase });
    }
    if (turn === 1 && isHumanVsHuman) {
      const phase: "scoring" | "checkout" = scores[1] > 170 ? "scoring" : "checkout";
      p2StatsRef.current.dartLog.push({ seg: dart.segment, mult: dart.multiplier, val: dart.value, phase });
    }

    // Card Clash: preprocess dart (segment redirects, multiplier changes, value floors/caps)
    if (isCardClash) {
      // Filter out finalLegOnly effects unless in final leg
      const inFinalLeg = legsNeeded - legWins[turn] === 1;
      const effectsForDart = inFinalLeg ? activeEffects : activeEffects.filter(e => !e.finalLegOnly);
      dart = ccPreprocessDart(dart, visitDarts.length, effectsForDart, turn, scores[turn]);
    }

    // Chaos Lab: resolve Board Marks against this dart. Runs on the real,
    // already-preprocessed dart, and never influences cum/nv/rem for THIS
    // dart's own scoring below — Hot/Trap rewards apply via a separate
    // setScores call, so they never interfere with this dart's own bust/
    // checkout math. Also stashed into pendingBoardMarkAdjustmentRef in case
    // this exact dart also wins the leg — see BUGFIX note on the ref itself.
    if (isCardClash && isChaosLabMode && activeBoardMarks.length > 0) {
      const dartResult = toBoardMarkDartResult(dart, String(turn));
      const resolved = resolveBoardMarksForDart(activeBoardMarks, { dartResult });
      if (resolved.events.length > 0) {
        setActiveBoardMarks(resolved.marks);
        const hot = resolved.events.find(e => e.type === "board_mark_hot_triggered");
        const cold = resolved.events.find(e => e.type === "card_clash_trigger_blocked_by_cold_mark");
        const trap = resolved.events.find(e => e.type === "card_clash_trigger_cancelled_by_trap_mark");
        if (hot) {
          const triggeredMark = activeBoardMarks.find(m => m.id === hot.markId);
          const payload = (triggeredMark?.metadata?.payload as string) ?? "score_shift";
          const rewardPlayer = turn as 0 | 1;
          const otherPlayer: 0 | 1 = rewardPlayer === 0 ? 1 : 0;

          if (payload === "swap_scores") {
            setScores(prev => {
              const n: [number, number] = [prev[1], prev[0]];
              cardDebugLog("X01Scorer", "[CHAOS_LAB] Score Swap triggered", { triggeredBy: rewardPlayer, scoresBefore: prev, scoresAfter: n });
              matchLoggerRef.current.log("chaos_lab_score_swap", { triggeredBy: rewardPlayer, scoresBefore: prev, scoresAfter: n });
              return n;
            });
            setLastActivation({ cardName: "🔄 SCORES SWAPPED!", player: rewardPlayer, key: `boardmark-swap-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, rewardPlayer, { icon: "🔄", color: "#c084fc", text: "Score Swap!" });
          } else if (payload === "double_next_visit") {
            setActiveEffects(prev => [...prev, { cardName: "Surge (Board Mark)", appliedBy: rewardPlayer, affectsPlayer: rewardPlayer, status: "pending", allDartsMultiplier: 2 }]); // pending: reliably applies to their NEXT full visit, not "whatever's left of this one" (which could be zero darts)
            cardDebugLog("X01Scorer", "[CHAOS_LAB] Surge triggered", { player: rewardPlayer });
            matchLoggerRef.current.log("chaos_lab_surge", { player: rewardPlayer });
            setLastActivation({ cardName: "⚡ SURGE! Your next visit scores ×2", player: rewardPlayer, key: `boardmark-surge-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, rewardPlayer, { icon: "⚡", color: "#ff8a3d", text: "Surge: next visit ×2" });
          } else if (payload === "leech_score") {
            // Trigger player's own dart scores completely normally for them
            // (untouched) — 50%/35% of that same dart's value ALSO hurts
            // their opponent. One dart, two consequences.
            const leechPct = triggeredMark?.createdByCardId === "prototype_parasite" ? 0.35 : 0.5;
            const leechAmount = Math.floor(dart.value * leechPct);
            setScores(prev => {
              const n = [...prev] as [number, number];
              n[otherPlayer] = n[otherPlayer] + leechAmount;
              cardDebugLog("X01Scorer", "[CHAOS_LAB] Leech triggered", { player: rewardPlayer, dartValue: dart.value, leechAmount, scoresBefore: prev, scoresAfter: n });
              matchLoggerRef.current.log("chaos_lab_leech", { player: rewardPlayer, dartValue: dart.value, leechAmount, scoresBefore: prev, scoresAfter: n });
              return n;
            });
            setLastActivation({ cardName: `🩸 SIPHONED! +${leechAmount} to them`, player: rewardPlayer, key: `boardmark-leech-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, rewardPlayer, { icon: "🩸", color: "#ff8a3d", text: `Siphon: +${leechAmount} to opponent` });
          } else {
            const magnitude = computeBoardMarkTriggerMagnitude(triggeredMark!, "X01", "hot");
            const isSteal = !!triggeredMark?.metadata?.steal;
            pendingBoardMarkAdjustmentRef.current[rewardPlayer] += magnitude; // reduces their starting score if this ends the leg
            if (isSteal) pendingBoardMarkAdjustmentRef.current[otherPlayer] -= magnitude; // increases theirs
            setScores(prev => {
              const n = [...prev] as [number, number];
              n[rewardPlayer] = clampX01RemainingAfterReduction(Math.max(0, n[rewardPlayer] - magnitude));
              if (isSteal) n[otherPlayer] = n[otherPlayer] + magnitude; // zero-sum: what you win, they lose
              cardDebugLog("X01Scorer", "[CHAOS_LAB] Hot triggered", { target: triggeredMark?.target, player: rewardPlayer, magnitude, isSteal, scoresBefore: prev, scoresAfter: n });
              matchLoggerRef.current.log("chaos_lab_hot_triggered", { target: triggeredMark?.target, player: rewardPlayer, magnitude, isSteal, scoresBefore: prev, scoresAfter: n });
              return n;
            });
            setLastActivation({ cardName: isSteal ? `🔥💰 Stolen! -${magnitude}` : `🔥 Hot! -${magnitude}`, player: rewardPlayer, key: `boardmark-hot-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, rewardPlayer, { icon: "🔥", color: "#ff8a3d", text: isSteal ? `Hot (steal): -${magnitude} bonus, opponent +${magnitude}` : `Hot bonus: -${magnitude}` });
          }
        } else if (trap) {
          const triggeredMark = activeBoardMarks.find(m => m.id === trap.markId);
          const payload = (triggeredMark?.metadata?.payload as string) ?? "score_shift";
          const penalizedPlayer = turn as 0 | 1;
          const trapOwner: 0 | 1 | undefined = triggeredMark ? (Number(triggeredMark.ownerPlayerId) as 0 | 1) : undefined;

          if (payload === "weaken_next_visit") {
            setActiveEffects(prev => [...prev, { cardName: "Weakened (Board Mark)", appliedBy: trapOwner ?? (penalizedPlayer === 0 ? 1 : 0), affectsPlayer: penalizedPlayer, status: "pending", allDartsMultiplier: 0.5 }]); // pending: applies to their NEXT full visit
            cardDebugLog("X01Scorer", "[CHAOS_LAB] Weakened triggered", { player: penalizedPlayer });
            matchLoggerRef.current.log("chaos_lab_weakened", { player: penalizedPlayer });
            setLastActivation({ cardName: "🥶 WEAKENED! Their next visit scores ×0.5", player: penalizedPlayer, key: `boardmark-weaken-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, penalizedPlayer, { icon: "🥶", color: "#ff4d4d", text: "Weakened: next visit ×0.5" });
          } else {
            const magnitude = computeBoardMarkTriggerMagnitude(triggeredMark!, "X01", "trap");
            const isSteal = !!triggeredMark?.metadata?.steal;
            pendingBoardMarkAdjustmentRef.current[penalizedPlayer] -= magnitude; // increases their starting score if this ends the leg
            if (isSteal && trapOwner !== undefined) pendingBoardMarkAdjustmentRef.current[trapOwner] += magnitude;
            setScores(prev => {
              const n = [...prev] as [number, number];
              n[penalizedPlayer] = n[penalizedPlayer] + magnitude;
              if (isSteal && trapOwner !== undefined) n[trapOwner] = clampX01RemainingAfterReduction(Math.max(0, n[trapOwner] - magnitude)); // trapper gets what the trapped player lost
              cardDebugLog("X01Scorer", "[CHAOS_LAB] Trap sprung", { target: triggeredMark?.target, player: penalizedPlayer, magnitude, isSteal, scoresBefore: prev, scoresAfter: n });
              matchLoggerRef.current.log("chaos_lab_trap_sprung", { target: triggeredMark?.target, player: penalizedPlayer, magnitude, isSteal, scoresBefore: prev, scoresAfter: n });
              return n;
            });
            setLastActivation({ cardName: isSteal ? `⚠️💰 Robbed! +${magnitude}` : `⚠️ Trap! +${magnitude}`, player: penalizedPlayer, key: `boardmark-trap-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, penalizedPlayer, { icon: "⚠️", color: "#ff4d4d", text: isSteal ? `Trap (steal): +${magnitude} penalty, opponent -${magnitude}` : `Trap penalty: +${magnitude}` });
          }
        } else if (cold) {
          matchLoggerRef.current.log("chaos_lab_cold_blocked", { target: cold.target, player: turn });
          setLastActivation({ cardName: "❄️ Blocked by Cold", player: turn as 0 | 1, key: `boardmark-cold-${Date.now()}` });
          logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, turn as 0 | 1, { icon: "❄️", color: "#5ec8ff", text: "Blocked by Cold — no trigger" });
        }
        cardDebugLog("X01Scorer", "[CHAOS_LAB] Board Mark events", resolved.events);
        matchLoggerRef.current.log("chaos_lab_resolver_events", { events: resolved.events, activeMarksAfter: resolved.marks.map(m => ({ id: m.id, type: m.type, target: m.target })) });
      }
    }

    const nv = [...visitDarts, dart];
    let cum = nv.reduce((s, d) => s + d.value, 0);
    // Card Clash: apply visit-total cap (Mercy Killer=60, Shutdown=50)
    if (isCardClash) cum = ccApplyVisitCap(cum, activeEffects, turn);
    const rem = scores[turn] - cum;

    if (rem < 0) {
      // Card Clash: Safety Net (bust→half) / Close Control (final 50, dart→1pt)
      if (isCardClash) {
        const intercept = ccInterceptBust(cum, cum, scores[turn], activeEffects, turn);
        if (intercept.prevent) {
          const reduction = intercept.halvedVisit ?? 0;
          if (turn === 0) { p1StatsRef.current.darts += nv.length; p1StatsRef.current.score += reduction; }
          if (turn === 1 && isHumanVsHuman) { p2StatsRef.current.darts += nv.length; p2StatsRef.current.score += reduction; }
          setScores(prev => { const n=[...prev] as [number,number]; n[turn] = Math.max(1, n[turn] - reduction); return n; });
          setHistory(h => [...h, { turn, score: reduction, left: scores[turn] - reduction, darts: nv, boardMarkNotes: isChaosLabMode ? [...boardMarkVisitNotesRef.current[turn]] : undefined }]);
          setVisitDarts([]);
          setActiveEffects(prev => ccExpireOnTurnEnd(prev, turn));
          setTurn(t => soloMode ? 0 : (t===0?1:0));
          return;
        }
      }
      if (turn === 0) p1StatsRef.current.darts += nv.length;
      if (turn === 1 && isHumanVsHuman) p2StatsRef.current.darts += nv.length;
      triggerBust(nv, bustResetTo !== undefined ? `BUST — score reset to ${bustResetTo}` : "BUST — overshot!");
      return;
    }
    // Score of 1 is unreachable in double-out (minimum finish is D1 = 2) — bust immediately
    if (rem === 1 && doubleOut) {
      if (turn === 0) p1StatsRef.current.darts += nv.length;
      if (turn === 1 && isHumanVsHuman) p2StatsRef.current.darts += nv.length;
      triggerBust(nv, "BUST — can't leave 1!");
      return;
    }
    if (rem === 0) {
      // Card Clash: Turn Enforcer — must throw all 3 darts before finishing
      if (isCardClash) {
        const isDbl = dart.multiplier === 2 || (dart.segment === 25 && dart.value === 50);
        if (ccShouldBlockFinish(nv.length - 1, isDbl, activeEffects, turn)) {
          // Score the dart but don't end the game; next dart will naturally bust (rem=0)
          setVisitDarts(nv);
          return;
        }
        // Trapped: force turn end after 1 dart if not a valid finish
        if (nv.length === 1 && !isValidOut(dart) &&
            activeEffects.some(e => e.status === "active" && e.affectsPlayer === turn && e.mustFinishAfterOneDart)) {
          setVisitDarts([]);
          setActiveEffects(prev => ccExpireOnTurnEnd(prev, turn));
          setTurn(t => soloMode ? 0 : (t===0?1:0));
          return;
        }
      }
      // Check if finish is blocked by Scoring Arsenal (forceFullTurn)
      if (isValidOut(dart) && nv.length < 3 &&
          activeEffects.some(e => e.status === "active" && e.affectsPlayer === turn && e.forceFullTurn)) {
        setVisitDarts(nv);
        return;
      }
      if (isValidOut(dart)) {
        if (turn === 0) {
          p1StatsRef.current.darts += nv.length;
          p1StatsRef.current.score += cum;
          bumpVisitMilestones(p1StatsRef.current, cum);
          p1StatsRef.current.coHits++;
        }
        if (turn === 1 && isHumanVsHuman) {
          p2StatsRef.current.darts += nv.length;
          p2StatsRef.current.score += cum;
          bumpVisitMilestones(p2StatsRef.current, cum);
          p2StatsRef.current.coHits++;
        }
        
        // CARD CLASH FIX 118: Finishing Bonus - add +50 immediately before win
        if (isCardClash) {
          const hasFinishingBonus = activeEffects.some(e => 
            e.status === "active" && e.affectsPlayer === turn && e.cardName === "Finishing Bonus"
          );
          if (hasFinishingBonus) {
            setScores(prev => {
              const ns: [number, number] = [...prev];
              ns[turn] = Math.max(0, ns[turn] - 50);  // X01: reduce remaining by 50 (good for player)
              return ns;
            });
          }
        }
        
        handleWin(turn, nv);
      } else {
        // Card Clash: Checkout Confidence — allow 1 free retry if missing double finish
        const hasCheckoutConfidence = isCardClash && 
          activeEffects.some(e => e.status === "active" && e.affectsPlayer === turn && e.freeRetryOnDoubleMiss);
        const canUseRetry = freeRetriesUsed[turn] === 0;
        const inCheckout = doubleOut && nv.length < 4; // Allow up to 4 darts with retry
        
        if (hasCheckoutConfidence && canUseRetry && inCheckout) {
          setFreeRetriesUsed(prev => {
            const n = [...prev] as [number, number];
            n[turn]++;
            return n;
          });
          setVisitDarts(nv); // Keep this dart, allow next one
          return;
        }
        
        if (turn === 0) p1StatsRef.current.darts += nv.length;
        if (turn === 1 && isHumanVsHuman) p2StatsRef.current.darts += nv.length;
        triggerBust(nv, bullFinish ? "BUST — must finish on Bull's-eye (50)!" : doubleOut ? "BUST — must finish on a double!" : trebleOut ? "BUST — treble required!" : "BUST!");
      }
      return;
    }

    // Card Clash: Trapped — if dart 1 is not a win, end turn immediately
    if (isCardClash && nv.length === 1 &&
        activeEffects.some(e => e.status === "active" && e.affectsPlayer === turn && e.mustFinishAfterOneDart)) {
      setVisitDarts([]);
      setActiveEffects(prev => ccExpireOnTurnEnd(prev, turn));
      setTurn(t => soloMode ? 0 : (t===0?1:0));
      return;
    }

    setVisitDarts(nv);
    if (nv.length === 3) {
      if (turn === 0) {
        p1StatsRef.current.darts += 3;
        p1StatsRef.current.score += cum;
        bumpVisitMilestones(p1StatsRef.current, cum);
      }
      if (turn === 1 && isHumanVsHuman) {
        p2StatsRef.current.darts += 3;
        p2StatsRef.current.score += cum;
        bumpVisitMilestones(p2StatsRef.current, cum);
      }
      // Card Clash: visit-end bonuses (Power Surge, Rust Hands, Mental Block, High Roller, etc.)
      let effectiveCum = cum;
      if (isCardClash) {
        // Filter out finalLegOnly effects unless in final leg
        const inFinalLeg = legsNeeded - legWins[turn] === 1;
        const effectsForVisitEnd = inFinalLeg ? activeEffects : activeEffects.filter(e => !e.finalLegOnly);
        const { bonusReduction, extraPenalty, newDeferredEffects } = ccApplyVisitEnd(cum, nv.length, effectsForVisitEnd, turn, legWins);
        effectiveCum = Math.max(0, cum + bonusReduction - extraPenalty);
        // THEME 2: Add any newly deferred effects to activeEffects
        if (newDeferredEffects.length > 0) {
          setActiveEffects(prev => [...prev, ...newDeferredEffects]);
        }
      }
      setScores(prev => { const n=[...prev] as [number,number]; n[turn] = Math.max(1, n[turn] - effectiveCum); return n; });
      setHistory(h => [...h, { turn, score: effectiveCum, left: scores[turn] - effectiveCum, darts: nv, boardMarkNotes: isChaosLabMode ? [...boardMarkVisitNotesRef.current[turn]] : undefined }]);
      setVisitDarts([]);
      // Card Clash: expire this-turn effects; promote opponent's pending → active
      if (isCardClash) setActiveEffects(prev => ccExpireOnTurnEnd(prev, turn));
      setTurn(t => soloMode ? 0 : (t===0?1:0));
    }
  }, [bust, visitDarts, turn, started, doubleIn, scores, legWins, triggerBust, handleWin, bustResetTo, bullFinish, doubleOut, trebleOut, isValidOut, noTrebles, isCardClash, activeEffects, isChaosLabMode, activeBoardMarks]);

  const handleMiss = () => handleDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" });
  const handleUndo = () => {
    if (bust) return;
    if (visitDarts.length > 0) {
      // Remove the last dart within the current visit
      setVisitDarts(prev => prev.slice(0, -1));
      // NOTE: activeEffects persist within a turn (that's correct)
    } else if (history.length > 0) {
      // Build new state from history stack
      const h = [...history];
      const last = h.pop()!;
      const newScores: [number, number] = [...scores];
      newScores[last.turn] = last.left + last.score;
      let finalTurn = last.turn as 0 | 1;

      // Vs-bot: if the most recent history entry was the bot's turn (turn=1),
      // also roll back the human's preceding visit so we land on the human's turn
      if (botConfig && last.turn === 1 && h.length > 0) {
        const prev = h.pop()!;
        newScores[prev.turn] = prev.left + prev.score;
        finalTurn = prev.turn as 0 | 1;
      }

      setHistory(h);
      setScores(newScores);
      setTurn(finalTurn);
      setVisitDarts([]);
      
      // CRITICAL FIX: When undoing to a different turn, clear activeEffects for the previous player
      // This prevents effects from leaking across turns
      if (isCardClash) {
        setActiveEffects(prev => 
          prev.filter(e => e.affectsPlayer !== last.turn || e.status === "expired")
        );
      }
    }
  };

  // ── Card Clash: Handle card activation ──
  const handleCardActivation = useCallback((cardId: string) => {
    const currentCards = turn === 0 ? p1Cards : p2Cards;
    const card = currentCards.find((c: any) => c.id?.toString() === cardId);
    if (!card) { 
      cardDebugLog("X01Scorer", "Card not found", { cardId }); 
      return; 
    }
    cardDebugLog("X01Scorer", "Card activated", { card: card.name, cardId });
    matchLoggerRef.current.log("card_activated_equip", { player: turn, card: card.name });

    const effects = ccActivateCard(card, turn, { scores, legWins }, undefined, { legHistory, legsNeeded });

    effects.forEach(e => {
      if (e.instant) {
        setScores(prev => {
          const n = [...prev] as [number, number];
          // THEME 3: Mode-specific instant effects (X01)
          if (e.instantRemainingPenalty) {
            n[e.affectsPlayer] = Math.max(1, n[e.affectsPlayer] + e.instantRemainingPenalty);
          }
          // Legacy fields (deprecated, kept for compatibility)
          if (e.instantP0Delta) n[0] = Math.max(1, n[0] + e.instantP0Delta);
          if (e.instantP1Delta) n[1] = Math.max(1, n[1] + e.instantP1Delta);
          return n;
        });
      }
    });
    const nonInstant = effects.filter(e => !e.instant);
    if (nonInstant.length > 0) {
      setActiveEffects(prev => [...prev, ...nonInstant]);
    }
    setLastActivation({ cardName: card.name, player: turn as 0 | 1, key: `${card.name}-${turn}-${Date.now()}` });
    setCardActivationLog(prev => [...prev, { cardId: String(card.id ?? card.name), usedBy: turn as 0 | 1 }]);
    
    // Mark card as permanently used (consumed for this match)
    if (!cardsUsed.some((c: any) => c.id === card.id)) {
      setCardsUsed(prev => [...prev, card]);
    }
    
    cardDebugLog("X01Scorer", "Effects queued", { effects: effects.map(e => `${e.cardName}→P${e.affectsPlayer}[${e.status}]`) });
  }, [p1Cards, p2Cards, cardsUsed, turn, scores, legWins]);

  // Activate deferred-next-turn effects when it becomes the player's turn
  // Also apply penalty blocking if player has blockOpponentPenalties active
  // Also evaluate opponent penalty Wildcards (Underdog Curse, etc.)
  useEffect(() => {
    if (isCardClash && started[turn]) {
      setActiveEffects(prev => {
        let updated = ccActivateDeferredNextTurnEffects(prev, turn);
        // FIX 104: Validate Unstoppable Checkout (checkoutOnly)
        updated = ccValidateCheckoutOnlyCards(updated, scores, turn);
        // FIX 107: Validate Exact Finish (requiresExactFinish)
        updated = ccValidateExactFinishCards(updated, scores, turn);
        // FIX 609: Win Bonus Removed - remove opponent momentum effects (Lucky Streak, Hot Hand, Momentum Surge)
        const hasBonusRemoval = updated.some(e => e.cardName === "Win Bonus Removed" && e.status === "active" && e.affectsPlayer === turn);
        if (hasBonusRemoval) {
          updated = updated.filter(e => {
            if (["Lucky Streak", "Momentum Surge", "Hot Hand"].includes(e.cardName) && e.affectsPlayer === turn) {
              return false;
            }
            return true;
          });
        }
        updated = ccApplyPenaltyBlockingIfNeeded(updated, turn);
        return updated;
      });
    }
  }, [turn, isCardClash, started, legWins, scores]);

  // Reset free retries at start of each turn (for Checkout Confidence)
  useEffect(() => {
    setFreeRetriesUsed([0, 0]);
  }, [turn]);

  // Activate deferred-next-leg effects when a new leg starts
  const prevLegWinsRef = useRef(legWins);
  useEffect(() => {
    if (isCardClash && legWins !== prevLegWinsRef.current) {
      // A leg has ended and a new one started
      // Activate deferred-next-leg effects for both players
      // Also evaluate conditional Wildcard cards at leg start
      setActiveEffects(prev => {
        let updated = prev;
        // Activate deferred-next-leg effects
        updated = ccActivateDeferredNextLegEffects(updated, 0);
        updated = ccActivateDeferredNextLegEffects(updated, 1);
        // NOTE: ccEvaluateConditionalWildcards disabled - conditional wildcard bonuses should only apply when card is manually played
        // The conditional checks (won previous leg, ahead in match, etc.) should happen in ccActivateCard instead
        // updated = updated.concat(ccEvaluateConditionalWildcards(0, legHistory, legWins, legsNeeded));
        // updated = updated.concat(ccEvaluateConditionalWildcards(1, legHistory, legWins, legsNeeded));
        return updated;
      });
      prevLegWinsRef.current = legWins;
    }
  }, [legWins, legHistory, isCardClash, legsNeeded]);

  // Card Clash Practice: bot (player 2) plays its own cards intelligently on its turn
  useEffect(() => {
    if (!isCardClash || !botConfig || turn !== 1 || bust) return;
    const unused = p2Cards.filter((c: any) => !cardsUsed.some((u: any) => u.id === c.id));
    if (unused.length === 0) return;
    const timer = safeTimeout(() => {
      const good = unused.filter((c: any) => c.category?.includes("GOOD"));
      const bad = unused.filter((c: any) => c.category?.includes("BAD"));
      const oppRemaining = scores[0];
      const myRemaining = scores[1];
      const oppInCheckoutRange = oppRemaining <= 170 && oppRemaining >= 2 && started[0];
      const behindInLegs = legWins[0] > legWins[1];
      const iAmInCheckoutRange = myRemaining <= 170 && myRemaining >= 2;

      let choice: any = null;
      if (oppInCheckoutRange && bad.length > 0 && Math.random() < 0.65) {
        choice = bad[Math.floor(Math.random() * bad.length)];
      } else if (good.length > 0 && (iAmInCheckoutRange || behindInLegs || Math.random() < 0.35)) {
        choice = good[Math.floor(Math.random() * good.length)];
      } else if (bad.length > 0 && Math.random() < 0.2) {
        choice = bad[Math.floor(Math.random() * bad.length)];
      }
      if (choice) handleCardActivation(choice.id?.toString());
    }, 400);
    return () => clearTimeout(timer);
  }, [turn, isCardClash, botConfig, p2Cards, cardsUsed, scores, legWins, started, bust, handleCardActivation]);

  const handleDartRef = useRef(handleDart);
  useEffect(() => { handleDartRef.current = handleDart; });
  
  // Mark active cards as used at turn end
  const markActiveCardsAsUsed = useCallback(() => {
    if (!isCardClash || activeEffects.length === 0) return;
    setCardsUsed(prev => {
      const newUsed = [...prev];
      // Mark all cards that have active effects for current player as used
      activeEffects.forEach(effect => {
        if (effect.affectsPlayer === turn && effect.appliedBy === turn) {
          const card = (turn === 0 ? p1Cards : p2Cards).find((c: any) => c.name === effect.cardName);
          if (card && !newUsed.some(c => c.id === card.id)) {
            newUsed.push(card);
          }
        }
      });
      return newUsed;
    });
  }, [isCardClash, activeEffects, turn, p1Cards, p2Cards]);
  const isBotTurnX01 = !!botConfig && turn === 1;
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const [d1, d2, d3] = botX01Visit(scores[1], !!doubleOut, botConfig);
    const t1 = safeTimeout(() => handleDartRef.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRef.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRef.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Boss Battle: leg 1 never goes through resetForLeg (that only runs between
  // legs), so it needs its own one-time call on mount to keep leg numbering
  // 1-indexed and consistent with every later leg.
  useEffect(() => { onLegStart?.(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cum = visitDarts.reduce((s,d) => s+d.value, 0);
  const projected = scores[turn] - cum;
  // Display-only: what a visit-total cap (Mercy Killer, Shutdown) actually
  // leaves this visit worth, so the on-screen total/"leaves" line never
  // shows a number the game itself isn't using. Kept separate from `cum`/
  // `projected` above — those still drive the live checkout suggestion,
  // which reacts per-dart and isn't part of this fix.
  const cappedCum = isCardClash ? ccApplyVisitCap(cum, activeEffects, turn) : cum;
  const { fs, toggle: toggleFs } = useFullscreen();
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  // ── Card Clash: Load per-player cards written by CardClashMatchScorer ──
  useEffect(() => {
    if (sessionStorage.getItem("card_clash_mode") !== "true") return;
    setIsCardClash(true);
    setIsChaosMode(sessionStorage.getItem("card_clash_chaos_mode") === "true");
    setIsChaosLabMode(sessionStorage.getItem("card_clash_chaos_lab_mode") === "true");
    try {
      const p1Raw = sessionStorage.getItem("card_clash_p1_cards") || "[]";
      const p2Raw = sessionStorage.getItem("card_clash_p2_cards") || "[]";
      
      const p1 = JSON.parse(p1Raw);
      const p2 = JSON.parse(p2Raw);
      
      setP1Cards(p1);
      setP2Cards(p2);
      cardDebugLog("X01Scorer", "Card Clash mode active", { p1Cards: p1.length, p2Cards: p2.length });
    } catch (e) {
      cardDebugLog("X01Scorer", "Failed to load Card Clash cards from sessionStorage", e);
    }
  }, []);

  // ── Chaos Mode / Chaos Lab: deal 3 face-down mystery cards at the start of each fresh visit ──
  useEffect(() => {
    if (!isCardClash || !(isChaosMode || isChaosLabMode)) return;
    if (!started[turn]) return;
    if (visitDarts.length !== 0) return;
    const key = `${turn}:${history.length}`;

    // Chaos Lab: expire visit-end Board Marks for whoever's visit just ended
    // (the other player, relative to this fresh visit starting now). Also
    // grows Escalation cards' stage by one for every visit they survive
    // unhit (capped at 5, see computeBoardMarkTriggerMagnitude). Safe no-op
    // when activeBoardMarks is empty (e.g. every non-Chaos-Lab match).
    if (isChaosLabMode && boardMarkVisitEndKeyRef.current !== key) {
      boardMarkVisitEndKeyRef.current = key;
      const justEndedPlayer = String(turn === 0 ? 1 : 0);
      setActiveBoardMarks(prev => {
        const afterExpiry = expireBoardMarksForVisitEnd(prev, { visitId: key, visitPlayerId: justEndedPlayer });
        return afterExpiry.map(m => {
          if (m.createdByCardId !== "prototype_slow_burn" && m.createdByCardId !== "prototype_simmering_trap") return m;
          const stage = Math.min(5, Number(m.metadata?.escalationStage ?? 0) + 1);
          return { ...m, metadata: { ...m.metadata, escalationStage: stage } };
        });
      });
    }

    if (chaosResolvedKeyRef.current === key) return;
    const drawOptions = () => isChaosLabMode ? drawChaosLabOptions("X01", 3, setsToWin > 0) : drawChaosOptions("X01", 3);
    if (turn === 1 && botConfig) {
      // Bot picks instantly, no UI
      const opts = drawOptions();
      chaosResolvedKeyRef.current = key;
      const pick = opts[Math.floor(Math.random() * opts.length)];
      handleChaosCardActivationRef.current?.(pick);
      return;
    }
    setChaosOptions(drawOptions());
  }, [turn, visitDarts.length, started, isCardClash, isChaosMode, isChaosLabMode, history.length, botConfig]);

  // ── Board Curse: notify an outside wrapper every time a fresh visit begins ──
  const visitStartKeyRef = useRef<string>("");
  useEffect(() => {
    if (!onVisitStart) return;
    if (!started[turn]) return;
    if (visitDarts.length !== 0) return;
    const key = `${turn}:${history.length}`;
    if (visitStartKeyRef.current === key) return;
    visitStartKeyRef.current = key;
    onVisitStart(turn);
  }, [turn, visitDarts.length, started, history.length, onVisitStart]);

  // ── Chaos Mode: apply a revealed mystery card directly (no equip lookup) ──
  const handleChaosCardActivation = useCallback((card: CardData) => {
    cardDebugLog("X01Scorer", "Chaos card activated", { card: card.name });
    matchLoggerRef.current.log("card_drawn_chaos", { player: turn, card: card.name, category: card.category });

    // Chaos Lab: Sabotage cards (Erase/Purge) remove the opponent's active
    // mark(s) instead of placing a new one — resolved immediately on draw,
    // no dart needed. Falls back to placing the card's normal mark if the
    // opponent has nothing to remove, so it's never a dead draw.
    const sabotageKind = BOARD_MARK_SABOTAGE_CARD_IDS[card.id];
    if (sabotageKind) {
      const opponentPlayerId = String(turn === 0 ? 1 : 0);
      const sabotageResult = applyBoardMarkSabotage(activeBoardMarks, sabotageKind, opponentPlayerId);
      let usedFallback = sabotageResult.removedCount === 0;
      if (!usedFallback) {
        setActiveBoardMarks(sabotageResult.marks);
        matchLoggerRef.current.log("chaos_lab_sabotage", { card: card.name, kind: sabotageKind, removedCount: sabotageResult.removedCount });
        logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, turn as 0 | 1, { icon: "💥", color: "#ff4d4d", text: `${card.name}: removed ${sabotageResult.removedCount} opponent mark${sabotageResult.removedCount > 1 ? "s" : ""}` });
      } else {
        const fallbackConfig = BOARD_MARK_CARD_ID_MAP[card.id];
        if (fallbackConfig) {
          const fallbackMark = createBoardMarkFromPrototypeCard(fallbackConfig, { ownerPlayerId: String(turn), opponentPlayerId, createdAtVisitId: `${turn}:${history.length}` })[0];
          const placement = placeBoardMark(activeBoardMarks, fallbackMark);
          if (placement.ok) setActiveBoardMarks(placement.marks);
          matchLoggerRef.current.log("chaos_lab_sabotage_fallback", { card: card.name, kind: sabotageKind, placed: placement.ok });
          logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, turn as 0 | 1, { icon: "💥", color: "#ff4d4d", text: `${card.name}: nothing to ${sabotageKind}, placed a mark instead` });
        }
      }
      setLastActivation({ cardName: usedFallback ? `${card.name} (nothing to ${sabotageKind})` : `💥 ${card.name}!`, player: turn as 0 | 1, key: `boardmark-sabotage-${Date.now()}` });
      setCardActivationLog(prev => [...prev, { cardId: String(card.id ?? card.name), usedBy: turn as 0 | 1 }]);
      setChaosOptions(null);
      chaosResolvedKeyRef.current = `${turn}:${history.length}`;
      return;
    }

    // Chaos Lab: Match Swing cards read live match state and resolve
    // immediately on draw — no dart needed, never actually placed as a
    // mark. Falls back to a solid bonus if the condition isn't met, so
    // it's never a dead draw.
    const matchSwingKind = BOARD_MARK_MATCH_SWING_CARD_IDS[card.id];
    if (matchSwingKind) {
      const standing: [number, number] = matchSwingKind === "set_point" ? legWins : (setsToWin > 0 ? setWins : legWins);
      const outcome = computeMatchSwingOutcome(matchSwingKind, turn as 0 | 1, standing);
      matchLoggerRef.current.log("chaos_lab_match_swing", { card: card.name, kind: matchSwingKind, standing, conditionMet: outcome.conditionMet, delta: outcome.delta });
      if (outcome.conditionMet) {
        if (matchSwingKind === "set_point") {
          setLegWins(prev => [prev[0] + outcome.delta[0], prev[1] + outcome.delta[1]]);
        } else if (setsToWin > 0) {
          setSetWins(prev => [prev[0] + outcome.delta[0], prev[1] + outcome.delta[1]]);
        } else {
          setLegWins(prev => [prev[0] + outcome.delta[0], prev[1] + outcome.delta[1]]);
        }
        setLastActivation({ cardName: `🌪️ ${card.name}! Leg swing!`, player: turn as 0 | 1, key: `boardmark-swing-${Date.now()}` });
        logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, turn as 0 | 1, { icon: "🌪️", color: "#c084fc", text: `${card.name}: leg swing triggered!` });
      } else {
        const fallbackMagnitude = getBoardMarkMagnitude("bull", "X01", "hot");
        const rewardPlayer = turn as 0 | 1;
        pendingBoardMarkAdjustmentRef.current[rewardPlayer] += fallbackMagnitude;
        setScores(prev => {
          const n = [...prev] as [number, number];
          n[rewardPlayer] = clampX01RemainingAfterReduction(Math.max(0, n[rewardPlayer] - fallbackMagnitude));
          return n;
        });
        setLastActivation({ cardName: `${card.name} — condition not met, +${fallbackMagnitude} instead`, player: rewardPlayer, key: `boardmark-swing-fallback-${Date.now()}` });
        logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, rewardPlayer, { icon: "🌪️", color: "#ff8a3d", text: `${card.name}: condition not met, +${fallbackMagnitude} bonus instead` });
      }
      setCardActivationLog(prev => [...prev, { cardId: String(card.id ?? card.name), usedBy: turn as 0 | 1 }]);
      setChaosOptions(null);
      chaosResolvedKeyRef.current = `${turn}:${history.length}`;
      return;
    }

    // Chaos Lab: Board Mark cards don't run through the normal effect engine
    // at all — they place a mark, which only ever affects future Card Clash
    // triggers via the Board Marks resolver, never scoring.
    const boardMarkConfig = BOARD_MARK_CARD_ID_MAP[card.id];
    if (boardMarkConfig) {
      const opponentPlayerId = String(turn === 0 ? 1 : 0);
      const newMarks = createBoardMarkFromPrototypeCard(boardMarkConfig, {
        ownerPlayerId: String(turn),
        opponentPlayerId,
        createdAtVisitId: `${turn}:${history.length}`,
      });
      setActiveBoardMarks(prev => {
        // Compound (risk/reward) cards produce 2 marks — place each independently;
        // if one is blocked by conflict/shield, the other can still go through.
        let current = prev;
        for (const mark of newMarks) {
          const result = placeBoardMark(current, mark);
          if (result.ok) {
            current = result.marks;
            matchLoggerRef.current.log("chaos_lab_mark_placed", { card: card.name, type: mark.type, target: mark.target, appliesTo: mark.appliesTo, owner: mark.ownerPlayerId });
          } else {
            matchLoggerRef.current.log("chaos_lab_mark_placement_blocked", { card: card.name, type: mark.type, target: mark.target, reason: result.reason });
          }
        }
        return current;
      });
      setLastActivation({ cardName: card.name, player: turn as 0 | 1, key: `${card.name}-${turn}-${Date.now()}` });
      setCardActivationLog(prev => [...prev, { cardId: String(card.id ?? card.name), usedBy: turn as 0 | 1 }]);
      setChaosOptions(null);
      chaosResolvedKeyRef.current = `${turn}:${history.length}`;
      return;
    }

    const effects = ccActivateCard(card, turn, { scores, legWins }, undefined, { legHistory, legsNeeded });
    effects.forEach(e => {
      if (e.instant) {
        setScores(prev => {
          const n = [...prev] as [number, number];
          if (e.instantRemainingPenalty) n[e.affectsPlayer] = Math.max(1, n[e.affectsPlayer] + e.instantRemainingPenalty);
          if (e.instantP0Delta) n[0] = Math.max(1, n[0] + e.instantP0Delta);
          if (e.instantP1Delta) n[1] = Math.max(1, n[1] + e.instantP1Delta);
          return n;
        });
      }
    });
    const nonInstant = effects.filter(e => !e.instant);
    if (nonInstant.length > 0) setActiveEffects(prev => [...prev, ...nonInstant]);
    setLastActivation({ cardName: card.name, player: turn as 0 | 1, key: `${card.name}-${turn}-${Date.now()}` });
    setCardActivationLog(prev => [...prev, { cardId: String(card.id ?? card.name), usedBy: turn as 0 | 1 }]);
    setChaosOptions(null);
    chaosResolvedKeyRef.current = `${turn}:${history.length}`;
  }, [turn, scores, legWins, legHistory, legsNeeded, history.length]);

  const handleChaosCardActivationRef = useRef(handleChaosCardActivation);
  handleChaosCardActivationRef.current = handleChaosCardActivation;

  return (
    <>
    <ScorerLayout
      top={<div className="space-y-3">
        {/* Fullscreen toggle — always shown on mobile, hover-visible on desktop */}
        <div className="flex justify-end">
        <button
          onClick={toggleFs}
          title={fs ? "Exit fullscreen" : "Go fullscreen"}
          className={isMobile ? "" : "opacity-30 hover:opacity-100 transition-opacity"}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "0.5rem",
            padding: "0.4rem 0.75rem",
            color: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.7rem",
            fontFamily: "Oswald, sans-serif",
            fontWeight: 700,
            letterSpacing: "0.08em",
            cursor: "pointer",
          }}>
          {fs ? <Minimize size={13} /> : <Maximize size={13} />}
          {fs ? "EXIT FULL" : "FULLSCREEN"}
        </button>
      </div>
      <div className="pdc-divider" />
      {/* Leg / Set score indicators */}
      {(setsToWin > 0 || (legs && legs > 1)) && (
        <div className="flex items-center justify-center gap-6 text-sm" style={{ fontFamily: "Oswald, sans-serif" }}>
          {setsToWin > 0 ? (
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>SETS</div>
                <div className="flex items-center gap-6">
                  {[0,1].map(i => (
                    <div key={i} className="text-center">
                      <div style={{ color: P_COLOR(i), fontSize: "0.65rem" }}>{names[i].split(" ")[0]}</div>
                      <div style={{ color: "#ffd24a", fontSize: "1.4rem", fontWeight: 900 }}>{setWins[i]}</div>
                      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.6rem" }}>/{setsNeeded}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-center">
                <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>LEGS</div>
                <div className="flex items-center gap-6">
                  {[0,1].map(i => (
                    <div key={i} className="text-center">
                      <div style={{ color: P_COLOR(i), fontSize: "0.65rem" }}>{names[i].split(" ")[0]}</div>
                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "1.1rem", fontWeight: 900 }}>
                        {legWins[i]}<span style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.65rem" }}>/{legsNeeded}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            [0,1].map(i => (
              <div key={i} className="flex items-center gap-1.5">
                <span style={{ color: P_COLOR(i) }}>{names[i]}</span>
                <span style={{ color: "#ffd24a", fontSize: "1.2rem", fontWeight: 900 }}>{legWins[i]}</span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" }}>/{legsNeeded}</span>
              </div>
            ))
          )}
        </div>
      )}
      {voiceEnabled && (
        <div className="flex justify-end items-center gap-2">
          {callerVoices.length > 0 && (
            <select value={callerVoiceURI ?? ""} onChange={e => changeCallerVoice(e.target.value)}
              title="Caller voice"
              className="px-2 py-1 rounded-lg text-xs max-w-[9rem]"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)", fontFamily: "Oswald, sans-serif" }}>
              <option value="">Default voice</option>
              {callerVoices.map(v => (
                <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
              ))}
            </select>
          )}
          <button onClick={toggleVoiceMuted} title={voiceMuted ? "Unmute voice call-outs" : "Mute voice call-outs"}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
            {voiceMuted ? "🔇" : "🔊"} {voiceMuted ? "Voice off" : "Voice on"}
          </button>
        </div>
      )}
      {/* Scoreboard */}
      <div className={soloMode ? "grid grid-cols-1 gap-3 max-w-xs mx-auto w-full" : "grid grid-cols-2 gap-3"}>
        {([0, ...(soloMode ? [] : [1])] as (0|1)[]).map(i => (
          <PlayerCard key={i} name={names[i]} score={scores[i]}
            turn={i===0} active={turn===i && !bust}
            sub={doubleIn && !started[i] ? "double in required" : undefined} />
        ))}
      </div>
      {isCardClash && <CCEffectsHUD effects={activeEffects} names={[p1Name, p2Name]} lastActivation={lastActivation} />}
      {isCardClash && isChaosLabMode && <BoardMarksHUD marks={activeBoardMarks} names={[p1Name, p2Name]} engine="X01" viewerIdx={turn as 0 | 1} />}
      {isCardClash && isChaosLabMode && <ChaosLabActivityLog entries={chaosLabActivityLogRef.current} names={[p1Name, p2Name]} />}
      {/* Checkout bar — updates live after every dart in the visit */}
      {([0, ...(soloMode ? [] : [1])] as (0|1)[]).map(i => {
        // For the active player, use the live remaining (score minus darts thrown so far this visit)
        // so the suggestion updates dart-by-dart. For inactive player use committed score.
        const liveRem = (i === turn && !bust) ? projected : scores[i];
        const co = (liveRem <= 170 && liveRem >= 2 && (!doubleIn || started[i])) ? CHECKOUTS[liveRem] : undefined;
        if (!co) return null;
        return <CheckoutBar key={i} checkout={co} playerName={names[i]} playerIdx={i as 0|1} />;
      })}
      {bust ? <BustBanner msg={bustMsg} /> : isBotTurnX01 ? <TurnBanner name={names[1]} turn={1} msg="— CPU THROWING…" /> : <TurnBanner name={names[turn]} turn={turn} msg={doubleIn && !started[turn] ? "— hit a double to start" : undefined} />}
      <SectionCard>
        <VisitDarts darts={visitDarts} cappedTotal={isCardClash ? cappedCum : undefined} />
        {visitDarts.length > 0 && (
          <div className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
            {cappedCum} scored{cappedCum !== cum ? ` (${cum} capped)` : ""} → leaves {(scores[turn] - cappedCum) >= 0 ? scores[turn] - cappedCum : "BUST"}
          </div>
        )}
      </SectionCard>
      {/* Card Modal - shows as overlay on top when showCards is true */}
      {showCards && isCardClash && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          zIndex: 1000,
          padding: "40px 16px 16px 16px",
          overflowY: "auto"
        }}
        onClick={() => setShowCards(false)}
        >
          <div style={{
            background: "linear-gradient(135deg, #0a0015 0%, #1a0033 100%)",
            border: "1.5px solid rgba(0,180,255,0.3)",
            borderRadius: "12px",
            padding: "16px",
            width: "100%",
            maxWidth: "480px",
            maxHeight: "50vh"
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px"
            }}>
              <div style={{
                fontSize: "14px",
                fontWeight: 900,
                color: "#00d4ff",
                letterSpacing: "0.05em",
                fontFamily: "'Arial Black',sans-serif"
              }}>⚡ YOUR CARDS</div>
              <button
                onClick={() => setShowCards(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#00d4ff",
                  fontSize: "24px",
                  cursor: "pointer",
                  padding: 0
                }}
              >
                ✕
              </button>
            </div>

            {/* GOOD Cards */}
            <div style={{ marginBottom: "20px" }}>
              <div style={{
                fontSize: "11px",
                fontWeight: 900,
                color: "#00cc66",
                letterSpacing: "0.1em",
                marginBottom: "10px",
                textTransform: "uppercase"
              }}>GOOD CARDS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {(turn === 0 ? p1Cards : p2Cards)
                  .filter((c: any) => c.category?.includes("GOOD"))
                  .map((card: any) => {
                    const isPermanentlyUsed = cardsUsed.some((used: any) => used.id === card.id);
                    return (
                      <div
                        key={card.id}
                        onClick={() => {
                          if (!isPermanentlyUsed) setSelectedCard(card);
                        }}
                        style={{
                          cursor: isPermanentlyUsed ? "not-allowed" : "pointer",
                          opacity: isPermanentlyUsed ? 0.4 : 1,
                          transform: !isPermanentlyUsed ? "scale(1)" : "scale(0.9)",
                          transition: "all 0.2s",
                          position: "relative"
                        }}
                      >
                        <TKDLCard card={card} size="md" locked={isPermanentlyUsed} />
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* BAD Cards */}
            <div>
              <div style={{
                fontSize: "11px",
                fontWeight: 900,
                color: "#ff6b6b",
                letterSpacing: "0.1em",
                marginBottom: "10px",
                textTransform: "uppercase"
              }}>BAD CARDS</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {(turn === 0 ? p1Cards : p2Cards)
                  .filter((c: any) => c.category?.includes("BAD"))
                  .map((card: any) => {
                    const isPermanentlyUsed = cardsUsed.some((used: any) => used.id === card.id);
                    return (
                      <div
                        key={card.id}
                        onClick={() => {
                          if (!isPermanentlyUsed) setSelectedCard(card);
                        }}
                        style={{
                          cursor: isPermanentlyUsed ? "not-allowed" : "pointer",
                          opacity: isPermanentlyUsed ? 0.4 : 1,
                          transform: !isPermanentlyUsed ? "scale(1)" : "scale(0.9)",
                          transition: "all 0.2s",
                          position: "relative"
                        }}
                      >
                        <TKDLCard card={card} size="md" locked={isPermanentlyUsed} />
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Recent Visits OR Card Toggle Button */}
      {(history.length > 0 || isCardClash) && (
        <SectionCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div className="text-xs uppercase tracking-widest font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
              {showCards ? "⚡ Your Cards" : "Recent Visits"}
            </div>
            {isCardClash && (
              <button
                onClick={() => setShowCards(!showCards)}
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  color: showCards ? "#00d4ff" : "rgba(255,255,255,0.4)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 6px",
                  transition: "color 0.2s",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = "#00d4ff";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = showCards ? "#00d4ff" : "rgba(255,255,255,0.4)";
                }}
              >
                {showCards ? "Hide" : "Cards"}
              </button>
            )}
          </div>
          
          {!showCards && (
            [...(showCards ? [] : history)].reverse().slice(0, 5).map((h, i) => (
              <div key={i} style={{ padding: "1px 0" }}>
                <div className="flex justify-between text-xs py-0.5">
                  <span style={{ color: P_COLOR(h.turn), fontFamily: "Oswald, sans-serif" }}>{names[h.turn]}</span>
                  <span style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>+{h.score}</span>
                  <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "mono" }}>{h.left} left</span>
                </div>
                {h.boardMarkNotes && h.boardMarkNotes.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1px", marginTop: "1px", marginBottom: "2px" }}>
                    {h.boardMarkNotes.map((note, ni) => (
                      <div key={ni} style={{ fontSize: "0.62rem", color: note.color, fontFamily: "Oswald, sans-serif", paddingLeft: "8px" }}>
                        {note.icon} {note.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </SectionCard>
      )}
      </div>
      }
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={handleMiss} onUndo={handleUndo} disabled={bust || isBotTurnX01} markedSegments={isCardClash && isChaosLabMode ? boardMarksToSegments(activeBoardMarks, "X01") : undefined} />
        <AbandonBtn onAbandon={() => { if (isCardClash) uploadMatchLog(matchLoggerRef.current, { gameMode: "X01", isChaosMode, isChaosLabMode }); onAbandon(); }} />
        {isCardClash && <DownloadMatchLogBtn logger={matchLoggerRef.current} />}
      </div>}
    />
    <CardActivationOverlay 
      equippedCards={(turn === 0 ? p1Cards : p2Cards).map(c => ({
        ...c,
        id: c.id || 0,
        isActive: cardsUsed.some((used: any) => used.id === c.id),
      }))}
      isVisible={isCardClash && (turn === 0 ? p1Cards : p2Cards).length > 0}
      selectedCard={selectedCard}
      onCardActivate={handleCardActivation}
      onClose={() => setSelectedCard(null)}
    />
    {isCardClash && (isChaosMode || isChaosLabMode) && chaosOptions && !(turn === 1 && botConfig) && (
      <ChaosCardReveal
        options={chaosOptions}
        playerLabel={names[turn]}
        onResolve={handleChaosCardActivation}
      />
    )}
    </>
  );
}

// ── Cricket Scorer ─────────────────────────────────────────────────────────────
const CRICKET_NUMS = [20, 19, 18, 17, 16, 15, 25];
const CRICKET_LABELS = ["20", "19", "18", "17", "16", "15", "Bull"];
const markSymbol = (m: number) => m === 0 ? "" : m === 1 ? "/" : m === 2 ? "✕" : "●";

export function CricketScorer({ p1Name, p2Name, cutThroat = false, includesBull = true, botConfig, onWin, onAbandon, onPracticeStats, cardEffects = [], legs: legsProp, setsToWin = 0, legsToWinSet = 3, soloMode = false, onCardsUsedChange, onLegStart, onVisitStart }: {
  p1Name: string; p2Name: string; cutThroat?: boolean; includesBull?: boolean; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
  cardEffects?: any[];
  legs?: number;
  setsToWin?: number;
  legsToWinSet?: number;
  /** Board Curse: solo play against no opponent — turn stays pinned on player 0, and closing every
   *  number wins outright (player 1's score never moves off 0, so the normal win check passes as
   *  soon as everything's closed). Mirrors X01Scorer's soloMode. */
  soloMode?: boolean;
  /** Card Clash: fires with every card activation (equip mode AND chaos mode, both players) for reward reporting. */
  onCardsUsedChange?: (log: { cardId: string; usedBy: 0 | 1 }[]) => void;
  /** Boss Battle: fires once when leg N begins (1-indexed, including leg 1 on mount) — see X01Scorer's onLegStart for the full explanation. */
  onLegStart?: (legNumber: number) => void;
  /** Board Curse: fires every time a fresh visit begins — see X01Scorer's onVisitStart for the full explanation. */
  onVisitStart?: (turn: 0 | 1) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const numCount = includesBull ? 7 : 6;
  const legs = legsProp;
  useEffect(() => { onLegStart?.(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const setsNeeded = setsToWin > 0 ? Math.ceil(setsToWin / 2) : 0;
  const legsNeeded = setsToWin > 0 ? Math.ceil(legsToWinSet / 2) : (legs ? Math.ceil(legs / 2) : 0);
  const [marks, setMarks]       = useState<[[number,number,number,number,number,number,number],[number,number,number,number,number,number,number]]>([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]);
  const [scores, setScores]     = useState<[number,number]>([0,0]);
  const [turn, setTurn]         = useState<0|1>(0);
  const [legWins, setLegWins]       = useState<[number, number]>([0, 0]);
  const [setWins, setSetWins]       = useState<[number, number]>([0, 0]);
  const [legHistory, setLegHistory] = useState<(0|1)[]>([]);
  const [legStarter, setLegStarter] = useState<0 | 1>(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [lastHit, setLastHit]   = useState<string>("");
  const [snapHistory, setSnapHistory] = useState<{marks: [[number,number,number,number,number,number,number],[number,number,number,number,number,number,number]], scores: [number,number], turn: 0|1, visitDarts: Dart[]}[]>([]);
  const [lockedNumbers, setLockedNumbers] = useState<[Set<number>, Set<number>]>([new Set(), new Set()]); // Track locked numbers per player (Number Prison, Re-Opening Block)
  const [protectedNumbers, setProtectedNumbers] = useState<[Set<number>, Set<number>]>([new Set(), new Set()]); // FIX 306: Numbers that can't be closed by opponent
  const [turnCounter, setTurnCounter] = useState<number>(1); // FIX 309: Track turn number in leg (1-based) for Early Closer
  const [prevTurnMarks, setPrevTurnMarks] = useState<[number[],number[]]>([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]); // Track marks from previous turn for Momentum Killer
  const [lastVisitMarkGains, setLastVisitMarkGains] = useState<[number[],number[]]>([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]); // Track marks gained last visit for Momentum Killer/Streak Breaker
  const [visitMarkGains, setVisitMarkGains] = useState<number[]>([0,0,0,0,0,0,0]); // Track marks gained this visit
  const [cricketVisitScore, setCricketVisitScore] = useState(0); // Track score gained this visit
  const [cricketVisitMarks, setCricketVisitMarks] = useState(0); // Track total marks gained this visit
  const [cricketClosedThisVisit, setCricketClosedThisVisit] = useState(false); // Track if number was closed this visit

  // Card Clash state (populated from sessionStorage by CardClashMatchScorer)
  const [p1Cards, setP1Cards]         = useState<any[]>([]);
  const [p2Cards, setP2Cards]         = useState<any[]>([]);
  const [cardsUsed, setCardsUsed]     = useState<any[]>([]);
  // Purpose-built log for reward reporting (separate from cardsUsed, which drives UI "already used" checks). Tracks every activation, equip-mode AND chaos.
  const [cardActivationLog, setCardActivationLog] = useState<{ cardId: string; usedBy: 0 | 1 }[]>([]);
  const [isCardClash, setIsCardClash] = useState(false);
  const [activeEffects, setActiveEffects] = useState<CCEffect[]>([]);
  const [lastActivation, setLastActivation] = useState<{ cardName: string; player: 0 | 1; key: string } | null>(null);
  const [showCards, setShowCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);

  useEffect(() => {
    onCardsUsedChange?.(cardActivationLog);
  }, [cardActivationLog]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chaos Mode state (no equip — random mystery card dealt each visit)
  const [isChaosMode, setIsChaosMode] = useState(false);
  const [chaosOptions, setChaosOptions] = useState<CardData[] | null>(null);
  const chaosResolvedKeyRef = useRef<string>("");

  // Chaos Lab state (Board Marks v1) — a separate mode from regular Chaos Mode,
  // never required by Standard Card Clash or existing Chaos Mode.
  const [isChaosLabMode, setIsChaosLabMode] = useState(false);
  const [activeBoardMarks, setActiveBoardMarks] = useState<BoardMark[]>([]);
  const boardMarkVisitEndKeyRef = useRef<string>("");
  // BUGFIX: a Hot/Trap reward applied via setScores on a dart that ALSO wins
  // the leg was getting silently wiped by resetForLeg's setScores([starting,
  // starting]) a moment later, before the player ever saw it. D16 in
  // particular is one of the most common checkout doubles, so this was very
  // reachable. This ref tracks any reward/penalty that hasn't yet "settled"
  // (survived to a fresh visit without the leg ending) -- resetForLeg
  // consumes it into the new leg's starting scores instead of losing it.
  const pendingBoardMarkAdjustmentRef = useRef<[number, number]>([0, 0]);
  // Collects Board Mark events for the current visit, per player — see X01Scorer's ref for the full comment.
  const boardMarkVisitNotesRef = useRef<[BoardMarkVisitNote[], BoardMarkVisitNote[]]>([[], []]);
  // Match-wide Chaos Lab Activity Log -- a persistent, engine-agnostic record
  // of every Chaos Lab event (Hot/Trap/Cold/Swap/Surge/Weaken/Leech/
  // Sabotage/Match Swing), shown on both X01 and Cricket regardless of
  // whether the engine has a per-visit "Recent Visits" panel. Capped at
  // CHAOS_LAB_ACTIVITY_LOG_CAP most recent entries.
  const chaosLabActivityLogRef = useRef<ChaosLabActivityEntry[]>([]);
  const [, setChaosLabActivityTick] = useState(0); // forces a re-render when the ref-based activity log changes
  // Structured match log — see X01Scorer's matchLoggerRef for the full comment.
  const matchLoggerRef = useRef(createMatchLogger({ engine: "CRICKET", p1Name, p2Name }));

  const names = [p1Name, p2Name];

  // ── Card Clash: Apply mark gain removal (Momentum Killer & Streak Breaker) ──
  const applyMarkGainRemoval = useCallback((target: 0|1, mode: "all" | "half") => {
    const gains = lastVisitMarkGains[target] || [];
    const totalGained = gains.reduce((sum, value) => sum + value, 0);
    const threshold = mode === "all" ? 2 : 3;
    if (totalGained < threshold) return;

    setMarks(prev => {
      const nm: typeof marks = [[...prev[0]] as any, [...prev[1]] as any];
      gains.forEach((gain, idx) => {
        if (gain <= 0) return;
        const reduction = mode === "all" ? gain : Math.ceil(gain / 2);
        nm[target][idx] = Math.max(0, nm[target][idx] - reduction);
      });
      cardDebugLog("CricketScorer", `[CARD_CLASH:${mode === "all" ? "MOMENTUM_KILLER" : "STREAK_BREAKER"}]`, { player: target, marksReduced: gains.length });
      return nm;
    });
  }, [lastVisitMarkGains]);

  // ── Card Clash: End cricket visit and apply visit-end effects ──
  const endCricketVisit = useCallback((completedPlayer: 0|1) => {
    // Pressure penalty: -30 if no number was closed this visit
    const pressurePenalty = activeEffects
      .filter(e => e.status === "active" && e.affectsPlayer === completedPlayer && e.pressureLoseIfNoClose)
      .reduce((sum, e) => sum + (e.pressureLoseIfNoClose ?? 0), 0);

    if (pressurePenalty > 0 && !cricketClosedThisVisit) {
      setScores(prev => {
        const ns: [number,number] = [...prev] as [number,number];
        ns[completedPlayer] = Math.max(0, ns[completedPlayer] - pressurePenalty);
        cardDebugLog("CricketScorer", "[CARD_CLASH:PRESSURE]", { player: completedPlayer, penalty: pressurePenalty });
        return ns;
      });
    }

    // Store this visit's mark gains for next player's Momentum Killer activation
    setLastVisitMarkGains(prev => {
      const next = [prev[0].slice(), prev[1].slice()] as [number[], number[]];
      next[completedPlayer] = visitMarkGains.slice();
      return next;
    });

    // Update prevTurnMarks for next comparison
    setPrevTurnMarks(prev => {
      const next = [prev[0].slice(), prev[1].slice()] as [number[], number[]];
      next[completedPlayer] = marks[completedPlayer].slice();
      return next;
    });

    // Reset visit state
    setVisitMarkGains([0,0,0,0,0,0,0]);
    setCricketVisitScore(0);
    setCricketVisitMarks(0);
    setCricketClosedThisVisit(false);
    setVisitDarts([]);

    // Expire turn-based effects and switch turn
    if (isCardClash) setActiveEffects(prev => ccExpireOnTurnEnd(prev, completedPlayer));
    setTurn(t => soloMode ? 0 : (t===0?1:0));
    setLastHit("");
  }, [activeEffects, cricketClosedThisVisit, isCardClash, marks, visitMarkGains, soloMode]);

  // Sync with cardEffects from parent (CardClashMatchScorer)
  useEffect(() => {
    if (cardEffects && cardEffects.length > 0) {
      setActiveEffects(cardEffects);
    }
  }, [cardEffects]);

  // ── Card Clash: Load per-player cards written by CardClashMatchScorer ──
  useEffect(() => {
    if (sessionStorage.getItem("card_clash_mode") !== "true") return;
    setIsCardClash(true);
    setIsChaosMode(sessionStorage.getItem("card_clash_chaos_mode") === "true");
    setIsChaosLabMode(sessionStorage.getItem("card_clash_chaos_lab_mode") === "true");
    try {
      const p1Raw = sessionStorage.getItem("card_clash_p1_cards") || "[]";
      const p2Raw = sessionStorage.getItem("card_clash_p2_cards") || "[]";
      
      const p1 = JSON.parse(p1Raw);
      const p2 = JSON.parse(p2Raw);
      
      setP1Cards(p1);
      setP2Cards(p2);
      cardDebugLog("CricketScorer", "Card Clash mode active", { p1Cards: p1.length, p2Cards: p2.length });
    } catch (e) {
      cardDebugLog("CricketScorer", "Failed to load Card Clash cards from sessionStorage", e);
    }
  }, []);

  // ── Chaos Mode / Chaos Lab: deal 3 face-down mystery cards at the start of each fresh visit ──
  useEffect(() => {
    if (!isCardClash || !(isChaosMode || isChaosLabMode)) return;
    if (visitDarts.length !== 0) return;
    const key = `${turn}:${legHistory.length}:${turnCounter}`;

    // Chaos Lab: expire visit-end Board Marks for whoever's visit just ended,
    // and grow Escalation cards' stage by one for every visit they survive unhit.
    if (isChaosLabMode && boardMarkVisitEndKeyRef.current !== key) {
      boardMarkVisitEndKeyRef.current = key;
      const justEndedPlayer = String(turn === 0 ? 1 : 0);
      setActiveBoardMarks(prev => {
        const afterExpiry = expireBoardMarksForVisitEnd(prev, { visitId: key, visitPlayerId: justEndedPlayer });
        return afterExpiry.map(m => {
          if (m.createdByCardId !== "prototype_slow_burn" && m.createdByCardId !== "prototype_simmering_trap") return m;
          const stage = Math.min(5, Number(m.metadata?.escalationStage ?? 0) + 1);
          return { ...m, metadata: { ...m.metadata, escalationStage: stage } };
        });
      });
    }

    if (chaosResolvedKeyRef.current === key) return;
    const drawOptions = () => isChaosLabMode ? drawChaosLabOptions("CRICKET", 3, setsToWin > 0) : drawChaosOptions("CRICKET", 3);
    if (turn === 1 && botConfig) {
      const opts = drawOptions();
      chaosResolvedKeyRef.current = key;
      const pick = opts[Math.floor(Math.random() * opts.length)];
      handleChaosCardActivationRef.current?.(pick);
      return;
    }
    setChaosOptions(drawOptions());
  }, [turn, visitDarts.length, isCardClash, isChaosMode, isChaosLabMode, turnCounter, legHistory, botConfig]);

  // ── Board Curse: notify an outside wrapper every time a fresh visit begins ──
  const visitStartKeyRefCri = useRef<string>("");
  useEffect(() => {
    if (!onVisitStart) return;
    if (visitDarts.length !== 0) return;
    const key = `${turn}:${legHistory.length}:${turnCounter}`;
    if (visitStartKeyRefCri.current === key) return;
    visitStartKeyRefCri.current = key;
    onVisitStart(turn);
  }, [turn, visitDarts.length, turnCounter, legHistory, onVisitStart]);

  // ── Chaos Mode: apply a revealed mystery card directly (no equip lookup) ──
  const handleChaosCardActivation = useCallback((card: CardData) => {
    cardDebugLog("CricketScorer", "Chaos card activated", { card: card.name });
    matchLoggerRef.current.log("card_drawn_chaos", { player: turn, card: card.name, category: card.category });

    // Chaos Lab: Sabotage cards (Erase/Purge) remove the opponent's active
    // mark(s) instead of placing a new one — resolved immediately on draw,
    // no dart needed. Falls back to placing the card's normal mark if the
    // opponent has nothing to remove, so it's never a dead draw.
    const sabotageKind = BOARD_MARK_SABOTAGE_CARD_IDS[card.id];
    if (sabotageKind) {
      const opponentPlayerId = String(turn === 0 ? 1 : 0);
      const sabotageResult = applyBoardMarkSabotage(activeBoardMarks, sabotageKind, opponentPlayerId);
      let usedFallback = sabotageResult.removedCount === 0;
      if (!usedFallback) {
        setActiveBoardMarks(sabotageResult.marks);
        matchLoggerRef.current.log("chaos_lab_sabotage", { card: card.name, kind: sabotageKind, removedCount: sabotageResult.removedCount });
        logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, turn as 0 | 1, { icon: "💥", color: "#ff4d4d", text: `${card.name}: removed ${sabotageResult.removedCount} opponent mark${sabotageResult.removedCount > 1 ? "s" : ""}` });
      } else {
        const fallbackConfig = BOARD_MARK_CARD_ID_MAP[card.id];
        if (fallbackConfig) {
          const fallbackMark = createBoardMarkFromPrototypeCard(fallbackConfig, { ownerPlayerId: String(turn), opponentPlayerId, createdAtVisitId: `${turn}:${legHistory.length}:${turnCounter}` })[0];
          const placement = placeBoardMark(activeBoardMarks, fallbackMark);
          if (placement.ok) setActiveBoardMarks(placement.marks);
          matchLoggerRef.current.log("chaos_lab_sabotage_fallback", { card: card.name, kind: sabotageKind, placed: placement.ok });
          logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, turn as 0 | 1, { icon: "💥", color: "#ff4d4d", text: `${card.name}: nothing to ${sabotageKind}, placed a mark instead` });
        }
      }
      setLastActivation({ cardName: usedFallback ? `${card.name} (nothing to ${sabotageKind})` : `💥 ${card.name}!`, player: turn as 0 | 1, key: `boardmark-sabotage-${Date.now()}` });
      setCardActivationLog(prev => [...prev, { cardId: String(card.id ?? card.name), usedBy: turn as 0 | 1 }]);
      setChaosOptions(null);
      chaosResolvedKeyRef.current = `${turn}:${legHistory.length}:${turnCounter}`;
      return;
    }

    // Chaos Lab: Match Swing cards read live match state and resolve
    // immediately on draw — no dart needed, never actually placed as a
    // mark. Falls back to a solid bonus if the condition isn't met, so
    // it's never a dead draw.
    const matchSwingKind = BOARD_MARK_MATCH_SWING_CARD_IDS[card.id];
    if (matchSwingKind) {
      const standing: [number, number] = matchSwingKind === "set_point" ? legWins : (setsToWin > 0 ? setWins : legWins);
      const outcome = computeMatchSwingOutcome(matchSwingKind, turn as 0 | 1, standing);
      matchLoggerRef.current.log("chaos_lab_match_swing", { card: card.name, kind: matchSwingKind, standing, conditionMet: outcome.conditionMet, delta: outcome.delta });
      if (outcome.conditionMet) {
        if (matchSwingKind === "set_point") {
          setLegWins(prev => [prev[0] + outcome.delta[0], prev[1] + outcome.delta[1]]);
        } else if (setsToWin > 0) {
          setSetWins(prev => [prev[0] + outcome.delta[0], prev[1] + outcome.delta[1]]);
        } else {
          setLegWins(prev => [prev[0] + outcome.delta[0], prev[1] + outcome.delta[1]]);
        }
        setLastActivation({ cardName: `🌪️ ${card.name}! Leg swing!`, player: turn as 0 | 1, key: `boardmark-swing-${Date.now()}` });
        logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, turn as 0 | 1, { icon: "🌪️", color: "#c084fc", text: `${card.name}: leg swing triggered!` });
      } else {
        const fallbackMagnitude = getBoardMarkMagnitude("bull", "CRICKET", "hot");
        const rewardPlayer = turn as 0 | 1;
        pendingBoardMarkAdjustmentRef.current[rewardPlayer] += fallbackMagnitude;
        setScores(prev => {
          const n = [...prev] as [number, number];
          n[rewardPlayer] = n[rewardPlayer] + fallbackMagnitude;
          return n;
        });
        setLastActivation({ cardName: `${card.name} — condition not met, +${fallbackMagnitude} instead`, player: rewardPlayer, key: `boardmark-swing-fallback-${Date.now()}` });
        logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, rewardPlayer, { icon: "🌪️", color: "#ff8a3d", text: `${card.name}: condition not met, +${fallbackMagnitude} bonus instead` });
      }
      setCardActivationLog(prev => [...prev, { cardId: String(card.id ?? card.name), usedBy: turn as 0 | 1 }]);
      setChaosOptions(null);
      chaosResolvedKeyRef.current = `${turn}:${legHistory.length}:${turnCounter}`;
      return;
    }

    // Chaos Lab: Board Mark cards don't run through the normal effect engine
    // at all — they place a mark, which only ever affects future Card Clash
    // triggers via the Board Marks resolver, never scoring.
    const boardMarkConfig = BOARD_MARK_CARD_ID_MAP[card.id];
    if (boardMarkConfig) {
      const opponentPlayerId = String(turn === 0 ? 1 : 0);
      const newMarks = createBoardMarkFromPrototypeCard(boardMarkConfig, {
        ownerPlayerId: String(turn),
        opponentPlayerId,
        createdAtVisitId: `${turn}:${legHistory.length}:${turnCounter}`,
      });
      setActiveBoardMarks(prev => {
        let current = prev;
        for (const mark of newMarks) {
          const result = placeBoardMark(current, mark);
          if (result.ok) {
            current = result.marks;
            matchLoggerRef.current.log("chaos_lab_mark_placed", { card: card.name, type: mark.type, target: mark.target, appliesTo: mark.appliesTo, owner: mark.ownerPlayerId });
          } else {
            matchLoggerRef.current.log("chaos_lab_mark_placement_blocked", { card: card.name, type: mark.type, target: mark.target, reason: result.reason });
          }
        }
        return current;
      });
      setLastActivation({ cardName: card.name, player: turn as 0 | 1, key: `${card.name}-${turn}-${Date.now()}` });
      setCardActivationLog(prev => [...prev, { cardId: String(card.id ?? card.name), usedBy: turn as 0 | 1 }]);
      setChaosOptions(null);
      chaosResolvedKeyRef.current = `${turn}:${legHistory.length}:${turnCounter}`;
      return;
    }

    // Same "called number" calculation as the equip-mode handler
    let calledNumber: number | undefined;
    for (let i = 0; i < numCount; i++) {
      if (marks[turn][i] < 3) {
        calledNumber = CRICKET_NUMS[i];
        break;
      }
    }

    const effects = ccActivateCard(card, turn, { marks, scores } as any, undefined, { legHistory, legsNeeded, calledNumber });

    // Card Clash: Number Prison — randomly lock one of opponent's closed numbers
    if (card.name === "Number Prison") {
      const opp: 0|1 = turn === 0 ? 1 : 0;
      const oppMarks = marks[opp];
      const closedNumbers: number[] = [];
      CRICKET_NUMS.forEach((num, idx) => {
        if (oppMarks[idx] >= 3) closedNumbers.push(num);
      });
      if (closedNumbers.length > 0) {
        const randomIdx = Math.floor(Math.random() * closedNumbers.length);
        const lockedNum = closedNumbers[randomIdx];
        setLockedNumbers(prev => {
          const newLocked = [new Set(prev[0]), new Set(prev[1])] as [Set<number>, Set<number>];
          newLocked[opp].add(lockedNum);
          return newLocked;
        });
      }
    }

    // CARD CLASH: Momentum Killer (409) - remove marks gained by opponent last visit
    if (card.name === "Momentum Killer") {
      const opp: 0|1 = turn === 0 ? 1 : 0;
      applyMarkGainRemoval(opp, "all");
      cardDebugLog("CricketScorer", "[CARD_CLASH:MOMENTUM_KILLER]", { targetPlayer: opp });
    }

    // CARD CLASH: Streak Breaker (418) - halve marks if opponent gained 3+ last visit
    if (card.name === "Streak Breaker") {
      const opp: 0|1 = turn === 0 ? 1 : 0;
      applyMarkGainRemoval(opp, "half");
      cardDebugLog("CricketScorer", "[CARD_CLASH:STREAK_BREAKER]", { targetPlayer: opp });
    }

    // CARD CLASH: Win Bonus Removed (609) - strip opponent's momentum bonuses
    if (card.name === "Win Bonus Removed") {
      const opp: 0|1 = turn === 0 ? 1 : 0;
      setActiveEffects(prev =>
        prev.filter(e =>
          e.affectsPlayer !== opp ||
          !["Lucky Streak", "Momentum Surge", "Hot Hand"].includes(e.cardName)
        )
      );
      cardDebugLog("CricketScorer", "[CARD_CLASH:WIN_BONUS_REMOVED]", { targetPlayer: opp });
    }

    effects.forEach(e => {
      if (e.instant) {
        if (e.instantCricketMarks) {
          setMarks(prev => {
            const newMarks = prev.map(row => [...row]) as typeof marks;
            for (const markMutation of e.instantCricketMarks!) {
              const currentMarks = newMarks[markMutation.playerIdx][markMutation.numberIdx];
              if (markMutation.markDelta === -999) {
                newMarks[markMutation.playerIdx][markMutation.numberIdx] = 0;
              } else {
                newMarks[markMutation.playerIdx][markMutation.numberIdx] = Math.min(3, currentMarks + markMutation.markDelta);
              }
            }
            return newMarks;
          });
        }
        setScores(prev => {
          const n = [...prev] as [number, number];
          if (e.instantScoreDelta) {
            n[e.affectsPlayer] = Math.max(0, n[e.affectsPlayer] + e.instantScoreDelta);
          }
          if (e.instantP0Delta) n[0] = Math.max(0, n[0] + e.instantP0Delta);
          if (e.instantP1Delta) n[1] = Math.max(0, n[1] + e.instantP1Delta);
          return n;
        });
      }
    });

    const nonInstant = effects.filter(e => !e.instant);
    if (nonInstant.length > 0) setActiveEffects(prev => [...prev, ...nonInstant]);
    setLastActivation({ cardName: card.name, player: turn as 0 | 1, key: `${card.name}-${turn}-${Date.now()}` });
    setCardActivationLog(prev => [...prev, { cardId: String(card.id ?? card.name), usedBy: turn as 0 | 1 }]);
    setChaosOptions(null);
    chaosResolvedKeyRef.current = `${turn}:${legHistory.length}:${turnCounter}`;
  }, [turn, marks, scores, legHistory, legsNeeded, turnCounter, numCount, applyMarkGainRemoval]);

  const handleChaosCardActivationRef = useRef(handleChaosCardActivation);
  handleChaosCardActivationRef.current = handleChaosCardActivation;

  // ── Card Clash: Handle card activation ──
  const handleCardActivation = useCallback((cardId: string) => {
    const currentCards = turn === 0 ? p1Cards : p2Cards;
    const card = currentCards.find((c: any) => c.id?.toString() === cardId);
    if (!card) { 
      cardDebugLog("CricketScorer", "Card not found", { cardId }); 
      return; 
    }
    cardDebugLog("CricketScorer", "Card activated", { card: card.name });
    matchLoggerRef.current.log("card_activated_equip", { player: turn, card: card.name });

    // THEME 4: Calculate called number (first unclosed number for this player)
    let calledNumber: number | undefined;
    for (let i = 0; i < numCount; i++) {
      if (marks[turn][i] < 3) {
        calledNumber = CRICKET_NUMS[i];
        break;
      }
    }

    // NOTE: Cricket now supports multi-leg matches (Best of Legs / Sets), same as X01,
    // so leg-conditioned Wildcard cards (Lucky Streak, Momentum Surge, etc.) use the
    // real legHistory/legsNeeded here instead of the single-leg-only stub this used to be.
    const effects = ccActivateCard(card, turn, { marks, scores } as any, undefined, { legHistory, legsNeeded, calledNumber });
    
    // Card Clash: Number Prison — randomly lock one of opponent's closed numbers
    if (card.name === "Number Prison") {
      const opp: 0|1 = turn === 0 ? 1 : 0;
      const oppMarks = marks[opp];
      const closedNumbers: number[] = [];
      CRICKET_NUMS.forEach((num, idx) => {
        if (oppMarks[idx] >= 3) closedNumbers.push(num);
      });
      
      if (closedNumbers.length > 0) {
        const randomIdx = Math.floor(Math.random() * closedNumbers.length);
        const lockedNum = closedNumbers[randomIdx];
        setLockedNumbers(prev => {
          const newLocked = [new Set(prev[0]), new Set(prev[1])] as [Set<number>, Set<number>];
          newLocked[opp].add(lockedNum);
          return newLocked;
        });
      }
    }

    // CARD CLASH: Momentum Killer (409) - remove marks gained by opponent last visit
    if (card.name === "Momentum Killer") {
      const opp: 0|1 = turn === 0 ? 1 : 0;
      applyMarkGainRemoval(opp, "all");
      cardDebugLog("CricketScorer", "[CARD_CLASH:MOMENTUM_KILLER]", { targetPlayer: opp });
    }

    // CARD CLASH: Streak Breaker (418) - halve marks if opponent gained 3+ last visit
    if (card.name === "Streak Breaker") {
      const opp: 0|1 = turn === 0 ? 1 : 0;
      applyMarkGainRemoval(opp, "half");
      cardDebugLog("CricketScorer", "[CARD_CLASH:STREAK_BREAKER]", { targetPlayer: opp });
    }

    // CARD CLASH: Win Bonus Removed (609) - strip opponent's momentum bonuses
    if (card.name === "Win Bonus Removed") {
      const opp: 0|1 = turn === 0 ? 1 : 0;
      setActiveEffects(prev =>
        prev.filter(e =>
          e.affectsPlayer !== opp ||
          !["Lucky Streak", "Momentum Surge", "Hot Hand"].includes(e.cardName)
        )
      );
      cardDebugLog("CricketScorer", "[CARD_CLASH:WIN_BONUS_REMOVED]", { targetPlayer: opp });
    }

    effects.forEach(e => {
      if (e.instant) {
        // THEME 4: Handle instant Cricket mark mutations
        if (e.instantCricketMarks) {
          setMarks(prev => {
            const newMarks = prev.map(row => [...row]) as typeof marks;
            for (const markMutation of e.instantCricketMarks!) {
              const currentMarks = newMarks[markMutation.playerIdx][markMutation.numberIdx];
              if (markMutation.markDelta === -999) {
                // Reset to 0 (Number Resurrection)
                newMarks[markMutation.playerIdx][markMutation.numberIdx] = 0;
              } else {
                // Add marks (Instant Mark)
                newMarks[markMutation.playerIdx][markMutation.numberIdx] = Math.min(3, currentMarks + markMutation.markDelta);
              }
            }
            return newMarks;
          });
        }
        
        // Handle score deltas
        setScores(prev => {
          const n = [...prev] as [number, number];
          // THEME 3: Mode-specific instant effects (Cricket)
          if (e.instantScoreDelta) {
            n[e.affectsPlayer] = Math.max(0, n[e.affectsPlayer] + e.instantScoreDelta);
          }
          // Legacy fields (deprecated, kept for compatibility)
          if (e.instantP0Delta) n[0] = Math.max(0, n[0] + e.instantP0Delta);
          if (e.instantP1Delta) n[1] = Math.max(0, n[1] + e.instantP1Delta);
          return n;
        });
      }
    });
    const nonInstant = effects.filter(e => !e.instant);
    if (nonInstant.length > 0) {
      setActiveEffects(prev => [...prev, ...nonInstant]);
    }
    setLastActivation({ cardName: card.name, player: turn as 0 | 1, key: `${card.name}-${turn}-${Date.now()}` });
    setCardActivationLog(prev => [...prev, { cardId: String(card.id ?? card.name), usedBy: turn as 0 | 1 }]);
    cardDebugLog("CricketScorer", "Effects queued", { effects: effects.map(e => `${e.cardName}→P${e.affectsPlayer}[${e.status}]`) });
    if (!cardsUsed.some((c: any) => c.id === card.id)) {
      setCardsUsed(prev => [...prev, card]);
    }
  }, [p1Cards, p2Cards, cardsUsed, turn, marks, scores, legHistory, legsNeeded]);

  // Card Clash Practice: bot (player 2) plays its own cards intelligently on its turn
  useEffect(() => {
    if (!isCardClash || !botConfig || turn !== 1) return;
    const unused = p2Cards.filter((c: any) => !cardsUsed.some((u: any) => u.id === c.id));
    if (unused.length === 0) return;
    const timer = safeTimeout(() => {
      const good = unused.filter((c: any) => c.category?.includes("GOOD"));
      const bad = unused.filter((c: any) => c.category?.includes("BAD"));
      const myClosed = marks[1].slice(0, numCount).filter(m => m >= 3).length;
      const oppClosed = marks[0].slice(0, numCount).filter(m => m >= 3).length;
      const behindOnScore = scores[0] > scores[1];
      const oppAheadOnClosures = oppClosed > myClosed;

      let choice: any = null;
      if (oppAheadOnClosures && bad.length > 0 && Math.random() < 0.6) {
        choice = bad[Math.floor(Math.random() * bad.length)];
      } else if (good.length > 0 && (behindOnScore || oppAheadOnClosures || Math.random() < 0.35)) {
        choice = good[Math.floor(Math.random() * good.length)];
      } else if (bad.length > 0 && Math.random() < 0.2) {
        choice = bad[Math.floor(Math.random() * bad.length)];
      }
      if (choice) handleCardActivation(choice.id?.toString());
    }, 400);
    return () => clearTimeout(timer);
  }, [turn, isCardClash, botConfig, p2Cards, cardsUsed, marks, scores, numCount, handleCardActivation]);

  const checkWin = (m: typeof marks, sc: [number,number]): 0|1|null => {
    for (const p of [0,1] as const) {
      const closed = m[p].slice(0, numCount).every(x => x >= 3);
      if (!closed) continue;
      const opp: 0|1 = p === 0 ? 1 : 0;
      if (!cutThroat && sc[p] >= sc[opp]) return p;
      if (cutThroat && sc[p] <= sc[opp]) return p;
    }
    return null;
  };

  const resetForLeg = useCallback((delay: number, newLegState: [number,number]) => {
    safeTimeout(() => {
      const ns: 0|1 = legStarter === 0 ? 1 : 0;
      setLegStarter(ns);
      setMarks([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]);
      // Fold in any Board Mark reward/penalty that hasn't settled yet (see
      // pendingBoardMarkAdjustmentRef's BUGFIX note) so it isn't silently
      // lost if this leg ended on the exact same dart that triggered it.
      const pendingCri = pendingBoardMarkAdjustmentRef.current;
      if (pendingCri[0] !== 0 || pendingCri[1] !== 0) {
        cardDebugLog("CricketScorer", "[CHAOS_LAB] Applying pending adjustment to new leg start", { pending: pendingCri });
        matchLoggerRef.current.log("chaos_lab_pending_applied_to_new_leg", { pending: pendingCri });
      }
      setScores([Math.max(0, pendingCri[0]), Math.max(0, pendingCri[1])]);
      pendingBoardMarkAdjustmentRef.current = [0, 0];
      if (isChaosLabMode) setActiveBoardMarks(prev => expireBoardMarksForLegEnd(prev));
      setTurn(soloMode ? 0 : ns);
      setVisitDarts([]);
      setLastHit("");
      setLockedNumbers([new Set(), new Set()]);
      setProtectedNumbers([new Set(), new Set()]);
      setTurnCounter(1);
      setPrevTurnMarks([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]);
      setLastVisitMarkGains([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]);
      setVisitMarkGains([0,0,0,0,0,0,0]);
      setCricketVisitScore(0);
      setCricketVisitMarks(0);
      setCricketClosedThisVisit(false);
      onLegStart?.(newLegState[0] + newLegState[1] + 1);
      setLegWins(newLegState);

      const legWinner = newLegState[0] > legWins[0] ? 0 : newLegState[1] > legWins[1] ? 1 : null;
      if (legWinner !== null) {
        matchLoggerRef.current.log("leg_won", { winner: legWinner });
        setLegHistory(prev => [...prev, legWinner]);

        // Card Clash: Perfect Game — shutout bonus (opponent scored 0 this leg).
        // BUGFIX: Perfect Game is a WILDCARD GOOD card (meant to work in both
        // X01 and Cricket) but this whole leg-transition bonus check only
        // existed in X01Scorer — it never fired in Cricket matches at all.
        // Also checks activeEffects so a Chaos-mode draw is detected too —
        // Chaos Mode has no persistent "equipped" state, only activeEffects.
        const opp: 0|1 = legWinner === 0 ? 1 : 0;
        if (isCardClash && scores[opp] === 0) {
          const winnerCardsForShutout = legWinner === 0 ? p1Cards : p2Cards;
          const hasPerfectGame = winnerCardsForShutout.some((c: any) => c.name?.trim() === "Perfect Game")
            || activeEffects.some(e => e.status === "active" && e.affectsPlayer === legWinner && e.cardName === "Perfect Game");
          if (hasPerfectGame) {
            setActiveEffects(prev => [...prev, {
              cardName: "Perfect Game",
              appliedBy: legWinner,
              affectsPlayer: legWinner,
              status: "active",
              visitBonus: 30,
              legDuration: true,
            }]);
          }
        }
      }
    }, delay);
  }, [legStarter, legWins, isCardClash, scores, p1Cards, p2Cards, onLegStart, soloMode]);

  const handleLegWin = useCallback((winnerIdx: 0|1) => {
    // Single-leg match (default / Bo1) — no format selected, behave exactly as before
    if (setsToWin <= 0 && (!legs || legs <= 1)) {
      if (isCardClash) uploadMatchLog(matchLoggerRef.current, { gameMode: "CRICKET", isChaosMode, isChaosLabMode });
      onWin(winnerIdx, cutThroat ? `Cut-Throat — lowest score wins` : undefined);
      return;
    }

    if (setsToWin > 0) {
      setLegWins(prev => {
        const n: [number,number] = [...prev] as [number,number];
        n[winnerIdx]++;
        if (n[winnerIdx] >= legsNeeded) {
          const ns: [number,number] = [setWins[0], setWins[1]];
          ns[winnerIdx]++;
          if (ns[winnerIdx] >= setsNeeded) {
            safeTimeout(() => {
              setSetWins(ns);
              if (isCardClash) uploadMatchLog(matchLoggerRef.current, { gameMode: "CRICKET", isChaosMode, isChaosLabMode });
              onWin(winnerIdx, `${ns[winnerIdx]}–${ns[winnerIdx===0?1:0]} sets`);
            }, 800);
          } else {
            safeTimeout(() => {
              setSetWins(ns);
              resetForLeg(0, [0, 0]);
            }, 1500);
          }
          return [0, 0];
        } else {
          resetForLeg(1200, n);
          return prev;
        }
      });
    } else {
      setLegWins(prev => {
        const n: [number,number] = [...prev] as [number,number];
        n[winnerIdx]++;
        if (n[winnerIdx] >= legsNeeded) {
          safeTimeout(() => {
            if (isCardClash) uploadMatchLog(matchLoggerRef.current, { gameMode: "CRICKET", isChaosMode, isChaosLabMode });
            onWin(winnerIdx, `${n[winnerIdx]}–${n[winnerIdx===0?1:0]} legs`);
          }, 200);
        } else {
          resetForLeg(1500, n);
        }
        return n;
      });
    }
  }, [legs, legsNeeded, setsNeeded, setsToWin, setWins, onWin, cutThroat, resetForLeg]);

  const handleDart = useCallback((dart: Dart) => {
    if (visitDarts.length >= 3) return;

    matchLoggerRef.current.log("dart_thrown", { player: turn, segment: dart.segment, multiplier: dart.multiplier, value: dart.value, label: dart.label });

    if (isChaosLabMode && visitDarts.length === 0) {
      boardMarkVisitNotesRef.current[turn] = [];
      if (pendingBoardMarkAdjustmentRef.current[turn] !== 0) {
        cardDebugLog("CricketScorer", "[CHAOS_LAB] Clearing settled pending adjustment at fresh visit", { player: turn, cleared: pendingBoardMarkAdjustmentRef.current[turn] });
        matchLoggerRef.current.log("chaos_lab_pending_adjustment_settled", { player: turn, cleared: pendingBoardMarkAdjustmentRef.current[turn] });
        pendingBoardMarkAdjustmentRef.current[turn] = 0;
      }
    }

    // Snapshot full state before this dart — enables per-dart AND cross-visit undo
    setSnapHistory(prev => [...prev, {
      marks: [marks[0].slice() as [number,number,number,number,number,number,number], marks[1].slice() as [number,number,number,number,number,number,number]],
      scores: [...scores] as [number,number],
      turn,
      visitDarts: [...visitDarts],
    }]);
    
    // CARD CLASH: Preprocess dart for Mark Flood and Aim Shift effects
    const effectiveDart = isCardClash
      ? ccPreprocessCricketDart(dart, activeEffects, turn, marks[turn])
      : dart;

    // Chaos Lab: resolve Board Marks against this dart. Runs on the real,
    // already-preprocessed dart. Hot/Trap rewards apply via a separate
    // setScores call, so they never interfere with this dart's own
    // scoring/marks math. Also stashed into pendingBoardMarkAdjustmentRef in
    // case this exact dart also wins the leg — see BUGFIX note on the ref.
    if (isCardClash && isChaosLabMode && activeBoardMarks.length > 0) {
      const dartResult = toBoardMarkDartResult(effectiveDart, String(turn));
      const resolved = resolveBoardMarksForDart(activeBoardMarks, { dartResult });
      if (resolved.events.length > 0) {
        setActiveBoardMarks(resolved.marks);
        const hot = resolved.events.find(e => e.type === "board_mark_hot_triggered");
        const cold = resolved.events.find(e => e.type === "card_clash_trigger_blocked_by_cold_mark");
        const trap = resolved.events.find(e => e.type === "card_clash_trigger_cancelled_by_trap_mark");
        if (hot) {
          const triggeredMark = activeBoardMarks.find(m => m.id === hot.markId);
          const payload = (triggeredMark?.metadata?.payload as string) ?? "score_shift";
          const rewardPlayer = turn as 0 | 1;
          const otherPlayer: 0 | 1 = rewardPlayer === 0 ? 1 : 0;

          if (payload === "swap_scores") {
            setScores(prev => {
              const n: [number, number] = [prev[1], prev[0]];
              cardDebugLog("CricketScorer", "[CHAOS_LAB] Score Swap triggered", { triggeredBy: rewardPlayer, scoresBefore: prev, scoresAfter: n });
              matchLoggerRef.current.log("chaos_lab_score_swap", { triggeredBy: rewardPlayer, scoresBefore: prev, scoresAfter: n });
              return n;
            });
            setLastActivation({ cardName: "🔄 SCORES SWAPPED!", player: rewardPlayer, key: `boardmark-swap-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, rewardPlayer, { icon: "🔄", color: "#c084fc", text: "Score Swap!" });
          } else if (payload === "double_next_visit") {
            setActiveEffects(prev => [...prev, { cardName: "Surge (Board Mark)", appliedBy: rewardPlayer, affectsPlayer: rewardPlayer, status: "pending", extraScoreMultiplier: 2 }]);
            cardDebugLog("CricketScorer", "[CHAOS_LAB] Surge triggered", { player: rewardPlayer });
            matchLoggerRef.current.log("chaos_lab_surge", { player: rewardPlayer });
            setLastActivation({ cardName: "⚡ SURGE! Your next visit scores ×2", player: rewardPlayer, key: `boardmark-surge-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, rewardPlayer, { icon: "⚡", color: "#ff8a3d", text: "Surge: next visit ×2" });
          } else if (payload === "leech_score") {
            const leechPct = triggeredMark?.createdByCardId === "prototype_parasite" ? 0.35 : 0.5;
            const leechAmount = Math.floor(effectiveDart.value * leechPct);
            setScores(prev => {
              const n = [...prev] as [number, number];
              n[otherPlayer] = Math.max(0, n[otherPlayer] - leechAmount);
              cardDebugLog("CricketScorer", "[CHAOS_LAB] Leech triggered", { player: rewardPlayer, dartValue: effectiveDart.value, leechAmount, scoresBefore: prev, scoresAfter: n });
              matchLoggerRef.current.log("chaos_lab_leech", { player: rewardPlayer, dartValue: effectiveDart.value, leechAmount, scoresBefore: prev, scoresAfter: n });
              return n;
            });
            setLastActivation({ cardName: `🩸 SIPHONED! -${leechAmount} from them`, player: rewardPlayer, key: `boardmark-leech-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, rewardPlayer, { icon: "🩸", color: "#ff8a3d", text: `Siphon: -${leechAmount} to opponent` });
          } else {
            const magnitude = computeBoardMarkTriggerMagnitude(triggeredMark!, "CRICKET", "hot");
            const isSteal = !!triggeredMark?.metadata?.steal;
            pendingBoardMarkAdjustmentRef.current[rewardPlayer] += magnitude; // adds to their next-leg starting points if this ends the leg
            if (isSteal) pendingBoardMarkAdjustmentRef.current[otherPlayer] -= magnitude;
            setScores(prev => {
              const n = [...prev] as [number, number];
              n[rewardPlayer] = n[rewardPlayer] + magnitude;
              if (isSteal) n[otherPlayer] = Math.max(0, n[otherPlayer] - magnitude);
              cardDebugLog("CricketScorer", "[CHAOS_LAB] Hot triggered", { target: triggeredMark?.target, player: rewardPlayer, magnitude, isSteal, scoresBefore: prev, scoresAfter: n });
              matchLoggerRef.current.log("chaos_lab_hot_triggered", { target: triggeredMark?.target, player: rewardPlayer, magnitude, isSteal, scoresBefore: prev, scoresAfter: n });
              return n;
            });
            setLastActivation({ cardName: isSteal ? `🔥💰 Stolen! +${magnitude}` : `🔥 Hot! +${magnitude}`, player: rewardPlayer, key: `boardmark-hot-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, rewardPlayer, { icon: "🔥", color: "#ff8a3d", text: isSteal ? `Hot (steal): +${magnitude} bonus, opponent -${magnitude}` : `Hot bonus: +${magnitude}` });
          }
        } else if (trap) {
          const triggeredMark = activeBoardMarks.find(m => m.id === trap.markId);
          const payload = (triggeredMark?.metadata?.payload as string) ?? "score_shift";
          const penalizedPlayer = turn as 0 | 1;
          const trapOwner: 0 | 1 | undefined = triggeredMark ? (Number(triggeredMark.ownerPlayerId) as 0 | 1) : undefined;

          if (payload === "weaken_next_visit") {
            setActiveEffects(prev => [...prev, { cardName: "Weakened (Board Mark)", appliedBy: trapOwner ?? (penalizedPlayer === 0 ? 1 : 0), affectsPlayer: penalizedPlayer, status: "pending", extraScoreMultiplier: 0.5 }]);
            cardDebugLog("CricketScorer", "[CHAOS_LAB] Weakened triggered", { player: penalizedPlayer });
            matchLoggerRef.current.log("chaos_lab_weakened", { player: penalizedPlayer });
            setLastActivation({ cardName: "🥶 WEAKENED! Their next visit scores ×0.5", player: penalizedPlayer, key: `boardmark-weaken-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, penalizedPlayer, { icon: "🥶", color: "#ff4d4d", text: "Weakened: next visit ×0.5" });
          } else {
            const magnitude = computeBoardMarkTriggerMagnitude(triggeredMark!, "CRICKET", "trap");
            const isSteal = !!triggeredMark?.metadata?.steal;
            pendingBoardMarkAdjustmentRef.current[penalizedPlayer] -= magnitude;
            if (isSteal && trapOwner !== undefined) pendingBoardMarkAdjustmentRef.current[trapOwner] += magnitude;
            setScores(prev => {
              const n = [...prev] as [number, number];
              n[penalizedPlayer] = Math.max(0, n[penalizedPlayer] - magnitude);
              if (isSteal && trapOwner !== undefined) n[trapOwner] = n[trapOwner] + magnitude;
              cardDebugLog("CricketScorer", "[CHAOS_LAB] Trap sprung", { target: triggeredMark?.target, player: penalizedPlayer, magnitude, isSteal, scoresBefore: prev, scoresAfter: n });
              matchLoggerRef.current.log("chaos_lab_trap_sprung", { target: triggeredMark?.target, player: penalizedPlayer, magnitude, isSteal, scoresBefore: prev, scoresAfter: n });
              return n;
            });
            setLastActivation({ cardName: isSteal ? `⚠️💰 Robbed! -${magnitude}` : `⚠️ Trap! -${magnitude}`, player: penalizedPlayer, key: `boardmark-trap-${Date.now()}` });
            logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, penalizedPlayer, { icon: "⚠️", color: "#ff4d4d", text: isSteal ? `Trap (steal): -${magnitude} penalty, opponent +${magnitude}` : `Trap penalty: -${magnitude}` });
          }
        } else if (cold) {
          matchLoggerRef.current.log("chaos_lab_cold_blocked", { target: cold.target, player: turn });
          setLastActivation({ cardName: "❄️ Blocked by Cold", player: turn as 0 | 1, key: `boardmark-cold-${Date.now()}` });
          logChaosLabActivity(boardMarkVisitNotesRef, chaosLabActivityLogRef, setChaosLabActivityTick, turn as 0 | 1, { icon: "❄️", color: "#5ec8ff", text: "Blocked by Cold — no trigger" });
        }
        cardDebugLog("CricketScorer", "[CHAOS_LAB] Board Mark events", resolved.events);
        matchLoggerRef.current.log("chaos_lab_resolver_events", { events: resolved.events, activeMarksAfter: resolved.marks.map(m => ({ id: m.id, type: m.type, target: m.target })) });
      }
    }
    
    // Cricket No Bull: bull hits are treated as misses
    if (!includesBull && effectiveDart.segment === 25) {
      const nv = [...visitDarts, dart];
      setVisitDarts(nv);
      setLastHit("Miss (no bull)");
      if (nv.length === 3) { setVisitDarts([]); setTurn(t => soloMode ? 0 : (t===0?1:0)); setLastHit(""); }
      return;
    }
    const numIdx = CRICKET_NUMS.indexOf(effectiveDart.segment);
    const nv = [...visitDarts, dart];

    if (numIdx >= 0) {
      // Card Clash: apply mark modifiers (Double Strike, Bad Aim, Hesitation, Sluggish, etc.)
      const rawHits = effectiveDart.multiplier;
      let effectiveHits = isCardClash ? (() => {
        const inFinalLeg = legsNeeded - legWins[turn] === 1;
        const effectsForMarks = inFinalLeg ? activeEffects : activeEffects.filter(e => !e.finalLegOnly);
        return ccApplyCricketMarkEffects(rawHits, effectiveDart.segment, visitDarts.length, effectsForMarks, turn);
      })() : rawHits;
      
      // Card Clash: Apply conditional Cricket card multipliers (Comeback Marks, Dominance)
      if (isCardClash) {
        const opp: 0|1 = turn === 0 ? 1 : 0;
        
        // Comeback Marks (313): If behind in points, marks * 1.5x
        const hasCombackMarks = activeEffects.some(e => e.cardName === "Comeback Marks" && e.status === "active" && e.affectsPlayer === turn);
        if (hasCombackMarks && scores[turn] < scores[opp]) {
          effectiveHits = Math.floor(effectiveHits * 1.5);
        }
        
        // Dominance (320): If lead in closed numbers, marks * 1.3x
        const hasDominance = activeEffects.some(e => e.cardName === "Dominance" && e.status === "active" && e.affectsPlayer === turn);
        if (hasDominance) {
          const closedByPlayer = marks[turn].filter(m => m >= 3).length;
          const closedByOpp = marks[opp].filter(m => m >= 3).length;
          if (closedByPlayer > closedByOpp) {
            effectiveHits = Math.floor(effectiveHits * 1.3);
          }
        }
      }
      
      // CARD CLASH FIX 303: Sniper Lock - next 3 darts must hit the locked segment
      if (isCardClash) {
        const sniperEffect = activeEffects.find(e => 
          e.cardName === "Sniper Lock" && e.status === "active" && e.affectsPlayer === turn
        );
        if (sniperEffect && sniperEffect.sniperLockSegment !== undefined) {
          if (dart.segment !== sniperEffect.sniperLockSegment) {
            effectiveHits = 0;  // Miss the sniper lock - no marks
          }
          // Decrement dart counter for sniper lock
          if (sniperEffect.dartsRemainingForSniper !== undefined) {
            setActiveEffects(prev => prev.map(e => 
              e === sniperEffect ? { ...e, dartsRemainingForSniper: (e.dartsRemainingForSniper ?? 0) - 1 } : e
            ));
            if (sniperEffect.dartsRemainingForSniper <= 1) {
            }
          }
        }
      }
      
      const canClose = !isCardClash || !ccBlockClosing(activeEffects, turn);
      
      // FIX 306: Check if number is protected by opponent's Closing Protection
      const isProtected = isCardClash && protectedNumbers[turn === 0 ? 1 : 0].has(CRICKET_NUMS[numIdx]);
      const effectiveCanClose = canClose && !isProtected;
      
      // Card Clash: Check if number is locked (Number Prison)
      const isLocked = isCardClash && lockedNumbers[turn].has(CRICKET_NUMS[numIdx]);
      const effectiveHitsAfterLock = isLocked ? 0 : effectiveHits;

      // BUGFIX AUDIT (610 Shutdown): maxMarksPerTurn field was defined but never enforced —
      // cap total marks this player can gain across all numbers this turn.
      const marksCapEffect = isCardClash
        ? activeEffects.find(e => e.status === "active" && e.affectsPlayer === turn && e.maxMarksPerTurn !== undefined)
        : undefined;
      const marksGainedThisTurnSoFar = visitMarkGains.reduce((sum, v) => sum + v, 0);
      const marksAllowance = marksCapEffect
        ? Math.max(0, (marksCapEffect.maxMarksPerTurn as number) - marksGainedThisTurnSoFar)
        : Infinity;
      const effectiveHitsAfterCap = Math.min(effectiveHitsAfterLock, marksAllowance);
      if (marksCapEffect && effectiveHitsAfterCap < effectiveHitsAfterLock) {
      }

      setMarks(prev => {
        const nm: typeof marks = [[ ...prev[0] ] as any, [ ...prev[1] ] as any];
        const toClose = Math.max(0, (effectiveCanClose ? 3 : 2) - nm[turn][numIdx]);
        const absorbed = Math.min(effectiveHitsAfterCap, Math.max(0, toClose));
        const extra = effectiveHitsAfterCap - absorbed;
        const wasClosedBefore = prev[turn][numIdx] >= 3;
        nm[turn][numIdx] = Math.min(effectiveCanClose ? 3 : 2, nm[turn][numIdx] + absorbed);
        const closedByThisDart = !wasClosedBefore && nm[turn][numIdx] >= 3;
        
        // CARD CLASH: Track mark gains this visit (for Momentum Killer, Streak Breaker, Mark Multiplier)
        if (isCardClash && absorbed > 0) {
          setVisitMarkGains(prev => {
            const next = prev.slice();
            next[numIdx] += absorbed;
            return next;
          });
          
          // Track if a number was closed this visit (for Pressure penalty)
          if (closedByThisDart) {
            setCricketClosedThisVisit(true);
          }
        }
        
        // FIX 306: Closing Protection - mark number as protected if opened with effect active
        if (isCardClash && absorbed > 0 && prev[turn][numIdx] === 0 && nm[turn][numIdx] > 0) {
          // This player just opened this number
          const hasClosingProtection = activeEffects.some(e => 
            e.cardName === "Closing Protection" && e.status === "active" && e.affectsPlayer === turn
          );
          if (hasClosingProtection) {
            setProtectedNumbers(prev => {
              const newProtected = [new Set(prev[0]), new Set(prev[1])] as [Set<number>, Set<number>];
              newProtected[turn].add(CRICKET_NUMS[numIdx]);
              return newProtected;
            });
          }
        }
        
        // Card Clash: Re-Opening Block — lock number if closing opponent's number with this card
        if (isCardClash && absorbed > 0 && nm[turn][numIdx] >= 3 && prev[turn][numIdx] < 3) {
          // This player just closed this number
          // Check if OPPONENT has Re-Opening Block active (they applied it to affect us)
          const hasReOpeningBlock = activeEffects.some(e => 
            e.cardName === "Re-Opening Block" && e.status === "active" && e.appliedBy !== turn && e.affectsPlayer === turn
          );
          if (hasReOpeningBlock) {
            setLockedNumbers(prev => {
              const newLocked = [new Set(prev[0]), new Set(prev[1])] as [Set<number>, Set<number>];
              newLocked[turn].add(CRICKET_NUMS[numIdx]);
              return newLocked;
            });
          }
        }
        // Card Clash: Early Closer (309) - bonus if close number in turns 1-4 (before turn 5)
        if (isCardClash && turnCounter < 5) {
          const hasEarlyCloser = activeEffects.some(e => 
            e.cardName === "Early Closer" && e.status === "active" && e.affectsPlayer === turn && e.freeMarkIfEarlyClose
          );
          if (hasEarlyCloser && absorbed > 0 && nm[turn][numIdx] >= 3 && prev[turn][numIdx] < 3) {
            // Number just closed in early turns - award +30 bonus
            setScores(ps => {
              const ns: [number,number] = [...ps];
              ns[turn] += 30;  // +30 bonus for early close
              return ns;
            });
          }
        }
        
        // Card Clash: Quick Close (316) - free mark if closing with ≤2 darts (by dart 2)
        if (isCardClash && visitDarts.length <= 2 && absorbed > 0) {
          const hasQuickClose = activeEffects.some(e => 
            e.cardName === "Quick Close" && e.status === "active" && e.affectsPlayer === turn && e.freeMarkIfQuickClose
          );
          if (hasQuickClose && nm[turn][numIdx] >= 3 && prev[turn][numIdx] < 3) {
            // Just closed with 2 or fewer darts - add free mark to another number
            const nextOpenIdx = nm[turn].findIndex(m => m < 3);
            if (nextOpenIdx >= 0) {
              nm[turn][nextOpenIdx] = Math.min(3, nm[turn][nextOpenIdx] + 1);
            }
          }
        }
        
        if (isLocked && effectiveHits > 0) {
        }
        // Score extra hits (scoring marks beyond closing)
        if (extra > 0) {
          const opp: 0|1 = turn === 0 ? 1 : 0;
          if (nm[opp][numIdx] < 3) {
            const effectiveExtra = isCardClash
              ? ccApplyCricketScoreEffects(extra, activeEffects, turn)
              : extra;
            setScores(ps => {
              const ns: [number,number] = [...ps] as [number,number];
              const val = CRICKET_NUMS[numIdx];
              if (cutThroat) ns[opp] += effectiveExtra * val;
              else ns[turn] += effectiveExtra * val;
              // Card Clash: per-mark penalty/bonus (Mark Erasure, Momentum Arsenal)
              if (isCardClash) {
                ns[turn] = Math.max(0, ns[turn]
                  - ccPenaltyPerMark(activeEffects, turn) * absorbed
                  + ccBonusPerMark(activeEffects, turn) * absorbed);
              }
              return ns;
            });
          }
        } else if (absorbed > 0 && isCardClash) {
          setScores(ps => {
            const ns: [number,number] = [...ps] as [number,number];
            ns[turn] = Math.max(0, ns[turn]
              - ccPenaltyPerMark(activeEffects, turn) * absorbed
              + ccBonusPerMark(activeEffects, turn) * absorbed);
            return ns;
          });
        }
        return nm;
      });
      const lbl = effectiveDart.multiplier === 1 ? `${effectiveDart.segment}` : effectiveDart.multiplier === 2 ? `D${effectiveDart.segment}` : `T${effectiveDart.segment}`;
      setLastHit(lbl);
      
      // FIX 311/312: Bull Multiplier / Bullseye Rush - mark chosen segments when Bull is hit
      if (isCardClash && dart.segment === 25 && includesBull) {
        const bullEffect = activeEffects.find(e => 
          (e.cardName === "Bull Multiplier" || e.cardName === "Bullseye Rush") && 
          e.status === "active" && e.affectsPlayer === turn &&
          e.bullMarksSegments && e.bullMarksSegments.length > 0
        );
        if (bullEffect) {
          setMarks(prev => {
            const nm: typeof marks = [[ ...prev[0] ] as any, [ ...prev[1] ] as any];
            for (const segment of bullEffect.bullMarksSegments ?? []) {
              const segIdx = CRICKET_NUMS.indexOf(segment);
              if (segIdx >= 0) nm[turn][segIdx] = Math.min(3, nm[turn][segIdx] + 1);
            }
            return nm;
          });
        }
      }
    } else {
      setLastHit("Miss");
    }

    setVisitDarts(nv);
    if (nv.length === 3) {
      setVisitDarts([]);
      
      // CARD CLASH: Evaluate all turn-end card effects
      if (isCardClash) {
        setActiveEffects(prev => {
          let updated = [...prev];
          const playerEffects = updated.filter(e => e.affectsPlayer === turn && e.status === "active");
          
          // 310: Perfect Round - bonus if all marks this turn
          const perfectRound = playerEffects.find(e => e.cardName === "Perfect Round");
          if (perfectRound && perfectRound.bonusIfAllMarksThisTurn) {
            // Count marks this turn on all numbers in visitDarts
            const marksThisTurn = visitDarts.reduce((sum, dart) => {
              const idx = CRICKET_NUMS.indexOf(dart.segment);
              return idx >= 0 ? sum + 1 : sum;
            }, 0);
            
            if (marksThisTurn >= 3 && visitDarts.length === 3) {
              setScores(prev => {
                const newScores: [number, number] = [...prev];
                newScores[turn] += perfectRound.bonusIfAllMarksThisTurn ?? 0;
                return newScores;
              });
            }
          }
          
          // 318: High Scorer - bonus if score >= 100
          const highScorer = playerEffects.find(e => e.cardName === "High Scorer");
          if (highScorer && highScorer.highScorerBonus) {
            if (scores[turn] >= (highScorer.highScorerThreshold || 100)) {
              setScores(prev => {
                const newScores: [number, number] = [...prev];
                newScores[turn] += highScorer.highScorerBonus ?? 0;
                cardDebugLog("CricketScorer", "[CARD_CLASH:HIGH_SCORER]", { player: turn, currentScore: scores[turn], bonus: highScorer.highScorerBonus });
                return newScores;
              });
            }
          }
          
          // 313: Comeback Marks - apply 1.5x multiplier bonus if behind in score
          const comebackMarks = playerEffects.find(e => e.cardName === "Comeback Marks");
          if (comebackMarks && comebackMarks.marksMultiplier === 1.5) {
            const opp: 0|1 = turn === 0 ? 1 : 0;
            if (scores[turn] < scores[opp]) {
              // Player is behind - apply 1.5x bonus to marks scored this turn
              // Each mark = +10 points, so 1.5x means +15 per mark (bonus of +5 per mark)
              let marksThisTurn = 0;
              const lastMarks = snapHistory.length > 0 ? snapHistory[snapHistory.length - 1].marks : [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];
              for (let i = 0; i < numCount; i++) {
                marksThisTurn += (marks[turn][i] - lastMarks[turn][i]);
              }
              if (marksThisTurn > 0) {
                const bonusPoints = Math.floor(marksThisTurn * 10 * 0.5); // 1.5x = base + 0.5x bonus
                setScores(prev => {
                  const newScores: [number, number] = [...prev];
                  newScores[turn] += bonusPoints;
                  return newScores;
                });
              }
            }
          }
          
          // 315: Mark Multiplier - bonus if 3+ marks gained this visit
          const markMult = playerEffects.find(e => e.cardName === "Mark Multiplier");
          if (markMult && markMult.markThresholdBonus) {
            const totalMarksThisVisit = visitMarkGains.reduce((sum, val) => sum + val, 0);
            if (totalMarksThisVisit >= (markMult.markThresholdBonusAt || 3)) {
              setScores(prev => {
                const newScores: [number, number] = [...prev];
                newScores[turn] += markMult.markThresholdBonus ?? 0;
                cardDebugLog("CricketScorer", "[CARD_CLASH:MARK_MULTIPLIER]", { player: turn, marksGained: totalMarksThisVisit, bonus: markMult.markThresholdBonus });
                return newScores;
              });
            }
          }
          
          // 320: Dominance - apply 1.3x mark multiplier (ceil) if closing more numbers
          const dominance = playerEffects.find(e => e.cardName === "Dominance");
          if (dominance && dominance.marksMultiplier === 1.3) {
            const opp: 0|1 = turn === 0 ? 1 : 0;
            const closedByPlayer = marks[turn].filter(m => m >= 3).length;
            const closedByOpp = marks[opp].filter(m => m >= 3).length;
            if (closedByPlayer > closedByOpp) {
              // Apply 1.3x bonus to marks scored this turn using ceil
              let marksThisTurn = 0;
              const lastMarks = snapHistory.length > 0 ? snapHistory[snapHistory.length - 1].marks : [[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]];
              for (let i = 0; i < numCount; i++) {
                marksThisTurn += (marks[turn][i] - lastMarks[turn][i]);
              }
              if (marksThisTurn > 0) {
                const bonusPoints = Math.ceil(marksThisTurn * 10 * 1.3) - (marksThisTurn * 10);  // ceil(marks × 1.3) - base
                setScores(prev => {
                  const newScores: [number, number] = [...prev];
                  newScores[turn] += bonusPoints;
                  return newScores;
                });
              }
            }
          }
          
          // 408: Pressure - penalty if number not closed
          const pressure = playerEffects.find(e => e.cardName === "Pressure");
          if (pressure && pressure.penaltyIfNotClosed) {
            // Check if any marked number wasn't closed this turn
            let hasUnclosedNumber = false;
            for (let i = 0; i < numCount; i++) {
              if (marks[turn][i] > 0 && marks[turn][i] < 3) {
                hasUnclosedNumber = true;
                break;
              }
            }
            if (hasUnclosedNumber) {
              setScores(prev => {
                const newScores: [number, number] = [...prev];
                newScores[turn] = Math.max(0, newScores[turn] - (pressure.penaltyIfNotClosed ?? 0));
                return newScores;
              });
            }
          }
          
          // 417: Mark Drain - remove 1 mark if opponent ahead
          const markDrain = playerEffects.find(e => e.cardName === "Mark Drain" && e.markDrainIfAhead);
          if (markDrain) {
            const opp: 0|1 = turn === 0 ? 1 : 0;
            if (scores[opp] > scores[turn]) {
              // Remove 1 mark from highest marked unopened number
              let maxIdx = -1, maxMarks = 0;
              for (let i = 0; i < numCount; i++) {
                if (marks[turn][i] > 0 && marks[turn][i] < 3 && marks[turn][i] > maxMarks) {
                  maxIdx = i;
                  maxMarks = marks[turn][i];
                }
              }
              if (maxIdx >= 0) {
                setMarks(prev => {
                  const nm: typeof marks = [[ ...prev[0] ] as any, [ ...prev[1] ] as any];
                  nm[turn][maxIdx] = Math.max(0, nm[turn][maxIdx] - 1);
                  return nm;
                });
              }
            }
          }
          
          // 418: Streak Breaker - halve marks on 2+ streak
          const streakBreaker = playerEffects.find(e => e.cardName === "Streak Breaker" && e.streakBreakerHalves);
          if (streakBreaker) {
            setMarks(prev => {
              const nm: typeof marks = [[ ...prev[0] ] as any, [ ...prev[1] ] as any];
              let broke = false;
              for (let i = 0; i < numCount; i++) {
                if (nm[turn][i] >= 2) {
                  nm[turn][i] = 1;
                  broke = true;
                }
              }
              return nm;
            });
          }
          
          return updated;
        });
      } else {
        // Non-Card-Clash: just expire effects normally
        if (isCardClash) setActiveEffects(prev => ccExpireOnTurnEnd(prev, turn));
      }
      
      // CARD CLASH: Store this visit's mark gains for opponent's Momentum Killer check next turn
      if (isCardClash) {
        setLastVisitMarkGains(prev => {
          const next = [prev[0].slice(), prev[1].slice()] as [number[], number[]];
          next[turn] = visitMarkGains.slice();
          cardDebugLog("CricketScorer", "[CARD_CLASH:VISIT_END]", { player: turn, marksGained: visitMarkGains.slice() });
          return next;
        });
        
        // Reset visit tracking state for next player
        setVisitMarkGains([0,0,0,0,0,0,0]);
        setCricketVisitScore(0);
        setCricketVisitMarks(0);
        setCricketClosedThisVisit(false);
      }
      
      // Increment turn counter for Early Closer tracking
      setTurnCounter(tc => tc + 1);
      setTurn(t => soloMode ? 0 : (t===0?1:0));
      setLastHit("");
    }

    // Check win after state settles
    safeTimeout(() => {
      setMarks(m => {
        setScores(sc => {
          const w = checkWin(m, sc);
          if (w !== null) safeTimeout(() => {
            onPracticeStats?.({ sessionData: { mode: "cricket" } });
            handleLegWin(w);
          }, 300);
          return sc;
        });
        return m;
      });
    }, 50);
  }, [visitDarts, turn, marks, scores, cutThroat, includesBull, numCount, onWin, isCardClash, activeEffects, handleLegWin, isChaosLabMode, activeBoardMarks, soloMode]);

  const handleMiss = () => handleDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" });
  const handleUndo = () => {
    if (snapHistory.length === 0) return;
    const snap = snapHistory[snapHistory.length - 1];
    const prevTurn = turn;
    setMarks(snap.marks);
    setScores(snap.scores);
    setTurn(snap.turn);
    setVisitDarts(snap.visitDarts);
    setLastHit("");
    setSnapHistory(prev => prev.slice(0, -1));
    
    // CRITICAL FIX: When undoing to a different turn, clear activeEffects for the previous player
    if (isCardClash && snap.turn !== prevTurn) {
      setActiveEffects(prev => 
        prev.filter(e => e.affectsPlayer !== prevTurn || e.status === "expired")
      );
    }
  };

  const handleDartRefCri = useRef(handleDart);
  useEffect(() => { handleDartRefCri.current = handleDart; });
  const isBotTurnCri = !!botConfig && turn === 1;
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const [d1, d2, d3] = botCricketVisit([...marks[1]], botConfig);
    const t1 = safeTimeout(() => handleDartRefCri.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefCri.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefCri.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Activate deferred-next-turn effects when it becomes the player's turn
  // Also apply penalty blocking if player has blockOpponentPenalties active
  useEffect(() => {
    if (isCardClash) {
      setActiveEffects(prev => {
        let updated = ccActivateDeferredNextTurnEffects(prev, turn);
        updated = ccApplyPenaltyBlockingIfNeeded(updated, turn);
        return updated;
      });
    }
  }, [turn, isCardClash]);

  // Activate deferred-next-leg effects when a new leg starts
  const prevLegWinsRef = useRef(legWins);
  useEffect(() => {
    if (isCardClash && legWins !== prevLegWinsRef.current) {
      // A leg has ended and a new one started
      setActiveEffects(prev => {
        let updated = prev;
        updated = ccActivateDeferredNextLegEffects(updated, 0);
        updated = ccActivateDeferredNextLegEffects(updated, 1);
        return updated;
      });
      prevLegWinsRef.current = legWins;
    }
  }, [legWins, isCardClash]);

  return (
    <>
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
            {cutThroat ? "Cut-Throat Cricket" : "Cricket"}
          </h2>
          {cutThroat && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Lowest score wins · Hitting closed numbers gives OPPONENT points</p>}
        </div>
      {(setsToWin > 0 || (legs && legs > 1)) && (
        <div className="flex items-center justify-center gap-6 text-sm" style={{ fontFamily: "Oswald, sans-serif" }}>
          {setsToWin > 0 ? (
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>SETS</div>
                <div className="flex items-center gap-6">
                  {[0,1].map(i => (
                    <div key={i} className="text-center">
                      <div style={{ color: P_COLOR(i), fontSize: "0.65rem" }}>{names[i].split(" ")[0]}</div>
                      <div style={{ color: "#ffd24a", fontSize: "1.4rem", fontWeight: 900 }}>{setWins[i]}</div>
                      <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.6rem" }}>/{setsNeeded}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-center">
                <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.5rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>LEGS</div>
                <div className="flex items-center gap-6">
                  {[0,1].map(i => (
                    <div key={i} className="text-center">
                      <div style={{ color: P_COLOR(i), fontSize: "0.65rem" }}>{names[i].split(" ")[0]}</div>
                      <div style={{ color: "rgba(255,255,255,0.55)", fontSize: "1.1rem", fontWeight: 900 }}>
                        {legWins[i]}<span style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.65rem" }}>/{legsNeeded}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            [0,1].map(i => (
              <div key={i} className="flex items-center gap-1.5">
                <span style={{ color: P_COLOR(i) }}>{names[i]}</span>
                <span style={{ color: "#ffd24a", fontSize: "1.2rem", fontWeight: 900 }}>{legWins[i]}</span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.7rem" }}>/{legsNeeded}</span>
              </div>
            ))
          )}
        </div>
      )}
      {/* Scores */}
      <div className="grid grid-cols-2 gap-3">
        {[0,1].map(i => (
          <PlayerCard key={i} name={names[i]} score={scores[i]} turn={i===0} active={turn===i} />
        ))}
      </div>
      {isCardClash && <CCEffectsHUD effects={activeEffects} names={[p1Name, p2Name]} lastActivation={lastActivation} />}
      {isCardClash && isChaosLabMode && <BoardMarksHUD marks={activeBoardMarks} names={[p1Name, p2Name]} engine="CRICKET" viewerIdx={turn as 0 | 1} />}
      {isCardClash && isChaosLabMode && <ChaosLabActivityLog entries={chaosLabActivityLogRef.current} names={[p1Name, p2Name]} />}
      {/* Cricket scorecard */}
      <SectionCard>
        <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "0.15rem" }}>
          {/* Header */}
          <div className="text-center text-xs font-bold pb-1" style={{ color: P_COLOR(0), fontFamily: "Oswald, sans-serif" }}>{p1Name.toUpperCase()}</div>
          <div className="text-center text-xs font-bold pb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>NUM</div>
          <div className="text-center text-xs font-bold pb-1" style={{ color: P_COLOR(1), fontFamily: "Oswald, sans-serif" }}>{p2Name.toUpperCase()}</div>

          {CRICKET_NUMS.slice(0, numCount).map((num, idx) => (
            <div key={num} style={{ display: "contents" }}>
              <div className="text-center py-2 text-lg font-bold" style={{
                fontFamily: "Oswald, sans-serif",
                color: marks[0][idx] >= 3 ? P_COLOR(0) : "rgba(255,255,255,0.7)",
              }}>
                {markSymbol(marks[0][idx])}
              </div>
              <div className="text-center py-2 text-sm font-bold" style={{
                fontFamily: "Oswald, sans-serif",
                color: "rgba(255,255,255,0.4)",
                borderLeft: "1px solid rgba(255,255,255,0.06)",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                textDecoration: marks[0][idx] >= 3 && marks[1][idx] >= 3 ? "line-through" : undefined,
              }}>
                {CRICKET_LABELS[idx]}
              </div>
              <div className="text-center py-2 text-lg font-bold" style={{
                fontFamily: "Oswald, sans-serif",
                color: marks[1][idx] >= 3 ? P_COLOR(1) : "rgba(255,255,255,0.7)",
              }}>
                {markSymbol(marks[1][idx])}
              </div>
            </div>
          ))}
        </div>
        {lastHit && (
          <div className="text-center text-xs mt-2 font-bold" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
            Hit: {lastHit}
          </div>
        )}
      </SectionCard>
      {isBotTurnCri ? <TurnBanner name={names[1]} turn={1} msg="— CPU THROWING…" /> : <TurnBanner name={names[turn]} turn={turn} msg={includesBull ? "— hit 15–20 or Bull" : "— hit 15–20 (no bull)"} />}
      <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard
          onDart={handleDart} onMiss={handleMiss} onUndo={handleUndo}
          activeSegments={CRICKET_NUMS.slice(0, numCount)} highlightSegments={CRICKET_NUMS.slice(0, numCount)}
          markedSegments={isCardClash && isChaosLabMode ? boardMarksToSegments(activeBoardMarks, "CRICKET") : undefined}
          disabled={isBotTurnCri}
        />
        <AbandonBtn onAbandon={() => { if (isCardClash) uploadMatchLog(matchLoggerRef.current, { gameMode: "CRICKET", isChaosMode, isChaosLabMode }); onAbandon(); }} />
        {isCardClash && <DownloadMatchLogBtn logger={matchLoggerRef.current} />}
      </div>}
    />
    <CardActivationOverlay 
      equippedCards={(turn === 0 ? p1Cards : p2Cards).map(c => ({
        ...c,
        id: c.id || 0,
        isActive: cardsUsed.some((used: any) => used.id === c.id),
      }))}
      isVisible={isCardClash && (turn === 0 ? p1Cards : p2Cards).length > 0}
      selectedCard={selectedCard}
      onCardActivate={handleCardActivation}
      onClose={() => setSelectedCard(null)}
    />
    {isCardClash && (isChaosMode || isChaosLabMode) && chaosOptions && !(turn === 1 && botConfig) && (
      <ChaosCardReveal
        options={chaosOptions}
        playerLabel={names[turn]}
        onResolve={handleChaosCardActivation}
      />
    )}
    </>
  );
}

// ── Killer Scorer ──────────────────────────────────────────────────────────────
export function KillerScorer({ p1Name, p2Name, lives = 3, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; lives?: number; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const [phase, setPhase]           = useState<"assign"|"play">("assign");
  const [assigning, setAssigning]   = useState<0|1>(0);
  const [killerNums, setKillerNums] = useState<[number|null, number|null]>([null, null]);
  const [isKiller, setIsKiller]     = useState<[boolean, boolean]>([false, false]);
  const [playerLives, setLives]     = useState<[number, number]>([lives, lives]);
  const [turn, setTurn]             = useState<0|1>(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [msg, setMsg]               = useState("");
  const [snapHistory, setSnapHistory] = useState<{killerNums: [number|null,number|null], isKiller: [boolean,boolean], playerLives: [number,number], turn: 0|1, visitDarts: Dart[]}[]>([]);
  const names = [p1Name, p2Name];

  // Bot auto-picks a number during assign phase
  useEffect(() => {
    if (!botConfig || assigning !== 1 || killerNums[1] !== null) return;
    const available = Array.from({length:20},(_,i)=>i+1).filter(n => n !== killerNums[0]);
    const pick = available[Math.floor(Math.random() * available.length)];
    const t = safeTimeout(() => {
      setKillerNums(prev => [prev[0], pick]);
      safeTimeout(() => setPhase("play"), 400);
    }, 800);
    return () => clearTimeout(t);
  }, [assigning, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignNumber = (n: number) => {
    if (killerNums[0] === n || killerNums[1] === n) return;
    setKillerNums(prev => { const k: [number|null,number|null] = [...prev] as any; k[assigning] = n; return k; });
    if (assigning === 0) setAssigning(1);
    else setPhase("play");
  };

  const handleDart = useCallback((dart: Dart) => {
    if (visitDarts.length >= 3) return;
    // Snapshot state before this dart — enables per-dart + cross-visit undo
    setSnapHistory(prev => [...prev, {
      killerNums: [...killerNums] as [number|null,number|null],
      isKiller: [...isKiller] as [boolean,boolean],
      playerLives: [...playerLives] as [number,number],
      turn,
      visitDarts: [...visitDarts],
    }]);
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);

    const myNum = killerNums[turn];
    const oppNum = killerNums[turn === 0 ? 1 : 0];
    const opp: 0|1 = turn === 0 ? 1 : 0;
    const isDouble = dart.multiplier === 2 && dart.segment === myNum;
    const hitsOppDouble = dart.multiplier === 2 && dart.segment === oppNum;

    if (!isKiller[turn] && isDouble) {
      setIsKiller(prev => { const n=[...prev] as [boolean,boolean]; n[turn]=true; return n; });
      setMsg(`${names[turn]} is now a KILLER!`);
      safeTimeout(() => setMsg(""), 2000);
    } else if (isKiller[turn] && hitsOppDouble) {
      setLives(prev => {
        const n = [...prev] as [number,number];
        n[opp]--;
        if (n[opp] <= 0) {
          safeTimeout(() => { onPracticeStats?.({ sessionData: { mode:"killer" } }); onWin(turn, `${names[opp]} eliminated!`); }, 300);
        }
        return n;
      });
      setMsg(`${names[opp]} loses a life!`);
      safeTimeout(() => setMsg(""), 2000);
    }

    if (nv.length === 3) { setVisitDarts([]); setTurn(t => t===0?1:0); }
  }, [visitDarts, turn, killerNums, isKiller, playerLives, names, onWin]);

  const handleMiss = () => handleDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" });
  const handleUndo = () => {
    if (snapHistory.length === 0) return;
    const snap = snapHistory[snapHistory.length - 1];
    setKillerNums(snap.killerNums);
    setIsKiller(snap.isKiller);
    setLives(snap.playerLives);
    setTurn(snap.turn);
    setVisitDarts(snap.visitDarts);
    setMsg("");
    setSnapHistory(prev => prev.slice(0, -1));
  };

  const handleDartRefKill = useRef(handleDart);
  useEffect(() => { handleDartRefKill.current = handleDart; });
  const isBotTurnKill = !!botConfig && turn === 1 && phase === "play";
  useEffect(() => {
    if (!botConfig || turn !== 1 || phase !== "play") return;
    const myNum = killerNums[1] ?? 0;
    const oppNum = killerNums[0] ?? 0;
    const [d1, d2, d3] = botKillerVisit(myNum, oppNum, isKiller[1], botConfig);
    const t1 = safeTimeout(() => handleDartRefKill.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefKill.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefKill.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === "assign") {
    return (
      <div style={{ maxWidth:"512px", margin:"0 auto", padding:"1rem 0.5rem" }}>
        <div className="pdc-divider" />
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily:"Oswald,sans-serif" }}>Killer — Pick Numbers</h2>
          <p className="text-sm mt-1" style={{ color:"rgba(255,255,255,0.4)" }}>
            <span style={{ color:P_COLOR(assigning) }}>{names[assigning]}</span>
            {assigning === 1 && botConfig ? " — CPU choosing…" : " — tap your number (1–20)"}
          </p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"0.5rem" }}>
          {Array.from({length:20},(_,i)=>i+1).map(n => {
            const taken = killerNums.includes(n);
            const disabled = taken || (assigning === 1 && !!botConfig);
            return (
              <button key={n} onClick={() => !disabled && assignNumber(n)}
                style={{
                  padding:"1rem 0", borderRadius:"0.5rem", fontFamily:"Oswald,sans-serif",
                  fontWeight:700, fontSize:"1.1rem", cursor:disabled?"not-allowed":"pointer",
                  background: killerNums[0]===n?`${P_COLOR(0)}33`:killerNums[1]===n?`${P_COLOR(1)}33`:"rgba(255,255,255,0.05)",
                  border: killerNums[0]===n?`1.5px solid ${P_COLOR(0)}`:killerNums[1]===n?`1.5px solid ${P_COLOR(1)}`:"1px solid rgba(255,255,255,0.1)",
                  color: taken?(killerNums[0]===n?P_COLOR(0):P_COLOR(1)):"rgba(255,255,255,0.8)",
                }}>D{n}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {[0,1].map(i=>(
            <div key={i} className="pdc-card p-3 text-center" style={{ borderColor:killerNums[i]!==null?P_COLOR(i):"rgba(255,255,255,0.06)" }}>
              <div className="text-xs" style={{ color:P_COLOR(i), fontFamily:"Oswald,sans-serif" }}>{names[i]}</div>
              <div className="text-xl font-bold" style={{ fontFamily:"Oswald,sans-serif", color:"#fff" }}>{killerNums[i]!==null?`D${killerNums[i]}`:"—"}</div>
            </div>
          ))}
        </div>
        <div className="mt-4"><AbandonBtn onAbandon={onAbandon} /></div>
      </div>
    );
  }

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <h2 className="text-2xl font-bold uppercase text-center" style={{ fontFamily:"Oswald,sans-serif" }}>Killer</h2>
        <div className="grid grid-cols-2 gap-3">
          {[0,1].map(i=>(
            <div key={i} className="pdc-card p-4 text-center" style={{ borderColor:turn===i?P_COLOR(i):"rgba(255,255,255,0.06)" }}>
              <div className="text-xs font-bold uppercase" style={{ color:P_COLOR(i), fontFamily:"Oswald,sans-serif" }}>{names[i]}</div>
              <div className="text-sm mt-1" style={{ color:"rgba(255,255,255,0.5)", fontFamily:"Oswald,sans-serif" }}>D{killerNums[i]}</div>
              <div className="text-lg font-bold" style={{ fontFamily:"Oswald,sans-serif", color:isKiller[i]?"#ffd24a":"rgba(255,255,255,0.3)" }}>
                {isKiller[i]?"☠ KILLER":"○ Not yet"}
              </div>
              <div className="flex justify-center gap-1 mt-2">
                {Array.from({length:lives}).map((_,li)=>(
                  <span key={li} style={{ fontSize:"1.1rem", opacity:li<playerLives[i]?1:0.15 }}>❤</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {msg&&<div className="text-center font-bold text-sm" style={{ color:"#ffd24a", fontFamily:"Oswald,sans-serif" }}>{msg}</div>}
        {isBotTurnKill
          ?<TurnBanner name={names[1]} turn={1} msg="— CPU THROWING…" />
          :<TurnBanner name={names[turn]} turn={turn}
            msg={!isKiller[turn]?`— hit D${killerNums[turn]} to become Killer`:`— hit D${killerNums[turn===0?1:0]} to take a life`} />}
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={handleMiss} onUndo={handleUndo}
          highlightSegments={killerNums.filter((n):n is number=>n!==null)}
          disabled={isBotTurnKill} />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Sequence Scorer (Around the World, Round the Clock, Shanghai, etc.) ────────
export function SequenceScorer({ p1Name, p2Name, config, gameKey, botConfig, onWin, onAbandon, onPracticeStats, onTurnChanged }: {
  p1Name: string; p2Name: string; config: any; gameKey: string; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
  onTurnChanged?: (t: 0|1) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const names = [p1Name, p2Name];

  // Build the target sequence
  const buildSequence = () => {
    if (gameKey === "doubles_challenge") {
      return Array.from({length:20},(_,i)=>({seg:i+1,mult:2,label:`D${i+1}`})).concat([{seg:25,mult:2,label:"DB"}]);
    }
    if (gameKey === "around_world_trebles" || gameKey === "around_the_world_trebles") {
      return Array.from({length:20},(_,i)=>({seg:i+1,mult:3,label:`T${i+1}`}));
    }
    if (gameKey === "round_the_board") {
      const fwd = Array.from({length:20},(_,i)=>({seg:i+1,mult:1,label:`${i+1}`}));
      const bck = Array.from({length:19},(_,i)=>({seg:19-i,mult:1,label:`${19-i}`}));
      return [...fwd, ...bck];
    }
    if (gameKey === "around_the_world" || gameKey === "atw") {
      return [...Array.from({length:20},(_,i)=>({seg:i+1,mult:1,label:`${i+1}`})), {seg:25,mult:1,label:"Bull"}];
    }
    if (gameKey === "round_the_clock" || gameKey === "round_the_clock_darts") {
      return Array.from({length:20},(_,i)=>({seg:i+1,mult:1,label:`${i+1}`}));
    }
    // Bermuda triangle
    if (gameKey === "bermuda_triangle") {
      return [12,13,14,"DB",15,16,17,"Bull",18,19,20,"DB"].map((v,i) => {
        if (v === "DB") return {seg:25,mult:2,label:"DB"};
        if (v === "Bull") return {seg:25,mult:1,label:"Bull"};
        return {seg:v as number,mult:1,label:`${v}`};
      });
    }
    if (gameKey === "chase_the_dragon") {
      const trebles = Array.from({length:11},(_,i)=>({seg:i+10,mult:3 as const,label:`T${i+10}`}));
      const doubles = Array.from({length:11},(_,i)=>({seg:20-i,mult:2 as const,label:`D${20-i}`}));
      return [...trebles, ...doubles, {seg:25,mult:2 as const,label:"DB"}];
    }
    if (gameKey === "around_clock_quick") {
      return Array.from({length:20},(_,i)=>({seg:i+1,mult:1 as const,label:`${i+1}`}));
    }
    if (gameKey === "round_clock_doubles") {
      return Array.from({length:20},(_,i)=>({seg:i+1,mult:2 as const,label:`D${i+1}`}));
    }
    // Shanghai (7 rounds scoring)
    return [];
  };

  const isShanghai = gameKey === "shanghai" || config?.type === "shanghai";
  const sequence = buildSequence();

  // Shanghai state
  const [shanghaiRound, setShanghaiRound]   = useState(1);
  const [shanghaiTurn, setShanghaiTurn]     = useState<0|1>(0);
  const [shanghaiScores, setShanghaiScores] = useState<[number,number]>([0,0]);
  const [shanghaiDarts, setShanghaiDarts]   = useState<Dart[]>([]);
  const [shanghaiHits, setShanghaiHits]     = useState<{s:boolean;d:boolean;t:boolean}>({s:false,d:false,t:false});

  // Sequence state
  const [positions, setPositions]   = useState<[number,number]>([0,0]);
  const [turn, setTurn]             = useState<0|1>(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);

  const maxRounds = config?.rounds ?? 7;

  if (isShanghai) {
    const handleShDart = (dart: Dart) => {
      if (shanghaiDarts.length >= 3) return;
      const nd = [...shanghaiDarts, dart];
      setShanghaiDarts(nd);
      const n = shanghaiRound;
      if (dart.segment === n) {
        const pts = dart.value; // n×mult
        setShanghaiScores(prev => { const s: [number,number] = [...prev] as [number,number]; s[shanghaiTurn] += pts; return s; });
        setShanghaiHits(prev => ({
          s: prev.s || dart.multiplier === 1,
          d: prev.d || dart.multiplier === 2,
          t: prev.t || dart.multiplier === 3,
        }));
        // Check shanghai (all 3 in one visit)
        const nh = { s: shanghaiHits.s || dart.multiplier===1, d: shanghaiHits.d || dart.multiplier===2, t: shanghaiHits.t || dart.multiplier===3 };
        if (nh.s && nh.d && nh.t) {
          safeTimeout(() => onWin(shanghaiTurn, `SHANGHAI on ${n}!`), 300);
          return;
        }
      }
      if (nd.length === 3) {
        setShanghaiDarts([]);
        setShanghaiHits({s:false,d:false,t:false});
        if (shanghaiTurn === 1) {
          if (shanghaiRound >= maxRounds) {
            safeTimeout(() => {
              const [s0,s1] = shanghaiScores;
              onWin(s0 >= s1 ? 0 : 1, `${s0} vs ${s1} after ${maxRounds} rounds`);
            }, 300);
          } else {
            setShanghaiRound(r => r+1);
            setShanghaiTurn(0);
          }
        } else {
          setShanghaiTurn(1);
        }
      }
    };
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Shanghai</h2>
          <p className="text-sm" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>Round {shanghaiRound} of {maxRounds} — Target: {shanghaiRound}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0,1].map(i => <PlayerCard key={i} name={names[i]} score={shanghaiScores[i]} turn={i===0} active={shanghaiTurn===i} />)}
        </div>
        <div className="pdc-card p-3 text-center" style={{ borderColor: "rgba(255,210,74,0.2)" }}>
          <p className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>This visit</p>
          <div className="flex justify-center gap-4 text-sm" style={{ fontFamily: "Oswald, sans-serif" }}>
            {[["S",shanghaiHits.s],["D",shanghaiHits.d],["T",shanghaiHits.t]].map(([l,h]) => (
              <span key={l as string} style={{ color: h ? "#22c55e" : "rgba(255,255,255,0.2)" }}>{l} {h ? "✓" : "○"}</span>
            ))}
            <span style={{ color: shanghaiHits.s&&shanghaiHits.d&&shanghaiHits.t ? "#ffd24a" : "rgba(255,255,255,0.2)" }}>SHANGHAI</span>
          </div>
        </div>
        <TurnBanner name={names[shanghaiTurn]} turn={shanghaiTurn} msg={`— aim at ${shanghaiRound}`} />
        <VisitDarts darts={shanghaiDarts} />
        <DartInputBoard onDart={handleShDart} onMiss={() => handleShDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={() => shanghaiDarts.length > 0 && setShanghaiDarts(p=>p.slice(0,-1))}
          highlightSegments={[shanghaiRound]} />
        <AbandonBtn onAbandon={onAbandon} />
      </div>
    );
  }

  // Standard sequence (race)
  const handleDart = (dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const nv = [...visitDarts, dart];
    const target = sequence[positions[turn]];
    if (target && dart.segment === target.seg && dart.multiplier >= target.mult) {
      let pos = positions[turn] + 1;
      // Allow extra advances from treble/double on single-required targets
      if (target.mult === 1) pos += (dart.multiplier - 1); // T1 → skip 2 extra? No, each dart advances once. Let extra multiplier advance once.
      const newPos = Math.min(pos, sequence.length);
      setPositions(prev => { const n:[number,number]=[...prev] as [number,number]; n[turn]=newPos; return n; });
      if (newPos >= sequence.length) { safeTimeout(() => { onPracticeStats?.({ sessionData:{mode:"sequence"} }); onWin(turn, `Finished the sequence!`); }, 200); return; }
    }
    setVisitDarts(nv);
    if (nv.length === 3) { setVisitDarts([]); const nt: 0|1 = turn===0?1:0; setTurn(nt); onTurnChanged?.(nt); }
  };

  const curTarget = sequence[positions[turn]];
  const botSeqTarget = sequence[positions[1]];

  const handleDartRefSeq = useRef(handleDart);
  useEffect(() => { handleDartRefSeq.current = handleDart; });
  const isBotTurnSeq = !!botConfig && turn === 1;
  useEffect(() => {
    if (!botConfig || turn !== 1 || !botSeqTarget) return;
    const [d1, d2, d3] = botSequenceVisit(botSeqTarget.seg, (botSeqTarget.mult ?? 1) as 1|2|3, botConfig);
    const t1 = safeTimeout(() => handleDartRefSeq.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefSeq.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefSeq.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        {/* Progress bars */}
        <div className="grid grid-cols-2 gap-3">
          {[0,1].map(i => (
            <div key={i} className="pdc-card p-3 text-center" style={{ borderColor: turn===i ? P_COLOR(i) : "rgba(255,255,255,0.06)" }}>
            <div className="text-xs font-bold uppercase mb-1" style={{ color: P_COLOR(i), fontFamily: "Oswald, sans-serif" }}>{names[i]}</div>
            <div className="text-xl font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>
              {positions[i]}/{sequence.length}
            </div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
              Next: {sequence[positions[i]]?.label ?? "DONE"}
            </div>
            <div className="mt-2 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full transition-all" style={{ background: P_COLOR(i), width: `${(positions[i]/sequence.length)*100}%` }} />
            </div>
          </div>
        ))}
      </div>
      {isBotTurnSeq ? <TurnBanner name={names[1]} turn={1} msg="— CPU THROWING…" /> : <TurnBanner name={names[turn]} turn={turn} msg={curTarget ? `— aim at ${curTarget.label}` : ""} />}
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart}
          onMiss={() => handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={() => visitDarts.length > 0 && setVisitDarts(p=>p.slice(0,-1))}
          highlightSegments={curTarget ? [curTarget.seg] : []}
          disabled={isBotTurnSeq}
        />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Halve-It Scorer (+ Bob's 27, Bermuda Triangle) ─────────────────────────────
const HALVEIT_TARGETS = [20,16,"D",17,"Bull",18,19,"T"];
const HALVEIT_LABELS  = ["20","16","Any Double","17","Bull","18","19","Any Treble"];

export function HalveItScorer({ p1Name, p2Name, gameKey, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; gameKey: string; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const isBobs = gameKey === "bobs_27";
  const targets = isBobs
    ? Array.from({length:20},(_,i)=>i+1)  // doubles 1-20
    : HALVEIT_TARGETS;
  const targetLabels = isBobs
    ? targets.map(n=>`D${n}`)
    : HALVEIT_LABELS;

  const [round, setRound]           = useState(0);
  const [turnInRound, setTIR]       = useState<0|1>(0);
  const [scores, setScores]         = useState<[number,number]>(isBobs ? [27,27] : [0,0]);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [roundScore, setRoundScore] = useState(0);
  const [hit, setHit]               = useState(false);
  const [turn, setTurn]             = useState<0|1>(0);

  const names = [p1Name, p2Name];
  const curTarget = targets[round];

  const dartHitsTarget = (dart: Dart): boolean => {
    if (isBobs) {
      // Must hit exact double
      const n = targets[round] as number;
      return dart.segment === n && dart.multiplier === 2;
    }
    if (curTarget === "D") return dart.multiplier === 2;
    if (curTarget === "T") return dart.multiplier === 3;
    if (curTarget === "Bull") return dart.segment === 25;
    return dart.segment === curTarget;
  };

  const handleDart = (dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);
    if (dartHitsTarget(dart)) {
      setHit(true);
      setRoundScore(prev => prev + dart.value);
    }
    if (nv.length === 3) {
      // End of this player's visit for this round
      const hitTarget = hit || dartHitsTarget(dart);
      const rs = roundScore + (dartHitsTarget(dart) ? dart.value : 0);
      setScores(prev => {
        const ns: [number,number] = [...prev] as [number,number];
        if (hitTarget || rs > 0) ns[turn] += rs;
        else {
          if (isBobs) {
            // Miss: subtract double value
            ns[turn] -= (targets[round] as number) * 2;
          } else {
            // Miss: halve score
            ns[turn] = Math.floor(ns[turn] / 2);
          }
        }
        return ns;
      });
      setVisitDarts([]); setRoundScore(0); setHit(false);
      if (turnInRound === 1) {
        // Both players done this round
        if (round + 1 >= targets.length) {
          safeTimeout(() => {
            setScores(sc => {
              const w: 0|1 = sc[0] >= sc[1] ? 0 : 1;
              onPracticeStats?.({ sessionData: { mode:"halveit", p1Score:sc[0], p2Score:sc[1] } });
              onWin(w, `${sc[0]} vs ${sc[1]}`);
              return sc;
            });
          }, 300);
        } else {
          setRound(r => r+1); setTIR(0); setTurn(0);
        }
      } else {
        setTIR(1); setTurn(1);
      }
    }
  };

  const handleDartRefHalve = useRef(handleDart);
  useEffect(() => { handleDartRefHalve.current = handleDart; });
  const isBotTurnHalve = !!botConfig && turn === 1;
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const ct = targets[round];
    let tSeg = 20, tMult: 1|2|3 = 1;
    if (isBobs) { tSeg = ct as number; tMult = 2; }
    else if (ct === "D") { tSeg = 20; tMult = 2; }
    else if (ct === "T") { tSeg = 20; tMult = 3; }
    else if (ct === "Bull") { tSeg = 25; tMult = 1; }
    else { tSeg = ct as number; tMult = 1; }
    const [d1, d2, d3] = botHalveItVisit(tSeg, tMult, botConfig);
    const t1 = safeTimeout(() => handleDartRefHalve.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefHalve.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefHalve.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>{isBobs ? "Bob's 27" : "Halve-It"}</h2>
        <p className="text-sm" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
          Round {round+1}/{targets.length} — Target: {targetLabels[round]}
        </p>
        {!isBobs && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Miss a target = score halved</p>}
        {isBobs && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Hit double = +score · Miss = -value</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0,1].map(i => <PlayerCard key={i} name={names[i]} score={scores[i]} turn={i===0} active={turn===i} />)}
      </div>
      {/* Round targets progress */}
      <div className="flex gap-1 flex-wrap justify-center">
        {targets.map((t,i) => (
          <div key={i} style={{
            width:"2rem", height:"2rem", borderRadius:"50%", display:"flex",
            alignItems:"center", justifyContent:"center", fontSize:"0.6rem",
            fontFamily:"Oswald, sans-serif",
            background: i < round ? "rgba(34,197,94,0.2)" : i===round ? "rgba(255,210,74,0.2)" : "rgba(255,255,255,0.05)",
            border: i===round ? "1.5px solid #ffd24a" : i < round ? "1px solid rgba(34,197,94,0.4)" : "1px solid rgba(255,255,255,0.08)",
            color: i < round ? "#22c55e" : i===round ? "#ffd24a" : "rgba(255,255,255,0.3)",
          }}>
            {typeof t === "number" ? (isBobs ? `D${t}` : `${t}`) : t}
          </div>
        ))}
      </div>
      {isBotTurnHalve ? <TurnBanner name={names[1]} turn={1} msg="— CPU THROWING…" /> : <TurnBanner name={names[turn]} turn={turn} msg={`— hit ${targetLabels[round]}`} />}
      <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart}
          onMiss={() => handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={() => visitDarts.length > 0 && setVisitDarts(p=>p.slice(0,-1))}
          highlightSegments={typeof curTarget === "number" ? [curTarget] : curTarget==="Bull" ? [25] : undefined}
          disabled={isBotTurnHalve}
        />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Count Up Scorer ────────────────────────────────────────────────────────────
export function CountUpScorer({ p1Name, p2Name, config, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; config: { target?: number; rounds?: number; bullsOnly?: boolean; accumulate?: boolean }; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const target = config.target ?? 501;
  const maxRounds = config.rounds ?? 0; // 0 = race to target
  const bullsOnly = config.bullsOnly ?? false;   // Bull Rush: count bull hits only
  const accumulate = config.accumulate ?? false; // Accumulator: each visit must beat previous or score halves
  const [scores, setScores]         = useState<[number,number]>([0,0]);
  const [rounds, setRounds]         = useState<[number,number]>([0,0]);
  const [lastVisit, setLastVisit]   = useState<[number,number]>([0,0]);
  const [turn, setTurn]             = useState<0|1>(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [halvMsg, setHalvMsg]       = useState("");
  const names = [p1Name, p2Name];

  const handleDart = (dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);
    if (nv.length === 3) {
      // Bull Rush: count how many darts hit the bull (segment 25)
      const bullHits = nv.filter(d => d.segment === 25).length;
      // Standard: sum all dart values
      const cum = bullsOnly ? bullHits : nv.reduce((s,d) => s+d.value, 0);

      setScores(prev => {
        const ns: [number,number] = [...prev] as [number,number];
        if (accumulate) {
          if (cum > lastVisit[turn]) {
            ns[turn] += cum;
          } else {
            ns[turn] = Math.floor(ns[turn] / 2);
            setHalvMsg(`${names[turn]}: only ${cum} pts — HALVED to ${ns[turn]}!`);
            safeTimeout(() => setHalvMsg(""), 2200);
          }
        } else {
          ns[turn] += cum;
        }
        if (maxRounds === 0 && ns[turn] >= target) {
          const label = bullsOnly ? `${ns[turn]} bulls!` : `Reached ${target} pts!`;
          safeTimeout(() => { onPracticeStats?.({ sessionData:{mode:"countup"} }); onWin(turn, label); }, 300);
        }
        return ns;
      });
      setLastVisit(prev => { const n=[...prev] as [number,number]; n[turn]=cum; return n; });
      setRounds(prev => {
        const nr: [number,number] = [...prev] as [number,number];
        nr[turn]++;
        if (maxRounds > 0 && nr[0] >= maxRounds && nr[1] >= maxRounds) {
          safeTimeout(() => {
            setScores(sc => {
              onPracticeStats?.({ sessionData:{mode:"countup", p1Score:sc[0], p2Score:sc[1]} });
            onWin(sc[0] >= sc[1] ? 0 : 1, `${sc[0]} vs ${sc[1]}`);
              return sc;
            });
          }, 300);
        }
        return nr;
      });
      setVisitDarts([]);
      setTurn(t => t===0?1:0);
    }
  };

  const sub = (i: number) => {
    if (bullsOnly) return `${target - scores[i]} more bulls to go`;
    if (maxRounds > 0) return `Round ${rounds[i]}/${maxRounds}`;
    return `Target: ${target}`;
  };

  const handleDartRefCU = useRef(handleDart);
  useEffect(() => { handleDartRefCU.current = handleDart; });
  const isBotTurnCU = !!botConfig && turn === 1;
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const [d1, d2, d3] = botCountUpVisit(botConfig);
    const t1 = safeTimeout(() => handleDartRefCU.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefCU.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefCU.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily:"Oswald,sans-serif" }}>
            {bullsOnly ? `Bull Rush — First to ${target} Bulls`
              : accumulate ? "Accumulator"
              : maxRounds > 0 ? `High Score — ${maxRounds} Rounds`
              : `Count Up — Race to ${target}`}
          </h2>
          <p className="text-xs mt-1" style={{ color:"rgba(255,255,255,0.3)" }}>
            {bullsOnly ? "Only bull hits count · Inner (50) or outer (25) · First to 5 wins"
              : accumulate ? "Each visit must score MORE than previous or your total is HALVED"
              : "Score as many points as possible"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0,1].map(i => <PlayerCard key={i} name={names[i]} score={scores[i]} turn={i===0} active={turn===i} sub={sub(i)} />)}
        </div>
        {halvMsg && <div className="text-center font-bold text-sm" style={{ color:"#ff005c", fontFamily:"Oswald,sans-serif" }}>{halvMsg}</div>}
        {isBotTurnCU ? <TurnBanner name={names[1]} turn={1} msg="— CPU THROWING…" />
          : <TurnBanner name={names[turn]} turn={turn} msg={bullsOnly ? "— aim at Bull!" : "— score as many as you can"} />}
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart}
          onMiss={() => handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={() => visitDarts.length > 0 && setVisitDarts(p=>p.slice(0,-1))}
          highlightSegments={bullsOnly ? [25] : undefined}
          disabled={isBotTurnCU} />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Gotcha Scorer ──────────────────────────────────────────────────────────────
export function GotchaScorer({ p1Name, p2Name, target = 301, botConfig, onWin, onAbandon, onTurnChanged }: {
  p1Name: string; p2Name: string; target?: number; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onTurnChanged?: (t: 0|1) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const [scores, setScores]         = useState<[number,number]>([0,0]);
  const [turn, setTurn]             = useState<0|1>(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [msg, setMsg]               = useState("");
  const names = [p1Name, p2Name];
  const handleDartRefGotcha = useRef<(d: Dart) => void>(() => {});
  const isBotTurnGotcha = !!botConfig && turn === 1;

  const handleDart = (dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);
    if (nv.length === 3) {
      const cum = nv.reduce((s,d) => s+d.value, 0);
      setScores(prev => {
        const ns: [number,number] = [...prev] as [number,number];
        const opp: 0|1 = turn===0?1:0;
        const projected = ns[turn] + cum;
        if (projected > target) {
          // Bust — revert
          setMsg("BUST! Back to " + ns[turn]);
          safeTimeout(() => setMsg(""), 1500);
        } else if (projected === target) {
          safeTimeout(() => onWin(turn, `Reached exactly ${target}!`), 200);
          ns[turn] = projected;
        } else {
          ns[turn] = projected;
          if (ns[turn] === ns[opp]) {
            // GOTCHA — reset opponent!
            ns[opp] = 0;
            setMsg(`GOTCHA! ${names[opp]} reset to 0!`);
            safeTimeout(() => setMsg(""), 2000);
          }
        }
        return ns;
      });
      setVisitDarts([]);
      const nt: 0|1 = turn===0?1:0; setTurn(nt); onTurnChanged?.(nt);
    }
  };

  useEffect(() => { handleDartRefGotcha.current = handleDart; });
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const [d1, d2, d3] = botGotchaVisit(scores[1], target, scores[0], botConfig);
    const t1 = safeTimeout(() => handleDartRefGotcha.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefGotcha.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefGotcha.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="pdc-divider" />
      <div className="text-center">
        <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Gotcha!</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Race to exactly {target}. Match opponent's score = GOTCHA — they reset to 0!</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0,1].map(i => <PlayerCard key={i} name={names[i]} score={scores[i]} scoreSuffix={`/${target}`} turn={i===0} active={turn===i} />)}
      </div>
      {msg && <div className="text-center font-bold" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>{msg}</div>}
      <TurnBanner name={names[turn]} turn={turn} msg={isBotTurnGotcha ? "— CPU THROWING…" : undefined} />
      <VisitDarts darts={visitDarts} />
      <DartInputBoard onDart={handleDart}
        onMiss={() => handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
        onUndo={() => visitDarts.length > 0 && setVisitDarts(p=>p.slice(0,-1))}
        disabled={isBotTurnGotcha} />
      <AbandonBtn onAbandon={onAbandon} />
    </div>
  );
}

// ── Baseball Scorer ────────────────────────────────────────────────────────────
export function BaseballScorer({ p1Name, p2Name, innings = 9, botConfig, onWin, onAbandon, onTurnChanged }: {
  p1Name: string; p2Name: string; innings?: number; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onTurnChanged?: (t: 0|1) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const [inning, setInning]         = useState(1);
  const [half, setHalf]             = useState<0|1>(0); // 0=bottom(P1), 1=top(P2)
  const [runs, setRuns]             = useState<[number,number]>([0,0]);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const names = [p1Name, p2Name];
  const handleDartRefBaseball = useRef<(d: Dart) => void>(() => {});
  const isBotTurnBaseball = !!botConfig && half === 1;

  const handleDart = (dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);
    if (nv.length === 3) {
      const r = nv.reduce((s,d) => s + (d.segment===inning ? d.multiplier : 0), 0);
      setRuns(prev => { const n:[number,number]=[...prev] as [number,number]; n[half]+=r; return n; });
      setVisitDarts([]);
      if (half === 1) {
        if (inning >= innings) {
          safeTimeout(() => {
            setRuns(sc => { onWin(sc[0]>=sc[1]?0:1, `${sc[0]}–${sc[1]} runs`); return sc; });
          }, 300);
        } else { setInning(i=>i+1); setHalf(0); onTurnChanged?.(0); }
      } else { setHalf(1); onTurnChanged?.(1); }
    }
  };

  useEffect(() => { handleDartRefBaseball.current = handleDart; });
  useEffect(() => {
    if (!botConfig || half !== 1) return;
    const [d1, d2, d3] = botBaseballVisit(inning, botConfig);
    const t1 = safeTimeout(() => handleDartRefBaseball.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefBaseball.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefBaseball.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [half, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="pdc-divider" />
      <div className="text-center">
        <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Baseball</h2>
        <p style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>Inning {inning}/{innings} — Target: {inning}</p>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Single=1 run · Double=2 · Treble=3</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0,1].map(i => <PlayerCard key={i} name={names[i]} score={runs[i]} scoreSuffix=" runs" turn={i===0} active={half===i} />)}
      </div>
      <TurnBanner name={names[half]} turn={half} msg={isBotTurnBaseball ? "— CPU THROWING…" : `— aim at ${inning}`} />
      <VisitDarts darts={visitDarts} />
      <DartInputBoard onDart={handleDart}
        onMiss={() => handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
        onUndo={() => visitDarts.length > 0 && setVisitDarts(p=>p.slice(0,-1))}
        highlightSegments={[inning]} disabled={isBotTurnBaseball} />
      <AbandonBtn onAbandon={onAbandon} />
    </div>
  );
}

// ── Scram Scorer ───────────────────────────────────────────────────────────────
const SCRAM_NUMS = [20,19,18,17,16,15,25];

export function ScramScorer({ p1Name, p2Name, botConfig, onWin, onAbandon }: {
  p1Name: string; p2Name: string; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
}) {
  const safeTimeout = useSafeTimeout();
  const [phase, setPhase]             = useState<1|2>(1);
  const [stopper, setStopper]         = useState<0|1>(0);   // who is stopper this phase
  const [closed, setClosed]           = useState<boolean[]>([false,false,false,false,false,false,false]);
  const [phaseScores, setPhaseScores] = useState<[number,number]>([0,0]); // scorer's total each phase
  const [turn, setTurn]               = useState<0|1>(0);
  const [visitDarts, setVisitDarts]   = useState<Dart[]>([]);
  const names = [p1Name, p2Name];
  const scorer: 0|1 = stopper === 0 ? 1 : 0;
  const handleDartRefScram = useRef<(d: Dart) => void>(() => {});
  const isBotTurnScram = !!botConfig && turn === 1;

  const handleDart = (dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);
    const numIdx = SCRAM_NUMS.indexOf(dart.segment);
    if (numIdx >= 0) {
      if (turn === stopper && !closed[numIdx]) {
        setClosed(prev => { const n=[...prev]; n[numIdx]=true; return n; });
      } else if (turn === scorer && !closed[numIdx]) {
        setPhaseScores(prev => {
          const n:[number,number]=[...prev] as [number,number];
          n[scorer] += dart.value;
          return n;
        });
      }
    }
    if (nv.length === 3) {
      setVisitDarts([]);
      // Check if all closed (stopper wins phase)
      setClosed(cl => {
        if (cl.every(Boolean)) {
          if (phase === 1) {
            // Start phase 2
            safeTimeout(() => {
              setPhase(2);
              setStopper(scorer); // swap roles
              setClosed([false,false,false,false,false,false,false]);
              setTurn(0);
            }, 800);
          } else {
            // Both phases done — compare scorer scores
            safeTimeout(() => {
              setPhaseScores(ps => {
                onWin(ps[0] >= ps[1] ? 0 : 1, `Phase scores: ${ps[0]} vs ${ps[1]}`);
                return ps;
              });
            }, 300);
          }
        }
        return cl;
      });
      setTurn(t => t===0?1:0);
    }
  };

  useEffect(() => { handleDartRefScram.current = handleDart; });
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const [d1, d2, d3] = botScramVisit(stopper === 1, closed, botConfig);
    const t1 = safeTimeout(() => handleDartRefScram.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefScram.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefScram.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="pdc-divider" />
      <div className="text-center">
        <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Scram — Phase {phase}/2</h2>
        <div className="grid grid-cols-2 gap-3 mt-2 text-xs" style={{ fontFamily: "Oswald, sans-serif" }}>
          <div style={{ color: P_COLOR(stopper) }}>{names[stopper]}: 🔒 Stopper</div>
          <div style={{ color: P_COLOR(scorer) }}>{names[scorer]}: 💰 Scorer — {phaseScores[scorer]}pts</div>
        </div>
      </div>
      {/* Number grid */}
      <SectionCard>
        <div className="grid grid-cols-7 gap-1">
          {SCRAM_NUMS.map((n,i) => (
            <div key={n} className="text-center py-2" style={{
              fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", fontWeight: 700,
              borderRadius: "0.4rem",
              background: closed[i] ? "rgba(255,0,92,0.15)" : "rgba(34,197,94,0.08)",
              border: closed[i] ? "1px solid rgba(255,0,92,0.4)" : "1px solid rgba(34,197,94,0.3)",
              color: closed[i] ? "#ff005c" : "#22c55e",
              textDecoration: closed[i] ? "line-through" : undefined,
            }}>
              {n===25?"Bull":n}
            </div>
          ))}
        </div>
        <div className="text-xs text-center mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
          {closed.filter(Boolean).length}/7 closed
        </div>
      </SectionCard>
      <TurnBanner name={names[turn]} turn={turn}
        msg={isBotTurnScram ? "— CPU THROWING…" : turn===stopper ? "— close numbers!" : "— score on open numbers!"} />
      <VisitDarts darts={visitDarts} />
      <DartInputBoard onDart={handleDart}
        onMiss={() => handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
        onUndo={() => visitDarts.length > 0 && setVisitDarts(p=>p.slice(0,-1))}
        activeSegments={SCRAM_NUMS} highlightSegments={SCRAM_NUMS.filter((_,i)=>!closed[i])} disabled={isBotTurnScram} />
      <AbandonBtn onAbandon={onAbandon} />
    </div>
  );
}

// ── Football Darts Scorer ──────────────────────────────────────────────────────
export function FootballScorer({ p1Name, p2Name, goalsToWin = 5, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; goalsToWin?: number;
  botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  // null = kickoff (uncontested — both need to hit bull to win possession)
  const [goals, setGoals]           = useState<[number,number]>([0,0]);
  const [possession, setPossession] = useState<0|1|null>(null);
  const [turn, setTurn]             = useState<0|1>(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [msg, setMsg]               = useState("KICKOFF — hit the bull to win possession!");
  const names = [p1Name, p2Name];

  // Per-dart processing: possession can change mid-visit so we handle each dart immediately
  const handleDart = useCallback((dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const nd = [...visitDarts, dart];
    setVisitDarts(nd);

    if (possession === turn) {
      // Has possession: any double (1-20) = goal
      if (dart.multiplier === 2 && dart.segment !== 25) {
        setGoals(prev => {
          const ng: [number,number] = [...prev] as [number,number];
          ng[turn]++;
          if (ng[turn] >= goalsToWin) {
            safeTimeout(() => {
              onPracticeStats?.({ sessionData: { mode:"football", goals: ng } });
              onWin(turn, `${ng[turn]} goals!`);
            }, 200);
          }
          return ng;
        });
        setMsg(`GOAL! ${names[turn]} scores! ⚽ ${goals[turn]+1}/${goalsToWin}`);
        safeTimeout(() => setMsg(""), 2000);
      }
    } else {
      // No possession (kickoff) or opponent has possession: need bull to steal/win it
      if (dart.segment === 25) {
        setPossession(turn);
        setMsg(`${names[turn]} wins possession! 🏈 Now aim for doubles to score!`);
        safeTimeout(() => setMsg(""), 2200);
      }
    }

    if (nd.length === 3) {
      setVisitDarts([]);
      setTurn(t => t === 0 ? 1 : 0);
    }
  }, [visitDarts, turn, possession, goals, goalsToWin, names, onWin, onPracticeStats]);

  const handleMiss = () => handleDart({ segment:0, multiplier:1, value:0, label:"Miss" });
  const handleUndo = () => visitDarts.length > 0 && setVisitDarts(p => p.slice(0,-1));

  const handleDartRefFB = useRef(handleDart);
  useEffect(() => { handleDartRefFB.current = handleDart; });
  const isBotTurnFB = !!botConfig && turn === 1;
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const hasBall = possession === 1;
    const [d1, d2, d3] = botFootballVisit(hasBall, botConfig);
    const t1 = safeTimeout(() => handleDartRefFB.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefFB.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefFB.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const possessionLabel = (i: number) => {
    if (possession === i) return "⚽ IN POSSESSION";
    if (possession === null) return "🏈 Kickoff";
    return "Aim for Bull 🎯";
  };

  const turnMsg = () => {
    if (possession === turn) return "— hit any DOUBLE to score!";
    if (possession === null) return "— hit 25 or Bull to win possession";
    return "— hit Bull to steal possession from opponent";
  };

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily:"Oswald,sans-serif" }}>Football Darts</h2>
          <p className="text-xs" style={{ color:"rgba(255,255,255,0.3)" }}>
            Hit Bull to win/steal possession · Any double = goal when in possession · Possession is kept until opponent hits Bull · First to {goalsToWin} wins
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0,1].map(i => (
            <PlayerCard key={i} name={names[i]} score={goals[i]} scoreSuffix=" ⚽" turn={i===0} active={turn===i}
              sub={possessionLabel(i)} />
          ))}
        </div>
        {msg && <div className="text-center font-bold text-sm" style={{ color:"#ffd24a", fontFamily:"Oswald,sans-serif" }}>{msg}</div>}
        {isBotTurnFB
          ? <TurnBanner name={names[1]} turn={1} msg="— CPU THROWING…" />
          : <TurnBanner name={names[turn]} turn={turn} msg={turnMsg()} />}
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={handleMiss} onUndo={handleUndo} disabled={isBotTurnFB}
          highlightSegments={possession === turn ? undefined : [25]} />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Golf Darts Scorer ──────────────────────────────────────────────────────────
export function GolfScorer({ p1Name, p2Name, holes = 9, botConfig, onWin, onAbandon, onPracticeStats, onTurnChanged }: {
  p1Name: string; p2Name: string; holes?: number;
  botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
  onTurnChanged?: (t: 0|1) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const [hole, setHole]             = useState(1);
  const [half, setHalf]             = useState<0|1>(0);
  const [totalScores, setTotal]     = useState<[number,number]>([0,0]);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const names = [p1Name, p2Name];

  const nextHalf = useCallback((addedScore: number) => {
    setTotal(prev => {
      const n: [number,number] = [...prev] as [number,number];
      n[half] += addedScore;
      if (half === 1) {
        setHole(h => {
          if (h >= holes) {
            safeTimeout(() => {
              onPracticeStats?.({ sessionData: { mode:"golf", strokes:[...n] } });
              onWin(n[0] <= n[1] ? 0 : 1, `${n[0]} vs ${n[1]} strokes`);
            }, 300);
            return h;
          }
          return h + 1;
        });
        setHalf(0); onTurnChanged?.(0);
      } else {
        setHalf(1); onTurnChanged?.(1);
      }
      return n;
    });
  }, [half, holes, onWin, onPracticeStats, onTurnChanged]);

  const handleDart = useCallback((dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const nv = [...visitDarts, dart];
    if (dart.segment === hole) {
      setVisitDarts([]);
      nextHalf(nv.length);
      return;
    }
    setVisitDarts(nv);
    if (nv.length === 3) {
      setVisitDarts([]);
      nextHalf(4);
    }
  }, [visitDarts, hole, nextHalf]);

  const handleDartRefGolf = useRef(handleDart);
  useEffect(() => { handleDartRefGolf.current = handleDart; });
  const isBotTurnGolf = !!botConfig && half === 1;
  useEffect(() => {
    if (!botConfig || half !== 1) return;
    const [d1, d2, d3] = botGolfVisit(hole, botConfig);
    const t1 = safeTimeout(() => handleDartRefGolf.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefGolf.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefGolf.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [half, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily:"Oswald,sans-serif" }}>Golf Darts</h2>
          <p style={{ color:"#ffd24a", fontFamily:"Oswald,sans-serif" }}>Hole {hole}/{holes} — Target: {hole}</p>
          <p className="text-xs" style={{ color:"rgba(255,255,255,0.3)" }}>Hit target in fewest darts. Miss all 3 = 4 strokes. LOWEST score wins.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0,1].map(i => <PlayerCard key={i} name={names[i]} score={totalScores[i]} scoreSuffix=" ⛳" turn={i===0} active={half===i} />)}
        </div>
        {isBotTurnGolf
          ? <TurnBanner name={names[1]} turn={1} msg="— CPU THROWING…" />
          : <TurnBanner name={names[half]} turn={half} msg={`— hit ${hole} (fewer darts = better)`} />}
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart}
          onMiss={() => handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={() => visitDarts.length > 0 && setVisitDarts(p=>p.slice(0,-1))}
          highlightSegments={[hole]}
          disabled={isBotTurnGolf} />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Nearest Bull Scorer ────────────────────────────────────────────────────────
export function NearestBullScorer({ p1Name, p2Name, botConfig, onWin, onAbandon }: {
  p1Name: string; p2Name: string; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
}) {
  const safeTimeout = useSafeTimeout();
  const [phase,   setPhase]   = useState<"throwing"|"declare">("throwing");
  const [thrown,  setThrown]  = useState<[boolean,boolean]>([false,false]);
  const [p1Score, setP1Score] = useState<number|null>(null);
  const [botScore,setBotScore]= useState<number|null>(null);
  const names = [p1Name, p2Name];

  const computeBotScore = (acc: number): number => {
    const r = Math.random();
    if (r > acc * 0.9)  return 0;
    if (r < acc * 0.35) return 50;
    return 25;
  };

  const handleP1Pick = (score: number) => {
    if (p1Score !== null) return;
    setP1Score(score);
    safeTimeout(() => {
      const bs = computeBotScore(botConfig!.hitAcc);
      setBotScore(bs);
      safeTimeout(() => onWin(score >= bs ? 0 : 1, `${score} vs ${bs}`), 1800);
    }, 900);
  };

  // ── Human vs Human ───────────────────────────────────────────────────────────
  if (!botConfig) {
    return (
      <div className="max-w-lg mx-auto space-y-5">
        <div className="pdc-divider" />
        <div className="text-center">
          <Target className="w-12 h-12 mx-auto mb-2" style={{ color: "#ffd24a" }} />
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Nearest the Bull</h2>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Each player throws 3 darts. Closest dart to Bull wins.</p>
        </div>
        {phase === "throwing" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[0,1].map(i => (
                <button key={i}
                  onClick={() => { if (!thrown[i]) { setThrown(p=>{const n=[...p] as [boolean,boolean]; n[i]=true; return n;}); } }}
                  style={{ padding:"2rem 1rem", borderRadius:"0.75rem", cursor: thrown[i]?"default":"pointer", background: thrown[i]?`${P_COLOR(i)}22`:"rgba(255,255,255,0.04)", border: thrown[i]?`2px solid ${P_COLOR(i)}`:"1px solid rgba(255,255,255,0.1)", color: P_COLOR(i), fontFamily:"Oswald,sans-serif" }}>
                  <div className="font-bold text-lg">{names[i]}</div>
                  <div className="text-xs mt-1 opacity-70">{thrown[i]?"✓ Thrown":"Tap when thrown"}</div>
                </button>
              ))}
            </div>
            {thrown[0] && thrown[1] && (
              <button onClick={() => setPhase("declare")}
                className="w-full h-12 font-bold uppercase tracking-widest rounded-xl"
                style={{ background:"#ff005c", color:"#fff", border:"none", fontFamily:"Oswald,sans-serif", cursor:"pointer" }}>
                Declare Winner →
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-center text-sm" style={{ color:"rgba(255,255,255,0.5)", fontFamily:"Oswald,sans-serif" }}>Look at the board — who is closest?</p>
            <div className="grid grid-cols-2 gap-4">
              {[0,1].map(i => (
                <button key={i} onClick={() => onWin(i as 0|1, "Nearest the Bull")}
                  style={{ padding:"2.5rem 1rem", borderRadius:"0.75rem", cursor:"pointer", background:`${P_COLOR(i)}18`, border:`2px solid ${P_COLOR(i)}44`, color:P_COLOR(i), fontFamily:"Oswald,sans-serif" }}>
                  <Trophy className="w-8 h-8 mx-auto mb-2" />
                  <div className="font-bold text-xl">{names[i]}</div>
                  <div className="text-xs mt-1 opacity-60">Tap — they were closest</div>
                </button>
              ))}
            </div>
          </>
        )}
        <AbandonBtn onAbandon={onAbandon} />
      </div>
    );
  }

  // ── Bot mode ─────────────────────────────────────────────────────────────────
  const ScoreLabel = ({ score }: { score: number|null }) => {
    if (score === null) return <span className="animate-pulse" style={{ color:"rgba(255,255,255,0.25)", fontFamily:"Oswald,sans-serif" }}>throwing…</span>;
    if (score === 50)   return <span style={{ color:"#ff005c", fontFamily:"Oswald,sans-serif", fontWeight:900 }}>BULL · 50</span>;
    if (score === 25)   return <span style={{ color:"#ffd24a", fontFamily:"Oswald,sans-serif", fontWeight:900 }}>OUTER · 25</span>;
    return <span style={{ color:"rgba(255,255,255,0.3)", fontFamily:"Oswald,sans-serif" }}>MISS · 0</span>;
  };

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="pdc-divider" />
      <div className="text-center">
        <Target className="w-12 h-12 mx-auto mb-2" style={{ color: "#ffd24a" }} />
        <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Nearest the Bull</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Pick your closest dart — bot throws automatically.</p>
      </div>
      {p1Score !== null && (
        <div className="pdc-card overflow-hidden">
          {[{ label: p1Name, score: p1Score }, { label: p2Name, score: botScore }].map((row, i) => {
            const isWinner = p1Score !== null && botScore !== null && (i === 0 ? p1Score >= botScore : botScore > p1Score);
            return (
              <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ background: isWinner?"rgba(34,197,94,0.07)":undefined, borderBottom: i===0?"1px solid rgba(255,255,255,0.06)":undefined }}>
                <span className="text-xs font-black w-16 shrink-0" style={{ fontFamily:"Oswald,sans-serif", color:P_COLOR(i as 0|1) }}>{row.label.toUpperCase()}</span>
                <span className="flex-1 text-right text-sm"><ScoreLabel score={row.score} /></span>
                {isWinner && <span className="text-xs font-black ml-2" style={{ color:"#22c55e", fontFamily:"Oswald,sans-serif", fontSize:"0.55rem" }}>WIN</span>}
              </div>
            );
          })}
        </div>
      )}
      {p1Score === null && (
        <div className="space-y-2">
          <p className="text-xs text-center" style={{ color:"rgba(255,255,255,0.4)", fontFamily:"Oswald,sans-serif" }}>Your closest dart to Bull:</p>
          {([
            { score:50, label:"🎯 Inner Bull", sub:"50", col:"#ff005c",               border:"rgba(255,0,92,0.4)",    bg:"rgba(255,0,92,0.1)"    },
            { score:25, label:"⭕ Outer Bull", sub:"25", col:"#ffd24a",               border:"rgba(255,210,74,0.3)",  bg:"rgba(255,210,74,0.07)" },
            { score:0,  label:"✗ Miss",         sub:"",  col:"rgba(255,255,255,0.3)", border:"rgba(255,255,255,0.1)", bg:"rgba(255,255,255,0.03)"},
          ] as const).map(({ score, label, sub, col, border, bg }) => (
            <button key={score} onClick={() => handleP1Pick(score)}
              style={{ width:"100%", padding:"1rem", borderRadius:"0.875rem", fontFamily:"Oswald,sans-serif", fontWeight:900, fontSize:"0.875rem", textTransform:"uppercase", letterSpacing:"0.14em", background:bg, border:`2px solid ${border}`, color:col, cursor:"pointer" }}>
              {label}{sub && <span style={{ color:"rgba(255,255,255,0.3)", fontWeight:400, marginLeft:"0.5rem" }}>{sub}</span>}
            </button>
          ))}
        </div>
      )}
      <AbandonBtn onAbandon={onAbandon} />
    </div>
  );
}

// ── Manual Scorer ──────────────────────────────────────────────────────────────
export function ManualScorer({ p1Name, p2Name, gameName, rules, onWin, onAbandon }: {
  p1Name: string; p2Name: string; gameName: string; rules?: string;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto space-y-5">
      <div className="pdc-divider" />
      <div className="text-center">
        <Crosshair className="w-10 h-10 mx-auto mb-2" style={{ color: "#a78bfa" }} />
        <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>{gameName}</h2>
        {rules && <p className="text-xs mt-2 px-4" style={{ color: "rgba(255,255,255,0.35)", lineHeight: 1.6 }}>{rules}</p>}
        <p className="text-sm mt-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
          Play your game — declare the winner when done
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[0,1].map(i => (
          <button key={i} onClick={() => onWin(i as 0|1)}
            style={{
              padding:"3rem 1rem", borderRadius:"0.75rem", cursor:"pointer",
              background:`${P_COLOR(i)}12`, border:`2px solid ${P_COLOR(i)}40`,
              color: P_COLOR(i), fontFamily: "Oswald, sans-serif",
            }}>
            <Trophy className="w-8 h-8 mx-auto mb-2" />
            <div className="font-bold text-xl">{i===0?p1Name:p2Name}</div>
            <div className="text-xs mt-1 opacity-60">Tap — they won</div>
          </button>
        ))}
      </div>
      <AbandonBtn onAbandon={onAbandon} />
    </div>
  );
}

// ── Snooker Darts ──────────────────────────────────────────────────────────────
const SNOOKER_BALLS: { label: string; value: number; segs: number[]; color: string; emoji: string }[] = [
  ...Array.from({ length: 15 }, () => ({ label: "Red", value: 1, segs: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], color: "#dc2626", emoji: "🔴" })),
  { label: "Yellow", value: 2, segs: [2], color: "#fde047", emoji: "🟡" },
  { label: "Green",  value: 3, segs: [3], color: "#22c55e", emoji: "🟢" },
  { label: "Brown",  value: 4, segs: [4], color: "#a16207", emoji: "🟤" },
  { label: "Blue",   value: 5, segs: [5], color: "#3b82f6", emoji: "🔵" },
  { label: "Pink",   value: 6, segs: [6], color: "#ec4899", emoji: "🩷" },
  { label: "Black",  value: 7, segs: [7], color: "#4b5563", emoji: "⚫" },
];

function botSnookerDart(segs: number[], cfg: BotConfig): Dart {
  if (Math.random() > cfg.hitAcc) return { segment: 0, multiplier: 1, value: 0, label: "Miss" };
  const seg = segs[Math.floor(Math.random() * Math.min(3, segs.length))];
  return { segment: seg, multiplier: 1, value: seg, label: `${seg}` };
}

export function SnookerScorer({ p1Name, p2Name, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const [ballIdx,    setBallIdx]    = useState(0);
  const [half,       setHalf]       = useState<0|1>(0);
  const [scores,     setScores]     = useState<[number,number]>([0,0]);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [potted,     setPotted]     = useState(false);
  const names = [p1Name, p2Name];
  const ball  = SNOOKER_BALLS[ballIdx];
  const ballIdxRef = useRef(ballIdx); ballIdxRef.current = ballIdx;
  const halfRef    = useRef(half);    halfRef.current    = half;
  const isBotTurnSnk = !!botConfig && half === 1;

  const doAdvance = (wasHit: boolean, bi: number, h: 0|1) => {
    if (wasHit) setScores(prev => { const ns:[number,number]=[...prev] as [number,number]; ns[h]+=SNOOKER_BALLS[bi].value; return ns; });
    setVisitDarts([]);
    setPotted(false);
    if (h === 0) {
      setHalf(1);
    } else if (bi + 1 < SNOOKER_BALLS.length) {
      setBallIdx(bi + 1);
      setHalf(0);
    } else {
      safeTimeout(() => {
        setScores(sc => { onPracticeStats?.({ sessionData: { mode: "snooker_darts" } }); onWin(sc[0] >= sc[1] ? 0 : 1, `${sc[0]}–${sc[1]} pts`); return sc; });
      }, 400);
    }
  };

  const handleDart = (dart: Dart) => {
    if (visitDarts.length >= 3 || potted) return;
    const hit = ball.segs.includes(dart.segment);
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);
    if (hit) { setPotted(true); return; }
    if (nv.length === 3) doAdvance(false, ballIdx, half);
  };

  useEffect(() => {
    if (!potted) return;
    const bi = ballIdxRef.current; const h = halfRef.current;
    const t = safeTimeout(() => doAdvance(true, bi, h), 600);
    return () => clearTimeout(t);
  }, [potted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDartRefSnk = useRef<(d: Dart) => void>(() => {});
  useEffect(() => { handleDartRefSnk.current = handleDart; });
  useEffect(() => {
    if (!botConfig || half !== 1) return;
    const segs = SNOOKER_BALLS[ballIdx].segs;
    const t1 = safeTimeout(() => handleDartRefSnk.current(botSnookerDart(segs, botConfig)), 700);
    const t2 = safeTimeout(() => handleDartRefSnk.current(botSnookerDart(segs, botConfig)), 1400);
    const t3 = safeTimeout(() => handleDartRefSnk.current(botSnookerDart(segs, botConfig)), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [half, ballIdx, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRed = ballIdx < 15;
  const redCount = Math.min(ballIdx + 1, 15);

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider"/>
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{fontFamily:"Oswald,sans-serif"}}>Snooker Darts</h2>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-lg">{ball.emoji}</span>
            <span className="font-black text-sm" style={{fontFamily:"Oswald,sans-serif", color:ball.color}}>
              {isRed ? `Red ${redCount}/15` : ball.label}
            </span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{fontFamily:"Oswald,sans-serif", background:`${ball.color}22`, color:ball.color, fontSize:"0.6rem"}}>+{ball.value}pt</span>
          </div>
          <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.3)"}}>
            {isRed ? "Hit any segment 1–15 to pot" : `Aim at segment ${ball.segs[0]}`}
          </p>
        </div>
        <div className="flex gap-0.5 justify-center flex-wrap px-2">
          {SNOOKER_BALLS.map((b, i) => (
            <div key={i} className="w-2 h-2 rounded-full" style={{
              background: b.color,
              opacity: i < ballIdx ? 0.2 : i === ballIdx ? 1 : 0.35,
              boxShadow: i === ballIdx ? `0 0 6px ${b.color}` : "none",
            }}/>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0,1].map(i=><PlayerCard key={i} name={names[i]} score={scores[i]} scoreSuffix=" pts" turn={i===0} active={half===i}/>)}
        </div>
        {potted && <div className="text-center font-bold text-sm" style={{color:"#22c55e",fontFamily:"Oswald,sans-serif"}}>Potted! 🎯</div>}
        <TurnBanner name={names[half]} turn={half} msg={isBotTurnSnk?"— CPU THROWING…":`— aim at ${isRed?"1–15":ball.segs[0]}`}/>
        <VisitDarts darts={visitDarts}/>
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={()=>handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={()=>visitDarts.length>0&&!potted&&setVisitDarts(p=>p.slice(0,-1))}
          highlightSegments={ball.segs} activeSegments={ball.segs} disabled={isBotTurnSnk||potted}/>
        <AbandonBtn onAbandon={onAbandon}/>
      </div>}
    />
  );
}

// ── JDC Challenge 41 ──────────────────────────────────────────────────────────
export function JDCChallenge41Scorer({ p1Name, p2Name, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const SH1 = [10,11,12,13,14,15];
  const DBL = [...Array.from({length:20},(_,i)=>i+1), 25];
  const SH2 = [15,16,17,18,19,20];
  const [phase, setPhase]           = useState<"sh1"|"dbl"|"sh2">("sh1");
  const [scores, setScores]         = useState<[number,number]>([0,0]);
  const [turn, setTurn]             = useState<0|1>(0);
  const [idx, setIdx]               = useState(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [shHits, setShHits]         = useState({s:false,d:false,t:false});
  const [msg, setMsg]               = useState("");
  const names = [p1Name, p2Name];
  const handleDartRefJDC = useRef<(d: Dart) => void>(() => {});
  const isBotTurnJDC = !!botConfig && turn === 1;
  const phaseArr = phase==="sh1"?SH1:phase==="dbl"?DBL:SH2;
  const target   = phaseArr[idx];

  const advance = useCallback((pts: number) => {
    setScores(prev => {
      const ns:[number,number]=[...prev] as [number,number];
      ns[turn] += pts;
      const nextTurn: 0|1 = turn===0?1:0;
      if (turn===1) {
        const nextIdx = idx+1;
        if (nextIdx >= phaseArr.length) {
          if (phase==="sh1") { setPhase("dbl"); setIdx(0); }
          else if (phase==="dbl") { setPhase("sh2"); setIdx(0); }
          else {
            safeTimeout(()=>{ onPracticeStats?.({sessionData:{mode:"jdc41"}}); onWin(ns[0]>=ns[1]?0:1,`${ns[0]} vs ${ns[1]} pts`); },300);
          }
        } else setIdx(nextIdx);
        setTurn(0);
      } else setTurn(nextTurn);
      setVisitDarts([]); setShHits({s:false,d:false,t:false});
      return ns;
    });
  }, [turn, idx, phase, phaseArr, onWin, onPracticeStats]);

  const handleDart = useCallback((dart: Dart) => {
    if (visitDarts.length>=3) return;
    const nv=[...visitDarts,dart];
    if (phase==="dbl") {
      if (dart.segment===target&&dart.multiplier===2) { setMsg(`D${target}! ✓`); safeTimeout(()=>setMsg(""),1500); advance(target*2); return; }
      setVisitDarts(nv);
      if (nv.length===3) { setMsg("Missed!"); safeTimeout(()=>setMsg(""),1200); advance(0); }
      return;
    }
    const nh={s:shHits.s||(dart.segment===target&&dart.multiplier===1),d:shHits.d||(dart.segment===target&&dart.multiplier===2),t:shHits.t||(dart.segment===target&&dart.multiplier===3)};
    const pts=dart.segment===target?dart.value:0;
    if(pts>0)setShHits(nh);
    if(nh.s&&nh.d&&nh.t){setMsg(`SHANGHAI ${target}! 🎯`);safeTimeout(()=>setMsg(""),2000);advance(nv.reduce((a,d)=>a+(d.segment===target?d.value:0),0)+50);return;}
    setVisitDarts(nv);
    if(nv.length===3){advance(nv.reduce((a,d)=>a+(d.segment===target?d.value:0),0));}
  },[visitDarts,phase,target,shHits,turn,advance]);

  useEffect(() => { handleDartRefJDC.current = handleDart; });
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const [d1, d2, d3] = botJDCVisit(phase, target, botConfig);
    const t1 = safeTimeout(() => handleDartRefJDC.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefJDC.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefJDC.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const label=phase==="sh1"?`Phase 1 — Shanghai ${SH1[0]}–${SH1.at(-1)}`
    :phase==="dbl"?`Phase 2 — Doubles ${DBL[0]}–D${DBL.at(-1)}`
    :`Phase 3 — Shanghai ${SH2[0]}–${SH2.at(-1)}`;

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider"/>
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{fontFamily:"Oswald,sans-serif"}}>JDC Challenge 41</h2>
          <p className="text-sm" style={{color:"#ffd24a",fontFamily:"Oswald,sans-serif"}}>{label}</p>
          <p className="text-sm mt-1" style={{color:"rgba(255,255,255,0.5)",fontFamily:"Oswald,sans-serif"}}>
            Target: <strong style={{color:"#fff"}}>{phase==="dbl"?`D${target}`:target}</strong>
            {phase!=="dbl"&&<span className="ml-3 text-xs" style={{color:"rgba(255,255,255,0.3)"}}>S:{shHits.s?"✓":"○"} D:{shHits.d?"✓":"○"} T:{shHits.t?"✓":"○"}</span>}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">{[0,1].map(i=><PlayerCard key={i} name={names[i]} score={scores[i]} turn={i===0} active={turn===i}/>)}</div>
        {msg&&<div className="text-center font-bold text-sm" style={{color:"#ffd24a",fontFamily:"Oswald,sans-serif"}}>{msg}</div>}
        <TurnBanner name={names[turn]} turn={turn} msg={isBotTurnJDC?"— CPU THROWING…":phase==="dbl"?`— hit D${target}!`:`— aim at ${target}`}/>
        <VisitDarts darts={visitDarts}/>
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={()=>handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={()=>visitDarts.length>0&&setVisitDarts(p=>p.slice(0,-1))} highlightSegments={[target]} disabled={isBotTurnJDC}/>
        <AbandonBtn onAbandon={onAbandon}/>
      </div>}
    />
  );
}

// ── Exponential Bundle ─────────────────────────────────────────────────────────
export function ExponentialBundleScorer({ p1Name, p2Name, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const TARGETS=[7,8,9,10,11,12];
  const [tIdx,setTIdx]             = useState(0);
  const [half,setHalf]             = useState<0|1>(0);
  const [scores,setScores]         = useState<[number,number]>([0,0]);
  const [visitDarts,setVisitDarts] = useState<Dart[]>([]);
  const names=[p1Name,p2Name];
  const target=TARGETS[tIdx];
  const handleDartRefExp = useRef<(d: Dart) => void>(() => {});
  const isBotTurnExp = !!botConfig && half === 1;

  const handleDart=useCallback((dart:Dart)=>{
    if(visitDarts.length>=3)return;
    const nv=[...visitDarts,dart];
    setVisitDarts(nv);
    if(nv.length===3){
      const pts=nv.reduce((sum,d)=>d.segment!==target?sum:sum+Math.pow(target,d.multiplier),0);
      setScores(prev=>{
        const ns:[number,number]=[...prev] as [number,number];
        ns[half]+=Math.round(pts);
        if(half===1){
          if(tIdx+1>=TARGETS.length){
            safeTimeout(()=>{onPracticeStats?.({sessionData:{mode:"exponential_bundle"}});onWin(ns[0]>=ns[1]?0:1,`${ns[0].toLocaleString()} vs ${ns[1].toLocaleString()}`);},300);
          } else {setTIdx(t=>t+1);setHalf(0);}
        } else setHalf(1);
        return ns;
      });
      setVisitDarts([]);
    }
  },[visitDarts,target,half,tIdx,onWin,onPracticeStats]);

  useEffect(() => { handleDartRefExp.current = handleDart; });
  useEffect(() => {
    if (!botConfig || half !== 1) return;
    const [d1, d2, d3] = botExponentialVisit(target, botConfig);
    const t1 = safeTimeout(() => handleDartRefExp.current(d1), 700);
    const t2 = safeTimeout(() => handleDartRefExp.current(d2), 1400);
    const t3 = safeTimeout(() => handleDartRefExp.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [half, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider"/>
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{fontFamily:"Oswald,sans-serif"}}>Exponential Bundle</h2>
          <p className="text-sm" style={{color:"#ffd24a",fontFamily:"Oswald,sans-serif"}}>Round {tIdx+1}/6 — Target: <strong>{target}</strong></p>
          <p className="text-xs" style={{color:"rgba(255,255,255,0.3)"}}>S={target} · D={target}²={target*target} · T={target}³={target*target*target} per dart</p>
        </div>
        <div className="grid grid-cols-2 gap-3">{[0,1].map(i=><PlayerCard key={i} name={names[i]} score={scores[i]} turn={i===0} active={half===i}/>)}</div>
        <TurnBanner name={names[half]} turn={half} msg={isBotTurnExp?"— CPU THROWING…":`— aim at ${target} (doubles & trebles score BIG)`}/>
        <VisitDarts darts={visitDarts}/>
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={()=>handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={()=>visitDarts.length>0&&setVisitDarts(p=>p.slice(0,-1))} highlightSegments={[target]} disabled={isBotTurnExp}/>
        <AbandonBtn onAbandon={onAbandon}/>
      </div>}
    />
  );
}

// ── Shooting Gallery ───────────────────────────────────────────────────────────
export function ShootingGalleryScorer({ p1Name, p2Name, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const ROUNDS=5;
  const rng=()=>Math.floor(Math.random()*10)+121;
  const [round,setRound]             = useState(0);
  const [half,setHalf]               = useState<0|1>(0);
  const [scores,setScores]           = useState<[number,number]>([0,0]);
  const [dartCount,setDartCount]     = useState(0);
  const [roundTarget,setRoundTarget] = useState(rng);
  const [remain,setRemain]           = useState(()=>roundTarget);
  const [msg,setMsg]                 = useState("");
  const [sgHistory,setSgHistory]     = useState<{remain:number,dartCount:number}[]>([]);
  const names=[p1Name,p2Name];
  const handleDartRefSG = useRef<(d: Dart) => void>(() => {});
  const isBotTurnSG = !!botConfig && half === 1;

  const nextPlayer=useCallback((dartsUsed:number)=>{
    setScores(prev=>{
      const ns:[number,number]=[...prev] as [number,number];
      ns[half]+=dartsUsed;
      if(half===1){
        if(round+1>=ROUNDS){
          safeTimeout(()=>{onPracticeStats?.({sessionData:{mode:"shooting_gallery"}});onWin(ns[0]<=ns[1]?0:1,`${ns[0]} vs ${ns[1]} darts`);},300);
        } else {
          const next=rng();
          setRound(r=>r+1);setRoundTarget(next);setRemain(next);setHalf(0);
        }
      } else {setRemain(roundTarget);setHalf(1);}
      setDartCount(0);
      return ns;
    });
  },[half,round,roundTarget,onWin,onPracticeStats]);

  const handleDart=useCallback((dart:Dart)=>{
    const dc=dartCount+1;
    const nr=remain-dart.value;
    if(nr===0&&dart.multiplier===2){setSgHistory([]);setMsg(`Checkout in ${dc}! 🎯`);safeTimeout(()=>setMsg(""),2000);nextPlayer(dc);return;}
    if(nr<0||nr===1){setSgHistory([]);setMsg("Bust! +10");safeTimeout(()=>setMsg(""),1500);nextPlayer(10);return;}
    setSgHistory(prev=>[...prev,{remain,dartCount}]);
    setRemain(nr);setDartCount(dc);
    if(dc>=9){setSgHistory([]);nextPlayer(10);}
  },[dartCount,remain,nextPlayer]);

  const handleSgUndo=()=>{
    if(sgHistory.length===0)return;
    const prev=sgHistory[sgHistory.length-1];
    setRemain(prev.remain);
    setDartCount(prev.dartCount);
    setSgHistory(h=>h.slice(0,-1));
  };

  useEffect(() => { handleDartRefSG.current = handleDart; });
  useEffect(() => {
    if (!botConfig || half !== 1) return;
    const t = safeTimeout(() => handleDartRefSG.current(botShootingGalleryDart(remain, botConfig)), 700);
    return () => clearTimeout(t);
  }, [half, remain, dartCount, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider"/>
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{fontFamily:"Oswald,sans-serif"}}>Shooting Gallery</h2>
          <p className="text-sm" style={{color:"#ffd24a",fontFamily:"Oswald,sans-serif"}}>Round {round+1}/{ROUNDS} — Target: <strong>{roundTarget}</strong></p>
          <p className="text-xs" style={{color:"rgba(255,255,255,0.3)"}}>Checkout in fewest darts. Bust or 9+ darts = +10. LOWEST score wins.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">{[0,1].map(i=><PlayerCard key={i} name={names[i]} score={scores[i]} scoreSuffix=" darts" turn={i===0} active={half===i}/>)}</div>
        <div className="pdc-card p-3 text-center">
          <div className="text-4xl font-black" style={{fontFamily:"Oswald,sans-serif",color:"#ffd24a"}}>{remain}</div>
          <div className="text-xs" style={{color:"rgba(255,255,255,0.3)"}}>remaining · dart {dartCount+1}</div>
        </div>
        {msg&&<div className="text-center font-bold text-sm" style={{color:"#ffd24a",fontFamily:"Oswald,sans-serif"}}>{msg}</div>}
        <TurnBanner name={names[half]} turn={half} msg={isBotTurnSG?"— CPU THROWING…":"— checkout on a double!"}/>
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={()=>handleDart({segment:0,multiplier:1,value:0,label:"Miss"})} onUndo={handleSgUndo} disabled={isBotTurnSG}/>
        <AbandonBtn onAbandon={onAbandon}/>
      </div>}
    />
  );
}

// ── Dead Centre ────────────────────────────────────────────────────────────────
export function DeadCentreScorer({ p1Name, p2Name, target=300, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; target?: number; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const [scores,setScores]         = useState<[number,number]>([0,0]);
  const [turn,setTurn]             = useState<0|1>(0);
  const [visitDarts,setVisitDarts] = useState<Dart[]>([]);
  const [visitPts,setVisitPts]     = useState(0);
  const [busted,setBusted]         = useState(false);
  const [msg,setMsg]               = useState("");
  const names=[p1Name,p2Name];

  const handleDart=useCallback((dart:Dart)=>{
    if(visitDarts.length>=3)return;
    const isBull=dart.segment===25;
    const nv=[...visitDarts,dart];
    setVisitDarts(nv);
    const nowBusted=busted||!isBull;
    if(!isBull){setBusted(true);setMsg(`${names[turn]} BUSTED — reset!`);safeTimeout(()=>setMsg(""),2000);}
    else setVisitPts(p=>p+dart.value);
    if(nv.length===3){
      setScores(prev=>{
        const ns:[number,number]=[...prev] as [number,number];
        if(nowBusted){ns[turn]=0;}
        else{
          ns[turn]+=visitPts+(isBull?dart.value:0);
          if(ns[turn]>=target){safeTimeout(()=>{onPracticeStats?.({sessionData:{mode:"dead_centre"}});onWin(turn,`${ns[turn]} pts!`);},200);}
        }
        return ns;
      });
      setVisitDarts([]);setVisitPts(0);setBusted(false);setTurn(t=>t===0?1:0);
    }
  },[visitDarts,visitPts,busted,turn,target,names,onWin,onPracticeStats]);

  const handleDartRefDC=useRef(handleDart);
  useEffect(()=>{handleDartRefDC.current=handleDart;});
  const isBotTurnDC=!!botConfig&&turn===1;
  useEffect(()=>{
    if(!botConfig||turn!==1)return;
    const acc=botConfig.hitAcc*0.65; // bull is harder than average target
    const mk=():Dart=>{
      if(Math.random()>acc)return{segment:0,multiplier:1,value:0,label:"Miss"};
      return Math.random()<0.4?{segment:25,multiplier:2,value:50,label:"DB"}:{segment:25,multiplier:1,value:25,label:"Bull"};
    };
    const t1=safeTimeout(()=>handleDartRefDC.current(mk()),700);
    const t2=safeTimeout(()=>handleDartRefDC.current(mk()),1400);
    const t3=safeTimeout(()=>handleDartRefDC.current(mk()),2100);
    return()=>{clearTimeout(t1);clearTimeout(t2);clearTimeout(t3);};
  },[turn,botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider"/>
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{fontFamily:"Oswald,sans-serif"}}>Dead Centre</h2>
          <p className="text-xs" style={{color:"rgba(255,255,255,0.3)"}}>Hit Bull (25 or 50) every dart or score RESETS to 0. Race to {target}.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0,1].map(i=><PlayerCard key={i} name={names[i]} score={scores[i]} turn={i===0} active={turn===i} sub={`${target-scores[i]} to go`}/>)}
        </div>
        {msg&&<div className="text-center font-bold text-sm" style={{color:"#ff005c",fontFamily:"Oswald,sans-serif"}}>{msg}</div>}
        {isBotTurnDC?<TurnBanner name={names[1]} turn={1} msg="— CPU THROWING…"/>:<TurnBanner name={names[turn]} turn={turn} msg="— aim at Bull only!"/>}
        {visitDarts.length>0&&<div className="text-center text-sm" style={{color:"rgba(255,255,255,0.4)",fontFamily:"Oswald,sans-serif"}}>This visit: +{visitPts}{busted?" 💥 BUSTED":""}</div>}
        <VisitDarts darts={visitDarts}/>
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={()=>handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={()=>visitDarts.length>0&&setVisitDarts(p=>p.slice(0,-1))} highlightSegments={[25]} disabled={isBotTurnDC}/>
        <AbandonBtn onAbandon={onAbandon}/>
      </div>}
    />
  );
}

// ── Three-in-a-Bed Scorer ──────────────────────────────────────────────────────
export function ThreeInABedScorer({ p1Name, p2Name, winsNeeded = 5, botConfig, onWin, onAbandon }: {
  p1Name: string; p2Name: string; winsNeeded?: number; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
}) {
  const safeTimeout = useSafeTimeout();
  const [roundWins, setRoundWins]   = useState<[number,number]>([0,0]);
  const [turn, setTurn]             = useState<0|1>(0);
  const [phase, setPhase]           = useState<"call"|"throw">("call");
  const [target, setTarget]         = useState<number|null>(null);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [msg, setMsg]               = useState("");
  const names = [p1Name, p2Name];
  const NUMS = Array.from({length:20},(_,i)=>i+1);
  const isBotTurn3B = !!botConfig && turn === 1;

  const callTarget = (n: number) => { setTarget(n); setPhase("throw"); };

  const handleDart = useCallback((dart: Dart) => {
    if (visitDarts.length >= 3 || target === null) return;
    const nd = [...visitDarts, dart];
    setVisitDarts(nd);
    if (nd.length === 3) {
      const allInBed = nd.every(d => d.segment === target && d.multiplier === 3);
      if (allInBed) {
        setMsg(`🎯 THREE-IN-A-BED! T${target}!`);
        setRoundWins(prev => {
          const n:[number,number]=[...prev] as [number,number];
          n[turn]++;
          if (n[turn] >= winsNeeded) {
            safeTimeout(() => onWin(turn, `${n[turn]} three-in-a-beds!`), 600);
          }
          return n;
        });
      } else {
        const inBedCount = nd.filter(d => d.segment === target && d.multiplier === 3).length;
        setMsg(inBedCount === 0 ? `Miss — none in T${target}` : `${inBedCount}/3 in T${target} — not enough!`);
      }
      safeTimeout(() => {
        setMsg(""); setVisitDarts([]); setTarget(null); setPhase("call");
        setTurn(t => t===0?1:0);
      }, 1800);
    }
  }, [visitDarts, target, turn, winsNeeded, onWin]);

  const handleDartRef3B = useRef(handleDart);
  useEffect(() => { handleDartRef3B.current = handleDart; });

  // Bot: auto-call a target during "call" phase
  useEffect(() => {
    if (!botConfig || turn !== 1 || phase !== "call") return;
    // Smarter bots aim higher — scale 0.25→1.0 hitAcc into num range 5→20
    const maxNum = Math.max(5, Math.round(botConfig.hitAcc * 20));
    const botNum = Math.floor(Math.random() * maxNum) + 1;
    const t = safeTimeout(() => callTarget(Math.min(20, botNum)), 600);
    return () => clearTimeout(t);
  }, [turn, phase, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bot: auto-throw 3 darts during "throw" phase
  useEffect(() => {
    if (!botConfig || turn !== 1 || phase !== "throw" || target === null) return;
    // Trebles are hard: effective accuracy is ~50% of general hitAcc
    const mk = (): Dart => {
      if (Math.random() > botConfig.hitAcc * 0.5)
        return { segment: 0, multiplier: 1, value: 0, label: "Miss" };
      return { segment: target, multiplier: 3, value: target * 3, label: `T${target}` };
    };
    const t1 = safeTimeout(() => handleDartRef3B.current(mk()), 700);
    const t2 = safeTimeout(() => handleDartRef3B.current(mk()), 1400);
    const t3 = safeTimeout(() => handleDartRef3B.current(mk()), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, phase, target, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="pdc-divider"/>
      <div className="text-center">
        <h2 className="text-2xl font-bold uppercase" style={{fontFamily:"Oswald,sans-serif"}}>Three-in-a-Bed</h2>
        <p className="text-xs mt-1" style={{color:"rgba(255,255,255,0.3)"}}>
          Call a treble, throw all 3 darts — all 3 must hit the same treble · First to {winsNeeded} rounds wins
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0,1].map(i => (
          <PlayerCard key={i} name={names[i]} score={roundWins[i]} scoreSuffix={`/${winsNeeded}`} turn={i===0} active={turn===i} />
        ))}
      </div>
      {msg && <div className="text-center font-bold text-sm" style={{color:"#ffd24a",fontFamily:"Oswald,sans-serif"}}>{msg}</div>}
      {phase === "call" ? (
        <>
          <TurnBanner name={names[turn]} turn={turn} msg={isBotTurn3B ? "— CPU choosing…" : "— call your treble!"} />
          {!isBotTurn3B && (
            <SectionCard>
              <p className="text-xs text-center mb-3" style={{color:"rgba(255,255,255,0.4)",fontFamily:"Oswald,sans-serif"}}>Pick your target:</p>
              <div className="grid grid-cols-5 gap-2">
                {NUMS.map(n => (
                  <button key={n} onClick={() => callTarget(n)}
                    className="py-3 rounded-lg font-bold text-sm"
                    style={{
                      fontFamily:"Oswald,sans-serif", background:"rgba(255,255,255,0.05)",
                      border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.8)",
                      cursor:"pointer",
                    }}>
                    T{n}
                  </button>
                ))}
              </div>
            </SectionCard>
          )}
        </>
      ) : (
        <>
          <TurnBanner name={names[turn]} turn={turn} msg={isBotTurn3B ? "— CPU THROWING…" : `— all 3 in T${target}!`} />
          <div className="text-center py-4" style={{fontFamily:"Oswald,sans-serif"}}>
            <div className="text-5xl font-black" style={{color:"#ffd24a"}}>T{target}</div>
            <div className="text-xs mt-1" style={{color:"rgba(255,255,255,0.3)"}}>
              {isBotTurn3B ? "CPU throwing…" : "Throw all 3 darts at treble " + target}
            </div>
          </div>
          {!isBotTurn3B && (
            <DartInputBoard onDart={handleDart}
              onMiss={() => handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
              onUndo={() => visitDarts.length > 0 && setVisitDarts(p=>p.slice(0,-1))}
              highlightSegments={target ? [target] : undefined} />
          )}
          <VisitDarts darts={visitDarts} />
        </>
      )}
      <AbandonBtn onAbandon={onAbandon} />
    </div>
  );
}

// ── Team X01 Scorer ────────────────────────────────────────────────────────────
const TEAM_COLORS: [string, string] = ["#22c55e", "#ee0a78"];

export function TeamX01Scorer({ teamNames, config, onWin, onAbandon }: {
  teamNames: [string[], string[]];
  config: { startingScore: number; doubleOut?: boolean; doubleIn?: boolean };
  onWin: (w: 0|1, detail?: string) => void;
  onAbandon: () => void;
}) {
  const safeTimeout = useSafeTimeout();
  const { startingScore = 501, doubleOut = true } = config;
  const [scores, setScores]         = useState<[number, number]>([startingScore, startingScore]);
  const [teamTurn, setTeamTurn]     = useState<0|1>(0);
  const [playerIdx, setPlayerIdx]   = useState<[number, number]>([0, 0]);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [bust, setBust]             = useState(false);
  const [bustMsg, setBustMsg]       = useState("");
  const [history, setHistory]       = useState<{ team:0|1; player:number; score:number; left:number }[]>([]);

  const isValidOut = useCallback((dart: Dart) => {
    if (doubleOut) return dart.multiplier === 2 || (dart.segment === 25 && dart.value === 50);
    return true;
  }, [doubleOut]);

  const advanceTurn = useCallback((capturedTeam: 0|1) => {
    setPlayerIdx(prev => {
      const n: [number,number] = [...prev] as [number,number];
      n[capturedTeam] = (n[capturedTeam] + 1) % teamNames[capturedTeam].length;
      return n;
    });
    setTeamTurn(t => t === 0 ? 1 : 0);
    setVisitDarts([]);
    setBust(false);
    setBustMsg("");
  }, [teamNames]);

  const handleDart = useCallback((dart: Dart) => {
    if (bust || visitDarts.length >= 3) return;
    const capturedTeam = teamTurn;
    const nv = [...visitDarts, dart];
    const cum = nv.reduce((s, d) => s + d.value, 0);
    const rem = scores[capturedTeam] - cum;

    if (rem < 0 || (rem === 1 && doubleOut)) {
      setBust(true);
      setBustMsg(rem < 0 ? "BUST — overshot!" : "BUST — can't leave 1!");
      setVisitDarts(nv);
      safeTimeout(() => advanceTurn(capturedTeam), 1500);
      return;
    }
    if (rem === 0) {
      if (isValidOut(dart)) {
        setVisitDarts(nv);
        safeTimeout(() => onWin(capturedTeam, `${teamNames[capturedTeam].join(" & ")} win!`), 300);
      } else {
        setBust(true);
        setBustMsg(doubleOut ? "BUST — must finish on a double!" : "BUST!");
        setVisitDarts(nv);
        safeTimeout(() => advanceTurn(capturedTeam), 1500);
      }
      return;
    }
    setVisitDarts(nv);
    if (nv.length === 3) {
      setScores(prev => { const n: [number,number] = [...prev] as [number,number]; n[capturedTeam] -= cum; return n; });
      setHistory(h => [...h, { team: capturedTeam, player: playerIdx[capturedTeam], score: cum, left: rem }]);
      advanceTurn(capturedTeam);
    }
  }, [bust, visitDarts, teamTurn, scores, playerIdx, doubleOut, isValidOut, advanceTurn, onWin, teamNames]);

  const handleMiss = () => handleDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" });
  const handleUndo = () => { if (!bust && visitDarts.length > 0) setVisitDarts(p => p.slice(0, -1)); };
  const cum = visitDarts.reduce((s, d) => s + d.value, 0);

  const currentPlayerName = (team: 0|1) => teamNames[team][playerIdx[team]];

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="grid grid-cols-2 gap-3">
          {([0, 1] as const).map(team => (
            <div key={team} className="pdc-card p-3 text-center relative overflow-hidden"
              style={{
                borderColor: teamTurn === team && !bust ? TEAM_COLORS[team] : "rgba(255,255,255,0.06)",
                boxShadow: teamTurn === team && !bust ? `0 0 18px ${TEAM_COLORS[team]}22` : undefined,
              }}>
              {teamTurn === team && !bust && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: TEAM_COLORS[team] }} />}
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ fontFamily: "Oswald, sans-serif", color: TEAM_COLORS[team] }}>
                Team {team + 1}
              </div>
              <div className="font-black leading-none" style={{ fontFamily: "Oswald, sans-serif", fontSize: "2.6rem", color: teamTurn === team ? "#fff" : "rgba(255,255,255,0.3)" }}>
                {scores[team]}
              </div>
              <div className="mt-2 space-y-0.5">
                {teamNames[team].map((name, i) => (
                  <div key={i} className="text-xs px-2 py-0.5 rounded" style={{
                    fontFamily: "Oswald, sans-serif",
                    background: teamTurn === team && playerIdx[team] === i ? `${TEAM_COLORS[team]}22` : "transparent",
                    color: teamTurn === team && playerIdx[team] === i ? TEAM_COLORS[team] : "rgba(255,255,255,0.3)",
                    fontWeight: teamTurn === team && playerIdx[team] === i ? 700 : 400,
                  }}>
                    {teamTurn === team && playerIdx[team] === i ? "▶ " : ""}{name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {(() => {
          const teamLiveRem = !bust ? Math.max(0, scores[teamTurn] - cum) : scores[teamTurn];
          return teamLiveRem >= 2 && teamLiveRem <= 170 && CHECKOUTS[teamLiveRem]
            ? <CheckoutBar checkout={CHECKOUTS[teamLiveRem]!} playerName={currentPlayerName(teamTurn)} playerIdx={teamTurn} />
            : null;
        })()}
        {bust
          ? <BustBanner msg={bustMsg} />
          : <TurnBanner name={currentPlayerName(teamTurn)} turn={teamTurn} msg="— enter your score" />}
        <SectionCard>
          <VisitDarts darts={visitDarts} />
          {visitDarts.length > 0 && (
            <div className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
              {cum} scored → leaves {Math.max(0, scores[teamTurn] - cum)}
            </div>
          )}
        </SectionCard>
        {/* Recent Visits */}
        {history.length > 0 && (
          <SectionCard>
            <div className="text-xs uppercase tracking-widest font-bold mb-3" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
              Recent Visits
            </div>
            {[...history].reverse().slice(0, 5).map((h, i) => (
              <div key={i} className="flex justify-between text-xs py-0.5">
                <span style={{ color: TEAM_COLORS[h.team], fontFamily: "Oswald, sans-serif" }}>{teamNames[h.team][h.player]}</span>
                <span style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>+{h.score}</span>
                <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "mono" }}>{h.left} left</span>
              </div>
            ))}
          </SectionCard>
        )}
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={handleMiss} onUndo={handleUndo} disabled={bust} />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Team Cricket Scorer ────────────────────────────────────────────────────────
export function TeamCricketScorer({ teamNames, cutThroat = false, onWin, onAbandon }: {
  teamNames: [string[], string[]];
  cutThroat?: boolean;
  onWin: (w: 0|1, detail?: string) => void;
  onAbandon: () => void;
}) {
  const safeTimeout = useSafeTimeout();
  const [marks, setMarks]           = useState<[[number,number,number,number,number,number,number],[number,number,number,number,number,number,number]]>([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]);
  const [scores, setScores]         = useState<[number,number]>([0,0]);
  const [teamTurn, setTeamTurn]     = useState<0|1>(0);
  const [playerIdx, setPlayerIdx]   = useState<[number,number]>([0,0]);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [lastHit, setLastHit]       = useState("");

  const checkWin = useCallback((m: typeof marks, sc: [number,number]): 0|1|null => {
    for (const p of [0,1] as const) {
      const closed = m[p].every(x => x >= 3);
      if (!closed) continue;
      const opp: 0|1 = p === 0 ? 1 : 0;
      if (!cutThroat && sc[p] >= sc[opp]) return p;
      if (cutThroat && sc[p] <= sc[opp]) return p;
    }
    return null;
  }, [cutThroat]);

  const handleDart = useCallback((dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const capturedTeam = teamTurn;
    const numIdx = CRICKET_NUMS.indexOf(dart.segment);
    const nv = [...visitDarts, dart];

    if (numIdx >= 0) {
      const hits = dart.multiplier;
      setMarks(prev => {
        const nm: typeof marks = [[...prev[0]] as any, [...prev[1]] as any];
        const toClose = Math.max(0, 3 - nm[capturedTeam][numIdx]);
        const extra = hits - Math.min(hits, toClose);
        nm[capturedTeam][numIdx] = Math.min(3, nm[capturedTeam][numIdx] + hits);
        if (extra > 0) {
          const opp: 0|1 = capturedTeam === 0 ? 1 : 0;
          if (nm[opp][numIdx] < 3) {
            setScores(ps => {
              const ns: [number,number] = [...ps] as [number,number];
              const val = CRICKET_NUMS[numIdx];
              if (cutThroat) ns[opp] += extra * val;
              else ns[capturedTeam] += extra * val;
              return ns;
            });
          }
        }
        return nm;
      });
      const lbl = dart.multiplier === 1 ? `${dart.segment}` : dart.multiplier === 2 ? `D${dart.segment}` : `T${dart.segment}`;
      setLastHit(lbl);
    } else {
      setLastHit("Miss");
    }

    setVisitDarts(nv);
    if (nv.length === 3) {
      setVisitDarts([]);
      setLastHit("");
      setPlayerIdx(prev => {
        const n: [number,number] = [...prev] as [number,number];
        n[capturedTeam] = (n[capturedTeam] + 1) % teamNames[capturedTeam].length;
        return n;
      });
      setTeamTurn(t => t === 0 ? 1 : 0);
    }

    safeTimeout(() => {
      setMarks(m => {
        setScores(sc => {
          const w = checkWin(m, sc);
          if (w !== null) safeTimeout(() => onWin(w, cutThroat ? "Cut-Throat — lowest score wins" : undefined), 300);
          return sc;
        });
        return m;
      });
    }, 50);
  }, [visitDarts, teamTurn, cutThroat, teamNames, onWin, checkWin]);

  const handleMiss = () => handleDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" });
  const handleUndo = () => { if (visitDarts.length > 0) setVisitDarts(p => p.slice(0, -1)); };

  const currentPlayer = (team: 0|1) => teamNames[team][playerIdx[team]];

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
            Team {cutThroat ? "Cut-Throat " : ""}Cricket
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([0,1] as const).map(team => (
            <div key={team} className="pdc-card p-3 text-center"
              style={{ borderColor: teamTurn === team ? TEAM_COLORS[team] : "rgba(255,255,255,0.06)" }}>
              <div className="text-xs font-bold uppercase" style={{ color: TEAM_COLORS[team], fontFamily: "Oswald, sans-serif" }}>Team {team + 1}</div>
              <div className="text-3xl font-black" style={{ fontFamily: "Oswald, sans-serif", color: teamTurn === team ? "#fff" : "rgba(255,255,255,0.3)" }}>{scores[team]}</div>
              <div className="mt-1 space-y-0.5">
                {teamNames[team].map((name, i) => (
                  <div key={i} className="text-xs" style={{
                    fontFamily: "Oswald, sans-serif",
                    color: teamTurn === team && playerIdx[team] === i ? TEAM_COLORS[team] : "rgba(255,255,255,0.3)",
                    fontWeight: teamTurn === team && playerIdx[team] === i ? 700 : 400,
                  }}>
                    {teamTurn === team && playerIdx[team] === i ? "▶ " : ""}{name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <SectionCard>
          <div className="grid" style={{ gridTemplateColumns: "1fr auto 1fr", gap: "0.15rem" }}>
            <div className="text-center text-xs font-bold pb-1" style={{ color: TEAM_COLORS[0], fontFamily: "Oswald, sans-serif" }}>Team 1</div>
            <div className="text-center text-xs font-bold pb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>NUM</div>
            <div className="text-center text-xs font-bold pb-1" style={{ color: TEAM_COLORS[1], fontFamily: "Oswald, sans-serif" }}>Team 2</div>
            {CRICKET_NUMS.map((num, idx) => (
              <div key={num} style={{ display: "contents" }}>
                <div className="text-center py-1.5 text-lg font-bold" style={{ fontFamily: "Oswald, sans-serif", color: marks[0][idx] >= 3 ? TEAM_COLORS[0] : "rgba(255,255,255,0.7)" }}>
                  {markSymbol(marks[0][idx])}
                </div>
                <div className="text-center py-1.5 text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)", borderLeft: "1px solid rgba(255,255,255,0.06)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                  {CRICKET_LABELS[idx]}
                </div>
                <div className="text-center py-1.5 text-lg font-bold" style={{ fontFamily: "Oswald, sans-serif", color: marks[1][idx] >= 3 ? TEAM_COLORS[1] : "rgba(255,255,255,0.7)" }}>
                  {markSymbol(marks[1][idx])}
                </div>
              </div>
            ))}
          </div>
          {lastHit && <div className="text-center text-xs mt-2 font-bold" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>Hit: {lastHit}</div>}
        </SectionCard>
        <TurnBanner name={currentPlayer(teamTurn)} turn={teamTurn} msg="— hit 15–20 or Bull" />
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={handleMiss} onUndo={handleUndo}
          activeSegments={CRICKET_NUMS} highlightSegments={CRICKET_NUMS} />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Multi-player Killer Scorer (3–6 individual players) ────────────────────────
export function MultiKillerScorer({ playerNames, lives = 3, onWin, onAbandon }: {
  playerNames: string[];
  lives?: number;
  onWin: (winnerIdx: number, detail?: string) => void;
  onAbandon: () => void;
}) {
  const safeTimeout = useSafeTimeout();
  const n = playerNames.length;
  const MCOLORS = ["#22c55e","#ee0a78","#ffd24a","#38bdf8","#f97316","#a78bfa"];
  const pColor = (i: number) => MCOLORS[i % MCOLORS.length];

  const [phase, setPhase]           = useState<"assign"|"play">("assign");
  const [assigningIdx, setAssigning] = useState(0);
  const [killerNums, setKillerNums] = useState<(number|null)[]>(() => Array(n).fill(null));
  const [isKiller, setIsKiller]     = useState<boolean[]>(() => Array(n).fill(false));
  const [playerLives, setPlayerLives] = useState<number[]>(() => Array(n).fill(lives));
  const [eliminated, setEliminated] = useState<boolean[]>(() => Array(n).fill(false));
  const [turn, setTurn]             = useState(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [msg, setMsg]               = useState("");

  const nextLivingPlayer = useCallback((from: number, elim: boolean[]) => {
    let next = (from + 1) % n;
    for (let i = 0; i < n; i++) {
      if (!elim[next]) return next;
      next = (next + 1) % n;
    }
    return from;
  }, [n]);

  const assignNumber = (num: number) => {
    if (killerNums.includes(num)) return;
    const newNums = [...killerNums];
    newNums[assigningIdx] = num;
    setKillerNums(newNums);
    if (assigningIdx < n - 1) setAssigning(assigningIdx + 1);
    else setPhase("play");
  };

  const handleDart = useCallback((dart: Dart) => {
    if (visitDarts.length >= 3 || phase !== "play") return;
    const capturedTurn = turn;
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);

    const myNum = killerNums[capturedTurn];
    const isMyDouble = dart.multiplier === 2 && dart.segment === myNum;

    if (!isKiller[capturedTurn] && isMyDouble) {
      setIsKiller(prev => { const n2 = [...prev]; n2[capturedTurn] = true; return n2; });
      setMsg(`${playerNames[capturedTurn]} is now a KILLER!`);
      safeTimeout(() => setMsg(""), 2000);
    } else if (isKiller[capturedTurn]) {
      for (let opp = 0; opp < n; opp++) {
        if (opp === capturedTurn || eliminated[opp]) continue;
        if (dart.multiplier === 2 && dart.segment === killerNums[opp]) {
          setPlayerLives(prev => {
            const newL = [...prev];
            newL[opp]--;
            if (newL[opp] <= 0) {
              setEliminated(prevElim => {
                const newElim = [...prevElim];
                newElim[opp] = true;
                setMsg(`${playerNames[opp]} eliminated!`);
                const survivors = newElim.filter(e => !e).length;
                if (survivors === 1) {
                  const winnerIdx = newElim.findIndex(e => !e);
                  safeTimeout(() => onWin(winnerIdx, `${playerNames[winnerIdx]} is the last survivor!`), 500);
                } else {
                  safeTimeout(() => setMsg(""), 2000);
                }
                return newElim;
              });
            } else {
              setMsg(`${playerNames[opp]} loses a life!`);
              safeTimeout(() => setMsg(""), 2000);
            }
            return newL;
          });
          break;
        }
      }
    }

    if (nv.length === 3) {
      setVisitDarts([]);
      setEliminated(elim => {
        const next = nextLivingPlayer(capturedTurn, elim);
        setTurn(next);
        return elim;
      });
    }
  }, [visitDarts, phase, turn, killerNums, isKiller, eliminated, playerNames, n, onWin, nextLivingPlayer]);

  const handleMiss = () => handleDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" });
  const handleUndo = () => { if (visitDarts.length > 0) setVisitDarts(p => p.slice(0, -1)); };

  if (phase === "assign") {
    return (
      <div style={{ maxWidth: "512px", margin: "0 auto", padding: "1rem 0.5rem" }}>
        <div className="pdc-divider" />
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Killer — Pick Numbers</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
            <span style={{ color: pColor(assigningIdx) }}>{playerNames[assigningIdx]}</span> — tap your double (1–20)
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.5rem" }}>
          {Array.from({ length: 20 }, (_, i) => i + 1).map(num => {
            const ownerIdx = killerNums.indexOf(num);
            const taken = ownerIdx !== -1;
            return (
              <button key={num} onClick={() => !taken && assignNumber(num)}
                style={{
                  padding: "0.8rem 0", borderRadius: "0.5rem", fontFamily: "Oswald, sans-serif",
                  fontWeight: 700, fontSize: "1rem", cursor: taken ? "not-allowed" : "pointer",
                  background: taken ? `${pColor(ownerIdx)}22` : "rgba(255,255,255,0.05)",
                  border: taken ? `1.5px solid ${pColor(ownerIdx)}` : "1px solid rgba(255,255,255,0.1)",
                  color: taken ? pColor(ownerIdx) : "rgba(255,255,255,0.8)",
                }}>D{num}
              </button>
            );
          })}
        </div>
        <div className="grid mt-4" style={{ gridTemplateColumns: `repeat(${Math.min(n, 3)},1fr)`, gap: "0.5rem" }}>
          {playerNames.map((name, i) => (
            <div key={i} className="pdc-card p-2 text-center" style={{ borderColor: killerNums[i] !== null ? pColor(i) : "rgba(255,255,255,0.06)" }}>
              <div className="text-xs" style={{ color: pColor(i), fontFamily: "Oswald, sans-serif" }}>{name}</div>
              <div className="text-lg font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>
                {killerNums[i] !== null ? `D${killerNums[i]}` : "—"}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4"><AbandonBtn onAbandon={onAbandon} /></div>
      </div>
    );
  }

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <h2 className="text-2xl font-bold uppercase text-center" style={{ fontFamily: "Oswald, sans-serif" }}>
          Killer — {n} Players
        </h2>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(n, 3)},1fr)` }}>
          {playerNames.map((name, i) => (
            <div key={i} className="pdc-card p-3 text-center"
              style={{ borderColor: turn === i && !eliminated[i] ? pColor(i) : "rgba(255,255,255,0.06)", opacity: eliminated[i] ? 0.35 : 1 }}>
              <div className="text-xs font-bold uppercase" style={{ color: pColor(i), fontFamily: "Oswald, sans-serif" }}>{name}</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>D{killerNums[i]}</div>
              <div className="text-sm font-bold mt-0.5" style={{ fontFamily: "Oswald, sans-serif", color: eliminated[i] ? "rgba(255,255,255,0.2)" : isKiller[i] ? "#ffd24a" : "rgba(255,255,255,0.3)" }}>
                {eliminated[i] ? "💀 OUT" : isKiller[i] ? "☠ KILLER" : "○"}
              </div>
              <div className="flex justify-center gap-0.5 mt-1">
                {Array.from({ length: lives }).map((_, li) => (
                  <span key={li} style={{ fontSize: "0.75rem", opacity: li < playerLives[i] ? 1 : 0.15 }}>❤</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {msg && <div className="text-center font-bold text-sm" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>{msg}</div>}
        {!eliminated[turn] && (
          <div className="flex items-center justify-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
            <Zap className="w-3.5 h-3.5" style={{ color: pColor(turn) }} />
            <span style={{ color: pColor(turn), fontWeight: 700 }}>{playerNames[turn]}</span>
            <span className="uppercase tracking-wider text-xs">
              {!isKiller[turn] ? `— hit D${killerNums[turn]} to become Killer` : `— hit an opponent's double`}
            </span>
          </div>
        )}
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={handleMiss} onUndo={handleUndo}
          highlightSegments={killerNums.filter((num): num is number => num !== null)} />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Doubles Team Cricket Scorer (fixed 2-player-per-side variant) ─────────────
export function DoublesTeamCricketScorer({ team1, team2, cutThroat = false, includesBull = true, onWin, onAbandon }: {
  team1: [string, string]; team2: [string, string];
  cutThroat?: boolean; includesBull?: boolean;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
}) {
  const safeTimeout = useSafeTimeout();
  const numCount = includesBull ? 7 : 6;
  const [marks, setMarks]       = useState<[[number,number,number,number,number,number,number],[number,number,number,number,number,number,number]]>([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]);
  const [scores, setScores]     = useState<[number,number]>([0,0]);
  const [turn, setTurn]         = useState<0|1>(0);
  const [active, setActive]     = useState<[0|1, 0|1]>([0, 0]);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [lastHit, setLastHit]   = useState<string>("");

  const teams = [team1, team2] as [[string, string], [string, string]];
  const TC = (i: 0|1) => i === 0 ? "#22c55e" : "#ee0a78";

  const checkWin = (m: typeof marks, sc: [number,number]): 0|1|null => {
    for (const p of [0,1] as const) {
      const closed = m[p].slice(0, numCount).every(x => x >= 3);
      if (!closed) continue;
      const opp: 0|1 = p === 0 ? 1 : 0;
      if (!cutThroat && sc[p] >= sc[opp]) return p;
      if (cutThroat && sc[p] <= sc[opp]) return p;
    }
    return null;
  };

  const handleDart = useCallback((dart: Dart) => {
    if (visitDarts.length >= 3) return;
    if (!includesBull && dart.segment === 25) {
      const nv = [...visitDarts, dart];
      setVisitDarts(nv);
      setLastHit("Miss (no bull)");
      if (nv.length === 3) {
        setVisitDarts([]); setLastHit("");
        setActive(prev => { const n = [...prev] as [0|1, 0|1]; n[turn] = n[turn] === 0 ? 1 : 0; return n; });
        setTurn(t => t===0?1:0);
      }
      return;
    }
    const numIdx = CRICKET_NUMS.indexOf(dart.segment);
    const nv = [...visitDarts, dart];
    if (numIdx >= 0) {
      const hits = dart.multiplier;
      setMarks(prev => {
        const nm: typeof marks = [[...prev[0]] as any, [...prev[1]] as any];
        const toClose = Math.max(0, 3 - nm[turn][numIdx]);
        const absorbed = Math.min(hits, toClose);
        const extra = hits - absorbed;
        nm[turn][numIdx] = Math.min(3, nm[turn][numIdx] + absorbed + extra);
        if (extra > 0) {
          const opp: 0|1 = turn === 0 ? 1 : 0;
          if (nm[opp][numIdx] < 3) {
            setScores(ps => {
              const ns: [number,number] = [...ps] as [number,number];
              const val = CRICKET_NUMS[numIdx];
              if (cutThroat) ns[opp] += extra * val;
              else ns[turn] += extra * val;
              return ns;
            });
          }
        }
        return nm;
      });
      const lbl = dart.multiplier === 1 ? `${dart.segment}` : dart.multiplier === 2 ? `D${dart.segment}` : `T${dart.segment}`;
      setLastHit(lbl);
    } else {
      setLastHit("Miss");
    }
    setVisitDarts(nv);
    if (nv.length === 3) {
      setVisitDarts([]); setLastHit("");
      setActive(prev => { const n = [...prev] as [0|1, 0|1]; n[turn] = n[turn] === 0 ? 1 : 0; return n; });
      setTurn(t => t===0?1:0);
    }
    safeTimeout(() => {
      setMarks(m => {
        setScores(sc => {
          const w = checkWin(m, sc);
          if (w !== null) safeTimeout(() => onWin(w, cutThroat ? "Cut-Throat — lowest score wins" : undefined), 300);
          return sc;
        });
        return m;
      });
    }, 50);
  }, [visitDarts, turn, cutThroat, includesBull, numCount, onWin]);

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily:"Oswald,sans-serif" }}>{cutThroat ? "Cut-Throat Cricket" : "Cricket"} Doubles</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([0,1] as const).map(i => (
            <div key={i} className="pdc-card p-3 text-center relative overflow-hidden" style={{ borderColor:turn===i?TC(i):"rgba(255,255,255,0.06)", boxShadow:turn===i?`0 0 20px ${TC(i)}22`:undefined }}>
              {turn === i && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background:TC(i) }} />}
              <div className="text-xs font-bold uppercase mb-0.5" style={{ fontFamily:"Oswald,sans-serif", color:TC(i), opacity:turn===i?1:0.5, letterSpacing:"0.08em" }}>Team {i+1}</div>
              <div className="font-black" style={{ fontFamily:"Oswald,sans-serif", fontSize:"2rem", color:turn===i?"#fff":"rgba(255,255,255,0.3)", lineHeight:1 }}>{scores[i]}</div>
              <div className="mt-1.5 space-y-0.5">
                {teams[i].map((name, j) => {
                  const isActive = turn===i && active[i]===j;
                  return <div key={j} className="text-xs flex items-center justify-center gap-1" style={{ fontFamily:"Oswald,sans-serif", color:isActive?TC(i):"rgba(255,255,255,0.3)", fontWeight:isActive?700:400 }}>
                    {isActive && <span style={{ fontSize:"0.55rem" }}>▶</span>}{name}
                  </div>;
                })}
              </div>
            </div>
          ))}
        </div>
        <SectionCard>
          <div className="grid" style={{ gridTemplateColumns:"1fr auto 1fr", gap:"0.15rem" }}>
            <div className="text-center text-xs font-bold pb-1" style={{ color:TC(0), fontFamily:"Oswald,sans-serif" }}>{team1[active[0]].toUpperCase()}</div>
            <div className="text-center text-xs font-bold pb-1" style={{ color:"rgba(255,255,255,0.3)", fontFamily:"Oswald,sans-serif" }}>NUM</div>
            <div className="text-center text-xs font-bold pb-1" style={{ color:TC(1), fontFamily:"Oswald,sans-serif" }}>{team2[active[1]].toUpperCase()}</div>
            {CRICKET_NUMS.slice(0, numCount).map((num, idx) => (
              <div key={num} style={{ display:"contents" }}>
                <div className="text-center py-2 text-lg font-bold" style={{ fontFamily:"Oswald,sans-serif", color:marks[0][idx]>=3?TC(0):"rgba(255,255,255,0.7)" }}>{markSymbol(marks[0][idx])}</div>
                <div className="text-center py-2 text-sm font-bold" style={{ fontFamily:"Oswald,sans-serif", color:"rgba(255,255,255,0.4)", borderLeft:"1px solid rgba(255,255,255,0.06)", borderRight:"1px solid rgba(255,255,255,0.06)" }}>{CRICKET_LABELS[idx]}</div>
                <div className="text-center py-2 text-lg font-bold" style={{ fontFamily:"Oswald,sans-serif", color:marks[1][idx]>=3?TC(1):"rgba(255,255,255,0.7)" }}>{markSymbol(marks[1][idx])}</div>
              </div>
            ))}
          </div>
          {lastHit && <div className="text-center text-xs mt-2 font-bold" style={{ color:"#ffd24a", fontFamily:"Oswald,sans-serif" }}>Hit: {lastHit}</div>}
        </SectionCard>
        <TurnBanner name={teams[turn][active[turn]]} turn={turn} msg={includesBull ? "— hit 15–20 or Bull" : "— hit 15–20 (no bull)"} />
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart}
          onMiss={() => handleDart({ segment:0, multiplier:1, value:0, label:"Miss" })}
          onUndo={() => visitDarts.length > 0 && setVisitDarts(p => p.slice(0,-1))}
          activeSegments={CRICKET_NUMS.slice(0, numCount)} highlightSegments={CRICKET_NUMS.slice(0, numCount)}
        />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Team Halve-It Scorer ───────────────────────────────────────────────────────
export function TeamHalveItScorer({ team1, team2, gameKey, onWin, onAbandon }: {
  team1: [string, string]; team2: [string, string]; gameKey: string;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
}) {
  const safeTimeout = useSafeTimeout();
  const isBobs = gameKey === "bobs_27";
  const targets = isBobs ? Array.from({length:20},(_,i)=>i+1) : HALVEIT_TARGETS;
  const targetLabels = isBobs ? targets.map(n=>`D${n}`) : HALVEIT_LABELS;

  const [round, setRound]           = useState(0);
  const [turn, setTurn]             = useState<0|1>(0);
  const [active, setActive]         = useState<[0|1, 0|1]>([0, 0]);
  const [scores, setScores]         = useState<[number,number]>(isBobs ? [27,27] : [0,0]);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [roundScore, setRoundScore] = useState(0);
  const [hit, setHit]               = useState(false);

  const teams = [team1, team2] as [[string, string], [string, string]];
  const TC = (i: 0|1) => i === 0 ? "#22c55e" : "#ee0a78";
  const curTarget = targets[round];

  const dartHitsTarget = (dart: Dart): boolean => {
    if (isBobs) { const n = targets[round] as number; return dart.segment === n && dart.multiplier === 2; }
    if (curTarget === "D") return dart.multiplier === 2;
    if (curTarget === "T") return dart.multiplier === 3;
    if (curTarget === "Bull") return dart.segment === 25;
    return dart.segment === curTarget;
  };

  const handleDart = (dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);
    if (dartHitsTarget(dart)) { setHit(true); setRoundScore(prev => prev + dart.value); }
    if (nv.length === 3) {
      const hitTarget = hit || dartHitsTarget(dart);
      const rs = roundScore + (dartHitsTarget(dart) ? dart.value : 0);
      setScores(prev => {
        const ns: [number,number] = [...prev] as [number,number];
        if (hitTarget || rs > 0) ns[turn] += rs;
        else if (isBobs) ns[turn] -= (targets[round] as number) * 2;
        else ns[turn] = Math.floor(ns[turn] / 2);
        return ns;
      });
      setVisitDarts([]); setRoundScore(0); setHit(false);
      setActive(prev => { const n = [...prev] as [0|1, 0|1]; n[turn] = n[turn]===0?1:0; return n; });
      if (turn === 1) {
        if (round + 1 >= targets.length) {
          safeTimeout(() => { setScores(sc => { onWin(sc[0]>=sc[1]?0:1, `${sc[0]} vs ${sc[1]}`); return sc; }); }, 300);
        } else { setRound(r => r+1); setTurn(0); }
      } else { setTurn(1); }
    }
  };

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily:"Oswald,sans-serif" }}>{isBobs ? "Bob's 27" : "Halve-It"} Doubles</h2>
          <p className="text-sm" style={{ color:"#ffd24a", fontFamily:"Oswald,sans-serif" }}>Round {round+1}/{targets.length} — Target: {targetLabels[round]}</p>
          {!isBobs && <p className="text-xs" style={{ color:"rgba(255,255,255,0.3)" }}>Miss = team score halved</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([0,1] as const).map(i => (
            <div key={i} className="pdc-card p-3 text-center relative overflow-hidden" style={{ borderColor:turn===i?TC(i):"rgba(255,255,255,0.06)", boxShadow:turn===i?`0 0 20px ${TC(i)}22`:undefined }}>
              {turn === i && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background:TC(i) }} />}
              <div className="text-xs font-bold uppercase mb-0.5" style={{ fontFamily:"Oswald,sans-serif", color:TC(i), opacity:turn===i?1:0.5, letterSpacing:"0.08em" }}>Team {i+1}</div>
              <div className="font-black" style={{ fontFamily:"Oswald,sans-serif", fontSize:"2.2rem", color:turn===i?"#fff":"rgba(255,255,255,0.3)", lineHeight:1 }}>{scores[i]}</div>
              <div className="mt-1.5 space-y-0.5">
                {teams[i].map((name, j) => {
                  const isActive = turn===i && active[i]===j;
                  return <div key={j} className="text-xs flex items-center justify-center gap-1" style={{ fontFamily:"Oswald,sans-serif", color:isActive?TC(i):"rgba(255,255,255,0.3)", fontWeight:isActive?700:400 }}>
                    {isActive && <span style={{ fontSize:"0.55rem" }}>▶</span>}{name}
                  </div>;
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-1 flex-wrap justify-center">
          {targets.map((t, i) => (
            <div key={i} style={{ width:"2rem",height:"2rem",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontFamily:"Oswald,sans-serif",background:i<round?"rgba(34,197,94,0.2)":i===round?"rgba(255,210,74,0.2)":"rgba(255,255,255,0.05)",border:i===round?"1.5px solid #ffd24a":i<round?"1px solid rgba(34,197,94,0.4)":"1px solid rgba(255,255,255,0.08)",color:i<round?"#22c55e":i===round?"#ffd24a":"rgba(255,255,255,0.3)" }}>
              {typeof t === "number" ? (isBobs ? `D${t}` : `${t}`) : t}
            </div>
          ))}
        </div>
        <TurnBanner name={teams[turn][active[turn]]} turn={turn} msg={`— hit ${targetLabels[round]}`} />
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart}
          onMiss={() => handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={() => visitDarts.length > 0 && setVisitDarts(p=>p.slice(0,-1))}
          highlightSegments={typeof curTarget==="number"?[curTarget]:curTarget==="Bull"?[25]:undefined}
        />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Team Count Up Scorer ───────────────────────────────────────────────────────
export function TeamCountUpScorer({ team1, team2, config, onWin, onAbandon }: {
  team1: [string, string]; team2: [string, string];
  config: { target?: number; rounds?: number; bullsOnly?: boolean };
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
}) {
  const safeTimeout = useSafeTimeout();
  const target    = config.target ?? 501;
  const maxRounds = config.rounds ?? 0;
  const bullsOnly = config.bullsOnly ?? false;

  const [scores, setScores]         = useState<[number,number]>([0,0]);
  const [rounds, setRounds]         = useState<[number,number]>([0,0]);
  const [turn, setTurn]             = useState<0|1>(0);
  const [active, setActive]         = useState<[0|1, 0|1]>([0, 0]);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);

  const teams = [team1, team2] as [[string, string], [string, string]];
  const TC = (i: 0|1) => i === 0 ? "#22c55e" : "#ee0a78";

  const handleDart = (dart: Dart) => {
    if (visitDarts.length >= 3) return;
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);
    if (nv.length === 3) {
      const bullHits = nv.filter(d => d.segment === 25).length;
      const cum = bullsOnly ? bullHits : nv.reduce((s,d) => s+d.value, 0);
      setScores(prev => {
        const ns: [number,number] = [...prev] as [number,number];
        ns[turn] += cum;
        if (maxRounds === 0 && ns[turn] >= target) {
          const label = bullsOnly ? `${ns[turn]} bulls!` : `Reached ${target} pts!`;
          safeTimeout(() => onWin(turn, label), 300);
        }
        return ns;
      });
      setRounds(prev => {
        const nr: [number,number] = [...prev] as [number,number];
        nr[turn]++;
        if (maxRounds > 0 && nr[0] >= maxRounds && nr[1] >= maxRounds) {
          safeTimeout(() => { setScores(sc => { onWin(sc[0]>=sc[1]?0:1, `${sc[0]} vs ${sc[1]}`); return sc; }); }, 300);
        }
        return nr;
      });
      setVisitDarts([]);
      setActive(prev => { const n = [...prev] as [0|1, 0|1]; n[turn] = n[turn]===0?1:0; return n; });
      setTurn(t => t===0?1:0);
    }
  };

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily:"Oswald,sans-serif" }}>
            {bullsOnly ? "Bull Rush Doubles" : maxRounds > 0 ? "High Score Doubles" : "Count Up Doubles"}
          </h2>
          <p className="text-xs mt-1" style={{ color:"rgba(255,255,255,0.3)" }}>
            {bullsOnly ? "Only bull hits count" : maxRounds > 0 ? `${maxRounds} rounds each` : `Race to ${target}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([0,1] as const).map(i => (
            <div key={i} className="pdc-card p-3 text-center relative overflow-hidden" style={{ borderColor:turn===i?TC(i):"rgba(255,255,255,0.06)", boxShadow:turn===i?`0 0 20px ${TC(i)}22`:undefined }}>
              {turn === i && <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background:TC(i) }} />}
              <div className="text-xs font-bold uppercase mb-0.5" style={{ fontFamily:"Oswald,sans-serif", color:TC(i), opacity:turn===i?1:0.5, letterSpacing:"0.08em" }}>Team {i+1}</div>
              <div className="font-black" style={{ fontFamily:"Oswald,sans-serif", fontSize:"2.2rem", color:turn===i?"#fff":"rgba(255,255,255,0.3)", lineHeight:1 }}>{scores[i]}</div>
              <div className="text-xs" style={{ color:"rgba(255,255,255,0.2)", fontFamily:"Oswald,sans-serif" }}>
                {maxRounds>0?`${rounds[i]}/${maxRounds} rounds`:`Target: ${target}`}
              </div>
              <div className="mt-1.5 space-y-0.5">
                {teams[i].map((name, j) => {
                  const isActive = turn===i && active[i]===j;
                  return <div key={j} className="text-xs flex items-center justify-center gap-1" style={{ fontFamily:"Oswald,sans-serif", color:isActive?TC(i):"rgba(255,255,255,0.3)", fontWeight:isActive?700:400 }}>
                    {isActive && <span style={{ fontSize:"0.55rem" }}>▶</span>}{name}
                  </div>;
                })}
              </div>
            </div>
          ))}
        </div>
        <TurnBanner name={teams[turn][active[turn]]} turn={turn} msg={bullsOnly ? "— aim at Bull!" : "— score as many as you can"} />
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart}
          onMiss={() => handleDart({segment:0,multiplier:1,value:0,label:"Miss"})}
          onUndo={() => visitDarts.length > 0 && setVisitDarts(p=>p.slice(0,-1))}
          highlightSegments={bullsOnly?[25]:undefined}
        />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── 99 Darts Scorer ────────────────────────────────────────────────────────────
export function NinetyNineDartsScorer({ p1Name, config, onWin, onAbandon, onPracticeStats }: {
  p1Name: string;
  config: { variant?: "standard" | "doubles" | "trebles" };
  onWin: (w: 0|1, d?: string) => void;
  onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const variant = config.variant ?? "standard";
  const [target, setTarget]         = useState<number | null>(null);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [dartsThrown, setDartsThrown] = useState(0);
  const [score, setScore]           = useState(0);
  const [done, setDone]             = useState(false);
  const [flashMsg, setFlashMsg]     = useState<string | null>(null);

  const TOTAL_DARTS = 99;
  const variantLabel = variant === "doubles" ? "Doubles" : variant === "trebles" ? "Trebles" : "Standard";
  const maxPerDart   = variant === "standard" ? 3 : 1;
  const maxScore     = TOTAL_DARTS * maxPerDart;

  const siteBg: React.CSSProperties = {
    backgroundImage: "linear-gradient(rgba(4,4,10,0.84), rgba(4,4,10,0.92)), url('https://i.postimg.cc/Bbf9fbrp/pdc1.jpg')",
    backgroundSize: "cover", backgroundPosition: "center",
  };

  function getDartScore(dart: Dart, t: number): number {
    if (dart.segment !== t) return 0;
    if (variant === "standard") return dart.multiplier;
    if (variant === "doubles")  return dart.multiplier === 2 ? 1 : 0;
    if (variant === "trebles")  return dart.multiplier === 3 ? 1 : 0;
    return 0;
  }

  const handleDart = (dart: Dart) => {
    if (target === null || done || visitDarts.length >= 3) return;
    const t = target;
    const pts = getDartScore(dart, t);
    if (pts > 0) {
      const label = variant === "standard"
        ? (dart.multiplier === 3 ? "TREBLE!" : dart.multiplier === 2 ? "Double!" : "Hit!")
        : "HIT!";
      setFlashMsg(`${label} +${pts}`);
      safeTimeout(() => setFlashMsg(null), 800);
    }
    const nv = [...visitDarts, dart];
    setVisitDarts(nv);
    if (nv.length === 3) {
      const visitPts = nv.reduce((acc, d) => acc + getDartScore(d, t), 0);
      setScore(prev => {
        const ns = prev + visitPts;
        const newDarts = dartsThrown + 3;
        if (newDarts >= TOTAL_DARTS) {
          setDone(true);
          const pct = Math.round((ns / maxScore) * 100);
          safeTimeout(() => {
            onPracticeStats?.({ sessionData: { mode: "99darts" } });
            onWin(0, `${ns}/${maxScore} (${pct}%)`);
          }, 1000);
        }
        return ns;
      });
      setDartsThrown(prev => prev + 3);
      setVisitDarts([]);
    }
  };

  const handleMiss = () => handleDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" });
  const handleUndo = () => {
    if (visitDarts.length > 0) setVisitDarts(p => p.slice(0, -1));
  };

  // ── Setup screen ─────────────────────────────────────────────────────────────
  if (target === null) {
    const nums = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
    const rule = variant === "standard"
      ? "S = 1pt · D = 2pts · T = 3pts"
      : variant === "doubles"
      ? "Only doubles count · 1 pt per hit · max 99"
      : "Only trebles count · 1 pt per hit · max 99";
    return (
      <div style={{ minHeight:"100dvh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"1.5rem", ...siteBg }}>
        <div className="text-center mb-6">
          <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color:"#00c8a0", fontFamily:"Oswald,sans-serif" }}>
            99 Darts · {variantLabel}
          </div>
          <h2 className="text-3xl font-black uppercase" style={{ fontFamily:"Oswald,sans-serif", color:"#fff" }}>
            Pick Your Target
          </h2>
          <p className="text-xs mt-2" style={{ color:"rgba(255,255,255,0.3)" }}>{rule}</p>
        </div>
        <div className="grid grid-cols-5 gap-2 mb-3" style={{ maxWidth:"17rem" }}>
          {nums.map(n => (
            <button key={n} onClick={() => setTarget(n)}
              className="rounded-lg font-black text-lg transition-all active:scale-95 hover:brightness-125"
              style={{ fontFamily:"Oswald,sans-serif", padding:"0.55rem 0", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#fff" }}>
              {n}
            </button>
          ))}
        </div>
        {variant !== "trebles" && (
          <button onClick={() => setTarget(25)}
            className="rounded-lg font-black text-sm transition-all active:scale-95 hover:brightness-125 mb-6"
            style={{ fontFamily:"Oswald,sans-serif", padding:"0.55rem 2.5rem", background:"rgba(255,0,92,0.15)", border:"1px solid rgba(255,0,92,0.4)", color:"#ff005c" }}>
            Bull
          </button>
        )}
        {variant === "trebles" && <div className="mb-6" />}
        <button onClick={onAbandon} className="text-xs" style={{ color:"rgba(255,255,255,0.2)" }}>← Back</button>
      </div>
    );
  }

  // ── Active / done ─────────────────────────────────────────────────────────────
  const targetLabel = target === 25 ? "Bull" : String(target);
  const dartsInFlight = dartsThrown + visitDarts.length;
  const remaining = TOTAL_DARTS - dartsInFlight;
  const visitNum  = Math.floor(dartsThrown / 3) + 1;
  const pct = dartsInFlight > 0 ? Math.round((score / (dartsInFlight * maxPerDart)) * 100) : 0;

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily:"Oswald,sans-serif", color:"#00c8a0" }}>
            99 Darts at {targetLabel} · {variantLabel}
          </div>
          <div className="text-xs mt-0.5" style={{ color:"rgba(255,255,255,0.25)", fontFamily:"Oswald,sans-serif" }}>{p1Name}</div>
        </div>
        <div className="pdc-divider" />
        <div className="flex items-center justify-around px-4">
          <div className="text-center">
            <div className="text-5xl font-black" style={{ fontFamily:"Oswald,sans-serif", color:"#ffd24a" }}>{score}</div>
            <div className="text-xs mt-1" style={{ color:"rgba(255,255,255,0.25)" }}>/ {maxScore} max</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black" style={{ fontFamily:"Oswald,sans-serif", color: pct >= 60 ? "#00c8a0" : pct >= 30 ? "#ffd24a" : "rgba(255,255,255,0.5)" }}>
              {pct}%
            </div>
            <div className="text-xs mt-1" style={{ color:"rgba(255,255,255,0.25)" }}>accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black" style={{ fontFamily:"Oswald,sans-serif", color:"rgba(255,255,255,0.6)" }}>{remaining}</div>
            <div className="text-xs mt-1" style={{ color:"rgba(255,255,255,0.25)" }}>darts left</div>
          </div>
        </div>
        <div className="px-4">
          <div className="flex items-center justify-between mb-1" style={{ color:"rgba(255,255,255,0.2)", fontFamily:"Oswald,sans-serif", fontSize:"0.6rem", letterSpacing:"0.08em" }}>
            <span>VISIT {done ? 33 : visitNum} / 33</span>
            <span>{dartsInFlight} / {TOTAL_DARTS} DARTS</span>
          </div>
          <div className="w-full rounded-full" style={{ height:4, background:"rgba(255,255,255,0.06)" }}>
            <div className="rounded-full transition-all duration-300" style={{ height:4, width:`${(dartsInFlight / TOTAL_DARTS)*100}%`, background:"#00c8a0" }} />
          </div>
        </div>
        {flashMsg && (
          <div className="text-center font-black" style={{ fontFamily:"Oswald,sans-serif", color:"#00c8a0", fontSize:"1rem" }}>{flashMsg}</div>
        )}
        <VisitDarts darts={visitDarts} />
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard
          onDart={handleDart}
          onMiss={handleMiss}
          onUndo={handleUndo}
          disabled={done}
          highlightSegments={[target]}
        />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Master-501 Scorer ──────────────────────────────────────────────────────────
// Solo 501 double-out vs a per-leg dart budget. Exceed the budget = leg loss.
export function Master501Scorer({
  playerName, dartLimit, legs, legsNeeded, tierName, tierColor, onMatchResult, onAbandon, onPracticeStats,
}: {
  playerName: string;
  dartLimit:  number;
  legs:       number;
  legsNeeded: number;
  tierName:   string;
  tierColor:  string;
  onMatchResult: (result: "win" | "loss", legsWon: number, legsLost: number) => void;
  onAbandon:  () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const safeTimeout = useSafeTimeout();
  const START = 501;
  const [score,      setScore]      = useState(START);
  const [legWins,    setLegWins]    = useState(0);
  const [legLosses,  setLegLosses]  = useState(0);
  const [dil,        setDil]        = useState(0);   // darts in current leg (committed)
  const [visitDarts, setVD]         = useState<Dart[]>([]);
  const [bust,       setBust]       = useState(false);
  const [bustMsg,    setBustMsg]    = useState("");
  const [flash,      setFlash]      = useState("");
  const [legDone,    setLegDone]    = useState<"win" | "loss" | null>(null);
  const [matchDone,  setMatchDone]  = useState<"win" | "loss" | null>(null);
  const { fs, toggle: toggleFs }    = useFullscreen();
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  const legWinsRef   = useRef(0);
  const legLossesRef = useRef(0);
  const losingThreshold = legsNeeded; // symmetric best-of (e.g. BO5→3, BO9→5, BO11→6)

  // Dart-by-dart tracking for session history
  const dartLogRef    = useRef<DartThrow[]>([]);
  const totalScoreRef = useRef(0);
  const s180sRef      = useRef(0);
  const coAttRef      = useRef(0);
  const coHitsRef     = useRef(0);

  const dartsUsed = dil + visitDarts.length;
  const dartsLeft = dartLimit - dartsUsed;
  const frac      = Math.max(0, dartsLeft) / dartLimit;
  const dColor    = frac > 0.5 ? "#22c55e" : frac > 0.2 ? "#ffd24a" : "#ff005c";

  // Notify parent after match is decided — emit stats first, then result after 1500ms
  useEffect(() => {
    if (!matchDone) return;
    onPracticeStats?.({
      p1Darts: dartLogRef.current.length,
      p1Score: totalScoreRef.current,
      p1_180s: s180sRef.current,
      p1CheckoutAttempts: coAttRef.current,
      p1CheckoutHits: coHitsRef.current,
      dartLog: [...dartLogRef.current],
    });
    const t = safeTimeout(() => onMatchResult(matchDone, legWinsRef.current, legLossesRef.current), 1500);
    return () => clearTimeout(t);
  }, [matchDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetLeg = useCallback(() => {
    safeTimeout(() => {
      setScore(START); setDil(0); setVD([]);
      setBust(false); setBustMsg(""); setLegDone(null); setFlash("");
    }, 2000);
  }, []);

  const winLeg = useCallback(() => {
    setFlash("🎯 LEG WON!");
    setLegDone("win");
    setLegWins(prev => {
      const n = prev + 1; legWinsRef.current = n;
      if (n >= legsNeeded) { setMatchDone("win"); } else { resetLeg(); }
      return n;
    });
  }, [legsNeeded, resetLeg]);

  const lossLeg = useCallback(() => {
    setFlash("❌ DARTS EXHAUSTED");
    setLegDone("loss");
    setLegLosses(prev => {
      const n = prev + 1; legLossesRef.current = n;
      if (n >= losingThreshold) { setMatchDone("loss"); } else { resetLeg(); }
      return n;
    });
  }, [losingThreshold, resetLeg]);

  const handleDart = useCallback((dart: Dart) => {
    if (bust || legDone || matchDone) return;
    if (visitDarts.length >= 3) return;
    if (dil >= dartLimit) return; // guard: dart limit already triggered

    // Track dart in session log
    const phase: "scoring" | "checkout" = score <= 170 ? "checkout" : "scoring";
    dartLogRef.current.push({ seg: dart.segment, mult: dart.multiplier, val: dart.value, phase });
    if (visitDarts.length === 0 && score <= 170) coAttRef.current++;

    const nv  = [...visitDarts, dart];
    const cum = nv.reduce((s, d) => s + d.value, 0);
    const rem = score - cum;

    if (rem < 0 || rem === 1) {
      const newDil = dil + nv.length;
      setDil(newDil); setBust(true);
      setBustMsg(rem < 0 ? "BUST — overshot!" : "BUST — can't leave 1!");
      safeTimeout(() => {
        setBust(false); setBustMsg(""); setVD([]);
        if (newDil >= dartLimit) lossLeg();
      }, 1200);
      return;
    }

    if (rem === 0) {
      const valid = dart.multiplier === 2 || (dart.segment === 25 && dart.value === 50);
      const newDil = dil + nv.length;
      setDil(newDil);
      if (valid) { totalScoreRef.current += score; coHitsRef.current++; setVD(nv); winLeg(); return; }
      setBust(true); setBustMsg("BUST — must finish on a double!");
      safeTimeout(() => {
        setBust(false); setBustMsg(""); setVD([]);
        if (newDil >= dartLimit) lossLeg();
      }, 1200);
      return;
    }

    setVD(nv);
    if (nv.length === 3) {
      const newDil = dil + 3;
      totalScoreRef.current += cum;
      if (cum === 180) s180sRef.current++;
      setDil(newDil); setScore(prev => prev - cum); setVD([]);
      if (newDil >= dartLimit) safeTimeout(() => lossLeg(), 400);
    }
  }, [bust, legDone, matchDone, visitDarts, score, dil, dartLimit, winLeg, lossLeg]);

  const handleMiss = () => handleDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" });
  const handleUndo = () => {
    if (!bust && visitDarts.length > 0) {
      dartLogRef.current = dartLogRef.current.slice(0, -1);
      setVD(prev => prev.slice(0, -1));
    }
  };

  // Leg status dots
  const wDots = Array.from({ length: legsNeeded },   (_, i) => i < legWins   ? "win"  : "empty");
  const lDots = Array.from({ length: losingThreshold }, (_, i) => i < legLosses ? "loss" : "empty");

  const isDisabled = !!(bust || legDone || matchDone);

  // Live checkout: update after every dart thrown in the current visit
  const cumRender     = visitDarts.reduce((s, d) => s + d.value, 0);
  const liveScore501  = score - cumRender;
  const m501Checkout  = (!bust && !legDone && liveScore501 >= 2 && liveScore501 <= 170)
    ? CHECKOUTS[liveScore501] : undefined;

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ fontFamily: "Oswald,sans-serif", background: tierColor + "20", color: tierColor, border: `1px solid ${tierColor}40` }}>
              {tierName}
            </div>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald,sans-serif", letterSpacing: "0.08em" }}>MASTER-501</span>
          </div>
          <button onClick={toggleFs} className={isMobile ? "" : "opacity-30 hover:opacity-100 transition-opacity"}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", color: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.7rem", fontFamily: "Oswald,sans-serif", fontWeight: 700, letterSpacing: "0.08em", cursor: "pointer" }}>
            {fs ? <Minimize size={13} /> : <Maximize size={13} />}
            {fs ? "EXIT FULL" : "FULLSCREEN"}
          </button>
        </div>
        <div className="pdc-divider" />

        {/* Score + Dart counter */}
        <div className="flex gap-3">
          <div className="flex-1 rounded-xl px-3 py-3 text-center" style={{ background: "rgba(34,197,94,0.07)", border: "2px solid rgba(34,197,94,0.3)" }}>
            <div className="text-xs mb-1 uppercase tracking-wider" style={{ fontFamily: "Oswald,sans-serif", color: "rgba(255,255,255,0.35)", fontSize: "0.62rem" }}>
              {playerName.slice(0, 12).toUpperCase()}
            </div>
            <div className="font-black" style={{ fontFamily: "Oswald,sans-serif", fontSize: "3.2rem", color: "#fff", lineHeight: 1 }}>{score}</div>
          </div>
          <div className="flex-1 rounded-xl px-3 py-3 text-center" style={{ background: dColor + "0f", border: `2px solid ${dColor}55`, transition: "border-color 0.3s" }}>
            <div className="text-xs mb-1 uppercase tracking-wider" style={{ fontFamily: "Oswald,sans-serif", color: "rgba(255,255,255,0.35)", fontSize: "0.62rem" }}>DARTS LEFT</div>
            <div className="font-black" style={{ fontFamily: "Oswald,sans-serif", fontSize: "3.2rem", color: dColor, lineHeight: 1, transition: "color 0.3s" }}>
              {Math.max(0, dartsLeft)}
            </div>
            <div className="w-full rounded-full mt-1" style={{ height: 3, background: "rgba(255,255,255,0.07)" }}>
              <div className="rounded-full transition-all duration-300" style={{ height: 3, width: `${frac * 100}%`, background: dColor }} />
            </div>
            <div style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald,sans-serif", fontSize: "0.58rem", marginTop: 2 }}>of {dartLimit}</div>
          </div>
        </div>

        {/* Leg tracker */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            {wDots.map((d, i) => (
              <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: d === "win" ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.04)", border: `1.5px solid ${d === "win" ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.1)"}`, fontSize: 9, color: d === "win" ? "#22c55e" : "transparent" }}>
                ✓
              </div>
            ))}
            <span className="ml-1 text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald,sans-serif", fontSize: "0.58rem" }}>/{legsNeeded} WIN</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald,sans-serif", fontSize: "0.58rem" }}>LOSE/</span>
            {lDots.map((d, i) => (
              <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{ background: d === "loss" ? "rgba(255,0,92,0.18)" : "rgba(255,255,255,0.04)", border: `1.5px solid ${d === "loss" ? "rgba(255,0,92,0.5)" : "rgba(255,255,255,0.1)"}`, fontSize: 9, color: d === "loss" ? "#ff005c" : "transparent" }}>
                ✗
              </div>
            ))}
          </div>
        </div>

        <VisitDarts darts={visitDarts} />

        {m501Checkout && <CheckoutBar checkout={m501Checkout} playerName={playerName} playerIdx={0} />}

        {(bust || flash) && (
          <div className="text-center font-black py-1" style={{ fontFamily: "Oswald,sans-serif", fontSize: "1.1rem", color: bust ? "#ff005c" : (legDone === "win" ? "#22c55e" : "#ff005c") }}>
            {bust ? bustMsg : flash}
          </div>
        )}
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={handleMiss} onUndo={handleUndo} disabled={isDisabled} />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}
