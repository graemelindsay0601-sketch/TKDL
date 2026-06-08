import { useState } from "react";
import {
  useGetStatsSummary,
  useGetLeaderboard,
  useGetRecentActivity,
  useGetNarrativeCards,
} from "@workspace/api-client-react";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Trophy, Swords, Flame, Skull, Zap, Target, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

function NarrativeCard({ card, idx }: { card: { type: string; headline: string; body: string; tag?: string }; idx: number }) {
  const clsMap: Record<string, string> = {
    HOTTEST_PLAYER:    "narrative-hot",
    TITLE_RACE:        "narrative-gold",
    ELIMINATION_WATCH: "narrative-hot",
    RIVALRY_SPOTLIGHT: "narrative-blue",
    STREAK_WATCH:      "narrative-gold",
  };
  const iconMap: Record<string, React.ReactNode> = {
    HOTTEST_PLAYER:    <Flame className="w-3.5 h-3.5 streak-fire" style={{ color: "#ff005c" }} />,
    TITLE_RACE:        <Trophy className="w-3.5 h-3.5" style={{ color: "#ffd24a" }} />,
    ELIMINATION_WATCH: <Skull className="w-3.5 h-3.5" style={{ color: "#ff005c" }} />,
    RIVALRY_SPOTLIGHT: <Swords className="w-3.5 h-3.5" style={{ color: "#0066ff" }} />,
    STREAK_WATCH:      <Zap className="w-3.5 h-3.5" style={{ color: "#ffd24a" }} />,
  };
  return (
    <div className={`pdc-card p-4 fade-in-up h-full ${clsMap[card.type] ?? "narrative-hot"}`}
      style={{ animationDelay: `${idx * 80}ms` }}>
      <div className="flex items-center gap-2 mb-1.5">
        {iconMap[card.type] ?? <Target className="w-3.5 h-3.5" style={{ color: "#ff005c" }} />}
        {card.tag && (
          <span className="text-xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full"
            style={{ fontFamily: "Oswald, sans-serif", background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", fontSize: "0.55rem" }}>
            {card.tag}
          </span>
        )}
      </div>
      <p className="font-black text-sm leading-snug mb-1" style={{ fontFamily: "Oswald, sans-serif", color: "#fff", letterSpacing: "0.02em" }}>
        {card.headline}
      </p>
      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{card.body}</p>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-black tabular-nums leading-none"
        style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.9rem", color: accent ?? "#fff", textShadow: accent ? `0 0 18px ${accent}55` : undefined }}>
        {value}
      </span>
      <span className="text-xs uppercase tracking-widest mt-0.5"
        style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.14em" }}>
        {label}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "recent">("leaderboard");

  const { data: summary }     = useGetStatsSummary();
  const { data: leaderboard } = useGetLeaderboard();
  const { data: recent }      = useGetRecentActivity();
  const { data: narrative }   = useGetNarrativeCards();

  const active    = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const top5      = active.slice(0, 5);
  const leader    = active[0] ?? null;
  const eliminated = (summary as any)?.eliminatedCount ?? 0;
  const posColors  = ["#ffd24a", "#c0c8d8", "#cd7f32"];

  return (
    <div className="space-y-4">
      <div className="pdc-divider" />

      {/* ── COMPACT LEADER SPOTLIGHT ── */}
      {leader && (
        <div className="spotlight-strip fade-in-up">
          {/* Left: identity */}
          <div className="flex items-center gap-4 relative z-10 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="live-dot" style={{ width: 5, height: 5 }} />
                <span className="text-xs font-black uppercase tracking-widest"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.8)", fontSize: "0.55rem", letterSpacing: "0.2em" }}>
                  Season Leader
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black uppercase shimmer-gold truncate"
                  style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.7rem", letterSpacing: "0.04em", lineHeight: 1 }}>
                  {leader.playerName}
                </span>
                <TierBadge tier={leader.tier} />
                {(leader as any).currentStreak >= 3 && (
                  <span className="flex items-center gap-1 text-xs font-black" style={{ color: "#ff005c" }}>
                    <Flame className="w-3 h-3 streak-fire" />{(leader as any).currentStreak}W
                  </span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-2 mt-0.5">
                {(leader as any).title && (
                  <span className="text-xs italic" style={{ color: "rgba(255,210,74,0.7)" }}>"{(leader as any).title}"</span>
                )}
                {(leader as any).archetype && (
                  <span className="text-xs font-bold uppercase tracking-wider"
                    style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                    · {(leader as any).archetype}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: stats — ELO hidden on mobile */}
          <div className="flex items-center gap-4 md:gap-6 relative z-10 shrink-0">
            <MiniStat label="Points" value={leader.points} accent="#ff005c" />
            <div className="hidden md:block w-px h-8 bg-white/10" />
            <div className="hidden md:block">
              <MiniStat label="ELO" value={leader.elo ?? 0} accent="#0066ff" />
            </div>
            <div className="w-px h-8 bg-white/10" />
            <MiniStat label="W–L" value={`${leader.wins}–${leader.losses}`} />
          </div>
        </div>
      )}

      {/* ── QUICK STATS — 2×2 on mobile, 4-col on sm+ ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active",     value: summary?.activePlayers ?? summary?.totalPlayers ?? 0, accent: "#0066ff",                   cls: "stat-box-blue" },
          { label: "Eliminated", value: eliminated,                                            accent: eliminated > 0 ? "#ff005c" : undefined, cls: eliminated > 0 ? "stat-box-red" : "" },
          { label: "Matches",    value: summary?.currentSeasonMatches ?? 0,                   accent: "#ffd24a",                   cls: "stat-box-gold" },
          { label: "Top ELO",    value: summary?.topEloPlayer?.elo ?? 0,                      accent: "#0066ff",                   cls: "stat-box-blue" },
        ].map(s => (
          <div key={s.label} className={`pdc-card px-4 py-3 ${s.cls}`}>
            <div className="text-xs uppercase tracking-widest mb-1.5"
              style={{ color: "rgba(255,255,255,0.28)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.16em" }}>
              {s.label}
            </div>
            <div className="font-black leading-none"
              style={{ fontFamily: "Oswald, sans-serif", fontSize: "2.2rem", color: s.accent ?? "#fff", textShadow: s.accent ? `0 0 20px ${s.accent}55` : undefined }}>
              {s.value}
            </div>
            {s.label === "Top ELO" && summary?.topEloPlayer?.name && (
              <div className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.25)" }}>{summary.topEloPlayer.name}</div>
            )}
          </div>
        ))}
      </div>

      {/* ── LIVE STORYLINES — horizontal scroll on mobile, grid on md+ ── */}
      {narrative && narrative.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="live-dot" />
            <span className="text-xs font-black uppercase tracking-widest"
              style={{ color: "rgba(255,0,92,0.85)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.18em" }}>
              Live Storylines
            </span>
          </div>

          {/* Mobile: snap carousel */}
          <div className="md:hidden flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
            {narrative.map((card: any, i: number) => (
              <div key={i} className="shrink-0 snap-start" style={{ width: "82vw" }}>
                <NarrativeCard card={card} idx={i} />
              </div>
            ))}
          </div>

          {/* Desktop: grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-3">
            {narrative.map((card: any, i: number) => (
              <NarrativeCard key={i} card={card} idx={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── DANGER ZONE ── */}
      {(() => {
        const atRisk = active.filter(e => e.points > 0 && e.points < 20);
        if (!atRisk.length) return null;
        return (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" style={{ color: "#ff005c" }} />
              <span className="text-xs font-black uppercase tracking-widest"
                style={{ color: "rgba(255,0,92,0.85)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.18em" }}>
                Danger Zone
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {atRisk.map(e => {
                const isCritical = e.points <= 8;
                const isWarning  = e.points > 8 && e.points <= 14;
                const accent     = isCritical ? "#ff005c" : isWarning ? "#f97316" : "#ffd24a";
                const label      = isCritical ? "CRITICAL" : isWarning ? "AT RISK" : "WATCH";
                const maxSafe    = e.points - 1;
                return (
                  <Link key={e.playerId} href={`/players/${e.playerId}`}>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5"
                      style={{
                        background: `rgba(${isCritical ? "255,0,92" : isWarning ? "249,115,22" : "255,210,74"},0.06)`,
                        border: `1px solid rgba(${isCritical ? "255,0,92" : isWarning ? "249,115,22" : "255,210,74"},0.25)`,
                      }}>
                      <div className="shrink-0">
                        {isCritical
                          ? <Skull className="w-4 h-4 animate-pulse" style={{ color: accent }} />
                          : <AlertTriangle className="w-4 h-4" style={{ color: accent }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm uppercase truncate"
                          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)" }}>
                          {e.playerName}
                        </div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                          1 loss of {maxSafe}+ pts → eliminated
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-black text-lg leading-none"
                          style={{ fontFamily: "Oswald, sans-serif", color: accent, textShadow: `0 0 12px ${accent}66` }}>
                          {e.points}
                        </div>
                        <div className="text-xs font-bold uppercase"
                          style={{ color: accent, opacity: 0.7, fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.1em" }}>
                          {label}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── LEADERBOARD + RECENT — tabs on mobile, side-by-side on lg+ ── */}

      {/* Mobile tab switcher */}
      <div className="lg:hidden flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {(["leaderboard", "recent"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest transition-all"
            style={{
              fontFamily: "Oswald, sans-serif",
              letterSpacing: "0.12em",
              background: activeTab === tab ? "rgba(255,0,92,0.12)" : "rgba(255,255,255,0.02)",
              color: activeTab === tab ? "#ff005c" : "rgba(255,255,255,0.35)",
              borderBottom: activeTab === tab ? "2px solid #ff005c" : "2px solid transparent",
            }}>
            {tab === "leaderboard"
              ? <><Trophy className="w-3.5 h-3.5" /> Standings</>
              : <><Swords className="w-3.5 h-3.5" /> Matches</>}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top 5 leaderboard */}
        <div className={`section-card ${activeTab !== "leaderboard" ? "hidden lg:block" : ""}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black uppercase flex items-center gap-2 text-sm"
              style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
              <Trophy className="w-3.5 h-3.5" style={{ color: "#ffd24a", filter: "drop-shadow(0 0 5px rgba(255,210,74,0.7))" }} />
              Leaderboard
            </h2>
            <Link href="/leaderboard" className="text-xs font-bold hover:text-white transition-colors uppercase tracking-widest"
              style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
              View All →
            </Link>
          </div>
          <div className="space-y-2">
            {top5.map((entry, i) => {
              const pColor  = posColors[i] ?? "rgba(255,255,255,0.4)";
              const isFirst = i === 0;
              return (
                <Link key={entry.playerId} href={`/players/${entry.playerId}`}>
                  <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 cursor-pointer ${isFirst ? "lb-rank-1" : i === 1 ? "lb-rank-2" : i === 2 ? "lb-rank-3" : "lb-card-row"}`}>
                    <span className="font-black w-6 text-center leading-none"
                      style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.3rem", color: pColor, textShadow: isFirst ? `0 0 14px ${pColor}` : undefined }}>
                      {entry.position}
                    </span>
                    <RankChange change={entry.positionChange} />
                    <div className="flex-1 min-w-0">
                      <div className={`font-black text-sm uppercase truncate ${isFirst ? "shimmer-gold" : ""}`}
                        style={!isFirst ? { color: "rgba(255,255,255,0.9)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.04em" } : { fontFamily: "Oswald, sans-serif" }}>
                        {entry.playerName}
                      </div>
                      {(entry as any).title && (
                        <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.22)", fontStyle: "italic" }}>{(entry as any).title}</div>
                      )}
                    </div>
                    <TierBadge tier={entry.tier} />
                    <span className="font-black tabular-nums"
                      style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.2rem", color: isFirst ? "#ffd24a" : "#ff005c", minWidth: "2.8rem", textAlign: "right" }}>
                      {entry.points}<span className="text-xs font-normal ml-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
                    </span>
                  </div>
                </Link>
              );
            })}
            {top5.length === 0 && (
              <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No data yet</div>
            )}
          </div>
        </div>

        {/* Recent matches */}
        <div className={`section-card ${activeTab !== "recent" ? "hidden lg:block" : ""}`}>
          <h2 className="font-black uppercase flex items-center gap-2 text-sm mb-4"
            style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em" }}>
            <Swords className="w-3.5 h-3.5" style={{ color: "#ff005c" }} />
            Recent Matches
          </h2>
          <div className="space-y-2">
            {recent?.slice(0, 6).map((m: any, i: number) => (
              <div key={m.matchId} className="flex items-center justify-between px-3 py-2.5 rounded-xl fade-in-up"
                style={{ animationDelay: `${i * 50}ms`, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="min-w-0">
                  <div className="text-sm font-bold flex items-center gap-1.5 flex-wrap">
                    {m.isTeamMatch ? (
                      <span className="font-black uppercase" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>{m.winnerName}</span>
                    ) : (
                      <Link href={`/players/${m.winnerId}`} className="hover:underline font-black uppercase"
                        style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>{m.winnerName}</Link>
                    )}
                    <span style={{ color: "rgba(255,255,255,0.22)", fontSize: "0.7rem" }}>def.</span>
                    <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>{m.loserName}</span>
                    {m.isTeamMatch && (
                      <span className="text-xs font-black px-1.5 py-0.5 rounded" style={{ background: "rgba(0,200,150,0.12)", color: "#00c896", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", letterSpacing: "0.05em" }}>TEAM</span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {format(new Date(m.playedAt), "MMM d, h:mm a")}
                  </div>
                  {m.gameType && (
                    <div className="text-xs mt-0.5 italic truncate" style={{ color: "rgba(255,255,255,0.18)", maxWidth: "13rem" }}>
                      {m.gameType}
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 ml-3">
                  {m.stake > 0 && (
                    <div className="font-black text-sm" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>±{m.stake}pts</div>
                  )}
                  <div className="text-xs font-mono" style={{ color: "rgba(0,102,255,0.65)" }}>+{m.eloChange} Elo</div>
                </div>
              </div>
            ))}
            {(!recent || recent.length === 0) && (
              <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No matches yet</div>
            )}
          </div>
        </div>
      </div>

      {/* ── ELIMINATED ── */}
      {leaderboard && leaderboard.some(e => e.status === "ELIMINATED") && (
        <div>
          <h2 className="text-xs uppercase tracking-widest mb-3 font-black flex items-center gap-2"
            style={{ color: "rgba(255,0,92,0.7)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.18em" }}>
            <Skull className="w-3 h-3" /> Eliminated
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {leaderboard.filter(e => e.status === "ELIMINATED").map(entry => (
              <Link key={entry.playerId} href={`/players/${entry.playerId}`}>
                <div className="pdc-card p-3 opacity-40 hover:opacity-65 transition-opacity cursor-pointer"
                  style={{ borderColor: "rgba(255,0,92,0.18)" }}>
                  <div className="flex items-center gap-1.5">
                    <span style={{ color: "#ff005c" }}>☠</span>
                    <span className="text-sm font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>{entry.playerName}</span>
                  </div>
                  <div className="text-xs mt-0.5 font-bold" style={{ color: "rgba(255,0,92,0.55)", fontFamily: "Oswald, sans-serif" }}>Eliminated</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
