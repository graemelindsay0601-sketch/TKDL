import { useState } from "react";
import { Zap } from "lucide-react";

// Note: this file used to also export CardEquipmentIntegration, an earlier
// equip-cards picker superseded by the live CardEquipmentSelector.tsx (used
// in play.tsx before every 1v1/Card Clash match) — removed as a dead
// duplicate. CardEquipmentGuide below is unrelated (a standalone help card,
// not a picker) and is kept since it's harmless and still unplaced rather
// than confirmed dead.
export function CardEquipmentGuide() {
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div style={{
      padding: "16px",
      background: "linear-gradient(135deg, rgba(255,212,74,0.1), rgba(0,229,255,0.1))",
      border: "1px solid rgba(255,212,74,0.3)",
      borderRadius: "8px",
      marginBottom: "16px",
    }}>
      <div style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        cursor: "pointer",
      }}
      onClick={() => setShowDetail(!showDetail)}>
        <Zap size={20} style={{ color: "#ffd24a", marginTop: "2px", flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: "14px",
            fontWeight: "600",
            color: "#fff",
            marginBottom: "4px",
          }}>
            How to Use Cards in Matches
          </div>
          <div style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.6)",
          }}>
            Cards must be equipped before a match starts
          </div>
        </div>
      </div>

      {showDetail && (
        <div style={{
          marginTop: "12px",
          paddingTop: "12px",
          borderTop: "1px solid rgba(255,212,74,0.2)",
        }}>
          <div style={{
            fontSize: "12px",
            color: "rgba(255,255,255,0.8)",
            lineHeight: "1.6",
          }}>
            <div style={{ marginBottom: "8px" }}>
              <strong style={{ color: "#ffd24a" }}>Step 1:</strong> Before starting a match, the equipment screen will show
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong style={{ color: "#ffd24a" }}>Step 2:</strong> Select up to 4 cards (2 good + 2 bad) from your collection
            </div>
            <div style={{ marginBottom: "8px" }}>
              <strong style={{ color: "#ffd24a" }}>Step 3:</strong> Cards are consumed during the match when their effects activate
            </div>
            <div style={{
              marginTop: "12px",
              padding: "8px",
              background: "rgba(0,0,0,0.2)",
              borderRadius: "4px",
              borderLeft: "3px solid #ffd24a",
            }}>
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
                💡 <strong>Pro Tip:</strong> Equip good cards early in the match, bad cards as a counter when needed
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
