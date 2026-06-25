import React, { useState, useEffect } from "react";

const D = {
  card:    "rgba(255,255,255,0.04)",
  border:  "rgba(255,255,255,0.08)",
  text:    "#ffffff",
  sub:     "rgba(255,255,255,0.45)",
  success: "#00ff88",
  danger:  "#ff6b6b",
  warn:    "#ffaa00",
  info:    "#00b4ff",
};

const getAdminHeaders = () => {
  const pin = sessionStorage.getItem("tkdl_admin_pin");
  return { "Content-Type": "application/json", ...(pin ? { "x-admin-pin": pin } : {}) };
};

interface FeatureFlag {
  id: number;
  featureName: string;
  enabled: boolean;
  adminTestMode: boolean;
  description?: string;
}

function Toggle({ on, onChange, color = D.success }: { on: boolean; onChange: () => void; color?: string }) {
  return (
    <button onClick={onChange} style={{ position: "relative", width: "44px", height: "24px", borderRadius: "12px", border: "none", cursor: "pointer", transition: "background 0.2s", background: on ? `${color}55` : "rgba(255,255,255,0.1)", flexShrink: 0, outline: "none" }}>
      <span style={{ position: "absolute", top: "2px", left: on ? "22px" : "2px", width: "20px", height: "20px", borderRadius: "50%", background: on ? color : "rgba(255,255,255,0.4)", transition: "left 0.2s", boxShadow: on ? `0 0 8px ${color}88` : "none" }} />
    </button>
  );
}

export default function AdminFeatureFlagsPanel() {
  const [flags, setFlags]     = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [msgType, setMsgType] = useState<"success" | "error">("success");

  useEffect(() => { loadFlags(); }, []);

  const toast = (msg: string, type: "success" | "error" = "success") => {
    setMessage(msg); setMsgType(type);
    setTimeout(() => setMessage(""), 4000);
  };

  const loadFlags = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/admin/feature-flags", { headers: getAdminHeaders() });
      const d = await r.json();
      setFlags(r.ok && Array.isArray(d) ? d : []);
      if (!r.ok) toast(d.error ?? "Failed to load flags", "error");
    } catch { toast("Failed to load feature flags", "error"); } finally { setLoading(false); }
  };

  const initializeFlags = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/admin/feature-flags/initialize", { method: "POST", headers: getAdminHeaders() });
      if (r.ok) { toast("✅ Feature flags initialized", "success"); loadFlags(); }
      else toast("Failed to initialize flags", "error");
    } catch { toast("Failed to initialize flags", "error"); } finally { setLoading(false); }
  };

  const toggleAdminTest = async (name: string, current: boolean) => {
    const r = await fetch(`/api/admin/feature-flags/${name}/admin-test`, { method: "POST", headers: getAdminHeaders(), body: JSON.stringify({ enabled: !current }) });
    if (r.ok) { toast(`${name}: Admin test ${!current ? "ON" : "OFF"}`, "success"); loadFlags(); }
    else toast("Failed to update", "error");
  };

  const toggleLive = async (name: string, current: boolean) => {
    const endpoint = current ? "disable" : "enable-all";
    const r = await fetch(`/api/admin/feature-flags/${name}/${endpoint}`, { method: "POST", headers: getAdminHeaders() });
    if (r.ok) { toast(`${name}: Now ${!current ? "LIVE 🚀" : "DISABLED"}`, "success"); loadFlags(); }
    else toast("Failed to update", "error");
  };

  const statusText = (flag: FeatureFlag) => {
    if (flag.enabled) return { label: "LIVE FOR EVERYONE", color: D.success };
    if (flag.adminTestMode) return { label: "ADMIN TEST ONLY", color: D.warn };
    return { label: "DISABLED", color: D.danger };
  };

  return (
    <div style={{ padding: "1.5rem", color: D.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, letterSpacing: "0.08em" }}>🚩 FEATURE FLAGS</h2>
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: D.sub }}>Control which features are visible to players</p>
        </div>
        <button onClick={loadFlags} style={{ padding: "7px 14px", borderRadius: "8px", border: `1px solid ${D.border}`, background: D.card, color: D.sub, cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>↻ Refresh</button>
      </div>

      {message && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", marginBottom: "1rem", fontSize: "13px", background: `${msgType === "success" ? D.success : D.danger}14`, border: `1px solid ${msgType === "success" ? D.success : D.danger}44`, color: msgType === "success" ? D.success : D.danger }}>
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem", color: D.sub }}>Loading flags…</div>
      ) : flags.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🚩</div>
          <p style={{ color: D.sub, marginBottom: "1.5rem" }}>No feature flags found in the database.</p>
          <button onClick={initializeFlags} style={{ padding: "10px 24px", borderRadius: "8px", border: "none", background: `${D.success}22`, color: D.success, cursor: "pointer", fontWeight: 700, fontSize: "14px" }}>
            Initialize Feature Flags
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {flags.map(flag => {
            const status = statusText(flag);
            const label = flag.featureName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
            return (
              <div key={flag.featureName} style={{ background: D.card, border: `1px solid ${D.border}`, borderRadius: "10px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", gap: "12px", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "2px" }}>{label}</div>
                    {flag.description && <div style={{ fontSize: "12px", color: D.sub }}>{flag.description}</div>}
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", color: status.color, whiteSpace: "nowrap", padding: "3px 10px", borderRadius: "10px", background: `${status.color}18`, border: `1px solid ${status.color}33` }}>
                    {status.label}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                  {/* Admin test toggle */}
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <Toggle on={flag.adminTestMode} onChange={() => toggleAdminTest(flag.featureName, flag.adminTestMode)} color={D.warn} />
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: D.text }}>🔒 Admin Test</div>
                      <div style={{ fontSize: "11px", color: D.sub }}>Only visible to you</div>
                    </div>
                  </label>

                  {/* Live toggle */}
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <Toggle on={flag.enabled} onChange={() => toggleLive(flag.featureName, flag.enabled)} color={D.success} />
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: D.text }}>🚀 Live for Everyone</div>
                      <div style={{ fontSize: "11px", color: D.sub }}>Visible to all players</div>
                    </div>
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: "1.5rem", padding: "14px 16px", background: D.card, border: `1px solid ${D.border}`, borderRadius: "10px", fontSize: "12px", color: D.sub, lineHeight: 1.6 }}>
        <strong style={{ color: D.warn }}>🔒 Admin Test:</strong> Only you can see the feature — for safe testing before going live.<br />
        <strong style={{ color: D.success }}>🚀 Live:</strong> All players can see and use the feature.<br />
        <strong style={{ color: D.danger }}>✗ Disabled:</strong> Hidden from everyone including admin.
      </div>
    </div>
  );
}
