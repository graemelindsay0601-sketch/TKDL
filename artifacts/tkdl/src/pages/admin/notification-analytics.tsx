/**
 * Notification Analytics Dashboard
 * Shows admin metrics on which notifications work best
 */

import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NotificationStats {
  total_sent: number;
  total_opened: number;
  open_rate: number;
  total_clicked: number;
  click_rate: number;
}

export function NotificationAnalytics() {
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/notifications/analytics");
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "8px",
      padding: "20px",
      color: "#fff",
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          width: "100%",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: expanded ? "20px" : 0,
          padding: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <BarChart3 size={18} style={{ color: "#4d94ff" }} />
          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>
            📊 Notification Analytics (Last 30 Days)
          </h3>
        </div>
        <ChevronDown
          size={20}
          style={{
            transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
            transition: "transform 0.2s",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Stats Grid */}
      {expanded && (
        <>
        {loading ? (
          <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.4)" }}>
            Loading analytics...
          </div>
        ) : stats ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "15px",
          marginBottom: "20px",
        }}>
          {/* Total Sent */}
          <div style={{
            background: "rgba(74,158,255,0.1)",
            border: "1px solid rgba(74,158,255,0.2)",
            borderRadius: "6px",
            padding: "15px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginBottom: "5px" }}>
              Total Sent
            </div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#4d94ff" }}>
              {stats.total_sent}
            </div>
          </div>

          {/* Total Opened */}
          <div style={{
            background: "rgba(0,229,160,0.1)",
            border: "1px solid rgba(0,229,160,0.2)",
            borderRadius: "6px",
            padding: "15px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginBottom: "5px" }}>
              Total Opened
            </div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#00e5a0" }}>
              {stats.total_opened}
            </div>
          </div>

          {/* Open Rate */}
          <div style={{
            background: "rgba(0,229,160,0.1)",
            border: "1px solid rgba(0,229,160,0.2)",
            borderRadius: "6px",
            padding: "15px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginBottom: "5px" }}>
              Open Rate
            </div>
            <div style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: stats.open_rate > 50 ? "#00e5a0" : stats.open_rate > 25 ? "#ffd24a" : "#ff7f00",
            }}>
              {stats.open_rate}%
            </div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "5px" }}>
              {stats.open_rate > 50 ? "Excellent" : stats.open_rate > 25 ? "Good" : "Poor"}
            </div>
          </div>

          {/* Total Clicked */}
          <div style={{
            background: "rgba(255,0,92,0.1)",
            border: "1px solid rgba(255,0,92,0.2)",
            borderRadius: "6px",
            padding: "15px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginBottom: "5px" }}>
              Total Clicked
            </div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#ff005c" }}>
              {stats.total_clicked}
            </div>
          </div>

          {/* Click Rate */}
          <div style={{
            background: "rgba(255,0,92,0.1)",
            border: "1px solid rgba(255,0,92,0.2)",
            borderRadius: "6px",
            padding: "15px",
            textAlign: "center",
          }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.5)", marginBottom: "5px" }}>
              Click Rate
            </div>
            <div style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: stats.click_rate > 30 ? "#00e5a0" : stats.click_rate > 10 ? "#ffd24a" : "#ff7f00",
            }}>
              {stats.click_rate}%
            </div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginTop: "5px" }}>
              {stats.click_rate > 30 ? "Excellent" : stats.click_rate > 10 ? "Good" : "Low"}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.4)" }}>
          No data available
        </div>
      )}
      )}

      {/* Refresh Button */}
      <button
        onClick={fetchAnalytics}
        style={{
          width: "100%",
          padding: "10px",
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "4px",
          color: "#4d94ff",
          fontSize: "12px",
          fontWeight: "bold",
          cursor: "pointer",
          marginBottom: "15px",
        }}
      >
        🔄 Refresh
      </button>

      {/* Info */}
      <div style={{
        padding: "10px",
        background: "rgba(74,158,255,0.05)",
        border: "1px solid rgba(74,158,255,0.2)",
        borderRadius: "4px",
        fontSize: "10px",
        color: "rgba(255,255,255,0.6)",
      }}>
        💡 Open Rate shows what % of sent notifications were opened. Click Rate shows what % led to engagement.
        Higher rates = more effective notifications.
      </div>
        </>
      )}
    </div>
  );
}
