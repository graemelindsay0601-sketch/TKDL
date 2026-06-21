import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Lock, CircuitBoard, Trophy, Star, Ghost, Shield, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";

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
  const [roster, setRoster] = useState<BotLeaderboardRow[]>([]);

  useEffect(() => {
    fetch("/api/bots/leaderboard")
      .then(r => r.json()).then(d => setRoster(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const topBots   = roster.filter(b => !b.locked).slice(0, 5);
  const onlineCount = roster.filter(r => !r.locked).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-8">

      {/* ══ HERO ══ */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(255,0,92,0.07) 0%, rgba(9,9,15,0.99) 55%, rgba(0,40,100,0.04) 100%)",
          border: "1px solid rgba(255,0,92,0.18)",
          minHeight: "320px",
        }}>
        {/* Glow orbs */}
        <div className="absolute top-0 left-0 w-96 h-96 pointer-events-none"
          style={{ background: "radial-gradient(circle at 15% 25%, rgba(255,0,92,0.14), transparent 60%)" }} />
        <div className="absolute bottom-0 right-0 w-64 h-64 pointer-events-none"
          style={{ background: "radial-gradient(circle at 85% 85%, rgba(167,139,250,0.05), transparent 65%)" }} />
        {/* Circuit grid texture */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, transparent 1px, transparent 40px, rgba(255,255,255,0.6) 41px), repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0px, transparent 1px, transparent 40px, rgba(255,255,255,0.6) 41px)" }} />

        <div className="relative p-6 md:p-10">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 rounded-xl"
              style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.2)" }}>
              <CircuitBoard className="w-5 h-5" style={{ color: "#ff005c", filter: "drop-shadow(0 0 8px rgba(255,0,92,0.8))" }} />
            </div>
            <div className="text-xs font-black uppercase tracking-widest"
              style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.7)", letterSpacing: "0.2em" }}>
              TKDL Shadow Bot Protocol
            </div>
          </div>

          {/* Main headline */}
          <div className="mb-6">
            <h1 className="font-black uppercase leading-none mb-2"
              style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: "clamp(2.6rem, 7vw, 5rem)",
                color: "#fff",
                letterSpacing: "0.03em",
                lineHeight: 0.9,
              }}>
              PLAY YOURSELF.
            </h1>
            <h2 className="font-black uppercase leading-none"
              style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: "clamp(2.6rem, 7vw, 5rem)",
                letterSpacing: "0.03em",
                lineHeight: 0.9,
                color: "#ff005c",
                textShadow: "0 0 40px rgba(255,0,92,0.5)",
              }}>
              BEAT YOURSELF.
            </h2>
          </div>

          <p className="text-sm leading-relaxed mb-8 max-w-lg" style={{ color: "rgba(255,255,255,0.42)" }}>
            Every dart you throw teaches your Shadow Bot. It learns your patterns, your favourite segments,
            your checkout targets — then turns them into an opponent you can actually face.{" "}
            <span style={{ color: "rgba(255,255,255,0.65)" }}>250 darts to activate.</span>
          </p>

          {/* Stat chips */}
          <div className="flex flex-wrap gap-3 mb-6">
            {[
              { icon: Ghost,       color: "#ff005c",  label: `${onlineCount} Bots Online`            },
              { icon: Star,        color: "#ffd24a",  label: `${TOTAL_BOT_GAMERSCORE}G Available`    },
              { icon: TrendingUp,  color: "#22c55e",  label: "Live Form — Updates Every Session"     },
            ].map(({ icon: Icon, color, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
                <Icon className="w-3.5 h-3.5" style={{ color }} />
                <span className="text-xs font-black uppercase"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.65)", letterSpacing: "0.06em" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          {/* Level roadmap */}
          <div className="flex items-center gap-0 flex-wrap">
            {LEVEL_STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs"
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      background: `${step.color}15`,
                      border: `1px solid ${step.color}35`,
                      color: step.color,
                    }}>
                    {i + 1}
                  </div>
                  <div className="text-center mt-1 hidden sm:block px-0.5">
                    <div className="font-black uppercase"
                      style={{ fontFamily: "Oswald, sans-serif", color: step.color, fontSize: "0.45rem", letterSpacing: "0.08em" }}>
                      {step.label}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.42rem" }}>{step.threshold}</div>
                  </div>
                </div>
                {i < LEVEL_STEPS.length - 1 && (
                  <div className="w-4 sm:w-8 h-px mt-0 sm:-mt-5 mx-0.5" style={{ background: "rgba(255,255,255,0.07)" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══ MINI LEADERBOARD ══ */}
      {topBots.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4" style={{ color: "#ff005c" }} />
              <h2 className="font-black uppercase text-sm tracking-wider"
                style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)", letterSpacing: "0.12em" }}>
                Top Bots
              </h2>
            </div>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
              By form level
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,0,92,0.15)", background: "rgba(255,0,92,0.03)" }}>
            {/* Header */}
            <div className="grid px-4 py-2"
              style={{
                gridTemplateColumns: "2rem 1fr 6rem 5rem 5rem",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}>
              {["#", "Bot", "Level", "Avg", "Darts"].map(h => (
                <div key={h} className="text-xs font-black uppercase tracking-widest text-right first:text-left"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: "0.12em" }}>
                  {h}
                </div>
              ))}
            </div>

            {topBots.map((bot, i) => {
              const color = LEVEL_COLOR[bot.accuracyLevel ?? "beginner"] ?? "#94a3b8";
              const label = LEVEL_LABEL[bot.accuracyLevel ?? "beginner"] ?? "Beginner";
              return (
                <Link key={bot.playerId} href={`/shadow-bot/${bot.playerId}`}>
                  <div className="grid px-4 py-3 cursor-pointer transition-all hover:bg-white/[0.03]"
                    style={{
                      gridTemplateColumns: "2rem 1fr 6rem 5rem 5rem",
                      borderBottom: i < topBots.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}>
                    {/* Rank */}
                    <div className="font-black text-sm self-center"
                      style={{ fontFamily: "Oswald, sans-serif", color: i === 0 ? "#ff005c" : "rgba(255,255,255,0.25)" }}>
                      {i === 0 ? "👑" : i + 1}
                    </div>
                    {/* Name */}
                    <div className="self-center min-w-0">
                      <div className="font-black text-sm truncate"
                        style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)", letterSpacing: "0.02em" }}>
                        Shadow {bot.playerName}
                      </div>
                    </div>
                    {/* Level */}
                    <div className="self-center text-right">
                      <span className="font-black text-xs uppercase px-2 py-0.5 rounded"
                        style={{ fontFamily: "Oswald, sans-serif", background: `${color}14`, color, border: `1px solid ${color}28`, fontSize: "0.55rem", letterSpacing: "0.08em" }}>
                        {label}
                      </span>
                    </div>
                    {/* Avg */}
                    <div className="self-center text-right font-black text-sm"
                      style={{ fontFamily: "Oswald, sans-serif", color }}>
                      {bot.computedAvg != null ? bot.computedAvg.toFixed(1) : "—"}
                    </div>
                    {/* Darts */}
                    <div className="self-center text-right text-xs"
                      style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                      {bot.totalDarts.toLocaleString()}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ BOT ROSTER ══ */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" style={{ color: "rgba(255,255,255,0.25)" }} />
            <h2 className="font-black uppercase text-sm tracking-wider"
              style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.55)", letterSpacing: "0.12em" }}>
              Full Roster
            </h2>
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
            {onlineCount} / {roster.length} online · tap to view bot
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
                <Link key={bot.playerId} href={`/shadow-bot/${bot.playerId}`}>
                  <div className="rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.015] cursor-pointer"
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
                        {/* Form trend arrow */}
                        {!bot.locked && (() => {
                          const lvlIdx = LEVEL_STEPS.findIndex(s => s.key === bot.accuracyLevel);
                          if (bot.progressToNext > 70 && lvlIdx < LEVEL_STEPS.length - 1) {
                            return <TrendingUp className="w-3 h-3 ml-auto shrink-0" style={{ color: "#22c55e" }} />;
                          } else if (bot.progressToNext < 20 && lvlIdx > 0) {
                            return <TrendingDown className="w-3 h-3 ml-auto shrink-0" style={{ color: "#ff005c" }} />;
                          } else {
                            return <Minus className="w-3 h-3 ml-auto shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />;
                          }
                        })()}
                      </div>

                      {/* Progress bar */}
                      {bot.locked && (
                        <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.58rem" }}>
                          {bot.totalDarts} / 250 darts to activate
                        </div>
                      )}
                      <div className="h-1 rounded-full overflow-hidden mb-3" style={{ background: "rgba(255,255,255,0.05)" }}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${bot.progressToNext}%`,
                            background: bot.locked
                              ? "linear-gradient(90deg, rgba(255,0,92,0.4), rgba(255,0,92,0.15))"
                              : `linear-gradient(90deg, ${color}, ${color}70)`,
                          }} />
                      </div>

                      {/* View link */}
                      <div className="flex items-center justify-end">
                        <span className="flex items-center gap-1 text-xs font-black uppercase"
                          style={{ fontFamily: "Oswald, sans-serif", color: bot.locked ? "rgba(255,255,255,0.18)" : color, letterSpacing: "0.06em", fontSize: "0.55rem" }}>
                          View Bot <ChevronRight className="w-2.5 h-2.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
