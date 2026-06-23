/**
 * Game engine scorer components — each handles its own state + dart input.
 * All scorers receive: p1Name, p2Name, config (parsed from game_type), onWin(0|1, detail?), onAbandon
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { DartInputBoard, VisitDarts, CHECKOUTS, type Dart } from "./dartboard";
import { AlertTriangle, Trophy, Zap, RotateCcw, Target, Crosshair, Maximize, Minimize } from "lucide-react";
import { type BotConfig, botX01Visit, botCricketVisit, botSequenceVisit, botHalveItVisit, botCountUpVisit, botFootballVisit, botGolfVisit, botKillerVisit, botGotchaVisit, botBaseballVisit, botScramVisit, botJDCVisit, botExponentialVisit, botShootingGalleryDart } from "./bot-engine";
import { type PracticeStats, type DartThrow } from "./stats-types";
import { CardActivationOverlay } from "@/components/CardActivationOverlay";
import { cardDebugLog } from "./card-debug";

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

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="pdc-card p-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>{children}</div>
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
export function X01Scorer({ p1Name, p2Name, config, botConfig, onWin, onAbandon, onPracticeStats, legs: legsProp, setsToWin = 0, legsToWinSet = 3, soloMode = false }: {
  p1Name: string; p2Name: string;
  config: { startingScore: number; doubleIn?: boolean; doubleOut?: boolean; trebleOut?: boolean; masterOut?: boolean; bullFinish?: boolean; noTrebles?: boolean; legs?: number; bustResetTo?: number };
  botConfig?: BotConfig;
  onWin: (w: 0 | 1, detail?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
  legs?: number;
  setsToWin?: number;
  legsToWinSet?: number; soloMode?: boolean;
}) {
  const { startingScore = 501, doubleIn = false, doubleOut = true, trebleOut = false, masterOut = false, bullFinish = false, noTrebles = false, legs: configLegs, bustResetTo } = config;
  const legs = legsProp ?? configLegs;
  const setsNeeded  = setsToWin > 0 ? Math.ceil(setsToWin / 2) : 0;
  const legsNeeded  = setsToWin > 0 ? Math.ceil(legsToWinSet / 2) : (legs ? Math.ceil(legs / 2) : 0);

  const [scores, setScores]         = useState<[number, number]>([startingScore, startingScore]);
  const [legWins, setLegWins]       = useState<[number, number]>([0, 0]);
  const [setWins, setSetWins]       = useState<[number, number]>([0, 0]);
  const [started, setStarted]       = useState<[boolean, boolean]>([!doubleIn, !doubleIn]);
  const [turn, setTurn]             = useState<0 | 1>(0);
  const [legStarter, setLegStarter] = useState<0 | 1>(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [bust, setBust]             = useState(false);
  const [bustMsg, setBustMsg]       = useState("");
  const [history, setHistory]       = useState<{ turn: 0|1; score: number; left: number; darts: Dart[] }[]>([]);
  
  // Card Clash state
  const [equippedCards, setEquippedCards] = useState<any[]>([]);
  const [cardsUsed, setCardsUsed]         = useState<any[]>([]);

  const names = [p1Name, p2Name];

  // Practice stat accumulators (refs = no re-render, always fresh in callbacks)
  const p1StatsRef = useRef({ darts: 0, score: 0, s180s: 0, coAttempts: 0, coHits: 0, dartLog: [] as DartThrow[] });
  // P2 stats — only meaningful in human-vs-human (no bot) sessions
  const p2StatsRef = useRef({ darts: 0, score: 0, s180s: 0, coAttempts: 0, coHits: 0, dartLog: [] as DartThrow[] });
  const isHumanVsHuman = !botConfig;

  const isValidOut = (dart: Dart): boolean => {
    if (bullFinish) return dart.segment === 25 && dart.value === 50;
    if (doubleOut)  return dart.multiplier === 2 || (dart.segment === 25 && dart.value === 50);
    if (trebleOut)  return dart.multiplier === 3;
    if (masterOut)  return dart.multiplier >= 2 || (dart.segment === 25 && dart.value === 50);
    return true;
  };

  const triggerBust = useCallback((darts: Dart[], msg: string) => {
    setBust(true); setBustMsg(msg); setVisitDarts(darts);
    if (bustResetTo !== undefined) {
      setScores(prev => { const n = [...prev] as [number, number]; n[turn] = bustResetTo; return n; });
    }
    setTimeout(() => { setBust(false); setBustMsg(""); setVisitDarts([]); setTurn(t => soloMode ? 0 : (t === 0 ? 1 : 0)); }, 1500);
  }, [turn, bustResetTo]);

  const handleWin = useCallback((winnerIdx: 0|1, darts: Dart[]) => {
    setVisitDarts(darts);
    const getStats = () => ({
      p1Darts: p1StatsRef.current.darts, p1Score: p1StatsRef.current.score,
      p1_180s: p1StatsRef.current.s180s, p1CheckoutAttempts: p1StatsRef.current.coAttempts,
      p1CheckoutHits: p1StatsRef.current.coHits, dartLog: [...p1StatsRef.current.dartLog],
      ...(isHumanVsHuman ? {
        p2Darts: p2StatsRef.current.darts, p2Score: p2StatsRef.current.score,
        p2_180s: p2StatsRef.current.s180s, p2CheckoutAttempts: p2StatsRef.current.coAttempts,
        p2CheckoutHits: p2StatsRef.current.coHits, p2DartLog: [...p2StatsRef.current.dartLog],
      } : {}),
    });
    const resetForLeg = (delay: number, newLegState: [number,number]) => {
      setTimeout(() => {
        const ns: 0|1 = legStarter === 0 ? 1 : 0;
        setLegStarter(ns); setScores([startingScore, startingScore]);
        setStarted([!doubleIn, !doubleIn]); setVisitDarts([]);
        setTurn(soloMode ? 0 : ns); setLegWins(newLegState);
      }, delay);
    };

    if (setsToWin > 0) {
      setLegWins(prev => {
        const n: [number,number] = [...prev] as [number,number];
        n[winnerIdx]++;
        if (n[winnerIdx] >= legsNeeded) {
          const ns: [number,number] = [setWins[0], setWins[1]];
          ns[winnerIdx]++;
          if (ns[winnerIdx] >= setsNeeded) {
            setTimeout(() => {
              setSetWins(ns);
              onWin(winnerIdx, `${ns[winnerIdx]}–${ns[winnerIdx===0?1:0]} sets`);
              onPracticeStats?.(getStats());
            }, 800);
          } else {
            setTimeout(() => {
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
        n[winnerIdx]++;
        if (n[winnerIdx] >= legsNeeded) {
          setTimeout(() => {
            onWin(winnerIdx, `${n[winnerIdx]}–${n[winnerIdx===0?1:0]} legs`);
            onPracticeStats?.(getStats());
          }, 200);
        } else {
          resetForLeg(1500, n);
        }
        return n;
      });
    } else {
      setTimeout(() => {
        onWin(winnerIdx);
        onPracticeStats?.(getStats());
      }, 200);
    }
  }, [legs, legsNeeded, setsNeeded, setsToWin, legStarter, startingScore, doubleIn, onWin, onPracticeStats, setWins]);

  const handleDart = useCallback((dart: Dart) => {
    if (bust || visitDarts.length >= 3) return;

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

    const nv = [...visitDarts, dart];
    const cum = nv.reduce((s, d) => s + d.value, 0);
    const rem = scores[turn] - cum;

    if (rem < 0) {
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
      if (isValidOut(dart)) {
        if (turn === 0) {
          p1StatsRef.current.darts += nv.length;
          p1StatsRef.current.score += cum;
          if (cum === 180) p1StatsRef.current.s180s++;
          p1StatsRef.current.coHits++;
        }
        if (turn === 1 && isHumanVsHuman) {
          p2StatsRef.current.darts += nv.length;
          p2StatsRef.current.score += cum;
          if (cum === 180) p2StatsRef.current.s180s++;
          p2StatsRef.current.coHits++;
        }
        handleWin(turn, nv);
      } else {
        if (turn === 0) p1StatsRef.current.darts += nv.length;
        if (turn === 1 && isHumanVsHuman) p2StatsRef.current.darts += nv.length;
        triggerBust(nv, bullFinish ? "BUST — must finish on Bull's-eye (50)!" : doubleOut ? "BUST — must finish on a double!" : trebleOut ? "BUST — treble required!" : "BUST!");
      }
      return;
    }

    setVisitDarts(nv);
    if (nv.length === 3) {
      if (turn === 0) {
        p1StatsRef.current.darts += 3;
        p1StatsRef.current.score += cum;
        if (cum === 180) p1StatsRef.current.s180s++;
      }
      if (turn === 1 && isHumanVsHuman) {
        p2StatsRef.current.darts += 3;
        p2StatsRef.current.score += cum;
        if (cum === 180) p2StatsRef.current.s180s++;
      }
      setScores(prev => { const n=[...prev] as [number,number]; n[turn] -= cum; return n; });
      setHistory(h => [...h, { turn, score: cum, left: rem, darts: nv }]);
      setVisitDarts([]);
      setTurn(t => soloMode ? 0 : (t===0?1:0));
    }
  }, [bust, visitDarts, turn, started, doubleIn, scores, triggerBust, handleWin, bustResetTo, bullFinish, doubleOut, trebleOut, isValidOut, noTrebles]);

  const handleMiss = () => handleDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" });
  const handleUndo = () => {
    if (bust) return;
    if (visitDarts.length > 0) {
      // Remove the last dart within the current visit
      setVisitDarts(prev => prev.slice(0, -1));
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
    }
  };

  const handleDartRef = useRef(handleDart);
  useEffect(() => { handleDartRef.current = handleDart; });
  const isBotTurnX01 = !!botConfig && turn === 1;
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const [d1, d2, d3] = botX01Visit(scores[1], !!doubleOut, botConfig);
    const t1 = setTimeout(() => handleDartRef.current(d1), 700);
    const t2 = setTimeout(() => handleDartRef.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRef.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  const cum = visitDarts.reduce((s,d) => s+d.value, 0);
  const projected = scores[turn] - cum;
  const { fs, toggle: toggleFs } = useFullscreen();
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

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
      {/* Scoreboard */}
      <div className={soloMode ? "grid grid-cols-1 gap-3 max-w-xs mx-auto w-full" : "grid grid-cols-2 gap-3"}>
        {([0, ...(soloMode ? [] : [1])] as (0|1)[]).map(i => (
          <PlayerCard key={i} name={names[i]} score={scores[i]}
            turn={i===0} active={turn===i && !bust}
            sub={doubleIn && !started[i] ? "double in required" : undefined} />
        ))}
      </div>
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
        <VisitDarts darts={visitDarts} />
        {visitDarts.length > 0 && (
          <div className="text-center text-xs mt-2" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
            {cum} scored → leaves {projected >= 0 ? projected : "BUST"}
          </div>
        )}
      </SectionCard>
      {/* Recent history */}
      {history.length > 0 && (
        <SectionCard>
          <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Recent Visits</div>
          {[...history].reverse().slice(0,5).map((h,i) => (
            <div key={i} className="flex justify-between text-xs py-0.5">
              <span style={{ color: P_COLOR(h.turn), fontFamily: "Oswald, sans-serif" }}>{names[h.turn]}</span>
              <span style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>+{h.score}</span>
              <span style={{ color: "rgba(255,255,255,0.3)", fontFamily: "mono" }}>{h.left} left</span>
            </div>
          ))}
        </SectionCard>
      )}
      </div>}
      bot={<div className="flex flex-col gap-2">
        <DartInputBoard onDart={handleDart} onMiss={handleMiss} onUndo={handleUndo} disabled={bust || isBotTurnX01} />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
    <CardActivationOverlay 
      equippedCards={equippedCards.map(c => ({
        id: c.id?.toString() || "",
        name: c.name || "Unknown Card",
        effect: c.effect_text || "Card effect",
        cardType: (c.good_or_bad === "GOOD" ? "GOOD" : "BAD") as "GOOD" | "BAD",
        isActive: cardsUsed.some((used: any) => used.id === c.id),
      }))}
      isVisible={equippedCards.length > 0}
      onClose={() => cardDebugLog("X01Scorer", "Card overlay closed")}
    />
    </>
  );
}

