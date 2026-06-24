import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Zap, Target } from "lucide-react";

interface Challenge {
  id: number;
  title: string;
  description: string | null;
  progress: number;
  requirement_value: number;
  reward_coins: number;
  is_completed: boolean;
  completed_at: string | null;
}

interface ChallengesBarProps {
  playerId: number;
}

export function ChallengesBar({ playerId }: ChallengesBarProps) {
  const [daily, setDaily] = useState<Challenge[]>([]);
  const [weekly, setWeekly] = useState<Challenge[]>([]);
  const [dailyResetIn, setDailyResetIn] = useState("");
  const [weeklyResetIn, setWeeklyResetIn] = useState("");
  const [expandedDaily, setExpandedDaily] = useState(true);
  const [expandedWeekly, setExpandedWeekly] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChallenges();
    const interval = setInterval(loadChallenges, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [playerId]);

  useEffect(() => {
    const timer = setInterval(() => updateTimers(), 1000);
    return () => clearInterval(timer);
  }, [daily, weekly]);

  const loadChallenges = async () => {
    try {
      const [dailyRes, weeklyRes] = await Promise.all([
        fetch(`/api/challenges/daily/${playerId}`),
        fetch(`/api/challenges/weekly/${playerId}`),
      ]);

      if (dailyRes.ok) {
        const data = await dailyRes.json();
        setDaily(data.challenges);
        setDailyResetIn(formatCountdown(data.secondsUntilReset));
      }

      if (weeklyRes.ok) {
        const data = await weeklyRes.json();
        setWeekly(data.challenges);
        setWeeklyResetIn(formatCountdown(data.secondsUntilReset));
      }

      setLoading(false);
    } catch (error) {
      console.error("Failed to load challenges:", error);
      setLoading(false);
    }
  };

  const updateTimers = () => {
    // Update countdown timers by decrementing
    const updateTime = (current: string) => {
      const parts = current.match(/(\d+)/g);
      if (!parts) return current;

      let [h, m, s] = parts.map(Number);
      s--;
      if (s < 0) {
        s = 59;
        m--;
        if (m < 0) {
          m = 59;
          h--;
        }
      }
      return `${h}h ${m}m ${s}s`;
    };

    if (dailyResetIn) setDailyResetIn(updateTime(dailyResetIn));
    if (weeklyResetIn) setWeeklyResetIn(updateTime(weeklyResetIn));
  };

  const formatCountdown = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (loading) return <div style={{ padding: "1rem", color: "#999" }}>Loading challenges...</div>;

  const completedDaily = daily.filter((c) => c.is_completed).length;
  const completedWeekly = weekly.filter((c) => c.is_completed).length;

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.4)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "0.75rem",
        padding: "1rem",
        marginBottom: "1.5rem",
      }}
    >
      {/* Daily Challenges */}
      <div
        style={{
          marginBottom: "1rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <button
          onClick={() => setExpandedDaily(!expandedDaily)}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            padding: 0,
            marginBottom: "0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Zap size={18} style={{ color: "#ffd24a" }} />
            <span>Daily Challenges</span>
            <span
              style={{
                fontSize: "0.85rem",
                color: "rgba(255,212,74,0.7)",
                marginLeft: "0.5rem",
              }}
            >
              {completedDaily}/{daily.length}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Resets in {dailyResetIn}
            </span>
            {expandedDaily ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {expandedDaily && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {daily.map((challenge) => (
              <ChallengeItem key={challenge.id} challenge={challenge} />
            ))}
          </div>
        )}
      </div>

      {/* Weekly Challenges */}
      <div>
        <button
          onClick={() => setExpandedWeekly(!expandedWeekly)}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            padding: 0,
            marginBottom: "0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Target size={18} style={{ color: "#0066ff" }} />
            <span>Weekly Challenges</span>
            <span
              style={{
                fontSize: "0.85rem",
                color: "rgba(0,102,255,0.7)",
                marginLeft: "0.5rem",
              }}
            >
              {completedWeekly}/{weekly.length}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.8rem",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Resets in {weeklyResetIn}
            </span>
            {expandedWeekly ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </button>

        {expandedWeekly && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {weekly.map((challenge) => (
              <ChallengeItem key={challenge.id} challenge={challenge} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChallengeItem({ challenge }: { challenge: Challenge }) {
  const progress = Math.min(100, (challenge.progress / challenge.requirement_value) * 100);
  const isCompleted = challenge.is_completed;

  return (
    <div
      style={{
        background: isCompleted ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${isCompleted ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: "0.5rem",
        padding: "0.75rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
        <span
          style={{
            fontSize: "0.9rem",
            fontWeight: 500,
            color: isCompleted ? "#10b981" : "#fff",
            textDecoration: isCompleted ? "line-through" : "none",
          }}
        >
          {challenge.title}
        </span>
        <span style={{ fontSize: "0.85rem", color: "#ffd24a", fontWeight: 600 }}>
          +{challenge.reward_coins}
        </span>
      </div>

      {challenge.description && (
        <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.6)", margin: "0 0 0.5rem 0" }}>
          {challenge.description}
        </p>
      )}

      <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: "0.25rem", height: "0.4rem", overflow: "hidden" }}>
        <div
          style={{
            background: isCompleted ? "#10b981" : `linear-gradient(90deg, #ffd24a, #ff6b9d)`,
            height: "100%",
            width: `${progress}%`,
            transition: "width 0.3s ease",
          }}
        />
      </div>

      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)", marginTop: "0.35rem" }}>
        {isCompleted ? (
          <span style={{ color: "#10b981" }}>✓ Completed</span>
        ) : (
          <span>
            {challenge.progress} / {challenge.requirement_value}
          </span>
        )}
      </div>
    </div>
  );
}
