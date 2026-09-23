import {
  useListPlayers,
  useSubmitMatch,
  useGetPlayerStats,
  getGetLeaderboardQueryKey,
  getGetStatsSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getListMatchesQueryKey,
  getGetPlayerStatsQueryKey,
  getGetPlayerQueryKey,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Swords, AlertCircle, Crown, Skull, X, Trophy, Users, Target, Building2, Zap } from "lucide-react";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TierBadge } from "@/components/tier-badge";
import { useSettings } from "@/hooks/use-settings";
import { useCurrentPlayer } from "@/context/auth";

const TIER_COLOR: Record<string, string> = {
  Diamond:  "#38bdf8",
  Platinum: "#e2e8f0",
  Gold:     "#ffd24a",
  Silver:   "#94a3b8",
  Bronze:   "#b45309",
};

const formSchema = z.object({
  winnerId: z.coerce.number().min(1, "Select a winner"),
  loserId:  z.coerce.number().min(1, "Select a loser"),
  stake:    z.coerce.number().min(1, "Stake must be at least 1"),
  gameType: z.string().optional(),
  notes:    z.string().optional(),
}).refine(d => d.winnerId !== d.loserId, {
  message: "A player cannot play against themselves",
  path: ["loserId"],
});

type FormValues = z.infer<typeof formSchema>;

function useDoublesTeamsForSubmit() {
  const [teams, setTeams]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    fetch("/api/seasons/current?leagueType=doubles")
      .then(r => r.json())
      .then(season => {
        if (!season?.id) { setTeams([]); return null; }
        return fetch(`/api/seasons/${season.id}/doubles/teams`).then(r => r.json());
      })
      .then(data => { if (Array.isArray(data)) setTeams(data); })
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);
  return { teams, loading, reload };
}

function useShiftWarsTeamsForSubmit() {
  const [teams, setTeams]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    fetch("/api/shift-wars/teams")
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (Array.isArray(data)) setTeams(data); })
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);
  return { teams, loading, reload };
}

// ═══════════════════════════════════════════════════════════════════════
// Shared presentational pieces — used by all four submit modes (Singles,
// Doubles, Shift Wars, ad-hoc Team) so the "pop" pass lands consistently
// everywhere instead of only on the mode that got redesigned first. Pure
// display + light interaction only; each section still owns its own
// state, validation and submit logic exactly as before.
// ═══════════════════════════════════════════════════════════════════════

/** Generic fetch hook for the couple of endpoints here that aren't in the
 *  generated api-client — same pattern head-to-head.tsx and the Hub's
 *  support routes already use elsewhere in this app. */
function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!url) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) { setData(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [url]);
  return { data, loading };
}

/** Cursor-following tilt + light sheen on a card, mutating the DOM
 *  directly via refs (not React state) so hovering doesn't trigger a
 *  re-render of the whole grid on every pointer move. Pairs with the
 *  `.sm-tilt` class in index.css, which owns the sheen pseudo-element and
 *  reads the --mx/--my custom properties this sets. */
function useTilt<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el!.style.setProperty("--mx", `${x * 100}%`);
      el!.style.setProperty("--my", `${y * 100}%`);
      const rx = (0.5 - y) * 8, ry = (x - 0.5) * 8;
      el!.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-2px)`;
    }
    function onLeave() { el!.style.transform = ""; }
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);
  return ref;
}

function gtIcon(label: string): ReactNode {
  const l = label.toLowerCase();
  if (l.includes("cricket")) {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 4h16v16H4z" /><path d="M4 10h16M4 16h16M10 4v16M16 4v16" /></svg>;
  }
  if (l.includes("killer")) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}>
        <circle cx="9" cy="10" r="1.1" fill="currentColor" stroke="none" /><circle cx="15" cy="10" r="1.1" fill="currentColor" stroke="none" />
        <path d="M8 16c1-1.3 2.4-2 4-2s3 .7 4 2" />
        <path d="M4 8s2-4 8-4 8 4 8 4v5c0 5-3.6 8-8 9-4.4-1-8-4-8-9V8Z" />
      </svg>
    );
  }
  if (/\dv\d/.test(l)) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" />
        <path d="M2 20c0-3 2.5-5 6-5s6 2 6 5M10 20c0-3 2.5-5 6-5s6 2 6 5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

type Side = { name: string; sub?: string } | null;

/** The winner/loser matchup strip every mode shows at the top — same
 *  beveled treatment (backed by the app's existing .pdc-card system, not a
 *  parallel one) whichever mode is active. */
function MatchupStrip({ winner, loser, winnerLabel = "Winner", loserLabel = "Loser" }: { winner: Side; loser: Side; winnerLabel?: string; loserLabel?: string }) {
  return (
    <div className="pdc-card overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_1fr]">
        <div className="px-4 py-3 flex flex-col gap-1 min-w-0" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: winner ? "radial-gradient(ellipse at top left, rgba(34,197,94,0.13), transparent 70%)" : undefined }}>
          <div className="flex items-center gap-1.5">
            <Crown className="w-3 h-3 shrink-0" style={{ color: "#22c55e" }} />
            <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", fontSize: "0.55rem" }}>{winnerLabel}</span>
          </div>
          {winner ? (
            <div>
              <div className="font-black uppercase leading-tight truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", fontSize: "1.1rem", textShadow: "0 0 16px rgba(34,197,94,0.4)" }}>{winner.name}</div>
              {winner.sub && <div className="text-xs font-mono" style={{ color: "rgba(34,197,94,0.65)" }}>{winner.sub}</div>}
            </div>
          ) : <div className="text-sm" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>tap to pick ↓</div>}
        </div>
        <div className="flex items-center justify-center px-4" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.04), transparent 75%)" }}>
          <div className="text-center">
            <Swords className="w-4 h-4 mx-auto mb-0.5" style={{ color: "rgba(255,255,255,0.25)" }} />
            <span className="font-black text-xs italic" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)" }}>VS</span>
          </div>
        </div>
        <div className="px-4 py-3 flex flex-col gap-1 min-w-0" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: loser ? "radial-gradient(ellipse at top right, rgba(255,0,92,0.13), transparent 70%)" : undefined }}>
          <div className="flex items-center gap-1.5 justify-end">
            <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "0.55rem" }}>{loserLabel}</span>
            <Skull className="w-3 h-3 shrink-0" style={{ color: "#ff005c" }} />
          </div>
          {loser ? (
            <div className="text-right">
              <div className="font-black uppercase leading-tight truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "1.1rem", textShadow: "0 0 16px rgba(255,0,92,0.4)" }}>{loser.name}</div>
              {loser.sub && <div className="text-xs font-mono" style={{ color: "rgba(255,0,92,0.65)" }}>{loser.sub}</div>}
            </div>
          ) : <div className="text-sm text-right" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>tap to pick ↓</div>}
        </div>
      </div>
    </div>
  );
}

/** Stake presets (poker-chip style) + a custom amount field — every mode
 *  had a free-type stake input alongside its quick-picks before; this
 *  keeps that, just restyled. */
function StakeCard({ value, onChange, max, bothSelected, presets = [1, 2, 5, 10, 20] }: { value: number; onChange: (n: number) => void; max: number; bothSelected: boolean; presets?: number[] }) {
  return (
    <div className="pdc-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "var(--color-gold)" }}>Stake</span>
        {bothSelected && <span className="text-xs font-mono" style={{ color: "rgba(255,210,74,0.5)" }}>max {max} pts</span>}
      </div>
      <div className="flex gap-2.5 justify-between mb-3">
        {presets.map(v => (
          <button key={v} type="button" onClick={() => onChange(v)} disabled={bothSelected && v > max}
            className={`sm-chip ${value === v ? "sm-chip-active" : ""}`}>
            {v}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-[0.62rem] uppercase tracking-wider" style={{ fontFamily: "var(--app-font-mono)", color: "rgba(255,255,255,0.45)" }}>Custom</span>
        <Input
          type="number" min={1} max={bothSelected ? max : 50}
          value={value || ""}
          onChange={e => onChange(parseInt(e.target.value, 10) || 0)}
          placeholder="Enter amount"
          className="sm-custom-input"
        />
      </div>
    </div>
  );
}

/** Game-type quick picks (now with icons) + free-text fallback — same
 *  dual binding as before, both write to the same value. */
function GameTypeCard({ value, onChange, options, theme = "pink" }: { value: string; onChange: (v: string) => void; options: string[]; theme?: "pink" | "green" | "blue" }) {
  return (
    <div className="pdc-card p-4">
      <span className="text-xs font-black uppercase tracking-widest block mb-2.5" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>Game Type</span>
      <div className="flex flex-wrap gap-2 mb-3">
        {options.map(g => (
          <button key={g} type="button" onClick={() => onChange(value === g ? "" : g)}
            className={`sm-gtchip ${value === g ? `sm-gtchip-active-${theme}` : ""}`}>
            {gtIcon(g)}{g}
          </button>
        ))}
      </div>
      <Input placeholder="Or type a custom game…" value={value} onChange={e => onChange(e.target.value)}
        style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }} />
    </div>
  );
}

const CTA_THEME: Record<"pink" | "green" | "blue", { grad: string; glow: string; pulseClass: string }> = {
  pink:  { grad: "linear-gradient(135deg, #ff005c, #cc0049)", glow: "0 0 24px rgba(255,0,92,0.25)",  pulseClass: "sm-cta-ready-pink" },
  green: { grad: "linear-gradient(135deg, #22c55e, #15803d)", glow: "0 0 24px rgba(34,197,94,0.25)", pulseClass: "sm-cta-ready-green" },
  blue:  { grad: "linear-gradient(135deg, #0066ff, #0047b3)", glow: "0 0 24px rgba(0,102,255,0.25)", pulseClass: "sm-cta-ready-blue" },
};

function SubmitCTA({ ready, submitting, disabled, readyLabel, idleLabel = "Select winner & loser above", type = "button", onClick, theme = "pink" }: {
  ready: boolean; submitting: boolean; disabled: boolean; readyLabel: string; idleLabel?: string;
  type?: "button" | "submit"; onClick?: () => void; theme?: "pink" | "green" | "blue";
}) {
  const t = CTA_THEME[theme];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-full h-14 rounded-xl text-lg font-black uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-40 ${ready ? t.pulseClass : ""}`}
      style={{
        fontFamily: "Oswald, sans-serif",
        background: ready ? t.grad : "rgba(255,255,255,0.06)",
        color: ready ? "#fff" : "rgba(255,255,255,0.3)",
        border: "none", letterSpacing: "0.12em",
        boxShadow: ready ? t.glow : undefined,
      }}>
      {submitting ? (
        <span className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#fff" }} />
          Submitting…
        </span>
      ) : ready ? (
        <span className="flex items-center justify-center gap-2"><Trophy className="w-5 h-5" />{readyLabel}</span>
      ) : idleLabel}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Singles-only real-data additions — Quick Rematch and the head-to-head
