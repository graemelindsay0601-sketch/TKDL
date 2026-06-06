import {
  useGetStatsSummary,
  useGetLeaderboard,
  useGetRecentActivity,
  useGetNarrativeCards,
} from "@workspace/api-client-react";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Trophy, Swords, Target, Flame, Skull, Zap } from "lucide-react";
import { format } from "date-fns";

function NarrativeIcon({ type }: { type: string }) {
  const map: Record<string, { icon: React.ReactNode; cls: string }> = {
    HOTTEST_PLAYER:    { icon: <Flame className="w-4 h-4 streak-fire" style={{ color: "#ff005c" }} />, cls: "narrative-hot" },
    TITLE_RACE:        { icon: <Trophy className="w-4 h-4" style={{ color: "#ffd24a" }} />,            cls: "narrative-gold" },
    ELIMINATION_WATCH: { icon: <Skull className="w-4 h-4" style={{ color: "#ff005c" }} />,            cls: "narrative-hot" },
    RIVALRY_SPOTLIGHT: { icon: <Swords className="w-4 h-4" style={{ color: "#0066ff" }} />,           cls: "narrative-blue" },
    STREAK_WATCH:      { icon: <Zap className="w-4 h-4" style={{ color: "#ffd24a" }} />,              cls: "narrative-gold" },
  };
  return <>{map[type]?.icon ?? <Target className="w-4 h-4" style={{ color: "#ff005c" }} />}</>;
}

function NarrativeCard({ card, idx }: { card: { type: string; headline: string; body: string; tag?: string }; idx: number }) {
  const clsMap: Record<string, string> = {
    HOTTEST_PLAYER: "narrative-hot",
    TITLE_RACE: "narrative-gold",
    ELIMINATION_WATCH: "narrative-hot",
    RIVALRY_SPOTLIGHT: "narrative-blue",
    STREAK_WATCH: "narrative-gold",
  };
  const cls = clsMap[card.type] ?? "narrative-hot";

  return (
    <div
      className={`pdc-card p-4 flex flex-col gap-2 fade-in-up ${cls}`}
      style={{ animationDelay: `${idx * 80}ms`, background: "rgba(255,255,255,0.025)" }}
    >
      <div className="flex items-center gap-2">
        <NarrativeIcon type={card.type} />
        {card.tag && (
          <span
            className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ fontFamily: "Oswald, sans-serif", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", fontSize: "0.58rem" }}
          >
            {card.tag}
          </span>
        )}
      </div>
      <p className="font-bold text-sm leading-snug" style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: "0.02em" }}>
        {card.headline}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
        {card.body}
      </p>
    </div>
  );
}

