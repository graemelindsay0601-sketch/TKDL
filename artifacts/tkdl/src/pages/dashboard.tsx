import { CARD_CLASH_BENCHED } from "@/lib/card-clash-bench";
import { Chapter, PmCard, Glow, DartboardBackdrop, Tile, TileGrid, Dots } from "@/components/premium/Premium";
import { useState, useEffect, useMemo } from "react";
import {
  useGetStatsSummary,
  useGetLeaderboard,
  useGetRecentActivity,
} from "@workspace/api-client-react";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { useCurrentPlayer } from "@/context/auth";
import { useCosmeticsCatalog, PROFILE_ICON_MAP } from "@/lib/cosmetics";
import { useSettings } from "@/hooks/use-settings";
import { useFetch } from "@/hooks/use-fetch";
import { Link } from "wouter";
import {
  Trophy, Swords, Flame, Skull, Zap, AlertTriangle,
  Star, Plus, Dumbbell, Award, History, BookOpen,
  Users, Building2, Ghost, Layers, Pin, Sparkles, Coins, ThumbsUp,
  MessageSquare, CircuitBoard, Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { MatchSpotlight } from "@/components/MatchSpotlight";
import { DailyDrill } from "@/components/DailyDrill";
import { MonthlyLeagueReports } from "@/components/monthly-league-reports";

// ══════════════════════════════════════════════════════════════════════════
// HUB REWORK v3 — see the mockup this was built from for the full rationale.
// Short version: the old Hub stacked ~10 blocks of equal weight (hero, trophy
// case, title race, danger zone, quick stats, game modes, then six parallel
// "what's happening" cards, then two tables) and always led with the league
// LEADER regardless of who was actually looking. This version picks a job —
// "what matters to me right now" — and structures around it: a viewer-
// relative State Band, a single Priority Nudge, a secondary For You rail, one
// merged filterable Pulse feed instead of six parallel cards, a condensed
// Explore strip, a Reference row for evergreen pages, and the same
// leaderboard/recent tables kept at the bottom as reference material.
// ══════════════════════════════════════════════════════════════════════════

// ── Shared helpers ─────────────────────────────────────────────────────────────

function MiniStat({ label, value, accent, size = "lg" }: { label: string; value: string | number; accent?: string; size?: "lg" | "md" }) {
  return (
    <div className="flex flex-col">
      <span className="font-black tabular-nums leading-none"
        style={{ fontFamily: "Oswald, sans-serif", fontSize: size === "lg" ? "1.9rem" : "1.4rem", color: accent ?? "#fff", textShadow: accent ? `0 0 18px ${accent}55` : undefined }}>
        {value}
      </span>
      <span className="text-xs uppercase tracking-widest mt-0.5"
        style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif", fontSize: "0.5rem", letterSpacing: "0.14em" }}>
        {label}
      </span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)  return `${days}d ago`;
  return format(new Date(dateStr), "MMM d");
}

const posColors = ["#ffd24a", "#c0c8d8", "#cd7f32"];
const TIER_GLOW: Record<string, string> = { Gold: "#ffd24a", Silver: "#c0c8d8", Bronze: "#cd7f32", Platinum: "#e2e8f0", Diamond: "#00e5ff" };

// ── FLASHBACK ────────────────────────────────────────────────────────────────
// A small nostalgia hit: resurfaces a real match from today's date in an
// earlier year (or, for a league too young to have one yet, one month back —
// see GET /matches/flashback for the fallback logic). Deliberately distinct
// from ForYouZone's existing "On This Day" priority nudge below, which is
// viewer-relative (only fires when the logged-in player has their OWN
// anniversary match today) — this one is league-wide, showing any player's
// notable match on today's date so there's still something to see on days
// with no personal anniversary. Renders nothing when there's no match to
// show rather than an empty-state card, since most days simply won't have
// one and that's fine.
type FlashbackMatch = {
  id: number; winnerName: string; loserName: string; stake: number;
  gameType: string; eloChange: number; wasUpsetWin: boolean;
  playedAt: string; unitsAgo: number; unit: "year" | "years" | "month";
};
function Flashback() {
  const { data } = useFetch<FlashbackMatch | null>("/api/matches/flashback");
  if (!data) return null;
  return (
    <PmCard accent="#f59e0b" className="flex items-center gap-3 px-4 py-3 flex-wrap">
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(180deg,#ffd27a,#c97a00)", color: "#1a1200", boxShadow: "0 0 14px rgba(245,158,11,.45)" }}><Calendar className="w-4 h-4" /></span>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-black uppercase tracking-wider mb-0.5"
          style={{ fontFamily: "Oswald, sans-serif", color: "#f59e0b", fontSize: "0.6rem", letterSpacing: "0.14em" }}>
          Flashback — {data.unitsAgo} {data.unit} ago
        </div>
        <div className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
          <span className="font-bold" style={{ color: "#fff" }}>{data.winnerName}</span> beat{" "}
          <span className="font-bold" style={{ color: "#fff" }}>{data.loserName}</span>
          {data.stake > 0 && <> for {data.stake} pts</>}
          {data.wasUpsetWin && <span className="ml-1" style={{ color: "#a855f7" }}>· upset win</span>}
        </div>
      </div>
    </PmCard>
  );
}

// ── FRESHNESS BAR ────────────────────────────────────────────────────────────
// "Welcome back, X — last visit Y ago" plus a "N new" count against the
// already-loaded Pulse feed. Reads GET /hub/visit/:id, which also stamps
// last_seen_hub_at = now() server-side as a side effect of this call — same
// "loading the page IS the seeing" shape as TrophyCaseSection's own fetch,
// simpler than TKDL LIVE's separate mark-seen because there's no render step
// to wait for here.
function FreshnessBar({ playerName, previousVisit, pulse }: { playerName: string; previousVisit: string | null; pulse: PulseItem[] | null }) {
  const newCount = previousVisit && pulse
    ? pulse.filter(p => new Date(p.timestamp).getTime() > new Date(previousVisit).getTime()).length
    : 0;

  return (
    <div className="flex items-center justify-between flex-wrap gap-2 px-1">
      <div className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
        Welcome back, <span className="font-bold" style={{ color: "#fff" }}>{playerName}</span>
        {previousVisit && <> — last visit {timeAgo(previousVisit)}</>}
      </div>
      {newCount > 0 && (
        <span className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", letterSpacing: "0.1em", color: "#34e0c9", background: "rgba(52,224,201,0.1)", border: "1px solid rgba(52,224,201,0.3)", padding: "0.25rem 0.6rem", borderRadius: 999 }}>
          {newCount} new since then
        </span>
      )}
    </div>
  );
}

// ── STATE BAND — viewer-relative ─────────────────────────────────────────────
// Leads with whoever's logged in, not always the league leader. If you're on
// the board: your rank/points/streak/form plus who you're chasing (or, if
// you're #1, who's chasing you). If you're not logged in, not on the board
// (e.g. eliminated), or the leaderboard hasn't loaded yet, this falls back to
// the original "season leader" framing — same graceful-degradation shape
// TrophyCaseSection already uses for logged-out visitors.
function StateBand({ leaderboard, summary, currentPlayer, form }: {
  leaderboard: any[] | undefined;
  summary: any;
  currentPlayer: { playerId: number; playerName: string } | null;
  form: boolean[] | null;
}) {
  const active   = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const atRisk   = active.filter(e => e.points > 0 && e.points < 20);
  const myIndex  = currentPlayer ? active.findIndex(e => e.playerId === currentPlayer.playerId) : -1;
  const viewer   = myIndex >= 0 ? active[myIndex] : null;
  const leader   = active[0] ?? null;
  const tierGlow = TIER_GLOW[(viewer ?? leader)?.tier ?? "Bronze"] ?? "#cd7f32";

  // Chase context: above you if you're not #1, below you (being chased) if
  // you are. Null when there's nobody in that direction (e.g. sole player).
  let chase: { label: string; name: string; points: number; gap: number; iAmAhead: boolean } | null = null;
  if (viewer && myIndex === 0 && active[1]) {
    chase = { label: "Being Chased", name: active[1].playerName, points: active[1].points, gap: viewer.points - active[1].points, iAmAhead: true };
  } else if (viewer && myIndex > 0) {
    const target = active[myIndex - 1];
    chase = { label: "Chasing", name: target.playerName, points: target.points, gap: target.points - viewer.points, iAmAhead: false };
  }

  const person   = viewer ?? leader;
  const heading  = viewer ? "YOUR STANDING" : "SEASON LEADER";


  return (
    <div className="relative overflow-hidden fade-in-up" style={{
      borderRadius: 24,
      border: `1px solid ${tierGlow}44`,
      background: `linear-gradient(160deg, ${tierGlow}2e 0%, #14102a 42%, #06060b 100%)`,
      boxShadow: `0 20px 50px rgba(0,0,0,.55), 0 0 50px ${tierGlow}14`,
    }}>
      <Glow x="85%" y="12%" color={tierGlow} size={460} opacity={0.32} />
      <Glow x="5%" y="70%" color="#a855f7" size={420} opacity={0.3} />
      <Glow x="80%" y="110%" color="#ff005c" size={360} opacity={0.16} />
      <DartboardBackdrop size={520} opacity={0.07} style={{ right: -190, top: -80, transform: "rotate(8deg)" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.05, background: "repeating-linear-gradient(115deg,#fff 0 1px,transparent 1px 12px)" }} />

      <div className="relative flex items-center justify-between flex-wrap gap-2" style={{ padding: "1.1rem 1.25rem 0", zIndex: 1 }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="live-dot" style={{ width: 6, height: 6 }} />
          <span className="pm-lab" style={{ color: "#ffd24a" }}>{heading}</span>
          <span className="pm-lab">· {summary?.currentSeasonName ?? "Season"}</span>
        </div>
        <Link href="/leaderboard" className="pm-chip" style={{ color: "#ffd24a", borderColor: "rgba(255,210,74,.45)" }}>Full table →</Link>
      </div>

      <div className="relative" style={{ padding: "0.9rem 1.25rem 1.25rem", zIndex: 1 }}>
        {person ? (
          <div className="flex flex-col gap-3.5">
            <div className="flex items-center gap-4 min-w-0">
              <div className="relative shrink-0" style={{ width: 82, height: 82 }}>
                <div className="absolute pointer-events-none" style={{ inset: -7, borderRadius: "50%", background: `conic-gradient(from 0deg, transparent, ${tierGlow}99, transparent 30%, #c4b5fd99, transparent 65%)`, filter: "blur(6px)" }} />
                <div className="relative w-full h-full rounded-full" style={{ padding: 4, background: `conic-gradient(from 200deg, ${tierGlow}, #c4b5fd, ${tierGlow}, #ffffff, ${tierGlow})` }}>
                  <div className="w-full h-full rounded-full flex items-center justify-center" style={{ background: "radial-gradient(circle at 35% 30%, #2f2850, #0f0d18)" }}>
                    <span className="pm-chrome" style={{ fontFamily: "Oswald, sans-serif", fontSize: 36, fontWeight: 700 }}>{person.playerName.slice(0, 1).toUpperCase()}</span>
                  </div>
                </div>
                <div className="absolute flex items-center justify-center" style={{ right: -6, bottom: -2, width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(180deg,#ffe58a,#d99a00)", color: "#1a1200", fontFamily: "Oswald, sans-serif", fontSize: 13, border: "2px solid #0c0a12", boxShadow: "0 0 12px rgba(255,210,74,.6)" }}>
                  #{viewer ? myIndex + 1 : 1}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                {(person as any).title && <div className="pm-metal" style={{ fontFamily: "Oswald, sans-serif", fontStyle: "italic", fontSize: 16 }}>“{(person as any).title}”</div>}
                <h1 className="pm-chrome uppercase leading-none truncate"
                  style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "clamp(2.2rem, 10vw, 3.6rem)", letterSpacing: "0.02em", filter: "drop-shadow(0 4px 10px rgba(0,0,0,.6))" }}>
                  {person.playerName}
                </h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap"><TierBadge tier={person.tier} /></div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {([
                { label: "Points", value: person.points, color: "#ff5c93", bg: "linear-gradient(180deg,#2a0f1d,#12080f)" },
                { label: "ELO", value: person.elo ?? 0, color: "#7fb4ff", bg: "linear-gradient(180deg,#0e1830,#080b14)" },
                { label: "W–L", value: `${person.wins}–${person.losses}`, color: "#e4e0f0", bg: "linear-gradient(180deg,#1b1828,#0c0a12)" },
              ] as const).map(p => (
                <div key={p.label} style={{ padding: 1, borderRadius: 16, background: `linear-gradient(140deg, ${p.color}, ${p.color}26 50%, ${p.color})` }}>
                  <div style={{ borderRadius: 15, padding: "10px 12px", background: p.bg }}>
                    <span className="pm-lab">{p.label}</span>
                    <div className="pm-num tabular-nums" style={{ fontSize: 30, color: p.color, textShadow: `0 0 16px ${p.color}80`, marginTop: 3 }}>{p.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {viewer && form && form.length > 0 && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {form.map((won, i) => (
                    <span key={i} className="w-6 h-6 rounded-md flex items-center justify-center" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.68rem",
                      background: won ? "linear-gradient(180deg, rgba(74,222,128,.35), rgba(74,222,128,.08))" : "linear-gradient(180deg, rgba(255,107,107,.35), rgba(255,107,107,.08))",
                      border: `1px solid ${won ? "rgba(74,222,128,.6)" : "rgba(255,107,107,.6)"}`, color: won ? "#b9ffd0" : "#ffc2c2" }}>{won ? "W" : "L"}</span>
                  ))}
                </div>
                <span className="pm-lab" style={{ fontSize: 9 }}>Last {form.length}</span>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {(person as any).currentStreak >= 2 && (
                <span className="flex items-center gap-2 px-3 py-2 rounded-2xl" style={{ background: "linear-gradient(90deg, rgba(255,92,147,.3), rgba(255,92,147,.05))", border: "1px solid rgba(255,92,147,.5)", color: "#ffd0df", fontFamily: "Oswald, sans-serif", fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  <Flame className="w-4 h-4" style={{ color: "#ff7aa6" }} />{(person as any).currentStreak}-win streak
                </span>
              )}
              {atRisk.length > 0 && (
                <span className="flex items-center gap-2 px-3 py-2 rounded-2xl" style={{ background: "linear-gradient(90deg, rgba(255,107,107,.2), rgba(255,107,107,.04))", border: "1px solid rgba(255,107,107,.45)", color: "#ffc2c2", fontFamily: "Oswald, sans-serif", fontSize: 13, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  <AlertTriangle className="w-4 h-4" /> {atRisk.length} in the danger zone
                </span>
              )}
            </div>

            {chase && (
              <div style={{ padding: 1, borderRadius: 16, background: "linear-gradient(140deg, #ffd24a, rgba(255,210,74,.12) 50%, #ffd24a)" }}>
                <div className="flex items-center justify-between gap-3" style={{ borderRadius: 15, padding: "12px 14px", background: "linear-gradient(180deg,#221a0a,#0f0b05)" }}>
                  <div className="min-w-0">
                    <span className="pm-lab" style={{ color: "#ffd24a" }}>{chase.label}</span>
                    <div className="truncate" style={{ fontFamily: "Oswald, sans-serif", fontSize: 18, color: "#fff", marginTop: 2 }}>{chase.name} <span style={{ color: "#a9a4bd", fontSize: 13 }}>· {chase.points} pts</span></div>
                    <Link href="/h2h" style={{ fontFamily: "Oswald, sans-serif", fontSize: 11, color: "#ffd24a", letterSpacing: "0.1em", textTransform: "uppercase" }}>Compare head to head →</Link>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="pm-num pm-metal" style={{ fontSize: 34 }}>{chase.gap}</div>
                    <div style={{ fontSize: 11, color: "#a9a4bd" }}>{chase.iAmAhead ? "point lead" : "points back"}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif", fontSize: "1rem", padding: "2rem 0" }}>
            No matches played yet — start the season!
          </div>
        )}
      </div>
    </div>
  );
}

// ── QUICK ACTIONS — the things a player actually DOES ────────────────────────
// The old Hub was purely a read surface — nothing on it let you act. Submit
// Match and Practice are always-on routes; Match Scorer joins them only once
// that feature's switched on, same live_scorer_enabled flag the sidebar's
// Play section already gates on. (The flag's own name stayed as-is — only
// the user-facing "Live Scorer" label was renamed to "Match Scorer", since
// nothing about it is actually live/spectator-visible; see feature-flags.tsx.)
function QuickActions({ liveScorerEnabled }: { liveScorerEnabled: boolean }) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <Link href="/submit">
        <span className="flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
          style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#1a1200", background: "linear-gradient(180deg, #ffe58a, #e0a800)", padding: "0.75rem 1.3rem", borderRadius: 999, boxShadow: "0 0 18px rgba(255,210,74,.45), inset 0 1px 0 rgba(255,255,255,.5)" }}>
          <Plus className="w-4 h-4" /> Submit a Match
        </span>
      </Link>
      <Link href="/practice">
        <span className="flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
          style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#e4e0f0", background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02))", border: "1px solid rgba(255,255,255,0.18)", padding: "0.75rem 1.3rem", borderRadius: 999, boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}>
          <Dumbbell className="w-4 h-4" /> Practice
        </span>
      </Link>
      {liveScorerEnabled && (
        <Link href="/play">
          <span className="flex items-center gap-2 cursor-pointer transition-all hover:-translate-y-0.5"
            style={{ fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#e4e0f0", background: "linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.02))", border: "1px solid rgba(255,255,255,0.18)", padding: "0.75rem 1.3rem", borderRadius: 999, boxShadow: "inset 0 1px 0 rgba(255,255,255,.08)" }}>
            <Swords className="w-4 h-4" /> Match Scorer
          </span>
        </Link>
      )}
    </div>
  );
}

// ── PRIORITY NUDGE + FOR YOU RAIL ────────────────────────────────────────────
// One ranked signal gets promoted to a full-width banner; everything else
// relevant renders as a smaller card in the rail below it. Both read from the
// same small set of per-player signals (TKDL LIVE, an active Tour run, pinned
// achievements, coins/cosmetics, current streak) — nothing here is exhaustive
// browsing, only what's real and applies to this player right now.
type HubSpotlight = { available: boolean; hasNewEdition: boolean; title: string | null };
type TourRun = { id: number; status: string; difficulty: string; tour_name: string; emoji: string; updated_at: string };
type PlayerCosmetics = { ownedIds: string[]; equippedNameStyleId: string | null; equippedProfileIconId: string | null };
type PlayerCurrency = { cardPoints: number };
type PinnedAchievement = { system: string; key: string; name: string; icon: string; rarity: string | null };
// GET /hub/on-this-day/:playerId — null on the (overwhelming majority of)
// days with no anniversary match; see routes/hub.ts for the query and its
// singles+Team-matches-only scope.
type OnThisDayMatch = {
  matchId: number; playedAt: string; yearsAgo: number; wasWin: boolean;
  opponentId: number; opponentName: string; gameType: string; eloChange: number;
};

function ForYouZone({ currentPlayer, myStreak }: { currentPlayer: { playerId: number; playerName: string } | null; myStreak: number }) {
  const catalog = useCosmeticsCatalog();
  const { data: spotlight } = useFetch<HubSpotlight>("/api/broadcast/hub-spotlight");
  const { data: tourRuns } = useFetch<TourRun[]>(currentPlayer ? `/api/tour/runs/${currentPlayer.playerId}` : null);
  // Card Clash can be disabled via the admin kill switch, in which case this
  // 403s — without tracking that separately from "no currency fetched yet",
  // the wallet card below would show a plain "0 coins", indistinguishable
  // from a player who genuinely has none.
  const { data: currency, error: currencyError } = useFetch<PlayerCurrency>(currentPlayer ? `/api/card-clash/shop/currency/${currentPlayer.playerId}` : null);
  const { data: cosmetics } = useFetch<PlayerCosmetics>(currentPlayer ? `/api/players/${currentPlayer.playerId}/cosmetics` : null);
  const { data: pinsData } = useFetch<{ pins: PinnedAchievement[] }>(currentPlayer ? `/api/players/${currentPlayer.playerId}/pinned-achievements` : null);
  const { data: onThisDay } = useFetch<OnThisDayMatch | null>(currentPlayer ? `/api/hub/on-this-day/${currentPlayer.playerId}` : null);

  if (!currentPlayer) return null;

  const activeRun = tourRuns?.find(r => r.status === "active") ?? null;
  const equippedName = catalog.find(c => c.id === cosmetics?.equippedNameStyleId);
  const equippedIcon = catalog.find(c => c.id === cosmetics?.equippedProfileIconId);
  const EquippedIconComp = equippedIcon?.iconKey ? PROFILE_ICON_MAP[equippedIcon.iconKey] : null;
  const pins = pinsData?.pins ?? [];

  // Priority order for the single promoted nudge: a new broadcast > an active
  // tour run to resume > an on-this-day anniversary match (rare enough — one
  // specific calendar day a year — that it deserves top billing over an
  // ordinary streak when it does fire) > a live win streak. Whichever wins is
  // excluded from the rail below so nothing appears twice.
  type Nudge = "tkdl" | "tour" | "onThisDay" | "streak" | null;
  const nudge: Nudge = spotlight?.available && spotlight.hasNewEdition ? "tkdl"
    : activeRun ? "tour"
    : onThisDay ? "onThisDay"
    : myStreak >= 3 ? "streak"
    : null;

  const railCards: React.ReactNode[] = [];

  if (pins.length > 0) {
    railCards.push(
      <div key="trophy" className="rounded-xl px-4 py-3.5 flex flex-col gap-2" style={{ background: "rgba(255,210,74,0.06)", border: "1px solid rgba(255,210,74,0.28)" }}>
        <div className="flex items-center gap-2">
          <Pin className="w-3.5 h-3.5" style={{ color: "#ffd24a" }} />
          <span className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.54rem", letterSpacing: "0.13em", color: "#ffd24a" }}>Trophy Case</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {pins.slice(0, 5).map(p => <span key={`${p.system}-${p.key}`} className="text-lg leading-none">{p.icon}</span>)}
        </div>
        <Link href="/account?tab=achievements" className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Manage →</Link>
      </div>
    );
  }

  railCards.push(
    <div key="wallet" className="rounded-xl px-4 py-3.5 flex flex-col gap-2" style={{ background: "rgba(0,200,160,0.06)", border: "1px solid rgba(0,200,160,0.28)" }}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.54rem", letterSpacing: "0.13em", color: "#00c8a0" }}>
          <Coins className="w-3.5 h-3.5" /> Wallet
        </span>
        <Link href="/account?tab=cosmetics" className="text-xs font-bold uppercase" style={{ color: "#00c8a0", opacity: 0.7, fontFamily: "Oswald, sans-serif", fontSize: "0.56rem" }}>Shop →</Link>
      </div>
      {currencyError ? (
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Coins unavailable right now</span>
      ) : (
        <span className="font-black tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.5rem", color: "#ffd24a", textShadow: "0 0 16px rgba(255,210,74,0.4)" }}>
          {currency?.cardPoints ?? 0}<span className="text-xs font-normal ml-1" style={{ color: "rgba(255,255,255,0.3)" }}>coins</span>
        </span>
      )}
      {(equippedName || equippedIcon) ? (
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          {equippedName?.name}{equippedName && EquippedIconComp ? " · " : ""}{EquippedIconComp && equippedIcon?.name}
        </div>
      ) : (
        <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Nothing equipped yet</div>
      )}
    </div>
  );

  if (activeRun && nudge !== "tour") {
    railCards.push(
      <div key="tour" className="rounded-xl px-4 py-3.5 flex flex-col gap-2" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.28)" }}>
        <span className="flex items-center gap-1.5 font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.54rem", letterSpacing: "0.13em", color: "#a5b4fc" }}>
          <Star className="w-3.5 h-3.5" /> Tour Mode
        </span>
        <span className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.9)" }}>{activeRun.emoji} {activeRun.tour_name}</span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{activeRun.difficulty} · in progress</span>
        <Link href={`/tour/${activeRun.id}`} className="text-xs font-black uppercase" style={{ color: "#a5b4fc", fontFamily: "Oswald, sans-serif", fontSize: "0.54rem" }}>Resume →</Link>
      </div>
    );
  }

  if (spotlight?.available && nudge !== "tkdl") {
    railCards.push(
      <div key="tkdl" className="rounded-xl px-4 py-3.5 flex flex-col gap-2" style={{ background: "rgba(255,210,74,0.06)", border: "1px solid rgba(255,210,74,0.28)" }}>
        <span className="flex items-center gap-1.5 font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.54rem", letterSpacing: "0.13em", color: "#ffd24a" }}>
          <Sparkles className="w-3.5 h-3.5" /> TKDL LIVE
        </span>
        <span className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.9)" }}>Catch up on the latest broadcast</span>
        {spotlight.title && <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{spotlight.title}</span>}
        <Link href="/tkdl-live" className="text-xs font-black uppercase" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif", fontSize: "0.54rem" }}>Watch →</Link>
      </div>
    );
  }

  // Previously, when onThisDay was outranked by a tkdl/tour nudge (see the
  // priority order above), the anniversary match data was fetched but never
  // rendered anywhere — no hero, no rail card — so it silently vanished for
  // that one calendar day. Mirrors the tour/tkdl/streak rail-card fallback.
  if (onThisDay && nudge !== "onThisDay") {
    railCards.push(
      <div key="onThisDay" className="rounded-xl px-4 py-3.5 flex flex-col gap-2" style={{ background: "rgba(255,210,74,0.06)", border: "1px solid rgba(255,210,74,0.28)" }}>
        <span className="flex items-center gap-1.5 font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.54rem", letterSpacing: "0.13em", color: "#ffd24a" }}>
          <Calendar className="w-3.5 h-3.5" /> On This Day
        </span>
        <span className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.9)" }}>
          {onThisDay.yearsAgo} year{onThisDay.yearsAgo === 1 ? "" : "s"} ago
        </span>
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
          {onThisDay.wasWin
            ? `You beat ${onThisDay.opponentName} today, ${onThisDay.yearsAgo} year${onThisDay.yearsAgo === 1 ? "" : "s"} back`
            : `${onThisDay.opponentName} beat you today, ${onThisDay.yearsAgo} year${onThisDay.yearsAgo === 1 ? "" : "s"} back`}
        </span>
        <Link href={`/h2h?p1=${currentPlayer.playerId}&p2=${onThisDay.opponentId}`} className="text-xs font-black uppercase" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif", fontSize: "0.54rem" }}>See rivalry →</Link>
      </div>
    );
  }

  if (myStreak >= 2 && nudge !== "streak") {
    railCards.push(
      <div key="streak" className="rounded-xl px-4 py-3.5 flex flex-col gap-2" style={{ background: "rgba(255,0,92,0.06)", border: "1px solid rgba(255,0,92,0.25)" }}>
        <span className="flex items-center gap-1.5 font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.54rem", letterSpacing: "0.13em", color: "#ff8fb4" }}>
          <Flame className="w-3.5 h-3.5" /> Your Streak
        </span>
        <span className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.82rem", color: "rgba(255,255,255,0.9)" }}>{myStreak} wins running</span>
      </div>
    );
  }

  return (
    <>
      {nudge && (
        <div className="relative overflow-hidden rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap fade-in-up"
          style={{ background: "linear-gradient(115deg, rgba(255,210,74,0.14), rgba(255,0,92,0.06))", border: "1px solid rgba(255,210,74,0.35)" }}>
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,210,74,0.18)" }}>
              {nudge === "tkdl" && <Sparkles className="w-5 h-5" style={{ color: "#ffd24a" }} />}
              {nudge === "tour" && <Star className="w-5 h-5" style={{ color: "#ffd24a" }} />}
              {nudge === "onThisDay" && <Calendar className="w-5 h-5" style={{ color: "#ffd24a" }} />}
              {nudge === "streak" && <Flame className="w-5 h-5" style={{ color: "#ffd24a" }} />}
            </div>
            <div className="min-w-0">
              <div className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", letterSpacing: "0.16em", color: "#ffd24a" }}>
                {nudge === "tkdl" && "TKDL LIVE · New Edition"}
                {nudge === "tour" && `Tour Mode · ${activeRun?.tour_name}`}
                {nudge === "onThisDay" && `On This Day · ${onThisDay?.yearsAgo} year${onThisDay?.yearsAgo === 1 ? "" : "s"} ago`}
                {nudge === "streak" && "On A Run"}
              </div>
              <div className="font-black uppercase truncate" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", color: "#fff" }}>
                {/* Was "This week's broadcast just dropped" — wrong cadence
                    claim. TKDL LIVE isn't weekly: by default it's one
                    episode a day (broadcast_single_daily_episode, the
                    "night" slot), or up to three a day (midday/evening/
                    night) if an admin turns that off — and even then a new
                    Edition only actually builds once enough has changed
                    (the Edition Change Score threshold in config-math.ts),
                    so it's results-driven within that daily cadence rather
                    than guaranteed on a fixed clock. "New" is the only claim
                    that's true regardless of which mode is active. */}
                {nudge === "tkdl" && "New broadcast just dropped"}
                {nudge === "tour" && `${activeRun?.difficulty} — resume where you left off`}
                {nudge === "onThisDay" && (onThisDay?.wasWin
                  ? `You beat ${onThisDay?.opponentName} today, ${onThisDay?.yearsAgo} year${onThisDay?.yearsAgo === 1 ? "" : "s"} back`
                  : `${onThisDay?.opponentName} beat you today, ${onThisDay?.yearsAgo} year${onThisDay?.yearsAgo === 1 ? "" : "s"} back`)}
                {nudge === "streak" && `${myStreak} wins in a row — keep it going`}
              </div>
            </div>
          </div>
          <Link href={
            nudge === "tkdl" ? "/tkdl-live"
            : nudge === "tour" ? `/tour/${activeRun?.id}`
            : nudge === "onThisDay" ? `/h2h?p1=${currentPlayer.playerId}&p2=${onThisDay?.opponentId}`
            : "/submit"
          }>
            <span className="font-black uppercase cursor-pointer" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.68rem", letterSpacing: "0.12em", color: "#1a0f00", background: "#ffd24a", padding: "0.6rem 1.2rem", borderRadius: 999, whiteSpace: "nowrap" }}>
              {nudge === "tkdl" ? "Watch now →" : nudge === "tour" ? "Resume →" : nudge === "onThisDay" ? "See rivalry →" : "Play now →"}
            </span>
          </Link>
        </div>
      )}

      {railCards.length > 0 && (
        <div>
          <Chapter title={nudge ? "Also for you" : "For you"} accent="#c4b5fd" />
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(railCards.length, 4)}, minmax(200px, 1fr))`, overflowX: "auto" }}>
            {railCards}
          </div>
        </div>
      )}
    </>
  );
}

// ── PULSE — one merged feed instead of six parallel cards ───────────────────
type PulseItem = {
  id: string;
  category: "league" | "tour" | "achievements" | "community";
  icon: string;
  title: string;
  subtitle: string;
  timestamp: string;
};

const PULSE_CATEGORY_COLOR: Record<PulseItem["category"], string> = {
  league: "#ff005c", tour: "#ffd24a", achievements: "#a855f7", community: "#22c55e",
};
const PULSE_TABS: { key: "all" | PulseItem["category"]; label: string }[] = [
  { key: "all", label: "All" }, { key: "league", label: "League" }, { key: "tour", label: "Tour" },
  { key: "achievements", label: "Achievements" }, { key: "community", label: "Community" },
];

function PulseSection({ pulse, loading, previousVisit, currentPlayerId }: {
  pulse: PulseItem[] | null;
  loading: boolean;
  previousVisit: string | null;
  currentPlayerId: number | null;
}) {
  const [tab, setTab] = useState<"all" | PulseItem["category"]>("all");
  const [reacted, setReacted] = useState<Set<string>>(new Set());
  // Short by default: the first few, then "Show more" adds a page at a time.
  const PULSE_PAGE = 5;
  const [shown, setShown] = useState(PULSE_PAGE);

  const allItems = (pulse ?? []).filter(p => tab === "all" || p.category === tab);
  const items = allItems.slice(0, shown);
  const hiddenCount = allItems.length - items.length;
  const previousVisitMs = previousVisit ? new Date(previousVisit).getTime() : null;
  let dividerPlaced = false;

  async function react(postId: string) {
    if (!currentPlayerId) return;
    const numericId = postId.replace("post-", "");
    setReacted(prev => { const next = new Set(prev); next.has(postId) ? next.delete(postId) : next.add(postId); return next; });
    try {
      await fetch(`/api/community/posts/${numericId}/react`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "👍" }),
      });
    } catch { /* optimistic UI already toggled; a failed react just doesn't persist */ }
  }

  return (
    <div>
    <Chapter title="League pulse" accent="#ff5c93" aside={<span className="pm-chip" style={{ color: "#ffc2d6", borderColor: "rgba(255,92,147,.45)" }}><span className="live-dot" /> Live</span>} />
    <div className="section-card" style={{ ["--pm-acc" as string]: "#ff5c93" } as React.CSSProperties}>
      <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2.5">
        <div className="flex gap-1.5 flex-wrap">
          {PULSE_TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setShown(PULSE_PAGE); }}
              className="font-black uppercase transition-all"
              style={{
                fontFamily: "Oswald, sans-serif", fontSize: "0.58rem", letterSpacing: "0.06em", padding: "0.32rem 0.7rem", borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.1)",
                color: tab === t.key ? "#1a1200" : "#cfcade",
                background: tab === t.key ? "linear-gradient(180deg,#ffe58a,#e0a800)" : "rgba(255,255,255,0.05)",
                borderColor: tab === t.key ? "#ffd24a" : "rgba(255,255,255,0.12)",
                boxShadow: tab === t.key ? "0 0 12px rgba(255,210,74,.4)" : undefined,
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {loading ? (
          <div className="py-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Nothing here yet</div>
        ) : items.map(item => {
          const color = PULSE_CATEGORY_COLOR[item.category];
          const isFresh = previousVisitMs !== null && new Date(item.timestamp).getTime() > previousVisitMs;
          const showDivider = !isFresh && !dividerPlaced && items.some(i => previousVisitMs !== null && new Date(i.timestamp).getTime() > previousVisitMs);
          if (showDivider) dividerPlaced = true;
          return (
            <div key={item.id}>
              {showDivider && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px" style={{ background: "rgba(52,224,201,0.25)" }} />
                  <span className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.52rem", letterSpacing: "0.12em", color: "#34e0c9", whiteSpace: "nowrap" }}>Since your last visit ↑</span>
                  <div className="flex-1 h-px" style={{ background: "rgba(52,224,201,0.25)" }} />
                </div>
              )}
              <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
                style={{ background: isFresh ? "rgba(52,224,201,0.03)" : "rgba(255,255,255,0.02)", border: `1px solid ${isFresh ? "rgba(52,224,201,0.25)" : "rgba(255,255,255,0.05)"}` }}>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm" style={{ background: `${color}22`, color }}>{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs leading-snug truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{item.title}</div>
                  <div className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.62rem" }}>
                    <span className="font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color, fontSize: "0.56rem" }}>{item.category}</span>
                    {item.subtitle && <>· {item.subtitle}</>} · {timeAgo(item.timestamp)}
                  </div>
                </div>
                {item.category === "community" && currentPlayerId && (
                  <button onClick={() => react(item.id)}
                    className="flex items-center gap-1 shrink-0 transition-all"
                    style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.62rem", fontWeight: 800, borderRadius: 999, padding: "0.22rem 0.55rem", border: "1px solid rgba(255,255,255,0.1)", color: reacted.has(item.id) ? "#fff" : "rgba(255,255,255,0.35)", background: reacted.has(item.id) ? "rgba(255,255,255,0.08)" : "transparent" }}>
                    <ThumbsUp className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!loading && (hiddenCount > 0 || shown > PULSE_PAGE) && (
        <div className="flex justify-center gap-2 mt-3">
          {hiddenCount > 0 && (
            <button onClick={() => setShown(n => n + 10)} className="pulse-more">
              Show more <span>+{Math.min(10, hiddenCount)}{hiddenCount > 10 ? ` of ${hiddenCount}` : ""}</span>
            </button>
          )}
          {shown > PULSE_PAGE && (
            <button onClick={() => setShown(PULSE_PAGE)} className="pulse-more ghost">Show less</button>
          )}
        </div>
      )}
    </div>
    </div>
  );
}

// ── EXPLORE strip (condensed) + REFERENCE row ────────────────────────────────
function ExploreAndReference({ settings }: { settings: any }) {
  const modes: { key: string; label: string; icon: React.ReactNode; accent: string; href: string; show: boolean }[] = [
    { key: "practice",   label: "Practice",     icon: <Dumbbell className="w-3 h-3" />,     accent: "#00e5a0", href: "/practice",    show: true },
    { key: "master501",  label: "Master-501",   icon: <Zap className="w-3 h-3" />,          accent: "#00c8a0", href: "/master501",   show: true },
    // Card Clash defaults to hidden (not true like the other toggles below) —
    // it's under an explicit kill switch, so a settings-load hiccup or a
    // failed fetch should never flash its tile back into view.
    { key: "cardclash",  label: "Card Clash",   icon: <Layers className="w-3 h-3" />,       accent: "#f97316", href: "/card-clash",  show: !CARD_CLASH_BENCHED && (settings?.card_clash_enabled ?? false) },
    { key: "doubles",    label: "Doubles",      icon: <Users className="w-3 h-3" />,        accent: "#0066ff", href: "/leaderboard?mode=doubles", show: settings?.doubles_event_enabled ?? true },
    { key: "shiftwars",  label: "Shift Wars",   icon: <Building2 className="w-3 h-3" />,    accent: "#22c55e", href: "/leaderboard?mode=shiftwars", show: settings?.shift_wars_enabled ?? true },
    { key: "bossbattle", label: "Boss Battle",  icon: <Skull className="w-3 h-3" />,        accent: "#ef4444", href: "/boss-battle", show: settings?.boss_battle_enabled ?? true },
    { key: "boardcurse", label: "Board Curse",  icon: <Ghost className="w-3 h-3" />,        accent: "#8b5cf6", href: "/board-curse", show: settings?.board_curse_enabled ?? true },
    { key: "shadowleague", label: "Shadow League", icon: <Trophy className="w-3 h-3" />,    accent: "#22d3ee", href: "/shadow-league", show: true },
    // Tour/Community/Shadow Bot added 2026-09-25 — all three were fully built
    // pages with real routes, but had no entry point anywhere on the Hub:
    // Tour only ever appeared in ForYouZone's rail, and only once a player
    // already had an active run (see the "activeRun" card above) — nothing
    // let a player who'd never started one discover or enter Tour Mode from
    // here. Community and Shadow Bot (1v1 vs AI, distinct from the
    // already-linked Shadow League standings) had no Hub link at all.
    // Icons match this app's existing convention for each (layout.tsx's
    // main nav uses the same Star/CircuitBoard/MessageSquare glyphs). Colors
    // were picked to stay visually distinct from every OTHER chip already in
    // this specific 11-item strip (a 2026-09-25 visual-consistency pass
    // checked, and every accent below is unique in this array) — Tour's
    // #a855f7 happens to also match layout.tsx's mobile bottom-nav, but
    // Shadow Bot and Community intentionally don't reuse layout.tsx's own
    // sidebar-section colors (#22d3ee, #22c55e) because those are already
    // spoken for by the neighbouring Shadow League and Shift Wars chips
    // right here — reusing them would make two chips in this one strip look
    // identical, which matters more for THIS strip's job (telling 11 modes
    // apart at a glance) than matching a color used one screen away.
    { key: "tour",       label: "Tour",         icon: <Star className="w-3 h-3" />,         accent: "#a855f7", href: "/tour",         show: true },
    { key: "shadowbot",  label: "Shadow Bot",   icon: <CircuitBoard className="w-3 h-3" />, accent: "#00d4ff", href: "/shadow-bot",   show: true },
    { key: "community",  label: "Community",    icon: <MessageSquare className="w-3 h-3" />, accent: "#ff005c", href: "/community",   show: true },
  ];

  const reference = [
    { label: "Hall of Fame", icon: <Award className="w-3 h-3" />, href: "/hall-of-fame" },
    { label: "Seasons",      icon: <History className="w-3 h-3" />, href: "/seasons" },
    { label: "Rules",        icon: <BookOpen className="w-3 h-3" />, href: "/rules" },
  ];

  return (
    <div>
      <Chapter title="Explore" accent="#3ee0b4" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {modes.filter(m => m.show).map(m => (
          <Link key={m.key} href={m.href}>
            <div className="flex items-center gap-2.5 cursor-pointer transition-all hover:-translate-y-0.5"
              style={{ padding: "12px 13px", borderRadius: 16, border: `1px solid ${m.accent}55`,
                background: `radial-gradient(120% 90% at 100% 0%, ${m.accent}33, transparent 60%), linear-gradient(180deg, #17141f, #0d0b13)`,
                boxShadow: "inset 0 1px 0 rgba(255,255,255,.08), 0 10px 24px rgba(0,0,0,.35)" }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${m.accent}26`, color: m.accent, boxShadow: `0 0 12px ${m.accent}44` }}>{m.icon}</span>
              <span className="uppercase" style={{ fontFamily: "Oswald, sans-serif", fontSize: 12.5, letterSpacing: "0.06em", color: "#fff", lineHeight: 1.15 }}>{m.label}</span>
            </div>
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap mt-3">
        <span className="pm-lab mr-1">Reference</span>
        {reference.map(r => (
          <Link key={r.label} href={r.href}>
            <span className="pm-chip cursor-pointer" style={{ minHeight: 32 }}>{r.icon} {r.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── MAIN HUB PAGE ──────────────────────────────────────────────────────────────

export default function Dashboard() {
  const currentPlayer = useCurrentPlayer();
  const { data: appSettings } = useSettings();

  const { data: summary }     = useGetStatsSummary();
  const { data: leaderboard } = useGetLeaderboard();
  const { data: recent }      = useGetRecentActivity();

  const { data: pulse, loading: pulseLoading } = useFetch<PulseItem[]>("/api/hub/pulse");
  const { data: visit } = useFetch<{ previousVisit: string | null }>(currentPlayer ? `/api/hub/visit/${currentPlayer.playerId}` : null);
  const { data: formData } = useFetch<{ results: boolean[] }>(currentPlayer ? `/api/hub/form/${currentPlayer.playerId}` : null);

  const active = leaderboard?.filter(e => e.status !== "ELIMINATED") ?? [];
  const top5   = active.slice(0, 5);
  const myEntry = currentPlayer ? active.find(e => e.playerId === currentPlayer.playerId) : null;
  const myStreak = (myEntry as any)?.currentStreak ?? 0;

  return (
    <div className="pm-page space-y-4">

      {currentPlayer && <FreshnessBar playerName={currentPlayer.playerName} previousVisit={visit?.previousVisit ?? null} pulse={pulse} />}

      <StateBand leaderboard={leaderboard} summary={summary} currentPlayer={currentPlayer} form={formData?.results ?? null} />

      <QuickActions liveScorerEnabled={appSettings?.live_scorer_enabled ?? false} />

      <MatchSpotlight />

      <ForYouZone currentPlayer={currentPlayer} myStreak={myStreak} />

      <PulseSection pulse={pulse} loading={pulseLoading} previousVisit={visit?.previousVisit ?? null} currentPlayerId={currentPlayer?.playerId ?? null} />

      <ExploreAndReference settings={appSettings} />

      <Flashback />

      <DailyDrill />
      <MonthlyLeagueReports compact />

      {/* ── LEADERBOARD + RECENT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="min-w-0">
          <Chapter title="Standings" accent="#ffd24a" aside={<Link href="/leaderboard" className="pm-chip" style={{ color: "#ffd24a", borderColor: "rgba(255,210,74,.45)" }}>View all →</Link>} />
          <PmCard accent="#ffd24a">
            {top5.map((entry, i) => {
              const medal = i === 0 ? "linear-gradient(180deg,#ffe58a,#d99a00)" : i === 1 ? "linear-gradient(180deg,#ffffff,#9aa6bd)" : i === 2 ? "linear-gradient(180deg,#f0b27a,#9c5a2a)" : "linear-gradient(180deg,#3a3550,#1d1a2b)";
              return (
                <Link key={entry.playerId} href={`/players/${entry.playerId}`}>
                  <div className="pm-row cursor-pointer transition-colors hover:bg-white/[0.03]" style={{ background: i === 0 ? "linear-gradient(90deg, rgba(255,210,74,.1), transparent 55%)" : undefined }}>
                    <div className="shrink-0 flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: "50%", background: medal, color: i < 3 ? "#141018" : "#e4e0f0", fontFamily: "Oswald, sans-serif", fontSize: 15, boxShadow: i < 3 ? "0 0 12px rgba(255,255,255,.15)" : undefined }}>{entry.position}</div>
                    <RankChange change={entry.positionChange} />
                    <div className="flex-1 min-w-0">
                      <div className={`uppercase truncate ${i === 0 ? "pm-metal" : ""}`} style={{ fontFamily: "Oswald, sans-serif", fontSize: 16, letterSpacing: "0.04em", color: i === 0 ? undefined : "#fff" }}>{entry.playerName}</div>
                      {(entry as any).title && <div className="truncate" style={{ fontSize: 12, color: "#a9a4bd", fontStyle: "italic" }}>{(entry as any).title}</div>}
                    </div>
                    <TierBadge tier={entry.tier} />
                    <span className="pm-num tabular-nums shrink-0" style={{ fontSize: 20, color: i === 0 ? "#ffd24a" : "#ff7aa6", minWidth: "2.6rem", textAlign: "right", textShadow: `0 0 10px ${i === 0 ? "rgba(255,210,74,.5)" : "rgba(255,92,147,.4)"}` }}>{entry.points}</span>
                  </div>
                </Link>
              );
            })}
            {top5.length === 0 && <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>No data yet</div>}
          </PmCard>
        </div>

        <div className="min-w-0">
          <Chapter title="Recent matches" accent="#4ade80" />
          <PmCard accent="#4ade80">
            {recent?.slice(0, 6).map((m: any, i: number) => (
              <div key={m.matchId} className="pm-row relative fade-in-up" style={{ animationDelay: `${i * 50}ms`, background: "linear-gradient(90deg, rgba(74,222,128,.07), transparent 45%)" }}>
                <i className="absolute left-0 rounded" style={{ top: 10, bottom: 10, width: 3, background: "#4ade80", boxShadow: "0 0 10px #4ade80" }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap" style={{ fontFamily: "Oswald, sans-serif", fontSize: 15 }}>
                    {m.isTeamMatch ? (
                      <span className="uppercase" style={{ color: "#4ade80" }}>{m.winnerName}</span>
                    ) : (
                      <Link href={`/players/${m.winnerId}`} className="hover:underline uppercase" style={{ color: "#4ade80" }}>{m.winnerName}</Link>
                    )}
                    <span style={{ color: "#8b86a0", fontSize: 12, fontFamily: "Inter, sans-serif" }}>beat</span>
                    <span className="uppercase" style={{ color: "#e4e0f0" }}>{m.loserName}</span>
                    {m.isTeamMatch && <span className="pm-chip" style={{ minHeight: 18, padding: "0 6px", fontSize: 9, color: "#7ff5d3", borderColor: "rgba(62,224,180,.4)" }}>Team</span>}
                  </div>
                  <div className="truncate" style={{ fontSize: 12, color: "#a9a4bd", marginTop: 2 }}>{m.gameType ? `${m.gameType} · ` : ""}{format(new Date(m.playedAt), "d MMM, h:mm a")}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="pm-num" style={{ fontSize: 17, color: "#4ade80" }}>+{m.pointsAwarded ?? 0} pts</div>
                  <div style={{ fontSize: 11, color: "#9cc6ff", marginTop: 2 }}>{m.eloChange ? `${m.eloChange > 0 ? "+" : ""}${m.eloChange} ELO` : ""}</div>
                </div>
              </div>
            ))}
            {(!recent || recent.length === 0) && <div className="py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>No matches yet</div>}
          </PmCard>
        </div>
      </div>
    </div>
  );
}
