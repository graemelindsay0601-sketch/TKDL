import { useGetPlayerStats, getGetPlayerStatsQueryKey } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierBadge } from "@/components/tier-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Trophy, Activity, Medal, Star, Target, Shield } from "lucide-react";

export default function PlayerDetail() {
  const params = useParams();
  const playerId = parseInt(params.id || "0", 10);
  
  const { data: stats, isLoading } = useGetPlayerStats(playerId, {
    query: {
      enabled: !!playerId,
      queryKey: getGetPlayerStatsQueryKey(playerId)
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!stats) {
    return <div>Player not found</div>;
  }

  const { player, seasonHistory, recentMatches, achievements } = stats;

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return 'bg-slate-500/10 text-slate-400 border-slate-700';
      case 'rare': return 'bg-blue-500/10 text-blue-400 border-blue-700';
      case 'epic': return 'bg-purple-500/10 text-purple-400 border-purple-700';
      case 'legendary': return 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Profile Card */}
      <Card className="border-t-4 border-t-primary overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Target className="w-48 h-48" />
        </div>
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
            <div className="flex-shrink-0 flex items-center justify-center w-32 h-32 rounded-full bg-secondary/20 text-secondary font-bold text-5xl uppercase tracking-tighter border-4 border-background shadow-xl">
              {player.avatarInitials || player.name.substring(0, 2)}
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2">
                <h1 className="text-4xl font-black tracking-tight">{player.name}</h1>
                <TierBadge tier={player.tier} />
              </div>
              {player.nickname && (
                <p className="text-xl text-muted-foreground italic">"{player.nickname}"</p>
              )}
              
              <div className="mt-6 flex flex-wrap justify-center md:justify-start gap-4">
                <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                  <Activity className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-xs text-muted-foreground uppercase font-semibold">Elo Rating</div>
                    <div className="text-xl font-bold font-mono">{player.elo}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                  <Trophy className="h-5 w-5 text-emerald-500" />
                  <div>
                    <div className="text-xs text-muted-foreground uppercase font-semibold">Career W-L</div>
                    <div className="text-xl font-bold font-mono">
                      {player.careerWins} - {player.careerLosses}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                  <Target className="h-5 w-5 text-secondary" />
                  <div>
                    <div className="text-xs text-muted-foreground uppercase font-semibold">Win Rate</div>
                    <div className="text-xl font-bold font-mono">
                      {player.careerWinRate !== undefined ? `${player.careerWinRate.toFixed(1)}%` : '0%'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Recent Matches & Stats */}
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Season History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {seasonHistory && seasonHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Season</TableHead>
                      <TableHead className="text-center">Final Rank</TableHead>
                      <TableHead className="text-right">Record</TableHead>
                      <TableHead className="text-right">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seasonHistory.map((season) => (
                      <TableRow key={season.seasonId}>
                        <TableCell className="font-medium">
                          {season.seasonName}
                          {season.isChampion && (
                            <span className="ml-2 inline-flex items-center text-xs text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">
                              <Star className="w-3 h-3 mr-1 fill-current" /> Champion
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold">
                          #{season.position}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {season.wins} - {season.losses}
                        </TableCell>
                        <TableCell className="text-right font-mono text-primary font-bold">
                          {season.points}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-6 text-muted-foreground">No season history available.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                Recent Matches
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentMatches && recentMatches.length > 0 ? (
                <div className="space-y-4">
                  {recentMatches.map((match) => {
                    const isWinner = match.winnerId === player.id;
                    const opponentName = isWinner ? match.loserName : match.winnerName;
                    
                    return (
                      <div key={match.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/50 border border-border">
                        <div className="flex items-center gap-4">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold ${isWinner ? 'bg-emerald-500/20 text-emerald-500' : 'bg-destructive/20 text-destructive'}`}>
                            {isWinner ? 'W' : 'L'}
                          </div>
                          <div>
                            <div className="font-semibold">vs {opponentName}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(match.playedAt), "MMM d, yyyy 'at' h:mm a")}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-mono font-bold ${isWinner ? 'text-emerald-500' : 'text-destructive'}`}>
                            {isWinner ? '+' : ''}{isWinner ? match.eloChange : -match.eloChange} Elo
                          </div>
                          {match.notes && <div className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate">{match.notes}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">No recent matches.</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Achievements */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Medal className="h-5 w-5 text-primary" />
                Achievements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {achievements && achievements.length > 0 ? (
                <div className="space-y-4">
                  {achievements.map(({ achievement, unlockedAt }) => (
                    <div key={achievement.id} className={`p-4 rounded-lg border ${getRarityColor(achievement.rarity)}`}>
                      <div className="flex items-start gap-3">
                        <div className="text-2xl mt-1">{achievement.icon}</div>
                        <div>
                          <div className="font-bold">{achievement.name}</div>
                          <div className="text-xs opacity-80 mt-1">{achievement.description}</div>
                          <div className="text-[10px] uppercase font-mono mt-2 opacity-60">
                            Unlocked {format(new Date(unlockedAt), "MMM d, yyyy")}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">No achievements unlocked yet.</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Current Form
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Current Streak</span>
                <span className="font-bold font-mono text-lg">{player.currentWinStreak || 0}W</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Longest Streak</span>
                <span className="font-bold font-mono text-lg">{player.longestWinStreak || 0}W</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-border/50">
                <span className="text-muted-foreground">Season Points</span>
                <span className="font-bold font-mono text-lg text-primary">{player.currentSeasonPoints || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Season Record</span>
                <span className="font-bold font-mono text-lg">{player.currentSeasonWins || 0} - {player.currentSeasonLosses || 0}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Ensure icons used above are imported correctly
import { History, Swords } from "lucide-react";
