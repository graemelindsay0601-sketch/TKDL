import { useState } from "react";
import { Send, MessageSquare, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleAdminSection } from "./collapsible-section";

export function TestComms() {
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState<any>(null);
  const { toast } = useToast();

  const fire = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res  = await fetch("/api/admin/test-comms", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setResult(data.sent);
        toast({ title: "Test data fired! Log in as Graeme to verify." });
      } else {
        toast({ title: "Test failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <CollapsibleAdminSection title="Test Comms (Messaging & Notifications)" icon={Send} accent="#00e5a0">
      <div className="px-4 py-4 space-y-4">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Fires fake test data to <strong style={{ color: "#fff" }}>Graeme</strong>: a DM from Sean, 3 notifications (DM received, post liked, post commented), and an approved community post. Also enables messaging, notifications, and community if they're off.
        </p>
        <button
          onClick={fire}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
          style={{ background: loading ? "rgba(0,229,160,0.06)" : "rgba(0,229,160,0.12)", border: "1px solid rgba(0,229,160,0.3)", color: "#00e5a0", fontFamily: "Oswald, sans-serif" }}>
          {loading ? (
            <><div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#00e5a0" }} />Firing…</>
          ) : (
            <><Send className="w-3.5 h-3.5" />Fire Test Data → Graeme</>
          )}
        </button>
        {result && (
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "#22c55e", fontFamily: "Oswald, sans-serif" }}>
              ✓ SENT — now log in as Graeme to check
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl p-3 text-center" style={{ background: "rgba(0,229,160,0.05)", border: "1px solid rgba(0,229,160,0.15)" }}>
                <MessageSquare className="w-4 h-4 mx-auto mb-1" style={{ color: "#00e5a0" }} />
                <div className="text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>1 DM</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>from Sean</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: "rgba(0,229,160,0.05)", border: "1px solid rgba(0,229,160,0.15)" }}>
                <Bell className="w-4 h-4 mx-auto mb-1" style={{ color: "#00e5a0" }} />
                <div className="text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>3 Alerts</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>notifications</div>
              </div>
              <div className="rounded-xl p-3 text-center" style={{ background: "rgba(0,229,160,0.05)", border: "1px solid rgba(0,229,160,0.15)" }}>
                <Send className="w-4 h-4 mx-auto mb-1" style={{ color: "#00e5a0" }} />
                <div className="text-xs font-bold" style={{ fontFamily: "Oswald, sans-serif", color: "#fff" }}>1 Post</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>community feed</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </CollapsibleAdminSection>
  );
}
