/**
 * Notification Analytics Dashboard
 * Shows admin metrics on which notifications work best
 */

import { useState, useEffect } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleAdminSection } from "./collapsible-section";

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
    // Brought onto the shared CollapsibleAdminSection wrapper — same behavior
    // (starts collapsed, click to expand), consistent chrome with the rest
    // of the admin page. #4d94ff swapped for the palette's #38bdf8.
    //
    // Typography/spacing brought into line with the rest of the admin
    // section (Oswald headers/labels/values, Tailwind rem-based classes
    // instead of raw px inline styles) in a 2026-09-25 visual-consistency
    // pass — this file previously used no Oswald at all and was visibly
    // out of step with every other admin panel. Colors/thresholds unchanged.
    <CollapsibleAdminSection title="Notification Analytics (Last 30 Days)" icon={BarChart3} accent="#38bdf8">
      <div className="px-4 py-4">
        {loading ? (
          <div className="text-center py-5 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Loading analytics...
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {/* Total Sent */}
            <div className="rounded-lg px-4 py-3 text-center" style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)" }}>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                Total Sent
              </div>
              <div className="text-2xl font-black tabular-nums" style={{ color: "#38bdf8", fontFamily: "Oswald, sans-serif" }}>
                {stats.total_sent}
              </div>
            </div>

            {/* Total Opened */}
            <div className="rounded-lg px-4 py-3 text-center" style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.2)" }}>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                Total Opened
              </div>
              <div className="text-2xl font-black tabular-nums" style={{ color: "#00e5a0", fontFamily: "Oswald, sans-serif" }}>
                {stats.total_opened}
              </div>
            </div>

            {/* Open Rate */}
            <div className="rounded-lg px-4 py-3 text-center" style={{ background: "rgba(0,229,160,0.1)", border: "1px solid rgba(0,229,160,0.2)" }}>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                Open Rate
              </div>
              <div className="text-2xl font-black tabular-nums" style={{ color: stats.open_rate > 50 ? "#00e5a0" : stats.open_rate > 25 ? "#ffd24a" : "#ff7f00", fontFamily: "Oswald, sans-serif" }}>
                {stats.open_rate}%
              </div>
              <div className="text-[0.65rem] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                {stats.open_rate > 50 ? "Excellent" : stats.open_rate > 25 ? "Good" : "Poor"}
              </div>
            </div>

            {/* Total Clicked */}
            <div className="rounded-lg px-4 py-3 text-center" style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.2)" }}>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                Total Clicked
              </div>
              <div className="text-2xl font-black tabular-nums" style={{ color: "#ff005c", fontFamily: "Oswald, sans-serif" }}>
                {stats.total_clicked}
              </div>
            </div>

            {/* Click Rate */}
            <div className="rounded-lg px-4 py-3 text-center" style={{ background: "rgba(255,0,92,0.1)", border: "1px solid rgba(255,0,92,0.2)" }}>
              <div className="text-xs mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                Click Rate
              </div>
              <div className="text-2xl font-black tabular-nums" style={{ color: stats.click_rate > 30 ? "#00e5a0" : stats.click_rate > 10 ? "#ffd24a" : "#ff7f00", fontFamily: "Oswald, sans-serif" }}>
                {stats.click_rate}%
              </div>
              <div className="text-[0.65rem] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                {stats.click_rate > 30 ? "Excellent" : stats.click_rate > 10 ? "Good" : "Low"}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-5 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            No data available
          </div>
        )}

        {/* Refresh Button */}
        <button
          onClick={fetchAnalytics}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 mb-4"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#38bdf8", fontFamily: "Oswald, sans-serif" }}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>

        {/* Info */}
        <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(56,189,248,0.05)", border: "1px solid rgba(56,189,248,0.2)", color: "rgba(255,255,255,0.6)" }}>
          Open Rate shows what % of sent notifications were opened. Click Rate shows what % led to engagement.
          Higher rates = more effective notifications.
        </div>
      </div>
    </CollapsibleAdminSection>
  );
}
