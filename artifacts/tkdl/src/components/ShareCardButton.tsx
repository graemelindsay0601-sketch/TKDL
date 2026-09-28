import { useState } from "react";
import { Check, LoaderCircle, RefreshCw, Share2 } from "lucide-react";
import { shareCard, type ShareCardSpec } from "@/lib/share-card";

export function ShareCardButton({ spec, filename, label = "Share card", className = "" }: { spec: ShareCardSpec; filename: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  async function run() {
    if (state === "busy") return;
    setState("busy");
    try {
      const result = await shareCard(spec, filename);
      if (result !== "cancelled") {
        setState("done");
        window.setTimeout(() => setState("idle"), 2_000);
      } else setState("idle");
    } catch {
      setState("failed");
    }
  }
  return (
    <button type="button" onClick={() => void run()} disabled={state === "busy"} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider ${className}`}
      style={{ color: state === "done" ? "#22c55e" : state === "failed" ? "#ff4d87" : "#ffd24a", background: state === "done" ? "rgba(34,197,94,.08)" : state === "failed" ? "rgba(255,0,92,.08)" : "rgba(255,210,74,.08)", border: `1px solid ${state === "done" ? "rgba(34,197,94,.28)" : state === "failed" ? "rgba(255,0,92,.28)" : "rgba(255,210,74,.25)"}`, fontFamily: "Oswald, sans-serif" }}>
      {state === "busy" ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : state === "done" ? <Check className="w-3.5 h-3.5" /> : state === "failed" ? <RefreshCw className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
      {state === "busy" ? "Creating…" : state === "done" ? "Ready" : state === "failed" ? "Retry card" : label}
    </button>
  );
}
