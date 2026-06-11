import {
  useListPlayers,
  useCreatePlayer,
  getListPlayersQueryKey,
  getGetStatsSummaryQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Skull, Flame, Target } from "lucide-react";
import { useState } from "react";
import { TierBadge } from "@/components/tier-badge";

const formSchema = z.object({
  name:     z.string().min(1, "Name is required"),
  nickname: z.string().optional(),
});

const RANK_COLORS: Record<number, string> = {
  0: "#ffd24a", 1: "#ff008c", 2: "#00aaff", 3: "#ff5050", 4: "#00ffaa",
};

const RARITY_COLOR: Record<string, string> = {
  Common: "#9ca3af", Rare: "#3b82f6", Epic: "#a855f7", Legendary: "#ffd24a",
};

const TIER_BAND: Record<string, { min: number; max: number }> = {
  Bronze: { min: 800, max: 950 }, Silver: { min: 950, max: 1100 },
  Gold: { min: 1100, max: 1250 }, Platinum: { min: 1250, max: 1400 },
  Diamond: { min: 1400, max: 1600 },
};

const TIER_ELO_COLOR: Record<string, string> = {
  Diamond: "#00e5ff", Platinum: "#e5e4e2", Gold: "#ffd24a", Silver: "#9ca3af", Bronze: "#cd7f32",
};

