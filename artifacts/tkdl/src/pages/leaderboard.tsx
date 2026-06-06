import { useGetLeaderboard } from "@workspace/api-client-react";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Skull, Flame, Trophy } from "lucide-react";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  const active     = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const eliminated = leaderboard?.filter(e => e.status === "ELIMINATED") ?? [];

  const tierRingCls = (tier: string) => {
    if (tier === "Gold")   return "tier-ring-gold";
    if (tier === "Silver") return "tier-ring-silver";
    return "tier-ring-bronze";
  };

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
            Season Leaderboard
          </h1>
          <p className="text-sm mt-1 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
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
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c", boxShadow: "0 0 20px rgba(255,0,92,0.3)" }} />
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,0,92,0.5)", fontFamily: "Oswald, sans-serif" }}>Loading</div>
        </div>
      ) : (
        <div className="pdc-card overflow-hidden">
          {/* Header row */}
          <div
            className="grid text-xs uppercase tracking-widest font-bold px-4 py-2.5 border-b"
            style={{
              gridTemplateColumns: "3.5rem 1fr 7rem 5rem 5rem 5.5rem",
              borderColor: "rgba(255,255,255,0.07)",
              color: "rgba(255,255,255,0.25)",
              fontFamily: "Oswald, sans-serif",
              letterSpacing: "0.1em",
              background: "rgba(255,255,255,0.015)",
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
            const posColor  = posColors[idx] ?? "rgba(255,255,255,0.4)";
            const isFirst   = idx === 0;
            const isTop3    = idx < 3;
            const streak    = (entry as any).currentStreak ?? 0;
            const tier      = entry.tier;
            const rowCls    = isFirst ? "lb-row-first" : idx === 1 ? "lb-row-second" : idx === 2 ? "lb-row-third" : "";

            return (
              <div
                key={entry.playerId}
                className={`grid items-center px-4 py-3 border-b transition-all hover:bg-white/[0.03] fade-in-up ${rowCls}`}
                style={{
                  gridTemplateColumns: "3.5rem 1fr 7rem 5rem 5rem 5.5rem",
                  borderColor: "rgba(255,255,255,0.045)",
                  animationDelay: `${idx * 40}ms`,
                }}
              >
                {/* Position + rank change */}
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <span
                    className={`font-bold text-xl leading-none ${isFirst ? "rank-1" : ""}`}
                    style={{ fontFamily: "Oswald, sans-serif", color: posColor }}
                  >
                    {entry.position}
                  </span>
                  <RankChange change={entry.positionChange} />
                </div>

                {/* Name + identity */}
                <div className="min-w-0 pr-2 flex items-center gap-3">
                  {/* Avatar with tier ring */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black uppercase shrink-0 ${tierRingCls(tier)}`}
                    style={{ background: isFirst ? "rgba(255,210,74,0.15)" : "rgba(255,0,92,0.1)", fontFamily: "Oswald, sans-serif", color: isFirst ? "#ffd24a" : "#ff005c" }}
                  >
                    {entry.playerName.substring(0, 2)}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/players/${entry.playerId}`}
                        className={`font-bold text-sm hover:underline truncate ${isFirst ? "shimmer-gold" : ""}`}
                        style={!isFirst ? { fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.9)" } : { fontFamily: "Oswald, sans-serif" }}
                      >
                        {entry.playerName}
                      </Link>
                      {streak >= 3 && (
                        <span className="flex items-center gap-0.5 text-xs font-bold shrink-0" style={{ color: "#ff005c" }}>
                          <Flame className="w-3 h-3 streak-fire" />{streak}W
                        </span>
                      )}
                      {isTop3 && (
                        <Trophy className="w-3 h-3 shrink-0" style={{ color: posColor, filter: `drop-shadow(0 0 4px ${posColor})` }} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {(entry as any).title && (
                        <span className="text-xs truncate" style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                          {(entry as any).title}
                        </span>
                      )}
                      {(entry as any).aura && (
                        <span
                          className="aura-badge"
                          style={{
                            color: (entry as any).auraColor ?? "rgba(255,255,255,0.4)",
                            borderColor: `${(entry as any).auraColor ?? "#ffffff"}33`,
                            background: `${(entry as any).auraColor ?? "#ffffff"}0d`,
                          }}
                        >
                          {(entry as any).aura}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Tier */}
                <div className="flex justify-center">
                  <TierBadge tier={tier} />
                </div>

                {/* Record */}
                <div className="text-center text-sm font-mono font-bold">
                  <span style={{ color: "#22c55e" }}>{entry.wins}</span>
                  <span style={{ color: "rgba(255,255,255,0.2)" }}>-</span>
                  <span style={{ color: "#ff005c" }}>{entry.losses}</span>
                </div>

                {/* Elo */}
                <div className="text-right font-mono text-sm tabular-nums font-bold" style={{ color: "#0066ff", textShadow: "0 0 8px rgba(0,102,255,0.4)" }}>
                  {entry.elo}
                </div>

                {/* Points */}
                <div className="text-right">
                  <span
                    className="font-bold text-xl tabular-nums"
                    style={{
                      fontFamily: "Oswald, sans-serif",
                      color: isFirst ? "#ffd24a" : "#ff005c",
                      textShadow: isFirst ? "0 0 12px rgba(255,210,74,0.5)" : "0 0 8px rgba(255,0,92,0.3)",
                    }}
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
                style={{ borderColor: "rgba(255,0,92,0.15)", background: "rgba(255,0,92,0.06)", color: "rgba(255,0,92,0.8)", fontFamily: "Oswald, sans-serif" }}
              >
                <Skull className="w-3 h-3" style={{ filter: "drop-shadow(0 0 4px rgba(255,0,92,0.6))" }} /> Eliminated
              </div>
              {eliminated.map(entry => (
                <div
                  key={entry.playerId}
                  className="eliminated-row grid items-center px-4 py-2.5 border-b"
                  style={{
                    gridTemplateColumns: "3.5rem 1fr 7rem 5rem 5rem 5.5rem",
                    borderColor: "rgba(255,0,92,0.08)",
                  }}
                >
                  <div className="text-center text-base" style={{ color: "#ff005c", filter: "drop-shadow(0 0 4px rgba(255,0,92,0.5))" }}>☠</div>
                  <div className="min-w-0 pr-2">
                    <Link href={`/players/${entry.playerId}`} className="font-bold text-sm hover:underline" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)" }}>
                      {entry.playerName}
                    </Link>
                  </div>
                  <div className="flex justify-center"><TierBadge tier={entry.tier} /></div>
                  <div className="text-center text-sm font-mono">
                    <span style={{ color: "#22c55e44" }}>{entry.wins}</span>
                    <span style={{ color: "rgba(255,255,255,0.12)" }}>-</span>
                    <span style={{ color: "#ff005c44" }}>{entry.losses}</span>
                  </div>
                  <div className="text-right font-mono text-sm" style={{ color: "rgba(0,102,255,0.3)" }}>{entry.elo}</div>
                  <div className="text-right font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.4)" }}>
                    0 <span className="text-xs font-normal" style={{ color: "rgba(255,255,255,0.1)" }}>pts</span>
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
