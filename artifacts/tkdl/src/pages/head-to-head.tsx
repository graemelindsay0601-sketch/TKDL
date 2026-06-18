import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { ArrowLeft, Swords, TrendingUp, Target, Flame, Trophy } from "lucide-react";
import { TierBadge } from "@/components/tier-badge";
import { format } from "date-fns";

type Player = { id: number; name: string; elo: number; tier: string; wins: number; currentStreak: number };
type H2HMatch = {
  id: number; playedAt: string; winnerId: number; winnerName: string;
  loserId: number; loserName: string; eloChange: number; stake: number;
  gameType: string; seasonName: string;
  winnerDarts: number | null; winner180s: number | null;
  loserDarts: number | null; loser180s: number | null;
};
type H2HData = { player1: Player; player2: Player; totalMatches: number; recentMatches: H2HMatch[] };
type PlayerOption = { id: number; name: string };

function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!url) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [url]);
  return { data, loading };
}

function WinBar({ p1Wins, p2Wins, p1Name, p2Name }: { p1Wins: number; p2Wins: number; p1Name: string; p2Name: string }) {
  const total = p1Wins + p2Wins;
  if (total === 0) return null;
  const p1Pct = Math.round((p1Wins / total) * 100);
  const p2Pct = 100 - p1Pct;
  return (
    <div className="space-y-2">
      <div className="flex h-4 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        {p1Wins > 0 && (
          <div className="transition-all duration-500" style={{ width: `${p1Pct}%`, background: "#ff005c" }} />
        )}
        {p2Wins > 0 && (
          <div className="transition-all duration-500" style={{ width: `${p2Pct}%`, background: "#0066ff" }} />
        )}
      </div>
      <div className="flex justify-between text-xs font-bold" style={{ fontFamily: "Share Tech Mono, monospace" }}>
        <span style={{ color: "#ff005c" }}>{p1Pct}% {p1Name}</span>
        <span style={{ color: "#0066ff" }}>{p2Name} {p2Pct}%</span>
      </div>
    </div>
  );
}

function FormDots({ matches, forPlayerId, limit = 10 }: { matches: H2HMatch[]; forPlayerId: number; limit?: number }) {
  const recent = matches.slice(0, limit);
  return (
    <div className="flex gap-1">
      {recent.map(m => (
        <div
          key={m.id}
          className="w-3 h-3 rounded-full"
          title={m.winnerId === forPlayerId ? "W" : "L"}
          style={{ background: m.winnerId === forPlayerId ? "#22c55e" : "#ff005c" }}
        />
      ))}
      {recent.length === 0 && <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No matches</span>}
    </div>
  );
}

