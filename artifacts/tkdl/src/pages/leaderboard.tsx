import { useGetLeaderboard } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Skull, Flame, Zap } from "lucide-react";
import { useState } from "react";

type Mode = "season" | "career";

const CAREER_SORTS = [
  { key: "wins",    label: "Career Wins"  },
  { key: "winRate", label: "Win Rate"     },
  { key: "elo",     label: "ELO Rating"   },
  { key: "peakElo", label: "Peak ELO"     },
  { key: "points",  label: "Career Pts"   },
] as const;

const TIER_BORDER: Record<string, string> = {
  Diamond:  "#00d4ff",
  Platinum: "#e879f9",
  Gold:     "#ffd24a",
  Silver:   "#c0c8d8",
  Bronze:   "#cd7f32",
};

const POS_COLORS = ["#ffd24a", "#c0c8d8", "#cd7f32"];
const POS_MEDALS = ["🥇", "🥈", "🥉"];

function Tab({ active, onClick, color = "#ff005c", children }: {
  active: boolean; onClick: () => void; color?: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 rounded-xl text-xs font-black uppercase transition-all"
      style={{
        fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em",
        background: active ? `${color}20` : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? `${color}55` : "rgba(255,255,255,0.07)"}`,
        color: active ? color : "rgba(255,255,255,0.3)",
        boxShadow: active ? `0 0 16px ${color}20` : undefined,
      }}>
      {children}
    </button>
  );
}

function SortBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all"
      style={{
        fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em",
        background: active ? "rgba(255,210,74,0.15)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${active ? "rgba(255,210,74,0.4)" : "rgba(255,255,255,0.06)"}`,
        color: active ? "#ffd24a" : "rgba(255,255,255,0.3)",
      }}>
      {children}
    </button>
  );
}

