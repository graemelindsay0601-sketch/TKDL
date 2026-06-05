import { useGetLeaderboard } from "@workspace/api-client-react";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Skull, Flame, TrendingUp } from "lucide-react";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  const active     = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const eliminated = leaderboard?.filter(e => e.status === "ELIMINATED") ?? [];

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
            Season Leaderboard
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            Ranked by points · Elo tiebreak
          </p>
        </div>
        <div className="text-right text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          <div>{active.length} active</div>
          {eliminated.length > 0 && (
            <div style={{ color: "#ff005c" }}>☠ {eliminated.length} eliminated</div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : (
        <div className="pdc-card overflow-hidden">
          {/* Header row */}
          <div
            className="grid text-xs uppercase tracking-widest font-bold px-4 py-2 border-b"
            style={{
              gridTemplateColumns: "3rem 1fr 7rem 5rem 5rem 5rem",
              borderColor: "rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "Oswald, sans-serif",
              letterSpacing: "0.1em",
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
            const posColors = ["#ffd24a", "#c0c8d8", "#cd7f32"];
            const posColor = posColors[idx] ?? "rgba(255,255,255,0.4)";
            const isFirst = idx === 0;
            const streak = (entry as any).currentStreak ?? 0;

            return (
              <div
                key={entry.playerId}
                className="grid items-center px-4 py-3 border-b transition-colors hover:bg-white/[0.025]"
                style={{
                  gridTemplateColumns: "3rem 1fr 7rem 5rem 5rem 5rem",
                  borderColor: "rgba(255,255,255,0.05)",
                  background: isFirst ? "rgba(255,210,74,0.04)" : undefined,
                }}
              >
                {/* Position */}
                <div className="flex flex-col items-center justify-center">
                  <span className="font-bold text-lg leading-none" style={{ fontFamily: "Oswald, sans-serif", color: posColor }}>
                    {entry.position}
                  </span>
                  <RankChange change={entry.positionChange} />
                </div>

                {/* Name + identity */}
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/players/${entry.playerId}`}
                      className="font-bold text-base hover:underline truncate"
                      style={{ fontFamily: "Oswald, sans-serif", color: isFirst ? "#ffd24a" : "rgba(255,255,255,0.9)" }}
                    >
                      {entry.playerName}
                    </Link>
                    {streak >= 3 && (
                      <span className="flex items-center gap-0.5 text-xs font-bold" style={{ color: "#ff005c" }}>
                        <Flame className="w-3 h-3" />{streak}W
                      </span>
                    )}
                  </div>
                  {(entry as any).title && (
                    <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.28)", fontStyle: "italic" }}>
                      {(entry as any).title}
                    </div>
                  )}
                  {(entry as any).aura && (
                    <span className="aura-badge" style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", marginTop: "2px" }}>
                      {(entry as any).aura}
                    </span>
                  )}
                </div>

                {/* Tier */}
                <div className="flex justify-center">
                  <TierBadge tier={entry.tier} />
                </div>

                {/* Record */}
                <div className="text-center text-sm font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                  <span style={{ color: "#22c55e" }}>{entry.wins}</span>
                  <span style={{ color: "rgba(255,255,255,0.25)" }}>-</span>
                  <span style={{ color: "#ff005c" }}>{entry.losses}</span>
                </div>

                {/* Elo */}
                <div className="text-right font-mono text-sm tabular-nums" style={{ color: "#0066ff" }}>
                  {entry.elo}
                </div>

                {/* Points */}
                <div className="text-right">
                  <span
                    className="font-bold text-lg tabular-nums"
                    style={{ fontFamily: "Oswald, sans-serif", color: isFirst ? "#ffd24a" : "#ff005c" }}
                  >
                    {entry.points}
                  </span>
                  <span className="text-xs ml-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
                </div>
              </div>
            );
          })}

          {active.length === 0 && (
            <div className="px-4 py-12 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No players on the leaderboard yet.
            </div>
          )}

          {/* Eliminated section */}
          {eliminated.length > 0 && (
            <>
              <div
                className="px-4 py-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest border-t border-b"
                style={{ borderColor: "rgba(255,0,92,0.15)", background: "rgba(255,0,92,0.05)", color: "rgba(255,0,92,0.7)", fontFamily: "Oswald, sans-serif" }}
              >
                <Skull className="w-3 h-3" /> Eliminated
              </div>
              {eliminated.map(entry => (
                <div
                  key={entry.playerId}
                  className="eliminated-row grid items-center px-4 py-2.5 border-b"
                  style={{
                    gridTemplateColumns: "3rem 1fr 7rem 5rem 5rem 5rem",
                    borderColor: "rgba(255,0,92,0.08)",
                  }}
                >
                  <div className="text-center text-base" style={{ color: "#ff005c" }}>☠</div>
                  <div className="min-w-0 pr-2">
                    <Link href={`/players/${entry.playerId}`} className="font-bold text-sm hover:underline" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>
                      {entry.playerName}
                    </Link>
                  </div>
                  <div className="flex justify-center"><TierBadge tier={entry.tier} /></div>
                  <div className="text-center text-sm font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                    <span style={{ color: "#22c55e55" }}>{entry.wins}</span>
                    <span style={{ color: "rgba(255,255,255,0.15)" }}>-</span>
                    <span style={{ color: "#ff005c55" }}>{entry.losses}</span>
                  </div>
                  <div className="text-right font-mono text-sm" style={{ color: "rgba(0,102,255,0.4)" }}>{entry.elo}</div>
                  <div className="text-right font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.5)" }}>
                    0 <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,0.15)" }}>pts</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