// panel. Both are grounded in endpoints that already exist for other
// pages (player-stats' headToHead list, /api/stats/h2h), not new
// aggregate queries, and both stay silent (render nothing) rather than
// show placeholder content when there's no real history to show.
// ═══════════════════════════════════════════════════════════════════════

function QuickRematch({ currentPlayerId, onPick }: { currentPlayerId: number; onPick: (winnerId: number, loserId: number) => void }) {
  const { data: stats } = useGetPlayerStats(currentPlayerId, {
    query: { staleTime: 60 * 1000, queryKey: getGetPlayerStatsQueryKey(currentPlayerId) },
  });
  const headToHead = ((stats as any)?.headToHead ?? []) as { opponentId: number; opponentName: string; wins: number; losses: number }[];
  const top = headToHead.slice(0, 3);
  if (top.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-2.5 ml-0.5">
        <Zap className="w-3 h-3" style={{ color: "var(--color-gold)" }} />
        <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)", fontSize: "0.62rem" }}>
          Quick rematch — your most-played opponents
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {top.map(r => (
          <button key={r.opponentId} type="button" onClick={() => onPick(currentPlayerId, r.opponentId)}
            className="pdc-card flex-shrink-0 flex items-center gap-2.5 px-3.5 py-2 hover:opacity-90 transition-opacity"
            style={{ borderRadius: 14 }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-black text-xs"
              style={{ fontFamily: "Oswald, sans-serif", background: "radial-gradient(circle at 32% 28%, #3a2f10, #1a1508 70%)", border: "1px solid rgba(255,210,74,0.4)", color: "var(--color-gold)" }}>
              {r.opponentName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold whitespace-nowrap" style={{ color: "rgba(255,255,255,0.9)" }}>vs {r.opponentName}</div>
              <div className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                you <span style={{ color: "#22c55e" }}>{r.wins}W</span> <span style={{ color: "#ff005c" }}>{r.losses}L</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

type H2HStat = { id: number; name: string; wins: number; currentStreak: number };
type H2HData = { player1: H2HStat; player2: H2HStat; totalMatches: number };

function HeadToHeadPanel({ winnerId, loserId }: { winnerId: number; loserId: number }) {
  const { data: h2h } = useFetch<H2HData>(`/api/stats/h2h?p1=${winnerId}&p2=${loserId}`);
  if (!h2h || !h2h.player1 || !h2h.player2 || h2h.totalMatches === 0) return null;

  const leader = h2h.player1.wins === h2h.player2.wins ? null : (h2h.player1.wins > h2h.player2.wins ? h2h.player1 : h2h.player2);

  return (
    <div className="mb-4">
      <div className="pdc-card p-4" style={{ borderColor: "rgba(255,210,74,0.25)", background: "linear-gradient(160deg, rgba(255,210,74,0.07), rgba(18,18,26,0.95) 70%)" }}>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5">
            <Swords className="w-3 h-3" style={{ color: "var(--color-gold)" }} />
            <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "var(--color-gold)", fontSize: "0.6rem" }}>Head-to-Head</span>
          </div>
          <a href={`/h2h?p1=${winnerId}&p2=${loserId}`} className="text-xs hover:underline" style={{ color: "rgba(255,255,255,0.35)" }}>View full history →</a>
        </div>
        <div className="flex items-center gap-4">
          <div className="font-mono font-black rounded-lg px-3 py-1" style={{ fontSize: "1.35rem", background: "#000", boxShadow: "inset 0 2px 6px rgba(0,0,0,0.7)" }}>
            <span style={{ color: "#22c55e", textShadow: "0 0 12px rgba(34,197,94,0.6)" }}>{h2h.player1.wins}</span>
            <span style={{ color: "rgba(255,255,255,0.25)", margin: "0 4px" }}>–</span>
            <span style={{ color: "#ff005c", textShadow: "0 0 12px rgba(255,0,92,0.6)" }}>{h2h.player2.wins}</span>
          </div>
          <div className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.6)" }}>
            {leader
              ? <><b style={{ color: "#fff" }}>{leader.name}</b> leads this matchup across {h2h.totalMatches} meetings.</>
              : <>Dead even across {h2h.totalMatches} meetings.</>}
          </div>
          {(h2h.player1.currentStreak || h2h.player2.currentStreak) ? (
            <div className="ml-auto text-right flex-shrink-0">
              <div className="font-mono font-black text-sm" style={{ color: "var(--color-gold)", textShadow: "0 0 10px rgba(255,210,74,0.5)" }}>
                {h2h.player1.currentStreak >= h2h.player2.currentStreak ? `W${h2h.player1.currentStreak}` : `W${h2h.player2.currentStreak}`}
              </div>
              <div className="text-[0.58rem] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.3)" }}>current run</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Ad-hoc Team Match's and the Singles grid's player cards get a small
 *  "YOU" tag (from the same useCurrentPlayer() the Hub uses) and a
 *  recentForm dot-row (the same field the Hub's sparkline reads) — both
 *  real per-player data already returned by /api/players, not added here. */
function FormDots({ form }: { form?: ("W" | "L")[] }) {
  if (!form || form.length === 0) return null;
  return (
    <div className="flex gap-[3px] items-center">
      {form.slice(-8).map((r, i) => (
        <span key={i} className="block rounded-full" style={{ width: 6, height: 6, background: r === "W" ? "#22c55e" : "#ff005c", boxShadow: r === "W" ? "0 0 5px rgba(34,197,94,0.7)" : undefined }} />
      ))}
    </div>
  );
}

/** Ad-hoc Team Match — reached via the "Turn this into a Team Match" toggle
 *  inside Singles. Any grouping of 1-6 players per side (2v2, 3v3, or uneven
 *  like 2v1), using each player's own existing points/Elo — not a shared
 *  team pot like the Doubles Event or Shift Wars. Posts to /api/team-matches,
 *  whose wager math pools what the losing side pays in (stake × loser count)
 *  and splits it evenly across the winning side, so uneven teams stay
 *  zero-sum instead of manufacturing points (see that route for the full
 *  explanation). The preview below mirrors that exact split so what's shown
 *  before submitting always matches what actually happens. */
function TeamModeSubmitSection({ onExit }: { onExit: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: players, isLoading: isLoadingPlayers } = useListPlayers();
  const currentPlayer = useCurrentPlayer();
  const activePlayers = players?.filter(p => p.isActive && p.status !== "ELIMINATED") ?? [];

  const [side, setSide]           = useState<"winner" | "loser">("winner");
  const [winnerIds, setWinnerIds] = useState<number[]>([]);
  const [loserIds, setLoserIds]   = useState<number[]>([]);
  const [stake, setStake]         = useState("5");
  const [gameType, setGameType]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const involved = [...winnerIds, ...loserIds];
  const involvedPlayers = activePlayers.filter(p => involved.includes(p.id));
  const maxStake = involvedPlayers.length > 0 ? Math.min(...involvedPlayers.map(p => p.points)) : 25;
  const stakeN = parseInt(stake) || 0;
  const bothSelected = winnerIds.length > 0 && loserIds.length > 0;

  // Mirrors the backend's pot-and-split exactly: each losing player pays the
  // full stake (same risk as a 1v1) into a pot; that pot is split evenly
  // across the winners, with any remainder (pot not divisible by winner
  // count) going to the first players in the winning list. Equal team sizes
  // — including a plain 1v1 — reduce to a flat ±stake per player.
  const pot = stakeN * loserIds.length;
  const baseShare = winnerIds.length > 0 ? Math.floor(pot / winnerIds.length) : 0;
  const remainder = pot - baseShare * winnerIds.length;
  const winnerShares = winnerIds.map((_, i) => baseShare + (i < remainder ? 1 : 0));
  const unevenTeams = winnerIds.length !== loserIds.length && bothSelected;

  function nameOf(id: number) { return activePlayers.find(p => p.id === id)?.name ?? "?"; }

  function togglePlayer(id: number) {
    if (winnerIds.includes(id)) { setWinnerIds(w => w.filter(x => x !== id)); return; }
    if (loserIds.includes(id))  { setLoserIds(l => l.filter(x => x !== id)); return; }
    if (side === "winner") setWinnerIds(w => [...w, id]);
    else setLoserIds(l => [...l, id]);
  }

  async function onSubmit() {
    if (!bothSelected) return;
    if (stakeN < 1) {
      toast({ title: "Invalid Stake", description: "Stake must be at least 1 point", variant: "destructive" });
      return;
    }
    if (stakeN > maxStake) {
      toast({ title: "Stake Too High", description: `Maximum stake is ${maxStake} points — one player's balance is the limit`, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/team-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerIds, loserIds, stake: stakeN, gameType: gameType || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const payoutDesc = unevenTeams
        ? `${winnerIds.map((id, i) => `${nameOf(id)} +${winnerShares[i]}`).join(", ")} · ${loserIds.map(id => `${nameOf(id)} -${stakeN}`).join(", ")}`
        : `${winnerIds.map(nameOf).join(" & ")} def. ${loserIds.map(nameOf).join(" & ")} — ±${stakeN} pts`;
      toast({ title: "Team Match Recorded ✓", description: payoutDesc });
      const involvedIds = [...winnerIds, ...loserIds];
      setWinnerIds([]); setLoserIds([]); setStake("5"); setGameType(""); setSide("winner");
      queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
      for (const id of involvedIds) {
        queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(id) });
        queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(id) });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message ?? "Unexpected error", variant: "destructive" });
    }
    setSubmitting(false);
  }

  return (
    <div className="space-y-5">
      {/* Exit back to 1v1 */}
      <button type="button" onClick={onExit}
        className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide hover:opacity-80"
        style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>
        <X className="w-3.5 h-3.5" /> Back to 1v1
      </button>

      {/* Roster strip */}
      <div className="pdc-card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr]">
          <div className="px-4 py-3 flex flex-col gap-1.5 min-w-0" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: winnerIds.length ? "rgba(34,197,94,0.05)" : undefined }}>
            <div className="flex items-center gap-1.5">
              <Crown className="w-3 h-3 shrink-0" style={{ color: "#22c55e" }} />
              <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", fontSize: "0.55rem" }}>Winning Team</span>
            </div>
            {winnerIds.length > 0 ? winnerIds.map(id => (
              <div key={id} className="flex items-center gap-1 text-sm font-bold" style={{ color: "#22c55e" }}>
                {nameOf(id)}
                <button type="button" onClick={() => setWinnerIds(w => w.filter(x => x !== id))} style={{ color: "rgba(34,197,94,0.5)" }}><X className="w-3 h-3" /></button>
              </div>
            )) : <div className="text-sm" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>tap players ↓</div>}
          </div>
          <div className="flex items-center justify-center px-4" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="text-center">
              <Swords className="w-4 h-4 mx-auto mb-0.5" style={{ color: "rgba(255,255,255,0.2)" }} />
              <span className="font-black text-xs italic" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)" }}>VS</span>
            </div>
          </div>
          <div className="px-4 py-3 flex flex-col gap-1.5 min-w-0" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: loserIds.length ? "rgba(255,0,92,0.05)" : undefined }}>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "0.55rem" }}>Losing Team</span>
              <Skull className="w-3 h-3 shrink-0" style={{ color: "#ff005c" }} />
            </div>
            {loserIds.length > 0 ? loserIds.map(id => (
              <div key={id} className="flex items-center justify-end gap-1 text-sm font-bold" style={{ color: "#ff005c" }}>
                <button type="button" onClick={() => setLoserIds(l => l.filter(x => x !== id))} style={{ color: "rgba(255,0,92,0.5)" }}><X className="w-3 h-3" /></button>
                {nameOf(id)}
              </div>
            )) : <div className="text-sm text-right" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>tap players ↓</div>}
          </div>
        </div>
      </div>

      {/* Side selector — which roster tapping a player adds to */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <button type="button" onClick={() => setSide("winner")}
          className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all"
          style={{ fontFamily: "Oswald, sans-serif", background: side === "winner" ? "rgba(34,197,94,0.15)" : "transparent", color: side === "winner" ? "#22c55e" : "rgba(255,255,255,0.35)" }}>
          <Crown className="w-3.5 h-3.5" /> Adding to Winners
        </button>
        <button type="button" onClick={() => setSide("loser")}
          className="flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all"
          style={{ fontFamily: "Oswald, sans-serif", background: side === "loser" ? "rgba(255,0,92,0.15)" : "transparent", color: side === "loser" ? "#ff005c" : "rgba(255,255,255,0.35)" }}>
          <Skull className="w-3.5 h-3.5" /> Adding to Losers
        </button>
      </div>

      {/* Player grid */}
      {isLoadingPlayers ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#0066ff" }} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {activePlayers.map(p => (
            <TeamModePlayerCard key={p.id} player={p} isYou={!!currentPlayer && p.id === currentPlayer.playerId}
              isWinner={winnerIds.includes(p.id)} isLoser={loserIds.includes(p.id)} disabled={submitting}
              onClick={() => togglePlayer(p.id)} />
          ))}
        </div>
      )}

      {/* Payout preview — mirrors the backend's pot-split exactly, so uneven
          teams (2v1, 3v2…) show the real per-player share before submitting
          instead of assuming a flat ±stake that would now be wrong. */}
      {bothSelected && stakeN > 0 && (
        <div className="pdc-card p-4">
          <span className="text-xs font-black uppercase tracking-widest block mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>
            Payout Preview
          </span>
          {unevenTeams ? (
            <div className="space-y-1.5">
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Uneven teams ({winnerIds.length}v{loserIds.length}) — losers each pay the full stake into a pot of <strong style={{ color: "#ffd24a" }}>{pot}</strong>, split across the winners:
              </div>
              {winnerIds.map((id, i) => (
                <div key={id} className="flex justify-between text-sm font-mono" style={{ color: "#22c55e" }}>
                  <span>{nameOf(id)}</span><span>+{winnerShares[i]}</span>
                </div>
              ))}
              {loserIds.map(id => (
                <div key={id} className="flex justify-between text-sm font-mono" style={{ color: "#ff005c" }}>
                  <span>{nameOf(id)}</span><span>-{stakeN}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
              Even teams — every winner gets <span style={{ color: "#22c55e" }}>+{stakeN}</span>, every loser pays <span style={{ color: "#ff005c" }}>-{stakeN}</span>.
            </div>
          )}
        </div>
      )}

      <StakeCard value={stakeN} onChange={v => setStake(String(v))} max={maxStake} bothSelected={involvedPlayers.length > 0} />
      <GameTypeCard value={gameType} onChange={setGameType} options={["Team 501", "Team Cricket", "2v2", "3v3"]} theme="blue" />

      <SubmitCTA
        type="button" onClick={onSubmit} theme="blue"
        submitting={submitting} disabled={submitting || !bothSelected || maxStake === 0}
        ready={bothSelected} readyLabel={`Confirm: ${winnerIds.map(nameOf).join(" & ")} def. ${loserIds.map(nameOf).join(" & ")}`}
        idleLabel="Add at least one player to each team"
      />
    </div>
  );
}

function TeamModePlayerCard({ player: p, isYou, isWinner, isLoser, disabled, onClick }: {
  player: any; isYou: boolean; isWinner: boolean; isLoser: boolean; disabled: boolean; onClick: () => void;
}) {
  const ref = useTilt<HTMLButtonElement>();
  return (
    <button ref={ref} type="button" onClick={onClick} disabled={disabled}
      className="sm-tilt relative rounded-xl overflow-hidden text-left transition-all duration-150 focus:outline-none px-3 py-2.5"
      style={{
        background: isWinner ? "rgba(34,197,94,0.1)" : isLoser ? "rgba(255,0,92,0.1)" : "rgba(255,255,255,0.03)",
        border: isWinner ? "1px solid rgba(34,197,94,0.5)" : isLoser ? "1px solid rgba(255,0,92,0.5)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isWinner ? "0 0 16px rgba(34,197,94,0.15)" : isLoser ? "0 0 16px rgba(255,0,92,0.15)" : undefined,
      }}>
      {isYou && (
        <span className="absolute top-1.5 left-1.5 text-[0.5rem] font-black uppercase tracking-wide rounded px-1.5 py-0.5"
          style={{ fontFamily: "Oswald, sans-serif", color: "#1a1508", background: "linear-gradient(160deg, #ffe08a, #e8ab00)" }}>You</span>
      )}
      <div className="font-black uppercase truncate mt-3.5" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.85rem", color: isWinner ? "#22c55e" : isLoser ? "#ff005c" : "rgba(255,255,255,0.85)" }}>
        {p.name}
      </div>
      <div className="flex items-center justify-between mt-0.5">
        <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>{p.points}pts</span>
        <FormDots form={(p as any).recentForm} />
      </div>
    </button>
  );
}

/** Shift Wars — the 3 fixed department teams (Fresh, Twilight, Shift Leader). Same
 *  "Team A beat Team B, stake X" submission shape as the Doubles Event, but points
 *  only (no Elo/tier), and teams are a permanent admin-managed roster rather than a
 *  season's random draw — so there's no season lookup or elimination concept here. */
function ShiftWarsSubmitSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { teams, loading, reload } = useShiftWarsTeamsForSubmit();

  const [winnerTeamId, setWinnerTeamId] = useState<number | null>(null);
  const [loserTeamId, setLoserTeamId]   = useState<number | null>(null);
  const [stake, setStake]         = useState("5");
  const [gameType, setGameType]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const winner = teams.find((t: any) => t.id === winnerTeamId) ?? null;
  const loser  = teams.find((t: any) => t.id === loserTeamId)  ?? null;
  const bothSelected = !!winner && !!loser && winner.id !== loser.id;
  const maxStake = winner && loser ? Math.min(winner.points, loser.points) : 25;
  const stakeN   = parseInt(stake) || 0;

  function handleCardClick(teamId: number) {
    if (winnerTeamId === teamId) { setWinnerTeamId(null); return; }
    if (loserTeamId === teamId)  { setLoserTeamId(null); return; }
    if (winnerTeamId === null) { setWinnerTeamId(teamId); return; }
    if (loserTeamId === null)  { setLoserTeamId(teamId); return; }
    setWinnerTeamId(teamId);
    setLoserTeamId(null);
  }

  async function onSubmit() {
    if (!bothSelected || !winner || !loser) return;
    if (stakeN < 1) {
      toast({ title: "Invalid Stake", description: "Stake must be at least 1 point", variant: "destructive" });
      return;
    }
    if (stakeN > maxStake) {
      toast({ title: "Stake Too High", description: `Maximum stake is ${maxStake} points for this matchup`, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/shift-wars/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerTeamId: winner.id, loserTeamId: loser.id, stake: stakeN, gameType: gameType || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      toast({ title: "Shift Wars Match Recorded ✓", description: `${winner.name} def. ${loser.name} — ±${stakeN} pts` });
      setWinnerTeamId(null); setLoserTeamId(null); setStake("5"); setGameType("");
      qc.invalidateQueries({ queryKey: ["leaderboard-shiftwars"] });
      reload();
    } catch (e: any) {
      toast({ title: "Error", description: e.message ?? "Unexpected error", variant: "destructive" });
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#22c55e" }} />
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="pdc-card px-6 py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
        No Shift Wars teams yet — ask an admin to set them up first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MatchupStrip
        winner={winner ? { name: winner.name, sub: `${winner.points}pts` } : null}
        loser={loser ? { name: loser.name, sub: `${loser.points}pts` } : null}
      />

      {/* Team grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {teams.map((t: any) => (
          <ShiftWarsTeamCard key={t.id} team={t} isWinner={winnerTeamId === t.id} isLoser={loserTeamId === t.id}
            isOther={winnerTeamId !== t.id && loserTeamId !== t.id && bothSelected} disabled={submitting}
            onClick={() => handleCardClick(t.id)} />
        ))}
      </div>

      {bothSelected && winner && loser && (
        <div className="pdc-card px-4 py-3 flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            {winner.name} <span style={{ color: "#22c55e" }}>{winner.points} → {stakeN > 0 ? winner.points + stakeN : winner.points}</span>
          </span>
          <span className="text-xs text-right" style={{ color: "rgba(255,255,255,0.35)" }}>
            {loser.name} <span style={{ color: "#ff005c" }}>{loser.points} → {stakeN > 0 ? Math.max(0, loser.points - stakeN) : loser.points}</span>
          </span>
        </div>
      )}

      <StakeCard value={stakeN} onChange={v => setStake(String(v))} max={maxStake} bothSelected={bothSelected} />
      <GameTypeCard value={gameType} onChange={setGameType} options={["501", "301", "Cricket", "Killer"]} theme="green" />

      <SubmitCTA
        type="button" onClick={onSubmit} theme="green"
        submitting={submitting} disabled={submitting || !bothSelected || maxStake === 0}
        ready={bothSelected && !!winner && !!loser} readyLabel={`Confirm: ${winner?.name} def. ${loser?.name}`}
        idleLabel="Select winning & losing team above"
      />
    </div>
  );
}

function ShiftWarsTeamCard({ team: t, isWinner, isLoser, isOther, disabled, onClick }: {
  team: any; isWinner: boolean; isLoser: boolean; isOther: boolean; disabled: boolean; onClick: () => void;
}) {
  const ref = useTilt<HTMLButtonElement>();
  return (
    <button ref={ref} type="button" onClick={onClick} disabled={disabled}
      className="sm-tilt relative rounded-xl overflow-hidden text-left transition-all duration-150 focus:outline-none"
      style={{
        background: isWinner ? "rgba(34,197,94,0.1)" : isLoser ? "rgba(255,0,92,0.1)" : "rgba(255,255,255,0.03)",
        border: isWinner ? "1px solid rgba(34,197,94,0.5)" : isLoser ? "1px solid rgba(255,0,92,0.5)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isWinner ? "0 0 16px rgba(34,197,94,0.15)" : isLoser ? "0 0 16px rgba(255,0,92,0.15)" : undefined,
        opacity: isOther ? 0.4 : 1,
        transform: (isWinner || isLoser) ? "scale(1.02)" : undefined,
      }}>
      <div className="h-0.5 w-full" style={{ background: isWinner ? "#22c55e" : isLoser ? "#ff005c" : "rgba(34,197,94,0.4)" }} />
      {isWinner && <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#22c55e" }}><Crown className="w-3 h-3" style={{ color: "#000" }} /></div>}
      {isLoser  && <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#ff005c" }}><Skull className="w-3 h-3" style={{ color: "#fff" }} /></div>}
      <div className="p-3 pt-2">
        <div className="font-black uppercase leading-tight pr-8 mb-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.95rem", color: isWinner ? "#22c55e" : isLoser ? "#ff005c" : "rgba(255,255,255,0.85)" }}>
          {t.name}
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-black tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.35rem", color: "#22c55e" }}>{t.points}</span>
          <span className="text-xs font-bold" style={{ color: "rgba(34,197,94,0.5)", fontFamily: "Oswald, sans-serif" }}>pts</span>
        </div>
        <div className="flex items-center justify-between text-xs font-mono">
          <span style={{ color: "#22c55e" }}>{t.wins}W</span>
          <span style={{ color: "#ff005c" }}>{t.losses}L</span>
        </div>
      </div>
    </button>
  );
}

function DoublesSubmitSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { teams, loading, reload } = useDoublesTeamsForSubmit();

  const [winnerTeamId, setWinnerTeamId] = useState<number | null>(null);
  const [loserTeamId, setLoserTeamId]   = useState<number | null>(null);
  const [stake, setStake]         = useState("5");
  const [gameType, setGameType]   = useState("");
  const [submitting, setSubmitting] = useState(false);

  const activeTeams = teams.filter((t: any) => !t.isEliminated);
  const winner = activeTeams.find((t: any) => t.id === winnerTeamId) ?? null;
  const loser  = activeTeams.find((t: any) => t.id === loserTeamId)  ?? null;
  const bothSelected = !!winner && !!loser && winner.id !== loser.id;
  const maxStake = winner && loser ? Math.min(winner.points, loser.points) : 25;
  const stakeN   = parseInt(stake) || 0;

  function handleCardClick(teamId: number) {
    if (winnerTeamId === teamId) { setWinnerTeamId(null); return; }
    if (loserTeamId === teamId)  { setLoserTeamId(null); return; }
    if (winnerTeamId === null) { setWinnerTeamId(teamId); return; }
    if (loserTeamId === null)  { setLoserTeamId(teamId); return; }
    setWinnerTeamId(teamId);
    setLoserTeamId(null);
  }

  async function onSubmit() {
    if (!bothSelected || !winner || !loser) return;
    if (stakeN < 1) {
      toast({ title: "Invalid Stake", description: "Stake must be at least 1 point", variant: "destructive" });
      return;
    }
    if (stakeN > maxStake) {
      toast({ title: "Stake Too High", description: `Maximum stake is ${maxStake} points for this matchup`, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/doubles/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerTeamId: winner.id, loserTeamId: loser.id, stake: stakeN, gameType: gameType || undefined }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      toast({ title: "Doubles Match Recorded ✓", description: `${winner.teamName} def. ${loser.teamName} — ±${stakeN} pts` });
      setWinnerTeamId(null); setLoserTeamId(null); setStake("5"); setGameType("");
      qc.invalidateQueries({ queryKey: ["leaderboard-doubles"] });
      reload();
    } catch (e: any) {
      toast({ title: "Error", description: e.message ?? "Unexpected error", variant: "destructive" });
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#0066ff" }} />
      </div>
    );
  }

  if (activeTeams.length === 0) {
    return (
      <div className="pdc-card px-6 py-16 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
        No doubles teams yet this season — ask an admin to run the random draw first.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MatchupStrip
        winner={winner ? { name: winner.teamName, sub: `${winner.points}pts · ${winner.elo} ELO` } : null}
        loser={loser ? { name: loser.teamName, sub: `${loser.points}pts · ${loser.elo} ELO` } : null}
      />

      {/* Team grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {activeTeams.map((t: any) => (
          <DoublesTeamCard key={t.id} team={t} isWinner={winnerTeamId === t.id} isLoser={loserTeamId === t.id}
            isOther={winnerTeamId !== t.id && loserTeamId !== t.id && bothSelected} disabled={submitting}
            onClick={() => handleCardClick(t.id)} />
        ))}
      </div>

      {bothSelected && winner && loser && (
        <div className="pdc-card px-4 py-3 flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            {winner.teamName} <span style={{ color: "#22c55e" }}>{winner.points} → {stakeN > 0 ? winner.points + stakeN : winner.points}</span>
          </span>
          <span className="text-xs text-right" style={{ color: "rgba(255,255,255,0.35)" }}>
            {loser.teamName} <span style={{ color: "#ff005c" }}>{loser.points} → {stakeN > 0 ? Math.max(0, loser.points - stakeN) : loser.points}</span>
            {stakeN > 0 && loser.points - stakeN <= 0 && <span style={{ color: "#ff005c" }}> ☠</span>}
          </span>
        </div>
      )}

      <StakeCard value={stakeN} onChange={v => setStake(String(v))} max={maxStake} bothSelected={bothSelected} />
      <GameTypeCard value={gameType} onChange={setGameType} options={["501", "301", "Cricket", "Killer"]} theme="blue" />

      <SubmitCTA
        type="button" onClick={onSubmit} theme="blue"
        submitting={submitting} disabled={submitting || !bothSelected || maxStake === 0}
        ready={bothSelected && !!winner && !!loser} readyLabel={`Confirm: ${winner?.teamName} def. ${loser?.teamName}`}
        idleLabel="Select winning & losing team above"
      />
    </div>
  );
}

function DoublesTeamCard({ team: t, isWinner, isLoser, isOther, disabled, onClick }: {
  team: any; isWinner: boolean; isLoser: boolean; isOther: boolean; disabled: boolean; onClick: () => void;
}) {
  const ref = useTilt<HTMLButtonElement>();
  return (
    <button ref={ref} type="button" onClick={onClick} disabled={disabled}
      className="sm-tilt relative rounded-xl overflow-hidden text-left transition-all duration-150 focus:outline-none"
      style={{
        background: isWinner ? "rgba(34,197,94,0.1)" : isLoser ? "rgba(255,0,92,0.1)" : "rgba(255,255,255,0.03)",
        border: isWinner ? "1px solid rgba(34,197,94,0.5)" : isLoser ? "1px solid rgba(255,0,92,0.5)" : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isWinner ? "0 0 16px rgba(34,197,94,0.15)" : isLoser ? "0 0 16px rgba(255,0,92,0.15)" : undefined,
        opacity: isOther ? 0.4 : 1,
        transform: (isWinner || isLoser) ? "scale(1.02)" : undefined,
      }}>
      <div className="h-0.5 w-full" style={{ background: isWinner ? "#22c55e" : isLoser ? "#ff005c" : "rgba(0,102,255,0.4)" }} />
      {isWinner && <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#22c55e" }}><Crown className="w-3 h-3" style={{ color: "#000" }} /></div>}
      {isLoser  && <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#ff005c" }}><Skull className="w-3 h-3" style={{ color: "#fff" }} /></div>}
      {!isWinner && !isLoser && <div className="absolute top-2 right-2"><TierBadge tier={t.tier} /></div>}
      <div className="p-3 pt-2">
        <div className="font-black uppercase leading-tight pr-8 mb-2" style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.95rem", color: isWinner ? "#22c55e" : isLoser ? "#ff005c" : "rgba(255,255,255,0.85)" }}>
          {t.teamName}
        </div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-black tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.35rem", color: "#0066ff" }}>{t.points}</span>
          <span className="text-xs font-bold" style={{ color: "rgba(0,102,255,0.5)", fontFamily: "Oswald, sans-serif" }}>pts</span>
          <span className="text-xs font-mono ml-auto" style={{ color: "rgba(0,102,255,0.6)" }}>{t.elo}</span>
        </div>
        <div className="flex items-center justify-between text-xs font-mono">
          <span style={{ color: "#22c55e" }}>{t.wins}W</span>
          <span style={{ color: "#ff005c" }}>{t.losses}L</span>
        </div>
      </div>
    </button>
  );
}

function SinglesPlayerCard({ player: p, isYou, isWinner, isLoser, isOther, disabled, onClick }: {
  player: any; isYou: boolean; isWinner: boolean; isLoser: boolean; isOther: boolean; disabled: boolean; onClick: () => void;
}) {
  const ref = useTilt<HTMLButtonElement>();
  const derivedTier = p.elo >= 1400 ? "Diamond" : p.elo >= 1250 ? "Platinum" : p.elo >= 1100 ? "Gold" : p.elo >= 950 ? "Silver" : "Bronze";
  const tier = (p as any).tier || derivedTier;
  const tierColor = TIER_COLOR[tier] ?? "#94a3b8";
  const winRate = (p.seasonGamesPlayed ?? 0) > 0
    ? Math.round(((p.seasonWins ?? 0) / (p.seasonGamesPlayed ?? 1)) * 100) : 0;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="sm-tilt relative rounded-xl overflow-hidden text-left transition-all duration-150 focus:outline-none"
      style={{
        background: isWinner
          ? "rgba(34,197,94,0.1)"
          : isLoser
            ? "rgba(255,0,92,0.1)"
            : "rgba(255,255,255,0.03)",
        border: isWinner
          ? "1px solid rgba(34,197,94,0.5)"
          : isLoser
            ? "1px solid rgba(255,0,92,0.5)"
            : "1px solid rgba(255,255,255,0.07)",
        boxShadow: isWinner
          ? "0 0 16px rgba(34,197,94,0.15)"
          : isLoser
            ? "0 0 16px rgba(255,0,92,0.15)"
            : undefined,
        opacity: isOther ? 0.4 : 1,
        transform: (isWinner || isLoser) ? "scale(1.02)" : undefined,
      }}
    >
      {/* Tier accent bar */}
      <div className="h-0.5 w-full" style={{ background: isWinner ? "#22c55e" : isLoser ? "#ff005c" : tierColor }} />

      {isYou && (
        <span className="absolute top-1.5 left-1.5 text-[0.5rem] font-black uppercase tracking-wide rounded px-1.5 py-0.5"
          style={{ fontFamily: "Oswald, sans-serif", color: "#1a1508", background: "linear-gradient(160deg, #ffe08a, #e8ab00)" }}>You</span>
      )}

      {/* Role badge */}
      {isWinner && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: "#22c55e" }}>
          <Crown className="w-3 h-3" style={{ color: "#000" }} />
        </div>
      )}
      {isLoser && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
          style={{ background: "#ff005c" }}>
          <Skull className="w-3 h-3" style={{ color: "#fff" }} />
        </div>
      )}
      {!isWinner && !isLoser && (
        <div className="absolute top-2 right-2">
          <TierBadge tier={tier} />
        </div>
      )}

      <div className="p-3 pt-2">
        <div className="font-black uppercase leading-tight pr-8 mb-2"
          style={{
            fontFamily: "Oswald, sans-serif",
            fontSize: "0.95rem",
            color: isWinner ? "#22c55e" : isLoser ? "#ff005c" : "rgba(255,255,255,0.85)",
          }}>
          {p.name}
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-black tabular-nums leading-none" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.35rem", color: "#ff005c" }}>
            {p.points}
          </span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,0,92,0.5)", fontFamily: "Oswald, sans-serif" }}>pts</span>
          <span className="text-xs font-mono ml-auto" style={{ color: "rgba(0,102,255,0.6)" }}>
            {p.elo}
          </span>
        </div>

        {/* Win rate bar */}
        <div className="space-y-1 mb-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono" style={{ color: "#22c55e" }}>{p.seasonWins ?? 0}W</span>
            <span className="text-xs font-mono" style={{ color: "#ff005c" }}>{p.seasonLosses ?? 0}L</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div className="h-full rounded-full"
              style={{
                width: `${winRate}%`,
                background: isWinner ? "#22c55e" : isLoser ? "#ff005c" : (winRate >= 60 ? "#22c55e" : winRate >= 40 ? "#0066ff" : "#ff005c"),
              }} />
          </div>
        </div>
        <FormDots form={(p as any).recentForm} />
      </div>
    </button>
  );
}

