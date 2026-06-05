import { useListPlayers, useSubmitMatch, getGetLeaderboardQueryKey, getGetStatsSummaryQueryKey, getGetRecentActivityQueryKey, getListMatchesQueryKey, getGetPlayerStatsQueryKey, getGetPlayerQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Swords } from "lucide-react";

const formSchema = z.object({
  winnerId: z.coerce.number().min(1, "Please select a winner"),
  loserId: z.coerce.number().min(1, "Please select a loser"),
  notes: z.string().optional(),
}).refine((data) => data.winnerId !== data.loserId, {
  message: "A player cannot play against themselves",
  path: ["loserId"],
});

export default function SubmitMatch() {
  const { data: players, isLoading: isLoadingPlayers } = useListPlayers();
  const submitMatchMutation = useSubmitMatch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      winnerId: 0,
      loserId: 0,
      notes: "",
    },
  });

  const activePlayers = players?.filter(p => p.isActive) || [];

  function onSubmit(values: z.infer<typeof formSchema>) {
    submitMatchMutation.mutate(
      { data: values },
      {
        onSuccess: (data) => {
          toast({
            title: "Match Recorded!",
            description: `${data.winnerName} defeated ${data.loserName}.`,
            variant: "default",
          });
          form.reset({ winnerId: 0, loserId: 0, notes: "" });
          
          // Invalidate queries
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
          toast({
            title: "Error submitting match",
            description: error.message || "An unexpected error occurred.",
            variant: "destructive",
          });
        },
      }
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Submit Match Result</h1>
        <p className="text-muted-foreground">Record the outcome of a game.</p>
      </div>

      <Card className="border-primary/20 shadow-lg shadow-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-primary" />
            Match Details
          </CardTitle>
          <CardDescription>Enter the winner and loser of the match.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                <FormField
                  control={form.control}
                  name="winnerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-emerald-500 font-bold uppercase tracking-wider">Winner</FormLabel>
                      <Select 
                        disabled={isLoadingPlayers || submitMatchMutation.isPending} 
                        onValueChange={field.onChange} 
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="h-14 text-lg bg-emerald-500/10 border-emerald-500/30 text-emerald-100">
                            <SelectValue placeholder="Select winner..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activePlayers.map((player) => (
                            <SelectItem key={`winner-${player.id}`} value={player.id.toString()}>
                              {player.name} {player.nickname ? `"${player.nickname}"` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
                  <div className="bg-background border rounded-full p-2 z-10 text-muted-foreground font-bold italic text-xl">
                    VS
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="loserId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-destructive font-bold uppercase tracking-wider">Loser</FormLabel>
                      <Select 
                        disabled={isLoadingPlayers || submitMatchMutation.isPending} 
                        onValueChange={field.onChange} 
                        value={field.value ? field.value.toString() : ""}
                      >
                        <FormControl>
                          <SelectTrigger className="h-14 text-lg bg-destructive/10 border-destructive/30 text-destructive-foreground">
                            <SelectValue placeholder="Select loser..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activePlayers.map((player) => (
                            <SelectItem key={`loser-${player.id}`} value={player.id.toString()}>
                              {player.name} {player.nickname ? `"${player.nickname}"` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match Notes (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 180 thrown, close finish..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-bold" 
                disabled={submitMatchMutation.isPending}
              >
                {submitMatchMutation.isPending ? "Submitting..." : "Submit Result"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
