// TKDL LIVE — the lower ticker strip (handover doc 11.4 "Ticker: All new
// results. Update immediately on next poll.", 15.2's own "lower ticker" for
// the >=1280px composition and "sticky compact ticker" on mobile). Reuses
// the exact scrolling-marquee treatment pages/broadcast.tsx's own existing
// kiosk board already established for this app (same @keyframes ticker
// technique) rather than inventing a second one.
import { useMemo } from "react";
import type { LiveTickerItem, LeagueType } from "./types";
import { LEAGUE_ACCENT } from "./theme";

export type LiveTickerProps = {
  items: LiveTickerItem[];
  /**
   * `${leagueType}:${entityId}` -> display name — the SAME composite-key
   * convention story-engine-math.ts's own subjectKey() already uses for
   * `LiveOverlayItem.subjectKeys` (see LiveInsertOverlay's own
   * namesBySubjectKey), adopted here too rather than a bare numeric id: a
   * singles winnerId is a player id, but a doubles/shift_wars winnerId is a
   * TEAM id (live-events.ts's own RecentMatch mapping) — a bare `Map<number,
   * string>` would silently collide a player and an unrelated team that
   * happen to share a small numeric id. useEntityNames() (useBroadcast.ts)
   * builds one such map from all three id spaces (players, doubles teams,
   * shift-wars teams) for both this prop and LiveInsertOverlay's at once. A
   * key missing from this map falls back to "#<id>" rather than blocking the
   * whole ticker on one unresolved name.
   */
  namesByKey: ReadonlyMap<string, string>;
  compact?: boolean;
};

function displayName(leagueType: LeagueType, id: number, namesByKey: ReadonlyMap<string, string>): string {
  return namesByKey.get(`${leagueType}:${id}`) ?? `#${id}`;
}

export function LiveTicker({ items, namesByKey, compact = false }: LiveTickerProps) {
  // A stable render order (newest first is how the API already returns
  // them) but rendered oldest-to-newest left-to-right so the marquee reads
  // like a real news ticker advancing forward through time, not backward.
  const ordered = useMemo(() => [...items].reverse(), [items]);
  const height = compact ? 32 : 40;

  if (ordered.length === 0) {
    return (
      <div
        className="flex items-center px-4 border-t"
        style={{ height, borderColor: "rgba(255,0,92,0.25)", background: "rgba(255,0,92,0.06)" }}
      >
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", fontSize: compact ? "0.6rem" : "0.65rem" }}>
          Waiting on the next result…
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center overflow-hidden border-t"
      style={{ height, borderColor: "rgba(255,0,92,0.25)", background: "rgba(255,0,92,0.06)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="shrink-0 px-4 font-black uppercase tracking-widest border-r h-full flex items-center"
        style={{ color: "#ff005c", borderColor: "rgba(255,0,92,0.3)", letterSpacing: "0.2em", background: "rgba(255,0,92,0.12)", fontSize: compact ? "0.55rem" : "0.6rem", fontFamily: "Oswald, sans-serif" }}
      >
        RESULTS
      </div>
      <div className="flex-1 overflow-hidden relative">
        <div
          className="flex items-center gap-8 whitespace-nowrap font-bold"
          style={{
            color: "rgba(255,255,255,0.7)",
            animation: `tkdl-live-ticker ${Math.max(20, ordered.length * 6)}s linear infinite`,
            paddingLeft: "100%",
            fontFamily: "Oswald, sans-serif",
            letterSpacing: "0.06em",
            fontSize: compact ? "0.7rem" : "0.8rem",
          }}
        >
          {[...ordered, ...ordered].map((item, i) => (
            <span key={`${item.matchId}-${i}`} className="flex items-center gap-3">
              <span style={{ color: LEAGUE_ACCENT[item.leagueType], opacity: 0.7 }}>●</span>
              <span className="font-black uppercase" style={{ color: "#22c55e" }}>{displayName(item.leagueType, item.winnerId, namesByKey)}</span>
              <span className="text-xs px-1.5 py-0.5 rounded font-black uppercase" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", fontSize: "0.6rem", letterSpacing: "0.08em" }}>
                def.
              </span>
              <span className="font-bold uppercase" style={{ color: "rgba(255,255,255,0.55)" }}>{displayName(item.leagueType, item.loserId, namesByKey)}</span>
            </span>
          ))}
        </div>
      </div>
      <style>{`
        @keyframes tkdl-live-ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
