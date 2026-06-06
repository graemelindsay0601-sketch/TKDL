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

const formSchema = z.object({
  name:     z.string().min(1, "Name is required"),
  nickname: z.string().optional(),
});

function tierConfig(tier: string) {
  if (tier === "Diamond")  return { gradient: "linear-gradient(135deg, #0a1628 0%, #0d2a5e 50%, #0066ff 100%)", glow: "rgba(0,102,255,0.6)",  ring: "#0066ff", color: "#4da6ff" };
  if (tier === "Platinum") return { gradient: "linear-gradient(135deg, #1a1a2e 0%, #2d2d5e 50%, #7b68ee 100%)", glow: "rgba(123,104,238,0.6)", ring: "#7b68ee", color: "#b8a9ff" };
  if (tier === "Gold")     return { gradient: "linear-gradient(135deg, #1a1200 0%, #3d2e00 50%, #ff9900 100%)", glow: "rgba(255,210,74,0.7)",  ring: "#ffd24a", color: "#ffd24a" };
  if (tier === "Silver")   return { gradient: "linear-gradient(135deg, #0d0d14 0%, #1a1a2e 50%, #2a3a5e 100%)", glow: "rgba(192,200,216,0.5)", ring: "#c0c8d8", color: "#c0c8d8" };
  return                           { gradient: "linear-gradient(135deg, #1a0800 0%, #2e1500 50%, #7a3b00 100%)", glow: "rgba(205,127,50,0.5)",  ring: "#cd7f32", color: "#e8a050" };
}

