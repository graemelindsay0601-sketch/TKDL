import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Clock, Zap } from "lucide-react";

interface PracticeSession {
  id: number;
  gameType: string;
  dartsThrown: number;
  durationSeconds: number;
  p1Score: number;
  p1_180s: number;
  p1CheckoutHits: number;
  p1CheckoutAttempts: number;
  createdAt: string;
  detail: string;
  opponent: string;
}

interface SessionDetail {
  id: number;
  gameType: string;
  dartsThrown: number;
  durationSeconds: number;
  p1Score: number;
  p1_180s: number;
  p1CheckoutHits: number;
  p1CheckoutAttempts: number;
  createdAt: string;
  dartLog: number[];
  avgDartValue: number;
}

interface SessionHistoryProps {
  playerId: number;
}

export function SessionHistory({ playerId }: SessionHistoryProps) {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [sessionDetails, setSessionDetails] = useState<Record<number, SessionDetail>>({});
  const [detailLoading, setDetailLoading] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/players/${playerId}/stats/sessions?limit=30`);
        const data = await response.json();
        setSessions(data);
      } catch (err) {
        console.error("Failed to load sessions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [playerId]);

  const handleExpand = async (sessionId: number) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      return;
    }

    setExpandedSession(sessionId);

    if (sessionDetails[sessionId]) return;

    try {
      setDetailLoading(prev => ({ ...prev, [sessionId]: true }));
      const response = await fetch(`/api/players/${playerId}/stats/sessions/${sessionId}`);
      const data = await response.json();
      setSessionDetails(prev => ({ ...prev, [sessionId]: data }));
    } catch (err) {
      console.error(`Failed to load session detail:`, err);
    } finally {
      setDetailLoading(prev => ({ ...prev, [sessionId]: false }));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)" }}>
        Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={{ padding: "16px", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
        No practice sessions yet
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {sessions.map(session => (
        <div key={session.id}>
          {/* Session Header */}
          <button
            onClick={() => handleExpand(session.id)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              padding: "12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "white",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, textAlign: "left" }}>
              {expandedSession === session.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              <div>
                <div style={{ fontWeight: "600", fontSize: "14px" }}>{session.gameType}</div>
                <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                  {new Date(session.createdAt).toLocaleDateString()} at {new Date(session.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", fontSize: "12px", color: "rgba(255,255,255,0.6)" }}>
              <span>📊 {session.dartsThrown || 0} darts</span>
              <span>⚡ {session.p1_180s || 0} 180s</span>
              <span>🎯 {session.p1CheckoutHits || 0} checkouts</span>
            </div>
          </button>

          {/* Expanded Details */}
          {expandedSession === session.id && (
            <div style={{
              padding: "12px",
              background: "rgba(255,255,255,0.01)",
              marginTop: "4px",
              borderRadius: "4px",
              borderLeft: "3px solid rgba(255,0,92,0.3)",
            }}>
              {detailLoading[session.id] ? (
                <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>Loading details...</div>
              ) : sessionDetails[session.id] ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Stats Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                    <div style={{
                      background: "rgba(255,255,255,0.03)",
                      padding: "8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}>
                      <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: "2px" }}>Score</div>
                      <div style={{ fontSize: "16px", fontWeight: "600" }}>{sessionDetails[session.id]!.p1Score}</div>
                    </div>
                    <div style={{
                      background: "rgba(255,255,255,0.03)",
                      padding: "8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}>
                      <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: "2px" }}>Duration</div>
                      <div style={{ fontSize: "16px", fontWeight: "600" }}>{formatDuration(sessionDetails[session.id]!.durationSeconds)}</div>
                    </div>
                    <div style={{
                      background: "rgba(255,255,255,0.03)",
                      padding: "8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}>
                      <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: "2px" }}>Avg Dart Value</div>
                      <div style={{ fontSize: "16px", fontWeight: "600" }}>{sessionDetails[session.id]!.avgDartValue.toFixed(1)}</div>
                    </div>
                    <div style={{
                      background: "rgba(255,255,255,0.03)",
                      padding: "8px",
                      borderRadius: "4px",
                      fontSize: "12px",
                    }}>
                      <div style={{ color: "rgba(255,255,255,0.5)", marginBottom: "2px" }}>Checkout %</div>
                      <div style={{ fontSize: "16px", fontWeight: "600" }}>
                        {sessionDetails[session.id]!.p1CheckoutAttempts > 0
                          ? ((sessionDetails[session.id]!.p1CheckoutHits / sessionDetails[session.id]!.p1CheckoutAttempts) * 100).toFixed(0)
                          : "0"}%
                      </div>
                    </div>
                  </div>

                  {/* Dart Log */}
                  {sessionDetails[session.id]!.dartLog.length > 0 && (
                    <div>
                      <div style={{ fontSize: "11px", fontWeight: "600", color: "rgba(255,255,255,0.5)", marginBottom: "6px", textTransform: "uppercase" }}>
                        Dart Sequence (first {Math.min(30, sessionDetails[session.id]!.dartLog.length)})
                      </div>
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(10, 1fr)",
                        gap: "4px",
                      }}>
                        {sessionDetails[session.id]!.dartLog.slice(0, 30).map((dart, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: "4px",
                              padding: "4px",
                              textAlign: "center",
                              fontSize: "11px",
                              fontWeight: "500",
                              color: dart === 20 ? "#ffd24a" : dart >= 15 ? "#00e5a0" : "rgba(255,255,255,0.6)",
                            }}
                          >
                            {dart}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
