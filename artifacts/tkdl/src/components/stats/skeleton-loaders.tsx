import React from "react";

/**
 * Skeleton Loader Components for smooth loading states
 * Usage: Replace content during loading for better perceived performance
 */

export function SkeletonPulse({ width = "100%", height = "20px", className = "" }) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        background: "linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 2s infinite",
        borderRadius: "6px",
      }}
    />
  );
}

export function StatsSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        <SkeletonPulse width="120px" height="32px" />
        <SkeletonPulse width="80px" height="28px" />
      </div>

      {/* Stats grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "12px",
      }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            padding: "16px",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "8px",
          }}>
            <SkeletonPulse height="24px" style={{ marginBottom: "8px" }} />
            <SkeletonPulse height="16px" width="80%" />
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div style={{
        padding: "16px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: "8px",
        minHeight: "300px",
      }}>
        <SkeletonPulse height="24px" style={{ marginBottom: "16px" }} width="40%" />
        <SkeletonPulse height="200px" style={{ marginBottom: "8px" }} />
      </div>
    </div>
  );
}

export function CardGridSkeleton() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
      gap: "12px",
    }}>
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          aspectRatio: "3/4",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: "8px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}>
          <SkeletonPulse height="40px" />
          <SkeletonPulse height="16px" width="70%" />
          <SkeletonPulse height="14px" width="50%" style={{ marginTop: "auto" }} />
        </div>
      ))}
    </div>
  );
}

export function ChallengesSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{
          padding: "16px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.05)",
          borderRadius: "8px",
          display: "flex",
          gap: "12px",
        }}>
          <SkeletonPulse width="60px" height="60px" />
          <div style={{ flex: 1 }}>
            <SkeletonPulse height="20px" style={{ marginBottom: "8px" }} />
            <SkeletonPulse height="16px" width="80%" />
            <SkeletonPulse height="14px" width="60%" style={{ marginTop: "8px" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// CSS animation for shimmer effect - add to global styles
export const shimmerCSS = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;
