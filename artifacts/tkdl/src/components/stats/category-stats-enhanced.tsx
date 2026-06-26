import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Activity, Target, Dumbbell, Trophy, X, ChevronRight, Brain, AlertCircle, Zap } from "lucide-react";
import { NoStatsEmptyState } from "@/components/empty-states";

type GameTypeCategory = "M501" | "Tour" | "Practice" | "League";
type StatTab = "overall" | "trends" | "darts" | "sessions";

interface CoachDrill {
  id: string;
  title: string;
  priority: "critical" | "high" | "normal" | "advanced";
  focus: string;
  description: string;
  drill: string;
  duration: string;
}

interface CategoryStatsEnhancedProps {
  playerId: number;
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

// Game type category metadata
const CATEGORY_META = {
  M501: { icon: "🎯", label: "Master 501", color: "#ffd24a", description: "High-level competitive format" },
  Tour: { icon: "🏆", label: "Tour Mode", color: "#00e5a0", description: "Tournament & challenge games" },
  Practice: { icon: "💪", label: "Practice", color: "#a855f7", description: "Solo & practice sessions" },
  League: { icon: "⚡", label: "League", color: "#ff005c", description: "Regular competitive matches" },
};

const PRIORITY_COLORS = {
  critical: "#ff005c",
  high: "#ffd24a",
  normal: "#a855f7",
  advanced: "#00e5a0",
};

export function CategoryStatsEnhanced({ playerId }: CategoryStatsEnhancedProps) {
  const [selectedCategory, setSelectedCategory] = useState<GameTypeCategory>("League");
  const [selectedTab, setSelectedTab] = useState<StatTab>("overall");
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats | null>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [dartProfile, setDartProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [coachDrills, setCoachDrills] = useState<CoachDrill[]>([]);
  const [loading, setLoading] = useState(false);
  const [window, setWindow] = useState<"7days" | "30days" | "90days" | "all">("all");
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);

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
        const [statsRes, trendsRes, dartsRes, sessionsRes, coachRes] = await Promise.all([
          fetch(`/api/players/${playerId}/stats/category/${selectedCategory}?window=${window}`),
          fetch(`/api/players/${playerId}/stats/category/${selectedCategory}/trends`),
          fetch(`/api/players/${playerId}/stats/category/${selectedCategory}/darts`),
          fetch(`/api/players/${playerId}/stats/category/${selectedCategory}/sessions`),
          fetch(`/api/players/${playerId}/practice-routine`),
        ]);

        if (statsRes.ok) setCategoryStats(await statsRes.json());
        if (trendsRes.ok) setTrends(await trendsRes.json());
        if (dartsRes.ok) setDartProfile(await dartsRes.json());
        if (sessionsRes.ok) setSessions(await sessionsRes.json());
        if (coachRes.ok) {
          const coachData = await coachRes.json();
          setCoachDrills(coachData.drills || []);
        }
      } catch (err) {
        console.error("Failed to load stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, [playerId, selectedCategory, window]);

  const getCoachWeakness = () => {
    if (!categoryStats) return null;
    
    // Check for critical weaknesses
    if (categoryStats.checkoutRate !== undefined && categoryStats.checkoutRate < 0.30) {
      return {
        type: "checkout",
        message: `Your checkout rate is ${(categoryStats.checkoutRate * 100).toFixed(1)}% — games slipping away on doubles.`,
        drill: coachDrills.find(d => d.id === "doubles"),
        severity: categoryStats.checkoutRate < 0.20 ? "critical" : "high",
      };
    }
    
    return null;
  };

  const weakness = getCoachWeakness();
  const categoryMeta = CATEGORY_META[selectedCategory];

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
            {weakness && (
              <div style={{
                background: `${weakness.severity === "critical" ? "rgba(255,0,92,0.15)" : "rgba(255,210,74,0.1)"}`,
                border: `1px solid ${weakness.severity === "critical" ? "rgba(255,0,92,0.3)" : "rgba(255,210,74,0.2)"}`,
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                gap: "12px",
              }}>
                <AlertCircle size={18} style={{ color: weakness.severity === "critical" ? "#ff005c" : "#ffd24a", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#fff", marginBottom: "4px" }}>
                    ⚠️ Coach Alert
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", marginBottom: "8px" }}>
                    {weakness.message}
                  </div>
                  {weakness.drill && (
                    <div style={{ fontSize: "11px", color: weakness.severity === "critical" ? "#ff005c" : "#ffd24a", fontWeight: "500" }}>
                      Recommended: {weakness.drill.title} ({weakness.drill.duration})
                    </div>
                  )}
                </div>
              </div>
            )}
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
          <NoStatsEmptyState reason="no-matches" />
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
            <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "6px" }}>
              💡 Focus on your weak areas: Practice the segments you miss most
            </div>
          </div>
        ) : (
          <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>No dart data available</div>
        );

      case "sessions":
        return sessions.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sessions.slice(0, 10).map((session) => (
              <button
                key={session.id}
                onClick={() => {
                  setSelectedSession(session);
                  setShowSessionModal(true);
                }}
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                  padding: "10px 12px",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
              >
                <div>
                  <div style={{ fontWeight: "600", fontSize: "13px" }}>{session.gameType}</div>
                  <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                    {new Date(session.createdAt).toLocaleDateString()} • {session.dartsThrown} darts • {session.p1_180s} 180s
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "rgba(255,255,255,0.3)" }} />
              </button>
            ))}
          </div>
        ) : (
          <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>No sessions in this category</div>
        );

      default:
        return null;
    }
  };

  const currentCategory = selectedCategory;
  const categoryColor = CATEGORY_META[currentCategory].color;

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

      {/* Category Selector with Icons */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {(Object.entries(CATEGORY_META) as any).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => {
              setSelectedCategory(key);
              setSelectedTab("overall");
            }}
            style={{
              padding: "8px 12px",
              fontSize: "12px",
              background: selectedCategory === key ? `${meta.color}20` : "rgba(255,255,255,0.02)",
              border: selectedCategory === key ? `1px solid ${meta.color}50` : "1px solid rgba(255,255,255,0.1)",
              color: selectedCategory === key ? meta.color : "rgba(255,255,255,0.5)",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span style={{ fontSize: "16px" }}>{meta.icon}</span>
            {meta.label}
          </button>
        ))}
      </div>

      {/* Category Description */}
      <div style={{
        background: "rgba(255,255,255,0.01)",
        border: `1px solid ${categoryColor}30`,
        borderRadius: "6px",
        padding: "10px 12px",
        fontSize: "12px",
        color: "rgba(255,255,255,0.6)",
      }}>
        {categoryMeta?.description}
      </div>

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

      {/* Coach Drills Sidebar */}
      {coachDrills.length > 0 && (
        <div style={{
          background: "rgba(167,139,250,0.08)",
          border: "1px solid rgba(167,139,250,0.2)",
          borderRadius: "8px",
          padding: "12px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Brain size={16} style={{ color: "#a855f7" }} />
            <span style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>Your Practice Plan</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {coachDrills.slice(0, 3).map((drill) => (
              <div key={drill.id} style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${PRIORITY_COLORS[drill.priority]}33`,
                borderRadius: "6px",
                padding: "8px",
                fontSize: "11px",
                display: "flex",
                gap: "8px",
                alignItems: "flex-start",
              }}>
                <div style={{ 
                  width: "3px", 
                  height: "100%", 
                  background: PRIORITY_COLORS[drill.priority],
                  borderRadius: "1px",
                }}></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "600", color: PRIORITY_COLORS[drill.priority] }}>{drill.title}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)" }}>{drill.focus} • {drill.duration}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {showSessionModal && selectedSession && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }} onClick={() => setShowSessionModal(false)}>
          <div style={{
            background: "rgba(8,6,18,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "20px",
            maxWidth: "500px",
            maxHeight: "80vh",
            overflow: "auto",
            width: "90%",
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "16px", fontWeight: "600" }}>Session Detail</h3>
              <button onClick={() => setShowSessionModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.5)" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
              <StatCard label="Game Type" value={selectedSession.gameType} color="#fff" />
              <StatCard label="Date" value={new Date(selectedSession.createdAt).toLocaleDateString()} color="#fff" />
              <StatCard label="Darts Thrown" value={selectedSession.dartsThrown} color="#ffd24a" />
              <StatCard label="180s" value={selectedSession.p1_180s} color="#ff005c" />
              <StatCard label="Checkout Hits" value={selectedSession.p1CheckoutHits} color="#00e5a0" />
              <StatCard label="Checkout Attempts" value={selectedSession.p1CheckoutAttempts} color="#a855f7" />
            </div>

            {selectedSession.dartLog && (
              <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.02)", borderRadius: "6px" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "8px", color: "rgba(255,255,255,0.7)" }}>Dart Log (First 100)</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(20, 1fr)", gap: "4px" }}>
                  {selectedSession.dartLog.slice(0, 100).map((dart: number, idx: number) => (
                    <div key={idx} style={{
                      aspect: "1",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: dart === 20 ? "rgba(255,0,92,0.2)" : dart >= 15 ? "rgba(255,210,74,0.2)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${dart === 20 ? "rgba(255,0,92,0.4)" : "rgba(255,255,255,0.1)"}`,
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: "600",
                      color: dart === 20 ? "#ff005c" : "#fff",
                    }}>
                      {dart}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