export default function HeadToHead() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [p1Id, setP1Id] = useState(params.get("p1") ? Number(params.get("p1")) : 0);
  const [p2Id, setP2Id] = useState(params.get("p2") ? Number(params.get("p2")) : 0);

  const { data: players } = useFetch<PlayerOption[]>("/api/players");
  const h2hUrl = p1Id && p2Id && p1Id !== p2Id ? `/api/stats/h2h?p1=${p1Id}&p2=${p2Id}` : null;
  const { data: h2h, loading } = useFetch<H2HData>(h2hUrl);

  const activePlayers = players?.filter((p: any) => p.isActive !== false) ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="pdc-divider" />
      <Link href="/leaderboard" className="flex items-center gap-1 text-xs hover:underline" style={{ color: "rgba(255,255,255,0.35)" }}>
        <ArrowLeft className="w-3 h-3" /> Back
      </Link>

      <div className="flex items-center gap-3">
        <Swords className="w-5 h-5" style={{ color: "#ff005c" }} />
        <h1 className="text-3xl font-black uppercase" style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em" }}>
          Head to Head
        </h1>
      </div>

      {/* Player pickers */}
      <div className="pdc-card p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div>
            <label className="text-xs uppercase font-bold tracking-widest mb-1 block" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>Player 1</label>
            <select
              value={p1Id}
              onChange={e => setP1Id(Number(e.target.value))}
              className="w-full rounded-lg px-3 py-2 text-sm font-bold"
              style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.25)", color: "#fff", fontFamily: "Oswald, sans-serif" }}
            >
              <option value={0}>Select player…</option>
              {activePlayers.map((p: PlayerOption) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="text-2xl font-black text-center pt-5" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.2)" }}>VS</div>
          <div>
            <label className="text-xs uppercase font-bold tracking-widest mb-1 block" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>Player 2</label>
            <select
              value={p2Id}
              onChange={e => setP2Id(Number(e.target.value))}
              className="w-full rounded-lg px-3 py-2 text-sm font-bold"
              style={{ background: "rgba(0,102,255,0.08)", border: "1px solid rgba(0,102,255,0.25)", color: "#fff", fontFamily: "Oswald, sans-serif" }}
            >
              <option value={0}>Select player…</option>
              {activePlayers.filter((p: PlayerOption) => p.id !== p1Id).map((p: PlayerOption) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ff005c" }} />
        </div>
      )}

      {/* No match yet */}
      {!loading && p1Id && p2Id && !h2h && (
        <div className="text-center py-10 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No data available.</div>
      )}

      {h2h && (
        <>
          {/* Head-to-head scoreboard */}
          <div className="pdc-card overflow-hidden">
            <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #ff005c, #0066ff)" }} />
            <div className="px-6 py-5">
              {/* Players row */}
              <div className="grid grid-cols-3 gap-4 items-center mb-6">
                {/* P1 */}
                <div className="text-left">
                  <Link href={`/players/${h2h.player1.id}`}>
                    <div className="font-black uppercase text-xl leading-tight hover:opacity-70 transition-opacity"
                      style={{ fontFamily: "Oswald, sans-serif", color: "#ff005c", letterSpacing: "0.06em" }}>
                      {h2h.player1.name}
                    </div>
                  </Link>
                  <TierBadge tier={h2h.player1.tier} />
                  <div className="text-xs mt-1 font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {h2h.player1.elo} ELO
                  </div>
                </div>

                {/* Score */}
                <div className="text-center">
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-black leading-none"
                      style={{ fontFamily: "Oswald, sans-serif", fontSize: "3.5rem", color: h2h.player1.wins >= h2h.player2.wins ? "#ff005c" : "rgba(255,0,92,0.4)" }}>
                      {h2h.player1.wins}
                    </span>
                    <span className="font-black text-xl" style={{ color: "rgba(255,255,255,0.2)" }}>–</span>
                    <span className="font-black leading-none"
                      style={{ fontFamily: "Oswald, sans-serif", fontSize: "3.5rem", color: h2h.player2.wins >= h2h.player1.wins ? "#0066ff" : "rgba(0,102,255,0.4)" }}>
                      {h2h.player2.wins}
                    </span>
                  </div>
                  <div className="text-xs mt-1 font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)", fontFamily: "Oswald, sans-serif" }}>
                    {h2h.totalMatches} matches
                  </div>
                </div>

                {/* P2 */}
                <div className="text-right">
                  <Link href={`/players/${h2h.player2.id}`}>
                    <div className="font-black uppercase text-xl leading-tight hover:opacity-70 transition-opacity"
                      style={{ fontFamily: "Oswald, sans-serif", color: "#0066ff", letterSpacing: "0.06em" }}>
                      {h2h.player2.name}
                    </div>
                  </Link>
                  <div className="flex justify-end">
                    <TierBadge tier={h2h.player2.tier} />
                  </div>
                  <div className="text-xs mt-1 font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {h2h.player2.elo} ELO
                  </div>
                </div>
              </div>

              {/* Win bar */}
              <WinBar p1Wins={h2h.player1.wins} p2Wins={h2h.player2.wins} p1Name={h2h.player1.name} p2Name={h2h.player2.name} />

              {/* Form */}
              {h2h.totalMatches > 0 && (
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs uppercase font-bold tracking-widest mb-1.5" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>
                      {h2h.player1.name} — Recent Form
                    </div>
                    <FormDots matches={h2h.recentMatches} forPlayerId={h2h.player1.id} />
                  </div>
                  <div className="text-right">
                    <div className="text-xs uppercase font-bold tracking-widest mb-1.5 text-right" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.55rem" }}>
                      {h2h.player2.name} — Recent Form
                    </div>
                    <div className="flex gap-1 justify-end">
                      {h2h.recentMatches.slice(0, 10).map(m => (
                        <div key={m.id} className="w-3 h-3 rounded-full" title={m.winnerId === h2h.player2.id ? "W" : "L"}
                          style={{ background: m.winnerId === h2h.player2.id ? "#22c55e" : "#ff005c" }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Streaks */}
              {(h2h.player1.currentStreak > 0 || h2h.player2.currentStreak > 0) && (
                <div className="mt-4 flex gap-3 flex-wrap">
                  {h2h.player1.currentStreak > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(255,0,92,0.08)", border: "1px solid rgba(255,0,92,0.2)" }}>
                      <Flame className="w-3 h-3" style={{ color: "#ff005c" }} />
                      <span className="text-xs font-bold" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                        {h2h.player1.name} on {h2h.player1.currentStreak}-win run
                      </span>
                    </div>
                  )}
                  {h2h.player2.currentStreak > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(0,102,255,0.08)", border: "1px solid rgba(0,102,255,0.2)" }}>
                      <Flame className="w-3 h-3" style={{ color: "#0066ff" }} />
                      <span className="text-xs font-bold" style={{ color: "#0066ff", fontFamily: "Oswald, sans-serif" }}>
                        {h2h.player2.name} on {h2h.player2.currentStreak}-win run
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Stat comparison */}
          <div className="pdc-card overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
              <TrendingUp className="w-4 h-4" style={{ color: "#ffd24a" }} />
              <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                Career Comparison
              </h2>
            </div>
            <div className="px-4 py-4 space-y-4">
              {[
                { label: "Current Elo", v1: h2h.player1.elo, v2: h2h.player2.elo, suffix: "" },
              ].map(row => {
                const winner = row.v1 > row.v2 ? 1 : row.v2 > row.v1 ? 2 : 0;
                return (
                  <div key={row.label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-black tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", color: winner === 1 ? "#ff005c" : "rgba(255,0,92,0.45)" }}>
                        {row.v1}{row.suffix}
                      </span>
                      <span className="text-xs uppercase font-bold tracking-widest" style={{ color: "rgba(255,255,255,0.3)", fontFamily: "Oswald, sans-serif", fontSize: "0.6rem" }}>
                        {row.label}
                      </span>
                      <span className="font-black tabular-nums" style={{ fontFamily: "Oswald, sans-serif", fontSize: "1.1rem", color: winner === 2 ? "#0066ff" : "rgba(0,102,255,0.45)" }}>
                        {row.v2}{row.suffix}
                      </span>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div style={{ width: `${(row.v1 / (row.v1 + row.v2)) * 100}%`, background: "#ff005c", opacity: winner === 1 ? 1 : 0.3 }} />
                      <div style={{ flex: 1, background: "#0066ff", opacity: winner === 2 ? 1 : 0.3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Match history */}
          {h2h.recentMatches.length > 0 && (
            <div className="pdc-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                <Trophy className="w-4 h-4" style={{ color: "#ff005c" }} />
                <h2 className="font-bold uppercase text-sm tracking-wider" style={{ fontFamily: "Oswald, sans-serif", color: "rgba(255,255,255,0.7)" }}>
                  Match History
                </h2>
              </div>
              <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                {h2h.recentMatches.map(m => {
                  const isP1Win = m.winnerId === h2h.player1.id;
                  return (
                    <div key={m.id} className="px-4 py-3 flex items-center gap-4">
                      <div className="shrink-0 w-16 text-xs font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {format(new Date(m.playedAt), "dd MMM")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-bold" style={{ fontFamily: "Oswald, sans-serif" }}>
                          <span style={{ color: isP1Win ? "#ff005c" : "rgba(255,0,92,0.4)" }}>{m.winnerName}</span>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>beat</span>
                          <span style={{ color: !isP1Win ? "#0066ff" : "rgba(0,102,255,0.4)" }}>{m.loserName}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{m.gameType}</span>
                          {m.seasonName && <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>· {m.seasonName}</span>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-bold" style={{ color: "#ffd24a", fontFamily: "Share Tech Mono, monospace" }}>
                          ±{m.eloChange}
                        </div>
                        {m.stake > 0 && (
                          <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>{m.stake}pts</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {h2h.totalMatches === 0 && (
            <div className="pdc-card p-8 text-center">
              <Target className="w-8 h-8 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
              <div className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)", fontFamily: "Oswald, sans-serif" }}>
                These two have never faced each other
              </div>
              <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                Submit a match to start this rivalry!
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
