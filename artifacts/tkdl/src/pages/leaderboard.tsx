import { useGetLeaderboard } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Skull, Flame, Trophy, Target, CircuitBoard, Star, Medal, Zap } from "lucide-react";
import { useState } from "react";

type Mode = "season" | "career" | "achievements" | "bot" | "tour" | "master501" | "records";

const CAREER_SORTS = [
  { key: "wins",    label: "Career Wins" },
  { key: "winRate", label: "Win Rate"    },
  { key: "elo",     label: "ELO Rating"  },
  { key: "peakElo", label: "Peak ELO"    },
  { key: "points",  label: "Career Pts"  },
] as const;

const TIER_BORDER: Record<string, string> = {
  Diamond: "#00d4ff", Platinum: "#e879f9", Gold: "#ffd24a", Silver: "#c0c8d8", Bronze: "#cd7f32",
};

function TierDot({ tier }: { tier: string }) {
  const color = TIER_BORDER[tier] ?? "rgba(255,255,255,0.2)";
  return (
    <div
      className="sm:hidden w-2.5 h-2.5 rounded-full shrink-0"
      title={tier}
      style={{ background: color, boxShadow: `0 0 5px ${color}80`, flexShrink: 0 }}
    />
  );
}
const POS_COLORS = ["#ffd24a", "#c0c8d8", "#cd7f32"];
const POS_MEDALS = ["🥇", "🥈", "🥉"];

const TIER_LABELS: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Pub",        color: "#60a5fa", emoji: "🍺" },
  2: { label: "Circuit",    color: "#34d399", emoji: "🎯" },
  3: { label: "County",     color: "#fbbf24", emoji: "🏅" },
  4: { label: "Pro",        color: "#f97316", emoji: "💎" },
  5: { label: "Elite",      color: "#a78bfa", emoji: "⭐" },
  6: { label: "Grand Prix", color: "#ff005c", emoji: "👑" },
};

const M501_TIERS: Record<number, { label: string; color: string; emoji: string }> = {
  1: { label: "Challenger",    color: "#94a3b8", emoji: "🎯" },
  2: { label: "Pro Circuit",   color: "#4ade80", emoji: "🏅" },
  3: { label: "Premier",       color: "#38bdf8", emoji: "💎" },
  4: { label: "Grand Prix",    color: "#ffd24a", emoji: "🏁" },
  5: { label: "World Champ",   color: "#ff005c", emoji: "👑" },
};

