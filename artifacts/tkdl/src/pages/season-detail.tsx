import { useGetSeason, getGetSeasonQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TierBadge } from "@/components/tier-badge";
import { format } from "date-fns";
import { Trophy, Calendar, Users, Medal } from "lucide-react";

export default function SeasonDetail() {
  const params = useParams();
  const seasonId = parseInt(params.id || "0", 10);
  
  const { data: seasonDetail, isLoading } = useGetSeason(seasonId, {
    query: {
      enabled: !!seasonId,
      queryKey: getGetSeasonQueryKey(seasonId)
    }
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!seasonDetail) {
    return <div>Season not found</div>;
  }

  const { season, standings } = seasonDetail;

  return (
    <div className="space-y-8">
      {/* Header Profile Card */}
      <Card className="border-t-4 border-t-primary overflow-hidden relative">
        <CardContent className="p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-black tracking-tight">{season.name}</h1>
                {season.isActive && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-500 uppercase tracking-widest animate-pulse">
                    Active Season
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-muted-foreground mt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {format(new Date(season.startDate), "MMM d, yyyy")} 
                    {season.endDate ? ` - ${format(new Date(season.endDate), "MMM d, yyyy")}` : " - Present"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>{season.totalMatches || 0} matches</span>
                </div>
              </div>
            </div>

            {season.championName && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4 min-w-[250px]">
                <div className="bg-amber-500/20 p-3 rounded-full text-amber-500">
                  <Trophy className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-xs text-amber-500/80 uppercase font-bold tracking-wider">Season Champion</div>
                  <div className="text-xl font-bold text-amber-400">{season.championName}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="w-5 h-5 text-primary" />
            Final Standings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Rank</TableHead>
                <TableHead>Player</TableHead>
                <TableHead className="text-center">End Tier</TableHead>
                <TableHead className="text-right">Record</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right font-bold text-primary">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings?.map((entry) => (
                <TableRow key={entry.playerId} className="group">
                  <TableCell className="text-center font-mono">
                    <span className={`font-bold text-lg ${entry.position === 1 ? 'text-amber-500 text-2xl' : entry.position === 2 ? 'text-slate-400 text-xl' : entry.position === 3 ? 'text-orange-700 text-xl' : ''}`}>
                      {entry.position}
                    </span>
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
                  <TableCell className="text-right font-mono text-xl font-bold text-primary">
                    {entry.points}
                  </TableCell>
                </TableRow>
              ))}
              {(!standings || standings.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No standings available for this season.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
