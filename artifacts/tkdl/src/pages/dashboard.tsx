import {
  useGetStatsSummary,
  useGetLeaderboard,
  useGetRecentActivity,
  useGetNarrativeCards,
} from "@workspace/api-client-react";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Trophy, Swords, Target, Flame, Skull, TrendingUp, Zap } from "lucide-react";
import { format } from "date-fns";

function NarrativeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    HOTTEST_PLAYER:    <Flame className="w-4 h-4" style={{ color: "#ff005c" }} />,
    TITLE_RACE:        <Trophy className="w-4 h-4" style={{ color: "#ffd24a" }} />,
    ELIMINATION_WATCH: <Skull className="w-4 h-4" style={{ color: "#ff005c" }} />,
    RIVALRY_SPOTLIGHT: <Swords className="w-4 h-4" style={{ color: "#0066ff" }} />,
    STREAK_WATCH:      <Zap className="w-4 h-4" style={{ color: "#ffd24a" }} />,
  };
  return <>{icons[type] ?? <Target className="w-4 h-4" style={{ color: "#ff005c" }} />}</>;
}

function NarrativeCard({ card }: { card: { type: string; headline: string; body: string; tag?: string } }) {
  const borderColors: Record<string, string> = {
    HOTTEST_PLAYER:    "rgba(255,0,92,0.4)",
    TITLE_RACE:        "rgba(255,210,74,0.4)",
    ELIMINATION_WATCH: "rgba(255,0,92,0.5)",
    RIVALRY_SPOTLIGHT: "rgba(0,102,255,0.4)",
    STREAK_WATCH:      "rgba(255,210,74,0.4)",
  };
  const borderColor = borderColors[card.type] ?? "rgba(255,255,255,0.12)";

  return (
    <div
      className="pdc-card p-4 flex flex-col gap-2"
      style={{ borderLeft: `3px solid ${borderColor}`, background: "rgba(255,255,255,0.025)" }}
    >
      <div className="flex items-center gap-2">
        <NarrativeIcon type={card.type} />
        {card.tag && (
          <span
            className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ fontFamily: "Oswald, sans-serif", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", fontSize: "0.6rem" }}
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

function StatBox({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="pdc-card p-4">
      <div className="text-xs uppercase tracking-widest mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
        {label}
      </div>
      <div className="text-3xl font-bold leading-none mb-1" style={{ fontFamily: "Oswald, sans-serif", color: accent ?? "#fff" }}>
        {value}
      </div>
      {sub && <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { data: summary }     = useGetStatsSummary();
  const { data: leaderboard } = useGetLeaderboard();
  const { data: recent }      = useGetRecentActivity();
  const { data: narrative }   = useGetNarrativeCards();

  const top5 = leaderboard?.filter(e => e.status !== "ELIMINATED").slice(0, 5) ?? [];
  const eliminated = (summary as any)?.eliminatedCount ?? 0;

  return (
    <div className="space-y-8">
      {/* Page title */}
      <div className="pdc-divider" />
      <div>
        <h1 className="text-4xl font-bold uppercase tracking-wide" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          {summary?.currentSeasonName ?? "Loading..."}
        </p>
      </div>

      {/* Stat boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatBox label="Active Players" value={summary?.activePlayers ?? summary?.totalPlayers ?? 0} />
        <StatBox label="Eliminated" value={eliminated} accent={eliminated > 0 ? "#ff005c" : undefined} />
        <StatBox label="Season Matches" value={summary?.currentSeasonMatches ?? 0} />
        <StatBox
          label="Top Elo"
          value={summary?.topEloPlayer?.elo ?? 0}
          sub={summary?.topEloPlayer?.name}
          accent="#0066ff"
        />
      </div>

      {/* Narrative cards */}
      {narrative && narrative.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: "rgba(255,0,92,0.7)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.15em" }}>
            ⚡ Live Storylines
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {narrative.map((card: any, i: number) => (
              <NarrativeCard key={i} card={card} />
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 leaderboard */}
        <div className="pdc-card overflow-hidden">
          <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.8)" }}>
              Leaderboard
            </h2>
            <Link href="/leaderboard" className="text-xs hover:underline" style={{ color: "#ff005c" }}>View All →</Link>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {top5.map((entry, i) => {
              const posColors = ["#ffd24a", "#c0c8d8", "#cd7f32"];
              const posColor = posColors[i] ?? "rgba(255,255,255,0.4)";
              return (
                <div key={entry.playerId} className="px-5 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                  <span className="font-bold w-6 text-center text-sm" style={{ fontFamily: "Oswald, sans-serif", color: posColor }}>
                    {entry.position}
                  </span>
                  <RankChange change={entry.positionChange} />
                  <div className="flex-1 min-w-0">
                    <Link href={`/players/${entry.playerId}`} className="font-semibold text-sm hover:text-white transition-colors truncate block" style={{ color: "rgba(255,255,255,0.9)", fontFamily: "Oswald, sans-serif" }}>
                      {entry.playerName}
                    </Link>
                    {(entry as any).title && <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{(entry as any).title}</div>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TierBadge tier={entry.tier} />
                    <span className="font-bold text-sm tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: i === 0 ? "#ffd24a" : "#ff005c", minWidth: "3rem", textAlign: "right" }}>
                      {entry.points}
                      <span className="text-xs font-normal ml-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>pts</span>
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
          <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.8)" }}>
              Recent Matches
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {recent?.slice(0, 6).map((activity: any) => (
              <div key={activity.matchId} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                    <span style={{ color: "#ff005c" }}>{activity.winnerName}</span>
                    <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 6px" }}>def.</span>
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>{activity.loserName}</span>
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {format(new Date(activity.playedAt), "MMM d, h:mm a")}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  {activity.stake && (
                    <div className="text-xs font-bold" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
                      ±{activity.stake}pts
                    </div>
                  )}
                  <div className="text-xs" style={{ color: "rgba(0,102,255,0.7)" }}>+{activity.eloChange} Elo</div>
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
          <h2 className="text-xs uppercase tracking-widest mb-3 font-semibold flex items-center gap-2" style={{ color: "rgba(255,0,92,0.6)", fontFamily: "Oswald, sans-serif" }}>
            <Skull className="w-3 h-3" /> Eliminated
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {leaderboard.filter(e => e.status === "ELIMINATED").map(entry => (
              <Link key={entry.playerId} href={`/players/${entry.playerId}`}>
                <div className="pdc-card p-3 opacity-50 hover:opacity-70 transition-opacity cursor-pointer" style={{ borderColor: "rgba(255,0,92,0.15)" }}>
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "#ff005c" }}>☠</span>
                    <span className="text-sm font-semibold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>{entry.playerName}</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "rgba(255,0,92,0.6)" }}>0 pts · Eliminated</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
