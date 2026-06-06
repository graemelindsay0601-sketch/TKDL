import {
  useListPlayers,
  useUpdatePlayer,
  useResetSeason,
  useListMatches,
  useDeleteMatch,
  getListPlayersQueryKey,
  getGetStatsSummaryQueryKey,
  getGetCurrentSeasonQueryKey,
  getListSeasonsQueryKey,
  getGetLeaderboardQueryKey,
  getListMatchesQueryKey,
  getGetRecentActivityQueryKey,
  getGetPlayerStatsQueryKey,
  getGetPlayerQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, RotateCcw, AlertTriangle, Swords, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function Admin() {
  const { data: players, isLoading: isLoadingPlayers } = useListPlayers();
  const { data: matches, isLoading: isLoadingMatches } = useListMatches({ limit: 20 });
  const updatePlayerMutation = useUpdatePlayer();
  const resetSeasonMutation  = useResetSeason();
  const deleteMatchMutation  = useDeleteMatch();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [seasonName, setSeasonName] = useState("");

  const handleToggleActive = (id: number, current: boolean) => {
    updatePlayerMutation.mutate(
      { id, data: { isActive: !current } },
      {
        onSuccess: () => {
          toast({ title: "Player Updated", description: "Status changed." });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleResetSeason = () => {
    resetSeasonMutation.mutate(
      { data: { name: seasonName || undefined } },
      {
        onSuccess: (data: any) => {
          toast({ title: "Season Reset", description: `New season "${data.name}" has started!` });
          setSeasonName("");
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCurrentSeasonQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSeasonsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        },
        onError: (e: any) => toast({ title: "Error resetting season", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleDeleteMatch = (matchId: number, winnerId: number, loserId: number) => {
    deleteMatchMutation.mutate(
      { id: matchId },
      {
        onSuccess: () => {
          toast({ title: "Match Deleted", description: "Stats reverted." });
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(loserId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(loserId) });
        },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-8">
      <div className="pdc-divider" />
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-6 h-6" style={{ color: "#ff005c" }} />
        <div>
          <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>
            Admin Panel
          </h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
            League management · Dangerous operations
          </p>
        </div>
      </div>

      {/* Season reset */}
      <div className="pdc-card p-5" style={{ borderColor: "rgba(255,0,92,0.2)", background: "rgba(255,0,92,0.03)" }}>
        <div className="flex items-center gap-2 mb-2">
          <RotateCcw className="w-4 h-4" style={{ color: "#ff005c" }} />
          <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c" }}>
            Season Management
          </h2>
        </div>
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          End the current season and start a new one. All players reset to 25 pts. ELO and career stats are preserved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1">
            <Input
              placeholder="Custom season name (optional)"
              value={seasonName}
              onChange={e => setSeasonName(e.target.value)}
              style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,0,92,0.2)" }}
            />
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>Leave blank for auto-generated name</p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                className="gap-2 font-bold uppercase tracking-wider whitespace-nowrap"
                style={{ background: "#ff005c", border: "none", fontFamily: "Oswald, sans-serif" }}
              >
                <AlertTriangle className="w-4 h-4" />
                Reset Season
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(255,0,92,0.3)" }}>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                  <AlertTriangle className="w-5 h-5" /> Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                  This will end the current active season, crown the champion, and reset all players to 25 pts.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetSeason}
                  style={{ background: "#ff005c", color: "#fff", border: "none" }}
                >
                  Yes, End Season
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Player roster */}
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <Users className="w-4 h-4" style={{ color: "#0066ff" }} />
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Roster Management
            </h2>
          </div>
          {isLoadingPlayers ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {players?.map(player => (
                <div
                  key={player.id}
                  className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02]"
                  style={{ opacity: !player.isActive ? 0.45 : 1 }}
                >
                  <div>
                    <div className="font-semibold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.85)" }}>
                      {player.name}
                      {(player as any).nickname && (
                        <span className="ml-1 font-normal" style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>
                          "{(player as any).nickname}"
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono" style={{ color: "#0066ff" }}>{player.elo} Elo</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase" style={{ color: player.isActive ? "#22c55e" : "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
                      {player.isActive ? "Active" : "Inactive"}
                    </span>
                    <Switch
                      checked={player.isActive}
                      onCheckedChange={() => handleToggleActive(player.id, player.isActive)}
                      disabled={updatePlayerMutation.isPending}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Match management */}
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <Swords className="w-4 h-4" style={{ color: "#ff005c" }} />
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Recent Matches
            </h2>
          </div>
          {isLoadingMatches ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {matches?.map((match: any) => (
                <div key={match.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  <div>
                    <div className="text-sm font-semibold">
                      <span style={{ color: "#22c55e" }}>{match.winnerName}</span>
                      <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 6px" }}>def.</span>
                      <span style={{ color: "#ff005c" }}>{match.loserName}</span>
                      {match.stake && (
                        <span className="ml-2 text-xs font-mono" style={{ color: "#ffd24a" }}>±{match.stake}pts</span>
                      )}
                    </div>
                    <div className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
                      {format(new Date(match.playedAt), "MMM d, HH:mm")}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-500/10 hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" style={{ color: "#ff005c" }} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(255,0,92,0.3)" }}>
                      <AlertDialogHeader>
                        <AlertDialogTitle style={{ fontFamily: "Oswald, sans-serif" }}>Delete Match Record?</AlertDialogTitle>
                        <AlertDialogDescription style={{ color: "rgba(255,255,255,0.5)" }}>
                          Delete {match.winnerName} vs {match.loserName} from{" "}
                          {format(new Date(match.playedAt), "MMM d, yyyy")}? Points and Elo will be reverted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteMatch(match.id, match.winnerId, match.loserId)}
                          style={{ background: "#ff005c", color: "#fff", border: "none" }}
                        >
                          Delete Match
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
              {(!matches || matches.length === 0) && (
                <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                  No matches found.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
