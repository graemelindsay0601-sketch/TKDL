import { useListSeasons } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { format } from "date-fns";
import { Calendar, Trophy, Users } from "lucide-react";

export default function Seasons() {
  const { data: seasons, isLoading } = useListSeasons();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Season Archive</h1>
        <p className="text-muted-foreground">Historical records and past champions.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {seasons?.map((season) => (
            <Link key={season.id} href={`/seasons/${season.id}`}>
              <Card className={`hover-elevate cursor-pointer transition-all border-border hover:border-primary/50 group h-full ${season.isActive ? 'border-primary/50 ring-1 ring-primary/20' : ''}`}>
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-xl group-hover:text-primary transition-colors">{season.name}</h3>
                    {season.isActive && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-500 uppercase tracking-widest animate-pulse">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 mb-6 flex-1">
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {format(new Date(season.startDate), "MMM d, yyyy")} 
                        {season.endDate ? ` - ${format(new Date(season.endDate), "MMM d, yyyy")}` : " - Present"}
                      </span>
                    </div>
                    
                    <div className="flex items-center text-sm text-muted-foreground gap-2">
                      <Users className="w-4 h-4" />
                      <span>{season.totalMatches || 0} matches played</span>
                    </div>
                  </div>

                  {season.championName && (
                    <div className="mt-auto pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <div className="bg-amber-500/20 p-1.5 rounded text-amber-500">
                          <Trophy className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground uppercase font-semibold">Champion</div>
                          <div className="font-bold text-foreground">{season.championName}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
          {(!seasons || seasons.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No seasons found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
