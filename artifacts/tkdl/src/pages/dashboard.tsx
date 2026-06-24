import { useState, useEffect } from "react";
import {
  useGetStatsSummary,
  useGetLeaderboard,
  useGetRecentActivity,
  useGetNarrativeCards,
  useListAchievements,
} from "@workspace/api-client-react";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { ChallengesBar } from "@/components/ChallengesBar";
import { CoinBalance } from "@/components/CoinBalance";
import { CardInventoryDashboard } from "@/components/CardInventoryDashboard";
import { Link } from "wouter";
import {
  Trophy, Swords, Flame, Skull, Zap, Target, AlertTriangle,
  Star, Medal, CircuitBoard, ChevronRight, Crosshair,
} from "lucide-react";
import { format } from "date-fns";

// ── Simple fetch hook ──────────────────────────────────────────────────────────

function useFetch<T>(url: string) {
  const [data, setData]     = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);
  return { data, loading };
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

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

function SectionHeader({
  icon, label, accent, href, linkLabel = "View All →",
}: {
  icon: React.ReactNode;
  label: string;
  accent: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <span style={{ color: accent }}>{icon}</span>
        <span className="font-black uppercase text-xs tracking-widest"
          style={{ fontFamily: "Oswald, sans-serif", color: accent, letterSpacing: "0.16em", fontSize: "0.65rem" }}>
          {label}
        </span>
      </div>
      {href && (
        <Link href={href} className="text-xs font-bold uppercase tracking-widest transition-colors hover:opacity-100"
          style={{ color: accent, opacity: 0.6, fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

const posColors = ["#ffd24a", "#c0c8d8", "#cd7f32"];

const TIER_GLOW: Record<string, string> = {
  Gold:     "#ffd24a",
  Silver:   "#c0c8d8",
  Bronze:   "#cd7f32",
  Platinum: "#e2e8f0",
  Diamond:  "#00e5ff",
};

// ── LEAGUE section ─────────────────────────────────────────────────────────────

function LeagueSection({
  narrative, leaderboard,
}: {
  narrative: any[] | undefined;
  leaderboard: any[] | undefined;
}) {
  const active  = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const atRisk  = active.filter(e => e.points > 0 && e.points < 20).slice(0, 2);

  const iconMap: Record<string, React.ReactNode> = {
    HOTTEST_PLAYER:    <Flame className="w-3 h-3" style={{ color: "#ff005c" }} />,
    TITLE_RACE:        <Trophy className="w-3 h-3" style={{ color: "#ffd24a" }} />,
    ELIMINATION_WATCH: <Skull className="w-3 h-3" style={{ color: "#ff005c" }} />,
    RIVALRY_SPOTLIGHT: <Swords className="w-3 h-3" style={{ color: "#0066ff" }} />,
    STREAK_WATCH:      <Zap className="w-3 h-3" style={{ color: "#ffd24a" }} />,
  };

  return (
    <div className="section-card" style={{ borderTop: "2px solid #ff005c" }}>
      <SectionHeader
        icon={<Trophy className="w-3.5 h-3.5" />}
        label="League"
        accent="#ff005c"
        href="/leaderboard"
      />

      <div className="space-y-2">
        {narrative?.slice(0, 3).map((card: any, i: number) => (
          <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="mt-0.5 shrink-0">{iconMap[card.type] ?? <Target className="w-3 h-3" style={{ color: "#ff005c" }} />}</span>
            <div className="min-w-0">
              <p className="font-black text-xs leading-snug truncate"
                style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.9)", letterSpacing: "0.02em" }}>
                {card.headline}
              </p>
              <p className="text-xs leading-relaxed line-clamp-1 mt-0.5"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                {card.body}
              </p>
            </div>
          </div>
        ))}

        {atRisk.length > 0 && (
          <div className="border-t pt-2 mt-1" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3 h-3 animate-pulse" style={{ color: "#ff005c" }} />
              <span className="text-xs font-black uppercase" style={{ color: "rgba(255,0,92,0.6)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.14em" }}>Danger Zone</span>
            </div>
            {atRisk.map(e => {
              const isCritical = e.points <= 8;
              const acc = isCritical ? "#ff005c" : "#f97316";
              return (
                <Link key={e.playerId} href={`/players/${e.playerId}`}>
                  <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg mb-1 cursor-pointer"
                    style={{ background: `rgba(${isCritical ? "255,0,92" : "249,115,22"},0.07)`, border: `1px solid rgba(${isCritical ? "255,0,92" : "249,115,22"},0.2)` }}>
                    <span className="font-black text-xs uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.75)" }}>
                      {e.playerName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm" style={{ fontFamily: "Oswald, sans-serif", color: acc }}>{e.points}<span className="text-xs font-normal ml-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span></span>
                      {isCritical && <Skull className="w-3 h-3 animate-pulse" style={{ color: acc }} />}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {(!narrative || narrative.length === 0) && atRisk.length === 0 && (
          <div className="py-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            Play matches to generate storylines
          </div>
        )}
      </div>
    </div>
  );
}

// ── TOUR section ───────────────────────────────────────────────────────────────

type TourSummary = { totalTrophies: number; activeRuns: number; completedRuns: number; eliminatedRuns: number };
type TourTrophy  = { id: number; player_name: string; tour_name: string; tier: number; emoji: string; difficulty: string; awarded_at: string };

const DIFF_COLORS: Record<string, string> = {
  amateur: "#9ca3af", club: "#38bdf8", county: "#34d399", pro: "#ffd24a", elite: "#ff005c",
};
const TIER_LABELS: Record<number, string> = { 1: "Amateur", 2: "Club", 3: "County", 4: "Regional", 5: "Pro", 6: "Elite" };

function TourSection() {
  const { data: summary } = useFetch<TourSummary>("/api/tour/summary");
  const { data: trophies } = useFetch<TourTrophy[]>("/api/tour/all-trophies");

  return (
    <div className="section-card" style={{ borderTop: "2px solid #ffd24a" }}>
      <SectionHeader
        icon={<Star className="w-3.5 h-3.5" />}
        label="Tour Mode"
        accent="#ffd24a"
        href="/tour"
        linkLabel="Enter →"
      />

      <div className="flex gap-5 mb-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <MiniStat label="Trophies" value={summary?.totalTrophies ?? 0} accent="#ffd24a" />
        <MiniStat label="Active Runs" value={summary?.activeRuns ?? 0} accent="#ffd24a" />
        <MiniStat label="Completed" value={summary?.completedRuns ?? 0} />
      </div>

      <div className="space-y-1.5">
        {trophies && trophies.length > 0 ? (
          trophies.slice(0, 4).map(t => (
            <div key={t.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
              style={{ background: "rgba(255,210,74,0.04)", border: "1px solid rgba(255,210,74,0.12)" }}>
              <span className="text-lg leading-none">{t.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-black text-xs uppercase truncate"
                  style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)", letterSpacing: "0.04em" }}>
                  {t.player_name}
                </div>
                <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{t.tour_name}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-black uppercase"
                  style={{ fontFamily: "Oswald, sans-serif", color: DIFF_COLORS[t.difficulty] ?? "#9ca3af", fontSize: "0.58rem", letterSpacing: "0.1em" }}>
                  {t.difficulty}
                </div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.58rem" }}>
                  {format(new Date(t.awarded_at), "MMM d")}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-4 text-center">
            <div className="text-2xl mb-1.5">🏆</div>
            <div className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>
              No trophies yet
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>
              Enter a tour to start your legacy
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-2.5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { label: "61 Tours", color: "#ffd24a" },
            { label: "6 Tiers",  color: "#ffd24a" },
            { label: "305 Trophies available", color: "rgba(255,255,255,0.3)" },
          ].map(p => (
            <span key={p.label} className="text-xs font-bold uppercase"
              style={{ fontFamily: "Oswald, sans-serif", color: p.color, fontSize: "0.6rem" }}>
              {p.label} ·
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ACHIEVEMENTS section ───────────────────────────────────────────────────────

type RecentUnlock = {
  unlocked_at: string; player_id: number; player_name: string;
  achievement_name: string; icon: string | null; rarity: string;
};

const RARITY_COLORS: Record<string, string> = {
  Mythic: "#ff005c", Legendary: "#ffd24a", Epic: "#a855f7", Rare: "#0066ff", Common: "#9ca3af",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function AchievementsSection() {
  const { data: recent, loading } = useFetch<RecentUnlock[]>("/api/achievements/recent");

  return (
    <div className="section-card" style={{ borderTop: "2px solid #a855f7" }}>
      <SectionHeader
        icon={<Medal className="w-3.5 h-3.5" />}
        label="Achievements"
        accent="#a855f7"
        href="/achievements"
      />

      <div className="space-y-1.5">
        {loading ? (
          <div className="flex justify-center py-6">
            <div className="w-5 h-5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#a855f7" }} />
          </div>
        ) : recent && recent.length > 0 ? (
          recent.map((u, i) => {
            const color = RARITY_COLORS[u.rarity] ?? "#9ca3af";
            return (
              <Link key={i} href={`/players/${u.player_id}`}>
                <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5"
                  style={{ background: `${color}07`, border: `1px solid ${color}1a` }}>
                  <span className="text-xl leading-none shrink-0">{u.icon || "🎯"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-xs uppercase truncate"
                      style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)", letterSpacing: "0.03em" }}>
                      {u.achievement_name.replace(/^[^\s]+\s/, "")}
                    </div>
                    <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                      <span style={{ color: "rgba(255,255,255,0.55)" }}>{u.player_name}</span>
                      {" · "}
                      <span style={{ color }}>{u.rarity}</span>
                    </div>
                  </div>
                  <div className="text-xs shrink-0" style={{ color: "rgba(255,255,255,0.18)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.6rem" }}>
                    {timeAgo(u.unlocked_at)}
                  </div>
                </div>
              </Link>
            );
          })
        ) : (
          <div className="py-6 text-center">
            <div className="text-2xl mb-1.5">🎖️</div>
            <div className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>
              No achievements unlocked yet
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>
              Play matches to start unlocking
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 pt-2.5 border-t flex gap-3 items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex gap-3">
          {[
            { label: "League", color: "#ff005c" },
            { label: "Tour",   color: "#ffd24a" },
            { label: "Bot",    color: "#0066ff" },
          ].map(p => (
            <span key={p.label} className="text-xs font-bold uppercase"
              style={{ fontFamily: "Oswald, sans-serif", color: p.color, fontSize: "0.6rem", opacity: 0.6 }}>
              {p.label}
            </span>
          ))}
        </div>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.15)", fontFamily: "Share Tech Mono, monospace", fontSize: "0.6rem" }}>
          456 total achievements
        </span>
      </div>
    </div>
  );
}

// ── SHADOW BOT section ─────────────────────────────────────────────────────────

type BotEntry = {
  playerId: number; playerName: string; totalDarts: number; totalSessions: number;
  accuracyLevel: string | null; locked: boolean; progressToNext: number; computedAvg: number | null;
};

const BOT_LEVEL_COLORS: Record<string, string> = {
  elite: "#ff005c", pro: "#ffd24a", county: "#34d399", club: "#38bdf8", amateur: "#9ca3af", beginner: "rgba(255,255,255,0.3)",
};

function ShadowBotSection() {
  const { data: bots } = useFetch<BotEntry[]>("/api/bots/leaderboard");

  const activeBots    = bots?.filter(b => !b.locked && b.totalDarts > 0) ?? [];
  const lockedBots    = bots?.filter(b => b.locked) ?? [];
  const totalDarts    = bots?.reduce((s, b) => s + (b.totalDarts ?? 0), 0) ?? 0;
  const totalSessions = bots?.reduce((s, b) => s + (b.totalSessions ?? 0), 0) ?? 0;

  return (
    <div className="section-card" style={{ borderTop: "2px solid #0066ff" }}>
      <SectionHeader
        icon={<CircuitBoard className="w-3.5 h-3.5" />}
        label="Shadow Bot"
        accent="#0066ff"
        href="/shadow-bot"
        linkLabel="Train →"
      />

      <div className="flex gap-5 mb-3 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <MiniStat label="Sessions" value={totalSessions} accent="#0066ff" />
        <MiniStat label="Darts Thrown" value={totalDarts.toLocaleString()} />
        <MiniStat label="Profiles Built" value={activeBots.length} />
      </div>

      <div className="space-y-1.5">
        {activeBots.length > 0 ? (
          activeBots.slice(0, 4).map(b => {
            const color = BOT_LEVEL_COLORS[b.accuracyLevel ?? "beginner"] ?? "#9ca3af";
            const avg   = b.computedAvg && b.computedAvg > 0 ? b.computedAvg.toFixed(1) : "–";
            return (
              <div key={b.playerId} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
                style={{ background: "rgba(0,102,255,0.04)", border: "1px solid rgba(0,102,255,0.12)" }}>
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                <div className="flex-1 min-w-0">
                  <div className="font-black text-xs uppercase truncate"
                    style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)", letterSpacing: "0.04em" }}>
                    {b.playerName}
                  </div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {b.totalDarts.toLocaleString()} darts · avg {avg}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-black uppercase"
                    style={{ fontFamily: "Oswald, sans-serif", color, fontSize: "0.58rem", letterSpacing: "0.1em" }}>
                    {b.accuracyLevel}
                  </div>
                  <div className="h-1 w-12 rounded-full mt-0.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                    <div className="h-full rounded-full" style={{ width: `${b.progressToNext}%`, background: color }} />
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-4 text-center">
            {lockedBots.length > 0 ? (
              <>
                <div className="text-2xl mb-1.5">🤖</div>
                <div className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>
                  No bots unlocked yet
                </div>
                <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>
                  Throw 250 darts to unlock your bot profile
                </div>
              </>
            ) : (
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>No practice sessions yet</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── RIVALRIES SECTION ──────────────────────────────────────────────────────────

type Rivalry = {
  p1_id: number; p2_id: number;
  p1_name: string; p2_name: string;
  total_matches: number; p1_wins: number; p2_wins: number;
  last_played_at: string;
};

function RivalriesSection() {
  const { data, loading } = useFetch<Rivalry[]>("/api/stats/rivalries");

  return (
    <div className="section-card" style={{ borderTop: "2px solid #ff005c" }}>
      <SectionHeader
        icon={<Crosshair className="w-3.5 h-3.5" />}
        label="Rivalries"
        accent="#ff005c"
      />

      {loading ? (
        <div className="py-4 text-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Loading…</div>
      ) : !data || data.length === 0 ? (
        <div className="py-4 text-center">
          <div className="text-2xl mb-1.5">⚔️</div>
          <div className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>
            No rivalries yet
          </div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.15)" }}>
            Play 3+ matches against the same opponent
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {data.slice(0, 5).map((r, i) => {
            const p1Leading  = r.p1_wins > r.p2_wins;
            const p2Leading  = r.p2_wins > r.p1_wins;
            const tied       = r.p1_wins === r.p2_wins;
            const leaderName = p1Leading ? r.p1_name : p2Leading ? r.p2_name : null;
            const leaderW    = p1Leading ? r.p1_wins : r.p2_wins;
            const trailerW   = p1Leading ? r.p2_wins : r.p1_wins;
            return (
              <div key={i} className="flex items-center gap-3 px-2.5 py-2 rounded-xl"
                style={{ background: "rgba(255,0,92,0.03)", border: "1px solid rgba(255,0,92,0.1)" }}>
                <span className="font-black tabular-nums shrink-0"
                  style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", color: "rgba(255,0,92,0.5)", minWidth: "1.4rem" }}>
                  {r.total_matches}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-xs uppercase truncate"
                    style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)", letterSpacing: "0.04em" }}>
                    {r.p1_name} <span style={{ color: "rgba(255,255,255,0.25)" }}>vs</span> {r.p2_name}
                  </div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.62rem" }}>
                    {tied
                      ? `${r.p1_wins}–${r.p2_wins} all square`
                      : `${leaderName} leads ${leaderW}–${trailerW}`}
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {Array.from({ length: Math.min(r.total_matches, 8) }).map((_, k) => {
                    const isP1Win = k < r.p1_wins;
                    return (
                      <div key={k} className="w-2 h-2 rounded-sm"
                        style={{ background: isP1Win ? "rgba(255,0,92,0.6)" : "rgba(0,102,255,0.6)" }} />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MAIN HUB PAGE ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<"leaderboard" | "recent">("leaderboard");

  const { data: summary }   = useGetStatsSummary();
  const { data: leaderboard } = useGetLeaderboard();
  const { data: recent }    = useGetRecentActivity();
  const { data: narrative } = useGetNarrativeCards();

  const active     = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const top5       = active.slice(0, 5);
  const leader     = active[0] ?? null;
  const second     = active[1] ?? null;
  const eliminated = (summary as any)?.eliminatedCount ?? 0;
  const gap        = leader && second ? leader.points - second.points : 0;
  const atRisk     = active.filter(e => e.points > 0 && e.points < 20).slice(0, 3);
  const tierGlow   = TIER_GLOW[leader?.tier ?? "Bronze"] ?? "#cd7f32";

  return (
    <div className="space-y-4">
      <div className="pdc-divider" />

      {/* ── CHALLENGES BAR ── */}
      {summary && summary.playerId && <ChallengesBar playerId={summary.playerId} />}

      {/* ── COIN BALANCE ── */}
      {summary && summary.playerId && <CoinBalance playerId={summary.playerId} />}

      {/* ── CARD INVENTORY ── */}
      {summary && summary.playerId && <CardInventoryDashboard playerId={summary.playerId} />}

      {/* ── CINEMATIC HERO ── */}
      <div className="relative overflow-hidden fade-in-up" style={{
        borderRadius: "1rem",
        minHeight: "clamp(200px, 26vw, 250px)",
        background: "linear-gradient(rgba(2,2,8,0.6) 0%, rgba(2,2,8,0.88) 100%), url('https://i.postimg.cc/Bbf9fbrp/pdc1.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center top",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: leader ? `0 0 60px ${tierGlow}18` : undefined,
      }}>
        {/* Tier glow rising from bottom */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse 130% 55% at 50% 120%, ${tierGlow}30, transparent 60%)`,
        }} />

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between" style={{ padding: "1.25rem 1.5rem 0" }}>
          <div className="flex items-center gap-2">
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.22em", color: "rgba(255,0,92,0.9)", fontWeight: 900 }}>LIVE</span>
            <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.7rem" }}>·</span>
            <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.35)", fontWeight: 700 }}>SEASON LEADER</span>
          </div>
          <div className="flex items-center gap-3">
            {summary?.currentSeasonName && (
              <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>
                {summary.currentSeasonName}
              </span>
            )}
            <Link href="/leaderboard" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "rgba(255,0,92,0.65)", letterSpacing: "0.14em", fontWeight: 900 }}>
              FULL TABLE →
            </Link>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 flex items-end justify-between gap-4" style={{ padding: "0.5rem 1.5rem 1.25rem" }}>
          {leader ? (
            <>
              <div className="min-w-0 flex-1">
                <h1 className="font-black uppercase leading-none truncate"
                  style={{
                    fontFamily: "Oswald, sans-serif",
                    fontSize: "clamp(2.2rem, 6vw, 3.6rem)",
                    letterSpacing: "0.05em",
                    color: "#fff",
                    textShadow: `0 2px 40px ${tierGlow}66`,
                  }}>
                  {leader.playerName}
                </h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <TierBadge tier={leader.tier} />
                  {(leader as any).title && (
                    <span style={{ color: "rgba(255,210,74,0.7)", fontStyle: "italic", fontSize: "0.8rem" }}>"{(leader as any).title}"</span>
                  )}
                  {(leader as any).archetype && (
                    <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.1em" }}>
                      · {(leader as any).archetype}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: "0.65rem" }}>
                  <MiniStat label="Points" value={leader.points} accent="#ff005c" />
                  <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                  <MiniStat label="ELO" value={leader.elo ?? 0} accent="#0066ff" />
                  <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                  <MiniStat label="W–L" value={`${leader.wins}–${leader.losses}`} />
                  {second && (
                    <>
                      <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
                      <div className="flex flex-col">
                        <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.9rem", fontWeight: 900, color: gap <= 5 ? "#ff005c" : "#ffd24a", lineHeight: 1, textShadow: `0 0 18px ${gap <= 5 ? "#ff005c55" : "#ffd24a55"}` }}>
                          +{gap}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.16em", marginTop: 2 }}>
                          CLEAR
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Streak badge */}
              {(leader as any).currentStreak >= 3 && (
                <div className="shrink-0 flex flex-col items-center"
                  style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.25)", borderRadius: "0.75rem", padding: "0.65rem 0.85rem" }}>
                  <Flame className="w-5 h-5 streak-fire" style={{ color: "#ff005c" }} />
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "2rem", fontWeight: 900, color: "#ff005c", lineHeight: 1, marginTop: "0.2rem" }}>
                    {(leader as any).currentStreak}
                  </span>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.44rem", color: "rgba(255,0,92,0.5)", letterSpacing: "0.12em", marginTop: "0.15rem" }}>
                    WIN STREAK
                  </span>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif", fontSize: "1rem", padding: "2rem 0" }}>
              No matches played yet — start the season!
            </div>
          )}
        </div>
      </div>

      {/* ── SITUATION STRIP (title race + danger zone) ── */}
      {(second || atRisk.length > 0) && (
        <div className={`grid gap-3 ${second && atRisk.length > 0 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>

          {/* Title race */}
          {second && (
            <div style={{ padding: "0.85rem 1rem", border: `1px solid ${gap <= 5 ? "rgba(255,0,92,0.25)" : "rgba(255,210,74,0.18)"}`, borderRadius: "0.75rem", background: gap <= 5 ? "rgba(255,0,92,0.05)" : "rgba(255,210,74,0.04)" }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <Trophy className="w-3 h-3" style={{ color: gap <= 5 ? "#ff005c" : "#ffd24a" }} />
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: gap <= 5 ? "#ff005c" : "#ffd24a", letterSpacing: "0.18em", fontWeight: 900 }}>
                  {gap <= 5 ? "⚡ TITLE RACE — NECK AND NECK" : "TITLE RACE"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>1ST</div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1rem", color: "#ffd24a", letterSpacing: "0.04em", lineHeight: 1.1 }}>{leader!.playerName}</div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.5rem", color: "#ff005c", lineHeight: 1 }}>{leader!.points}<span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>pts</span></div>
                </div>
                <div className="text-center px-2">
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.8rem", fontWeight: 900, color: gap <= 5 ? "#ff005c" : "#ffd24a", lineHeight: 1, textShadow: `0 0 20px ${gap <= 5 ? "#ff005c55" : "#ffd24a55"}` }}>
                    {gap}
                  </div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.42rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>PTS GAP</div>
                </div>
                <div className="text-right">
                  <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>2ND</div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1rem", color: "rgba(255,255,255,0.65)", letterSpacing: "0.04em", lineHeight: 1.1 }}>{second.playerName}</div>
                  <div style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.5rem", color: "rgba(255,255,255,0.4)", lineHeight: 1 }}>{second.points}<span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)", fontWeight: 400 }}>pts</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Danger zone */}
          {atRisk.length > 0 && (
            <div style={{ padding: "0.85rem 1rem", border: "1px solid rgba(255,0,92,0.2)", borderRadius: "0.75rem", background: "rgba(255,0,92,0.04)" }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <AlertTriangle className="w-3 h-3 animate-pulse" style={{ color: "#ff005c" }} />
                <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", color: "#ff005c", letterSpacing: "0.18em", fontWeight: 900 }}>DANGER ZONE</span>
              </div>
              <div className="space-y-1.5">
                {atRisk.map(e => {
                  const isCritical = e.points <= 8;
                  const acc = isCritical ? "#ff005c" : "#f97316";
                  return (
                    <Link key={e.playerId} href={`/players/${e.playerId}`}>
                      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80"
                        style={{ background: `rgba(${isCritical ? "255,0,92" : "249,115,22"},0.08)`, border: `1px solid rgba(${isCritical ? "255,0,92" : "249,115,22"},0.22)` }}>
                        <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "0.8rem", color: "rgba(255,255,255,0.8)", letterSpacing: "0.04em" }}>
                          {e.playerName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span style={{ fontFamily: "Oswald, sans-serif", fontWeight: 900, fontSize: "1.1rem", color: acc }}>{e.points}<span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)", fontWeight: 400 }}> pts</span></span>
                          {isCritical && <Skull className="w-3 h-3 animate-pulse" style={{ color: acc }} />}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── QUICK STATS ── */}
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

      {/* ── ACTIVITY WALL ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="live-dot" />
          <span className="text-xs font-black uppercase tracking-widest"
            style={{ color: "rgba(255,0,92,0.85)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.18em", fontSize: "0.65rem" }}>
            What's Happening
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LeagueSection narrative={narrative} leaderboard={leaderboard} />
          <TourSection />
          <AchievementsSection />
          <ShadowBotSection />
          <RivalriesSection />
        </div>
      </div>

      {/* ── LEADERBOARD + RECENT ── */}

      {/* Mobile tab switcher */}
      <div className="lg:hidden flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {(["leaderboard", "recent"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-widest transition-all"
            style={{
              fontFamily: "Oswald, sans-serif", letterSpacing: "0.12em",
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
                      <span className="text-xs font-black px-1.5 py-0.5 rounded"
                        style={{ background: "rgba(0,200,150,0.12)", color: "#00c896", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", letterSpacing: "0.05em" }}>TEAM</span>
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
                  <div className="text-xs font-black"
                    style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>
                    +{m.pointsAwarded ?? 0}
                    <span className="font-normal ml-0.5" style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.2)" }}>pts</span>
                  </div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.65rem" }}>
                    {m.eloChange ? `ELO ${m.eloChange > 0 ? "+" : ""}${m.eloChange}` : ""}
                  </div>
                </div>
              </div>
            ))}
            {(!recent || recent.length === 0) && (
              <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No matches yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
