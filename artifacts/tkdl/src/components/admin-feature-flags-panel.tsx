import React, { useState, useEffect } from "react";
import { ToggleRight, ToggleLeft } from "lucide-react";

interface FeatureFlag {
  id: number;
  featureName: string;
  enabled: boolean;
  adminTestMode: boolean;
  description?: string;
}

const getAdminHeaders = () => {
  const pin = sessionStorage.getItem("tkdl_admin_pin");
  return {
    "Content-Type": "application/json",
    ...(pin ? { "x-admin-pin": pin } : {}),
  };
};

export default function AdminFeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const colors = {
    bg: "#1a1a1a",
    bgSecondary: "#2a2a2a",
    bgTertiary: "#333333",
    text: "#ffffff",
    textSecondary: "#cccccc",
    border: "#404040",
    success: "#10b981",
    danger: "#ef4444",
    successBg: "rgba(16,185,129,0.1)",
    dangerBg: "rgba(239,68,68,0.1)",
  };

  useEffect(() => {
    loadFlags();
  }, []);

  const loadFlags = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/feature-flags", {
        headers: getAdminHeaders(),
      });
      const data = await res.json();
      
      if (!res.ok) {
        console.error("API error:", data);
        showMessage(`Failed to load flags: ${data.error || "Unknown error"}`, "error");
        setFlags([]);
        return;
      }
      
      setFlags(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load feature flags:", error);
      showMessage("Failed to load feature flags", "error");
      setFlags([]);
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(""), 4000);
  };

  const initializeFlags = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/feature-flags/initialize", {
        method: "POST",
        headers: getAdminHeaders(),
      });

      if (res.ok) {
        showMessage("Feature flags initialized successfully!", "success");
        await loadFlags();
      } else {
        showMessage("Failed to initialize feature flags", "error");
      }
    } catch (error) {
      console.error("Initialization error:", error);
      showMessage("Failed to initialize feature flags", "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminTest = async (featureName: string, currentTestMode: boolean) => {
    try {
      const res = await fetch(`/api/admin/feature-flags/${featureName}/admin-test`, {
        method: "POST",
        headers: getAdminHeaders(),
        body: JSON.stringify({ enabled: !currentTestMode }),
      });

      if (res.ok) {
        showMessage(
          `${featureName}: Admin test mode ${!currentTestMode ? "ENABLED ✓" : "DISABLED"}`,
          "success"
        );
        loadFlags();
      } else {
        showMessage("Failed to update admin test mode", "error");
      }
    } catch (error) {
      showMessage("Failed to update admin test mode", "error");
    }
  };

  const toggleLive = async (featureName: string, currentEnabled: boolean) => {
    try {
      const endpoint = currentEnabled ? "disable" : "enable-all";
      const res = await fetch(`/api/admin/feature-flags/${featureName}/${endpoint}`, {
        method: "POST",
        headers: getAdminHeaders(),
      });

      if (res.ok) {
        showMessage(
          `${featureName}: Now ${!currentEnabled ? "LIVE for everyone 🚀" : "DISABLED"}`,
          "success"
        );
        loadFlags();
      } else {
        showMessage("Failed to toggle feature", "error");
      }
    } catch (error) {
      showMessage("Failed to toggle feature", "error");
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "900px", backgroundColor: colors.bg, color: colors.text }}>
      <h2 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "1rem" }}>
        🚀 Feature Flags Control Panel
      </h2>

      <p style={{ fontSize: "13px", color: colors.textSecondary, marginBottom: "1.5rem" }}>
        Control which features are visible to players
      </p>

      {message && (
        <div
          style={{
            background: messageType === "success" ? colors.successBg : colors.dangerBg,
            color: messageType === "success" ? colors.success : colors.danger,
            padding: "12px 16px",
            borderRadius: "6px",
            marginBottom: "1.5rem",
            fontSize: "13px",
            border: `1px solid ${messageType === "success" ? colors.success : colors.danger}`,
          }}
        >
          {message}
        </div>
      )}

      {loading ? (
        <p>Loading feature flags...</p>
      ) : flags.length === 0 ? (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ color: colors.textSecondary, marginBottom: "1.5rem" }}>No feature flags found</p>
          <button
            onClick={initializeFlags}
            disabled={loading}
            style={{
              padding: "10px 20px",
              background: colors.success,
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            {loading ? "Initializing..." : "Initialize Feature Flags"}
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {flags.map((flag) => (
            <div
              key={flag.featureName}
              style={{
                background: colors.bgSecondary,
                padding: "1.5rem",
                borderRadius: "8px",
                border: `1px solid ${colors.border}`,
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "600", margin: "0 0 4px 0", textTransform: "capitalize" }}>
                  {flag.featureName.replace(/_/g, " ")}
                </h3>
                {flag.description && (
                  <p style={{ fontSize: "12px", color: colors.textSecondary, margin: 0 }}>
                    {flag.description}
                  </p>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                {/* Admin Test Mode */}
                <div
                  style={{
                    padding: "12px",
                    background: colors.bg,
                    borderRadius: "6px",
                    border: `1px solid ${colors.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "500", marginBottom: "2px" }}>
                      🔒 Admin Test Mode
                    </div>
                    <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                      {flag.adminTestMode ? "ENABLED" : "DISABLED"}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAdminTest(flag.featureName, flag.adminTestMode)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: flag.adminTestMode ? colors.success : colors.danger,
                      fontSize: "20px",
                    }}
                  >
                    {flag.adminTestMode ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                </div>

                {/* Live for Everyone */}
                <div
                  style={{
                    padding: "12px",
                    background: colors.bg,
                    borderRadius: "6px",
                    border: `1px solid ${colors.border}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: "500", marginBottom: "2px" }}>
                      🚀 Live for Everyone
                    </div>
                    <div style={{ fontSize: "11px", color: colors.textSecondary }}>
                      {flag.enabled ? "ENABLED" : "DISABLED"}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleLive(flag.featureName, flag.enabled)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: flag.enabled ? colors.success : colors.danger,
                      fontSize: "20px",
                    }}
                  >
                    {flag.enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                </div>
              </div>

              {/* Status Badge */}
              <div style={{ marginTop: "12px", fontSize: "11px", fontWeight: "500" }}>
                {flag.enabled ? (
                  <span style={{ color: colors.success }}>✓ LIVE FOR EVERYONE</span>
                ) : flag.adminTestMode ? (
                  <span style={{ color: colors.success }}>✓ ADMIN TEST ONLY</span>
                ) : (
                  <span style={{ color: colors.danger }}>✗ DISABLED FOR EVERYONE</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: "2rem", padding: "1rem", background: colors.bgSecondary, borderRadius: "6px", fontSize: "12px", color: colors.textSecondary }}>
        <p style={{ margin: "0 0 8px 0" }}>
          <strong>🔒 Admin Test Mode:</strong> Only you (admin) can see this feature while testing
        </p>
        <p style={{ margin: "0 0 8px 0" }}>
          <strong>🚀 Live for Everyone:</strong> All players can now see and use this feature
        </p>
        <p style={{ margin: 0 }}>
          <strong>✗ Disabled:</strong> Feature is hidden from all players (including admin)
        </p>
      </div>
    </div>
  );
}
