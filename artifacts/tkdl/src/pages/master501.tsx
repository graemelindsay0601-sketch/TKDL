import { PageHero, Chapter, PmCard } from "@/components/premium/Premium";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Target, ArrowRight, CheckCircle, Lock, RotateCcw, Zap, Shield, Flame, TrendingUp } from "lucide-react";
import { Master501Scorer } from "@/lib/scorers";
import { type PracticeStats } from "@/lib/stats-types";
import { SessionHistorySection } from "@/components/session-history";
import { useCurrentPlayer } from "@/context/auth";
import { NearlyThere } from "@/components/achievements-v2/NearlyThere";
import { useWakeLock, useZoomLock, useExitGuard, useMatchSnapshot, readMatchSnapshot, clearMatchSnapshot } from "@/lib/nativeParity";
import { useToast } from "@/hooks/use-toast";

const M501_SNAPSHOT_KEY = "tkdl_master501_snapshot";
type M501Snapshot = { tier: number; round: number; tierName: string };

const M501_TIERS = [
  { tier: 1, name: "Challenger",          color: "#94a3b8", dartLimits: [60, 55, 50] as const },
  { tier: 2, name: "Pro Circuit",         color: "#4ade80", dartLimits: [48, 45, 42] as const },
  { tier: 3, name: "Premier",             color: "#38bdf8", dartLimits: [39, 36, 33] as const },
  { tier: 4, name: "Grand Prix",          color: "#ffd24a", dartLimits: [30, 27, 24] as const },
  { tier: 5, name: "World Championship",  color: "#ff005c", dartLimits: [21, 18, 15] as const },
] as const;

const M501_ROUNDS = [
  { round: 1, legs: 5,  legsNeeded: 3, label: "Best of 5"  },
  { round: 2, legs: 9,  legsNeeded: 5, label: "Best of 9"  },
  { round: 3, legs: 11, legsNeeded: 6, label: "Best of 11" },
] as const;

type TierIdx  = 0 | 1 | 2 | 3 | 4;
type RoundIdx = 0 | 1 | 2;

function getConfig(tier: number, round: number) {
  const t = M501_TIERS[(tier - 1) as TierIdx];
  const r = M501_ROUNDS[(round - 1) as RoundIdx];
  if (!t || !r) return null;
  return { ...t, ...r, dartLimit: t.dartLimits[(round - 1) as RoundIdx] };
}

type Player  = { id: number; name: string; status: string; isActive: boolean };
type Progress = { currentTier: number; currentRound: number; config: ReturnType<typeof getConfig> };
type StartCfg = NonNullable<ReturnType<typeof getConfig>>;
type Phase   = "lobby" | "bullup" | "playing" | "result";
type BullResult = { playerScore: number; botScore: number; playerFirst: boolean } | null;

// Was a hotlinked third-party image (i.postimg.cc) — a visual one-off vs.
// every other fullscreen match/result screen in the app (practice.tsx,
// play.tsx, board-curse.tsx, boss-battle.tsx, tour-run.tsx all use this
// same solid-dark + ambient-blob treatment), and a dependency on an
// external host staying up. Swapped for the shared treatment; the two call
// sites below now also render the ambient-blob-red/blue divs.
const SITE_BG: React.CSSProperties = { background: "#06040e" };

type LbRow = { id: number; name: string; tier: number; round: number; total_wins: number; total_losses: number; total_runs: number; best_avg: string; total_180s: number; co_hits: number; co_attempts: number };

const M501_TIER_META: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Challenger",         color: "#94a3b8", emoji: "🎯" },
  2: { label: "Pro Circuit",        color: "#4ade80", emoji: "⚡" },
  3: { label: "Premier",            color: "#38bdf8", emoji: "🔵" },
  4: { label: "Grand Prix",         color: "#ffd24a", emoji: "🏆" },
  5: { label: "World Championship", color: "#ff005c", emoji: "👑" },
};

