import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export function CareerBetaReset() {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  async function reset() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/career/reset", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Career reset failed");
      setConfirmation("");
      await queryClient.invalidateQueries({ queryKey: ["career"] });
      toast({ title: "Career beta reset complete", description: `${result.deletedSaves} Career saves deleted.` });
    } catch (error) {
      toast({ title: "Career reset failed", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
    } finally { setBusy(false); }
  }
  return <div className="space-y-2 rounded-lg border border-red-500/30 p-3">
    <h3 className="font-bold">Reset Career beta data</h3>
    <p className="text-sm text-muted-foreground">Permanently deletes every player's Career saves, NPC worlds, calendars, event results, Career finances, sponsors, rankings, Tour Cards and live Career matches. This cannot be undone.</p>
    <p className="text-sm text-muted-foreground">TKDL accounts, league matches and stats, TKDL coins, achievements, M501 and Classic Tour progress are kept. The Career visibility setting is kept.</p>
    <label htmlFor="career-reset-confirmation" className="block text-sm">Type DELETE ALL CAREER SAVES to confirm</label>
    <input id="career-reset-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" className="w-full rounded border bg-background p-2" />
    <button type="button" disabled={busy || confirmation !== "DELETE ALL CAREER SAVES"} onClick={reset} className="rounded bg-red-700 px-3 py-2 text-white disabled:opacity-40">{busy ? "Deleting Career data…" : "Delete all Career beta saves"}</button>
  </div>;
}
