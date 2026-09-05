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
      <div className="ticker-bar" style={{ height }}>
        <div className="ticker-label" style={{ fontSize: compact ? "0.55rem" : "0.6rem" }}>
          RESULTS
        </div>
        <div className="flex-1 flex items-center px-4">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", fontSize: compact ? "0.6rem" : "0.65rem" }}>
            Waiting on the next result…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-bar" style={{ height }}>
      <div className="ticker-label" style={{ fontSize: compact ? "0.55rem" : "0.6rem" }}>
        RESULTS
      </div>
      <div className="ticker-scroll-wrap">
        <div
          className="ticker-track"
          style={{
            ["--ticker-duration" as any]: `${Math.max(20, ordered.length * 6)}s`
          }}
        >
          {[...ordered, ...ordered].map((item, i) => (
            <div key={`${item.matchId}-${i}`} className="ticker-item">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: LEAGUE_ACCENT[item.leagueType], opacity: 0.9 }} />
              <span className="font-black uppercase" style={{ color: "#22c55e" }}>{displayName(item.leagueType, item.winnerId, namesByKey)}</span>
              <span className="text-xs px-1.5 py-0.5 rounded font-black uppercase" style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: "0.55rem", letterSpacing: "0.1em" }}>
                def.
              </span>
              <span className="font-bold uppercase" style={{ color: "rgba(255,255,255,0.7)" }}>{displayName(item.leagueType, item.loserId, namesByKey)}</span>
              <div className="h-4 w-px mx-2" style={{ background: "rgba(255,255,255,0.15)" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