export default function Master501() {
  const [players,     setPlayers]     = useState<Player[]>([]);
  const [playerId,    setPlayerId]    = useState<number | null>(null);
  const [progress,    setProgress]    = useState<Progress | null>(null);
  const [phase,       setPhase]       = useState<Phase>("lobby");
  const [runId,       setRunId]       = useState<number | null>(null);
  const [startCfg,    setStartCfg]    = useState<StartCfg | null>(null);
  const [matchResult, setMatchResult] = useState<{ result: "win" | "loss"; legsWon: number; legsLost: number } | null>(null);
  const [saveFailed,  setSaveFailed]  = useState(false);
  const { toast } = useToast();
  const [loading,     setLoading]     = useState(false);
  const [lastStats,   setLastStats]   = useState<PracticeStats | null>(null);
  const [lbRows,      setLbRows]      = useState<LbRow[]>([]);
  const [bullResult,  setBullResult]  = useState<BullResult>(null);

  const pendingStatsRef = useRef<PracticeStats | null>(null);
  const matchStartRef   = useRef<number>(Date.now());

  const currentPlayer = useCurrentPlayer();

  useEffect(() => {
    fetch("/api/players")
      .then(r => r.json())
      .then((d: Player[]) => {
        const active = d.filter(p => p.isActive !== false);
        setPlayers(active);
        if (!playerId && active.length > 0) {
          const defaultId = currentPlayer ? active.find(p => p.id === currentPlayer.playerId)?.id ?? null : null;
          setPlayerId(defaultId ?? active[0].id);
        }
      })
      .catch(() => {});
    fetch("/api/master501/leaderboard")
      .then(r => r.json())
      .then(setLbRows)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!playerId) { setProgress(null); return; }
    fetch(`/api/master501/progress/${playerId}`)
      .then(r => r.json())
      .then(setProgress)
      .catch(() => {});
  }, [playerId]);

  const [startingCell, setStartingCell] = useState<string | null>(null); // "tier-round" key

  const handleStartAt = async (tier: number, round: number) => {
    if (!playerId) return;
    const key = `${tier}-${round}`;
    setStartingCell(key);
    matchStartRef.current = Date.now();
    try {
      const res  = await fetch("/api/master501/runs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, tier, round }),
      });
      if (!res.ok) {
        // Previously an unchecked res.ok meant a failed start left startCfg
        // undefined, so every later phase guard (bullup/playing both require
        // `&& startCfg`) silently failed to match and the page just fell back
        // to the Lobby with no feedback — the Play/Replay button looked broken.
        toast({ title: "Couldn't start the match", description: "Check your connection and try again.", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setRunId(data.runId);
      setStartCfg(data.config as StartCfg);
      setBullResult(null);
      setPhase("bullup");
    } catch {
      toast({ title: "Couldn't start the match", description: "Check your connection and try again.", variant: "destructive" });
    }
    finally { setStartingCell(null); }
  };

  // Random bot bull score weighted toward realistic outcomes
  const handleBullThrow = (playerScore: number) => {
    const BOT_POOL = [50, 50, 25, 25, 25, 20, 18, 16, 14, 11, 9, 7, 5, 3, 1, 0];
    const botScore = BOT_POOL[Math.floor(Math.random() * BOT_POOL.length)];
    const playerFirst = playerScore >= botScore;
    setBullResult({ playerScore, botScore, playerFirst });
    setTimeout(() => { setBullResult(null); setPhase("playing"); }, 3000);
  };

  const handleMatchResult = async (result: "win" | "loss", legsWon: number, legsLost: number) => {
    const stats = pendingStatsRef.current;
    pendingStatsRef.current = null;
    setLastStats(stats);
    setMatchResult({ result, legsWon, legsLost });

    // Save session to practice_sessions (fire-and-forget)
    if (playerId && stats) {
      const cfg  = startCfg;
      const prog = progress;
      fetch("/api/practice/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player1Id:          playerId,
          gameTypeKey:        "501_double_out",
          gameTypeName:       `Master-501 — ${cfg?.name ?? ""}`,
          // Every other mode (e.g. tour-run.tsx) uses the 0/1 convention for
          // a completed single-player-vs-bot session. Sending null on a loss
          // instead of 1 made the backend treat these as "not completed"
          // (practice.ts's completed count is COUNT(winner_idx IS NOT NULL)),
          // undercounted M-501 losses anywhere winner_idx = 1 is tallied, and
          // rendered as won:null (neither win nor loss) in session history.
          winnerIdx:          result === "win" ? 0 : 1,
          detail:             `${cfg?.name ?? ""} R${prog?.currentRound ?? 1}: ${legsWon}–${legsLost}`,
          durationSeconds:    Math.round((Date.now() - matchStartRef.current) / 1000),
          p1Darts:            stats.p1Darts,
          p1Score:            stats.p1Score,
          p1_180s:            stats.p1_180s,
          p1CheckoutAttempts: stats.p1CheckoutAttempts,
          p1CheckoutHits:     stats.p1CheckoutHits,
          sessionData: {
            mode:      "master501",
            tierName:  cfg?.name,
            tier:      cfg?.tier,
            round:     cfg?.round,
            dartLimit: cfg?.dartLimit,
            legsWon,
            legsLost,
            dartLog:   stats.dartLog,
          },
        }),
      }).catch(() => {});
    }

    // Previously this PATCH's response was never checked, so a failed/dropped
    // request still fell through to setPhase("result") and showed "LEVEL
    // CLEARED" for a win the server never recorded — the player's ladder
    // progress would then silently revert the next time they opened the
    // lobby, with no explanation. Track whether the save actually landed so
    // the result screen can say so and offer a retry.
    let patchOk = true;
    try {
      if (runId) {
        const res = await fetch(`/api/master501/runs/${runId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result, legsWon, legsLost }),
        });
        patchOk = res.ok;
      }
      if (patchOk && playerId) {
        const pr = await fetch(`/api/master501/progress/${playerId}`).then(r => r.ok ? r.json() : null);
        if (pr) setProgress(pr);
      }
    } catch { patchOk = false; }
    setSaveFailed(!patchOk);
    setPhase("result");
  };

  const retrySaveResult = async () => {
    if (!runId || !matchResult) return;
    try {
      const res = await fetch(`/api/master501/runs/${runId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result: matchResult.result, legsWon: matchResult.legsWon, legsLost: matchResult.legsLost }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (playerId) {
        const pr = await fetch(`/api/master501/progress/${playerId}`).then(r => r.ok ? r.json() : null);
        if (pr) setProgress(pr);
      }
      setSaveFailed(false);
      toast({ title: "Result saved" });
    } catch {
      toast({ title: "Still couldn't save", description: "Check your connection and try again.", variant: "destructive" });
    }
  };

  const handlePlayAgain = () => {
    setMatchResult(null); setRunId(null); setStartCfg(null); setSaveFailed(false); setPhase("lobby");
  };

  // Native-app parity: keep the screen awake, stop pinch-zoom, and trap the
  // back button/swipe behind a confirmation for as long as a leg is live —
  // see src/lib/nativeParity.ts. The interrupted-run snapshot covers the
  // wider bullup+playing window since a crash during Bull Up would otherwise
  // strand a runId server-side with no result ever recorded against it.
  const isLive = phase === "playing";
  const inRun  = phase === "bullup" || phase === "playing";
  useWakeLock(isLive);
  useZoomLock(isLive);
  useExitGuard(isLive, () => setPhase("lobby"));
  useMatchSnapshot<M501Snapshot>(
    M501_SNAPSHOT_KEY, inRun,
    startCfg ? { tier: startCfg.tier, round: startCfg.round, tierName: startCfg.name } : null
  );

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if (phase === "result" && matchResult) {
    const won  = matchResult.result === "win";
    const acc  = won ? "#22c55e" : "#ff005c";
    const next = progress?.config;
    return (
      <div className="min-h-screen" style={SITE_BG}>
        <div className="ambient-blob-red" />
        <div className="ambient-blob-blue" />
        <div className="max-w-md mx-auto px-4 pt-16 pb-12 flex flex-col items-center gap-6" style={{ position: "relative" }}>
          <div style={{ fontSize: "4rem" }}>{won ? "🏆" : "💀"}</div>
          <div className="text-center">
            <div className="font-black uppercase text-4xl mb-1" style={{ fontFamily: "Oswald,sans-serif", color: acc }}>
              {won ? "LEVEL CLEARED" : "CHALLENGE FAILED"}
            </div>
            <div className="text-xl font-black" style={{ fontFamily: "Oswald,sans-serif", color: "rgba(255,255,255,0.5)" }}>
              {matchResult.legsWon} – {matchResult.legsLost}
            </div>
          </div>

          {saveFailed && (
            <div className="w-full rounded-xl p-3 flex items-center justify-between gap-3" style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.3)" }}>
              <span className="text-xs" style={{ color: "#ff8fb4", fontFamily: "Oswald,sans-serif" }}>
                This result wasn't saved to your progress.
              </span>
              <button onClick={() => void retrySaveResult()} className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
                style={{ background: "rgba(255,0,92,0.15)", border: "1px solid rgba(255,0,92,0.4)", color: "#ff005c", fontFamily: "Oswald,sans-serif" }}>
                Retry
              </button>
            </div>
          )}

          {next && (
            <div className="w-full rounded-xl p-4 text-center" style={{ background: acc + "0a", border: `1px solid ${acc}30` }}>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald,sans-serif" }}>
                {won ? "NEXT CHALLENGE" : "RETRY"}
              </div>
              <div className="font-black text-lg" style={{ fontFamily: "Oswald,sans-serif", color: acc }}>
                {next.name}
              </div>
              <div className="flex justify-center gap-6 mt-2">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Oswald,sans-serif" }}>
                  <span className="font-black text-white">{next.dartLimit}</span> darts/leg
                </span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "Oswald,sans-serif" }}>
                  {next.label}
                </span>
              </div>
            </div>
          )}

          {/* Stats strip */}
          {lastStats && (lastStats.p1Darts ?? 0) > 0 && (
            <div className="w-full flex gap-2">
              {lastStats.p1Score != null && lastStats.p1Darts! > 0 && (
                <div className="flex-1 text-center px-3 py-2.5 rounded-xl" style={{ background: acc + "0a", border: `1px solid ${acc}20` }}>
                  <div className="font-black text-xl" style={{ fontFamily: "Oswald,sans-serif", color: acc }}>
                    {(lastStats.p1Score * 3 / lastStats.p1Darts!).toFixed(2)}
                  </div>
                  <div className="uppercase" style={{ fontFamily: "Oswald,sans-serif", fontSize: "0.45rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>3-dart avg</div>
                </div>
              )}
              {(lastStats.p1_180s ?? 0) > 0 && (
                <div className="flex-1 text-center px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,210,74,0.08)", border: "1px solid rgba(255,210,74,0.15)" }}>
                  <div className="font-black text-xl" style={{ fontFamily: "Oswald,sans-serif", color: "#ffd24a" }}>{lastStats.p1_180s}</div>
                  <div className="uppercase" style={{ fontFamily: "Oswald,sans-serif", fontSize: "0.45rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>180s</div>
                </div>
              )}
              {(lastStats.p1CheckoutAttempts ?? 0) > 0 && (
                <div className="flex-1 text-center px-3 py-2.5 rounded-xl" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)" }}>
                  <div className="font-black text-xl" style={{ fontFamily: "Oswald,sans-serif", color: "#22c55e" }}>
                    {Math.round(((lastStats.p1CheckoutHits ?? 0) / lastStats.p1CheckoutAttempts!) * 100)}%
                  </div>
                  <div className="uppercase" style={{ fontFamily: "Oswald,sans-serif", fontSize: "0.45rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>checkout</div>
                </div>
              )}
            </div>
          )}

          {playerId && <div className="w-full max-w-sm text-left"><NearlyThere players={[{ id: playerId }]} areas={["MASTER501"]} /></div>}

          <button onClick={handlePlayAgain} className="px-8 py-3 rounded-xl font-black uppercase tracking-widest text-sm"
            style={{ fontFamily: "Oswald,sans-serif", cursor: "pointer", background: acc + "20", border: `1px solid ${acc}50`, color: acc }}>
            <RotateCcw size={13} className="inline mr-1.5" />
            {won ? "NEXT LEVEL" : "TRY AGAIN"}
          </button>
        </div>
      </div>
    );
  }

  // ── BULL UP ────────────────────────────────────────────────────────────────
  if (phase === "bullup" && startCfg) {
    const playerName = players.find(p => p.id === playerId)?.name ?? "Player";
    const threw = bullResult !== null;

    const ScoreLabel = ({ score }: { score: number }) => {
      if (score === 50) return <><span style={{ color: "#ff005c" }}>BULL</span> <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8em" }}>50</span></>;
      if (score === 25) return <><span style={{ color: "#ffd24a" }}>OUTER BULL</span> <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8em" }}>25</span></>;
      if (score === 0)  return <span style={{ color: "rgba(255,255,255,0.3)" }}>MISS</span>;
      return <><span style={{ color: "rgba(255,255,255,0.7)" }}>{score}</span></>;
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={SITE_BG}>
        <div className="ambient-blob-red" />
        <div className="ambient-blob-blue" />
        <div className="w-full max-w-sm space-y-6" style={{ position: "relative" }}>

          {/* Header */}
          <div className="text-center space-y-1">
            <div className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald,sans-serif", color: startCfg.color, letterSpacing: "0.22em" }}>
              {startCfg.name} · Master-501
            </div>
            <div className="font-black uppercase" style={{ fontFamily: "Oswald,sans-serif", fontSize: "2.4rem", color: "#fff", lineHeight: 1 }}>
              BULL UP
            </div>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald,sans-serif" }}>
              {threw ? "Closest to the bull throws first" : "Throw for the bull to decide who starts"}
            </div>
          </div>

          {/* Scoreboard — shown after throw */}
          {threw && bullResult && (
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${bullResult.playerFirst ? "rgba(34,197,94,0.3)" : "rgba(255,0,92,0.3)"}` }}>
              {/* Player row */}
              <div className="flex items-center justify-between px-5 py-4" style={{ background: bullResult.playerFirst ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)" }}>
                <div>
                  <div className="font-black uppercase text-sm" style={{ fontFamily: "Oswald,sans-serif", color: bullResult.playerFirst ? "#22c55e" : "rgba(255,255,255,0.6)" }}>
                    {playerName.toUpperCase()}
                  </div>
                  {bullResult.playerFirst && (
                    <div className="text-xs font-black uppercase" style={{ color: "#22c55e", fontFamily: "Oswald,sans-serif", fontSize: "0.55rem", letterSpacing: "0.12em" }}>
                      ✓ THROWS FIRST
                    </div>
                  )}
                </div>
                <div className="font-black text-2xl tabular-nums" style={{ fontFamily: "Oswald,sans-serif" }}>
                  <ScoreLabel score={bullResult.playerScore} />
                </div>
              </div>

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* Bot row */}
              <div className="flex items-center justify-between px-5 py-4" style={{ background: !bullResult.playerFirst ? "rgba(255,0,92,0.08)" : "rgba(255,255,255,0.03)" }}>
                <div>
                  <div className="font-black uppercase text-sm" style={{ fontFamily: "Oswald,sans-serif", color: !bullResult.playerFirst ? "#ff005c" : "rgba(255,255,255,0.4)" }}>
                    THE MACHINE
                  </div>
                  {!bullResult.playerFirst && (
                    <div className="text-xs font-black uppercase" style={{ color: "#ff005c", fontFamily: "Oswald,sans-serif", fontSize: "0.55rem", letterSpacing: "0.12em" }}>
                      ✓ THROWS FIRST
                    </div>
                  )}
                </div>
                <div className="font-black text-2xl tabular-nums" style={{ fontFamily: "Oswald,sans-serif" }}>
                  <ScoreLabel score={bullResult.botScore} />
                </div>
              </div>
            </div>
          )}

          {/* Throw buttons — shown before throw */}
          {!threw && (
            <div className="space-y-3">
              <button
                onClick={() => handleBullThrow(50)}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95"
                style={{ fontFamily: "Oswald,sans-serif", background: "rgba(255,0,92,0.12)", border: "2px solid rgba(255,0,92,0.4)", color: "#ff005c", cursor: "pointer", letterSpacing: "0.14em" }}>
                🎯 BULL &nbsp;<span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>50</span>
              </button>
              <button
                onClick={() => handleBullThrow(25)}
                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm transition-all active:scale-95"
                style={{ fontFamily: "Oswald,sans-serif", background: "rgba(255,210,74,0.08)", border: "2px solid rgba(255,210,74,0.3)", color: "#ffd24a", cursor: "pointer", letterSpacing: "0.14em" }}>
                ⭕ OUTER BULL &nbsp;<span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 400 }}>25</span>
              </button>
              <button
                onClick={() => handleBullThrow(0)}
                className="w-full py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all active:scale-95"
                style={{ fontFamily: "Oswald,sans-serif", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)", cursor: "pointer", letterSpacing: "0.14em" }}>
                ✗ MISS
              </button>
            </div>
          )}

          {/* Loading bar — auto-advances after throw */}
          {threw && (
            <div className="space-y-2 text-center">
              <div className="text-xs font-black uppercase" style={{ fontFamily: "Oswald,sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em" }}>
                Starting match…
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.07)" }}>
                <div className="h-full rounded-full" style={{ background: startCfg.color, animation: "fill-bar 3s linear forwards", width: "0%" }} />
              </div>
            </div>
          )}

          {/* Abandon link */}
          {!threw && (
            <div className="text-center">
              <button onClick={() => setPhase("lobby")} className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald,sans-serif", background: "none", border: "none", cursor: "pointer" }}>
                ← Back to lobby
              </button>
            </div>
          )}
        </div>

        <style>{`@keyframes fill-bar { from { width: 0% } to { width: 100% } }`}</style>
      </div>
    );
  }

  // ── PLAYING ────────────────────────────────────────────────────────────────
  if (phase === "playing" && startCfg) {
    const playerName = players.find(p => p.id === playerId)?.name ?? "Player";
    // Same fixed full-viewport portal used by practice.tsx/play.tsx — see the
    // comment in play.tsx's "playing" branch for why this can't just render
    // inline inside the app shell without forcing a scroll mid-match.
    return createPortal(
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#06040e" }}>
        <Master501Scorer
          playerName={playerName}
          dartLimit={startCfg.dartLimit}
          legs={startCfg.legs}
          legsNeeded={startCfg.legsNeeded}
          tierName={startCfg.name}
          tierColor={startCfg.color}
          onMatchResult={handleMatchResult}
          onAbandon={() => setPhase("lobby")}
          onPracticeStats={s => { pendingStatsRef.current = s; }}
        />
      </div>,
      document.body
    );
  }

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  const currentTier  = progress?.currentTier  ?? 0;
  const currentRound = progress?.currentRound ?? 0;
  const lobbyCfg     = progress?.config;
  const activeLbRows = lbRows.filter(r => r.total_runs > 0);
  const interruptedRun = readMatchSnapshot<M501Snapshot>(M501_SNAPSHOT_KEY);

  return (
    <div className="space-y-5 pb-10 pm-page">

      {/* ── INTERRUPTED RUN RECOVERY ────────────────────────────────────────── */}
      {interruptedRun && (
        <div className="pdc-card p-3 flex items-center gap-3" style={{ borderColor: "rgba(255,210,74,0.3)", background: "rgba(255,210,74,0.06)" }}>
          <Zap className="w-4 h-4 shrink-0" style={{ color: "#ffd24a" }} />
          <div className="flex-1 text-xs" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.6)" }}>
            Your last run ({interruptedRun.tierName}, Round {interruptedRun.round}) looks like it got interrupted before a result was recorded.
          </div>
          <button
            onClick={() => { clearMatchSnapshot(M501_SNAPSHOT_KEY); void handleStartAt(interruptedRun.tier, interruptedRun.round); }}
            className="shrink-0 text-xs font-bold uppercase px-3 py-1.5 rounded-lg"
            style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", background: "rgba(255,210,74,0.12)", border: "1px solid rgba(255,210,74,0.3)", cursor: "pointer" }}>
            Run it back
          </button>
          <button
            onClick={() => clearMatchSnapshot(M501_SNAPSHOT_KEY)}
            className="shrink-0 text-xs"
            style={{ color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>
            Dismiss
          </button>
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────────────────────── */}
      <PageHero kicker="TKDL Master-501" icon={<Zap className="w-3.5 h-3.5" />} accent="#00c8a0" accent2="#0066ff"
        title={<>Can you beat <span style={{ WebkitTextFillColor: "#3df0c8", textShadow: "0 0 24px rgba(0,200,160,.55)" }}>the clock?</span></>}
        sub={<>Every leg has a dart limit — go over it and the leg is gone. Start at 60 darts per leg; by the World Championship you've got just <b style={{ color: "#ff5c93" }}>15</b>.</>}>
        <div className="grid grid-cols-4 gap-2 mt-4">
          {[
            { v: "60→15", l: "Dart limit", c: "#3df0c8" },
            { v: "5", l: "Tiers", c: "#7fb4ff" },
            { v: "15", l: "Rounds", c: "#ff7aa6" },
            { v: "∞", l: "Saves", c: "#ffd24a" },
          ].map(t => (
            <div key={t.l} className="rounded-2xl px-1 py-2.5 text-center" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.015))", border: "1px solid rgba(255,255,255,.12)" }}>
              <div className="tabular-nums leading-none whitespace-nowrap" style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: 20, color: t.c, textShadow: `0 0 14px ${t.c}77` }}>{t.v}</div>
              <div className="pm-lab justify-center mt-1" style={{ fontSize: 8, letterSpacing: ".1em" }}>{t.l}</div>
            </div>
          ))}
        </div>
      </PageHero>

      {/* ── LADDER STANDINGS ─────────────────────────────────────────────────── */}
      <Chapter title="Ladder standings" accent="#00c8a0" aside={<span className="pm-chip">By tier · round</span>} />
      {activeLbRows.length === 0 ? (
        <PmCard accent="#00c8a0">
          <div className="px-4 py-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 35% 30%, rgba(0,200,160,.4), #0d0b14 75%)", border: "1px solid rgba(0,200,160,.6)", boxShadow: "0 0 18px rgba(0,200,160,.35)" }}><Target className="w-6 h-6" style={{ color: "#fff" }} /></div>
            <div className="pm-chrome uppercase mt-3" style={{ fontFamily: "Oswald,sans-serif", fontWeight: 700, fontSize: 20 }}>No runs yet</div>
            <div className="text-sm" style={{ color: "#a9a4bd" }}>Be the first to climb the ladder</div>
          </div>
        </PmCard>
      ) : (
        <div className="space-y-2">
          {activeLbRows.slice(0, 6).map((row, idx) => {
            const meta  = M501_TIER_META[row.tier] ?? M501_TIER_META[1];
            const avg   = Number(row.best_avg);
            const coPct = row.co_attempts > 0 ? Math.round((row.co_hits / row.co_attempts) * 100) : null;
            const medal = ["linear-gradient(180deg,#ffe58a,#d99a00)", "linear-gradient(180deg,#ffffff,#9aa6bd)", "linear-gradient(180deg,#f0b27a,#9c5a2a)"][idx];
            const pc = ["#ffd24a", "#c0c8d8", "#cd7f32"][idx];
            return (
              <div key={row.id} className="pm-lbrow flex items-center gap-3 rounded-2xl px-3 py-3"
                style={{ background: idx < 3 ? `linear-gradient(90deg, ${pc}26, rgba(23,20,31,.95) 50%, rgba(12,10,18,.97))` : undefined, borderColor: idx < 3 ? `${pc}66` : undefined }}>
                <div className="shrink-0 flex items-center justify-center rounded-full" style={{ width: 38, height: 38, background: medal ?? "linear-gradient(180deg,#3a3550,#1d1a2b)", color: medal ? "#141018" : "#e4e0f0", fontFamily: "Oswald, sans-serif", fontSize: 15, boxShadow: medal ? `0 0 14px ${pc}66` : "inset 0 1px 0 rgba(255,255,255,.1)" }}>{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="uppercase truncate" style={{ fontFamily: "Oswald,sans-serif", fontSize: 16, letterSpacing: ".03em", color: "#fff" }}>{row.name}</div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="pm-chip" style={{ fontSize: 9, padding: "2px 7px", color: meta.color, borderColor: `${meta.color}66`, background: `${meta.color}14` }}>{meta.emoji} T{row.tier} {meta.label}</span>
                    <span className="text-[11px]" style={{ color: "#a9a4bd", fontFamily: "Oswald,sans-serif", letterSpacing: ".04em" }}>
                      R{row.round} · <span style={{ color: "#4ade80" }}>{row.total_wins}W</span>{row.total_180s > 0 ? <> · <span style={{ color: "#ffd24a" }}>{row.total_180s}</span> 180s</> : null}{coPct !== null ? ` · ${coPct}% CO` : ""}
                    </span>
                  </div>
                </div>
                {avg > 0 && (
                  <div className="shrink-0 text-right">
                    <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald,sans-serif", fontWeight: 700, fontSize: 24, color: avg >= 90 ? "#ffd24a" : "#3df0c8", textShadow: "0 0 12px rgba(0,200,160,.45)" }}>{avg.toFixed(1)}</div>
                    <div className="pm-lab justify-end" style={{ fontSize: 8.5 }}>best avg</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="max-w-xl mx-auto w-full space-y-5">
      {/* Player selector */}
      <Chapter title="Your run" accent="#00c8a0" />
      <PmCard accent="#00c8a0">
        <div className="p-4">
          <label className="pm-lab mb-2" style={{ color: "#3df0c8" }}>Player</label>
          <select value={playerId ?? ""} onChange={e => setPlayerId(Number(e.target.value) || null)}
            className="w-full px-4 rounded-full text-sm uppercase"
            style={{ height: 44, background: "linear-gradient(180deg, rgba(0,200,160,.2), rgba(0,200,160,.05))", border: "1px solid rgba(0,200,160,.55)", color: "#fff", fontFamily: "Oswald,sans-serif", letterSpacing: ".04em", cursor: "pointer", boxShadow: "0 0 14px rgba(0,200,160,.2)" }}>
            <option value="">Pick a player…</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </PmCard>

      {/* Career ladder — each unlocked round has an inline play / replay button */}
      <Chapter title="Career ladder" accent="#ffd24a" />
      <div className="space-y-3">
        {M501_TIERS.map(tier => {
          const tierFullyDone = playerId ? tier.tier < currentTier : false;
          const isActiveTier = playerId ? tier.tier === currentTier : false;
          return (
            <div key={tier.tier} className="pm-card overflow-hidden relative" style={{ ["--pm-acc" as any]: tierFullyDone ? "#22c55e" : tier.color, opacity: playerId && !tierFullyDone && !isActiveTier ? 0.75 : 1 }}>
              <div className="absolute pointer-events-none" style={{ right: -60, top: -60, width: 180, height: 180, borderRadius: "50%", background: `radial-gradient(circle, ${tier.color}30, transparent 70%)` }} />
              <div className="relative px-4 pt-3 pb-2 flex items-center gap-2">
                <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ fontFamily: "Oswald,sans-serif", fontSize: 13, color: "#141018", background: `linear-gradient(180deg, ${tier.color}, ${tier.color}99)`, boxShadow: `0 0 12px ${tier.color}77` }}>{tier.tier}</span>
                <span className="uppercase" style={{ fontFamily: "Oswald,sans-serif", fontSize: 16, letterSpacing: ".05em", color: tierFullyDone ? "#4ade80" : "#f2eefc" }}>{tier.name}</span>
                {tierFullyDone && <CheckCircle size={14} style={{ color: "#22c55e" }} />}
                {!playerId && tier.tier > 1 && <Lock size={12} style={{ color: "#6b6680" }} />}
              </div>
              <div className="relative grid grid-cols-3 gap-2 px-3 pb-3">
                {M501_ROUNDS.map(r => {
                  const isCompleted = playerId ? (tier.tier < currentTier || (tier.tier === currentTier && r.round < currentRound)) : false;
                  const isCurrent   = playerId ? (tier.tier === currentTier && r.round === currentRound) : false;
                  const isLocked    = !isCompleted && !isCurrent;
                  const cellKey     = `${tier.tier}-${r.round}`;
                  const isStarting  = startingCell === cellKey;
                  const dartLimit   = tier.dartLimits[r.round - 1 as 0|1|2];
                  return (
                    <div key={r.round} className="rounded-xl px-2 py-2 flex flex-col gap-1.5 items-center text-center"
                      style={{ background: isCurrent ? `linear-gradient(180deg, ${tier.color}33, ${tier.color}0a)` : "rgba(255,255,255,.035)", border: `1px solid ${isCurrent ? tier.color + "aa" : "rgba(255,255,255,.08)"}`, boxShadow: isCurrent ? `0 0 14px ${tier.color}44` : undefined }}>
                      <div className="tabular-nums leading-none" style={{ fontFamily: "Oswald,sans-serif", fontWeight: 700, fontSize: 20, color: isLocked ? "#4d4860" : "#fff", textShadow: isCurrent ? `0 0 10px ${tier.color}` : undefined }}>{dartLimit}<span style={{ fontSize: 11, color: isLocked ? "#4d4860" : "#a9a4bd" }}>d</span></div>
                      <div style={{ fontFamily: "Oswald,sans-serif", fontSize: 9.5, letterSpacing: ".06em", color: isLocked ? "#4d4860" : "#a9a4bd" }}>R{r.round} · {r.label}</div>
                      {isCurrent && (
                        <button onClick={() => handleStartAt(tier.tier, r.round)} disabled={isStarting}
                          className="w-full py-1.5 rounded-full uppercase transition-all"
                          style={{ fontFamily: "Oswald,sans-serif", fontSize: "0.65rem", letterSpacing: "0.1em", cursor: "pointer", background: "linear-gradient(180deg, #ffe58a, #e0a800)", color: "#1a1200", border: "1px solid #ffd24a", boxShadow: "0 0 12px rgba(255,210,74,.45)", opacity: isStarting ? 0.6 : 1 }}>
                          {isStarting ? "…" : "▶ Play"}
                        </button>
                      )}
                      {isCompleted && (
                        <button onClick={() => handleStartAt(tier.tier, r.round)} disabled={isStarting}
                          className="w-full py-1.5 rounded-full uppercase transition-all"
                          style={{ fontFamily: "Oswald,sans-serif", fontSize: "0.6rem", letterSpacing: "0.08em", cursor: "pointer", background: "rgba(34,197,94,0.14)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.45)", opacity: isStarting ? 0.6 : 1 }}>
                          {isStarting ? "…" : "↺ Replay"}
                        </button>
                      )}
                      {isLocked && <div className="w-full py-1.5 rounded-full flex justify-center" style={{ background: "rgba(255,255,255,0.03)" }}><Lock size={11} style={{ color: "#4d4860" }} /></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Match history */}
      {playerId && (
        <SessionHistorySection
          playerId={playerId}
          mode="master501"
          title="Match History"
          accentColor="#00c8a0"
          limit={10}
          emptyMessage="No M-501 sessions yet"
        />
      )}
      </div>{/* /max-w-xl */}
    </div>
  );
}
