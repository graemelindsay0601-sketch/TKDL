import { useState, useEffect } from "react";
import { Zap, Award, TrendingUp } from "lucide-react";

interface DrillStat {
  drillId: string;
  drillTitle: string;
  totalCompletions: number;
  lastCompleted?: Date;
  bestScore?: number;
  averageScore?: number;
  currentMastery: "novice" | "intermediate" | "proficient" | "mastered";
  nextGoal?: string;
  improvementTrend: number;
}

interface DrillProgressTrackerProps {
  playerId: number;
}

export function DrillProgressTracker({ playerId }: DrillProgressTrackerProps) {
  const [drills, setDrills] = useState<DrillStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState<any[]>([]);

  useEffect(() => {
    const fetchDrillProgress = async () => {
      try {
        const [statsRes, milestoneRes] = await Promise.all([
          fetch(`/api/players/${playerId}/drills/stats`),
          fetch(`/api/players/${playerId}/drills/milestones`),
        ]);

        if (statsRes.ok) setDrills(await statsRes.json());
        if (milestoneRes.ok) setMilestones(await milestoneRes.json());
      } catch (err) {
        console.error("Failed to load drill progress:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDrillProgress();
  }, [playerId]);

  if (loading) {
    return <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>Loading drill progress...</div>;
  }

  const getMasteryColor = (mastery: string) => {
    switch (mastery) {
      case "mastered": return "#ffd24a";
      case "proficient": return "#00e5a0";
      case "intermediate": return "#a855f7";
      case "novice": return "#ff005c";
      default: return "rgba(255,255,255,0.3)";
    }
  };

  const getMasteryLabel = (mastery: string) => {
    switch (mastery) {
      case "mastered": return "🏆 Mastered";
      case "proficient": return "✓ Proficient";
      case "intermediate": return "📈 Intermediate";
      case "novice": return "🌱 Novice";
      default: return mastery;
    }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      padding: "16px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Zap size={16} style={{ color: "#a855f7" }} />
        <span style={{ fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
          Your Drill Progress
        </span>
      </div>

      {/* Drills List */}
      {drills.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
          {drills.map((drill) => (
            <div key={drill.drillId} style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "12px",
            }}>
              {/* Drill Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "8px",
              }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.9)" }}>
                    {drill.drillTitle}
                  </div>
                  <div style={{
                    fontSize: "11px",
                    color: getMasteryColor(drill.currentMastery),
                    fontWeight: "600",
                    marginTop: "2px",
                  }}>
                    {getMasteryLabel(drill.currentMastery)}
                  </div>
                </div>
                <div style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#ffd24a",
                  textAlign: "right",
                }}>
                  {drill.totalCompletions}x
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ marginBottom: "8px" }}>
                <div style={{
                  height: "6px",
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}>
                  <div style={{
                    height: "100%",
                    width: `${(drill.averageScore || 0)}%`,
                    background: `linear-gradient(90deg, ${getMasteryColor(drill.currentMastery)}, ${getMasteryColor(drill.currentMastery)})`,
                  }}></div>
                </div>
              </div>

              {/* Stats */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                fontSize: "11px",
              }}>
                <div style={{ color: "rgba(255,255,255,0.5)" }}>
                  Score: <strong style={{ color: "rgba(255,255,255,0.7)" }}>
                    {drill.averageScore?.toFixed(0) || 0}%
                  </strong>
                </div>
                <div style={{
                  textAlign: "right",
                  color: drill.improvementTrend > 0 ? "#00e5a0" : "#ff005c",
                  fontWeight: "600",
                }}>
                  {drill.improvementTrend > 0 ? "↑" : "↓"} {Math.abs(drill.improvementTrend).toFixed(1)}%
                </div>
              </div>

              {/* Next Goal */}
              {drill.currentMastery !== "mastered" && (
                <div style={{
                  marginTop: "8px",
                  padding: "8px",
                  background: "rgba(168,85,247,0.1)",
                  borderRadius: "4px",
                  fontSize: "10px",
                  color: "#a855f7",
                }}>
                  Next Goal: {drill.nextGoal}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          padding: "20px",
          textAlign: "center",
          color: "rgba(255,255,255,0.4)",
          fontSize: "12px",
        }}>
          No drills completed yet. Start a drill from your coach recommendations!
        </div>
      )}

      {/* Milestones */}
      {milestones.length > 0 && (
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.1)",
          paddingTop: "12px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.8)", marginBottom: "10px" }}>
            🎯 Achievements
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {milestones.map((milestone, idx) => (
              <div key={idx} style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px",
                background: milestone.achieved ? "rgba(255,210,74,0.08)" : "rgba(255,255,255,0.02)",
                border: `1px solid ${milestone.achieved ? "rgba(255,210,74,0.2)" : "rgba(255,255,255,0.1)"}`,
                borderRadius: "6px",
              }}>
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: `conic-gradient(#ffd24a ${milestone.progress}%, rgba(255,255,255,0.1) ${milestone.progress}%)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  flexShrink: 0,
                }}>
                  {milestone.achieved ? "✓" : Math.round(milestone.progress) + "%"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: milestone.achieved ? "#ffd24a" : "rgba(255,255,255,0.7)",
                  }}>
                    {milestone.name}
                  </div>
                  <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
                    {milestone.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
