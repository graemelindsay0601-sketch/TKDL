import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useListPlayers } from "@workspace/api-client-react";
import { Bot, Lock, Dumbbell, Zap, Target, ChevronRight, CircuitBoard, Trophy, Star, TrendingUp, Shield } from "lucide-react";

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

type BotLeaderboardRow = {
  playerId: number;
  playerName: string;
  totalDarts: number;
  totalSessions: number;
  gameModes: number;
  locked: boolean;
  computedAvg: number | null;
  accuracyLevel: string | null;
  progressToNext: number;
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

const LEVEL_STEPS = [
  { key: "beginner", label: "Beginner", threshold: "0",    color: "#94a3b8" },
  { key: "amateur",  label: "Amateur",  threshold: "45+",  color: "#22c55e" },
  { key: "club",     label: "Club",     threshold: "62+",  color: "#3b82f6" },
  { key: "county",   label: "County",   threshold: "80+",  color: "#a78bfa" },
  { key: "pro",      label: "Pro Tour", threshold: "95+",  color: "#ffd24a" },
  { key: "elite",    label: "Elite",    threshold: "108+", color: "#ff005c" },
];

const TOTAL_BOT_GAMERSCORE = 1130;

function BotLevelPip({ levelKey, active }: { levelKey: string; active: boolean }) {
  const color = LEVEL_COLOR[levelKey] ?? "#94a3b8";
  return (
    <div className="w-2.5 h-2.5 rounded-full transition-all" style={{
      background: active ? color : "rgba(255,255,255,0.08)",
      boxShadow: active ? `0 0 8px ${color}90` : "none",
    }} />
  );
}

export default function ShadowBot() {
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const p = new URLSearchParams(window.location.search).get("player");
    return p ? Number(p) : null;
  });
  const [stats, setStats]     = useState<ShadowBotStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [roster, setRoster]   = useState<BotLeaderboardRow[]>([]);

  const { data: players } = useListPlayers();

  useEffect(() => {
    fetch("/api/bots/leaderboard")
      .then(r => r.json()).then(d => setRoster(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

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

  const lvlColor  = stats?.accuracyLevel ? (LEVEL_COLOR[stats.accuracyLevel] ?? "#ff005c") : "#ff005c";
  const lvlLabel  = stats?.accuracyLevel ? (LEVEL_LABEL[stats.accuracyLevel] ?? stats.accuracyLevel) : null;
  const nextLabel = stats?.nextLevel ? (LEVEL_LABEL[stats.nextLevel] ?? stats.nextLevel) : null;
  const activeLevelIdx = stats?.accuracyLevel ? LEVEL_STEPS.findIndex(s => s.key === stats.accuracyLevel) : -1;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      {/* ══ HERO / SALES PITCH ══ */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,0,92,0.08) 0%, rgba(9,9,15,0.98) 50%, rgba(0,102,255,0.04) 100%)",
          border: "1px solid rgba(255,0,92,0.2)",
        }}>
        <div className="absolute top-0 left-0 w-64 h-64 pointer-events-none"
          style={{ background: "radial-gradient(circle at 20% 20%, rgba(255,0,92,0.12), transparent 65%)" }} />
        <div className="absolute bottom-0 right-0 w-48 h-48 pointer-events-none"
          style={{ background: "radial-gradient(circle at 80% 80%, rgba(0,102,255,0.06), transparent 65%)" }} />

        <div className="relative p-6 md:p-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-5">
            <div className="shrink-0 p-3 rounded-2xl"
              style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.2)" }}>
              <CircuitBoard className="w-7 h-7"
                style={{ color: "#ff005c", filter: "drop-shadow(0 0 8px rgba(255,0,92,0.8))" }} />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-widest mb-1"
                style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.7)", letterSpacing: "0.2em" }}>
                TKDL Bot System
              </div>
              <h1 className="font-black uppercase leading-none"
                style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(1.8rem, 5vw, 3rem)", color: "#fff", letterSpacing: "0.04em" }}>
                Shadow Bot <span style={{ color: "#ff005c" }}>Protocol</span>
              </h1>
            </div>
          </div>

          <p className="text-sm leading-relaxed mb-6 max-w-xl" style={{ color: "rgba(255,255,255,0.45)" }}>
            Every dart you throw in practice trains your personal AI alter-ego. It learns your accuracy, your favourite
            targets, how you finish — and levels up as you improve. Max it out, earn exclusive gamerscore, and prove
            your Shadow Bot is the best in the league.
          </p>

          {/* Level progression strip */}
          <div className="mb-6">
            <div className="text-xs font-black uppercase tracking-widest mb-3"
              style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: "0.15em" }}>
              Level Progression — activate at 250 darts
            </div>
            <div className="flex items-start gap-0">
              {LEVEL_STEPS.map((step, i) => (
                <div key={step.key} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm"
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        background: `${step.color}15`,
                        border: `1px solid ${step.color}35`,
                        color: step.color,
                      }}>
                      {i + 1}
                    </div>
                    <div className="text-center mt-1.5 hidden sm:block px-0.5">
                      <div className="font-black uppercase"
                        style={{ fontFamily: "Oswald, sans-serif", color: step.color, fontSize: "0.5rem", letterSpacing: "0.08em" }}>
                        {step.label}
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.45rem" }}>{step.threshold} avg</div>
                    </div>
                  </div>
                  {i < LEVEL_STEPS.length - 1 && (
                    <div className="w-4 sm:w-8 h-px mt-0 sm:-mt-5 mx-0.5" style={{ background: "rgba(255,255,255,0.08)" }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Dumbbell,   color: "#a78bfa", title: "Log Darts",      desc: "Play any practice game to feed your bot data"       },
              { icon: TrendingUp, color: "#22c55e", title: "Level Up",        desc: "Hit 45+ avg to activate, then grind to Elite"      },
              { icon: Star,       color: "#ffd24a", title: `${TOTAL_BOT_GAMERSCORE}G Available`, desc: "17 exclusive bot achievements to unlock"  },
              { icon: Trophy,     color: "#ff005c", title: "Compete",         desc: "Compare your bot rank against the whole league"    },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="rounded-xl p-3"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Icon className="w-4 h-4 mb-2" style={{ color }} />
                <div className="font-black text-xs uppercase mb-1"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.75)", letterSpacing: "0.05em" }}>
                  {title}
                </div>
                <div className="leading-relaxed" style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.62rem" }}>
                  {desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ BOT ROSTER — EVERYONE'S BOTS ══ */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} />
            <h2 className="font-black uppercase text-sm tracking-wider"
              style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.55)", letterSpacing: "0.12em" }}>
              Bot Roster
            </h2>
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
            {roster.filter(r => !r.locked).length} / {roster.length} online
          </span>
        </div>

        {roster.length === 0 ? (
          <div className="section-card py-10 text-center">
            <div className="text-sm animate-pulse" style={{ color: "rgba(255,255,255,0.2)" }}>Loading bots…</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {roster.map((bot, rank) => {
              const color     = bot.locked ? "rgba(255,255,255,0.12)" : (LEVEL_COLOR[bot.accuracyLevel ?? "beginner"] ?? "#94a3b8");
              const label     = bot.locked ? "Offline" : (LEVEL_LABEL[bot.accuracyLevel ?? "beginner"] ?? "Beginner");
              const activeLvl = bot.accuracyLevel ? LEVEL_STEPS.findIndex(s => s.key === bot.accuracyLevel) : -1;
              return (
                <button key={bot.playerId}
                  onClick={() => { setSelectedId(bot.playerId); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}
                  className="text-left rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.015] cursor-pointer"
                  style={{
                    background: bot.locked ? "rgba(255,255,255,0.02)" : `${color}07`,
                    border: `1px solid ${bot.locked ? "rgba(255,255,255,0.06)" : `${color}22`}`,
                  }}>
                  <div className="h-0.5 w-full" style={{ background: bot.locked ? "rgba(255,255,255,0.06)" : color }} />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-xs font-bold uppercase mb-0.5"
                          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", fontSize: "0.52rem", letterSpacing: "0.12em" }}>
                          {rank === 0 && !bot.locked ? "🏆 TOP BOT" : `BOT #${rank + 1}`}
                        </div>
                        <div className="font-black uppercase leading-tight"
                          style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.05rem", color: bot.locked ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.88)" }}>
                          Shadow {bot.playerName}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-lg shrink-0"
                        style={{ background: bot.locked ? "rgba(255,0,92,0.06)" : `${color}14`, border: `1px solid ${bot.locked ? "rgba(255,0,92,0.15)" : `${color}28`}` }}>
                        {bot.locked && <Lock className="w-2.5 h-2.5" style={{ color: "#ff005c" }} />}
                        <span className="font-black uppercase"
                          style={{ fontFamily: "Oswald, sans-serif", color: bot.locked ? "#ff005c" : color, fontSize: "0.5rem", letterSpacing: "0.08em" }}>
                          {label}
                        </span>
                      </div>
                    </div>

                    {/* Level pips */}
                    <div className="flex items-center gap-1.5 mb-3">
                      {LEVEL_STEPS.map((s, i) => (
                        <BotLevelPip key={s.key} levelKey={s.key} active={!bot.locked && i <= activeLvl} />
                      ))}
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                      <span>
                        <span className="font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{bot.totalDarts.toLocaleString()}</span> darts
                      </span>
                      <span>
                        <span className="font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>{bot.totalSessions}</span> sessions
                      </span>
                      {!bot.locked && bot.computedAvg != null && (
                        <span>
                          <span className="font-black" style={{ fontFamily: "Oswald, sans-serif", color }}>{bot.computedAvg.toFixed(1)}</span> avg
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {bot.locked && (
                      <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.58rem" }}>
                        {bot.totalDarts} / 250 darts to activate
                      </div>
                    )}
                    <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${bot.progressToNext}%`,
                          background: bot.locked
                            ? "linear-gradient(90deg, rgba(255,0,92,0.4), rgba(255,0,92,0.15))"
                            : `linear-gradient(90deg, ${color}, ${color}70)`,
                        }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ MY BOT ══ */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CircuitBoard className="w-4 h-4" style={{ color: "#ff005c", filter: "drop-shadow(0 0 4px rgba(255,0,92,0.6))" }} />
          <h2 className="font-black uppercase text-sm tracking-wider"
            style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.55)", letterSpacing: "0.12em" }}>
            My Bot
          </h2>
        </div>

        {/* Player selector */}
        <div className="section-card mb-4">
          <label className="block text-xs font-black uppercase tracking-widest mb-2"
            style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)" }}>
            Select Your Player
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
            }}>
            <option value="">— choose a player —</option>
            {players?.filter((p: any) => p.isActive).map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {selectedId && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                See full achievements + gamerscore on the player profile
              </span>
              <Link href={`/players/${selectedId}`}
                className="flex items-center gap-1.5 text-xs font-black uppercase px-3 py-1.5 rounded-lg"
                style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.2)" }}>
                Full Profile <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Empty state */}
        {!selectedId && !loading && (
          <div className="section-card py-12 flex flex-col items-center justify-center text-center">
            <Bot className="w-12 h-12 mb-4" style={{ color: "rgba(255,255,255,0.05)" }} />
            <div className="font-black uppercase text-sm mb-1"
              style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
              Select a player above
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.12)" }}>
              Or tap any bot card in the roster to inspect it
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="section-card py-10 text-center">
            <div className="text-sm animate-pulse" style={{ color: "rgba(255,255,255,0.3)" }}>
              Initialising shadow bot…
            </div>
          </div>
        )}

        {/* Bot detail */}
        {stats && !loading && (
          <>
            <div className="section-card relative overflow-hidden"
              style={{ borderColor: stats.locked ? "rgba(255,0,92,0.2)" : `${lvlColor}28` }}>
              <div className="absolute inset-0 pointer-events-none" style={{
                background: `radial-gradient(ellipse at 15% 50%, ${stats.locked ? "rgba(255,0,92,0.05)" : `${lvlColor}07`} 0%, transparent 65%)`,
              }} />
              <div className="relative z-10">
                {/* Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest mb-1.5"
                      style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.22)" }}>
                      Shadow Bot
                    </div>
                    <div className="font-black uppercase leading-none"
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontSize: "1.75rem",
                        color: stats.locked ? "rgba(255,255,255,0.3)" : lvlColor,
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
                      style={{ fontFamily: "Oswald, sans-serif", background: `${lvlColor}14`, border: `1px solid ${lvlColor}38`, color: lvlColor }}>
                      {lvlLabel}
                    </div>
                  )}
                </div>

                {/* Level pips with labels */}
                <div className="flex items-center gap-2.5 mb-5">
                  {LEVEL_STEPS.map((step, i) => {
                    const isReached = !stats.locked && i <= activeLevelIdx;
                    return (
                      <div key={step.key} className="flex flex-col items-center gap-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{
                            background: isReached ? `${step.color}20` : "rgba(255,255,255,0.04)",
                            border: `1px solid ${isReached ? `${step.color}45` : "rgba(255,255,255,0.07)"}`,
                          }}>
                          <div className="w-2 h-2 rounded-full" style={{
                            background: isReached ? step.color : "rgba(255,255,255,0.08)",
                            boxShadow: isReached ? `0 0 6px ${step.color}` : "none",
                          }} />
                        </div>
                        <span className="text-xs hidden sm:block"
                          style={{ fontFamily: "Oswald, sans-serif", color: isReached ? step.color : "rgba(255,255,255,0.15)", fontSize: "0.48rem", fontWeight: 700, letterSpacing: "0.06em" }}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    {stats.locked ? (
                      <>
                        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                          {stats.totalDarts} / {stats.dartsNeeded} darts to activate
                        </span>
                        <span className="text-xs font-bold" style={{ color: "#ff005c" }}>{stats.progressToNext}%</span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: lvlColor }}>
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
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${stats.progressToNext}%`,
                        background: stats.locked
                          ? "linear-gradient(90deg, #ff005c, rgba(255,0,92,0.35))"
                          : `linear-gradient(90deg, ${lvlColor}, ${lvlColor}70)`,
                        boxShadow: `0 0 10px ${stats.locked ? "#ff005c" : lvlColor}50`,
                      }} />
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
                      style={{ fontFamily: "Oswald, sans-serif", background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.28)", color: "#ff005c", letterSpacing: "0.08em" }}>
                      <Dumbbell className="w-4 h-4" /> Go Practice
                    </Link>
                  </div>
                )}

                {/* Unlocked stats */}
                {!stats.locked && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      {[
                        { label: "Sessions",     value: stats.totalSessions.toString()                                    },
                        { label: "Darts Logged", value: stats.totalDarts.toLocaleString()                                },
                        { label: "3-Dart Avg",   value: stats.computedAvg != null ? stats.computedAvg.toFixed(1) : "—"  },
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

            {/* Training breakdown */}
            {stats.gameModeSessions.length > 0 && (
              <div className="section-card mt-4">
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
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${barPct}%`, background: isThin ? "rgba(255,200,0,0.45)" : `${lvlColor}55` }} />
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

            {/* Thin spots */}
            {stats.thinSpots.length > 0 && (
              <div className="section-card mt-4" style={{ borderColor: "rgba(255,200,0,0.12)" }}>
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
                          {g.sessions === 0 ? "No sessions yet" : `Only ${g.sessions} session${g.sessions !== 1 ? "s" : ""} — needs more data`}
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

            {/* No sessions */}
            {stats.gameModeSessions.length === 0 && (
              <div className="section-card mt-4 py-14 flex flex-col items-center justify-center text-center">
                <Dumbbell className="w-12 h-12 mb-4" style={{ color: "rgba(255,255,255,0.06)" }} />
                <div className="font-black uppercase text-base mb-2"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: "0.08em" }}>
                  No sessions yet
                </div>
                <Link href="/practice"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-black text-sm uppercase"
                  style={{ fontFamily: "Oswald, sans-serif", background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.28)", color: "#ff005c", letterSpacing: "0.08em" }}>
                  <Dumbbell className="w-4 h-4" /> Start Practice
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
