import { useEffect, useState } from "react";
import { Check, Download, Image, LoaderCircle, RefreshCw, Share2 } from "lucide-react";
import { downloadRenderedCard, renderShareCard, shareRenderedCard, type ShareCardSpec } from "@/lib/share-card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ShareCardButton({ spec, filename, label = "Share card", className = "", render }: { spec: ShareCardSpec; filename: string; label?: string; className?: string; render?: () => Promise<Blob> }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const [preview, setPreview] = useState<{ blob: Blob; url: string } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  async function run() {
    if (state === "busy") return;
    setState("busy");
    try {
      // `render` lets a caller swap in its own canvas renderer (see
      // pages/poster-library.tsx, which draws a dedicated poster graphic)
      // while reusing this component's preview/share/download dialog as-is.
      // spec is still used below for the Web Share title/text regardless of
      // which renderer actually produced the pixels.
      const blob = await (render ? render() : renderShareCard(spec));
      const url = URL.createObjectURL(blob);
      setPreview(current => { if (current) URL.revokeObjectURL(current.url); return { blob, url }; });
      setOpen(true);
      setState("done");
    } catch {
      setState("failed");
    }
  }
  async function share() {
    if (!preview) return;
    setState("busy");
    try {
      const result = await shareRenderedCard(preview.blob, spec, filename);
      setState(result === "cancelled" ? "done" : "done");
    } catch { setState("failed"); }
  }
  return (
    <>
      <button type="button" onClick={() => void run()} disabled={state === "busy"} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider ${className}`}
        style={{ color: state === "done" ? "#22c55e" : state === "failed" ? "#ff4d87" : "#ffd24a", background: state === "done" ? "rgba(34,197,94,.08)" : state === "failed" ? "rgba(255,0,92,.08)" : "rgba(255,210,74,.08)", border: `1px solid ${state === "done" ? "rgba(34,197,94,.28)" : state === "failed" ? "rgba(255,0,92,.28)" : "rgba(255,210,74,.25)"}`, fontFamily: "Oswald, sans-serif" }}>
        {state === "busy" ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : state === "done" ? <Image className="w-3.5 h-3.5" /> : state === "failed" ? <RefreshCw className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
        {state === "busy" ? "Creating…" : state === "done" ? "View poster" : state === "failed" ? "Retry poster" : label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl border-white/10 bg-[#080711] p-3 sm:p-5">
          <DialogHeader className="pr-8 text-left">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#ff005c]"><span className="h-2 w-2 rounded-full bg-[#ff005c] shadow-[0_0_12px_#ff005c]"/>TKDL Media Studio</div>
            <DialogTitle className="font-black uppercase text-white" style={{ fontFamily: "Oswald, sans-serif" }}>Your match poster is ready</DialogTitle>
            <DialogDescription>Preview the full image, then share it or save the PNG to your device.</DialogDescription>
          </DialogHeader>
          {preview && <div className="overflow-hidden rounded-xl border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,.55)]"><img src={preview.url} alt={`${spec.title} match poster`} className="block h-auto w-full" /></div>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => void share()} disabled={!preview || state === "busy"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#ff005c] px-4 py-3 text-xs font-black uppercase tracking-wider text-white disabled:opacity-50" style={{ fontFamily: "Oswald, sans-serif" }}><Share2 className="h-4 w-4"/>{state === "busy" ? "Opening share…" : "Share poster"}</button>
            <button type="button" onClick={() => preview && downloadRenderedCard(preview.blob, filename)} disabled={!preview} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#ffd24a]/30 bg-[#ffd24a]/10 px-4 py-3 text-xs font-black uppercase tracking-wider text-[#ffd24a] disabled:opacity-50" style={{ fontFamily: "Oswald, sans-serif" }}><Download className="h-4 w-4"/>Download PNG</button>
          </div>
          <div className="flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-[11px] text-white/35"><Check className="h-3.5 w-3.5 text-green-500"/>1200 × 630, ready for messages and social posts</div>
            <DialogClose className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-white/65" style={{ fontFamily: "Oswald, sans-serif" }}>Close poster</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