function Tab({ active, onClick, color = "#ff005c", icon, children }: {
  active: boolean; onClick: () => void; color?: string; icon?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase transition-all"
      style={{
        fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em",
        background: active ? `${color}20` : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? `${color}55` : "rgba(255,255,255,0.07)"}`,
        color: active ? color : "rgba(255,255,255,0.3)",
        boxShadow: active ? `0 0 16px ${color}20` : undefined,
      }}>
      {icon && <span className="opacity-90">{icon}</span>}
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

function Pos({ idx }: { idx: number }) {
  const col = POS_COLORS[idx] ?? "rgba(255,255,255,0.4)";
  return (
    <div className="w-8 flex flex-col items-center shrink-0 gap-0.5">
      <span className="font-black leading-none"
        style={{ fontFamily: "Oswald, sans-serif", fontSize: idx === 0 ? "2rem" : idx < 3 ? "1.6rem" : "1.2rem", color: col, textShadow: idx < 3 ? `0 0 16px ${col}60` : undefined }}>
        {idx + 1}
      </span>
    </div>
  );
}

function SeasonRow({ entry, idx, maxElo }: { entry: any; idx: number; maxElo: number }) {
  const isTop3 = idx < 3;
  const pColor = POS_COLORS[idx] ?? "rgba(255,255,255,0.4)";
  const tierColor = TIER_BORDER[entry.tier] ?? "rgba(255,255,255,0.12)";
  const streak = entry.currentStreak ?? 0;
  return (
    <Link href={`/players/${entry.playerId}`} asChild>
      <div className="group flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.035] fade-in-up"
        style={{ padding: "0.8rem 1.1rem", background: isTop3 ? `linear-gradient(90deg, ${pColor}07, transparent 60%)` : "rgba(255,255,255,0.018)", borderLeft: `3px solid ${isTop3 ? pColor + "55" : tierColor + "55"}`, animationDelay: `${idx * 35}ms` }}>
        <Pos idx={idx} />
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black uppercase leading-tight" style={{ fontFamily: "Oswald, sans-serif", fontSize: idx === 0 ? "1.2rem" : "1rem", letterSpacing: "0.04em", color: idx === 0 ? "#fff" : "rgba(255,255,255,0.85)" }}>{entry.playerName}</span>
            {isTop3 && <span className="text-base leading-none">{POS_MEDALS[idx]}</span>}
            {streak >= 3 && <span className="flex items-center gap-0.5 text-xs font-bold shrink-0" style={{ color: "#ff005c" }}><Flame className="w-3 h-3 streak-fire" />{streak}W</span>}
          </div>
          {entry.title && <div className="text-xs truncate" style={{ color: "rgba(255,210,74,0.5)", fontStyle: "italic", lineHeight: 1.3 }}>{entry.title}</div>}
        </div>
        <TierDot tier={entry.tier} />
        <div className="hidden sm:flex shrink-0"><TierBadge tier={entry.tier} /></div>
        <div className="hidden sm:block font-mono text-sm text-center shrink-0" style={{ minWidth: "4rem" }}>
          <span style={{ color: "#22c55e" }}>{entry.wins}</span><span style={{ color: "rgba(255,255,255,0.18)" }}>-</span><span style={{ color: "#ff005c" }}>{entry.losses}</span>
        </div>
        <div className="hidden sm:block shrink-0"><EloBar elo={entry.elo} maxElo={maxElo} /></div>
        <div className="text-right shrink-0" style={{ minWidth: "3.5rem" }}>
          <span className="font-black tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontSize: idx === 0 ? "2rem" : isTop3 ? "1.7rem" : "1.5rem", color: idx === 0 ? "#ffd24a" : "#ff005c", textShadow: idx === 0 ? "0 0 16px rgba(255,210,74,0.4)" : undefined }}>{entry.points}</span>
          <span className="text-xs ml-0.5" style={{ color: "rgba(255,255,255,0.18)" }}>pts</span>
        </div>
      </div>
    </Link>
  );
}

function CareerRow({ entry, idx, maxElo, sortKey }: { entry: any; idx: number; maxElo: number; sortKey: string }) {
  const isTop3 = idx < 3;
  const pColor = POS_COLORS[idx] ?? "rgba(255,255,255,0.4)";
  return (
    <Link href={`/players/${entry.playerId}`} asChild>
      <div className="group flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.035] fade-in-up"
        style={{ padding: "0.8rem 1.1rem", background: isTop3 ? `linear-gradient(90deg, ${pColor}07, transparent 60%)` : "rgba(255,255,255,0.018)", borderLeft: `3px solid ${isTop3 ? pColor + "55" : "rgba(255,255,255,0.08)"}`, animationDelay: `${idx * 35}ms` }}>
        <Pos idx={idx} />
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span className="font-black uppercase text-base truncate" style={{ fontFamily: "Oswald, sans-serif", color: isTop3 ? "#fff" : "rgba(255,255,255,0.82)" }}>{entry.playerName}</span>
            {entry.titles > 0 && <span className="text-sm shrink-0" title={`${entry.titles} title(s)`}>{"🏆".repeat(Math.min(entry.titles, 3))}</span>}
          </div>
          {entry.title && <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.22)", fontStyle: "italic" }}>{entry.title}</div>}
        </div>
        <div className="hidden sm:block font-mono text-sm text-center shrink-0" style={{ minWidth: "4.5rem" }}>
          <span style={{ color: "#22c55e" }}>{entry.careerWins}</span><span style={{ color: "rgba(255,255,255,0.18)" }}>-</span><span style={{ color: "#ff005c" }}>{entry.careerLosses}</span>
        </div>
        <div className="hidden sm:block text-sm font-bold tabular-nums text-right shrink-0" style={{ minWidth: "3.5rem", color: entry.winRate >= 60 ? "#22c55e" : entry.winRate >= 45 ? "rgba(255,255,255,0.55)" : "#ff005c" }}>{entry.winRate}%</div>
        <div className="hidden sm:block shrink-0"><EloBar elo={entry.elo} maxElo={maxElo} /></div>
        <div className="hidden lg:block font-mono text-sm tabular-nums text-right shrink-0" style={{ minWidth: "3.5rem", color: "rgba(0,102,255,0.5)" }}>{entry.peakElo}</div>
        <div className="text-right shrink-0" style={{ minWidth: "4rem" }}>
          {sortKey === "points" ? (
            <span className="font-black text-lg tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: entry.careerPoints >= 0 ? "#22c55e" : "#ff005c" }}>{entry.careerPoints > 0 ? "+" : ""}{entry.careerPoints}</span>
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

function AchievementsRow({ entry, idx }: { entry: any; idx: number }) {
  const isTop3 = idx < 3;
  const pColor = POS_COLORS[idx] ?? "rgba(255,255,255,0.4)";
  const gs = entry.totalGs as number;
  const gsColor = gs >= 500 ? "#a78bfa" : gs >= 200 ? "#ffd24a" : gs >= 100 ? "#0066ff" : "rgba(255,255,255,0.5)";
  return (
    <Link href={`/players/${entry.playerId}`} asChild>
      <div className="group flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.035] fade-in-up"
        style={{ padding: "0.8rem 1.1rem", background: isTop3 ? `linear-gradient(90deg, ${pColor}07, transparent 60%)` : "rgba(255,255,255,0.018)", borderLeft: `3px solid ${isTop3 ? pColor + "55" : "rgba(168,85,247,0.15)"}`, animationDelay: `${idx * 35}ms` }}>
        <Pos idx={idx} />
        <div className="flex-1 min-w-0 pr-2">
          <span className="font-black uppercase text-base" style={{ fontFamily: "Oswald, sans-serif", color: isTop3 ? "#fff" : "rgba(255,255,255,0.82)" }}>{entry.playerName}</span>
          <div className="flex items-center gap-3 mt-0.5 text-xs" style={{ color: "rgba(255,255,255,0.28)" }}>
            <span>🏆 League: <span style={{ color: "#ffd24a" }}>{entry.leagueCount}</span></span>
            <span>⭐ Tour: <span style={{ color: "#a78bfa" }}>{entry.tourCount}</span></span>
          </div>
        </div>
        <div className="hidden sm:block text-right shrink-0" style={{ minWidth: "5rem" }}>
          <div className="text-xs font-bold uppercase mb-0.5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>Achievements</div>
          <div className="font-black tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.4rem", color: "rgba(255,255,255,0.7)", lineHeight: 1 }}>{entry.totalCount}</div>
        </div>
        <div className="text-right shrink-0" style={{ minWidth: "5rem" }}>
          <div className="text-xs font-bold uppercase mb-0.5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>Gamerscore</div>
          <div className="font-black tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.5rem", color: gsColor, lineHeight: 1, textShadow: isTop3 ? `0 0 12px ${gsColor}60` : undefined }}>{gs.toLocaleString()}</div>
        </div>
      </div>
    </Link>
  );
}

function BotRow({ entry, idx, maxDarts }: { entry: any; idx: number; maxDarts: number }) {
  const isTop3 = idx < 3;
  const pColor = POS_COLORS[idx] ?? "rgba(255,255,255,0.4)";
  const pct = maxDarts > 0 ? Math.max(4, Math.round((entry.totalDarts / maxDarts) * 100)) : 4;
  const ckPct = entry.checkoutAttempts > 0 ? Math.round((entry.checkoutHits / entry.checkoutAttempts) * 100) : 0;
  return (
    <Link href={`/players/${entry.playerId}`} asChild>
      <div className="group flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.035] fade-in-up"
        style={{ padding: "0.8rem 1.1rem", background: isTop3 ? `linear-gradient(90deg, ${pColor}07, transparent 60%)` : "rgba(255,255,255,0.018)", borderLeft: `3px solid ${isTop3 ? pColor + "55" : "rgba(0,229,160,0.15)"}`, animationDelay: `${idx * 35}ms` }}>
        <Pos idx={idx} />
        <div className="flex-1 min-w-0 pr-2">
          <span className="font-black uppercase text-base" style={{ fontFamily: "Oswald, sans-serif", color: isTop3 ? "#fff" : "rgba(255,255,255,0.82)" }}>{entry.playerName}</span>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)", maxWidth: "8rem" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #00e5a0, #0066ff)" }} />
            </div>
            <span className="text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.3)" }}>{entry.totalDarts.toLocaleString()} darts</span>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-center shrink-0 gap-0.5" style={{ minWidth: "3.5rem" }}>
          <span className="font-black text-xl tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: "#00e5a0", lineHeight: 1 }}>{entry.totalSessions}</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>Sessions</span>
        </div>
        <div className="hidden sm:flex flex-col items-center shrink-0 gap-0.5" style={{ minWidth: "3rem" }}>
          <span className="font-black text-xl tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", lineHeight: 1 }}>{entry.total180s}</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>180s</span>
        </div>
        <div className="hidden md:flex flex-col items-center shrink-0 gap-0.5" style={{ minWidth: "3.5rem" }}>
          <span className="font-black text-xl tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", lineHeight: 1 }}>{ckPct}%</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>Checkout</span>
        </div>
        <div className="flex flex-col items-center shrink-0 gap-0.5" style={{ minWidth: "3rem" }}>
          <span className="font-black text-xl tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: "#0066ff", lineHeight: 1 }}>{entry.uniqueGames}</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>Formats</span>
        </div>
      </div>
    </Link>
  );
}

function TourRow({ entry, idx }: { entry: any; idx: number }) {
  const isTop3 = idx < 3;
  const pColor = POS_COLORS[idx] ?? "rgba(255,255,255,0.4)";
  const hasTrophies = entry.totalTrophies > 0;
  return (
    <Link href={`/players/${entry.playerId}`} asChild>
      <div className="group flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.035] fade-in-up"
        style={{ padding: "0.8rem 1.1rem", background: isTop3 && hasTrophies ? `linear-gradient(90deg, ${pColor}07, transparent 60%)` : "rgba(255,255,255,0.018)", borderLeft: `3px solid ${isTop3 && hasTrophies ? pColor + "55" : "rgba(255,210,74,0.1)"}`, animationDelay: `${idx * 35}ms` }}>
        <Pos idx={idx} />
        <div className="flex-1 min-w-0 pr-2">
          <span className="font-black uppercase text-base" style={{ fontFamily: "Oswald, sans-serif", color: isTop3 && hasTrophies ? "#fff" : "rgba(255,255,255,0.82)" }}>{entry.playerName}</span>
          {hasTrophies ? (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {[1,2,3,4,5,6].map(t => entry[`t${t}`] > 0 ? (
                <span key={t} className="text-xs px-1.5 py-0.5 rounded-md font-bold" style={{ background: `${TIER_LABELS[t].color}18`, color: TIER_LABELS[t].color, fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
                  {TIER_LABELS[t].emoji} T{t}×{entry[`t${t}`]}
                </span>
              ) : null)}
              {entry.eliteWins > 0 && <span className="text-xs px-1.5 py-0.5 rounded-md font-bold" style={{ background: "rgba(255,0,92,0.15)", color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>ELITE×{entry.eliteWins}</span>}
            </div>
          ) : (
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.18)", fontStyle: "italic" }}>No trophies yet</div>
          )}
        </div>
        <div className="hidden sm:flex flex-col items-center shrink-0 gap-0.5" style={{ minWidth: "4rem" }}>
          <span className="text-xs font-bold uppercase mb-0.5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>Tours</span>
          <span className="font-black tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", color: "rgba(255,255,255,0.4)", lineHeight: 1 }}>{entry.uniqueTours}</span>
        </div>
        <div className="text-right shrink-0" style={{ minWidth: "4rem" }}>
          <div className="text-xs font-bold uppercase mb-0.5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>Trophies</div>
          <span className="font-black tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: isTop3 && hasTrophies ? "2rem" : "1.6rem", color: hasTrophies ? (idx === 0 ? "#ffd24a" : "rgba(255,210,74,0.7)") : "rgba(255,255,255,0.12)", lineHeight: 1, textShadow: idx === 0 && hasTrophies ? "0 0 16px rgba(255,210,74,0.4)" : undefined }}>
            {entry.totalTrophies}
          </span>
        </div>
      </div>
    </Link>
  );
}

function M501Row({ entry, idx }: { entry: any; idx: number }) {
  const isTop3    = idx < 3;
  const pColor    = POS_COLORS[idx] ?? "rgba(255,255,255,0.4)";
  const tier      = Number(entry.tier ?? 1);
  const round     = Number(entry.round ?? 1);
  const meta      = M501_TIERS[tier] ?? M501_TIERS[1];
  const wins      = Number(entry.total_wins ?? 0);
  const losses    = Number(entry.total_losses ?? 0);
  const bestAvg   = Number(entry.best_avg ?? 0);
  const total180s = Number(entry.total_180s ?? 0);
  const coHits    = Number(entry.co_hits ?? 0);
  const coAttempts= Number(entry.co_attempts ?? 0);
  const coPct     = coAttempts > 0 ? Math.round((coHits / coAttempts) * 100) : 0;
  const hasPlayed = wins + losses > 0;
  return (
    <Link href={`/players/${entry.id}`} asChild>
      <div className="group flex items-center gap-3 rounded-xl cursor-pointer transition-all duration-150 hover:bg-white/[0.035] fade-in-up"
        style={{ padding: "0.8rem 1.1rem", background: isTop3 && hasPlayed ? `linear-gradient(90deg, ${pColor}07, transparent 60%)` : "rgba(255,255,255,0.018)", borderLeft: `3px solid ${isTop3 && hasPlayed ? pColor + "55" : meta.color + "20"}`, animationDelay: `${idx * 35}ms` }}>
        <Pos idx={idx} />
        <div className="flex-1 min-w-0 pr-2">
          <span className="font-black uppercase text-base" style={{ fontFamily: "Oswald, sans-serif", color: isTop3 && hasPlayed ? "#fff" : "rgba(255,255,255,0.82)" }}>{entry.name}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs px-1.5 py-0.5 rounded-md font-black uppercase"
              style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}33`, fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", fontSize: "0.6rem" }}>
              {meta.emoji} {meta.label}
            </span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>Rd {round}</span>
          </div>
        </div>
        <div className="hidden sm:block font-mono text-sm text-center shrink-0" style={{ minWidth: "4rem" }}>
          <span style={{ color: "#22c55e" }}>{wins}</span><span style={{ color: "rgba(255,255,255,0.18)" }}>-</span><span style={{ color: "#ff005c" }}>{losses}</span>
        </div>
        <div className="hidden sm:flex flex-col items-center shrink-0 gap-0.5" style={{ minWidth: "3.5rem" }}>
          <span className="font-black text-base tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: bestAvg >= 90 ? "#ffd24a" : bestAvg >= 80 ? "#22c55e" : "rgba(255,255,255,0.45)", lineHeight: 1 }}>
            {bestAvg > 0 ? bestAvg.toFixed(1) : "—"}
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>Avg</span>
        </div>
        <div className="hidden sm:flex flex-col items-center shrink-0 gap-0.5" style={{ minWidth: "2.5rem" }}>
          <span className="font-black text-base tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", lineHeight: 1 }}>{total180s}</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>180s</span>
        </div>
        <div className="hidden md:flex flex-col items-center shrink-0 gap-0.5" style={{ minWidth: "3rem" }}>
          <span className="font-black text-base tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: coPct >= 50 ? "#00c8a0" : "rgba(255,255,255,0.4)", lineHeight: 1 }}>
            {coAttempts > 0 ? `${coPct}%` : "—"}
          </span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>CO%</span>
        </div>
      </div>
    </Link>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
    </div>
  );
}

