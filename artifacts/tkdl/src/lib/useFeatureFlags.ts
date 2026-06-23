import { useState, useEffect } from "react";

interface FeatureStatus {
  available: boolean;
  liveForAll: boolean;
  adminTestMode: boolean;
  isAdmin: boolean;
}

interface FeatureStatuses {
  cardShop: FeatureStatus;
  coins: FeatureStatus;
  cardClash: FeatureStatus;
  isAdmin: boolean;
  userId?: number;
}

const DEFAULT_STATUS: FeatureStatuses = {
  cardShop: { available: false, liveForAll: false, adminTestMode: false, isAdmin: false },
  coins: { available: false, liveForAll: false, adminTestMode: false, isAdmin: false },
  cardClash: { available: false, liveForAll: false, adminTestMode: false, isAdmin: false },
  isAdmin: false,
};

/**
 * Hook to get feature flag status
 * Fetches from /api/card-clash/feature-status
 */
export function useFeatureFlags() {
  const [status, setStatus] = useState<FeatureStatuses>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/card-clash/feature-status");
        const data = await response.json();
        setStatus(data);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch feature status:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch feature status");
        // Use defaults if fetch fails
        setStatus(DEFAULT_STATUS);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, []);

  return {
    isLoading: loading,
    error,
    isCardShopAvailable: status.cardShop.available,
    isCoinsAvailable: status.coins.available,
    isCardClashAvailable: status.cardClash.available,
    isAdmin: status.isAdmin,
    status,
  };
}

/**
 * Component to check if feature is available
 * Shows "Coming Soon" if not available
 */
export function FeatureGate({
  featureName,
  isAvailable,
  children,
  fallback = "This feature is coming soon!",
}: {
  featureName: string;
  isAvailable: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (!isAvailable) {
    return (
      <div
        style={{
          padding: "2rem",
          textAlign: "center",
          background: "var(--color-background-secondary)",
          borderRadius: "var(--border-radius-lg)",
          border: "1px dashed var(--color-border-tertiary)",
        }}
      >
        <h3 style={{ fontSize: "18px", fontWeight: 500, margin: "0 0 8px 0" }}>
          🔒 {featureName}
        </h3>
        <p style={{ fontSize: "14px", color: "var(--color-text-secondary)", margin: 0 }}>
          {fallback}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Quick helper to check if admin (returns null if not admin)
 */
export function AdminOnly({ children, isAdmin }: { children: React.ReactNode; isAdmin: boolean }) {
  if (!isAdmin) {
    return null;
  }
  return <>{children}</>;
}
