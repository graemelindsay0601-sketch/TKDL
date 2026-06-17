import { useState, useEffect, useRef } from "react";
import { Target, ArrowRight, CheckCircle, Lock, RotateCcw, Zap, Shield, Flame, TrendingUp } from "lucide-react";
import { Master501Scorer } from "@/lib/scorers";
import { type PracticeStats } from "@/lib/stats-types";
import { SessionHistorySection } from "@/components/session-history";
import { useCurrentPlayer } from "@/context/auth";

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

const SITE_BG: React.CSSProperties = {
  backgroundImage: "linear-gradient(rgba(4,4,10,0.84), rgba(4,4,10,0.92)), url('https://i.postimg.cc/Bbf9fbrp/pdc1.jpg')",
  backgroundSize: "cover", backgroundPosition: "center",
};

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
      const data = await res.json();
      setRunId(data.runId);
      setStartCfg(data.config as StartCfg);
      setBullResult(null);
      setPhase("bullup");
    } catch { /* ignore */ }
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
          winnerIdx:          result === "win" ? 0 : null,
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

    try {
      if (runId) {
        await fetch(`/api/master501/runs/${runId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ result, legsWon, legsLost }),
        });
      }
      if (playerId) {
        const pr = await fetch(`/api/master501/progress/${playerId}`).then(r => r.json());
        setProgress(pr);
      }
    } catch { /* ignore */ }
    setPhase("result");
  };

  const handlePlayAgain = () => {
    setMatchResult(null); setRunId(null); setStartCfg(null); setPhase("lobby");
  };

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if (phase === "result" && matchResult) {
    const won  = matchResult.result === "win";
    const acc  = won ? "#22c55e" : "#ff005c";
    const next = progress?.config;
    return (
      <div className="min-h-screen" style={SITE_BG}>
        <div className="max-w-md mx-auto px-4 pt-16 pb-12 flex flex-col items-center gap-6">
          <div style={{ fontSize: "4rem" }}>{won ? "🏆" : "💀"}</div>
          <div className="text-center">
            <div className="font-black uppercase text-4xl mb-1" style={{ fontFamily: "Oswald,sans-serif", color: acc }}>
              {won ? "LEVEL CLEARED" : "CHALLENGE FAILED"}
            </div>
            <div className="text-xl font-black" style={{ fontFamily: "Oswald,sans-serif", color: "rgba(255,255,255,0.5)" }}>
              {matchResult.legsWon} – {matchResult.legsLost}
            </div>
          </div>

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
        <div className="w-full max-w-sm space-y-6">

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
    return (
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
    );
  }

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  const currentTier  = progress?.currentTier  ?? 0;
  const currentRound = progress?.currentRound ?? 0;
  const lobbyCfg     = progress?.config;
  const activeLbRows = lbRows.filter(r => r.total_runs > 0);

  return (
    <div className="space-y-5 pb-10">

      {/* ── HERO / SALES PITCH ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{ background: "linear-gradient(135deg, rgba(0,200,160,0.12) 0%, rgba(0,102,255,0.07) 60%, transparent 100%)", border: "1px solid rgba(0,200,160,0.25)" }}>
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, background: "radial-gradient(circle, rgba(0,200,160,0.22) 0%, transparent 65%)" }} />
          <div style={{ position: "absolute", bottom: -40, left: -40, width: 180, height: 180, background: "radial-gradient(circle, rgba(0,102,255,0.14) 0%, transparent 65%)" }} />
        </div>
        <div className="relative p-5 md:p-7">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-3.5 h-3.5 fill-current" style={{ color: "#00c8a0" }} />
            <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#00c8a0", fontFamily: "Oswald,sans-serif", letterSpacing: "0.22em" }}>
              TKDL MASTER-501
            </span>
          </div>
          <h1 className="font-black uppercase leading-none mb-3"
            style={{ fontFamily: "Oswald,sans-serif", fontSize: "clamp(1.8rem, 5vw, 3rem)", letterSpacing: "0.06em", color: "#fff" }}>
            CAN YOU BEAT<br />THE CLOCK?
          </h1>
          <p className="text-sm leading-relaxed mb-5 max-w-lg" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Oswald,sans-serif" }}>
            Every leg has a dart limit. Go over it and the leg is gone — no excuses, no extensions.
            Start at 60 darts per leg. By the time you reach the World Championship tier, you've got just <span style={{ color: "#ff005c", fontWeight: 900 }}>15</span>.
            Five tiers. Fifteen rounds. Pure solo pressure.
          </p>

          {/* Feature bullets */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            {[
              { icon: <Zap className="w-3.5 h-3.5" />,        color: "#00c8a0", title: "Dart Limits",    desc: "60 → 15 darts" },
              { icon: <Shield className="w-3.5 h-3.5" />,     color: "#38bdf8", title: "5 Tiers",        desc: "Challenger to Worlds" },
              { icon: <Flame className="w-3.5 h-3.5" />,      color: "#ff005c", title: "15 Rounds",      desc: "BO5 · BO9 · BO11" },
              { icon: <TrendingUp className="w-3.5 h-3.5" />, color: "#ffd24a", title: "Career Ladder",  desc: "Progress saves forever" },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                style={{ background: `${f.color}0e`, border: `1px solid ${f.color}28` }}>
                <div className="shrink-0 mt-0.5" style={{ color: f.color }}>{f.icon}</div>
                <div>
                  <div className="font-black uppercase text-xs" style={{ fontFamily: "Oswald,sans-serif", color: f.color, fontSize: "0.62rem", letterSpacing: "0.1em" }}>{f.title}</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.6rem" }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MINI LEADERBOARD ───────────────────────────────────────────────── */}
      <div className="pdc-card overflow-hidden">
        <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5" style={{ color: "#00c8a0" }} />
            <span className="font-black uppercase tracking-widest text-xs" style={{ fontFamily: "Oswald,sans-serif", color: "rgba(255,255,255,0.5)", fontSize: "0.6rem", letterSpacing: "0.15em" }}>
              LADDER STANDINGS
            </span>
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald,sans-serif", fontSize: "0.58rem" }}>Ranked by tier · round</span>
        </div>
        {activeLbRows.length === 0 ? (
          <div className="px-4 py-8 text-center space-y-2">
            <div className="text-3xl">🎯</div>
            <div className="font-black uppercase text-sm" style={{ fontFamily: "Oswald,sans-serif", color: "rgba(255,255,255,0.4)" }}>No runs yet</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Be the first to climb the ladder</div>
          </div>
        ) : (
          <div>
            {activeLbRows.slice(0, 6).map((row, idx) => {
              const meta   = M501_TIER_META[row.tier] ?? M501_TIER_META[1];
              const avg    = Number(row.best_avg);
              const coPct  = row.co_attempts > 0 ? Math.round((row.co_hits / row.co_attempts) * 100) : null;
              const POS_COLORS = ["#ffd24a", "#94a3b8", "#cd7f32"];
              const posColor   = POS_COLORS[idx] ?? "rgba(255,255,255,0.2)";
              return (
                <div key={row.id} className="px-4 py-2.5 border-b flex items-center gap-3"
                  style={{ borderColor: "rgba(255,255,255,0.04)", background: idx === 0 ? "rgba(0,200,160,0.04)" : undefined }}>
                  <span className="font-black text-sm w-5 shrink-0 text-center tabular-nums"
                    style={{ fontFamily: "Oswald,sans-serif", color: posColor, fontSize: idx < 3 ? "0.85rem" : "0.7rem" }}>
                    {idx < 3 ? ["🥇","🥈","🥉"][idx] : idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-black uppercase text-sm" style={{ fontFamily: "Oswald,sans-serif", color: idx === 0 ? "#fff" : "rgba(255,255,255,0.8)" }}>
                      {row.name}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded font-black uppercase"
                        style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30`, fontFamily: "Oswald,sans-serif", fontSize: "0.55rem", letterSpacing: "0.08em" }}>
                        {meta.emoji} T{row.tier} {meta.label}
                      </span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald,sans-serif", fontSize: "0.58rem" }}>R{row.round}</span>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 shrink-0">
                    <div className="text-center">
                      <div className="font-mono text-xs font-bold" style={{ color: "#22c55e" }}>{row.total_wins}<span style={{ color: "rgba(255,255,255,0.2)" }}>W</span></div>
                    </div>
                    {avg > 0 && (
                      <div className="text-center" style={{ minWidth: "3rem" }}>
                        <div className="font-black text-sm tabular-nums" style={{ fontFamily: "Oswald,sans-serif", color: avg >= 90 ? "#ffd24a" : avg >= 80 ? "#22c55e" : "rgba(255,255,255,0.45)", lineHeight: 1 }}>{avg.toFixed(1)}</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Oswald,sans-serif", fontSize: "0.5rem" }}>AVG</div>
                      </div>
                    )}
                    {row.total_180s > 0 && (
                      <div className="text-center">
                        <div className="font-black text-sm" style={{ fontFamily: "Oswald,sans-serif", color: "#ffd24a", lineHeight: 1 }}>{row.total_180s}</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Oswald,sans-serif", fontSize: "0.5rem" }}>180s</div>
                      </div>
                    )}
                    {coPct !== null && (
                      <div className="text-center">
                        <div className="font-black text-sm" style={{ fontFamily: "Oswald,sans-serif", color: coPct >= 50 ? "#00c8a0" : "rgba(255,255,255,0.4)", lineHeight: 1 }}>{coPct}%</div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Oswald,sans-serif", fontSize: "0.5rem" }}>CO%</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="max-w-xl mx-auto w-full space-y-5">
      {/* Player selector */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald,sans-serif" }}>Player</h2>
        <select value={playerId ?? ""} onChange={e => setPlayerId(Number(e.target.value) || null)}
          className="w-full px-3 py-2.5 rounded-lg text-sm"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontFamily: "Oswald,sans-serif", cursor: "pointer" }}>
          <option value="">Select player…</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Career ladder — each unlocked round has an inline play / replay button */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald,sans-serif" }}>Career Ladder</h2>
        <div className="space-y-2">
          {M501_TIERS.map(tier => {
            const tierFullyDone = playerId ? tier.tier < currentTier : false;
            return (
              <div key={tier.tier} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${tier.color}25` }}>
                {/* Tier header */}
                <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: tier.color + "12" }}>
                  <span className="text-xs font-black uppercase tracking-wider" style={{ fontFamily: "Oswald,sans-serif", color: tierFullyDone ? "#22c55e" : tier.color }}>
                    {tier.name}
                  </span>
                  {tierFullyDone && <CheckCircle size={11} style={{ color: "#22c55e" }} />}
                  {!playerId && tier.tier > 1 && <Lock size={9} style={{ color: "rgba(255,255,255,0.18)" }} />}
                </div>
                {/* Round cells */}
                <div className="grid grid-cols-3 divide-x" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  {M501_ROUNDS.map(r => {
                    const isCompleted = playerId ? (tier.tier < currentTier || (tier.tier === currentTier && r.round < currentRound)) : false;
                    const isCurrent   = playerId ? (tier.tier === currentTier && r.round === currentRound) : false;
                    const isLocked    = !isCompleted && !isCurrent;
                    const cellKey     = `${tier.tier}-${r.round}`;
                    const isStarting  = startingCell === cellKey;
                    const dartLimit   = tier.dartLimits[r.round - 1 as 0|1|2];

                    return (
                      <div key={r.round} className="px-2.5 py-2.5 flex flex-col gap-1.5"
                        style={{ borderColor: "rgba(255,255,255,0.05)", background: isCurrent ? tier.color + "14" : "transparent" }}>
                        {/* Round label + dart count */}
                        <div className="flex items-baseline gap-1">
                          <span style={{ fontFamily: "Oswald,sans-serif", fontWeight: isCurrent ? 900 : 500, fontSize: "0.72rem",
                            color: isLocked ? "rgba(255,255,255,0.18)" : isCurrent ? "#fff" : "rgba(255,255,255,0.65)" }}>
                            R{r.round}
                          </span>
                          <span style={{ fontFamily: "Oswald,sans-serif", fontSize: "0.58rem",
                            color: isLocked ? "rgba(255,255,255,0.1)" : isCurrent ? tier.color : "rgba(255,255,255,0.3)" }}>
                            {dartLimit}d · {r.label}
                          </span>
                        </div>

                        {/* Action button */}
                        {isCurrent && (
                          <button
                            onClick={() => handleStartAt(tier.tier, r.round)}
                            disabled={isStarting}
                            className="w-full py-1.5 rounded-lg font-black uppercase text-center transition-all"
                            style={{
                              fontFamily: "Oswald,sans-serif", fontSize: "0.6rem", letterSpacing: "0.08em", cursor: "pointer",
                              background: `linear-gradient(135deg, ${tier.color}, ${tier.color}99)`,
                              color: "#fff", border: "none", opacity: isStarting ? 0.6 : 1,
                            }}>
                            {isStarting ? "…" : "▶ PLAY"}
                          </button>
                        )}
                        {isCompleted && (
                          <button
                            onClick={() => handleStartAt(tier.tier, r.round)}
                            disabled={isStarting}
                            className="w-full py-1 rounded-lg font-black uppercase text-center transition-all"
                            style={{
                              fontFamily: "Oswald,sans-serif", fontSize: "0.55rem", letterSpacing: "0.06em", cursor: "pointer",
                              background: "rgba(34,197,94,0.08)", color: "#22c55e",
                              border: "1px solid rgba(34,197,94,0.2)", opacity: isStarting ? 0.6 : 1,
                            }}>
                            {isStarting ? "…" : "↺ REPLAY"}
                          </button>
                        )}
                        {isLocked && (
                          <div className="w-full py-1 rounded-lg text-center"
                            style={{ background: "rgba(255,255,255,0.03)", fontSize: "0.55rem", color: "rgba(255,255,255,0.1)", fontFamily: "Oswald,sans-serif" }}>
                            🔒
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
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