function PlayerCard({ player, leaderboardRank }: { player: any; leaderboardRank?: number }) {
  const isElim = player.status === "ELIMINATED";
  const pts    = isElim ? 0 : (player.points ?? 25);
  const streak = player.currentWinStreak ?? 0;
  const rank   = leaderboardRank ?? 99;

  const rankCls = isElim ? "pc-eliminated"
    : rank === 0 ? "pc-rank-1"
    : rank === 1 ? "pc-rank-2"
    : rank === 2 ? "pc-rank-3"
    : rank === 3 ? "pc-rank-4"
    : rank === 4 ? "pc-rank-5"
    : "";

  const accentColor = isElim ? "#ff005c" : (RANK_COLORS[rank] ?? "rgba(255,255,255,0.55)");
  const nameRepeat  = `${player.name.toUpperCase()}  ·  `.repeat(8);

  return (
    <Link href={`/players/${player.id}`}>
      <div className={`player-glass-card ${rankCls} p-5`} style={{ minHeight: "210px" }}>

        {/* Scrolling name watermark */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" style={{ zIndex: 0 }}>
          <div style={{
            position: "absolute",
            top: "28%",
            whiteSpace: "nowrap",
            fontFamily: "Oswald, sans-serif",
            fontSize: "3rem",
            fontWeight: 900,
            color: accentColor,
            letterSpacing: "0.08em",
            opacity: isElim ? 0.04 : 0.06,
            lineHeight: 1,
            animation: "player-name-scroll 18s linear infinite",
            willChange: "transform",
          }}>
            {nameRepeat}
          </div>
        </div>

        {/* Rank badge top-right */}
        {!isElim && rank < 99 && (
          <div className="absolute top-4 right-4 z-10">
            <div className="flex items-center justify-center w-8 h-8 rounded-full font-black text-sm"
              style={{
                fontFamily: "Oswald, sans-serif",
                background: `${accentColor}18`,
                border: `1.5px solid ${accentColor}55`,
                color: accentColor,
                textShadow: `0 0 8px ${accentColor}88`,
                fontSize: rank === 0 ? "0.9rem" : "0.8rem",
              }}>
              #{rank + 1}
            </div>
          </div>
        )}

        {/* Content layer */}
        <div style={{ position: "relative", zIndex: 2 }}>
          {/* Target icon row */}
          <div className="flex items-center gap-2 mb-3">
            {isElim ? (
              <span className="text-xl">☠</span>
            ) : (
              <div className="relative">
                <Target className="w-5 h-5" style={{ color: accentColor, filter: `drop-shadow(0 0 6px ${accentColor}88)` }} />
              </div>
            )}
            {streak >= 3 && !isElim && (
              <div className="flex items-center gap-1 text-xs font-black" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                <Flame className="w-3 h-3 streak-fire" />{streak}W
              </div>
            )}
          </div>

          {/* Name */}
          <div className="font-black uppercase leading-tight mb-0.5"
            style={{
              fontFamily: "Oswald, sans-serif", fontSize: "1.4rem", letterSpacing: "0.03em",
              color: isElim ? "rgba(255,100,100,0.7)" : "rgba(255,255,255,0.96)",
              textShadow: isElim ? undefined : `0 0 20px ${accentColor}33`,
            }}>
            {player.name}
          </div>

          {(player as any).nickname && (
            <div className="text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.28)", fontStyle: "italic" }}>
              "{(player as any).nickname}"
            </div>
          )}

          {/* Title badge */}
          {(player as any).activeTitleLabel && (
            <div className="mb-2">
              <span style={{
                display: "inline-block",
                fontFamily: "Oswald, sans-serif", fontSize: "0.52rem",
                padding: "2px 7px", borderRadius: "6px",
                letterSpacing: "0.1em", fontWeight: 700,
                color: RARITY_COLOR[(player as any).activeTitleRarity] ?? "#9ca3af",
                background: `${RARITY_COLOR[(player as any).activeTitleRarity] ?? "#9ca3af"}18`,
                border: `1px solid ${RARITY_COLOR[(player as any).activeTitleRarity] ?? "#9ca3af"}38`,
              }}>
                {(player as any).activeTitleIcon} {(player as any).activeTitleLabel}
              </span>
            </div>
          )}

          {/* Points + tier */}
          {!isElim && (
            <div className="flex items-end justify-between mt-2 mb-3">
              <div className="flex items-baseline gap-1.5">
                <span className="font-black tabular-nums leading-none"
                  style={{ fontFamily: "Oswald, sans-serif", fontSize: "2.4rem", color: accentColor, textShadow: `0 0 22px ${accentColor}88`, lineHeight: 1 }}>
                  {pts}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>pts</span>
              </div>
              <TierBadge tier={player.tier} />
            </div>
          )}

          {/* Divider */}
          <div style={{ height: "1px", background: `${accentColor}22`, margin: "8px 0" }} />

          {/* Stats row */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.8rem" }}>
                {player.seasonWins ?? 0}W
              </span>
              <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
              <span style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif", fontWeight: 700, fontSize: "0.8rem" }}>
                {player.seasonLosses ?? 0}L
              </span>
            </div>
            {/* Recent form dots */}
            {Array.isArray((player as any).recentForm) && (player as any).recentForm.length > 0 && (
              <div className="flex items-center gap-1">
                {((player as any).recentForm as string[]).slice(0, 5).map((r, i) => (
                  <div key={i} style={{
                    width: "10px", height: "10px", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: r === "W" ? "rgba(34,197,94,0.18)" : "rgba(255,0,92,0.12)",
                    border: `1px solid ${r === "W" ? "rgba(34,197,94,0.45)" : "rgba(255,0,92,0.38)"}`,
                  }}>
                    <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.3rem", fontWeight: 900, color: r === "W" ? "#22c55e" : "#ff005c" }}>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Elo progress bar */}
          {!isElim && (() => {
            const band = TIER_BAND[player.tier ?? "Bronze"] ?? { min: 800, max: 1000 };
            const pct  = Math.min(100, Math.max(0, ((player.elo - band.min) / (band.max - band.min)) * 100));
            const col  = TIER_ELO_COLOR[player.tier ?? "Bronze"] ?? "#9ca3af";
            return (
              <div style={{ marginTop: "6px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.45rem", color: "rgba(255,255,255,0.18)", letterSpacing: "0.08em" }}>ELO BAND</span>
                  <span style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.55rem", fontWeight: 700, color: "#0066ff" }}>{player.elo}</span>
                </div>
                <div style={{ height: "2px", background: "rgba(255,255,255,0.05)", borderRadius: "1px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: col, borderRadius: "1px", opacity: 0.6, transition: "width 0.5s ease" }} />
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </Link>
  );
}

export default function Players() {
  const { data: players, isLoading } = useListPlayers();
  const createPlayerMutation = useCreatePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", nickname: "" },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createPlayerMutation.mutate({ data: values }, {
      onSuccess: (data: any) => {
        toast({ title: "Player Registered", description: `${data.name} has joined the league.` });
        form.reset();
        setIsOpen(false);
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
      },
      onError: (error: any) => {
        toast({ title: "Error", description: error.message ?? "Failed.", variant: "destructive" });
      },
    });
  }

  const active     = players?.filter(p => p.isActive && p.status !== "ELIMINATED") ?? [];
  const eliminated = players?.filter(p => p.isActive && p.status === "ELIMINATED") ?? [];
  const inactive   = players?.filter(p => !p.isActive) ?? [];

  const activeSorted = [...active].sort((a, b) => (b.points ?? 25) - (a.points ?? 25));
  const rankMap = new Map(activeSorted.map((p, i) => [p.id, i]));

  return (
    <div className="space-y-8">
      <div className="pdc-divider" />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="uppercase font-black"
            style={{ fontFamily: "Oswald, sans-serif", fontSize: "3rem", letterSpacing: "0.04em", textShadow: "0 0 30px rgba(255,0,92,0.2)" }}>
            Player Registry
          </h1>
          <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {active.length} active{eliminated.length > 0 ? ` · ${eliminated.length} eliminated` : ""}{inactive.length > 0 ? ` · ${inactive.length} inactive` : ""}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl" style={{ background: "#ff005c", border: "none", fontFamily: "Oswald, sans-serif", letterSpacing: "0.08em" }}>
              <Plus className="h-4 w-4" /> Add Player
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Player</DialogTitle>
              <DialogDescription>New players start with 25 points and Silver ELO (1000).</DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="nickname" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nickname (optional)</FormLabel>
                    <FormControl><Input placeholder="The Sniper" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full rounded-xl" disabled={createPlayerMutation.isPending}
                  style={{ background: "#ff005c", border: "none" }}>
                  {createPlayerMutation.isPending ? "Registering…" : "Register Player"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : (
        <div className="space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {activeSorted.map((player, i) => (
              <div key={player.id} className="fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
                <PlayerCard player={player} leaderboardRank={rankMap.get(player.id)} />
              </div>
            ))}
          </div>

          {eliminated.length > 0 && (
            <div>
              <h2 className="text-sm uppercase tracking-widest mb-4 flex items-center gap-2 font-black"
                style={{ color: "rgba(255,0,92,0.75)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.18em" }}>
                <Skull className="w-4 h-4" style={{ filter: "drop-shadow(0 0 5px rgba(255,0,92,0.7))" }} />
                Eliminated
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {eliminated.map((player, i) => (
                  <div key={player.id} className="fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                    <PlayerCard player={player} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {inactive.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
                Inactive / Departed
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {inactive.map(player => (
                  <Link key={player.id} href={`/players/${player.id}`}>
                    <div className="pdc-card p-3 cursor-pointer opacity-30 hover:opacity-50 transition-opacity">
                      <div className="font-bold text-sm uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.6)" }}>{player.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Inactive</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
