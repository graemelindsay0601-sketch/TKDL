import { useState, useEffect } from "react";
import { Flame, Award, Target } from "lucide-react";

interface StreakWidgetProps {
  playerId: number;
  onMilestoneUnlocked?: (message: string) => void;
}

interface StreakData {
  currentWinStreak: number;
  bestWinStreak: number;
  currentCheckoutStreak: number;
  bestCheckoutStreak: number;
  streakMilestones: string[];
}

export function StreakWidget({ playerId, onMilestoneUnlocked }: StreakWidgetProps) {
  const [streaks, setStreaks] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStreaks = async () => {
      try {
        const response = await fetch(`/api/players/${playerId}/streaks`);
        const data = await response.json();
        setStreaks(data);

        // Check for milestone
        if (data.streakMilestones.length > 0 && onMilestoneUnlocked) {
          data.streakMilestones.forEach((milestone: string) => {
            onMilestoneUnlocked(milestone);
          });
        }
      } catch (err) {
        console.error("Failed to load streaks:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStreaks();
  }, [playerId, onMilestoneUnlocked]);

  if (loading) {
    return <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>Loading streaks...</div>;
  }

  if (!streaks) {
    return null;
  }

  const getStreakColor = (streak: number) => {
    if (streak >= 10) return "#ff005c";
    if (streak >= 5) return "#ffd24a";
    if (streak >= 3) return "#00e5a0";
    return "rgba(255,255,255,0.3)";
  };

  const getStreakEmoji = (streak: number) => {
    if (streak >= 10) return "🔥🔥🔥";
    if (streak >= 7) return "🔥🔥";
    if (streak >= 5) return "🔥";
    return "";
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(255,0,92,0.08) 0%, rgba(255,210,74,0.08) 100%)",
      border: "1px solid rgba(255,0,92,0.2)",
      borderRadius: "12px",
      padding: "16px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <Flame size={18} style={{ color: "#ff005c" }} />
        <span style={{ fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
          Your Streaks
        </span>
      </div>

      {/* Streaks Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        {/* Win Streak */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: `2px solid ${getStreakColor(streaks.currentWinStreak)}`,
          borderRadius: "8px",
          padding: "12px",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "32px",
            fontWeight: "900",
            color: getStreakColor(streaks.currentWinStreak),
            lineHeight: 1,
            marginBottom: "4px",
          }}>
            {streaks.currentWinStreak}
            <span style={{ fontSize: "20px", marginLeft: "4px" }}>W</span>
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginBottom: "4px" }}>
            Current
          </div>
          {streaks.currentWinStreak > 0 && (
            <div style={{ fontSize: "16px" }}>{getStreakEmoji(streaks.currentWinStreak)}</div>
          )}
        </div>

        {/* Best Win Streak */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "8px",
          padding: "12px",
          textAlign: "center",
        }}>
          <div style={{
            fontSize: "28px",
            fontWeight: "900",
            color: "#ffd24a",
            lineHeight: 1,
            marginBottom: "4px",
          }}>
            {streaks.bestWinStreak}
            <span style={{ fontSize: "18px", marginLeft: "4px" }}>W</span>
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>Best</div>
        </div>
      </div>

      {/* Checkout Streak */}
      {streaks.currentCheckoutStreak > 0 && (
        <div style={{
          background: "rgba(0,229,160,0.08)",
          border: "1px solid rgba(0,229,160,0.2)",
          borderRadius: "8px",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}>
          <Target size={14} style={{ color: "#00e5a0" }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "12px", fontWeight: "600", color: "#00e5a0" }}>
              {streaks.currentCheckoutStreak} consecutive 50%+ checkouts
            </div>
          </div>
          <span style={{ fontSize: "18px" }}>✓</span>
        </div>
      )}

      {/* Milestones */}
      {streaks.streakMilestones.length > 0 && (
        <div style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          paddingTop: "12px",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}>
          {streaks.streakMilestones.map((milestone, idx) => (
            <div key={idx} style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "rgba(255,255,255,0.7)",
              animation: "pulse 2s infinite",
            }}>
              <Award size={14} style={{ color: "#ffd24a" }} />
              {milestone}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
