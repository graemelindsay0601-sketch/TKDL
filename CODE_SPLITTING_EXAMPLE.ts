// CODE SPLITTING GUIDE FOR ACCOUNT.tsx
//
// Convert from:
//   import { CategoryStatsEnhanced } from "@/components/stats"
//   <CategoryStatsEnhanced ... />
//
// To:
//   const CategoryStatsEnhanced = lazy(() => import("@/components/stats").then(m => ({ default: m.CategoryStatsEnhanced })))
//   <Suspense fallback={<LoadingSpinner />}>
//     <CategoryStatsEnhanced ... />
//   </Suspense>
//
// This makes the component load only when the tab opens, not on initial load

import { lazy, Suspense, useState } from "react";

// Lazy load heavy components - they'll only be downloaded when tab opens
const CategoryStatsEnhanced = lazy(() =>
  import("@/components/stats").then(m => ({ default: m.CategoryStatsEnhanced }))
);

const AdvancedAnalyticsDashboard = lazy(() =>
  import("@/components/stats").then(m => ({ default: m.AdvancedAnalyticsDashboard }))
);

// Lightweight loading spinner
function TabContentLoading() {
  return (
    <div style={{
      padding: "40px",
      textAlign: "center",
      color: "rgba(255,255,255,0.5)",
    }}>
      <div style={{ fontSize: "14px", marginBottom: "20px" }}>Loading...</div>
      <div style={{
        width: "30px",
        height: "30px",
        border: "2px solid rgba(255,0,92,0.2)",
        borderTop: "2px solid #ff005c",
        borderRadius: "50%",
        margin: "0 auto",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Then in your render, wrap with Suspense:
// <Suspense fallback={<TabContentLoading />}>
//   <CategoryStatsEnhanced playerId={playerId} />
// </Suspense>
//
// This defers loading the component until it's actually needed