function EloBar({ elo, maxElo }: { elo: number; maxElo: number }) {
  const pct = Math.max(5, Math.min(100, ((elo - 800) / (maxElo - 800 + 50)) * 100));
  const color = elo >= 1200 ? "#ffd24a" : elo >= 1100 ? "#22c55e" : elo >= 1000 ? "#0066ff" : "#ff005c";
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono font-bold text-sm tabular-nums hidden sm:block"
        style={{ color, minWidth: "2.8rem", textAlign: "right" }}>{elo}</span>
      <div className="w-12 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function SeasonRow({ entry, idx, maxElo }: { entry: any; idx: number; maxElo: number }) {
  const isTop3  = idx < 3;
  const pColor  = POS_COLORS[idx] ?? "rgba(255,255,255,0.4)";
  const tierColor = TIER_BORDER[entry.tier] ?? "rgba(255,255,255,0.12)";
  const streak  = (entry as any).currentStreak ?? 0;

  return (
    <Link href={`/players/${entry.playerId}`} asChild>
      <div className="group flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.035] fade-in-up"
        style={{
          padding: "0.8rem 1.1rem",
          background: isTop3 ? `linear-gradient(90deg, ${pColor}07, transparent 60%)` : "rgba(255,255,255,0.018)",
          borderLeft: `3px solid ${isTop3 ? pColor + "55" : tierColor + "55"}`,
          animationDelay: `${idx * 35}ms`,
        }}>

        {/* Rank */}
        <div className="w-8 flex flex-col items-center shrink-0 gap-0.5">
          <span className="font-black leading-none"
            style={{
              fontFamily: "Oswald, sans-serif",
              fontSize: idx === 0 ? "2rem" : isTop3 ? "1.6rem" : "1.2rem",
              color: pColor,
              textShadow: isTop3 ? `0 0 16px ${pColor}60` : undefined,
            }}>
            {entry.position}
          </span>
          <RankChange change={entry.positionChange} />
        </div>

        {/* Name + title */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black uppercase leading-tight"
              style={{
                fontFamily: "Oswald, sans-serif",
                fontSize: idx === 0 ? "1.2rem" : "1rem",
                letterSpacing: "0.04em",
                color: idx === 0 ? "#fff" : "rgba(255,255,255,0.85)",
              }}>
              {entry.playerName}
            </span>
            {isTop3 && <span className="text-base leading-none">{POS_MEDALS[idx]}</span>}
            {streak >= 3 && (
              <span className="flex items-center gap-0.5 text-xs font-bold shrink-0" style={{ color: "#ff005c" }}>
                <Flame className="w-3 h-3 streak-fire" />{streak}W
              </span>
            )}
          </div>
          {(entry as any).title && (
            <div className="text-xs truncate" style={{ color: "rgba(255,210,74,0.5)", fontStyle: "italic", lineHeight: 1.3 }}>
              {(entry as any).title}
            </div>
          )}
        </div>

        {/* Tier badge */}
        <div className="hidden sm:flex shrink-0"><TierBadge tier={entry.tier} /></div>

        {/* Record */}
        <div className="hidden md:block font-mono text-sm text-center shrink-0" style={{ minWidth: "4rem" }}>
          <span style={{ color: "#22c55e" }}>{entry.wins}</span>
          <span style={{ color: "rgba(255,255,255,0.18)" }}>-</span>
          <span style={{ color: "#ff005c" }}>{entry.losses}</span>
        </div>

        {/* ELO bar */}
        <div className="hidden sm:block shrink-0"><EloBar elo={entry.elo} maxElo={maxElo} /></div>

        {/* Points */}
        <div className="text-right shrink-0" style={{ minWidth: "3.5rem" }}>
          <span className="font-black tabular-nums leading-none"
            style={{
              fontFamily: "Oswald, sans-serif",
              fontSize: idx === 0 ? "2rem" : isTop3 ? "1.7rem" : "1.5rem",
              color: idx === 0 ? "#ffd24a" : "#ff005c",
              textShadow: idx === 0 ? "0 0 16px rgba(255,210,74,0.4)" : undefined,
            }}>
            {entry.points}
          </span>
          <span className="text-xs ml-0.5" style={{ color: "rgba(255,255,255,0.18)" }}>pts</span>
        </div>
      </div>
    </Link>
  );
}

function CareerRow({ entry, idx, maxElo, sortKey }: { entry: any; idx: number; maxElo: number; sortKey: string }) {
  const isTop3  = idx < 3;
  const pColor  = POS_COLORS[idx] ?? "rgba(255,255,255,0.4)";
  const netPts  = entry.careerPoints ?? 0;

  return (
    <Link href={`/players/${entry.playerId}`} asChild>
      <div className="group flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.035] fade-in-up"
        style={{
          padding: "0.8rem 1.1rem",
          background: isTop3 ? `linear-gradient(90deg, ${pColor}07, transparent 60%)` : "rgba(255,255,255,0.018)",
          borderLeft: `3px solid ${isTop3 ? pColor + "55" : "rgba(255,255,255,0.08)"}`,
          animationDelay: `${idx * 35}ms`,
        }}>

        <div className="w-8 text-center shrink-0">
          <span className="font-black leading-none"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: isTop3 ? "1.6rem" : "1.2rem", color: pColor, textShadow: isTop3 ? `0 0 16px ${pColor}50` : undefined }}>
            {entry.position}
          </span>
        </div>

        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="font-black uppercase text-base truncate"
              style={{ fontFamily: "Oswald, sans-serif", color: isTop3 ? "#fff" : "rgba(255,255,255,0.82)" }}>
              {entry.playerName}
            </span>
            {entry.titles > 0 && (
              <span className="text-sm shrink-0" title={`${entry.titles} season title(s)`}>
                {"🏆".repeat(Math.min(entry.titles, 3))}
              </span>
            )}
          </div>
          {entry.title && (
            <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.22)", fontStyle: "italic" }}>{entry.title}</div>
          )}
        </div>

        <div className="hidden md:block font-mono text-sm text-center shrink-0" style={{ minWidth: "4.5rem" }}>
          <span style={{ color: "#22c55e" }}>{entry.careerWins}</span>
          <span style={{ color: "rgba(255,255,255,0.18)" }}>-</span>
          <span style={{ color: "#ff005c" }}>{entry.careerLosses}</span>
        </div>

        <div className="hidden md:block text-sm font-bold tabular-nums text-right shrink-0" style={{ minWidth: "3.5rem", color: entry.winRate >= 60 ? "#22c55e" : entry.winRate >= 45 ? "rgba(255,255,255,0.55)" : "#ff005c" }}>
          {entry.winRate}%
        </div>

        <div className="hidden sm:block shrink-0"><EloBar elo={entry.elo} maxElo={maxElo} /></div>

        <div className="hidden md:block font-mono text-sm tabular-nums text-right shrink-0"
          style={{ minWidth: "3.5rem", color: "rgba(0,102,255,0.5)" }}>
          {entry.peakElo}
        </div>

        <div className="text-right shrink-0" style={{ minWidth: "4rem" }}>
          {sortKey === "points" ? (
            <span className="font-black text-lg tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: netPts >= 0 ? "#22c55e" : "#ff005c" }}>
              {netPts > 0 ? "+" : ""}{netPts}
            </span>
          ) : entry.titles > 0 ? (
            <span style={{ color: "#ffd24a", fontSize: "1.1rem" }}>🏆×{entry.titles}</span>
          ) : (
            <span style={{ color: "rgba(255,255,255,0.2)" }}>—</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function Leaderboard() {
  const [mode, setMode]       = useState<Mode>("season");
  const [careerSort, setSort] = useState<string>("wins");

  const { data: leaderboard, isLoading: seasonLoading } = useGetLeaderboard();
  const { data: careerData,  isLoading: careerLoading  } = useQuery({
    queryKey: ["leaderboard-career", careerSort],
    queryFn:  () => fetch(`/api/leaderboard/career?sortBy=${careerSort}`).then(r => r.json()),
    enabled:  mode === "career",
  });

  const isLoading  = mode === "season" ? seasonLoading : careerLoading;
  const active     = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const eliminated = leaderboard?.filter(e => e.status === "ELIMINATED") ?? [];
  const maxElo     = Math.max(...(leaderboard ?? []).map(e => e.elo), 1100);
  const careerRows = (careerData ?? []) as any[];
  const maxCarElo  = Math.max(...careerRows.map(e => e.elo), 1100);

  return (
    <div className="space-y-5">
      <div className="pdc-divider" />

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-black uppercase"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "3rem", letterSpacing: "0.04em", textShadow: "0 0 30px rgba(255,0,92,0.2)", lineHeight: 1 }}>
            {mode === "season" ? "Season Standings" : "All-Time Records"}
          </h1>
          <p className="text-sm mt-1.5 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
            {mode === "season"
              ? <><span className="live-dot" /> Ranked by points · ELO tiebreak</>
              : <>Career statistics across all seasons</>}
          </p>
        </div>
        {mode === "season" && active.length > 0 && (
          <div className="text-xs font-bold text-right" style={{ fontFamily: "Oswald, sans-serif" }}>
            <div style={{ color: "rgba(255,255,255,0.35)" }}>{active.length} active</div>
            {eliminated.length > 0 && <div style={{ color: "#ff005c" }}>☠ {eliminated.length} eliminated</div>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Tab active={mode === "season"} onClick={() => setMode("season")}>🏆 Season</Tab>
        <Tab active={mode === "career"} onClick={() => setMode("career")} color="#0066ff">📊 All Time</Tab>
        {mode === "career" && (
          <>
            <div className="w-px h-5 mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />
            {CAREER_SORTS.map(s => (
              <SortBtn key={s.key} active={careerSort === s.key} onClick={() => setSort(s.key)}>{s.label}</SortBtn>
            ))}
          </>
        )}
      </div>

      {/* Column headers */}
      {!isLoading && mode === "season" && (
        <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: "0.12em" }}>
          <div className="w-8 text-center">#</div>
          <div className="flex-1">Player</div>
          <div className="hidden sm:block" style={{ minWidth: "3.5rem" }}>Tier</div>
          <div className="hidden md:block text-center" style={{ minWidth: "4rem" }}>W-L</div>
          <div className="hidden sm:block" style={{ minWidth: "7rem" }}>ELO</div>
          <div className="text-right" style={{ minWidth: "3.5rem" }}>Pts</div>
        </div>
      )}
      {!isLoading && mode === "career" && (
        <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: "0.12em" }}>
          <div className="w-8 text-center">#</div>
          <div className="flex-1">Player</div>
          <div className="hidden md:block text-center" style={{ minWidth: "4.5rem" }}>W-L</div>
          <div className="hidden md:block text-right" style={{ minWidth: "3.5rem" }}>Win%</div>
          <div className="hidden sm:block" style={{ minWidth: "7rem" }}>ELO</div>
          <div className="hidden md:block text-right" style={{ minWidth: "3.5rem" }}>Peak</div>
          <div className="text-right" style={{ minWidth: "4rem" }}>{careerSort === "points" ? "Net Pts" : "Titles"}</div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : mode === "season" ? (
        <div className="space-y-1.5">
          {active.map((entry, idx) => (
            <SeasonRow key={entry.playerId} entry={entry} idx={idx} maxElo={maxElo} />
          ))}

          {active.length === 0 && (
            <div className="pdc-card px-6 py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No players yet.</div>
          )}

          {/* Eliminated */}
          {eliminated.length > 0 && (
            <div className="mt-5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl"
                style={{ background: "rgba(255,0,92,0.07)", border: "1px solid rgba(255,0,92,0.14)", color: "rgba(255,0,92,0.75)", fontFamily: "Oswald, sans-serif" }}>
                <Skull className="w-3.5 h-3.5" style={{ filter: "drop-shadow(0 0 4px rgba(255,0,92,0.7))" }} />
                Eliminated · Season over
              </div>
              {eliminated.map(entry => (
                <Link key={entry.playerId} href={`/players/${entry.playerId}`} asChild>
                  <div className="flex items-center gap-3 rounded-xl cursor-pointer transition-all hover:bg-white/[0.02]"
                    style={{ padding: "0.7rem 1.1rem", background: "rgba(255,0,92,0.03)", borderLeft: "3px solid rgba(255,0,92,0.18)" }}>
                    <div className="w-8 text-center text-lg" style={{ color: "#ff005c" }}>☠</div>
                    <div className="flex-1">
                      <span className="font-black uppercase text-sm line-through"
                        style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,100,100,0.5)" }}>
                        {entry.playerName}
                      </span>
                    </div>
                    <div className="hidden sm:block"><TierBadge tier={entry.tier} /></div>
                    <span className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.18)" }}>{entry.wins}-{entry.losses}</span>
                    <span className="font-mono text-sm" style={{ color: "rgba(0,102,255,0.22)" }}>{entry.elo}</span>
                    <span className="font-black text-lg" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.3)" }}>0 pts</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* All Time */
        <div className="space-y-1.5">
          {careerRows.map((entry, idx) => (
            <CareerRow key={entry.playerId} entry={entry} idx={idx} maxElo={maxCarElo} sortKey={careerSort} />
          ))}
          {careerRows.length === 0 && (
            <div className="pdc-card px-6 py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No data.</div>
          )}
          <div className="pt-2 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
            🏆 Season champion · Net Pts = points gained minus points lost across all wager seasons
          </div>
        </div>
      )}
    </div>
  );
}