function PlayerCard({ player }: { player: any }) {
  const isElim = player.status === "ELIMINATED";
  const tier   = (player as any).tier || (player.elo >= 1250 ? "Diamond" : player.elo >= 1100 ? "Gold" : player.elo >= 980 ? "Silver" : "Bronze");
  const cfg    = tierConfig(tier);
  const streak = player.currentWinStreak ?? 0;
  const pts    = isElim ? 0 : (player.points ?? 25);

  return (
    <Link href={`/players/${player.id}`}>
      <div
        className="group relative overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1"
        style={{
          borderRadius: "6px",
          border: isElim ? "1px solid rgba(255,0,92,0.25)" : `1px solid ${cfg.ring}33`,
          boxShadow: isElim
            ? "0 0 20px rgba(255,0,92,0.12)"
            : `0 0 0 transparent`,
          background: "#0c0c14",
        }}
      >
        {/* Hover glow overlay */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
          style={{ boxShadow: `inset 0 0 30px ${isElim ? "rgba(255,0,92,0.1)" : cfg.glow + "22"}`, borderRadius: "6px" }}
        />

        {/* Header banner */}
        <div
          className="relative flex items-center justify-between px-4 py-3"
          style={{
            background: isElim
              ? "linear-gradient(135deg, #1a0000 0%, #2d0010 50%, #4a0020 100%)"
              : cfg.gradient,
            borderBottom: `1px solid ${isElim ? "rgba(255,0,92,0.2)" : cfg.ring + "44"}`,
          }}
        >
          {/* Large initials */}
          <div
            className="text-3xl font-black uppercase tracking-tighter leading-none"
            style={{
              fontFamily: "Oswald, sans-serif",
              color: isElim ? "rgba(255,0,92,0.7)" : cfg.color,
              textShadow: `0 0 20px ${isElim ? "rgba(255,0,92,0.6)" : cfg.glow}`,
              letterSpacing: "-0.04em",
            }}
          >
            {isElim ? "☠" : player.name.substring(0, 2).toUpperCase()}
          </div>

          {/* Tier badge */}
          <div
            className="text-xs font-bold uppercase tracking-widest px-2 py-1"
            style={{
              fontFamily: "Oswald, sans-serif",
              color: isElim ? "#ff005c" : cfg.color,
              background: isElim ? "rgba(255,0,92,0.15)" : `${cfg.ring}22`,
              border: `1px solid ${isElim ? "rgba(255,0,92,0.3)" : cfg.ring + "55"}`,
              borderRadius: "2px",
              fontSize: "0.6rem",
              letterSpacing: "0.14em",
            }}
          >
            {isElim ? "ELIMINATED" : tier.toUpperCase()}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {/* Name */}
          <div
            className="font-bold text-lg uppercase leading-tight mb-0.5"
            style={{
              fontFamily: "Oswald, sans-serif",
              color: isElim ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.92)",
              letterSpacing: "0.04em",
            }}
          >
            {player.name}
          </div>
          {(player as any).nickname && (
            <div className="text-xs mb-2.5" style={{ color: isElim ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.32)", fontStyle: "italic" }}>
              "{(player as any).nickname}"
            </div>
          )}

          {/* Points – big number */}
          {!isElim && (
            <div className="flex items-baseline gap-1.5 mb-3 mt-1">
              <span
                className="text-3xl font-black leading-none tabular-nums"
                style={{
                  fontFamily: "Oswald, sans-serif",
                  color: cfg.color,
                  textShadow: `0 0 16px ${cfg.glow}`,
                }}
              >
                {pts}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>pts</span>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: "1px", background: isElim ? "rgba(255,0,92,0.1)" : "rgba(255,255,255,0.06)", marginBottom: "10px" }} />

          {/* Stats row */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif", fontWeight: 700 }}>
                {player.seasonWins ?? 0}W
              </span>
              <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
              <span style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif", fontWeight: 700 }}>
                {player.seasonLosses ?? 0}L
              </span>
            </div>
            <span className="font-mono font-bold tabular-nums" style={{ color: "#0066ff", fontSize: "0.7rem" }}>
              {player.elo} Elo
            </span>
          </div>

          {/* Streak */}
          {streak >= 3 && (
            <div className="flex items-center gap-1.5 mt-2.5 text-xs font-bold" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
              <Flame className="w-3 h-3 streak-fire" />
              {streak}W STREAK
            </div>
          )}
        </div>

        {/* Left edge accent */}
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5"
          style={{ background: isElim ? "rgba(255,0,92,0.5)" : cfg.ring, opacity: 0.7 }}
        />
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
    createPlayerMutation.mutate(
      { data: values },
      {
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
      }
    );
  }

  const active     = players?.filter(p => p.isActive && p.status !== "ELIMINATED") ?? [];
  const eliminated = players?.filter(p => p.isActive && p.status === "ELIMINATED") ?? [];
  const inactive   = players?.filter(p => !p.isActive) ?? [];

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
            Player Registry
          </h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            {active.length} active
            {eliminated.length > 0 ? ` · ${eliminated.length} eliminated` : ""}
            {inactive.length > 0 ? ` · ${inactive.length} inactive` : ""}
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" style={{ background: "#ff005c", border: "none" }}>
              <Plus className="h-4 w-4" />
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Player</DialogTitle>
              <DialogDescription>New players start with 25 points and Silver Elo (1000).</DialogDescription>
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
                <Button type="submit" className="w-full" disabled={createPlayerMutation.isPending}
                  style={{ background: "#ff005c", border: "none" }}>
                  {createPlayerMutation.isPending ? "Registering…" : "Register Player"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Active players */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {active.map((player, i) => (
              <div key={player.id} className="fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                <PlayerCard player={player} />
              </div>
            ))}
          </div>

          {/* Eliminated */}
          {eliminated.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-widest mb-3 flex items-center gap-2 font-bold" style={{ color: "rgba(255,0,92,0.7)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.15em" }}>
                <Skull className="w-3 h-3" style={{ filter: "drop-shadow(0 0 4px rgba(255,0,92,0.6))" }} />
                Eliminated
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {eliminated.map((player, i) => (
                  <div key={player.id} className="fade-in-up" style={{ animationDelay: `${i * 30}ms` }}>
                    <PlayerCard player={player} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inactive */}
          {inactive.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
                <Target className="w-3 h-3 inline mr-2 opacity-50" />
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
