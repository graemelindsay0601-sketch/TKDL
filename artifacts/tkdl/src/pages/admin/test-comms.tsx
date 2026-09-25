import { useState } from "react";
import { Send, Bell, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleAdminSection } from "./collapsible-section";

// Rewritten alongside the backend route (see routes/admin.ts's own comment
// for the full story) rather than patched — the old version hardcoded
// player ids 1/2 with no existence check (the likely source of the 500s),
// had no admin auth check, wrote fake rows straight into a real DM inbox
// and the real community feed every time it ran, and never actually
// exercised push delivery at all — every "success" only proved a row could
// be inserted, not that anything reached a device. This version fires at
// the logged-in admin's own account, through the real pipeline, and shows
// exactly what the push attempt did or didn't do.
export function TestComms() {
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<any>(null);
  const [error, setError]     = useState<string | null>(null);
  const { toast } = useToast();

  const fire = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res  = await fetch("/api/admin/test-comms", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setResult(data);
        toast({ title: "Test notification sent" });
      } else {
        setError(data.detail ?? data.error ?? "Test failed");
        toast({ title: "Test failed", variant: "destructive" });
      }
    } catch {
      setError("Couldn't reach the server.");
      toast({ title: "Network error", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <CollapsibleAdminSection title="Test Comms (Messaging & Notifications)" icon={Send} accent="#00e5a0">
      <div className="px-4 py-4 space-y-4">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Sends one real notification (with a real push attempt) to your own account through the actual notification pipeline — not fake rows inserted straight into the database. Tells you exactly what happened.
        </p>
        <button
          onClick={fire}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
          style={{ background: loading ? "rgba(0,229,160,0.06)" : "rgba(0,229,160,0.12)", border: "1px solid rgba(0,229,160,0.3)", color: "#00e5a0", fontFamily: "Oswald, sans-serif" }}>
          {loading ? (
            <><div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#00e5a0" }} />Sending…</>
          ) : (
            <><Send className="w-3.5 h-3.5" />Send Test Notification</>
          )}
        </button>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(255,0,92,0.06)", border: "1px solid rgba(255,0,92,0.2)" }}>
            <X className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#ff005c" }} />
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>{error}</div>
          </div>
        )}

        {result && (
          <div className="space-y-2 pt-1">
            {/* #00e5a0, not #22c55e -- matches this page's own success accent
                (the button/spinner above, the push-delivered check below), per
                a 2026-09-25 visual-consistency pass. */}
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "#00e5a0", fontFamily: "Oswald, sans-serif" }}>
              <Bell className="w-3.5 h-3.5" /> Sent to {result.target?.name ?? "your account"} — an in-app notification is waiting for you
            </div>
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg"
              style={{
                background: result.push?.ok ? "rgba(0,229,160,0.08)" : "rgba(255,210,74,0.08)",
                border: `1px solid ${result.push?.ok ? "rgba(0,229,160,0.25)" : "rgba(255,210,74,0.25)"}`,
              }}>
              {result.push?.ok
                ? <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#00e5a0" }} />
                : <X className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "#ffd24a" }} />}
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.5 }}>
                {result.push?.ok
                  ? `Push delivered to ${result.push.sentTo} device${result.push.sentTo === 1 ? "" : "s"} — check for it.`
                  : (result.push?.detail ?? "Push wasn't sent — see the in-app notification instead.")}
              </div>
            </div>
          </div>
        )}
      </div>
    </CollapsibleAdminSection>
  );
}
