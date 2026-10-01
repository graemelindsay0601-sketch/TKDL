import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { RotateCcw, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type CorrectionTeam = {
  id: number;
  name: string;
  result: "win" | "loss";
  pointsNow: number;
  pointsAfter: number;
  eloNow?: number;
  eloAfter?: number;
  reactivates?: boolean;
};

type CorrectionPreview = {
  league: "doubles" | "shift_wars";
  kind: "standard" | "combined" | "multi";
  id: number;
  playedAt: string;
  title: string;
  subtitle: string;
  notes?: string | null;
  exact: boolean;
  teams: CorrectionTeam[];
};

export function TeamMatchCorrection({
  league,
  onCorrected,
}: {
  league: "doubles" | "shift_wars";
  onCorrected: () => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<CorrectionPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const label = league === "doubles" ? "Doubles" : "Shift Wars";
  const accent = league === "doubles" ? "#a855f7" : "#0066ff";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/team-match-corrections/${league}/latest`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setPreview(await res.json());
    } catch (err: any) {
      setPreview(null);
      toast({ title: `Could not load ${label} correction`, description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [league, label, toast]);

  useEffect(() => { void load(); }, [load]);

  const undo = async () => {
    if (!preview) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/team-match-corrections/${league}/${preview.kind}/${preview.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      toast({ title: `${label} result undone`, description: "Team balances and records were restored." });
      await onCorrected();
      await load();
    } catch (err: any) {
      toast({ title: "Could not undo result", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${accent}33`, background: `${accent}08` }}>
      <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div>
          <div className="text-xs uppercase tracking-wider font-black flex items-center gap-1.5" style={{ color: accent, fontFamily: "Oswald, sans-serif" }}>
            <ShieldCheck className="w-3.5 h-3.5" /> Latest Result Correction
          </div>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Only the newest result is unlocked, preserving points and match order.</p>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Checking the latest result…</div>
      ) : !preview ? (
        <div className="px-4 py-5 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No current-season {label} result is available to correct.</div>
      ) : (
        <div className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>{preview.title}</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                {preview.subtitle} · {format(new Date(preview.playedAt), "d MMM, HH:mm")}
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider rounded px-2 py-1" style={{ color: preview.kind === "combined" ? "#00c896" : preview.kind === "multi" ? "#ffd24a" : accent, background: preview.kind === "combined" ? "rgba(0,200,150,0.1)" : preview.kind === "multi" ? "rgba(255,210,74,0.1)" : `${accent}14` }}>
              {preview.kind === "combined" ? "Uneven" : preview.kind === "multi" ? "Multi-Team" : "Standard"}
            </span>
          </div>

          <div className="space-y-1.5">
            {preview.teams.map(team => (
              <div key={team.id} className="grid items-center gap-2 rounded px-3 py-2 text-xs" style={{ gridTemplateColumns: "minmax(0,1fr) auto", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.055)" }}>
                <div className="min-w-0">
                  <span className="font-bold truncate block" style={{ color: team.result === "win" ? "#22c55e" : "#ff5a89" }}>{team.name}</span>
                  {team.reactivates && <span className="text-[10px]" style={{ color: "#ffd24a" }}>Team will be reactivated</span>}
                </div>
                <div className="text-right font-mono whitespace-nowrap">
                  <span style={{ color: "rgba(255,255,255,0.38)" }}>{team.pointsNow}</span>
                  <span className="mx-1.5" style={{ color: "rgba(255,255,255,0.18)" }}>→</span>
                  <span style={{ color: "#ffd24a" }}>{team.pointsAfter} pts</span>
                  {team.eloNow !== undefined && team.eloAfter !== undefined && (
                    <span className="ml-2" style={{ color: "rgba(255,255,255,0.35)" }}>Elo {team.eloNow}→{team.eloAfter}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!preview.exact && (
            <div className="flex gap-2 rounded px-3 py-2 text-xs" style={{ background: "rgba(255,210,74,0.07)", color: "rgba(255,230,150,0.75)", border: "1px solid rgba(255,210,74,0.18)" }}>
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              This older result predates exact Elo snapshots. Points and records restore exactly; Elo uses the safest available rollback.
            </div>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={deleting} className="w-full gap-2 font-black uppercase tracking-wider" style={{ background: "#ff005c", border: "none", fontFamily: "Oswald, sans-serif" }}>
                <RotateCcw className="w-4 h-4" /> {deleting ? "Undoing…" : "Undo Latest Result"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent style={{ background: "hsl(240 20% 7%)", borderColor: "rgba(255,0,92,0.3)" }}>
              <AlertDialogHeader>
                <AlertDialogTitle style={{ color: "#ff5a89", fontFamily: "Oswald, sans-serif" }}>Undo this {label} result?</AlertDialogTitle>
                <AlertDialogDescription style={{ color: "rgba(255,255,255,0.55)" }}>
                  {preview.title}. The previewed team points, records{league === "doubles" ? " and Elo" : ""} will be restored and the result removed. This action is recorded in Admin Audit.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Result</AlertDialogCancel>
                <AlertDialogAction onClick={undo} style={{ background: "#ff005c", color: "white", border: "none" }}>Yes, Undo Result</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
