import { useListPlayers, useCreatePlayer, getListPlayersQueryKey, getGetStatsSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, User, Activity } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  nickname: z.string().optional(),
});

export default function Players() {
  const { data: players, isLoading } = useListPlayers();
  const createPlayerMutation = useCreatePlayer();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      nickname: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createPlayerMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          toast({
            title: "Player Added",
            description: `${data.name} has joined the league.`,
          });
          form.reset();
          setIsDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message || "Failed to create player.",
            variant: "destructive",
          });
        },
      }
    );
  }

  const activePlayers = players?.filter(p => p.isActive) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Player Registry</h1>
          <p className="text-muted-foreground">Active roster for the current season.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Player
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Player</DialogTitle>
              <DialogDescription>
                Add a new player to the league. They will start with base Elo in the Bronze tier.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nickname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nickname (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="The Sniper" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createPlayerMutation.isPending}>
                  {createPlayerMutation.isPending ? "Registering..." : "Register Player"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {activePlayers.map((player) => (
            <Link key={player.id} href={`/players/${player.id}`}>
              <Card className="hover-elevate cursor-pointer transition-all border-border hover:border-primary/50 group">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-secondary/20 text-secondary font-bold text-xl uppercase tracking-tighter">
                      {player.avatarInitials || player.name.substring(0, 2)}
                    </div>
                    <TierBadge tier={player.tier} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-1">{player.name}</h3>
                    {player.nickname && (
                      <p className="text-sm text-muted-foreground italic mb-2 line-clamp-1">"{player.nickname}"</p>
                    )}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="bg-muted rounded p-2 text-center">
                      <div className="text-xs text-muted-foreground uppercase">Elo</div>
                      <div className="font-mono font-bold">{player.elo}</div>
                    </div>
                    <div className="bg-muted rounded p-2 text-center">
                      <div className="text-xs text-muted-foreground uppercase">Win Rate</div>
                      <div className="font-mono font-bold text-emerald-500">
                        {player.careerWinRate !== undefined ? `${player.careerWinRate.toFixed(1)}%` : '0%'}
                      </div>
                    </div>
                  </div>
                  {player.currentWinStreak && player.currentWinStreak >= 3 && (
                    <div className="mt-3 flex items-center justify-center gap-1 text-xs font-bold text-orange-500 bg-orange-500/10 rounded-full py-1 px-2">
                      <Activity className="h-3 w-3" />
                      {player.currentWinStreak} Match Win Streak!
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
          {activePlayers.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No active players found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
