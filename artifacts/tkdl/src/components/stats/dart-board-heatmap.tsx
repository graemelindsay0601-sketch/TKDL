import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";

interface DartBoardHeatmapProps {
  playerId: number;
  category?: "M501" | "Tour" | "Practice" | "League";
}

interface HeatmapData {
  segments: Record<number, number>; // segment -> hit count
  maxHits: number;
  weakSpots: { segment: number; hits: number; potential: string }[];
  strongSpots: { segment: number; hits: number }[];
}

export function DartBoardHeatmap({ playerId, category = "Practice" }: DartBoardHeatmapProps) {
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const response = await fetch(
          `/api/players/${playerId}/stats/category/${category}/darts`
        );
        const dartData = await response.json();

        // Convert dart frequencies to heatmap
        const segments: Record<number, number> = {};
        const frequencies = dartData.allTargetFrequencies || [];

        frequencies.forEach((freq: any) => {
          segments[freq.target] = freq.hits || 0;
        });

        const maxHits = Math.max(...Object.values(segments), 1);

        // Identify weak and strong spots
        const sorted = Object.entries(segments)
          .map(([seg, hits]) => ({ segment: parseInt(seg), hits: hits as number }))
          .sort((a, b) => b.hits - a.hits);

        const weakSpots = sorted.slice(-3).reverse().map(s => ({
          ...s,
          potential: s.segment === 20 ? "Huge upside!" : s.segment === 19 ? "Key area" : "Secondary target",
        }));

        const strongSpots = sorted.slice(0, 3);

        setHeatmap({
          segments,
          maxHits,
          weakSpots,
          strongSpots,
        });
      } catch (err) {
        console.error("Failed to load dart heatmap:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHeatmap();
  }, [playerId, category]);

  if (loading) {
    return <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>Loading heatmap...</div>;
  }

  if (!heatmap) {
    return <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>No dart data available</div>;
  }

  const getHeatColor = (hits: number) => {
    const ratio = hits / heatmap.maxHits;
    if (ratio === 0) return "rgba(255,255,255,0.05)";
    if (ratio > 0.8) return "#ff005c";
    if (ratio > 0.6) return "#ffd24a";
    if (ratio > 0.4) return "#a855f7";
    if (ratio > 0.2) return "#00e5a0";
    return "rgba(255,255,255,0.1)";
  };

  // Dart board layout (standard positions)
  const boardLayout = [
    { angle: 0, segment: 20 },
    { angle: 18, segment: 1 },
    { angle: 36, segment: 18 },
    { angle: 54, segment: 4 },
    { angle: 72, segment: 13 },
    { angle: 90, segment: 6 },
    { angle: 108, segment: 10 },
    { angle: 126, segment: 15 },
    { angle: 144, segment: 2 },
    { angle: 162, segment: 17 },
    { angle: 180, segment: 3 },
    { angle: 198, segment: 19 },
    { angle: 216, segment: 7 },
    { angle: 234, segment: 16 },
    { angle: 252, segment: 8 },
    { angle: 270, segment: 11 },
    { angle: 288, segment: 14 },
    { angle: 306, segment: 9 },
    { angle: 324, segment: 12 },
    { angle: 342, segment: 5 },
  ];

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      padding: "20px",
    }}>
      {/* Title */}
      <div style={{ fontSize: "14px", fontWeight: "600", marginBottom: "16px", color: "rgba(255,255,255,0.8)" }}>
        🎯 Your Targeting Pattern
      </div>

      {/* Dartboard Visualization */}
      <div style={{ marginBottom: "20px", textAlign: "center" }}>
        <svg
          width="300"
          height="300"
          viewBox="0 0 300 300"
          style={{ margin: "0 auto", display: "block" }}
        >
          {/* Outer ring */}
          <circle cx="150" cy="150" r="140" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />

          {/* Board segments */}
          {boardLayout.map((item) => {
            const hits = heatmap.segments[item.segment] || 0;
            const color = getHeatColor(hits);
            const rad = (item.angle * Math.PI) / 180;
            const x = 150 + 100 * Math.cos(rad);
            const y = 150 + 100 * Math.sin(rad);

            return (
              <g key={item.segment}>
                {/* Segment circle */}
                <circle
                  cx={x}
                  cy={y}
                  r="18"
                  fill={color}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="1"
                />
                {/* Segment number */}
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="14"
                  fontWeight="600"
                  fill={hits > heatmap.maxHits * 0.6 ? "#000" : "#fff"}
                  opacity={hits === 0 ? 0.3 : 1}
                >
                  {item.segment}
                </text>
              </g>
            );
          })}

          {/* Center bullseye */}
          <circle cx="150" cy="150" r="12" fill="rgba(255,255,255,0.1)" />
        </svg>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        gap: "12px",
        justifyContent: "center",
        marginBottom: "16px",
        fontSize: "11px",
        flexWrap: "wrap",
      }}>
        {[
          { color: "#ff005c", label: "Most Hit" },
          { color: "#ffd24a", label: "High" },
          { color: "#a855f7", label: "Medium" },
          { color: "#00e5a0", label: "Low" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <div style={{
              width: "12px",
              height: "12px",
              borderRadius: "2px",
              background: item.color,
            }}></div>
            <span style={{ color: "rgba(255,255,255,0.6)" }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Weak Spots Alert */}
      {heatmap.weakSpots.length > 0 && (
        <div style={{
          background: "rgba(255,0,92,0.08)",
          border: "1px solid rgba(255,0,92,0.2)",
          borderRadius: "8px",
          padding: "12px",
          marginBottom: "12px",
        }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
            <AlertCircle size={14} style={{ color: "#ff005c", marginTop: "2px", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "12px", fontWeight: "600", color: "#ff005c", marginBottom: "4px" }}>
                Weak Spots Identified
              </div>
              {heatmap.weakSpots.map((spot) => (
                <div key={spot.segment} style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", lineHeight: 1.4 }}>
                  <strong>{spot.segment}</strong> ({spot.hits} hits) — {spot.potential}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Strong Spots */}
      {heatmap.strongSpots.length > 0 && (
        <div style={{
          background: "rgba(0,229,160,0.08)",
          border: "1px solid rgba(0,229,160,0.2)",
          borderRadius: "8px",
          padding: "12px",
        }}>
          <div style={{ fontSize: "12px", fontWeight: "600", color: "#00e5a0", marginBottom: "6px" }}>
            ✓ Your Strong Areas
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {heatmap.strongSpots.map((spot) => (
              <div key={spot.segment} style={{
                background: "rgba(0,229,160,0.15)",
                border: "1px solid rgba(0,229,160,0.3)",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "11px",
                fontWeight: "600",
                color: "#00e5a0",
              }}>
                {spot.segment} ({spot.hits}x)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
