import { useGetSeason, getGetSeasonQueryKey } from "@workspace/api-client-react";
import { useParams, useSearch, Link } from "wouter";
import { TierBadge } from "@/components/tier-badge";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { Trophy, Calendar, Hash, ArrowLeft, Medal, Flame, Zap, Crown, BarChart3, Swords, Users, Skull, Building2 } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";

function useSeasonMatches(seasonId: number) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!seasonId) return;
    setLoading(true);
    fetch(`/api/seasons/${seasonId}/matches`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [seasonId]);
  return { data, loading };
}

// Doubles and Shift Wars each run their own independent monthly season now
// (see db/migrations/add_season_league_type.ts) — their season ids no longer
// line up with whichever Singles season this page happens to be showing, so
// rather than pretend a fixed historical relationship these tabs always
// reflect the CURRENT Doubles/Shift Wars season, whichever Singles season
// you're browsing. This mirrors how Shift Wars was already treated here
// ("a standing 3-team competition") — Doubles now gets the same treatment.
function useCurrentLeagueSeasonId(leagueType: "doubles" | "shift_wars"): number | null {
  const [id, setId] = useState<number | null>(null);
  useEffect(() => {
    fetch(`/api/seasons/current?leagueType=${leagueType}`)
      .then(r => r.json())
      .then(d => setId(d?.id ?? null))
      .catch(() => setId(null));
  }, [leagueType]);
  return id;
}

