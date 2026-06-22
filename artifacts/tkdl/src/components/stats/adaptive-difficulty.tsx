import { useState, useEffect } from "react";
import { Zap, ChevronRight } from "lucide-react";

interface DrillDifficulty {
  drillId: string;
  drillTitle: string;
  currentDifficulty: "easy" | "medium" | "hard" | "master";
  mastery: number; // 0-100
  completedDifficulties: ("easy" | "medium" | "hard" | "master")[];
  nextChallenge: string;
  daysToNextLevel: number | null;
}

interface AdaptiveDifficultyProps {
  playerId: number;
}

const DIFFICULTY_LEVELS = [
  {
    level: "easy",
    label: "Easy",
    description: "Relaxed practice, no pressure",
    color: "#00e5a0",
  },
  {
    level: "medium",
    label: "Medium",
    description: "Standard difficulty, focused practice",
    color: "#a855f7",
  },
  {
    level: "hard",
    label: "Hard",
    description: "Challenging, time pressure",
    color: "#ffd24a",
  },
  {
    level: "master",
    label: "Master",
    description: "Competition-level intensity",
    color: "#ff005c",
  },
];

export function AdaptiveDifficulty({ playerId }: AdaptiveDifficultyProps) {
  const [drills, setDrills] = useState<DrillDifficulty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdaptiveData = async () => {
      try {
        const response = await fetch(`/api/players/${playerId}/drills/adaptive`);
        const data = await response.json();
        setDrills(data);
      } catch (err) {
        console.error("Failed to load adaptive difficulty:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdaptiveData();
  }, [playerId]);

  if (loading) {
    return <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>Loading drill progression...</div>;
  }

  if (drills.length === 0) {
    return <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>No drills started yet</div>;
  }

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      padding: "16px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Zap size={16} style={{ color: "#ffd24a" }} />
        <span style={{ fontSize: "13px", fontWeight: "600", color: "rgba(255,255,255,0.8)" }}>
          Adaptive Training Path
        </span>
      </div>

      {/* Drills with Progression */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {drills.map((drill) => {
          const currentLevelIndex = DIFFICULTY_LEVELS.findIndex(d => d.level === drill.currentDifficulty);
          
          return (
            <div key={drill.drillId} style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px",
              padding: "14px",
              overflow: "hidden",
            }}>
              {/* Drill Title */}
              <div style={{ marginBottom: "12px" }}>
                <h4 style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "rgba(255,255,255,0.9)",
                  margin: 0,
                  marginBottom: "4px",
                }}>
                  {drill.drillTitle}
                </h4>
                <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
                  {drill.nextChallenge}
                </div>
              </div>

              {/* Difficulty Progression */}
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "12px" }}>
                {DIFFICULTY_LEVELS.map((level, idx) => {
                  const isCompleted = drill.completedDifficulties.includes(level.level as any);
                  const isCurrent = idx === currentLevelIndex;
                  
                  return (
                    <div key={level.level} style={{ display: "flex", alignItems: "center" }}>
                      {/* Difficulty Button */}
                      <div style={{
                        padding: "8px 10px",
                        borderRadius: "6px",
                        background: isCurrent
                          ? `${level.color}30`
                          : isCompleted
                          ? "rgba(255,255,255,0.1)"
                          : "rgba(255,255,255,0.02)",
                        border: isCurrent
                          ? `2px solid ${level.color}`
                          : isCompleted
                          ? "1px solid rgba(255,255,255,0.1)"
                          : "1px solid rgba(255,255,255,0.05)",
                        fontSize: "10px",
                        fontWeight: "600",
                        color: isCurrent ? level.color : isCompleted ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)",
                        minWidth: "60px",
                        textAlign: "center",
                        transition: "all 0.2s",
                        cursor: isCompleted || isCurrent ? "pointer" : "default",
                      }}>
                        {isCompleted && !isCurrent ? "✓" : level.label}
                      </div>

                      {/* Arrow */}
                      {idx < DIFFICULTY_LEVELS.length - 1 && (
                        <ChevronRight size={12} style={{
                          color: idx < currentLevelIndex ? "rgba(0,229,160,0.5)" : "rgba(255,255,255,0.2)",
                          margin: "0 2px",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress & Timeline */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                fontSize: "11px",
              }}>
                <div style={{ color: "rgba(255,255,255,0.5)" }}>
                  Mastery: <strong style={{ color: "rgba(255,255,255,0.8)" }}>
                    {drill.mastery.toFixed(0)}%
                  </strong>
                </div>
                {drill.daysToNextLevel !== null ? (
                  <div style={{ color: "rgba(255,255,255,0.5)", textAlign: "right" }}>
                    Next unlock: <strong style={{ color: "#a855f7" }}>
                      {drill.daysToNextLevel === 0 ? "Ready!" : `${drill.daysToNextLevel} days`}
                    </strong>
                  </div>
                ) : (
                  <div style={{ color: "rgba(255,255,255,0.5)", textAlign: "right" }}>
                    <strong style={{ color: "#ffd24a" }}>Master Level</strong> 🏆
                  </div>
                )}
              </div>

              {/* Current Level Description */}
              <div style={{
                marginTop: "10px",
                padding: "8px",
                background: `${DIFFICULTY_LEVELS[currentLevelIndex]?.color || "#fff"}15`,
                borderLeft: `3px solid ${DIFFICULTY_LEVELS[currentLevelIndex]?.color || "#fff"}`,
                borderRadius: "4px",
                fontSize: "11px",
                color: "rgba(255,255,255,0.7)",
              }}>
                📍 <strong>{DIFFICULTY_LEVELS[currentLevelIndex]?.label}</strong>: {DIFFICULTY_LEVELS[currentLevelIndex]?.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Box */}
      <div style={{
        marginTop: "16px",
        padding: "12px",
        background: "rgba(168,85,247,0.08)",
        border: "1px solid rgba(168,85,247,0.2)",
        borderRadius: "8px",
        fontSize: "11px",
        color: "rgba(255,255,255,0.6)",
        lineHeight: 1.5,
      }}>
        💡 The coach automatically adjusts drill difficulty as you improve. Master the current level to unlock the next challenge!
      </div>
    </div>
  );
}
