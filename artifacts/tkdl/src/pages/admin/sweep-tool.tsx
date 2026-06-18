import { useState } from "react";
import { Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleAdminSection } from "./collapsible-section";

export function SweepTool() {
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<{ granted: number; playersChecked: number } | null>(null);
  const { toast } = useToast();

  const runSweep = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res  = await fetch("/api/admin/achievement-sweep", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setResult(data);
        toast({ title: `Sweep complete — ${data.granted} achievements unlocked` });
      } else {
        toast({ title: "Sweep failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    }
    setRunning(false);
  };

  return (
    <CollapsibleAdminSection title="Achievement Engine" icon={Zap} accent="#ffd24a">
      <div className="px-4 py-4">
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          Retroactively evaluate all achievements across full match history. Run after importing matches or adding new achievements.
        </p>
        <div className="flex items-center gap-4 flex-wrap">
          <button onClick={runSweep} disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
            style={{ background: running ? "rgba(255,210,74,0.08)" : "rgba(255,210,74,0.15)", border: "1px solid rgba(255,210,74,0.35)", color: "#ffd24a", fontFamily: "Oswald, sans-serif" }}>
            {running ? (
              <><div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#ffd24a" }} />Scanning all players...</>
            ) : (
              <><Zap className="w-3.5 h-3.5" />Run Achievement Sweep</>
            )}
          </button>
          {result && (
            <div className="font-bold text-sm" style={{ fontFamily: "Oswald, sans-serif", color: result.granted > 0 ? "#22c55e" : "rgba(255,255,255,0.35)" }}>
              {result.granted > 0
                ? `✓ ${result.granted} unlocked across ${result.playersChecked} players`
                : `✓ All up to date — ${result.playersChecked} players checked`}
            </div>
          )}
        </div>
      </div>
    </CollapsibleAdminSection>
  );
}
