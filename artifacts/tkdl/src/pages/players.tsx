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
import { TierBadge } from "@/components/tier-badge";
import { Link } from "wouter";
import { Plus, Skull, Flame } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  name:     z.string().min(1, "Name is required"),
  nickname: z.string().optional(),
});

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
            {active.length} active · {eliminated.length > 0 ? `${eliminated.length} eliminated · ` : ""}{inactive.length} inactive
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
              <DialogDescription>
                New players start with 25 points and Silver Elo (1000).
              </DialogDescription>
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
        <div className="space-y-6">
          {/* Active players */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {active.map(player => (
              <Link key={player.id} href={`/players/${player.id}`}>
                <div className="pdc-card p-4 cursor-pointer transition-all hover:border-white/15 hover:-translate-y-0.5">
                  {/* Avatar + tier */}
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded flex items-center justify-center text-lg font-black uppercase"
                      style={{ background: "rgba(255,0,92,0.1)", color: "#ff005c", fontFamily: "Oswald, sans-serif" }}
                    >
                      {player.name.substring(0, 2)}
                    </div>
                    <TierBadge tier={player.tier} />
                  </div>

                  {/* Name */}
                  <div className="font-bold text-base leading-tight mb-0.5" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.9)" }}>
                    {player.name}
                  </div>
                  {player.nickname && (
                    <div className="text-xs mb-2" style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
                      "{player.nickname}"
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem", fontFamily: "Oswald, sans-serif" }}>Pts</div>
                      <div className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>{player.points}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem", fontFamily: "Oswald, sans-serif" }}>Elo</div>
                      <div className="font-bold text-sm font-mono" style={{ color: "#0066ff" }}>{player.elo}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-wider mb-0.5" style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.6rem", fontFamily: "Oswald, sans-serif" }}>W-L</div>
                      <div className="font-bold text-sm font-mono" style={{ color: "rgba(255,255,255,0.6)" }}>
                        <span style={{ color: "#22c55e" }}>{player.seasonWins ?? 0}</span>
                        <span style={{ color: "rgba(255,255,255,0.2)" }}>-</span>
                        <span style={{ color: "#ff005c" }}>{player.seasonLosses ?? 0}</span>
                      </div>
                    </div>
                  </div>

                  {player.currentWinStreak && player.currentWinStreak >= 3 && (
                    <div className="flex items-center gap-1 mt-2 text-xs font-bold" style={{ color: "#ff005c" }}>
                      <Flame className="w-3 h-3" /> {player.currentWinStreak}W streak
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Eliminated */}
          {eliminated.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-widest mb-3 flex items-center gap-2 font-bold" style={{ color: "rgba(255,0,92,0.6)", fontFamily: "Oswald, sans-serif" }}>
                <Skull className="w-3 h-3" /> Eliminated
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {eliminated.map(player => (
                  <Link key={player.id} href={`/players/${player.id}`}>
                    <div className="pdc-card p-3 cursor-pointer opacity-50 hover:opacity-70 transition-opacity" style={{ borderColor: "rgba(255,0,92,0.1)" }}>
                      <div className="flex items-center gap-2">
                        <span style={{ color: "#ff005c" }}>☠</span>
                        <div className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>{player.name}</div>
                      </div>
                      <div className="text-xs mt-1" style={{ color: "rgba(255,0,92,0.5)" }}>0 pts · Eliminated</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Inactive */}
          {inactive.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-widest mb-3 font-bold" style={{ color: "rgba(255,255,255,0.2)", fontFamily: "Oswald, sans-serif" }}>
                Inactive / Departed
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {inactive.map(player => (
                  <Link key={player.id} href={`/players/${player.id}`}>
                    <div className="pdc-card p-3 cursor-pointer opacity-35 hover:opacity-50 transition-opacity">
                      <div className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.6)" }}>{player.name}</div>
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
