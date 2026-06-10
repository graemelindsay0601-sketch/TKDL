import { useState, useEffect, useRef } from "react";
import { Target, ArrowRight, CheckCircle, Lock, RotateCcw, Zap, Shield, Flame, TrendingUp } from "lucide-react";
import { Master501Scorer } from "@/lib/scorers";
import { type PracticeStats } from "@/lib/stats-types";
import { SessionHistorySection } from "@/components/session-history";

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

type Player  = { id: number; name: string; status: string };
type Progress = { currentTier: number; currentRound: number; config: ReturnType<typeof getConfig> };
type StartCfg = NonNullable<ReturnType<typeof getConfig>>;
type Phase   = "lobby" | "playing" | "result";

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

  const pendingStatsRef = useRef<PracticeStats | null>(null);
  const matchStartRef   = useRef<number>(Date.now());

  useEffect(() => {
    fetch("/api/players")
      .then(r => r.json())
      .then((d: Player[]) => setPlayers(d.filter(p => p.status === "ACTIVE")))
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

  const handleStart = async () => {
    if (!playerId) return;
    setLoading(true);
    matchStartRef.current = Date.now();
    try {
      const res  = await fetch("/api/master501/runs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      setRunId(data.runId);
      setStartCfg(data.config as StartCfg);
      setPhase("playing");
    } catch { /* ignore */ }
    finally { setLoading(false); }
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
            tier:      prog?.currentTier,
            round:     prog?.currentRound,
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

      {/* Current challenge card */}
      {playerId && lobbyCfg && (
        <div className="rounded-xl p-4" style={{ background: lobbyCfg.color + "10", border: `2px solid ${lobbyCfg.color}35` }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ fontFamily: "Oswald,sans-serif", background: lobbyCfg.color + "20", color: lobbyCfg.color, border: `1px solid ${lobbyCfg.color}40` }}>
              {lobbyCfg.name}
            </div>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald,sans-serif" }}>
              Tier {currentTier} · Round {currentRound}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="font-black text-2xl" style={{ fontFamily: "Oswald,sans-serif", color: lobbyCfg.color }}>{lobbyCfg.dartLimit}</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald,sans-serif", fontSize: "0.65rem" }}>DARTS / LEG</div>
            </div>
            <div>
              <div className="font-black text-lg mt-0.5" style={{ fontFamily: "Oswald,sans-serif", color: "#fff" }}>{lobbyCfg.label}</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald,sans-serif", fontSize: "0.65rem" }}>FORMAT</div>
            </div>
            <div>
              <div className="font-black text-2xl" style={{ fontFamily: "Oswald,sans-serif", color: "#ffd24a" }}>{lobbyCfg.legsNeeded}</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald,sans-serif", fontSize: "0.65rem" }}>LEGS TO WIN</div>
            </div>
          </div>
        </div>
      )}

      {/* Career ladder */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald,sans-serif" }}>Career Ladder</h2>
        <div className="space-y-2">
          {M501_TIERS.map(tier => {
            const tierDone = playerId ? tier.tier < currentTier : false;
            return (
              <div key={tier.tier} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${tier.color}25` }}>
                <div className="px-3 py-1.5 flex items-center gap-2" style={{ background: tier.color + "12" }}>
                  <span className="text-xs font-black uppercase tracking-wider" style={{ fontFamily: "Oswald,sans-serif", color: tierDone ? "#22c55e" : tier.color }}>
                    {tier.name}
                  </span>
                  {tierDone && <CheckCircle size={11} style={{ color: "#22c55e" }} />}
                </div>
                <div className="grid grid-cols-3">
                  {M501_ROUNDS.map(r => {
                    const isCompleted = playerId ? (tier.tier < currentTier || (tier.tier === currentTier && r.round < currentRound)) : false;
                    const isCurrent   = playerId ? (tier.tier === currentTier && r.round === currentRound) : false;
                    const isLocked    = !isCompleted && !isCurrent;
                    return (
                      <div key={r.round}
                        className="px-3 py-2.5 flex items-center gap-1.5 border-r last:border-r-0"
                        style={{ borderColor: "rgba(255,255,255,0.05)", background: isCurrent ? tier.color + "15" : "transparent" }}>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontFamily: "Oswald,sans-serif", fontWeight: isCurrent ? 700 : 400, fontSize: "0.72rem", color: isLocked ? "rgba(255,255,255,0.2)" : "#fff" }}>
                            R{r.round} · {tier.dartLimits[r.round - 1]}d
                          </div>
                          <div style={{ color: "rgba(255,255,255,0.22)", fontSize: "0.58rem", fontFamily: "Oswald,sans-serif" }}>{r.label}</div>
                        </div>
                        {isCompleted && <CheckCircle size={11} style={{ color: "#22c55e", flexShrink: 0 }} />}
                        {isCurrent   && <ArrowRight  size={11} style={{ color: tier.color,  flexShrink: 0 }} />}
                        {isLocked && !playerId && <Lock size={9} style={{ color: "rgba(255,255,255,0.1)", flexShrink: 0 }} />}
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

      {/* Start button */}
      <button onClick={handleStart} disabled={!playerId || loading}
        className="w-full py-4 rounded-xl font-black uppercase tracking-widest text-lg transition-all"
        style={{
          fontFamily: "Oswald,sans-serif", cursor: playerId && !loading ? "pointer" : "not-allowed",
          background: playerId ? "linear-gradient(135deg, #00c8a0, #0066ff)" : "rgba(255,255,255,0.04)",
          color: playerId ? "#fff" : "rgba(255,255,255,0.2)",
          border: playerId ? "none" : "1px solid rgba(255,255,255,0.07)",
          opacity: loading ? 0.7 : 1,
        }}>
        {loading ? "LOADING…" : "START MATCH"}
      </button>
      </div>{/* /max-w-xl */}
    </div>
  );
}
