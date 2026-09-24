import { useState, useEffect, useCallback } from "react";

export type PushState = "unsupported" | "default" | "granted" | "denied" | "subscribed";

export function usePushNotifications(playerId: number | null | undefined) {
  const [state, setState] = useState<PushState>("default");
  const [loading, setLoading] = useState(false);

  const supported = typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;

  // Register service worker on mount
  useEffect(() => {
    if (!supported) return;

    navigator.serviceWorker
      .register("/service-worker.js")
      .catch((err) => console.error("Service Worker registration failed:", err));
  }, [supported]);

  // Check subscription status
  useEffect(() => {
    if (!supported || !playerId) return;
    if (Notification.permission === "denied") { setState("denied"); return; }

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) setState("subscribed");
      else setState(Notification.permission === "granted" ? "granted" : "default");
    }).catch(() => setState("default"));
  }, [supported, playerId]);

  // Returns the state subscribing actually landed on, so a caller (e.g.
  // NotificationOptInPrompt) can tell a real success/decline apart from an
  // unexpected failure — see that component for why the distinction
  // matters: treating every outcome the same silently and permanently
  // dismissed the one-time opt-in prompt even when subscribing had failed,
  // leaving the player with no visible way to retry.
  const subscribe = useCallback(async (): Promise<PushState> => {
    if (!supported || !playerId) return "unsupported";
    setLoading(true);
    try {
      const keyRes = await fetch("/api/notifications/vapid-public-key");
      if (!keyRes.ok) { setState("default"); return "default"; }
      const { publicKey, enabled } = await keyRes.json() as { publicKey: string; enabled?: boolean };
      if (!publicKey || enabled === false) {
        // Server has no VAPID key configured — subscribing would only
        // throw once we call pushManager.subscribe() below. Bail out
        // before asking for OS permission at all, so a config problem on
        // our end never shows the player a permission prompt for
        // something that can't actually work yet.
        setState("default");
        return "default";
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState("denied"); return "denied"; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const r = await fetch("/api/notifications/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (r.ok) { setState("subscribed"); return "subscribed"; }
      setState("default");
      return "default";
    } catch {
      setState("default");
      return "default";
    } finally { setLoading(false); }
  }, [supported, playerId]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Send this device's own endpoint so the server only removes THIS
        // subscription — without it, the server used to (and, for an old
        // cached client that hasn't picked this up yet, still would) delete
        // every device this player has ever subscribed from, silently
        // signing them out of push on a phone just because notifications
        // got toggled off on a desktop browser.
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setState("default");
    } catch {}
    finally { setLoading(false); }
  }, [supported]);

  return { state, loading, supported, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}
