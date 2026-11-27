import { PlayCircle, X } from "lucide-react";
import { PmCard } from "@/components/premium/Premium";

/** "Carry on where you left off" card shown when a saved, unfinished game exists. */
export function ResumeMatchCard({ title, players, detail, resumeLabel = "Resume match", onResume, onDiscard }: {
  title: string;
  players: (string | null | undefined)[];
  detail?: string;
  resumeLabel?: string;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const names = players.filter(Boolean).join(" vs ");
  return (
    <PmCard accent="#ffd24a" className="max-w-2xl mx-auto mb-4" style={{ padding: "14px 14px 12px" }}>
      <div className="flex items-start gap-3" style={{ position: "relative", zIndex: 1 }}>
        <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: "radial-gradient(circle at 35% 30%, rgba(255,210,74,.35), rgba(255,210,74,.08))", border: "1px solid rgba(255,210,74,.45)", boxShadow: "0 0 18px rgba(255,210,74,.25)" }}>
          <PlayCircle className="w-5 h-5" style={{ color: "#ffd24a" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[.18em]" style={{ color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>Unfinished game</div>
          <div className="pm-chrome text-lg font-bold uppercase leading-tight truncate" style={{ fontFamily: "Oswald, sans-serif" }}>{title}</div>
          {names && <div className="text-xs truncate" style={{ color: "rgba(255,255,255,.6)" }}>{names}</div>}
          {detail && <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,.4)" }}>{detail}</div>}
        </div>
        <button onClick={onDiscard} aria-label="Discard unfinished game" className="shrink-0 p-1 rounded-full" style={{ color: "rgba(255,255,255,.35)", cursor: "pointer" }}>
          <X className="w-4 h-4" />
        </button>
      </div>
      <button onClick={onResume} className="w-full mt-3 py-2.5 rounded-xl font-bold uppercase tracking-[.14em] text-sm active:scale-[.98]"
        style={{ position: "relative", zIndex: 1, fontFamily: "Oswald, sans-serif", color: "#1a1206", background: "linear-gradient(180deg,#ffe082,#ffc531)", boxShadow: "0 8px 24px -8px rgba(255,197,49,.6)", cursor: "pointer" }}>
        {resumeLabel}
      </button>
    </PmCard>
  );
}
