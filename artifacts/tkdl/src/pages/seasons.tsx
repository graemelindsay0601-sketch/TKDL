import { useListSeasons } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { Archive, ArrowDown, ArrowUp, CalendarDays, CircleDot, Trophy, Hash, Search, Clock, ChevronDown, ChevronUp, Plus, Check, X, Target } from "lucide-react";
import { apiFetchJson, apiFetchJsonOr } from "@/lib/api-fetch";
import { useToast } from "@/hooks/use-toast";
import "@/styles/season-archive.css";

// Fetch players hook
function usePlayers() {
  const [players, setPlayers] = useState<any[]>([]);
  useEffect(() => {
    apiFetchJsonOr<any[]>("/api/players", []).then(d => setPlayers(Array.isArray(d) ? d.filter((p:any) => p.isActive) : []));
  }, []);
  return players;
}

// Fetch season MVP
function useSeasonMvp(id: number, enabled: boolean) {
  const [mvp, setMvp] = useState<{ playerId: number; playerName: string; wins: number } | null>(null);
  useEffect(() => {
    if (!enabled || !id) return;
    apiFetchJsonOr<any>(`/api/seasons/${id}/mvp`, null).then(d => setMvp(d));
  }, [id, enabled]);
  return mvp;
}

// Fetch season detail (standings)
function useSeasonDetail(id: number) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (!id) return;
    apiFetchJsonOr<any>(`/api/seasons/${id}`, null).then(setData);
  }, [id]);
  return data;
}

