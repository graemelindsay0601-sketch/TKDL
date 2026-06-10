import { useGetSeason, getGetSeasonQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { TierBadge } from "@/components/tier-badge";
import { format } from "date-fns";
import { Trophy, Calendar, Hash, ArrowLeft, Medal, Flame, Zap, Crown, BarChart3 } from "lucide-react";

export default function SeasonDetail() {
  const params = useParams();
  const seasonId = parseInt(params.id || "0", 10);

  const { data: seasonDetail, isLoading } = useGetSeason(seasonId, {
    query: { enabled: !!seasonId, queryKey: getGetSeasonQueryKey(seasonId) },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
      </div>
    );
  }

  if (!seasonDetail) {
    return <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.3)" }}>Season not found.</div>;
  }

  const { season, standings } = seasonDetail;

  const posColors = ["#ffd24a", "#c0c8d8", "#cd7f32"];

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />

      <Link href="/seasons" className="flex items-center gap-1 text-xs hover:underline" style={{ color: "rgba(255,255,255,0.35)" }}>
        <ArrowLeft className="w-3 h-3" /> All Seasons
      </Link>

      {/* Header */}
      <div className="pdc-card p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
                {season.name}
              </h1>
              {season.isActive && (
                <span
                  className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded animate-pulse"
                  style={{ background: "rgba(255,0,92,0.15)", color: "#ff005c", fontFamily: "Oswald, sans-serif", border: "1px solid rgba(255,0,92,0.3)" }}
                >
                  Live
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(season.startDate), "MMM d, yyyy")}
                {season.endDate ? ` — ${format(new Date(season.endDate), "MMM d, yyyy")}` : " — Present"}
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" />
                {season.totalMatches ?? 0} matches
              </div>
            </div>
          </div>

          {season.championName && (
            <div
              className="pdc-card p-4 flex items-center gap-4 min-w-[220px]"
              style={{ borderColor: "rgba(255,210,74,0.25)", background: "rgba(255,210,74,0.04)" }}
            >
              <div className="p-2 rounded" style={{ background: "rgba(255,210,74,0.12)" }}>
                <Trophy className="w-7 h-7" style={{ color: "#ffd24a" }} />
              </div>
              <div>
                <div className="text-xs uppercase font-bold tracking-wider" style={{ color: "rgba(255,210,74,0.5)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                  Champion
                </div>
                <div className="text-xl font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>
                  {season.championName}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Card — only for completed seasons */}
      {!season.isActive && standings && standings.length > 0 && (() => {
        const sorted = [...standings];
        const mostWins    = [...sorted].sort((a, b) => (b.wins  ?? 0) - (a.wins  ?? 0))[0];
        const highestElo  = [...sorted].sort((a, b) => (b.elo   ?? 0) - (a.elo   ?? 0))[0];
        const mostPoints  = [...sorted].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
        const totalMatches = sorted.reduce((s, e) => s + (e.wins ?? 0), 0);
        const winPct = mostWins ? Math.round(((mostWins.wins ?? 0) / Math.max((mostWins.wins ?? 0) + (mostWins.losses ?? 0), 1)) * 100) : 0;

        const stats = [
          { icon: <Flame className="w-4 h-4" />, color: "#ff005c", label: "Season Dominator", value: mostWins?.playerName ?? "—", sub: `${mostWins?.wins ?? 0}W–${mostWins?.losses ?? 0}L · ${winPct}% win rate` },
          { icon: <Zap className="w-4 h-4" />,   color: "#0066ff", label: "Peak Elo",          value: `${highestElo?.elo ?? 0}`,    sub: highestElo?.playerName ?? "—" },
          { icon: <Crown className="w-4 h-4" />, color: "#ffd24a", label: "Points Leader",     value: `${mostPoints?.points ?? 0}`, sub: mostPoints?.playerName ?? "—" },
          { icon: <BarChart3 className="w-4 h-4" />, color: "#4ade80", label: "Total Matches",  value: totalMatches,                  sub: `${sorted.length} players` },
        ];

        return (
          <div className="pdc-card p-5" style={{ borderColor: "rgba(255,210,74,0.12)", background: "rgba(255,210,74,0.02)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4" style={{ color: "#ffd24a" }} />
              <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", letterSpacing: "0.14em" }}>
                Season Report Card
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.map(s => (
                <div key={s.label} className="rounded-xl px-4 py-3"
                  style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span style={{ color: s.color }}>{s.icon}</span>
                    <span className="text-xs uppercase tracking-widest font-bold"
                      style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.55rem", letterSpacing: "0.16em" }}>
                      {s.label}
                    </span>
                  </div>
                  <div className="font-black leading-none mb-0.5"
                    style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.5rem", color: s.color, textShadow: `0 0 16px ${s.color}55` }}>
                    {s.value}
                  </div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Standings */}
      <div className="pdc-card overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          <Medal className="w-4 h-4" style={{ color: "#ff005c" }} />
          <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
            Final Standings
          </h2>
        </div>

        {/* Table header */}
        <div
          className="grid text-xs uppercase font-bold px-4 py-2 border-b"
          style={{ gridTemplateColumns: "3rem 1fr 7rem 5rem 5rem 5rem", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}
        >
          <div className="text-center">#</div>
          <div>Player</div>
          <div className="text-center">Tier</div>
          <div className="text-center">Record</div>
          <div className="text-right">Elo</div>
          <div className="text-right">Points</div>
        </div>

        {standings?.map((entry, idx) => (
          <div
            key={entry.playerId}
            className="grid items-center px-4 py-3 border-b transition-colors hover:bg-white/[0.025]"
            style={{
              gridTemplateColumns: "3rem 1fr 7rem 5rem 5rem 5rem",
              borderColor: "rgba(255,255,255,0.05)",
              background: idx === 0 ? "rgba(255,210,74,0.04)" : undefined,
            }}
          >
            <div className="text-center">
              <span className="font-bold text-xl leading-none" style={{ fontFamily: "Oswald, sans-serif", color: posColors[idx] ?? "rgba(255,255,255,0.4)" }}>
                {entry.position}
              </span>
              {(entry as any).isChampion && <div className="text-xs" style={{ color: "#ffd24a" }}>🏆</div>}
            </div>

            <div className="min-w-0 pr-2">
              <Link href={`/players/${entry.playerId}`} className="font-bold text-base hover:underline truncate block" style={{ fontFamily: "Oswald, sans-serif", color: idx === 0 ? "#ffd24a" : "rgba(255,255,255,0.85)" }}>
                {entry.playerName}
              </Link>
              {(entry as any).playerNickname && (
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>"{(entry as any).playerNickname}"</div>
              )}
            </div>

            <div className="flex justify-center">
              <TierBadge tier={entry.tier} />
            </div>

            <div className="text-center text-sm font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
              <span style={{ color: "#22c55e" }}>{entry.wins}</span>
              <span style={{ color: "rgba(255,255,255,0.25)" }}>-</span>
              <span style={{ color: "#ff005c" }}>{entry.losses}</span>
            </div>

            <div className="text-right font-mono text-sm tabular-nums" style={{ color: "#0066ff" }}>
              {entry.elo}
            </div>

            <div className="text-right">
              <span className="font-bold text-lg" style={{ fontFamily: "Oswald, sans-serif", color: idx === 0 ? "#ffd24a" : "#ff005c" }}>
                {entry.points}
              </span>
              <span className="text-xs ml-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
            </div>
          </div>
        ))}

        {(!standings || standings.length === 0) && (
          <div className="px-4 py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            No standings data yet — check back when the season ends.
          </div>
        )}
      </div>
    </div>
  );
}
