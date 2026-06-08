import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListPlayers } from "@workspace/api-client-react";
import { Bot, Lock, Dumbbell, Zap, Target, ChevronRight, CircuitBoard } from "lucide-react";

type GameModeRow = { gameTypeKey: string; gameTypeName: string; sessions: number; darts: number };

type ShadowBotStats = {
  playerName: string;
  locked: boolean;
  totalDarts: number;
  dartsNeeded: number;
  totalSessions: number;
  computedAvg?: number;
  doubleHitPct?: number;
  primarySeg?: number;
  checkoutSegs?: number[];
  accuracyLevel: string | null;
  nextLevel: string | null;
  progressToNext: number;
  gameModeSessions: GameModeRow[];
  thinSpots: GameModeRow[];
};

const LEVEL_COLOR: Record<string, string> = {
  beginner: "#94a3b8",
  amateur:  "#22c55e",
  club:     "#3b82f6",
  county:   "#a78bfa",
  pro:      "#ffd24a",
  elite:    "#ff005c",
};

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Beginner",
  amateur:  "Amateur",
  club:     "Club Player",
  county:   "County",
  pro:      "Pro Tour",
  elite:    "Elite",
};

export default function ShadowBot() {
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const p = new URLSearchParams(window.location.search).get("player");
    return p ? Number(p) : null;
  });
  const [stats, setStats]   = useState<ShadowBotStats | null>(null);
  const [loading, setLoading] = useState(false);
  const { data: players }   = useListPlayers();

  useEffect(() => {
    if (!selectedId) { setStats(null); return; }
    setLoading(true);
    setStats(null);
    fetch(`/api/players/${selectedId}/shadow-bot-stats`)
      .then(r => r.json())
      .then((d: ShadowBotStats) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const lvlColor = stats?.accuracyLevel ? (LEVEL_COLOR[stats.accuracyLevel] ?? "#ff005c") : "#ff005c";
  const lvlLabel = stats?.accuracyLevel ? (LEVEL_LABEL[stats.accuracyLevel] ?? stats.accuracyLevel) : null;
  const nextLabel = stats?.nextLevel ? (LEVEL_LABEL[stats.nextLevel] ?? stats.nextLevel) : null;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

      {/* ── Page header ── */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <CircuitBoard className="w-5 h-5" style={{ color: "#ff005c", filter: "drop-shadow(0 0 6px rgba(255,0,92,0.7))" }} />
          <h1 className="font-black uppercase tracking-widest text-xl"
            style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.95)", letterSpacing: "0.15em" }}>
            Shadow Bot Protocol
          </h1>
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.28)" }}>
          Your AI alter-ego — trained on every dart you throw. Play more to sharpen it.
        </p>
      </div>

      {/* ── Player selector ── */}
      <div className="section-card">
        <label className="block text-xs font-black uppercase tracking-widest mb-2"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)" }}>
          Select Player
        </label>
        <select
          value={selectedId ?? ""}
          onChange={e => setSelectedId(e.target.value ? Number(e.target.value) : null)}
          className="w-full px-3 py-2.5 rounded-lg text-sm font-semibold"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: selectedId ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.3)",
            outline: "none",
          }}
        >
          <option value="">— choose a player —</option>
          {players?.filter((p: any) => p.isActive).map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* ── Empty state ── */}
      {!selectedId && !loading && (
        <div className="section-card py-16 flex flex-col items-center justify-center text-center">
          <Bot className="w-14 h-14 mb-4" style={{ color: "rgba(255,255,255,0.07)" }} />
          <div className="font-black uppercase text-base mb-1"
            style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
            Select a Player
          </div>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.18)" }}>
            Pick a player above to view their Shadow Bot
          </p>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="section-card py-12 text-center">
          <div className="text-sm animate-pulse" style={{ color: "rgba(255,255,255,0.3)" }}>
            Initialising shadow bot…
          </div>
        </div>
      )}

      {/* ── Bot card + stats ── */}
      {stats && !loading && (
        <>
          {/* Bot identity card */}
          <div className="section-card relative overflow-hidden"
            style={{ borderColor: stats.locked ? "rgba(255,0,92,0.2)" : `${lvlColor}28` }}>
            {/* Background glow */}
            <div className="absolute inset-0 pointer-events-none" style={{
              background: `radial-gradient(ellipse at 15% 50%, ${stats.locked ? "rgba(255,0,92,0.05)" : `${lvlColor}07`} 0%, transparent 65%)`,
            }} />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="text-xs font-black uppercase tracking-widest mb-1.5"
                    style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)" }}>
                    Shadow Bot
                  </div>
                  <div className="font-black uppercase leading-none"
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      fontSize: "1.75rem",
                      color: stats.locked ? "rgba(255,255,255,0.35)" : lvlColor,
                      textShadow: stats.locked ? "none" : `0 0 24px ${lvlColor}50`,
                    }}>
                    Shadow {stats.playerName}
                  </div>
                </div>
                {stats.locked ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.2)" }}>
                    <Lock className="w-3.5 h-3.5" style={{ color: "#ff005c" }} />
                    <span className="text-xs font-black uppercase"
                      style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", letterSpacing: "0.08em" }}>
                      Offline
                    </span>
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wider"
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      background: `${lvlColor}14`,
                      border: `1px solid ${lvlColor}38`,
                      color: lvlColor,
                    }}>
                    {lvlLabel}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  {stats.locked ? (
                    <>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {stats.totalDarts} / {stats.dartsNeeded} darts to activate
                      </span>
                      <span className="text-xs font-bold" style={{ color: "#ff005c" }}>
                        {stats.progressToNext}%
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-black uppercase"
                        style={{ fontFamily: "Oswald, sans-serif", color: lvlColor }}>
                        {lvlLabel}
                      </span>
                      {nextLabel ? (
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
                          {stats.progressToNext}% → {nextLabel}
                        </span>
                      ) : (
                        <span className="text-xs font-black" style={{ color: "#ff005c" }}>MAX LEVEL</span>
                      )}
                    </>
                  )}
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${stats.progressToNext}%`,
                      background: stats.locked
                        ? "linear-gradient(90deg, #ff005c, rgba(255,0,92,0.4))"
                        : `linear-gradient(90deg, ${lvlColor}, ${lvlColor}70)`,
                      boxShadow: `0 0 10px ${stats.locked ? "#ff005c" : lvlColor}50`,
                    }}
                  />
                </div>
              </div>

              {/* Locked CTA */}
              {stats.locked && (
                <div className="text-center py-3">
                  <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Shadow {stats.playerName} needs{" "}
                    <span className="font-bold" style={{ color: "#ff005c" }}>
                      {stats.dartsNeeded - stats.totalDarts} more darts
                    </span>{" "}
                    of practice to come online.
                  </p>
                  <Link href="/practice"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-black text-sm uppercase"
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      background: "rgba(255,0,92,0.1)",
                      border: "1px solid rgba(255,0,92,0.28)",
                      color: "#ff005c",
                      letterSpacing: "0.08em",
                    }}>
                    <Dumbbell className="w-4 h-4" />
                    Go Practice
                  </Link>
                </div>
              )}

              {/* Unlocked stats */}
              {!stats.locked && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Sessions",     value: stats.totalSessions.toString()                              },
                      { label: "Darts Logged", value: stats.totalDarts.toLocaleString()                          },
                      { label: "3-Dart Avg",   value: stats.computedAvg != null ? stats.computedAvg.toFixed(1) : "—" },
                      { label: "Checkout %",   value: stats.doubleHitPct != null ? `${Math.round(stats.doubleHitPct * 100)}%` : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl px-3 py-3 text-center"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="font-black text-xl mb-0.5"
                          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.92)" }}>
                          {value}
                        </div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Targeting preferences */}
                  <div className="flex items-center gap-5 flex-wrap pt-1">
                    {stats.primarySeg != null && (
                      <div className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5" style={{ color: lvlColor }} />
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Primary target</span>
                        <span className="font-black text-sm px-2 py-0.5 rounded"
                          style={{ fontFamily: "Oswald, sans-serif", background: `${lvlColor}14`, color: lvlColor }}>
                          T{stats.primarySeg}
                        </span>
                      </div>
                    )}
                    {stats.checkoutSegs && stats.checkoutSegs.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Checkout prefs</span>
                        <div className="flex gap-1">
                          {stats.checkoutSegs.map(s => (
                            <span key={s} className="text-xs font-black px-1.5 py-0.5 rounded"
                              style={{ fontFamily: "Oswald, sans-serif", background: `${lvlColor}12`, color: lvlColor }}>
                              D{s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Training breakdown ── */}
          {stats.gameModeSessions.length > 0 && (
            <div className="section-card">
              <h2 className="font-black uppercase text-sm mb-4 flex items-center gap-2"
                style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
                <Zap className="w-3.5 h-3.5" style={{ color: "#ffd24a" }} />
                Training by Game Mode
              </h2>
              <div className="space-y-2.5">
                {stats.gameModeSessions.map(g => {
                  const maxSess = stats.gameModeSessions[0]?.sessions ?? 1;
                  const barPct  = Math.round((g.sessions / maxSess) * 100);
                  const isThin  = g.sessions < 5;
                  return (
                    <div key={g.gameTypeKey} className="flex items-center gap-3">
                      <div className="w-32 md:w-44 shrink-0 text-xs truncate"
                        style={{ color: isThin ? "#ffd24a" : "rgba(255,255,255,0.55)" }}>
                        {g.gameTypeName}
                      </div>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barPct}%`,
                            background: isThin ? "rgba(255,200,0,0.45)" : `${lvlColor}55`,
                          }}
                        />
                      </div>
                      <div className="w-20 text-right text-xs font-mono shrink-0"
                        style={{ color: isThin ? "#ffd24a" : "rgba(255,255,255,0.35)" }}>
                        {g.sessions} {g.sessions === 1 ? "session" : "sessions"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Thin spots ── */}
          {stats.thinSpots.length > 0 && (
            <div className="section-card" style={{ borderColor: "rgba(255,200,0,0.12)" }}>
              <h2 className="font-black uppercase text-sm mb-3 flex items-center gap-2"
                style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
                <span style={{ color: "#ffd24a", fontSize: "1rem" }}>⚠</span>
                Thin Spots
                <span className="text-xs font-normal normal-case ml-1" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "normal" }}>
                  — play more to sharpen your bot
                </span>
              </h2>
              <div className="space-y-2">
                {stats.thinSpots.slice(0, 6).map(g => (
                  <div key={g.gameTypeKey}
                    className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,200,0,0.03)", border: "1px solid rgba(255,200,0,0.1)" }}>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.72)" }}>
                        {g.gameTypeName}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,200,0,0.65)" }}>
                        {g.sessions === 0
                          ? "No sessions yet"
                          : `Only ${g.sessions} session${g.sessions !== 1 ? "s" : ""} — needs more data`}
                      </div>
                    </div>
                    <Link href="/practice"
                      className="flex items-center gap-1 text-xs font-black uppercase px-2.5 py-1.5 rounded-lg shrink-0"
                      style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.15)" }}>
                      Practice <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── No sessions yet ── */}
          {stats.gameModeSessions.length === 0 && (
            <div className="section-card py-14 flex flex-col items-center justify-center text-center">
              <Dumbbell className="w-12 h-12 mb-4" style={{ color: "rgba(255,255,255,0.07)" }} />
              <div className="font-black uppercase text-base mb-2"
                style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>
                Shadow {stats.playerName} hasn't thrown a dart yet
              </div>
              <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.2)" }}>
                Play a practice session to start training your bot
              </p>
              <Link href="/practice"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-black text-sm uppercase"
                style={{
                  fontFamily: "Oswald, sans-serif",
                  background: "rgba(255,0,92,0.1)",
                  border: "1px solid rgba(255,0,92,0.28)",
                  color: "#ff005c",
                  letterSpacing: "0.08em",
                }}>
                <Dumbbell className="w-4 h-4" />
                Start Practice
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
