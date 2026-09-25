// Build-fix (2026-09-25): pages/card-clash.tsx imports { VirtualizedLeaderboard }
// from this file, but the file had been emptied out (see git history for the
// prior "REMOVED — inert and unreferenced" version) on the mistaken belief
// that nothing still imported it — card-clash.tsx did, so the Render build
// failed on the missing export. This restores a minimal, non-virtualized
// replacement (a plain .map() list, same approach pages/leaderboard.tsx
// already uses) rather than reviving the original virtualized implementation,
// which itself depended on a useVirtualization hook that doesn't exist
// anywhere in this repo and was never going to compile either. Scope is
// deliberately limited to unblocking the build — no other Card Clash
// behavior here was reviewed or changed.

type Standing = {
  player_id: number;
  player_name: string;
  wins: number;
  losses: number;
  total_matches: number;
  win_percentage?: number;
  cards_unlocked_count?: number;
  coins?: number;
  cards_owned?: number;
  updated_at?: string;
};

export function VirtualizedLeaderboard({
  standings,
  playerId,
  containerHeight = "600px",
}: {
  standings: Standing[];
  playerId: number | undefined;
  containerHeight?: string;
}) {
  return (
    <div style={{ maxHeight: containerHeight, overflowY: "auto" }}>
      {standings.map((s, i) => {
        const isYou = s.player_id === playerId;
        const winPct =
          s.win_percentage ??
          (s.total_matches > 0 ? Math.round((s.wins / s.total_matches) * 100) : 0);
        return (
          <div
            key={s.player_id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              marginBottom: "6px",
              background: isYou ? "rgba(192,132,252,0.1)" : "rgba(255,255,255,0.03)",
              border: isYou ? "1px solid rgba(192,132,252,0.3)" : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div style={{ width: "28px", textAlign: "center", fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, fontWeight: 600, color: isYou ? "#c084fc" : "rgba(255,255,255,0.85)" }}>
              {s.player_name}
              {isYou && <span style={{ fontSize: "11px", color: "rgba(192,132,252,0.7)", marginLeft: "6px" }}>(you)</span>}
            </div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)" }}>
              {s.wins}W–{s.losses}L
            </div>
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.35)", width: "44px", textAlign: "right" }}>
              {winPct}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
