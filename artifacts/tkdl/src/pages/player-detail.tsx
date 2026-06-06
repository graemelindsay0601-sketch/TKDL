import { useGetPlayerStats, getGetPlayerStatsQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { TierBadge } from "@/components/tier-badge";
import { format } from "date-fns";
import { useState, useEffect, useRef } from "react";
import { Trophy, Target, Skull, Flame, ArrowLeft, Lock, CheckCircle, ChevronDown, ChevronUp, Star } from "lucide-react";

// Animated counter hook
function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const pct = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - pct, 3);
      setValue(Math.round(eased * target));
      if (pct < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return value;
}

function AnimatedStat({ value, label, accent, suffix = "" }: { value: number; label: string; accent?: string; suffix?: string }) {
  const animated = useCountUp(value);
  return (
    <div className="pdc-card p-4 text-center group hover:scale-105 transition-transform cursor-default"
      style={{ borderColor: accent ? `${accent}33` : undefined }}>
      <div className="text-xs uppercase tracking-widest mb-2 font-bold"
        style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", letterSpacing: "0.15em" }}>
        {label}
      </div>
      <div className="text-2xl font-bold leading-none" style={{ fontFamily: "Oswald, sans-serif", color: accent ?? "rgba(255,255,255,0.85)" }}>
        {animated}{suffix}
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

function AchievementCard({ a, small = false }: { a: any; small?: boolean }) {
  const [hovered, setHovered] = useState(false);
  const rc = RARITY_COLORS[a.rarity] ?? RARITY_COLORS.Common;
  const isHidden = a.hidden && !a.isUnlocked;
  const pct = Math.min(100, a.progressPct ?? 0);
  const isClose = pct >= 60 && !a.isUnlocked;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded overflow-hidden transition-all duration-200 cursor-default"
      style={{
        background: a.isUnlocked ? rc.bg : isHidden ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${a.isUnlocked ? rc.color + "55" : isClose ? rc.color + "33" : "rgba(255,255,255,0.07)"}`,
        boxShadow: hovered && a.isUnlocked ? `0 0 16px ${rc.glow}` : undefined,
        transform: hovered ? "translateY(-2px)" : undefined,
        padding: small ? "0.5rem" : "0.75rem",
      }}
    >
      {/* Rarity top bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: a.isUnlocked ? rc.color : "transparent" }} />

      {/* Content */}
      <div className={`flex ${small ? "flex-col items-center text-center gap-1" : "items-start gap-3"}`}>
        <div className={`${small ? "text-2xl" : "text-3xl"} leading-none shrink-0 ${isHidden ? "grayscale opacity-30" : ""}`}>
          {isHidden ? "🔒" : a.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1 mb-0.5">
            <div className={`font-bold leading-tight truncate ${small ? "text-xs" : "text-xs"}`}
              style={{ fontFamily: "Oswald, sans-serif", color: a.isUnlocked ? rc.color : isHidden ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.55)", fontSize: small ? "0.6rem" : "0.75rem" }}>
              {isHidden ? "???" : a.name.replace(/^[^\s]+\s/, "")}
            </div>
            {a.isUnlocked && !small && <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: rc.color }} />}
          </div>
          {!small && !isHidden && (
            <div className="text-xs leading-tight mb-1.5" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem" }}>
              {a.description}
            </div>
          )}
          {/* Progress bar */}
          {!a.isUnlocked && !isHidden && !small && (
            <div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: isClose ? rc.color : "rgba(255,255,255,0.25)" }} />
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.6rem" }}>
                {a.currentProgress ?? 0} / {a.criteriaValue}
              </div>
            </div>
          )}
          {!a.isUnlocked && !isHidden && small && pct > 0 && (
            <div className="h-0.5 rounded-full overflow-hidden mt-1" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isClose ? rc.color : "rgba(255,255,255,0.2)" }} />
            </div>
          )}
          {a.isUnlocked && a.unlockedAt && !small && (
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.6rem" }}>
              Unlocked {format(new Date(a.unlockedAt), "MMM d, yyyy")}
            </div>
          )}
        </div>
      </div>

      {/* Rarity badge (small mode) */}
      {small && (
        <div className="text-center mt-1">
          <span style={{ fontSize: "0.5rem", color: rc.color, fontFamily: "Oswald, sans-serif", letterSpacing: "0.05em" }}>{a.rarity.toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}

export default function PlayerDetail() {
  const params = useParams();
  const playerId = parseInt(params.id || "0", 10);
  const [achFilter, setAchFilter] = useState<"all" | "unlocked" | "locked" | "close">("all");
  const [achRarity, setAchRarity] = useState<string>("all");
  const [showAllAch, setShowAllAch] = useState(false);

  const { data: stats, isLoading } = useGetPlayerStats(playerId, {
    query: { enabled: !!playerId, queryKey: getGetPlayerStatsQueryKey(playerId) },
  });

  // Fetch achievement progress separately
  const [achProgress, setAchProgress] = useState<any[]>([]);
  const [achLoading, setAchLoading] = useState(true);
  useEffect(() => {
    if (!playerId) return;
    setAchLoading(true);
    fetch(`/api/players/${playerId}/achievement-progress`)
      .then(r => r.json())
      .then(d => { setAchProgress(Array.isArray(d) ? d : []); setAchLoading(false); })
      .catch(() => setAchLoading(false));
  }, [playerId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
      </div>
    );
  }
  if (!stats) {
    return <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.3)" }}>Player not found.</div>;
  }

  const { player, seasonHistory, recentMatches } = stats;
  const identity = (stats as any).identity ?? {};
  const isEliminated = player.status === "ELIMINATED";
  const derivedTier = player.elo >= 1100 ? "Gold" : player.elo >= 980 ? "Silver" : "Bronze";
  const tier = (player as any).tier || derivedTier;

  const totalGames = player.careerGamesPlayed ?? 0;
  const winRate = totalGames > 0 ? Math.round(((player.careerWins ?? 0) / totalGames) * 100) : 0;

  // Filter achievements
  const filteredAch = achProgress.filter(a => {
    if (achRarity !== "all" && a.rarity !== achRarity) return false;
    if (achFilter === "unlocked") return a.isUnlocked;
    if (achFilter === "locked") return !a.isUnlocked && !a.hidden;
    if (achFilter === "close") return !a.isUnlocked && (a.progressPct ?? 0) >= 50;
    return true;
  });
  const displayedAch = showAllAch ? filteredAch : filteredAch.slice(0, 24);
  const unlockedCount = achProgress.filter(a => a.isUnlocked).length;
  const closeCount = achProgress.filter(a => !a.isUnlocked && (a.progressPct ?? 0) >= 50).length;

  const headToHead = (stats as any).headToHead ?? [];

  return (
    <div className="space-y-6 pb-8">
      <div className="pdc-divider" />

      <Link href="/players" className="flex items-center gap-1.5 text-xs hover:underline group"
        style={{ color: "rgba(255,255,255,0.3)" }}>
        <ArrowLeft className="w-3 h-3 group-hover:text-white transition-colors" /> All Players
      </Link>

      {/* ── HERO ── */}
      <div className="pdc-card p-6 relative overflow-hidden"
        style={{
          borderColor: isEliminated ? "rgba(255,0,92,0.3)" : "rgba(255,255,255,0.1)",
          background: isEliminated
            ? "linear-gradient(135deg, rgba(255,0,92,0.06) 0%, rgba(255,255,255,0.01) 100%)"
            : "linear-gradient(135deg, rgba(255,0,92,0.03) 0%, rgba(0,102,255,0.03) 100%)",
        }}
      >
        {/* Watermark */}
        <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none select-none"
          style={{ fontSize: "12rem", fontFamily: "Oswald, sans-serif", lineHeight: 1, color: "#ff005c" }}>
          {player.name.substring(0, 2).toUpperCase()}
        </div>

        <div className="relative flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="w-24 h-24 rounded flex items-center justify-center text-4xl font-black uppercase shrink-0 relative"
            style={{
              background: isEliminated ? "rgba(255,0,92,0.08)" : "rgba(255,0,92,0.06)",
              border: isEliminated ? "2px solid rgba(255,0,92,0.4)" : "2px solid rgba(255,0,92,0.2)",
              fontFamily: "Oswald, sans-serif",
              color: "#ff005c",
              boxShadow: isEliminated ? "0 0 30px rgba(255,0,92,0.2)" : "0 0 20px rgba(255,0,92,0.1)",
            }}>
            {isEliminated ? "☠" : player.name.substring(0, 2)}
            {(player.currentWinStreak ?? 0) >= 3 && (
              <div className="absolute -top-2 -right-2 text-lg animate-bounce">🔥</div>
            )}
          </div>

          {/* Name block */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-5xl font-black uppercase leading-none"
                style={{ fontFamily: "Oswald, sans-serif", color: isEliminated ? "#ff005c" : "#fff", textShadow: isEliminated ? "0 0 30px rgba(255,0,92,0.5)" : undefined }}>
                {player.name}
              </h1>
              <TierBadge tier={tier} />
              {isEliminated && (
                <span className="aura-badge animate-pulse" style={{ color: "#ff005c", borderColor: "rgba(255,0,92,0.4)", background: "rgba(255,0,92,0.1)" }}>
                  <Skull className="w-3 h-3 inline mr-1" />ELIMINATED
                </span>
              )}
            </div>

            {identity.title && (
              <div className="text-base mb-2" style={{ color: "rgba(255,210,74,0.8)", fontStyle: "italic" }}>
                "{identity.title}"
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 mb-4">
              {identity.archetype && (
                <span className="aura-badge" style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)" }}>
                  {identity.archetype}
                </span>
              )}
              {identity.aura && (
                <span className="aura-badge" style={{ color: "#0066ff", borderColor: "rgba(0,102,255,0.3)", background: "rgba(0,102,255,0.06)" }}>
                  {identity.aura}
                </span>
              )}
              {identity.prestige && (
                <span className="aura-badge" style={{ color: "#ffd24a", borderColor: "rgba(255,210,74,0.3)", background: "rgba(255,210,74,0.06)" }}>
                  ★ {identity.prestige}
                </span>
              )}
              {unlockedCount > 0 && (
                <span className="aura-badge" style={{ color: "#a855f7", borderColor: "rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.06)" }}>
                  🏆 {unlockedCount} achievements
                </span>
              )}
            </div>
          </div>

          {/* Points balance */}
          <div className="text-right shrink-0">
            <div className="text-xs uppercase font-bold mb-1"
              style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", fontSize: "0.6rem", letterSpacing: "0.15em" }}>
              Balance
            </div>
            <div className="text-6xl font-black leading-none"
              style={{ fontFamily: "Oswald, sans-serif", color: isEliminated ? "#ff005c" : "#ff005c", textShadow: "0 0 40px rgba(255,0,92,0.4)" }}>
              {player.points}
            </div>
            <div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>pts</div>
            <div className="mt-2 text-sm font-mono" style={{ color: "#0066ff" }}>{player.elo} Elo</div>
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
              Peak: {player.peakPoints ?? player.points}pts
            </div>
          </div>
        </div>
      </div>

      {/* ── STAT GRID ── */}
      <div>
        <div className="text-xs uppercase font-bold mb-3"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em" }}>
          Current Season
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <AnimatedStat label="Wins"     value={player.seasonWins ?? 0}         accent="#22c55e" />
          <AnimatedStat label="Losses"   value={player.seasonLosses ?? 0}       accent="#ff005c" />
          <AnimatedStat label="Played"   value={player.seasonGamesPlayed ?? 0} />
          <AnimatedStat label="Win %"    value={(player.seasonGamesPlayed ?? 0) > 0 ? Math.round(((player.seasonWins ?? 0) / (player.seasonGamesPlayed ?? 1)) * 100) : 0} suffix="%" />
          <AnimatedStat label="W-Streak" value={player.currentWinStreak ?? 0}  accent={(player.currentWinStreak ?? 0) >= 3 ? "#ff005c" : undefined} />
          <AnimatedStat label="L-Streak" value={player.currentLossStreak ?? 0} accent={(player.currentLossStreak ?? 0) >= 3 ? "#ff005c" : undefined} />
        </div>
      </div>

      <div>
        <div className="text-xs uppercase font-bold mb-3"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em" }}>
          Career
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <AnimatedStat label="Wins"      value={player.careerWins ?? 0}         accent="#22c55e" />
          <AnimatedStat label="Losses"    value={player.careerLosses ?? 0}       accent="#ff005c" />
          <AnimatedStat label="Played"    value={player.careerGamesPlayed ?? 0} />
          <AnimatedStat label="Win %"     value={winRate}                         suffix="%" accent={winRate >= 60 ? "#ffd24a" : undefined} />
          <AnimatedStat label="Peak Elo"  value={player.careerPeakElo ?? player.elo} accent="#0066ff" />
          <AnimatedStat label="Best Pts"  value={player.peakPoints ?? player.points}  accent="#ffd24a" />
        </div>
      </div>

      {/* ── MATCHES + H2H ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent matches */}
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Recent Matches
            </h2>
          </div>
          <div>
            {recentMatches?.slice(0, 8).map((m: any) => {
              const isWin = m.winnerId === player.id;
              return (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between border-b hover:bg-white/[0.025] transition-colors group"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider mb-0.5"
                      style={{ fontFamily: "Oswald, sans-serif", color: isWin ? "#22c55e" : "#ff005c" }}>
                      {isWin ? "✓ WIN" : "✗ LOSS"}
                    </div>
                    <div className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                      vs {isWin ? m.loserName : m.winnerName}
                    </div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                      {format(new Date(m.playedAt), "MMM d, yyyy")}
                      {m.gameType && <span className="ml-2 opacity-60">· {m.gameType}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {m.stake > 0 && (
                      <div className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: isWin ? "#22c55e" : "#ff005c" }}>
                        {isWin ? "+" : "-"}{m.stake}pts
                      </div>
                    )}
                    <div className="text-xs font-mono" style={{ color: "rgba(0,102,255,0.6)" }}>
                      {isWin ? "+" : "-"}{m.eloChange} Elo
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
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Head-to-Head
            </h2>
          </div>
          <div>
            {headToHead.slice(0, 8).map((h: any) => {
              const total = h.wins + h.losses;
              const winPct = total > 0 ? Math.round((h.wins / total) * 100) : 0;
              const dominant = winPct >= 70;
              const struggling = winPct <= 30;
              return (
                <div key={h.opponentId}
                  className="px-4 py-3 flex items-center gap-3 border-b hover:bg-white/[0.025] transition-colors"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <Link href={`/players/${h.opponentId}`} className="text-sm font-bold hover:underline w-24 shrink-0"
                    style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                    {h.opponentName}
                  </Link>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono" style={{ color: "#22c55e", minWidth: "1.5rem", textAlign: "right" }}>{h.wins}W</span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${winPct}%`, background: dominant ? "#22c55e" : struggling ? "#ff005c" : "#0066ff" }} />
                      </div>
                      <span className="text-xs font-mono" style={{ color: "#ff005c", minWidth: "1.5rem" }}>{h.losses}L</span>
                    </div>
                  </div>
                  <div className="text-xs font-bold w-10 text-right shrink-0"
                    style={{ fontFamily: "Oswald, sans-serif", color: dominant ? "#22c55e" : struggling ? "#ff005c" : "rgba(255,255,255,0.4)" }}>
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

      {/* ── SEASON HISTORY ── */}
      {seasonHistory && seasonHistory.length > 0 && (
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Season History
            </h2>
          </div>
          <div className="grid text-xs uppercase font-bold px-4 py-2 border-b"
            style={{ gridTemplateColumns: "1fr 4rem 5rem 4rem 5rem", borderColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
            <div>Season</div>
            <div className="text-center">Pos</div>
            <div className="text-center">W-L</div>
            <div className="text-right">Elo</div>
            <div className="text-right">Pts</div>
          </div>
          {seasonHistory.map((s: any) => (
            <div key={s.seasonId}
              className="grid px-4 py-3 border-b items-center hover:bg-white/[0.025] transition-colors"
              style={{ gridTemplateColumns: "1fr 4rem 5rem 4rem 5rem", borderColor: "rgba(255,255,255,0.04)" }}>
              <div>
                <Link href={`/seasons/${s.seasonId}`} className="text-sm font-semibold hover:underline"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  {s.seasonName}
                </Link>
                {s.isChampion && <span className="ml-2 text-xs" style={{ color: "#ffd24a" }}>👑 Champion</span>}
              </div>
              <div className="text-center text-sm font-bold"
                style={{ fontFamily: "Oswald, sans-serif", color: s.position === 1 ? "#ffd24a" : s.position <= 3 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.35)" }}>
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

      {/* ── ACHIEVEMENT CATALOGUE ── */}
      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
              Achievements
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              <span style={{ color: "#ffd24a" }}>{unlockedCount}</span> unlocked ·{" "}
              <span style={{ color: "#a855f7" }}>{closeCount}</span> within reach · 91 total
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status filter */}
            <div className="flex rounded overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              {(["all", "unlocked", "close", "locked"] as const).map(f => (
                <button key={f} onClick={() => setAchFilter(f)}
                  className="px-2.5 py-1.5 text-xs font-bold uppercase transition-all"
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    letterSpacing: "0.05em",
                    background: achFilter === f ? "#ff005c" : "transparent",
                    color: achFilter === f ? "#fff" : "rgba(255,255,255,0.35)",
                  }}>
                  {f === "close" ? "≥50%" : f}
                </button>
              ))}
            </div>
            {/* Rarity filter */}
            <div className="flex rounded overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
              {["all", "Common", "Rare", "Epic", "Legendary", "Mythic"].map(r => {
                const rc = RARITY_COLORS[r];
                return (
                  <button key={r} onClick={() => setAchRarity(r)}
                    className="px-2.5 py-1.5 text-xs font-bold uppercase transition-all"
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      letterSpacing: "0.05em",
                      background: achRarity === r ? (rc?.color ?? "#ff005c") : "transparent",
                      color: achRarity === r ? "#fff" : (rc?.color ?? "rgba(255,255,255,0.35)"),
                    }}>
                    {r === "all" ? "All" : r.substring(0, 3)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {achLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
          </div>
        ) : filteredAch.length === 0 ? (
          <div className="text-center py-12" style={{ color: "rgba(255,255,255,0.2)" }}>No achievements match this filter</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayedAch.map((a: any) => (
                <AchievementCard key={a.id} a={a} />
              ))}
            </div>
            {filteredAch.length > 24 && (
              <button
                onClick={() => setShowAllAch(s => !s)}
                className="w-full mt-4 py-3 text-xs font-bold uppercase tracking-wider transition-all hover:bg-white/5 rounded flex items-center justify-center gap-2"
                style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                {showAllAch ? <><ChevronUp className="w-4 h-4" /> Show Less</> : <><ChevronDown className="w-4 h-4" /> Show All {filteredAch.length} Achievements</>}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
