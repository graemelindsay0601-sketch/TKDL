import { useEffect, useState } from "react";
import { X, Trophy, Flame, TrendingUp } from "lucide-react";
import { useCosmeticsCatalog, recapStyleCSS } from "@/lib/cosmetics";
import { format } from "date-fns";

interface RecapData {
  position: number;
  wins: number;
  losses: number;
  points: number;
  elo: number;
  isChampion: boolean;
  seasonName: string;
  startDate: string;
  endDate: string | null;
  leagueType: string;
  matchesPlayed: number;
  winRate: number;
  longestStreak: number;
  biggestWin: number;
}

// A shareable-looking summary card of one of a player's own completed
// seasons — browsable from player-detail's Season History section (each row
// gets a "Recap" button that opens this as a modal). Content comes from
// GET /players/:id/seasons/:seasonId/recap: the season's frozen end-of-
// season standings row plus two computed highlights. Background skin comes
// from the player's own equipped RECAP_STYLE cosmetic (see
// lib/cosmetics.ts's recapStyleCSS) — falls back to a plain dark panel when
// nothing's equipped.
export function SeasonRecapModal({ playerId, seasonId, playerName, onClose }: { playerId: number; seasonId: number; playerName: string; onClose: () => void }) {
  const [recap, setRecap] = useState<RecapData | null>(null);
  const [error, setError] = useState(false);
  const cosmeticsCatalog = useCosmeticsCatalog();
  const [equippedRecapStyleId, setEquippedRecapStyleId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/players/${playerId}/seasons/${seasonId}/recap`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => { if (live) setRecap(d); })
      .catch(() => { if (live) setError(true); });
    fetch(`/api/players/${playerId}/cosmetics`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (live) setEquippedRecapStyleId(d?.equippedRecapStyleId ?? null); })
      .catch(() => {});
    return () => { live = false; };
  }, [playerId, seasonId]);

  const styleCosmetic = cosmeticsCatalog.find(c => c.id === equippedRecapStyleId);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={onClose}>
      <div
        className="relative w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "#15121f", border: "1px solid rgba(255,255,255,0.1)", ...recapStyleCSS(styleCosmetic) }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg z-10" style={{ background: "rgba(0,0,0,0.3)" }}>
          <X className="w-4 h-4" style={{ color: "rgba(255,255,255,0.6)" }} />
        </button>

        {!recap && !error && (
          <div className="py-20 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</div>
        )}
        {error && (
          <div className="py-20 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Couldn't load this season's recap.</div>
        )}
        {recap && (
          <div className="p-6">
            <div className="text-center mb-4">
              <div className="text-xs uppercase font-bold tracking-widest" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.4)" }}>
                {recap.leagueType === "singles" ? "Singles Season" : recap.leagueType === "doubles" ? "Doubles Season" : "Shift Wars Season"} Recap
              </div>
              <div className="text-2xl font-black uppercase mt-1" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>
                {recap.seasonName}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                {format(new Date(recap.startDate), "MMM yyyy")}
                {recap.endDate ? ` – ${format(new Date(recap.endDate), "MMM yyyy")}` : " – present"}
              </div>
              <div className="text-sm font-bold mt-2" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.75)" }}>
                {playerName}
              </div>
            </div>

            {recap.isChampion && (
              <div className="flex items-center justify-center gap-1.5 mb-4 py-1.5 rounded-lg"
                style={{ background: "rgba(255,210,74,0.1)", border: "1px solid rgba(255,210,74,0.3)" }}>
                <Trophy className="w-3.5 h-3.5" style={{ color: "#ffd24a" }} />
                <span className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", letterSpacing: "0.06em" }}>
                  Season Champion
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mb-3">
              <StatTile label="Finish" value={`#${recap.position}`} color={recap.position === 1 ? "#ffd24a" : "#fff"} />
              <StatTile label="Record" value={`${recap.wins}-${recap.losses}`} color="#fff" />
              <StatTile label="Win Rate" value={`${recap.winRate}%`} color="#22c55e" />
              <StatTile label="Points" value={`${recap.points}`} color="#ff005c" />
            </div>

            {(recap.longestStreak > 1 || recap.biggestWin > 0) && (
              <div className="flex flex-col gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {recap.longestStreak > 1 && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                    <Flame className="w-3.5 h-3.5" style={{ color: "#ff8c00" }} />
                    Longest streak this season: <span className="font-bold" style={{ color: "#fff" }}>{recap.longestStreak} wins</span>
                  </div>
                )}
                {recap.biggestWin > 0 && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                    <TrendingUp className="w-3.5 h-3.5" style={{ color: "#0066ff" }} />
                    Biggest win: <span className="font-bold" style={{ color: "#fff" }}>+{recap.biggestWin} ELO</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg px-3 py-2 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
      <div className="text-[0.6rem] uppercase font-bold tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.35)" }}>
        {label}
      </div>
      <div className="text-lg font-black" style={{ fontFamily: "Oswald, sans-serif", color }}>
        {value}
      </div>
    </div>
  );
}
