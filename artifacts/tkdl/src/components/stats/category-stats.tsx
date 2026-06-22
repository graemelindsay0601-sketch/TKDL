import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Activity, Target, Dumbbell, Trophy } from "lucide-react";

type GameTypeCategory = "M501" | "Tour" | "Practice" | "League";
type StatTab = "overall" | "trends" | "darts" | "sessions";

interface CategoryStatsProps {
  playerId: number;
  onCoachWeakness?: (category: GameTypeCategory, metric: string, value: number) => void;
}

interface CategoryStats {
  category: GameTypeCategory;
  source: "competitive" | "practice";
  matches?: number;
  wins?: number;
  losses?: number;
  winRate?: number;
  totalDarts?: number;
  avgDartsPerMatch?: number;
  total180s?: number;
  checkoutHits?: number;
  checkoutAttempts?: number;
  checkoutRate?: number;
  sessions?: number;
  avgDartsPerSession?: number;
}

interface CategoryBreakdown {
  gameType: string;
  gameTypeName: string;
  category: GameTypeCategory;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  totalDarts: number;
  total180s: number;
  checkoutHits: number;
  checkoutAttempts: number;
  checkoutRate: number;
}

export function CategoryStats({ playerId, onCoachWeakness }: CategoryStatsProps) {
  const [selectedCategory, setSelectedCategory] = useState<GameTypeCategory>("League");
  const [selectedTab, setSelectedTab] = useState<StatTab>("overall");
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [dartProfile, setDartProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [window, setWindow] = useState<"7days" | "30days" | "90days" | "all">("all");

  const categories: { key: GameTypeCategory; label: string; icon: React.ReactNode; color: string }[] = [
    { key: "League", label: "League", icon: <Trophy size={16} />, color: "#ff005c" },
    { key: "M501", label: "Master 501", icon: <Activity size={16} />, color: "#ffd24a" },
    { key: "Tour", label: "Tour Mode", icon: <Target size={16} />, color: "#00e5a0" },
    { key: "Practice", label: "Practice", icon: <Dumbbell size={16} />, color: "#a855f7" },
  ];

  useEffect(() => {
    const fetchBreakdown = async () => {
      try {
        const response = await fetch(`/api/players/${playerId}/stats/categories?window=${window}`);
        const data = await response.json();
        setBreakdown(data);
      } catch (err) {
        console.error("Failed to load category breakdown:", err);
      }
    };
    fetchBreakdown();
  }, [playerId, window]);

  useEffect(() => {
    const fetchCategoryData = async () => {
      setLoading(true);
      try {
        const [statsRes, trendsRes, dartsRes, sessionsRes] = await Promise.all([
          fetch(`/api/players/${playerId}/stats/category/${selectedCategory}?window=${window}`),
          fetch(`/api/players/${playerId}/stats/category/${selectedCategory}/trends`),
          fetch(`/api/players/${playerId}/stats/category/${selectedCategory}/darts`),
          fetch(`/api/players/${playerId}/stats/category/${selectedCategory}/sessions`),
        ]);

        if (statsRes.ok) {
          const stats = await statsRes.json();
          setCategoryStats(stats);
          
          // Notify coach of potential weaknesses
          if (onCoachWeakness && stats.checkoutRate !== undefined && stats.checkoutRate < 0.30) {
            onCoachWeakness(selectedCategory, "checkoutRate", stats.checkoutRate);
          }
        }
        if (trendsRes.ok) {
          setTrends(await trendsRes.json());
        }
        if (dartsRes.ok) {
          setDartProfile(await dartsRes.json());
        }
        if (sessionsRes.ok) {
          setSessions(await sessionsRes.json());
        }
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, [playerId, selectedCategory, window, onCoachWeakness]);

  const StatCard = ({ label, value, secondary, trend, color }: any) => (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "8px",
      padding: "12px",
      flex: "1 1 calc(50% - 8px)",
      minWidth: "140px",
    }}>
      <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", marginBottom: "6px" }}>
        {label}
      </div>
      <div style={{ fontSize: "20px", fontWeight: "600", color: color || "#fff", marginBottom: "4px" }}>
        {typeof value === "number" && !Number.isInteger(value) ? value.toFixed(2) : value}
      </div>
      {secondary && (
        <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>
          {secondary}
        </div>
      )}
      {trend !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", color: trend > 0 ? "#00e5a0" : "#ff005c" }}>
          {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span style={{ fontSize: "11px" }}>{Math.abs(trend).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (loading) {
      return <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>Loading...</div>;
    }

    switch (selectedTab) {
      case "overall":
        return categoryStats ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {categoryStats.source === "competitive" ? (
                <>
                  <StatCard label="Matches" value={categoryStats.matches} secondary={`${categoryStats.wins}W-${categoryStats.losses}L`} color="#ff005c" />
                  <StatCard label="Win Rate" value={`${((categoryStats.winRate || 0) * 100).toFixed(1)}%`} color={categoryStats.winRate! > 0.5 ? "#00e5a0" : "#ff005c"} />
                  <StatCard label="Avg Darts" value={categoryStats.avgDartsPerMatch?.toFixed(1)} color="#ffd24a" />
                  <StatCard label="180s" value={categoryStats.total180s} color="#a855f7" />
                  <StatCard label="Checkout %" value={`${((categoryStats.checkoutRate || 0) * 100).toFixed(1)}%`} secondary={`${categoryStats.checkoutHits}/${categoryStats.checkoutAttempts}`} color={categoryStats.checkoutRate! > 0.3 ? "#00e5a0" : "#ff005c"} />
                </>
              ) : (
                <>
                  <StatCard label="Sessions" value={categoryStats.sessions} color="#a855f7" />
                  <StatCard label="Total Darts" value={categoryStats.totalDarts} color="#ffd24a" />
                  <StatCard label="Avg Per Session" value={categoryStats.avgDartsPerSession?.toFixed(1)} color="#00e5a0" />
                  <StatCard label="180s" value={categoryStats.total180s} color="#ff005c" />
                </>
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>No data available</div>
        );

      case "trends":
        return trends.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {trends.map((trend, idx) => (
              <div key={idx} style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                padding: "10px",
                display: "flex",
                justifyContent: "space-between",
              }}>
                <div>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>{trend.month}</div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>{trend.wins}W - {trend.matches - trend.wins}L</div>
                </div>
                <div style={{ textAlign: "right", fontSize: "12px", color: trend.winRate >= 0.5 ? "#00e5a0" : "#ff005c" }}>
                  {trend.matches} games • {(trend.winRate * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>No trend data</div>
        );

      case "darts":
        return dartProfile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
              {dartProfile.mostFrequentTargets?.map((dart: any) => (
                <div key={dart.target} style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  padding: "12px",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "#ff005c", marginBottom: "4px" }}>{dart.target}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{dart.frequency.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>No dart data available</div>
        );

      case "sessions":
        return sessions.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sessions.slice(0, 10).map((session) => (
              <div key={session.id} style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "6px",
                padding: "10px",
              }}>
                <div style={{ fontWeight: "600", fontSize: "13px", marginBottom: "4px" }}>{session.gameType}</div>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                  {new Date(session.createdAt).toLocaleDateString()} • {session.dartsThrown} darts • {session.p1_180s} 180s
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>No sessions in this category</div>
        );

      default:
        return null;
    }
  };

  const currentCategory = categories.find(c => c.key === selectedCategory);
  const categoryColor = currentCategory?.color || "#fff";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Time Window Filter */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "center", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        {(["7days", "30days", "90days", "all"] as const).map(w => (
          <button
            key={w}
            onClick={() => setWindow(w)}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              background: window === w ? "rgba(255,0,92,0.2)" : "transparent",
              border: window === w ? "1px solid rgba(255,0,92,0.5)" : "1px solid rgba(255,255,255,0.1)",
              color: window === w ? "#ff005c" : "rgba(255,255,255,0.5)",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {w === "7days" ? "7d" : w === "30days" ? "30d" : w === "90days" ? "90d" : "All"}
          </button>
        ))}
      </div>

      {/* Category Selector */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {categories.map(cat => (
          <button
            key={cat.key}
            onClick={() => {
              setSelectedCategory(cat.key);
              setSelectedTab("overall");
            }}
            style={{
              padding: "8px 12px",
              fontSize: "12px",
              background: selectedCategory === cat.key ? `${cat.color}20` : "rgba(255,255,255,0.02)",
              border: selectedCategory === cat.key ? `1px solid ${cat.color}50` : "1px solid rgba(255,255,255,0.1)",
              color: selectedCategory === cat.key ? cat.color : "rgba(255,255,255,0.5)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* Category Stats Card */}
      {breakdown.filter(b => b.category === selectedCategory).length > 0 && (
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: `1px solid ${categoryColor}30`,
          borderRadius: "8px",
          padding: "12px",
        }}>
          <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
            {breakdown.filter(b => b.category === selectedCategory).map(b => (
              <div key={b.gameType} style={{ display: "flex", gap: "12px" }}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>{b.gameTypeName}</span>
                <span style={{ color: categoryColor, fontWeight: "600" }}>{b.matches}G • {b.wins}W • {(b.winRate * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat Tabs */}
      <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
        {(["overall", "trends", "darts", "sessions"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            style={{
              padding: "8px 14px",
              fontSize: "12px",
              background: selectedTab === tab ? "rgba(255,0,92,0.15)" : "transparent",
              border: selectedTab === tab ? "1px solid rgba(255,0,92,0.3)" : "1px solid transparent",
              color: selectedTab === tab ? "#ff005c" : "rgba(255,255,255,0.5)",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            {tab === "overall" ? "Overall" : tab === "trends" ? "Trends" : tab === "darts" ? "Darts" : "Sessions"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: "rgba(255,255,255,0.01)", borderRadius: "6px", padding: "12px" }}>
        {renderContent()}
      </div>
    </div>
  );
}