// Fetch playoff matches for a season
function usePlayoff(seasonId: number, enabled: boolean) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const refresh = () => {
    if (!enabled) return;
    setLoading(true);
    apiFetchJson<any[]>(`/api/seasons/${seasonId}/playoff`).then(d => { setMatches(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(refresh, [seasonId, enabled]);
  return { matches, loading, refresh };
}

const ROUND_LABELS: Record<string, string> = {
  "semi-final": "Semi Final",
  "semifinal": "Semi Final",
  "final": "Grand Final",
  "quarter-final": "Quarter Final",
  "3rd-place": "3rd Place Play-off",
};

function PlayoffSection({ seasonId, standings }: { seasonId: number; standings: any[] }) {
  const players = usePlayers();
  const { matches, loading, refresh } = usePlayoff(seasonId, true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ player1Id: "", player2Id: "", round: "final", gameType: "Best of 3" });
  const [submitting, setSubmitting] = useState(false);
  const [settingWinner, setSettingWinner] = useState<number | null>(null);
  // "tkdl_admin_unlocked" only controls which UI to show — the actual
  // authorization comes from the admin session cookie set by the real PIN
  // screen (POST /api/admin/verify-pin). No PIN is sent with these requests.
  const isAdmin = sessionStorage.getItem("tkdl_admin_unlocked") === "1";
  const { toast } = useToast();

  const addMatch = async () => {
    if (!form.player1Id || !form.player2Id || form.player1Id === form.player2Id) return;
    setSubmitting(true);
    try {
      await apiFetchJson(`/api/seasons/${seasonId}/playoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ player1Id: parseInt(form.player1Id), player2Id: parseInt(form.player2Id), round: form.round, gameType: form.gameType }),
      });
      setAdding(false);
      setForm({ player1Id: "", player2Id: "", round: "final", gameType: "Best of 3" });
      refresh();
    } catch (err) {
      toast({ title: "Couldn't add playoff match", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const setWinner = async (matchId: number, winnerId: number) => {
    setSettingWinner(matchId);
    try {
      await apiFetchJson(`/api/seasons/${seasonId}/playoff/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ winnerId }),
      });
      refresh();
      // Only reload once the write actually succeeded — previously this ran
      // unconditionally, so a failed PATCH (expired admin session, a
      // network blip) looked like a clean success with the match silently
      // never recorded.
      window.location.reload();
    } catch (err) {
      toast({ title: "Couldn't set winner", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSettingWinner(null);
    }
  };

  const deleteMatch = async (matchId: number) => {
    try {
      await apiFetchJson(`/api/seasons/${seasonId}/playoff/${matchId}`, { method: "DELETE" });
      refresh();
    } catch (err) {
      toast({ title: "Couldn't delete match", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const activePlayers = players.filter(p => p.isActive);
  const top4 = standings.slice(0, 4);

  return (
    <div className="mt-5 pt-5 border-t" style={{ borderColor: "rgba(255,210,74,0.2)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4" style={{ color: "#ffd24a" }} />
          <h3 className="font-black uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>
            Playoff Bracket
          </h3>
        </div>
        {isAdmin && (
          <button onClick={() => setAdding(a => !a)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all hover:opacity-80"
            style={{ background: "rgba(255,210,74,0.12)", border: "1px solid rgba(255,210,74,0.3)", color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
            <Plus className="w-3 h-3" /> Add Match
          </button>
        )}
      </div>

      {/* Top 4 from league */}
      {top4.length > 0 && (
        <div className="mb-4 rounded p-3" style={{ background: "rgba(255,210,74,0.04)", border: "1px solid rgba(255,210,74,0.1)" }}>
          <div className="text-xs uppercase font-bold mb-2" style={{ color: "rgba(255,210,74,0.5)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em", fontSize: "0.6rem" }}>
            League Stage Qualifiers
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {top4.map((s: any, i: number) => (
              <div key={s.playerId} className="flex items-center gap-2 p-2 rounded"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-xs font-black w-4" style={{ fontFamily: "Oswald, sans-serif", color: i === 0 ? "#ffd24a" : "rgba(255,255,255,0.3)" }}>
                  {i + 1}
                </span>
                <span className="text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  {s.playerName}
                </span>
                <span className="text-xs ml-auto font-mono" style={{ color: "#ff005c" }}>{s.points}pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add match form — admin only */}
      {isAdmin && adding && (
        <div className="mb-4 p-4 rounded" style={{ background: "rgba(255,210,74,0.04)", border: "1px solid rgba(255,210,74,0.2)" }}>
          <div className="text-xs uppercase font-bold mb-3" style={{ color: "rgba(255,210,74,0.6)", fontFamily: "Oswald, sans-serif", letterSpacing: "0.1em" }}>
            Schedule Playoff Match
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>PLAYER 1</div>
              <select value={form.player1Id} onChange={e => setForm(f => ({ ...f, player1Id: e.target.value }))}
                className="w-full px-2 py-1.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
                <option value="">Select...</option>
                {activePlayers.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>PLAYER 2</div>
              <select value={form.player2Id} onChange={e => setForm(f => ({ ...f, player2Id: e.target.value }))}
                className="w-full px-2 py-1.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
                <option value="">Select...</option>
                {activePlayers.filter((p: any) => p.id !== parseInt(form.player1Id)).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>ROUND</div>
              <select value={form.round} onChange={e => setForm(f => ({ ...f, round: e.target.value }))}
                className="w-full px-2 py-1.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
                <option value="quarter-final">Quarter Final</option>
                <option value="semi-final">Semi Final</option>
                <option value="3rd-place">3rd Place Play-off</option>
                <option value="final">Grand Final</option>
              </select>
            </div>
            <div>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>FORMAT</div>
              <select value={form.gameType} onChange={e => setForm(f => ({ ...f, gameType: e.target.value }))}
                className="w-full px-2 py-1.5 rounded text-sm"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>
                <option>Best of 3</option>
                <option>Best of 5</option>
                <option>Best of 7</option>
                <option>Single leg 501</option>
                <option>Single leg 301</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addMatch} disabled={submitting || !form.player1Id || !form.player2Id}
              className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider disabled:opacity-40 transition-all"
              style={{ background: "#ffd24a", color: "#09090f", fontFamily: "Oswald, sans-serif" }}>
              {submitting ? "Adding..." : "Add Match"}
            </button>
            <button onClick={() => setAdding(false)}
              className="px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Matches list */}
      {loading ? (
        <div className="text-center py-6" style={{ color: "rgba(255,255,255,0.2)" }}>Loading...</div>
      ) : matches.length === 0 ? (
        <div className="text-center py-6 text-sm" style={{ color: "rgba(255,255,255,0.2)" }}>
          {isAdmin ? "No playoff matches yet. Add one above." : "No playoff matches scheduled yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m: any) => (
            <div key={m.id} className="rounded overflow-hidden"
              style={{ border: `1px solid ${m.winner_id ? "rgba(255,210,74,0.25)" : "rgba(255,255,255,0.08)"}`, background: m.winner_id ? "rgba(255,210,74,0.03)" : "rgba(255,255,255,0.02)" }}>
              {/* Match header */}
              <div className="px-3 py-1.5 flex items-center justify-between border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="text-xs font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,210,74,0.6)", letterSpacing: "0.1em", fontSize: "0.6rem" }}>
                  {ROUND_LABELS[m.round] ?? m.round}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.6rem" }}>{m.game_type}</span>
                  {isAdmin && (
                    <button onClick={() => deleteMatch(m.id)} className="text-xs opacity-30 hover:opacity-70 transition-opacity" style={{ color: "#ff005c" }}>
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {/* Players */}
              <div className="px-3 py-3 flex items-center gap-2">
                {/* P1 */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {!m.winner_id ? (
                      isAdmin ? (
                        <button onClick={() => setWinner(m.id, m.player1_id)}
                          disabled={settingWinner === m.id}
                          className="flex-1 py-2 px-3 rounded text-sm font-bold uppercase text-left transition-all hover:bg-white/10"
                          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {m.player1_name}
                          <span className="ml-2 text-xs font-normal opacity-50">tap to win</span>
                        </button>
                      ) : (
                        <div className="flex-1 py-2 px-3 rounded text-sm font-bold uppercase"
                          style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          {m.player1_name}
                        </div>
                      )
                    ) : (
                      <div className="flex-1 py-2 px-3 rounded text-sm font-bold uppercase"
                        style={{ fontFamily: "Oswald, sans-serif", color: m.winner_id === m.player1_id ? "#ffd24a" : "rgba(255,255,255,0.3)", background: m.winner_id === m.player1_id ? "rgba(255,210,74,0.08)" : "transparent", border: `1px solid ${m.winner_id === m.player1_id ? "rgba(255,210,74,0.3)" : "rgba(255,255,255,0.04)"}` }}>
                        {m.winner_id === m.player1_id && "👑 "}{m.player1_name}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm font-black" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)" }}>VS</div>
                {/* P2 */}
                <div className="flex-1">
                  {!m.winner_id ? (
                    isAdmin ? (
                      <button onClick={() => setWinner(m.id, m.player2_id)}
                        disabled={settingWinner === m.id}
                        className="flex-1 w-full py-2 px-3 rounded text-sm font-bold uppercase text-left transition-all hover:bg-white/10"
                        style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {m.player2_name}
                        <span className="ml-2 text-xs font-normal opacity-50">tap to win</span>
                      </button>
                    ) : (
                      <div className="flex-1 py-2 px-3 rounded text-sm font-bold uppercase"
                        style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {m.player2_name}
                      </div>
                    )
                  ) : (
                    <div className="flex-1 py-2 px-3 rounded text-sm font-bold uppercase"
                      style={{ fontFamily: "Oswald, sans-serif", color: m.winner_id === m.player2_id ? "#ffd24a" : "rgba(255,255,255,0.3)", background: m.winner_id === m.player2_id ? "rgba(255,210,74,0.08)" : "transparent", border: `1px solid ${m.winner_id === m.player2_id ? "rgba(255,210,74,0.3)" : "rgba(255,255,255,0.04)"}` }}>
                      {m.winner_id === m.player2_id && "👑 "}{m.player2_name}
                    </div>
                  )}
                </div>
              </div>
              {m.winner_id && (
                <div className="px-3 pb-2">
                  <span className="text-xs" style={{ color: "#ffd24a", fontSize: "0.65rem" }}>
                    🏆 {m.winner_name} wins
                    {m.round === "final" && " — SEASON CHAMPION"}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SeasonCard({ season, idx }: { season: any; idx: number }) {
  const [expanded, setExpanded] = useState(false);
  const detail = useSeasonDetail(expanded ? season.id : 0);
  const mvp    = useSeasonMvp(season.id, !season.isActive && !!season.championName);

  const isLive      = season.isActive;
  const hasChampion = !!season.championName;
  const playoffPend = !!(season as any).playoffPending;
  const format301   = (season as any).format === "301";
  const notes       = (season as any).notes;
  const showPlayoff = playoffPend || hasChampion;
  const isAdmin     = sessionStorage.getItem("tkdl_admin_unlocked") === "1";
  const dateRange = `${format(new Date(season.startDate), "d MMM yyyy")} — ${
    season.endDate ? format(new Date(season.endDate), "d MMM yyyy") : "Present"
  }`;

  return (
    <article
      className={`season-entry ${isLive ? "is-live" : "is-complete"} ${expanded ? "is-expanded" : ""}`}
      style={{ "--entry-index": idx } as CSSProperties}
    >
      <div className="entry-marker" aria-hidden="true">
        <span>{String(idx + 1).padStart(2, "0")}</span>
        <i />
      </div>
      <div className="entry-panel">
        <div className="entry-main">
          <div className="entry-title-block">
            <div className="entry-overline">
              <span className={`status-mark ${isLive ? "live-mark" : ""}`}>
                {isLive ? <CircleDot size={13} /> : <Check size={13} />}
              </span>
              <span>{isLive ? "Season in progress" : "Season complete"}</span>
              {isLive && <span className="live-chip">Live now</span>}
              {playoffPend && !hasChampion && <span className="live-chip">Playoff pending</span>}
            </div>
            <h2>{season.name}</h2>
            <div className="entry-dates">
              <CalendarDays size={14} aria-hidden="true" />
              <span>{dateRange}</span>
            </div>
            {notes && <p className="season-notes">{notes}</p>}
          </div>

          <div className="entry-summary">
            <div className="summary-number">
              <span className="summary-value">{String(season.totalMatches ?? 0).padStart(2, "0")}</span>
              <span className="summary-label">Matches</span>
            </div>
            <div className="summary-divider" />
            <div className="summary-champion">
              <span className="summary-label">{isLive ? "Title status" : "Season champion"}</span>
              <strong className={hasChampion ? "" : "awaiting"}>{season.championName ?? "Not decided"}</strong>
              {mvp && mvp.playerId !== season.championId && (
                <span className="summary-mvp">Season MVP · {mvp.playerName} ({mvp.wins}W)</span>
              )}
              {playoffPend && !hasChampion && <span className="summary-mvp">Awaiting playoff</span>}
            </div>
            {format301 && <span className="format-stamp" aria-label="301 format">301</span>}
          </div>
        </div>

        <button
          type="button"
          className="entry-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={`season-details-${season.id}`}
          aria-label={`${expanded ? "Hide" : "View"} details for ${season.name}`}
        >
          <span>{expanded ? "Close season record" : "Open season record"}</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {/* Expanded content keeps the existing standings, race narrative, and admin playoff tools. */}
        {expanded && (
          <div className="entry-details" id={`season-details-${season.id}`}>
            <div className="details-heading">
              <span className="details-index">RECORD / {String(season.id).padStart(2, "0")}</span>
              <span className="details-rule" />
              <Archive size={15} aria-hidden="true" />
            </div>
            <div className="details-grid">
              <div className="detail-cell">
                <span className="detail-label">Season dates</span>
                <span className="detail-value">{dateRange}</span>
              </div>
              <div className="detail-cell">
                <span className="detail-label">Matches played</span>
                <span className="detail-value"><Hash size={13} /> {season.totalMatches ?? 0}</span>
              </div>
              <div className="detail-cell">
                <span className="detail-label">Champion</span>
                <span className={`detail-value ${hasChampion ? "gold-value" : "quiet-value"}`}>
                  {hasChampion ? <><Trophy size={14} /> {season.championName}</> : <><Clock size={14} /> Yet to be decided</>}
                </span>
              </div>
              {format301 && (
                <div className="detail-cell">
                  <span className="detail-label">Format</span>
                  <span className="detail-value"><span className="mini-format">301</span> 301</span>
                </div>
              )}
              {mvp && (
                <div className="detail-cell">
                  <span className="detail-label">Season MVP</span>
                  <span className="detail-value gold-value">{mvp.playerName} · {mvp.wins} wins</span>
                </div>
              )}
            </div>
            {notes && <p className="details-note">{notes}</p>}

          {/* ── LIVE season narrative ── */}
          {isLive && detail?.standings && detail.standings.length >= 2 && (() => {
            // Elo tiebreak matches the leaderboard/players-page convention
            // (points desc, then elo desc) — currently masked here by a
            // stable sort over already-correctly-ordered API data, but kept
            // explicit so this narrative block can't silently drift from the
            // real ranking if the standings payload's order ever changes.
            const st: any[] = [...detail.standings].sort((a: any, b: any) => b.points - a.points || (b.elo ?? 1000) - (a.elo ?? 1000));
            const top = st[0];
            const second = st[1];
            const gap = top && second ? top.points - second.points : null;
            const dangerZone = st.filter((s: any) => s.points === 0);
            const hasNarrative = gap !== null || dangerZone.length > 0;
            if (!hasNarrative) return null;

            return (
              <div className="mt-4 space-y-2 mb-1">
                {gap !== null && gap <= 10 && second && (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                    style={{ background: "rgba(255,210,74,0.07)", border: "1px solid rgba(255,210,74,0.22)" }}>
                    <span className="text-base shrink-0 mt-0.5">⚡</span>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", fontSize: "0.6rem", letterSpacing: "0.1em" }}>
                        TITLE RACE
                      </div>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
                        <span style={{ color: "#ffd24a", fontWeight: 700 }}>{top.playerName}</span> leads{" "}
                        <span style={{ color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>{second.playerName}</span>{" "}
                        by only <span style={{ color: "#ffd24a", fontWeight: 700 }}>{gap} pts</span> — anyone's race
                      </p>
                    </div>
                  </div>
                )}
                {gap !== null && gap > 10 && top && second && (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                    style={{ background: "rgba(255,0,92,0.06)", border: "1px solid rgba(255,0,92,0.15)" }}>
                    <span className="text-base shrink-0 mt-0.5">👑</span>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", fontSize: "0.6rem", letterSpacing: "0.1em" }}>
                        LEADER
                      </div>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.55)" }}>
                        <span style={{ color: "#fff", fontWeight: 700 }}>{top.playerName}</span> leads by{" "}
                        <span style={{ color: "#ff005c", fontWeight: 700 }}>{gap} pts</span> — {second.playerName} chasing
                      </p>
                    </div>
                  </div>
                )}
                {dangerZone.length > 0 && (
                  <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg"
                    style={{ background: "rgba(255,0,92,0.04)", border: "1px solid rgba(255,0,92,0.12)" }}>
                    <span className="text-base shrink-0 mt-0.5">☠</span>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,0,92,0.7)", fontSize: "0.6rem", letterSpacing: "0.1em" }}>
                        DANGER ZONE
                      </div>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {dangerZone.map((s: any) => s.playerName).join(", ")} — eliminated from title race
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Standings */}
          {detail?.standings && detail.standings.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase font-bold mb-3" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em" }}>
                {isLive ? "Current Standings" : "League Standings"}
              </div>
              <div className="space-y-1">
                {[...detail.standings].sort((a: any, b: any) => isLive ? (b.points - a.points || (b.elo ?? 1000) - (a.elo ?? 1000)) : a.position - b.position).map((s: any, idx: number) => (
                  <Link key={s.playerId} href={`/players/${s.playerId}`}>
                    <div className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/5 transition-colors cursor-pointer group"
                      style={{ background: (isLive ? idx === 0 : s.position === 1) ? "rgba(255,210,74,0.04)" : undefined }}>
                      <span className="w-5 text-xs font-black text-right shrink-0"
                        style={{ fontFamily: "Oswald, sans-serif", color: (isLive ? idx : s.position - 1) === 0 ? "#ffd24a" : (isLive ? idx : s.position - 1) === 1 ? "#9ca3af" : (isLive ? idx : s.position - 1) === 2 ? "#cd7c2f" : "rgba(255,255,255,0.25)" }}>
                        {isLive ? idx + 1 : s.position}
                      </span>
                      {s.isChampion && <span className="text-xs">👑</span>}
                      <span className="text-sm font-bold flex-1 truncate group-hover:underline"
                        style={{ fontFamily: "Oswald, sans-serif", color: s.points === 0 ? "rgba(255,0,92,0.5)" : "rgba(255,255,255,0.75)" }}>
                        {s.playerName}
                        {s.points === 0 && <span className="ml-1 text-xs opacity-60">☠</span>}
                      </span>
                      <span className="text-xs font-mono" style={{ color: "#22c55e", minWidth: "2rem", textAlign: "right" }}>{s.wins}W</span>
                      <span className="text-xs font-mono" style={{ color: "#ff005c" }}>{s.losses}L</span>
                      <span className="text-sm font-black ml-2" style={{ fontFamily: "Oswald, sans-serif", color: s.points === 0 ? "rgba(255,0,92,0.5)" : "#ff005c", minWidth: "3rem", textAlign: "right" }}>
                        {s.points}pts
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Playoff section — admin only */}
          {isAdmin && showPlayoff && detail?.standings && (
            <PlayoffSection seasonId={season.id} standings={detail.standings} />
          )}
        </div>
      )}
      </div>
    </article>
  );
}

type SeasonFilter = "all" | "live" | "completed";

export default function Seasons() {
  const { data: seasons, isLoading } = useListSeasons();
  const [filter, setFilter] = useState<SeasonFilter>("all");
  const [query, setQuery] = useState("");
  const [ascending, setAscending] = useState(false);

  const visibleSeasons = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...(seasons ?? [])]
      .filter((season: any) => {
        const matchesFilter = filter === "all" ||
          (filter === "live" && season.isActive) ||
          (filter === "completed" && !season.isActive);
        const searchable = `${season.name} ${season.championName ?? ""} ${season.format ?? ""} ${season.notes ?? ""}`;
        return matchesFilter && searchable.toLowerCase().includes(normalizedQuery);
      })
      .sort((a: any, b: any) => {
        const dateDifference = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        return ascending ? dateDifference : -dateDifference;
      });
  }, [seasons, filter, query, ascending]);
  const completedCount = (seasons ?? []).filter((season: any) => !season.isActive).length;
  const liveSeason = (seasons ?? []).find((season: any) => season.isActive);

  return (
    <main className="archive-premium">
      <div className="archive-inner">
        <header className="archive-masthead">
          <div className="masthead-brand">
            <span className="brand-mark"><Trophy size={13} /></span>
            <span>TKDL / Season archive</span>
          </div>
          <div className="masthead-location"><span className="masthead-dot" /> Match night records</div>
        </header>

        <section className="archive-intro" aria-labelledby="archive-title">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> The record room</div>
            <h1 id="archive-title" className="archive-title">SEASONS<br /><span>ON THE BOARD</span></h1>
            <p className="archive-subtitle">
              Every campaign leaves its mark. Revisit the seasons, the matches played, and the names written into the TKDL record.
            </p>
          </div>
          <div className="intro-count" aria-label={`${seasons?.length ?? 0} seasons in the archive`}>
            <strong>{String(seasons?.length ?? 0).padStart(2, "0")}</strong>
            <span>Seasons<br />on record</span>
          </div>
        </section>

        <section aria-label="Season archive controls">
          <div className="archive-toolbar">
            <div className="filter-group" role="group" aria-label="Filter seasons">
              {([
                ["all", "All seasons"],
                ["live", "In progress"],
                ["completed", "Completed"],
              ] as [SeasonFilter, string][]).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="filter-btn"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="toolbar-tools">
              <label className="search-box">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Find a season"
                  aria-label="Search seasons, champions, or format"
                />
              </label>
              <button
                type="button"
                className="sort-btn"
                onClick={() => setAscending((value) => !value)}
                aria-label={`Sort seasons ${ascending ? "newest first" : "oldest first"}`}
              >
                {ascending ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                <span>{ascending ? "Oldest" : "Newest"}</span>
              </button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="season-loading" role="status" aria-label="Loading seasons">
            <span className="season-loading-spinner" />
          </div>
        ) : (
          <section className="timeline" aria-label="Seasons">
            {visibleSeasons.length > 0 ? visibleSeasons.map((season: any, idx: number) => (
              <SeasonCard key={season.id} season={season} idx={idx} />
            )) : (
              <div className="empty-state">
                <Search size={18} aria-hidden="true" />
                <strong>{seasons?.length ? "No season found" : "No seasons recorded"}</strong>
                <span>{seasons?.length ? "Try another month, champion, or format." : "Season records will appear here once available."}</span>
              </div>
            )}
          </section>
        )}

        <footer className="archive-footnote">
          <span className="footnote-line" />
          <span>{completedCount} completed seasons{liveSeason ? ` · ${liveSeason.name} still in play` : ""}</span>
        </footer>
      </div>
    </main>
  );
}
