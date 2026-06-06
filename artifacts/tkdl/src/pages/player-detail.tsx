import { useGetPlayerStats, getGetPlayerStatsQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { TierBadge } from "@/components/tier-badge";
import { format } from "date-fns";
import { Trophy, Target, Skull, Flame, ArrowLeft } from "lucide-react";

function StatCell({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="pdc-card p-3 text-center">
      <div className="text-xs uppercase tracking-widest mb-1 font-semibold" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", letterSpacing: "0.12em" }}>
        {label}
      </div>
      <div className="font-bold text-xl leading-none" style={{ fontFamily: "Oswald, sans-serif", color: accent ?? "rgba(255,255,255,0.85)" }}>
        {value}
      </div>
    </div>
  );
}

export default function PlayerDetail() {
  const params = useParams();
  const playerId = parseInt(params.id || "0", 10);

  const { data: stats, isLoading } = useGetPlayerStats(playerId, {
    query: { enabled: !!playerId, queryKey: getGetPlayerStatsQueryKey(playerId) },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.3)" }}>
        Player not found.
      </div>
    );
  }

  const { player, seasonHistory, recentMatches, achievements } = stats;
  const identity = (stats as any).identity ?? {};
  const isEliminated = player.status === "ELIMINATED";
  const derivedTier = player.elo >= 1100 ? "Gold" : player.elo >= 980 ? "Silver" : "Bronze";
  const tier = (player as any).tier || derivedTier;

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />

      <Link href="/players" className="flex items-center gap-1 text-xs hover:underline" style={{ color: "rgba(255,255,255,0.35)" }}>
        <ArrowLeft className="w-3 h-3" /> All Players
      </Link>

      {/* Hero card */}
      <div
        className="pdc-card p-6 relative overflow-hidden"
        style={{
          borderColor: isEliminated ? "rgba(255,0,92,0.25)" : "rgba(255,255,255,0.08)",
          background: isEliminated
            ? "rgba(255,0,92,0.04)"
            : identity.aura
            ? "rgba(255,255,255,0.025)"
            : undefined,
        }}
      >
        {/* BG watermark */}
        <div className="absolute right-4 top-4 opacity-5 pointer-events-none">
          <Target className="w-32 h-32" />
        </div>

        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          <div
            className="w-20 h-20 rounded flex items-center justify-center text-3xl font-black uppercase shrink-0"
            style={{
              background: isEliminated ? "rgba(255,0,92,0.1)" : "rgba(255,0,92,0.08)",
              color: isEliminated ? "#ff005c" : "#ff005c",
              fontFamily: "Oswald, sans-serif",
              border: isEliminated ? "1px solid rgba(255,0,92,0.3)" : "1px solid rgba(255,0,92,0.15)",
            }}
          >
            {isEliminated ? "☠" : player.name.substring(0, 2)}
          </div>

          {/* Name + identity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1">
              <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", color: isEliminated ? "#ff005c" : "#fff" }}>
                {player.name}
              </h1>
              {(player as any).nickname && (
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
                  "{(player as any).nickname}"
                </span>
              )}
              <TierBadge tier={tier} />
              {isEliminated && (
                <span className="aura-badge" style={{ color: "#ff005c", borderColor: "rgba(255,0,92,0.4)", background: "rgba(255,0,92,0.1)" }}>
                  <Skull className="w-3 h-3 inline mr-1" />ELIMINATED
                </span>
              )}
            </div>

            {/* Title + archetype */}
            {identity.title && (
              <div className="text-sm mb-2" style={{ color: "rgba(255,210,74,0.7)", fontStyle: "italic" }}>
                "{identity.title}"
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {identity.archetype && (
                <span className="aura-badge" style={{ color: "rgba(255,255,255,0.5)", borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)" }}>
                  {identity.archetype}
                </span>
              )}
              {identity.aura && (
                <span className="aura-badge" style={{ color: "#0066ff", borderColor: "rgba(0,102,255,0.3)", background: "rgba(0,102,255,0.07)" }}>
                  {identity.aura}
                </span>
              )}
              {identity.prestige && (
                <span className="aura-badge" style={{ color: "#ffd24a", borderColor: "rgba(255,210,74,0.3)", background: "rgba(255,210,74,0.07)" }}>
                  {identity.prestige}
                </span>
              )}
            </div>
          </div>

          {/* Points balance */}
          <div className="text-right shrink-0">
            <div className="text-xs uppercase tracking-widest mb-1 font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem" }}>
              Balance
            </div>
            <div className="text-5xl font-bold" style={{ fontFamily: "Oswald, sans-serif", color: isEliminated ? "#ff005c" : "#ff005c", lineHeight: 1 }}>
              {player.points}
            </div>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>pts</div>
            <div className="mt-2 text-sm font-mono" style={{ color: "#0066ff" }}>
              {player.elo} Elo
            </div>
          </div>
        </div>
      </div>

      {/* Season stats */}
      <div>
        <h2 className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>
          Current Season
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <StatCell label="Wins"    value={player.seasonWins ?? 0}   accent="#22c55e" />
          <StatCell label="Losses"  value={player.seasonLosses ?? 0} accent="#ff005c" />
          <StatCell label="Played"  value={player.seasonGamesPlayed ?? 0} />
          <StatCell label="Win %"   value={
            (player.seasonGamesPlayed ?? 0) > 0
              ? `${(((player.seasonWins ?? 0) / (player.seasonGamesPlayed ?? 1)) * 100).toFixed(0)}%`
              : "—"
          } />
          <StatCell label="W-Streak" value={player.currentWinStreak ?? 0}  accent={player.currentWinStreak && player.currentWinStreak >= 3 ? "#ff005c" : undefined} />
          <StatCell label="L-Streak" value={player.currentLossStreak ?? 0} accent={player.currentLossStreak && player.currentLossStreak >= 3 ? "#ff005c" : undefined} />
        </div>
      </div>

      {/* Career stats */}
      <div>
        <h2 className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)", letterSpacing: "0.15em" }}>
          Career
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <StatCell label="Wins"      value={player.careerWins ?? 0}         accent="#22c55e" />
          <StatCell label="Losses"    value={player.careerLosses ?? 0}       accent="#ff005c" />
          <StatCell label="Played"    value={player.careerGamesPlayed ?? 0} />
          <StatCell label="Career W%" value={
            (player.careerGamesPlayed ?? 0) > 0
              ? `${(((player.careerWins ?? 0) / (player.careerGamesPlayed ?? 1)) * 100).toFixed(0)}%`
              : "—"
          } />
          <StatCell label="Peak Elo"  value={player.careerPeakElo ?? player.elo} accent="#0066ff" />
          <StatCell label="Peak Pts"  value={player.peakPoints ?? player.points}  accent="#ffd24a" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent matches */}
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Recent Matches
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            {recentMatches?.slice(0, 8).map((m: any) => {
              const isWin = m.winnerId === player.id;
              return (
                <div key={m.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ fontFamily: "Oswald, sans-serif", color: isWin ? "#22c55e" : "#ff005c" }}>
                      {isWin ? "WIN" : "LOSS"}
                    </div>
                    <div className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                      vs {isWin ? m.loserName : m.winnerName}
                    </div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {format(new Date(m.playedAt), "MMM d, yyyy")}
                    </div>
                  </div>
                  <div className="text-right">
                    {m.stake && (
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
              <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No matches yet</div>
            )}
          </div>
        </div>

        {/* Achievements */}
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Achievements
            </h2>
            <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
              {achievements?.length ?? 0} unlocked
            </span>
          </div>
          {achievements && achievements.length > 0 ? (
            <div className="p-3 grid grid-cols-3 gap-2">
              {achievements.slice(0, 9).map((a: any) => (
                <div
                  key={a.id ?? a.achievement?.id}
                  className="pdc-card p-2 text-center"
                  title={a.achievement?.name ?? a.name}
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}
                >
                  <div className="text-2xl leading-none mb-1">
                    {a.achievement?.icon ?? a.icon ?? <Trophy className="w-5 h-5 mx-auto opacity-40" />}
                  </div>
                  <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                    {a.achievement?.name ?? a.name}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No achievements yet</div>
          )}
        </div>
      </div>

      {/* Season history */}
      {seasonHistory && seasonHistory.length > 0 && (
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Season History
            </h2>
          </div>
          <div
            className="grid text-xs uppercase font-bold px-4 py-2 border-b"
            style={{ gridTemplateColumns: "1fr 4rem 4rem 4rem 5rem", borderColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}
          >
            <div>Season</div>
            <div className="text-center">Pos</div>
            <div className="text-center">W-L</div>
            <div className="text-right">Elo</div>
            <div className="text-right">Pts</div>
          </div>
          {seasonHistory.map((s: any) => (
            <div
              key={s.seasonId}
              className="grid px-4 py-2.5 border-b items-center hover:bg-white/[0.02] transition-colors"
              style={{ gridTemplateColumns: "1fr 4rem 4rem 5rem 5rem", borderColor: "rgba(255,255,255,0.04)" }}
            >
              <div>
                <Link href={`/seasons/${s.seasonId}`} className="text-sm font-semibold hover:underline" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  {s.seasonName}
                </Link>
                {s.isChampion && (
                  <span className="ml-2 text-xs" style={{ color: "#ffd24a" }}>🏆 Champion</span>
                )}
              </div>
              <div className="text-center text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: s.position === 1 ? "#ffd24a" : "rgba(255,255,255,0.5)" }}>
                #{s.position}
              </div>
              <div className="text-center text-sm font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                <span style={{ color: "#22c55e" }}>{s.wins}</span>-<span style={{ color: "#ff005c" }}>{s.losses}</span>
              </div>
              <div className="text-right text-sm font-mono" style={{ color: "#0066ff" }}>{s.elo}</div>
              <div className="text-right font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>
                {s.points}pts
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
