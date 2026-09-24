/**
 * Notification Center Component
 * Displays notification history and preferences in player profile
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { X, Bell, Trash2, Settings, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data?: Record<string, any>;
}

interface NotificationPreferences {
  push_enabled: boolean;
  match_results: boolean;
  rank_changes: boolean;
  threat_alerts: boolean;
  coach_tips: boolean;
  announcements: boolean;
  private_mode: boolean;
  direct_messages: boolean;
  achievements: boolean;
  community_activity: boolean;
}

export function NotificationCenter({ playerId }: { playerId: number }) {
  const [, navigate] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Load notifications
  useEffect(() => {
    fetchNotifications();
    fetchPreferences();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?limit=50`);
      if (res.ok) {
        setNotifications(await res.json());
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const res = await fetch(`/api/players/${playerId}/notification-prefs`, { credentials: "include" });
      if (res.ok) {
        setPreferences(await res.json());
      }
    } catch (err) {
      console.error("Failed to load preferences", err);
    }
  };

  const handleMarkRead = async (notificationId: number) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });
      if (res.ok) {
        setNotifications(notifications.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        ));
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to mark as read", variant: "destructive" });
    }
  };

  const handleDelete = async (notificationId: number) => {
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setNotifications(notifications.filter(n => n.id !== notificationId));
        toast({ title: "Notification deleted" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/players/${playerId}/notification-prefs`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });
      if (res.ok) {
        toast({ title: "Preferences saved" });
        setShowPrefs(false);
      } else {
        toast({ title: "Error", description: "Failed to save", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      match_result: "Match Result",
      rank_change: "Rank Change",
      threat_alert: "Threat Alert",
      coach_tip: "Coach Tip",
      announcement: "Announcement",
      dm_received: "Message",
      achievement_unlocked: "Achievement",
      post_approved: "Community",
      post_liked: "Community",
      post_commented: "Community",
      auto_post_fired: "Community",
      interview_invite: "Interview Desk",
    };
    return labels[type] || type;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      match_result: "#ff005c",
      rank_change: "#ffd24a",
      threat_alert: "#ff7f00",
      coach_tip: "#00e5a0",
      announcement: "#4d94ff",
      dm_received: "#c084fc",
      achievement_unlocked: "#ffd24a",
      post_approved: "#22c55e",
      post_liked: "#22c55e",
      post_commented: "#22c55e",
      auto_post_fired: "#22c55e",
      interview_invite: "#0066ff",
    };
    return colors[type] || "#9ca3af";
  };

  const relativeTime = (ts: string) => {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div style={{ padding: "20px", color: "#fff" }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        paddingBottom: "15px",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Bell size={20} style={{ color: "#ff005c" }} />
          <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0 }}>Notifications</h3>
        </div>
        <button
          onClick={() => setShowPrefs(!showPrefs)}
          style={{
            background: "none",
            border: "none",
            color: "#ffd24a",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "12px",
          }}
        >
          <Settings size={16} />
          Preferences
        </button>
      </div>

      {/* Preferences Panel */}
      {showPrefs && preferences && (
        <div style={{
          background: "rgba(255,0,92,0.05)",
          border: "1px solid rgba(255,0,92,0.2)",
          borderRadius: "8px",
          padding: "15px",
          marginBottom: "20px",
        }}>
          <h4 style={{ margin: "0 0 15px 0", fontSize: "14px" }}>Notification Preferences</h4>

          {/* Master toggle */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            marginBottom: "10px",
          }}>
            <label style={{ fontSize: "12px", cursor: "pointer" }}>All Notifications</label>
            <input
              type="checkbox"
              checked={preferences.push_enabled}
              onChange={(e) =>
                setPreferences({ ...preferences, push_enabled: e.target.checked })
              }
              style={{ cursor: "pointer", width: "16px", height: "16px" }}
            />
          </div>

          {/* Per-type toggles, each with what actually fires it spelled out —
              this used to just be a bare label ("Rank Changes (Singles)")
              that was also stale: sendRankChangeNotifications() has been
              wired into Doubles, Shift Wars and team matches too (see
              routes/doubles.ts, shift-wars.ts, team-matches.ts), not just
              routes/matches.ts. Naming the real trigger for each type here
              is the answer to "what actually counts as a notification" —
              it shouldn't require reading the source to find out. */}
          {[
            { key: "match_results", label: "Match Results", detail: "A singles, doubles or Shift Wars match you were in gets recorded." },
            { key: "rank_changes", label: "Rank Changes", detail: "Your position moves on the singles, doubles or Shift Wars leaderboard." },
            { key: "threat_alerts", label: "Close Match Alerts", detail: "Someone closes to within 15 points of your rank." },
            { key: "direct_messages", label: "Direct Messages", detail: "Another player sends you a message." },
            { key: "achievements", label: "Achievement Unlocks", detail: "You unlock an achievement, in any system (league, Master-501, Shadow Bot, Boss Battle, Doubles, Shift Wars, Practice, Board Curse)." },
            { key: "community_activity", label: "Community Activity", detail: "Someone likes or comments on your post, or your post is approved." },
            { key: "coach_tips", label: "Coach Tips", detail: "The scheduled daily coaching tip goes out." },
            { key: "announcements", label: "League Announcements", detail: "An admin sends a league-wide announcement." },
          ].map(({ key, label, detail }) => (
            <div
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px",
                padding: "8px 0",
                fontSize: "12px",
              }}
            >
              <label style={{ cursor: "pointer" }}>
                <div>{label}</div>
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "2px", lineHeight: 1.4 }}>{detail}</div>
              </label>
              <input
                type="checkbox"
                checked={(preferences as any)[key]}
                onChange={(e) =>
                  setPreferences({
                    ...preferences,
                    [key]: e.target.checked,
                  })
                }
                disabled={!preferences.push_enabled}
                style={{
                  cursor: preferences.push_enabled ? "pointer" : "not-allowed",
                  width: "16px",
                  height: "16px",
                  opacity: preferences.push_enabled ? 1 : 0.5,
                  flexShrink: 0,
                  marginTop: "2px",
                }}
              />
            </div>
          ))}

          {/* Privacy mode */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            marginTop: "10px",
            fontSize: "12px",
          }}>
            <label style={{ cursor: "pointer" }}>Private Mode (don't share publicly)</label>
            <input
              type="checkbox"
              checked={preferences.private_mode}
              onChange={(e) =>
                setPreferences({ ...preferences, private_mode: e.target.checked })
              }
              style={{ cursor: "pointer", width: "16px", height: "16px" }}
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSavePreferences}
            disabled={saving}
            style={{
              marginTop: "15px",
              width: "100%",
              padding: "8px",
              background: saving ? "rgba(255,0,92,0.3)" : "#ff005c",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: "bold",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save Preferences"}
          </button>
        </div>
      )}

      {/* Notifications List */}
      <div style={{ maxHeight: "400px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.5)" }}>
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px", color: "rgba(255,255,255,0.5)" }}>
            No notifications yet
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={notif.data?.url ? () => { if (!notif.read) handleMarkRead(notif.id); navigate(notif.data!.url); } : undefined}
              style={{
                background: notif.read ? "transparent" : "rgba(255,0,92,0.05)",
                border: `1px solid rgba(${notif.read ? "255,255,255,0.1" : "255,0,92,0.3"})`,
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "10px",
                cursor: notif.data?.url ? "pointer" : "default",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Type badge */}
                <div style={{
                  display: "inline-block",
                  background: getTypeColor(notif.type),
                  color: "#000",
                  padding: "2px 8px",
                  borderRadius: "3px",
                  fontSize: "10px",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}>
                  {getTypeLabel(notif.type)}
                </div>

                {/* Title */}
                <h5 style={{
                  margin: "5px 0",
                  fontSize: "13px",
                  fontWeight: notif.read ? "normal" : "bold",
                  wordBreak: "break-word",
                }}>
                  {notif.title}
                </h5>

                {/* Body */}
                <p style={{
                  margin: "5px 0",
                  fontSize: "12px",
                  color: "rgba(255,255,255,0.7)",
                  wordBreak: "break-word",
                }}>
                  {notif.body}
                </p>

                {/* Time */}
                <div style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.4)",
                  marginTop: "5px",
                }}>
                  {relativeTime(notif.created_at)}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                {!notif.read && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMarkRead(notif.id); }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#00e5a0",
                      cursor: "pointer",
                      padding: "4px",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Mark as read"
                  >
                    <Check size={14} />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(notif.id); }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ff7f00",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                  }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
