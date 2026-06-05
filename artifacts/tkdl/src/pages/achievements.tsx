import { useListAchievements } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";

export default function Achievements() {
  const { data: achievements, isLoading } = useListAchievements();

  const getRarityStyles = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return 'bg-slate-500/5 border-slate-700 text-slate-300';
      case 'rare': return 'bg-blue-500/5 border-blue-700 text-blue-300';
      case 'epic': return 'bg-purple-500/10 border-purple-600 text-purple-300';
      case 'legendary': return 'bg-amber-500/10 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/50';
      default: return 'bg-muted border-border text-foreground';
    }
  };

  const getRarityBadge = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return 'bg-slate-800 text-slate-400';
      case 'rare': return 'bg-blue-900/50 text-blue-400';
      case 'epic': return 'bg-purple-900/50 text-purple-400';
      case 'legendary': return 'bg-amber-900/50 text-amber-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Achievement Catalogue</h1>
        <p className="text-muted-foreground">Unlock these badges of honor through your gameplay.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {achievements?.map((achievement) => (
            <Card key={achievement.id} className={`overflow-hidden transition-all ${getRarityStyles(achievement.rarity)}`}>
              <CardContent className="p-6 relative h-full flex flex-col">
                <div className="absolute top-4 right-4">
                  <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded ${getRarityBadge(achievement.rarity)}`}>
                    {achievement.rarity}
                  </span>
                </div>
                
                <div className="text-4xl mb-4 mt-2">
                  {achievement.icon || <Trophy className="w-8 h-8 opacity-50" />}
                </div>
                
                <h3 className="font-bold text-lg mb-2">{achievement.name}</h3>
                <p className="text-sm opacity-80 flex-1">{achievement.description}</p>
                
                {achievement.threshold !== undefined && achievement.threshold !== null && (
                  <div className="mt-4 pt-4 border-t border-current/10">
                    <div className="text-xs uppercase font-mono opacity-60">Requirement</div>
                    <div className="font-mono font-bold text-sm">{achievement.threshold}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {(!achievements || achievements.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No achievements found in the database.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
