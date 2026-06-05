import { useGetLeaderboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TierBadge } from "@/components/tier-badge";
import { RankChange } from "@/components/rank-change";
import { Link } from "wouter";

export default function Leaderboard() {
  const { data: leaderboard, isLoading } = useGetLeaderboard();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Season Leaderboard</h1>
        <p className="text-muted-foreground">Current standings for the active season.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Standings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Rank</TableHead>
                  <TableHead>Player</TableHead>
                  <TableHead className="text-center">Tier</TableHead>
                  <TableHead className="text-right">W - L</TableHead>
                  <TableHead className="text-right">Win %</TableHead>
                  <TableHead className="text-right">Streak</TableHead>
                  <TableHead className="text-right font-bold text-primary">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard?.map((entry) => (
                  <TableRow key={entry.playerId} className="group">
                    <TableCell className="text-center font-mono">
                      <div className="flex flex-col items-center justify-center">
                        <span className="font-bold text-lg">{entry.position}</span>
                        <RankChange change={entry.positionChange} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/players/${entry.playerId}`} className="font-semibold hover:text-primary transition-colors text-base">
                        {entry.playerName}
                      </Link>
                      {entry.playerNickname && (
                        <div className="text-xs text-muted-foreground mt-0.5">"{entry.playerNickname}"</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <TierBadge tier={entry.tier} />
                      <div className="text-xs text-muted-foreground mt-1 font-mono">{entry.elo} Elo</div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className="text-emerald-500">{entry.wins}</span> - <span className="text-destructive">{entry.losses}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {entry.winRate !== undefined ? `${entry.winRate.toFixed(1)}%` : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {entry.currentStreak && entry.currentStreak > 1 ? (
                        <span className="text-orange-500 font-bold">{entry.currentStreak}W</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xl font-bold text-primary">
                      {entry.points}
                    </TableCell>
                  </TableRow>
                ))}
                {(!leaderboard || leaderboard.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No players on the leaderboard yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
