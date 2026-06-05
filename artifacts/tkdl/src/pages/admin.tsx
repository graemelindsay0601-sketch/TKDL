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
  getGetPlayerQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Users, RotateCcw, AlertTriangle, Swords, Trash2 } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function Admin() {
  const { data: players, isLoading: isLoadingPlayers } = useListPlayers();
  const { data: matches, isLoading: isLoadingMatches } = useListMatches({ limit: 20 });
  const updatePlayerMutation = useUpdatePlayer();
  const resetSeasonMutation = useResetSeason();
  const deleteMatchMutation = useDeleteMatch();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [seasonName, setSeasonName] = useState("");

  const handleToggleActive = (id: number, currentStatus: boolean) => {
    updatePlayerMutation.mutate(
      { id, data: { isActive: !currentStatus } },
      {
        onSuccess: () => {
          toast({
            title: "Player Updated",
            description: `Player status changed successfully.`,
          });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message || "Failed to update player.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleResetSeason = () => {
    resetSeasonMutation.mutate(
      { data: { name: seasonName || undefined } },
      {
        onSuccess: (data) => {
          toast({
            title: "Season Reset",
            description: `New season "${data.name}" has started!`,
            variant: "default",
          });
          setSeasonName("");
          // Invalidate everything related to current season
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetCurrentSeasonQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListSeasonsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
        },
        onError: (error: any) => {
          toast({
            title: "Error resetting season",
            description: error.message || "An unexpected error occurred.",
            variant: "destructive",
          });
        }
      }
    );
  };

  const handleDeleteMatch = (matchId: number, winnerId: number, loserId: number) => {
    deleteMatchMutation.mutate(
      { id: matchId },
      {
        onSuccess: () => {
          toast({
            title: "Match Deleted",
            description: "The match has been removed and Elo/stats have been reverted.",
          });
          queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetLeaderboardQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetStatsSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerStatsQueryKey(loserId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(winnerId) });
          queryClient.invalidateQueries({ queryKey: getGetPlayerQueryKey(loserId) });
        },
        onError: (error: any) => {
          toast({
            title: "Error",
            description: error.message || "Failed to delete match.",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-destructive flex items-center gap-3">
          <ShieldAlert className="w-8 h-8" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground">League management and dangerous operations.</p>
      </div>

      <Card className="border-destructive/20 shadow-lg shadow-destructive/5 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <RotateCcw className="w-5 h-5" />
            Season Management
          </CardTitle>
          <CardDescription>
            End the current season and start a new one. All players' season points and records will be reset to zero. Elo ratings and career stats are preserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="w-full sm:max-w-xs">
              <Input 
                placeholder="Custom season name (optional)" 
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Leaves blank for auto-generated name</p>
            </div>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2 font-bold whitespace-nowrap">
                  <AlertTriangle className="w-4 h-4" />
                  Reset Season
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="border-destructive">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Are you absolutely sure?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-base">
                    This action cannot be undone. It will end the current active season, 
                    crown a champion based on current standings, and reset all season scores to zero 
                    for the start of the new season.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetSeason} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Yes, End Current Season
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Player Roster Management
            </CardTitle>
            <CardDescription>
              Deactivate players who have left or are no longer participating. Inactive players won't appear in dropdowns or the main registry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPlayers ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Player</TableHead>
                      <TableHead>Elo</TableHead>
                      <TableHead className="text-right">Active Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {players?.map((player) => (
                      <TableRow key={player.id} className={!player.isActive ? "opacity-50 bg-muted/50" : ""}>
                        <TableCell className="font-medium">
                          {player.name} {player.nickname && <span className="text-muted-foreground italic ml-1">"{player.nickname}"</span>}
                        </TableCell>
                        <TableCell className="font-mono">{player.elo}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className={`text-xs font-bold uppercase ${player.isActive ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                              {player.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <Switch 
                              checked={player.isActive} 
                              onCheckedChange={() => handleToggleActive(player.id, player.isActive)}
                              disabled={updatePlayerMutation.isPending}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="w-5 h-5" />
              Match Management
            </CardTitle>
            <CardDescription>
              Delete erroneous matches. Deleting a match will recalculate and revert the Elo points for both players.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingMatches ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches?.map((match) => (
                      <TableRow key={match.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(match.playedAt), "MMM d, HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm whitespace-nowrap">
                            <span className="text-emerald-500">{match.winnerName}</span> def. <span className="text-destructive">{match.loserName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Match Record?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will delete the match record of {match.winnerName} vs {match.loserName} played on {format(new Date(match.playedAt), "MMM d, yyyy")}.
                                  It will also revert the Elo changes for both players. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteMatch(match.id, match.winnerId, match.loserId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete Match
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!matches || matches.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          No matches found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
