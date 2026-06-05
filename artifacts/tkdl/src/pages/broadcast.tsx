import { useGetBroadcastData } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { TierBadge } from "@/components/tier-badge";
import { Trophy, Swords, Zap } from "lucide-react";
import { format } from "date-fns";

export default function Broadcast() {
  const { data, refetch } = useGetBroadcastData();
  const [time, setTime] = useState(new Date());

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return (
    <div className="h-screen w-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary"></div>
    </div>
  );

  const { season, leaderboard, recentMatches, featuredPlayer } = data;

  return (
    <div className="h-screen w-screen bg-background overflow-hidden flex flex-col text-foreground font-sans relative">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-secondary/5 rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 pointer-events-none"></div>

      {/* Header Banner */}
      <header className="bg-card border-b-4 border-primary px-8 py-6 flex justify-between items-center z-10 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="bg-primary text-primary-foreground p-3 rounded-xl">
            <Trophy className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase text-primary">TKDL Network</h1>
            <div className="text-xl font-bold text-muted-foreground flex items-center gap-3 mt-1">
              <span>{season.name}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-emerald-500 text-sm uppercase tracking-widest">Live</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-5xl font-mono font-black tracking-tighter">{format(time, "HH:mm:ss")}</div>
          <div className="text-lg text-muted-foreground font-mono uppercase tracking-widest">{format(time, "EEEE, MMMM d")}</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden p-8 gap-8 z-10">
        
        {/* Left Column: Leaderboard */}
        <div className="w-2/3 flex flex-col">
          <div className="bg-card border border-border rounded-2xl flex-1 flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-muted px-8 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-2xl font-black uppercase tracking-widest flex items-center gap-3">
                <Trophy className="w-6 h-6 text-secondary" /> 
                Current Standings
              </h2>
            </div>
            
            <div className="flex-1 overflow-hidden flex flex-col p-4 gap-2">
              {/* Table Header */}
              <div className="flex px-4 py-2 text-sm font-bold text-muted-foreground uppercase tracking-widest border-b border-border/50">
                <div className="w-16 text-center">Rank</div>
                <div className="flex-1">Player</div>
                <div className="w-32 text-center">Tier</div>
                <div className="w-32 text-right">Record</div>
                <div className="w-24 text-right">Pts</div>
              </div>
              
              {/* Leaderboard Rows - Top 10 max */}
              {leaderboard.slice(0, 10).map((entry, idx) => (
                <div key={entry.playerId} className={`flex items-center px-4 py-4 rounded-xl transition-colors ${idx === 0 ? 'bg-amber-500/10 border border-amber-500/30' : idx < 3 ? 'bg-muted/50' : ''}`}>
                  <div className="w-16 text-center font-black font-mono text-3xl opacity-80">
                    {entry.position}
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold">{entry.playerName}</div>
                    {entry.playerNickname && <div className="text-sm text-muted-foreground italic">"{entry.playerNickname}"</div>}
                  </div>
                  <div className="w-32 flex justify-center">
                    <TierBadge tier={entry.tier} />
                  </div>
                  <div className="w-32 text-right font-mono text-xl font-bold">
                    <span className="text-emerald-500">{entry.wins}</span><span className="text-muted-foreground opacity-50">-</span><span className="text-destructive">{entry.losses}</span>
                  </div>
                  <div className="w-24 text-right font-black font-mono text-3xl text-primary">
                    {entry.points}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Featured & Recent */}
        <div className="w-1/3 flex flex-col gap-8">
          
          {/* Featured Player Spotlight */}
          {featuredPlayer && (
            <div className="bg-gradient-to-br from-card to-card/50 border border-primary/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Zap className="w-32 h-32" />
              </div>
              
              <div className="text-xs font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4" /> 
                Player Spotlight
              </div>
              
              <div className="flex items-center gap-6 mb-6 relative z-10">
                <div className="w-24 h-24 rounded-full bg-secondary/20 border-2 border-secondary flex items-center justify-center text-4xl font-black text-secondary uppercase">
                  {featuredPlayer.avatarInitials || featuredPlayer.name.substring(0, 2)}
                </div>
                <div>
                  <h3 className="text-3xl font-black line-clamp-1">{featuredPlayer.name}</h3>
                  <TierBadge tier={featuredPlayer.tier} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-background/80 rounded-xl p-4 border border-border/50 text-center">
                  <div className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-1">Elo</div>
                  <div className="text-3xl font-black font-mono">{featuredPlayer.elo}</div>
                </div>
                <div className="bg-background/80 rounded-xl p-4 border border-border/50 text-center">
                  <div className="text-sm text-muted-foreground uppercase font-bold tracking-wider mb-1">Win %</div>
                  <div className="text-3xl font-black font-mono text-emerald-500">
                    {featuredPlayer.careerWinRate ? `${featuredPlayer.careerWinRate.toFixed(0)}%` : '0%'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recent Matches Feed */}
          <div className="bg-card border border-border rounded-2xl flex-1 flex flex-col overflow-hidden shadow-2xl">
            <div className="bg-muted px-6 py-4 border-b border-border">
              <h2 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                <Swords className="w-5 h-5 text-destructive" /> 
                Latest Results
              </h2>
            </div>
            
            <div className="flex-1 overflow-hidden p-4 space-y-4">
              {recentMatches.slice(0, 6).map((match) => (
                <div key={match.id} className="bg-background rounded-xl p-4 border border-border/50 shadow-sm relative overflow-hidden">
                  {/* Subtle win indicator bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"></div>
                  
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                      {format(new Date(match.playedAt), "MMM d, HH:mm")}
                    </div>
                    <div className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded font-mono">
                      +{match.eloChange} Elo
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-lg truncate flex-1">{match.winnerName}</div>
                    <div className="px-3 text-muted-foreground/50 font-black italic text-sm">def</div>
                    <div className="font-medium text-muted-foreground truncate flex-1 text-right">{match.loserName}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
        </div>
      </main>
      
      {/* Ticker Bottom Bar */}
      <footer className="bg-primary text-primary-foreground py-2 overflow-hidden flex whitespace-nowrap">
        <div className="animate-[slide_30s_linear_infinite] inline-flex items-center gap-8 px-4 font-mono font-bold tracking-widest uppercase text-sm">
          {recentMatches.map((match) => (
            <span key={`ticker-${match.id}`} className="flex items-center gap-2">
              <span className="text-emerald-900">{match.winnerName}</span> 
              <span className="opacity-50 text-xs">DEFEATED</span> 
              <span>{match.loserName}</span>
              <span className="bg-primary-foreground/20 px-2 py-0.5 rounded ml-2">+{match.pointsAwarded} PTS</span>
              <span className="mx-4 opacity-30">•</span>
            </span>
          ))}
          {/* Duplicate for seamless loop */}
          {recentMatches.map((match) => (
            <span key={`ticker-dup-${match.id}`} className="flex items-center gap-2">
              <span className="text-emerald-900">{match.winnerName}</span> 
              <span className="opacity-50 text-xs">DEFEATED</span> 
              <span>{match.loserName}</span>
              <span className="bg-primary-foreground/20 px-2 py-0.5 rounded ml-2">+{match.pointsAwarded} PTS</span>
              <span className="mx-4 opacity-30">•</span>
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
