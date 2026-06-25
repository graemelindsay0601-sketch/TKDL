import React, { useState, useEffect, useCallback } from "react";
import { useCurrentPlayer } from "@/context/auth";
import { CardShopUI } from "@/components/CardShopUI";
import { CardCollectionBook } from "@/components/CardCollectionBook";
import { CoinBalance } from "@/components/CoinBalance";
import { CardClashMatchLauncher } from "@/components/CardClashMatchLauncher";
import { PlayerChallenges } from "@/components/PlayerChallenges";

type Tab = "overview" | "shop" | "collection" | "play" | "standings" | "mock";

interface Stats {
  coins: number;
  cardsOwned: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
}

interface Standing {
  player_id: number;
  player_name: string;
  wins: number;
  losses: number;
  total_matches: number;
  points: number;
}

interface Player {
  id: number;
  name: string;
}

export default function CardClashPage() {
  const currentPlayer = useCurrentPlayer();
  const playerId = currentPlayer?.playerId;

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [standingsLoading, setStandingsLoading] = useState(false);

  // Mock game state
  const [mockPlayers, setMockPlayers] = useState<Player[]>([]);
  const [mockOpponentType, setMockOpponentType] = useState<"bot" | "player">("bot");
  const [mockOpponentId, setMockOpponentId] = useState<number | null>(null);
  const [mockStarted, setMockStarted] = useState(false);
  const [mockMatch, setMockMatch] = useState<any>(null);
  const [mockLoading, setMockLoading] = useState(false);

  const loadStats = useCallback(async () => {
    if (!playerId) return;
    try {
      const r = await fetch(`/api/card-clash/player/${playerId}/stats`);
      if (r.ok) setStats(await r.json());
    } catch {}
  }, [playerId]);

  const loadStandings = useCallback(async () => {
    setStandingsLoading(true);
    try {
      const r = await fetch("/api/card-clash/standings");
      if (r.ok) setStandings(await r.json());
    } catch {} finally {
      setStandingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!playerId) return;
    setLoading(true);
    Promise.all([loadStats(), loadStandings()]).finally(() => setLoading(false));
  }, [playerId, loadStats, loadStandings]);

  // Load players for mock game
  useEffect(() => {
    if (activeTab !== "mock") return;
    fetch("/api/card-clash/mock-game/players")
      .then(r => r.ok ? r.json() : [])
      .then((p: Player[]) => setMockPlayers(p.filter(pl => pl.id !== playerId)))
      .catch(() => {});
  }, [activeTab, playerId]);

  const handleMockStart = async () => {
    if (!playerId) return;
    setMockLoading(true);
    try {
      const r = await fetch("/api/card-clash/mock-game/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          player1Id: playerId,
          player2Id: mockOpponentType === "player" ? mockOpponentId : null,
          isBotOpponent: mockOpponentType === "bot",
          player1Cards: [],
        }),
      });
      if (r.ok) {
        const data = await r.json();
        setMockMatch(data);
        setMockStarted(true);
      }
    } catch {} finally {
      setMockLoading(false);
    }
  };

  const handleMockFinish = async (winnerId: number) => {
    if (!mockMatch?.match?.id) return;
    await fetch("/api/card-clash/match/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: mockMatch.match.id, winnerId, cardsUsedInMatch: [] }),
    }).catch(() => {});
    setMockStarted(false);
    setMockMatch(null);
    setMockOpponentId(null);
  };

  if (!currentPlayer || !playerId) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: "1rem" }}>
          Authentication issue — please log out and back in
        </div>
        <button onClick={() => (window.location.href = "/login")} style={btnStyle("#ffd24a", "#000")}>
          Go to Login
        </button>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "📊 Overview" },
    { id: "shop", label: "🛍️ Shop" },
    { id: "collection", label: "📚 Collection" },
    { id: "play", label: "⚡ Play" },
    { id: "standings", label: "🏆 Standings" },
    { id: "mock", label: "🎲 Mock Game" },
  ];

  const winRate = stats && stats.matchesPlayed > 0
    ? Math.round((stats.wins / stats.matchesPlayed) * 100)
    : 0;

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, rgba(255,212,74,0.15), rgba(0,229,255,0.15))",
        borderRadius: "16px", padding: "2.5rem 2rem", marginBottom: "2rem",
        border: "2px solid rgba(255,212,74,0.3)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "48px" }}>🎴</div>
          <div>
            <h1 style={{ fontSize: "32px", fontWeight: "700", margin: 0, color: "#ffd24a" }}>Card Clash</h1>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>
              Collect cards, challenge rivals, climb the all-time leaderboard
            </p>
          </div>
        </div>
        {loading ? (
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px" }}>Loading stats...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
            <StatBox title="Coins" value={stats?.coins ?? 0} color="#ffd24a" />
            <StatBox title="Cards Owned" value={stats?.cardsOwned ?? 0} color="#00e5ff" />
            <StatBox title="Matches" value={stats?.matchesPlayed ?? 0} color="#ff6b6b" />
            <StatBox title="Wins" value={stats?.wins ?? 0} color="#00ff88" />
            <StatBox title="Losses" value={stats?.losses ?? 0} color="#ff6b6b" />
            <StatBox title="Win Rate" value={`${winRate}%`} color="#c084fc" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "2rem", borderBottom: "2px solid rgba(255,255,255,0.1)", overflowX: "auto" }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: "12px 18px",
            background: activeTab === tab.id ? "rgba(255,212,74,0.2)" : "transparent",
            border: activeTab === tab.id ? "2px solid #ffd24a" : "2px solid transparent",
            color: activeTab === tab.id ? "#ffd24a" : "rgba(255,255,255,0.6)",
            borderRadius: "8px 8px 0 0", cursor: "pointer", fontSize: "13px",
            fontWeight: "600", whiteSpace: "nowrap", transition: "all 0.2s",
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px", padding: "2rem", border: "1px solid rgba(255,255,255,0.1)" }}>

        {/* Overview */}
        {activeTab === "overview" && (
          <div style={{ display: "grid", gap: "2rem" }}>
            <div>
              <h2 style={h2}>Welcome to Card Clash</h2>
              <div style={infoBox}>
                <p>🎴 <strong>Collect Cards</strong> — Buy card packs in the Shop to build your collection</p>
                <p>⚡ <strong>Equip &amp; Play</strong> — Select up to 4 cards before each match for tactical effects</p>
                <p>🏆 <strong>Win &amp; Climb</strong> — Defeats earn coins and push you up the all-time leaderboard</p>
                <p>🎲 <strong>Mock Game</strong> — Try any cards freely against bots or friends with no real stakes</p>
              </div>
            </div>
            <div>
              <h2 style={h2}>Your Progress</h2>
              <CoinBalance playerId={playerId} />
              <div style={{ marginTop: "1rem" }}>
                <PlayerChallenges playerId={playerId} />
              </div>
            </div>
          </div>
        )}

        {/* Shop */}
        {activeTab === "shop" && (
          <div>
            <h2 style={h2}>Card Shop</h2>
            <CardShopUI playerId={playerId} />
          </div>
        )}

        {/* Collection */}
        {activeTab === "collection" && (
          <div>
            <h2 style={h2}>Your Collection</h2>
            <CardCollectionBook playerId={playerId} />
          </div>
        )}

        {/* Play */}
        {activeTab === "play" && (
          <div>
            <h2 style={h2}>Play Card Clash</h2>
            <CardClashMatchLauncher
              currentPlayerId={playerId}
              currentPlayerName={(currentPlayer as any)?.name || (currentPlayer as any)?.playerName || "Player"}
              onMatchComplete={() => {
                setActiveTab("overview");
                loadStats();
              }}
            />
          </div>
        )}

        {/* Standings */}
        {activeTab === "standings" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ ...h2, margin: 0 }}>All-Time Standings</h2>
              <button onClick={loadStandings} style={btnStyle("rgba(255,255,255,0.1)", "#fff")} disabled={standingsLoading}>
                {standingsLoading ? "Refreshing..." : "↻ Refresh"}
              </button>
            </div>
            {standingsLoading ? (
              <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "2rem" }}>Loading standings...</div>
            ) : standings.length > 0 ? (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid rgba(255,212,74,0.3)" }}>
                      {["Rank", "Player", "W", "L", "Played", "Points"].map(h => (
                        <th key={h} style={{ padding: "12px", textAlign: h === "Player" || h === "Rank" ? "left" : "center", color: "#ffd24a", fontWeight: "600" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((row, idx) => (
                      <tr key={row.player_id} style={{
                        borderBottom: "1px solid rgba(255,255,255,0.07)",
                        background: row.player_id === playerId ? "rgba(255,212,74,0.08)" : "transparent",
                      }}>
                        <td style={{ padding: "12px", color: "#ffd24a", fontWeight: "700" }}>
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                        </td>
                        <td style={{ padding: "12px", color: row.player_id === playerId ? "#ffd24a" : "#fff", fontWeight: row.player_id === playerId ? "600" : "400" }}>
                          {row.player_name} {row.player_id === playerId ? "(you)" : ""}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center", color: "#00ff88", fontWeight: "600" }}>{row.wins}</td>
                        <td style={{ padding: "12px", textAlign: "center", color: "#ff6b6b" }}>{row.losses}</td>
                        <td style={{ padding: "12px", textAlign: "center", color: "rgba(255,255,255,0.6)" }}>{row.total_matches}</td>
                        <td style={{ padding: "12px", textAlign: "center", color: "#00e5ff", fontWeight: "600" }}>{row.points ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "3rem" }}>
                <div style={{ fontSize: "48px", marginBottom: "1rem" }}>🏆</div>
                <div>No matches yet — play some Card Clash games to appear here!</div>
              </div>
            )}
          </div>
        )}

        {/* Mock Game */}
        {activeTab === "mock" && (
          <div>
            <h2 style={h2}>🎲 Mock Game</h2>
            <div style={{ ...infoBox, marginBottom: "1.5rem" }}>
              <strong>Practice mode:</strong> Try any cards for free — no coins spent, no cards consumed. Great for testing strategies or having a casual game.
            </div>

            {!mockStarted ? (
              <div style={{ display: "grid", gap: "1.5rem", maxWidth: "500px" }}>
                <div>
                  <label style={labelStyle}>Opponent type</label>
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                    {(["bot", "player"] as const).map(t => (
                      <button key={t} onClick={() => setMockOpponentType(t)} style={{
                        padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: "600",
                        background: mockOpponentType === t ? "#ffd24a" : "rgba(255,255,255,0.1)",
                        color: mockOpponentType === t ? "#000" : "#fff",
                        border: mockOpponentType === t ? "2px solid #ffd24a" : "2px solid rgba(255,255,255,0.2)",
                      }}>
                        {t === "bot" ? "🤖 Bot" : "👤 Player"}
                      </button>
                    ))}
                  </div>
                </div>

                {mockOpponentType === "bot" && (
                  <div style={{ ...infoBox, fontSize: "13px" }}>
                    The bot will be assigned random cards from the full catalog.
                  </div>
                )}

                {mockOpponentType === "player" && (
                  <div>
                    <label style={labelStyle}>Select opponent</label>
                    <select
                      value={mockOpponentId ?? ""}
                      onChange={e => setMockOpponentId(Number(e.target.value) || null)}
                      style={{ width: "100%", padding: "10px", borderRadius: "8px", marginTop: "8px", background: "#1a1a2e", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
                    >
                      <option value="">Choose a player...</option>
                      {mockPlayers.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={handleMockStart}
                  disabled={mockLoading || (mockOpponentType === "player" && !mockOpponentId)}
                  style={btnStyle("#ffd24a", "#000")}
                >
                  {mockLoading ? "Starting..." : "🎲 Start Mock Game"}
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "1.5rem", maxWidth: "500px" }}>
                <div style={{ background: "rgba(0,255,136,0.1)", border: "1px solid rgba(0,255,136,0.3)", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ fontSize: "16px", fontWeight: "700", color: "#00ff88", marginBottom: "8px" }}>
                    ✅ Mock Game in Progress
                  </div>
                  <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)" }}>
                    Go play your darts match, then come back and record the result below.
                  </div>
                  {mockMatch?.botCards?.length > 0 && (
                    <div style={{ marginTop: "12px", fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                      Bot cards: {mockMatch.botCards.map((c: any) => c.cardId).join(", ")}
                    </div>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Who won?</label>
                  <div style={{ display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap" }}>
                    <button onClick={() => handleMockFinish(playerId!)} style={btnStyle("#00ff88", "#000")}>
                      🏆 I Won
                    </button>
                    {mockMatch?.match?.player_2_id && mockMatch.match.player_2_id !== 0 && (
                      <button onClick={() => handleMockFinish(mockMatch.match.player_2_id)} style={btnStyle("#ff6b6b", "#fff")}>
                        😔 Opponent Won
                      </button>
                    )}
                    {(!mockMatch?.match?.player_2_id || mockMatch.match.player_2_id === 0) && (
                      <button onClick={() => handleMockFinish(0)} style={btnStyle("#ff6b6b", "#fff")}>
                        😔 Bot Won
                      </button>
                    )}
                    <button onClick={() => { setMockStarted(false); setMockMatch(null); }} style={btnStyle("rgba(255,255,255,0.1)", "#fff")}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function StatBox({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div style={{ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: "8px", padding: "14px", textAlign: "center" }}>
      <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</div>
      <div style={{ fontSize: "22px", fontWeight: "700", color }}>{value}</div>
    </div>
  );
}

const h2: React.CSSProperties = { fontSize: "18px", fontWeight: "700", marginBottom: "1rem", color: "#ffd24a" };
const infoBox: React.CSSProperties = {
  background: "rgba(255,212,74,0.08)", border: "1px solid rgba(255,212,74,0.25)",
  borderRadius: "8px", padding: "16px", fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: "1.7",
};
const labelStyle: React.CSSProperties = { fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.7)" };

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: "10px 20px", background: bg, color, border: "none",
    borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px",
  };
}
