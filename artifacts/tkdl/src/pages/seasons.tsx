import { useListSeasons } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Calendar, Trophy, Hash } from "lucide-react";

export default function Seasons() {
  const { data: seasons, isLoading } = useListSeasons();

  const sorted = seasons ? [...seasons].sort((a, b) => b.id - a.id) : [];

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />
      <div>
        <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
          Season Archive
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          {seasons?.length ?? 0} seasons · Full history
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(season => (
            <Link key={season.id} href={`/seasons/${season.id}`}>
              <div
                className="pdc-card p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:border-white/15 flex flex-col h-full"
                style={{
                  borderColor: season.isActive ? "rgba(255,0,92,0.3)" : undefined,
                  background: season.isActive ? "rgba(255,0,92,0.04)" : undefined,
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="font-bold text-xl leading-tight" style={{ fontFamily: "Oswald, sans-serif", color: season.isActive ? "#fff" : "rgba(255,255,255,0.8)" }}>
                    {season.name}
                  </h3>
                  {season.isActive && (
                    <span
                      className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded animate-pulse shrink-0 ml-2"
                      style={{ background: "rgba(255,0,92,0.15)", color: "#ff005c", fontFamily: "Oswald, sans-serif", border: "1px solid rgba(255,0,92,0.3)" }}
                    >
                      Live
                    </span>
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {format(new Date(season.startDate), "MMM d, yyyy")}
                      {season.endDate ? ` — ${format(new Date(season.endDate), "MMM d, yyyy")}` : " — Present"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                    <Hash className="w-3.5 h-3.5" />
                    <span>{season.totalMatches ?? 0} matches played</span>
                  </div>
                </div>

                {season.championName && (
                  <div
                    className="mt-4 pt-4 border-t flex items-center gap-3"
                    style={{ borderColor: "rgba(255,210,74,0.15)" }}
                  >
                    <div className="p-1.5 rounded" style={{ background: "rgba(255,210,74,0.1)" }}>
                      <Trophy className="w-4 h-4" style={{ color: "#ffd24a" }} />
                    </div>
                    <div>
                      <div className="text-xs uppercase font-bold tracking-wider" style={{ color: "rgba(255,210,74,0.5)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                        Champion
                      </div>
                      <div className="font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>
                        {season.championName}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Link>
          ))}
          {sorted.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No seasons found.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
