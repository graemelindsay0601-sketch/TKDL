import {
  useGetStatsSummary,
  useGetLeaderboard,
  useGetRecentActivity,
  useGetNarrativeCards,
} from "@workspace/api-client-react";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Trophy, Swords, Flame, Skull, Zap, Target } from "lucide-react";
import { format } from "date-fns";

function NarrativeCard({ card, idx }: { card: { type: string; headline: string; body: string; tag?: string }; idx: number }) {
  const clsMap: Record<string, string> = {
    HOTTEST_PLAYER:    "narrative-hot",
    TITLE_RACE:        "narrative-gold",
    ELIMINATION_WATCH: "narrative-hot",
    RIVALRY_SPOTLIGHT: "narrative-blue",
    STREAK_WATCH:      "narrative-gold",
  };
  const iconMap: Record<string, React.ReactNode> = {
    HOTTEST_PLAYER:    <Flame className="w-4 h-4 streak-fire" style={{ color: "#ff005c" }} />,
    TITLE_RACE:        <Trophy className="w-4 h-4" style={{ color: "#ffd24a" }} />,
    ELIMINATION_WATCH: <Skull className="w-4 h-4" style={{ color: "#ff005c" }} />,
    RIVALRY_SPOTLIGHT: <Swords className="w-4 h-4" style={{ color: "#0066ff" }} />,
    STREAK_WATCH:      <Zap className="w-4 h-4" style={{ color: "#ffd24a" }} />,
  };

  return (
    <div className={`pdc-card p-5 fade-in-up ${clsMap[card.type] ?? "narrative-hot"}`}
      style={{ animationDelay: `${idx * 80}ms` }}>
      <div className="flex items-center gap-2 mb-2">
        {iconMap[card.type] ?? <Target className="w-4 h-4" style={{ color: "#ff005c" }} />}
        {card.tag && (
          <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ fontFamily: "Oswald, sans-serif", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.45)", fontSize: "0.58rem" }}>
            {card.tag}
          </span>
        )}
      </div>
      <p className="font-black text-sm leading-snug mb-1.5" style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: "0.03em" }}>
        {card.headline}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
        {card.body}
      </p>
    </div>
  );
}

function StatPill({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col items-center px-5 py-3 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="font-black text-2xl leading-none tabular-nums"
        style={{ fontFamily: "Oswald, sans-serif", color: accent ?? "#fff", textShadow: accent ? `0 0 20px ${accent}55` : undefined }}>
        {value}
      </div>
      <div className="text-xs mt-1 uppercase tracking-widest"
        style={{ color: "rgba(255,255,255,0.28)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.14em" }}>
        {label}
      </div>
    </div>
  );
}

