import { useState, useEffect } from "react";
import { TrendingUp, Users, Trophy, Flame, Target, Award, BarChart3, Calendar } from "lucide-react";

interface PlayerStats {
  playerId: number;
  playerName: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  eloRating: number;
  eloChange: number;
  checkoutRate: number;
  avg180s: number;
  tier: string;
}

interface LeagueMetrics {
  totalMatches: number;
  totalPlayers: number;
  averageWinRate: number;
  topPlayer: PlayerStats;
  mostImproved: PlayerStats;
  activePlayers: number;
}

interface GameTypeStats {
  gameType: string;
  totalMatches: number;
  popularity: number;
  avgCheckoutRate: number;
  winRateStd: number;
}

export function AdvancedAnalyticsDashboard({ playerId }: { playerId?: number }) {
  const [selectedView, setSelectedView] = useState<"overview" | "leaderboard" | "trends" | "formats">("overview");
  const [metrics, setMetrics] = useState<LeagueMetrics | null>(null);
  const [playerRanking, setPlayerRanking] = useState<PlayerStats[]>([]);
  const [formatStats, setFormatStats] = useState<GameTypeStats[]>([]);
  const [monthlyTrends, setMonthlyTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        // Fetch real league data from the leaderboard API
        const leaderRes = await fetch("/api/leaderboard");
        const leaderboard = await leaderRes.json();
        
        if (leaderboard && Array.isArray(leaderboard) && leaderboard.length > 0) {
          const players = leaderboard.slice(0, 10); // Top 10 players
          
          const totalMatches = leaderboard.reduce((sum: number, p: any) => sum + (p.matchCount || 0), 0);
          const topPlayer = leaderboard[0];
          const activePlayers = leaderboard.filter((p: any) => p.matchCount > 0).length;
          
          // Create metrics from real data
          const realMetrics: LeagueMetrics = {
            totalMatches,
            totalPlayers: leaderboard.length,
            averageWinRate: 0.5,
            topPlayer: {
              playerId: topPlayer.id,
              playerName: topPlayer.name,
              matches: topPlayer.matchCount || 0,
              wins: topPlayer.wins || 0,
              losses: topPlayer.losses || 0,
              winRate: topPlayer.matchCount ? (topPlayer.wins || 0) / topPlayer.matchCount : 0,
              eloRating: topPlayer.elo || 0,
              eloChange: 0,
              checkoutRate: 0,
              avg180s: 0,
              tier: topPlayer.tier || "Unranked",
            },
            mostImproved: players[1] || topPlayer,
            activePlayers,
          };
          
          const realPlayers: PlayerStats[] = leaderboard.slice(0, 15).map((p: any, idx: number) => ({
            playerId: p.id,
            playerName: p.name,
            matches: p.matchCount || 0,
            wins: p.wins || 0,
            losses: p.losses || 0,
            winRate: p.matchCount ? (p.wins || 0) / p.matchCount : 0,
            eloRating: p.elo || 0,
            eloChange: 0,
            checkoutRate: 0,
            avg180s: 0,
            tier: p.tier || "Unranked",
          }));
          
          setMetrics(realMetrics);
          setPlayerRanking(realPlayers);
        }
      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, []);
            gameType: "Around the World",
            totalMatches: 44,
            popularity: 9.0,
            avgCheckoutRate: 0.42,
            winRateStd: 0.2,
          },
        ];

      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>Loading analytics...</div>;
  }

  const StatBox = ({ icon: Icon, label, value, unit, trend, color }: any) => (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "8px",
      padding: "16px",
      flex: "1 1 calc(25% - 12px)",
      minWidth: "200px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <Icon size={16} style={{ color }} />
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontWeight: "600" }}>{label}</span>
      </div>
      <div style={{ fontSize: "28px", fontWeight: "700", color, marginBottom: "4px" }}>
        {typeof value === "number" && !Number.isInteger(value) ? value.toFixed(1) : value}
        <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginLeft: "4px" }}>{unit}</span>
      </div>
      {trend !== undefined && (
        <div style={{ fontSize: "12px", color: trend > 0 ? "#00e5a0" : "#ff005c" }}>
          {trend > 0 ? "▲" : "▼"} {Math.abs(trend).toFixed(1)}% from last month
        </div>
      )}
    </div>
  );

  const renderOverview = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Key Metrics */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <StatBox
          icon={BarChart3}
          label="Total Matches"
          value={metrics?.totalMatches}
          unit=""
          color="#ff005c"
          trend={10.2}
        />
        <StatBox
          icon={Users}
          label="Active Players"
          value={metrics?.activePlayers}
          unit="/"
          color="#a855f7"
        />
        <StatBox
          icon={Trophy}
          label="Avg Win Rate"
          value={`${((metrics?.averageWinRate || 0) * 100).toFixed(1)}%`}
          unit=""
          color="#00e5a0"
        />
        <StatBox
          icon={Flame}
          label="Top Player Win Rate"
          value={`${((metrics?.topPlayer.winRate || 0) * 100).toFixed(1)}%`}
          unit=""
          color="#ffd24a"
        />
      </div>

      {/* Top Players */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Trophy size={16} style={{ color: "#ffd24a" }} />
          <h3 style={{ fontSize: "14px", fontWeight: "600" }}>League Leaders</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {playerRanking.slice(0, 3).map((player, idx) => (
            <div key={player.playerId} style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px",
              background: "rgba(255,255,255,0.01)",
              borderRadius: "6px",
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                background: idx === 0 ? "rgba(255,210,74,0.2)" : idx === 1 ? "rgba(200,200,200,0.2)" : "rgba(205,127,50,0.2)",
                border: `2px solid ${idx === 0 ? "#ffd24a" : idx === 1 ? "#c0c0c0" : "#cd7f32"}`,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "700",
                color: idx === 0 ? "#ffd24a" : idx === 1 ? "#c0c0c0" : "#cd7f32",
              }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "13px", fontWeight: "600" }}>{player.playerName}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                  {player.wins}W • {(player.winRate * 100).toFixed(0)}% • {player.eloRating} ELO
                </div>
              </div>
              <div style={{
                fontSize: "12px",
                fontWeight: "600",
                color: player.eloChange >= 0 ? "#00e5a0" : "#ff005c",
              }}>
                {player.eloChange >= 0 ? "+" : ""}{player.eloChange}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Format Popularity */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Target size={16} style={{ color: "#00e5a0" }} />
          <h3 style={{ fontSize: "14px", fontWeight: "600" }}>Game Format Breakdown</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {formatStats.map((format) => (
            <div key={format.gameType} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ flex: "0 0 200px", fontSize: "12px", fontWeight: "500" }}>{format.gameType}</div>
              <div style={{
                flex: 1,
                height: "24px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "4px",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  width: `${format.popularity}%`,
                  background: `linear-gradient(90deg, #ff005c, #a855f7)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: "6px",
                  fontSize: "10px",
                  color: "#fff",
                  fontWeight: "600",
                }}>
                  {format.popularity.toFixed(1)}%
                </div>
              </div>
              <div style={{ flex: "0 0 60px", fontSize: "11px", color: "rgba(255,255,255,0.5)", textAlign: "right" }}>
                {format.totalMatches} games
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderLeaderboard = () => (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            {["Rank", "Player", "Matches", "W-L", "Win %", "ELO", "Change"].map(header => (
              <th key={header} style={{
                padding: "12px 8px",
                textAlign: "left",
                fontSize: "12px",
                fontWeight: "600",
                color: "rgba(255,255,255,0.5)",
                textTransform: "uppercase",
              }}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {playerRanking.map((player, idx) => (
            <tr key={player.playerId} style={{
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              background: idx < 3 ? "rgba(255,210,74,0.05)" : undefined,
            }}>
              <td style={{ padding: "10px 8px" }}>
                <span style={{ fontSize: "14px", fontWeight: "700", color: idx === 0 ? "#ffd24a" : idx === 1 ? "#c0c0c0" : "#cd7f32" }}>
                  {idx + 1}
                </span>
              </td>
              <td style={{ padding: "10px 8px", fontSize: "13px", fontWeight: "500" }}>{player.playerName}</td>
              <td style={{ padding: "10px 8px", fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>{player.matches}</td>
              <td style={{ padding: "10px 8px", fontSize: "12px" }}>
                <span style={{ color: "#00e5a0" }}>{player.wins}W</span>
                <span style={{ color: "rgba(255,255,255,0.4)" }}> - </span>
                <span style={{ color: "#ff005c" }}>{player.losses}L</span>
              </td>
              <td style={{ padding: "10px 8px", fontSize: "12px", fontWeight: "600", color: player.winRate > 0.55 ? "#00e5a0" : "#fff" }}>
                {(player.winRate * 100).toFixed(1)}%
              </td>
              <td style={{ padding: "10px 8px", fontSize: "13px", fontWeight: "600" }}>{player.eloRating}</td>
              <td style={{ padding: "10px 8px", fontSize: "12px", fontWeight: "600", color: player.eloChange >= 0 ? "#00e5a0" : "#ff005c" }}>
                {player.eloChange >= 0 ? "+" : ""}{player.eloChange}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderTrends = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <TrendingUp size={16} style={{ color: "#a855f7" }} />
          <h3 style={{ fontSize: "14px", fontWeight: "600" }}>Monthly Trends</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {monthlyTrends.map((trend, idx) => (
            <div key={idx} style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "12px",
              background: "rgba(255,255,255,0.01)",
              borderRadius: "6px",
            }}>
              <div style={{ flex: "0 0 120px" }}>
                <div style={{ fontSize: "13px", fontWeight: "600" }}>{trend.month}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)", marginBottom: "4px" }}>
                  Matches: {trend.matches}
                </div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
                  Avg Checkout: {(trend.avgCheckout * 100).toFixed(1)}%
                </div>
              </div>
              <div style={{
                flex: "0 0 100px",
                textAlign: "right",
                fontSize: "13px",
                fontWeight: "600",
                color: "#00e5a0",
              }}>
                {(trend.topWinRate * 100).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* View Selector */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
        {(["overview", "leaderboard", "trends", "formats"] as const).map(view => (
          <button
            key={view}
            onClick={() => setSelectedView(view)}
            style={{
              padding: "8px 16px",
              fontSize: "12px",
              background: selectedView === view ? "rgba(255,0,92,0.15)" : "transparent",
              border: selectedView === view ? "1px solid rgba(255,0,92,0.3)" : "1px solid transparent",
              color: selectedView === view ? "#ff005c" : "rgba(255,255,255,0.5)",
              borderRadius: "4px",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {view === "formats" ? "Formats" : view.charAt(0).toUpperCase() + view.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      {selectedView === "overview" && renderOverview()}
      {selectedView === "leaderboard" && renderLeaderboard()}
      {selectedView === "trends" && renderTrends()}
      {selectedView === "formats" && (
        <div style={{ padding: "20px", textAlign: "center", color: "rgba(255,255,255,0.5)" }}>
          Format analysis available in Overview → Game Format Breakdown
        </div>
      )}
    </div>
  );
}
