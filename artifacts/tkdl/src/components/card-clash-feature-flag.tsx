import React, { useState } from "react";

interface CardClashFeatureFlagProps {
  isAdmin: boolean;
  onToggle?: (enabled: boolean) => void;
}

export default function CardClashFeatureFlag({
  isAdmin,
  onToggle,
}: CardClashFeatureFlagProps) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!isAdmin) return;

    try {
      setLoading(true);
      // TODO: Connect to actual API endpoint for feature flag
      const newState = !enabled;
      setEnabled(newState);
      onToggle?.(newState);
    } catch (error) {
      console.error("Failed to toggle Card Clash:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ padding: "1rem", color: "var(--color-text-secondary)" }}>
        <p>Card Clash feature flag management is admin-only.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "var(--color-background-secondary)",
        padding: "1.5rem",
        borderRadius: "var(--border-radius-lg)",
        border: "0.5px solid var(--color-border-tertiary)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: 500, margin: "0 0 4px 0" }}>
            🎴 Card Clash Feature
          </h3>
          <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", margin: 0 }}>
            {enabled
              ? "Public - All players can see Card Clash"
              : "Admin Only - Only admins can test Card Clash"}
          </p>
        </div>

        <button
          onClick={handleToggle}
          disabled={loading}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--border-radius-md)",
            border: "0.5px solid var(--color-border-tertiary)",
            background: enabled
              ? "var(--color-background-success)"
              : "var(--color-background-secondary)",
            color: enabled ? "white" : "var(--color-text-primary)",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          {enabled ? "🟢 Public" : "🔒 Admin Only"}
        </button>
      </div>
    </div>
  );
}