function StatBox({ label, value, sub, accent, topCls }: { label: string; value: string | number; sub?: string; accent?: string; topCls?: string }) {
  return (
    <div className={`pdc-card p-5 ${topCls ?? ""}`}>
      <div className="text-xs uppercase tracking-widest mb-2 font-semibold"
        style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.16em" }}>
        {label}
      </div>
      <div className="font-black leading-none mb-1"
        style={{ fontFamily: "Oswald, sans-serif", fontSize: "2.6rem", color: accent ?? "#fff", textShadow: accent ? `0 0 24px ${accent}66` : undefined }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { data: summary }     = useGetStatsSummary();
  const { data: leaderboard } = useGetLeaderboard();
  const { data: recent }      = useGetRecentActivity();
  const { data: narrative }   = useGetNarrativeCards();

  const active    = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const top5      = active.slice(0, 5);
  const leader    = active[0] ?? null;
  const eliminated = (summary as any)?.eliminatedCount ?? 0;
  const posColors  = ["#ffd24a", "#c0c8d8", "#cd7f32"];

  const leaderWr = leader && (leader as any).careerGamesPlayed > 0
    ? Math.round(((leader as any).careerWins / (leader as any).careerGamesPlayed) * 100)
    : null;

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />

      {/* ── ARENA HERO — Featured #1 player ── */}
      {leader && (
        <div className="arena-hero fade-in-up">
          {/* Rotating conic spotlight */}
          <div className="arena-hero-spinner" />
          {/* Pulsing radial core */}
          <div className="arena-hero-core" />

          {/* Giant watermark name */}
          <div className="absolute inset-0 flex items-center justify-start overflow-hidden pointer-events-none select-none" style={{ paddingLeft: "2%" }}>
            <span style={{
              fontFamily: "Oswald, sans-serif",
              fontSize: "clamp(5rem, 14vw, 11rem)",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: "rgba(255,255,255,0.025)",
              textTransform: "uppercase",
            }}>
              {leader.playerName}
            </span>
          </div>

          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* Left: identity */}
            <div className="flex items-center gap-5">
              {/* Avatar orb */}
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-full flex items-center justify-center font-black text-3xl uppercase"
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    background: "radial-gradient(circle at 35% 35%, rgba(255,60,60,0.3), rgba(255,0,92,0.15))",
                    border: "2px solid rgba(255,0,92,0.5)",
                    color: "#ff005c",
                    boxShadow: "0 0 40px rgba(255,0,92,0.3), inset 0 0 20px rgba(255,0,92,0.1)",
                  }}>
                  {leader.playerName.substring(0, 2)}
                </div>
                {/* Streak fire indicator */}
                {(leader as any).currentStreak >= 3 && (
                  <div className="absolute -top-2 -right-1 text-xl streak-fire">🔥</div>
                )}
                {/* Rotating ring */}
                <div className="absolute inset-[-6px] rounded-full border border-dashed pointer-events-none"
                  style={{ borderColor: "rgba(255,0,92,0.25)", animation: "spin-slow 20s linear infinite" }} />
              </div>

              {/* Name + badges */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded"
                    style={{ background: "rgba(255,0,92,0.2)", border: "1px solid rgba(255,0,92,0.4)", color: "#ff005c", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>
                    <span className="live-dot inline-block mr-1.5" style={{ width: 5, height: 5 }} />
                    Season Leader
                  </span>
                  <TierBadge tier={leader.tier} />
                </div>

                <h2 className="font-black uppercase leading-none mb-2"
                  style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(1.8rem, 4vw, 3rem)", color: "#fff", textShadow: "0 0 30px rgba(255,0,92,0.25)" }}>
                  {leader.playerName}
                </h2>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(leader as any).title && (
                    <span className="text-sm italic" style={{ color: "rgba(255,210,74,0.8)" }}>
                      "{(leader as any).title}"
                    </span>
                  )}
                  {(leader as any).archetype && (
                    <span className="aura-badge" style={{ color: "rgba(255,255,255,0.45)", borderColor: "rgba(255,255,255,0.1)", fontSize: "0.62rem" }}>
                      {(leader as any).archetype}
                    </span>
                  )}
                  {(leader as any).aura && (
                    <span className="aura-badge" style={{ color: (leader as any).auraColor ?? "#0066ff", borderColor: `${(leader as any).auraColor ?? "#0066ff"}44`, background: `${(leader as any).auraColor ?? "#0066ff"}12`, fontSize: "0.62rem" }}>
                      {(leader as any).aura}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: live stats */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:justify-end">
              <div className="flex flex-col items-end mr-3 sm:mr-5">
                <div className="font-black leading-none tabular-nums"
                  style={{ fontFamily: "Oswald, sans-serif", fontSize: "clamp(2.5rem, 5vw, 4rem)", color: "#ff005c", textShadow: "0 0 40px rgba(255,0,92,0.45)" }}>
                  {leader.points}
                </div>
                <div className="text-xs mt-0.5 uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>
                  Points
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <StatPill label="ELO" value={leader.elo ?? 0} accent="#0066ff" />
                {(leader as any).currentStreak > 0 && (
                  <StatPill label="Win Streak" value={`${(leader as any).currentStreak}W`} accent={(leader as any).currentStreak >= 3 ? "#ff005c" : undefined} />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <StatPill label="Season" value={`${leader.wins}W-${leader.losses}L`} />
                {leaderWr !== null && <StatPill label="Win Rate" value={`${leaderWr}%`} accent={leaderWr >= 65 ? "#22c55e" : undefined} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Season header strip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="live-dot" />
          <span className="font-black uppercase tracking-wider text-sm"
            style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.5)", letterSpacing: "0.12em" }}>
            {summary?.currentSeasonName ?? "Loading..."}
          </span>
        </div>
        {eliminated > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(255,0,92,0.12)", border: "1px solid rgba(255,0,92,0.3)" }}>
            <Skull className="w-3.5 h-3.5" style={{ color: "#ff005c" }} />
            <span className="font-black text-xs" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>{eliminated} ELIMINATED</span>
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

      {/* Live storylines */}
      {narrative && narrative.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-widest mb-3 font-black flex items-center gap-2"
            style={{ color: "rgba(255,0,92,0.85)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.18em" }}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top 5 leaderboard */}
        <div className="section-card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-black uppercase flex items-center gap-2 text-base"
              style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
              <Trophy className="w-4 h-4" style={{ color: "#ffd24a", filter: "drop-shadow(0 0 5px rgba(255,210,74,0.7))" }} />
              Leaderboard
            </h2>
            <Link href="/leaderboard" className="text-xs font-bold hover:text-white transition-colors uppercase tracking-widest"
              style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
              View All →
            </Link>
          </div>
          <div className="space-y-2">
            {top5.map((entry, i) => {
              const pColor  = posColors[i] ?? "rgba(255,255,255,0.4)";
              const isFirst = i === 0;
              return (
                <Link key={entry.playerId} href={`/players/${entry.playerId}`}>
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all hover:-translate-y-0.5 ${isFirst ? "lb-rank-1" : i === 1 ? "lb-rank-2" : i === 2 ? "lb-rank-3" : "lb-card-row"}`}
                    style={{ cursor: "pointer" }}>
                    <span className="font-black w-7 text-center leading-none"
                      style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.5rem", color: pColor, textShadow: isFirst ? `0 0 16px ${pColor}` : undefined }}>
                      {entry.position}
                    </span>
                    <RankChange change={entry.positionChange} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-black text-sm uppercase truncate block ${isFirst ? "shimmer-gold" : ""}`}
                        style={!isFirst ? { color: "rgba(255,255,255,0.9)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" } : { fontFamily: "Oswald, sans-serif" }}>
                        {entry.playerName}
                      </div>
                      {(entry as any).title && (
                        <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>{(entry as any).title}</div>
                      )}
                    </div>
                    <TierBadge tier={entry.tier} />
                    <span className="font-black tabular-nums"
                      style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.3rem", color: isFirst ? "#ffd24a" : "#ff005c", minWidth: "3rem", textAlign: "right", textShadow: isFirst ? "0 0 12px rgba(255,210,74,0.5)" : undefined }}>
                      {entry.points}
                      <span className="text-xs font-normal ml-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>pts</span>
                    </span>
                  </div>
                </Link>
              );
            })}
            {top5.length === 0 && (
              <div className="px-5 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No data yet</div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="section-card">
          <h2 className="font-black uppercase flex items-center gap-2 text-base mb-5"
            style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
            <Swords className="w-4 h-4" style={{ color: "#ff005c" }} />
            Recent Matches
          </h2>
          <div className="space-y-2">
            {recent?.slice(0, 6).map((activity: any, i: number) => (
              <div key={activity.matchId}
                className="flex items-center justify-between px-4 py-3 rounded-2xl fade-in-up"
                style={{ animationDelay: `${i * 50}ms`, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="min-w-0">
                  <div className="text-sm font-bold">
                    <Link href={`/players/${activity.winnerId}`} className="hover:underline font-black uppercase"
                      style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>{activity.winnerName}</Link>
                    <span style={{ color: "rgba(255,255,255,0.25)", margin: "0 6px", fontSize: "0.75rem" }}>def.</span>
                    <span className="font-bold" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem" }}>{activity.loserName}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {format(new Date(activity.playedAt), "MMM d, h:mm a")}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  {activity.stake > 0 && (
                    <div className="font-black text-sm" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif", textShadow: "0 0 10px rgba(255,210,74,0.5)" }}>
                      ±{activity.stake}pts
                    </div>
                  )}
                  <div className="text-xs font-mono" style={{ color: "rgba(0,102,255,0.7)" }}>+{activity.eloChange} Elo</div>
                </div>
              </div>
            ))}
            {(!recent || recent.length === 0) && (
              <div className="px-5 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No matches yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Eliminated players */}
      {leaderboard && leaderboard.some(e => e.status === "ELIMINATED") && (
        <div>
          <h2 className="text-xs uppercase tracking-widest mb-4 font-black flex items-center gap-2"
            style={{ color: "rgba(255,0,92,0.75)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.18em" }}>
            <Skull className="w-3.5 h-3.5" /> Eliminated
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {leaderboard.filter(e => e.status === "ELIMINATED").map(entry => (
              <Link key={entry.playerId} href={`/players/${entry.playerId}`}>
                <div className="pdc-card p-4 opacity-40 hover:opacity-65 transition-opacity cursor-pointer"
                  style={{ borderColor: "rgba(255,0,92,0.22)", borderRadius: "20px" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm" style={{ color: "#ff005c" }}>☠</span>
                    <span className="text-sm font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>{entry.playerName}</span>
                  </div>
                  <div className="text-xs font-bold" style={{ color: "rgba(255,0,92,0.65)", fontFamily: "Oswald, sans-serif" }}>0 pts · Eliminated</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
