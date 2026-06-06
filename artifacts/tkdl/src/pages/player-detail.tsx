import { useGetPlayerStats, getGetPlayerStatsQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { TierBadge } from "@/components/tier-badge";
import { format } from "date-fns";
import { useState, useEffect, useRef } from "react";
import { Trophy, Skull, Flame, ArrowLeft, CheckCircle, ChevronDown, Zap, Dumbbell } from "lucide-react";

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(e * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function FormStrip({ matches, playerId }: { matches: any[]; playerId: number }) {
  if (!matches?.length) return null;
  const last10 = [...matches].slice(0, 10).reverse();
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {last10.map((m: any, i: number) => {
        const isWin = m.winnerId === playerId;
        return (
          <div key={i}
            className="w-6 h-6 rounded flex items-center justify-center font-black"
            style={{
              background: isWin ? "rgba(34,197,94,0.18)" : "rgba(255,0,92,0.18)",
              border: `1px solid ${isWin ? "rgba(34,197,94,0.45)" : "rgba(255,0,92,0.45)"}`,
              color: isWin ? "#22c55e" : "#ff005c",
              fontFamily: "Oswald, sans-serif", fontSize: "0.6rem",
            }}>
            {isWin ? "W" : "L"}
          </div>
        );
      })}
      <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
        FORM
      </span>
    </div>
  );
}

function EloSparkline({ currentElo, matches, playerId }: { currentElo: number; matches: any[]; playerId: number }) {
  if (!matches || matches.length < 2) return null;

  const pts: number[] = [currentElo];
  let elo = currentElo;
  for (const m of [...matches].slice(0, 15)) {
    const isWin = m.winnerId === playerId;
    elo = isWin ? elo - (m.eloChange ?? 16) : Math.min(elo + (m.eloChange ?? 16), 1600);
    elo = Math.max(800, elo);
    pts.unshift(elo);
  }

  const W = 300; const H = 56;
  const lo = Math.min(...pts) - 8;
  const hi = Math.max(...pts) + 8;
  const rng = hi - lo || 80;

  const coords = pts.map((v, i) => ({
    x: (i / (pts.length - 1)) * W,
    y: H - ((v - lo) / rng) * H,
  }));

  const path = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;
  const last = coords[coords.length - 1];
  const trending = pts[pts.length - 1] >= pts[0];
  const color = trending ? "#22c55e" : "#ff005c";
  const uid = `sg-${playerId}`;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>
          ELO Journey
        </span>
        <span className="font-mono text-xs font-bold" style={{ color }}>
          {trending ? "↑" : "↓"} {currentElo}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 56, display: "block" }}>
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${uid})`} />
        <path d={path} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last.x} cy={last.y} r="3.5" fill={color} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
      </svg>
      <div className="flex justify-between mt-0.5">
        <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.58rem" }}>{pts[0]}</span>
        <span className="font-mono text-xs" style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.58rem" }}>{pts[pts.length - 1]}</span>
      </div>
    </div>
  );
}

const RARITY_COLORS: Record<string, { color: string; glow: string; bg: string }> = {
  Common:    { color: "#9ca3af", glow: "rgba(156,163,175,0.3)", bg: "rgba(156,163,175,0.07)" },
  Rare:      { color: "#0066ff", glow: "rgba(0,102,255,0.3)",   bg: "rgba(0,102,255,0.07)"  },
  Epic:      { color: "#a855f7", glow: "rgba(168,85,247,0.35)", bg: "rgba(168,85,247,0.08)" },
  Legendary: { color: "#ffd24a", glow: "rgba(255,210,74,0.4)",  bg: "rgba(255,210,74,0.08)" },
  Mythic:    { color: "#ff005c", glow: "rgba(255,0,92,0.4)",    bg: "rgba(255,0,92,0.08)"   },
};

function AchievementCard({ a }: { a: any }) {
  const rc = RARITY_COLORS[a.rarity] ?? RARITY_COLORS.Common;
  const isHidden = a.hidden && !a.isUnlocked;
  const pct = Math.min(100, a.progressPct ?? 0);
  const isClose = pct >= 60 && !a.isUnlocked;
  return (
    <div className="relative rounded-lg overflow-hidden transition-all duration-200 cursor-default hover:-translate-y-0.5"
      style={{
        background: a.isUnlocked ? rc.bg : "rgba(255,255,255,0.025)",
        border: `1px solid ${a.isUnlocked ? rc.color + "55" : isClose ? rc.color + "33" : "rgba(255,255,255,0.07)"}`,
        padding: "0.625rem",
      }}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: a.isUnlocked ? rc.color : "transparent" }} />
      <div className="flex items-start gap-2.5">
        <div className={`text-2xl leading-none shrink-0 ${isHidden ? "grayscale opacity-30" : ""}`}>{isHidden ? "🔒" : a.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <div className="font-bold leading-tight" style={{ fontFamily: "Oswald, sans-serif", color: a.isUnlocked ? rc.color : isHidden ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)", fontSize: "0.7rem" }}>
              {isHidden ? "???" : a.name.replace(/^[^\s]+\s/, "")}
            </div>
            {a.isUnlocked && <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" style={{ color: rc.color }} />}
          </div>
          {!isHidden && (
            <div className="text-xs leading-tight mb-1" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.62rem" }}>{a.description}</div>
          )}
          {!a.isUnlocked && !isHidden && (
            <div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: isClose ? rc.color : "rgba(255,255,255,0.25)" }} />
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>
                {a.currentProgress ?? 0} / {a.criteriaValue}
              </div>
            </div>
          )}
          {a.isUnlocked && a.unlockedAt && (
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>
              {format(new Date(a.unlockedAt), "MMM d, yyyy")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BigStat({ value, label, color, suffix = "" }: { value: number; label: string; color: string; suffix?: string }) {
  const animated = useCountUp(value);
  return (
    <div className="flex flex-col items-center">
      <div className="font-black leading-none tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", color, textShadow: `0 0 24px ${color}50` }}>
        {animated}{suffix}
      </div>
      <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.58rem", letterSpacing: "0.15em" }}>
        {label}
      </div>
    </div>
  );
}

function SmallStat({ value, label, accent, suffix = "" }: { value: number; label: string; accent?: string; suffix?: string }) {
  const animated = useCountUp(value);
  return (
    <div className="pdc-card p-3.5 text-center">
      <div className="text-xs uppercase tracking-widest mb-1.5 font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.22)", fontSize: "0.58rem", letterSpacing: "0.15em" }}>
        {label}
      </div>
      <div className="text-xl font-bold leading-none" style={{ fontFamily: "Oswald, sans-serif", color: accent ?? "rgba(255,255,255,0.85)" }}>
        {animated}{suffix}
      </div>
    </div>
  );
}

const TIER_GLOW: Record<string, string> = {
  Diamond:  "#00d4ff",
  Platinum: "#e879f9",
  Gold:     "#ffd24a",
  Silver:   "#c0c8d8",
  Bronze:   "#cd7f32",
};

export default function PlayerDetail() {
  const params = useParams();
  const playerId = parseInt(params.id || "0", 10);
  const [achFilter, setAchFilter] = useState<"all" | "unlocked" | "locked" | "close">("all");
  const [showAllAch, setShowAllAch] = useState(false);
  const [profileTab, setProfileTab] = useState<"matches" | "h2h" | "practice">("matches");

  const { data: stats, isLoading } = useGetPlayerStats(playerId, {
    query: { enabled: !!playerId, queryKey: getGetPlayerStatsQueryKey(playerId) },
  });

  const [achProgress, setAchProgress] = useState<any[]>([]);
  useEffect(() => {
    if (!playerId) return;
    fetch(`/api/players/${playerId}/achievement-progress`)
      .then(r => r.json()).then(d => setAchProgress(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [playerId]);

  const [gameTypes, setGameTypes] = useState<any[]>([]);
  useEffect(() => {
    if (!playerId) return;
    fetch(`/api/players/${playerId}/game-types`)
      .then(r => r.json()).then(d => setGameTypes(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [playerId]);

  const [practiceAgg, setPracticeAgg] = useState<any>(null);
  const [practiceSessions, setPracticeSessions] = useState<any[]>([]);
  const [dartProfile, setDartProfile] = useState<any>(null);
  useEffect(() => {
    if (!playerId) return;
    fetch(`/api/players/${playerId}/practice-stats`)
      .then(r => r.json()).then(d => setPracticeAgg(d))
      .catch(() => {});
    fetch(`/api/players/${playerId}/practice-sessions`)
      .then(r => r.json()).then(d => setPracticeSessions(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch(`/api/players/${playerId}/dart-profile`)
      .then(r => r.json()).then(d => setDartProfile(d))
      .catch(() => {});
  }, [playerId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
      </div>
    );
  }
  if (!stats) return <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.3)" }}>Player not found.</div>;

  const { player, seasonHistory, recentMatches } = stats;
  const identity = (stats as any).identity ?? {};
  const headToHead = (stats as any).headToHead ?? [];
  const isEliminated = player.status === "ELIMINATED";
  const derivedTier = player.elo >= 1400 ? "Diamond" : player.elo >= 1250 ? "Platinum" : player.elo >= 1100 ? "Gold" : player.elo >= 950 ? "Silver" : "Bronze";
  const tier = (player as any).tier || derivedTier;
  const tierColor = TIER_GLOW[tier] ?? "#ff005c";

  const totalGames = player.careerGamesPlayed ?? 0;
  const winRate = totalGames > 0 ? Math.round(((player.careerWins ?? 0) / totalGames) * 100) : 0;
  const unlockedCount = achProgress.filter(a => a.isUnlocked).length;
  const closeCount = achProgress.filter(a => !a.isUnlocked && (a.progressPct ?? 0) >= 50).length;

  const filteredAch = achProgress.filter(a => {
    if (achFilter === "unlocked") return a.isUnlocked;
    if (achFilter === "locked") return !a.isUnlocked && !a.hidden;
    if (achFilter === "close") return !a.isUnlocked && (a.progressPct ?? 0) >= 50;
    return true;
  });
  const displayedAch = showAllAch ? filteredAch : filteredAch.slice(0, 18);

  const streak = player.currentWinStreak ?? 0;
  const lossStreak = player.currentLossStreak ?? 0;

  return (
    <div className="space-y-5 pb-8">
      <div className="pdc-divider" />

      <Link href="/players" className="inline-flex items-center gap-1.5 text-xs hover:underline"
        style={{ color: "rgba(255,255,255,0.3)" }}>
        <ArrowLeft className="w-3 h-3" /> All Players
      </Link>

      {/* ══ CINEMATIC HERO ══ */}
      <div className="relative overflow-hidden rounded-2xl"
        style={{
          background: isEliminated
            ? "linear-gradient(135deg, rgba(255,0,92,0.1) 0%, rgba(9,9,15,0.98) 60%)"
            : `linear-gradient(135deg, ${tierColor}12 0%, rgba(9,9,15,0.98) 55%, rgba(0,102,255,0.05) 100%)`,
          border: `1px solid ${isEliminated ? "rgba(255,0,92,0.25)" : `${tierColor}28`}`,
          boxShadow: `0 0 60px ${isEliminated ? "rgba(255,0,92,0.08)" : `${tierColor}08`}`,
        }}>

        {/* Large rank watermark */}
        {(stats as any).rank && (
          <div className="absolute right-[-1.5rem] bottom-[-1rem] font-black pointer-events-none select-none leading-none"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "min(20vw, 14rem)", color: `${tierColor}07`, zIndex: 0 }}>
            #{(stats as any).rank}
          </div>
        )}

        {/* Tier glow orb */}
        <div className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
          style={{ background: `radial-gradient(circle at 80% 20%, ${tierColor}10, transparent 65%)`, zIndex: 0 }} />

        <div className="relative p-5 md:p-7" style={{ zIndex: 1 }}>
          {/* Row 1: badges */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <TierBadge tier={tier} />
            {identity.archetype && (
              <span className="aura-badge text-xs" style={{ color: "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.1)" }}>
                {identity.archetype}
              </span>
            )}
            {identity.aura && (
              <span className="aura-badge text-xs" style={{ color: "#0066ff", borderColor: "rgba(0,102,255,0.3)", background: "rgba(0,102,255,0.06)" }}>
                {identity.aura}
              </span>
            )}
            {isEliminated && (
              <span className="aura-badge animate-pulse" style={{ color: "#ff005c", borderColor: "rgba(255,0,92,0.4)", background: "rgba(255,0,92,0.1)" }}>
                <Skull className="w-3 h-3 inline mr-1" />ELIMINATED
              </span>
            )}
          </div>

          {/* Row 2: name + key stats */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
            <div className="flex-1 min-w-0">
              {identity.title && (
                <div className="text-sm mb-1" style={{ color: "rgba(255,210,74,0.7)", fontStyle: "italic" }}>
                  "{identity.title}"
                </div>
              )}
              <h1 className="font-black uppercase leading-none mb-2"
                style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(2.2rem, 7vw, 4.5rem)", letterSpacing: "0.03em",
                  color: isEliminated ? "#ff005c" : "#fff",
                  textShadow: isEliminated ? "0 0 40px rgba(255,0,92,0.5)" : `0 0 40px ${tierColor}20` }}>
                {player.name}
                {streak >= 3 && <span className="ml-3 text-3xl animate-bounce inline-block">🔥</span>}
              </h1>

              {/* Form strip */}
              <FormStrip matches={recentMatches ?? []} playerId={player.id} />

              {/* Prestige */}
              {identity.prestige && (
                <div className="mt-2">
                  <span className="aura-badge text-xs" style={{ color: "#ffd24a", borderColor: "rgba(255,210,74,0.3)", background: "rgba(255,210,74,0.06)" }}>
                    ★ {identity.prestige}
                  </span>
                </div>
              )}
            </div>

            {/* Key 3 stats */}
            <div className="flex items-center gap-4 sm:gap-6 shrink-0 py-2">
              <BigStat value={player.points} label="Points" color={isEliminated ? "#ff005c" : "#ff005c"} />
              <div className="w-px h-12 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }} />
              <BigStat value={player.elo} label="ELO" color="#0066ff" />
              <div className="w-px h-12 rounded-full hidden sm:block" style={{ background: "rgba(255,255,255,0.08)" }} />
              <div className="hidden sm:flex flex-col items-center">
                <div className="font-black leading-none" style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(1.4rem, 3vw, 2rem)" }}>
                  <span style={{ color: "#22c55e" }}>{player.seasonWins ?? 0}</span>
                  <span style={{ color: "rgba(255,255,255,0.18)" }}>-</span>
                  <span style={{ color: "#ff005c" }}>{player.seasonLosses ?? 0}</span>
                </div>
                <div className="text-xs font-bold uppercase tracking-widest mt-1" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.58rem" }}>
                  Season
                </div>
              </div>
            </div>
          </div>

          {/* Streak alerts */}
          {(streak >= 3 || lossStreak >= 3) && (
            <div className="flex gap-2 mt-4 flex-wrap">
              {streak >= 3 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: "rgba(255,0,92,0.12)", border: "1px solid rgba(255,0,92,0.3)", color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                  <Flame className="w-4 h-4 streak-fire" />{streak}W STREAK — ON FIRE
                </div>
              )}
              {lossStreak >= 3 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold"
                  style={{ background: "rgba(255,0,92,0.06)", border: "1px solid rgba(255,0,92,0.15)", color: "rgba(255,0,92,0.7)", fontFamily: "Oswald, sans-serif" }}>
                  <Skull className="w-3.5 h-3.5" />{lossStreak}L STREAK — COLD RUN
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${tierColor}40, transparent)` }} />
      </div>

      {/* ══ ELO JOURNEY ══ */}
      {recentMatches && recentMatches.length >= 2 && (
        <div className="pdc-card p-4">
          <EloSparkline currentElo={player.elo} matches={recentMatches} playerId={player.id} />
        </div>
      )}

      {/* ══ SEASON STATS ══ */}
      <div>
        <div className="text-xs uppercase font-bold mb-2.5"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.22)", letterSpacing: "0.15em" }}>
          Current Season
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <SmallStat label="Wins"     value={player.seasonWins ?? 0}         accent="#22c55e" />
          <SmallStat label="Losses"   value={player.seasonLosses ?? 0}       accent="#ff005c" />
          <SmallStat label="Played"   value={player.seasonGamesPlayed ?? 0} />
          <SmallStat label="Win %"    value={(player.seasonGamesPlayed ?? 0) > 0 ? Math.round(((player.seasonWins ?? 0) / Math.max(1, player.seasonGamesPlayed ?? 1)) * 100) : 0} suffix="%" />
          <SmallStat label="W-Streak" value={streak}  accent={streak >= 3 ? "#ff005c" : undefined} />
          <SmallStat label="L-Streak" value={lossStreak} accent={lossStreak >= 3 ? "#ff005c" : undefined} />
        </div>
      </div>

      {/* ══ CAREER STATS ══ */}
      <div>
        <div className="text-xs uppercase font-bold mb-2.5"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.22)", letterSpacing: "0.15em" }}>
          Career
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <SmallStat label="Wins"      value={player.careerWins ?? 0}     accent="#22c55e" />
          <SmallStat label="Losses"    value={player.careerLosses ?? 0}   accent="#ff005c" />
          <SmallStat label="Played"    value={totalGames} />
          <SmallStat label="Win %"     value={winRate}                     suffix="%" accent={winRate >= 60 ? "#ffd24a" : undefined} />
          <SmallStat label="Peak ELO"  value={player.careerPeakElo ?? player.elo} accent="#0066ff" />
          <SmallStat label="Career Pts" value={player.careerPoints ?? 0}
            accent={(player.careerPoints ?? 0) >= 0 ? "#22c55e" : "#ff005c"} />
        </div>
      </div>

      {/* ══ RECENT MATCHES + H2H ══ */}

      {/* Mobile tab switcher */}
      <div className="lg:hidden flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {([
          { key: "matches",  label: "Matches",  Icon: Zap,      activeColor: "#ff005c", activeBg: "rgba(255,0,92,0.12)"      },
          { key: "h2h",      label: "H2H",      Icon: Trophy,   activeColor: "#ff005c", activeBg: "rgba(255,0,92,0.12)"      },
          { key: "practice", label: "Practice", Icon: Dumbbell, activeColor: "#a78bfa", activeBg: "rgba(167,139,250,0.12)"   },
        ] as const).map(({ key, label, Icon, activeColor, activeBg }) => (
          <button key={key} onClick={() => setProfileTab(key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black uppercase tracking-widest transition-all"
            style={{
              fontFamily: "Oswald, sans-serif",
              letterSpacing: "0.1em",
              background: profileTab === key ? activeBg : "rgba(255,255,255,0.02)",
              color: profileTab === key ? activeColor : "rgba(255,255,255,0.35)",
              borderBottom: profileTab === key ? `2px solid ${activeColor}` : "2px solid transparent",
            }}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent matches */}
        <div className={`pdc-card overflow-hidden ${profileTab !== "matches" ? "hidden lg:block" : ""}`}>
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Recent Matches
            </h2>
            <Zap className="w-3.5 h-3.5" style={{ color: "rgba(0,102,255,0.5)" }} />
          </div>
          <div>
            {recentMatches?.slice(0, 8).map((m: any) => {
              const isWin = m.winnerId === player.id;
              return (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between border-b hover:bg-white/[0.02] transition-colors"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1 h-8 rounded-full shrink-0" style={{ background: isWin ? "#22c55e" : "#ff005c" }} />
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider"
                        style={{ fontFamily: "Oswald, sans-serif", color: isWin ? "#22c55e" : "#ff005c", fontSize: "0.65rem" }}>
                        {isWin ? "WIN" : "LOSS"}
                      </div>
                      <div className="text-sm font-bold truncate" style={{ color: "rgba(255,255,255,0.7)" }}>
                        vs {isWin ? m.loserName : m.winnerName}
                      </div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {format(new Date(m.playedAt), "d MMM yy")}
                      </div>
                      {m.gameType && (
                        <div className="text-xs italic truncate" style={{ color: "rgba(255,255,255,0.18)", maxWidth: "10rem" }}>
                          {m.gameType}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {m.stake > 0 && (
                      <div className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: isWin ? "#22c55e" : "#ff005c" }}>
                        {isWin ? "+" : "-"}{m.stake}pts
                      </div>
                    )}
                    <div className="text-xs font-mono" style={{ color: "rgba(0,102,255,0.55)" }}>
                      {isWin ? "+" : "-"}{m.eloChange} ELO
                    </div>
                  </div>
                </div>
              );
            })}
            {(!recentMatches || recentMatches.length === 0) && (
              <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>No matches yet</div>
            )}
          </div>
        </div>

        {/* Head-to-head */}
        <div className={`pdc-card overflow-hidden ${profileTab !== "h2h" ? "hidden lg:block" : ""}`}>
          <div className="px-4 py-3 border-b flex items-center justify-between"
            style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Head-to-Head
            </h2>
            <Trophy className="w-3.5 h-3.5" style={{ color: "rgba(255,210,74,0.5)" }} />
          </div>
          <div>
            {headToHead.slice(0, 8).map((h: any) => {
              const total = h.wins + h.losses;
              const winPct = total > 0 ? Math.round((h.wins / total) * 100) : 0;
              const dominant = winPct >= 65;
              const struggling = winPct <= 35;
              return (
                <div key={h.opponentId}
                  className="px-4 py-3 flex items-center gap-3 border-b hover:bg-white/[0.02] transition-colors"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <Link href={`/players/${h.opponentId}`} className="text-sm font-bold hover:underline shrink-0 w-20 truncate"
                    style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.65)" }}>
                    {h.opponentName}
                  </Link>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono w-5 text-right" style={{ color: "#22c55e" }}>{h.wins}W</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${winPct}%`, background: dominant ? "#22c55e" : struggling ? "#ff005c" : "#0066ff" }} />
                      </div>
                      <span className="text-xs font-mono w-5" style={{ color: "#ff005c" }}>{h.losses}L</span>
                    </div>
                  </div>
                  <div className="text-xs font-bold w-8 text-right shrink-0"
                    style={{ fontFamily: "Oswald, sans-serif", color: dominant ? "#22c55e" : struggling ? "#ff005c" : "rgba(255,255,255,0.35)" }}>
                    {winPct}%
                  </div>
                </div>
              );
            })}
            {headToHead.length === 0 && (
              <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>No match history</div>
            )}
          </div>
        </div>
      </div>

      {/* ══ PRACTICE STATS ══ */}
      <div className={`pdc-card overflow-hidden ${profileTab !== "practice" ? "hidden lg:block" : ""}`}>
        <div className="px-4 py-3 border-b flex items-center justify-between"
          style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
            Practice Stats
          </h2>
          <Dumbbell className="w-3.5 h-3.5" style={{ color: "rgba(167,139,250,0.5)" }} />
        </div>

        {/* Aggregate summary */}
        {practiceAgg && Number(practiceAgg.total_sessions) > 0 ? (
          <>
            {/* ── Row 1: core averages ── */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.07]" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {[
                { label: "3-Dart Avg",  value: practiceAgg.avg_three_dart,   color: "#a78bfa", fmt: (v: number|null) => v != null ? Number(v).toFixed(1) : "—" },
                { label: "Best Session Avg", value: practiceAgg.best_session_avg, color: "#c4b5fd", fmt: (v: number|null) => v != null ? Number(v).toFixed(1) : "—" },
                { label: "First 9 Avg", value: practiceAgg.visit_stats?.first9_avg, color: "#818cf8", fmt: (v: number|null) => v != null ? Number(v).toFixed(1) : "—" },
              ].map(({ label, value, color, fmt }) => (
                <div key={label} className="px-3 py-3 text-center">
                  <div className="text-2xl font-black tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", color }}>
                    {fmt(value as any)}
                  </div>
                  <div className="text-xs mt-1 uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.52rem" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Row 2: key counts ── */}
            <div className="grid grid-cols-5 divide-x divide-white/[0.07]" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              {[
                { label: "Sessions",     value: practiceAgg.total_sessions ?? 0,   color: "rgba(255,255,255,0.6)", fmt: (v: number) => String(v) },
                { label: "180s",         value: practiceAgg.total_180s ?? 0,        color: "#ffd24a",              fmt: (v: number) => String(v) },
                { label: "140+",         value: practiceAgg.visit_stats?.v140 ?? 0, color: "#f97316",              fmt: (v: number) => String(v) },
                { label: "100+",         value: practiceAgg.visit_stats?.v100 ?? 0, color: "#fb923c",              fmt: (v: number) => String(v) },
                { label: "Checkout %",   value: practiceAgg.total_co_attempts > 0 ? Math.round((practiceAgg.total_co_hits / practiceAgg.total_co_attempts) * 100) : null, color: "#22c55e", fmt: (v: number|null) => v != null ? `${v}%` : "—" },
              ].map(({ label, value, color, fmt }) => (
                <div key={label} className="px-2 py-3 text-center">
                  <div className="text-lg font-black tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", color }}>
                    {fmt(value as any)}
                  </div>
                  <div className="text-xs mt-1 uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.5rem" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Visit Score Distribution ── */}
            {practiceAgg.visit_stats && Number(practiceAgg.visit_stats.total_visits) > 0 && (() => {
              const vs = practiceAgg.visit_stats;
              const total = Number(vs.total_visits);
              const buckets = [
                { label: "180",    val: Number(vs.v180 ?? 0),  color: "#ffd24a" },
                { label: "140–179",val: Number(vs.v140 ?? 0),  color: "#f97316" },
                { label: "100–139",val: Number(vs.v100 ?? 0),  color: "#fb923c" },
                { label: "60–99",  val: Number(vs.v60  ?? 0),  color: "#a78bfa" },
                { label: "40–59",  val: Number(vs.v40  ?? 0),  color: "rgba(167,139,250,0.45)" },
                { label: "1–39",   val: Number(vs.v_low ?? 0), color: "rgba(255,255,255,0.2)" },
                { label: "0",      val: Number(vs.v_zero ?? 0),color: "rgba(255,0,92,0.3)" },
              ];
              const maxVal = Math.max(...buckets.map(b => b.val), 1);
              return (
                <div className="border-t px-4 py-3" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", fontSize: "0.52rem" }}>
                      Visit Score Distribution
                    </span>
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>
                      {total} visits · best {vs.best_visit ?? "—"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {buckets.map(b => {
                      const pct = total > 0 ? Math.round((b.val / total) * 100) : 0;
                      const barW = Math.round((b.val / maxVal) * 100);
                      return (
                        <div key={b.label} className="flex items-center gap-2">
                          <span className="text-xs font-bold shrink-0 text-right" style={{ width: 52, fontFamily: "Oswald, sans-serif", color: b.color, fontSize: "0.62rem" }}>
                            {b.label}
                          </span>
                          <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <div className="h-full rounded transition-all" style={{ width: `${barW}%`, background: b.color, opacity: 0.85 }} />
                          </div>
                          <div className="shrink-0 flex gap-1.5 items-center" style={{ width: 52 }}>
                            <span className="text-xs font-black tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: b.color, fontSize: "0.65rem" }}>{b.val}</span>
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── Dart Profile ────────────────────────────────────────────── */}
            {dartProfile && (dartProfile.hasEnoughData || (dartProfile.totalDarts > 0 && !dartProfile.hasEnoughData)) && (
              <div className="border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <div className="px-4 py-2 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", fontSize: "0.55rem" }}>
                    🎯 Dart Profile
                  </span>
                  {!dartProfile.hasEnoughData && (
                    <span className="text-xs" style={{ color: "rgba(167,139,250,0.4)", fontSize: "0.6rem" }}>
                      {dartProfile.totalDarts}/{dartProfile.minRequired} darts to unlock
                    </span>
                  )}
                </div>

                {dartProfile.hasEnoughData ? (
                  <div className="px-4 py-3 space-y-4">
                    {/* Primary target + summary row */}
                    <div className="flex items-start gap-4">
                      {dartProfile.primaryTarget && (
                        <div className="shrink-0 text-center">
                          <div className="text-2xl font-black leading-none" style={{ fontFamily: "Oswald, sans-serif", color: "#a78bfa" }}>
                            T{dartProfile.primaryTarget.seg === 25 ? "Bull" : dartProfile.primaryTarget.seg}
                          </div>
                          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.6rem" }}>PRIMARY</div>
                        </div>
                      )}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between text-xs" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.65rem" }}>
                          <span>Treble accuracy</span>
                          <span style={{ color: "#a78bfa", fontFamily: "Oswald, sans-serif" }}>{dartProfile.primaryTarget?.treblePct ?? 0}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${dartProfile.primaryTarget?.treblePct ?? 0}%`, background: "linear-gradient(90deg,#7c3aed,#a78bfa)" }} />
                        </div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>{dartProfile.totalDarts.toLocaleString()} darts profiled</div>
                      </div>
                    </div>

                    {/* Scoring distribution */}
                    {dartProfile.scoringDistribution?.length > 0 && (
                      <div>
                        <div className="text-xs mb-1.5 uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.55rem", fontFamily: "Oswald, sans-serif" }}>Scoring targets</div>
                        <div className="space-y-1">
                          {dartProfile.scoringDistribution.slice(0, 5).map((seg: any) => (
                            <div key={seg.seg} className="flex items-center gap-2">
                              <span className="text-xs font-bold w-8 text-right shrink-0" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.5)", fontSize: "0.65rem" }}>{seg.label}</span>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                                <div className="h-full rounded-full" style={{ width: `${seg.pct}%`, background: seg === dartProfile.scoringDistribution[0] ? "#a78bfa" : "rgba(167,139,250,0.35)" }} />
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 w-24">
                                <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.6rem" }}>{seg.pct}%</span>
                                {seg.treble > 0 && <span className="text-xs font-mono" style={{ color: "#a78bfa", fontSize: "0.58rem" }}>{seg.treblePct}%T</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Checkout preferences */}
                    {dartProfile.checkoutPrefs?.length > 0 && (
                      <div>
                        <div className="text-xs mb-1.5 uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.55rem", fontFamily: "Oswald, sans-serif" }}>Preferred doubles</div>
                        <div className="flex flex-wrap gap-1.5">
                          {dartProfile.checkoutPrefs.map((co: any, i: number) => (
                            <div key={co.seg} className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                              style={{ background: i === 0 ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.05)", border: `1px solid ${i === 0 ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.06)"}` }}>
                              <span className="text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif", color: i === 0 ? "#a78bfa" : "rgba(255,255,255,0.4)", fontSize: "0.65rem" }}>{co.label}</span>
                              <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.58rem" }}>{co.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Progress towards unlocking */
                  <div className="px-4 py-3">
                    <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((dartProfile.totalDarts / dartProfile.minRequired) * 100)}%`, background: "rgba(167,139,250,0.4)" }} />
                    </div>
                    <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.62rem" }}>
                      Keep practising — profile unlocks at {dartProfile.minRequired} darts
                    </p>
                  </div>
                )}
              </div>
            )}

            {practiceSessions.length > 0 && (
              <div>
                <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", fontSize: "0.55rem" }}>
                    Recent Sessions
                  </span>
                </div>
                {practiceSessions.slice(0, 10).map((s: any) => {
                  const avg    = s.p1_avg != null ? Number(s.p1_avg).toFixed(1) : null;
                  const won    = s.winner_idx === 0;
                  const coHits = Number(s.p1_checkout_hits ?? 0);
                  const coAtt  = Number(s.p1_checkout_attempts ?? 0);
                  const coPct  = coAtt > 0 ? Math.round((coHits / coAtt) * 100) : null;
                  return (
                    <div key={s.id} className="px-4 py-2.5 flex items-center gap-3 border-b hover:bg-white/[0.02] transition-colors"
                      style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                      <div className="w-1 h-7 rounded-full shrink-0"
                        style={{ background: s.winner_idx === null ? "rgba(255,255,255,0.15)" : won ? "#22c55e" : "#ff005c" }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.75)" }}>
                            {s.game_type_name}
                          </span>
                          {s.winner_idx !== null && (
                            <span className="text-xs font-black" style={{ fontFamily: "Oswald, sans-serif", color: won ? "#22c55e" : "#ff005c", fontSize: "0.62rem" }}>
                              {won ? "WIN" : "LOSS"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          {avg && <span className="text-xs font-mono" style={{ color: "#a78bfa" }}>{avg} avg</span>}
                          {Number(s.p1_180s) > 0 && <span className="text-xs font-mono" style={{ color: "#ffd24a" }}>{s.p1_180s}×180</span>}
                          {coPct !== null && <span className="text-xs font-mono" style={{ color: "#22c55e" }}>{coPct}% co</span>}
                        </div>
                      </div>
                      <div className="text-xs shrink-0 text-right" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                        {format(new Date(s.created_at), "d MMM")}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="px-4 py-10 text-center">
            <Dumbbell className="w-8 h-8 mx-auto mb-3 opacity-10" style={{ color: "#a78bfa" }} />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>No practice sessions yet</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.1)" }}>Play some X01 practice matches to start tracking stats</p>
          </div>
        )}
      </div>

      {/* ══ FORMAT STATS ══ */}
      {gameTypes.length > 0 && (() => {
        const FORMAT_ICONS: Record<string, string> = {
          Cricket: "🦗", "301": "🎯", "501": "⚡", "Around the World": "🌍",
          Killer: "💀", Shanghai: "🐉", "Bull Finish": "🎪", Treble: "⚔️", "1001": "🌠",
        };
        const best = [...gameTypes].sort((a, b) => b.wins - a.wins || b.winRate - a.winRate)[0];
        const worst = [...gameTypes].filter(g => g.losses > g.wins).sort((a, b) => a.winRate - b.winRate)[0];
        return (
          <div className="pdc-card overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <h2 className="font-bold uppercase text-sm tracking-wider"
                style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                Format Stats
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,210,74,0.1)", color: "rgba(255,210,74,0.7)", border: "1px solid rgba(255,210,74,0.2)" }}>
                {gameTypes.length} formats
              </span>
            </div>
            <div>
              {gameTypes.map((g: any) => {
                const isBest  = best  && g.gameType === best.gameType;
                const isWorst = worst && g.gameType === worst.gameType;
                const barColor = g.winRate >= 60 ? "#22c55e" : g.winRate >= 40 ? "#0066ff" : "#ff005c";
                return (
                  <div key={g.gameType}
                    className="px-4 py-2.5 flex items-center gap-3 border-b hover:bg-white/[0.015] transition-colors"
                    style={{ borderColor: "rgba(255,255,255,0.04)", background: isBest ? "rgba(255,210,74,0.02)" : undefined }}>
                    <span className="text-base shrink-0 w-5 text-center leading-none">
                      {FORMAT_ICONS[g.gameType] ?? "🎯"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm font-bold truncate"
                          style={{ fontFamily: "Oswald, sans-serif", color: isBest ? "#ffd24a" : isWorst ? "rgba(255,0,92,0.7)" : "rgba(255,255,255,0.75)" }}>
                          {g.gameType}
                        </span>
                        {isBest && (
                          <span className="px-1.5 py-0.5 rounded font-black"
                            style={{ background: "rgba(255,210,74,0.15)", color: "#ffd24a", fontSize: "0.52rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                            BEST
                          </span>
                        )}
                        {isWorst && (
                          <span className="px-1.5 py-0.5 rounded font-black"
                            style={{ background: "rgba(255,0,92,0.1)", color: "rgba(255,0,92,0.6)", fontSize: "0.52rem", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
                            NEMESIS
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)", maxWidth: 100 }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${g.winRate}%`, background: barColor }} />
                        </div>
                        <span className="text-xs font-mono tabular-nums"
                          style={{ color: barColor === "#22c55e" ? "rgba(34,197,94,0.7)" : barColor === "#ff005c" ? "rgba(255,0,92,0.7)" : "rgba(0,102,255,0.7)", fontSize: "0.6rem" }}>
                          {g.winRate}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-sm font-bold">
                        <span style={{ color: "#22c55e" }}>{g.wins}</span>
                        <span style={{ color: "rgba(255,255,255,0.18)" }}>–</span>
                        <span style={{ color: "#ff005c" }}>{g.losses}</span>
                      </div>
                      {g.netPoints !== 0 && (
                        <div className="text-xs font-bold tabular-nums"
                          style={{ color: g.netPoints > 0 ? "rgba(34,197,94,0.55)" : "rgba(255,0,92,0.55)", fontSize: "0.62rem" }}>
                          {g.netPoints > 0 ? "+" : ""}{g.netPoints}pts
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ══ SEASON HISTORY ══ */}
      {seasonHistory && seasonHistory.length > 0 && (
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Season History
            </h2>
          </div>
          <div className="grid text-xs uppercase font-bold px-4 py-2 border-b"
            style={{ gridTemplateColumns: "1fr 4rem 5rem 4rem 5rem", borderColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.22)", fontFamily: "Oswald, sans-serif" }}>
            <div>Season</div><div className="text-center">Pos</div><div className="text-center">W-L</div><div className="text-right">ELO</div><div className="text-right">Pts</div>
          </div>
          {seasonHistory.map((s: any) => (
            <div key={s.seasonId}
              className="grid px-4 py-3 border-b items-center hover:bg-white/[0.02] transition-colors"
              style={{ gridTemplateColumns: "1fr 4rem 5rem 4rem 5rem", borderColor: "rgba(255,255,255,0.04)" }}>
              <div>
                <Link href={`/seasons/${s.seasonId}`} className="text-sm font-semibold hover:underline"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  {s.seasonName}
                </Link>
                {s.isChampion && <span className="ml-2 text-xs" style={{ color: "#ffd24a" }}>👑 Champion</span>}
              </div>
              <div className="text-center text-sm font-bold"
                style={{ fontFamily: "Oswald, sans-serif", color: s.position === 1 ? "#ffd24a" : s.position <= 3 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)" }}>
                #{s.position}
              </div>
              <div className="text-center text-sm font-mono">
                <span style={{ color: "#22c55e" }}>{s.wins}</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>-</span>
                <span style={{ color: "#ff005c" }}>{s.losses}</span>
              </div>
              <div className="text-right text-sm font-mono" style={{ color: "#0066ff" }}>{s.elo}</div>
              <div className="text-right font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>{s.points}pts</div>
            </div>
          ))}
        </div>
      )}

      {/* ══ ACHIEVEMENTS ══ */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>Achievements</h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              <span style={{ color: "#ffd24a" }}>{unlockedCount}</span> unlocked ·{" "}
              <span style={{ color: "#a855f7" }}>{closeCount}</span> within reach
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["all","unlocked","close","locked"] as const).map(f => (
              <button key={f} onClick={() => setAchFilter(f)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all"
                style={{
                  fontFamily: "Oswald, sans-serif", letterSpacing: "0.07em",
                  background: achFilter === f ? "rgba(255,0,92,0.18)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${achFilter === f ? "rgba(255,0,92,0.45)" : "rgba(255,255,255,0.07)"}`,
                  color: achFilter === f ? "#ff005c" : "rgba(255,255,255,0.3)",
                }}>
                {f === "all" ? "All" : f === "unlocked" ? "✓ Done" : f === "close" ? "⚡ Close" : "🔒 Locked"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {displayedAch.map((a: any) => <AchievementCard key={a.id} a={a} />)}
        </div>

        {filteredAch.length === 0 && (
          <div className="pdc-card px-6 py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
            No achievements in this category yet.
          </div>
        )}

        {filteredAch.length > 18 && (
          <button onClick={() => setShowAllAch(v => !v)}
            className="w-full mt-3 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold uppercase transition-all hover:bg-white/[0.04]"
            style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", color: "rgba(255,255,255,0.35)", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <ChevronDown className="w-4 h-4" style={{ transform: showAllAch ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
            {showAllAch ? "Show Less" : `Show ${filteredAch.length - 18} More`}
          </button>
        )}
      </div>
    </div>
  );
}
