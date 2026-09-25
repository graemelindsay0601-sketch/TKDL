/**
 * Admin Announcements Manager
 * Allows admins to create and send announcements to all players or specific players
 */

import { useState } from "react";
import { Send, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleAdminSection } from "./collapsible-section";

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
    // Brought onto the shared CollapsibleAdminSection wrapper (same as
    // SeasonEditor/ShiftWarsAdmin/etc. below it on the admin page) instead
    // of a hand-rolled collapse button — same behavior, consistent chrome.
    //
    // Typography/spacing brought into line with the rest of the admin
    // section (Oswald headers/labels/buttons, Tailwind rem-based classes
    // instead of raw px inline styles) in a 2026-09-25 visual-consistency
    // pass — this file previously used no Oswald at all and was visibly
    // out of step with every other admin panel. Colors/behavior unchanged.
    <CollapsibleAdminSection title="Send Announcement" icon={Send} accent="#ff005c">
      <div className="px-4 py-4 space-y-4">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Notify all players with an important message
        </p>

        {/* Form */}
        <div className="space-y-4">
          {/* Title Input */}
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., New Season Starts Tomorrow"
              maxLength={100}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}
            />
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              {title.length}/100
            </div>
          </div>

          {/* Body Input */}
          <div>
            <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: "rgba(255,255,255,0.35)", fontFamily: "Oswald, sans-serif" }}>
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your announcement message here..."
              maxLength={500}
              rows={4}
              className="w-full px-3 py-2 rounded-lg text-sm resize-y"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", fontFamily: "monospace" }}
            />
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
              {body.length}/500
            </div>
          </div>

          {/* Critical Flag */}
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: "rgba(255,0,92,0.05)", border: "1px solid rgba(255,0,92,0.2)" }}>
            <input
              type="checkbox"
              id="critical"
              checked={critical}
              onChange={(e) => setCritical(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <label htmlFor="critical" className="text-xs cursor-pointer flex-1">
              🔴 Critical (overrides quiet hours & daily limit)
            </label>
          </div>

          {/* Preview */}
          <div
            onClick={() => setPreviewOpen(!previewOpen)}
            className="px-3 py-2 rounded-lg cursor-pointer text-xs uppercase tracking-wider text-center"
            style={{ background: "rgba(0,229,160,0.05)", border: "1px solid rgba(0,229,160,0.2)", color: "#00e5a0", fontFamily: "Oswald, sans-serif" }}
          >
            {previewOpen ? "▼ Hide Preview" : "▶ Show Preview"}
          </div>

          {previewOpen && (
            <div className="px-3 py-3 rounded-lg text-xs" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="font-bold mb-1" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
                {title || "(No title)"}
              </div>
              <div style={{ color: "rgba(255,255,255,0.7)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {body || "(No message)"}
              </div>
            </div>
          )}

          {/* Buttons */}
          <button
            onClick={handleSendTest}
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: sending || !title.trim() || !body.trim() ? "rgba(255,0,92,0.3)" : "#ff005c",
              color: "#fff",
              fontFamily: "Oswald, sans-serif",
            }}
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? "Sending..." : "Send to All Players"}
          </button>

          {/* Info */}
          <div className="flex gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(74,158,255,0.05)", border: "1px solid rgba(74,158,255,0.2)", color: "rgba(255,255,255,0.6)" }}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <div>
              Announcement will be sent to all active players. Critical announcements bypass quiet hours (11pm-8am) and daily notification limits.
            </div>
          </div>
        </div>
      </div>
    </CollapsibleAdminSection>
  );
}
