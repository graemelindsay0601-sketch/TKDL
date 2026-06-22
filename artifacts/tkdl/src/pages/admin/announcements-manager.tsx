/**
 * Admin Announcements Manager
 * Allows admins to create and send announcements to all players or specific players
 */

import { useState } from "react";
import { Send, AlertCircle, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function AnnouncementsManager() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [critical, setCritical] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const { toast } = useToast();

  const handleSendTest = async () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Error", description: "Title and message are required", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          target_players: null, // Send to all
          critical,
        }),
      });

      if (res.ok) {
        toast({
          title: "✓ Announcement Sent",
          description: "Sent to all active players",
        });
        setTitle("");
        setBody("");
        setCritical(false);
      } else {
        const error = await res.json();
        toast({
          title: "Error",
          description: error.error || "Failed to send",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: "8px",
      padding: "20px",
      color: "#fff",
    }}>
      {/* Header */}
      <div style={{ marginBottom: "20px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", margin: 0, marginBottom: "5px" }}>
          📢 Send Announcement
        </h3>
        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
          Notify all players with an important message
        </p>
      </div>

      {/* Form */}
      <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        {/* Title Input */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., New Season Starts Tomorrow"
            maxLength={100}
            style={{
              width: "100%",
              padding: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              color: "#fff",
              fontSize: "13px",
              boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "3px" }}>
            {title.length}/100
          </div>
        </div>

        {/* Body Input */}
        <div>
          <label style={{ fontSize: "12px", fontWeight: "bold", display: "block", marginBottom: "5px" }}>
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your announcement message here..."
            maxLength={500}
            rows={4}
            style={{
              width: "100%",
              padding: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              color: "#fff",
              fontSize: "13px",
              fontFamily: "monospace",
              boxSizing: "border-box",
              resize: "vertical",
            }}
          />
          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: "3px" }}>
            {body.length}/500
          </div>
        </div>

        {/* Critical Flag */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px",
          background: "rgba(255,0,92,0.05)",
          border: "1px solid rgba(255,0,92,0.2)",
          borderRadius: "4px",
        }}>
          <input
            type="checkbox"
            id="critical"
            checked={critical}
            onChange={(e) => setCritical(e.target.checked)}
            style={{ cursor: "pointer", width: "16px", height: "16px" }}
          />
          <label htmlFor="critical" style={{ fontSize: "12px", cursor: "pointer", flex: 1, margin: 0 }}>
            🔴 Critical (overrides quiet hours & daily limit)
          </label>
        </div>

        {/* Preview */}
        <div
          onClick={() => setPreviewOpen(!previewOpen)}
          style={{
            padding: "10px",
            background: "rgba(0,229,160,0.05)",
            border: "1px solid rgba(0,229,160,0.2)",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            color: "#00e5a0",
            textAlign: "center",
          }}
        >
          {previewOpen ? "▼ Hide Preview" : "▶ Show Preview"}
        </div>

        {previewOpen && (
          <div style={{
            padding: "12px",
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "4px",
            fontSize: "12px",
          }}>
            <div style={{ color: "#ffd24a", fontWeight: "bold", marginBottom: "5px" }}>
              {title || "(No title)"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.7)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {body || "(No message)"}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={handleSendTest}
            disabled={sending || !title.trim() || !body.trim()}
            style={{
              flex: 1,
              padding: "10px",
              background: sending || !title.trim() || !body.trim() ? "rgba(255,0,92,0.3)" : "#ff005c",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: "bold",
              cursor: sending || !title.trim() || !body.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <Send size={14} />
            {sending ? "Sending..." : "Send to All Players"}
          </button>
        </div>

        {/* Info */}
        <div style={{
          padding: "10px",
          background: "rgba(74,158,255,0.05)",
          border: "1px solid rgba(74,158,255,0.2)",
          borderRadius: "4px",
          fontSize: "11px",
          color: "rgba(255,255,255,0.6)",
          display: "flex",
          gap: "8px",
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            Announcement will be sent to all active players. Critical announcements bypass quiet hours (11pm-8am) and daily notification limits.
          </div>
        </div>
      </div>
    </div>
  );
}
