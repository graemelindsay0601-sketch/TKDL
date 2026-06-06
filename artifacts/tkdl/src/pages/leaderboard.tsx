import { useGetLeaderboard } from "@workspace/api-client-react";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Skull, Flame, Trophy } from "lucide-react";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  const active     = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const eliminated = leaderboard?.filter(e => e.status === "ELIMINATED") ?? [];

  const posColors  = ["#ffd24a", "#c0c8d8", "#cd7f32"];
  const rankClass  = (i: number) => i === 0 ? "lb-rank-1" : i === 1 ? "lb-rank-2" : i === 2 ? "lb-rank-3" : "";
  const rankColor  = (i: number) => posColors[i] ?? "rgba(255,255,255,0.45)";

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-5xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em", textShadow: "0 0 30px rgba(255,0,92,0.25)" }}>
            Season Leaderboard
          </h1>
          <p className="text-sm mt-1.5 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span className="live-dot" /> Ranked by points · Elo tiebreak
          </p>
        </div>
        <div className="text-right text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>
          <div style={{ color: "rgba(255,255,255,0.4)" }}>{active.length} active</div>
          {eliminated.length > 0 && (
            <div style={{ color: "#ff005c" }}>☠ {eliminated.length} eliminated</div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c", boxShadow: "0 0 24px rgba(255,0,92,0.3)" }} />
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,0,92,0.5)", fontFamily: "Oswald, sans-serif" }}>Loading</div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Header */}
          <div
            className="grid text-xs uppercase tracking-widest font-bold px-5 py-2.5 rounded-2xl"
            style={{
              gridTemplateColumns: "3.5rem 1fr 7rem 5rem 5rem 5.5rem",
              color: "rgba(255,255,255,0.22)",
              fontFamily: "Oswald, sans-serif",
              letterSpacing: "0.12em",
              background: "rgba(255,255,255,0.025)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div className="text-center">#</div>
            <div>Player</div>
            <div className="text-center">Tier</div>
            <div className="text-center">Record</div>
            <div className="text-right">Elo</div>
            <div className="text-right">Points</div>
          </div>

          {/* Active players */}
          {active.map((entry, idx) => {
            const isFirst  = idx === 0;
            const isTop3   = idx < 3;
            const streak   = (entry as any).currentStreak ?? 0;
            const pColor   = rankColor(idx);

            return (
              <Link key={entry.playerId} href={`/players/${entry.playerId}`} asChild>
                <div
                  className={`lb-card-row grid items-center fade-in-up ${rankClass(idx)}`}
                  style={{
                    gridTemplateColumns: "3.5rem 1fr 7rem 5rem 5rem 5.5rem",
                    animationDelay: `${idx * 40}ms`,
                  }}
                >
                  {/* Rank */}
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <span
                      className="font-black leading-none"
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        fontSize: isFirst ? "2rem" : "1.6rem",
                        color: pColor,
                        textShadow: isFirst ? `0 0 20px ${pColor}` : undefined,
                      }}
                    >
                      {entry.position}
                    </span>
                    <RankChange change={entry.positionChange} />
                  </div>

                  {/* Name + identity */}
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`font-black uppercase truncate ${isFirst ? "shimmer-gold" : ""}`}
                        style={{
                          fontFamily: "Oswald, sans-serif",
                          fontSize: "1.1rem",
                          letterSpacing: "0.05em",
                          color: isFirst ? undefined : "rgba(255,255,255,0.92)",
                          textShadow: isFirst ? undefined : "0 0 10px rgba(255,255,255,0.1)",
                        }}
                      >
                        {entry.playerName}
                      </span>
                      {streak >= 3 && (
                        <span className="flex items-center gap-0.5 text-xs font-bold shrink-0" style={{ color: "#ff005c" }}>
                          <Flame className="w-3 h-3 streak-fire" />{streak}W
                        </span>
                      )}
                      {isTop3 && (
                        <Trophy className="w-3.5 h-3.5 shrink-0" style={{ color: pColor, filter: `drop-shadow(0 0 5px ${pColor})` }} />
                      )}
                    </div>
                    {(entry as any).title && (
                      <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                        {(entry as any).title}
                      </div>
                    )}
                  </div>

                  {/* Tier */}
                  <div className="flex justify-center">
                    <TierBadge tier={entry.tier} />
                  </div>

                  {/* Record */}
                  <div className="text-center font-mono font-bold text-sm">
                    <span style={{ color: "#22c55e" }}>{entry.wins}</span>
                    <span style={{ color: "rgba(255,255,255,0.2)" }}>-</span>
                    <span style={{ color: "#ff005c" }}>{entry.losses}</span>
                  </div>

                  {/* Elo */}
                  <div className="text-right font-mono font-bold text-sm tabular-nums" style={{ color: "#0066ff", textShadow: "0 0 10px rgba(0,102,255,0.5)" }}>
                    {entry.elo}
                  </div>

                  {/* Points */}
                  <div className="text-right">
                    <span
                      className="font-black text-2xl tabular-nums leading-none"
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        color: isFirst ? "#ffd24a" : "#ff005c",
                        textShadow: isFirst ? "0 0 16px rgba(255,210,74,0.6)" : "0 0 10px rgba(255,0,92,0.3)",
                      }}
                    >
                      {entry.points}
                    </span>
                    <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
                  </div>
                </div>
              </Link>
            );
          })}

          {active.length === 0 && (
            <div className="pdc-card px-6 py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No players on the leaderboard yet.
            </div>
          )}

          {/* Eliminated */}
          {eliminated.length > 0 && (
            <div className="mt-6">
              <div
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-5 py-3 rounded-2xl mb-3"
                style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.18)", color: "rgba(255,0,92,0.85)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.15em" }}
              >
                <Skull className="w-3.5 h-3.5" style={{ filter: "drop-shadow(0 0 4px rgba(255,0,92,0.7))" }} />
                Eliminated
              </div>
              {eliminated.map(entry => (
                <Link key={entry.playerId} href={`/players/${entry.playerId}`} asChild>
                  <div
                    className="lb-card-row lb-eliminated grid items-center mb-2"
                    style={{ gridTemplateColumns: "3.5rem 1fr 7rem 5rem 5rem 5.5rem" }}
                  >
                    <div className="text-center text-xl" style={{ color: "#ff005c" }}>☠</div>
                    <div className="min-w-0 pr-2">
                      <span className="font-black uppercase text-sm line-through" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,100,100,0.7)" }}>
                        {entry.playerName}
                      </span>
                    </div>
                    <div className="flex justify-center"><TierBadge tier={entry.tier} /></div>
                    <div className="text-center font-mono text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {entry.wins}-{entry.losses}
                    </div>
                    <div className="text-right font-mono text-sm" style={{ color: "rgba(0,102,255,0.3)" }}>{entry.elo}</div>
                    <div className="text-right font-black" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.4)", fontSize: "1.1rem" }}>
                      0 <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,0.1)" }}>pts</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