export default function SubmitMatch() {
  const { data: appSettings } = useSettings();
  const doublesEventEnabled = appSettings?.doubles_event_enabled ?? true;
  const shiftWarsEnabled = appSettings?.shift_wars_enabled ?? false;
  const [mode, setModeState] = useState<"singles" | "doubles" | "shiftwars">("singles");
  const setMode = (m: "singles" | "doubles" | "shiftwars") => setModeState(
    m === "doubles" && !doublesEventEnabled ? "singles" :
    m === "shiftwars" && !shiftWarsEnabled ? "singles" : m
  );
  // Ad-hoc team matches (2v2, 3v3, or uneven like 2v1) live inside the Singles
  // tab as a toggle rather than a separate top-level mode — it's the same
  // "any grouping of players, own points/Elo" match as a 1v1, just with more
  // than one player per side.
  const [teamMode, setTeamMode] = useState(false);
  const { data: players, isLoading: isLoadingPlayers } = useListPlayers();
  const submitMutation = useSubmitMatch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentPlayer = useCurrentPlayer();

  useEffect(() => {
    if (mode === "doubles" && !doublesEventEnabled) setModeState("singles");
    if (mode === "shiftwars" && !shiftWarsEnabled) setModeState("singles");
  }, [doublesEventEnabled, shiftWarsEnabled, mode]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { winnerId: 0, loserId: 0, stake: 5, gameType: "", notes: "" },
  });

  const winnerId = form.watch("winnerId");
  const loserId  = form.watch("loserId");
  const stake    = Number(form.watch("stake"));

  const activePlayers = players?.filter(p => p.isActive && p.status !== "ELIMINATED") ?? [];

  const winner = activePlayers.find(p => p.id === Number(winnerId)) ?? null;
  const loser  = activePlayers.find(p => p.id === Number(loserId))  ?? null;

  const winnerPts = winner?.points ?? null;
  const loserPts  = loser?.points  ?? null;

  const maxStake = winnerPts !== null && loserPts !== null
    ? Math.min(winnerPts, loserPts)
    : 25;

  const bothSelected = winnerId > 0 && loserId > 0 && winnerId !== loserId;

  function handleCardClick(playerId: number) {
    const currentWinner = Number(form.getValues("winnerId"));
    const currentLoser  = Number(form.getValues("loserId"));

    if (currentWinner === playerId) {
      form.setValue("winnerId", 0);
      return;
    }
    if (currentLoser === playerId) {
      form.setValue("loserId", 0);
      return;
    }
    if (currentWinner === 0) {
      form.setValue("winnerId", playerId);
      return;
    }
    if (currentLoser === 0) {
      form.setValue("loserId", playerId);
      return;
    }
    form.setValue("winnerId", playerId);
    form.setValue("loserId", 0);
  }

  function onSubmit(values: FormValues) {
    // Validate stake against maxStake
    if (values.stake > maxStake) {
      toast({
        title: "Stake Too High",
        description: `Maximum stake is ${maxStake} points for this match`,
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate(
      { data: { winnerId: values.winnerId, loserId: values.loserId, stake: values.stake, gameType: values.gameType || undefined, notes: values.notes } },
      {
        onSuccess: (data: any) => {
          toast({
            title: "Match Recorded ✓",
            description: `${data.winnerName} def. ${data.loserName} — ±${values.stake} pts`,
          });
          form.reset({ winnerId: 0, loserId: 0, stake: 5, gameType: "", notes: "" });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(values.winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(values.loserId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(values.winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(values.loserId) });
        },
        onError: (error: any) => {
          toast({ title: "Error", description: error.message ?? "Unexpected error", variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      <div className="pdc-divider" />
      <div>
        <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
          Submit Match
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          {mode === "singles" && teamMode
            ? "Tap players to build each team — any size, even uneven (2v1, 3v2…). Tap again to remove."
            : mode === "singles"
            ? "Tap a player to pick winner, tap another to pick loser. Tap again to deselect."
            : "Tap a team to pick winner, tap another to pick loser. Tap again to deselect."}
        </p>
      </div>

      {/* ── MODE TOGGLE ── */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${1 + (doublesEventEnabled ? 1 : 0) + (shiftWarsEnabled ? 1 : 0)}, minmax(0, 1fr))` }}>
        <button
          type="button"
          onClick={() => setMode("singles")}
          className={`sm-tab sm-tab-pink ${mode === "singles" ? "sm-tab-active" : ""}`}>
          <span className="sm-tab-ic"><Swords className="w-3 h-3" /></span> Singles
        </button>
        {doublesEventEnabled && (
          <button
            type="button"
            onClick={() => setMode("doubles")}
            className={`sm-tab sm-tab-blue ${mode === "doubles" ? "sm-tab-active" : ""}`}>
            <span className="sm-tab-ic"><Users className="w-3 h-3" /></span> Doubles Event
          </button>
        )}
        {shiftWarsEnabled && (
          <button
            type="button"
            onClick={() => setMode("shiftwars")}
            className={`sm-tab sm-tab-green ${mode === "shiftwars" ? "sm-tab-active" : ""}`}>
            <span className="sm-tab-ic"><Building2 className="w-3 h-3" /></span> Shift Wars
          </button>
        )}
      </div>

      {mode === "doubles" && <DoublesSubmitSection />}
      {mode === "shiftwars" && <ShiftWarsSubmitSection />}

      {mode === "singles" && (teamMode ? (
        <TeamModeSubmitSection onExit={() => setTeamMode(false)} />
      ) : (
      <>
      {currentPlayer && <QuickRematch currentPlayerId={currentPlayer.playerId} onPick={(w, l) => { form.setValue("winnerId", w); form.setValue("loserId", l); }} />}

      {/* ── TEAM MODE TOGGLE ── */}
      <button
        type="button"
        onClick={() => setTeamMode(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide transition-all hover:opacity-90"
        style={{
          fontFamily: "Oswald, sans-serif",
          background: "rgba(34,197,94,0.08)",
          border: "1px dashed rgba(34,197,94,0.3)",
          color: "#22c55e",
        }}>
        <Users className="w-4 h-4" /> Turn this into a Team Match (2v2, 3v3, or uneven…)
      </button>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

          <MatchupStrip
            winner={winner ? { name: winner.name, sub: `${winner.points}pts · ${winner.elo} ELO` } : null}
            loser={loser ? { name: loser.name, sub: `${loser.points}pts · ${loser.elo} ELO` } : null}
          />

          {bothSelected && <HeadToHeadPanel winnerId={Number(winnerId)} loserId={Number(loserId)} />}

          {/* ── PLAYER GRID ── */}
          <div>
            {isLoadingPlayers ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activePlayers.map(p => (
                  <SinglesPlayerCard key={p.id} player={p} isYou={!!currentPlayer && p.id === currentPlayer.playerId}
                    isWinner={Number(winnerId) === p.id} isLoser={Number(loserId) === p.id}
                    isOther={Number(winnerId) !== p.id && Number(loserId) !== p.id && bothSelected}
                    disabled={submitMutation.isPending}
                    onClick={() => handleCardClick(p.id)} />
                ))}
              </div>
            )}
          </div>

          {/* Validation errors */}
          {form.formState.errors.winnerId && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#ff005c" }}>
              <AlertCircle className="w-3 h-3" /> {form.formState.errors.winnerId.message}
            </p>
          )}
          {form.formState.errors.loserId && (
            <p className="text-xs flex items-center gap-1" style={{ color: "#ff005c" }}>
              <AlertCircle className="w-3 h-3" /> {form.formState.errors.loserId.message}
            </p>
          )}

          {/* ── POINTS PREVIEW ── */}
          {bothSelected && winnerPts !== null && loserPts !== null && (
            <div className="pdc-card overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <div className="px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.55rem" }}>
                  Points Preview
                </span>
              </div>
              <div className="grid grid-cols-2 divide-x" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="px-4 py-3">
                  <div className="text-xs font-bold uppercase mb-1" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", fontSize: "0.55rem" }}>
                    {winner?.name}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>{winnerPts}</span>
                    <span style={{ color: "rgba(255,255,255,0.2)" }}>→</span>
                    <span className="font-black text-xl" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e" }}>
                      {stake > 0 ? winnerPts + stake : winnerPts}
                    </span>
                  </div>
                  {stake > 0 && (
                    <div className="text-xs font-bold mt-0.5" style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif" }}>
                      +{stake} pts
                    </div>
                  )}
                </div>
                <div className="px-4 py-3">
                  <div className="text-xs font-bold uppercase mb-1" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "0.55rem" }}>
                    {loser?.name}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>{loserPts}</span>
                    <span style={{ color: "rgba(255,255,255,0.2)" }}>→</span>
                    <span className="font-black text-xl" style={{ fontFamily: "Oswald, sans-serif", color: loserPts - stake <= 0 ? "#ff005c" : "rgba(255,0,92,0.7)" }}>
                      {stake > 0 ? Math.max(0, loserPts - stake) : loserPts}
                    </span>
                  </div>
                  {stake > 0 && (
                    <div className="text-xs font-bold mt-0.5" style={{ fontFamily: "Oswald, sans-serif" }}>
                      {loserPts - stake <= 0 ? (
                        <span style={{ color: "#ff005c" }}>☠ ELIMINATED</span>
                      ) : (
                        <span style={{ color: "rgba(255,0,92,0.6)" }}>−{stake} pts</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {maxStake === 0 && (
                <div className="px-4 py-2 flex items-center gap-2 border-t" style={{ borderColor: "rgba(255,0,92,0.2)", background: "rgba(255,0,92,0.06)" }}>
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "#ff005c" }} />
                  <span className="text-xs" style={{ color: "#ff005c" }}>One player is at 0 pts — cannot play</span>
                </div>
              )}
            </div>
          )}

          {/* ── STAKE ── */}
          <FormField
            control={form.control}
            name="stake"
            render={({ field }) => (
              <FormItem>
                <StakeCard value={Number(field.value) || 0} onChange={v => form.setValue("stake", v)} max={maxStake} bothSelected={bothSelected} presets={[1, 2, 3, 5, 10]} />
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── GAME TYPE ── */}
          <FormField
            control={form.control}
            name="gameType"
            render={({ field }) => (
              <FormItem>
                <GameTypeCard value={field.value ?? ""} onChange={v => form.setValue("gameType", v)} options={["501", "301", "Cricket", "Killer", "Around the World"]} theme="pink" />
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Used for format achievements and stats tracking
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── SUBMIT ── */}
          <SubmitCTA
            type="submit" theme="pink"
            submitting={submitMutation.isPending} disabled={submitMutation.isPending || maxStake === 0}
            ready={bothSelected} readyLabel={`Confirm: ${winner?.name} def. ${loser?.name}`}
            idleLabel="Select winner & loser above"
          />

        </form>
      </Form>
      </>
      ))}
    </div>
  );
}
