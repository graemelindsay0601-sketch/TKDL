import { useGetLeaderboard } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Skull, Flame, Trophy, Zap } from "lucide-react";
import { useState } from "react";

type Mode = "season" | "career";

const CAREER_SORTS = [
  { key: "wins",    label: "Career Wins"   },
  { key: "winRate", label: "Win Rate"       },
  { key: "elo",     label: "ELO Rating"     },
  { key: "peakElo", label: "Peak ELO"       },
  { key: "points",  label: "Career Pts"     },
] as const;

const TIER_BORDER: Record<string, string> = {
  Diamond:  "#00d4ff",
  Platinum: "#e879f9",
  Gold:     "#ffd24a",
  Silver:   "#c0c8d8",
  Bronze:   "#cd7f32",
};

const POD_COLORS = ["#ffd24a", "#c0c8d8", "#cd7f32"];
const POD_LABELS = ["CHAMPION", "RUNNER-UP", "3RD PLACE"];

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
    <div className="flex items-center gap-2">
      <span className="font-mono font-bold text-sm tabular-nums" style={{ color, minWidth: "2.8rem", textAlign: "right" }}>{elo}</span>
      <div className="w-14 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function PodiumCard({ entry, idx, maxElo }: { entry: any; idx: number; maxElo: number }) {
  const color = POD_COLORS[idx];
  const label = POD_LABELS[idx];
  const streak = (entry as any).currentStreak ?? 0;
  const eloColor = entry.elo >= 1200 ? "#ffd24a" : entry.elo >= 1100 ? "#22c55e" : "#0066ff";

  return (
    <Link href={`/players/${entry.playerId}`} asChild>
      <div className="relative overflow-hidden rounded-2xl cursor-pointer group transition-all duration-200 hover:scale-[1.01]"
        style={{
          background: `linear-gradient(135deg, ${color}0D 0%, rgba(9,9,15,0.97) 60%, ${color}05 100%)`,
          border: `1px solid ${color}40`,
          boxShadow: `0 0 40px ${color}12, inset 0 1px 0 ${color}20`,
          padding: idx === 0 ? "1.5rem 1.75rem" : "1.25rem 1.5rem",
        }}>

        {/* Rank watermark */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 font-black pointer-events-none select-none"
          style={{ fontFamily: "Oswald, sans-serif", fontSize: idx === 0 ? "9rem" : "7rem", lineHeight: 1, color: `${color}06`, zIndex: 0 }}>
          {idx + 1}
        </div>

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.18em] mb-1.5"
              style={{ fontFamily: "Oswald, sans-serif", color: `${color}AA`, fontSize: "0.58rem" }}>
              {label}
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-black uppercase leading-none"
                style={{ fontFamily: "Oswald, sans-serif", fontSize: idx === 0 ? "2.6rem" : "2rem", letterSpacing: "0.04em", color: "#fff" }}>
                {entry.playerName}
              </span>
              {streak >= 3 && (
                <span className="flex items-center gap-1 text-sm font-bold" style={{ color: "#ff005c" }}>
                  <Flame className="w-4 h-4 streak-fire" />{streak}W
                </span>
              )}
              {(entry as any).title && (
                <span className="text-xs" style={{ color: "rgba(255,210,74,0.55)", fontStyle: "italic" }}>
                  "{(entry as any).title}"
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <TierBadge tier={entry.tier} />
              <span className="font-mono text-sm">
                <span style={{ color: "#22c55e" }}>{entry.wins}</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>W · </span>
                <span style={{ color: "#ff005c" }}>{entry.losses}</span>
                <span style={{ color: "rgba(255,255,255,0.2)" }}>L</span>
              </span>
              <span className="font-mono text-sm" style={{ color: eloColor }}>
                <Zap className="w-3 h-3 inline mr-0.5" style={{ verticalAlign: "middle" }} />
                {entry.elo} ELO
              </span>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="font-black leading-none tabular-nums"
              style={{ fontFamily: "Oswald, sans-serif", fontSize: idx === 0 ? "4rem" : "3rem", color, textShadow: `0 0 30px ${color}60` }}>
              {entry.points}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
              POINTS
            </div>
          </div>
        </div>

        {/* Bottom glow line */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}50, transparent)` }} />
      </div>
    </Link>
  );
}

function LeaderRow({ entry, idx, maxElo }: { entry: any; idx: number; maxElo: number }) {
  const rank = idx + 4;
  const tierColor = TIER_BORDER[entry.tier] ?? "rgba(255,255,255,0.15)";
  const streak = (entry as any).currentStreak ?? 0;

  return (
    <Link href={`/players/${entry.playerId}`} asChild>
      <div className="relative group flex items-center gap-4 cursor-pointer rounded-xl transition-all duration-150 hover:bg-white/[0.03]"
        style={{ padding: "0.875rem 1.25rem", borderLeft: `3px solid ${tierColor}60`, background: "rgba(255,255,255,0.018)" }}>

        <div className="w-8 text-center shrink-0">
          <span className="font-black leading-none text-base" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)" }}>{rank}</span>
          <RankChange change={entry.positionChange} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black uppercase text-base" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em", color: "rgba(255,255,255,0.88)" }}>
              {entry.playerName}
            </span>
            {streak >= 3 && (
              <span className="flex items-center gap-0.5 text-xs font-bold shrink-0" style={{ color: "#ff005c" }}>
                <Flame className="w-3 h-3 streak-fire" />{streak}W
              </span>
            )}
          </div>
          {(entry as any).title && (
            <div className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.22)", fontStyle: "italic" }}>
              {(entry as any).title}
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center"><TierBadge tier={entry.tier} /></div>

        <div className="hidden md:block font-mono text-sm text-center" style={{ minWidth: "4rem" }}>
          <span style={{ color: "#22c55e" }}>{entry.wins}</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>-</span>
          <span style={{ color: "#ff005c" }}>{entry.losses}</span>
        </div>

        <div className="hidden sm:block" style={{ minWidth: "7rem" }}>
          <EloBar elo={entry.elo} maxElo={maxElo} />
        </div>

        <div className="shrink-0 text-right" style={{ minWidth: "4rem" }}>
          <span className="font-black text-xl tabular-nums leading-none"
            style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>
            {entry.points}
          </span>
          <span className="text-xs ml-1" style={{ color: "rgba(255,255,255,0.18)" }}>pts</span>
        </div>
      </div>
    </Link>
  );
}

function CareerRow({ entry, idx, maxElo, sortKey }: { entry: any; idx: number; maxElo: number; sortKey: string }) {
  const posColors = ["#ffd24a", "#c0c8d8", "#cd7f32"];
  const pColor = posColors[idx] ?? "rgba(255,255,255,0.4)";
  const isTop = idx < 3;
  const eloColor = entry.elo >= 1200 ? "#ffd24a" : entry.elo >= 1100 ? "#22c55e" : "#0066ff";
  const netPts = entry.careerPoints ?? 0;

  return (
    <Link href={`/players/${entry.playerId}`} asChild>
      <div className={`relative flex items-center gap-4 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.03] fade-in-up ${isTop ? "" : ""}`}
        style={{
          padding: "0.875rem 1.25rem",
          background: isTop ? `linear-gradient(90deg, ${pColor}08, transparent)` : "rgba(255,255,255,0.018)",
          borderLeft: `3px solid ${isTop ? pColor + "70" : "rgba(255,255,255,0.08)"}`,
          animationDelay: `${idx * 35}ms`,
        }}>

        <div className="w-8 text-center shrink-0">
          <span className="font-black leading-none"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: isTop ? "1.6rem" : "1.1rem", color: pColor, textShadow: isTop ? `0 0 16px ${pColor}` : undefined }}>
            {entry.position}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-black uppercase text-base truncate"
              style={{ fontFamily: "Oswald, sans-serif", color: isTop ? "#fff" : "rgba(255,255,255,0.85)" }}>
              {entry.playerName}
            </span>
            {entry.titles > 0 && (
              <span className="text-sm shrink-0" title={`${entry.titles} title${entry.titles > 1 ? "s" : ""}`}>
                {"🏆".repeat(Math.min(entry.titles, 3))}
              </span>
            )}
          </div>
          {entry.title && (
            <div className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.22)", fontStyle: "italic" }}>{entry.title}</div>
          )}
        </div>

        <div className="hidden md:block font-mono text-sm text-center" style={{ minWidth: "4.5rem" }}>
          <span style={{ color: "#22c55e" }}>{entry.careerWins}</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>-</span>
          <span style={{ color: "#ff005c" }}>{entry.careerLosses}</span>
        </div>

        <div className="hidden md:block text-sm font-bold text-center tabular-nums" style={{ minWidth: "3.5rem", color: entry.winRate >= 60 ? "#22c55e" : entry.winRate >= 45 ? "rgba(255,255,255,0.6)" : "#ff005c" }}>
          {entry.winRate}%
        </div>

        <div className="hidden sm:block" style={{ minWidth: "7rem" }}>
          <EloBar elo={entry.elo} maxElo={maxElo} />
        </div>

        <div className="hidden md:block font-mono text-sm tabular-nums text-right" style={{ minWidth: "4rem", color: "rgba(0,102,255,0.5)" }}>
          {entry.peakElo}
        </div>

        <div className="shrink-0 text-right" style={{ minWidth: "4.5rem" }}>
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
  const { data: careerData, isLoading: careerLoading } = useQuery({
    queryKey: ["leaderboard-career", careerSort],
    queryFn: () => fetch(`/api/leaderboard/career?sortBy=${careerSort}`).then(r => r.json()),
    enabled: mode === "career",
  });

  const isLoading = mode === "season" ? seasonLoading : careerLoading;
  const active     = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const eliminated = leaderboard?.filter(e => e.status === "ELIMINATED") ?? [];
  const top3       = active.slice(0, 3);
  const rest       = active.slice(3);
  const maxElo     = Math.max(...(leaderboard ?? []).map(e => e.elo), 1100);
  const careerRows = careerData ?? [];
  const maxCareerElo = Math.max(...careerRows.map((e: any) => e.elo), 1100);

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />

      <div className="flex items-end justify-between flex-wrap gap-4">
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
          <div className="text-right text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>
            <div style={{ color: "rgba(255,255,255,0.4)" }}>{active.length} active</div>
            {eliminated.length > 0 && <div style={{ color: "#ff005c" }}>☠ {eliminated.length} eliminated</div>}
          </div>
        )}
      </div>

      {/* Mode tabs */}
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

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : mode === "season" ? (
        <div className="space-y-3">
          {/* Podium — top 3 */}
          {top3.length > 0 && (
            <div className="space-y-2">
              {top3.map((entry, idx) => (
                <PodiumCard key={entry.playerId} entry={entry} idx={idx} maxElo={maxElo} />
              ))}
            </div>
          )}

          {/* Divider */}
          {rest.length > 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.15)", letterSpacing: "0.18em" }}>
                The Field
              </span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
          )}

          {/* Positions 4+ */}
          <div className="space-y-1.5">
            {rest.map((entry, idx) => (
              <LeaderRow key={entry.playerId} entry={entry} idx={idx} maxElo={maxElo} />
            ))}
          </div>

          {active.length === 0 && (
            <div className="pdc-card px-6 py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No players yet.</div>
          )}

          {/* Eliminated section */}
          {eliminated.length > 0 && (
            <div className="mt-6 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest px-5 py-3 rounded-2xl"
                style={{ background: "rgba(255,0,92,0.07)", border: "1px solid rgba(255,0,92,0.15)", color: "rgba(255,0,92,0.8)", fontFamily: "Oswald, sans-serif" }}>
                <Skull className="w-3.5 h-3.5" style={{ filter: "drop-shadow(0 0 4px rgba(255,0,92,0.7))" }} />
                Eliminated — Season Over
              </div>
              {eliminated.map(entry => (
                <Link key={entry.playerId} href={`/players/${entry.playerId}`} asChild>
                  <div className="flex items-center gap-4 rounded-xl cursor-pointer transition-all hover:bg-white/[0.02]"
                    style={{ padding: "0.75rem 1.25rem", background: "rgba(255,0,92,0.03)", borderLeft: "3px solid rgba(255,0,92,0.2)" }}>
                    <div className="w-8 text-center text-lg" style={{ color: "#ff005c" }}>☠</div>
                    <div className="flex-1">
                      <span className="font-black uppercase text-sm line-through" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,100,100,0.55)" }}>
                        {entry.playerName}
                      </span>
                    </div>
                    <TierBadge tier={entry.tier} />
                    <span className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>{entry.wins}-{entry.losses}</span>
                    <span className="font-mono text-sm" style={{ color: "rgba(0,102,255,0.25)" }}>{entry.elo}</span>
                    <span className="font-black text-lg" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.35)" }}>0 pts</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── ALL TIME VIEW ── */
        <div className="space-y-1.5">
          <div className="grid text-xs uppercase tracking-widest font-bold px-5 py-2.5 rounded-xl mb-2"
            style={{ gridTemplateColumns: "2.5rem 1fr 5rem 4rem 8rem 4.5rem 5rem", color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", background: "rgba(255,255,255,0.02)", letterSpacing: "0.1em" }}>
            <div className="text-center">#</div>
            <div>Player</div>
            <div className="hidden md:block text-center">W–L</div>
            <div className="hidden md:block text-center">Win%</div>
            <div className="hidden sm:block">ELO</div>
            <div className="hidden md:block text-right">Peak</div>
            <div className="text-right">{careerSort === "points" ? "Net Pts" : "Titles"}</div>
          </div>

          {careerRows.map((entry: any, idx: number) => (
            <CareerRow key={entry.playerId} entry={entry} idx={idx} maxElo={maxCareerElo} sortKey={careerSort} />
          ))}

          {careerRows.length === 0 && (
            <div className="pdc-card px-6 py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No career data yet.</div>
          )}

          <div className="pt-3 flex items-center gap-4 text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>
            <span>🏆 Season champion</span>
            <span>·</span>
            <span>Net Pts = total points won minus lost (May & June seasons)</span>
          </div>
        </div>
      )}
    </div>
  );
}
