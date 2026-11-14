import type { ChatEvent } from "../api";

/** Which chat events take over the overlay chip for a moment: overlay alerts, subs and super chats. */
export const isHudAlert = (e: ChatEvent) => e.kind === "ALERT" || e.kind === "SUB" || e.kind === "SUPERCHAT";

/** The short line an alert shows on the chip (kept short: the chip sits in a narrow corner on phones). */
export function hudAlertText(e: ChatEvent): string {
  switch (e.kind) {
    case "ALERT": return e.alert === "REQUEST_IN" ? `📩 Request from ${e.user ?? "chat"}` : e.alert === "REQUEST" ? `✅ ${e.text}` : e.alert === "TRAIN" ? `🚂 ${e.text}`
      : e.alert === "TRAIN_END" ? `🚂 ${e.text}` : e.alert === "PREDICTION" ? `🔮 ${e.text}` : e.alert === "MILESTONE" ? `🎉 ${e.text}` : e.text;
    case "SUB": return `⭐ ${e.user} subscribed!`;
    case "SUPERCHAT": return `💬 ${e.user}: £${(e.pence / 100).toFixed(2)}`;
    default: return "";
  }
}