function StatBox({ label, value, sub, accent, topCls }: { label: string; value: string | number; sub?: string; accent?: string; topCls?: string }) {
  return (
    <div className={`pdc-card p-4 ${topCls ?? ""}`}>
      <div className="text-xs uppercase tracking-widest mb-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.14em" }}>
        {label}
      </div>
      <div className="text-3xl font-bold leading-none mb-1" style={{ fontFamily: "Oswald, sans-serif", color: accent ?? "#fff", textShadow: accent ? `0 0 20px ${accent}66` : undefined }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { data: summary }     = useGetStatsSummary();
  const { data: leaderboard } = useGetLeaderboard();
  const { data: recent }      = useGetRecentActivity();
  const { data: narrative }   = useGetNarrativeCards();

  const top5      = leaderboard?.filter(e => e.status !== "ELIMINATED").slice(0, 5) ?? [];
  const eliminated = (summary as any)?.eliminatedCount ?? 0;
  const posColors  = ["#ffd24a", "#c0c8d8", "#cd7f32"];

  return (
    <div className="space-y-8">
      <div className="pdc-divider" />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold uppercase tracking-wide" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>
            Dashboard
          </h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span className="live-dot" />
            {summary?.currentSeasonName ?? "Loading..."}
          </p>
        </div>
        {eliminated > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded" style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.3)" }}>
            <Skull className="w-4 h-4" style={{ color: "#ff005c" }} />
            <span className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>{eliminated} ELIMINATED</span>
          </div>
        )}
      </div>

      {/* Stat boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox label="Active Players"  value={summary?.activePlayers ?? summary?.totalPlayers ?? 0} topCls="stat-box-blue" accent="#0066ff" />
        <StatBox label="Eliminated"      value={eliminated} accent={eliminated > 0 ? "#ff005c" : undefined} topCls={eliminated > 0 ? "stat-box-red" : undefined} />
        <StatBox label="Season Matches"  value={summary?.currentSeasonMatches ?? 0} topCls="stat-box-gold" accent="#ffd24a" />
        <StatBox label="Top Elo"         value={summary?.topEloPlayer?.elo ?? 0} sub={summary?.topEloPlayer?.name} accent="#0066ff" topCls="stat-box-blue" />
      </div>

      {/* Narrative cards */}
      {narrative && narrative.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-widest mb-3 font-semibold flex items-center gap-2" style={{ color: "rgba(255,0,92,0.8)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.15em" }}>
            <span className="live-dot" />
            Live Storylines
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {narrative.map((card: any, i: number) => (
              <NarrativeCard key={i} card={card} idx={i} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 leaderboard */}
        <div className="pdc-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase tracking-wider text-sm flex items-center gap-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.8)" }}>
              <Trophy className="w-3.5 h-3.5" style={{ color: "#ffd24a" }} />
              Leaderboard
            </h2>
            <Link href="/leaderboard" className="text-xs font-bold hover:text-white transition-colors" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>View All →</Link>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {top5.map((entry, i) => {
              const posColor = posColors[i] ?? "rgba(255,255,255,0.4)";
              const isFirst  = i === 0;
              return (
                <div
                  key={entry.playerId}
                  className={`px-4 py-3 flex items-center gap-3 hover:bg-white/[0.025] transition-all ${isFirst ? "lb-row-first" : i === 1 ? "lb-row-second" : i === 2 ? "lb-row-third" : ""}`}
                >
                  <span className="font-bold w-6 text-center text-lg leading-none" style={{ fontFamily: "Oswald, sans-serif", color: posColor, textShadow: isFirst ? `0 0 12px ${posColor}` : undefined }}>
                    {entry.position}
                  </span>
                  <RankChange change={entry.positionChange} />
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/players/${entry.playerId}`}
                      className={`font-semibold text-sm hover:text-white transition-colors truncate block ${isFirst ? "shimmer-gold" : ""}`}
                      style={!isFirst ? { color: "rgba(255,255,255,0.85)", fontFamily: "Oswald, sans-serif" } : { fontFamily: "Oswald, sans-serif" }}
                    >
                      {entry.playerName}
                    </Link>
                    {(entry as any).title && <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.28)", fontStyle: "italic" }}>{(entry as any).title}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TierBadge tier={entry.tier} />
                    <span
                      className="font-bold text-sm tabular-nums"
                      style={{ fontFamily: "Oswald, sans-serif", color: isFirst ? "#ffd24a" : "#ff005c", minWidth: "3rem", textAlign: "right", textShadow: isFirst ? "0 0 10px rgba(255,210,74,0.5)" : undefined }}
                    >
                      {entry.points}
                      <span className="text-xs font-normal ml-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>pts</span>
                    </span>
                  </div>
                </div>
              );
            })}
            {top5.length === 0 && (
              <div className="px-5 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No data yet</div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="pdc-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <Swords className="w-3.5 h-3.5" style={{ color: "#ff005c" }} />
            <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.8)" }}>
              Recent Matches
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {recent?.slice(0, 6).map((activity: any, i: number) => (
              <div key={activity.matchId} className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    <Link href={`/players/${activity.winnerId}`} className="hover:underline" style={{ color: "#ff005c" }}>{activity.winnerName}</Link>
                    <span style={{ color: "rgba(255,255,255,0.25)", margin: "0 6px" }}>def.</span>
                    <span style={{ color: "rgba(255,255,255,0.45)" }}>{activity.loserName}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>
                    {format(new Date(activity.playedAt), "MMM d, h:mm a")}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  {activity.stake && (
                    <div className="text-xs font-bold" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif", textShadow: "0 0 8px rgba(255,210,74,0.4)" }}>
                      ±{activity.stake}pts
                    </div>
                  )}
                  <div className="text-xs font-mono" style={{ color: "rgba(0,102,255,0.6)" }}>+{activity.eloChange} Elo</div>
                </div>
              </div>
            ))}
            {(!recent || recent.length === 0) && (
              <div className="px-5 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No matches yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Eliminated section */}
      {leaderboard && leaderboard.some(e => e.status === "ELIMINATED") && (
        <div>
          <h2 className="text-xs uppercase tracking-widest mb-3 font-semibold flex items-center gap-2" style={{ color: "rgba(255,0,92,0.7)", fontFamily: "Oswald, sans-serif" }}>
            <Skull className="w-3 h-3" /> Eliminated
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {leaderboard.filter(e => e.status === "ELIMINATED").map(entry => (
              <Link key={entry.playerId} href={`/players/${entry.playerId}`}>
                <div className="pdc-card p-3 opacity-45 hover:opacity-65 transition-opacity cursor-pointer" style={{ borderColor: "rgba(255,0,92,0.2)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "#ff005c" }}>☠</span>
                    <span className="text-sm font-semibold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>{entry.playerName}</span>
                  </div>
                  <div className="text-xs mt-1 font-bold" style={{ color: "rgba(255,0,92,0.6)", fontFamily: "Oswald, sans-serif" }}>0 pts · Eliminated</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