export default function Standings() {
  const [mode, setMode]       = useState<Mode>("season");
  const [careerSort, setSort] = useState<string>("wins");

  const { data: leaderboard,   isLoading: seasonLoading }  = useGetLeaderboard();
  const { data: careerData,    isLoading: careerLoading }   = useQuery({
    queryKey: ["leaderboard-career", careerSort],
    queryFn:  () => fetch(`/api/leaderboard/career?sortBy=${careerSort}`).then(r => r.json()),
    enabled:  mode === "career",
  });
  const { data: achData,       isLoading: achLoading }      = useQuery({
    queryKey: ["leaderboard-achievements"],
    queryFn:  () => fetch("/api/leaderboard/achievements").then(r => r.json()),
    enabled:  mode === "achievements",
  });
  const { data: botData,       isLoading: botLoading }      = useQuery({
    queryKey: ["leaderboard-bot"],
    queryFn:  () => fetch("/api/leaderboard/bot").then(r => r.json()),
    enabled:  mode === "bot",
  });
  const { data: tourData,      isLoading: tourLoading }     = useQuery({
    queryKey: ["leaderboard-tour"],
    queryFn:  () => fetch("/api/leaderboard/tour").then(r => r.json()),
    enabled:  mode === "tour",
  });
  const { data: m501Data,      isLoading: m501Loading }     = useQuery({
    queryKey: ["leaderboard-master501"],
    queryFn:  () => fetch("/api/master501/leaderboard").then(r => r.json()),
    enabled:  mode === "master501",
  });
  const { data: recordsData,   isLoading: recordsLoading }  = useQuery({
    queryKey: ["leaderboard-records"],
    queryFn:  () => fetch("/api/stats/checkout-records").then(r => r.json()),
    enabled:  mode === "records",
  });

  const isLoading = { season: seasonLoading, career: careerLoading, achievements: achLoading, bot: botLoading, tour: tourLoading, master501: m501Loading, records: recordsLoading }[mode];

  const active     = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const eliminated = leaderboard?.filter(e => e.status === "ELIMINATED") ?? [];
  const maxElo     = Math.max(...(leaderboard ?? []).map(e => e.elo), 1100);
  const careerRows = (careerData ?? []) as any[];
  const maxCarElo  = Math.max(...careerRows.map(e => e.elo), 1100);
  const achRows    = (achData  ?? []) as any[];
  const botRows    = (botData  ?? []) as any[];
  const tourRows   = (tourData ?? []) as any[];
  const m501Rows      = (m501Data    ?? []) as any[];
  const recordsRows   = (recordsData ?? []) as any[];
  const maxDarts   = Math.max(...botRows.map(r => r.totalDarts), 1);

  const headings: Record<Mode, string> = {
    season: "Season Standings", career: "All-Time Records",
    achievements: "Achievement Standings", bot: "Shadow Bot Rankings",
    tour: "Tour Rankings", master501: "Master-501 Rankings",
    records: "Checkout Hall of Fame",
  };
  const subheads: Record<Mode, React.ReactNode> = {
    season:      <><span className="live-dot" /> Ranked by points · ELO tiebreak</>,
    career:      <>Career statistics across all seasons</>,
    achievements: <>Total gamerscore from league + tour achievements</>,
    bot:         <>Practice session stats — darts thrown, 180s, checkout %</>,
    tour:        <>Tour trophy cabinet rankings across all 61 tours</>,
    master501:   <>Tier progression · win/loss · best avg · 180s · checkout %</>,
    records:     <>Highest single-leg checkouts ever recorded in practice</>,
  };

  return (
    <div className="space-y-5">
      <div className="pdc-divider" />

      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-black uppercase"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "3rem", letterSpacing: "0.04em", textShadow: "0 0 30px rgba(255,0,92,0.2)", lineHeight: 1 }}>
            {headings[mode]}
          </h1>
          <p className="text-sm mt-1.5 flex items-center gap-2" style={{ color: "rgba(255,255,255,0.35)" }}>
            {subheads[mode]}
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
        <Tab active={mode === "season"}       onClick={() => setMode("season")}       color="#ff005c"  icon={<Trophy className="w-3.5 h-3.5" />}>Season</Tab>
        <Tab active={mode === "career"}       onClick={() => setMode("career")}       color="#0066ff"  icon={<Target className="w-3.5 h-3.5" />}>All Time</Tab>
        <Tab active={mode === "achievements"} onClick={() => setMode("achievements")} color="#a855f7"  icon={<Medal className="w-3.5 h-3.5" />}>Achievements</Tab>
        <Tab active={mode === "bot"}          onClick={() => setMode("bot")}          color="#00e5a0"  icon={<CircuitBoard className="w-3.5 h-3.5" />}>Shadow Bot</Tab>
        <Tab active={mode === "tour"}         onClick={() => setMode("tour")}         color="#ffd24a"  icon={<Star className="w-3.5 h-3.5" />}>Tour</Tab>
        <Tab active={mode === "master501"}   onClick={() => setMode("master501")}   color="#00c8a0"  icon={<Zap className="w-3.5 h-3.5" />}>Master-501</Tab>
        <Tab active={mode === "records"}     onClick={() => setMode("records")}     color="#ff005c"  icon={<Flame className="w-3.5 h-3.5" />}>Records</Tab>
      </div>

      {/* Career sort pills */}
      {mode === "career" && (
        <div className="flex items-center gap-2 flex-wrap">
          {CAREER_SORTS.map(s => (
            <SortBtn key={s.key} active={careerSort === s.key} onClick={() => setSort(s.key)}>{s.label}</SortBtn>
          ))}
        </div>
      )}

      {/* Column headers */}
      {!isLoading && mode === "season" && (
        <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: "0.12em" }}>
          <div className="w-8 text-center">#</div>
          <div className="flex-1">Player</div>
          <div className="hidden sm:block" style={{ minWidth: "3.5rem" }}>Tier</div>
          <div className="hidden sm:block text-center" style={{ minWidth: "4rem" }}>W-L</div>
          <div className="hidden sm:block" style={{ minWidth: "7rem" }}>ELO</div>
          <div className="text-right" style={{ minWidth: "3.5rem" }}>Pts</div>
        </div>
      )}
      {!isLoading && mode === "career" && (
        <div className="flex items-center gap-3 px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.18)", letterSpacing: "0.12em" }}>
          <div className="w-8 text-center">#</div>
          <div className="flex-1">Player</div>
          <div className="hidden sm:block text-center" style={{ minWidth: "4.5rem" }}>W-L</div>
          <div className="hidden sm:block text-right" style={{ minWidth: "3.5rem" }}>Win%</div>
          <div className="hidden sm:block" style={{ minWidth: "7rem" }}>ELO</div>
          <div className="hidden lg:block text-right" style={{ minWidth: "3.5rem" }}>Peak</div>
          <div className="text-right" style={{ minWidth: "4rem" }}>
            {careerSort === "points" ? "Net Pts" : "Titles"}
          </div>
        </div>
      )}

      {isLoading ? <Spinner /> : (
        <>
          {/* ── Season ── */}
          {mode === "season" && (
            <div className="space-y-1.5">
              {active.map((entry, idx) => <SeasonRow key={entry.playerId} entry={entry} idx={idx} maxElo={maxElo} />)}
              {active.length === 0 && <div className="pdc-card px-6 py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No players yet.</div>}
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
                          <span className="font-black uppercase text-sm line-through" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,100,100,0.5)" }}>{entry.playerName}</span>
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
          )}

          {/* ── All Time ── */}
          {mode === "career" && (
            <div className="space-y-1.5">
              {careerRows.map((entry, idx) => <CareerRow key={entry.playerId} entry={entry} idx={idx} maxElo={maxCarElo} sortKey={careerSort} />)}
              {careerRows.length === 0 && <div className="pdc-card px-6 py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No data.</div>}
              <div className="pt-2 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
                🏆 Season champion · Net Pts = points gained minus points lost across all wager seasons
              </div>
            </div>
          )}

          {/* ── Achievements ── */}
          {mode === "achievements" && (
            <div className="space-y-1.5">
              {achRows.length === 0 ? (
                <div className="pdc-card px-6 py-16 text-center space-y-3">
                  <div className="text-4xl">🏅</div>
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No achievements unlocked yet — start playing!</div>
                </div>
              ) : achRows.map((entry, idx) => <AchievementsRow key={entry.playerId} entry={entry} idx={idx} />)}
              {achRows.length > 0 && (
                <div className="pt-2 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
                  Gamerscore: Common 5 · Uncommon 10 · Rare 25 · Epic 50 · Legendary 100 · Mythic 250 · Tour achievements vary
                </div>
              )}
            </div>
          )}

          {/* ── Shadow Bot ── */}
          {mode === "bot" && (
            <div className="space-y-1.5">
              {botRows.length === 0 ? (
                <div className="pdc-card px-6 py-16 text-center space-y-3">
                  <div className="text-4xl">🤖</div>
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No practice sessions yet — hit the Shadow Bot!</div>
                </div>
              ) : botRows.map((entry, idx) => <BotRow key={entry.playerId} entry={entry} idx={idx} maxDarts={maxDarts} />)}
              {botRows.length > 0 && (
                <div className="pt-2 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
                  Ranked by total darts thrown · Checkout % requires ≥1 attempt
                </div>
              )}
            </div>
          )}

          {/* ── Tour ── */}
          {mode === "tour" && (
            <div className="space-y-1.5">
              {tourRows.length === 0 ? (
                <div className="pdc-card px-6 py-16 text-center space-y-3">
                  <div className="text-4xl">🏆</div>
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No tour trophies yet — enter a tour!</div>
                </div>
              ) : tourRows.map((entry, idx) => <TourRow key={entry.playerId} entry={entry} idx={idx} />)}
              {tourRows.length > 0 && (
                <div className="flex items-center gap-4 pt-2 flex-wrap">
                  {Object.entries(TIER_LABELS).map(([t, info]) => (
                    <span key={t} className="text-xs flex items-center gap-1" style={{ color: info.color }}>
                      {info.emoji} T{t} {info.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Checkout Records ── */}
          {mode === "records" && (
            <div className="space-y-2">
              {recordsRows.length === 0 ? (
                <div className="pdc-card px-6 py-16 text-center space-y-3">
                  <div className="text-4xl">🎯</div>
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No checkouts recorded yet — hit the practice board!</div>
                </div>
              ) : recordsRows.map((entry, idx) => {
                const checkout = Number(entry.highest_checkout);
                const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                const isTop3 = idx < 3;
                const checkoutColor = checkout >= 160 ? "#ff005c" : checkout >= 100 ? "#ffd24a" : checkout >= 60 ? "#00e5a0" : "rgba(255,255,255,0.55)";
                const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null;
                return (
                  <Link key={entry.player_id} href={`/players/${entry.player_id}`} asChild>
                    <div className="pdc-card flex items-center gap-4 cursor-pointer transition-all hover:scale-[1.01]"
                      style={{ padding: "0.85rem 1.2rem", borderLeft: isTop3 ? `3px solid ${checkoutColor}` : undefined }}>
                      {/* Rank */}
                      <div className="w-8 text-center shrink-0">
                        {medal
                          ? <span className="text-xl">{medal}</span>
                          : <span className="font-black text-sm tabular-nums" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)" }}>{idx + 1}</span>
                        }
                      </div>
                      {/* Player */}
                      <div className="flex-1 min-w-0">
                        <div className="font-black uppercase truncate" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1rem", letterSpacing: "0.05em", color: isTop3 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.65)" }}>
                          {entry.player_name}
                        </div>
                        {entry.game_type_name && (
                          <div className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {entry.game_type_name}{date ? ` · ${date}` : ""}
                          </div>
                        )}
                      </div>
                      {/* Checkout score */}
                      <div className="text-right shrink-0">
                        <div className="font-black tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontSize: isTop3 ? "2.2rem" : "1.8rem", color: checkoutColor, textShadow: isTop3 ? `0 0 20px ${checkoutColor}60` : undefined }}>
                          {checkout}
                        </div>
                        <div className="text-xs uppercase tracking-widest mt-0.5" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.48rem" }}>
                          CHECKOUT
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
              {recordsRows.length > 0 && (
                <div className="pt-1 text-xs" style={{ color: "rgba(255,255,255,0.15)" }}>
                  Highest single-leg checkout per player from all practice sessions · 170 is the maximum possible checkout
                </div>
              )}
            </div>
          )}

          {/* ── Master-501 ── */}
          {mode === "master501" && (
            <div className="space-y-1.5">
              {m501Rows.length === 0 ? (
                <div className="pdc-card px-6 py-16 text-center space-y-3">
                  <div className="text-4xl">🎯</div>
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No Master-501 runs yet — start climbing the ladder!</div>
                </div>
              ) : m501Rows.map((entry, idx) => <M501Row key={entry.id} entry={entry} idx={idx} />)}
              {m501Rows.length > 0 && (
                <div className="flex items-center gap-3 pt-2 flex-wrap">
                  {Object.entries(M501_TIERS).map(([t, info]) => (
                    <span key={t} className="text-xs flex items-center gap-1" style={{ color: info.color }}>
                      {info.emoji} T{t} {info.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
