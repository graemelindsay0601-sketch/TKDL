import { useListSeasons } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Calendar, Trophy, Hash, AlertCircle, Clock } from "lucide-react";

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
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c", boxShadow: "0 0 20px rgba(255,0,92,0.3)" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((season: any, idx: number) => {
            const isLive      = season.isActive;
            const hasChampion = !!season.championName;
            const playoffPend = !!(season as any).playoffPending;
            const format301   = (season as any).format === "301";
            const notes       = (season as any).notes;

            return (
              <Link key={season.id} href={`/seasons/${season.id}`}>
                <div
                  className={`pdc-card p-5 cursor-pointer transition-all hover:-translate-y-0.5 flex flex-col h-full fade-in-up ${isLive ? "pulse-red" : ""}`}
                  style={{
                    animationDelay: `${idx * 60}ms`,
                    borderColor: isLive
                      ? "rgba(255,0,92,0.35)"
                      : hasChampion
                      ? "rgba(255,210,74,0.2)"
                      : playoffPend
                      ? "rgba(255,210,74,0.15)"
                      : "rgba(255,255,255,0.08)",
                    background: isLive
                      ? "linear-gradient(135deg, rgba(255,0,92,0.05) 0%, rgba(255,255,255,0.02) 100%)"
                      : hasChampion
                      ? "linear-gradient(135deg, rgba(255,210,74,0.04) 0%, rgba(255,255,255,0.02) 100%)"
                      : "rgba(255,255,255,0.025)",
                  }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <h3
                      className="font-bold text-xl leading-tight uppercase"
                      style={{
                        fontFamily: "Oswald, sans-serif",
                        color: isLive ? "#fff" : hasChampion ? "#ffd24a" : "rgba(255,255,255,0.85)",
                        textShadow: isLive ? "0 0 12px rgba(255,0,92,0.4)" : hasChampion ? "0 0 10px rgba(255,210,74,0.3)" : undefined,
                      }}
                    >
                      {season.name}
                    </h3>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isLive && (
                        <span className="flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded"
                          style={{ background: "rgba(255,0,92,0.15)", border: "1px solid rgba(255,0,92,0.4)", color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                          <span className="live-dot" style={{ width: 5, height: 5 }} />LIVE
                        </span>
                      )}
                      {playoffPend && !isLive && (
                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded"
                          style={{ background: "rgba(255,210,74,0.1)", border: "1px solid rgba(255,210,74,0.3)", color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
                          <AlertCircle className="w-3 h-3" />PLAYOFF
                        </span>
                      )}
                      {format301 && (
                        <span className="text-xs px-2 py-0.5 rounded font-bold"
                          style={{ background: "rgba(0,102,255,0.1)", border: "1px solid rgba(0,102,255,0.25)", color: "#0066ff", fontFamily: "Oswald, sans-serif" }}>
                          301
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
                      <Calendar className="w-3 h-3" />
                      <span>
                        {format(new Date(season.startDate), "MMM d, yyyy")}
                        {season.endDate ? ` — ${format(new Date(season.endDate), "MMM d, yyyy")}` : " — Present"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      <Hash className="w-3 h-3" />
                      <span>{season.totalMatches ?? 0} matches</span>
                    </div>
                    {notes && (
                      <p className="text-xs italic mt-1" style={{ color: "rgba(255,255,255,0.28)" }}>{notes}</p>
                    )}
                  </div>

                  {/* Champion / status footer */}
                  {hasChampion && !playoffPend ? (
                    <div className="mt-4 pt-3 border-t flex items-center gap-3" style={{ borderColor: "rgba(255,210,74,0.15)" }}>
                      <div className="p-1.5 rounded" style={{ background: "rgba(255,210,74,0.1)" }}>
                        <Trophy className="w-4 h-4" style={{ color: "#ffd24a", filter: "drop-shadow(0 0 4px rgba(255,210,74,0.6))" }} />
                      </div>
                      <div>
                        <div className="text-xs uppercase font-bold tracking-wider" style={{ color: "rgba(255,210,74,0.5)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                          Champion
                        </div>
                        <div className="font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", textShadow: "0 0 8px rgba(255,210,74,0.4)" }}>
                          {season.championName}
                        </div>
                      </div>
                    </div>
                  ) : playoffPend ? (
                    <div className="mt-4 pt-3 border-t flex items-center gap-2" style={{ borderColor: "rgba(255,210,74,0.1)" }}>
                      <Clock className="w-4 h-4 shrink-0" style={{ color: "#ffd24a" }} />
                      <div>
                        <div className="text-xs font-bold uppercase" style={{ color: "rgba(255,210,74,0.6)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>Status</div>
                        <div className="text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>Awaiting Playoff</div>
                      </div>
                    </div>
                  ) : isLive ? (
                    <div className="mt-4 pt-3 border-t flex items-center gap-2" style={{ borderColor: "rgba(255,0,92,0.1)" }}>
                      <span className="live-dot" />
                      <span className="text-xs font-bold uppercase" style={{ color: "rgba(255,0,92,0.7)", fontFamily: "Oswald, sans-serif" }}>
                        Season in progress
                      </span>
                    </div>
                  ) : (
                    <div className="mt-4 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>No champion recorded</span>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}

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
