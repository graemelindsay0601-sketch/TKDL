import { useState } from "react";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CollapsibleAdminSection } from "./collapsible-section";

export function DataManagement() {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `tkdl-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: "Full JSON snapshot saved to your device" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
    setExporting(false);
  };

  return (
    <CollapsibleAdminSection title="Data Backup" icon={Download} accent="#6ab0ff">
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Export a full JSON snapshot of all players, matches, seasons, standings, and achievements. Keep regular backups — store externally as insurance against data loss.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm uppercase tracking-wider transition-all active:scale-95 disabled:opacity-50"
          style={{ background: exporting ? "rgba(106,176,255,0.06)" : "rgba(106,176,255,0.12)", border: "1px solid rgba(106,176,255,0.3)", color: "#6ab0ff", fontFamily: "Oswald, sans-serif" }}
        >
          {exporting ? (
            <><div className="w-3.5 h-3.5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: "#6ab0ff" }} />Preparing…</>
          ) : (
            <><Download className="w-3.5 h-3.5" />Download Full Backup</>
          )}
        </button>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.18)" }}>
          Includes all tables: players, matches, seasons, standings, achievements, unlocks
        </p>
      </div>
    </CollapsibleAdminSection>
  );
}
