import React from "react";
import { Trophy, TrendingUp, Zap, Heart } from "lucide-react";

/**
 * Empty State Components
 * Show friendly messages when no data is available
 */

export function NoStatsEmptyState({ reason = "default" }: { reason?: "no-matches" | "new-player" | "filtering" | "default" }) {
  const configs = {
    "no-matches": {
      icon: <Trophy size={48} />,
      title: "No Stats Yet",
      message: "Play some matches to see your statistics and performance trends.",
      action: "Start Playing",
      actionColor: "#00d4ff",
    },
    "new-player": {
      icon: <Heart size={48} />,
      title: "Welcome to the Stats Tab!",
      message: "Your statistics will appear here as you play matches across different game modes.",
      action: "Learn More",
      actionColor: "#ffd24a",
    },
    "filtering": {
      icon: <Zap size={48} />,
      title: "No Data in This Period",
      message: "Try adjusting your time filter or selecting a different game category.",
      action: "Change Filters",
      actionColor: "#00e5a0",
    },
    "default": {
      icon: <TrendingUp size={48} />,
      title: "Stats Unavailable",
      message: "Your statistics are being calculated. Check back in a moment!",
      action: "Refresh",
      actionColor: "#a78bfa",
    },
  };

  const config = configs[reason];

  return (
    <div style={{
      padding: "40px 20px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
      background: "rgba(255,255,255,0.01)",
      border: "1px dashed rgba(255,255,255,0.1)",
      borderRadius: "12px",
      minHeight: "300px",
      justifyContent: "center",
    }}>
      <div style={{ opacity: 0.5, color: config.actionColor }}>
        {config.icon}
      </div>
      <div>
        <h3 style={{
          margin: "0 0 8px 0",
          fontSize: "18px",
          fontWeight: "600",
          color: "#fff",
        }}>
          {config.title}
        </h3>
        <p style={{
          margin: "0",
          fontSize: "14px",
          color: "rgba(255,255,255,0.5)",
          maxWidth: "400px",
        }}>
          {config.message}
        </p>
      </div>
      <button style={{
        marginTop: "16px",
        padding: "10px 24px",
        background: `${config.actionColor}15`,
        border: `1px solid ${config.actionColor}40`,
        color: config.actionColor,
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: "600",
        cursor: "pointer",
        fontFamily: "Oswald, sans-serif",
        letterSpacing: "0.06em",
        transition: "all 0.2s",
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = `${config.actionColor}25`;
          (e.currentTarget as HTMLButtonElement).style.borderColor = `${config.actionColor}60`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = `${config.actionColor}15`;
          (e.currentTarget as HTMLButtonElement).style.borderColor = `${config.actionColor}40`;
        }}
      >
        {config.action}
      </button>
    </div>
  );
}

export function NoCardsEmptyState() {
  return (
    <div style={{
      padding: "40px 20px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
      background: "rgba(255,255,255,0.01)",
      border: "1px dashed rgba(255,255,255,0.1)",
      borderRadius: "12px",
      minHeight: "300px",
      justifyContent: "center",
    }}>
      <div style={{ opacity: 0.5, color: "#00d9ff" }}>
        <Zap size={48} />
      </div>
      <div>
        <h3 style={{
          margin: "0 0 8px 0",
          fontSize: "18px",
          fontWeight: "600",
          color: "#fff",
        }}>
          No Cards Yet
        </h3>
        <p style={{
          margin: "0",
          fontSize: "14px",
          color: "rgba(255,255,255,0.5)",
          maxWidth: "400px",
        }}>
          Open card packs in the Card Clash shop to start building your collection.
        </p>
      </div>
      <a href="/card-clash" style={{
        marginTop: "16px",
        padding: "10px 24px",
        background: "#00d9ff15",
        border: "1px solid #00d9ff40",
        color: "#00d9ff",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: "600",
        cursor: "pointer",
        fontFamily: "Oswald, sans-serif",
        letterSpacing: "0.06em",
        textDecoration: "none",
        display: "inline-block",
        transition: "all 0.2s",
      }}>
        Go to Card Shop
      </a>
    </div>
  );
}

export function NoChallengesEmptyState() {
  return (
    <div style={{
      padding: "40px 20px",
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "16px",
      background: "rgba(255,255,255,0.01)",
      border: "1px dashed rgba(255,255,255,0.1)",
      borderRadius: "12px",
      minHeight: "300px",
      justifyContent: "center",
    }}>
      <div style={{ opacity: 0.5, color: "#ffd24a" }}>
        <Trophy size={48} />
      </div>
      <div>
        <h3 style={{
          margin: "0 0 8px 0",
          fontSize: "18px",
          fontWeight: "600",
          color: "#fff",
        }}>
          No Active Challenges
        </h3>
        <p style={{
          margin: "0",
          fontSize: "14px",
          color: "rgba(255,255,255,0.5)",
          maxWidth: "400px",
        }}>
          Daily and weekly challenges refresh throughout the season. Check back soon!
        </p>
      </div>
      <button style={{
        marginTop: "16px",
        padding: "10px 24px",
        background: "#ffd24a15",
        border: "1px solid #ffd24a40",
        color: "#ffd24a",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: "600",
        cursor: "pointer",
        fontFamily: "Oswald, sans-serif",
        letterSpacing: "0.06em",
        transition: "all 0.2s",
      }}
        onClick={() => window.location.reload()}
      >
        Refresh
      </button>
    </div>
  );
}