// ── Cricket Scorer ─────────────────────────────────────────────────────────────
const CRICKET_NUMS = [20, 19, 18, 17, 16, 15, 25];
const CRICKET_LABELS = ["20", "19", "18", "17", "16", "15", "Bull"];
const markSymbol = (m: number) => m === 0 ? "" : m === 1 ? "/" : m === 2 ? "✕" : "●";

export function CricketScorer({ p1Name, p2Name, cutThroat = false, includesBull = true, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; cutThroat?: boolean; includesBull?: boolean; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
  const numCount = includesBull ? 7 : 6;
  const [marks, setMarks]       = useState<[[number,number,number,number,number,number,number],[number,number,number,number,number,number,number]]>([[0,0,0,0,0,0,0],[0,0,0,0,0,0,0]]);
  const [scores, setScores]     = useState<[number,number]>([0,0]);
  const [turn, setTurn]         = useState<0|1>(0);
  const [visitDarts, setVisitDarts] = useState<Dart[]>([]);
  const [lastHit, setLastHit]   = useState<string>("");
  const [snapHistory, setSnapHistory] = useState<{marks: [[number,number,number,number,number,number,number],[number,number,number,number,number,number,number]], scores: [number,number], turn: 0|1, visitDarts: Dart[]}[]>([]);

  const names = [p1Name, p2Name];

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
    // Snapshot full state before this dart — enables per-dart AND cross-visit undo
    setSnapHistory(prev => [...prev, {
      marks: [marks[0].slice() as [number,number,number,number,number,number,number], marks[1].slice() as [number,number,number,number,number,number,number]],
      scores: [...scores] as [number,number],
      turn,
      visitDarts: [...visitDarts],
    }]);
    // Cricket No Bull: bull hits are treated as misses
    if (!includesBull && dart.segment === 25) {
      const nv = [...visitDarts, dart];
      setVisitDarts(nv);
      setLastHit("Miss (no bull)");
      if (nv.length === 3) { setVisitDarts([]); setTurn(t => t===0?1:0); setLastHit(""); }
      return;
    }
    const numIdx = CRICKET_NUMS.indexOf(dart.segment);
    const nv = [...visitDarts, dart];

    if (numIdx >= 0) {
      const hits = dart.multiplier;
      setMarks(prev => {
        const nm: typeof marks = [[ ...prev[0] ] as any, [ ...prev[1] ] as any];
        const toClose = Math.max(0, 3 - nm[turn][numIdx]);
        const absorbed = Math.min(hits, toClose);
        const extra = hits - absorbed;
        nm[turn][numIdx] = Math.min(3, nm[turn][numIdx] + absorbed + extra);
        // Score extra
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
      setVisitDarts([]);
      setTurn(t => t===0?1:0);
      setLastHit("");
    }

    // Check win after state settles
    setTimeout(() => {
      setMarks(m => {
        setScores(sc => {
          const w = checkWin(m, sc);
          if (w !== null) setTimeout(() => {
            onPracticeStats?.({ sessionData: { mode: "cricket" } });
            onWin(w, cutThroat ? `Cut-Throat — lowest score wins` : undefined);
          }, 300);
          return sc;
        });
        return m;
      });
    }, 50);
  }, [visitDarts, turn, marks, scores, cutThroat, includesBull, numCount, onWin]);

  const handleMiss = () => handleDart({ segment: 0, multiplier: 1, value: 0, label: "Miss" });
  const handleUndo = () => {
    if (snapHistory.length === 0) return;
    const snap = snapHistory[snapHistory.length - 1];
    setMarks(snap.marks);
    setScores(snap.scores);
    setTurn(snap.turn);
    setVisitDarts(snap.visitDarts);
    setLastHit("");
    setSnapHistory(prev => prev.slice(0, -1));
  };

  const handleDartRefCri = useRef(handleDart);
  useEffect(() => { handleDartRefCri.current = handleDart; });
  const isBotTurnCri = !!botConfig && turn === 1;
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const [d1, d2, d3] = botCricketVisit([...marks[1]], botConfig);
    const t1 = setTimeout(() => handleDartRefCri.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefCri.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefCri.current(d3), 2100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [turn, botConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ScorerLayout
      top={<div className="space-y-3">
        <div className="pdc-divider" />
        <div className="text-center">
          <h2 className="text-2xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
            {cutThroat ? "Cut-Throat Cricket" : "Cricket"}
          </h2>
          {cutThroat && <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Lowest score wins · Hitting closed numbers gives OPPONENT points</p>}
        </div>
      {/* Scores */}
      <div className="grid grid-cols-2 gap-3">
        {[0,1].map(i => (
          <PlayerCard key={i} name={names[i]} score={scores[i]} turn={i===0} active={turn===i} />
        ))}
      </div>
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
          disabled={isBotTurnCri}
        />
        <AbandonBtn onAbandon={onAbandon} />
      </div>}
    />
  );
}

// ── Killer Scorer ──────────────────────────────────────────────────────────────
export function KillerScorer({ p1Name, p2Name, lives = 3, botConfig, onWin, onAbandon, onPracticeStats }: {
  p1Name: string; p2Name: string; lives?: number; botConfig?: BotConfig;
  onWin: (w: 0|1, d?: string) => void; onAbandon: () => void;
  onPracticeStats?: (s: PracticeStats) => void;
}) {
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
    const t = setTimeout(() => {
      setKillerNums(prev => [prev[0], pick]);
      setTimeout(() => setPhase("play"), 400);
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
      setTimeout(() => setMsg(""), 2000);
    } else if (isKiller[turn] && hitsOppDouble) {
      setLives(prev => {
        const n = [...prev] as [number,number];
        n[opp]--;
        if (n[opp] <= 0) {
          setTimeout(() => { onPracticeStats?.({ sessionData: { mode:"killer" } }); onWin(turn, `${names[opp]} eliminated!`); }, 300);
        }
        return n;
      });
      setMsg(`${names[opp]} loses a life!`);
      setTimeout(() => setMsg(""), 2000);
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
    const t1 = setTimeout(() => handleDartRefKill.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefKill.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefKill.current(d3), 2100);
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
          setTimeout(() => onWin(shanghaiTurn, `SHANGHAI on ${n}!`), 300);
          return;
        }
      }
      if (nd.length === 3) {
        setShanghaiDarts([]);
        setShanghaiHits({s:false,d:false,t:false});
        if (shanghaiTurn === 1) {
          if (shanghaiRound >= maxRounds) {
            setTimeout(() => {
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
      if (newPos >= sequence.length) { setTimeout(() => { onPracticeStats?.({ sessionData:{mode:"sequence"} }); onWin(turn, `Finished the sequence!`); }, 200); return; }
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
    const t1 = setTimeout(() => handleDartRefSeq.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefSeq.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefSeq.current(d3), 2100);
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
          setTimeout(() => {
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
    const t1 = setTimeout(() => handleDartRefHalve.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefHalve.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefHalve.current(d3), 2100);
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
            setTimeout(() => setHalvMsg(""), 2200);
          }
        } else {
          ns[turn] += cum;
        }
        if (maxRounds === 0 && ns[turn] >= target) {
          const label = bullsOnly ? `${ns[turn]} bulls!` : `Reached ${target} pts!`;
          setTimeout(() => { onPracticeStats?.({ sessionData:{mode:"countup"} }); onWin(turn, label); }, 300);
        }
        return ns;
      });
      setLastVisit(prev => { const n=[...prev] as [number,number]; n[turn]=cum; return n; });
      setRounds(prev => {
        const nr: [number,number] = [...prev] as [number,number];
        nr[turn]++;
        if (maxRounds > 0 && nr[0] >= maxRounds && nr[1] >= maxRounds) {
          setTimeout(() => {
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
    const t1 = setTimeout(() => handleDartRefCU.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefCU.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefCU.current(d3), 2100);
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
          setTimeout(() => setMsg(""), 1500);
        } else if (projected === target) {
          setTimeout(() => onWin(turn, `Reached exactly ${target}!`), 200);
          ns[turn] = projected;
        } else {
          ns[turn] = projected;
          if (ns[turn] === ns[opp]) {
            // GOTCHA — reset opponent!
            ns[opp] = 0;
            setMsg(`GOTCHA! ${names[opp]} reset to 0!`);
            setTimeout(() => setMsg(""), 2000);
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
    const t1 = setTimeout(() => handleDartRefGotcha.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefGotcha.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefGotcha.current(d3), 2100);
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
          setTimeout(() => {
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
    const t1 = setTimeout(() => handleDartRefBaseball.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefBaseball.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefBaseball.current(d3), 2100);
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
            setTimeout(() => {
              setPhase(2);
              setStopper(scorer); // swap roles
              setClosed([false,false,false,false,false,false,false]);
              setTurn(0);
            }, 800);
          } else {
            // Both phases done — compare scorer scores
            setTimeout(() => {
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
    const t1 = setTimeout(() => handleDartRefScram.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefScram.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefScram.current(d3), 2100);
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
            setTimeout(() => {
              onPracticeStats?.({ sessionData: { mode:"football", goals: ng } });
              onWin(turn, `${ng[turn]} goals!`);
            }, 200);
          }
          return ng;
        });
        setMsg(`GOAL! ${names[turn]} scores! ⚽ ${goals[turn]+1}/${goalsToWin}`);
        setTimeout(() => setMsg(""), 2000);
      }
    } else {
      // No possession (kickoff) or opponent has possession: need bull to steal/win it
      if (dart.segment === 25) {
        setPossession(turn);
        setMsg(`${names[turn]} wins possession! 🏈 Now aim for doubles to score!`);
        setTimeout(() => setMsg(""), 2200);
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
    const t1 = setTimeout(() => handleDartRefFB.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefFB.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefFB.current(d3), 2100);
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
            setTimeout(() => {
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
    const t1 = setTimeout(() => handleDartRefGolf.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefGolf.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefGolf.current(d3), 2100);
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
    setTimeout(() => {
      const bs = computeBotScore(botConfig!.hitAcc);
      setBotScore(bs);
      setTimeout(() => onWin(score >= bs ? 0 : 1, `${score} vs ${bs}`), 1800);
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
      setTimeout(() => {
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
    const t = setTimeout(() => doAdvance(true, bi, h), 600);
    return () => clearTimeout(t);
  }, [potted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDartRefSnk = useRef<(d: Dart) => void>(() => {});
  useEffect(() => { handleDartRefSnk.current = handleDart; });
  useEffect(() => {
    if (!botConfig || half !== 1) return;
    const segs = SNOOKER_BALLS[ballIdx].segs;
    const t1 = setTimeout(() => handleDartRefSnk.current(botSnookerDart(segs, botConfig)), 700);
    const t2 = setTimeout(() => handleDartRefSnk.current(botSnookerDart(segs, botConfig)), 1400);
    const t3 = setTimeout(() => handleDartRefSnk.current(botSnookerDart(segs, botConfig)), 2100);
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
            setTimeout(()=>{ onPracticeStats?.({sessionData:{mode:"jdc41"}}); onWin(ns[0]>=ns[1]?0:1,`${ns[0]} vs ${ns[1]} pts`); },300);
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
      if (dart.segment===target&&dart.multiplier===2) { setMsg(`D${target}! ✓`); setTimeout(()=>setMsg(""),1500); advance(target*2); return; }
      setVisitDarts(nv);
      if (nv.length===3) { setMsg("Missed!"); setTimeout(()=>setMsg(""),1200); advance(0); }
      return;
    }
    const nh={s:shHits.s||(dart.segment===target&&dart.multiplier===1),d:shHits.d||(dart.segment===target&&dart.multiplier===2),t:shHits.t||(dart.segment===target&&dart.multiplier===3)};
    const pts=dart.segment===target?dart.value:0;
    if(pts>0)setShHits(nh);
    if(nh.s&&nh.d&&nh.t){setMsg(`SHANGHAI ${target}! 🎯`);setTimeout(()=>setMsg(""),2000);advance(nv.reduce((a,d)=>a+(d.segment===target?d.value:0),0)+50);return;}
    setVisitDarts(nv);
    if(nv.length===3){advance(nv.reduce((a,d)=>a+(d.segment===target?d.value:0),0));}
  },[visitDarts,phase,target,shHits,turn,advance]);

  useEffect(() => { handleDartRefJDC.current = handleDart; });
  useEffect(() => {
    if (!botConfig || turn !== 1) return;
    const [d1, d2, d3] = botJDCVisit(phase, target, botConfig);
    const t1 = setTimeout(() => handleDartRefJDC.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefJDC.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefJDC.current(d3), 2100);
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
            setTimeout(()=>{onPracticeStats?.({sessionData:{mode:"exponential_bundle"}});onWin(ns[0]>=ns[1]?0:1,`${ns[0].toLocaleString()} vs ${ns[1].toLocaleString()}`);},300);
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
    const t1 = setTimeout(() => handleDartRefExp.current(d1), 700);
    const t2 = setTimeout(() => handleDartRefExp.current(d2), 1400);
    const t3 = setTimeout(() => handleDartRefExp.current(d3), 2100);
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
          setTimeout(()=>{onPracticeStats?.({sessionData:{mode:"shooting_gallery"}});onWin(ns[0]<=ns[1]?0:1,`${ns[0]} vs ${ns[1]} darts`);},300);
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
    if(nr===0&&dart.multiplier===2){setSgHistory([]);setMsg(`Checkout in ${dc}! 🎯`);setTimeout(()=>setMsg(""),2000);nextPlayer(dc);return;}
    if(nr<0||nr===1){setSgHistory([]);setMsg("Bust! +10");setTimeout(()=>setMsg(""),1500);nextPlayer(10);return;}
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
    const t = setTimeout(() => handleDartRefSG.current(botShootingGalleryDart(remain, botConfig)), 700);
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
    if(!isBull){setBusted(true);setMsg(`${names[turn]} BUSTED — reset!`);setTimeout(()=>setMsg(""),2000);}
    else setVisitPts(p=>p+dart.value);
    if(nv.length===3){
      setScores(prev=>{
        const ns:[number,number]=[...prev] as [number,number];
        if(nowBusted){ns[turn]=0;}
        else{
          ns[turn]+=visitPts+(isBull?dart.value:0);
          if(ns[turn]>=target){setTimeout(()=>{onPracticeStats?.({sessionData:{mode:"dead_centre"}});onWin(turn,`${ns[turn]} pts!`);},200);}
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
    const t1=setTimeout(()=>handleDartRefDC.current(mk()),700);
    const t2=setTimeout(()=>handleDartRefDC.current(mk()),1400);
    const t3=setTimeout(()=>handleDartRefDC.current(mk()),2100);
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
            setTimeout(() => onWin(turn, `${n[turn]} three-in-a-beds!`), 600);
          }
          return n;
        });
      } else {
        const inBedCount = nd.filter(d => d.segment === target && d.multiplier === 3).length;
        setMsg(inBedCount === 0 ? `Miss — none in T${target}` : `${inBedCount}/3 in T${target} — not enough!`);
      }
      setTimeout(() => {
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
    const t = setTimeout(() => callTarget(Math.min(20, botNum)), 600);
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
    const t1 = setTimeout(() => handleDartRef3B.current(mk()), 700);
    const t2 = setTimeout(() => handleDartRef3B.current(mk()), 1400);
    const t3 = setTimeout(() => handleDartRef3B.current(mk()), 2100);
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
      setTimeout(() => advanceTurn(capturedTeam), 1500);
      return;
    }
    if (rem === 0) {
      if (isValidOut(dart)) {
        setVisitDarts(nv);
        setTimeout(() => onWin(capturedTeam, `${teamNames[capturedTeam].join(" & ")} win!`), 300);
      } else {
        setBust(true);
        setBustMsg(doubleOut ? "BUST — must finish on a double!" : "BUST!");
        setVisitDarts(nv);
        setTimeout(() => advanceTurn(capturedTeam), 1500);
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
        {history.length > 0 && (
          <SectionCard>
            <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>Recent Visits</div>
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

    setTimeout(() => {
      setMarks(m => {
        setScores(sc => {
          const w = checkWin(m, sc);
          if (w !== null) setTimeout(() => onWin(w, cutThroat ? "Cut-Throat — lowest score wins" : undefined), 300);
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
      setTimeout(() => setMsg(""), 2000);
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
                  setTimeout(() => onWin(winnerIdx, `${playerNames[winnerIdx]} is the last survivor!`), 500);
                } else {
                  setTimeout(() => setMsg(""), 2000);
                }
                return newElim;
              });
            } else {
              setMsg(`${playerNames[opp]} loses a life!`);
              setTimeout(() => setMsg(""), 2000);
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
    setTimeout(() => {
      setMarks(m => {
        setScores(sc => {
          const w = checkWin(m, sc);
          if (w !== null) setTimeout(() => onWin(w, cutThroat ? "Cut-Throat — lowest score wins" : undefined), 300);
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
          setTimeout(() => { setScores(sc => { onWin(sc[0]>=sc[1]?0:1, `${sc[0]} vs ${sc[1]}`); return sc; }); }, 300);
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
          setTimeout(() => onWin(turn, label), 300);
        }
        return ns;
      });
      setRounds(prev => {
        const nr: [number,number] = [...prev] as [number,number];
        nr[turn]++;
        if (maxRounds > 0 && nr[0] >= maxRounds && nr[1] >= maxRounds) {
          setTimeout(() => { setScores(sc => { onWin(sc[0]>=sc[1]?0:1, `${sc[0]} vs ${sc[1]}`); return sc; }); }, 300);
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
      setTimeout(() => setFlashMsg(null), 800);
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
          setTimeout(() => {
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
    const t = setTimeout(() => onMatchResult(matchDone, legWinsRef.current, legLossesRef.current), 1500);
    return () => clearTimeout(t);
  }, [matchDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetLeg = useCallback(() => {
    setTimeout(() => {
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
      setTimeout(() => {
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
      setTimeout(() => {
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
      if (newDil >= dartLimit) setTimeout(() => lossLeg(), 400);
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
