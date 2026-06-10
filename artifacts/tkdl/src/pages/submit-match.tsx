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
import { Swords, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

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

  const [winnerPts, setWinnerPts] = useState<number | null>(null);
  const [loserPts,  setLoserPts]  = useState<number | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { winnerId: 0, loserId: 0, stake: 5, gameType: "", notes: "" },
  });

  const winnerId = form.watch("winnerId");
  const loserId  = form.watch("loserId");
  const stake    = Number(form.watch("stake"));

  const activePlayers = players?.filter(p => p.isActive && p.status !== "ELIMINATED") ?? [];

  useEffect(() => {
    const w = activePlayers.find(p => p.id === Number(winnerId));
    const l = activePlayers.find(p => p.id === Number(loserId));
    setWinnerPts(w?.points ?? null);
    setLoserPts(l?.points  ?? null);
  }, [winnerId, loserId, players]);

  const maxStake = winnerPts !== null && loserPts !== null
    ? Math.min(winnerPts, loserPts)
    : 25;

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

  const bothSelected = winnerId > 0 && loserId > 0 && winnerId !== loserId;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="pdc-divider" />
      <div>
        <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
          Submit Match
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          Record a result — points transfer on confirmation
        </p>
      </div>

      <div className="pdc-card p-6" style={{ borderColor: "rgba(255,0,92,0.15)" }}>
        <div className="flex items-center gap-2 mb-6">
          <Swords className="w-4 h-4" style={{ color: "#ff005c" }} />
          <span className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
            Match Details
          </span>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Winner / Loser row */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-end">
              <FormField
                control={form.control}
                name="winnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif" }}>
                      Winner
                    </FormLabel>
                    <Select disabled={isLoadingPlayers || submitMutation.isPending} onValueChange={field.onChange} value={field.value ? String(field.value) : ""}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-base" style={{ background: "rgba(34,197,94,0.07)", borderColor: "rgba(34,197,94,0.25)", color: "rgba(255,255,255,0.9)" }}>
                          <SelectValue placeholder="Select winner…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activePlayers.map(p => (
                          <SelectItem key={`w-${p.id}`} value={String(p.id)}>
                            {p.name} — {p.points}pts
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {winnerPts !== null && (
                      <div className="text-xs mt-1 font-mono" style={{ color: "rgba(34,197,94,0.7)" }}>
                        Balance: {winnerPts} pts
                      </div>
                    )}
                  </FormItem>
                )}
              />

              <div className="flex justify-center items-center pb-6">
                <span className="text-2xl font-black italic" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)" }}>
                  VS
                </span>
              </div>

              <FormField
                control={form.control}
                name="loserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-widest" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                      Loser
                    </FormLabel>
                    <Select disabled={isLoadingPlayers || submitMutation.isPending} onValueChange={field.onChange} value={field.value ? String(field.value) : ""}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-base" style={{ background: "rgba(255,0,92,0.07)", borderColor: "rgba(255,0,92,0.25)", color: "rgba(255,255,255,0.9)" }}>
                          <SelectValue placeholder="Select loser…" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activePlayers.map(p => (
                          <SelectItem key={`l-${p.id}`} value={String(p.id)}>
                            {p.name} — {p.points}pts
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {loserPts !== null && (
                      <div className="text-xs mt-1 font-mono" style={{ color: "rgba(255,0,92,0.7)" }}>
                        Balance: {loserPts} pts
                      </div>
                    )}
                  </FormItem>
                )}
              />
            </div>

            {/* Stake */}
            <div>
              <FormField
                control={form.control}
                name="stake"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between mb-1.5">
                      <FormLabel className="text-xs font-bold uppercase tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>
                        Stake (Points Wagered)
                      </FormLabel>
                      {bothSelected && (
                        <span className="text-xs font-mono" style={{ color: "rgba(255,210,74,0.7)" }}>
                          max {maxStake}
                        </span>
                      )}
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
                    {bothSelected && maxStake < 25 && (
                      <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                        Limited by lowest balance ({maxStake} pts)
                      </p>
                    )}
                    {bothSelected && maxStake === 0 && (
                      <p className="flex items-center gap-1 text-xs mt-1" style={{ color: "#ff005c" }}>
                        <AlertCircle className="w-3 h-3" />
                        One player is already at 0 pts — cannot play
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </div>

            {/* Points preview */}
            {bothSelected && stake > 0 && winnerPts !== null && loserPts !== null && (
              <div className="pdc-card p-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-xs uppercase tracking-widest mb-2 font-bold" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                  After Match
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div style={{ color: "#22c55e" }}>Winner gains</div>
                    <div className="font-bold text-lg" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e" }}>
                      {winnerPts} → {winnerPts + stake}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#ff005c" }}>Loser loses</div>
                    <div className="font-bold text-lg" style={{ fontFamily: "Oswald, sans-serif", color: loserPts - stake <= 0 ? "#ff005c" : "rgba(255,255,255,0.7)" }}>
                      {loserPts} → {Math.max(0, loserPts - stake)}
                      {loserPts - stake <= 0 && <span className="ml-2 text-sm">☠ ELIMINATED</span>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Game Type */}
            <FormField
              control={form.control}
              name="gameType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.5)", fontFamily: "Oswald, sans-serif" }}>
                    Game Type
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. 501, 301, Cricket, Around the World, Killer…"
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

            <Button
              type="submit"
              className="w-full h-14 text-lg font-bold uppercase tracking-widest"
              disabled={submitMutation.isPending || maxStake === 0}
              style={{ fontFamily: "Oswald, sans-serif", background: "#ff005c", color: "#fff", border: "none", letterSpacing: "0.12em" }}
            >
              {submitMutation.isPending ? "Submitting…" : "Submit Result"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