function useDoublesTeams() {
  const currentSeasonId = useCurrentLeagueSeasonId("doubles");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (currentSeasonId === null) return;
    if (!currentSeasonId) { setData([]); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/seasons/${currentSeasonId}/doubles/teams`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [currentSeasonId]);
  return { data, loading };
}

function useDoublesMatches() {
  const currentSeasonId = useCurrentLeagueSeasonId("doubles");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (currentSeasonId === null) return;
    if (!currentSeasonId) { setData([]); setLoading(false); return; }
    setLoading(true);
    fetch(`/api/seasons/${currentSeasonId}/doubles/matches`)
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [currentSeasonId]);
  return { data, loading };
}

// Always the live current Shift Wars standings, regardless of which Singles
// season is being browsed — see the comment above useCurrentLeagueSeasonId.
// Past Shift Wars seasons are still browsable via /api/shift-wars/history
// (the "recent champions" list) elsewhere; this tab is just "what's
// happening right now".
function useSeasonShiftWars() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch("/api/shift-wars/teams")
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);
  return { data, loading, isLive: true };
}

export default function SeasonDetail() {
  const params = useParams();
  const seasonId = parseInt(params.id || "0", 10);
  // A doubles/shift-wars card elsewhere in the app (e.g. a player's profile)
  // links here with ?tab=doubles / ?tab=shiftwars since those seasons now
  // have their own ids, separate from whichever Singles season this page's
  // :id refers to — see useCurrentLeagueSeasonId above.
  const search = useSearch();
  const requestedTab = new URLSearchParams(search).get("tab");
  const [activeTab, setActiveTab] = useState<"standings" | "matches" | "doubles" | "shiftwars">(
    requestedTab === "doubles" || requestedTab === "shiftwars" ? requestedTab : "standings"
  );
  const [doublesView, setDoublesView] = useState<"standings" | "matches">("standings");

  const { data: seasonDetail, isLoading } = useGetSeason(seasonId, {
    query: { enabled: !!seasonId, queryKey: getGetSeasonQueryKey(seasonId) },
  });
  const { data: matches, loading: matchesLoading } = useSeasonMatches(seasonId);
  const { data: doublesTeams, loading: doublesTeamsLoading } = useDoublesTeams();
  const { data: doublesMatches, loading: doublesMatchesLoading } = useDoublesMatches();
  const { data: shiftWarsRows, loading: shiftWarsLoading, isLive: shiftWarsIsLive } = useSeasonShiftWars();
  const { data: appSettings } = useSettings();
  const shiftWarsEnabled = appSettings?.shift_wars_enabled ?? false;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
      </div>
    );
  }

  if (!seasonDetail) {
    return <div className="text-center py-20" style={{ color: "rgba(255,255,255,0.3)" }}>Season not found.</div>;
  }

  const { season, standings } = seasonDetail;
  const posColors = ["#ffd24a", "#c0c8d8", "#cd7f32"];

  return (
    <div className="space-y-6">
      <div className="pdc-divider" />

      <Link href="/seasons" className="flex items-center gap-1 text-xs hover:underline" style={{ color: "rgba(255,255,255,0.35)" }}>
        <ArrowLeft className="w-3 h-3" /> All Seasons
      </Link>

      {/* Header */}
      <div className="pdc-card p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6 justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold uppercase" style={{ fontFamily: "Oswald, sans-serif" }}>
                {season.name}
              </h1>
              {season.isActive && (
                <span
                  className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded animate-pulse"
                  style={{ background: "rgba(255,0,92,0.15)", color: "#ff005c", fontFamily: "Oswald, sans-serif", border: "1px solid rgba(255,0,92,0.3)" }}
                >
                  Live
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                {format(new Date(season.startDate), "MMM d, yyyy")}
                {season.endDate ? ` — ${format(new Date(season.endDate), "MMM d, yyyy")}` : " — Present"}
              </div>
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" />
                {matches.length > 0 ? matches.length : (season.totalMatches ?? 0)} matches
              </div>
            </div>
          </div>

          {season.championName && (
            <div
              className="pdc-card p-4 flex items-center gap-4 min-w-[220px]"
              style={{ borderColor: "rgba(255,210,74,0.25)", background: "rgba(255,210,74,0.04)" }}
            >
              <div className="p-2 rounded" style={{ background: "rgba(255,210,74,0.12)" }}>
                <Trophy className="w-7 h-7" style={{ color: "#ffd24a" }} />
              </div>
              <div>
                <div className="text-xs uppercase font-bold tracking-wider" style={{ color: "rgba(255,210,74,0.5)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                  Champion
                </div>
                <div className="text-xl font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a" }}>
                  {season.championName}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Card — only for completed seasons */}
      {!season.isActive && standings && standings.length > 0 && (() => {
        const sorted = [...standings];
        const mostWins    = [...sorted].sort((a, b) => (b.wins  ?? 0) - (a.wins  ?? 0))[0];
        const highestElo  = [...sorted].sort((a, b) => (b.elo   ?? 0) - (a.elo   ?? 0))[0];
        const mostPoints  = [...sorted].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
        const totalMatches = sorted.reduce((s, e) => s + (e.wins ?? 0), 0);
        const winPct = mostWins ? Math.round(((mostWins.wins ?? 0) / Math.max((mostWins.wins ?? 0) + (mostWins.losses ?? 0), 1)) * 100) : 0;

        const stats = [
          { icon: <Flame className="w-4 h-4" />, color: "#ff005c", label: "Season Dominator", value: mostWins?.playerName ?? "—", sub: `${mostWins?.wins ?? 0}W–${mostWins?.losses ?? 0}L · ${winPct}% win rate` },
          { icon: <Zap className="w-4 h-4" />,   color: "#0066ff", label: "Peak Elo",          value: `${highestElo?.elo ?? 0}`,    sub: highestElo?.playerName ?? "—" },
          { icon: <Crown className="w-4 h-4" />, color: "#ffd24a", label: "Points Leader",     value: `${mostPoints?.points ?? 0}`, sub: mostPoints?.playerName ?? "—" },
          { icon: <BarChart3 className="w-4 h-4" />, color: "#4ade80", label: "Total Matches",  value: totalMatches,                  sub: `${sorted.length} players` },
        ];

        return (
          <div className="pdc-card p-5" style={{ borderColor: "rgba(255,210,74,0.12)", background: "rgba(255,210,74,0.02)" }}>
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4" style={{ color: "#ffd24a" }} />
              <h2 className="font-bold uppercase tracking-wider text-sm" style={{ fontFamily: "Oswald, sans-serif", color: "#ffd24a", letterSpacing: "0.14em" }}>
                Season Report Card
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.map(s => (
                <div key={s.label} className="rounded-xl px-4 py-3"
                  style={{ background: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <span style={{ color: s.color }}>{s.icon}</span>
                    <span className="text-xs uppercase tracking-widest font-bold"
                      style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.3)", fontSize: "0.55rem", letterSpacing: "0.16em" }}>
                      {s.label}
                    </span>
                  </div>
                  <div className="font-black leading-none mb-0.5"
                    style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.5rem", color: s.color, textShadow: `0 0 16px ${s.color}55` }}>
                    {s.value}
                  </div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {(["standings", "matches", "doubles", ...(shiftWarsEnabled ? ["shiftwars" as const] : [])] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 px-4 rounded-lg text-sm font-bold uppercase tracking-wider transition-all"
            style={{
              fontFamily: "Oswald, sans-serif",
              background: activeTab === tab ? "#ff005c" : "transparent",
              color: activeTab === tab ? "#fff" : "rgba(255,255,255,0.4)",
              letterSpacing: "0.08em",
            }}
          >
            {tab === "standings" ? "Standings" : tab === "matches" ? `Matches${matches.length > 0 ? ` (${matches.length})` : ""}` : tab === "doubles" ? "Doubles" : "Shift Wars"}
          </button>
        ))}
      </div>

      {/* Standings tab */}
      {activeTab === "standings" && (
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <Medal className="w-4 h-4" style={{ color: "#ff005c" }} />
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              {season.isActive ? "Current Standings" : "Final Standings"}
            </h2>
          </div>

          <div
            className="grid text-xs uppercase font-bold px-4 py-2 border-b"
            style={{ gridTemplateColumns: "3rem 1fr 7rem 5rem 5rem 5rem", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}
          >
            <div className="text-center">#</div>
            <div>Player</div>
            <div className="text-center">Tier</div>
            <div className="text-center">Record</div>
            <div className="text-right">Elo</div>
            <div className="text-right">Points</div>
          </div>

          {standings?.map((entry, idx) => (
            <div
              key={entry.playerId}
              className="grid items-center px-4 py-3 border-b transition-colors hover:bg-white/[0.025]"
              style={{
                gridTemplateColumns: "3rem 1fr 7rem 5rem 5rem 5rem",
                borderColor: "rgba(255,255,255,0.05)",
                background: idx === 0 ? "rgba(255,210,74,0.04)" : undefined,
              }}
            >
              <div className="text-center">
                <span className="font-bold text-xl leading-none" style={{ fontFamily: "Oswald, sans-serif", color: posColors[idx] ?? "rgba(255,255,255,0.4)" }}>
                  {entry.position}
                </span>
                {(entry as any).isChampion && <div className="text-xs" style={{ color: "#ffd24a" }}>🏆</div>}
              </div>

              <div className="min-w-0 pr-2">
                <Link href={`/players/${entry.playerId}`} className="font-bold text-base hover:underline truncate block" style={{ fontFamily: "Oswald, sans-serif", color: idx === 0 ? "#ffd24a" : "rgba(255,255,255,0.85)" }}>
                  {entry.playerName}
                </Link>
                {(entry as any).playerNickname && (
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>"{(entry as any).playerNickname}"</div>
                )}
              </div>

              <div className="flex justify-center">
                <TierBadge tier={entry.tier} />
              </div>

              <div className="text-center text-sm font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                <span style={{ color: "#22c55e" }}>{entry.wins}</span>
                <span style={{ color: "rgba(255,255,255,0.25)" }}>-</span>
                <span style={{ color: "#ff005c" }}>{entry.losses}</span>
              </div>

              <div className="text-right font-mono text-sm tabular-nums" style={{ color: "#0066ff" }}>
                {entry.elo}
              </div>

              <div className="text-right">
                <span className="font-bold text-lg" style={{ fontFamily: "Oswald, sans-serif", color: idx === 0 ? "#ffd24a" : "#ff005c" }}>
                  {entry.points}
                </span>
                <span className="text-xs ml-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
              </div>
            </div>
          ))}

          {(!standings || standings.length === 0) && (
            <div className="px-4 py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No standings data yet.
            </div>
          )}
        </div>
      )}

      {/* Matches tab */}
      {activeTab === "matches" && (
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <Swords className="w-4 h-4" style={{ color: "#ff005c" }} />
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              All Matches
            </h2>
          </div>

          {matchesLoading ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
            </div>
          ) : matches.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No matches recorded yet.</div>
          ) : (
            <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              {matches.map((m: any) => (
                <div key={m.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                  <div className="shrink-0 w-14 text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {format(new Date(m.playedAt), "dd MMM")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Link href={`/players/${m.winnerId}`}>
                        <span className="font-bold hover:underline" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e" }}>
                          {m.winnerName}
                        </span>
                      </Link>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>beat</span>
                      <Link href={`/players/${m.loserId}`}>
                        <span className="font-bold hover:underline" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.5)" }}>
                          {m.loserName}
                        </span>
                      </Link>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {m.gameType}
                      {m.winnerDarts && ` · ${m.winnerDarts} darts`}
                      {m.winner180s > 0 && ` · ${m.winner180s}×180`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xs font-bold font-mono" style={{ color: "#ffd24a" }}>±{m.eloChange}</div>
                    {m.stake > 0 && (
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{m.stake}pts</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Doubles tab */}
      {activeTab === "doubles" && (
        <div className="space-y-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {(["standings", "matches"] as const).map(v => (
              <button
                key={v}
                onClick={() => setDoublesView(v)}
                className="flex-1 py-1.5 px-4 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                style={{
                  fontFamily: "Oswald, sans-serif",
                  background: doublesView === v ? "#0066ff" : "transparent",
                  color: doublesView === v ? "#fff" : "rgba(255,255,255,0.4)",
                  letterSpacing: "0.08em",
                }}
              >
                {v === "standings" ? "Team Standings" : `Match Log${doublesMatches.length > 0 ? ` (${doublesMatches.length})` : ""}`}
              </button>
            ))}
          </div>

          {doublesView === "standings" && (
            <div className="pdc-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <Users className="w-4 h-4" style={{ color: "#0066ff" }} />
                <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  Doubles Standings
                </h2>
              </div>

              {doublesTeamsLoading ? (
                <div className="py-10 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#0066ff" }} />
                </div>
              ) : doublesTeams.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                  No doubles teams yet — an admin needs to run the random draw for the current Doubles Event season.
                </div>
              ) : (
                <>
                  <div
                    className="grid text-xs uppercase font-bold px-4 py-2 border-b"
                    style={{ gridTemplateColumns: "3rem 1fr 7rem 5rem 5rem 5rem", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}
                  >
                    <div className="text-center">#</div>
                    <div>Team</div>
                    <div className="text-center">Tier</div>
                    <div className="text-center">Record</div>
                    <div className="text-right">Elo</div>
                    <div className="text-right">Points</div>
                  </div>
                  {doublesTeams.map((team: any, idx: number) => (
                    <div
                      key={team.id}
                      className="grid items-center px-4 py-3 border-b transition-colors hover:bg-white/[0.025]"
                      style={{
                        gridTemplateColumns: "3rem 1fr 7rem 5rem 5rem 5rem",
                        borderColor: "rgba(255,255,255,0.05)",
                        background: idx === 0 && !team.isEliminated ? "rgba(0,102,255,0.05)" : undefined,
                        opacity: team.isEliminated ? 0.5 : 1,
                      }}
                    >
                      <div className="text-center">
                        <span className="font-bold text-xl leading-none" style={{ fontFamily: "Oswald, sans-serif", color: posColors[idx] ?? "rgba(255,255,255,0.4)" }}>
                          {team.position}
                        </span>
                        {team.isEliminated && <div className="flex justify-center mt-0.5"><Skull className="w-3 h-3" style={{ color: "rgba(255,255,255,0.3)" }} /></div>}
                      </div>
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-base truncate" style={{ fontFamily: "Oswald, sans-serif", color: idx === 0 ? "#0066ff" : "rgba(255,255,255,0.85)" }}>
                          {team.players.map((p: any, i: number) => (
                            <span key={p.id}>
                              {i > 0 && <span style={{ color: "rgba(255,255,255,0.25)" }}> & </span>}
                              <Link href={`/players/${p.id}`} className="hover:underline">{p.name}</Link>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-center">
                        <TierBadge tier={team.tier} />
                      </div>
                      <div className="text-center text-sm font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                        <span style={{ color: "#22c55e" }}>{team.wins}</span>
                        <span style={{ color: "rgba(255,255,255,0.25)" }}>-</span>
                        <span style={{ color: "#ff005c" }}>{team.losses}</span>
                      </div>
                      <div className="text-right font-mono text-sm tabular-nums" style={{ color: "#0066ff" }}>
                        {team.elo}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-lg" style={{ fontFamily: "Oswald, sans-serif", color: idx === 0 ? "#0066ff" : "#ff005c" }}>
                          {team.points}
                        </span>
                        <span className="text-xs ml-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {doublesView === "matches" && (
            <div className="pdc-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <Swords className="w-4 h-4" style={{ color: "#0066ff" }} />
                <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  Doubles Matches
                </h2>
              </div>

              {doublesMatchesLoading ? (
                <div className="py-10 flex justify-center">
                  <div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#0066ff" }} />
                </div>
              ) : doublesMatches.length === 0 ? (
                <div className="py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No doubles matches recorded yet.</div>
              ) : (
                <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  {doublesMatches.map((m: any) => (
                    <div key={m.id} className="px-4 py-3 flex items-center gap-3 hover:bg-white/[0.02] transition-colors">
                      <div className="shrink-0 w-14 text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {format(new Date(m.playedAt), "dd MMM")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <span className="font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#22c55e" }}>{m.winnerTeamName}</span>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>beat</span>
                          <span className="font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.5)" }}>{m.loserTeamName}</span>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{m.gameType}</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-bold font-mono" style={{ color: "#ffd24a" }}>±{m.eloChange}</div>
                        {m.stake > 0 && (
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{m.stake}pts</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Shift Wars tab */}
      {activeTab === "shiftwars" && (
        <div className="pdc-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <Building2 className="w-4 h-4" style={{ color: "#22c55e" }} />
            <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
              Shift Wars Standings
            </h2>
            {shiftWarsIsLive && (
              <span className="text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded ml-auto"
                style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", fontFamily: "Oswald, sans-serif", border: "1px solid rgba(34,197,94,0.3)" }}>
                Live
              </span>
            )}
          </div>

          {shiftWarsLoading ? (
            <div className="py-10 flex justify-center">
              <div className="w-6 h-6 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#22c55e" }} />
            </div>
          ) : shiftWarsRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No Shift Wars data yet.
            </div>
          ) : (
            <>
              <div
                className="grid text-xs uppercase font-bold px-4 py-2 border-b"
                style={{ gridTemplateColumns: "3rem 1fr 5rem 5rem", borderColor: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif" }}
              >
                <div className="text-center">#</div>
                <div>Team</div>
                <div className="text-center">Record</div>
                <div className="text-right">Points</div>
              </div>
              {shiftWarsRows.map((team: any, idx: number) => (
                <div
                  key={team.teamId ?? team.id}
                  className="grid items-center px-4 py-3 border-b transition-colors hover:bg-white/[0.025]"
                  style={{
                    gridTemplateColumns: "3rem 1fr 5rem 5rem",
                    borderColor: "rgba(255,255,255,0.05)",
                    background: idx === 0 ? "rgba(34,197,94,0.05)" : undefined,
                  }}
                >
                  <div className="text-center">
                    <span className="font-bold text-xl leading-none" style={{ fontFamily: "Oswald, sans-serif", color: posColors[idx] ?? "rgba(255,255,255,0.4)" }}>
                      {team.position}
                    </span>
                    {team.isChampion && <div className="text-xs" style={{ color: "#ffd24a" }}>🏆</div>}
                  </div>
                  <div className="min-w-0 pr-2">
                    <div className="font-bold text-base truncate" style={{ fontFamily: "Oswald, sans-serif", color: idx === 0 ? "#22c55e" : "rgba(255,255,255,0.85)" }}>
                      {team.teamName ?? team.name}
                    </div>
                    {Array.isArray(team.players) && team.players.length > 0 && (
                      <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {team.players.map((p: any) => p.name).join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="text-center text-sm font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                    <span style={{ color: "#22c55e" }}>{team.wins}</span>
                    <span style={{ color: "rgba(255,255,255,0.25)" }}>-</span>
                    <span style={{ color: "#ff005c" }}>{team.losses}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-lg" style={{ fontFamily: "Oswald, sans-serif", color: idx === 0 ? "#22c55e" : "#ff005c" }}>
                      {team.points}
                    </span>
                    <span className="text-xs ml-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>pts</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
