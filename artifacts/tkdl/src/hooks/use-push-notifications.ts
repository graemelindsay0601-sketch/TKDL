import { useState, useEffect, useCallback } from "react";

export type PushState = "unsupported" | "default" | "granted" | "denied" | "subscribed";

export function usePushNotifications(playerId: number | null | undefined) {
  const [state, setState] = useState<PushState>("default");
  const [loading, setLoading] = useState(false);

  const supported = typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;

  useEffect(() => {
    if (!supported || !playerId) return;
    if (Notification.permission === "denied") { setState("denied"); return; }

    navigator.serviceWorker.ready.then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      if (sub) setState("subscribed");
      else setState(Notification.permission === "granted" ? "granted" : "default");
    }).catch(() => setState("default"));
  }, [supported, playerId]);

  const subscribe = useCallback(async () => {
    if (!supported || !playerId) return;
    setLoading(true);
    try {
      const keyRes = await fetch("/api/notifications/vapid-public-key");
      if (!keyRes.ok) return;
      const { publicKey } = await keyRes.json() as { publicKey: string };

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState("denied"); return; }

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
      if (r.ok) setState("subscribed");
    } catch { setState("default"); }
    finally { setLoading(false); }
  }, [supported, playerId]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await fetch("/api/notifications/subscribe", { method: "DELETE", credentials: "include" });
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
