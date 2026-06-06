import { useListSeasons } from "@workspace/api-client-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { Calendar, Trophy, Hash, Clock, ChevronDown, ChevronUp, Plus, Check, X, Target } from "lucide-react";

// Fetch players hook
function usePlayers() {
  const [players, setPlayers] = useState<any[]>([]);
  useEffect(() => {
    fetch("/api/players").then(r => r.json()).then(d => setPlayers(Array.isArray(d) ? d.filter((p:any) => p.isActive) : []));
  }, []);
  return players;
}

// Fetch season detail (standings)
function useSeasonDetail(id: number) {
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    if (!id) return;
    fetch(`/api/seasons/${id}`).then(r => r.json()).then(setData).catch(() => {});
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
    fetch(`/api/seasons/${seasonId}/playoff`).then(r => r.json()).then(d => { setMatches(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => setLoading(false));
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
  const isAdmin = sessionStorage.getItem("tkdl_admin_unlocked") === "1";

  const adminPin = () => sessionStorage.getItem("tkdl_admin_pin") ?? "";

  const addMatch = async () => {
    if (!form.player1Id || !form.player2Id || form.player1Id === form.player2Id) return;
    setSubmitting(true);
    await fetch(`/api/seasons/${seasonId}/playoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin() },
      body: JSON.stringify({ player1Id: parseInt(form.player1Id), player2Id: parseInt(form.player2Id), round: form.round, gameType: form.gameType }),
    });
    setSubmitting(false);
    setAdding(false);
    setForm({ player1Id: "", player2Id: "", round: "final", gameType: "Best of 3" });
    refresh();
  };

  const setWinner = async (matchId: number, winnerId: number) => {
    setSettingWinner(matchId);
    await fetch(`/api/seasons/${seasonId}/playoff/${matchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Admin-Pin": adminPin() },
      body: JSON.stringify({ winnerId }),
    });
    setSettingWinner(null);
    refresh();
    window.location.reload();
  };

  const deleteMatch = async (matchId: number) => {
    await fetch(`/api/seasons/${seasonId}/playoff/${matchId}`, {
      method: "DELETE",
      headers: { "X-Admin-Pin": adminPin() },
    });
    refresh();
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

  const isLive      = season.isActive;
  const hasChampion = !!season.championName;
  const playoffPend = !!(season as any).playoffPending;
  const format301   = (season as any).format === "301";
  const notes       = (season as any).notes;
  const showPlayoff = playoffPend || hasChampion;

  return (
    <div
      className={`pdc-card overflow-hidden transition-all duration-300 fade-in-up ${isLive ? "pulse-red" : ""}`}
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
      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div>
            <h3 className="font-black text-xl uppercase leading-tight"
              style={{ fontFamily: "Oswald, sans-serif", color: isLive ? "#ff005c" : hasChampion ? "#ffd24a" : "rgba(255,255,255,0.9)" }}>
              {season.name}
            </h3>
            {isLive && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#ff005c" }} />
                <span className="text-xs font-bold uppercase" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem", letterSpacing: "0.1em" }}>Live</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {isLive && (
              <span className="px-2 py-0.5 rounded text-xs font-black uppercase" style={{ background: "rgba(255,0,92,0.15)", border: "1px solid rgba(255,0,92,0.3)", color: "#ff005c", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                ● LIVE
              </span>
            )}
            {playoffPend && (
              <span className="px-2 py-0.5 rounded text-xs font-black uppercase" style={{ background: "rgba(255,210,74,0.1)", border: "1px solid rgba(255,210,74,0.3)", color: "#ffd24a", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                ⚡ PLAYOFF
              </span>
            )}
            {format301 && (
              <span className="px-2 py-0.5 rounded text-xs font-black uppercase" style={{ background: "rgba(0,102,255,0.1)", border: "1px solid rgba(0,102,255,0.3)", color: "#0066ff", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                301
              </span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-col gap-1.5 mb-4">
          <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            <Calendar className="w-3 h-3" />
            {format(new Date(season.startDate), "d MMM yyyy")} —{" "}
            {season.endDate ? format(new Date(season.endDate), "d MMM yyyy") : "Present"}
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            <Hash className="w-3 h-3" />
            {season.totalMatches} matches
          </div>
          {notes && (
            <div className="text-xs italic mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>{notes}</div>
          )}
        </div>

        {/* Champion */}
        {hasChampion && (
          <div className="flex items-center gap-3 p-3 rounded mb-4"
            style={{ background: "rgba(255,210,74,0.06)", border: "1px solid rgba(255,210,74,0.2)" }}>
            <Trophy className="w-5 h-5 shrink-0" style={{ color: "#ffd24a" }} />
            <div>
              <div className="text-xs uppercase font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,210,74,0.6)", fontSize: "0.6rem", letterSpacing: "0.1em" }}>Champion</div>
              <div className="text-lg font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>{season.championName}</div>
            </div>
          </div>
        )}

        {/* Status */}
        {isLive && (
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem" }}>
            ● Season in Progress
          </div>
        )}
        {playoffPend && !hasChampion && (
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase"
            style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif", fontSize: "0.65rem" }}>
            <Clock className="w-3 h-3" /> Awaiting Playoff
          </div>
        )}

        {/* Expand/Collapse button */}
        {!isLive && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full mt-4 pt-3 border-t flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider transition-all hover:opacity-70"
            style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}>
            {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Hide Details</> : <><ChevronDown className="w-3.5 h-3.5" /> {showPlayoff ? "Playoff & Standings" : "View Standings"}</>}
          </button>
        )}
      </div>

      {/* Expanded content */}
      {expanded && !isLive && (
        <div className="border-t px-5 pb-5" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {/* Standings */}
          {detail?.standings && detail.standings.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase font-bold mb-3" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.25)", letterSpacing: "0.12em" }}>
                League Standings
              </div>
              <div className="space-y-1">
                {detail.standings.map((s: any) => (
                  <Link key={s.playerId} href={`/players/${s.playerId}`}>
                    <div className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/5 transition-colors cursor-pointer group"
                      style={{ background: s.position === 1 ? "rgba(255,210,74,0.04)" : undefined }}>
                      <span className="w-5 text-xs font-black text-right shrink-0"
                        style={{ fontFamily: "Oswald, sans-serif", color: s.position === 1 ? "#ffd24a" : s.position === 2 ? "#9ca3af" : s.position === 3 ? "#cd7c2f" : "rgba(255,255,255,0.25)" }}>
                        {s.position}
                      </span>
                      {s.isChampion && <span className="text-xs">👑</span>}
                      <span className="text-sm font-bold flex-1 truncate group-hover:underline"
                        style={{ fontFamily: "Oswald, sans-serif", color: s.points === 0 ? "#ff005c" : "rgba(255,255,255,0.75)" }}>
                        {s.playerName}
                        {s.points === 0 && <span className="ml-1 text-xs opacity-60">☠</span>}
                      </span>
                      <span className="text-xs font-mono" style={{ color: "#22c55e", minWidth: "2rem", textAlign: "right" }}>{s.wins}W</span>
                      <span className="text-xs font-mono" style={{ color: "#ff005c" }}>{s.losses}L</span>
                      <span className="text-sm font-black ml-2" style={{ fontFamily: "Oswald, sans-serif", color: s.points === 0 ? "#ff005c" : "#ff005c", minWidth: "3rem", textAlign: "right" }}>
                        {s.points}pts
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Playoff section */}
          {showPlayoff && detail?.standings && (
            <PlayoffSection seasonId={season.id} standings={detail.standings} />
          )}
        </div>
      )}
    </div>
  );
}

export default function Seasons() {
  const { data: seasons, isLoading } = useListSeasons();
  const sorted = seasons ? [...seasons].sort((a, b) => b.id - a.id) : [];

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />
      <div>
        <h1 className="text-4xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
          Season Archive
        </h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
          {seasons?.length ?? 0} seasons · Full history
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {sorted.map((season: any, idx: number) => (
            <SeasonCard key={season.id} season={season} idx={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
