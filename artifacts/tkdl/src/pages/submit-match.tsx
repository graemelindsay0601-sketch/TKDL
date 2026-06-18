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
import { Swords, AlertCircle, Crown, Skull, X, Trophy } from "lucide-react";
import { useState } from "react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { TierBadge } from "@/components/tier-badge";

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
  stake:    z.coerce.number().min(1, "Stake must be at least 1").max(25),
  gameType: z.string().optional(),
  notes:    z.string().optional(),
}).refine(d => d.winnerId !== d.loserId, {
  message: "A player cannot play against themselves",
  path: ["loserId"],
});

type FormValues = z.infer<typeof formSchema>;

export default function SubmitMatch() {
  const { data: players, isLoading: isLoadingPlayers } = useListPlayers();
  const submitMutation = useSubmitMatch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
          Tap a player to pick winner, tap another to pick loser
        </p>
      </div>

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
    </div>
  );
}
