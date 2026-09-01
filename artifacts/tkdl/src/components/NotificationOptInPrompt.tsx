import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useAuth } from "@/context/auth";
import { usePushNotifications } from "@/hooks/use-push-notifications";

/**
 * First-use "want push notifications?" card — the piece that was missing
 * even though the underlying push pipeline (usePushNotifications, the
 * Enable/Disable widget on the account page, the service worker) already
 * existed. Without this, a player only ever saw that widget if they dug
 * into Account → Social → Notifications themselves, so almost nobody ever
 * subscribed. This surfaces the same subscribe() call app-wide, once, the
 * first time a logged-in player who hasn't decided yet lands on any page.
 *
 * Mounted once in Layout so it shows regardless of which page the player
 * lands on after logging in — but only ever asks once per browser per
 * player: the choice (or dismissal) is remembered in localStorage, and the
 * real "Enable/Turn Off" control on the account page is always there if
 * someone wants to change their mind later.
 */
const dismissedKey = (playerId: number) => `tkdl-notif-prompt-dismissed-${playerId}`;

export function NotificationOptInPrompt() {
  const { user } = useAuth();
  const push = usePushNotifications(user?.playerId);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!user?.playerId) { setDismissed(true); return; }
    try {
      setDismissed(localStorage.getItem(dismissedKey(user.playerId)) === "1");
    } catch {
      setDismissed(false); // if storage is unavailable, err toward showing it once rather than never
    }
  }, [user?.playerId]);

  const dismiss = () => {
    setDismissed(true);
    if (!user?.playerId) return;
    try { localStorage.setItem(dismissedKey(user.playerId), "1"); } catch {}
  };

  const handleEnable = async () => {
    await push.subscribe();
    dismiss();
  };

  const visible = !!user?.playerId && push.supported && push.state === "default" && !dismissed;
  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-4 lg:pb-6 lg:pl-64"
      style={{ pointerEvents: "none" }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          pointerEvents: "auto",
          background: "rgba(8,6,18,0.97)",
          border: "1px solid rgba(255,210,74,0.25)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)",
          backdropFilter: "blur(20px)",
        }}>
        <div className="flex items-start gap-3 p-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,210,74,0.1)", border: "1px solid rgba(255,210,74,0.3)" }}>
            <Bell className="w-4 h-4" style={{ color: "#ffd24a" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontFamily: "Oswald, sans-serif", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.06em", color: "#fff" }}>
              Stay in the loop?
            </div>
            <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.5, marginTop: "4px" }}>
              Get notified the moment results, rank changes and announcements happen — singles, doubles, Shift Wars, all of it — even when you're not in the app.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={handleEnable} disabled={push.loading}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-90 disabled:opacity-60"
                style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", background: "#ffd24a", color: "#1a1400", fontSize: "0.66rem" }}>
                {push.loading ? "…" : "Enable notifications"}
              </button>
              <button onClick={dismiss} disabled={push.loading}
                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:opacity-80"
                style={{ fontFamily: "Oswald, sans-serif", letterSpacing: "0.06em", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)", fontSize: "0.66rem" }}>
                Not now
              </button>
            </div>
          </div>
          <button onClick={dismiss} disabled={push.loading} title="Dismiss"
            className="p-1 rounded-lg shrink-0 transition-colors hover:bg-white/10">
            <X className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.3)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}
