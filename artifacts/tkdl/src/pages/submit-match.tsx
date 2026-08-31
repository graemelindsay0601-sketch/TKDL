import {
  useListPlayers,
  useSubmitMatch,
  getGetLeaderboardQueryKey,
  getGetStatsSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getListMatchesQueryKey,
  getGetPlayerStatsQueryKey,
  getGetPlayerQueryKey,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Swords, AlertCircle, Crown, Skull, X, Trophy, Users, Target, Building2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TierBadge } from "@/components/tier-badge";
import { useSettings } from "@/hooks/use-settings";

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
    fetch("/api/seasons/current")
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
      {/* Matchup strip */}
      <div className="pdc-card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr]">
          <div className="px-4 py-3 flex flex-col gap-1 min-w-0" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: winner ? "rgba(34,197,94,0.05)" : undefined }}>
            <div className="flex items-center gap-1.5">
              <Crown className="w-3 h-3 shrink-0" style={{ color: "#22c55e" }} />
              <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", fontSize: "0.55rem" }}>Winner</span>
            </div>
            {winner ? (
              <div>
                <div className="font-black uppercase leading-tight truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", fontSize: "1.05rem" }}>{winner.name}</div>
                <div className="text-xs font-mono" style={{ color: "rgba(34,197,94,0.6)" }}>{winner.points}pts</div>
              </div>
            ) : <div className="text-sm" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>tap a team ↓</div>}
          </div>
          <div className="flex items-center justify-center px-4" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="text-center">
              <Swords className="w-4 h-4 mx-auto mb-0.5" style={{ color: "rgba(255,255,255,0.2)" }} />
              <span className="font-black text-xs italic" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)" }}>VS</span>
            </div>
          </div>
          <div className="px-4 py-3 flex flex-col gap-1 min-w-0" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: loser ? "rgba(255,0,92,0.05)" : undefined }}>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "0.55rem" }}>Loser</span>
              <Skull className="w-3 h-3 shrink-0" style={{ color: "#ff005c" }} />
            </div>
            {loser ? (
              <div className="text-right">
                <div className="font-black uppercase leading-tight truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "1.05rem" }}>{loser.name}</div>
                <div className="text-xs font-mono" style={{ color: "rgba(255,0,92,0.6)" }}>{loser.points}pts</div>
              </div>
            ) : <div className="text-sm text-right" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>tap a team ↓</div>}
          </div>
        </div>
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {teams.map((t: any) => {
          const isWinner = winnerTeamId === t.id;
          const isLoser  = loserTeamId === t.id;
          const isOther  = !isWinner && !isLoser && bothSelected;
          return (
            <button key={t.id} type="button" onClick={() => handleCardClick(t.id)} disabled={submitting}
              className="relative rounded-xl overflow-hidden text-left transition-all duration-150 focus:outline-none"
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
        })}
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

      {/* Stake */}
      <div className="pdc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>Stake</span>
          {bothSelected && <span className="text-xs font-mono" style={{ color: "rgba(255,210,74,0.5)" }}>max {maxStake} pts</span>}
        </div>
        <div className="flex gap-2 mb-3">
          {[1, 2, 5, 10, 20].map(v => (
            <button key={v} type="button" onClick={() => setStake(String(v))} disabled={bothSelected && v > maxStake}
              className="flex-1 py-2 rounded-lg text-sm font-black uppercase transition-all"
              style={{
                fontFamily: "Oswald, sans-serif",
                background: stakeN === v ? "rgba(255,210,74,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${stakeN === v ? "rgba(255,210,74,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: stakeN === v ? "#ffd24a" : "rgba(255,255,255,0.35)",
                opacity: bothSelected && v > maxStake ? 0.3 : 1,
              }}>{v}</button>
          ))}
        </div>
        <Input type="number" min={1} max={bothSelected ? maxStake : 50} value={stake} onChange={e => setStake(e.target.value)}
          className="text-center text-2xl font-bold h-14"
          style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", background: "rgba(255,210,74,0.05)", borderColor: "rgba(255,210,74,0.2)" }} />
      </div>

      {/* Game type */}
      <div className="pdc-card p-4">
        <span className="text-xs font-black uppercase tracking-widest block mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>Game Type</span>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {["501", "301", "Cricket", "Killer"].map(gt => (
            <button key={gt} type="button" onClick={() => setGameType(gameType === gt ? "" : gt)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all"
              style={{
                fontFamily: "Oswald, sans-serif",
                background: gameType === gt ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${gameType === gt ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: gameType === gt ? "#22c55e" : "rgba(255,255,255,0.35)",
              }}>{gt}</button>
          ))}
        </div>
        <Input placeholder="Or type a custom game…" value={gameType} onChange={e => setGameType(e.target.value)}
          style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }} />
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !bothSelected || maxStake === 0}
        className="w-full h-14 rounded-xl text-lg font-black uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-40"
        style={{
          fontFamily: "Oswald, sans-serif",
          background: bothSelected ? "linear-gradient(135deg, #22c55e, #15803d)" : "rgba(255,255,255,0.06)",
          color: bothSelected ? "#fff" : "rgba(255,255,255,0.3)",
          border: "none", letterSpacing: "0.12em",
          boxShadow: bothSelected ? "0 0 24px rgba(34,197,94,0.25)" : undefined,
        }}>
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#fff" }} />
            Submitting…
          </span>
        ) : bothSelected && winner && loser ? (
          <span className="flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5" />
            Confirm: {winner.name} def. {loser.name}
          </span>
        ) : "Select winning & losing team above"}
      </button>
    </div>
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
      {/* Matchup strip */}
      <div className="pdc-card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_1fr]">
          <div className="px-4 py-3 flex flex-col gap-1 min-w-0" style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: winner ? "rgba(34,197,94,0.05)" : undefined }}>
            <div className="flex items-center gap-1.5">
              <Crown className="w-3 h-3 shrink-0" style={{ color: "#22c55e" }} />
              <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", fontSize: "0.55rem" }}>Winner</span>
            </div>
            {winner ? (
              <div>
                <div className="font-black uppercase leading-tight truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", fontSize: "1.05rem" }}>{winner.teamName}</div>
                <div className="text-xs font-mono" style={{ color: "rgba(34,197,94,0.6)" }}>{winner.points}pts · {winner.elo} ELO</div>
              </div>
            ) : <div className="text-sm" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>tap a team ↓</div>}
          </div>
          <div className="flex items-center justify-center px-4" style={{ background: "rgba(255,255,255,0.02)" }}>
            <div className="text-center">
              <Swords className="w-4 h-4 mx-auto mb-0.5" style={{ color: "rgba(255,255,255,0.2)" }} />
              <span className="font-black text-xs italic" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)" }}>VS</span>
            </div>
          </div>
          <div className="px-4 py-3 flex flex-col gap-1 min-w-0" style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: loser ? "rgba(255,0,92,0.05)" : undefined }}>
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "0.55rem" }}>Loser</span>
              <Skull className="w-3 h-3 shrink-0" style={{ color: "#ff005c" }} />
            </div>
            {loser ? (
              <div className="text-right">
                <div className="font-black uppercase leading-tight truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "1.05rem" }}>{loser.teamName}</div>
                <div className="text-xs font-mono" style={{ color: "rgba(255,0,92,0.6)" }}>{loser.points}pts · {loser.elo} ELO</div>
              </div>
            ) : <div className="text-sm text-right" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>tap a team ↓</div>}
          </div>
        </div>
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {activeTeams.map((t: any) => {
          const isWinner = winnerTeamId === t.id;
          const isLoser  = loserTeamId === t.id;
          const isOther  = !isWinner && !isLoser && bothSelected;
          return (
            <button key={t.id} type="button" onClick={() => handleCardClick(t.id)} disabled={submitting}
              className="relative rounded-xl overflow-hidden text-left transition-all duration-150 focus:outline-none"
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
        })}
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

      {/* Stake */}
      <div className="pdc-card p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>Stake</span>
          {bothSelected && <span className="text-xs font-mono" style={{ color: "rgba(255,210,74,0.5)" }}>max {maxStake} pts</span>}
        </div>
        <div className="flex gap-2 mb-3">
          {[1, 2, 5, 10, 20].map(v => (
            <button key={v} type="button" onClick={() => setStake(String(v))} disabled={bothSelected && v > maxStake}
              className="flex-1 py-2 rounded-lg text-sm font-black uppercase transition-all"
              style={{
                fontFamily: "Oswald, sans-serif",
                background: stakeN === v ? "rgba(255,210,74,0.18)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${stakeN === v ? "rgba(255,210,74,0.5)" : "rgba(255,255,255,0.08)"}`,
                color: stakeN === v ? "#ffd24a" : "rgba(255,255,255,0.35)",
                opacity: bothSelected && v > maxStake ? 0.3 : 1,
              }}>{v}</button>
          ))}
        </div>
        <Input type="number" min={1} max={bothSelected ? maxStake : 50} value={stake} onChange={e => setStake(e.target.value)}
          className="text-center text-2xl font-bold h-14"
          style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", background: "rgba(255,210,74,0.05)", borderColor: "rgba(255,210,74,0.2)" }} />
      </div>

      {/* Game type */}
      <div className="pdc-card p-4">
        <span className="text-xs font-black uppercase tracking-widest block mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>Game Type</span>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {["501", "301", "Cricket", "Killer"].map(gt => (
            <button key={gt} type="button" onClick={() => setGameType(gameType === gt ? "" : gt)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all"
              style={{
                fontFamily: "Oswald, sans-serif",
                background: gameType === gt ? "rgba(0,102,255,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${gameType === gt ? "rgba(0,102,255,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: gameType === gt ? "#0066ff" : "rgba(255,255,255,0.35)",
              }}>{gt}</button>
          ))}
        </div>
        <Input placeholder="Or type a custom game…" value={gameType} onChange={e => setGameType(e.target.value)}
          style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }} />
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !bothSelected || maxStake === 0}
        className="w-full h-14 rounded-xl text-lg font-black uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-40"
        style={{
          fontFamily: "Oswald, sans-serif",
          background: bothSelected ? "linear-gradient(135deg, #0066ff, #0047b3)" : "rgba(255,255,255,0.06)",
          color: bothSelected ? "#fff" : "rgba(255,255,255,0.3)",
          border: "none", letterSpacing: "0.12em",
          boxShadow: bothSelected ? "0 0 24px rgba(0,102,255,0.25)" : undefined,
        }}>
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#fff" }} />
            Submitting…
          </span>
        ) : bothSelected && winner && loser ? (
          <span className="flex items-center justify-center gap-2">
            <Trophy className="w-5 h-5" />
            Confirm: {winner.teamName} def. {loser.teamName}
          </span>
        ) : "Select winning & losing team above"}
      </button>
    </div>
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
  const { data: players, isLoading: isLoadingPlayers } = useListPlayers();
  const submitMutation = useSubmitMatch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
          {mode === "singles"
            ? "Tap a player to pick winner, tap another to pick loser. Tap again to deselect."
            : "Tap a team to pick winner, tap another to pick loser. Tap again to deselect."}
        </p>
      </div>

      {/* ── MODE TOGGLE ── */}
      <div className="grid gap-2 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", gridTemplateColumns: `repeat(${1 + (doublesEventEnabled ? 1 : 0) + (shiftWarsEnabled ? 1 : 0)}, minmax(0, 1fr))` }}>
        <button
          type="button"
          onClick={() => setMode("singles")}
          className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black uppercase tracking-wide transition-all"
          style={{
            fontFamily: "Oswald, sans-serif",
            background: mode === "singles" ? "rgba(255,0,92,0.15)" : "transparent",
            color: mode === "singles" ? "#ff005c" : "rgba(255,255,255,0.35)",
            boxShadow: mode === "singles" ? "0 0 16px rgba(255,0,92,0.12)" : undefined,
          }}>
          <Swords className="w-4 h-4" /> Singles
        </button>
        {doublesEventEnabled && (
          <button
            type="button"
            onClick={() => setMode("doubles")}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black uppercase tracking-wide transition-all"
            style={{
              fontFamily: "Oswald, sans-serif",
              background: mode === "doubles" ? "rgba(0,102,255,0.15)" : "transparent",
              color: mode === "doubles" ? "#0066ff" : "rgba(255,255,255,0.35)",
              boxShadow: mode === "doubles" ? "0 0 16px rgba(0,102,255,0.12)" : undefined,
            }}>
            <Users className="w-4 h-4" /> Doubles Event
          </button>
        )}
        {shiftWarsEnabled && (
          <button
            type="button"
            onClick={() => setMode("shiftwars")}
            className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-black uppercase tracking-wide transition-all"
            style={{
              fontFamily: "Oswald, sans-serif",
              background: mode === "shiftwars" ? "rgba(34,197,94,0.15)" : "transparent",
              color: mode === "shiftwars" ? "#22c55e" : "rgba(255,255,255,0.35)",
              boxShadow: mode === "shiftwars" ? "0 0 16px rgba(34,197,94,0.12)" : undefined,
            }}>
            <Building2 className="w-4 h-4" /> Shift Wars
          </button>
        )}
      </div>

      {mode === "doubles" && <DoublesSubmitSection />}
      {mode === "shiftwars" && <ShiftWarsSubmitSection />}

      {mode === "singles" && (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

          {/* ── MATCHUP STRIP ── */}
          <div className="pdc-card overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_1fr]">
              {/* Winner slot */}
              <div className="px-4 py-3 flex flex-col gap-1 min-w-0"
                style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: winner ? "rgba(34,197,94,0.05)" : undefined }}>
                <div className="flex items-center gap-1.5">
                  <Crown className="w-3 h-3 shrink-0" style={{ color: "#22c55e" }} />
                  <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", fontSize: "0.55rem" }}>
                    Winner
                  </span>
                </div>
                {winner ? (
                  <div>
                    <div className="font-black uppercase leading-tight truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e", fontSize: "1.05rem" }}>
                      {winner.name}
                    </div>
                    <div className="text-xs font-mono" style={{ color: "rgba(34,197,94,0.6)" }}>
                      {winner.points}pts · {winner.elo} ELO
                    </div>
                  </div>
                ) : (
                  <div className="text-sm" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                    tap a player ↓
                  </div>
                )}
              </div>

              {/* VS */}
              <div className="flex items-center justify-center px-4"
                style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="text-center">
                  <Swords className="w-4 h-4 mx-auto mb-0.5" style={{ color: "rgba(255,255,255,0.2)" }} />
                  <span className="font-black text-xs italic" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)" }}>VS</span>
                </div>
              </div>

              {/* Loser slot */}
              <div className="px-4 py-3 flex flex-col gap-1 min-w-0"
                style={{ borderLeft: "1px solid rgba(255,255,255,0.06)", background: loser ? "rgba(255,0,92,0.05)" : undefined }}>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "0.55rem" }}>
                    Loser
                  </span>
                  <Skull className="w-3 h-3 shrink-0" style={{ color: "#ff005c" }} />
                </div>
                {loser ? (
                  <div className="text-right">
                    <div className="font-black uppercase leading-tight truncate" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "1.05rem" }}>
                      {loser.name}
                    </div>
                    <div className="text-xs font-mono" style={{ color: "rgba(255,0,92,0.6)" }}>
                      {loser.points}pts · {loser.elo} ELO
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-right" style={{ color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>
                    tap a player ↓
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── PLAYER GRID ── */}
          <div>
            {isLoadingPlayers ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activePlayers.map(p => {
                  const isWinner = Number(winnerId) === p.id;
                  const isLoser  = Number(loserId)  === p.id;
                  const isOther  = !isWinner && !isLoser && bothSelected;
                  const derivedTier = p.elo >= 1400 ? "Diamond" : p.elo >= 1250 ? "Platinum" : p.elo >= 1100 ? "Gold" : p.elo >= 950 ? "Silver" : "Bronze";
                  const tier = (p as any).tier || derivedTier;
                  const tierColor = TIER_COLOR[tier] ?? "#94a3b8";
                  const winRate = (p.seasonGamesPlayed ?? 0) > 0
                    ? Math.round(((p.seasonWins ?? 0) / (p.seasonGamesPlayed ?? 1)) * 100) : 0;

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleCardClick(p.id)}
                      disabled={submitMutation.isPending}
                      className="relative rounded-xl overflow-hidden text-left transition-all duration-150 focus:outline-none"
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
                        <div className="space-y-1">
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
                      </div>
                    </button>
                  );
                })}
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
          <div className="pdc-card p-4">
            <FormField
              control={form.control}
              name="stake"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between mb-3">
                    <FormLabel className="text-xs font-black uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>
                      Stake
                    </FormLabel>
                    {bothSelected && (
                      <span className="text-xs font-mono" style={{ color: "rgba(255,210,74,0.5)" }}>
                        max {maxStake} pts
                      </span>
                    )}
                  </div>

                  {/* Quick-pick buttons */}
                  <div className="flex gap-2 mb-3">
                    {[1, 2, 3, 5, 10].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => form.setValue("stake", v)}
                        disabled={bothSelected && v > maxStake}
                        className="flex-1 py-2 rounded-lg text-sm font-black uppercase transition-all"
                        style={{
                          fontFamily: "Oswald, sans-serif",
                          background: stake === v ? "rgba(255,210,74,0.18)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${stake === v ? "rgba(255,210,74,0.5)" : "rgba(255,255,255,0.08)"}`,
                          color: stake === v ? "#ffd24a" : "rgba(255,255,255,0.35)",
                          opacity: bothSelected && v > maxStake ? 0.3 : 1,
                        }}>
                        {v}
                      </button>
                    ))}
                  </div>

                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      max={bothSelected ? maxStake : 25}
                      {...field}
                      className="text-center text-2xl font-bold h-14"
                      style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", background: "rgba(255,210,74,0.05)", borderColor: "rgba(255,210,74,0.2)" }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* ── GAME TYPE ── */}
          <div className="pdc-card p-4">
            <FormField
              control={form.control}
              name="gameType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-black uppercase tracking-widest block mb-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>
                    Game Type
                  </FormLabel>

                  {/* Quick-pick chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {["501", "301", "Cricket", "Killer", "Around the World"].map(gt => (
                      <button
                        key={gt}
                        type="button"
                        onClick={() => form.setValue("gameType", field.value === gt ? "" : gt)}
                        className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase transition-all"
                        style={{
                          fontFamily: "Oswald, sans-serif",
                          background: field.value === gt ? "rgba(255,0,92,0.15)" : "rgba(255,255,255,0.04)",
                          border: `1px solid ${field.value === gt ? "rgba(255,0,92,0.4)" : "rgba(255,255,255,0.08)"}`,
                          color: field.value === gt ? "#ff005c" : "rgba(255,255,255,0.35)",
                        }}>
                        {gt}
                      </button>
                    ))}
                  </div>

                  <FormControl>
                    <Input
                      placeholder="Or type a custom game…"
                      {...field}
                      style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}
                    />
                  </FormControl>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Used for format achievements and stats tracking
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* ── SUBMIT ── */}
          <button
            type="submit"
            disabled={submitMutation.isPending || maxStake === 0}
            className="w-full h-14 rounded-xl text-lg font-black uppercase tracking-widest transition-all hover:opacity-90 disabled:opacity-40"
            style={{
              fontFamily: "Oswald, sans-serif",
              background: bothSelected ? "linear-gradient(135deg, #ff005c, #cc0049)" : "rgba(255,255,255,0.06)",
              color: bothSelected ? "#fff" : "rgba(255,255,255,0.3)",
              border: "none",
              letterSpacing: "0.12em",
              boxShadow: bothSelected ? "0 0 24px rgba(255,0,92,0.25)" : undefined,
            }}>
            {submitMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#fff" }} />
                Submitting…
              </span>
            ) : bothSelected ? (
              <span className="flex items-center justify-center gap-2">
                <Trophy className="w-5 h-5" />
                Confirm: {winner?.name} def. {loser?.name}
              </span>
            ) : (
              "Select winner & loser above"
            )}
          </button>

        </form>
      </Form>
      )}
    </div>
  );
}
