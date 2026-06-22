/**
 * Notification Center Component
 * Displays notification history and preferences in player profile
 */

import { useState, useEffect } from "react";
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
  coach_tips: boolean;
  announcements: boolean;
  private_mode: boolean;
}

export function NotificationCenter({ playerId }: { playerId: number }) {
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
      const res = await fetch(`/api/players/${playerId}/notification-prefs`);
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

          {/* Per-type toggles */}
          {[
            { key: "match_results", label: "Match Results" },
            { key: "rank_changes", label: "Rank Changes" },
            { key: "coach_tips", label: "Coach Tips" },
            { key: "announcements", label: "Announcements" },
          ].map(({ key, label }) => (
            <div
              key={key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
                fontSize: "12px",
              }}
            >
              <label style={{ cursor: "pointer" }}>{label}</label>
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
                    onClick={() => handleMarkRead(notif.id)}
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
                  onClick={() => handleDelete(notif.id)}
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
