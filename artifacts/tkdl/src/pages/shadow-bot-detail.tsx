import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, CircuitBoard, Lock, Dumbbell, Target, Zap, Trophy, ChevronRight, Ghost, TrendingUp, TrendingDown, Minus, Brain } from "lucide-react";

type GameModeRow = { gameTypeKey: string; gameTypeName: string; sessions: number; darts: number };

type TimelinePoint = { weekLabel: string; avg: number | null; darts: number };
type RivalryRow = { playerId: number; playerName: string; wins: number; losses: number; lastPlayed: string };

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
  practiceDarts?: number;
  matchDarts?: number;
  totalMatches?: number;
  matchWins?: number;
  matchWinRate?: number | null;
  total180s?: number;
  playerElo?: number;
};

type MatchRow = {
  id: number;
  playerId: number;
  playerName: string;
  winnerIdx: number | null;
  playerWon: boolean;
  p1Darts: number | null;
  p1Avg: number | null;
  p1CheckoutHits: number | null;
  p1_180s: number | null;
  gameTypeKey: string;
  gameTypeName: string;
  detail: string | null;
  createdAt: string;
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

const LEVEL_DESCRIPTIONS: Record<string, string> = {
  beginner: "Still finding its range. Feeds on every dart you log.",
  amateur:  "Developing patterns emerge. Dangerous on a good day.",
  club:     "Consistent scoring. Knows its favourite numbers.",
  county:   "High-level form. Checkout game coming together.",
  pro:      "Tour-level threat. Precision scoring and clean doubles.",
  elite:    "Peak form. Every session felt on the board.",
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ShadowBotDetail() {
  const params = useParams<{ playerId: string }>();
  const playerId = Number(params.playerId);

  const [stats, setStats]         = useState<ShadowBotStats | null>(null);
  const [matches, setMatches]     = useState<MatchRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(false);
  const [timeline, setTimeline]   = useState<TimelinePoint[]>([]);
  const [rivalry, setRivalry]     = useState<RivalryRow[]>([]);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    setError(false);
    Promise.all([
      fetch(`/api/players/${playerId}/shadow-bot-stats`).then(r => r.json()),
      fetch(`/api/shadow-bot/${playerId}/matches`).then(r => r.json()),
      fetch(`/api/players/${playerId}/bot-improvement-timeline`).then(r => r.ok ? r.json() : { timeline: [] }),
      fetch(`/api/players/${playerId}/shadow-rivalry`).then(r => r.ok ? r.json() : []),
    ])
      .then(([s, m, tl, rv]) => {
        setStats(s as ShadowBotStats);
        setMatches(Array.isArray(m) ? m as MatchRow[] : []);
        setTimeline(Array.isArray(tl?.timeline) ? tl.timeline : []);
        setRivalry(Array.isArray(rv) ? rv as RivalryRow[] : []);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [playerId]);

  if (!playerId) {
    return (
      <div className="p-6 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>Invalid bot ID</div>
    );
  }

  const lvlColor      = stats?.accuracyLevel ? (LEVEL_COLOR[stats.accuracyLevel] ?? "#ff005c") : "#ff005c";
  const lvlLabel      = stats?.accuracyLevel ? (LEVEL_LABEL[stats.accuracyLevel] ?? stats.accuracyLevel) : null;
  const nextLabel     = stats?.nextLevel ? (LEVEL_LABEL[stats.nextLevel] ?? stats.nextLevel) : null;
  const activeLevelIdx = stats?.accuracyLevel ? LEVEL_STEPS.findIndex(s => s.key === stats.accuracyLevel) : -1;
  const lvlDesc       = stats?.accuracyLevel ? (LEVEL_DESCRIPTIONS[stats.accuracyLevel] ?? "") : "";

  const matchWins     = matches.filter(m => m.playerWon === false).length;
  const matchLosses   = matches.filter(m => m.playerWon === true).length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      {/* Back link */}
      <Link href="/shadow-bot"
        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider"
        style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.28)", letterSpacing: "0.12em" }}>
        <ArrowLeft className="w-3.5 h-3.5" />
        Bot Roster
      </Link>

      {loading && (
        <div className="section-card py-16 text-center animate-pulse"
          style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
          Loading shadow bot…
        </div>
      )}

      {error && (
        <div className="section-card py-16 text-center"
          style={{ color: "rgba(255,0,92,0.6)", fontFamily: "Oswald, sans-serif" }}>
          Could not load bot data
        </div>
      )}

      {stats && !loading && (
        <>
          {/* ══ HERO ══ */}
          <div className="relative overflow-hidden rounded-2xl"
            style={{
              background: stats.locked
                ? "linear-gradient(135deg, rgba(255,0,92,0.05) 0%, rgba(9,9,15,0.98) 60%)"
                : `linear-gradient(135deg, ${lvlColor}0a 0%, rgba(9,9,15,0.98) 55%, ${lvlColor}04 100%)`,
              border: `1px solid ${stats.locked ? "rgba(255,0,92,0.18)" : `${lvlColor}28`}`,
            }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: `radial-gradient(ellipse at 10% 50%, ${stats.locked ? "rgba(255,0,92,0.08)" : `${lvlColor}10`} 0%, transparent 65%)` }} />

            <div className="relative p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                <div className="flex-1 min-w-0">
                  {/* Eyebrow */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg"
                      style={{ background: stats.locked ? "rgba(255,0,92,0.08)" : `${lvlColor}12`, border: `1px solid ${stats.locked ? "rgba(255,0,92,0.2)" : `${lvlColor}28`}` }}>
                      {stats.locked
                        ? <Lock className="w-3.5 h-3.5" style={{ color: "#ff005c" }} />
                        : <Ghost className="w-3.5 h-3.5" style={{ color: lvlColor }} />
                      }
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest"
                      style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.18em" }}>
                      Shadow Bot · Player Clone
                    </span>
                  </div>

                  {/* Name */}
                  <h1 className="font-black uppercase leading-none mb-2"
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      fontSize: "clamp(2.2rem, 6vw, 4rem)",
                      color: stats.locked ? "rgba(255,255,255,0.2)" : "#fff",
                      letterSpacing: "0.04em",
                      textShadow: stats.locked ? "none" : `0 0 40px ${lvlColor}30`,
                    }}>
                    Shadow{" "}
                    <span style={{ color: stats.locked ? "rgba(255,255,255,0.18)" : lvlColor,
                      textShadow: stats.locked ? "none" : `0 0 32px ${lvlColor}60` }}>
                      {stats.playerName}
                    </span>
                  </h1>

                  {/* Level or locked state */}
                  {stats.locked ? (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                        style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.2)" }}>
                        <Lock className="w-3 h-3" style={{ color: "#ff005c" }} />
                        <span className="text-xs font-black uppercase"
                          style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", letterSpacing: "0.1em" }}>
                          Offline — {stats.dartsNeeded - stats.totalDarts} darts to activate
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="px-3 py-1.5 rounded-lg"
                        style={{ background: `${lvlColor}14`, border: `1px solid ${lvlColor}38` }}>
                        <span className="text-xs font-black uppercase"
                          style={{ fontFamily: "Oswald, sans-serif", color: lvlColor, letterSpacing: "0.1em" }}>
                          {lvlLabel}
                        </span>
                      </div>
                      {stats.computedAvg != null && (
                        <div className="px-3 py-1.5 rounded-lg"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <span className="text-xs font-black" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                            {stats.computedAvg.toFixed(1)} avg
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <p className="text-sm leading-relaxed max-w-lg" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {stats.locked
                      ? `A shadow bot that mirrors ${stats.playerName}'s dart-throwing DNA. Needs ${stats.dartsNeeded - stats.totalDarts} more darts of practice data before it can come online.`
                      : `A living replica of ${stats.playerName}'s form, built from ${stats.totalDarts.toLocaleString()} darts of data. ${lvlDesc}`
                    }
                  </p>
                </div>

                {/* Right: CTA links */}
                <div className="flex flex-col gap-2 shrink-0">
                  <Link href={`/players/${playerId}`}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase whitespace-nowrap"
                    style={{ fontFamily: "Oswald, sans-serif", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", letterSpacing: "0.08em" }}>
                    <ChevronRight className="w-3.5 h-3.5" />
                    Player Profile
                  </Link>
                  {stats.locked && (
                    <Link href="/practice"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase whitespace-nowrap"
                      style={{ fontFamily: "Oswald, sans-serif", background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.28)", color: "#ff005c", letterSpacing: "0.08em" }}>
                      <Dumbbell className="w-3.5 h-3.5" />
                      Go Practice
                    </Link>
                  )}
                  {!stats.locked && (
                    <Link href="/practice"
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs uppercase whitespace-nowrap"
                      style={{ fontFamily: "Oswald, sans-serif", background: `${lvlColor}12`, border: `1px solid ${lvlColor}30`, color: lvlColor, letterSpacing: "0.08em" }}>
                      <Dumbbell className="w-3.5 h-3.5" />
                      Train More
                    </Link>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6">
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
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${stats.progressToNext}%`,
                      background: stats.locked
                        ? "linear-gradient(90deg, #ff005c, rgba(255,0,92,0.35))"
                        : `linear-gradient(90deg, ${lvlColor}, ${lvlColor}60)`,
                      boxShadow: `0 0 10px ${stats.locked ? "#ff005c" : lvlColor}50`,
                    }} />
                </div>
              </div>

              {/* Level pips */}
              <div className="flex items-center gap-2.5 mt-4">
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
            </div>
          </div>

          {/* ══ STATS GRID ══ */}
          {!stats.locked && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Form Avg",     value: stats.computedAvg != null ? stats.computedAvg.toFixed(1) : "—",  color: lvlColor },
                { label: "Checkout %",   value: stats.doubleHitPct != null ? `${Math.round(stats.doubleHitPct * 100)}%` : "—", color: "#22c55e" },
                { label: "Practice Sessions", value: stats.totalSessions.toString(), color: "#a78bfa" },
                { label: "Darts Logged", value: stats.totalDarts.toLocaleString(), color: "#ffd24a" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl px-4 py-4 text-center relative overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}07 0%, transparent 70%)` }} />
                  <div className="font-black text-2xl mb-1"
                    style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.92)" }}>
                    {value}
                  </div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* ══ BOT CAPABILITIES ══ */}
          {!stats.locked && (stats.primarySeg != null || (stats.checkoutSegs && stats.checkoutSegs.length > 0)) && (
            <div className="section-card">
              <h2 className="font-black uppercase text-sm mb-4 flex items-center gap-2"
                style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
                <Target className="w-3.5 h-3.5" style={{ color: lvlColor }} />
                Dart Profile
              </h2>
              <div className="flex flex-wrap items-center gap-6">
                {stats.primarySeg != null && (
                  <div>
                    <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.28)" }}>Primary Target</div>
                    <div className="font-black text-2xl px-3 py-1 rounded-lg inline-block"
                      style={{ fontFamily: "Oswald, sans-serif", background: `${lvlColor}14`, color: lvlColor, border: `1px solid ${lvlColor}30` }}>
                      T{stats.primarySeg}
                    </div>
                  </div>
                )}
                {stats.checkoutSegs && stats.checkoutSegs.length > 0 && (
                  <div>
                    <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.28)" }}>Preferred Checkouts</div>
                    <div className="flex gap-1.5">
                      {stats.checkoutSegs.map(s => (
                        <span key={s} className="font-black text-sm px-2.5 py-1.5 rounded-lg"
                          style={{ fontFamily: "Oswald, sans-serif", background: `${lvlColor}12`, color: lvlColor, border: `1px solid ${lvlColor}28` }}>
                          D{s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══ DATA SOURCES ══ */}
          <div className="section-card">
            <h2 className="font-black uppercase text-sm mb-4 flex items-center gap-2"
              style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
              <Zap className="w-3.5 h-3.5" style={{ color: "#ffd24a" }} />
              Data Sources
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl px-3 py-3 flex flex-col gap-1"
                style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.14)" }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Dumbbell className="w-3 h-3" style={{ color: "#a78bfa" }}/>
                  <span className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#a78bfa", fontSize: "0.52rem", letterSpacing: "0.1em" }}>Practice</span>
                </div>
                <div className="font-black text-lg" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)" }}>
                  {(stats.practiceDarts ?? 0).toLocaleString()}
                </div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem" }}>
                  darts · {stats.totalSessions} session{stats.totalSessions !== 1 ? "s" : ""}
                </div>
              </div>
              <div className="rounded-xl px-3 py-3 flex flex-col gap-1"
                style={{ background: "rgba(255,210,74,0.06)", border: "1px solid rgba(255,210,74,0.14)" }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Trophy className="w-3 h-3" style={{ color: "#ffd24a" }}/>
                  <span className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", fontSize: "0.52rem", letterSpacing: "0.1em" }}>League</span>
                </div>
                <div className="font-black text-lg" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)" }}>
                  {stats.matchWins ?? 0}W–{((stats.totalMatches ?? 0) - (stats.matchWins ?? 0))}L
                </div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem" }}>
                  {stats.totalMatches ?? 0} match{(stats.totalMatches ?? 0) !== 1 ? "es" : ""}
                </div>
              </div>
              <div className="rounded-xl px-3 py-3 flex flex-col gap-1"
                style={{ background: "rgba(0,210,150,0.06)", border: "1px solid rgba(0,210,150,0.14)" }}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <TrendingUp className="w-3 h-3" style={{ color: "#00d296" }}/>
                  <span className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#00d296", fontSize: "0.52rem", letterSpacing: "0.1em" }}>Elo Rating</span>
                </div>
                <div className="font-black text-lg" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)" }}>
                  {stats.playerElo ?? 1000}
                </div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem" }}>
                  league rating
                </div>
              </div>
            </div>
          </div>

          {/* ══ TRAINING BREAKDOWN ══ */}
          {stats.gameModeSessions.length > 0 && (
            <div className="section-card">
              <h2 className="font-black uppercase text-sm mb-4 flex items-center gap-2"
                style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
                <CircuitBoard className="w-3.5 h-3.5" style={{ color: "#ff005c" }} />
                Training by Game Mode
              </h2>
              <div className="space-y-3">
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
                        {g.sessions} session{g.sessions !== 1 ? "s" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ IMPROVEMENT TIMELINE ══ */}
          {timeline.filter(p => p.avg != null).length >= 2 && (
            <div className="section-card">
              <h2 className="font-black uppercase text-sm mb-4 flex items-center gap-2"
                style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
                <TrendingUp className="w-3.5 h-3.5" style={{ color: "#a78bfa" }} />
                Form Trend
                <span className="ml-auto text-xs font-normal normal-case" style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "normal" }}>
                  Last {timeline.length} weeks
                </span>
              </h2>
              {(() => {
                const points = timeline.filter(p => p.avg != null);
                const maxAvg = Math.max(...points.map(p => p.avg!));
                const minAvg = Math.min(...points.map(p => p.avg!));
                const range  = Math.max(maxAvg - minAvg, 5);
                const first  = points[0]?.avg ?? 0;
                const last   = points[points.length - 1]?.avg ?? 0;
                const delta  = last - first;
                const TrendIcon = delta > 2 ? TrendingUp : delta < -2 ? TrendingDown : Minus;
                const trendColor = delta > 2 ? "#22c55e" : delta < -2 ? "#ff005c" : "rgba(255,255,255,0.35)";
                return (
                  <>
                    <div className="flex items-end gap-1.5 h-20 mb-3">
                      {timeline.map((p, i) => {
                        const pct = p.avg != null ? ((p.avg - minAvg + 2) / (range + 4)) * 100 : 8;
                        const isLast = i === timeline.length - 1;
                        const color = p.avg == null ? "rgba(255,255,255,0.06)"
                          : isLast ? lvlColor : `${lvlColor}70`;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                            <div className="w-full rounded-t-sm transition-all duration-500"
                              style={{ height: `${Math.max(pct, 8)}%`, background: color }} />
                            {i % 2 === 0 && (
                              <span className="text-center leading-none" style={{ fontSize: "0.42rem", color: "rgba(255,255,255,0.18)", fontFamily: "Oswald, sans-serif" }}>
                                {p.weekLabel.replace("Wk ", "")}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <TrendIcon className="w-3.5 h-3.5" style={{ color: trendColor }} />
                        <span className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: trendColor, letterSpacing: "0.08em", fontSize: "0.62rem" }}>
                          {delta > 2 ? `+${delta.toFixed(1)} improving` : delta < -2 ? `${delta.toFixed(1)} declining` : "holding form"}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        <span>Low <span className="font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>{minAvg.toFixed(1)}</span></span>
                        <span>Peak <span className="font-bold" style={{ color: lvlColor }}>{maxAvg.toFixed(1)}</span></span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ══ RIVALRY TRACKER ══ */}
          {rivalry.length > 0 && (
            <div className="section-card">
              <h2 className="font-black uppercase text-sm mb-4 flex items-center gap-2"
                style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
                <Ghost className="w-3.5 h-3.5" style={{ color: "#ff005c" }} />
                Who Beats This Bot
                <Link href="/coach" className="ml-auto flex items-center gap-1 text-xs font-normal normal-case"
                  style={{ color: "rgba(167,139,250,0.6)", letterSpacing: "normal" }}>
                  <Brain className="w-3 h-3" />Coach Drills
                </Link>
              </h2>
              <div className="space-y-2">
                {rivalry.map(r => {
                  const total = r.wins + r.losses;
                  const winPct = total > 0 ? Math.round((r.wins / total) * 100) : 0;
                  const isPositive = r.wins >= r.losses;
                  return (
                    <div key={r.playerId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                      <Link href={`/players/${r.playerId}`}
                        className="flex-1 min-w-0 font-black text-sm truncate"
                        style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.8)" }}>
                        {r.playerName}
                      </Link>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold" style={{ color: isPositive ? "#22c55e" : "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                          {r.wins}W–{r.losses}L
                        </span>
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full" style={{ width: `${winPct}%`, background: isPositive ? "#22c55e" : "#ff005c" }} />
                        </div>
                        <span className="text-xs w-8 text-right" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                          {winPct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══ MATCH HISTORY VS THIS BOT ══ */}
          <div className="section-card">
            <h2 className="font-black uppercase text-sm mb-4 flex items-center gap-2"
              style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
              <Ghost className="w-3.5 h-3.5" style={{ color: lvlColor }} />
              Matches vs Shadow {stats.playerName}
              {matches.length > 0 && (
                <span className="ml-auto text-xs font-normal normal-case"
                  style={{ color: "rgba(255,255,255,0.25)", letterSpacing: "normal" }}>
                  {matchWins}W {matchLosses}L for the bot
                </span>
              )}
            </h2>

            {matches.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Ghost className="w-10 h-10 mb-3" style={{ color: "rgba(255,255,255,0.05)" }} />
                <div className="font-black uppercase text-sm mb-2"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.15)", letterSpacing: "0.1em" }}>
                  No matches yet
                </div>
                <p className="text-xs max-w-xs" style={{ color: "rgba(255,255,255,0.12)" }}>
                  Play against Shadow {stats.playerName} in Practice mode and the results will appear here.
                </p>
                <Link href="/practice"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg font-black text-xs uppercase"
                  style={{ fontFamily: "Oswald, sans-serif", background: `${lvlColor}10`, border: `1px solid ${lvlColor}28`, color: lvlColor, letterSpacing: "0.08em" }}>
                  <Dumbbell className="w-3.5 h-3.5" /> Challenge This Bot
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {matches.map(match => (
                  <div key={match.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-xl"
                    style={{
                      background: match.playerWon ? "rgba(34,197,94,0.04)" : "rgba(255,0,92,0.04)",
                      border: `1px solid ${match.playerWon ? "rgba(34,197,94,0.12)" : "rgba(255,0,92,0.12)"}`,
                    }}>
                    {/* Result pill */}
                    <div className="shrink-0 w-14 text-center px-2 py-1 rounded-lg"
                      style={{
                        background: match.playerWon ? "rgba(34,197,94,0.1)" : "rgba(255,0,92,0.1)",
                        border: `1px solid ${match.playerWon ? "rgba(34,197,94,0.25)" : "rgba(255,0,92,0.25)"}`,
                      }}>
                      <div className="font-black text-xs uppercase"
                        style={{ fontFamily: "Oswald, sans-serif", color: match.playerWon ? "#22c55e" : "#ff005c", letterSpacing: "0.08em" }}>
                        {match.playerWon ? "WIN" : "LOSS"}
                      </div>
                    </div>

                    {/* Player */}
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm truncate"
                        style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.82)" }}>
                        {match.playerName}
                      </div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
                        {match.gameTypeName}
                        {match.detail ? ` · ${match.detail}` : ""}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3 shrink-0">
                      {match.p1Avg != null && (
                        <div className="text-right hidden sm:block">
                          <div className="font-black text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                            {match.p1Avg.toFixed(1)}
                          </div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>avg</div>
                        </div>
                      )}
                      {match.p1Darts != null && (
                        <div className="text-right hidden md:block">
                          <div className="font-black text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.5)" }}>
                            {match.p1Darts}
                          </div>
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>darts</div>
                        </div>
                      )}
                      <div className="text-right">
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                          {formatDate(match.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
