import { useGetStatsSummary, useGetLeaderboard, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";
import { Trophy, Activity, Users, Hash } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { data: summary } = useGetStatsSummary();
  const { data: leaderboard } = useGetLeaderboard();
  const { data: recent } = useGetRecentActivity();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">League overview and current standings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary?.totalPlayers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary?.totalMatches || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Season</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.currentSeasonName || "N/A"}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.currentSeasonMatches || 0} matches played
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Elo</CardTitle>
            <Activity className="h-4 w-4 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary?.topEloPlayer?.elo || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.topEloPlayer?.name || "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Leaderboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {leaderboard?.slice(0, 5).map((entry) => (
                <div key={entry.playerId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 text-center font-mono font-bold text-muted-foreground">
                      {entry.position}
                    </div>
                    <RankChange change={entry.positionChange} />
                    <div>
                      <Link href={`/players/${entry.playerId}`} className="font-semibold hover:text-primary transition-colors">
                        {entry.playerName}
                      </Link>
                      {entry.playerNickname && (
                        <span className="ml-2 text-xs text-muted-foreground">"{entry.playerNickname}"</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <TierBadge tier={entry.tier} />
                    <div className="font-mono font-bold text-right w-12">{entry.points} pts</div>
                  </div>
                </div>
              ))}
              {(!leaderboard || leaderboard.length === 0) && (
                <div className="text-center text-muted-foreground py-4 text-sm">No data yet</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recent?.slice(0, 5).map((activity) => (
                <div key={activity.matchId} className="flex justify-between items-start border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div>
                    <div className="font-medium text-sm">
                      <span className="text-emerald-500 font-semibold">{activity.winnerName}</span>
                      {" def. "}
                      <span className="text-muted-foreground">{activity.loserName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(activity.playedAt), "MMM d, h:mm a")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-emerald-500">+{activity.eloChange} Elo</div>
                  </div>
                </div>
              ))}
              {(!recent || recent.length === 0) && (
                <div className="text-center text-muted-foreground py-4 text-sm">No matches played</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
