import { useGetLeaderboard } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Skull, Flame, Trophy, ChevronDown } from "lucide-react";
import { useState } from "react";

type Mode = "season" | "career";

const CAREER_SORTS = [
  { key: "wins",    label: "Career Wins"   },
  { key: "winRate", label: "Win Rate"       },
  { key: "elo",     label: "Current ELO"   },
  { key: "peakElo", label: "Peak ELO"       },
  { key: "points",  label: "Career Points" },
] as const;

function FilterBtn({ active, onClick, color = "#ff005c", children }: {
  active: boolean; onClick: () => void; color?: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all"
      style={{
        fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
        background: active ? `${color}22` : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? `${color}66` : "rgba(255,255,255,0.08)"}`,
        color: active ? color : "rgba(255,255,255,0.35)",
      }}>
      {children}
    </button>
  );
}

export default function Leaderboard() {
  const [mode, setMode]         = useState<Mode>("season");
  const [careerSort, setSort]   = useState<string>("wins");

  const { data: leaderboard, isLoading: seasonLoading } = useGetLeaderboard();

  const { data: careerData, isLoading: careerLoading } = useQuery({
    queryKey: ["leaderboard-career", careerSort],
    queryFn: () => fetch(`/api/leaderboard/career?sortBy=${careerSort}`).then(r => r.json()),
    enabled: mode === "career",
  });

  const isLoading = mode === "season" ? seasonLoading : careerLoading;

  const active     = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const eliminated = leaderboard?.filter(e => e.status === "ELIMINATED") ?? [];
  const posColors  = ["#ffd24a", "#c0c8d8", "#cd7f32"];
  const rankClass  = (i: number) => i === 0 ? "lb-rank-1" : i === 1 ? "lb-rank-2" : i === 2 ? "lb-rank-3" : "";

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-black uppercase"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "3rem", letterSpacing: "0.04em", textShadow: "0 0 30px rgba(255,0,92,0.2)", lineHeight: 1 }}>
            {mode === "season" ? "Season Standings" : "All-Time Records"}
          </h1>
          <p className="text-sm mt-1.5 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
            {mode === "season" ? (
              <><span className="live-dot" /> Ranked by points · ELO tiebreak</>
            ) : (
              <>📊 Career statistics across all seasons</>
            )}
          </p>
        </div>
        <div className="text-right text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>
          {mode === "season" && (
            <>
              <div style={{ color: "rgba(255,255,255,0.4)" }}>{active.length} active</div>
              {eliminated.length > 0 && <div style={{ color: "#ff005c" }}>☠ {eliminated.length} eliminated</div>}
            </>
          )}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterBtn active={mode === "season"} onClick={() => setMode("season")}>
          🏆 Season
        </FilterBtn>
        <FilterBtn active={mode === "career"} onClick={() => setMode("career")} color="#0066ff">
          📊 All Time
        </FilterBtn>

        {mode === "career" && (
          <>
            <div className="w-px h-5 bg-white/10 mx-1" />
            {CAREER_SORTS.map(s => (
              <FilterBtn key={s.key} active={careerSort === s.key} onClick={() => setSort(s.key)} color="#ffd24a">
                {s.label}
              </FilterBtn>
            ))}
          </>
        )}
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: "#ff005c", boxShadow: "0 0 20px rgba(255,0,92,0.3)" }} />
        </div>
      ) : mode === "season" ? (
        /* ── SEASON VIEW ── */
        <div className="space-y-2">
          {/* Column headers */}
          <div className="grid text-xs uppercase tracking-widest font-bold px-5 py-2.5 rounded-2xl"
            style={{
              gridTemplateColumns: "3.5rem 1fr 7rem 5rem 5rem 5.5rem",
              color: "rgba(255,255,255,0.22)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em",
              background: "rgba(255,255,255,0.025)",
            }}>
            <div className="text-center">#</div>
            <div>Player</div>
            <div className="text-center">Tier</div>
            <div className="text-center">Record</div>
            <div className="text-right">ELO</div>
            <div className="text-right">Points</div>
          </div>

          {active.map((entry, idx) => {
            const streak  = (entry as any).currentStreak ?? 0;
            const pColor  = posColors[idx] ?? "rgba(255,255,255,0.45)";
            const isFirst = idx === 0;
            return (
              <Link key={entry.playerId} href={`/players/${entry.playerId}`} asChild>
                <div className={`lb-card-row grid items-center fade-in-up ${rankClass(idx)}`}
                  style={{ gridTemplateColumns: "3.5rem 1fr 7rem 5rem 5rem 5.5rem", animationDelay: `${idx * 40}ms` }}>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-black leading-none"
                      style={{ fontFamily: "Oswald, sans-serif", fontSize: isFirst ? "2rem" : "1.6rem", color: pColor, textShadow: isFirst ? `0 0 20px ${pColor}` : undefined }}>
                      {entry.position}
                    </span>
                    <RankChange change={entry.positionChange} />
                  </div>
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-black uppercase truncate ${isFirst ? "shimmer-gold" : ""}`}
                        style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", letterSpacing: "0.05em", color: isFirst ? undefined : "rgba(255,255,255,0.92)" }}>
                        {entry.playerName}
                      </span>
                      {streak >= 3 && (
                        <span className="flex items-center gap-0.5 text-xs font-bold shrink-0" style={{ color: "#ff005c" }}>
                          <Flame className="w-3 h-3 streak-fire" />{streak}W
                        </span>
                      )}
                      {idx < 3 && <Trophy className="w-3.5 h-3.5 shrink-0" style={{ color: pColor, filter: `drop-shadow(0 0 4px ${pColor})` }} />}
                    </div>
                    {(entry as any).title && (
                      <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>
                        {(entry as any).title}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center"><TierBadge tier={entry.tier} /></div>
                  <div className="text-center font-mono font-bold text-sm">
                    <span style={{ color: "#22c55e" }}>{entry.wins}</span>
                    <span style={{ color: "rgba(255,255,255,0.2)" }}>-</span>
                    <span style={{ color: "#ff005c" }}>{entry.losses}</span>
                  </div>
                  <div className="text-right font-mono font-bold text-sm tabular-nums" style={{ color: "#0066ff", textShadow: "0 0 8px rgba(0,102,255,0.4)" }}>
                    {entry.elo}
                  </div>
                  <div className="text-right">
                    <span className="font-black text-2xl tabular-nums leading-none"
                      style={{ fontFamily: "Oswald, sans-serif", color: isFirst ? "#ffd24a" : "#ff005c", textShadow: isFirst ? "0 0 14px rgba(255,210,74,0.5)" : "0 0 8px rgba(255,0,92,0.3)" }}>
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
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest px-5 py-3 rounded-2xl mb-3"
                style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.18)", color: "rgba(255,0,92,0.85)", fontFamily: "Oswald, sans-serif" }}>
                <Skull className="w-3.5 h-3.5" style={{ filter: "drop-shadow(0 0 4px rgba(255,0,92,0.7))" }} />
                Eliminated
              </div>
              {eliminated.map(entry => (
                <Link key={entry.playerId} href={`/players/${entry.playerId}`} asChild>
                  <div className="lb-card-row lb-eliminated grid items-center mb-2"
                    style={{ gridTemplateColumns: "3.5rem 1fr 7rem 5rem 5rem 5.5rem" }}>
                    <div className="text-center text-xl" style={{ color: "#ff005c" }}>☠</div>
                    <div className="min-w-0 pr-2">
                      <span className="font-black uppercase text-sm line-through" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,100,100,0.7)" }}>
                        {entry.playerName}
                      </span>
                    </div>
                    <div className="flex justify-center"><TierBadge tier={entry.tier} /></div>
                    <div className="text-center font-mono text-sm" style={{ color: "rgba(255,255,255,0.25)" }}>{entry.wins}-{entry.losses}</div>
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
      ) : (
        /* ── CAREER VIEW ── */
        <div className="space-y-2">
          {/* Column headers */}
          <div className="grid text-xs uppercase tracking-widest font-bold px-5 py-2.5 rounded-2xl"
            style={{
              gridTemplateColumns: "3rem 1fr 6rem 6rem 5rem 5rem 5rem",
              color: "rgba(255,255,255,0.22)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
              background: "rgba(255,255,255,0.025)",
            }}>
            <div className="text-center">#</div>
            <div>Player</div>
            <div className="text-center">W-L</div>
            <div className="text-center">Win %</div>
            <div className="text-right">ELO</div>
            <div className="text-right">Peak ELO</div>
            <div className="text-right">
              {careerSort === "points" ? "Career Pts" : "Titles"}
            </div>
          </div>

          {(careerData ?? []).map((entry: any, idx: number) => {
            const pColor  = posColors[idx] ?? "rgba(255,255,255,0.45)";
            const isFirst = idx === 0;
            return (
              <Link key={entry.playerId} href={`/players/${entry.playerId}`} asChild>
                <div className={`lb-card-row grid items-center fade-in-up ${isFirst ? "lb-rank-1" : idx === 1 ? "lb-rank-2" : idx === 2 ? "lb-rank-3" : ""}`}
                  style={{ gridTemplateColumns: "3rem 1fr 6rem 6rem 5rem 5rem 5rem", animationDelay: `${idx * 35}ms` }}>
                  <span className="font-black text-center leading-none"
                    style={{ fontFamily: "Oswald, sans-serif", fontSize: isFirst ? "1.8rem" : "1.4rem", color: pColor, textShadow: isFirst ? `0 0 18px ${pColor}` : undefined }}>
                    {entry.position}
                  </span>
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-black uppercase ${isFirst ? "shimmer-gold" : ""}`}
                        style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.05rem", color: isFirst ? undefined : "rgba(255,255,255,0.9)" }}>
                        {entry.playerName}
                      </span>
                      {entry.titles > 0 && (
                        <span className="text-sm" title={`${entry.titles} season title${entry.titles > 1 ? "s" : ""}`}>
                          {"🏆".repeat(Math.min(entry.titles, 3))}
                        </span>
                      )}
                    </div>
                    {entry.title && (
                      <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.25)", fontStyle: "italic" }}>{entry.title}</div>
                    )}
                  </div>
                  <div className="text-center font-mono font-bold text-sm">
                    <span style={{ color: "#22c55e" }}>{entry.careerWins}</span>
                    <span style={{ color: "rgba(255,255,255,0.2)" }}>-</span>
                    <span style={{ color: "#ff005c" }}>{entry.careerLosses}</span>
                  </div>
                  <div className="text-center font-bold text-sm tabular-nums"
                    style={{ color: entry.winRate >= 65 ? "#22c55e" : entry.winRate >= 50 ? "rgba(255,255,255,0.7)" : "#ff005c" }}>
                    {entry.winRate}%
                  </div>
                  <div className="text-right font-mono font-bold text-sm tabular-nums" style={{ color: "#0066ff", textShadow: "0 0 8px rgba(0,102,255,0.4)" }}>
                    {entry.elo}
                  </div>
                  <div className="text-right font-mono text-sm tabular-nums" style={{ color: "rgba(0,102,255,0.55)" }}>
                    {entry.peakElo}
                  </div>
                  <div className="text-right font-black"
                    style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", color: isFirst ? "#ffd24a" : "rgba(255,255,255,0.7)" }}>
                    {careerSort === "points" ? `${entry.careerPoints}` : entry.titles > 0 ? `🏆×${entry.titles}` : "—"}
                  </div>
                </div>
              </Link>
            );
          })}

          {(!careerData || careerData.length === 0) && (
            <div className="pdc-card px-6 py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No career data yet.
            </div>
          )}
        </div>
      )}

      {/* Career legend */}
      {mode === "career" && (
        <div className="flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
          <span>🏆 Season Champion</span>
          <span>·</span>
          <span>Win % = career win rate across all seasons</span>
          <span>·</span>
          <span>Career Pts = cumulative points earned</span>
        </div>
      )}
    </div>
  );
}
